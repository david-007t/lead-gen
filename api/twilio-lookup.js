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

function parseTwilioVerification(data) {
  const lineStatus = String(data?.line_status?.status || data?.lineStatus?.status || '').toLowerCase();
  const lineStatusError = data?.line_status?.error_code ?? data?.lineStatus?.errorCode ?? null;
  const lineType = String(data?.line_type_intelligence?.type || data?.lineTypeIntelligence?.type || '').toLowerCase();
  const lineTypeError = data?.line_type_intelligence?.error_code ?? data?.lineTypeIntelligence?.errorCode ?? null;
  const twilioActive = data?.valid === true && lineStatus === 'active' && lineType && VERIFIED_LINE_TYPES.has(lineType) && lineTypeError == null;
  const fallbackValid = data?.valid === true && lineType && VERIFIED_LINE_TYPES.has(lineType) && lineStatusError != null && lineTypeError == null;

  return {
    verified: Boolean(twilioActive || fallbackValid),
    validationMode: twilioActive ? 'twilio_active' : fallbackValid ? 'twilio_fallback' : 'twilio_failed',
    valid: Boolean(data?.valid),
    lineStatus: lineStatus || null,
    lineType: lineType || null,
    phoneNumber: data?.phone_number || data?.phoneNumber || null,
    nationalFormat: data?.national_format || data?.nationalFormat || null,
    carrierName: data?.line_type_intelligence?.carrier_name || data?.lineTypeIntelligence?.carrierName || null,
    raw: data,
  };
}

function parseAbstractVerification(data) {
  const phoneValidation = data?.phone_validation || {};
  const lineStatus = String(phoneValidation?.line_status || '').toLowerCase();
  const lineType = String(data?.phone_carrier?.line_type || '').toLowerCase().replace(/_/g, '');
  const verified = Boolean(
    phoneValidation?.is_valid === true &&
    lineStatus === 'active' &&
    lineType &&
    VERIFIED_LINE_TYPES.has(lineType)
  );

  return {
    verified,
    validationMode: verified ? 'abstract_verified' : 'abstract_failed',
    valid: Boolean(phoneValidation?.is_valid),
    lineStatus: lineStatus || null,
    lineType: lineType || null,
    phoneNumber: data?.phone_number || null,
    nationalFormat: data?.phone_format?.national || data?.phone_number || null,
    carrierName: data?.phone_carrier?.name || null,
    raw: data,
  };
}

async function lookupWithAbstract({ phone, countryCode }, apiKey) {
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
    api_key: apiKey,
    phone: normalizedPhone,
  });
  if (countryCode) params.set('country', String(countryCode).trim().toUpperCase());

  const response = await fetch(`https://phoneintelligence.abstractapi.com/v1/?${params.toString()}`, {
    method: 'GET',
    headers: {
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
      provider: 'abstract',
      verified: false,
      error: 'upstream_parse_error',
      reason: `Abstract returned a non-JSON response (HTTP ${response.status})`,
      httpStatus: response.status,
    };
  }

  if (!response.ok) {
    return {
      phone,
      normalizedPhone,
      provider: 'abstract',
      verified: false,
      error: data?.error?.code || data?.code || 'lookup_failed',
      reason: data?.error?.message || data?.message || `Abstract lookup failed (HTTP ${response.status})`,
      httpStatus: response.status,
      raw: data,
    };
  }

  return {
    phone,
    normalizedPhone,
    provider: 'abstract',
    httpStatus: response.status,
    ...parseAbstractVerification(data),
  };
}

async function lookupWithTwilio({ phone, countryCode }, authHeader) {
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
      provider: 'twilio',
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
      provider: 'twilio',
      verified: false,
      error: data?.code || data?.error_code || 'lookup_failed',
      reason: data?.message || `Twilio lookup failed (HTTP ${response.status})`,
      httpStatus: response.status,
      raw: data,
    };
  }

  return {
    phone,
    normalizedPhone,
    provider: 'twilio',
    httpStatus: response.status,
    ...parseTwilioVerification(data),
  };
}

async function verifyPhone(entry, abstractApiKey, twilioAuthHeader) {
  if (abstractApiKey) {
    const abstractResult = await lookupWithAbstract(entry, abstractApiKey);
    if (abstractResult.verified || !twilioAuthHeader) return abstractResult;
  }

  if (twilioAuthHeader) {
    return lookupWithTwilio(entry, twilioAuthHeader);
  }

  return {
    phone: entry?.phone || '',
    verified: false,
    error: 'provider_not_configured',
    reason: 'No phone verification provider is configured.',
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const abstractApiKey = process.env.ABSTRACT_API_KEY;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioAuthHeader = accountSid && authToken
    ? `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`
    : null;

  if (!abstractApiKey && !twilioAuthHeader) {
    return res.status(500).json({ error: 'Phone verification is not configured. Set ABSTRACT_API_KEY and/or Twilio credentials.' });
  }

  const body = req.body || {};
  const numbers = Array.isArray(body.numbers) ? body.numbers : [];
  if (numbers.length === 0) {
    return res.status(400).json({ error: 'numbers[] is required' });
  }

  try {
    const results = [];
    for (const entry of numbers) {
      const result = await verifyPhone(entry || {}, abstractApiKey, twilioAuthHeader);
      results.push(result);
    }
    return res.status(200).json({ results });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Failed to reach a phone verification provider.',
    });
  }
}
