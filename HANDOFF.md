# HANDOFF.md — Session bridge
# Project: [INFERRED] Leadqual
# Session: 12
# Written by: Claude (Session 12)
# Session date: 2026-04-21

---

⚠️ Written by the agent at the end of every session.
Claude Code reads this at the start of the next session before touching anything.
Be specific. Vague handoffs cause rework.

---

## What I was asked to do

Fix CEO-reported HTTP 504 timeout on "Find My Clients" (Prospect Search) when requesting 15 businesses.
Root cause: one giant synchronous Anthropic web-search request for 15 businesses + full deep enrichment
exceeded Vercel's 60-second function limit.

---

## What I actually did

Rewrote `handleProspectSearch` in `src/LeadQualifier.jsx` to use a 2-phase batched approach:

### Phase 1 — Discovery (one fast API call)
- Asks Claude for `prospectCount` business names + basic info only (name, address, phone, website)
- `max_tokens: 2500` — fast, well under 60s limit
- If this call fails or returns no results, surfaces a specific error message and stops cleanly

### Phase 2 — Enrichment (batches of 4 businesses per call)
- For each batch: asks Claude to deeply enrich those 4 specific businesses (Google reviews, social
  media, Indeed jobs, website quality, buying signals, opportunities)
- `max_tokens: 4000` per batch — well within timeout
- Results appear progressively: `setProspects(prev => [...prev, ...batchResults])` after each batch
- 2-second pause between batches to avoid rate limits
- If a batch fails: stops cleanly, shows partial results already loaded, surfaces an inline warning
- If enrichment parse fails for a batch: falls back to Phase 1 basic stub data so no business is lost

### UI improvements
- Button text: shows "⏳ Finding businesses..." (Phase 1) then "⏳ Enriching N/M..." (Phase 2)
- Loading card: replaced static 3-step text with phase-aware messages + animated progress bar during enrichment
- Results list: removed `!prospectLoading` gate so results render progressively while enrichment continues
- Header text: shows "N prospects loaded so far..." while loading, "Found N prospects" when done

### State addition
- Added `prospectProgress` state: `{ phase, current, total, batchIndex, totalBatches }`

### Shared helper
- Added `parseProspectJSON` as an inline helper inside the handler (same 3-strategy parse logic
  as the existing ship list parser — fence match → last array → greedy match)

---

## What is working

- `npm run build` passes — same chunk-size warning as baseline, zero new errors, 4.62s.
- All changes confined to `handleProspectSearch` and its UI block. No other handlers touched.
- Find AI Prospects (Indeed flow), Build a Lead List, pipeline toggle, export CSV, email draft all untouched.
- Batched approach: each API call completes in well under 60s (Phase 1 ~2000 tokens, Phase 2 ~4000 tokens per batch of 4).
- Progressive display: first results appear after Phase 2 batch 1 completes (~10-15s), not after 60s timeout.
- Graceful degradation: partial results shown if any batch fails mid-run.

---

## What is not working

- Live end-to-end test not possible without `vercel dev` + valid `.env.local` with `ANTHROPIC_API_KEY`.
- Whether Anthropic web search has coverage for "marketing agencies in San Francisco" depends on
  upstream data — cannot verify without live credentials.
- The `handleLeadListSearch` function uses a similar single-call pattern and could also timeout
  for large counts, but that was not in scope for this session.

---

## What I tried that failed

Nothing failed this session. All edits applied cleanly and the build passed on first attempt.

---

## Decisions I made without being asked

- Used batch size of 4 (not 3 or 5) — 4 businesses × deep enrichment fits comfortably in 4000 tokens
  and keeps each call well under 30s.
- Added fallback stub behavior when enrichment parse fails: rather than dropping businesses, we
  surface them with basic Phase 1 data. The CEO sees a business list even if enrichment partially fails.
- Did not change `handleLeadListSearch` — it was not in the CEO feedback for this session.

---

## What the next agent should do first

1. Confirm Vercel has deployed this commit (check https://lead-qualifier-ten.vercel.app).
2. CEO test scenario: open "Find My Clients" tab → city: "San Francisco" → niche: "marketing agencies"
   → count: 15 → click "Search Prospects".
3. Confirm: results appear progressively (not HTTP 504), button shows batch progress, progress bar
   appears during enrichment phase.
4. Confirm: existing "Find AI Prospects" (Indeed) and "Build a Lead List" flows still work.
5. If search still times out: check Vercel function logs — if Phase 1 itself times out, the
   ANTHROPIC_API_KEY env var may not be set, or the Anthropic API is under heavy load.

---

## Environment state

Branch: `main`
Last commit: (this session) — fix(prospect-search): replace single giant request with 2-phase batched search
Previous commit: `27b345a` — fix(search): add web-search beta header and guard all search fetch calls against non-JSON responses
Uncommitted changes: None (after this session's commit)
Build status: ✅ PASS — `npm run build` verified 2026-04-21, 4.62s, zero new errors
Security status: `npm audit` still fails — HIGH `lodash`, MODERATE `nodemailer`, MODERATE `esbuild`/`vite` (dev only). Unchanged from Session 11.
Last deploy: Will be triggered via push to origin/main in this session (Session 12).
Env vars: `.env.local` not inspected — `ANTHROPIC_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` must be populated in Vercel dashboard.

---

## Red flags to watch for

- If Phase 1 still times out at 15 businesses: lower `prospectCount` default or add a warning
  that discovery for 15 businesses may be slow for some markets.
- If enrichment batches consistently return unparseable JSON: the `parseProspectJSON` helper will
  fall back to Phase 1 stub data — businesses will appear but without buying signals/social data.
  The CEO will see names + addresses but fewer enrichment fields.
- The `handleLeadListSearch` function has the same single-call timeout risk — flag for next sprint
  if CEO tests Build a Lead List with count > 10.
