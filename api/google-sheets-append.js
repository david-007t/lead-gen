import crypto from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function getPrivateKey() {
  return (process.env.GOOGLE_SHEETS_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || '')
    .replace(/\\n/g, '\n');
}

async function getAccessToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  }));
  const unsigned = `${header}.${claims}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsigned)
    .sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Google auth failed');
  }
  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const webhookToken = process.env.GOOGLE_SHEETS_WEBHOOK_TOKEN;
  const defaultSpreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  const { columns, rows, spreadsheetId, sheetName = 'Lead Request Results', range } = req.body || {};
  if (!Array.isArray(columns) || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'Missing columns or rows' });
  }

  const values = [
    columns.map(value => String(value ?? '')),
    ...rows.map(row => Array.isArray(row)
      ? row.map(value => String(value ?? ''))
      : columns.map(column => String(row?.[column] ?? ''))),
  ];

  try {
    if (webhookUrl) {
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          token: webhookToken || '',
          sheetName,
          columns,
          rows,
          values,
        }),
      });
      const rawText = await webhookResponse.text();
      let data = {};
      let webhookParsed = false;
      try { data = JSON.parse(rawText); webhookParsed = true; } catch {}

      // Surface real errors: HTTP failure, JSON parse failure, or explicit error field
      if (!webhookResponse.ok) {
        return res.status(webhookResponse.status || 502).json({
          error: (webhookParsed && data.error) || `Webhook HTTP ${webhookResponse.status}: ${rawText.slice(0, 300)}`,
        });
      }
      if (!webhookParsed) {
        // GAS returned HTTP 200 but non-JSON — usually means it threw internally
        return res.status(502).json({
          error: `Webhook returned non-JSON response (sheet tab may not exist or GAS script error): ${rawText.slice(0, 300)}`,
        });
      }
      if (data.error) {
        return res.status(502).json({ error: data.error });
      }
      console.log('google-sheets-append webhook success', {
        sheetName,
        rowCount: rows.length,
        columnCount: columns.length,
        updatedRows: data.updatedRows || values.length,
        updatedRange: data.updatedRange || '',
      });
      return res.status(200).json({
        success: true,
        updatedRows: data.updatedRows || values.length,
        updatedRange: data.updatedRange || '',
        sheetName,
        rowCount: rows.length,
      });
    }

    if (!clientEmail || !privateKey || !defaultSpreadsheetId) {
      return res.status(503).json({
        error: 'Google Sheets append is not configured. Set GOOGLE_SHEETS_WEBHOOK_URL in Vercel, or set GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, and GOOGLE_SHEETS_SPREADSHEET_ID.',
      });
    }

    const token = await getAccessToken(clientEmail, privateKey);
    const targetSpreadsheetId = spreadsheetId || defaultSpreadsheetId;

    // Auto-create the sheet tab if it doesn't exist
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(targetSpreadsheetId)}?fields=sheets.properties.title`;
    const metaResponse = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (metaResponse.ok) {
      const meta = await metaResponse.json();
      const tabExists = (meta.sheets || []).some(s => s.properties?.title === sheetName);
      if (!tabExists) {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(targetSpreadsheetId)}:batchUpdate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] }),
        });
      }
    }

    const appendRange = range || `${sheetName}!A1`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(targetSpreadsheetId)}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const appendResponse = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    });

    const data = await appendResponse.json();
    if (!appendResponse.ok) {
      return res.status(appendResponse.status).json({
        error: data?.error?.message || 'Google Sheets append failed',
      });
    }

    console.log('google-sheets-append api success', {
      sheetName,
      rowCount: rows.length,
      columnCount: columns.length,
      updatedRows: data?.updates?.updatedRows,
      updatedRange: data?.updates?.updatedRange,
    });
    return res.status(200).json({
      success: true,
      updatedRows: data?.updates?.updatedRows,
      updatedRange: data?.updates?.updatedRange,
      sheetName,
      rowCount: rows.length,
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Google Sheets append failed' });
  }
}
