import { z } from "zod";
import type { ActionId, Source } from "../types.js";

const text = z.string().min(1);
const shortText = text.max(300);
const sourceRef = z.string().regex(/^S[1-9]\d*$/);
export const PITCH_MIN_WORDS = 150;
export const PITCH_MAX_WORDS = 300;
export const PITCH_MIN_PARAGRAPHS = 2;
export const PITCH_MAX_PARAGRAPHS = 4;

/**
 * Exported so the retry path in gemini.ts reports the same number this validator rejected.
 * Two different word counts would produce a correction the model cannot act on.
 */
export function pitchWordCount(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

/**
 * Paragraphs are blank-line separated, which is what render.ts emits and what
 * DocService.insertStructuredAt_ turns into separate document paragraphs. A single soft newline is
 * deliberately not a paragraph: the writer would emit it as its own paragraph with no spacing, which
 * is not what a reader sees as a break.
 *
 * Exported for the same reason as pitchWordCount - the retry path must quote this number back.
 */
export function pitchParagraphCount(value: string): number {
  return value
    .trim()
    .split(/\n\s*\n/u)
    .filter((block) => block.trim()).length;
}

/**
 * superRefine rather than chained refine so a pitch that is both too short and unbroken reports both
 * issues at once. Chained refines short-circuit, which would cost a second corrective retry to
 * surface the second problem.
 */
const pitchDraft = text.superRefine((value, ctx) => {
  const words = pitchWordCount(value);
  if (words < PITCH_MIN_WORDS || words > PITCH_MAX_WORDS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `pitchDraft must contain ${PITCH_MIN_WORDS} to ${PITCH_MAX_WORDS} words`,
    });
  }
  if (pitchParagraphCount(value) < PITCH_MIN_PARAGRAPHS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        `pitchDraft must be at least ${PITCH_MIN_PARAGRAPHS} paragraphs ` +
        `separated by a blank line`,
    });
  }
});

const common = {
  schemaVersion: z.literal("1.1"),
  languageCode: z.string().min(2).max(12),
  title: shortText,
  summary: text,
};

export const proposalOutputSchema = z.object({
  ...common,
  actionId: z.literal("proposal"),
  labels: z.object({
    angle: shortText,
    soWhat: shortText,
    whyNow: shortText,
    questions: shortText,
    whatsNew: shortText,
    expectedEvidence: shortText,
    originality: shortText,
    pitchDraft: shortText,
  }),
  angle: text,
  soWhat: text,
  whyNow: text,
  questions: z
    .array(z.object({ id: z.string().regex(/^Q[1-6]$/), text }))
    .min(3)
    .max(6),
  whatsNew: text,
  expectedEvidence: z
    .array(
      z.object({
        item: text,
        kind: z.enum(["document", "data", "interview", "fieldwork"]),
        kindLabel: shortText,
      }),
    )
    .min(1)
    .max(20),
  originalityCheck: text,
  pitchDraft,
});

export const ideasOutputSchema = z.object({
  ...common,
  actionId: z.literal("proposalIdeas"),
  labels: z.object({
    angle: shortText,
    whyNow: shortText,
    firstSource: shortText,
    sources: shortText,
    recommended: shortText,
  }),
  recommendedIndex: z.number().int().min(1).max(3),
  recommendationReason: text,
  ideas: z
    .array(
      z.object({
        title: shortText,
        angle: text,
        whyNow: text,
        firstSource: text,
        sourceRefs: z.array(sourceRef).max(5).default([]),
      }),
    )
    .length(3),
});

