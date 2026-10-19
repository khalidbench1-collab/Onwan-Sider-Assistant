import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import { ApiError } from "../errors.js";
import type {
  GeneratedDocument,
  GenerateInput,
  GenerationGateway,
  Plan,
  Source,
} from "../types.js";
import { buildPrompt } from "./prompts.js";
import {
  PITCH_MAX_PARAGRAPHS,
  PITCH_MAX_WORDS,
  PITCH_MIN_PARAGRAPHS,
  PITCH_MIN_WORDS,
  parseOutput,
  pitchParagraphCount,
  pitchWordCount,
  wireResponseSchemas,
} from "./schemas.js";
import { renderOutput } from "./render.js";
import { logEvent } from "./log.js";

type GeminiUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
};

function groundingSources(response: unknown): Source[] {
  const found = new Map<string, Source>();
  const candidates = (response as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      };
    }>;
  }).candidates || [];
  for (const candidate of candidates) {
    for (const chunk of candidate.groundingMetadata?.groundingChunks || []) {
      const uri = chunk.web?.uri;
      if (uri && /^https?:\/\//.test(uri)) {
        found.set(uri, { url: uri, title: chunk.web?.title || uri });
      }
    }
  }
  return [...found.values()];
}

function maxOutputTokens(input: GenerateInput): number {
  return input.actionId === "editDraft" || input.actionId === "research" ? 16000 : 10000;
}

export function buildRequestConfigs(
  input: GenerateInput,
  prompt: ReturnType<typeof buildPrompt>,
): {
  grounded?: Record<string, unknown>;
  structured: Record<string, unknown>;
} {
  const structured: Record<string, unknown> = {
    systemInstruction: prompt.system,
    responseMimeType: "application/json",
    // wireResponseSchemas, not responseSchemas: Vertex rejects the declared maxItems as an
    // over-budget decoding grammar. See the note in schemas.ts; parseOutput still enforces them.
    responseJsonSchema: wireResponseSchemas[input.actionId],
    maxOutputTokens: maxOutputTokens(input),
    // Formatting already-grounded evidence into JSON does not need deep reasoning. Keeping this
    // low reserves the output allowance for the actual journalism document instead of thoughts.
    thinkingConfig: { thinkingLevel: "LOW" },
  };
  if (!prompt.useSearch) return { structured };
  return {
    grounded: {
      systemInstruction: prompt.groundingSystem,
      tools: [{ googleSearch: {} }],
      maxOutputTokens: maxOutputTokens(input),
    },
    structured,
  };
}

export function classifyGeminiFailure(error: unknown): string {
  const status = providerStatus(error);
  if (status === 401 || status === 403) return "permission";
  if (status === 404) return "model_unavailable";
  if (status === 408 || status === 504) return "timeout";
  if (status === 429) return "quota";
  if (status !== undefined && status >= 500) return "provider_unavailable";
  if (status !== undefined && status >= 400) return "invalid_request";
  const detail = error instanceof Error ? `${error.name} ${error.message}`.toLowerCase() : "";
  if (
    detail.includes("timeout") ||
    detail.includes("timed out") ||
    detail.includes("abort") ||
    detail.includes("deadline") ||
    detail.includes("etimedout") ||
    detail.includes("econnreset") ||
    detail.includes("socket hang up")
  ) {
    return "timeout";
  }
  if (detail.includes("response") && detail.includes("schema")) return "structured_output";
  if (detail.includes("tool") || detail.includes("ground")) return "tool_configuration";
  if (detail.includes("location") || detail.includes("region")) return "location";
  if (detail.includes("model") && (detail.includes("not found") || detail.includes("unsupported"))) {
    return "model_unavailable";
  }
  if (detail.includes("permission") || detail.includes("forbidden") || detail.includes("403")) {
    return "permission";
  }
  if (detail.includes("quota") || detail.includes("rate") || detail.includes("429")) return "quota";
  if (error instanceof z.ZodError || error instanceof SyntaxError) return "invalid_output";
  return "unknown";
}

/**
 * Keep provider diagnostics useful without logging the request or provider response body.
 * The SDK exposes only a numeric status on its ApiError; that is safe operational metadata.
 */
export function providerStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && Number.isFinite(status) ? status : undefined;
}

/**
 * pitchDraft's word range and paragraph rule live only in the Zod refines: on the wire the field is a
 * plain string, so Vertex cannot constrain it and the model learns both rules from instructions
 * alone. A miss used to discard an otherwise complete proposal and bill a failed action, so a
 * rejection confined to pitchDraft now earns one corrective retry. Any other validation issue still
 * fails immediately - retrying a structurally wrong answer would just spend a second call to fail the
 * same way.
 */
export function isPitchDraftFormatError(error: unknown): boolean {
  return (
    error instanceof z.ZodError &&
    error.issues.length > 0 &&
    error.issues.every((issue) => issue.path.length === 1 && issue.path[0] === "pitchDraft")
  );
}

/**
 * Names only the rules the previous answer actually broke. Telling a model to fix a word count it
 * already satisfied invites it to rewrite a correct field and break something else.
 */
