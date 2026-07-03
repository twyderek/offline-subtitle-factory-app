import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

const exePath = process.argv[2];
const port = Number(process.argv[3] || 9235);
const timeoutMs = Number(process.argv[4] || 30000);

if (!exePath) {
  throw new Error('Usage: node scripts/verify-electron-renderer.mjs <exe-path> [debug-port]');
}

const child = spawn(exePath, [`--remote-debugging-port=${port}`], {
  stdio: 'ignore',
  detached: false,
});

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function waitForTarget() {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const targets = await getJson(`http://127.0.0.1:${port}/json`);
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // App is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Timed out waiting for Electron renderer target');
}

function encodeFrame(text) {
  const payload = Buffer.from(text);
  const header = [];
  header.push(0x81);
  if (payload.length < 126) {
    header.push(0x80 | payload.length);
  } else if (payload.length < 65536) {
    header.push(0x80 | 126, (payload.length >> 8) & 0xff, payload.length & 0xff);
  } else {
    throw new Error('Payload too large');
  }
  const mask = crypto.randomBytes(4);
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i += 1) masked[i] = payload[i] ^ mask[i % 4];
  return Buffer.concat([Buffer.from(header), mask, masked]);
}

function decodeFrames(buffer) {
  const messages = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    let length = second & 0x7f;
    let headerLength = 2;
    if (length === 126) {
      if (offset + 4 > buffer.length) break;
      length = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (length === 127) {
      if (offset + 10 > buffer.length) break;
      const high = buffer.readUInt32BE(offset + 2);
      const low = buffer.readUInt32BE(offset + 6);
      if (high !== 0) throw new Error('Frame too large');
      length = low;
      headerLength = 10;
    }
    const masked = Boolean(second & 0x80);
    const maskLength = masked ? 4 : 0;
    const frameEnd = offset + headerLength + maskLength + length;
    if (frameEnd > buffer.length) break;
    let payload = buffer.subarray(offset + headerLength + maskLength, frameEnd);
    if (masked) {
      const mask = buffer.subarray(offset + headerLength, offset + headerLength + 4);
      payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
    }
    if ((first & 0x0f) === 1) messages.push(payload.toString('utf8'));
    offset = frameEnd;
  }
  return { messages, rest: buffer.subarray(offset) };
}