export const researchOutputSchema = z.object({
  ...common,
  actionId: z.literal("research"),
  labels: z.object({
    contradictions: shortText,
    unanswered: shortText,
    sources: shortText,
  }),
  keyFinding: text,
  sections: z
    .array(
      z.object({
        heading: shortText,
        findings: z
          .array(
            z.object({
              text,
              certainty: z.enum([
                "source_supported",
                "reported_claim",
                "conflicting",
                "unverified",
              ]),
              certaintyLabel: shortText,
              sourceType: z.enum([
                "peer_reviewed",
                "official",
                "fieldwork",
                "interview",
                "commercial_data",
                "company_statement",
                "journalism",
              ]),
              sourceTypeLabel: shortText,
              sourceRefs: z.array(sourceRef).max(10).default([]),
              date: z.string().max(100).default(""),
              servesQuestion: z.string().regex(/^Q[1-6]$/),
            }),
          )
          .min(1)
          .max(30),
      }),
    )
    .min(1)
    .max(15),
  contradictions: z
    .array(z.object({ pointA: text, pointB: text, note: text }))
    .max(20)
    .default([]),
  unanswered: z
    .array(z.object({ question: text, suggestion: text }))
    .max(20)
    .default([]),
});

export const fieldworkOutputSchema = z.object({
  ...common,
  actionId: z.literal("fieldworkPlan"),
  labels: z.object({
    sources: shortText,
    interviews: shortText,
    evidence: shortText,
    logistics: shortText,
    itinerary: shortText,
    safetyAccess: shortText,
    equipment: shortText,
    beforeArrival: shortText,
  }),
  planSummary: text,
  humanSources: z
    .array(
      z.object({
        who: text,
        role: text,
        affiliation: z.string(),
        relevance: text,
        contactMethod: text,
        type: z.enum([
          "official",
          "expert",
          "civil_society",
          "researcher",
          "affected_community",
          "industry_insider",
        ]),
        typeLabel: shortText,
      }),
    )
    .max(30),
  interviews: z
    .array(
      z.object({
        forSource: text,
        background: z.array(text).max(20),
        accountability: z.array(text).max(20),
        technical: z.array(text).max(20),
        sensitiveFlags: z.array(text).max(20),
      }),
    )
    .max(30),
  evidence: z
    .array(
      z.object({
        item: text,
        kind: z.enum(["document", "site", "sample_or_data", "visual"]),
        kindLabel: shortText,
        method: text,
        evidentiaryValue: z.enum(["high", "medium", "supporting"]),
        evidentiaryValueLabel: shortText,
      }),
    )
    .max(40),
  logistics: z.object({
    itinerary: z
      .array(z.object({ order: z.number().int().min(1), place: text, why: text }))
      .max(30),
    safetyAccess: z.array(text).max(30),
    equipment: z.array(text).max(30),
    beforeArrival: z.array(text).max(30),
  }),
});

const gapSchema = z.object({
  what: text,
  criticality: z.number().int().min(1).max(5),
  whatsNeeded: z.array(text).max(20),
  howToGet: z.array(text).max(20),
  requestDraft: z.string().default(""),
});

export const frameworkOutputSchema = z.object({
  ...common,
  actionId: z.literal("storyFramework"),
  labels: z.object({
    missing: shortText,
    whyFits: shortText,
    thesis: shortText,
    spine: shortText,
    sections: shortText,
    opening: shortText,
    ending: shortText,
    gaps: shortText,
    actions: shortText,
  }),
  verdict: z.enum(["framework", "insufficient"]),
  missing: z
    .array(
      z.object({
        item: text,
        criticality: z.number().int().min(1).max(5),
        howToGet: text,
      }),
    )
    .max(30),
  reminder: z.string(),
  framework: z.string(),
  whyFits: z.string(),
  thesis: z.string(),
  spine: z.string(),
  completionPct: z.number().min(0).max(100),
  sections: z
    .array(
      z.object({
        order: z.number().int().min(1),
        name: shortText,
        sharePct: z.number().min(0).max(100),
        role: text,
        yourMaterial: text,
        status: z.enum(["ready", "partial", "missing"]),
        statusLabel: shortText,
      }),
    )
    .max(20),
  opening: z.object({ choice: z.string(), application: z.string() }),
  ending: z.object({ choice: z.string(), application: z.string() }),
  gaps: z.array(gapSchema).max(30),
  actionItems: z
    .array(
      z.object({
        when: z.enum(["today", "this_week", "before_publication"]),
        whenLabel: shortText,
        task: text,
      }),
    )
    .max(30),
});

