import { createHash, randomBytes } from "node:crypto";
import { Firestore, FieldValue, Timestamp } from "@google-cloud/firestore";
import { ApiError } from "../errors.js";
import type { AppConfig } from "../config.js";
import { computeExpiresAt, isExpired, toIso, type TimeLike } from "./term.js";
import type { BillingStore, EventOutcome, PaymentResult, PilotPayment } from "./billing.js";
import type {
  AuthenticatedUser,
  Entitlement,
  Plan,
  UsageReservation,
} from "../types.js";

export type LedgerEntryType = "grant" | "reserve" | "consume" | "refund";

export interface LedgerEntry {
  licenseId: string;
  type: LedgerEntryType;
  amount: number;
  balanceAfter: number;
  actionId: string | null;
  clientRequestId: string | null;
}

/**
 * The limit is configurable, so the message must not spell it out. It read "your three free actions"
 * for as long as the limit happened to be three, and would have quietly started lying the moment it
 * changed. Apps Script shows its own localized string for FREE_LIMIT; this one reaches API clients
 * and logs.
 */
function freeLimitMessage(limit: number): string {
  return `You have used all ${limit} of your free actions.`;
}

export interface EntitlementStore {
  entitlement(user: AuthenticatedUser): Promise<Entitlement>;
  activate(user: AuthenticatedUser, code: string): Promise<Entitlement>;
  reserve(
    user: AuthenticatedUser,
    clientRequestId: string,
    cost: number,
    actionId?: string,
  ): Promise<UsageReservation>;
  consume(reservation: UsageReservation): Promise<Entitlement>;
  refund(reservation: UsageReservation): Promise<void>;
}

function codeDigest(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase(), "utf8").digest("hex");
}

function requestDigest(user: AuthenticatedUser, clientRequestId: string): string {
  return createHash("sha256")
    .update(`${user.uidHash}:${clientRequestId}`, "utf8")
    .digest("hex");
}

interface LicenseFacts {
  status?: unknown;
  expiresAt?: TimeLike;
}

function activeLicense(data: LicenseFacts, now: Date = new Date()): boolean {
  if (data.status !== "active" && data.status !== "provisioned") return false;
  return !isExpired(data.expiresAt, now);
}

export class FirestoreEntitlementStore implements EntitlementStore {
  private readonly db: Firestore;

  constructor(private readonly config: AppConfig, db?: Firestore) {
    this.db = db || new Firestore({ projectId: config.GOOGLE_CLOUD_PROJECT });
  }

  private collection(name: string): string {
    return `${this.config.ONWAN_DATA_NAMESPACE}_${name}`;
  }

  /** Always called inside the same transaction as the balance change it describes. */
  private appendLedger(
    transaction: FirebaseFirestore.Transaction,
    entry: LedgerEntry,
  ): void {
    const ref = this.db.collection(this.collection("credit_ledger")).doc();
    transaction.create(ref, {
      licenseId: entry.licenseId,
      type: entry.type,
      amount: entry.amount,
      balanceAfter: entry.balanceAfter,
      actionId: entry.actionId,
      clientRequestId: entry.clientRequestId,
      ts: FieldValue.serverTimestamp(),
    });
  }

