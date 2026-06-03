import { promises as dns } from "dns";

const PARKED_PATTERNS = [
  /domain is for sale/i,
  /buy this domain/i,
  /this domain may be for sale/i,
  /parkingcrew/i,
  /sedo\.com/i,
  /afternic/i,
  /namecheap parking/i,
  /godaddy\.com\/forsale/i,
];

const PLACEHOLDER_PATTERNS = [
  /coming soon/i,
  /under construction/i,
];

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const NON_STANDALONE_DOMAINS = [
  "facebook.com",
  "instagram.com",
  "yelp.com",
  "google.com",
  "g.page",
  "business.site",
  "square.site",
  "vagaro.com",
  "booksy.com",
  "schedulicity.com",
  "glossgenius.com",
  "acuityscheduling.com",
  "calendly.com",
  "linktr.ee",
  "beacons.ai",
];

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function isValidEmailSyntax(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  if (/\b(example|test|fake|dummy|placeholder)\b/.test(email)) return false;
  const domain = email.split("@")[1] || "";
  if (/(^|\.)example\.(com|org|net)$|(^|\.)test$|(^|\.)invalid$/.test(domain)) return false;
  return true;
}

async function verifyEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email) return { emailVerified: false, emailStatus: "missing", email };
  if (!isValidEmailSyntax(email)) return { emailVerified: false, emailStatus: "invalid_syntax", email };
  const domain = email.split("@")[1];
  try {
    const mx = await dns.resolveMx(domain);
    if (Array.isArray(mx) && mx.length > 0) return { emailVerified: true, emailStatus: "mx", email };
  } catch {}
  try {
    const addrs = await dns.resolve4(domain);
    if (Array.isArray(addrs) && addrs.length > 0) return { emailVerified: true, emailStatus: "a_record", email };
  } catch {}
  return { emailVerified: false, emailStatus: "no_dns", email };
}