export const editedOutputSchema = z.object({
  ...common,
  actionId: z.literal("editDraft"),
  labels: z.object({
    persona: shortText,
    editedText: shortText,
    changes: shortText,
    flags: shortText,
    unverifiedAdditions: shortText,
  }),
  persona: z.enum(["anchor", "surgeon", "bard", "mimic", "alchemist"]),
  personaLabel: shortText,
  personaWhy: text,
  editedTextMd: text,
  changeSummary: z
    .array(
      z.object({
        kind: z.enum(["merge", "remove_filler", "transition", "rhythm", "wording"]),
        kindLabel: shortText,
        note: text,
      }),
    )
    .max(20),
  flags: z
    .array(
      z.object({
        kind: z.enum(["needs_source", "ambiguity", "internal_contradiction"]),
        kindLabel: shortText,
        excerpt: text,
        note: text,
      }),
    )
    .max(30),
  unverifiedAdditions: z.array(text).max(20).default([]),
});

export const claimCheckOutputSchema = z.object({
  ...common,
  actionId: z.literal("claimCheck"),
  labels: z.object({
    highRisk: shortText,
    mediumRisk: shortText,
    lowRisk: shortText,
    howToVerify: shortText,
    primarySource: shortText,
    contradictions: shortText,
    sources: shortText,
  }),
  items: z
    .array(
      z.object({
        id: z.string().regex(/^C[1-9]\d*$/),
        kind: z.enum(["claim", "number", "quote", "link"]),
        kindLabel: shortText,
        claimType: z.enum([
          "statistical",
          "legal",
          "supply_chain",
          "scientific",
          "temporal",
          "causal",
          "general",
        ]),
        claimTypeLabel: shortText,
        text,
        risk: z.enum(["high", "medium", "low"]),
        status: z.enum([
          "needs_verification",
          "needs_source",
          "internal_contradiction",
        ]),
        statusLabel: shortText,
        howToVerify: text,
        primarySourceTarget: text,
        trapWarning: z.string().default(""),
        sourceRefs: z.array(sourceRef).max(10).default([]),
      }),
    )
    .min(1)
    .max(100),
  internalContradictions: z
    .array(z.object({ a: text, b: text }))
    .max(30)
    .default([]),
});

type WithSources<T> = T & { sources: Source[] };
export type ProposalOutput = WithSources<z.infer<typeof proposalOutputSchema>>;
export type IdeasOutput = WithSources<z.infer<typeof ideasOutputSchema>>;
export type ResearchOutput = WithSources<z.infer<typeof researchOutputSchema>>;
export type FieldworkOutput = WithSources<z.infer<typeof fieldworkOutputSchema>>;
export type FrameworkOutput = WithSources<z.infer<typeof frameworkOutputSchema>>;
export type EditedOutput = WithSources<z.infer<typeof editedOutputSchema>>;
export type ClaimCheckOutput = WithSources<z.infer<typeof claimCheckOutputSchema>>;
export type ParsedOutput =
  | ProposalOutput
  | IdeasOutput
  | ResearchOutput
  | FieldworkOutput
  | FrameworkOutput
  | EditedOutput
  | ClaimCheckOutput;
type ParsedWithoutSources =
  | z.infer<typeof proposalOutputSchema>
  | z.infer<typeof ideasOutputSchema>
  | z.infer<typeof researchOutputSchema>
  | z.infer<typeof fieldworkOutputSchema>
  | z.infer<typeof frameworkOutputSchema>
  | z.infer<typeof editedOutputSchema>
  | z.infer<typeof claimCheckOutputSchema>;

type JsonSchema = Record<string, unknown>;
const stringSchema = (): JsonSchema => ({ type: "string" });
/**
 * `description` is metadata, not part of the decoding grammar, so it costs nothing against the
 * Vertex budget documented below while still reaching the model.
 */
