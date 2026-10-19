import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { GenerateInput } from "../src/types.js";
import {
  buildRequestConfigs,
  classifyGeminiFailure,
  formattingContents,
  groundedResearchDocument,
  isPitchDraftFormatError,
  pitchDraftRetryInstruction,
  providerStatus,
} from "../src/lib/gemini.js";
import { buildPrompt } from "../src/lib/prompts.js";
import { parseOutput, pitchWordCount } from "../src/lib/schemas.js";

function input(actionId: GenerateInput["actionId"]): GenerateInput {
  return {
    actionId,
    clientRequestId: "00000000-0000-4000-8000-000000000001",
    inputs: {
      targetText: "A journalism proposal about public transport.",
      styleProfile: "",
      domain: "",
      ideaText: "",
    },
    uiLocale: "en",
    outputLanguage: "auto",
    projectLanguageHint: "en",
  };
}

describe("Gemini request configuration", () => {
  it("keeps Google Search and structured output in separate requests", () => {
    const request = input("research");
    const configs = buildRequestConfigs(request, buildPrompt(request));

    expect(configs.grounded?.tools).toEqual([{ googleSearch: {} }]);
    expect(configs.grounded?.temperature).toBeUndefined();
    expect(configs.grounded?.responseJsonSchema).toBeUndefined();
    expect(configs.grounded?.responseMimeType).toBeUndefined();
    expect(configs.structured.responseJsonSchema).toBeDefined();
    expect(configs.structured.responseMimeType).toBe("application/json");
    expect(configs.structured.thinkingConfig).toEqual({ thinkingLevel: "LOW" });
    expect(configs.structured.maxOutputTokens).toBe(16000);
    expect(configs.structured.tools).toBeUndefined();
  });

  it("uses one structured request for actions that do not search", () => {
    const request = input("proposal");
    const configs = buildRequestConfigs(request, buildPrompt(request));

    expect(configs.grounded).toBeUndefined();
    expect(configs.structured.responseJsonSchema).toBeDefined();
  });

  it("classifies failures without logging raw request content", () => {
    expect(classifyGeminiFailure(new Error("Location eu is unsupported"))).toBe("location");
    expect(classifyGeminiFailure(new Error("Tools cannot be used with response schema"))).toBe(
      "structured_output",
    );
    expect(classifyGeminiFailure(new Error("quota exceeded"))).toBe("quota");
    expect(classifyGeminiFailure(new Error("request timed out after 90000ms"))).toBe("timeout");
    expect(classifyGeminiFailure({ status: 504 })).toBe("timeout");
    expect(classifyGeminiFailure({ status: 503 })).toBe("provider_unavailable");
    expect(providerStatus({ status: 429 })).toBe(429);
    expect(providerStatus({ status: "429" })).toBeUndefined();
  });

  it("turns an empty Google Search summary into a transparent cautious fallback", () => {
    const contents = formattingContents("Topic", "", []);

    expect(contents).toContain("No usable live Google Search evidence was returned");
    expect(contents).toContain('only "unverified" certainty');
    expect(contents).toContain("No trusted web sources were returned.");
  });

  it("returns grounded desk research directly with trusted source links", () => {
    const request = input("research");
    const result = groundedResearchDocument(
      request,
      "gemini-3.6-flash",
      "# Research memo\n\nGrounded finding.",
      [{ title: "Official source", url: "https://example.org/report" }],
      { inputTokens: 40, outputTokens: 20 },
    );

    expect(result.markdown).toContain("Grounded finding.");
    expect(result.markdown).toContain("[Official source](https://example.org/report)");
    expect(result.sources).toHaveLength(1);
    expect(result.model).toBe("gemini-3.6-flash");
  });
});

