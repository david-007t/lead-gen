# QA_CHECKLIST.md — Quality gate
# Project: [INFERRED] Leadqual
# Last run: 2026-04-16 by Codex prep_qa
# Result: FAIL

---

⚠️ HARD GATE. Nothing ships until every item passes.

---

## 1. App bootstrap and single-user shell

- [x] App loads as a single-page dashboard shell
- [x] Browser session persists local state on refresh
- [ ] First-run setup completes without runtime errors
- [ ] Theme, tabs, and saved state survive a full reload under runtime parity

## 2. Core lead workflow

- [ ] User can generate leads through the Anthropic-backed happy path
- [ ] Generated leads render with score, status, and analytics output
- [ ] User can create, edit, and delete manual leads without a crash
- [ ] CSV import/export works with the current lead schema
- [ ] Empty and malformed lead data are handled gracefully

## 3. Ship List / Supabase workflow

- [ ] Ship List search returns results under runtime parity
- [ ] Saving a company to Supabase succeeds
- [ ] Updating Ship List status persists correctly
- [ ] Deleting a saved company removes it cleanly
- [ ] Contact-finding and outreach drafting do not leave the UI stuck

## 4. Error handling

- [ ] Failed API call shows user-friendly feedback, not raw internals
- [ ] Invalid form input shows a clear validation message
- [ ] Loading states display during async operations
- [ ] Empty state renders correctly with no blank screen
- [ ] Offline or disconnected behavior fails predictably

## 5. Mobile — 375px

- [ ] Dashboard renders correctly at 375px
- [ ] No horizontal scroll appears in primary views
- [ ] Text remains readable with no clipping or overflow
- [ ] Forms and controls are usable on a mobile keyboard
- [ ] Tap targets remain usable across major actions

## 6. Performance and build

- [x] Production build completes successfully
- [x] No production console logging remains in the inspected app/API files
- [ ] Primary happy path stays usable with the current bundle size
- [ ] API responses are acceptable under local runtime parity

## 7. Cross-browser and runtime parity

- [ ] Chrome latest
- [ ] Safari latest
- [ ] Firefox latest
- [ ] Mobile Safari iOS
- [ ] `vercel dev` runtime parity verified for the API-backed flows

---

## Failure log

Item failed: Runtime QA evidence is still missing for the single-user v1 workflows
Expected: The approved single-user release target should have a completed `vercel dev` happy-path pass covering lead generation, local persistence, Ship List CRUD, and mobile responsiveness.
Actual: Fresh inspection confirms the app shape, but this session only completed static review plus build/audit verification. No runtime QA pass was executed.
Evidence:
- `src/main.jsx:1-8` still mounts a single `LeadQualifier` component with no route/auth layer, so the QA gate must reflect a single-user SPA rather than auth flows.
- `src/LeadQualifier.jsx:319-330` still persists app data and theme in `localStorage`, so reload behavior must be verified under real runtime conditions.
- `src/LeadQualifier.jsx:941-1012` still performs Ship List Supabase CRUD from the client, which has not been exercised this session.
- `README.md:45` still says the AI lead finder requires `vercel dev` rather than plain `npm run dev`.
- `npm run build` passed on 2026-04-16, but no browser-based QA evidence was captured afterward.
Steps to reproduce:
1. Run `vercel dev` with the required env vars present.
2. Execute the lead-generation happy path, then the Ship List save/update/delete flow.
3. Repeat the visible UI checks at 375px and capture console/network evidence.
Assigned to Codex: 2026-04-16

## Verified findings from 2026-04-16

- PASS: The current repo is a single-page app shell, not an auth-gated multi-route product.
  Evidence: `src/main.jsx:1-8` mounts only `LeadQualifier`, and `vercel.json:10-12` rewrites non-API routes to `index.html`.
- PASS: Browser-local persistence exists and must be part of QA scope.
  Evidence: `src/LeadQualifier.jsx:319-324` and `src/LeadQualifier.jsx:330` read/write persisted state and theme from `localStorage`.
- PASS: Production build completes in the current workspace.
  Evidence: `npm run build` passed on 2026-04-16 and emitted only the existing chunk-size warning for `dist/assets/index-CpdcXt5p.js`.
- PASS: No production console logging remains in the previously remediated files.
  Evidence: prior 2026-04-15 verification for `src/LeadQualifier.jsx`, `api/anthropic.js`, and `api/send-email.js` still stands, and this prep session found no contradictory source changes in the inspected regions.
- FAIL: Runtime verification of the AI lead-generation path is still missing.
  Evidence: `README.md:45` requires `vercel dev`, and no runtime smoke test was executed on 2026-04-16.
- FAIL: Runtime verification of the Ship List/Supabase CRUD path is still missing.
  Evidence: `src/LeadQualifier.jsx:941-1012` contains the CRUD surface, but this session did not exercise it.
- FAIL: Mobile, offline, and cross-browser sections remain unverified.
  Evidence: no browser/device pass was executed on 2026-04-16.
- FAIL: User-friendly API failure handling is not yet verified for every visible path.
  Evidence: this session inspected the handlers but did not trigger live error cases in the UI.

## Missing verification before QA can proceed

- Run `vercel dev` with valid local env vars and capture the single-user happy path end to end.
- Verify reload persistence, Ship List CRUD, and error states in the live runtime instead of by source inspection alone.
- Run a 375px responsive pass and browser checks in Chrome, Safari, and Firefox once the runtime is up.

## Next verification step

- Start `vercel dev`, then execute one recorded happy-path pass: generate leads, save one Ship List company, refresh the browser to confirm persisted state, and capture desktop plus 375px evidence.

---

## Agent rules

- Run every item — no skipping
- Mark FAIL immediately — do not push through
- Attach screenshots or logs for every failure
- After Codex fixes, re-run the full checklist — not just failed items
- Scout adds items based on recurring failures in ERRORS.md
