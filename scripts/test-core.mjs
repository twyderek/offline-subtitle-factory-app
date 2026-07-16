import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceAppDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = process.env.OFFLINE_SUBTITLE_TEST_APP_DIR
  ? path.resolve(process.env.OFFLINE_SUBTITLE_TEST_APP_DIR)
  : sourceAppDir;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-subtitle-test-'));
const port = 19000 + Math.floor(Math.random() * 1000);
const token = `test-${Date.now()}-${Math.random()}`;
const baseUrl = `http://127.0.0.1:${port}`;
let output = '';
const serverCommand = process.env.OFFLINE_SUBTITLE_TEST_NODE || process.execPath;

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

  const form = new FormData();
  form.set('video', new Blob(['fake-video']), 'sample.mp4');
  form.set('existingSrt', new Blob(['1\n00:00:00,000 --> 00:00:01,000\n測試字幕\n']), 'sample.srt');
  form.set('language', 'zh-TW');
  form.set('performancePreset', 'balanced');
  const createdResponse = await api('/api/jobs', { method: 'POST', body: form });
  if (createdResponse.status !== 201) throw new Error(await createdResponse.text());
  const created = await createdResponse.json();

  const inputVideo = path.join(dataDir, created.jobId, 'input', 'sample.mp4');
  assert.equal(fs.readFileSync(inputVideo, 'utf8'), 'fake-video', '串流上傳檔案內容應一致');

  const started = await api(`/api/jobs/${created.jobId}/start`, { method: 'POST' });
  assert.equal(started.status, 202, '任務應可啟動');
  const completed = await waitForJob(created.jobId, ['completed']);
  assert.equal(completed.stage, 'ready-review');

  const pagedResponse = await api('/api/jobs?offset=0&limit=1');
  const paged = await pagedResponse.json();
  assert.equal(paged.jobs.length, 1);
  assert.equal(paged.total, 1);
  assert.equal(paged.hasMore, false);

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
  fs.rmSync(dataDir, { recursive: true, force: true });
}
