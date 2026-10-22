import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { aiEndpointPrivacy, isLoopbackAiUrl } from '../lib/ai/local-ai.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const model = String(process.env.OLLAMA_MODEL || 'llama3.2:1b').trim();
const ollamaBaseUrl = String(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1').replace(/\/+$/, '');
const outputPath = path.resolve(process.argv[2] || `docs/project-management/evidence/${new Date().toISOString().slice(0, 10)}-ollama-${model.replace(/[^a-z0-9.-]+/gi, '-')}-product-live.json`);
if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite existing Ollama product evidence: ${outputPath}`);
if (!isLoopbackAiUrl(ollamaBaseUrl)) throw new Error(`Ollama product probe 只允許 loopback URL：${ollamaBaseUrl}`);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-ollama-product-live-'));
const settingsDir = path.join(dataDir, 'config');
const toolDataDir = path.join(dataDir, 'tools');
const port = 24000 + Math.floor(Math.random() * 1000);
const apiBaseUrl = `http://127.0.0.1:${port}`;
const token = `probe-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const sourceCues = [
  { id: 1, start: '00:00:00,000', end: '00:00:02,500', text: '這是一段課程影片字幕，老師正在說明如何在軟體中匯入影片並檢查字幕內容。' },
  { id: 2, start: '00:00:02,500', end: '00:00:05,000', text: '完成設定後，請先預覽結果，再確認字幕與影片時間是否一致。' },
];

function srtFromCues(cues) {
  return `${cues.map((cue) => `${cue.id}\n${cue.start} --> ${cue.end}\n${cue.text}`).join('\n\n')}\n`;
}

function srtTimeToSeconds(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2}):(\d{2})[,\.](\d{1,3})$/);
  if (!match) throw new Error(`探針時碼格式無效：${value}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4].padEnd(3, '0')) / 1000;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function requireOk(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(pathname, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('X-Offline-Subtitle-Token', token);
  return fetch(`${apiBaseUrl}${pathname}`, { ...options, headers });
}

async function waitForServer() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await api('/api/jobs?limit=1');
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('字幕工廠測試 server 啟動逾時');
}

async function waitForAi(jobId, timeoutMs = 240000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await api(`/api/jobs/${encodeURIComponent(jobId)}/ai-optimize`);
    const body = await response.json();
    if (['completed', 'failed', 'cancelled', 'interrupted'].includes(body.status)) return body;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('實際 Ollama AI 任務等待逾時');
}

function stopProcess(child) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 5000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

const startedAt = new Date().toISOString();
const started = Date.now();
let appProcess;
let evidence = {
  schema: 'offline-subtitle-factory.ollama-product-live-acceptance.v1',
  startedAt,
  completedAt: null,
  elapsedMs: null,
  environment: { platform: process.platform, arch: process.arch, node: process.version },
  provider: 'ollama',
  baseUrl: ollamaBaseUrl,
  endpointPrivacy: aiEndpointPrivacy(ollamaBaseUrl),
  model,
  scope: { systemNetworkDisabled: false, loopbackOnlyConfiguration: isLoopbackAiUrl(ollamaBaseUrl), lmStudio: 'not-run-by-explicit-scope-exception' },
  status: 'fail',
};

