function splitFullName(fullName) {
  const cleaned = String(fullName || "")
    .trim()
    .replace(/^(mr|mrs|ms|miss|dr|prof)\.?\s+/i, "")
    .replace(/\s+/g, " ");
  if (!cleaned) return { firstName: "", lastName: "", fullName: "" };
  const parts = cleaned.split(" ");
  return {
    firstName: parts[0] || "",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : "",
    fullName: cleaned,
  };
}

function normalizeDomain(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const hostname = new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "");
    return hostname;
  } catch {
    return raw.toLowerCase().replace(/^https?:\/\//i, "").replace(/^www\./, "").split("/")[0];
  }
}

function mapHunterConfidence(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return "";
  if (numeric >= 85) return "HIGH";
  if (numeric >= 60) return "MEDIUM";
  return "LOW";
}

function mapVerificationStatus(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "valid") return true;
  if (normalized === "accept_all") return true;
  return false;
}

async function lookupWithHunter(entry, apiKey) {
  const { firstName, lastName, fullName } = splitFullName(entry?.name);
  const domain = normalizeDomain(entry?.domain);
  const company = String(entry?.company || "").trim();

  if ((!firstName && !fullName) || (!domain && !company)) {
    return {
      email: "",
      verified: false,
      error: "missing_lookup_fields",
      reason: "A contact name and domain or company are required for Hunter email lookup.",
    };
  }

  const params = new URLSearchParams({ api_key: apiKey });
  if (domain) params.set("domain", domain);
  if (!domain && company) params.set("company", company);
  if (firstName && lastName) {
    params.set("first_name", firstName);
    params.set("last_name", lastName);
  } else {
    params.set("full_name", fullName || firstName);
  }

  const response = await fetch(`https://api.hunter.io/v2/email-finder?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const rawText = await response.text();
  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return {
      email: "",
      verified: false,
      error: "upstream_parse_error",
      reason: `Hunter returned a non-JSON response (HTTP ${response.status})`,
      httpStatus: response.status,
    };
  }

  if (!response.ok) {
    return {
      email: "",
      verified: false,
      error: payload?.errors?.[0]?.id || payload?.errors?.[0]?.code || "lookup_failed",
      reason: payload?.errors?.[0]?.details || payload?.errors?.[0]?.message || `Hunter lookup failed (HTTP ${response.status})`,
      httpStatus: response.status,
      raw: payload,
    };
  }

  const data = payload?.data || {};
  const email = String(data?.email || "").trim();
  const verificationStatus = String(data?.verification?.status || "").toLowerCase();
  const score = Number(data?.score);
  const verified = Boolean(email) && mapVerificationStatus(verificationStatus);

  return {
    email,
    verified,
    status: verificationStatus || null,
    confidence: mapHunterConfidence(score),
    score: Number.isFinite(score) ? score : null,
    domain: data?.domain || domain || null,
    sourceUrl: Array.isArray(data?.sources) && data.sources[0]?.uri ? data.sources[0].uri : null,
    company: data?.company || company || null,
    raw: payload,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Hunter is not configured. Set HUNTER_API_KEY." });
  }

  const body = req.body || {};
  const leads = Array.isArray(body.leads) ? body.leads : [];
  if (leads.length === 0) {
    return res.status(400).json({ error: "leads[] is required" });
  }

  try {
    const results = [];
    for (const lead of leads) {
      results.push(await lookupWithHunter(lead || {}, apiKey));
    }
    return res.status(200).json({ results });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Failed to reach Hunter." });
  }
}
