import { describe, expect, it } from "vitest";
import { MemoryEntitlementStore } from "../src/lib/entitlement.js";
import type { AuthenticatedUser } from "../src/types.js";

const user: AuthenticatedUser = {
  sub: "google-sub",
  email: "journalist@example.com",
  uidHash: "uid-hash",
  emailHash: "email-hash",
};

function payment(overrides: Record<string, unknown> = {}) {
  return {
    eventId: "evt_1",
    emailHash: "email-hash",
    checkoutSessionId: "cs_1",
    stripeCustomerId: "cus_1",
    amountTotal: 2900,
    currency: "usd",
    ...overrides,
  };
}

describe("billing store", () => {
  it("claims an event once and rejects the replay", async () => {
    const billing = new MemoryEntitlementStore().billing();
    expect(await billing.claimEvent("evt_1", "checkout.session.completed")).toBe(true);
    expect(await billing.claimEvent("evt_1", "checkout.session.completed")).toBe(false);
  });

  it("marks a matching licence paid and starts the term once activated", async () => {
    const store = new MemoryEntitlementStore(3, 30);
    store.provision({ code: "ONWAN-PAY-1", emailHash: "email-hash", credits: 200 });
    const billing = store.billing();

    const result = await billing.applyPilotPayment(payment());
    expect(result.outcome).toBe("applied");
    expect(result.licenseId).toBeTruthy();

    // The customer's first sidebar load binds the licence by email and starts the term.
    const entitlement = await store.entitlement(user);
    expect(entitlement.plan).toBe("pro");
    expect(entitlement.expiresAt).toBeTruthy();
  });

  it("does not move the credit balance", async () => {
    const store = new MemoryEntitlementStore(3, 30);
    store.provision({ code: "ONWAN-PAY-2", emailHash: "email-hash", credits: 200 });
    const billing = store.billing();
    await billing.applyPilotPayment(payment());
    const entitlement = await store.entitlement(user);
    expect(entitlement.creditsRemaining).toBe(200);
    expect(store.ledger).toHaveLength(0);
  });

  it("records an unmatched payment when no licence carries that email hash", async () => {
    const store = new MemoryEntitlementStore(3, 30);
    const billing = store.billing();
    const result = await billing.applyPilotPayment(payment({ emailHash: "nobody" }));
    expect(result.outcome).toBe("unmatched");
    expect(result.licenseId).toBeNull();
    expect(store.unmatchedPayments).toHaveLength(1);
  });

  it("never applies a second payment to an already paid licence", async () => {
    const store = new MemoryEntitlementStore(3, 30);
    store.provision({ code: "ONWAN-PAY-3", emailHash: "email-hash", credits: 200 });
    const billing = store.billing();
    await billing.applyPilotPayment(payment({ eventId: "evt_a" }));
    const second = await billing.applyPilotPayment(payment({ eventId: "evt_b" }));
    expect(second.outcome).toBe("unmatched");
  });
});
