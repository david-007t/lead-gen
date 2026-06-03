export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (process.env.ANTHROPIC_DISABLED === '1') {
    return res.status(423).json({
      error: {
        type: 'anthropic_disabled',
        message: 'Anthropic API calls are disabled by ANTHROPIC_DISABLED=1.',
      },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const body = req.body || {};
    const tools = Array.isArray(body.tools) ? body.tools : [];
    const model = String(body.model || '');

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    let response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

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

    const usage = data?.usage || {};
    const inputTokens = Number(usage.input_tokens || 0);
    const outputTokens = Number(usage.output_tokens || 0);
    const webSearchRequests = Number(
      usage?.server_tool_use?.web_search_requests ||
      usage?.server_tool_use?.web_search_request_count ||
      0
    );
    const pricing = /sonnet-4/i.test(model)
      ? { inputPerMillion: 3, outputPerMillion: 15, webSearchEach: 0.01 }
      : { inputPerMillion: 0, outputPerMillion: 0, webSearchEach: 0.01 };
    const estimatedCostUsd =
      (inputTokens / 1_000_000) * pricing.inputPerMillion +
      (outputTokens / 1_000_000) * pricing.outputPerMillion +
      webSearchRequests * pricing.webSearchEach;
    if (Number.isFinite(estimatedCostUsd) && estimatedCostUsd > 0) {
      res.setHeader('x-anthropic-estimated-cost-usd', estimatedCostUsd.toFixed(6));
      res.setHeader('x-anthropic-input-tokens', String(inputTokens));
      res.setHeader('x-anthropic-output-tokens', String(outputTokens));
      res.setHeader('x-anthropic-web-search-requests', String(webSearchRequests));
      console.log('[anthropic-cost]', JSON.stringify({
        model,
        inputTokens,
        outputTokens,
        webSearchRequests,
        estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
      }));
    }

    return res.status(response.status).json(data);
  } catch (error) {
    if (error?.name === 'AbortError') {
      return res.status(504).json({
        error: {
          type: 'upstream_timeout',
          message: 'Anthropic web search took too long. Try a smaller geography, fewer rows, or run the search again.',
        },
      });
    }

    return res.status(500).json({
      error: {
        type: 'fetch_error',
        message: error?.message || 'Failed to reach Anthropic API. Please try again.',
      },
    });
  }
}
