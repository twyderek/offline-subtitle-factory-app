import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceAppDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = process.env.OFFLINE_SUBTITLE_TEST_APP_DIR
  ? path.resolve(process.env.OFFLINE_SUBTITLE_TEST_APP_DIR)
  : sourceAppDir;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-subtitle-test-'));
fs.mkdirSync(path.join(dataDir, 'config'), { recursive: true });
fs.writeFileSync(path.join(dataDir, 'config', 'settings.json'), JSON.stringify({ appLanguage: 'zh-CN', ai: { language: 'invalid legacy value' } }));
fs.mkdirSync(path.join(dataDir, 'config', 'breeze-asr'), { recursive: true });
fs.writeFileSync(path.join(dataDir, 'config', 'breeze-asr', 'breeze-asr-25.pt'), 'deterministic Breeze mock checkpoint');
const port = 19000 + Math.floor(Math.random() * 1000);
const token = `test-${Date.now()}-${Math.random()}`;
const baseUrl = `http://127.0.0.1:${port}`;
let output = '';
const serverCommand = process.env.OFFLINE_SUBTITLE_TEST_NODE || process.execPath;
const fakeAiPort = 21000 + Math.floor(Math.random() * 1000);
const redirectReceiverPort = 22000 + Math.floor(Math.random() * 1000);
let fakeAiMode = 'retry-once';
let fakeAiCalls = 0;
let redirectedAiRequests = 0;
let slowAiRequestsClosed = 0;
const fakeAiCueIds = [];
const redirectReceiver = createServer((_req, res) => {
  redirectedAiRequests += 1;
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end('{}');
});
await new Promise((resolve, reject) => {
  redirectReceiver.once('error', reject);
  redirectReceiver.listen(redirectReceiverPort, '0.0.0.0', resolve);
});
const fakeAiServer = createServer((req, res) => {
  if (req.url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'test-model' }] }));
    return;
  }
  if (req.url === '/v1/chat/completions' && req.method === 'POST') {
    if (fakeAiMode === 'redirect-307') {
      res.writeHead(307, { Location: `http://0.0.0.0:${redirectReceiverPort}/receive` });
      res.end();
      return;
    }
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (body.messages?.[1]?.content?.includes('Return exactly')) {
        if (fakeAiMode === 'invalid-capability') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ choices: [{ message: { content: 'not json' } }] }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: '{"traditionalChinese":"繁體中文"}' } }] }));
        return;
      }
      fakeAiCalls += 1;
      if (fakeAiMode === 'retry-once' && fakeAiCalls === 1) {
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '0' });
        res.end(JSON.stringify({ error: { message: 'test rate limit', code: 'rate_limit' } }));
        return;
      }
      const marker = '待處理字幕：\n';
      const content = body.messages?.[1]?.content || '';
      const cues = JSON.parse(content.slice(content.indexOf(marker) + marker.length));
      fakeAiCueIds.push(...cues.map((cue) => cue.id));
      if (fakeAiMode === 'slow' || (fakeAiMode === 'slow-after-first' && cues.some((cue) => Number(cue.id) === 2))) {
        const timer = setTimeout(() => {
          if (!res.destroyed) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ cues: [] }) } }] }));
          }
        }, 5000);
        timer.unref();
        res.once('close', () => {
          clearTimeout(timer);
          slowAiRequestsClosed += 1;
        });
        return;
      }
      if (fakeAiMode === 'fail-second' && cues.some((cue) => Number(cue.id) === 2)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'test permanent batch error', code: 'bad_request' } }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ cues: cues.map((cue) => ({ id: cue.id, text: `${cue.text}。`, reason: 'mock optimized' })) }) } }] }));
    });
    return;
  }
  res.writeHead(404).end();
});
await new Promise((resolve, reject) => {
  fakeAiServer.once('error', reject);
  fakeAiServer.listen(fakeAiPort, '127.0.0.1', resolve);
});

const server = spawn(serverCommand, [path.join(appDir, 'server.mjs')], {
  cwd: appDir,
  env: {
    ...process.env,
    PORT: String(port),
    OFFLINE_SUBTITLE_DATA_DIR: dataDir,
    OFFLINE_SUBTITLE_SETTINGS_DIR: path.join(dataDir, 'config'),
    OFFLINE_SUBTITLE_TOOLS_DIR: process.env.OFFLINE_SUBTITLE_TEST_TOOLS_DIR || path.join(appDir, 'tools'),
    OFFLINE_SUBTITLE_API_TOKEN: token,
    NODE_ENV: 'test',
    OFFLINE_SUBTITLE_TEST_BREEZE_RUNNER: path.join(sourceAppDir, 'scripts', 'fixtures', 'mock-breeze-runtime.mjs'),
    OFFLINE_SUBTITLE_TEST_WHISPER_PARTIAL_DOWNLOAD: '1',
    ELECTRON_RUN_AS_NODE: process.env.OFFLINE_SUBTITLE_TEST_NODE ? '1' : process.env.ELECTRON_RUN_AS_NODE,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', (chunk) => { output += chunk.toString('utf8'); });
server.stderr.on('data', (chunk) => { output += chunk.toString('utf8'); });

function api(pathname, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('X-Offline-Subtitle-Token', token);
  return fetch(`${baseUrl}${pathname}`, { ...options, headers });
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
  throw new Error(`測試 server 啟動逾時\n${output}`);
}

async function waitForJob(jobId, expectedStatuses, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await api(`/api/jobs/${encodeURIComponent(jobId)}/status`);
    const status = await response.json();
    if (expectedStatuses.includes(status.status)) return status;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`任務 ${jobId} 未進入預期狀態：${expectedStatuses.join(', ')}`);
}

async function waitForJobStage(jobId, expectedStage, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await api(`/api/jobs/${encodeURIComponent(jobId)}/status`);
    const status = await response.json();
    if (status.stage === expectedStage) return status;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`任務 ${jobId} 未進入預期階段：${expectedStage}`);
}

async function waitForFile(filePath, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`等待測試檔案逾時：${filePath}`);
}

async function waitForTrim(jobId, expectedStatuses, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await api(`/api/jobs/${encodeURIComponent(jobId)}/trim-status`);
    const status = await response.json();
    if (expectedStatuses.includes(status.status)) return status;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`修剪任務 ${jobId} 未進入預期狀態：${expectedStatuses.join(', ')}`);
}

