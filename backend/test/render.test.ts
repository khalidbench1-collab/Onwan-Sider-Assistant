import { describe, expect, it } from "vitest";
import { renderOutput } from "../src/lib/render.js";
import { sanitizeForTest } from "../src/lib/log.js";

describe("output rendering", () => {
  it("renders model-localized headings without forcing the UI language", () => {
    const rendered = renderOutput({
      schemaVersion: "1.1",
      actionId: "research",
      languageCode: "fr",
      title: "Recherche",
      summary: "Résumé du travail documentaire.",
      labels: {
        contradictions: "Contradictions",
        unanswered: "Questions ouvertes",
        sources: "Sources",
      },
      keyFinding: "Le document public est la meilleure première piste.",
      sections: [
        {
          heading: "Prochaines étapes",
          findings: [
            {
              text: "Commencer par les documents publics.",
              certainty: "source_supported",
              certaintyLabel: "Soutenu par une source",
              sourceType: "official",
              sourceTypeLabel: "Source officielle",
              sourceRefs: [],
              date: "",
              servesQuestion: "Q1",
            },
          ],
        },
      ],
      contradictions: [],
      unanswered: [],
      sources: [],
    });
    expect(rendered.markdown).toContain("# Recherche");
    expect(rendered.markdown).toContain("## Prochaines étapes");
    expect(rendered.languageCode).toBe("fr");
  });

  it("drops unsafe source protocols and renders only trusted source references", () => {
    const rendered = renderOutput({
      schemaVersion: "1.1",
      actionId: "research",
      languageCode: "en",
      title: "Research",
      summary: "A source-safe memo.",
      labels: {
        contradictions: "Contradictions",
        unanswered: "Unanswered",
        sources: "Sources",
      },
      keyFinding: "The official report is relevant.",
      sections: [
        {
          heading: "Finding",
          findings: [
            {
              text: "Text",
              certainty: "source_supported",
              certaintyLabel: "Source-supported",
              sourceType: "official",
              sourceTypeLabel: "Official",
              sourceRefs: ["S1", "S2", "S99"],
              date: "2026",
              servesQuestion: "Q1",
            },
          ],
        },
      ],
      contradictions: [],
      unanswered: [],
      sources: [
        { title: "Bad", url: "javascript:alert(1)" },
        { title: "Good", url: "https://example.com/report" },
      ],
    });
    expect(rendered.markdown).not.toContain("javascript:");
    expect(rendered.markdown).toContain("https://example.com/report");
    expect(rendered.markdown).toContain("[S2]");
    expect(rendered.markdown).not.toContain("[S1]");
    expect(rendered.markdown).not.toContain("[S99]");
  });

  /**
   * DocService.insertStructuredAt_ splits the markdown on "\n" and makes each line a paragraph, so
   * the blank lines inside pitchDraft are the only thing standing between the reader and one crowded
   * block. The renderer must pass them through untouched.
   */
  it("preserves the blank lines inside a multi-paragraph pitch", () => {
    const rendered = renderOutput({
      schemaVersion: "1.1",
      actionId: "proposal",
      languageCode: "ar",
      title: "عنوان",
      summary: "ملخص",
      labels: {
        angle: "الزاوية",
        soWhat: "الأهمية",
        whyNow: "لماذا الآن",
        questions: "أسئلة",
        whatsNew: "الجديد",
        expectedEvidence: "الأدلة",
        originality: "الأصالة",
        pitchDraft: "مسودة العرض",
      },
      angle: "زاوية",
      soWhat: "أهمية",
      whyNow: "توقيت",
      questions: [{ id: "Q1", text: "سؤال" }],
      whatsNew: "جديد",
      expectedEvidence: [{ item: "سجل", kind: "document", kindLabel: "وثيقة" }],
      originalityCheck: "أصالة",
      pitchDraft: "الفقرة الأولى.\n\nالفقرة الثانية.\n\nالفقرة الثالثة.",
      sources: [],
    });

    expect(rendered.markdown).toContain("الفقرة الأولى.\n\nالفقرة الثانية.\n\nالفقرة الثالثة.");
  });
});

describe("privacy-safe logging", () => {
  it("redacts document content, prompts, email, and tokens", () => {
    const value = sanitizeForTest({
      targetText: "confidential story",
      nested: {
        styleProfile: "private prose",
        email: "source@example.com",
        token: "secret",
        actionId: "research",
      },
    });
    expect(JSON.stringify(value)).not.toContain("confidential");
    expect(JSON.stringify(value)).not.toContain("source@example.com");
    expect(value).toMatchObject({
      targetText: "[REDACTED]",
      nested: {
        styleProfile: "[REDACTED]",
        email: "[REDACTED]",
        token: "[REDACTED]",
        actionId: "research",
      },
    });
  });
});