export function pitchDraftRetryInstruction(words: number, paragraphs: number): string {
  const faults: string[] = [];
  if (words < PITCH_MIN_WORDS || words > PITCH_MAX_WORDS) {
    faults.push(
      `it contained ${words} words, outside the required ${PITCH_MIN_WORDS} to ` +
        `${PITCH_MAX_WORDS} words`,
    );
  }
  if (paragraphs < PITCH_MIN_PARAGRAPHS) {
    faults.push(
      `it was written as ${paragraphs} paragraph(s), but pitchDraft must be ` +
        `${PITCH_MIN_PARAGRAPHS} to ${PITCH_MAX_PARAGRAPHS} paragraphs separated by a blank line ` +
        `("\\n\\n" between paragraphs), in Arabic exactly as in English`,
    );
  }
  return `

Your previous answer was rejected for pitchDraft only: ${faults.join("; and ")}. Produce the same \
proposal again, keeping every other field as you wrote it, and rewrite pitchDraft so it satisfies \
every rule. Check it before answering.`;
}

function usageOf(response: unknown): { inputTokens: number; outputTokens: number } {
  const usage = (response as { usageMetadata?: GeminiUsage }).usageMetadata;
  return {
    inputTokens: Number(usage?.promptTokenCount || 0),
    outputTokens: Number(usage?.candidatesTokenCount || 0),
  };
}

function outputLanguageOf(input: GenerateInput): string {
  if (input.outputLanguage && input.outputLanguage !== "auto") return input.outputLanguage;
  if (input.projectLanguageHint && input.projectLanguageHint !== "auto") {
    return input.projectLanguageHint;
  }
  return input.uiLocale;
}

export function groundedResearchDocument(
  input: GenerateInput,
  model: string,
  groundedText: string,
  sources: Source[],
  usage: { inputTokens: number; outputTokens: number },
): GeneratedDocument {
  const heading = input.uiLocale === "ar" ? "المصادر" : "Sources";
  const sourceLines = sources.map((source) => {
    const label = source.title.replace(/[[\]]/g, "").trim() || source.url;
    return `- [${label}](${source.url})`;
  });
  const markdown = sourceLines.length
    ? `${groundedText.trim()}\n\n## ${heading}\n\n${sourceLines.join("\n")}`
    : groundedText.trim();
  return {
    kind: "document",
    markdown,
    languageCode: outputLanguageOf(input),
    sources,
    model,
    usage,
  };
}

export function formattingContents(
  user: string,
  groundedText: string,
  groundedSources: Source[],
): string {
  const hasGroundedSummary = groundedText.trim().length > 0;
  const trustedSources = groundedSources.length
    ? groundedSources
        .map(
          (source, index) =>
            `S${index + 1} | ${source.title.replace(/\s+/g, " ").trim()} | ${source.url}`,
        )
        .join("\n")
    : "No trusted web sources were returned.";
  const evidenceBrief = hasGroundedSummary
    ? groundedText
    : "Google Search returned no usable narrative evidence for this request.";
  const fallbackRules = hasGroundedSummary
    ? ""
    : `

IMPORTANT: No usable live Google Search evidence was returned. Do not state factual findings as
established. For research, produce a cautious source-seeking brief: use only \"unverified\" certainty,
empty sourceRefs, and no invented dates, people, institutions, quotations, figures, or URLs. For claim
checking, treat every item as a verification lead rather than a verified finding.`;
  return `${user}

<GOOGLE_SEARCH_GROUNDED_EVIDENCE>
${evidenceBrief}
</GOOGLE_SEARCH_GROUNDED_EVIDENCE>

<TRUSTED_SOURCES>
${trustedSources}
</TRUSTED_SOURCES>

Format the requested result using only the supplied journalism material and grounded evidence.
Do not add a factual claim that is absent from them. Preserve uncertainty and attribution.
When the response schema contains sourceRefs, cite only IDs from TRUSTED_SOURCES (for example S1).
Never create, copy, or guess a URL in the JSON. The backend owns and renders every URL.${fallbackRules}`;
}

export class GeminiGateway implements GenerationGateway {
  private readonly client: GoogleGenAI;

  constructor(private readonly config: AppConfig) {
    this.client = new GoogleGenAI({
      vertexai: true,
      project: config.GOOGLE_CLOUD_PROJECT,
      location: config.GEMINI_LOCATION,
      // Omit SDK retryOptions deliberately: it both avoids automatic retries AND makes the SDK
      // return the raw non-2xx response so its own throwErrorIfNotOK parses Vertex's detailed error
      // body (status + reason) instead of discarding it as a bare "Bad Request". Timeout stays 90s
      // for Search grounding, which is slower than ordinary generation.
      httpOptions: { timeout: 90000 },
    });
  }