describe("pitchDraft format recovery", () => {
  const lengthIssue = () =>
    new z.ZodError([
      { code: "custom", path: ["pitchDraft"], message: "pitchDraft must contain 150 to 300 words" },
    ]);

  it("recognises a word-count-only failure", () => {
    expect(isPitchDraftFormatError(lengthIssue())).toBe(true);
  });

  it("recognises a paragraph-only failure", () => {
    const paragraphIssue = new z.ZodError([
      {
        code: "custom",
        path: ["pitchDraft"],
        message: "pitchDraft must be at least 2 paragraphs separated by a blank line",
      },
    ]);

    expect(isPitchDraftFormatError(paragraphIssue)).toBe(true);
  });

  it("does not treat other validation failures as recoverable", () => {
    const other = new z.ZodError([
      { code: "custom", path: ["angle"], message: "required" },
      { code: "custom", path: ["pitchDraft"], message: "pitchDraft must contain 150 to 300 words" },
    ]);

    expect(isPitchDraftFormatError(other)).toBe(false);
    expect(isPitchDraftFormatError(new z.ZodError([]))).toBe(false);
    expect(isPitchDraftFormatError(new Error("boom"))).toBe(false);
  });

  it("tells the model exactly how far off the word count was", () => {
    const instruction = pitchDraftRetryInstruction(42, 3);

    expect(instruction).toContain("42");
    expect(instruction).toContain("150");
    expect(instruction).toContain("300");
  });

  it("names the paragraph rule when the pitch arrived as one block", () => {
    const instruction = pitchDraftRetryInstruction(200, 1);

    expect(instruction).toMatch(/paragraph/i);
    expect(instruction).toMatch(/Arabic/);
  });

  it("does not ask the model to fix a rule it already satisfied", () => {
    const paragraphsOnly = pitchDraftRetryInstruction(200, 1);
    const wordsOnly = pitchDraftRetryInstruction(42, 3);

    expect(paragraphsOnly).not.toContain("200 words");
    expect(wordsOnly).not.toMatch(/paragraph\(s\)/);
  });

  it("counts words the same way the validator does", () => {
    expect(pitchWordCount("  one   two\nthree ")).toBe(3);
    expect(pitchWordCount("")).toBe(0);
    expect(pitchWordCount("كلمة واحدة")).toBe(2);
  });

  it("advertises the word range and paragraph rule on the wire so the model is told twice", () => {
    const configs = buildRequestConfigs(input("proposal"), buildPrompt(input("proposal")));
    const schema = configs.structured.responseJsonSchema as {
      properties?: Record<string, Record<string, unknown>>;
    };
    const description = String(schema.properties?.pitchDraft?.description ?? "");

    expect(description).toContain("150");
    expect(description).toContain("300");
    expect(description).toMatch(/paragraphs separated by a blank line/);
    expect(description).toMatch(/Arabic/);
  });

  it("states the paragraph rule in the prompt as well as the schema", () => {
    expect(buildPrompt(input("proposal")).system).toMatch(/paragraphs separated by/);
  });
});

describe("Vertex constrained-decoding budget", () => {
  const actionIds: GenerateInput["actionId"][] = [
    "proposalIdeas",
    "proposal",
    "research",
    "fieldworkPlan",
    "storyFramework",
    "editDraft",
    "claimCheck",
  ];

  function keywordPaths(node: unknown, keyword: string, path = ""): string[] {
    if (!node || typeof node !== "object") return [];
    const record = node as Record<string, unknown>;
    const found: string[] = [];
    if (record[keyword] !== undefined) found.push(path || "<root>");
    if (record.properties && typeof record.properties === "object") {
      for (const [key, value] of Object.entries(record.properties as Record<string, unknown>)) {
        found.push(...keywordPaths(value, keyword, `${path}.${key}`));
      }
    }
    if (record.items) found.push(...keywordPaths(record.items, keyword, `${path}[]`));
    return found;
  }

  it("sends no maxItems to Vertex for any action", () => {
    for (const actionId of actionIds) {
      const configs = buildRequestConfigs(input(actionId), buildPrompt(input(actionId)));
      expect(keywordPaths(configs.structured.responseJsonSchema, "maxItems")).toEqual([]);
    }
  });

  function property(
    actionId: GenerateInput["actionId"],
    name: string,
  ): Record<string, unknown> {
    const configs = buildRequestConfigs(input(actionId), buildPrompt(input(actionId)));
    const schema = configs.structured.responseJsonSchema as {
      properties?: Record<string, Record<string, unknown>>;
    };
    const found = schema.properties?.[name];
    if (!found) throw new Error(`${actionId} has no property ${name}`);
    return found;
  }

  it("keeps the cheap bounds that guarantee a usable document", () => {
    expect(property("proposal", "questions").minItems).toBe(3);
    expect(property("proposal", "expectedEvidence").minItems).toBe(1);
    expect(property("proposalIdeas", "recommendedIndex").minimum).toBe(1);
    expect(property("proposalIdeas", "recommendedIndex").maximum).toBe(3);
  });

  it("still rejects an oversized array, so dropping maxItems loses no validation", () => {
    const item = {
      who: "Source",
      role: "Role",
      affiliation: "",
      relevance: "Relevant",
      contactMethod: "Public channel",
      type: "official",
      typeLabel: "رسمي",
    };
    const overLimit = {
      schemaVersion: "1.1",
      actionId: "fieldworkPlan",
      languageCode: "ar",
      title: "خطة",
      summary: "ملخص",
      labels: {
        sources: "المصادر",
        interviews: "المقابلات",
        evidence: "الأدلة",
        logistics: "اللوجستيات",
        itinerary: "المسار",
        safetyAccess: "السلامة",
        equipment: "المعدات",
        beforeArrival: "قبل الوصول",
      },
      planSummary: "ملخص الخطة",
      humanSources: Array.from({ length: 31 }, () => item),
      interviews: [],
      evidence: [],
      logistics: { itinerary: [], safetyAccess: [], equipment: [], beforeArrival: [] },
    };

    expect(() => parseOutput("fieldworkPlan", overLimit)).toThrow();
  });
});
