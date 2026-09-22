import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { aiEndpointPrivacy, isLoopbackAiUrl } from '../lib/ai/local-ai.mjs';

const exePath = process.argv[2];
const port = Number(process.argv[3] || 9990);
const timeoutMs = Number(process.argv[4] || 30000);
const outputPath = path.resolve(process.argv[5] || `docs/project-management/evidence/${new Date().toISOString().slice(0, 10)}-ollama-ui-live.json`);
const model = String(process.argv[6] || process.env.OSF_OLLAMA_UI_MODEL || process.env.OLLAMA_MODEL || 'llama3.2:1b').trim();
const ollamaBaseUrl = String(process.env.OSF_OLLAMA_UI_BASE_URL || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1').replace(/\/+$/, '');

if (!exePath) throw new Error('Usage: node scripts/verify-electron-ollama-ui.mjs <exe-path> [debug-port] [timeout-ms] [evidence-output] [ollama-model]');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`Invalid DevTools port: ${port}`);
if (!Number.isFinite(timeoutMs) || timeoutMs < 5000) throw new Error(`Invalid timeout: ${timeoutMs}`);
if (!model) throw new Error('Ollama model is required');
if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite existing Ollama UI evidence: ${outputPath}`);
if (!isLoopbackAiUrl(ollamaBaseUrl)) throw new Error(`Ollama UI probe 只允許 loopback URL：${ollamaBaseUrl}`);

const sourceCues = [
  { id: 1, start: '00:00:00,000', end: '00:00:02,500', text: 'Hello，朋友。' },
  { id: 2, start: '00:00:02,500', end: '00:00:05,000', text: 'Thank you，大家。' },
];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function srtTimeToSeconds(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2}):(\d{2})[,\.](\d{1,3})$/);
  if (!match) throw new Error(`探針時碼格式無效：${value}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4].padEnd(3, '0')) / 1000;
}

function srtFromCues(cues) {
  return `${cues.map((cue) => `${cue.id}\n${cue.start} --> ${cue.end}\n${cue.text}`).join('\n\n')}\n`;
}

function requireOk(condition, message) {
  if (!condition) throw new Error(message);
}

async function removeUserDataWithRetries(target) {
  let lastError;
  const attempts = process.platform === 'win32' ? 20 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      if (process.platform !== 'win32' || !['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(error?.code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError;
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.setTimeout(1500, () => request.destroy(new Error('Timed out querying Electron DevTools')));
    request.on('error', reject);
  });
}

async function waitForTarget(child, childLogs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const targets = await getJson(`http://127.0.0.1:${port}/json`);
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl && /^http:\/\/127\.0\.0\.1:\d+\//.test(target.url || '') && /字幕/.test(target.title || ''));
      if (page) return page;
    } catch {
      // Electron is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for Electron renderer target${childLogs() ? `\n${childLogs()}` : ''}`);
}

async function connectWebSocket(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out connecting to Electron DevTools')), 5000);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('Failed to connect to Electron DevTools'));
    }, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const data = JSON.parse(String(event.data));
    if (!data.id || !pending.has(data.id)) return;
    const entry = pending.get(data.id);
    clearTimeout(entry.timer);
    pending.delete(data.id);
    entry.resolve(data);
  });
  return {
    call(method, params = {}, timeoutMs = 20000) {
      const messageId = ++id;
      socket.send(JSON.stringify({ id: messageId, method, params }));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(messageId);
          reject(new Error(`Timed out waiting for DevTools method ${method}`));
        }, timeoutMs);
        pending.set(messageId, { resolve, reject, timer });
      });
    },
    close() { socket.close(); },
  };
}

function evaluatedValue(response) {
  return response?.result?.result?.value ?? response?.result?.value;
}

