import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { loadConfig } from "../src/config.js";
import { MemoryEntitlementStore } from "../src/lib/entitlement.js";
import type { IdentityVerifier } from "../src/lib/identity.js";
import type {
  AuthenticatedUser,
  GeneratedDocument,
  GenerateInput,
  GenerationGateway,
  Plan,
} from "../src/types.js";

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
};

const user: AuthenticatedUser = {
  sub: "google-sub",
  email: "journalist@example.com",
  uidHash: "uid-hash",
  emailHash: "email-hash",
};

class FakeIdentity implements IdentityVerifier {
  async verify(token: string): Promise<AuthenticatedUser> {
    if (token !== "valid") throw new Error("invalid token");
    return user;
  }
}

class FakeGateway implements GenerationGateway {
  fail = false;
  calls: Array<{ input: GenerateInput; plan: Plan }> = [];

  async generate(input: GenerateInput, plan: Plan): Promise<GeneratedDocument> {
    this.calls.push({ input, plan });
    if (this.fail) throw new Error("model failure");
    return {
      kind: "document",
      markdown: "# Result\n\nSafe content",
      languageCode: "en",
      sources: [],
      model: plan === "free" ? config.GEMINI_FREE_MODEL : config.GEMINI_PRO_MODEL,
      usage: { inputTokens: 100, outputTokens: 50 },
    };
  }
}

function payload(actionId = "proposal") {
  return {
    actionId,
    clientRequestId: randomUUID(),
    inputs: { targetText: "A draft story" },
    uiLocale: "en",
    outputLanguage: "auto",
    projectLanguageHint: "en",
  };
}

function harness(configOverrides: Partial<AppConfig> = {}) {
  const store = new MemoryEntitlementStore(3);
  const gateway = new FakeGateway();
  const app = createApp({
    config: { ...config, ...configOverrides },
    identity: new FakeIdentity(),
    store,
    gateway,
  });
  return { app, store, gateway };
}

