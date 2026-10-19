# Onwan Editor — Output Templates

**Version 1.1 · 2026-07-27 · Phase 1 contract**

This is the product contract for Gemini output and the current direct-to-Google-Docs renderer. It is
based on the owner's journalism experience and reference assets. The executable source of truth is
`backend/src/lib/schemas.ts`; this document explains the editorial meaning of that code.

Phase 1 returns validated JSON, renders it on the backend, and writes the result directly into the
active Google Docs tab. The sidebar shows only progress, access, errors, and the destination. It does
not show result cards, copy buttons, or an intermediate “insert” step.

---

## 0. Rules shared by every tool

- `schemaVersion` is `1.1`.
- `actionId` is a stable machine value.
- `languageCode` is the detected or requested project language.
- `title`, `summary`, fixed headings, and all explanatory text use the project language.
- Machine enums remain English and language-neutral. The user does not edit or normally see them.
- The renderer uses restrained formatting: headings, paragraphs, useful lists, and defined status
  symbols. It does not invent decorative cards or expose raw JSON.
- The AI must never mark a journalistic claim “confirmed.” Only a journalist can do that after
  verification.
- Search actions may cite only `S1`, `S2`, and similar references supplied by the backend.
- URLs come exclusively from Gemini grounding metadata captured by the backend. The model cannot
  create, copy, or guess a URL.
- Company statements remain attributed claims, not facts.
- Contradictions are displayed, not silently resolved.
- Missing evidence is explicit.

Canonical internal certainty values:

| Machine value | Meaning | Rendered symbol |
|---|---|---|
| `source_supported` | The trusted source supports this wording; human verification still required | ✅ |
| `reported_claim` | A person or organization reports or alleges this | ⚠️ |
| `conflicting` | Sources or supplied material disagree | 🔴 |
| `unverified` | The evidence is absent or inadequate | ◻️ |

Other stable enums include `high/medium/low`, `ready/partial/missing`, evidence and source types,
editing personas, and action timing. Localized labels surrounding these values come from Gemini and
are validated as ordinary text.

---

## 1. `proposal` — prepare a proposal

Purpose: turn an idea or notes into an editor-ready reporting proposal without duplicating the same
content in several fields.

```ts
{
  schemaVersion: "1.1",
  actionId: "proposal",
  languageCode: string,
  title: string,
  summary: string,
  labels: {
    angle: string, soWhat: string, whyNow: string, questions: string,
    whatsNew: string, expectedEvidence: string, originality: string, pitchDraft: string
  },
  angle: string,
  soWhat: string,
  whyNow: string,
  questions: [{ id: "Q1" | "Q2" | "Q3" | "Q4" | "Q5" | "Q6", text: string }],
  whatsNew: string,
  expectedEvidence: [{
    item: string,
    kind: "document" | "data" | "interview" | "fieldwork",
    kindLabel: string
  }],
  originalityCheck: string,
  pitchDraft: string
}
```

Rules:

- Create three to six stable questions using `Q1` through `Q6`.
- Later research connects findings to these question IDs.
- `pitchDraft` is the concise sendable version and must contain **150–300 words**. There is no
  duplicate `fullTextMd`.
- Expected evidence describes what reporting must obtain; it does not claim the evidence exists.

Current Docs output: angle → significance → why now → questions → novelty → expected evidence →
originality check → pitch draft.

---

## 2. `proposalIdeas` — three selectable angles

```ts
{
  schemaVersion: "1.1",
  actionId: "proposalIdeas",
  languageCode: string,
  title: string,
  summary: string,
  labels: {
    angle: string, whyNow: string, firstSource: string, sources: string, recommended: string
  },
  recommendedIndex: 1 | 2 | 3,
  recommendationReason: string,
  ideas: [{
    title: string,
    angle: string,
    whyNow: string,
    firstSource: string,
    sourceRefs: ["S1", "S2"]
  }] // exactly 3
}
```

`firstSource` is the most useful first reporting direction, not an invented contact. This is an
authenticated, unmetered preview: the three cards appear only in the proposal wizard, never in the
document. Exactly one angle is recommended, but the journalist may choose any card or enter a custom
angle. The backend normalizes harmless wrapper differences such as a string recommendation index,
missing localized labels, or extra ideas, while still rejecting fewer than three usable angles. The
final `proposal` call is the only charged generation in the workflow.

---

## 3. `research` — desk research