  /**
   * Fields written when a licence becomes bound to a Google identity, by either
   * route: the email auto-match in findLicense or an explicit code activation.
   * An already-activated licence keeps its original activatedAt so re-activation
   * can never restart the paid term.
   */
  private activationFields(
    data: FirebaseFirestore.DocumentData,
    user: AuthenticatedUser,
    now: Date = new Date(),
  ): Record<string, unknown> {
    const termDays = Number(data.termDays || this.config.PILOT_TERM_DAYS);
    const fields: Record<string, unknown> = {
      uidHash: user.uidHash,
      emailHash: user.emailHash,
      status: "active",
      termDays,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (data.activatedAt) return fields;
    fields.activatedAt = Timestamp.fromDate(now);
    const expiresAt = computeExpiresAt(now, data.paidAt, termDays);
    if (expiresAt) fields.expiresAt = Timestamp.fromDate(expiresAt);
    return fields;
  }

  private async findLicense(user: AuthenticatedUser): Promise<{
    id: string;
    data: FirebaseFirestore.DocumentData;
  } | null> {
    const licenses = this.db.collection(this.collection("licenses"));
    let snapshot = await licenses.where("uidHash", "==", user.uidHash).limit(1).get();
    if (snapshot.empty && user.emailHash) {
      const emailMatches = await licenses
        .where("emailHash", "==", user.emailHash)
        .limit(5)
        .get();
      const match = emailMatches.docs.find((candidate) => !candidate.data().uidHash);
      if (match) {
        const fields = this.activationFields(match.data(), user);
        await match.ref.update(fields);
        return { id: match.id, data: { ...match.data(), ...fields } };
      }
    }
    if (snapshot.empty) return null;
    const match = snapshot.docs[0]!;
    return { id: match.id, data: match.data() };
  }

  async entitlement(user: AuthenticatedUser): Promise<Entitlement> {
    const now = new Date();
    const license = await this.findLicense(user);
    if (license && activeLicense(license.data, now)) {
      return {
        plan: "pro",
        status: license.data.status,
        freeActionsRemaining: 0,
        creditsRemaining: Number(license.data.creditsRemaining || 0),
        renewsAt:
          license.data.currentPeriodEnd instanceof Timestamp
            ? license.data.currentPeriodEnd.toDate().toISOString()
            : license.data.currentPeriodEnd || null,
        expiresAt: toIso(license.data.expiresAt),
        licenseId: license.id,
      };
    }
    const expired = Boolean(license && isExpired(license.data.expiresAt, now));
    const userDoc = await this.db.collection(this.collection("users")).doc(user.uidHash).get();
    const used = Number(userDoc.data()?.freeActionsUsed || 0);
    const reserved = Number(userDoc.data()?.freeActionsReserved || 0);
    return {
      plan: "free",
      status: expired ? "expired" : "free",
      freeActionsRemaining: Math.max(0, this.config.FREE_ACTION_LIMIT - used - reserved),
      creditsRemaining: null,
      renewsAt: null,
      expiresAt: expired ? toIso(license!.data.expiresAt) : null,
      licenseId: expired ? license!.id : null,
    };
  }

  async activate(user: AuthenticatedUser, code: string): Promise<Entitlement> {
    const normalized = code.trim().toUpperCase();
    if (!/^ONWAN-[A-Z0-9-]{8,}$/.test(normalized)) {
      throw new ApiError(400, "INVALID_LICENSE", "The licence code is not valid.");
    }
    const snapshot = await this.db
      .collection(this.collection("licenses"))
      .where("codeHash", "==", codeDigest(normalized))
      .limit(1)
      .get();
    if (snapshot.empty) throw new ApiError(404, "INVALID_LICENSE", "The licence code was not found.");
    const license = snapshot.docs[0]!;
    await this.db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(license.ref);
      const data = fresh.data() || {};
      if (data.uidHash && data.uidHash !== user.uidHash) {
        throw new ApiError(409, "LICENSE_BOUND", "This licence belongs to another Google account.");
      }
      if (isExpired(data.expiresAt)) {
        throw new ApiError(403, "LICENSE_EXPIRED", "This pilot licence has ended.");
      }
      if (!activeLicense(data)) {
        throw new ApiError(403, "LICENSE_INACTIVE", "This licence is not active.");
      }
      transaction.update(license.ref, this.activationFields(data, user));
    });
    return this.entitlement(user);
  }

  async reserve(
    user: AuthenticatedUser,
    clientRequestId: string,
    cost: number,
    actionId?: string,
  ): Promise<UsageReservation> {
    const id = requestDigest(user, clientRequestId);
    const reservations = this.db.collection(this.collection("usage_reservations"));
    const reservationRef = reservations.doc(id);
    const currentEntitlement = await this.entitlement(user);
    const reservation: UsageReservation = {
      id,
      uidHash: user.uidHash,
      plan: currentEntitlement.plan,
      cost,
      licenseId: currentEntitlement.licenseId,
      status: "reserved",
    };

    await this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(reservationRef);
      if (existing.exists) {
        throw new ApiError(409, "DUPLICATE_REQUEST", "This request was already processed.");
      }
      if (reservation.plan === "free") {
        const userRef = this.db.collection(this.collection("users")).doc(user.uidHash);
        const userSnapshot = await transaction.get(userRef);
        const data = userSnapshot.data() || {};
        const used = Number(data.freeActionsUsed || 0);
        const pending = Number(data.freeActionsReserved || 0);
        if (used + pending >= this.config.FREE_ACTION_LIMIT) {
          throw new ApiError(402, "FREE_LIMIT", freeLimitMessage(this.config.FREE_ACTION_LIMIT));
        }
        transaction.set(
          userRef,
          {
            emailHash: user.emailHash,
            createdAt: data.createdAt || FieldValue.serverTimestamp(),
            freeActionsUsed: used,
            freeActionsReserved: pending + 1,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      } else {
        const licenseRef = this.db
          .collection(this.collection("licenses"))
          .doc(reservation.licenseId!);
        const licenseSnapshot = await transaction.get(licenseRef);
        const data = licenseSnapshot.data() || {};
        if (!activeLicense(data)) {
          throw new ApiError(403, "SUSPENDED", "The licence is not active.");
        }
        const balance = Number(data.creditsRemaining || 0);
        if (balance < cost) {
          throw new ApiError(402, "INSUFFICIENT_CREDITS", "There are not enough credits.");
        }
        const balanceAfter = balance - cost;
        transaction.update(licenseRef, {
          creditsRemaining: balanceAfter,
          updatedAt: FieldValue.serverTimestamp(),
        });
        this.appendLedger(transaction, {
          licenseId: reservation.licenseId!,
          type: "reserve",
          amount: -cost,
          balanceAfter,
          actionId: actionId ?? null,
          clientRequestId,
        });
      }
      transaction.create(reservationRef, {
        ...reservation,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return reservation;
  }

  async consume(reservation: UsageReservation): Promise<Entitlement> {
    const reservationRef = this.db
      .collection(this.collection("usage_reservations"))
      .doc(reservation.id);
    await this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(reservationRef);
      if (!existing.exists || existing.data()?.status !== "reserved") return;
      if (reservation.plan === "free") {
        const userRef = this.db.collection(this.collection("users")).doc(reservation.uidHash);
        const userSnapshot = await transaction.get(userRef);
        const data = userSnapshot.data() || {};
        transaction.set(
          userRef,
          {
            freeActionsUsed: Number(data.freeActionsUsed || 0) + 1,
            freeActionsReserved: Math.max(0, Number(data.freeActionsReserved || 0) - 1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      } else if (reservation.licenseId) {
        const licenseRef = this.db
          .collection(this.collection("licenses"))
          .doc(reservation.licenseId);
        const licenseSnapshot = await transaction.get(licenseRef);
        // The balance moved at reserve; this row distinguishes a reservation
        // that was spent from one that was refunded.
        this.appendLedger(transaction, {
          licenseId: reservation.licenseId,
          type: "consume",
          amount: 0,
          balanceAfter: Number(licenseSnapshot.data()?.creditsRemaining || 0),
          actionId: null,
          clientRequestId: null,
        });
      }
      transaction.update(reservationRef, {
        status: "consumed",
        completedAt: FieldValue.serverTimestamp(),
      });
    });
    return this.entitlement({
      sub: "",
      email: "",
      uidHash: reservation.uidHash,
      emailHash: "",
    });
  }

  async refund(reservation: UsageReservation): Promise<void> {
    const reservationRef = this.db
      .collection(this.collection("usage_reservations"))
      .doc(reservation.id);
    await this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(reservationRef);
      if (!existing.exists || existing.data()?.status !== "reserved") return;
      if (reservation.plan === "free") {
        const userRef = this.db.collection(this.collection("users")).doc(reservation.uidHash);
        const userSnapshot = await transaction.get(userRef);
        const pending = Number(userSnapshot.data()?.freeActionsReserved || 0);
        transaction.set(
          userRef,
          {
            freeActionsReserved: Math.max(0, pending - 1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      } else if (reservation.licenseId) {
        const licenseRef = this.db
          .collection(this.collection("licenses"))
          .doc(reservation.licenseId);
        const licenseSnapshot = await transaction.get(licenseRef);
        const balanceAfter =
          Number(licenseSnapshot.data()?.creditsRemaining || 0) + reservation.cost;
        transaction.update(licenseRef, {
          creditsRemaining: balanceAfter,
          updatedAt: FieldValue.serverTimestamp(),
        });
        this.appendLedger(transaction, {
          licenseId: reservation.licenseId,
          type: "refund",
          amount: reservation.cost,
          balanceAfter,
          actionId: null,
          clientRequestId: null,
        });
      }
      transaction.update(reservationRef, {
        status: "refunded",
        completedAt: FieldValue.serverTimestamp(),
      });
    });
  }
}

interface MemoryUser {
  used: number;
  reserved: number;
}

interface MemoryLicense {
  id: string;
  codeHash: string;
  uidHash: string | null;
  emailHash: string | null;
  status: "provisioned" | "active" | "suspended" | "cancelled";
  creditsRemaining: number;
  activatedAt: Date | null;
  paidAt: Date | null;
  expiresAt: Date | null;
  termDays: number;
}

export class MemoryEntitlementStore implements EntitlementStore {
  private readonly users = new Map<string, MemoryUser>();
  private readonly licenses = new Map<string, MemoryLicense>();
  private readonly reservations = new Map<string, UsageReservation>();
  readonly ledger: LedgerEntry[] = [];
  readonly stripeEvents = new Map<string, { type: string; outcome: EventOutcome | null }>();
  readonly unmatchedPayments: PilotPayment[] = [];

  /** A billing store sharing this instance's licences, so tests can span pay -> unlock. */
  billing(): BillingStore {
    const store = this;
    return {
      async claimEvent(eventId: string, type: string): Promise<boolean> {
        if (store.stripeEvents.has(eventId)) return false;
        store.stripeEvents.set(eventId, { type, outcome: null });
        return true;
      },
      async finishEvent(eventId: string, outcome: EventOutcome): Promise<void> {
        const record = store.stripeEvents.get(eventId);
        if (record) record.outcome = outcome;
      },
      async applyPilotPayment(payment: PilotPayment): Promise<PaymentResult> {
        const target = [...store.licenses.values()].find(
          (candidate) => candidate.emailHash === payment.emailHash && !candidate.paidAt,
        );
        if (!target) {
          store.unmatchedPayments.push(payment);
          return { outcome: "unmatched", licenseId: null };
        }
        target.paidAt = new Date();
        target.expiresAt = computeExpiresAt(target.activatedAt, target.paidAt, target.termDays);
        return { outcome: "applied", licenseId: target.id };
      },
    };
  }

  constructor(
    private readonly freeLimit = 3,
    private readonly defaultTermDays = 30,
  ) {}

  provision(options: {
    code?: string;
    uidHash?: string;
    emailHash?: string;
    credits?: number;
    activatedAt?: Date | null;
    paidAt?: Date | null;
    termDays?: number;
  } = {}): string {
    const code = options.code || `ONWAN-${randomBytes(8).toString("hex").toUpperCase()}`;
    const id = randomBytes(8).toString("hex");
    const termDays = options.termDays ?? this.defaultTermDays;
    const activatedAt = options.activatedAt ?? null;
    const paidAt = options.paidAt ?? null;
    this.licenses.set(id, {
      id,
      codeHash: codeDigest(code),
      uidHash: options.uidHash || null,
      emailHash: options.emailHash || null,
      status: options.uidHash ? "active" : "provisioned",
      creditsRemaining: options.credits ?? 200,
      activatedAt,
      paidAt,
      expiresAt: computeExpiresAt(activatedAt, paidAt, termDays),
      termDays,
    });
    return code;
  }

  private bind(license: MemoryLicense, user: AuthenticatedUser, now = new Date()): void {
    license.uidHash = user.uidHash;
    license.emailHash = user.emailHash || license.emailHash;
    license.status = "active";
    if (!license.activatedAt) {
      license.activatedAt = now;
      license.expiresAt = computeExpiresAt(now, license.paidAt, license.termDays);
    }
  }

  async entitlement(user: AuthenticatedUser): Promise<Entitlement> {
    const now = new Date();
    const license = [...this.licenses.values()].find(
      (candidate) =>
        candidate.uidHash === user.uidHash ||
        (!candidate.uidHash && candidate.emailHash && candidate.emailHash === user.emailHash),
    );
    if (license && activeLicense(license, now)) {
      if (!license.uidHash) this.bind(license, user, now);
      return {
        plan: "pro",
        status: license.status,
        freeActionsRemaining: 0,
        creditsRemaining: license.creditsRemaining,
        renewsAt: null,
        expiresAt: toIso(license.expiresAt),
        licenseId: license.id,
      };
    }
    const expired = Boolean(license && isExpired(license.expiresAt, now));
    const record = this.users.get(user.uidHash) || { used: 0, reserved: 0 };
    return {
      plan: "free",
      status: expired ? "expired" : "free",
      freeActionsRemaining: Math.max(0, this.freeLimit - record.used - record.reserved),
      creditsRemaining: null,
      renewsAt: null,
      expiresAt: expired ? toIso(license!.expiresAt) : null,
      licenseId: expired ? license!.id : null,
    };
  }

  async activate(user: AuthenticatedUser, code: string): Promise<Entitlement> {
    const license = [...this.licenses.values()].find(
      (candidate) => candidate.codeHash === codeDigest(code),
    );
    if (!license) throw new ApiError(404, "INVALID_LICENSE", "The licence code was not found.");
    if (license.uidHash && license.uidHash !== user.uidHash) {
      throw new ApiError(409, "LICENSE_BOUND", "This licence belongs to another Google account.");
    }
    if (isExpired(license.expiresAt)) {
      throw new ApiError(403, "LICENSE_EXPIRED", "This pilot licence has ended.");
    }
    this.bind(license, user);
    return this.entitlement(user);
  }

  async reserve(
    user: AuthenticatedUser,
    clientRequestId: string,
    cost: number,
    actionId?: string,
  ): Promise<UsageReservation> {
    const id = requestDigest(user, clientRequestId);
    if (this.reservations.has(id)) {
      throw new ApiError(409, "DUPLICATE_REQUEST", "This request was already processed.");
    }
    const entitlement = await this.entitlement(user);
    if (entitlement.plan === "free") {
      const record = this.users.get(user.uidHash) || { used: 0, reserved: 0 };
      if (record.used + record.reserved >= this.freeLimit) {
        throw new ApiError(402, "FREE_LIMIT", freeLimitMessage(this.freeLimit));
      }
      record.reserved += 1;
      this.users.set(user.uidHash, record);
    } else {
      const license = this.licenses.get(entitlement.licenseId!);
      if (!license || license.creditsRemaining < cost) {
        throw new ApiError(402, "INSUFFICIENT_CREDITS", "There are not enough credits.");
      }
      license.creditsRemaining -= cost;
      this.ledger.push({
        licenseId: license.id,
        type: "reserve",
        amount: -cost,
        balanceAfter: license.creditsRemaining,
        actionId: actionId ?? null,
        clientRequestId,
      });
    }
    const reservation: UsageReservation = {
      id,
      uidHash: user.uidHash,
      plan: entitlement.plan,
      cost,
      licenseId: entitlement.licenseId,
      status: "reserved",
    };
    this.reservations.set(id, reservation);
    return reservation;
  }

  async consume(reservation: UsageReservation): Promise<Entitlement> {
    const saved = this.reservations.get(reservation.id);
    if (saved?.status === "reserved") {
      saved.status = "consumed";
      if (saved.plan === "free") {
        const record = this.users.get(saved.uidHash)!;
        record.reserved -= 1;
        record.used += 1;
      } else if (saved.licenseId) {
        this.ledger.push({
          licenseId: saved.licenseId,
          type: "consume",
          amount: 0,
          balanceAfter: this.licenses.get(saved.licenseId)?.creditsRemaining ?? 0,
          actionId: null,
          clientRequestId: null,
        });
      }
    }
    return this.entitlement({
      sub: "",
      email: "",
      uidHash: reservation.uidHash,
      emailHash: "",
    });
  }

  async refund(reservation: UsageReservation): Promise<void> {
    const saved = this.reservations.get(reservation.id);
    if (!saved || saved.status !== "reserved") return;
    saved.status = "refunded";
    if (saved.plan === "free") {
      const record = this.users.get(saved.uidHash)!;
      record.reserved = Math.max(0, record.reserved - 1);
    } else if (saved.licenseId) {
      const license = this.licenses.get(saved.licenseId);
      if (license) {
        license.creditsRemaining += saved.cost;
        this.ledger.push({
          licenseId: license.id,
          type: "refund",
          amount: saved.cost,
          balanceAfter: license.creditsRemaining,
          actionId: null,
          clientRequestId: null,
        });
      }
    }
  }
}