describe("Onwan API", () => {
  it("serves an unauthenticated health check without leaking configuration", async () => {
    const { app } = harness();
    const response = await request(app).get("/health").expect(200);
    expect(response.body).toEqual({
      ok: true,
      service: "onwan-api",
      environment: "test",
    });
    expect(JSON.stringify(response.body)).not.toContain("salt");
  });

  it("requires Google identity for protected routes", async () => {
    const { app } = harness();
    await request(app).get("/v1/entitlement").expect(401);
  });

  it("counts only successful free actions and blocks the fourth", async () => {
    const { app } = harness();
    for (let expected = 2; expected >= 0; expected -= 1) {
      const response = await request(app)
        .post("/v1/generate")
        .set("authorization", "Bearer valid")
        .send(payload())
        .expect(200);
      expect(response.body.credits.freeActionsRemaining).toBe(expected);
      expect(response.body.credits.cost).toBe(0);
    }
    const blocked = await request(app)
      .post("/v1/generate")
      .set("authorization", "Bearer valid")
      .send(payload())
      .expect(402);
    expect(blocked.body.error).toBe("FREE_LIMIT");
  });

  it("returns three-angle previews without consuming a free action", async () => {
    const { app, gateway } = harness();
    gateway.generate = async () => ({
      kind: "ideas",
      markdown: "# Angles",
      languageCode: "en",
      sources: [],
      preview: {
        recommendedIndex: 2,
        recommendationReason: "Best public-interest fit.",
        ideas: [1, 2, 3].map((number) => ({
          title: `Angle ${number}`,
          angle: `Distinct angle ${number}`,
          whyNow: "Timely",
          firstSource: "Public records",
        })),
      },
      model: config.GEMINI_FREE_MODEL,
      usage: { inputTokens: 20, outputTokens: 20 },
    });
    const preview = await request(app)
      .post("/v1/generate")
      .set("authorization", "Bearer valid")
      .send({
        ...payload("proposalIdeas"),
        inputs: {
          targetText: "",
          ideaText: "A local housing shortage",
          storyType: "quick",
        },
      })
      .expect(200);
    expect(preview.body.result.preview.ideas).toHaveLength(3);
    expect(preview.body.credits.freeActionsRemaining).toBe(3);
    expect(preview.body.credits.cost).toBe(0);
  });

  it("refunds a free reservation after model failure", async () => {
    const { app, gateway } = harness();
    gateway.fail = true;
    await request(app)
      .post("/v1/generate")
      .set("authorization", "Bearer valid")
      .send(payload())
      .expect(500);
    gateway.fail = false;
    const entitlement = await request(app)
      .get("/v1/entitlement")
      .set("authorization", "Bearer valid")
      .expect(200);
    expect(entitlement.body.entitlement.freeActionsRemaining).toBe(3);
  });

  it("activates a manual licence and charges Pro credits", async () => {
    const { app, store, gateway } = harness();
    const code = store.provision({ code: "ONWAN-TEST-CODE-123", credits: 10 });
    const activation = await request(app)
      .post("/v1/licenses/activate")
      .set("authorization", "Bearer valid")
      .send({ code })
      .expect(200);
    expect(activation.body.entitlement.plan).toBe("pro");

    const generated = await request(app)
      .post("/v1/generate")
      .set("authorization", "Bearer valid")
      .send(payload("research"))
      .expect(200);
    expect(generated.body.credits.cost).toBe(3);
    expect(generated.body.credits.remaining).toBe(7);
    expect(gateway.calls.at(-1)?.plan).toBe("pro");
  });

  it("rejects a duplicate client request id", async () => {
    const { app } = harness();
    const body = payload();
    await request(app)
      .post("/v1/generate")
      .set("authorization", "Bearer valid")
      .send(body)
      .expect(200);
    const duplicate = await request(app)
      .post("/v1/generate")
      .set("authorization", "Bearer valid")
      .send(body)
      .expect(409);
    expect(duplicate.body.error).toBe("DUPLICATE_REQUEST");
  });

  it("records every credit movement in the ledger", async () => {
    const { app, store, gateway } = harness();
    const code = store.provision({ code: "ONWAN-LEDGER-CODE-1", credits: 10 });
    await request(app)
      .post("/v1/licenses/activate")
      .set("authorization", "Bearer valid")
      .send({ code })
      .expect(200);

    await request(app)
      .post("/v1/generate")
      .set("authorization", "Bearer valid")
      .send(payload("research"))
      .expect(200);

    gateway.fail = true;
    await request(app)
      .post("/v1/generate")
      .set("authorization", "Bearer valid")
      .send(payload("research"))
      .expect(500);

    const types = store.ledger.map((entry) => entry.type);
    expect(types).toEqual(["reserve", "consume", "reserve", "refund"]);
    expect(store.ledger.map((entry) => entry.balanceAfter)).toEqual([7, 7, 4, 7]);
    expect(store.ledger[0]?.actionId).toBe("research");
    expect(store.ledger.every((entry) => entry.licenseId)).toBe(true);
  });

  it("writes no ledger rows for free-plan actions", async () => {
    const { app, store } = harness();
    await request(app)
      .post("/v1/generate")
      .set("authorization", "Bearer valid")
      .send(payload())
      .expect(200);
    expect(store.ledger).toHaveLength(0);
  });

  it("reports an expired pilot licence as free with an expired status", async () => {
    const { app, store } = harness();
    const longAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const code = store.provision({
      code: "ONWAN-EXPIRED-CODE-1",
      credits: 50,
      uidHash: user.uidHash,
      activatedAt: longAgo,
      paidAt: longAgo,
      termDays: 30,
    });
    expect(code).toBeTruthy();

    const entitlement = await request(app)
      .get("/v1/entitlement")
      .set("authorization", "Bearer valid")
      .expect(200);
    expect(entitlement.body.entitlement.plan).toBe("free");
    expect(entitlement.body.entitlement.status).toBe("expired");
    expect(entitlement.body.entitlement.creditsRemaining).toBeNull();
    expect(entitlement.body.entitlement.expiresAt).toBeTruthy();
  });

  it("keeps an unexpired pilot licence usable and exposes its expiry", async () => {
    const { app, store } = harness();
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    store.provision({
      code: "ONWAN-LIVE-CODE-1",
      credits: 50,
      uidHash: user.uidHash,
      activatedAt: recent,
      paidAt: recent,
      termDays: 30,
    });
    const entitlement = await request(app)
      .get("/v1/entitlement")
      .set("authorization", "Bearer valid")
      .expect(200);
    expect(entitlement.body.entitlement.plan).toBe("pro");
    expect(entitlement.body.entitlement.expiresAt).toBeTruthy();
  });

  it("never expires a licence that was provisioned but never paid", async () => {
    const { app, store } = harness();
    store.provision({
      code: "ONWAN-UNPAID-CODE-1",
      credits: 50,
      uidHash: user.uidHash,
      activatedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
      termDays: 30,
    });
    const entitlement = await request(app)
      .get("/v1/entitlement")
      .set("authorization", "Bearer valid")
      .expect(200);
    expect(entitlement.body.entitlement.plan).toBe("pro");
    expect(entitlement.body.entitlement.expiresAt).toBeNull();
  });

  it("refuses to activate an expired licence with a distinct error code", async () => {
    const { app, store } = harness();
    const longAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const code = store.provision({
      code: "ONWAN-EXPIRED-CODE-2",
      credits: 50,
      activatedAt: longAgo,
      paidAt: longAgo,
      termDays: 30,
    });
    const rejected = await request(app)
      .post("/v1/licenses/activate")
      .set("authorization", "Bearer valid")
      .send({ code })
      .expect(403);
    expect(rejected.body.error).toBe("LICENSE_EXPIRED");
  });

  it("starts the term at activation when payment came first", async () => {
    const { app, store } = harness();
    const paidAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const code = store.provision({ code: "ONWAN-PAID-FIRST-1", credits: 50, paidAt, termDays: 30 });
    const activation = await request(app)
      .post("/v1/licenses/activate")
      .set("authorization", "Bearer valid")
      .send({ code })
      .expect(200);
    expect(activation.body.entitlement.plan).toBe("pro");
    const expiry = new Date(activation.body.entitlement.expiresAt).getTime();
    // Term runs from activation (now), not from the earlier payment.
    expect(expiry).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
  });

  it("rate-limits excessive Pro generation attempts", async () => {
    const { app, store } = harness({ PRO_HOURLY_LIMIT: 2 });
    const code = store.provision({ code: "ONWAN-RATE-LIMIT-123", credits: 20 });
    await request(app)
      .post("/v1/licenses/activate")
      .set("authorization", "Bearer valid")
      .send({ code })
      .expect(200);

    for (let index = 0; index < 2; index += 1) {
      await request(app)
        .post("/v1/generate")
        .set("authorization", "Bearer valid")
        .send(payload("research"))
        .expect(200);
    }
    const blocked = await request(app)
      .post("/v1/generate")
      .set("authorization", "Bearer valid")
      .send(payload("research"))
      .expect(429);
    expect(blocked.body.error).toBe("RATE_LIMIT");
  });
});

describe("free allowance", () => {
  it("defaults to 30 actions, sized for use rather than for a sales trial", () => {
    const config = loadConfig({
      GOOGLE_CLOUD_PROJECT: "test-project",
      ONWAN_OAUTH_AUDIENCE: "test-audience",
      ONWAN_ID_HASH_SALT: "0123456789012345678901234567890123456789",
    } as NodeJS.ProcessEnv);
    expect(config.FREE_ACTION_LIMIT).toBe(30);
  });

  it("still honours an explicit override", () => {
    const config = loadConfig({
      GOOGLE_CLOUD_PROJECT: "test-project",
      ONWAN_OAUTH_AUDIENCE: "test-audience",
      ONWAN_ID_HASH_SALT: "0123456789012345678901234567890123456789",
      FREE_ACTION_LIMIT: "5",
    } as NodeJS.ProcessEnv);
    expect(config.FREE_ACTION_LIMIT).toBe(5);
  });
});
