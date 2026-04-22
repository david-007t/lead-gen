# SECURITY_CHECKLIST.md — Security gate
# Project: [INFERRED] Leadqual
# Last run: 2026-04-21 by Codex
# Result: FAIL (SMTP issue resolved; other items still open)

---

⚠️ HARD GATE. Runs after QA passes. No exceptions. No "fix post-launch."

---

## 1. Secrets and configuration

- [x] Anthropic API key stays server-side in `api/anthropic.js`
- [x] `.env.example` contains placeholders only
- [x] Local env files are ignored by git
- [ ] Git history checked for committed secrets
- [ ] Production Vercel env vars verified
- [ ] No other hardcoded credentials anywhere in the active runtime path

## 2. Single-user browser data model

- [ ] No sensitive lead or contact data is stored in `localStorage`
- [ ] Browser-local persistence is explicitly accepted for the v1 threat model
- [ ] Shared-browser behavior is documented and QA-tested
- [ ] Supabase access pattern is acceptable for the approved single-user scope

## 3. API routes

- [ ] Input validation exists on every public route
- [ ] Public routes are rate-limited where abuse is plausible
- [ ] No sensitive data is returned in API error messages
- [x] HTTP methods are restricted on the inspected routes
- [ ] CORS behavior is verified for deployed runtime

## 4. Supabase and database access

- [ ] No unauthorized data exposure is possible through the client-side Supabase flow
- [ ] The `ship_list_companies` table access pattern is verified against the approved scope
- [ ] Database-side protections are documented for the current deployment
- [x] No raw SQL from user input appears in the visible frontend code

## 5. Third-party and outbound data flow

- [x] Anthropic requests use the server-side API key only
- [ ] User data sent to Anthropic is reviewed for minimum necessary disclosure
- [x] SMTP credentials are never accepted from the client
- [x] Outbound email failures do not expose raw internals

## 6. Dependencies

- [ ] `npm audit --json` reports no blocking advisories
- [ ] Vulnerable packages are upgraded or risk-accepted in writing
- [ ] Dependency versions are intentionally locked for release
- [ ] Unnecessary runtime packages are removed

## 7. Frontend and deployment surface

- [ ] No sensitive data is exposed in URL params
- [ ] CSP headers are configured and verified in deployment
- [ ] User-generated content is sanitized before render where needed
- [ ] Public deployment headers and runtime config are inspected

---

## Failure log

Item: Multiple verified security gaps remain open for the approved single-user v1
Severity: HIGH
Description: Fresh inspection still shows client-stored lead data, unauthenticated public API routes without verified rate limiting or validation, a client-supplied SMTP credential flow, and unresolved dependency advisories.
Evidence:
- `src/LeadQualifier.jsx:319-324` and `src/LeadQualifier.jsx:330` store app data and theme in `localStorage`.
- `src/LeadQualifier.jsx:941-1012` performs Ship List Supabase reads/writes directly from the client via the public anon-key client created at `src/LeadQualifier.jsx:3-8`.
- `api/send-email.js:8-41` accepts `smtpConfig` from the request body and returns raw `error.message`.
- `api/anthropic.js:1-26` and `api/send-email.js:3-43` expose public POST handlers with method checks but no visible validation/rate limiting layer.
- `package.json:11-20` still uses caret ranges, and `npm audit --json` on 2026-04-16 reported 1 high advisory (`lodash`) and 1 moderate advisory (`nodemailer`).
Fix required:
- Remove or redesign the client-supplied SMTP flow.
- Upgrade or explicitly risk-accept the vulnerable dependencies, then rerun `npm audit --json`.
- Verify the deployed env/header posture and document whether the single-user localStorage/Supabase model is acceptable for v1.
Assigned to Codex: 2026-04-16

## Verified findings from 2026-04-16

- PASS: Anthropic API key handling remains server-side in the visible repo.
  Evidence: `api/anthropic.js:6-19` reads `process.env.ANTHROPIC_API_KEY` and forwards requests server-side.
- PASS: `.env.example` contains only a placeholder, and local env files are gitignored.
  Evidence: `.env.example:1-2` contains `ANTHROPIC_API_KEY=sk-ant-xxxxx`, and `.gitignore:1-5` ignores `.env` and `.env.local`.
- PASS: The inspected API routes restrict unsupported HTTP methods.
  Evidence: `api/anthropic.js:2-4` and `api/send-email.js:4-6` return `405` for non-`POST` requests.
- PASS: No raw SQL from user input is visible in the inspected frontend code.
  Evidence: `src/LeadQualifier.jsx:941-1012` uses the Supabase client API rather than handwritten SQL.
- FAIL: Sensitive app data persists in browser storage.
  Evidence: `src/LeadQualifier.jsx:319-324` and `src/LeadQualifier.jsx:330` persist app state/theme in `localStorage`, and `README.md:49-52` documents `localStorage` as the storage model.
- FAIL: Ship List database access is performed directly from the client with no verified server-side guard.
  Evidence: `src/LeadQualifier.jsx:3-8` creates the public Supabase client, and `src/LeadQualifier.jsx:941-1012` reads/writes `ship_list_companies` from the browser.
- PASS: The email route no longer accepts SMTP credentials from the client and no longer leaks raw error text.
  Evidence (2026-04-21): `api/send-email.js` redesigned — `smtpConfig` removed from request body; credentials read from `process.env.SMTP_USER/PASS/HOST/PORT/FROM_NAME`; error handler now returns generic `"Failed to send email"` instead of raw `error.message`. Build verified passing.
- FAIL: Public API validation/rate limiting are not verified and are not evident in the inspected handlers.
  Evidence: `api/anthropic.js:1-26` forwards `req.body` directly, and `api/send-email.js:8-15` performs only minimal presence checks.
- FAIL: Dependency security gate is still red.
  Evidence: `npm audit --json` on 2026-04-16 reported 1 high advisory (`lodash`) and 1 moderate advisory (`nodemailer`); `package.json:11-20` still uses caret ranges.
- UNVERIFIED: Git history secrets scan, deployed Vercel env vars, CSP headers, and deployed response headers.
  Evidence: this prep session did not inspect git history, the live Vercel project, or deployed HTTP responses.

## Missing verification before security sign-off

- Inspect git history for committed secrets before closing the secrets section.
- Inspect the deployed Vercel env configuration and response headers before marking env/CSP items pass.
- Re-run `npm audit --json` only after dependency remediation or written risk acceptance lands.
- Decide and document whether browser-local lead storage plus client-side Supabase access is acceptable for the single-user v1 threat model.

## Next verification step

- After the `vercel dev` QA pass, inspect the deployed/runtime security surface in this order: `api/send-email.js` redesign decision, dependency remediation plus `npm audit --json`, then deployment env/header verification.

---

## Agent rules

- CRITICAL blocks ship entirely until resolved and re-verified
- HIGH blocks ship unless CEO accepts risk in writing
- Never mark passing without actually verifying
- Run npm audit every check
- Scout reviews monthly against new CVEs
