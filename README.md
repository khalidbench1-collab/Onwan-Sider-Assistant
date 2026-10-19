# Onwan / عنوان

Onwan is a bilingual Arabic/English Google Docs add-on for journalists. It reads the current
selection or active document tab, calls a managed Gemini backend on Google Cloud, and writes the
result directly into that tab. The sidebar shows progress and destination only; it never displays
the generated article text for manual copying.

> **Current status — Published (2026-08-26).** Onwan is live on the
> [Google Workspace Marketplace](https://workspace.google.com/marketplace/app/onwan/970590417505)
> (App ID `970590417505`) and OAuth verification has cleared — no more unverified-app warning or
> 100-user cap. The managed-Gemini code is implemented and verified: all seven actions pass in real
> documents in both Arabic and English, including a non-default document tab.

### Submission path — complete

`onwan.eu` live with homepage, Impressum, Datenschutz and Support; domain verified in Search Console;
consent-screen branding, logo and all five scopes verified in production; demonstration video
recorded and OAuth verification passed; Apps Script **version 4** cut with a deployment pinned to it;
Marketplace listing submitted, reviewed, and **approved for publication**.

Two sensitive scopes — `script.external_request` and `script.container.ui` — made verification
unavoidable; no add-on with a backend and a sidebar can drop either. There is no paid tier: Onwan is
free to use, funded by grants rather than Stripe/subscription billing, so no billing or Checkout work
sits on this path.

## What Phase 1 provides

- Arabic or English interface, remembered per user.
- Automatic project-language detection plus a per-document language override.
- Seven managed actions: angle preview, proposal, desk research, fieldwork plan, story framework,
  draft editing, and claim/source check.
- Guided proposal workflow: inspect the active tab, choose Quick Story or Investigation, select one
  of three angles (or a custom angle), and write a proposal with a 150–300-word pitch draft. The app
  adds the matching Quick Story or Investigation tab architecture below the proposal and prompts the
  journalist to create those tabs manually. Angle preview is unmetered; only the final proposal is
  charged.
- Step readiness: the panel reads the document locally and dims a step whose prerequisites are not
  met, replacing its description with what is missing ("needs a proposal with a clear angle") and
  naming the suggested next step. The gate is soft -- clicking a dimmed step offers the action that
  would unblock it alongside "run anyway", so an expert is never trapped by a wrong guess. The scan
  costs no credits and makes no backend call; if it fails, every step opens.
- Results written directly into the active Google Docs tab with RTL/LTR formatting.
- Non-destructive draft editing: the original remains and a review copy with short reasons is added
  below it.
- Thirty successful free actions; failed calls are refunded.
- Further credits are issued manually at no charge. Every action runs on `gemini-3.8-flash`
  regardless of plan.
- Google Search grounding for story ideas, research, and claim-check work.
- No Gemini/Anthropic key in Apps Script or the browser.
- Privacy-safe operational logs: no document text, prompts, generated copy, token, or raw email.

The proposal tab-architecture guide is implemented without relying on Google Docs Developer Preview.
Automatic tab creation remains deferred. `AddDocumentTabRequest` is generally available, but only
through the Docs REST API, which does not accept `documents.currentonly`; probes on 2026-09-05 showed
`drive.file` reaches a document the app itself created and returns 404 for the document the user
already has open, because it is a per-file grant. Creating tabs in the journalist's own document
would therefore require the restricted `auth/documents` scope, which Onwan does not request.
Native suggestion writing (`writeMode: SUGGEST`) and programmatic comments remain Developer Preview
and are not public launch dependencies, so draft editing and claim checking continue to produce a
non-destructive review copy.

## Architecture

```text
Google Docs + Apps Script sidebar
       │ Google identity token + HTTPS JSON
       ▼
Cloud Run: Onwan API (Node 20, TypeScript, Express)
       ├── verifies Google identity
       ├── checks free/Pro entitlement in Firestore
       ├── calls Gemini on Vertex AI (global model/Search endpoint)
       └── returns structured Markdown
       │
       ▼
Apps Script writes into the active Docs tab
```

The backend retains pseudonymous entitlement and reservation data. Editorial content transits the
backend in memory and is not written to Firestore or application logs. Apps Script may cache the last
proposal or a failed-to-write result for up to six hours so the workflow can continue without another
AI charge.

## Local verification

Requirements: Node.js 20+.

```bash
npm install
npm --prefix backend install
npm run check
npm test
npm run build:backend
```

The current suite has 36 Apps Script checks, 18 public-site checks, and 68 backend tests. It
covers syntax and scopes, provider-key removal, direct-write UI behavior, bilingual branding,
step-readiness scanning and soft gating,
authentication, free limits, failure refunds, manual licence activation, credit charging, duplicate
requests, rate limiting, all seven output schemas, trusted-source rendering, unsafe-link removal,
and log redaction.

The site checks run the real build. They hold all ten routes in place (Home, Services, About, their
Arabic translations at `/ar`, `/ar/services` and `/ar/about`, and the four legal pages), assert the
postal address reaches the Impressum and no other page, keep the Google trademark attribution the
Marketplace reviewer asked for, confirm no page contains a `<script>`, an external stylesheet, or a
`@font-face` pointing anywhere but this origin, and confirm `/services` carries no `<form>` of its
own — its one request path is a link out to Typeform. On the Arabic side they check every page is
`dir="rtl"`, cross-linked to its English counterpart by the corner language icon, translated rather
than duplicated, and that the brand name renders as a single language everywhere ("Onwan" or "عنوان",
never both at once).

## Configuration and deployment

Never commit real values from `.env`, Google tokens, licence codes, or Secret Manager. Runtime
configuration is documented in [`backend/.env.example`](backend/.env.example).

After Cloud Run is deployed, the Apps Script project needs one Script property:

```text
ONWAN_BACKEND_URL=https://the-cloud-run-service-url
```

Do not restore the revoked `ANTHROPIC_API_KEY`. The legacy direct-provider client has been deleted.

## Development workflow

The repository is the source of truth. Git is the rollback history; `clasp push` only synchronizes
Apps Script source.

```bash
npm run check
npm test
git add -A
git commit -m "..."
npx clasp push -f
```

Use a saved Editor add-on test deployment while the OAuth app is in Testing. Public distribution
uses Google Workspace Marketplace review; before approval, named pilot users use the official Draft
Tester route. There is no recommended third-party or private “unlisted marketplace.”

## Project layout

```text
backend/
├── src/                 Cloud Run API, Gemini, identity, entitlement, schemas, logging
├── scripts/             manual licence provisioner
├── test/                backend tests
└── Dockerfile

src/
├── appsscript.json      Apps Script manifest and OAuth scopes
├── Backend.js           authenticated Cloud Run client
├── Actions.js           action orchestration and direct writing
├── DocService.js        active-tab read/write and formatting
├── Locale.js            UI/project language state
├── Settings.js          backend/style/language settings
├── Prompts.js           client-side action metadata and step prerequisites
├── Readiness.js         document readiness scan and per-step gating
├── ResultCache.js       proposal/retry recovery state
└── Sidebar.html         bilingual Onwan interface

site/
└── build.mjs            renders onwan.eu -- Home/Services/About (English + Arabic) plus 4 legal pages

assets/
└── fonts/               Anton + Literata (EN/DE) and Cairo (AR), self-hosted for Home/Services/About

test/
├── apps-script-static.test.cjs
└── site-build.test.cjs

docs/
├── ONWAN_MANAGED_GEMINI_MASTER_PLAN.md
├── phase-0/
└── phase-1/
```

## Legal and evidence

[`IMPRESSUM.md`](IMPRESSUM.md), [`DATENSCHUTZ.md`](DATENSCHUTZ.md), [`TERMS.md`](TERMS.md) and
[`SUPPORT.md`](SUPPORT.md) are published at `https://onwan.eu/impressum`, `/datenschutz`, `/terms`
and `/support`. Run `npm run build:site` to regenerate the pages from the markdown, which stays the
source of truth, then deploy with `firebase deploy --only hosting`. Home, Services and About are not
markdown files — they are the `HOME`/`HOME_AR`, `SERVICES`/`SERVICES_AR` and `ABOUT`/`ABOUT_AR`
templates in [`site/build.mjs`](site/build.mjs), which also holds the single inline stylesheet every
page shares. Services offers AI training guides and workshops for journalists — reframed from a
broader AI-consulting concept so it stays inside the owner's registered freelance-journalist activity
— with Typeform as the only request path, linked out rather than embedded.

Home, Services and About are published in Arabic too, at `/ar`, `/ar/services` and `/ar/about`
(`dir="rtl"`), reached from their English counterparts by a language icon in the header's corner. The
four legal pages are not translated and stay English/German-only; the Arabic footer still links out to
them, with translated labels except "Impressum", which is the fixed German legal term rather than a
description. The masthead and footer brand read as a single language throughout the site — "Onwan" in
English/German, "عنوان" in Arabic — never both at once.

The **postal address is published on the Impressum only**, because § 5 DDG requires it there.
Datenschutz and Terms name the Impressum instead of repeating the street, which keeps the
controller's contact details reachable for GDPR Art. 13 without printing a home address on three
pages. `PRIVACY.md` mirrors the German text and must be changed with it. A test enforces this; do
not reintroduce the address elsewhere.

`firebase.json` sends `default-src 'none'` with `font-src 'self'`. That blocks all JavaScript,
external stylesheets, and form submission, and allows fonts only from this origin — no Google Fonts
CDN, no `data:` URIs. Home, Services and About self-host Anton and Literata for English/German under
`assets/fonts/`, and Cairo (Google Fonts' own Arabic-subset variable file) for the Arabic pages;
everything else on the site still runs on system fonts. The site is static and inline-CSS only by
necessity, not by preference — changing either of those means changing the header first.
[`AI_TRANSPARENCY.md`](AI_TRANSPARENCY.md) and [`COOKIE_POLICY.md`](COOKIE_POLICY.md) remain
unpublished drafts; [`PRIVACY.md`](PRIVACY.md) is an internal English translation of the German
privacy policy and is never published — the German text is the one that governs.

## Licence

Copyright © 2026 Khalid Bencherif.

Licensed under the **GNU Affero General Public License v3.0 only** (AGPL-3.0-only). The full text is
in [`LICENSE`](LICENSE).

AGPL rather than a permissive licence for one specific reason: Onwan is delivered as a hosted service,
and section 13 of the AGPL extends the source-sharing obligation to users who interact with a modified
version **over a network**. Under MIT or Apache-2.0 a third party could run a closed fork of this
backend as a paid product and owe nothing back. Under AGPL they cannot.

The licence covers the source in this repository. It does not grant rights in the **Onwan / عنوان**
name, the logo, or the listing identity — those stay with the author. "Google", "Google Docs" and
"Google Workspace" are trademarks of Google LLC; Onwan is not endorsed by or affiliated with Google.
