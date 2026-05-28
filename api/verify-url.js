const GENERIC_PROOF_DOMAINS = ["zoominfo", "apollo", "dnb", "crunchbase", "yelp", "zippia", "signalhire", "rocketreach", "adapt", "lusha", "seamless", "zillow", "realtor", "expertise"];

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function getHostname(value) {
  try {
    return new URL(normalizeUrl(value)).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isGenericProofDomain(value) {
  const host = getHostname(value);
  return GENERIC_PROOF_DOMAINS.some(domain => new RegExp(`(^|\\.)${domain}\\.com$`, "i").test(host));
}

function verifyLinkedInUrl(url) {
  let parsed;
  try {
    parsed = new URL(normalizeUrl(url));
  } catch {
    return { ok: false, status: 0, finalUrl: url || "", reason: "invalid_url" };
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "linkedin.com" && host !== "www.linkedin.com") return null;

  const path = parsed.pathname.replace(/\/+$/, "");
  const validPatterns = [
    /^\/posts\/[^/]+_[A-Za-z0-9-]+$/i,
    /^\/pulse\/[^/]+$/i,
    /^\/in\/[^/]+$/i,
    /^\/company\/[^/]+\/posts$/i,
    /^\/company\/[^/]+\/about$/i,
  ];

  if (!validPatterns.some(pattern => pattern.test(path))) {
    return {
      ok: false,
      status: 0,
      finalUrl: parsed.toString(),
      reason: "linkedin-invalid-structure",
    };
  }

  return {
    ok: true,
    status: 200,
    finalUrl: parsed.toString(),
    verified: "linkedin-structural",
  };
}

async function requestUrl(url, method) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "LeadGenVerifyUrl/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const url = normalizeUrl(req.body?.url);
  if (!url) return res.status(400).json({ ok: false, status: 0, finalUrl: "", reason: "url_required" });

  const linkedInResult = verifyLinkedInUrl(url);
  if (linkedInResult) return res.status(200).json(linkedInResult);

  if (isGenericProofDomain(url)) {
    return res.status(200).json({ ok: false, status: 0, finalUrl: url, reason: "generic_proof_domain" });
  }

  try {
    let response = await requestUrl(url, "HEAD");
    if (!response.ok || response.status === 405 || response.status === 403) {
      response = await requestUrl(url, "GET");
    }

    const finalUrl = response.url || url;
    if (isGenericProofDomain(finalUrl)) {
      return res.status(200).json({
        ok: false,
        status: response.status,
        finalUrl,
        reason: "redirected_to_generic_proof_domain",
      });
    }

    return res.status(200).json({
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      finalUrl,
      verified: response.status >= 200 && response.status < 300 ? "http" : "",
      ...((response.status >= 200 && response.status < 300) ? {} : { reason: "http_status_failed" }),
    });
  } catch (error) {
    return res.status(200).json({
      ok: false,
      status: 0,
      finalUrl: url,
      reason: error?.name === "AbortError" ? "timeout" : error?.message || "fetch_failed",
    });
  }
}
