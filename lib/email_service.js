const { sendSmtpEmail, verifySmtpCredentials } = require('./smtp.js');

/**
 * Send email via Resend API (https://resend.com)
 */
async function sendEmailViaResend({ apiKey, fromName, fromEmail, to, cc, subject, bodyText, attachments = [] }) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) throw new Error('กรุณาระบุ Resend API Key');

  // Default to a5@active5.co.th if custom domain is not specified
  const senderEmail = (fromEmail && fromEmail.includes('@')) ? fromEmail.trim() : 'a5@active5.co.th';
  const from = fromName ? `${fromName} <${senderEmail}>` : senderEmail;

  const toList = (to || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
  const ccList = (cc || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);

  if (toList.length === 0) {
    throw new Error('กรุณาระบุอีเมลผู้รับ (To)');
  }

  const payload = {
    from,
    to: toList,
    subject,
    text: bodyText || '',
    attachments: attachments.map(att => ({
      filename: att.filename,
      content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content
    }))
  };

  if (ccList.length > 0) {
    payload.cc = ccList;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cleanKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message || (data.errors && data.errors.map(e => e.message).join(', ')) || `Resend Error (${res.status})`;
    throw new Error(msg);
  }

  return { success: true, id: data.id, provider: 'resend' };
}

/**
 * Send email via SendGrid API (https://sendgrid.com)
 */
async function sendEmailViaSendGrid({ apiKey, fromName, fromEmail, to, cc, subject, bodyText, attachments = [] }) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) throw new Error('กรุณาระบุ SendGrid API Key');

  const toList = (to || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
  const ccList = (cc || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);

  if (toList.length === 0) {
    throw new Error('กรุณาระบุอีเมลผู้รับ (To)');
  }

  const personalizations = [{
    to: toList.map(email => ({ email }))
  }];
  if (ccList.length > 0) {
    personalizations[0].cc = ccList.map(email => ({ email }));
  }

  const payload = {
    personalizations,
    from: {
      email: fromEmail || 'a5@active5.co.th',
      name: fromName || 'บริษัท แอคทีฟ 5 จำกัด'
    },
    subject,
    content: [{
      type: 'text/plain',
      value: bodyText || ''
    }]
  };

  if (attachments.length > 0) {
    payload.attachments = attachments.map(att => ({
      filename: att.filename,
      type: att.contentType || 'application/pdf',
      disposition: 'attachment',
      content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content
    }));
  }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cleanKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const errDetail = data.errors?.[0]?.message || `SendGrid Error (${res.status})`;
    throw new Error(errDetail);
  }

  return { success: true, provider: 'sendgrid' };
}

/**
 * Verify API Key for Resend or SendGrid
 */
async function verifyApiKey({ provider = 'resend', apiKey }) {
  const key = (apiKey || '').trim();
  if (!key) throw new Error('กรุณาระบุ API Key');

  if (provider === 'sendgrid' || key.startsWith('SG.')) {
    const res = await fetch('https://api.sendgrid.com/v3/scopes', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    if (!res.ok) {
      throw new Error('SendGrid API Key ไม่ถูกต้อง หรือไม่มีสิทธิ์เข้าถึง (ต้องมีสิทธิ์ Mail Send)');
    }
    return { success: true, provider: 'sendgrid', message: 'SendGrid API Key ถูกต้อง พร้อมใช้งาน!' };
  } else {
    // Resend
    const res = await fetch('https://api.resend.com/api-keys', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Resend API Key ไม่ถูกต้อง กรุณาตรวจสอบคีย์จาก resend.com/api-keys');
    }
    return { success: true, provider: 'resend', message: 'Resend API Key ถูกต้อง พร้อมใช้งาน!' };
  }
}

/**
 * Dispatch Email using configured service (Resend, SendGrid, or SMTP)
 */
async function dispatchEmail(settings, mailOptions) {
  const provider = settings.email_provider || 'resend';
  const apiKey = (settings.email_api_key || '').trim();
  const fromName = settings.email_from_name || settings.company_name || 'Active 5 System';
  const fromEmail = (settings.email_from_address || '').trim();

  // If Resend API Key is provided
  if (provider === 'resend' || (!provider && apiKey.startsWith('re_')) || (provider !== 'smtp' && apiKey.startsWith('re_'))) {
    if (!apiKey) {
      throw new Error('ยังไม่ได้ตั้งค่า Resend API Key กรุณาไปที่ "ข้อมูลบริษัท > ตั้งค่าการส่ง Email" เพื่อกรอก API Key');
    }
    return sendEmailViaResend({
      apiKey,
      fromName,
      fromEmail,
      ...mailOptions
    });
  }

  // If SendGrid API Key is provided
  if (provider === 'sendgrid' || apiKey.startsWith('SG.')) {
    if (!apiKey) {
      throw new Error('ยังไม่ได้ตั้งค่า SendGrid API Key กรุณาไปที่ "ข้อมูลบริษัท > ตั้งค่าการส่ง Email" เพื่อกรอก API Key');
    }
    return sendEmailViaSendGrid({
      apiKey,
      fromName,
      fromEmail,
      ...mailOptions
    });
  }

  // Fallback to SMTP
  const user = (settings.smtp_user || '').trim();
  const pass = (settings.smtp_pass || '').trim();
  if (!user || !pass) {
    throw new Error('ยังไม่ได้ตั้งค่า Email API Key หรือ SMTP สำหรับส่งอีเมล กรุณากดปุ่ม "⚙️ ตั้งค่า Email" เพื่อตั้งค่าก่อนส่ง');
  }

  const host = settings.smtp_host || 'smtp.gmail.com';
  const port = parseInt(settings.smtp_port || 465, 10);
  const smtpFromName = settings.smtp_from_name || fromName;
  const smtpFromEmail = settings.smtp_from_email || user;

  const mailRes = await sendSmtpEmail({
    host,
    port,
    user,
    pass,
    fromName: smtpFromName,
    fromEmail: smtpFromEmail
  }, mailOptions);

  if (!mailRes.success) {
    throw new Error(mailRes.error);
  }

  return { success: true, provider: 'smtp' };
}

module.exports = {
  sendEmailViaResend,
  sendEmailViaSendGrid,
  verifyApiKey,
  dispatchEmail
};