function connectWebSocket(wsUrl) {
  const url = new URL(wsUrl);
  const key = crypto.randomBytes(16).toString('base64');
  const socket = net.connect(Number(url.port), url.hostname);
  let buffer = Buffer.alloc(0);
  let connected = false;
  let id = 0;
  const pending = new Map();

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (!connected) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      connected = true;
      buffer = buffer.subarray(headerEnd + 4);
    }
    const decoded = decodeFrames(buffer);
    buffer = decoded.rest;
    for (const message of decoded.messages) {
      const data = JSON.parse(message);
      if (data.id && pending.has(data.id)) {
        pending.get(data.id)(data);
        pending.delete(data.id);
      }
    }
  });

  socket.write([
    `GET ${url.pathname}${url.search} HTTP/1.1`,
    `Host: ${url.host}`,
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Key: ${key}`,
    'Sec-WebSocket-Version: 13',
    '',
    '',
  ].join('\r\n'));

  return {
    call(method, params = {}) {
      const messageId = ++id;
      const message = JSON.stringify({ id: messageId, method, params });
      socket.write(encodeFrame(message));
      return new Promise((resolve) => pending.set(messageId, resolve));
    },
    close() {
      socket.end();
    },
  };
}

let client;
try {
  const target = await waitForTarget();
  client = connectWebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const inspectExpression = `(() => ({
    href: location.href,
    title: document.title,
    hasPageSettingsButton: Boolean(document.getElementById('openSettings')),
    hasSettingsModal: Boolean(document.getElementById('appSettings')),
    hasWorkflowSettings: Boolean(document.querySelector('[data-step="appSettings"]')),
    hasElectronApi: Boolean(window.electronAPI),
    hasSelectFolder: typeof window.electronAPI?.selectFolder === 'function',
    hasOpenArbitraryFolder: typeof window.electronAPI?.openArbitraryFolder === 'function',
    modalOpenBefore: document.getElementById('appSettings')?.classList.contains('is-open') || false
  }))()`;
  const before = await client.call('Runtime.evaluate', { expression: inspectExpression, returnByValue: true });
  await client.call('Runtime.evaluate', {
    expression: `window.dispatchEvent(new CustomEvent('open-app-settings'));`,
    returnByValue: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const after = await client.call('Runtime.evaluate', {
    expression: `document.getElementById('appSettings')?.classList.contains('is-open') || false`,
    returnByValue: true,
  });

  const uploadFlow = await client.call('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const health = await fetch('/api/health', { cache: 'no-store' }).then((res) => res.json());
      const settings = await fetch('/api/settings', { cache: 'no-store' }).then((res) => res.json());
      const form = new FormData();
      form.append('video', new File([new Uint8Array([0, 1, 2, 3])], 'renderer-upload-test.mp4', { type: 'video/mp4' }));
      form.append('existingSrt', new File(['1\\n00:00:00,000 --> 00:00:01,000\\n打包版上傳測試\\n'], 'renderer-upload-test.srt', { type: 'text/plain' }));
      form.append('ruleFile', new File(['REMOVE_FILLER: 呃,啊\\n'], 'rule.txt', { type: 'text/plain' }));
      form.append('language', 'zh-TW');
      form.append('asrEngine', 'manual');
      form.append('outputFormats', 'srt');
      const createResponse = await fetch('/api/jobs', { method: 'POST', body: form });
      const created = await createResponse.json();
      if (!createResponse.ok) return { healthOk: health.ok, settingsOk: Boolean(settings.projectFolder), createStatus: createResponse.status, created };
      const startResponse = await fetch('/api/jobs/' + encodeURIComponent(created.jobId) + '/start', { method: 'POST' });
      let status = null;
      for (let i = 0; i < 20; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        status = await fetch('/api/jobs/' + encodeURIComponent(created.jobId) + '/status', { cache: 'no-store' }).then((res) => res.json());
        if (['completed', 'failed', 'cancelled', 'needs-action'].includes(status.status)) break;
      }
      return {
        healthOk: health.ok,
        settingsOk: Boolean(settings.projectFolder),
        createStatus: createResponse.status,
        startStatus: startResponse.status,
        jobId: created.jobId,
        finalStatus: status?.status,
        hasCleanedSrt: Boolean(status?.files?.cleanedSrt),
        folder: status?.folder,
      };
    })()`,
  });

  const folderIconFlow = await client.call('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      window.dispatchEvent(new CustomEvent('open-app-settings'));
      await new Promise((resolve) => setTimeout(resolve, 200));
      const input = document.getElementById('projectFolder');
      const button = document.querySelector('.folder-open[data-folder-target="projectFolder"]');
      window.__skipNativeFolderOpenForTest = true;
      input.value = 'C:\\\\Temp\\\\offline-subtitle-folder-open-test';
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 300));
      delete window.__skipNativeFolderOpenForTest;
      return {
        hasButton: Boolean(button),
        requestedPath: button.dataset.openRequested || null,
        openResult: button.dataset.openResult || null,
      };
    })()`,
  });

  const result = {
    exe: path.resolve(exePath),
    before: before.result.result.value,
    modalOpenAfterEvent: after.result.result.value,
    uploadFlow: uploadFlow.result.result.value,
    folderIconFlow: folderIconFlow.result.result.value,
  };
  console.log(JSON.stringify(result, null, 2));

  if (result.before.hasPageSettingsButton) throw new Error('Page settings button still exists');
  if (!result.before.hasSettingsModal) throw new Error('Settings modal is missing');
  if (result.before.hasWorkflowSettings) throw new Error('Workflow settings step still exists');
  if (!result.before.hasElectronApi) throw new Error('Electron preload API is missing');
  if (!result.before.hasSelectFolder) throw new Error('Electron selectFolder API is missing');
  if (!result.before.hasOpenArbitraryFolder) throw new Error('Electron openArbitraryFolder API is missing');
  if (!result.modalOpenAfterEvent) throw new Error('Settings modal did not open from renderer event');
  if (!result.uploadFlow.healthOk) throw new Error('Renderer health fetch failed');
  if (!result.uploadFlow.settingsOk) throw new Error('Renderer settings fetch failed');
  if (result.uploadFlow.createStatus !== 201) throw new Error(`Renderer upload create job failed: ${result.uploadFlow.createStatus}`);
  if (result.uploadFlow.startStatus !== 202) throw new Error(`Renderer start job failed: ${result.uploadFlow.startStatus}`);
  if (result.uploadFlow.finalStatus !== 'completed') throw new Error(`Renderer upload job did not complete: ${result.uploadFlow.finalStatus}`);
  if (!result.uploadFlow.hasCleanedSrt) throw new Error('Renderer upload job did not produce cleaned SRT');
  if (!result.folderIconFlow.hasButton) throw new Error('Folder open icon button is missing');
  if (!result.folderIconFlow.requestedPath?.includes('offline-subtitle-folder-open-test')) throw new Error('Folder open icon did not request the entered path');
  if (result.folderIconFlow.openResult !== 'skipped') throw new Error('Folder open icon did not reach the open-folder flow');
} finally {
  client?.close();
  child.kill();
  spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
}
