#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const desiredCount = 5;
const region = "Los Angeles, CA";
const nicheText = "Mortgage brokers";
const focusText = "Subprime or distressed exposure — works with FHA, VA, first-time buyers, short sales, foreclosures, or markets known for credit-challenged buyers";

function extractJSONValue(fullText) {
  if (!fullText) return null;
  const fenced = fullText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidates = [];
  if (fenced) candidates.push(fenced[1]);
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

function columnKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getValue(row, names) {
  const wanted = names.map(columnKey);
  const key = Object.keys(row || {}).find(name => wanted.includes(columnKey(name)));
  return key ? String(row[key] || "").trim() : "";
}

function proofPath(value) {
  try {
    return new URL(value).pathname.toLowerCase();
  } catch {
    return "";
  }
}

function buildPrompt(batchCount, queryFocus, alreadyAccepted = []) {
  return `Find up to ${batchCount} REFERRAL PARTNERS for Conquer Credit Management, a consumer credit repair company in Los Angeles that helps individuals fix their personal credit so they can qualify for mortgages, auto loans, and rentals.

We are looking for PROFESSIONALS whose clients regularly get blocked by personal credit problems and who would benefit from having a trusted credit-repair partner to refer those clients to.

Region: ${region}
Niche hint: ${nicheText}
Signal focus: ${focusText}
Search this specific angle first: ${queryFocus}
${alreadyAccepted.length ? `Do not return these already accepted leads: ${alreadyAccepted.join(", ")}.` : ""}

Niche discipline:
- If the Niche hint names a specific Tier A category, return only that category.
- If the Niche hint is "Mortgage brokers" or similar, return only named mortgage brokers, loan officers, or loan originators.

Ideal prospects (Tier A — return these):
- Mortgage brokers and loan officers, especially FHA, VA, non-QM, or subprime-focused
- Real estate agents and brokers, especially those working with first-time buyers, distressed properties, short sales, or buyer-side transactions in mid-tier markets
- Used car dealers and subprime auto lenders (independent, not national franchises)
- Apartment leasing agents and property managers who run credit checks on applicants
- Divorce attorneys and bankruptcy attorneys (solo or small firm)
- Tax preparers serving working/middle-class neighborhoods (not big-firm CPAs)

Reject (Tier C — never return these):
- Big banks (Chase, BofA, Wells Fargo, Citi, US Bank, etc.)
- Credit unions with more than ~$1B in assets
- National mortgage chains and corporate franchise offices with mandatory in-house referral programs (Rocket Mortgage, Quicken, LoanDepot corporate, etc.)
- Wholesale lenders, TPO/channel lenders, correspondent lenders, and lender marketplaces
- Other credit repair companies (Lexington Law, Credit Saint, Sky Blue, etc. — direct competitors)
- Nonprofit credit counseling organizations
- Debt settlement and debt consolidation companies
- Title companies and escrow companies
- Insurance agents and brokers
- Financial advisors at high-net-worth firms (Morgan Stanley, Merrill, UBS, private wealth divisions)

Each lead must have:
1. A NAMED individual contact (broker name, agent name, attorney name) — not just "ABC Realty"
2. A public, recent (within 6 months), caller-mentionable signal showing they are actively producing or expanding
3. A proof URL that DIRECTLY shows the signal — LinkedIn post, brokerage announcement, local news article, podcast episode, deal closing announcement, recent press, recent listing
4. Proof URL must NOT be: a homepage, About page, Zillow profile, Realtor.com profile, Expertise.com, Yelp, ZoomInfo, Apollo, Crunchbase, DNB, or any directory
5. Avoid using a LinkedIn profile page as the Proof URL when the signal is from a post. Use the exact LinkedIn post URL when available.
6. Do not return generic contacts like "Loan Officer Team", "Company Representative", "Office", "Staff", or "Team". Skip the row if you cannot name a person.
6a. Do not return "Name not specified" or title-only contacts like "Senior Loan Officer" or "FHA Specialist Loan Officer".
7. For mortgage searches, an individual loan officer or broker page is acceptable only when it directly states FHA, VA, non-QM, first-time buyer, or credit-challenged borrower expertise.

Search speed rules:
- Start with targeted searches for "${nicheText}" in "${region}" plus FHA, VA, first-time buyer, non-QM, subprime, recent closing, joined brokerage, or podcast.
- For mortgage-broker searches, use source patterns like Scotsman Guide rankings, Non-QM announcements, individual FHA/VA loan officer pages, broker podcasts, local mortgage association posts, brokerage announcements, and LinkedIn posts.
- Return enough candidate rows so that at least ${desiredCount} can survive validation.
- For Los Angeles mortgage searches, broaden across LA County cities and neighborhoods: Los Angeles, Pasadena, Glendale, Burbank, Long Beach, Torrance, Sherman Oaks, Encino, Woodland Hills, Downey, Whittier, Norwalk, Pomona, and Santa Monica.
- Use high-confidence public sources only.

Source quality rules:
1. Signal must be specific enough to mention on a cold call
2. If the proof URL is older than 6 months, skip the company
3. Do not claim financial pressure or distress about the contact unless proof explicitly supports it
4. Prioritize leads with a public phone or email
5. Prefer source diversity. Do not return all proof URLs from LinkedIn. Aim for a mix of LinkedIn posts, brokerage websites, local news articles, and podcast/press appearances. If multiple leads have LinkedIn-only proofs, replace some with leads that have other source types.

Before returning JSON, self-check and replace any row that fails any of these:
- Named contact is missing, title-only, "team", "staff", or "name not specified"
- Region is not clearly Los Angeles County
- Signal says 2024 or older
- Proof URL is a homepage, About page, directory, Zillow, Realtor.com, Expertise.com, Yelp, or generic profile
- Proof URL does not directly support the Referral Signal
- Company is a wholesale lender, TPO/channel lender, lender marketplace, national chain, bank, credit union, or competitor

Return strict JSON only. No prose. No markdown.

JSON shape:
[
  {
    "Company Name": "Brokerage or firm name",
    "Decision Maker": "Named individual with title (e.g., 'Maria Gonzalez, Loan Officer')",
    "Best Phone": "",
    "Email": "",
    "Region": "City, State",
    "Industry": "One of: Mortgage, Real Estate, Auto, Property Management, Legal, Tax, Financial Advisory",
    "Company Type": "Independent / Small firm / Franchise office / Solo practitioner",
    "Referral Signal": "One caller-ready sentence naming the exact signal and date if known.",
    "Signal Proof URL": "https://...",
    "Source URL": "https://...",
    "Referral Fit": "Why this person would benefit from a credit-repair referral partner — one sentence.",
    "Pitch Angle": "\"Suggested opening line for outreach, wrapped in quote marks, that references the specific signal.\""
  }
]`;
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

function localFailures(row, verification) {
  const company = getValue(row, ["Company Name"]);
  const decisionMaker = getValue(row, ["Decision Maker"]);
  const industry = getValue(row, ["Industry"]);
  const signal = getValue(row, ["Referral Signal"]);
  const proofUrl = getValue(row, ["Signal Proof URL"]);
  const pitch = getValue(row, ["Pitch Angle"]);
  const text = `${company} ${decisionMaker} ${industry}`.toLowerCase();
  const failures = [];

  if (!/\b(mortgage|loan officer|loan originator|\blo\b)\b/i.test(text)) failures.push("not named mortgage broker/LO");
  if (/\b(company representative|loan officer team|name not specified|not specified|team|representative|staff|office|department)\b/i.test(decisionMaker) || /^(fha specialist|senior loan officer|loan officer|mortgage broker)$/i.test(decisionMaker.trim())) failures.push("generic contact, not a named individual");
  if (/\b(tpo|wholesale lender|wholesale channel|correspondent lender|lender marketplace|loan marketplace)\b/i.test(JSON.stringify(row))) failures.push("wholesale/lender channel, not a referral partner");
  if (!/los angeles|la county|beverly hills|santa monica|pasadena|glendale|burbank|long beach|sherman oaks|encino|woodland hills|torrance|inglewood|downey|compton|whittier|norwalk|el monte|pomona/i.test(JSON.stringify(row))) failures.push("not clearly LA County");
  if (/\b(chase|bank of america|bofa|wells fargo|rocket mortgage|quicken|loandepot|citi|us bank)\b/i.test(text)) failures.push("national chain / Tier C");
  if (/\b(zillow|realtor|expertise)\.com/i.test(proofUrl)) failures.push("directory proof source");
  if (/^\/?$|^\/(about|contact|locations?|services?|company|home)\/?$/i.test(proofPath(proofUrl))) failures.push("generic proof URL path");
  if (!verification?.ok) failures.push(`proof verification failed: ${verification?.reason || "unknown"}`);
  if (!signal || signal.length < 40) failures.push("signal too generic");
  if (/\b20(1\d|2[0-4])\b/.test(signal)) failures.push("signal appears older than six months");
  if (!pitch || pitch.length < 40 || !/^["“]/.test(pitch.trim())) failures.push("pitch not a quotable opening line");
  return failures;
}

async function main() {
  console.log(`Running Credit Leads harness against ${BASE_URL}`);
  const audited = [];
  const rejected = [];
  const seen = new Set();
  const searchAngles = [
    `${focusText}; named LA mortgage brokers or loan officers with FHA, VA, first-time buyer, non-QM, or subprime borrower pages`,
    "Los Angeles 2026 Scotsman Guide Non-QM mortgage broker loan officer press release named individual",
    "Los Angeles mortgage broker FHA VA first-time buyer individual loan officer page",
    "Los Angeles mortgage broker recent podcast interview FHA VA non-QM named loan officer",
    "Los Angeles loan officer joined brokerage 2026 FHA VA non-QM LinkedIn post",
    "Pasadena Glendale Burbank Long Beach mortgage broker FHA VA first-time buyer named loan officer",
    "Beverly Hills Los Angeles non-QM mortgage broker 2026 press release named individual",
    "LA County Scotsman Guide 2026 mortgage originator named loan officer non-QM FHA VA",
  ];

  for (const queryFocus of searchAngles) {
    if (audited.length >= desiredCount) break;
    const batchCount = Math.min(2, desiredCount - audited.length);
    const data = await postJSON("/api/anthropic", {
      model: "claude-sonnet-4-6",
      max_tokens: 1700,
      system: "You are a careful B2B lead researcher finding referral partners for a consumer credit repair company. Your job is to find mortgage brokers, real estate agents, and adjacent professionals whose clients have personal credit problems. Return strict JSON only. No narration, no search notes, no markdown. Accuracy beats volume.",
      messages: [{ role: "user", content: buildPrompt(batchCount, queryFocus, audited.map(item => getValue(item.row, ["Company Name"])).filter(Boolean)) }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    });

    const text = (data.content || []).filter(block => block.type === "text" && block.text).map(block => block.text).join("\n");
    const rows = extractJSONValue(text);
    if (!Array.isArray(rows)) {
      rejected.push({ row: { "Company Name": queryFocus }, verification: null, failures: ["Anthropic response did not parse to a JSON array"] });
      continue;
    }

    for (const row of rows) {
      const key = columnKey(`${getValue(row, ["Company Name"])} ${getValue(row, ["Decision Maker"])}`);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const proofUrl = getValue(row, ["Signal Proof URL"]);
      const verification = await postJSON("/api/verify-url", { url: proofUrl });
      const item = { row, verification, failures: localFailures(row, verification) };
      if (item.failures.length === 0 && audited.length < desiredCount) audited.push(item);
      else if (item.failures.length > 0) rejected.push(item);
      if (audited.length >= desiredCount) break;
    }
  }

  const linkedinOnly = audited.filter(item => /^https?:\/\/(www\.)?linkedin\.com/i.test(getValue(item.row, ["Signal Proof URL"]))).length;
  if (audited.length < desiredCount) {
    rejected.push({
      row: {},
      verification: null,
      failures: [`only returned ${audited.length}/${desiredCount} expected rows`],
    });
  }
  if (linkedinOnly > 3) {
    audited.forEach(item => item.failures.push("source mix failed: more than 3 LinkedIn-only proofs"));
  }

  console.log(JSON.stringify(audited.map(item => ({
    company: getValue(item.row, ["Company Name"]),
    decisionMaker: getValue(item.row, ["Decision Maker"]),
    region: getValue(item.row, ["Region"]),
    industry: getValue(item.row, ["Industry"]),
    referralSignal: getValue(item.row, ["Referral Signal"]),
    proofUrl: getValue(item.row, ["Signal Proof URL"]),
    verification: item.verification,
    pitchAngle: getValue(item.row, ["Pitch Angle"]),
    failures: item.failures,
  })), null, 2));

  if (audited.length < desiredCount || audited.some(item => item.failures.length > 0)) {
    console.error("Rejected rows:");
    console.error(JSON.stringify(rejected.slice(0, 8).map(item => ({
      company: getValue(item.row, ["Company Name"]),
      decisionMaker: getValue(item.row, ["Decision Maker"]),
      proofUrl: getValue(item.row, ["Signal Proof URL"]),
      failures: item.failures,
    })), null, 2));
    console.error(`Harness failed: ${audited.length}/${desiredCount} accepted rows.`);
    process.exit(1);
  }

  console.log("Harness passed.");
}

main().catch(error => {
  console.error(error?.message || error);
  process.exit(1);
});
