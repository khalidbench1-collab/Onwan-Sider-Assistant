import express, { type Express, type RequestHandler } from "express";
import type { AppConfig } from "./config.js";
import { publicError } from "./errors.js";
import type { BillingStore } from "./lib/billing.js";
import type { EntitlementStore } from "./lib/entitlement.js";
import { identityMiddleware, type IdentityVerifier } from "./lib/identity.js";
import { logEvent } from "./lib/log.js";
import type { GenerationGateway } from "./types.js";
import { entitlementRouter } from "./routes/entitlement.js";
import { generateRouter } from "./routes/generate.js";
import { stripeWebhookHandler } from "./routes/stripe.js";

export interface AppServices {
  config: AppConfig;
  identity: IdentityVerifier;
  store: EntitlementStore;
  gateway: GenerationGateway;
  billing?: BillingStore;
}

export function createApp(services: AppServices): Express {
  const app = express();
  app.disable("x-powered-by");

  // Registered before express.json and before the /v1 identity gate, in that order,
  // because Stripe signs the raw bytes and cannot present a Google ID token.
  if (
    services.billing &&
    services.config.STRIPE_SECRET_KEY &&
    services.config.STRIPE_WEBHOOK_SECRET
  ) {
    app.post(
      "/v1/stripe/webhook",
      express.raw({ type: "application/json" }),
      stripeWebhookHandler(services.config, services.billing),
    );
  }

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.json({
      ok: true,
      service: "onwan-api",
      environment: services.config.ONWAN_DATA_NAMESPACE,
    });
  });

  const authenticated: RequestHandler = identityMiddleware(services.identity);
  app.use("/v1", authenticated);
  app.use("/v1", entitlementRouter(services.store));
  app.use("/v1", generateRouter(services.config, services.store, services.gateway));

  app.use((_request, response) => {
    response.status(404).json({ ok: false, error: "NOT_FOUND", message: "Route not found." });
  });

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      const visible = publicError(error);
      if (visible.status >= 500) {
        logEvent("ERROR", "request_failed", {
          errorName: error instanceof Error ? error.name : "unknown",
        });
      }
      response.status(visible.status).json(visible.body);
    },
  );

  return app;
}
