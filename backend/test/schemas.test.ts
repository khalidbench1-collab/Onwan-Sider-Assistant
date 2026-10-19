import { describe, expect, it } from "vitest";
import type { ActionId } from "../src/types.js";
import {
  PITCH_MIN_PARAGRAPHS,
  parseOutput,
  pitchParagraphCount,
  responseSchemas,
} from "../src/lib/schemas.js";

/** A pitch of `words` words spread over `paragraphs` blank-line-separated blocks. */
const pitch = (words: number, paragraphs: number): string => {
  const all = Array.from({ length: words }, (_, index) => `كلمة${index + 1}`);
  const per = Math.ceil(words / paragraphs);
  const blocks: string[] = [];
  for (let index = 0; index < words; index += per) {
    blocks.push(all.slice(index, index + per).join(" "));
  }
  return blocks.join("\n\n");
};

const base = (actionId: ActionId) => ({
  schemaVersion: "1.1",
  actionId,
  languageCode: "ar",
  title: "عنوان",
  summary: "ملخص موجز",
});

const validOutputs: Record<ActionId, Record<string, unknown>> = {
  proposalIdeas: {
    ...base("proposalIdeas"),
    labels: {
      angle: "الزاوية",
      whyNow: "لماذا الآن",
      firstSource: "نقطة البداية",
      sources: "المصادر",
      recommended: "موصى بها",
    },
    recommendedIndex: 2,
    recommendationReason: "الزاوية الثانية أوضح أثرًا وأسهل تنفيذًا.",
    ideas: [1, 2, 3].map((number) => ({
      title: `فكرة ${number}`,
      angle: "زاوية محددة",
      whyNow: "سبب زمني واضح",
      firstSource: "وثيقة رسمية",
      sourceRefs: ["S1"],
    })),
  },
  proposal: {
    ...base("proposal"),
    labels: {
      angle: "الزاوية",
      soWhat: "الأهمية",
      whyNow: "لماذا الآن",
      questions: "أسئلة العمل",
      whatsNew: "الجديد",
      expectedEvidence: "الأدلة المتوقعة",
      originality: "الأصالة",
      pitchDraft: "مسودة العرض",
    },
    angle: "زاوية محددة",
    soWhat: "أهمية عامة",
    whyNow: "سبب زمني",
    questions: ["Q1", "Q2", "Q3"].map((id) => ({ id, text: "سؤال عمل" })),
    whatsNew: "قيمة جديدة",
    expectedEvidence: [{ item: "سجل عام", kind: "document", kindLabel: "وثيقة" }],
    originalityCheck: "اختبار أصالة صريح",
    pitchDraft: pitch(150, 3),
  },
  research: {
    ...base("research"),
    labels: {
      contradictions: "التناقضات",
      unanswered: "أسئلة مفتوحة",
      sources: "المصادر",
    },
    keyFinding: "نتيجة أساسية",
    sections: [
      {
        heading: "نتائج رسمية",
        findings: [
          {
            text: "نتيجة منسوبة",
            certainty: "reported_claim",
            certaintyLabel: "ادعاء منسوب",
            sourceType: "company_statement",
            sourceTypeLabel: "بيان شركة",
            sourceRefs: ["S1"],
            date: "2026-07-27",
            servesQuestion: "Q1",
          },
        ],
      },
    ],
    contradictions: [],
    unanswered: [],
  },
  fieldworkPlan: {
    ...base("fieldworkPlan"),
    labels: {
      sources: "المصادر البشرية",
      interviews: "المقابلات",
      evidence: "الأدلة",
      logistics: "اللوجستيات",
      itinerary: "المسار",
      safetyAccess: "السلامة والوصول",
      equipment: "المعدات",
      beforeArrival: "قبل الوصول",
    },
    planSummary: "ابدأ بأعلى دليل قيمة.",
    humanSources: [
      {
        who: "مسؤول مختص",
        role: "متحدث",
        affiliation: "",
        relevance: "لحق الرد",
        contactMethod: "قناة المؤسسة الرسمية",
        type: "official",
        typeLabel: "رسمي",
      },
    ],
    interviews: [
      {
        forSource: "المسؤول المختص",
        background: ["ما نطاق المسؤولية؟"],
        accountability: [],
        technical: [],
        sensitiveFlags: [],
      },
    ],
    evidence: [
      {
        item: "السجل الأصلي",
        kind: "document",
        kindLabel: "وثيقة",
        method: "طلب السجل من الجهة",
        evidentiaryValue: "high",
        evidentiaryValueLabel: "قيمة عالية",
      },
    ],
    logistics: {
      itinerary: [{ order: 1, place: "الموقع", why: "الملاحظة" }],
      safetyAccess: [],
      equipment: [],
      beforeArrival: [],
    },
  },
  storyFramework: {
    ...base("storyFramework"),
    labels: {
      missing: "ما ينقص",
      whyFits: "سبب الاختيار",
      thesis: "الفرضية",
      spine: "الخيط الناظم",
      sections: "الأقسام",
      opening: "الافتتاح",
      ending: "الخاتمة",
      gaps: "الفجوات",
      actions: "الإجراءات",
    },
    verdict: "insufficient",
    missing: [{ item: "حق الرد", criticality: 5, howToGet: "إرسال أسئلة مكتوبة" }],
    reminder: "أكمل البحث والعمل الميداني أولًا.",
    framework: "",
    whyFits: "",
    thesis: "",
    spine: "",
    completionPct: 20,
    sections: [],
    opening: { choice: "", application: "" },
    ending: { choice: "", application: "" },
    gaps: [],
    actionItems: [],
  },
  editDraft: {
    ...base("editDraft"),
    labels: {
      persona: "عدسة التحرير",
      editedText: "النص المحرر",
      changes: "التغييرات",
      flags: "ملاحظات المراجعة",
      unverifiedAdditions: "إضافات غير متحققة",
    },
    persona: "mimic",
    personaLabel: "المحاكي",
    personaWhy: "يحافظ على صوت الكاتب.",
    editedTextMd: "نص محرر بلا معلومات جديدة.",
    changeSummary: [{ kind: "wording", kindLabel: "صياغة", note: "اختصار صياغة مطولة." }],
    flags: [],
    unverifiedAdditions: [],
  },
  claimCheck: {
    ...base("claimCheck"),
    labels: {
      highRisk: "مخاطر عالية",
      mediumRisk: "مخاطر متوسطة",
      lowRisk: "مخاطر منخفضة",
      howToVerify: "طريقة التحقق",
      primarySource: "المصدر الأولي",
      contradictions: "تناقضات داخلية",
      sources: "مصادر مرشحة",
    },
    items: [
      {
        id: "C1",
        kind: "number",
        kindLabel: "رقم",
        claimType: "statistical",
        claimTypeLabel: "إحصائي",
        text: "رقم يحتاج إلى تحقق",
        risk: "high",
        status: "needs_verification",
        statusLabel: "يحتاج تحققًا",
        howToVerify: "راجع الجدول الأصلي ومنهجيته.",
        primarySourceTarget: "البيانات الرسمية الأصلية",
        trapWarning: "تحقق من سنة القياس.",
        sourceRefs: ["S1"],
      },
    ],
    internalContradictions: [],
  },
};

