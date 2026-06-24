function stripTags(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeDuckUrl(value = "") {
  try {
    const url = new URL(value, "https://duckduckgo.com");
    const uddg = url.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : url.href;
  } catch {
    return value;
  }
}

function extractDuckResults(html = "") {
  const results = [];
  const blockRe = /<div[^>]+class="[^"]*result[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi;
  const blocks = html.match(blockRe) || [];
  for (const block of blocks) {
    const linkMatch = block.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;
    const url = decodeDuckUrl(linkMatch[1]);
    const title = stripTags(linkMatch[2]);
    const snippetMatch = block.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[\s\S]*?>([\s\S]*?)<\/a>/i) ||
      block.match(/<div[^>]+class="[^"]*result__snippet[^"]*"[\s\S]*?>([\s\S]*?)<\/div>/i);
    const snippet = stripTags(snippetMatch?.[1] || "");
    if (/^https?:\/\//i.test(url) && title) results.push({ title, url, snippet });
  }
  return results;
}

function extractName(title = "") {
  return title
    .replace(/\s*[-|].*$/g, "")
    .replace(/\b(Realtor|Real Estate Agent|Loan Officer|Mortgage Broker|Broker Associate)\b.*$/i, "")
    .trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { region = "Los Angeles, CA", niche = "real estate agents", focus = "production", count = 5 } = req.body || {};
  const focusText = {
    production: "recent listing closing",
    subprime: "first time buyer FHA VA",
    referral: "preferred partner referral",
    growth: "joined brokerage launched team",
  }[focus] || "recent listing";
  const query = `${niche} ${region} ${focusText}`;
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 LeadQualifierDemo/1.0",
        "accept": "text/html",
      },
      signal: controller.signal,
    });
    const html = await response.text();
    const raw = extractDuckResults(html);
    const seen = new Set();
    const rows = raw
      .filter(item => !/zillow|realtor\.com|yelp|facebook|instagram|linkedin|zoominfo|apollo|rocketreach/i.test(item.url))
      .map(item => {
        const name = extractName(item.title);
        const key = `${name}|${item.url}`.toLowerCase();
        if (!name || seen.has(key)) return null;
        seen.add(key);
        const isMortgage = /mortgage|loan/i.test(`${niche} ${item.title} ${item.snippet}`);
        return {
          companyName: name,
          decisionMaker: isMortgage ? `${name.split(/\s+/).slice(0, 2).join(" ")}, Loan Officer` : `${name.split(/\s+/).slice(0, 2).join(" ")}, Real Estate Agent`,
          region,
          industry: isMortgage ? "Mortgage" : "Real Estate",
          companyType: "Small firm",
          signal: item.snippet || `Public search result for ${name} in ${region}.`,
          proofUrl: item.url,
          sourceUrl: item.url,
        };
      })
      .filter(Boolean)
      .slice(0, Math.min(10, Math.max(1, Number(count) || 5)));
    return res.status(200).json({ rows, query });
  } catch (error) {
    return res.status(200).json({ rows: [], query, error: error?.message || "lite search failed" });
  } finally {
    clearTimeout(timeout);
  }
}
