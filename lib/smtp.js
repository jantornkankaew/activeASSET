const tls = require('node:tls');
const net = require('node:net');
const dns = require('node:dns');

if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

/**
 * Clean & normalize Google App Password (removes spaces)
 */
function normalizePassword(pass) {
  return (pass || '').replace(/\s+/g, '');
}

/**
 * Helper to encode UTF-8 string for email headers (RFC 2047)
 */
function encodeHeader(str) {
  if (!str) return '';
  // Check if string contains non-ASCII characters
  if (/^[\x20-\x7E]*$/.test(str)) {
    return str;
  }
  return `=?UTF-8?B?${Buffer.from(str, 'utf-8').toString('base64')}?=`;
}

/**
 * Low-level SMTP client over TLS/SSL (zero external dependencies)
 */
class SmtpClient {
  constructor(options = {}) {
    this.host = options.host || 'smtp.gmail.com';
    this.port = parseInt(options.port || 465, 10);
    this.user = options.user || '';
    this.pass = normalizePassword(options.pass);
    this.fromName = options.fromName || 'Active 5 System';
    this.fromEmail = options.fromEmail || this.user;
    this.timeout = options.timeout || 20000;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          if (this.socket) this.socket.destroy();
          reject(new Error(`เชื่อมต่อไปยัง ${this.host}:${this.port} หมดเวลา (Timeout ${this.timeout / 1000}s)`));
        }
      }, this.timeout);

      this.buffer = '';
      this.pendingResponse = null;

      const onConnect = () => {
        // Socket connected
      };

      if (this.port === 465) {
        // Direct SSL/TLS
        this.socket = tls.connect({
          host: this.host,
          port: this.port,
          rejectUnauthorized: false
        }, onConnect);
      } else {
        // Plain TCP (can STARTTLS later if needed, but 465 is default for Gmail)
        this.socket = net.connect({
          host: this.host,
          port: this.port
        }, onConnect);
      }

      this.socket.setEncoding('utf8');

      this.socket.on('data', chunk => {
        this.buffer += chunk;
        this.processBuffer();
      });

      this.socket.on('error', err => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error(`SMTP Connection Error: ${err.message}`));
        }
      });

      this.socket.on('close', () => {
        if (this.pendingResponse) {
          this.pendingResponse.reject(new Error('การเชื่อมต่อ SMTP ถูกปิดก่อนได้รับคำตอบ'));
          this.pendingResponse = null;
        }
      });

      // Expect greeting 220
      this.waitForResponse()
        .then(res => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            if (res.code === 220) {
              resolve(res);
            } else {
              reject(new Error(`เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง: ${res.raw}`));
            }
          }
        })
        .catch(err => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        });
    });
  }

  processBuffer() {
    if (!this.pendingResponse) return;

    // SMTP responses end with \r\n, multi-line format has dash after code: '250-...'
    // Final line has space: '250 ...'
    const lines = this.buffer.split(/\r?\n/);
    if (lines.length < 2) return; // not finished

    // Check if the last non-empty line is a completed reply
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(\d{3})(?:([ -])(.*))?$/);
      if (match) {
        const isLastLine = match[2] !== '-';
        if (isLastLine) {
          // Completed response
          const completedLines = lines.slice(0, i + 1).join('\n');
          this.buffer = lines.slice(i + 1).join('\n');
          const res = {
            code: parseInt(match[1], 10),
            message: match[3] || '',
            raw: completedLines
          };
          const { resolve } = this.pendingResponse;
          this.pendingResponse = null;
          resolve(res);
          return;
        }
      }
    }
  }

  waitForResponse() {
    return new Promise((resolve, reject) => {
      this.pendingResponse = { resolve, reject };
      this.processBuffer();
    });
  }

  async sendCommand(cmd) {
    if (!this.socket || this.socket.destroyed) {
      throw new Error('การเชื่อมต่อ SMTP ขาดหาย');
    }
    this.socket.write(cmd + '\r\n');
    return this.waitForResponse();
  }

  async authenticate() {
    const ehlo = await this.sendCommand('EHLO localhost');
    if (ehlo.code !== 250) {
      throw new Error(`EHLO ล้มเหลว: ${ehlo.raw}`);
    }

    // Try AUTH LOGIN
    const authStart = await this.sendCommand('AUTH LOGIN');
    if (authStart.code !== 334) {
      throw new Error(`AUTH LOGIN ไม่ได้รับการยอมรับ: ${authStart.raw}`);
    }

    const userB64 = Buffer.from(this.user, 'utf-8').toString('base64');
    const userRes = await this.sendCommand(userB64);
    if (userRes.code !== 334) {
      throw new Error(`ชื่อผู้ใช้/อีเมลไม่ถูกต้อง: ${userRes.raw}`);
    }

    const passB64 = Buffer.from(this.pass, 'utf-8').toString('base64');
    const passRes = await this.sendCommand(passB64);
    if (passRes.code !== 235) {
      if (passRes.raw.includes('Application-specific password required') || passRes.raw.includes('InvalidCredentials') || passRes.raw.includes('BadCredentials')) {
        throw new Error('รหัสผ่านไม่ถูกต้อง: สำหรับ Gmail จำเป็นต้องใช้ Google App Password 16 หลัก (ไม่ใช่รหัสผ่านล็อกอินทั่วไป)');
      }
      throw new Error(`การยืนยันตัวตนล้มเหลว (Code ${passRes.code}): ${passRes.message || passRes.raw}`);
    }

    return true;
  }

  async sendMail({ to, cc = '', subject, bodyText, attachments = [] }) {
    await this.authenticate();

    const sender = this.fromEmail || this.user;
    const mailFrom = await this.sendCommand(`MAIL FROM:<${sender}>`);
    if (mailFrom.code !== 250) {
      throw new Error(`MAIL FROM ปฏิเสธ: ${mailFrom.raw}`);
    }

    // Parse recipients
    const toList = (to || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
    const ccList = (cc || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
    const allRecipients = Array.from(new Set([...toList, ...ccList]));

    if (allRecipients.length === 0) {
      throw new Error('กรุณาระบุอีเมลผู้รับ (To)');
    }

    for (const rcpt of allRecipients) {
      // Extract bare email from "Name <email@dom.com>" if present
      const match = rcpt.match(/<([^>]+)>/);
      const cleanEmail = match ? match[1] : rcpt;
      const rcptRes = await this.sendCommand(`RCPT TO:<${cleanEmail}>`);
      if (rcptRes.code !== 250 && rcptRes.code !== 251) {
        throw new Error(`RCPT TO ปฏิเสธอีเมล (${cleanEmail}): ${rcptRes.raw}`);
      }
    }

    const dataRes = await this.sendCommand('DATA');
    if (dataRes.code !== 354) {
      throw new Error(`DATA ไม่พร้อมรับข้อมูล: ${dataRes.raw}`);
    }

    // Build MIME message
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const headerLines = [];

    const fromDisp = this.fromName ? `"${encodeHeader(this.fromName)}" <${sender}>` : `<${sender}>`;
    headerLines.push(`From: ${fromDisp}`);
    headerLines.push(`To: ${toList.join(', ')}`);
    if (ccList.length > 0) {
      headerLines.push(`Cc: ${ccList.join(', ')}`);
    }
    headerLines.push(`Subject: ${encodeHeader(subject)}`);
    headerLines.push(`Date: ${new Date().toUTCString()}`);
    headerLines.push(`Message-ID: <${Date.now()}.${Math.random().toString(36).substring(2)}@${this.host}>`);
    headerLines.push('MIME-Version: 1.0');
    headerLines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    headerLines.push('');

    let payload = headerLines.join('\r\n') + '\r\n';

    // Body part
    payload += `--${boundary}\r\n`;
    payload += 'Content-Type: text/plain; charset=UTF-8\r\n';
    payload += 'Content-Transfer-Encoding: base64\r\n\r\n';
    payload += Buffer.from(bodyText || '', 'utf-8').toString('base64') + '\r\n\r\n';

    // Attachment parts
    for (const att of attachments) {
      const fileName = att.filename || 'attachment.pdf';
      const fileContentType = att.contentType || 'application/pdf';
      const fileData = Buffer.isBuffer(att.content)
        ? att.content
        : Buffer.from(att.content, 'base64');

      payload += `--${boundary}\r\n`;
      payload += `Content-Type: ${fileContentType}; name="${encodeHeader(fileName)}"\r\n`;
      payload += `Content-Disposition: attachment; filename="${encodeHeader(fileName)}"\r\n`;
      payload += 'Content-Transfer-Encoding: base64\r\n\r\n';

      // Split base64 into 76-character lines for RFC compliance
      const b64 = fileData.toString('base64');
      for (let i = 0; i < b64.length; i += 76) {
        payload += b64.substring(i, i + 76) + '\r\n';
      }
      payload += '\r\n';
    }

    payload += `--${boundary}--\r\n.\r\n`;

    this.socket.write(payload);
    const finishRes = await this.waitForResponse();
    if (finishRes.code !== 250) {
      throw new Error(`ส่งอีเมลไม่สำเร็จ: ${finishRes.raw}`);
    }

    try {
      await this.sendCommand('QUIT');
    } catch (_) {}

    this.socket.destroy();
    return { success: true, messageId: finishRes.message };
  }

  close() {
    if (this.socket && !this.socket.destroyed) {
      this.socket.destroy();
    }
  }
}

/**
 * Verify SMTP credentials only
 */
async function verifySmtpCredentials(options) {
  const client = new SmtpClient(options);
  try {
    await client.connect();
    await client.authenticate();
    await client.sendCommand('QUIT');
    client.close();
    return { success: true, message: 'การเชื่อมต่อและยืนยันตัวตนกับ Gmail สำเร็จเรียบร้อย' };
  } catch (err) {
    client.close();
    return { success: false, error: err.message };
  }
}

/**
 * Send an email with optional attachments
 */
async function sendSmtpEmail(options, mailOptions) {
  const client = new SmtpClient(options);
  try {
    await client.connect();
    const result = await client.sendMail(mailOptions);
    return { success: true, result };
  } catch (err) {
    client.close();
    return { success: false, error: err.message };
  }
}

module.exports = {
  SmtpClient,
  verifySmtpCredentials,
  sendSmtpEmail
};