describe("Onwan output schema v1.1", () => {
  it("parses every action and supplies an empty backend-owned source list", () => {
    for (const [actionId, value] of Object.entries(validOutputs) as Array<
      [ActionId, Record<string, unknown>]
    >) {
      const parsed = parseOutput(actionId, value);
      expect(parsed.actionId).toBe(actionId);
      expect(parsed.schemaVersion).toBe("1.1");
      expect(parsed.sources).toEqual([]);
    }
  });

  it("normalizes harmless proposal preview wrapper differences", () => {
    const parsed = parseOutput("proposalIdeas", {
      languageCode: "Arabic language response that is too long",
      recommendedIndex: "2",
      ideas: [1, 2, 3, 4].map((number) => ({
        angle: `زاوية محددة ${number}`,
        whyNow: `سبب زمني ${number}`,
        firstSource: `مصدر أولي ${number}`,
      })),
    });
    expect(parsed.actionId).toBe("proposalIdeas");
    if (parsed.actionId !== "proposalIdeas") throw new Error("Unexpected action");
    expect(parsed.ideas).toHaveLength(3);
    expect(parsed.recommendedIndex).toBe(2);
    expect(parsed.languageCode).toBe("ar");
    expect(parsed.labels.recommended).toBe("موصى بها");
    expect(() =>
      parseOutput("proposalIdeas", {
        languageCode: "ar",
        ideas: [
          { angle: "الأولى", whyNow: "الآن", firstSource: "مصدر" },
          { angle: "الثانية", whyNow: "الآن", firstSource: "مصدر" },
        ],
      }),
    ).toThrow();
  });

  it("strips model-supplied source objects before the backend adds grounding metadata", () => {
    const parsed = parseOutput("research", {
      ...validOutputs.research,
      sources: [{ title: "Untrusted", url: "https://model.example/fabricated" }],
    });
    expect(parsed.sources).toEqual([]);
  });

  it("keeps URL fields out of every model response schema", () => {
    const containsKey = (value: unknown, key: string): boolean => {
      if (!value || typeof value !== "object") return false;
      if (Object.prototype.hasOwnProperty.call(value, key)) return true;
      return Object.values(value).some((nested) => containsKey(nested, key));
    };
    for (const schema of Object.values(responseSchemas)) {
      const properties = schema.properties as Record<string, unknown>;
      expect(properties.sources).toBeUndefined();
      expect(containsKey(schema, "url")).toBe(false);
    }
  });

  it("rejects localized machine enums and mismatched action IDs", () => {
    expect(() =>
      parseOutput("research", {
        ...validOutputs.research,
        sections: [
          {
            heading: "نتائج",
            findings: [
              {
                text: "نص",
                certainty: "مؤكد",
                certaintyLabel: "مؤكد",
                sourceType: "official",
                sourceTypeLabel: "رسمي",
                sourceRefs: [],
                date: "",
                servesQuestion: "Q1",
              },
            ],
          },
        ],
      }),
    ).toThrow();
    expect(() => parseOutput("proposal", validOutputs.research)).toThrow();
  });
});