async function evaluate(client, expression, timeoutMs = 20000) {
  const response = await client.call('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression }, timeoutMs);
  if (response?.result?.exceptionDetails) {
    throw new Error(response.result.exceptionDetails.exception?.description || 'Renderer evaluation failed');
  }
  return evaluatedValue(response);
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-subtitle-ollama-ui-'));
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-subtitle-ollama-ui-electron-'));
const childEnv = {
  ...process.env,
  SUBTITLE_AI_API_KEY: '',
  SUBTITLE_AI_KEYS_JSON: '{}',
  ELECTRON_NO_ATTACH_CONSOLE: '1',
};
const child = spawn(path.resolve(exePath), [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`], {
  cwd: path.dirname(path.resolve(exePath)),
  env: childEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: false,
});
let childLogs = '';
const captureChildLog = (chunk) => { childLogs = `${childLogs}${chunk.toString('utf8')}`.slice(-8000); };
child.stdout.on('data', captureChildLog);
child.stderr.on('data', captureChildLog);

let client;
const startedAt = new Date().toISOString();
const started = Date.now();
let evidence = {
  schema: 'offline-subtitle-factory.ollama-ui-live-acceptance.v1',
  startedAt,
  completedAt: null,
  elapsedMs: null,
  environment: { platform: process.platform, arch: process.arch, node: process.version },
  executable: path.resolve(exePath),
  provider: 'ollama',
  baseUrl: ollamaBaseUrl,
  endpointPrivacy: aiEndpointPrivacy(ollamaBaseUrl),
  model,
  scope: {
    systemNetworkDisabled: false,
    loopbackOnlyConfiguration: isLoopbackAiUrl(ollamaBaseUrl),
    apiKeySupplied: false,
    lmStudio: 'not-run-by-explicit-scope-exception',
  },
  status: 'fail',
};
let uiTrace = {};

async function stopChild() {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return;
  }
  child.kill('SIGTERM');
  await Promise.race([
    once(child, 'exit').catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (child.exitCode == null) child.kill('SIGKILL');
}

try {
  const target = await waitForTarget(child, () => childLogs);
  client = await connectWebSocket(target.webSocketDebuggerUrl);
  const homeNavigationUrl = await evaluate(client, 'location.href');
  const home = await evaluate(client, '(() => ({ href: location.origin + location.pathname, title: document.title, hasHomeDashboard: Boolean(document.getElementById(\'homeDashboard\')) }))()');
  requireOk(home.hasHomeDashboard, '封裝版首頁未載入');

  const setup = await evaluate(client, `(async () => {
    const cues = ${JSON.stringify(sourceCues)};
    const health = await fetch('/api/health', { cache: 'no-store' }).then((response) => response.json());
    const form = new FormData();
    form.append('video', new File([new Uint8Array([0, 1, 2, 3])], 'ollama-ui-test.mp4', { type: 'video/mp4' }));
    form.append('existingSrt', new File([${JSON.stringify(srtFromCues(sourceCues))}], 'ollama-ui-test.srt', { type: 'text/plain' }));
    form.append('language', 'zh-TW');
    form.append('asrEngine', 'manual');
    form.append('outputFormats', 'srt');
    const createResponse = await fetch('/api/jobs', { method: 'POST', body: form });
    const created = await createResponse.json();
    if (!createResponse.ok) return { healthOk: health.ok, createStatus: createResponse.status, error: created.error || 'create failed' };
    const startResponse = await fetch('/api/jobs/' + encodeURIComponent(created.jobId) + '/start', { method: 'POST' });
    let status = null;
    for (let index = 0; index < 30; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      status = await fetch('/api/jobs/' + encodeURIComponent(created.jobId) + '/status', { cache: 'no-store' }).then((response) => response.json());
      if (['completed', 'failed', 'cancelled', 'needs-action'].includes(status.status)) break;
    }
    const reviewResponse = await fetch('/api/jobs/' + encodeURIComponent(created.jobId) + '/review-data', { cache: 'no-store' });
    const review = reviewResponse.ok ? await reviewResponse.json() : null;
    const sourceSubtitle = review?.subtitle || '';
    const timecodes = (review?.bilingualCues || []).map((cue) => [Number(cue.start), Number(cue.end)]);
    const sourceSha256 = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sourceSubtitle));
    const sourceHash = [...new Uint8Array(sourceSha256)].map((value) => value.toString(16).padStart(2, '0')).join('');
    return {
      healthOk: health.ok,
      createStatus: createResponse.status,
      startStatus: startResponse.status,
      jobId: created.jobId,
      finalStatus: status?.status,
      cueCount: review?.bilingualCues?.length || 0,
      sourceSubtitle,
      sourceHash,
      timecodes,
      subtitleFileName: review?.subtitleFileName || '',
    };
  })()`);
  requireOk(setup.healthOk, '封裝版 renderer health fetch 失敗');
  requireOk(setup.createStatus === 201 && setup.startStatus === 202, `封裝版 UI 驗收任務啟動失敗：${setup.createStatus}/${setup.startStatus}`);
  requireOk(setup.finalStatus === 'completed', `封裝版 UI 驗收任務未完成：${setup.finalStatus}`);
  requireOk(setup.cueCount === sourceCues.length, `封裝版 UI 驗收 cue 數量不符：${setup.cueCount}`);

  const reviewUrl = new URL(`/review/${encodeURIComponent(setup.jobId)}`, homeNavigationUrl);
  reviewUrl.searchParams.set('token', new URL(homeNavigationUrl).searchParams.get('token') || '');
  await client.call('Page.navigate', { url: reviewUrl.toString() });
  const reviewLoaded = await evaluate(client, `(async () => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (document.getElementById('cueCount')?.textContent.trim() === '2' && document.getElementById('runAiOptimize')) return { ready: true, href: location.origin + location.pathname, title: document.title };
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return { ready: false, href: location.origin + location.pathname, title: document.title, cueCount: document.getElementById('cueCount')?.textContent.trim() || '' };
  })()`);
  requireOk(reviewLoaded.ready, `校閱頁未載入 2 段字幕：${reviewLoaded.cueCount || 'unknown'}`);

  const settingsFlow = await evaluate(client, `(async () => {
    const setValue = (id, value, eventName = 'input') => {
      const element = document.getElementById(id);
      if (!element) throw new Error('missing #' + id);
      if (element.type === 'checkbox') element.checked = Boolean(value);
      else element.value = value;
      element.dispatchEvent(new Event(eventName, { bubbles: true }));
    };
    document.getElementById('openAiSettings').click();
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && !document.getElementById('aiSettingsModal')?.classList.contains('open')) await new Promise((resolve) => setTimeout(resolve, 100));
    if (!document.getElementById('aiSettingsModal')?.classList.contains('open')) return { opened: false };
    setValue('aiProvider', 'ollama', 'change');
    await new Promise((resolve) => setTimeout(resolve, 350));
    setValue('aiEnabled', true);
    setValue('aiBaseUrl', ${JSON.stringify(ollamaBaseUrl)});
    setValue('aiModel', ${JSON.stringify(model)});
    setValue('aiBatchSize', 2);
    setValue('aiApiKey', '');
    setValue('aiLanguage', 'en', 'change');
    setValue('aiTimeoutSeconds', 120);
    setValue('aiMaxRetries', 0);
    setValue('aiRetryBaseMs', 1000);
    setValue('aiInstructions', 'Return only a JSON object with a cues array. Translate each cue completely into English. Keep each original id.');
    document.getElementById('aiConsent').checked = false;
    document.getElementById('saveAiSettings').click();
    const saveDeadline = Date.now() + 10000;
    while (Date.now() < saveDeadline) {
      const status = document.getElementById('aiSettingsStatus')?.textContent || '';
      if (!document.getElementById('saveAiSettings')?.disabled && status.includes('設定已儲存')) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const status = document.getElementById('aiSettingsStatus')?.textContent || '';
    const privacy = document.getElementById('aiPrivacyStatus')?.textContent || '';
    const key = document.getElementById('aiApiKey');
    const snapshot = {
      opened: true,
      saved: status.includes('設定已儲存'),
      status,
      provider: document.getElementById('aiProvider').value,
      baseUrl: document.getElementById('aiBaseUrl').value,
      model: document.getElementById('aiModel').value,
      language: document.getElementById('aiLanguage').value,
      keyEmpty: key.value === '',
      keyHasSavedValue: key.dataset.hasKey === 'true',
      privacyIsLocal: privacy.includes('本機模式'),
      consentDisabled: document.getElementById('aiConsent').disabled,
    };
    document.getElementById('closeAiSettings').click();
    return snapshot;
  })()`);
  requireOk(settingsFlow.opened && settingsFlow.saved, `Ollama UI 設定保存失敗：${settingsFlow.status || 'modal not saved'}`);
  requireOk(settingsFlow.provider === 'ollama' && settingsFlow.baseUrl === ollamaBaseUrl && settingsFlow.model === model, 'Ollama UI 設定未保留 provider/base URL/model');
  requireOk(settingsFlow.language === 'en', 'Ollama UI 輸出語言未設定為英文');
  requireOk(settingsFlow.keyEmpty && !settingsFlow.keyHasSavedValue && settingsFlow.privacyIsLocal && settingsFlow.consentDisabled, 'Ollama UI 本機隱私／API Key 門檻狀態不符');
  uiTrace.settings = settingsFlow;

  await evaluate(client, `(() => {
    const originalFetch = window.fetch;
    window.fetch = (input, init = {}) => {
      const requestUrl = new URL(typeof input === 'string' ? input : input.url, location.href);
      if (requestUrl.pathname.endsWith('/ai-optimize') && String(init.method || 'GET').toUpperCase() === 'POST') {
        try {
          const body = JSON.parse(String(init.body || '{}'));
          window.__osfOllamaUiRequestSummary = {
            mode: body.mode || '',
            language: body.language || '',
            preserveTiming: body.preserveTiming === true,
            cueCount: Array.isArray(body.cues) ? body.cues.length : 0,
            cueIds: Array.isArray(body.cues) ? body.cues.map((cue) => cue.id) : [],
            cueTextLengths: Array.isArray(body.cues) ? body.cues.map((cue) => String(cue.text || '').length) : [],
            instructionsLength: String(body.instructions || '').length,
          };
        } catch {}
      }
      return originalFetch(input, init);
    };
    return true;
  })()`);

  const runFlow = await evaluate(client, `(async () => {
    if (document.getElementById('aiToolbar').classList.contains('collapsed')) document.getElementById('toggleAiToolbar').click();
    document.querySelector('.ai-mode[data-ai-mode="translate"]').click();
    document.getElementById('aiScope').value = 'all';
    document.getElementById('aiScope').dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('aiPreserveTiming').checked = true;
    document.getElementById('runAiOptimize').click();
    const deadline = Date.now() + 300000;
    while (Date.now() < deadline) {
      const recordResponse = await fetch('/api/jobs/' + encodeURIComponent(${JSON.stringify(setup.jobId)}) + '/ai-optimize', { cache: 'no-store' });
      const record = recordResponse.ok ? await recordResponse.json() : null;
      const cancelHidden = document.getElementById('cancelAiOptimize')?.hidden;
      if (record && ['completed', 'failed', 'cancelled', 'interrupted'].includes(record.status) && cancelHidden) {
        return {
          status: record.status,
          error: record.error || '',
          sessionId: record.sessionId || '',
          suggestionCount: record.result?.suggestions?.length || 0,
          totalRetries: record.result?.totalRetries ?? null,
          progress: record.progress || null,
          requestSummary: window.__osfOllamaUiRequestSummary || null,
          aiStatusText: document.getElementById('aiProgressText')?.textContent || '',
          suggestionActionsHidden: document.getElementById('aiSuggestionActions')?.hidden !== false,
          toolbarExpanded: !document.getElementById('aiToolbar')?.classList.contains('collapsed'),
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return { status: 'timeout', requestSummary: window.__osfOllamaUiRequestSummary || null, error: document.getElementById('aiProgressText')?.textContent || 'UI AI flow timeout' };
  })()`, 330000);
  uiTrace.optimize = runFlow;
  requireOk(runFlow.status === 'completed', `Ollama UI AI 任務未完成：${runFlow.error || runFlow.status}`);
  requireOk(runFlow.suggestionCount === sourceCues.length, `Ollama UI 建議數量不符：${runFlow.suggestionCount}/${sourceCues.length}`);
  requireOk(runFlow.sessionId && !runFlow.suggestionActionsHidden && runFlow.toolbarExpanded, 'Ollama UI 未呈現可接受的 AI 建議與 Session');

  const acceptFlow = await evaluate(client, `(async () => {
    document.getElementById('acceptAllAiSuggestions').click();
    const deadline = Date.now() + 10000;
    let sessions = null;
    while (Date.now() < deadline) {
      const response = await fetch('/api/jobs/' + encodeURIComponent(${JSON.stringify(setup.jobId)}) + '/ai-sessions', { cache: 'no-store' });
      sessions = response.ok ? await response.json() : null;
      const session = sessions?.sessions?.find((item) => item.sessionId === ${JSON.stringify(runFlow.sessionId)});
      if (session?.statistics?.accepted === 2) return { accepted: session.statistics.accepted, actionsHidden: document.getElementById('aiSuggestionActions')?.hidden === true, changedCount: document.getElementById('changedCount')?.textContent.trim() || '' };
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    const session = sessions?.sessions?.find((item) => item.sessionId === ${JSON.stringify(runFlow.sessionId)});
    return { accepted: session?.statistics?.accepted || 0, actionsHidden: document.getElementById('aiSuggestionActions')?.hidden === true, changedCount: document.getElementById('changedCount')?.textContent.trim() || '' };
  })()`);
  requireOk(acceptFlow.accepted === sourceCues.length && acceptFlow.actionsHidden, `Ollama UI 全部接受未完成：${acceptFlow.accepted}/${sourceCues.length}`);
  uiTrace.accept = acceptFlow;

  const historyFlow = await evaluate(client, `(async () => {
    const clickAndWait = async (id, word) => {
      document.getElementById(id).click();
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        if ((document.getElementById('reviewStatus')?.textContent || '').includes(word)) return true;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return false;
    };
    const undo = await clickAndWait('undoAiSession', '撤銷');
    const undoText = document.getElementById('aiSessionSummary')?.textContent || '';
    const redo = await clickAndWait('redoAiSession', '重新套用');
    const redoText = document.getElementById('aiSessionSummary')?.textContent || '';
    return { undo, redo, undoText, redoText, undoEnabled: !document.getElementById('undoAiSession').disabled, redoEnabled: !document.getElementById('redoAiSession').disabled };
  })()`);
  requireOk(historyFlow.undo && historyFlow.redo && historyFlow.undoEnabled && historyFlow.redoEnabled, 'Ollama UI undo/redo 未完成');
  uiTrace.history = historyFlow;

  const saveFlow = await evaluate(client, `(async () => {
    const save = document.getElementById('saveSrt');
    save.click();
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const review = await fetch('/api/jobs/' + encodeURIComponent(${JSON.stringify(setup.jobId)}) + '/review-data', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null);
      if (review?.subtitleFileName === 'reviewed.srt' && review.bilingualCues?.length === 2) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(review.subtitle || ''));
        const reviewHash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
        const savedTimecodes = review.bilingualCues.map((cue) => [Number(cue.start), Number(cue.end)]);
        const translated = review.bilingualCues.map((cue) => String(cue.translatedText || '')).join(' ');
        return {
          saved: true,
          status: document.getElementById('reviewStatus')?.textContent || '',
          subtitleFileName: review.subtitleFileName,
          cueCount: review.bilingualCues.length,
          timecodes: savedTimecodes,
          timecodesUnchanged: JSON.stringify(savedTimecodes) === JSON.stringify(${JSON.stringify(setup.timecodes)}),
          hasEnglishTranslation: /[A-Za-z]/.test(translated) && review.bilingualCues.some((cue) => cue.sourceText !== cue.translatedText),
          reviewHash,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return { saved: false, status: document.getElementById('reviewStatus')?.textContent || '' };
  })()`);
  requireOk(saveFlow.saved && saveFlow.cueCount === sourceCues.length, `Ollama UI 另存 SRT 未完成：${saveFlow.status || 'unknown'}`);
  requireOk(saveFlow.timecodesUnchanged && saveFlow.hasEnglishTranslation, 'Ollama UI 保存後時間碼或英文內容驗證失敗');
  uiTrace.save = saveFlow;

  evidence.status = 'pass';
  evidence.home = home;
  evidence.job = { createStatus: setup.createStatus, startStatus: setup.startStatus, finalStatus: setup.finalStatus, cueCount: setup.cueCount };
  evidence.ui = {
    reviewLoaded,
    settings: settingsFlow,
    optimize: { status: runFlow.status, sessionIdPresent: Boolean(runFlow.sessionId), suggestionCount: runFlow.suggestionCount, totalRetries: runFlow.totalRetries, progress: runFlow.progress, toolbarExpanded: runFlow.toolbarExpanded },
    accept: acceptFlow,
    history: historyFlow,
    save: { saved: saveFlow.saved, subtitleFileName: saveFlow.subtitleFileName, cueCount: saveFlow.cueCount, timecodesUnchanged: saveFlow.timecodesUnchanged, hasEnglishTranslation: saveFlow.hasEnglishTranslation, reviewSha256: saveFlow.reviewHash },
  };
  evidence.source = { cueCount: setup.cueCount, timecodes: setup.timecodes, sourceSubtitleSha256: setup.sourceHash, originalSubtitleFileName: setup.subtitleFileName };
} catch (error) {
  evidence.error = { message: String(error?.message || error), code: String(error?.code || '') };
  evidence.ui = uiTrace;
  if (childLogs) evidence.error.childLogTail = childLogs;
} finally {
  evidence.completedAt = new Date().toISOString();
  evidence.elapsedMs = Date.now() - started;
  client?.close();
  await stopChild();
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  } finally {
    await removeUserDataWithRetries(userDataDir);
    await removeUserDataWithRetries(dataDir);
  }
  console.log(JSON.stringify({ outputPath, status: evidence.status, model, elapsedMs: evidence.elapsedMs, error: evidence.error || null }, null, 2));
  if (evidence.status !== 'pass') process.exitCode = 1;
}
