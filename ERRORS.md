# ERRORS.md — Bug escalation log
# Project: [INFERRED] Leadqual
# Last updated: 2026-04-14

---

Read this before attempting any fix.
Check if error already exists before logging a new one.
Scout reads this monthly to identify systemic patterns.

---

## Active errors

### ERROR-[INFERRED]-001
- Status: BLOCKED
- Logged: 2026-04-14 by [INFERRED] Codex
- Task reference: [INFERRED] Audit production-readiness gaps in `src/LeadQualifier.jsx`, `api/anthropic.js`, and `api/send-email.js`.
- Description: [INFERRED] The README explicitly states the AI Lead Finder will not work under plain `npm run dev` because the Vite app depends on a separate backend path and requires `vercel dev` for local API behavior, which is an incomplete developer experience for the current repo state.
- Expected: [INFERRED] The current primary workflow should work from the visible repo state.
- Actual: [INFERRED] The inferred blocker remains unresolved after governance-only review.
- Impact: [INFERRED] Blocks clean QA and release confidence for the current build.

Attempt 1 — 2026-04-14:
  Tried: [INFERRED] Read current code paths, README notes, and existing handoff context.
  Result: [INFERRED] Root cause became clearer, but the issue was not fixed because source edits were out of scope for this retrofit.
  Why failed: [INFERRED] This session intentionally did not modify source code.

Attempt 2 — 2026-04-14:
  Tried: [INFERRED] Convert findings into governance tasks and escalation notes.
  Result: [INFERRED] Team now has a clear implementation target, but the bug still exists.
  Why failed: [INFERRED] Governance-only work cannot resolve runtime behavior by itself.

Escalated to CEO: 2026-04-14
Resolution needed: [INFERRED] Confirm the project remains in BUILD until the blocker is fixed and verified.

---

## Resolved errors

### ERROR-[INFERRED]-000
- Status: RESOLVED
- Logged: 2026-04-14 — Resolved: 2026-04-14
- Root cause: [INFERRED] Missing governance surface across the existing project.
- Fix: [INFERRED] Bootstrapped and populated the 10 governance files.
- Files changed: [INFERRED] CLAUDE.md, SPEC.md, TASKS.md, HANDOFF.md, ERRORS.md, DECISIONS.md, ARCHITECTURE.md, REVIEW_REPORT.md, QA_CHECKLIST.md, SECURITY_CHECKLIST.md
- Prevention: [INFERRED] Keep project governance in sync with `_system/templates/` going forward.

---

## Patterns — updated by Scout

- [INFERRED] Operational assumptions hidden in code or environment notes — occurred [INFERRED] 1 times — suggested fix: [INFERRED] Convert assumptions into explicit config and checklist items.

---

## Agent rules

- Log after 2 failed attempts — not 3 or 4
- Never delete resolved errors — they feed Scout pattern analysis
- Be specific — "it didn't work" is not valid
- Include file paths, error messages, and stack traces
- One error ID per distinct issue