/**
 * The renderer emits pitchDraft as a single markdown block and DocService splits the result on "\n",
 * so a pitch written without blank lines lands in the document as one crowded paragraph. English
 * output happened to be paragraphed by model habit and Arabic was not, which is the bug this guards:
 * the rule is enforced for every language rather than requested and hoped for.
 */
describe("pitchDraft paragraph structure", () => {
  it("counts blank-line-separated blocks, ignoring trailing and repeated blank lines", () => {
    expect(pitchParagraphCount("one\n\ntwo")).toBe(2);
    expect(pitchParagraphCount("one\n\n\n  \n\ntwo\n\n")).toBe(2);
    expect(pitchParagraphCount("single block\nwith a soft break")).toBe(1);
    expect(pitchParagraphCount("")).toBe(0);
  });

  it("rejects a correct-length pitch written as one unbroken block", () => {
    expect(() =>
      parseOutput("proposal", { ...validOutputs.proposal, pitchDraft: pitch(200, 1) }),
    ).toThrow(/paragraph/i);
  });

  it("accepts a pitch at the paragraph minimum", () => {
    expect(() =>
      parseOutput("proposal", {
        ...validOutputs.proposal,
        pitchDraft: pitch(200, PITCH_MIN_PARAGRAPHS),
      }),
    ).not.toThrow();
  });

  it("reports both failures on the pitchDraft path so one retry can fix both", () => {
    try {
      parseOutput("proposal", { ...validOutputs.proposal, pitchDraft: pitch(20, 1) });
      throw new Error("expected parseOutput to throw");
    } catch (error) {
      const issues = (error as { issues?: { path: (string | number)[] }[] }).issues ?? [];
      expect(issues).toHaveLength(2);
      expect(issues.every((issue) => issue.path[0] === "pitchDraft")).toBe(true);
    }
  });
});
