import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../errors.js";
import type { EntitlementStore } from "../lib/entitlement.js";

const activationSchema = z.object({
  code: z.string().min(8).max(80),
});

export function entitlementRouter(store: EntitlementStore): Router {
  const router = Router();

  router.get("/entitlement", async (request, response, next) => {
    try {
      if (!request.user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in with Google.");
      response.json({ ok: true, entitlement: await store.entitlement(request.user) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/licenses/activate", async (request, response, next) => {
    try {
      if (!request.user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in with Google.");
      const parsed = activationSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ApiError(400, "INVALID_LICENSE", "Enter a valid licence code.");
      }
      const entitlement = await store.activate(request.user, parsed.data.code);
      response.json({ ok: true, entitlement });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
