import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  GOOGLE_CLOUD_PROJECT: z.string().min(1),
  GEMINI_LOCATION: z.string().min(1).default("global"),
  // Both keys resolve to the same model (owner decision, 2026-08-16). The split existed to reserve
  // the stronger model for paying users; with the paid tier withdrawn every journalist is on `free`,
  // and gemini-3.5-flash-lite had never served a production request — 30 days of logs show only
  // 3.6-flash. Collapsing avoids moving all traffic onto a never-exercised path to save roughly
  // $0.13 per journalist across a full 30-action allowance. Neither key is set on Cloud Run, so
  // these defaults are what production runs. The branch in gemini.ts stays: a future grant-funded
  // tier can re-split from configuration alone.
  // Moved from gemini-3.6-flash to gemini-3.8-flash on 2026-10-06: Google discontinues 3.6-flash on
  // Vertex on 2026-11-19 (requests 404 after that). 3.8-flash passed all seven actions live, including
  // Search grounding and the structured-output schemas; gemini-3.5-flash, the other suggested target,
  // timed out on three of seven.
  GEMINI_FREE_MODEL: z.string().min(1).default("gemini-3.8-flash"),
  GEMINI_PRO_MODEL: z.string().min(1).default("gemini-3.8-flash"),
  ONWAN_OAUTH_AUDIENCE: z.string().min(1),
  ONWAN_ID_HASH_SALT: z.string().min(24),
  ONWAN_DATA_NAMESPACE: z
    .string()
    .regex(/^[a-z0-9_-]+$/)
    .default("staging"),
  // 30, not 7: a complete story cycle is six actions (proposal, research, fieldwork plan, framework,
  // edit, claim check). Seven was sized as a trial before a purchase — one cycle plus a retry. With
  // the paid tier withdrawn there is nothing to convert to, so seven left a journalist permanently
  // blocked after a single story. Thirty is five cycles: enough to use for real work.
  FREE_ACTION_LIMIT: z.coerce.number().int().min(0).max(100).default(30),
  PRO_HOURLY_LIMIT: z.coerce.number().int().min(1).max(1000).default(60),
  PILOT_TERM_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  PILOT_CREDITS: z.coerce.number().int().min(1).max(100000).default(100),
  MAX_INPUT_CHARS: z.coerce.number().int().min(1000).max(200000).default(150000),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid configuration: ${fields}`);
  }
  return parsed.data;
}
