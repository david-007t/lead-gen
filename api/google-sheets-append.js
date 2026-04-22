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
  const defaultSpreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!clientEmail || !privateKey || !defaultSpreadsheetId) {
    return res.status(503).json({
      error: 'Google Sheets append is not configured. Set GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, and GOOGLE_SHEETS_SPREADSHEET_ID in Vercel.',
    });
  }

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
    const token = await getAccessToken(clientEmail, privateKey);
    const targetSpreadsheetId = spreadsheetId || defaultSpreadsheetId;
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

    return res.status(200).json({
      success: true,
      updatedRows: data?.updates?.updatedRows,
      updatedRange: data?.updates?.updatedRange,
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Google Sheets append failed' });
  }
}
