const VERIFIED_LINE_TYPES = new Set([
  'landline',
  'mobile',
  'fixedvoip',
  'nonfixedvoip',
  'tollfree',
]);

function normalizePhoneInput(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  const numeric = digits.replace(/\D/g, '');
  if (!numeric) return '';
  if (numeric.length === 11 && numeric.startsWith('1')) return `+${numeric}`;
  if (numeric.length === 10) return `+1${numeric}`;
  return raw;
}

function parseLookupVerification(data) {
  const lineStatus = String(data?.line_status?.status || data?.lineStatus?.status || '').toLowerCase();
  const lineType = String(data?.line_type_intelligence?.type || data?.lineTypeIntelligence?.type || '').toLowerCase();
  const lineTypeError = data?.line_type_intelligence?.error_code ?? data?.lineTypeIntelligence?.errorCode ?? null;
  const verified = Boolean(
    data?.valid === true &&
    lineStatus === 'active' &&
    lineType &&
    VERIFIED_LINE_TYPES.has(lineType) &&
    lineTypeError == null
  );

  return {
    verified,
    valid: Boolean(data?.valid),
    lineStatus: lineStatus || null,
    lineType: lineType || null,
    phoneNumber: data?.phone_number || data?.phoneNumber || null,
    nationalFormat: data?.national_format || data?.nationalFormat || null,
    carrierName: data?.line_type_intelligence?.carrier_name || data?.lineTypeIntelligence?.carrierName || null,
    raw: data,
  };
}

async function lookupPhoneNumber({ phone, countryCode }, authHeader) {
  const normalizedPhone = normalizePhoneInput(phone);
  if (!normalizedPhone) {
    return {
      phone,
      verified: false,
      error: 'missing_phone',
      reason: 'Phone number missing or invalid',
    };
  }

  const params = new URLSearchParams({
    Fields: 'line_status,line_type_intelligence',
  });
  if (!normalizedPhone.startsWith('+') && countryCode) {
    params.set('CountryCode', String(countryCode).trim().toUpperCase());
  }

  const response = await fetch(`https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(normalizedPhone)}?${params.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
  });

  const rawText = await response.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    return {
      phone,
      normalizedPhone,
      verified: false,
      error: 'upstream_parse_error',
      reason: `Twilio returned a non-JSON response (HTTP ${response.status})`,
      httpStatus: response.status,
    };
  }

  if (!response.ok) {
    return {
      phone,
      normalizedPhone,
      verified: false,
      error: data?.code || data?.error_code || 'lookup_failed',
      reason: data?.message || `Twilio lookup failed (HTTP ${response.status})`,
      httpStatus: response.status,
      raw: data,
    };
  }

  const parsed = parseLookupVerification(data);
  return {
    phone,
    normalizedPhone,
    httpStatus: response.status,
    ...parsed,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    return res.status(500).json({ error: 'Twilio Lookup is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.' });
  }

  const body = req.body || {};
  const numbers = Array.isArray(body.numbers) ? body.numbers : [];
  if (numbers.length === 0) {
    return res.status(400).json({ error: 'numbers[] is required' });
  }

  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;

  try {
    const results = [];
    for (const entry of numbers) {
      const result = await lookupPhoneNumber(entry || {}, authHeader);
      results.push(result);
    }
    return res.status(200).json({ results });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Failed to reach Twilio Lookup.',
    });
  }
}
