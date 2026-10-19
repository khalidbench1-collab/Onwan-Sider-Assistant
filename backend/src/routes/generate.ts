import { Router } from "express";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import { ApiError } from "../errors.js";
import type { EntitlementStore } from "../lib/entitlement.js";
import { logEvent } from "../lib/log.js";
import { ACTION_IDS, type ActionId, type GenerationGateway } from "../types.js";

const requestSchema = z.object({
  actionId: z.enum(ACTION_IDS),
  clientRequestId: z.string().uuid(),
  inputs: z.object({
    targetText: z.string(),
    styleProfile: z.string().optional().default(""),
    domain: z.string().max(500).optional().default(""),
    ideaText: z.string().max(20000).optional().default(""),
    selectedAngle: z.string().max(5000).optional().default(""),
    storyType: z.enum(["quick", "investigation"]).optional(),
  }),
  uiLocale: z.enum(["ar", "en"]),
  outputLanguage: z.string().min(2).max(12).default("auto"),
  projectLanguageHint: z.string().min(2).max(12).optional().default("auto"),
});

export const ACTION_CREDIT_COST: Record<ActionId, number> = {
  proposalIdeas: 0,
  proposal: 1,
  research: 3,
  fieldworkPlan: 3,
  storyFramework: 2,
  editDraft: 2,
  claimCheck: 3,
};

export function generateRouter(
  config: AppConfig,
  store: EntitlementStore,
  gateway: GenerationGateway,
): Router {
  const router = Router();
  const hourlyUsage = new Map<string, { windowStart: number; count: number }>();
  const previewHourlyUsage = new Map<string, { windowStart: number; count: number }>();

  router.post("/generate", async (request, response, next) => {
    let reservation: Awaited<ReturnType<EntitlementStore["reserve"]>> | null = null;
    const started = Date.now();
    try {
      const parsed = requestSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ApiError(400, "INVALID_REQUEST", "The request is incomplete or invalid.");
      }
      const input = parsed.data;
      const inputSize =
        input.inputs.targetText.length +
        input.inputs.styleProfile.length +
        input.inputs.ideaText.length +
        input.inputs.selectedAngle.length;
      if (inputSize > config.MAX_INPUT_CHARS) {
        throw new ApiError(413, "TOO_LONG", "The selected document text is too long.");
      }
      if (!request.user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in with Google.");

      const entitlement = await store.entitlement(request.user);
      const isPreview = input.actionId === "proposalIdeas";
      if (isPreview) {
        enforceHourlyLimit_(
          previewHourlyUsage,
          request.user.uidHash,
          10,
          Date.now(),
        );
      } else if (entitlement.plan === "pro") {
        enforceHourlyLimit_(
          hourlyUsage,
          request.user.uidHash,
          config.PRO_HOURLY_LIMIT,
          Date.now(),
        );
      }
      const cost = entitlement.plan === "free" || isPreview
        ? 0
        : ACTION_CREDIT_COST[input.actionId];
      if (!isPreview) {
        reservation = await store.reserve(
          request.user,
          input.clientRequestId,
          cost,
          input.actionId,
        );
      }
      const result = await gateway.generate(input, entitlement.plan);
      const updated = reservation
        ? await store.consume(reservation)
        : entitlement;

      logEvent("INFO", "generation_completed", {
        requestId: input.clientRequestId,
        uidHash: request.user.uidHash,
        actionId: input.actionId,
        plan: entitlement.plan,
        model: result.model,
        language: result.languageCode,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        latencyMs: Date.now() - started,
        status: "success",
      });

      response.json({
        ok: true,
        result: {
          kind: result.kind,
          markdown: result.markdown,
          sources: result.sources,
          preview: result.preview,
        },
        language: {
          detected: result.languageCode,
          used: result.languageCode,
        },
        entitlement: updated,
        credits: {
          cost,
          remaining: updated.creditsRemaining,
          freeActionsRemaining: updated.freeActionsRemaining,
        },
        model: result.model,
        requestId: input.clientRequestId,
      });
    } catch (error) {
      if (reservation) await store.refund(reservation);
      logEvent("WARNING", "generation_failed", {
        uidHash: request.user?.uidHash,
        actionId: request.body?.actionId,
        errorCode: error instanceof ApiError ? error.code : "INTERNAL",
        latencyMs: Date.now() - started,
        status: "failed",
      });
      next(error);
    }
  });

  return router;
}

function enforceHourlyLimit_(
  usage: Map<string, { windowStart: number; count: number }>,
  key: string,
  limit: number,
  now: number,
): void {
  const hour = 60 * 60 * 1000;
  const current = usage.get(key);
  if (!current || now - current.windowStart >= hour) {
    usage.set(key, { windowStart: now, count: 1 });
    return;
  }
  if (current.count >= limit) {
    throw new ApiError(429, "RATE_LIMIT", "Too many requests. Please try again later.");
  }
  current.count += 1;
}
