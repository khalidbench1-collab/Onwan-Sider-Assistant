import type { RequestHandler } from "express";
import Stripe from "stripe";
import type { AppConfig } from "../config.js";
import type { BillingStore } from "../lib/billing.js";
import { hashIdentityValue } from "../lib/identity.js";
import { logEvent } from "../lib/log.js";

export function stripeWebhookHandler(config: AppConfig, billing: BillingStore): RequestHandler {
  const stripe = new Stripe(config.STRIPE_SECRET_KEY as string);

  return async (request, response) => {
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        request.body as Buffer,
        request.header("stripe-signature") || "",
        config.STRIPE_WEBHOOK_SECRET as string,
      );
    } catch {
      logEvent("WARNING", "stripe_signature_rejected");
      response.status(400).json({ ok: false, error: "INVALID_SIGNATURE" });
      return;
    }

    try {
      const claimed = await billing.claimEvent(event.id, event.type);
      if (!claimed) {
        response.json({ ok: true, outcome: "replay" });
        return;
      }

      if (event.type !== "checkout.session.completed") {
        await billing.finishEvent(event.id, "ignored");
        response.json({ ok: true, outcome: "ignored" });
        return;
      }

      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_details?.email?.toLowerCase().trim();
      if (!email) {
        await billing.finishEvent(event.id, "unmatched");
        logEvent("WARNING", "stripe_payment_without_email", { eventId: event.id });
        response.json({ ok: true, outcome: "unmatched" });
        return;
      }

      const result = await billing.applyPilotPayment({
        eventId: event.id,
        emailHash: hashIdentityValue(email, config.ONWAN_ID_HASH_SALT),
        checkoutSessionId: session.id ?? null,
        stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
        amountTotal: session.amount_total ?? null,
        currency: session.currency ?? null,
      });
      await billing.finishEvent(event.id, result.outcome, result.licenseId);

      logEvent(result.outcome === "applied" ? "INFO" : "WARNING", "stripe_payment_recorded", {
        eventId: event.id,
        outcome: result.outcome,
        licenseId: result.licenseId,
      });
      response.json({ ok: true, outcome: result.outcome });
    } catch (error) {
      // 500 makes Stripe retry, which is safe because claimEvent is create-if-absent.
      logEvent("ERROR", "stripe_webhook_failed", {
        eventId: event.id,
        errorName: error instanceof Error ? error.name : "unknown",
      });
      response.status(500).json({ ok: false, error: "WEBHOOK_FAILED" });
    }
  };
}
