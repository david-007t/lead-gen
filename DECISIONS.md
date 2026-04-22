# DECISIONS.md — Architecture decision log
# Project: [INFERRED] Leadqual
# Last updated: 2026-04-15

---

Every technical decision not explicitly in SPEC.md must be logged here.
Read this before making any architectural change.
Scout reads "revisit if" fields to flag stale decisions.

---

## Decision log

### DECISION-[INFERRED]-001
- Date: 2026-04-14
- Made by: [INFERRED] Codex retrofit pass
- Category: [INFERRED] Governance baseline

Decision: [INFERRED] Use the existing repository structure as the source of truth for a frozen retrofit spec.
Alternatives considered: [INFERRED] Delay governance until after a broader rebuild, or invent missing product details.
Why this: [INFERRED] The brief required governance bootstrapping from what is actually present in code.
Trade-offs accepted: [INFERRED] Some values remain inferred until the CEO verifies them.
Revisit if: [INFERRED] The product scope or architecture changes materially from what is currently in the repo.

### DECISION-[INFERRED]-002
- Date: 2026-04-14
- Made by: [INFERRED] Codex retrofit pass
- Category: [INFERRED] Verification posture

Decision: [INFERRED] Mark QA and security review artifacts as FAIL until a live verification session is run.
Alternatives considered: [INFERRED] Leave review files blank or imply readiness without evidence.
Why this: [INFERRED] Governance should reflect actual verification status, not optimism.
Trade-offs accepted: [INFERRED] The project appears more unfinished, but the state is honest.
Revisit if: [INFERRED] A full QA and security run is completed with evidence.

### DECISION-[INFERRED]-003
- Date: 2026-04-15
- Made by: Codex
- Category: Governance reconciliation

Decision: Replace the stale "governance retrofit" sprint framing with a verified production-readiness cleanup task centered on `src/LeadQualifier.jsx`, `api/anthropic.js`, and `api/send-email.js`.
Alternatives considered: Leave the retrofit task in place, or start source edits without correcting the project record first.
Why this: The repo already contains the app and API code, and inspection showed the current highest-confidence gap is production logging plus missing local build verification, not missing governance scaffolding.
Trade-offs accepted: The plan now reflects a narrower and more operational next move, but broader product questions like auth remain blocked.
Revisit if: The logging cleanup is completed and `npm run build` passes with installed dependencies.

---

## Dependency log

| Package | Version | Why added | Date | Added by |
|---------|---------|-----------|------|----------|
| [INFERRED] No new dependency added in retrofit | [INFERRED] N/A | [INFERRED] Governance-only session | 2026-04-14 | [INFERRED] Codex |

---

## Agent rules

- Log every decision not in SPEC.md
- Log every new dependency — no silent installs
- "Revisit if" is mandatory on every decision
- Never delete — mark superseded decisions as SUPERSEDED
