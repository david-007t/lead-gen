#!/usr/bin/env node
import { readFile } from "fs/promises";
import path from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
let city = process.env.CITY || "Phoenix, AZ";
let niche = process.env.NICHE || "auto detailers";
const allowClaudeLive = process.env.ALLOW_CLAUDE_LIVE === "1";
const liveVerify = process.env.LIVE_VERIFY === "1";
const leadQualityOnly = process.env.LEAD_QUALITY_ONLY === "1";
const defaultFixture = path.join(process.cwd(), "fixtures/find-leads/phoenix-auto-detailers.json");
const fixtureFile = process.env.FIXTURE_FILE || (allowClaudeLive ? "" : defaultFixture);
let desiredCount = Math.min(Math.max(Number(process.env.COUNT) || (fixtureFile ? 5 : 3), 1), 10);
let minAccepted = Math.min(Number(process.env.MIN_ACCEPTED) || (fixtureFile ? 1 : 2), desiredCount);
let searchCount = Math.min(desiredCount * 3, 12);

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

function companyName(row) {
  return getValue(row, ["Company Name"]);
}

function isGenericSourceUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return true;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const path = parsed.pathname.toLowerCase().replace(/\/+$/, "");
    if (!path || path === "/") return true;
    if (host === "yelp.com" && /^\/search\/?/.test(path)) return true;
    if (host === "yelp.com") return !/^\/biz\/[^/]+/.test(path);
    if (host === "google.com" && /^\/search\/?/.test(path)) return true;
    if (host === "google.com" && /^\/maps\/search\/?/.test(path)) return true;
    if (host === "google.com" && /^\/maps\/place\/[^/]+/.test(path)) return false;
    if (host === "bing.com" && /^\/search\/?/.test(path)) return true;
    if (host === "facebook.com" || host.endsWith(".facebook.com")) return /^\/(search|pages|marketplace|groups|events|watch|reel|story)(\/|$)/.test(path);
    if (host === "instagram.com" || host.endsWith(".instagram.com")) return /^\/(explore|reels?|stories|accounts|p)(\/|$)/.test(path);
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return !/^\/@[^/]+/.test(path);
    if (host === "g.page") return false;
    return false;
  } catch {
    return true;
  }
}

function isValidEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  if (/\b(example|test|fake|dummy|placeholder)\b/.test(email)) return false;
  if (/(^|\.)example\.(com|org|net)$|(^|\.)test$|(^|\.)invalid$/.test(email.split("@")[1] || "")) return false;
  return true;
}

function isFabricatedPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10) return false;
  return /^55501\d{2}$/.test(national.slice(3)) || /^555/.test(national.slice(3));
}

function looksLikeSearchQueryBusinessName(name) {
  const normalizedName = String(name || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalizedName) return false;
  const requestedCity = parseCityState(city).city.toLowerCase();
  const words = normalizedName.split(/\s+/);
  const cityWords = requestedCity.split(/\s+/).filter(Boolean);
  const nameWords = words.filter(word => !cityWords.includes(word));
  const nicheWords = nicheTokens(niche)
    .flatMap(word => [word, word.replace(/s$/, ""), word.replace(/ers?$/, ""), word.replace(/ing$/, "")])
    .filter(Boolean);
  const hasCity = requestedCity && normalizedName.includes(requestedCity);
  const nicheHits = new Set(nicheWords.filter(word => normalizedName.includes(word))).size;
  const genericServiceWords = /\b(auto|mobile|car|ceramic|paint|detail|detailing|wash|cleaning|coating|nail|salon|spa|hvac|contractor|contractors?|plumb|plumber|roof|roofer|electric|electrician|landscap|cleaners?|repair|service|services)\b/;
  const servicePhrase = genericServiceWords.test(normalizedName);
  const allNonCityWordsAreGeneric = nameWords.length > 0 && nameWords.every(word =>
    nicheWords.includes(word) || genericServiceWords.test(word) || /^(and|the|near|best|local|top)$/.test(word)
  );
  return Boolean(hasCity && servicePhrase && words.length <= 5 && (nicheHits >= 1 || allNonCityWordsAreGeneric));
}

function nicheTokens(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length >= 4)
    .map(token => token.endsWith("s") ? token.slice(0, -1) : token);
}

