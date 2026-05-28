#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const city = process.env.CITY || "Bakersfield, CA";
const niche = process.env.NICHE || "auto detailers";
const desiredCount = Math.min(Math.max(Number(process.env.COUNT) || 3, 1), 10);
const minAccepted = Math.min(Number(process.env.MIN_ACCEPTED) || 2, desiredCount);
const searchCount = Math.min(desiredCount + 1, 10);

const chainRejects = [
  "jiffy lube",
  "midas",
  "maaco",
  "caliber collision",
  "gerber collision",
  "supercuts",
  "great clips",
  "subway",
  "mcdonald",
  "wendy",
  "burger king",
  "taco bell",
  "starbucks",
  "walmart",
  "target",
  "home depot",
  "lowe's",
  "lowes",
  "u-haul",
  "enterprise",
  "avis",
  "hertz",
];

function extractJSONValue(fullText) {
  if (!fullText) return null;
  const fenced = fullText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidates = [];
  if (fenced) candidates.push(fenced[1]);
  const firstBracket = fullText.indexOf("[");
  const lastBracket = fullText.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    candidates.push(fullText.slice(firstBracket, lastBracket + 1));
  }
  candidates.push(fullText);
  for (const candidate of candidates) {
    try { return JSON.parse(candidate); } catch {}
    const arrayMatch = candidate.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      try { return JSON.parse(arrayMatch[0]); } catch {
        try { return JSON.parse(arrayMatch[0].replace(/,\s*(?=[}\]])/g, "")); } catch {}
      }
    }
  }
  return null;
}

function clean(value) {
  const text = String(value || "").trim();
  return /^(not found|n\/a|na|none|unknown|null)$/i.test(text) ? "" : text;
}

function columnKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getValue(row, names) {
  const wanted = names.map(columnKey);
  const key = Object.keys(row || {}).find(name => wanted.includes(columnKey(name)));
  return clean(key ? row[key] : "");
}

async function postJSON(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || data.error || `${path} failed with HTTP ${response.status}`);
  }
  return data;
}

function buildPrompt() {
  return `Find up to ${searchCount} candidate ${niche} in ${city} that do not appear to have a usable standalone website, so at least ${desiredCount} can survive verification.

Practical no-website definition:
- No website listed on public sources.
- Or only a Facebook, Instagram, Yelp, directory, booking page, marketplace profile, or Google Business Profile.
- Or the listed website is broken, parked, dead, empty, under construction, or a generic placeholder.

Fast research rules:
1. Start from broad public listings/search results for "${niche} ${city}".
2. Prefer businesses where the listing has no Website field or only a social/directory/booking link.
3. If the public listing shows a Website field/link/URL, put that exact URL into Website URL.
4. Keep only real local businesses with a phone or email.
5. Exclude national chains, franchises, lead sellers, marketplaces, and directories.
6. Do not perform exhaustive per-business official-site searches. The harness runs a separate website verification pass after this response.
7. If you cannot confidently find ${searchCount} candidates quickly, return fewer valid candidates instead of continuing to search.

Selected signal detection:
- HIRING: job postings or "now hiring" language.
- RUNNING_ADS: sponsored Yelp result, enhanced Yelp profile, paid directory placement, or visible paid/local ad indicator.
- ONLINE_BOOKING: booking page on Vagaro, Booksy, Square Appointments, Calendly, StyleSeat, Schedulicity, GlossGenius, Acuity, or similar.
- RECENT_ACTIVITY: recently opened, recently posted, recently updated listing, or recently announced service/location.

Exclude:
- Companies with a normal usable standalone website.
- National chains, franchises, marketplaces, directories, and lead sellers.
- Companies without a phone number or email address.

Return exactly this JSON array schema:
[
  {
    "Company Name": "",
    "Address": "",
    "Phone": "",
    "Email": "",
    "Website URL": "",
    "Source URL": "",
    "Website Status": "No website found",
    "Proof": "",
    "Pitch Angle": "",
    "Signals": {
      "hiringOnIndeed": false,
      "runningAds": false,
      "onlineBooking": false,
      "recentlyStarted": false
    },
    "Signal Evidence": {
      "hiringOnIndeed": "",
      "runningAds": "",
      "onlineBooking": "",
      "recentlyStarted": ""
    }
  }
]

Hard rules:
- No placeholder text like "Not found", "N/A", "Unknown", or "None".
- Source URL must be a public page proving the business exists or showing limited web presence.
- Website Status must be one of: "No website found", "Social-only presence", "Directory-only presence", "Broken website", "Placeholder website", "Parked domain".
- Pitch Angle must be one caller-ready sentence about helping the business get a real website and must mention a specific fact from the row.
- Return strict JSON only. No prose. No markdown.`;
}

