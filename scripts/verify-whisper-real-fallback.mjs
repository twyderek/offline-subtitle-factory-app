import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseWhisperFallbackLogMarkers } from '../lib/whisper-fallback-policy.mjs';
import { sanitizeDiagnosticOutput } from '../lib/whisper-probe-diagnostics.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toolsDir = path.resolve(process.env.OFFLINE_SUBTITLE_TOOLS_DIR || path.join(appDir, 'tools'));
const outputPath = path.resolve(process.argv[2] || `docs/project-management/evidence/${new Date().toISOString().slice(0, 10)}-whisper-real-server-fallback.json`);
if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite existing Whisper fallback evidence: ${outputPath}`);

const runtimePath = path.join(toolsDir, 'whisper-cpp', process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli');
const modelPath = path.join(toolsDir, 'whisper-models', 'ggml-tiny.bin');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-whisper-real-fallback-'));
const settingsDir = path.join(dataDir, 'config');
const port = 24000 + Math.floor(Math.random() * 1000);
let actualPort = port;
let apiBaseUrl = `http://127.0.0.1:${port}`;
const token = `probe-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const startedAt = new Date().toISOString();
const started = Date.now();
let appProcess;
let observedStatus = null;
let appStdout = '';
let appStderr = '';

function requireOk(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function appendOutput(previous, chunk) {
  return `${previous}${chunk.toString('utf8')}`.slice(-8192);
}

function createSilenceWav() {
  const sampleRate = 16000;
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
  return wav;
}

async function api(pathname, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('X-Offline-Subtitle-Token', token);
  return fetch(`${apiBaseUrl}${pathname}`, { ...options, headers });
}

function refreshApiBaseUrl() {
  const portFilePath = path.join(dataDir, 'offline-subtitle-port.tmp');
  try {
    const candidate = Number(fs.readFileSync(portFilePath, 'utf8').trim());
    if (Number.isInteger(candidate) && candidate >= 1 && candidate <= 65535) {
      actualPort = candidate;
      apiBaseUrl = `http://127.0.0.1:${candidate}`;
      evidence.server.actualPort = candidate;
    }
  } catch {}
}

