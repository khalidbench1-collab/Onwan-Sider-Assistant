# Onwan release record

This file defines the release discipline for the managed-Gemini migration. It does not authorize a
production release.

## Rules

1. Never publish Apps Script "Head" or an uncommitted working tree.
2. Run the phase acceptance checks and secret/privacy scan first.
3. Record the git commit, Apps Script version/deployment ID, Cloud Run revision, date, operator, and
   rollback target below.
4. Keep staging and production configuration separate.
5. Update a Marketplace deployment only after the pinned version passes the same acceptance checks.
6. Never place API keys, Stripe secrets, customer contacts, story text, receipts, or unredacted
   screenshots in git.

## Release log

| Date | Environment | Git commit | Apps Script version/deployment | Cloud Run revision | Operator | Verification | Rollback |
|---|---|---|---|---|---|---|---|
| 2026-07-28 | Apps Script version only — **not** deployed to any user | `f4471e6` | Version **1**, no deployment attached | `onwan-api-staging`, schema-fix revision above `00020` | Owner + Claude | 11 Apps Script checks and 31 backend tests pass; all 13 script files pulled from Apps Script are byte-identical to `src/`; no prior versions existed | n/a — first version |

**What version 1 is and is not.** It is a snapshot of the script at commit `f4471e6`. Head remains
what the owner's own testing runs against, and version 1 does not move when `src/` changes.

**Deployment pinned to version 1**, created 2026-07-28 for the Marketplace SDK:

```
AKfycbxJmrXS5-fsj1aGf1lgWG2K_58sXUkk2z1M0mZB3pNNz6zPbdwP0j44gb-5ChHj5PwbxQ
```

The project's only previous deployment was pinned to `@HEAD`, which rule 1 forbids publishing — a
Marketplace listing pointed at it would have shipped every future `clasp push` straight to users with
no review. The new deployment is pinned to `@1` and is the one the store listing must reference. The
`@HEAD` deployment is left in place for the owner's own testing.

## Phase 0 note

Phase 0 creates documentation and external-account rails only. The deployed v2.2 Anthropic prototype
must not be presented as the managed-Gemini pilot. The first managed release belongs to Phase 1 and
requires its own approval.