function hostnameFromUrl(value) {
  const url = normalizeUrl(value);
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isGenericSourceUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return true;
  try {
    const parsed = new URL(normalizeUrl(raw));
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

function isNonStandaloneUrl(value) {
  const host = hostnameFromUrl(value);
  return NON_STANDALONE_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`));
}

function nonStandaloneStatus(value) {
  const host = hostnameFromUrl(value);
  if (/facebook|instagram/i.test(host)) return "Social-only presence";
  if (/yelp|google|g\.page|business\.site/i.test(host)) return "Directory-only presence";
  return "Booking/profile-only presence";
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
    .map(token => token.length >= 4 && token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token)
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
      value: candidate.value,
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
  if (PARKED_PATTERNS.some(pattern => pattern.test(text) || pattern.test(finalUrl))) return true;
  const thinPage = visibleTextLength(html) < 800;
  const hasPlaceholder = PLACEHOLDER_PATTERNS.some(pattern => pattern.test(text));
  return thinPage && hasPlaceholder && /domain|website|site|launch|template|placeholder/i.test(text);
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

const GENERIC_MATCH_TOKENS = new Set([
  "mobile", "auto", "detail", "detailing", "car", "wash", "ceramic", "paint", "coating",
  "salon", "nail", "spa", "hvac", "plumbing", "roofing", "services", "service",
  "contractor", "contractors", "repair", "cleaning", "near", "best", "local",
  "az", "ca", "tx", "fl", "ny", "phoenix", "yuma", "mesa", "glendale", "peoria",
  "los", "angeles", "houston", "dallas", "miami", "tucson", "austin",
]);

function pageMatchesBusiness(html, businessName, { phone = "", address = "" } = {}) {
  const searchableText = normalizeMatchText(`${extractTitleAndMeta(html)} ${html}`);
  const tokens = businessTokens(businessName).filter(token => token.length >= 3);
  if (tokens.length === 0) return false;
  const matchedTokens = new Set(tokens.filter(token => searchableText.includes(token)));
  const distinctiveMatches = [...matchedTokens].filter(token => !GENERIC_MATCH_TOKENS.has(token));

  const phoneDigits = String(phone || "").replace(/\D/g, "");
  const htmlDigits = String(html || "").replace(/\D/g, "");
  const phoneMatch = phoneDigits.length >= 10 && htmlDigits.includes(phoneDigits.slice(-10));

  const locality = String(address || "")
    .split(",")
    .map(part => normalizeMatchText(part).trim())
    .filter(part => part.length >= 3 && !/^\d/.test(part))
    .slice(0, 2);
  const localityMatch = locality.some(part => part && searchableText.includes(part));

  if (matchedTokens.size >= Math.min(2, tokens.length) && distinctiveMatches.length >= 1) return true;
  if (matchedTokens.size >= 1 && (phoneMatch || localityMatch)) return true;
  return false;
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/gi, " ");
}

function extractContactInfo(html) {
  const raw = decodeHtmlEntities(String(html || ""));
  const phones = [...raw.matchAll(/(?:tel:|\b)(\+?1?[\s.-]?\(?[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4})\b/g)]
    .map(match => match[1].replace(/^1(?=\D?\d{3})/, "").trim())
    .map(phone => {
      const digits = phone.replace(/\D/g, "");
      const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
      return national.length === 10 ? `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}` : phone;
    })
    .filter(phone => !/55501\d{2}|555\d{4}/.test(phone.replace(/\D/g, "").slice(-7)));
  const emails = [...raw.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)]
    .map(match => match[0].toLowerCase())
    .filter(email => isValidEmailSyntax(email));

  return {
    phones: [...new Set(phones)].slice(0, 3),
    emails: [...new Set(emails)].slice(0, 3),
  };
}

function getFetchVariants(rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (!url) return [];
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return [url];
  }
  const variants = [parsed.toString()];
  const host = parsed.hostname;
  if (host.startsWith("www.")) {
    const clone = new URL(parsed.toString());
    clone.hostname = host.replace(/^www\./, "");
    variants.push(clone.toString());
  } else {
    const clone = new URL(parsed.toString());
    clone.hostname = `www.${host}`;
    variants.push(clone.toString());
  }
  if (parsed.protocol === "http:") {
    const clone = new URL(parsed.toString());
    clone.protocol = "https:";
    variants.push(clone.toString());
  }
  return [...new Set(variants)];
}

function unverifiedReason(check) {
  if (!check) return "";
  if (["timeout", "tls_error", "bot_blocked"].includes(check.errorKind)) return check.errorKind;
  if ([403, 429, 503].includes(Number(check.status))) return "bot_or_rate_limited";
  return "";
}

async function fetchOnce(url, businessName, context = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: BROWSER_HEADERS,
    });
    const html = await response.text().catch(() => "");
    const contentLength = html.length;
    const parked = response.ok && pageLooksParked(html, response.url);
    const matchesBusiness = response.ok && pageMatchesBusiness(html, businessName, context);
    const hasRealContent = response.ok && contentLength > 500 && !parked && matchesBusiness;
    const contact = response.ok && matchesBusiness ? extractContactInfo(html) : { phones: [], emails: [] };

    return {
      normalizedUrl: url,
      finalUrl: response.url,
      reachable: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentLength,
      parked,
      matchesBusiness,
      hasRealContent,
      contactPhones: contact.phones,
      contactEmails: contact.emails,
      errorKind: [403, 429, 503].includes(response.status) ? "bot_blocked" : "",
    };
  } catch (error) {
    const code = error?.cause?.code || "";
    const message = error?.message || "";
    const errorKind = error?.name === "AbortError"
      ? "timeout"
      : /TLS|SSL|certificate|CERT|EPROTO/i.test(`${code} ${message}`)
        ? "tls_error"
        : /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET/i.test(`${code} ${message}`)
          ? "network_error"
          : "fetch_failed";
    return {
      normalizedUrl: url,
      reachable: false,
      error: errorKind,
      errorKind,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchUrl(rawUrl, businessName, context = {}) {
  const variants = getFetchVariants(rawUrl);
  if (variants.length === 0) return { url: rawUrl || "", normalizedUrl: "", reachable: false, error: "missing_url", errorKind: "missing_url", attempts: [] };

  const attempts = [];
  for (const variant of variants) {
    const result = await fetchOnce(variant, businessName, context);
    attempts.push(result);
    if (result.hasRealContent || result.parked || result.reachable) {
      return { ...result, url: rawUrl, attempts };
    }
  }

  return { ...(attempts[0] || {}), url: rawUrl, attempts };
}

async function verifySourceUrl(sourceUrl, businessName, context = {}) {
  if (!sourceUrl) return { sourceVerified: false, sourceStatus: "unreachable", sourceUrl: "", sourceProof: "No source URL provided." };
  if (isGenericSourceUrl(sourceUrl)) {
    return {
      sourceVerified: false,
      sourceStatus: "generic_search",
      sourceUrl: normalizeUrl(sourceUrl),
      sourceProof: "Source URL is a generic search page, not a business-specific proof page.",
    };
  }

  const check = await fetchUrl(sourceUrl, businessName, context);
  const sourceVerified = Boolean(check.reachable && check.matchesBusiness);
  return {
    sourceVerified,
    sourceStatus: sourceVerified ? "reachable" : "unreachable",
    sourceUrl: check.finalUrl || check.normalizedUrl || normalizeUrl(sourceUrl),
    sourcePhone: sourceVerified ? check.contactPhones?.[0] || "" : "",
    sourceEmail: sourceVerified ? check.contactEmails?.[0] || "" : "",
    sourceProof: sourceVerified
      ? `Verified business-specific source at ${check.finalUrl || check.normalizedUrl}.`
      : `Could not verify source page as business-specific (${check.error || `HTTP ${check.status || "unknown"}`}).`,
    sourceCheck: check,
  };
}

async function verifyLead(lead) {
  const businessName = String(lead?.businessName || lead?.["Company Name"] || "").trim();
  const context = {
    phone: lead?.phone || lead?.Phone || lead?.["Best Phone"] || "",
    address: lead?.address || lead?.Address || lead?.region || lead?.Region || "",
  };
  const emailResult = await verifyEmail(lead?.email || lead?.Email || "");
  const sourceUrl = lead?.sourceUrl || lead?.["Source URL"] || lead?.source || lead?.Source || "";
  const sourceResult = await verifySourceUrl(sourceUrl, businessName, context);
  const providedCandidates = [
    lead?.websiteUrl,
    lead?.["Website URL"],
    lead?.website,
    lead?.Website,
  ].filter(Boolean);
  const domains = candidateDomains(businessName, providedCandidates);

  const nonStandaloneProvided = providedCandidates.find(isNonStandaloneUrl);
  if (nonStandaloneProvided) {
    return {
      ...emailResult,
      ...sourceResult,
      businessName,
      status: nonStandaloneStatus(nonStandaloneProvided),
      keep: true,
      websiteUrl: normalizeUrl(nonStandaloneProvided),
      checked: [],
      proof: `Only non-standalone web presence found at ${normalizeUrl(nonStandaloneProvided)}.`,
    };
  }

  if (domains.length === 0) {
    return {
      ...emailResult,
      ...sourceResult,
      businessName,
      status: "No website found",
      keep: true,
      checked: [],
      proof: "No candidate domains could be generated from the business name.",
    };
  }

  const checks = await Promise.all(domains.map(async candidate => {
    if (candidate.source === "provided" && isNonStandaloneUrl(candidate.value || candidate.domain)) {
      return {
        url: candidate.value || candidate.domain,
        normalizedUrl: normalizeUrl(candidate.value || candidate.domain),
        finalUrl: normalizeUrl(candidate.value || candidate.domain),
        reachable: true,
        status: 200,
        parked: false,
        matchesBusiness: true,
        hasRealContent: false,
        candidateSource: candidate.source,
        nonStandalone: true,
      };
    }
    const check = await fetchUrl(candidate.domain, businessName, context);
    return { ...check, candidateSource: candidate.source };
  }));
  const working = checks.find(check => check.hasRealContent);
  if (working) {
    return {
      ...emailResult,
      ...sourceResult,
      businessName,
      status: "Has working website",
      keep: false,
      websiteUrl: working.finalUrl || working.normalizedUrl,
      checked: checks,
      proof: `Verified working website at ${working.finalUrl || working.normalizedUrl}.`,
    };
  }

  const parked = checks.find(check => check.candidateSource === "provided" && check.parked);
  if (parked) {
    return {
      ...emailResult,
      ...sourceResult,
      businessName,
      status: "Parked domain",
      keep: true,
      websiteUrl: parked.finalUrl || parked.normalizedUrl,
      checked: checks,
      proof: `Verified parked/placeholder domain at ${parked.finalUrl || parked.normalizedUrl}.`,
    };
  }

  const unverified = checks.find(check => unverifiedReason(check));
  if (unverified) {
    return {
      ...emailResult,
      ...sourceResult,
      businessName,
      status: "Unverified — could not confirm",
      keep: false,
      websiteUrl: unverified.finalUrl || unverified.normalizedUrl,
      checked: checks,
      proof: `Could not safely verify website status (${unverifiedReason(unverified)}).`,
    };
  }

  const reachableNonMatch = checks.find(check => check.reachable && !check.matchesBusiness);
  if (reachableNonMatch) {
    return {
      ...emailResult,
      ...sourceResult,
      businessName,
      status: "Unverified — could not confirm",
      keep: false,
      websiteUrl: reachableNonMatch.finalUrl || reachableNonMatch.normalizedUrl,
      checked: checks,
      proof: "Candidate domain responded, but page content did not match the business name.",
    };
  }

  const failed = checks.find(check => check.candidateSource === "provided" && !check.reachable);
  if (failed) {
    if (["timeout", "tls_error", "bot_blocked"].includes(failed.errorKind)) {
      return {
        ...emailResult,
        ...sourceResult,
        businessName,
        status: "Unverified — could not confirm",
        keep: false,
        websiteUrl: failed.normalizedUrl,
        checked: checks,
        proof: `Could not safely verify provided website (${failed.error || "unknown"}).`,
      };
    }
    return {
      ...emailResult,
      ...sourceResult,
      businessName,
      status: "Broken website",
      keep: true,
      websiteUrl: failed.normalizedUrl,
      checked: checks,
      proof: `Candidate domain failed website check (${failed.error || `HTTP ${failed.status || "unknown"}`}).`,
    };
  }

  return {
    ...emailResult,
    ...sourceResult,
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
