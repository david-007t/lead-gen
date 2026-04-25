// api/indeed-search.js
// Fetches real job postings from JSearch (RapidAPI) — aggregates Indeed, LinkedIn, ZipRecruiter, Glassdoor.
// Filters to local small business leads only — no remote, no staffing agencies, no national chains.

const JSEARCH_BASE = "https://jsearch.p.rapidapi.com/search";

const BLOCKED_PATTERNS = [
  /\bstaffing\b/i,
  /\brecruiting\b/i,
  /\brecruitment\b/i,
  /\btalent\s+(group|solutions|partners|acquisition)\b/i,
  /\bstaff\s+(solutions|services|pro|partners)\b/i,
  /\b(global|national|american|premier|elite|professional)\s+(staffing|resources|solutions|hr)\b/i,
  /\bconduent\b/i,
  /\bsafelite\b/i,
  /\bmanpower\b/i,
  /\bkelly\s+services\b/i,
  /\brobert\s+half\b/i,
  /\boffice\s+team\b/i,
  /\bsyneos\b/i,
  /\badecco\b/i,
  /\brandstad\b/i,
  /\binsight\s+global\b/i,
  /\btelus\s+international\b/i,
  /\bteleperformance\b/i,
  /\bsupport\.com\b/i,
  /\bcognosante\b/i,
  /\bworkhuman\b/i,
  /\bworkaholics\b/i,
  /\b(hiring|workforce)\s+(solutions|group|partners)\b/i,
];

function isBlockedEmployer(name) {
  return BLOCKED_PATTERNS.some(p => p.test(name || ""));
}

function isRemoteJob(job) {
  if (job.job_is_remote === true) return true;
  const loc = [job.job_city, job.job_state].filter(Boolean).join(" ").toLowerCase();
  if (/\bremote\b/.test(loc)) return true;
  if (/\bremote\b/.test((job.job_title || "").toLowerCase())) return true;
  return false;
}

function buildPayRate(job) {
  const min = job.job_min_salary;
  const max = job.job_max_salary;
  const period = (job.job_salary_period || "").toLowerCase();
  if (!min && !max) return "";
  const fmt = (n) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`;
  const range = min && max ? `${fmt(min)}–${fmt(max)}` : min ? `${fmt(min)}+` : `up to ${fmt(max)}`;
  return period ? `${range}/${period}` : range;
}

async function fetchJSearch(role, location, apiKey) {
  const query = location ? `${role} in ${location}` : role;
  const params = new URLSearchParams({ query, num_pages: "1", date_posted: "week" });

  const resp = await fetch(`${JSEARCH_BASE}?${params}`, {
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`JSearch ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  if (data.status !== "OK" || !Array.isArray(data.data)) {
    throw new Error(data.message || "JSearch returned no results");
  }
  return data.data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return res.status(500).json({ error: "RAPIDAPI_KEY is not configured. Add it in Vercel → Settings → Environment Variables." });

  const { roles = [], location = "", count = 10 } = req.body || {};
  if (!Array.isArray(roles) || roles.length === 0) return res.status(400).json({ error: "roles[] is required" });

  const errors = [];

  const roleResults = await Promise.all(
    roles.slice(0, 5).map(async (role) => {
      try {
        return { role, jobs: await fetchJSearch(role, location, apiKey) };
      } catch (err) {
        errors.push({ role, error: err.message });
        return { role, jobs: [] };
      }
    })
  );

  const seenUrls = new Set();
  const results = [];

  for (const { role, jobs } of roleResults) {
    for (const job of jobs) {
        if (isRemoteJob(job)) continue;
        if (isBlockedEmployer(job.employer_name)) continue;

        const url = job.job_apply_link || job.job_google_link || "";
        if (!url || seenUrls.has(url)) continue;
        seenUrls.add(url);

        const city = job.job_city || "";
        const state = job.job_state || "";
        const locationStr = [city, state].filter(Boolean).join(", ") || location || "On-site";

        results.push({
          companyName: job.employer_name || "",
          jobTitle: job.job_title || role,
          location: locationStr,
          jobUrl: url,
          postingDate: job.job_posted_at_datetime_utc || "",
          jobPayRate: buildPayRate(job),
          description: (job.job_description || "").slice(0, 600),
          isDirectApply: Boolean(job.job_apply_is_direct),
          source: "JSearch",
          searchedRole: role,
          industry: "",
          website: job.employer_website || "",
          phone: "",
          email: "",
          companySize: "",
          automationAngle: "",
          automationUseCase: "",
          pitchHook: "",
          urgency: "medium",
          annualCost: "",
          buyingSignals: [],
          opportunities: [],
          googleReviews: { rating: 0, count: 0 },
        });
    }
  }

  return res.status(200).json({
    results: results.slice(0, count * roles.length),
    errors: errors.length ? errors : undefined,
  });
}