function localFailures(row, verification) {
  const company = getValue(row, ["Company Name"]);
  const address = getValue(row, ["Address", "Region", "Location"]);
  const phone = getValue(row, ["Phone", "Best Phone"]);
  const email = getValue(row, ["Email"]);
  const pitch = getValue(row, ["Pitch Angle"]);
  const sourceUrl = getValue(row, ["Source URL", "Source"]);
  const websiteStatus = getValue(row, ["Website Status"]);
  const fullText = JSON.stringify(row).toLowerCase();
  const failures = [];

  if (!company) failures.push("missing company name");
  if (!new RegExp(city.replace(/,.*/, ""), "i").test(address + " " + fullText)) failures.push(`not clearly in ${city}`);
  if (!/auto|detail|detailing|car wash|mobile wash|ceramic|paint correction/i.test(fullText)) failures.push(`not clearly niche-matched to ${niche}`);
  if (chainRejects.some(name => fullText.includes(name))) failures.push("looks like a chain/franchise");
  if (!phone && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) failures.push("missing phone/email");
  if (verification?.keep === false || /has working website/i.test(verification?.status || "")) failures.push(`working website found: ${verification?.websiteUrl || "unknown"}`);
  if (!/no website|social-only|directory-only|broken|placeholder|parked/i.test(websiteStatus + " " + (verification?.status || ""))) failures.push("website status is not no-website/broken/social-only");
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) failures.push("missing public source URL");
  if (!pitch || pitch.length < 45) failures.push("pitch angle too generic/short");

  return failures;
}

async function main() {
  console.log(`Running webdev Find Leads harness against ${BASE_URL}`);
  console.log(`Search: ${city} + ${niche} + ${desiredCount} results\n`);

  const data = await postJSON("/api/anthropic", {
    model: "claude-sonnet-4-20250514",
    max_tokens: 2200,
    system: "You are a fast B2B lead researcher. Use web search to find real local businesses. Return only a raw JSON array. No markdown, no explanation, no placeholders.",
    messages: [{ role: "user", content: buildPrompt() }],
    tools: [{ type: "web_search_20250305", name: "web_search" }],
  });

  const text = (data.content || [])
    .filter(block => block.type === "text" && block.text)
    .map(block => block.text)
    .join("\n");
  const rows = extractJSONValue(text);
  if (!Array.isArray(rows)) {
    console.error("Raw text preview:");
    console.error(text.slice(0, 2000) || JSON.stringify(data).slice(0, 2000));
    throw new Error("Anthropic response did not parse to a JSON array.");
  }

  const verification = await postJSON("/api/website-check", {
    leads: rows.map(row => ({
      businessName: getValue(row, ["Company Name"]),
      websiteUrl: getValue(row, ["Website URL", "Website"]),
    })),
  });

  const accepted = [];
  const rejected = [];
  rows.forEach((row, index) => {
    const check = verification.results?.[index] || null;
    const failures = localFailures(row, check);
    const item = { row, verification: check, failures };
    if (failures.length === 0) accepted.push(item);
    else rejected.push(item);
  });

  console.log(`Accepted: ${accepted.length}/${desiredCount}`);
  accepted.slice(0, desiredCount).forEach((item, index) => {
    console.log(`\n[PASS ${index + 1}] ${getValue(item.row, ["Company Name"])}`);
    console.log(`Contact: ${getValue(item.row, ["Phone"])} ${getValue(item.row, ["Email"])}`.trim());
    console.log(`Address: ${getValue(item.row, ["Address"])}`);
    console.log(`Website: ${item.verification?.status || getValue(item.row, ["Website Status"])}`);
    console.log(`Source: ${getValue(item.row, ["Source URL"])}`);
    console.log(`Pitch: ${getValue(item.row, ["Pitch Angle"])}`);
  });

  if (rejected.length) {
    console.log(`\nRejected: ${rejected.length}`);
    rejected.forEach((item, index) => {
      console.log(`\n[FAIL ${index + 1}] ${getValue(item.row, ["Company Name"]) || "(missing company)"}`);
      console.log(`Reasons: ${item.failures.join("; ")}`);
      console.log(`Website check: ${item.verification?.status || "none"} ${item.verification?.websiteUrl || ""}`.trim());
      console.log(`Source: ${getValue(item.row, ["Source URL"])}`);
    });
  }

  if (accepted.length < Math.min(minAccepted, rows.length)) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(`Harness failed: ${error.message}`);
  process.exit(1);
});
