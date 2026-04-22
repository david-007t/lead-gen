# SPEC.md — Product specification
# Project: [INFERRED] Leadqual
# Version: 1.0
# Status: FROZEN
# Frozen by: [INFERRED] CEO
# Frozen on: 2026-04-14

---

⚠️ THIS FILE IS FROZEN. NO AGENT MAY MODIFY IT.
Flag scope changes in TASKS.md and escalate to orchestrator.

---

## Product identity

Name: [INFERRED] Leadqual
Type: [INFERRED] AI lead qualification dashboard
One-line value prop: [INFERRED] Finds and scores service-business leads with editable pipeline management and analytics.
Target user: [INFERRED] Service businesses and operators sourcing qualified outbound opportunities.
Business goal: [INFERRED] Help operators discover and prioritize leads without manual spreadsheet triage.

---

## Three-layer architecture

### Layer 1 — Data
Source: [INFERRED] User-entered lead data, Supabase records, and AI-generated search results via Anthropic.
Format: [INFERRED] Browser state, Supabase rows, CSV imports, and Vercel API JSON responses.
Update frequency: [INFERRED] On-demand user-triggered refresh and editing.

### Layer 2 — AI orchestration
What the AI does: [INFERRED] Generate or score leads based on industry filters and qualification criteria.
Model: [INFERRED] Anthropic messages API accessed through `api/anthropic.js`.
Key logic: [INFERRED] Prompt Anthropic from a Vercel serverless proxy and combine results with editable lead records.

### Layer 3 — Output
What the user gets: [INFERRED] Qualified lead list with scoring, analytics, and follow-up tracking.
Delivery method: [INFERRED] Browser dashboard deployed on Vercel.
Format: [INFERRED] React UI tables, charts, and exported CSV data.

---

## MVP features — locked

[INFERRED] Core flow visible in the current codebase is preserved as an MVP feature.
[INFERRED] Primary data source and storage layer are already reflected in the repository.
[INFERRED] Current operator or user-facing output surface remains part of v1.
[INFERRED] Existing integration stack remains in scope only where already implemented.
[INFERRED] Quality and governance visibility are now tracked through the retrofit files.

Maximum 5. If not listed here, it does not get built in v1.

---

## Explicitly out of scope — v1

[INFERRED] Broad platform expansion beyond the currently visible repository responsibilities.
[INFERRED] Major architectural rewrites outside the existing stack.
[INFERRED] New premium or admin experiences not already represented in code.

---

## Tech stack

Frontend: [INFERRED] React 18 + Vite single-page app.
Backend / DB: [INFERRED] Vercel serverless functions plus Supabase.
Auth: [INFERRED] No production auth flow implemented yet.
Hosting: [INFERRED] Vercel.
Data pipeline: [INFERRED] User-triggered browser workflow with serverless API proxying.
Key integrations: [INFERRED] Supabase, Anthropic, Nodemailer, Recharts, Vercel Functions.

---

## Launch criteria

Target date: [INFERRED] 2026-05-07
Definition of done: All MVP features working, QA gate passed, security gate passed, CEO staging approval received.

---

## Changelog

v1.0 — 2026-04-14 — Initial spec. Frozen by [INFERRED] CEO.