const describedString = (description: string): JsonSchema => ({ type: "string", description });
const stringArraySchema = (): JsonSchema => ({
  type: "array",
  items: stringSchema(),
});
const sourceRefsSchema = (): JsonSchema => ({
  type: "array",
  items: stringSchema(),
});
const objectSchema = (required: string[], properties: Record<string, JsonSchema>): JsonSchema => ({
  type: "object",
  required,
  properties,
});
const arraySchema = (
  items: JsonSchema,
  limits: { minItems?: number; maxItems?: number } = {},
): JsonSchema => ({
  type: "array",
  items,
  ...limits,
});
const enumSchema = (values: string[]): JsonSchema => ({ type: "string", enum: values });
const numberSchema = (minimum?: number, maximum?: number): JsonSchema => ({
  type: "number",
  ...(minimum === undefined ? {} : { minimum }),
  ...(maximum === undefined ? {} : { maximum }),
});
const integerSchema = (minimum?: number, maximum?: number): JsonSchema => ({
  type: "integer",
  ...(minimum === undefined ? {} : { minimum }),
  ...(maximum === undefined ? {} : { maximum }),
});

function commonProperties(actionId: ActionId): Record<string, JsonSchema> {
  return {
    schemaVersion: enumSchema(["1.1"]),
    actionId: enumSchema([actionId]),
    languageCode: stringSchema(),
    title: stringSchema(),
    summary: stringSchema(),
  };
}

function response(
  actionId: ActionId,
  required: string[],
  properties: Record<string, JsonSchema>,
): JsonSchema {
  return objectSchema(
    ["schemaVersion", "actionId", "languageCode", "title", "summary", ...required],
    { ...commonProperties(actionId), ...properties },
  );
}

const labelsSchema = (keys: string[]): JsonSchema =>
  objectSchema(keys, Object.fromEntries(keys.map((key) => [key, stringSchema()])));

