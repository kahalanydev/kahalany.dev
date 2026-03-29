const nodemailer = require('nodemailer');
const { getDb } = require('../db');

function getSmtpConfig() {
  const db = getDb();
  const get = (key) => {
    const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key);
    return row ? row.value : '';
  };

  const host = get('smtp_host');
  const port = get('smtp_port');
  const user = get('smtp_user');
  const pass = get('smtp_pass');
  const from = get('smtp_from');

  if (!host || !port || !user || !pass || !from) return null;
  return { host, port: parseInt(port), user, pass, from };
}

async function sendEmail({ to, subject, html }) {
  const config = getSmtpConfig();
  if (!config) {
    console.log(`[EMAIL] SMTP not configured — would have sent "${subject}" to ${to}`);
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass }
  });

  try {
    await transporter.sendMail({
      from: config.from,
      to,
      subject,
      html
    });
    console.log(`[EMAIL] Sent "${subject}" to ${to}`);
    return true;
  } catch (err) {
    console.error(`[EMAIL] Failed to send to ${to}:`, err.message);
    return false;
  }
}

function sendWelcomeEmail({ email, name, password, role, loginUrl }) {
  const displayName = name || email;
  const portalLabel = role === 'client' ? 'Client Portal' : 'Admin Panel';

  return sendEmail({
    to: email,
    subject: `You've been invited to Kahalany.Dev ${portalLabel}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;padding:32px;background:#1a1a2e;color:#e0e0e0;border-radius:12px">
        <div style="text-align:center;margin-bottom:24px">
          <h1 style="color:#00ff88;font-size:24px;margin:0">Kahalany.Dev</h1>
          <p style="color:#888;margin:4px 0 0">${portalLabel}</p>
        </div>
        <p>Hi ${displayName},</p>
        <p>You've been invited to the <strong>${portalLabel}</strong>. Here are your login credentials:</p>
        <div style="background:#0d0d1a;padding:16px;border-radius:8px;margin:20px 0;border-left:3px solid #00ff88">
          <p style="margin:0 0 8px"><strong>Email:</strong> <code style="color:#00ff88">${email}</code></p>
          <p style="margin:0"><strong>Temporary Password:</strong> <code style="color:#00ff88">${password}</code></p>
        </div>
        <p>You'll be asked to change your password on first login.</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${loginUrl}" style="display:inline-block;background:#00ff88;color:#0d0d1a;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Sign In</a>
        </div>
        <p style="color:#666;font-size:12px;margin-top:24px;border-top:1px solid #333;padding-top:16px">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    `
  });
}

function sendPasswordResetEmail({ email, name, password, loginUrl }) {
  const displayName = name || email;

  return sendEmail({
    to: email,
    subject: 'Your Kahalany.Dev password has been reset',
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;padding:32px;background:#1a1a2e;color:#e0e0e0;border-radius:12px">
        <div style="text-align:center;margin-bottom:24px">
          <h1 style="color:#00ff88;font-size:24px;margin:0">Kahalany.Dev</h1>
        </div>
        <p>Hi ${displayName},</p>
        <p>Your password has been reset by an administrator. Here are your new credentials:</p>
        <div style="background:#0d0d1a;padding:16px;border-radius:8px;margin:20px 0;border-left:3px solid #00ff88">
          <p style="margin:0 0 8px"><strong>Email:</strong> <code style="color:#00ff88">${email}</code></p>
          <p style="margin:0"><strong>New Password:</strong> <code style="color:#00ff88">${password}</code></p>
        </div>
        <p>You'll be asked to change this password on your next login.</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${loginUrl}" style="display:inline-block;background:#00ff88;color:#0d0d1a;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Sign In</a>
        </div>
      </div>
    `
  });
}

module.exports = { sendEmail, sendWelcomeEmail, sendPasswordResetEmail, getSmtpConfig };