```ts
{
  schemaVersion: "1.1",
  actionId: "research",
  languageCode: string,
  title: string,
  summary: string,
  labels: { contradictions: string, unanswered: string, sources: string },
  keyFinding: string,
  sections: [{
    heading: string,
    findings: [{
      text: string,
      certainty: "source_supported" | "reported_claim" | "conflicting" | "unverified",
      certaintyLabel: string,
      sourceType:
        "peer_reviewed" | "official" | "fieldwork" | "interview" |
        "commercial_data" | "company_statement" | "journalism",
      sourceTypeLabel: string,
      sourceRefs: ["S1", "S2"],
      date: string,
      servesQuestion: "Q1" | "Q2" | "Q3" | "Q4" | "Q5" | "Q6"
    }]
  }],
  contradictions: [{ pointA: string, pointB: string, note: string }],
  unanswered: [{ question: string, suggestion: string }]
}
```

Rules:

- Every finding must serve a proposal question.
- Time-sensitive findings include their relevant date.
- A trusted source reference is a lead and an attribution trail, not automatic verification.
- The renderer displays certainty symbols, question IDs, contradictions, unanswered questions, and
  a source list whose URLs come from backend-captured grounding metadata.

---

## 4. `fieldworkPlan` — fieldwork plan

```ts
{
  schemaVersion: "1.1",
  actionId: "fieldworkPlan",
  languageCode: string,
  title: string,
  summary: string,
  labels: {
    sources: string, interviews: string, evidence: string, logistics: string,
    itinerary: string, safetyAccess: string, equipment: string, beforeArrival: string
  },
  planSummary: string,
  humanSources: [{
    who: string,
    role: string,
    affiliation: string,
    relevance: string,
    contactMethod: string,
    type:
      "official" | "expert" | "civil_society" | "researcher" |
      "affected_community" | "industry_insider",
    typeLabel: string
  }],
  interviews: [{
    forSource: string,
    background: string[],
    accountability: string[],
    technical: string[],
    sensitiveFlags: string[]
  }],
  evidence: [{
    item: string,
    kind: "document" | "site" | "sample_or_data" | "visual",
    kindLabel: string,
    method: string,
    evidentiaryValue: "high" | "medium" | "supporting",
    evidentiaryValueLabel: string
  }],
  logistics: {
    itinerary: [{ order: number, place: string, why: string }],
    safetyAccess: string[],
    equipment: string[],
    beforeArrival: string[]
  }
}
```

`humanSources` deliberately differs from the backend-owned web `sources` field. The model may suggest
source categories, roles, institutions, and contact methods, but must not invent personal contact
details. Evidence is rendered in value order, followed by the itinerary, safety/access, equipment,
and pre-arrival tasks.

---

## 5. `storyFramework` — framework and gap analysis

```ts
{
  schemaVersion: "1.1",
  actionId: "storyFramework",
  languageCode: string,
  title: string,
  summary: string,
  labels: {
    missing: string, whyFits: string, thesis: string, spine: string, sections: string,
    opening: string, ending: string, gaps: string, actions: string
  },
  verdict: "framework" | "insufficient",
  missing: [{ item: string, criticality: 1 | 2 | 3 | 4 | 5, howToGet: string }],
  reminder: string,
  framework: string,
  whyFits: string,
  thesis: string,
  spine: string,
  completionPct: number,
  sections: [{
    order: number,
    name: string,
    sharePct: number,
    role: string,
    yourMaterial: string,
    status: "ready" | "partial" | "missing",
    statusLabel: string
  }],
  opening: { choice: string, application: string },
  ending: { choice: string, application: string },
  gaps: [{
    what: string,
    criticality: 1 | 2 | 3 | 4 | 5,
    whatsNeeded: string[],
    howToGet: string[],
    requestDraft: string
  }],
  actionItems: [{
    when: "today" | "this_week" | "before_publication",
    whenLabel: string,
    task: string
  }]
}
```

If reporting material is inadequate, `verdict` must be `insufficient`; the renderer writes the
critical missing work and stops. It must not manufacture a structure from empty planning text.

For `framework`, the model chooses or justifiably combines investigative, feature, journey, profile,
or data-driven structures. Readiness and completion estimates must reflect supplied material.
Remaining gaps are sorted by criticality.

---

## 6. `editDraft` — edit a draft

This replaces the language-specific legacy name `editArabic`. The project language can be Arabic,
English, or another detected language.

