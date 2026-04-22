export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const body = req.body || {};
    const tools = Array.isArray(body.tools) ? body.tools : [];

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };

    // web_search_20250305 requires the web-search beta header; without it Anthropic
    // rejects the tool and searches return no results.
    if (tools.some(t => t.type && t.type.startsWith('web_search'))) {
      headers['anthropic-beta'] = 'web-search-2025-03-05';
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    // Read the response as text first so we can safely handle non-JSON bodies
    // (e.g. Anthropic maintenance pages, CDN errors) without crashing.
    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      return res.status(502).json({
        error: {
          type: 'upstream_parse_error',
          message: `Anthropic API returned a non-JSON response (HTTP ${response.status}). Please try again.`,
        },
      });
    }

    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({
      error: {
        type: 'fetch_error',
        message: error?.message || 'Failed to reach Anthropic API. Please try again.',
      },
    });
  }
}
