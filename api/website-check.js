function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

async function checkUrl(rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (!url) return { url: rawUrl || "", normalizedUrl: "", reachable: false, error: "missing_url" };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
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
    return {
      url: rawUrl,
      normalizedUrl: url,
      finalUrl: response.url,
      reachable: response.ok,
      status: response.status,
      statusText: response.statusText,
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const urls = Array.isArray(req.body?.urls) ? req.body.urls.slice(0, 10) : [];
  if (urls.length === 0) return res.status(400).json({ error: "urls[] is required" });

  const results = await Promise.all(urls.map(checkUrl));
  return res.status(200).json({ results });
}