```ts
{
  schemaVersion: "1.1",
  actionId: "editDraft",
  languageCode: string,
  title: string,
  summary: string,
  labels: {
    persona: string, editedText: string, changes: string,
    flags: string, unverifiedAdditions: string
  },
  persona: "anchor" | "surgeon" | "bard" | "mimic" | "alchemist",
  personaLabel: string,
  personaWhy: string,
  editedTextMd: string,
  changeSummary: [{
    kind: "merge" | "remove_filler" | "transition" | "rhythm" | "wording",
    kindLabel: string,
    note: string
  }],
  flags: [{
    kind: "needs_source" | "ambiguity" | "internal_contradiction",
    kindLabel: string,
    excerpt: string,
    note: string
  }],
  unverifiedAdditions: string[]
}
```

The AI chooses an editing lens, returns the full revised text, and gives short reasons for material
changes. It must not add facts, quotations, scenes, or reporting. `unverifiedAdditions` should be
empty; any non-empty value is shown as a prominent warning.

Current Phase 1 behavior writes the edited version plus reasons and flags directly into Docs. True
Google Docs suggestion creation and accept/reject controls are deferred because the required public
API support is not generally available.

---

## 7. `claimCheck` — claim and source check

```ts
{
  schemaVersion: "1.1",
  actionId: "claimCheck",
  languageCode: string,
  title: string,
  summary: string,
  labels: {
    highRisk: string, mediumRisk: string, lowRisk: string,
    howToVerify: string, primarySource: string,
    contradictions: string, sources: string
  },
  items: [{
    id: "C1" | "C2" | "...",
    kind: "claim" | "number" | "quote" | "link",
    kindLabel: string,
    claimType:
      "statistical" | "legal" | "supply_chain" | "scientific" |
        "temporal" | "causal" | "general",
    claimTypeLabel: string,
    text: string,
    risk: "high" | "medium" | "low",
    status: "needs_verification" | "needs_source" | "internal_contradiction",
    statusLabel: string,
    howToVerify: string,
    primarySourceTarget: string,
    trapWarning: string,
    sourceRefs: ["S1", "S2"]
  }],
  internalContradictions: [{ a: string, b: string }]
}
```

The tool extracts, classifies, and triages claims. It never verifies them automatically. Search
results are leads for the journalist, and the ideal primary source remains explicit. The renderer
groups items by publication risk, with high risk first, and includes verification steps, source
targets, traps, contradictions, and backend-trusted references.

---

## 8. Renderer contract

`backend/src/lib/schemas.ts` validates all seven outputs. `backend/src/lib/render.ts` maps them to
Markdown understood by the Apps Script Docs writer. `src/Actions.js` sends the validated rendered
result directly to `src/DocService.js`; the sidebar never interprets raw model output.

The TypeScript/Zod implementation is the executable source of truth. When this document and code
disagree, fix both in the same change; do not generate production schemas from Markdown.

---

## 9. Production-safe proposal architecture; remaining Phase 3 work

The unmetered wizard preview shows exactly three selectable angles in the sidebar. After the
journalist selects an angle and story type, the charged request writes the final proposal into the
active tab. Immediately below it, Apps Script adds a localized Quick Story or Investigation tab
architecture and tells the journalist to create those tabs manually with the Google Docs `+` button.
The stored last-proposal value contains only the proposal, not the architecture instructions, so
later actions receive clean editorial context.

This is the public production behavior. It intentionally avoids the Preview-only dynamic tab API.
Automatic tab creation/routing may be reconsidered only after the required Google Docs API becomes
generally available and passes a fresh terms, OAuth, and reliability review.

The following designs remain approved for Phase 3 and must not yet be presented as available:

- Native evidence and claim–evidence tables in the active tab.
- Footnotes connected to trusted source URLs.
- Proposal-question bookmarks and internal links from research findings.
- Named ranges for safe replace/update behavior.
- Review-copy integration with short reasons.
- Claim-row bookmarks, deduplication, and append/update behavior.
- Seed content for project dashboard, proposal, evidence, fieldwork, analysis, writing, drafts, and
  post-publication tabs.

These are Docs integration features, not changes to Gemini's editorial schemas. They will be
implemented and acceptance-tested only when Phase 3 is explicitly started.

---

## 10. Provenance

The structures draw on the owner's pre-existing journalism references and experience, including
pitching criteria, fieldwork planning, story frameworks, gap analysis, fact-checking, editorial
review, and output-style guidance. Those references are prior-work inputs and should be disclosed as
such in the XPRIZE submission. Production wording, schemas, validation, trusted-source handling, and
rendering logic in version 1.1 were created during the hackathon period.

Real story content from reference investigations must not be copied into templates, screenshots, or
tests.