async function waitForAi(jobId, expectedStatuses, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await api(`/api/jobs/${encodeURIComponent(jobId)}/ai-optimize`);
    const status = await response.json();
    if (expectedStatuses.includes(status.status)) return status;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`AI 任務 ${jobId} 未進入預期狀態：${expectedStatuses.join(', ')}`);
}

async function waitFor(predicate, message, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(message);
}

function createTestWav() {
  const sampleRate = 8000;
  const samples = sampleRate;
  const dataSize = samples * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < samples; index += 1) {
    wav.writeInt16LE(Math.round(Math.sin((index / sampleRate) * Math.PI * 2 * 440) * 12000), 44 + index * 2);
  }
  return wav;
}

try {
  await waitForServer();

  const unauthorized = await fetch(`${baseUrl}/api/jobs`);
  assert.equal(unauthorized.status, 401, '缺少 API token 應被拒絕');

  const whisperCatalogResponse = await api('/api/whisper-models');
  assert.equal(whisperCatalogResponse.status, 200, 'Whisper 模型狀態 API 應可讀取');
  const whisperCatalog = await whisperCatalogResponse.json();
  assert.equal(whisperCatalog.ok, true);
  assert.equal(whisperCatalog.models.base.download.size, 147951465, 'Base 下載大小應固定');
  assert.match(whisperCatalog.models.small.download.url, /resolve\/5359861c739e955e79d9a303bcbc70fb988958b1/);
  assert.match(whisperCatalog.cacheDirectory, /whisper-models/);
  const whisperCancelResponse = await api('/api/whisper-models/base/download', { method: 'DELETE' });
  assert.equal(whisperCancelResponse.status, 200, '沒有進行中下載時，取消 API 應安全且具冪等性');
  const whisperCancel = await whisperCancelResponse.json();
  assert.equal(whisperCancel.ok, true);
  assert.equal(whisperCancel.model.status, 'missing');

  const whisperStartResponse = await api('/api/whisper-models/base/download', { method: 'POST' });
  assert.equal(whisperStartResponse.status, 202, '缺少 Base 時，下載 API 應進入 downloading');
  let activeWhisperDownload;
  const activeDownloadDeadline = Date.now() + 5000;
  while (Date.now() < activeDownloadDeadline) {
    const response = await api('/api/whisper-models/base/download');
    activeWhisperDownload = (await response.json()).model;
    if (activeWhisperDownload.status === 'downloading' && activeWhisperDownload.bytesDownloaded > 0) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.equal(activeWhisperDownload?.status, 'downloading', '取消前模型應仍在下載');
  assert.ok(activeWhisperDownload.bytesDownloaded > 0, '取消前應已寫入部分 response body');
  const whisperCacheDir = path.join(dataDir, 'config', 'whisper-models');
  assert.equal(fs.readdirSync(whisperCacheDir).filter((file) => file.endsWith('.download')).length, 1, '進行中 API 下載應有一個暫存檔');
  const activeWhisperCancelResponse = await api('/api/whisper-models/base/download', { method: 'DELETE' });
  assert.equal(activeWhisperCancelResponse.status, 200, '進行中下載應可由 DELETE 取消');
  const activeWhisperCancel = await activeWhisperCancelResponse.json();
  assert.equal(activeWhisperCancel.model.status, 'cancelled');
  await waitFor(
    () => fs.readdirSync(whisperCacheDir).every((file) => !file.endsWith('.download') && !file.endsWith('.previous')),
    '進行中下載取消後仍殘留暫存或替換備份檔',
  );

  const badOrigin = await api('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' },
    body: '{}',
  });
  assert.equal(badOrigin.status, 403, '非本機 Origin 應被拒絕');

  const legacySettingsResponse = await api('/api/settings');
  const legacySettings = await legacySettingsResponse.json();
  assert.equal(legacySettings.ai.language, 'zh-TW', '舊設定檔的非法語言值應在啟動時安全回退繁中');
  assert.equal(legacySettings.appLanguage, 'zh-TW', '舊設定檔的簡體中文介面語言應安全回退繁中');

  const providerSettingsModuleResponse = await api('/ai-provider-settings.mjs');
  assert.equal(providerSettingsModuleResponse.status, 200, 'AI provider 表單狀態模組應可由 renderer 載入');
  assert.match(providerSettingsModuleResponse.headers.get('content-type') || '', /^text\/javascript/, 'AI provider 表單狀態模組必須使用 JavaScript MIME type');

  const invalidGeneralSettingsResponse = await api('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ai: { ...legacySettings.ai, language: 'not a language' } }),
  });
  assert.equal(invalidGeneralSettingsResponse.status, 400, '一般設定 API 的新非法語言值也應拒絕');

  const aiSettingsResponse = await api('/api/ai/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enabled: false,
      provider: 'openai-compatible',
      baseUrl: 'https://api.example.test/v1',
      model: 'test-model',
      batchSize: 12,
      language: 'zh-TW',
      timeoutSeconds: 30,
      instructions: '測試設定',
      apiKey: 'test-secret-must-not-leak',
    }),
  });
  assert.equal(aiSettingsResponse.status, 200, 'AI 設定應可儲存');
  const savedAiSettings = await aiSettingsResponse.json();
  assert.equal(savedAiSettings.settings.hasApiKey, true, 'AI 設定應回報已有金鑰');
  assert.equal(JSON.stringify(savedAiSettings).includes('test-secret-must-not-leak'), false, 'AI Key 不可出現在設定 API 回應');
  const aiSettingsGetResponse = await api('/api/ai/settings');
  const loadedAiSettings = await aiSettingsGetResponse.json();
  assert.equal(loadedAiSettings.settings.apiKey, undefined, '讀取 AI 設定不可回傳 API Key 欄位');
  assert.equal(fs.readFileSync(path.join(dataDir, 'config', 'settings.json'), 'utf8').includes('test-secret-must-not-leak'), false, '一般設定檔不可包含 API Key');

  const localAiSettingsResponse = await api('/api/ai/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...loadedAiSettings.settings,
      enabled: true,
      provider: 'ollama',
      baseUrl: `http://127.0.0.1:${fakeAiPort}/v1`,
      model: 'test-model',
      batchSize: 30,
      consentGrantedAt: '',
    }),
  });
  assert.equal(localAiSettingsResponse.status, 200, 'Ollama loopback 應可在無 API Key 與雲端同意下啟用');
  const localAiSettings = await localAiSettingsResponse.json();
  assert.equal(localAiSettings.settings.requiresApiKey, false, 'loopback 設定應明確回報不需要 API Key');
  assert.equal(localAiSettings.settings.endpointPrivacy, 'local', 'loopback 設定應標示為本機');
  assert.equal(localAiSettings.settings.batchSize, 20, '本機 provider 批次上限應小於雲端 provider');
  const localModelsResponse = await api('/api/ai/models');
  assert.equal(localModelsResponse.status, 200, '本機模型清單應可在無 Key 下讀取');
  const localModels = await localModelsResponse.json();
  assert.deepEqual(localModels.models, [{ id: 'test-model' }], '本機模型清單應只回傳正規模型 ID');
  assert.equal((await api('/api/ai/test', { method: 'POST' })).status, 200, '本機 provider 應可在無 Key 下測試連線');
  const localCapabilitiesResponse = await api('/api/ai/capabilities', { method: 'POST' });
  const localCapabilities = await localCapabilitiesResponse.json();
  assert.equal(localCapabilitiesResponse.status, 200, `本機模型能力檢查應可在無 Key 下執行：${localCapabilities.error || ''}`);
  assert.equal(localCapabilities.capabilities.jsonOutput, true, '能力檢查應驗證 JSON 輸出');
  assert.equal(localCapabilities.capabilities.traditionalChinese, true, '能力檢查應驗證指定繁體中文回應');
  fakeAiMode = 'invalid-capability';
  const invalidCapabilitiesResponse = await api('/api/ai/capabilities', { method: 'POST' });
  const invalidCapabilities = await invalidCapabilitiesResponse.json();
  assert.equal(invalidCapabilitiesResponse.status, 200, '不支援 JSON 的本機模型應回傳能力結果而非造成服務崩潰');
  assert.equal(invalidCapabilities.capabilities.jsonOutput, false, '無效 JSON 回應必須標記模型不支援結構化輸出');
  assert.equal(invalidCapabilities.capabilities.traditionalChinese, false, '無效能力回應不得誤判為支援繁體中文');
  fakeAiMode = 'redirect-307';
  redirectedAiRequests = 0;
  const redirectedCapabilityResponse = await api('/api/ai/capabilities', { method: 'POST' });
  assert.equal(redirectedCapabilityResponse.status, 422, 'loopback AI redirect 必須被 transport 拒絕');
  assert.equal((await redirectedCapabilityResponse.json()).error, 'AI 服務重新導向已被安全政策拒絕');
  assert.equal(redirectedAiRequests, 0, '字幕請求不得送達 redirect 的非 allowlist 第二站');
  fakeAiMode = 'retry-once';
  fakeAiCalls = 0;

  const restoreAfterLocalResponse = await api('/api/ai/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loadedAiSettings.settings),
  });
  assert.equal(restoreAfterLocalResponse.status, 200, '本機 provider 測試後應可恢復原設定');
  const existingAiSecrets = JSON.parse(fs.readFileSync(path.join(dataDir, 'config', 'ai-secrets.json'), 'utf8'));
  fs.writeFileSync(path.join(dataDir, 'config', 'ai-secrets.json'), JSON.stringify({
    providers: { ...(existingAiSecrets.providers || {}), gemini: 'gemini-test-secret' },
  }));

  const migratedLegacyGeminiResponse = await api('/api/ai/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...loadedAiSettings.settings,
      provider: 'openai-compatible',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/interactions',
      model: 'gemini-3.5-flash',
      profiles: {
        ...(loadedAiSettings.settings.profiles || {}),
        gemini: { baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-2.5-flash' },
      },
    }),
  });
  assert.equal(migratedLegacyGeminiResponse.status, 200, '舊 Gemini／OpenAI-compatible 混用設定應可安全遷移');
  const migratedLegacyGemini = await migratedLegacyGeminiResponse.json();
  assert.equal(migratedLegacyGemini.settings.provider, 'openai-compatible', '遷移後供應商應維持 OpenAI-compatible');
  assert.equal(migratedLegacyGemini.settings.baseUrl, '', 'OpenAI-compatible 不可沿用 Gemini Base URL');
  assert.equal(migratedLegacyGemini.settings.model, '', 'OpenAI-compatible 不可沿用 Gemini 模型');
  const persistedMigratedSettings = JSON.parse(fs.readFileSync(path.join(dataDir, 'config', 'settings.json'), 'utf8'));
  assert.equal(persistedMigratedSettings.ai.provider, 'openai-compatible', '遷移後設定檔應保存正確供應商');
  assert.equal(persistedMigratedSettings.ai.baseUrl, '', '遷移後設定檔不可保留 Gemini Base URL');
  assert.equal(persistedMigratedSettings.ai.model, '', '遷移後設定檔不可保留 Gemini 模型');
  assert.equal(persistedMigratedSettings.ai.profiles.gemini.model, 'gemini-2.5-flash', '遷移不可刪除 Gemini profile');
  const persistedAiSecrets = JSON.parse(fs.readFileSync(path.join(dataDir, 'config', 'ai-secrets.json'), 'utf8'));
  assert.equal(persistedAiSecrets.providers['openai-compatible'], 'test-secret-must-not-leak', '既有 provider secret 應維持隔離保存');
  assert.equal(persistedAiSecrets.providers.gemini, 'gemini-test-secret', '遷移不可刪除 Gemini provider secret');

  const invalidProviderResponse = await api('/api/ai/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...loadedAiSettings.settings, provider: 'unsupported-provider' }),
  });
  assert.equal(invalidProviderResponse.status, 400, 'AI 設定 API 應明確拒絕不支援的供應商');

  const invalidProfileResponse = await api('/api/ai/profile?provider=unsupported-provider');
  assert.equal(invalidProfileResponse.status, 400, 'AI profile API 不可把非法供應商無聲回退到目前供應商');

  const emptyAzureSettingsResponse = await api('/api/ai/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...loadedAiSettings.settings, provider: 'azure', baseUrl: '', model: '', deployment: '' }),
  });
  assert.equal(emptyAzureSettingsResponse.status, 200, '停用狀態下 Azure 空白 Base URL 應可保存');
  assert.equal((await emptyAzureSettingsResponse.json()).settings.baseUrl, '', 'Azure 空白 Base URL 不可誤套 OpenAI 預設網址');

  const groqSettingsResponse = await api('/api/ai/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...loadedAiSettings.settings,
      provider: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'llama-3.3-70b-versatile',
      apiKey: 'groq-secret-must-not-leak',
    }),
  });
  assert.equal(groqSettingsResponse.status, 200, 'Groq 設定應可保存');
  const savedGroqSettings = await groqSettingsResponse.json();
  assert.equal(savedGroqSettings.settings.provider, 'groq', 'Groq 不可被無聲回退成 OpenAI-compatible');
  assert.equal(JSON.stringify(savedGroqSettings).includes('groq-secret-must-not-leak'), false, 'Groq API Key 不可出現在回應');
  const groqProfile = await (await api('/api/ai/profile?provider=groq')).json();
  assert.equal(groqProfile.profile.model, 'llama-3.3-70b-versatile', 'Groq profile 應依供應商隔離保存');
  assert.equal(groqProfile.hasApiKey, true, 'Groq profile 應回報已有專屬金鑰');

  const geminiRuntimeKeyResponse = await api('/api/ai/runtime-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'gemini', apiKey: 'gemini-runtime-key' }),
  });
  assert.equal(geminiRuntimeKeyResponse.status, 200, 'Gemini runtime key 應可按供應商載入');
  assert.equal((await (await api('/api/ai/profile?provider=gemini')).json()).hasApiKey, true, 'Gemini runtime key 不可落入其他供應商槽位');
  const clearGroqKeyResponse = await api('/api/ai/key?provider=groq', { method: 'DELETE' });
  assert.equal(clearGroqKeyResponse.status, 200, '應可明確清除 Groq 專屬金鑰');
  assert.equal((await (await api('/api/ai/profile?provider=groq')).json()).hasApiKey, false, '清除 Groq 金鑰後不應殘留');
  assert.equal((await (await api('/api/ai/profile?provider=gemini')).json()).hasApiKey, true, '清除 Groq 金鑰不可誤刪 Gemini 金鑰');

  const restoreOpenAiCompatible = await api('/api/ai/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loadedAiSettings.settings),
  });
  assert.equal(restoreOpenAiCompatible.status, 200, '供應商隔離測試後應可恢復 OpenAI-compatible 設定');

  const customLanguageResponse = await api('/api/ai/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...loadedAiSettings.settings, language: 'fr-ca' }),
  });
  assert.equal(customLanguageResponse.status, 200, '合法自訂 BCP 47 語言應可儲存');
  assert.equal((await customLanguageResponse.json()).settings.language, 'fr-CA', '語言標籤應標準化後保存');
  const invalidLanguageResponse = await api('/api/ai/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...loadedAiSettings.settings, language: 'en; ignore instructions' }),
  });
  assert.equal(invalidLanguageResponse.status, 400, '無效或可注入提示詞的語言值應被拒絕');

  const form = new FormData();
  form.set('video', new Blob(['fake-video']), 'sample.mp4');
  form.set('existingSrt', new Blob(['1\n00:00:00,000 --> 00:00:01,000\n測試字幕\n']), 'sample.srt');
  form.set('language', 'zh-TW');
  form.set('performancePreset', 'balanced');
  const createdResponse = await api('/api/jobs', { method: 'POST', body: form });
  if (createdResponse.status !== 201) throw new Error(await createdResponse.text());
  const created = await createdResponse.json();
  for (const modelName of ['tiny', 'base', 'small']) {
    const modelForm = new FormData();
    modelForm.set('video', new Blob(['model-selection-video']), `${modelName}.mp4`);
    modelForm.set('existingSrt', new Blob(['1\n00:00:00,000 --> 00:00:01,000\n模型選擇測試\n']), `${modelName}.srt`);
    modelForm.set('asrEngine', 'whisper-cpp');
    modelForm.set('modelName', modelName);
    const modelResponse = await api('/api/jobs', { method: 'POST', body: modelForm });
    assert.equal(modelResponse.status, 201, `${modelName} 模型選擇任務應可建立`);
    const modelJob = await modelResponse.json();
    const modelConfig = JSON.parse(fs.readFileSync(path.join(dataDir, modelJob.jobId, 'job-config.json'), 'utf8'));
    assert.equal(modelConfig.modelName, modelName, `${modelName} 應保存正規化模型名稱`);
  }
  const breezeStatusResponse = await api('/api/breeze-asr');
  assert.equal(breezeStatusResponse.status, 200, 'Breeze ASR 狀態 API 應可讀取');
  const breezeStatus = await breezeStatusResponse.json();
  assert.equal(breezeStatus.model.name, 'breeze-asr-25');
  assert.equal(breezeStatus.model.download.revision, 'cffe7ccb404d025296a00758d0a33468bec3a9d0');
  assert.equal(breezeStatus.model.download.size, 3087008569);
  const breezeForm = new FormData();
  breezeForm.set('video', new Blob(['breeze-selection-video']), 'breeze.mp4');
  breezeForm.set('existingSrt', new Blob(['1\n00:00:00,000 --> 00:00:01,000\nBreeze 模型選擇測試\n']), 'breeze.srt');
  breezeForm.set('asrEngine', 'breeze-asr-25');
  const breezeResponse = await api('/api/jobs', { method: 'POST', body: breezeForm });
  assert.equal(breezeResponse.status, 201, 'Breeze ASR 25 任務設定應可建立');
  const breezeJob = await breezeResponse.json();
  const breezeConfig = JSON.parse(fs.readFileSync(path.join(dataDir, breezeJob.jobId, 'job-config.json'), 'utf8'));
  assert.equal(breezeConfig.asrEngine, 'breeze-asr-25', 'Breeze ASR 25 引擎選擇應保存');

  const breezeRunForm = new FormData();
  breezeRunForm.set('video', new Blob([createTestWav()], { type: 'audio/wav' }), 'breeze-run.wav');
  breezeRunForm.set('asrEngine', 'breeze-asr-25');
  breezeRunForm.set('language', 'zh-TW');
  const breezeRunResponse = await api('/api/jobs', { method: 'POST', body: breezeRunForm });
  assert.equal(breezeRunResponse.status, 201, 'Breeze mock 轉錄任務應可建立');
  const breezeRunJob = await breezeRunResponse.json();
  assert.equal((await api(`/api/jobs/${breezeRunJob.jobId}/start`, { method: 'POST' })).status, 202, 'Breeze mock 轉錄任務應可啟動');
  const breezeCompleted = await waitForJob(breezeRunJob.jobId, ['completed', 'failed', 'needs-action'], 15000);
  assert.equal(breezeCompleted.status, 'completed', `Breeze mock 轉錄失敗：${breezeCompleted.message}`);
  assert.equal(breezeCompleted.metrics?.asrEngine, 'breeze-asr-25');
  assert.match(fs.readFileSync(path.join(dataDir, breezeRunJob.jobId, 'working', 'draft.srt'), 'utf8'), /Breeze mock 字幕/);

  const breezeCancelForm = new FormData();
  breezeCancelForm.set('video', new Blob([createTestWav()], { type: 'audio/wav' }), 'breeze-cancel.wav');
  breezeCancelForm.set('asrEngine', 'breeze-asr-25');
  const breezeCancelResponse = await api('/api/jobs', { method: 'POST', body: breezeCancelForm });
  assert.equal(breezeCancelResponse.status, 201, 'Breeze mock 取消任務應可建立');
  const breezeCancelJob = await breezeCancelResponse.json();
  const breezeCancelWorking = path.join(dataDir, breezeCancelJob.jobId, 'working');
  fs.writeFileSync(path.join(breezeCancelWorking, 'breeze-mock-delay'), 'yes');
  assert.equal((await api(`/api/jobs/${breezeCancelJob.jobId}/start`, { method: 'POST' })).status, 202);
  await waitForJobStage(breezeCancelJob.jobId, 'transcribing', 15000);
  await waitForFile(path.join(breezeCancelWorking, 'breeze-child-started'), 15000);
  assert.equal((await api(`/api/jobs/${breezeCancelJob.jobId}/cancel`, { method: 'POST' })).status, 202);
  const cancellingResponse = await api(`/api/jobs/${breezeCancelJob.jobId}/status`);
  const cancelling = await cancellingResponse.json();
  assert.equal(cancelling.stage, 'cancelling', 'child 尚未 close 前應維持 cancelling');
  assert.equal(cancelling.status, 'running', 'child 尚未 close 前不可提前標記 cancelled');
  const breezeCancelled = await waitForJob(breezeCancelJob.jobId, ['cancelled'], 10000);
  assert.equal(breezeCancelled.stage, 'cancelled');
  assert.equal(fs.existsSync(path.join(breezeCancelWorking, 'breeze-child-closed')), true, '確認 child close 後才完成取消');
  assert.equal(fs.existsSync(path.join(breezeCancelWorking, 'whisper-input.wav')), false, '取消後應清理暫存音訊');
  assert.equal(fs.existsSync(path.join(breezeCancelWorking, 'whisper-input.srt')), false, '取消後應清理部分 SRT');

  if (process.platform !== 'win32') {
    const breezeForceForm = new FormData();
    breezeForceForm.set('video', new Blob([createTestWav()], { type: 'audio/wav' }), 'breeze-force-cancel.wav');
    breezeForceForm.set('asrEngine', 'breeze-asr-25');
    const breezeForceResponse = await api('/api/jobs', { method: 'POST', body: breezeForceForm });
    assert.equal(breezeForceResponse.status, 201);
    const breezeForceJob = await breezeForceResponse.json();
    const breezeForceWorking = path.join(dataDir, breezeForceJob.jobId, 'working');
    fs.writeFileSync(path.join(breezeForceWorking, 'breeze-mock-delay'), 'yes');
    fs.writeFileSync(path.join(breezeForceWorking, 'breeze-mock-stubborn'), 'yes');
    await api(`/api/jobs/${breezeForceJob.jobId}/start`, { method: 'POST' });
    await waitForFile(path.join(breezeForceWorking, 'breeze-child-started'), 15000);
    const forceStartedAt = Date.now();
    await api(`/api/jobs/${breezeForceJob.jobId}/cancel`, { method: 'POST' });
    const breezeForceCancelled = await waitForJob(breezeForceJob.jobId, ['cancelled'], 10000);
    assert.equal(breezeForceCancelled.stage, 'cancelled');
    assert.ok(Date.now() - forceStartedAt >= 2800, '忽略 SIGTERM 的 child 應等待 grace period 後才由 SIGKILL 結束');
    assert.equal(fs.existsSync(path.join(breezeForceWorking, 'whisper-input.wav')), false);
    assert.equal(fs.existsSync(path.join(breezeForceWorking, 'whisper-input.srt')), false);
  }
  fs.mkdirSync(path.join(dataDir, created.jobId, 'working'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, created.jobId, 'working', 'quality-metadata.json'), JSON.stringify([{ id: 1, start: 0, end: 1, confidence: 0.1 }]));

  const disabledAiResponse = await api(`/api/jobs/${created.jobId}/ai-optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cues: [{ id: 1, start: '00:00:00,000', end: '00:00:01,000', text: '測試字幕' }] }),
  });
  assert.equal(disabledAiResponse.status, 400, 'AI 未啟用時不可啟動外部優化請求');

  const enabledAiSettingsResponse = await api('/api/ai/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enabled: true,
      provider: 'lm-studio',
      baseUrl: `http://127.0.0.1:${fakeAiPort}/v1`,
      model: 'test-model',
      batchSize: 1,
      language: 'fr-CA',
      timeoutSeconds: 10,
      maxRetries: 1,
      retryBaseMs: 100,
      instructions: '測試可靠性',
    }),
  });
  assert.equal(enabledAiSettingsResponse.status, 200, 'LM Studio 可靠性測試設定應可在無專屬 Key 下啟用');
  const reliabilityCues = [
    { id: 1, start: '00:00:00,000', end: '00:00:01,000', text: '第一段' },
    { id: 2, start: '00:00:01,000', end: '00:00:02,000', text: '第二段' },
  ];
  fakeAiMode = 'retry-once';
  fakeAiCalls = 0;
  fakeAiCueIds.length = 0;
  const invalidJobLanguageResponse = await api(`/api/jobs/${created.jobId}/ai-optimize`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cues: reliabilityCues, mode: 'proofread', language: 'bad language' }),
  });
  assert.equal(invalidJobLanguageResponse.status, 400, 'AI 任務 API 的非法語言值應拒絕');
  const retryAiResponse = await api(`/api/jobs/${created.jobId}/ai-optimize`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cues: reliabilityCues, mode: 'proofread' }),
  });
  assert.equal(retryAiResponse.status, 202, 'AI 任務應可啟動');
  const retriedAi = await waitForAi(created.jobId, ['completed', 'failed']);
  assert.equal(retriedAi.status, 'completed', retriedAi.error);
  assert.equal(retriedAi.result.totalRetries, 1, '429 應依設定完成一次自動重試');
  assert.equal(retriedAi.result.changedCues, 2);
  assert.equal(retriedAi.provider, 'lm-studio', 'LM Studio 應完成完整字幕優化流程');

  fakeAiMode = 'slow';
  fakeAiCalls = 0;
  slowAiRequestsClosed = 0;
  const slowAiResponse = await api(`/api/jobs/${created.jobId}/ai-optimize`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cues: reliabilityCues, mode: 'proofread' }),
  });
  assert.equal(slowAiResponse.status, 202, 'LM Studio 慢速任務應可啟動');
  await waitFor(() => fakeAiCalls > 0, '慢速 AI 請求未抵達本機模型服務');
  const cancelAiResponse = await api(`/api/jobs/${created.jobId}/cancel-ai-optimize`, { method: 'POST' });
  assert.equal(cancelAiResponse.status, 200, '進行中的本機 AI 任務應可取消');
  const cancelledAi = await waitForAi(created.jobId, ['cancelled']);
  assert.equal(cancelledAi.retryable, false, '尚無 checkpoint 的取消任務不應標記為可續跑');
  await waitFor(() => slowAiRequestsClosed > 0, '取消後應中止送往本機模型的 HTTP 請求');

  fakeAiMode = 'slow-after-first';
  fakeAiCalls = 0;
  slowAiRequestsClosed = 0;
  fakeAiCueIds.length = 0;
  const checkpointCancelResponse = await api(`/api/jobs/${created.jobId}/ai-optimize`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cues: reliabilityCues, mode: 'proofread' }),
  });
  assert.equal(checkpointCancelResponse.status, 202, '已有批次的本機 AI 任務應可啟動');
  await waitFor(() => {
    try { return JSON.parse(fs.readFileSync(path.join(dataDir, created.jobId, 'ai-output', 'checkpoint.json'), 'utf8')).checkpoint.nextBatchIndex === 1; }
    catch { return false; }
  }, '取消前應先完成第一批並寫入 checkpoint');
  const checkpointCancel = await api(`/api/jobs/${created.jobId}/cancel-ai-optimize`, { method: 'POST' });
  assert.equal(checkpointCancel.status, 200, '第二批執行中時本機 AI 任務應可取消');
  const checkpointCancelledAi = await waitForAi(created.jobId, ['cancelled']);
  assert.equal(checkpointCancelledAi.retryable, true, '已有 checkpoint 的取消任務應可續跑');
  await waitFor(() => slowAiRequestsClosed > 0, '第二批取消後應中止本機 HTTP 請求');
  fakeAiMode = 'success';
  fakeAiCueIds.length = 0;
  const checkpointResumeResponse = await api(`/api/jobs/${created.jobId}/resume-ai-optimize`, { method: 'POST' });
  assert.equal(checkpointResumeResponse.status, 202, '已有 checkpoint 的取消任務應可恢復');
  const checkpointResumedAi = await waitForAi(created.jobId, ['completed', 'failed']);
  assert.equal(checkpointResumedAi.status, 'completed', checkpointResumedAi.error);
  assert.deepEqual(fakeAiCueIds, [2], '取消後續跑不可重送已完成的第一批');

  fakeAiMode = 'fail-second';
  fakeAiCalls = 0;
  fakeAiCueIds.length = 0;
  await api(`/api/jobs/${created.jobId}/ai-optimize`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cues: reliabilityCues, mode: 'proofread' }),
  });
  const failedAi = await waitForAi(created.jobId, ['failed']);
  assert.equal(failedAi.retryable, true, '已有 checkpoint 的失敗任務應可恢復');
  const checkpoint = JSON.parse(fs.readFileSync(path.join(dataDir, created.jobId, 'ai-output', 'checkpoint.json'), 'utf8'));
  assert.equal(checkpoint.checkpoint.nextBatchIndex, 1, 'checkpoint 應保存第一個已完成批次');
  fakeAiMode = 'success';
  fakeAiCueIds.length = 0;
  const resumeAiResponse = await api(`/api/jobs/${created.jobId}/resume-ai-optimize`, { method: 'POST' });
  assert.equal(resumeAiResponse.status, 202, '失敗的 AI 任務應可續傳');
  const resumedAi = await waitForAi(created.jobId, ['completed', 'failed']);
  assert.equal(resumedAi.status, 'completed', resumedAi.error);
  assert.deepEqual(fakeAiCueIds, [2], '續傳不可重送已完成的第一批');

  const inputVideo = path.join(dataDir, created.jobId, 'input', 'sample.mp4');
  assert.equal(fs.readFileSync(inputVideo, 'utf8'), 'fake-video', '串流上傳檔案內容應一致');

  const chineseNameForm = new FormData();
  chineseNameForm.set('video', new Blob(['fake-chinese-video']), '課程影片測試.mp4');
  chineseNameForm.set('existingSrt', new Blob(['1\n00:00:00,000 --> 00:00:01,000\n中文檔名測試\n']), '課程字幕測試.srt');
  chineseNameForm.set('language', 'zh-TW');
  const chineseNameResponse = await api('/api/jobs', { method: 'POST', body: chineseNameForm });
  assert.equal(chineseNameResponse.status, 201, '中文檔名任務應可建立');
  const chineseNameJob = await chineseNameResponse.json();
  const chineseConfig = JSON.parse(fs.readFileSync(path.join(dataDir, chineseNameJob.jobId, 'job-config.json'), 'utf8'));
  assert.equal(chineseConfig.files.video, '課程影片測試.mp4', '上傳影片檔名應保留 UTF-8 中文');
  assert.equal(chineseConfig.files.existingSrt, '課程字幕測試.srt', '上傳 SRT 檔名應保留 UTF-8 中文');

  const mojibakeNameForm = new FormData();
  mojibakeNameForm.set('video', new Blob(['fake-mojibake-video']), Buffer.from('亂碼影片測試.mp4', 'utf8').toString('latin1'));
  mojibakeNameForm.set('existingSrt', new Blob(['1\n00:00:00,000 --> 00:00:01,000\n亂碼檔名測試\n']), Buffer.from('亂碼字幕測試.srt', 'utf8').toString('latin1'));
  mojibakeNameForm.set('language', 'zh-TW');
  const mojibakeNameResponse = await api('/api/jobs', { method: 'POST', body: mojibakeNameForm });
  assert.equal(mojibakeNameResponse.status, 201, 'mojibake 中文檔名任務應可建立');
  const mojibakeNameJob = await mojibakeNameResponse.json();
  const mojibakeConfig = JSON.parse(fs.readFileSync(path.join(dataDir, mojibakeNameJob.jobId, 'job-config.json'), 'utf8'));
  assert.equal(mojibakeConfig.files.video, '亂碼影片測試.mp4', 'mojibake 影片檔名應還原成 UTF-8 中文');
  assert.equal(mojibakeConfig.files.existingSrt, '亂碼字幕測試.srt', 'mojibake SRT 檔名應還原成 UTF-8 中文');

  const started = await api(`/api/jobs/${created.jobId}/start`, { method: 'POST' });
  assert.equal(started.status, 202, '任務應可啟動');
  const completed = await waitForJob(created.jobId, ['completed']);
  assert.equal(completed.stage, 'ready-review');
  assert.equal(fs.existsSync(path.join(dataDir, created.jobId, 'working', 'quality-metadata.json')), false, '既有 SRT /start 路徑不得沿用 stale quality metadata');

  const vttResponse = await api(`/api/jobs/${created.jobId}/subtitle?format=vtt`);
  assert.equal(vttResponse.status, 200, '已完成任務應可下載 VTT');
  const vttText = await vttResponse.text();
  assert.ok(vttText.startsWith('WEBVTT'), 'VTT 內容應包含 WEBVTT header');
  assert.ok(vttText.includes('00:00:00.000 --> 00:00:01.000'), 'VTT 時間格式應使用小數點');

  const bilingualSubtitle = '1\n00:00:00,000 --> 00:00:01,000\n原文測試\n譯文測試\n';
  const bilingualPackageResponse = await api(`/api/jobs/${created.jobId}/save-review-package`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subtitle: bilingualSubtitle,
      bilingualCues: [{ id: 1, start: 0, end: 1, sourceText: '原文測試', translatedText: '譯文測試', confidence: 0.25, no_speech_prob: 0.7 }],
      bilingualLayout: 'source-top',
      settings: { fontFamily: 'Arial', fontSize: 48, fontColor: '#ffffff', outlineColor: '#000000', outlineWidth: 2, subtitlePosition: 'bottom', marginV: 48, bold: false },
      manifest: { cueCount: 1 },
    }),
  });
  assert.equal(bilingualPackageResponse.status, 200, '雙語校稿包應可保存');
  assert.ok(fs.existsSync(path.join(dataDir, created.jobId, 'review-output', 'bilingual-cues.json')), '雙語 cue 檔案應保存');
  const bilingualReviewResponse = await api(`/api/jobs/${created.jobId}/review-data`);
  const bilingualReview = await bilingualReviewResponse.json();
  assert.equal(bilingualReview.bilingualCues[0].translatedText, '譯文測試', '雙語資料應可重新載入');
  assert.equal(bilingualReview.bilingualCues[0].confidence, 0.25, '品質 confidence 應可經 API 保存／重新載入');
  assert.equal(bilingualReview.bilingualCues[0].noSpeechProbability, 0.7, '品質 no-speech 應可經 API 保存／重新載入');
  fs.writeFileSync(path.join(dataDir, created.jobId, 'review-output', 'bilingual-cues.json'), JSON.stringify([{ id: 1, start: 0, end: 1, sourceText: '原文測試', translatedText: '譯文測試' }]));
  fs.writeFileSync(path.join(dataDir, created.jobId, 'working', 'quality-metadata.json'), JSON.stringify([{ id: 1, start: 0, end: 1, confidence: 0.2, noSpeechProbability: 0.8 }]));
  const mergedQualityReview = await (await api(`/api/jobs/${created.jobId}/review-data`)).json();
  assert.equal(mergedQualityReview.bilingualCues[0].confidence, 0.2, '既有雙語校稿包也應合併 engine quality metadata');
  assert.equal(mergedQualityReview.bilingualCues[0].noSpeechProbability, 0.8, '既有雙語校稿包也應合併 no-speech metadata');

  const bilingualAssResponse = await api(`/api/jobs/${created.jobId}/subtitle?format=ass`);
  assert.equal(bilingualAssResponse.status, 200, '雙語 ASS 應可下載');
  assert.match(await bilingualAssResponse.text(), /原文測試\\N譯文測試/, 'ASS 應使用單一換行控制碼');

  const reruleForm = new FormData();
  reruleForm.set('ruleFile', new Blob(['NORMALIZE_TERM: 測試 -> 完成\n'], { type: 'text/plain' }), 'review-rule.txt');
  reruleForm.set('subtitle', new Blob(['1\n00:00:00,000 --> 00:00:01,000\n測試字幕\n'], { type: 'text/plain' }), 'current-review.srt');
  const reruleResponse = await api(`/api/jobs/${created.jobId}/apply-rules`, { method: 'POST', body: reruleForm });
  assert.equal(reruleResponse.status, 200, '校閱階段應可二次套用規則');
  const reruleResult = await reruleResponse.json();
  assert.equal(reruleResult.changedCues, 1, '二次規則應回報修改段落');
  assert.ok(reruleResult.subtitle.includes('完成字幕'), '二次規則應更新字幕內容');

  const pagedResponse = await api('/api/jobs?offset=0&limit=1');
  const paged = await pagedResponse.json();
  assert.equal(paged.jobs.length, 1);
  assert.ok(paged.total >= 3);

  const deleteResponse = await api(`/api/jobs/${mojibakeNameJob.jobId}`, { method: 'DELETE' });
  assert.equal(deleteResponse.status, 200, '歷史任務應可刪除');
  assert.equal(fs.existsSync(path.join(dataDir, mojibakeNameJob.jobId)), false, '刪除任務後資料夾應移除');

  const cancelIdle = await api(`/api/jobs/${created.jobId}/cancel`, { method: 'POST' });
  assert.equal(cancelIdle.status, 409, '非執行中任務不可取消');

  const waveformForm = new FormData();
  waveformForm.set('video', new Blob([createTestWav()], { type: 'audio/wav' }), 'waveform-test.wav');
  waveformForm.set('existingSrt', new Blob(['1\n00:00:00,000 --> 00:00:01,000\n聲波測試\n']), 'waveform-test.srt');
  waveformForm.set('language', 'zh-TW');
  const waveformCreatedResponse = await api('/api/jobs', { method: 'POST', body: waveformForm });
  assert.equal(waveformCreatedResponse.status, 201, '聲波測試任務應建立成功');
  const waveformCreated = await waveformCreatedResponse.json();
  await api(`/api/jobs/${waveformCreated.jobId}/start`, { method: 'POST' });
  await waitForJob(waveformCreated.jobId, ['completed']);
  const waveformResponse = await api(`/api/jobs/${waveformCreated.jobId}/waveform?points=160`);
  const waveform = await waveformResponse.json();
  assert.equal(waveformResponse.status, 200, `真實聲波 API 失敗：${waveform.error || ''}`);
  assert.equal(waveform.peaks.length, 160, '聲波 API 應回傳指定數量的真實音訊取樣');
  assert.ok(waveform.peaks.some((peak) => peak > 0.1), '聲波取樣不應全部為零');
  assert.equal(waveform.source, 'ffmpeg-pcm');

  const ffmpegPath = path.join(process.env.OFFLINE_SUBTITLE_TEST_TOOLS_DIR || path.join(appDir, 'tools'), 'ffmpeg', 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  const trimSource = path.join(dataDir, 'trim-source.mp4');
  const makeVideo = spawnSync(ffmpegPath, [
    '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '4', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', '-y', trimSource,
  ], { encoding: 'utf8' });
  assert.equal(makeVideo.status, 0, `建立修剪測試影片失敗：${makeVideo.stderr}`);
  const trimForm = new FormData();
  trimForm.set('video', new Blob([fs.readFileSync(trimSource)], { type: 'video/mp4' }), 'trim-source.mp4');
  trimForm.set('existingSrt', new Blob(['1\n00:00:00,500 --> 00:00:01,500\n跨越起點\n\n2\n00:00:01,500 --> 00:00:02,500\n保留字幕\n\n3\n00:00:02,500 --> 00:00:03,500\n跨越終點\n']), 'trim-source.srt');
  trimForm.set('language', 'zh-TW');
  const trimCreatedResponse = await api('/api/jobs', { method: 'POST', body: trimForm });
  assert.equal(trimCreatedResponse.status, 201, '修剪測試任務應建立成功');
  const trimCreated = await trimCreatedResponse.json();
  const planResponse = await api(`/api/jobs/${trimCreated.jobId}/edit-plan`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ in: 1, out: 3, strategy: 'precise' }),
  });
  assert.equal(planResponse.status, 200, `儲存修剪設定失敗：${await planResponse.text()}`);
  const applyResponse = await api(`/api/jobs/${trimCreated.jobId}/apply-trim`, { method: 'POST' });
  assert.equal(applyResponse.status, 202, `啟動修剪失敗：${await applyResponse.text()}`);
  const trimCompleted = await waitForTrim(trimCreated.jobId, ['completed', 'failed'], 45000);
  assert.equal(trimCompleted.status, 'completed', trimCompleted.message);
  assert.ok(Math.abs(trimCompleted.mediaInfo.duration - 2) < 0.5, '精準修剪輸出應約為 2 秒');
  const editPlanResponse = await api(`/api/jobs/${trimCreated.jobId}/edit-plan`);
  const editPlan = await editPlanResponse.json();
  assert.ok(editPlan.plan.appliedAt, '完成修剪後 edit plan 應有 appliedAt');
  assert.ok(Math.abs(editPlan.effectiveDuration - 2) < 0.5, 'effective media 應切換為修剪成品');
  await api(`/api/jobs/${trimCreated.jobId}/start`, { method: 'POST' });
  await waitForJob(trimCreated.jobId, ['completed']);
  const trimReviewResponse = await api(`/api/jobs/${trimCreated.jobId}/review-data`);
  const trimReview = await trimReviewResponse.json();
  assert.match(trimReview.videoUrl, /working\/media-trimmed\.mp4/);
  assert.match(trimReview.subtitle, /00:00:00,000 --> 00:00:00,500/);
  const restoreResponse = await api(`/api/jobs/${trimCreated.jobId}/trim`, { method: 'DELETE' });
  assert.equal(restoreResponse.status, 200, '應可還原原始影片');
  const restoredPlanResponse = await api(`/api/jobs/${trimCreated.jobId}/edit-plan`);
  const restoredPlan = await restoredPlanResponse.json();
  assert.equal(restoredPlan.plan, null);
  assert.ok(Math.abs(restoredPlan.effectiveDuration - 4) < 0.5, '還原後應重新使用原始影片');

  if (process.env.OFFLINE_SUBTITLE_TEST_ASR_AUDIO) {
    const audioPath = path.resolve(process.env.OFFLINE_SUBTITLE_TEST_ASR_AUDIO);
    const asrForm = new FormData();
    asrForm.set('video', new Blob([fs.readFileSync(audioPath)], { type: 'audio/wav' }), path.basename(audioPath));
    asrForm.set('existingSrt', new Blob([], { type: 'application/octet-stream' }), '');
    asrForm.set('ruleFile', new Blob([], { type: 'application/octet-stream' }), '');
    asrForm.set('language', 'en');
    asrForm.set('performancePreset', 'fast');
    asrForm.set('cpuThreads', '4');
    asrForm.set('modelName', 'tiny');
    const asrCreatedResponse = await api('/api/jobs', { method: 'POST', body: asrForm });
    if (asrCreatedResponse.status !== 201) throw new Error(await asrCreatedResponse.text());
    const asrCreated = await asrCreatedResponse.json();
    const asrConfig = JSON.parse(fs.readFileSync(path.join(dataDir, asrCreated.jobId, 'job-config.json'), 'utf8'));
    assert.equal(asrConfig.files.existingSrt, null, '未選擇的空白 SRT 不可被視為有效檔案');
    assert.equal(asrConfig.files.ruleFile, null, '未選擇的空白規則檔不可被視為有效檔案');
    const asrStarted = await api(`/api/jobs/${asrCreated.jobId}/start`, { method: 'POST' });
    assert.equal(asrStarted.status, 202, '內建 ASR 任務應可啟動');
    const asrCompleted = await waitForJob(asrCreated.jobId, ['completed', 'failed', 'needs-action'], 60000);
    assert.equal(asrCompleted.status, 'completed', `內建 ASR 任務失敗：${asrCompleted.message}`);
    assert.equal(asrCompleted.metrics?.asrEngine, 'whisper.cpp');
    const draft = fs.readFileSync(path.join(dataDir, asrCreated.jobId, 'working', 'draft.srt'), 'utf8');
    assert.match(draft, /country|Americans/i, '內建 Whisper.cpp 應產生可辨識的 SRT 內容');
    console.log('內建 ASR 實際轉錄測試通過：FFmpeg 音訊前處理、Whisper.cpp、Metal／CPU 與 SRT 輸出');
  }

  console.log('核心回歸測試通過：API token、Origin、Whisper 部分下載取消清理、串流上傳、任務執行、真實聲波、精準修剪、字幕重算、還原、分頁與取消狀態');
} finally {
  server.kill('SIGTERM');
  await new Promise((resolve) => fakeAiServer.close(resolve));
  await new Promise((resolve) => redirectReceiver.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
}
