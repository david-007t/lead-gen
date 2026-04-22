import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, body } = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Missing to, subject, or body' });
  }

  // SMTP credentials come from server-side env vars only — never from the client.
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpFromName = process.env.SMTP_FROM_NAME;

  if (!smtpUser || !smtpPass) {
    return res.status(503).json({ error: 'Email service not configured' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const fromLabel = smtpFromName
      ? `${smtpFromName} <${smtpUser}>`
      : smtpUser;

    await transporter.sendMail({
      from: fromLabel,
      to,
      subject,
      text: body,
    });

    return res.status(200).json({ success: true });
  } catch {
    // Do not expose raw error internals to the client.
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