export const responseSchemas: Record<ActionId, JsonSchema> = {
  proposalIdeas: response(
    "proposalIdeas",
    ["labels", "recommendedIndex", "recommendationReason", "ideas"],
    {
      labels: labelsSchema(["angle", "whyNow", "firstSource", "sources", "recommended"]),
      recommendedIndex: {
        type: "integer",
        minimum: 1,
        maximum: 3,
      },
      recommendationReason: stringSchema(),
      ideas: arraySchema(
        objectSchema(
          ["title", "angle", "whyNow", "firstSource", "sourceRefs"],
          {
            title: stringSchema(),
            angle: stringSchema(),
            whyNow: stringSchema(),
            firstSource: stringSchema(),
            sourceRefs: sourceRefsSchema(),
          },
        ),
        { minItems: 3, maxItems: 3 },
      ),
    },
  ),
  proposal: response(
    "proposal",
    [
      "labels",
      "angle",
      "soWhat",
      "whyNow",
      "questions",
      "whatsNew",
      "expectedEvidence",
      "originalityCheck",
      "pitchDraft",
    ],
    {
      labels: labelsSchema([
        "angle",
        "soWhat",
        "whyNow",
        "questions",
        "whatsNew",
        "expectedEvidence",
        "originality",
        "pitchDraft",
      ]),
      angle: stringSchema(),
      soWhat: stringSchema(),
      whyNow: stringSchema(),
      questions: arraySchema(
        objectSchema(["id", "text"], { id: stringSchema(), text: stringSchema() }),
        { minItems: 3, maxItems: 6 },
      ),
      whatsNew: stringSchema(),
      expectedEvidence: arraySchema(
        objectSchema(
          ["item", "kind", "kindLabel"],
          {
            item: stringSchema(),
            kind: enumSchema(["document", "data", "interview", "fieldwork"]),
            kindLabel: stringSchema(),
          },
        ),
        { minItems: 1, maxItems: 20 },
      ),
      originalityCheck: stringSchema(),
      // The word range and paragraph rule are Zod refines that Vertex cannot enforce, so state them
      // here as well as in the prompt. Missing either costs the journalist a whole proposal and one
      // corrective retry.
      pitchDraft: describedString(
        `The complete pitch, ${PITCH_MIN_WORDS} to ${PITCH_MAX_WORDS} words. ` +
          `Count the words before answering; shorter or longer is rejected. ` +
          `Write it as ${PITCH_MIN_PARAGRAPHS} to ${PITCH_MAX_PARAGRAPHS} paragraphs separated by a ` +
          `blank line. One unbroken block is rejected, in every language including Arabic.`,
      ),
    },
  ),
  research: response(
    "research",
    ["labels", "keyFinding", "sections", "contradictions", "unanswered"],
    {
      labels: labelsSchema(["contradictions", "unanswered", "sources"]),
      keyFinding: stringSchema(),
      sections: arraySchema(
        objectSchema(
          ["heading", "findings"],
          {
            heading: stringSchema(),
            findings: arraySchema(
              objectSchema(
                [
                  "text",
                  "certainty",
                  "certaintyLabel",
                  "sourceType",
                  "sourceTypeLabel",
                  "sourceRefs",
                  "date",
                  "servesQuestion",
                ],
                {
                  text: stringSchema(),
                  certainty: enumSchema([
                    "source_supported",
                    "reported_claim",
                    "conflicting",
                    "unverified",
                  ]),
                  certaintyLabel: stringSchema(),
                  sourceType: enumSchema([
                    "peer_reviewed",
                    "official",
                    "fieldwork",
                    "interview",
                    "commercial_data",
                    "company_statement",
                    "journalism",
                  ]),
                  sourceTypeLabel: stringSchema(),
                  sourceRefs: sourceRefsSchema(),
                  date: stringSchema(),
                  servesQuestion: stringSchema(),
                },
              ),
              { minItems: 1, maxItems: 30 },
            ),
          },
        ),
        { minItems: 1, maxItems: 15 },
      ),
      contradictions: arraySchema(
        objectSchema(
          ["pointA", "pointB", "note"],
          { pointA: stringSchema(), pointB: stringSchema(), note: stringSchema() },
        ),
        { maxItems: 20 },
      ),
      unanswered: arraySchema(
        objectSchema(
          ["question", "suggestion"],
          { question: stringSchema(), suggestion: stringSchema() },
        ),
        { maxItems: 20 },
      ),
    },
  ),
  fieldworkPlan: response(
    "fieldworkPlan",
    ["labels", "planSummary", "humanSources", "interviews", "evidence", "logistics"],
    {
      labels: labelsSchema([
        "sources",
        "interviews",
        "evidence",
        "logistics",
        "itinerary",
        "safetyAccess",
        "equipment",
        "beforeArrival",
      ]),
      planSummary: stringSchema(),
      humanSources: arraySchema(
        objectSchema(
          ["who", "role", "affiliation", "relevance", "contactMethod", "type", "typeLabel"],
          {
            who: stringSchema(),
            role: stringSchema(),
            affiliation: stringSchema(),
            relevance: stringSchema(),
            contactMethod: stringSchema(),
            type: enumSchema([
              "official",
              "expert",
              "civil_society",
              "researcher",
              "affected_community",
              "industry_insider",
            ]),
            typeLabel: stringSchema(),
          },
        ),
        { maxItems: 30 },
      ),
      interviews: arraySchema(
        objectSchema(
          ["forSource", "background", "accountability", "technical", "sensitiveFlags"],
          {
            forSource: stringSchema(),
            background: stringArraySchema(),
            accountability: stringArraySchema(),
            technical: stringArraySchema(),
            sensitiveFlags: stringArraySchema(),
          },
        ),
        { maxItems: 30 },
      ),
      evidence: arraySchema(
        objectSchema(
          ["item", "kind", "kindLabel", "method", "evidentiaryValue", "evidentiaryValueLabel"],
          {
            item: stringSchema(),
            kind: enumSchema(["document", "site", "sample_or_data", "visual"]),
            kindLabel: stringSchema(),
            method: stringSchema(),
            evidentiaryValue: enumSchema(["high", "medium", "supporting"]),
            evidentiaryValueLabel: stringSchema(),
          },
        ),
        { maxItems: 40 },
      ),
      logistics: objectSchema(
        ["itinerary", "safetyAccess", "equipment", "beforeArrival"],
        {
          itinerary: arraySchema(
            objectSchema(
              ["order", "place", "why"],
              {
                order: integerSchema(1),
                place: stringSchema(),
                why: stringSchema(),
              },
            ),
            { maxItems: 30 },
          ),
          safetyAccess: stringArraySchema(),
          equipment: stringArraySchema(),
          beforeArrival: stringArraySchema(),
        },
      ),
    },
  ),
  storyFramework: response(
    "storyFramework",
    [
      "labels",
      "verdict",
      "missing",
      "reminder",
      "framework",
      "whyFits",
      "thesis",
      "spine",
      "completionPct",
      "sections",
      "opening",
      "ending",
      "gaps",
      "actionItems",
    ],
    {
      labels: labelsSchema([
        "missing",
        "whyFits",
        "thesis",
        "spine",
        "sections",
        "opening",
        "ending",
        "gaps",
        "actions",
      ]),
      verdict: enumSchema(["framework", "insufficient"]),
      missing: arraySchema(
        objectSchema(
          ["item", "criticality", "howToGet"],
          {
            item: stringSchema(),
            criticality: integerSchema(1, 5),
            howToGet: stringSchema(),
          },
        ),
        { maxItems: 30 },
      ),
      reminder: stringSchema(),
      framework: stringSchema(),
      whyFits: stringSchema(),
      thesis: stringSchema(),
      spine: stringSchema(),
      completionPct: numberSchema(0, 100),
      sections: arraySchema(
        objectSchema(
          ["order", "name", "sharePct", "role", "yourMaterial", "status", "statusLabel"],
          {
            order: integerSchema(1),
            name: stringSchema(),
            sharePct: numberSchema(0, 100),
            role: stringSchema(),
            yourMaterial: stringSchema(),
            status: enumSchema(["ready", "partial", "missing"]),
            statusLabel: stringSchema(),
          },
        ),
        { maxItems: 20 },
      ),
      opening: objectSchema(
        ["choice", "application"],
        { choice: stringSchema(), application: stringSchema() },
      ),
      ending: objectSchema(
        ["choice", "application"],
        { choice: stringSchema(), application: stringSchema() },
      ),
      gaps: arraySchema(
        objectSchema(
          ["what", "criticality", "whatsNeeded", "howToGet", "requestDraft"],
          {
            what: stringSchema(),
            criticality: integerSchema(1, 5),
            whatsNeeded: stringArraySchema(),
            howToGet: stringArraySchema(),
            requestDraft: stringSchema(),
          },
        ),
        { maxItems: 30 },
      ),
      actionItems: arraySchema(
        objectSchema(
          ["when", "whenLabel", "task"],
          {
            when: enumSchema(["today", "this_week", "before_publication"]),
            whenLabel: stringSchema(),
            task: stringSchema(),
          },
        ),
        { maxItems: 30 },
      ),
    },
  ),
  editDraft: response(
    "editDraft",
    [
      "labels",
      "persona",
      "personaLabel",
      "personaWhy",
      "editedTextMd",
      "changeSummary",
      "flags",
      "unverifiedAdditions",
    ],
    {
      labels: labelsSchema([
        "persona",
        "editedText",
        "changes",
        "flags",
        "unverifiedAdditions",
      ]),
      persona: enumSchema(["anchor", "surgeon", "bard", "mimic", "alchemist"]),
      personaLabel: stringSchema(),
      personaWhy: stringSchema(),
      editedTextMd: stringSchema(),
      changeSummary: arraySchema(
        objectSchema(
          ["kind", "kindLabel", "note"],
          {
            kind: enumSchema(["merge", "remove_filler", "transition", "rhythm", "wording"]),
            kindLabel: stringSchema(),
            note: stringSchema(),
          },
        ),
        { maxItems: 20 },
      ),
      flags: arraySchema(
        objectSchema(
          ["kind", "kindLabel", "excerpt", "note"],
          {
            kind: enumSchema(["needs_source", "ambiguity", "internal_contradiction"]),
            kindLabel: stringSchema(),
            excerpt: stringSchema(),
            note: stringSchema(),
          },
        ),
        { maxItems: 30 },
      ),
      unverifiedAdditions: stringArraySchema(),
    },
  ),
  claimCheck: response(
    "claimCheck",
    ["labels", "items", "internalContradictions"],
    {
      labels: labelsSchema([
        "highRisk",
        "mediumRisk",
        "lowRisk",
        "howToVerify",
        "primarySource",
        "contradictions",
        "sources",
      ]),
      items: arraySchema(
        objectSchema(
          [
            "id",
            "kind",
            "kindLabel",
            "claimType",
            "claimTypeLabel",
            "text",
            "risk",
            "status",
            "statusLabel",
            "howToVerify",
            "primarySourceTarget",
            "trapWarning",
            "sourceRefs",
          ],
          {
            id: stringSchema(),
            kind: enumSchema(["claim", "number", "quote", "link"]),
            kindLabel: stringSchema(),
            claimType: enumSchema([
              "statistical",
              "legal",
              "supply_chain",
              "scientific",
              "temporal",
              "causal",
              "general",
            ]),
            claimTypeLabel: stringSchema(),
            text: stringSchema(),
            risk: enumSchema(["high", "medium", "low"]),
            status: enumSchema([
              "needs_verification",
              "needs_source",
              "internal_contradiction",
            ]),
            statusLabel: stringSchema(),
            howToVerify: stringSchema(),
            primarySourceTarget: stringSchema(),
            trapWarning: stringSchema(),
            sourceRefs: sourceRefsSchema(),
          },
        ),
        { minItems: 1, maxItems: 100 },
      ),
      internalContradictions: arraySchema(
        objectSchema(["a", "b"], { a: stringSchema(), b: stringSchema() }),
        { maxItems: 30 },
      ),
    },
  ),
};

