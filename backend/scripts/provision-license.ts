import { createHash, randomBytes } from "node:crypto";
import { Firestore, FieldValue } from "@google-cloud/firestore";
import { loadConfig } from "../src/config.js";
import { hashIdentityValue } from "../src/lib/identity.js";

const [emailArg, creditsArg] = process.argv.slice(2);
if (!emailArg) {
  throw new Error("Usage: npm run provision-license -- customer@example.com [credits]");
}
const email = emailArg.toLowerCase().trim();

const config = loadConfig();
const credits = Number(creditsArg || config.PILOT_CREDITS);
if (!Number.isInteger(credits) || credits < 1) throw new Error("Credits must be a positive integer.");

const db = new Firestore({ projectId: config.GOOGLE_CLOUD_PROJECT });
const code = `ONWAN-${randomBytes(12).toString("base64url").toUpperCase()}`;
const emailHash = hashIdentityValue(email, config.ONWAN_ID_HASH_SALT);
// Licence codes are hashed without a salt, byte-identical to codeDigest in
// lib/entitlement.ts. Do not switch this to hashIdentityValue.
const codeHash = createHash("sha256").update(code.trim().toUpperCase(), "utf8").digest("hex");

const licenseRef = db.collection(`${config.ONWAN_DATA_NAMESPACE}_licenses`).doc();
const ledgerRef = db.collection(`${config.ONWAN_DATA_NAMESPACE}_credit_ledger`).doc();
const batch = db.batch();
batch.create(licenseRef, {
  codeHash,
  emailHash,
  uidHash: null,
  status: "provisioned",
  plan: "pro",
  creditsRemaining: credits,
  creditsMonthly: credits,
  termDays: config.PILOT_TERM_DAYS,
  activatedAt: null,
  paidAt: null,
  expiresAt: null,
  source: "manual",
  createdAt: FieldValue.serverTimestamp(),
});
// The grant belongs where the credits are created. The Stripe webhook records
// payment facts and never moves a balance.
batch.create(ledgerRef, {
  licenseId: licenseRef.id,
  type: "grant",
  amount: credits,
  balanceAfter: credits,
  actionId: null,
  clientRequestId: null,
  ts: FieldValue.serverTimestamp(),
});
await batch.commit();
process.stdout.write(`${code}\n`);