function parseCityState(value) {
  const match = String(value || "").match(/\b([A-Za-z][A-Za-z .'-]+),\s*([A-Z]{2})\b/);
  if (!match) return { city: "", state: "" };
  return { city: match[1].trim(), state: match[2].trim().toUpperCase() };
}

const metroCities = {
  "phoenix, az": ["phoenix", "glendale", "peoria", "mesa", "tempe", "scottsdale", "chandler", "avondale", "surprise", "gilbert", "el mirage"],
  "los angeles, ca": ["los angeles", "glendale", "burbank", "pasadena", "inglewood", "long beach", "van nuys", "santa monica", "torrance"],
  "houston, tx": ["houston", "katy", "sugar land", "pasadena", "spring", "pearland"],
  "dallas, tx": ["dallas", "plano", "garland", "irving", "arlington", "mesquite"],
  "miami, fl": ["miami", "hialeah", "doral", "kendall", "hollywood"],
};

function inferCity(address) {
  const parsed = parseCityState(address);
  if (parsed.city) return parsed;
  const requested = parseCityState(city);
  const text = String(address || "").toLowerCase();
  const metro = metroCities[`${requested.city}, ${requested.state}`.toLowerCase()] || [requested.city.toLowerCase()];
  const found = metro.find(name => name && new RegExp(`\\b${name}\\b`, "i").test(text));
  return found ? { city: found, state: requested.state } : { city: "", state: "" };
}

function isInRequestedMetro(address) {
  const requested = parseCityState(city);
  if (!requested.city || !requested.state) return true;
  const actual = inferCity(address);
  if (!actual.city || actual.state !== requested.state) return false;
  const metro = metroCities[`${requested.city}, ${requested.state}`.toLowerCase()] || [requested.city.toLowerCase()];
  return metro.includes(actual.city.toLowerCase());
}

async function verifyPhones(rows) {
  const numbers = rows
    .map((row, index) => ({ index, phone: getValue(row, ["Phone", "Best Phone"]) }))
    .filter(item => item.phone);
  if (numbers.length === 0) return new Map();
  try {
    const data = await postJSON("/api/twilio-lookup", {
      numbers: numbers.map(item => ({ phone: item.phone, countryCode: "US" })),
    });
    const verified = new Map();
    (data.results || []).forEach((result, offset) => {
      verified.set(numbers[offset].index, result);
    });
    return verified;
  } catch (error) {
    console.log(`Phone verification unavailable: ${error.message}`);
    return new Map();
  }
}

function fixturePhoneResults(results = []) {
  const verified = new Map();
  results.forEach((result, index) => {
    verified.set(index, result);
  });
  return verified;
}

async function loadFixture() {
  if (!fixtureFile) return null;
  const raw = await readFile(fixtureFile, "utf8");
  const fixture = JSON.parse(raw);
  if (!Array.isArray(fixture.rows)) throw new Error(`Fixture ${fixtureFile} must contain rows[]`);
  return fixture;
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

function focusAngles() {
  if (/phoenix/i.test(city) && /auto|detail|detailing|ceramic|paint correction/i.test(niche)) {
    return [
      "mobile auto detailers in Phoenix AZ",
      "ceramic coating shops in Glendale AZ or Peoria AZ",
      "paint correction specialists in Mesa AZ or Tempe AZ",
      "interior car detailing in Scottsdale AZ or Chandler AZ",
    ];
  }
  return [niche];
}

function buildPrompt(focus, batchCount) {
  return `Find up to ${batchCount} candidate ${focus || niche} near ${city} that are strong prospects for web development services because they do not appear to have a usable standalone website, so at least ${desiredCount} can survive verification.

Practical no-website definition:
- No website listed on public sources.
- Or only a Facebook, Instagram, Yelp, directory, booking page, marketplace profile, or Google Business Profile.
- Or the listed website is broken, parked, dead, empty, under construction, or a generic placeholder.

Fast research rules:
1. Start from focused public listings/search results for "${focus || `${niche} ${city}`}".
2. Prefer businesses where the listing has no Website field or only a social/directory/booking link.
3. If the public listing shows a Website field/link/URL, put that exact URL into Website URL.
4. Keep only real local businesses with a phone or email.
5. Exclude national chains, franchises, lead sellers, marketplaces, and directories.
6. Do not perform exhaustive per-business official-site searches. The harness runs a separate website verification pass after this response.
7. If you cannot confidently find ${searchCount} candidates quickly, return fewer valid candidates instead of continuing to search.
8. Prefer owner-operated businesses where a first website, booking page, or local SEO page would clearly help them win customers.
9. Source URL must be a business-specific page for that company. Never use Yelp search, Google search, or maps search URLs.
10. Return fewer than ${batchCount} if you cannot find business-specific pages quickly.
11. Source URL must be reachable by an automated server check. Do not use Facebook, Instagram, Yelp, TikTok, or Google as the primary Source URL. Prefer accessible business-specific pages from MapQuest, Manta, Chamber of Commerce, BBB, Cylex, ShowMeLocal, BusinessYab, local city/business directories, or another non-social directory profile.

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
- Source URL must be a business-specific public page proving the business exists or showing limited web presence. Never return a generic search results URL.
- Website Status must be one of: "No website found", "Social-only presence", "Directory-only presence", "Broken website", "Placeholder website", "Parked domain".
- Pitch Angle must be one caller-ready sentence in this format: specific evidence from the source + business pain + website opportunity. It must mention "website", "booking", "local SEO", or "online".
- Return strict JSON only. No prose. No markdown.`;
}

function localFailures(row, verification, phoneVerification, { qualityOnly = false } = {}) {
  const company = getValue(row, ["Company Name"]);
  const address = getValue(row, ["Address", "Region", "Location"]);
  const phone = getValue(row, ["Phone", "Best Phone"]);
  const email = getValue(row, ["Email"]);
  const pitch = getValue(row, ["Pitch Angle"]);
  const sourceUrl = getValue(row, ["Source URL", "Source"]);
  const websiteStatus = getValue(row, ["Website Status"]);
  const fullText = JSON.stringify(row).toLowerCase();
  const failures = [];
  const tokens = nicheTokens(niche);
  const nicheMatched = tokens.length === 0 || tokens.some(token => fullText.includes(token)) || /auto|detail|detailing|car wash|mobile wash|ceramic|paint correction/i.test(`${niche} ${fullText}`);
  const phoneVerified = phone ? phoneVerification?.verified === true : false;
  const hasSyntaxEmail = isValidEmail(email);

  if (!company) failures.push("missing company name");
  if (looksLikeSearchQueryBusinessName(company)) failures.push("business name looks like the search query");
  if (!isInRequestedMetro(address)) failures.push(`outside requested metro ${city}`);
  if (!nicheMatched) failures.push(`not clearly niche-matched to ${niche}`);
  if (chainRejects.some(name => fullText.includes(name))) failures.push("looks like a chain/franchise");
  if (isFabricatedPhone(phone)) failures.push("fabricated-looking phone");
  if (qualityOnly) {
    if (!phone && !hasSyntaxEmail) failures.push("missing phone or syntactically valid email");
  } else if (!phoneVerified && verification?.emailVerified !== true) failures.push("missing verified phone or MX-valid email");
  if (/unverified|could not confirm/i.test(verification?.status || "")) failures.push("website status is unverified");
  else if (verification?.keep === false || /has working website/i.test(verification?.status || "")) failures.push(`working website found: ${verification?.websiteUrl || "unknown"}`);
  if (!/no website|social-only|directory-only|booking|profile-only|placeholder|parked/i.test(websiteStatus + " " + (verification?.status || ""))) failures.push("website status is not a verified webdev gap");
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) failures.push("missing public source URL");
  if (isGenericSourceUrl(sourceUrl)) failures.push("source URL is a search/listing page, not a business-specific profile");
  if (!qualityOnly && (verification?.sourceVerified !== true || verification?.sourceStatus !== "reachable")) failures.push("proof source URL not reachable");
  if (!pitch || pitch.length < 75 || !/website|booking|local seo|online/i.test(pitch)) {
    failures.push("pitch angle too generic/short for webdev sale");
  }

  return failures;
}

async function main() {
  const fixture = await loadFixture();
  if (fixture) {
    if (fixture.city && !process.env.CITY) city = fixture.city;
    if (fixture.niche && !process.env.NICHE) niche = fixture.niche;
    if (fixture.count && !process.env.COUNT) desiredCount = Math.min(Math.max(Number(fixture.count), 1), 10);
    if (fixture.minAccepted && !process.env.MIN_ACCEPTED) minAccepted = Math.min(Number(fixture.minAccepted), desiredCount);
    searchCount = Math.min(desiredCount * 3, 12);
  }

  console.log(`Running webdev Find Leads harness against ${BASE_URL}`);
  console.log(`Search: ${city} + ${niche} + ${desiredCount} results\n`);
  if (leadQualityOnly) {
    console.log("Mode: LEAD_QUALITY_ONLY=1 (contact verification skipped; source reachability is reported, not a hard reject)\n");
  }

  const seen = new Set();
  let accepted = [];
  let rejected = [];

  async function evaluateRows(rows, fixtureVerification = [], fixturePhones = []) {
    const uniqueRows = rows.filter(row => {
      const key = columnKey(getValue(row, ["Company Name"]));
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (uniqueRows.length === 0) return;

    const verification = liveVerify
      ? await postJSON("/api/website-check", {
          leads: uniqueRows.map(row => ({
            businessName: getValue(row, ["Company Name"]),
            websiteUrl: getValue(row, ["Website URL", "Website"]),
            sourceUrl: getValue(row, ["Source URL", "Source"]),
            phone: getValue(row, ["Phone", "Best Phone"]),
            email: getValue(row, ["Email"]),
            address: getValue(row, ["Address", "Region", "Location"]),
          })),
        })
      : { results: fixtureVerification };

    const enrichedRows = uniqueRows.map((row, index) => {
      const check = verification.results?.[index] || {};
      return {
        ...row,
        Phone: getValue(row, ["Phone", "Best Phone"]) || check.sourcePhone || "",
        Email: getValue(row, ["Email"]) || check.sourceEmail || "",
      };
    });
    const phoneResults = leadQualityOnly
      ? new Map()
      : liveVerify ? await verifyPhones(enrichedRows) : fixturePhoneResults(fixturePhones);

    enrichedRows.forEach((row, index) => {
      const check = verification.results?.[index] || null;
      const failures = localFailures(row, check, phoneResults.get(index), { qualityOnly: leadQualityOnly });
      const item = { row, verification: check, failures };
      if (failures.length === 0) accepted.push(item);
      else rejected.push(item);
    });
  }

  if (fixture) {
    console.log(`Mode: offline fixture (${fixtureFile})`);
    console.log(liveVerify ? "Verification: LIVE website/phone checks enabled" : "Verification: fixture-only, no network verifier calls");
    await evaluateRows(fixture.rows, fixture.verifications || [], fixture.phoneVerifications || []);
  } else {
    if (!allowClaudeLive) {
      throw new Error("Live Claude search is disabled. Set ALLOW_CLAUDE_LIVE=1 to spend Anthropic API tokens.");
    }

    for (const focus of focusAngles()) {
      if (accepted.length >= desiredCount) break;
      const batchCount = Math.min(3, searchCount);
      console.log(`Focus: ${focus}`);
      const data = await postJSON("/api/anthropic", {
        model: "claude-sonnet-4-6",
        max_tokens: 1800,
        system: "You are a fast B2B lead researcher. Use web search to find real local businesses. Return only a raw JSON array. No markdown, no explanation, no placeholders.",
        messages: [{ role: "user", content: buildPrompt(focus, batchCount) }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      });

      const text = (data.content || [])
        .filter(block => block.type === "text" && block.text)
        .map(block => block.text)
        .join("\n");
      const rows = extractJSONValue(text);
      if (!Array.isArray(rows)) {
        console.log("Batch did not parse; skipping focus.");
        console.log((text || JSON.stringify(data)).slice(0, 800));
        continue;
      }
      await evaluateRows(rows);
    }
  }

  if (leadQualityOnly) {
    console.log(`Discovered ${accepted.length + rejected.length} · Accepted ${accepted.length} · Rejected ${rejected.length}`);
  } else {
    console.log(`Accepted: ${accepted.length}/${desiredCount}`);
  }
  const acceptedForOutput = leadQualityOnly ? accepted : accepted.slice(0, desiredCount);
  acceptedForOutput.forEach((item, index) => {
    console.log(`\n[PASS ${index + 1}] ${getValue(item.row, ["Company Name"])}`);
    if (leadQualityOnly) {
      console.log(`City/metro: ${getValue(item.row, ["Address"]) || "(missing)"}`);
      console.log(`Phone present: ${getValue(item.row, ["Phone", "Best Phone"]) ? "yes" : "no"}`);
      console.log(`Email present: ${isValidEmail(getValue(item.row, ["Email"])) ? "yes" : "no"}`);
    } else {
      console.log(`Contact: ${getValue(item.row, ["Phone"])} ${getValue(item.row, ["Email"])}`.trim());
    }
    console.log(`Address: ${getValue(item.row, ["Address"])}`);
    console.log(`Website: ${item.verification?.status || getValue(item.row, ["Website Status"])}`);
    console.log(`Source: ${getValue(item.row, ["Source URL"])}${leadQualityOnly ? ` · sourceVerified: ${item.verification?.sourceVerified === true ? "yes" : "no"} · sourceStatus: ${item.verification?.sourceStatus || "unknown"}` : ""}`);
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

  if (!leadQualityOnly && fixture?.expectations) {
    const expectationFailures = [];
    const acceptedNames = new Set(accepted.map(item => companyName(item.row)));
    const rejectedByName = new Map(rejected.map(item => [companyName(item.row), item.failures]));
    (fixture.expectations.accepted || []).forEach(name => {
      if (!acceptedNames.has(name)) expectationFailures.push(`Expected accepted row missing: ${name}`);
    });
    Object.entries(fixture.expectations.rejected || {}).forEach(([name, expectedReasons]) => {
      const failures = rejectedByName.get(name);
      if (!failures) {
        expectationFailures.push(`Expected rejected row missing: ${name}`);
        return;
      }
      expectedReasons.forEach(expectedReason => {
        if (!failures.some(failure => failure.includes(expectedReason))) {
          expectationFailures.push(`Expected rejection reason missing for ${name}: ${expectedReason}`);
        }
      });
    });
    if (expectationFailures.length) {
      console.log("\nFixture expectation failures:");
      expectationFailures.forEach(failure => console.log(`- ${failure}`));
      process.exitCode = 1;
    }
  }

  if (!leadQualityOnly && accepted.length < minAccepted) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(`Harness failed: ${error.message}`);
  process.exit(1);
});