async function waitForServer() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    refreshApiBaseUrl();
    if (appProcess?.exitCode !== null && appProcess?.exitCode !== undefined) {
      const signalText = evidence.server.process.signal ? `，signal ${evidence.server.process.signal}` : '';
      throw new Error(`產品 server 在 ready 前離開，exit code ${appProcess.exitCode}${signalText}`);
    }
    try {
      const response = await api('/api/jobs?limit=1');
      if (response.ok) {
        evidence.server.process.ready = true;
        evidence.server.process.readyAt = new Date().toISOString();
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('產品 server 啟動逾時');
}

async function waitForJob(jobId, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await api(`/api/jobs/${encodeURIComponent(jobId)}/status`);
    requireOk(response.ok, `任務狀態查詢失敗：HTTP ${response.status}`);
    observedStatus = await response.json();
    if (['completed', 'failed', 'needs-action', 'cancelled', 'interrupted'].includes(observedStatus.status)) return observedStatus;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('產品 server Whisper fallback 任務等待逾時');
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

const evidence = {
  schema: 'offline-subtitle-factory.whisper-real-server-fallback.v2',
  startedAt,
  completedAt: null,
  elapsedMs: null,
  environment: { platform: process.platform, arch: process.arch, node: process.version },
  assets: { toolsDir, runtimePath, modelPath, runtimeSha256: null, modelSha256: null },
  input: { kind: 'generated-silence-wav', sampleRate: 16000, channels: 1, durationSeconds: 1, userMediaRead: false },
  server: {
    mode: 'production',
    loopbackOnly: true,
    testRunnersDisabled: true,
    requestedPort: port,
    actualPort: actualPort,
    process: {
      pid: null,
      ready: false,
      readyAt: null,
      exitCode: null,
      signal: null,
      preReadyExitCode: null,
      preReadySignal: null,
      probeTokenDetected: false,
      stdoutTail: null,
      stderrTail: null,
    },
  },
  job: { created: false, started: false, status: null, stage: null, metrics: null, logMarkers: null, outputs: null },
  scope: { externalNetwork: false, lmStudio: 'not-run-by-explicit-scope-exception', userSubtitleModified: false },
  status: 'fail',
};

try {
  requireOk(process.platform === 'darwin' && process.arch === 'arm64', '本 probe 只接受目前 macOS arm64 bundled Metal fallback 驗收環境');
  requireOk(fs.existsSync(runtimePath), `找不到 bundled whisper-cli：${runtimePath}`);
  requireOk(fs.existsSync(modelPath), `找不到 bundled Tiny 模型：${modelPath}`);
  requireOk((fs.statSync(runtimePath).mode & 0o111) !== 0, `bundled whisper-cli 不可執行：${runtimePath}`);
  evidence.assets.runtimeSha256 = sha256File(runtimePath);
  evidence.assets.modelSha256 = sha256File(modelPath);

  fs.mkdirSync(settingsDir, { recursive: true });
  fs.writeFileSync(path.join(settingsDir, 'settings.json'), JSON.stringify({ appLanguage: 'zh-TW' }), 'utf8');
  const serverEnv = {
    ...(process.env.PATH ? { PATH: process.env.PATH } : {}),
    ...(process.env.LANG ? { LANG: process.env.LANG } : {}),
    ...(process.env.LC_ALL ? { LC_ALL: process.env.LC_ALL } : {}),
    ...(process.env.TZ ? { TZ: process.env.TZ } : {}),
    PORT: String(port),
    NODE_ENV: 'production',
    OFFLINE_SUBTITLE_DATA_DIR: dataDir,
    OFFLINE_SUBTITLE_SETTINGS_DIR: settingsDir,
    OFFLINE_SUBTITLE_TOOLS_DIR: toolsDir,
    WHISPER_CACHE: path.join(toolsDir, 'whisper-models'),
    WHISPER_MODEL_CACHE_DIR: path.join(settingsDir, 'whisper-models'),
    BREEZE_ASR_MODEL_DIR: path.join(settingsDir, 'breeze-asr'),
    OFFLINE_SUBTITLE_API_TOKEN: token,
    SUBTITLE_AI_API_KEY: '',
    SUBTITLE_AI_KEYS_JSON: '{}',
    TEMP: dataDir,
    TMP: dataDir,
    TMPDIR: dataDir,
  };
  appProcess = spawn(process.execPath, [path.join(appDir, 'server.mjs')], {
    cwd: appDir,
    env: serverEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  evidence.server.process.pid = appProcess.pid || null;
  appProcess.stdout?.on('data', (chunk) => { appStdout = appendOutput(appStdout, chunk); });
  appProcess.stderr?.on('data', (chunk) => { appStderr = appendOutput(appStderr, chunk); });
  appProcess.on('exit', (code, signalName) => {
    evidence.server.process.exitCode = code;
    evidence.server.process.signal = signalName;
    if (!evidence.server.process.ready) {
      evidence.server.process.preReadyExitCode = code;
      evidence.server.process.preReadySignal = signalName;
    }
  });
  await waitForServer();

  const form = new FormData();
  form.set('video', new Blob([createSilenceWav()], { type: 'audio/wav' }), 'whisper-real-fallback.wav');
  form.set('language', 'zh-TW');
  form.set('asrEngine', 'whisper-cpp');
  form.set('modelName', 'tiny');
  form.set('performancePreset', 'fast');
  form.set('cpuThreads', '2');
  form.set('outputFormats', 'srt');
  const jobResponse = await api('/api/jobs', { method: 'POST', body: form });
  requireOk(jobResponse.status === 201, `Whisper fallback 任務建立失敗：HTTP ${jobResponse.status}`);
  const job = await jobResponse.json();
  evidence.job.created = true;

  const startResponse = await api(`/api/jobs/${encodeURIComponent(job.jobId)}/start`, { method: 'POST' });
  requireOk(startResponse.status === 202, `Whisper fallback 任務啟動失敗：HTTP ${startResponse.status}`);
  evidence.job.started = true;
  const status = await waitForJob(job.jobId);
  const jobRoot = path.join(dataDir, job.jobId);
  const workingDir = path.join(jobRoot, 'working');
  const draftPath = path.join(workingDir, 'draft.srt');
  const outputSrtPath = path.join(workingDir, 'whisper-cpp-output.srt');
  const outputJsonPath = path.join(workingDir, 'whisper-cpp-output.json');
  const qualityPath = path.join(workingDir, 'quality-metadata.json');
  const stalePartialArtifacts = fs.readdirSync(workingDir).filter((name) => (
    name === 'whisper-cpp-stale-partial-output'
    || /^whisper-cpp-output\.(?:srt|json)\.(?:partial|tmp|download)$/i.test(name)
  ));
  const logs = Array.isArray(status.logs) ? status.logs.join('\n') : '';
  const fallbackLogMarkers = parseWhisperFallbackLogMarkers(logs);
  const outputSrtReady = fs.existsSync(outputSrtPath) && fs.statSync(outputSrtPath).size > 0;
  const outputJsonReady = fs.existsSync(outputJsonPath) && fs.statSync(outputJsonPath).size > 0;
  const draftReady = fs.existsSync(draftPath) && fs.statSync(draftPath).size > 0;

  evidence.job.status = status.status;
  evidence.job.stage = status.stage;
  evidence.job.metrics = {
    asrEngine: status.metrics?.asrEngine || null,
    whisperDevice: status.metrics?.whisperDevice || null,
    modelName: status.metrics?.modelName || null,
  };
  evidence.job.logMarkers = {
    ...fallbackLogMarkers,
    fullLogsStored: false,
    selectedLogs: (status.logs || [])
      .filter((entry) => /Metal|CPU|Whisper\.cpp|fallback|完成|失敗|轉錄/i.test(String(entry)))
      .map((entry) => String(entry).slice(0, 240)),
  };
  evidence.job.outputs = {
    draftSrt: draftReady,
    whisperCppSrt: outputSrtReady,
    whisperCppJson: outputJsonReady,
    qualityMetadata: fs.existsSync(qualityPath),
    stalePartialOutput: stalePartialArtifacts.length > 0,
    stalePartialArtifacts,
  };

  requireOk(status.status === 'completed', `產品 server 任務未完成：${status.status}／${status.message || ''}`);
  requireOk(status.stage === 'ready-review', `產品 server 任務階段不符：${status.stage}`);
  requireOk(status.metrics?.asrEngine === 'whisper.cpp', `ASR engine 不符：${status.metrics?.asrEngine || ''}`);
  requireOk(draftReady && outputSrtReady && outputJsonReady, 'server 完成但 draft／Whisper.cpp SRT／JSON 輸出不完整');
  requireOk(stalePartialArtifacts.length === 0, `工作目錄殘留 partial output：${stalePartialArtifacts.join(', ')}`);
  requireOk(!fs.existsSync(path.join(workingDir, 'whisper-input.wav')), '任務完成後仍殘留 Whisper 暫存 WAV');
  requireOk(fs.existsSync(path.join(jobRoot, 'input', 'whisper-real-fallback.wav')), '驗收輸入未正確保存至任務 input');

  const fallbackObserved = fallbackLogMarkers.fallbackObserved;
  evidence.job.fallbackObserved = fallbackObserved;
  if (fallbackObserved) {
    requireOk(status.metrics?.whisperDevice === 'cpu', `Metal 失敗後未落到 CPU：${status.metrics?.whisperDevice || ''}`);
  } else {
    requireOk(status.metrics?.whisperDevice === 'metal', `未觀察到 fallback 時 Metal 路徑 metrics 不符：${status.metrics?.whisperDevice || ''}`);
  }

  evidence.status = 'pass';
} catch (error) {
  evidence.error = { message: String(error?.message || error), code: String(error?.code || '') };
  if (observedStatus) {
    evidence.job.status = observedStatus.status || null;
    evidence.job.stage = observedStatus.stage || null;
  }
} finally {
  await stopProcess(appProcess);
  const rawDiagnosticOutput = `${appStdout}\n${appStderr}`;
  evidence.server.process.probeTokenDetected = rawDiagnosticOutput.includes(token);
  try {
    requireOk(!evidence.server.process.probeTokenDetected, 'production server diagnostics echoed the probe token');
  } catch (error) {
    evidence.status = 'fail';
    evidence.error = { message: String(error?.message || error), code: String(error?.code || '') };
  }
  evidence.server.process.stdoutTail = sanitizeDiagnosticOutput(appStdout, [token]);
  evidence.server.process.stderrTail = sanitizeDiagnosticOutput(appStderr, [token]);
  evidence.completedAt = new Date().toISOString();
  evidence.elapsedMs = Date.now() - started;
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite existing Whisper fallback evidence: ${outputPath}`);
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    console.log(JSON.stringify({ outputPath, status: evidence.status, elapsedMs: evidence.elapsedMs, error: evidence.error || null }, null, 2));
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  if (evidence.status !== 'pass') process.exitCode = 1;
}
