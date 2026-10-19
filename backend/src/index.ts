import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { FirestoreBillingStore } from "./lib/billing.js";
import { FirestoreEntitlementStore } from "./lib/entitlement.js";
import { GeminiGateway } from "./lib/gemini.js";
import { GoogleIdentityVerifier } from "./lib/identity.js";
import { logEvent } from "./lib/log.js";

const config = loadConfig();
const app = createApp({
  config,
  identity: new GoogleIdentityVerifier(config),
  store: new FirestoreEntitlementStore(config),
  gateway: new GeminiGateway(config),
  billing: new FirestoreBillingStore(config),
});

app.listen(config.PORT, () => {
  logEvent("INFO", "service_started", {
    port: config.PORT,
    namespace: config.ONWAN_DATA_NAMESPACE,
    geminiLocation: config.GEMINI_LOCATION,
  });
});
