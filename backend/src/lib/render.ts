import type { Source } from "../types.js";
import type { ParsedOutput } from "./schemas.js";

function safeSource(source: Source): Source | null {
  try {
    const parsed = new URL(source.url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return { url: parsed.toString(), title: source.title.trim() || parsed.hostname };
  } catch {
    return null;
  }
}

function link(source: Source): string {
  const label = source.title.replace(/[[\]]/g, "");
  return `[${label}](${source.url})`;
}

function sourceContext(sources: Source[]): {
  safe: Source[];
  byRef: Map<string, Source>;
} {
  const safe: Source[] = [];
  const byRef = new Map<string, Source>();
  sources.forEach((source, index) => {
    const cleaned = safeSource(source);
    if (!cleaned) return;
    safe.push(cleaned);
    byRef.set(`S${index + 1}`, cleaned);
  });
  return { safe, byRef };
}

function refs(refsToRender: string[], byRef: Map<string, Source>): string {
  const seen = new Set<string>();
  const rendered = refsToRender
    .filter((ref) => {
      if (seen.has(ref) || !byRef.has(ref)) return false;
      seen.add(ref);
      return true;
    })
    .map((ref) => `[${ref}](${byRef.get(ref)!.url})`);
  return rendered.length ? ` (${rendered.join(", ")})` : "";
}

function appendSources(lines: string[], heading: string, sources: Source[]): void {
  if (!sources.length) return;
  lines.push(`## ${heading}`, ...sources.map((source) => `- ${link(source)}`));
}

function pushList(lines: string[], values: string[]): void {
  lines.push(...values.map((value) => `- ${value}`));
}

const certaintySymbol = {
  source_supported: "✅",
  reported_claim: "⚠️",
  conflicting: "🔴",
  unverified: "◻️",
} as const;

const evidenceSymbol = {
  high: "●●●",
  medium: "●●",
  supporting: "●",
} as const;

const sectionStatusSymbol = {
  ready: "✅",
  partial: "⚠️",
  missing: "◻️",
} as const;

export function renderOutput(value: ParsedOutput): {
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
} {
  const sourceData = sourceContext(value.sources);
  const lines = [`# ${value.title}`, value.summary];

  switch (value.actionId) {
    case "proposalIdeas": {
      value.ideas.forEach((idea, index) => {
        lines.push(
          `## ${index + 1}. ${idea.title}`,
          `**${value.labels.angle}:** ${idea.angle}`,
          `**${value.labels.whyNow}:** ${idea.whyNow}`,
          `**${value.labels.firstSource}:** ${idea.firstSource}${refs(idea.sourceRefs, sourceData.byRef)}`,
        );
      });
      appendSources(lines, value.labels.sources, sourceData.safe);
      return {
        kind: "ideas",
        markdown: lines.join("\n\n"),
        languageCode: value.languageCode,
        sources: sourceData.safe,
        preview: {
          recommendedIndex: value.recommendedIndex,
          recommendationReason: value.recommendationReason,
          ideas: value.ideas.map((idea) => ({
            title: idea.title,
            angle: idea.angle,
            whyNow: idea.whyNow,
            firstSource: idea.firstSource,
          })),
        },
      };
    }

    case "proposal": {
      lines.push(
        `## ${value.labels.angle}`,
        value.angle,
        `## ${value.labels.soWhat}`,
        value.soWhat,
        `## ${value.labels.whyNow}`,
        value.whyNow,
        `## ${value.labels.questions}`,
      );
      pushList(lines, value.questions.map((question) => `**${question.id}:** ${question.text}`));
      lines.push(`## ${value.labels.whatsNew}`, value.whatsNew);
      lines.push(`## ${value.labels.expectedEvidence}`);
      pushList(
        lines,
        value.expectedEvidence.map(
          (evidence) => `**${evidence.kindLabel}:** ${evidence.item}`,
        ),
      );
      lines.push(
        `## ${value.labels.originality}`,
        value.originalityCheck,
        `## ${value.labels.pitchDraft}`,
        value.pitchDraft,
      );
      break;
    }

    case "research": {
      lines.push(`**${value.keyFinding}**`);
      for (const section of value.sections) {
        lines.push(`## ${section.heading}`);
        pushList(
          lines,
          section.findings.map((finding) => {
            const date = finding.date ? ` — ${finding.date}` : "";
            return `${certaintySymbol[finding.certainty]} **${finding.certaintyLabel} · ${finding.sourceTypeLabel}:** ${finding.text}${date} [${finding.servesQuestion}]${refs(finding.sourceRefs, sourceData.byRef)}`;
          }),
        );
      }
      if (value.contradictions.length) {
        lines.push(`## ${value.labels.contradictions}`);
        pushList(
          lines,
          value.contradictions.map(
            (item) => `🔴 ${item.pointA} ↔ ${item.pointB} — ${item.note}`,
          ),
        );
      }
      if (value.unanswered.length) {
        lines.push(`## ${value.labels.unanswered}`);
        pushList(
          lines,
          value.unanswered.map((item) => `**${item.question}** — ${item.suggestion}`),
        );
      }
      appendSources(lines, value.labels.sources, sourceData.safe);
      break;
    }

    case "fieldworkPlan": {
      lines.push(value.planSummary, `## ${value.labels.sources}`);
      pushList(
        lines,
        value.humanSources.map((source) => {
          const affiliation = source.affiliation ? ` — ${source.affiliation}` : "";
          return `**${source.typeLabel} · ${source.who} — ${source.role}**${affiliation}: ${source.relevance} (${source.contactMethod})`;
        }),
      );
      lines.push(`## ${value.labels.interviews}`);
      for (const interview of value.interviews) {
        lines.push(`### ${interview.forSource}`);
        pushList(lines, [
          ...interview.background,
          ...interview.accountability,
          ...interview.technical,
          ...interview.sensitiveFlags.map((flag) => `⚠️ ${flag}`),
        ]);
      }
      lines.push(`## ${value.labels.evidence}`);
      pushList(
        lines,
        [...value.evidence]
          .sort(
            (a, b) =>
              ["supporting", "medium", "high"].indexOf(b.evidentiaryValue) -
              ["supporting", "medium", "high"].indexOf(a.evidentiaryValue),
          )
          .map(
            (evidence) =>
              `${evidenceSymbol[evidence.evidentiaryValue]} **${evidence.kindLabel} · ${evidence.item} — ${evidence.evidentiaryValueLabel}:** ${evidence.method}`,
          ),
      );
      lines.push(
        `## ${value.labels.logistics}`,
        `### ${value.labels.itinerary}`,
        ...[...value.logistics.itinerary]
          .sort((a, b) => a.order - b.order)
          .map((stop) => `${stop.order}. **${stop.place}:** ${stop.why}`),
        `### ${value.labels.safetyAccess}`,
      );
      pushList(lines, value.logistics.safetyAccess);
      lines.push(`### ${value.labels.equipment}`);
      pushList(lines, value.logistics.equipment);
      lines.push(`### ${value.labels.beforeArrival}`);
      pushList(lines, value.logistics.beforeArrival);
      break;
    }

    case "storyFramework": {
      if (value.verdict === "insufficient") {
        if (value.reminder) lines.push(value.reminder);
        lines.push(`## ${value.labels.missing}`);
        pushList(
          lines,
          [...value.missing]
            .sort((a, b) => b.criticality - a.criticality)
            .map(
              (item) =>
                `**${item.criticality}/5 — ${item.item}:** ${item.howToGet}`,
            ),
        );
        break;
      }
      lines.push(
        `**${value.framework} — ${Math.round(value.completionPct)}%**`,
        `## ${value.labels.whyFits}`,
        value.whyFits,
        `## ${value.labels.thesis}`,
        value.thesis,
        `## ${value.labels.spine}`,
        value.spine,
        `## ${value.labels.sections}`,
      );
      for (const section of [...value.sections].sort((a, b) => a.order - b.order)) {
        lines.push(
          `### ${section.order}. ${sectionStatusSymbol[section.status]} ${section.name} — ${section.statusLabel} · ${Math.round(section.sharePct)}%`,
          section.role,
          section.yourMaterial,
        );
      }
      lines.push(
        `## ${value.labels.opening}`,
        `**${value.opening.choice}** — ${value.opening.application}`,
        `## ${value.labels.ending}`,
        `**${value.ending.choice}** — ${value.ending.application}`,
      );
      if (value.gaps.length) {
        lines.push(`## ${value.labels.gaps}`);
        for (const gap of [...value.gaps].sort((a, b) => b.criticality - a.criticality)) {
          lines.push(`### ${gap.criticality}/5 — ${gap.what}`);
          pushList(lines, [...gap.whatsNeeded, ...gap.howToGet]);
          if (gap.requestDraft) lines.push(gap.requestDraft);
        }
      }
      if (value.actionItems.length) {
        lines.push(`## ${value.labels.actions}`);
        const groups = new Map<string, string[]>();
        for (const item of value.actionItems) {
          const tasks = groups.get(item.whenLabel) || [];
          tasks.push(item.task);
          groups.set(item.whenLabel, tasks);
        }
        for (const [whenLabel, tasks] of groups) {
          lines.push(`### ${whenLabel}`);
          pushList(lines, tasks);
        }
      }
      break;
    }

    case "editDraft": {
      lines.push(
        `## ${value.labels.persona}`,
        `**${value.personaLabel}:** ${value.personaWhy}`,
        `## ${value.labels.editedText}`,
        value.editedTextMd,
      );
      if (value.changeSummary.length) {
        lines.push(`## ${value.labels.changes}`);
        pushList(
          lines,
          value.changeSummary.map((change) => `**${change.kindLabel}:** ${change.note}`),
        );
      }
      if (value.flags.length) {
        lines.push(`## ${value.labels.flags}`);
        pushList(
          lines,
          value.flags.map(
            (flag) => `⚠️ **${flag.kindLabel} · ${flag.excerpt}** — ${flag.note}`,
          ),
        );
      }
      if (value.unverifiedAdditions.length) {
        lines.push(`## ⚠️ ${value.labels.unverifiedAdditions}`);
        pushList(lines, value.unverifiedAdditions);
      }
      return {
        kind: "edited",
        markdown: lines.join("\n\n"),
        languageCode: value.languageCode,
        sources: [],
      };
    }

    case "claimCheck": {
      const groups = [
        { risk: "high" as const, label: value.labels.highRisk },
        { risk: "medium" as const, label: value.labels.mediumRisk },
        { risk: "low" as const, label: value.labels.lowRisk },
      ];
      for (const group of groups) {
        const items = value.items.filter((item) => item.risk === group.risk);
        if (!items.length) continue;
        lines.push(`## ${group.label}`);
        for (const item of items) {
          lines.push(
            `### ${item.id} — ${item.kindLabel} · ${item.claimTypeLabel}`,
            `${item.text}${refs(item.sourceRefs, sourceData.byRef)}`,
            `**${item.statusLabel}**`,
            `**${value.labels.howToVerify}:** ${item.howToVerify}`,
            `**${value.labels.primarySource}:** ${item.primarySourceTarget}`,
          );
          if (item.trapWarning) lines.push(`⚠️ ${item.trapWarning}`);
        }
      }
      if (value.internalContradictions.length) {
        lines.push(`## ${value.labels.contradictions}`);
        pushList(
          lines,
          value.internalContradictions.map(
            (contradiction) => `🔴 ${contradiction.a} ↔ ${contradiction.b}`,
          ),
        );
      }
      appendSources(lines, value.labels.sources, sourceData.safe);
      break;
    }
  }

  return {
    kind: "document",
    markdown: lines.join("\n\n"),
    languageCode: value.languageCode,
    sources: sourceData.safe,
  };
}
