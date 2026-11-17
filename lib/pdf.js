const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/**
 * Locate Chrome or Chromium executable across different OS platforms
 */
function findChromeExecutable() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const platform = os.platform();
  const candidates = [];

  if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else if (platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env.LOCALAPPDATA || 'C:\\Users\\Default\\AppData\\Local';
    candidates.push(
      path.join(programFiles, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(programFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe')
    );
  } else {
    // Linux
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser'
    );
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Generate a PDF buffer from a loan ID using Chrome Headless via DevTools Protocol
 */
async function generateLoanPdf(loanId, options = {}) {
  const chromePath = findChromeExecutable();
  if (!chromePath) {
    throw new Error('ไม่พบ Google Chrome หรือ Chromium ในเครื่อง เพื่อใช้สร้างไฟล์ PDF');
  }

  const port = options.port || (9400 + Math.floor(Math.random() * 500));
  const serverPort = options.serverPort || 3020;
  const timeoutMs = options.timeoutMs || 25000;
  const tempDir = path.join(os.tmpdir(), `active_pdf_${Date.now()}_${Math.random().toString(36).substring(2)}`);

  try {
    fs.mkdirSync(tempDir, { recursive: true });
  } catch (_) {}

  const chrome = spawn(chromePath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tempDir}`,
    'about:blank'
  ], { stdio: 'ignore' });

  let isKilled = false;
  const cleanup = () => {
    if (!isKilled) {
      isKilled = true;
      try {
        chrome.kill();
      } catch (_) {}
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {}
    }
  };

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      cleanup();
      reject(new Error(`สร้างไฟล์ PDF หมดเวลาเกินกำหนด (${timeoutMs / 1000} วินาที)`));
    }, timeoutMs);
  });

  const worker = async () => {
    // Wait for Chrome debugging port to be ready
    let target = null;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`);
        const list = await res.json();
        target = list.find(t => t.type === 'page');
        if (target?.webSocketDebuggerUrl) break;
      } catch (_) {
        await sleep(150);
      }
    }

    if (!target?.webSocketDebuggerUrl) {
      throw new Error('ไม่สามารถเชื่อมต่อ Chrome DevTools เพื่อเรนเดอร์ PDF ได้');
    }

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let msgId = 1;
    const pending = new Map();

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const curId = msgId++;
        pending.set(curId, { resolve, reject });
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    }

    ws.onmessage = e => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.id && pending.has(msg.id)) {
          const { resolve, reject } = pending.get(msg.id);
          pending.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      } catch (_) {}
    };

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    await send('Page.enable');
    await send('Runtime.enable');

    // Emulate print CSS media
    await send('Emulation.setEmulatedMedia', { media: 'print' });

    // Navigate to loan print URL
    const targetUrl = `http://localhost:${serverPort}/#modal:print-${encodeURIComponent(loanId)}`;
    await send('Page.navigate', { url: targetUrl });

    // Wait until print preview sheet is rendered
    for (let i = 0; i < 40; i++) {
      await sleep(200);
      const evalRes = await send('Runtime.evaluate', {
        expression: `Boolean(document.querySelector('.gate-pass-print-sheet') || document.querySelector('.gate-pass-dual-wrapper'))`
      });
      if (evalRes?.result?.value === true) {
        break;
      }
    }

    await sleep(400); // Allow fonts and signatures to settle

    // Print to PDF
    const pdfResult = await send('Page.printToPDF', {
      printBackground: true,
      paperWidth: 8.27,
      paperHeight: 11.69,
      marginTop: 0.25,
      marginBottom: 0.25,
      marginLeft: 0.25,
      marginRight: 0.25,
      preferCSSPageSize: true
    });

    try {
      ws.close();
    } catch (_) {}
    cleanup();

    if (!pdfResult?.data) {
      throw new Error('Chrome ไม่ได้ส่งข้อมูล PDF กลับมา');
    }

    return Buffer.from(pdfResult.data, 'base64');
  };

  try {
    return await Promise.race([worker(), timeoutPromise]);
  } catch (err) {
    cleanup();
    throw err;
  }
}

module.exports = {
  findChromeExecutable,
  generateLoanPdf
};
