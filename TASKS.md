# TASKS.md — Sprint state
# Project: [INFERRED] Leadqual
# Phase: [INFERRED] BUILD
# Last updated: 2026-04-21 by Claude (Session 9)

---

## Current sprint goal

Refactor LeadQual into a three-mode lead engine and build Mode 2B (Build a Lead List) as the first executable slice.

---

## In progress

- [ ] None. CEO error-diagnostic fix committed and pushed to origin/main on 2026-04-21. Vercel auto-deploy triggered. Awaiting CEO retest.

---

## Blocked

- [ ] [INFERRED] No active CEO scope blocker remains. The single-user v1 decision is resolved; only concrete QA/security execution blockers should re-block the project now.


## Done this sprint

- [x] Fixed Find My Clients "No businesses found" showing no diagnostic reason — replaced generic message with three specific failure modes (empty API response, parse failure with AI preview, genuine empty list); fixed silent spinner-freeze bug (setFinderError→setProspectError); fixed dead-letter Strategy 2 field check (name→businessName); surfaced actual err.message in catch block. — completed: 2026-04-21 — by: Claude (Session 10)
  Files changed: `src/LeadQualifier.jsx`
  Verified: `npm run build` passed 2026-04-21, 3.39s, zero new errors. Pushed to origin/main, Vercel auto-deploy triggered.
- [x] Refactored LeadQual into a three-mode lead engine (Find AI Prospects, Find My Clients, Build a Lead List) with a mode selector strip and updated tab bar. Built Mode 2B (Build a Lead List) as the first executable slice. — completed: 2026-04-21 — by: Codex
  Files changed: `src/LeadQualifier.jsx`
  Verified: `npm run build` passed on 2026-04-21 — same chunk-size warning as baseline, zero new errors.
  - Mode selector strip added above tab bar with three pill buttons.
  - "LeadGen" tab renamed to "Find AI Prospects".
  - New "Build a Lead List" tab added with city, niche, result-count inputs.
  - `handleLeadListSearch`, `handleLeadListDraftOutreach`, `handleAddLeadListToPipeline` handlers added.
  - Existing Indeed flow, outreach generation, card UI, copy button, pipeline toggle, export CSV untouched.

- [x] Redesigned `api/send-email.js` so SMTP credentials are never accepted from the client: removed `smtpConfig` from request body, moved all credentials to server-side env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`), sanitized error response to a generic string. Updated `.env.example` with SMTP var documentation. `npm run build` verified passing. — completed: 2026-04-21 — by: Codex
- [x] Prepared Leadqual for QA by re-verifying implementation readiness and updating QA_CHECKLIST.md, SECURITY_CHECKLIST.md, TASKS.md, and HANDOFF.md to the approved single-user v1 scope. — completed: 2026-04-16 — by: Codex
- [x] CEO confirmed Leadqual v1 stays single-user, so the team should align release gates to that scope instead of adding auth/RLS first. — completed: 2026-04-19 — by: CEO
- [x] Bootstrapped governance files into `leadqual/` — completed: 2026-04-14 — by: [INFERRED] Codex
- [x] Reconciled stale governance state against the visible repo. — completed: 2026-04-15 — by: Codex
- [x] Removed production console logging from `src/LeadQualifier.jsx`, `api/anthropic.js`, and `api/send-email.js`. — completed: 2026-04-15 — by: Codex
- [x] Ran QA_CHECKLIST.md and SECURITY_CHECKLIST.md against the visible repo. — completed: 2026-04-15 — by: Codex

---


## Up next

- [ ] CEO: Retest Find My Clients — search "marketing agencies" in "Oakland, CA" — confirm specific error message now shown when no results are found (should explain whether API failed, parsing failed, or list was empty).
- [ ] CEO: Run existing Indeed (Find AI Prospects) flow — confirm it still works end to end.
- [ ] CEO: Test Build a Lead List — enter city, niche, result count; confirm results appear with outreach draft and add-to-pipeline.
- [ ] CEO: Confirm mode selector shows all three modes (Build a Lead List, Find AI Prospects, Find My Clients).
- [ ] CEO: Verify outreach draft copy button, pipeline toggle, export CSV still work.
- [x] Deploy to Vercel — committed and pushed to origin/main on 2026-04-21 by Claude (Session 9). Vercel auto-deploy triggered via GitHub integration.
- [ ] Define Mode 2C scope: "Find My Clients" (currently routes to existing Prospect Search tab — decide if that is the right mapping or if it needs its own flow).
- [ ] Run `vercel dev` with valid env vars and execute the AI lead-generation happy path end to end, then capture desktop, 375px mobile, console, and network evidence for `QA_CHECKLIST.md`.


## Future ideas — out of scope for v1

- [INFERRED] Multi-user workspace support with per-team reporting.

---

## Scope change requests

- [INFERRED] Replace direct proxying with a richer orchestration layer after auth is decided. — requested: 2026-04-14 — status: PENDING
- Three-mode refactor (Find AI Prospects / Find My Clients / Build a Lead List) — requested: 2026-04-21 — status: DONE (Mode 2B built; Modes 1 and 3 mapped to existing tabs)

---

## Agent rules

- Update at END of every session — never the beginning
- Never mark done unless actually done and tested
- Move to BLOCKED after 2 failed attempts — do not retry
- Tasks must include file paths — never vague descriptions
- One task = one atomic unit of work
