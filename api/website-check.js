const PARKED_PATTERNS = [
  /domain is for sale/i,
  /buy this domain/i,
  /this domain may be for sale/i,
  /parkingcrew/i,
  /sedo\.com/i,
  /afternic/i,
  /namecheap parking/i,
  /godaddy\.com\/forsale/i,
  /coming soon/i,
  /under construction/i,
];

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function hostnameFromUrl(value) {
  const url = normalizeUrl(value);
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeMatchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ");
}

function businessTokens(name) {
  return normalizeMatchText(name)
    .replace(/\b(inc|llc|ltd|co|company|corp|corporation|the)\b/g, " ")
    .split(/\s+/)
    .map(token => token.trim())
    .map(token => token.length >= 4 && token.endsWith("s") ? token.slice(0, -1) : token)
    .filter(token => token.length >= 2);
}

function candidateDomains(name, provided = []) {
  const tokens = businessTokens(name).slice(0, 4);
  const compact = tokens.join("");
  const dashed = tokens.join("-");
  const candidates = [
    ...provided.map(value => ({ value, source: "provided" })),
    compact && { value: `${compact}.com`, source: "guessed" },
    dashed && { value: `${dashed}.com`, source: "guessed" },
    compact && { value: `${compact}.net`, source: "guessed" },
    compact && { value: `${compact}.co`, source: "guessed" },
    compact && { value: `${compact}services.com`, source: "guessed" },
    compact && { value: `${compact}service.com`, source: "guessed" },
  ].filter(Boolean);

  const seen = new Set();
  return candidates
    .map(candidate => ({
      domain: hostnameFromUrl(candidate.value) || String(candidate.value).toLowerCase().replace(/^www\./, ""),
      source: candidate.source,
    }))
    .filter(candidate => {
      if (!candidate.domain || seen.has(candidate.domain)) return false;
      seen.add(candidate.domain);
      return true;
    })
    .slice(0, 8);
}

function pageLooksParked(html, finalUrl = "") {
  const text = String(html || "").slice(0, 5000);
  return PARKED_PATTERNS.some(pattern => pattern.test(text) || pattern.test(finalUrl));
}

function extractTitleAndMeta(html) {
  const raw = String(html || "");
  const title = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  const metaDescriptions = [...raw.matchAll(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']*)["'][^>]*>/gi)]
    .map(match => match[1])
    .join(" ");
  return `${title} ${metaDescriptions}`;
}

function visibleTextLength(html) {
  return normalizeMatchText(String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " "))
    .trim()
    .length;
}

function pageMatchesBusiness(html, businessName) {
  const searchableText = normalizeMatchText(`${extractTitleAndMeta(html)} ${html}`);
  const tokens = businessTokens(businessName).filter(token => token.length >= 3);
  if (tokens.length === 0) return false;
  const sparsePage = visibleTextLength(html) < 1500;
  const needed = Math.min(sparsePage ? 1 : 2, tokens.length);
  return tokens.filter(token => searchableText.includes(token)).length >= needed;
}

async function fetchUrl(rawUrl, businessName) {
  const url = normalizeUrl(rawUrl);
  if (!url) return { url: rawUrl || "", normalizedUrl: "", reachable: false, error: "missing_url" };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "LeadGenWebsiteCheck/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const html = await response.text().catch(() => "");
    const contentLength = html.length;
    const parked = response.ok && pageLooksParked(html, response.url);
    const matchesBusiness = response.ok && pageMatchesBusiness(html, businessName);
    const hasRealContent = response.ok && contentLength > 500 && !parked && matchesBusiness;

    return {
      url: rawUrl,
      normalizedUrl: url,
      finalUrl: response.url,
      reachable: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentLength,
      parked,
      matchesBusiness,
      hasRealContent,
    };
  } catch (error) {
    return {
      url: rawUrl,
      normalizedUrl: url,
      reachable: false,
      error: error?.name === "AbortError" ? "timeout" : error?.message || "fetch_failed",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function verifyLead(lead) {
  const businessName = String(lead?.businessName || lead?.["Company Name"] || "").trim();
  const providedCandidates = [
    lead?.websiteUrl,
    lead?.["Website URL"],
    lead?.website,
    lead?.Website,
  ].filter(Boolean);
  const domains = candidateDomains(businessName, providedCandidates);

  if (domains.length === 0) {
    return {
      businessName,
      status: "No website found",
      keep: true,
      checked: [],
      proof: "No candidate domains could be generated from the business name.",
    };
  }

  const checks = await Promise.all(domains.map(async candidate => {
    const check = await fetchUrl(candidate.domain, businessName);
    return { ...check, candidateSource: candidate.source };
  }));
  const working = checks.find(check => check.hasRealContent);
  if (working) {
    return {
      businessName,
      status: "Has working website",
      keep: false,
      websiteUrl: working.finalUrl || working.normalizedUrl,
      checked: checks,
      proof: `Verified working website at ${working.finalUrl || working.normalizedUrl}.`,
    };
  }

  const parked = checks.find(check => check.parked);
  if (parked) {
    return {
      businessName,
      status: "Parked domain",
      keep: true,
      websiteUrl: parked.finalUrl || parked.normalizedUrl,
      checked: checks,
      proof: `Verified parked/placeholder domain at ${parked.finalUrl || parked.normalizedUrl}.`,
    };
  }

  const reachableNonMatch = checks.find(check => check.reachable && !check.matchesBusiness);
  if (reachableNonMatch) {
    return {
      businessName,
      status: "No verified website found",
      keep: true,
      websiteUrl: "",
      checked: checks,
      proof: "Candidate domain responded, but page content did not match the business name.",
    };
  }

  const failed = checks.find(check => check.candidateSource === "provided" && !check.reachable);
  if (failed) {
    return {
      businessName,
      status: "Broken website",
      keep: true,
      websiteUrl: failed.normalizedUrl,
      checked: checks,
      proof: `Candidate domain failed website check (${failed.error || `HTTP ${failed.status || "unknown"}`}).`,
    };
  }

  return {
    businessName,
    status: "No website found",
    keep: true,
    checked: checks,
    proof: "No working website found among candidate domains.",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const leads = Array.isArray(req.body?.leads) ? req.body.leads.slice(0, 10) : [];
  const urls = Array.isArray(req.body?.urls) ? req.body.urls.slice(0, 10) : [];

  if (leads.length > 0) {
    const results = await Promise.all(leads.map(verifyLead));
    return res.status(200).json({ results });
  }

  if (urls.length > 0) {
    const results = await Promise.all(urls.map(url => fetchUrl(url, "")));
    return res.status(200).json({ results });
  }

  return res.status(400).json({ error: "leads[] or urls[] is required" });
}