try {
  fs.mkdirSync(settingsDir, { recursive: true });
  fs.mkdirSync(toolDataDir, { recursive: true });
  fs.writeFileSync(path.join(settingsDir, 'settings.json'), JSON.stringify({ appLanguage: 'zh-TW', ai: { enabled: false, provider: 'ollama', baseUrl: ollamaBaseUrl, model } }), 'utf8');
  const serverEnv = {
    ...(process.env.PATH ? { PATH: process.env.PATH } : {}),
    ...(process.env.NODE_PATH ? { NODE_PATH: process.env.NODE_PATH } : {}),
    ...(process.env.LANG ? { LANG: process.env.LANG } : {}),
    ...(process.env.LC_ALL ? { LC_ALL: process.env.LC_ALL } : {}),
    ...(process.env.TZ ? { TZ: process.env.TZ } : {}),
    PORT: String(port),
    OFFLINE_SUBTITLE_DATA_DIR: dataDir,
    OFFLINE_SUBTITLE_SETTINGS_DIR: settingsDir,
    OFFLINE_SUBTITLE_TOOLS_DIR: toolDataDir,
    WHISPER_CACHE: path.join(toolDataDir, 'whisper-models'),
    WHISPER_MODEL_CACHE_DIR: path.join(settingsDir, 'whisper-models'),
    BREEZE_ASR_MODEL_DIR: path.join(settingsDir, 'breeze-asr'),
    OFFLINE_SUBTITLE_API_TOKEN: token,
    SUBTITLE_AI_API_KEY: '',
    SUBTITLE_AI_KEYS_JSON: '{}',
    TEMP: dataDir,
    TMP: dataDir,
    TMPDIR: dataDir,
    NODE_ENV: 'test',
  };
  appProcess = spawn(process.execPath, [path.join(appDir, 'server.mjs')], {
    cwd: appDir,
    env: serverEnv,
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  await waitForServer();

  const settingsResponse = await api('/api/ai/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true, provider: 'ollama', baseUrl: ollamaBaseUrl, model, batchSize: 1, language: 'en', timeoutSeconds: 120, maxRetries: 0 }),
  });
  requireOk(settingsResponse.status === 200, `Ollama 設定保存失敗：HTTP ${settingsResponse.status}`);
  const settings = await settingsResponse.json();
  requireOk(settings.settings?.provider === 'ollama' && settings.settings?.model === model, 'Ollama 設定未正規化為預期 provider／model');

  const form = new FormData();
  form.set('video', new Blob(['offline-ollama-product-live-video']), 'ollama-product-live.mp4');
  form.set('existingSrt', new Blob([srtFromCues(sourceCues)]), 'ollama-product-live.srt');
  form.set('language', 'zh-TW');
  const jobResponse = await api('/api/jobs', { method: 'POST', body: form });
  requireOk(jobResponse.status === 201, `本機字幕任務建立失敗：HTTP ${jobResponse.status}`);
  const job = await jobResponse.json();
  const inputSrtPath = path.join(dataDir, job.jobId, 'input', 'ollama-product-live.srt');
  requireOk(fs.existsSync(inputSrtPath), '原始字幕檔未建立');
  const originalSrt = fs.readFileSync(inputSrtPath, 'utf8');
  const originalSrtSha256 = sha256(originalSrt);

  const optimizeResponse = await api(`/api/jobs/${encodeURIComponent(job.jobId)}/ai-optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cues: sourceCues, mode: 'translate', language: 'en' }),
  });
  requireOk(optimizeResponse.status === 202, `Ollama AI 任務啟動失敗：HTTP ${optimizeResponse.status}`);
  const aiRecord = await waitForAi(job.jobId);
  requireOk(aiRecord.status === 'completed', `Ollama AI 任務未完成：${aiRecord.error || aiRecord.status}`);
  const suggestions = aiRecord.result?.suggestions || [];
  requireOk(suggestions.length === sourceCues.length, `Ollama 建議數量不符：${suggestions.length}/${sourceCues.length}`);
  requireOk(suggestions.every((item, index) => String(item.id) === String(sourceCues[index].id) && item.mode === 'translate' && item.text), 'Ollama 建議未保留 cue ID／模式／文字');

  const sessionsResponse = await api(`/api/jobs/${encodeURIComponent(job.jobId)}/ai-sessions`);
  requireOk(sessionsResponse.status === 200, `AI session 查詢失敗：HTTP ${sessionsResponse.status}`);
  const sessionsBody = await sessionsResponse.json();
  const session = (sessionsBody.sessions || []).find((item) => item.sessionId === aiRecord.sessionId);
  requireOk(session, '找不到已完成 Ollama AI session');

  const decisions = Object.fromEntries(suggestions.map((item) => [String(item.id), 'accepted']));
  const decisionResponse = await api(`/api/jobs/${encodeURIComponent(job.jobId)}/ai-session-decisions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: session.sessionId, decisions }),
  });
  requireOk(decisionResponse.status === 200, `AI 接受決策保存失敗：HTTP ${decisionResponse.status}`);
  const decisionBody = await decisionResponse.json();
  requireOk(decisionBody.session?.statistics?.accepted === sourceCues.length, 'AI 接受決策數量不符');

  const acceptedCues = sourceCues.map((cue) => ({
    ...cue,
    start: srtTimeToSeconds(cue.start),
    end: srtTimeToSeconds(cue.end),
    text: suggestions.find((item) => String(item.id) === String(cue.id)).text,
  }));
  const undoResponse = await api(`/api/jobs/${encodeURIComponent(job.jobId)}/undo-ai-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: session.sessionId, cues: acceptedCues }),
  });
  requireOk(undoResponse.status === 200, `AI undo 失敗：HTTP ${undoResponse.status}`);
  const undo = await undoResponse.json();
  requireOk(undo.conflicts.length === 0 && undo.changes.length === sourceCues.length, 'AI undo 未完整還原已接受建議');

  const redoResponse = await api(`/api/jobs/${encodeURIComponent(job.jobId)}/redo-ai-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: session.sessionId, cues: sourceCues }),
  });
  requireOk(redoResponse.status === 200, `AI redo 失敗：HTTP ${redoResponse.status}`);
  const redo = await redoResponse.json();
  requireOk(redo.conflicts.length === 0 && redo.changes.length === sourceCues.length, 'AI redo 未完整重套已接受建議');

  const bilingualCues = sourceCues.map((cue) => ({
    ...cue,
    start: srtTimeToSeconds(cue.start),
    end: srtTimeToSeconds(cue.end),
    startRaw: cue.start,
    endRaw: cue.end,
    sourceText: cue.text,
    translatedText: suggestions.find((item) => String(item.id) === String(cue.id)).text,
    text: suggestions.find((item) => String(item.id) === String(cue.id)).text,
  }));
  const subtitle = bilingualCues.map((cue) => `${cue.id}\n${cue.start} --> ${cue.end}\n${cue.sourceText}\n${cue.translatedText}`).join('\n\n') + '\n';
  const saveResponse = await api(`/api/jobs/${encodeURIComponent(job.jobId)}/save-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subtitle, bilingualCues, bilingualLayout: 'source-top' }),
  });
  requireOk(saveResponse.status === 200, `接受後保存校閱結果失敗：HTTP ${saveResponse.status}`);
  const savedReviewPath = path.join(dataDir, job.jobId, 'review-output', 'reviewed.srt');
  requireOk(fs.existsSync(inputSrtPath) && fs.existsSync(savedReviewPath), '原始或校閱字幕檔未建立');
  const afterSaveSrt = fs.readFileSync(inputSrtPath, 'utf8');
  const reviewDataResponse = await api(`/api/jobs/${encodeURIComponent(job.jobId)}/review-data`);
  requireOk(reviewDataResponse.status === 200, `校閱資料查詢失敗：HTTP ${reviewDataResponse.status}`);
  const reviewData = await reviewDataResponse.json();
  requireOk(reviewData.bilingualCues?.length === sourceCues.length, '校閱資料 cue 數量不符');
  requireOk(reviewData.bilingualCues.every((cue, index) => cue.start === srtTimeToSeconds(sourceCues[index].start) && cue.end === srtTimeToSeconds(sourceCues[index].end)), '接受後時間碼發生變更');
  requireOk(afterSaveSrt === originalSrt, '原始字幕檔被人工接受流程覆蓋');

  evidence.status = 'pass';
  evidence.job = { created: true, aiStatus: aiRecord.status, suggestionCount: suggestions.length, totalRetries: aiRecord.result?.totalRetries ?? null };
  evidence.session = { created: true, accepted: decisionBody.session.statistics.accepted, undoChanges: undo.changes.length, redoChanges: redo.changes.length };
  evidence.review = { saved: true, cueCount: reviewData.bilingualCues.length, timecodesUnchanged: true, sourceSrtPreserved: true, sourceSrtBeforeSha256: originalSrtSha256, sourceSrtAfterSha256: sha256(afterSaveSrt), sourceSrtSha256: originalSrtSha256, reviewSrtSha256: sha256(fs.readFileSync(savedReviewPath, 'utf8')) };
} catch (error) {
  evidence.error = { message: String(error?.message || error), code: String(error?.code || '') };
} finally {
  await stopProcess(appProcess);
  evidence.completedAt = new Date().toISOString();
  evidence.elapsedMs = Date.now() - started;
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite existing Ollama product evidence: ${outputPath}`);
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    console.log(JSON.stringify({ outputPath, status: evidence.status, model, elapsedMs: evidence.elapsedMs, error: evidence.error || null }, null, 2));
    if (evidence.status !== 'pass') process.exitCode = 1;
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}
