export const COST_EVENTS_KEY = "lq-cost-events-v1";
export const COST_RUNS_KEY = "lq-cost-runs-v1";

export const MODEL_PRICING_PER_MTOK = {
  sonnet: { input: 3, output: 15, cacheWrite5m: 3.75, cacheRead: 0.3 },
  haiku: { input: 0.8, output: 4, cacheWrite5m: 1, cacheRead: 0.08 },
  opus: { input: 15, output: 75, cacheWrite5m: 18.75, cacheRead: 1.5 },
};

export const WEB_SEARCH_COST = 0.01;

export function getModelPricing(model = "") {
  const name = String(model).toLowerCase();
  if (name.includes("haiku")) return MODEL_PRICING_PER_MTOK.haiku;
  if (name.includes("opus")) return MODEL_PRICING_PER_MTOK.opus;
  return MODEL_PRICING_PER_MTOK.sonnet;
}

export function estimateTokensFromText(text) {
  return Math.ceil(String(text || "").length / 4);
}

export function calculateAnthropicCost(model, usage = {}, fallbackInputTokens = 0, fallbackOutputTokens = 0) {
  const pricing = getModelPricing(model);
  const inputTokens = Number(usage?.input_tokens ?? fallbackInputTokens ?? 0);
  const outputTokens = Number(usage?.output_tokens ?? fallbackOutputTokens ?? 0);
  const cacheCreationTokens = Number(usage?.cache_creation_input_tokens ?? 0);
  const cacheReadTokens = Number(usage?.cache_read_input_tokens ?? 0);
  const webSearchRequests = Number(usage?.server_tool_use?.web_search_requests ?? 0);
  const cost =
    (inputTokens * pricing.input / 1_000_000) +
    (outputTokens * pricing.output / 1_000_000) +
    (cacheCreationTokens * pricing.cacheWrite5m / 1_000_000) +
    (cacheReadTokens * pricing.cacheRead / 1_000_000) +
    (webSearchRequests * WEB_SEARCH_COST);
  return { inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, webSearchRequests, cost };
}

export function formatCost(cost) {
  const value = Number(cost || 0);
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

export function formatDuration(ms) {
  const value = Math.max(0, Number(ms || 0));
  if (value < 1000) return `${Math.round(value)}ms`;
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

export function formatRelativeTime(timestamp) {
  const value = typeof timestamp === "number" ? timestamp : Date.parse(timestamp || "");
  if (!value) return "unknown";
  const diff = Date.now() - value;
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? "ago" : "from now";
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return "just now";
  if (abs < hour) return `${Math.round(abs / minute)}m ${suffix}`;
  if (abs < day) return `${Math.round(abs / hour)}h ${suffix}`;
  if (abs < 2 * day && diff >= 0) return "yesterday";
  if (abs < 7 * day) return `${Math.round(abs / day)}d ${suffix}`;
  return new Date(value).toLocaleDateString();
}

export function createRunId() {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createCallId() {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function summarizeParams(params = {}) {
  const clean = Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (clean.length === 0) return "No params";
  const preferred = ["city", "region", "sizeBand", "niche", "count", "requestedCount", "roles"];
  const ordered = [
    ...preferred.filter(key => Object.prototype.hasOwnProperty.call(params, key)).map(key => [key, params[key]]),
    ...clean.filter(([key]) => !preferred.includes(key)),
  ];
  return ordered.slice(0, 4).map(([key, value]) => {
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());
    const rendered = Array.isArray(value) ? value.join(", ") : String(value);
    return `${label}: ${rendered}`;
  }).join(" · ");
}

export function buildCostStats(costRuns = [], costEvents = []) {
  const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const runsTotal = costRuns.reduce((sum, run) => sum + Number(run.totalCost || 0), 0);
  const runCallIds = new Set(costRuns.flatMap(run => run.callIds || []));
  const unassociated = costEvents.filter(event => !event.runId && !runCallIds.has(event.id));
  const unassociatedTotal = unassociated.reduce((sum, event) => sum + Number(event.cost || 0), 0);
  const lifetime = runsTotal + unassociatedTotal;
  const thisWeek = costRuns
    .filter(run => Date.parse(run.startedAt || run.endedAt || "") >= weekStart)
    .reduce((sum, run) => sum + Number(run.totalCost || 0), 0) +
    unassociated
      .filter(event => Number(event.createdAt || 0) >= weekStart)
      .reduce((sum, event) => sum + Number(event.cost || 0), 0);
  const completedRuns = costRuns.filter(run => Number(run.totalCost || 0) > 0);
  const totalResults = costRuns.reduce((sum, run) => sum + Number(run.resultCount || 0), 0);
  return {
    lifetime,
    thisWeek,
    averagePerRun: completedRuns.length ? runsTotal / completedRuns.length : 0,
    averagePerResult: totalResults ? runsTotal / totalResults : 0,
    unassociated,
  };
}

export function normalizeLegacyCostEvents(events = []) {
  return (Array.isArray(events) ? events : []).map(event => ({
    id: event.id || createCallId(),
    createdAt: event.createdAt || Date.now(),
    ...event,
  }));
}
