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
fs.writeFileSync(path.join(dataDir, 'config', 'settings.json'), JSON.stringify({ ai: { language: 'invalid legacy value' } }));
const port = 19000 + Math.floor(Math.random() * 1000);
const token = `test-${Date.now()}-${Math.random()}`;
const baseUrl = `http://127.0.0.1:${port}`;
let output = '';
const serverCommand = process.env.OFFLINE_SUBTITLE_TEST_NODE || process.execPath;
const fakeAiPort = 21000 + Math.floor(Math.random() * 1000);
let fakeAiMode = 'retry-once';
let fakeAiCalls = 0;
const fakeAiCueIds = [];
const fakeAiServer = createServer((req, res) => {
  if (req.url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'test-model' }] }));
    return;
  }
  if (req.url === '/v1/chat/completions' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      fakeAiCalls += 1;
      if (fakeAiMode === 'retry-once' && fakeAiCalls === 1) {
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '0' });
        res.end(JSON.stringify({ error: { message: 'test rate limit', code: 'rate_limit' } }));
        return;
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const marker = '待處理字幕：\n';
      const content = body.messages?.[1]?.content || '';
      const cues = JSON.parse(content.slice(content.indexOf(marker) + marker.length));
      fakeAiCueIds.push(...cues.map((cue) => cue.id));
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

  const badOrigin = await api('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' },
    body: '{}',
  });
  assert.equal(badOrigin.status, 403, '非本機 Origin 應被拒絕');

  const legacySettingsResponse = await api('/api/settings');
  const legacySettings = await legacySettingsResponse.json();
  assert.equal(legacySettings.ai.language, 'zh-TW', '舊設定檔的非法語言值應在啟動時安全回退繁中');

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
      provider: 'openai-compatible',
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
  assert.equal(enabledAiSettingsResponse.status, 200, 'AI 可靠性測試設定應可啟用');
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

  const vttResponse = await api(`/api/jobs/${created.jobId}/subtitle?format=vtt`);
  assert.equal(vttResponse.status, 200, '已完成任務應可下載 VTT');
  const vttText = await vttResponse.text();
  assert.ok(vttText.startsWith('WEBVTT'), 'VTT 內容應包含 WEBVTT header');
  assert.ok(vttText.includes('00:00:00.000 --> 00:00:01.000'), 'VTT 時間格式應使用小數點');

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

  console.log('核心回歸測試通過：API token、Origin、串流上傳、任務執行、真實聲波、精準修剪、字幕重算、還原、分頁與取消狀態');
} finally {
  server.kill('SIGTERM');
  await new Promise((resolve) => fakeAiServer.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
}
