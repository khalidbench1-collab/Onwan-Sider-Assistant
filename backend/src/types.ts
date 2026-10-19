export const ACTION_IDS = [
  "proposalIdeas",
  "proposal",
  "research",
  "fieldworkPlan",
  "storyFramework",
  "editDraft",
  "claimCheck",
] as const;

export type ActionId = (typeof ACTION_IDS)[number];
export type Plan = "free" | "pro";
export type StoryType = "quick" | "investigation";

export interface AuthenticatedUser {
  sub: string;
  email: string;
  uidHash: string;
  emailHash: string;
}

export interface Entitlement {
  plan: Plan;
  status:
    | "free"
    | "provisioned"
    | "active"
    | "past_due"
    | "suspended"
    | "cancelled"
    | "expired";
  freeActionsRemaining: number;
  creditsRemaining: number | null;
  renewsAt: string | null;
  expiresAt: string | null;
  licenseId: string | null;
}

export interface UsageReservation {
  id: string;
  uidHash: string;
  plan: Plan;
  cost: number;
  licenseId: string | null;
  status: "reserved" | "consumed" | "refunded";
}

export interface GenerateInput {
  actionId: ActionId;
  clientRequestId: string;
  inputs: {
    targetText: string;
    styleProfile?: string;
    domain?: string;
    ideaText?: string;
    selectedAngle?: string;
    storyType?: StoryType;
  };
  uiLocale: "ar" | "en";
  outputLanguage: string;
  projectLanguageHint?: string;
}

export interface Source {
  url: string;
  title: string;
}

export interface GeneratedDocument {
  kind: "document" | "ideas" | "edited";
  markdown: string;
  languageCode: string;
  sources: Source[];
  preview?: {
    recommendedIndex: number;
    recommendationReason: string;
    ideas: Array<{
      title: string;
      angle: string;
      whyNow: string;
      firstSource: string;
    }>;
  };
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface GenerationGateway {
  generate(
    input: GenerateInput,
    plan: Plan,
  ): Promise<GeneratedDocument>;
}