/**
 * Vertex compiles `responseJsonSchema` into a constrained-decoding grammar and rejects the request
 * with a bare 400 INVALID_ARGUMENT once that grammar grows too large. Measured against
 * `gemini-3.6-flash` on 2026-07-28, the budget tracks `maxItems x properties-per-element` and the
 * cliff sits between 260 and 300: an array of 13-property objects passes at `maxItems` 20 (260) and
 * fails at 30 (390), while a 3-property one passes at 30 (90) and fails at 100 (300). Nested arrays
 * multiply, so `research` exceeded the budget even with every `maxItems` lowered to 5 — capping
 * cannot fix it, only omitting the keyword can. Five of the seven actions were over budget.
 *
 * `maxItems` is therefore dropped from the wire schema. It is the expensive keyword and the only
 * one the Zod parsers below already enforce independently, so `parseOutput` still rejects an
 * oversized array. `minItems`, `minimum`, and `maximum` are cheap and stay, keeping the guarantees
 * that actually shape a usable document ("at least one finding", "three to six questions").
 * Revert this once Vertex raises the limit; `responseSchemas` remains the statement of intent.
 */
function withoutMaxItems(schema: JsonSchema): JsonSchema {
  const result: JsonSchema = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "maxItems") continue;
    if (key === "properties" && value && typeof value === "object") {
      result[key] = Object.fromEntries(
        Object.entries(value as Record<string, JsonSchema>).map(([name, child]) => [
          name,
          withoutMaxItems(child),
        ]),
      );
    } else if (key === "items" && value && typeof value === "object") {
      result[key] = withoutMaxItems(value as JsonSchema);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export const wireResponseSchemas: Record<ActionId, JsonSchema> = Object.fromEntries(
  Object.entries(responseSchemas).map(([actionId, schema]) => [actionId, withoutMaxItems(schema)]),
) as Record<ActionId, JsonSchema>;

const parsers: Record<ActionId, z.ZodType<ParsedWithoutSources>> = {
  proposalIdeas: ideasOutputSchema,
  proposal: proposalOutputSchema,
  research: researchOutputSchema,
  fieldworkPlan: fieldworkOutputSchema,
  storyFramework: frameworkOutputSchema,
  editDraft: editedOutputSchema,
  claimCheck: claimCheckOutputSchema,
};

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIdeasPreview(value: unknown): unknown {
  const input = recordOf(value);
  const rawIdeas = Array.isArray(input.ideas) ? input.ideas.slice(0, 3) : [];
  const visibleText = rawIdeas
    .map((idea) => Object.values(recordOf(idea)).map(stringOf).join(" "))
    .join(" ");
  const requestedLanguage = stringOf(input.languageCode);
  const arabic =
    /^ar(?:-|$)/i.test(requestedLanguage) || /[\u0600-\u06ff]/u.test(visibleText);
  const languageCode =
    requestedLanguage.length >= 2 && requestedLanguage.length <= 12
      ? requestedLanguage
      : arabic
        ? "ar"
        : "en";
  const labels = recordOf(input.labels);
  const recommendation = Number(input.recommendedIndex);
  const recommendedIndex = Number.isFinite(recommendation)
    ? Math.min(3, Math.max(1, Math.trunc(recommendation)))
    : 1;

  return {
    ...input,
    schemaVersion: "1.1",
    actionId: "proposalIdeas",
    languageCode,
    title:
      stringOf(input.title) ||
      (arabic ? "زوايا صحفية مقترحة" : "Proposed journalism angles"),
    summary:
      stringOf(input.summary) ||
      (arabic
        ? "ثلاث زوايا قابلة للاختيار داخل المحرر."
        : "Three selectable angles for the proposal wizard."),
    labels: {
      angle: stringOf(labels.angle) || (arabic ? "الزاوية" : "Angle"),
      whyNow: stringOf(labels.whyNow) || (arabic ? "لماذا الآن" : "Why now"),
      firstSource:
        stringOf(labels.firstSource) ||
        (arabic ? "نقطة البداية" : "First reporting source"),
      sources: stringOf(labels.sources) || (arabic ? "المصادر" : "Sources"),
      recommended:
        stringOf(labels.recommended) || (arabic ? "موصى بها" : "Recommended"),
    },
    recommendedIndex,
    recommendationReason:
      stringOf(input.recommendationReason) ||
      (arabic
        ? "هذه الزاوية أوضح من حيث المصلحة العامة وإمكانية التنفيذ."
        : "This angle offers the clearest public-interest and feasibility fit."),
    ideas: rawIdeas.map((idea, index) => {
      const item = recordOf(idea);
      const angle = stringOf(item.angle);
      const rawRefs = Array.isArray(item.sourceRefs) ? item.sourceRefs : [];
      return {
        title:
          stringOf(item.title) ||
          angle.slice(0, 300) ||
          (arabic ? `الزاوية ${index + 1}` : `Angle ${index + 1}`),
        angle,
        whyNow:
          stringOf(item.whyNow) ||
          (arabic
            ? "يحتاج التوقيت إلى تأكيد تحريري أثناء الإبلاغ."
            : "The timing should be confirmed during reporting."),
        firstSource:
          stringOf(item.firstSource) ||
          (arabic
            ? "ابدأ بمصدر أولي أو سجل رسمي ذي صلة."
            : "Start with a relevant primary source or official record."),
        sourceRefs: rawRefs
          .map(stringOf)
          .filter((ref) => /^S[1-9]\d*$/.test(ref))
          .slice(0, 5),
      };
    }),
  };
}

export function parseOutput(actionId: ActionId, value: unknown): ParsedOutput {
  const candidate = actionId === "proposalIdeas" ? normalizeIdeasPreview(value) : value;
  return { ...parsers[actionId].parse(candidate), sources: [] } as ParsedOutput;
}
