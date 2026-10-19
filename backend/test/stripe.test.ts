import request from "supertest";
import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { MemoryEntitlementStore } from "../src/lib/entitlement.js";
import { hashIdentityValue } from "../src/lib/identity.js";
import type { IdentityVerifier } from "../src/lib/identity.js";
import type {
  AuthenticatedUser,
  GeneratedDocument,
  GenerateInput,
  GenerationGateway,
  Plan,
} from "../src/types.js";

const WEBHOOK_SECRET = "whsec_test_secret";

const config: AppConfig = {
  NODE_ENV: "test",
  PORT: 8080,
  GOOGLE_CLOUD_PROJECT: "test-project",
  GEMINI_LOCATION: "global",
  GEMINI_FREE_MODEL: "gemini-3.5-flash-lite",
  GEMINI_PRO_MODEL: "gemini-3.6-flash",
  ONWAN_OAUTH_AUDIENCE: "test-audience",
  ONWAN_ID_HASH_SALT: "a-long-test-salt-that-is-not-production",
  ONWAN_DATA_NAMESPACE: "test",
  FREE_ACTION_LIMIT: 3,
  PRO_HOURLY_LIMIT: 60,
  MAX_INPUT_CHARS: 150000,
  PILOT_TERM_DAYS: 30,
  PILOT_CREDITS: 200,
  STRIPE_SECRET_KEY: "sk_test_key",
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
};

const user: AuthenticatedUser = {
  sub: "google-sub",
  email: "journalist@example.com",
  uidHash: "uid-hash",
  emailHash: hashIdentityValue("journalist@example.com", config.ONWAN_ID_HASH_SALT),
};

class FakeIdentity implements IdentityVerifier {
  async verify(token: string): Promise<AuthenticatedUser> {
    if (token !== "valid") throw new Error("invalid token");
    return user;
  }
}

class FakeGateway implements GenerationGateway {
  async generate(_input: GenerateInput, plan: Plan): Promise<GeneratedDocument> {
    return {
      kind: "document",
      markdown: "# Result",
      languageCode: "en",
      sources: [],
      model: plan === "free" ? config.GEMINI_FREE_MODEL : config.GEMINI_PRO_MODEL,
      usage: { inputTokens: 1, outputTokens: 1 },
    };
  }
}

function harness() {
  const store = new MemoryEntitlementStore(3, 30);
  const billing = store.billing();
  const app = createApp({
    config,
    identity: new FakeIdentity(),
    store,
    gateway: new FakeGateway(),
    billing,
  });
  return { app, store };
}

function signedEvent(body: Record<string, unknown>): { payload: string; signature: string } {
  const payload = JSON.stringify(body);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  });
  return { payload, signature };
}

function checkoutEvent(id: string, email: string) {
  return {
    id,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        customer: "cus_test_1",
        amount_total: 2900,
        currency: "usd",
        customer_details: { email },
      },
    },
  };
}

describe("Stripe webhook", () => {
  it("rejects a body whose signature does not match", async () => {
    const { app } = harness();
    const { payload } = signedEvent(checkoutEvent("evt_bad", user.email));
    const response = await request(app)
      .post("/v1/stripe/webhook")
      .set("content-type", "application/json")
      .set("stripe-signature", "t=1,v1=deadbeef")
      .send(payload)
      .expect(400);
    expect(response.body.error).toBe("INVALID_SIGNATURE");
  });

  it("accepts a signed event without any Google identity token", async () => {
    const { app, store } = harness();
    store.provision({ code: "ONWAN-HOOK-1", emailHash: user.emailHash, credits: 200 });
    const { payload, signature } = signedEvent(checkoutEvent("evt_ok", user.email));
    const response = await request(app)
      .post("/v1/stripe/webhook")
      .set("content-type", "application/json")
      .set("stripe-signature", signature)
      .send(payload)
      .expect(200);
    expect(response.body.outcome).toBe("applied");
  });

  it("treats a replayed event id as a no-op", async () => {
    const { app, store } = harness();
    store.provision({ code: "ONWAN-HOOK-2", emailHash: user.emailHash, credits: 200 });
    const { payload, signature } = signedEvent(checkoutEvent("evt_replay", user.email));
    await request(app)
      .post("/v1/stripe/webhook")
      .set("content-type", "application/json")
      .set("stripe-signature", signature)
      .send(payload)
      .expect(200);
    const replay = await request(app)
      .post("/v1/stripe/webhook")
      .set("content-type", "application/json")
      .set("stripe-signature", signature)
      .send(payload)
      .expect(200);
    expect(replay.body.outcome).toBe("replay");
  });

  it("ignores event types outside the pilot flow", async () => {
    const { app } = harness();
    const { payload, signature } = signedEvent({
      id: "evt_other",
      object: "event",
      type: "invoice.paid",
      data: { object: { id: "in_1", object: "invoice" } },
    });
    const response = await request(app)
      .post("/v1/stripe/webhook")
      .set("content-type", "application/json")
      .set("stripe-signature", signature)
      .send(payload)
      .expect(200);
    expect(response.body.outcome).toBe("ignored");
  });

  it("records a payment with no matching licence instead of retrying forever", async () => {
    const { app, store } = harness();
    const { payload, signature } = signedEvent(
      checkoutEvent("evt_unmatched", "stranger@example.com"),
    );
    const response = await request(app)
      .post("/v1/stripe/webhook")
      .set("content-type", "application/json")
      .set("stripe-signature", signature)
      .send(payload)
      .expect(200);
    expect(response.body.outcome).toBe("unmatched");
    expect(store.unmatchedPayments).toHaveLength(1);
  });

  it("leaves the webhook unmounted when the secrets are absent", async () => {
    const store = new MemoryEntitlementStore(3, 30);
    const app = createApp({
      config: { ...config, STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: undefined },
      identity: new FakeIdentity(),
      store,
      gateway: new FakeGateway(),
    });
    await request(app)
      .post("/v1/stripe/webhook")
      .set("content-type", "application/json")
      .send("{}")
      .expect(401);
  });
});
