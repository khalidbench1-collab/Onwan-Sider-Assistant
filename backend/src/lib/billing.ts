import { Firestore, FieldValue, Timestamp } from "@google-cloud/firestore";
import type { AppConfig } from "../config.js";
import { computeExpiresAt } from "./term.js";

export type EventOutcome = "applied" | "ignored" | "unmatched";

export interface PilotPayment {
  eventId: string;
  emailHash: string;
  checkoutSessionId: string | null;
  stripeCustomerId: string | null;
  amountTotal: number | null;
  currency: string | null;
}

export interface PaymentResult {
  outcome: "applied" | "unmatched";
  licenseId: string | null;
}

export interface BillingStore {
  /** False when this event id was already recorded, which makes replays free. */
  claimEvent(eventId: string, type: string): Promise<boolean>;
  finishEvent(eventId: string, outcome: EventOutcome, licenseId?: string | null): Promise<void>;
  applyPilotPayment(payment: PilotPayment): Promise<PaymentResult>;
}

export class FirestoreBillingStore implements BillingStore {
  private readonly db: Firestore;

  constructor(private readonly config: AppConfig, db?: Firestore) {
    this.db = db || new Firestore({ projectId: config.GOOGLE_CLOUD_PROJECT });
  }

  private collection(name: string): string {
    return `${this.config.ONWAN_DATA_NAMESPACE}_${name}`;
  }

  async claimEvent(eventId: string, type: string): Promise<boolean> {
    try {
      await this.db.collection(this.collection("stripe_events")).doc(eventId).create({
        type,
        outcome: null,
        licenseId: null,
        receivedAt: FieldValue.serverTimestamp(),
      });
      return true;
    } catch {
      // create() fails with ALREADY_EXISTS, which is exactly the replay signal.
      return false;
    }
  }

  async finishEvent(
    eventId: string,
    outcome: EventOutcome,
    licenseId: string | null = null,
  ): Promise<void> {
    await this.db.collection(this.collection("stripe_events")).doc(eventId).update({
      outcome,
      licenseId,
      processedAt: FieldValue.serverTimestamp(),
    });
  }

  async applyPilotPayment(payment: PilotPayment): Promise<PaymentResult> {
    const matches = await this.db
      .collection(this.collection("licenses"))
      .where("emailHash", "==", payment.emailHash)
      .limit(5)
      .get();
    const target = matches.docs.find((candidate) => !candidate.data().paidAt);
    if (!target) {
      await this.db
        .collection(this.collection("unmatched_payments"))
        .doc(payment.eventId)
        .create({
          emailHash: payment.emailHash,
          checkoutSessionId: payment.checkoutSessionId,
          stripeCustomerId: payment.stripeCustomerId,
          amountTotal: payment.amountTotal,
          currency: payment.currency,
          ts: FieldValue.serverTimestamp(),
        });
      return { outcome: "unmatched", licenseId: null };
    }

    const paidAt = new Date();
    await this.db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(target.ref);
      const data = fresh.data() || {};
      if (data.paidAt) return;
      const termDays = Number(data.termDays || this.config.PILOT_TERM_DAYS);
      const update: Record<string, unknown> = {
        paidAt: Timestamp.fromDate(paidAt),
        termDays,
        source: "pilot_checkout",
        stripeCustomerId: payment.stripeCustomerId,
        checkoutSessionId: payment.checkoutSessionId,
        updatedAt: FieldValue.serverTimestamp(),
      };
      // Only set when the licence is already activated; otherwise activation sets it.
      const expiresAt = computeExpiresAt(data.activatedAt, paidAt, termDays);
      if (expiresAt) update.expiresAt = Timestamp.fromDate(expiresAt);
      transaction.update(target.ref, update);
    });
    return { outcome: "applied", licenseId: target.id };
  }
}