  async generate(input: GenerateInput, plan: Plan): Promise<GeneratedDocument> {
    // Owner decision (2026-07-27): the 3.5-flash fallback was removed. It re-ran the same failing
    // request and only doubled failure latency, so a failure now surfaces immediately as
    // AI_UNAVAILABLE. Both plans now resolve to gemini-3.8-flash (see config.ts); the branch is kept
    // so a future tier can re-split without a code change.
    const model =
      plan === "pro" ? this.config.GEMINI_PRO_MODEL : this.config.GEMINI_FREE_MODEL;

    try {
      return await this.callModel(model, input);
    } catch (error) {
      logEvent("WARNING", "gemini_attempt_failed", {
        actionId: input.actionId,
        model,
        errorName: error instanceof Error ? error.name : "unknown",
        errorCategory: classifyGeminiFailure(error),
        providerStatus: providerStatus(error),
        validationIssues:
          error instanceof z.ZodError
            ? error.issues.slice(0, 8).map((issue) => `${issue.path.join(".")}:${issue.code}`)
            : [],
      });
      throw new ApiError(
        503,
        "AI_UNAVAILABLE",
        error instanceof z.ZodError
          ? "The AI response could not be validated. Please try again."
          : "Gemini is temporarily unavailable. Please try again.",
      );
    }
  }

  private async callModel(model: string, input: GenerateInput): Promise<GeneratedDocument> {
    const prompt = buildPrompt(input);
    const configs = buildRequestConfigs(input, prompt);
    let contents = prompt.user;
    let grounded: Source[] = [];
    let groundingUsage = { inputTokens: 0, outputTokens: 0 };

    if (configs.grounded) {
      try {
        const groundingResponse = await this.client.models.generateContent({
          model,
          contents,
          config: configs.grounded,
        });
        const groundedText = String(groundingResponse.text || "").trim();
        grounded = groundingSources(groundingResponse);
        if (!groundedText) {
          logEvent("WARNING", "grounding_empty_fallback", {
            actionId: input.actionId,
            model,
            sourceCount: grounded.length,
          });
        }
        contents = formattingContents(prompt.user, groundedText, grounded);
        groundingUsage = usageOf(groundingResponse);
        if (input.actionId === "research" && groundedText) {
          return groundedResearchDocument(
            input,
            model,
            groundedText,
            grounded,
            groundingUsage,
          );
        }
      } catch (error) {
        // Search grounding is an optional enrichment, not a reason to block a journalist's
        // workflow. The next structured request is deliberately constrained to produce an
        // unverified, source-seeking brief with no invented sources or factual claims.
        logEvent("WARNING", "grounding_request_failed_fallback", {
          actionId: input.actionId,
          model,
          errorCategory: classifyGeminiFailure(error),
          providerStatus: providerStatus(error),
        });
        contents = formattingContents(prompt.user, "", []);
      }
    }

    const response = await this.client.models.generateContent({
      model,
      contents,
      config: configs.structured,
    });
    const raw = response.text;
    if (!raw) {
      const candidate = response.candidates?.[0];
      logEvent("WARNING", "gemini_empty_structured_response", {
        actionId: input.actionId,
        model,
        finishReason: candidate?.finishReason || "unknown",
        blockReason: response.promptFeedback?.blockReason || "none",
        promptTokens: Number(response.usageMetadata?.promptTokenCount || 0),
        outputTokens: Number(response.usageMetadata?.candidatesTokenCount || 0),
        thoughtTokens: Number(response.usageMetadata?.thoughtsTokenCount || 0),
      });
      throw new Error("Gemini returned no text");
    }
    let parsed: ReturnType<typeof parseOutput>;
    let formattingUsage = usageOf(response);
    try {
      parsed = parseOutput(input.actionId, JSON.parse(raw));
    } catch (error) {
      if (!isPitchDraftFormatError(error)) throw error;
      const draft = (JSON.parse(raw) as { pitchDraft?: unknown }).pitchDraft;
      const text = typeof draft === "string" ? draft : "";
      const words = pitchWordCount(text);
      const paragraphs = pitchParagraphCount(text);
      logEvent("INFO", "pitch_draft_format_retry", {
        actionId: input.actionId,
        model,
        words,
        paragraphs,
        required: `${PITCH_MIN_WORDS}-${PITCH_MAX_WORDS} words, ${PITCH_MIN_PARAGRAPHS}+ paragraphs`,
      });
      const retry = await this.client.models.generateContent({
        model,
        contents: `${contents}${pitchDraftRetryInstruction(words, paragraphs)}`,
        config: configs.structured,
      });
      const retryRaw = retry.text;
      if (!retryRaw) throw new Error("Gemini returned no text");
      const retryUsage = usageOf(retry);
      formattingUsage = {
        inputTokens: formattingUsage.inputTokens + retryUsage.inputTokens,
        outputTokens: formattingUsage.outputTokens + retryUsage.outputTokens,
      };
      parsed = parseOutput(input.actionId, JSON.parse(retryRaw));
    }
    if (prompt.useSearch) parsed.sources = grounded;
    const rendered = renderOutput(parsed);
    const sources = new Map<string, Source>();
    for (const source of [...rendered.sources, ...grounded]) {
      if (/^https?:\/\//.test(source.url)) sources.set(source.url, source);
    }
    return {
      ...rendered,
      sources: [...sources.values()],
      model,
      usage: {
        inputTokens: groundingUsage.inputTokens + formattingUsage.inputTokens,
        outputTokens: groundingUsage.outputTokens + formattingUsage.outputTokens,
      },
    };
  }
}
