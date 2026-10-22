import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const realToolsDir = path.resolve(process.env.OFFLINE_SUBTITLE_TOOLS_DIR || path.join(appDir, 'tools'));
const fixturePath = path.join(appDir, 'scripts', 'fixtures', 'mock-whisper-cpp-runtime.mjs');
const cancelBundledCpu = process.argv.includes('--cancel-bundled-cpu');
const simulateCancelApiLoss = process.argv.includes('--simulate-cancel-api-loss');
const hybridBundledCpu = cancelBundledCpu || process.argv.includes('--bundled-cpu');
const positionalArgs = process.argv.slice(2).filter((arg) => !['--bundled-cpu', '--cancel-bundled-cpu', '--simulate-cancel-api-loss'].includes(arg));
if (positionalArgs.length > 1 || positionalArgs.some((arg) => arg.startsWith('--')) || (cancelBundledCpu && process.argv.includes('--bundled-cpu')) || (simulateCancelApiLoss && !cancelBundledCpu)) {
  throw new Error('Usage: verify-whisper-production-fallback.mjs [--bundled-cpu|--cancel-bundled-cpu [--simulate-cancel-api-loss]] [evidence-path]');
}
const evidenceName = cancelBundledCpu ? 'whisper-bundled-cpu-cancel' : hybridBundledCpu ? 'whisper-hybrid-fallback' : 'whisper-production-fallback';
const outputPath = path.resolve(positionalArgs[0] || `docs/project-management/evidence/${new Date().toISOString().slice(0, 10)}-${evidenceName}.json`);
if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite existing Whisper production fallback evidence: ${outputPath}`);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-whisper-production-fallback-'));
const dataDir = path.join(tempRoot, 'data');
const settingsDir = path.join(dataDir, 'config');
const toolsDir = path.join(tempRoot, 'tools');
const bundledFfmpegPath = path.join(realToolsDir, 'ffmpeg', 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
const bundledModelPath = path.join(realToolsDir, 'whisper-models', 'ggml-tiny.bin');
const bundledRuntimePath = path.join(realToolsDir, 'whisper-cpp', process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli');
const wrapperPath = path.join(toolsDir, 'whisper-cpp', process.platform === 'win32' ? 'whisper-cli.cmd' : 'whisper-cli');
const requestedPort = 24000 + Math.floor(Math.random() * 1000);
let actualPort = requestedPort;
let apiBaseUrl = `http://127.0.0.1:${requestedPort}`;
const token = `probe-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const startedAt = new Date().toISOString();
const started = Date.now();
let appProcess;
let observedStatus = null;
let activeJobId = null;

function requireOk(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function createSilenceWav(durationSeconds = 1) {
  const sampleRate = 16000;
  const dataSize = sampleRate * 2 * durationSeconds;
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

async function api(pathname, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('X-Offline-Subtitle-Token', token);
  return fetch(`${apiBaseUrl}${pathname}`, { ...options, headers });
}

async function waitForServer() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    refreshApiBaseUrl();
    if (appProcess?.exitCode !== null && appProcess?.exitCode !== undefined) {
      throw new Error(`產品 server 在 ready 前離開，exit code ${appProcess.exitCode}`);
    }
    try {
      const response = await api('/api/jobs?limit=1');
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('production-mode fallback server 啟動逾時');
}

async function waitForJob(jobId, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await api(`/api/jobs/${encodeURIComponent(jobId)}/status`);
    requireOk(response.ok, `任務狀態查詢失敗：HTTP ${response.status}`);
    observedStatus = await response.json();
    if (['completed', 'failed', 'needs-action', 'cancelled', 'interrupted'].includes(observedStatus.status)) return observedStatus;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('production-mode fallback 任務等待逾時');
}

async function waitForFile(filePath, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`等待 CPU child marker 逾時：${path.basename(filePath)}`);
}

function processGroupExists(groupId) {
  try {
    process.kill(-groupId, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    if (error?.code === 'EPERM') {
      const scan = spawnSync('/bin/ps', ['-axo', 'pgid='], { encoding: 'utf8' });
      if (scan.status === 0) return scan.stdout.split('\n').some((line) => Number(line.trim()) === groupId);
    }
    throw error;
  }
}

async function stopIsolatedProcessGroup(child) {
  const groupId = child?.pid ?? null;
  const result = { groupId, termSent: false, killSent: false, groupGone: !groupId, errorCode: null };
  if (!groupId) return result;
  const waitGone = async (timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!processGroupExists(groupId)) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return !processGroupExists(groupId);
  };
  try {
    if (processGroupExists(groupId)) {
      process.kill(-groupId, 'SIGTERM');
      result.termSent = true;
    }
    if (!(await waitGone(2500))) {
      process.kill(-groupId, 'SIGKILL');
      result.killSent = true;
      result.groupGone = await waitGone(3000);
    } else {
      result.groupGone = true;
    }
  } catch (error) {
    if (error?.code === 'ESRCH') result.groupGone = true;
    else result.errorCode = String(error?.code || error?.message || error);
  }
  return result;
}

const evidence = {
  schema: cancelBundledCpu ? 'offline-subtitle-factory.whisper-bundled-cpu-cancel.v1' : hybridBundledCpu ? 'offline-subtitle-factory.whisper-hybrid-fallback.v1' : 'offline-subtitle-factory.whisper-production-fallback.v1',
  startedAt,
  completedAt: null,
  elapsedMs: null,
  environment: { platform: process.platform, arch: process.arch, node: process.version },
  controlledRuntime: {
    type: cancelBundledCpu ? 'controlled-metal-bundled-cpu-cancel-wrapper' : hybridBundledCpu ? 'controlled-metal-bundled-cpu-wrapper' : 'deterministic-whisper-cpp-wrapper',
    fixturePath: hybridBundledCpu ? null : fixturePath,
    bundledRuntimeUsed: hybridBundledCpu,
    bundledRuntimeUsedForCpu: hybridBundledCpu,
    bundledRuntimePath: hybridBundledCpu ? bundledRuntimePath : null,
    bundledRuntimeSha256: null,
    bundledModelPath,
    bundledModelSha256: null,
    wrapperCreatesMetalExit139: true,
    bundledMetalCrashObserved: false,
  },
  input: { kind: 'generated-silence-wav', sampleRate: 16000, channels: 1, durationSeconds: cancelBundledCpu ? 60 : 1, userMediaRead: false },
  scenario: simulateCancelApiLoss ? 'probe-injected-cancel-api-loss' : 'normal',
  replay: hybridBundledCpu ? {
    workingDirectory: appDir,
    command: cancelBundledCpu
      ? simulateCancelApiLoss
        ? 'npm run acceptance:whisper:bundled-cpu-cancel -- --simulate-cancel-api-loss "/private/tmp/osf-whisper-cpu-cancel-api-loss-$(uuidgen).json"'
        : 'npm run acceptance:whisper:bundled-cpu-cancel -- "/private/tmp/osf-whisper-cpu-cancel-$(uuidgen).json"'
      : 'npm run acceptance:whisper:hybrid-fallback -- "/private/tmp/osf-whisper-hybrid-$(uuidgen).json"',
    prerequisites: ['macOS arm64', 'bundled whisper-cli, Tiny model, and FFmpeg available locally', 'permission to run local child processes and bind a 127.0.0.1 server'],
    outputPolicy: 'Use a fresh evidence path; the probe refuses to overwrite existing files.',
  } : null,
  server: { mode: 'production', loopbackOnly: true, testRunnersDisabled: true, requestedPort, actualPort },
  job: { created: false, started: false, status: null, stage: null, metrics: null, logMarkers: null, outputs: null, fallbackObserved: false },
  scope: { externalNetwork: false, lmStudio: 'not-run-by-explicit-scope-exception', userSubtitleModified: false },
  status: 'fail',
};

try {
  requireOk(hybridBundledCpu ? process.platform === 'darwin' && process.arch === 'arm64' : process.platform !== 'win32', hybridBundledCpu ? 'bundled CPU hybrid probe 只支援 macOS arm64' : '本 probe 目前只支援 macOS／Linux 的 executable wrapper 路徑');
  if (!hybridBundledCpu) requireOk(fs.existsSync(fixturePath), `找不到 deterministic Whisper fixture：${fixturePath}`);
  requireOk(fs.existsSync(bundledFfmpegPath), `找不到 bundled FFmpeg：${bundledFfmpegPath}`);
  requireOk(fs.existsSync(bundledModelPath), `找不到 bundled Tiny 模型：${bundledModelPath}`);
  if (hybridBundledCpu) {
    requireOk(fs.existsSync(bundledRuntimePath), `找不到 bundled whisper-cli：${bundledRuntimePath}`);
    requireOk((fs.statSync(bundledRuntimePath).mode & 0o111) !== 0, `bundled whisper-cli 不可執行：${bundledRuntimePath}`);
    evidence.controlledRuntime.bundledRuntimeSha256 = sha256File(bundledRuntimePath);
  }
  evidence.controlledRuntime.bundledModelSha256 = sha256File(bundledModelPath);

  fs.mkdirSync(path.dirname(wrapperPath), { recursive: true });
  fs.mkdirSync(path.dirname(path.join(toolsDir, 'ffmpeg', 'bin', 'ffmpeg')), { recursive: true });
  fs.mkdirSync(path.join(toolsDir, 'whisper-models'), { recursive: true });
  fs.symlinkSync(bundledFfmpegPath, path.join(toolsDir, 'ffmpeg', 'bin', 'ffmpeg'));
  fs.symlinkSync(bundledModelPath, path.join(toolsDir, 'whisper-models', 'ggml-tiny.bin'));
  const wrapperSource = hybridBundledCpu ? `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  process.stdout.write('controlled Metal failure / bundled CPU acceptance wrapper\\n');
  process.exit(0);
}
const outputBase = args[args.indexOf('-of') + 1];
if (!outputBase) process.exit(2);
const outputDir = path.dirname(outputBase);
const cancelProbe = ${cancelBundledCpu};
const invocationPath = path.join(outputDir, 'whisper-cpp-invocations.log');
if (!args.includes('--no-gpu')) {
  fs.appendFileSync(invocationPath, 'metal\\n', 'utf8');
  fs.writeFileSync(outputBase + '.srt', 'partial Metal output\\n', 'utf8');
  fs.writeFileSync(outputBase + '.json', '{"partial":true}', 'utf8');
  fs.writeFileSync(path.join(outputDir, 'whisper-cpp-metal-139'), 'controlled', 'utf8');
  process.stderr.write('controlled Metal exit 139\\n');
  process.exit(139);
}
fs.appendFileSync(invocationPath, 'cpu\\n', 'utf8');
if (fs.existsSync(outputBase + '.srt') || fs.existsSync(outputBase + '.json')) {
  fs.writeFileSync(path.join(outputDir, 'whisper-cpp-stale-partial-output'), 'yes', 'utf8');
}
const child = spawn(${JSON.stringify(bundledRuntimePath)}, args, { stdio: 'inherit', shell: false });
let cancelRequested = false;
let forcedKill = false;
let childErrorCode = null;
let forceKillTimer = null;
child.on('spawn', () => {
  if (cancelProbe) fs.writeFileSync(path.join(outputDir, 'whisper-cpp-bundled-cpu-ready'), 'spawned', 'utf8');
});
process.on('SIGTERM', () => {
  cancelRequested = true;
  if (cancelProbe) fs.writeFileSync(path.join(outputDir, 'whisper-cpp-wrapper-sigterm'), 'received', 'utf8');
  child.kill('SIGTERM');
  forceKillTimer = setTimeout(() => {
    forcedKill = true;
    child.kill('SIGKILL');
  }, 2000);
});
process.on('SIGINT', () => child.kill('SIGINT'));
child.on('error', (error) => {
  childErrorCode = String(error.code || '');
  process.exitCode = 1;
});
child.on('close', (exitCode, signal) => {
  if (forceKillTimer) clearTimeout(forceKillTimer);
  fs.writeFileSync(path.join(outputDir, 'whisper-cpp-bundled-cpu-result.json'), JSON.stringify({ exitCode, signal, errorCode: childErrorCode, cancelRequested, forcedKill }));
  if (cancelProbe) fs.writeFileSync(path.join(outputDir, 'whisper-cpp-bundled-cpu-closed'), 'closed', 'utf8');
  if (cancelProbe && cancelRequested) setTimeout(() => process.exit(exitCode ?? 1), 300);
  else process.exit(exitCode ?? 1);
});
` : `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  process.stdout.write('deterministic production fallback wrapper\\n');
  process.exit(0);
}
const outputBase = args[args.indexOf('-of') + 1];
if (!outputBase) process.exit(2);
const outputDir = path.dirname(outputBase);
const crashMarker = path.join(outputDir, 'whisper-cpp-mock-metal-139');
if (!args.includes('--no-gpu') && !fs.existsSync(crashMarker)) fs.writeFileSync(crashMarker, 'yes', 'utf8');
const result = spawnSync(process.execPath, [${JSON.stringify(fixturePath)}, ...args], { stdio: 'inherit' });
if (result.error) process.exit(1);
process.exit(result.status ?? 1);
`;
  fs.writeFileSync(wrapperPath, wrapperSource, { encoding: 'utf8', mode: 0o755 });
  fs.chmodSync(wrapperPath, 0o755);

  fs.mkdirSync(settingsDir, { recursive: true });
  fs.writeFileSync(path.join(settingsDir, 'settings.json'), JSON.stringify({ appLanguage: 'zh-TW' }), 'utf8');
  const serverEnv = {
    ...(process.env.PATH ? { PATH: [path.dirname(wrapperPath), path.dirname(bundledFfmpegPath), process.env.PATH].join(path.delimiter) } : {}),
    ...(process.env.LANG ? { LANG: process.env.LANG } : {}),
    ...(process.env.LC_ALL ? { LC_ALL: process.env.LC_ALL } : {}),
    ...(process.env.TZ ? { TZ: process.env.TZ } : {}),
    PORT: String(requestedPort),
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
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  await waitForServer();

  const form = new FormData();
  form.set('video', new Blob([createSilenceWav(evidence.input.durationSeconds)], { type: 'audio/wav' }), 'whisper-production-fallback.wav');
  form.set('language', 'zh-TW');
  form.set('asrEngine', 'whisper-cpp');
  form.set('modelName', 'tiny');
  form.set('performancePreset', 'fast');
  form.set('cpuThreads', '2');
  form.set('outputFormats', 'srt');
  const jobResponse = await api('/api/jobs', { method: 'POST', body: form });
  requireOk(jobResponse.status === 201, `production fallback 任務建立失敗：HTTP ${jobResponse.status}`);
  const job = await jobResponse.json();
  activeJobId = job.jobId;
  evidence.job.created = true;
  const startResponse = await api(`/api/jobs/${encodeURIComponent(job.jobId)}/start`, { method: 'POST' });
  requireOk(startResponse.status === 202, `production fallback 任務啟動失敗：HTTP ${startResponse.status}`);
  evidence.job.started = true;
  const jobRoot = path.join(dataDir, job.jobId);
  const workingDir = path.join(jobRoot, 'working');
  const draftPath = path.join(workingDir, 'draft.srt');
  const outputSrtPath = path.join(workingDir, 'whisper-cpp-output.srt');
  const outputJsonPath = path.join(workingDir, 'whisper-cpp-output.json');
  let status;
  if (cancelBundledCpu) {
    await waitForFile(path.join(workingDir, 'whisper-cpp-bundled-cpu-ready'));
    requireOk(!fs.existsSync(path.join(workingDir, 'whisper-cpp-bundled-cpu-result.json')), 'bundled CPU 在取消前已關閉');
    const beforeResponse = await api(`/api/jobs/${encodeURIComponent(job.jobId)}/status`);
    requireOk(beforeResponse.ok, `取消前狀態查詢失敗：HTTP ${beforeResponse.status}`);
    const before = await beforeResponse.json();
    requireOk(before.status === 'running' && before.metrics?.whisperDevice === 'cpu', `取消前 CPU 任務不在執行中：${before.status}/${before.metrics?.whisperDevice}`);
    observedStatus = before;
    fs.writeFileSync(outputSrtPath, 'probe-injected partial SRT\n', 'utf8');
    fs.writeFileSync(outputJsonPath, '{"probeInjectedPartial":true}', 'utf8');
    fs.writeFileSync(path.join(workingDir, 'quality-metadata.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(workingDir, 'edit-plan.json'), '{}', 'utf8');
    evidence.job.cancelLifecycle = {
      cpuSpawnMarker: true,
      before: { status: before.status, stage: before.stage },
      partialArtifactsSource: 'probe-injected-after-bundled-cpu-spawn',
    };
    if (simulateCancelApiLoss) {
      const error = new Error('probe-injected cancellation API unavailable');
      error.code = 'PROBE_CANCEL_API_LOSS';
      throw error;
    }
    const cancelResponse = await api(`/api/jobs/${encodeURIComponent(job.jobId)}/cancel`, { method: 'POST' });
    requireOk(cancelResponse.status === 202, `bundled CPU 取消 API 失敗：HTTP ${cancelResponse.status}`);
    const cancellingResponse = await api(`/api/jobs/${encodeURIComponent(job.jobId)}/status`);
    requireOk(cancellingResponse.ok, `取消中狀態查詢失敗：HTTP ${cancellingResponse.status}`);
    const cancelling = await cancellingResponse.json();
    evidence.job.cancelLifecycle.cancelHttpStatus = cancelResponse.status;
    evidence.job.cancelLifecycle.afterRequest = { status: cancelling.status, stage: cancelling.stage };
    requireOk(cancelling.status === 'running' && cancelling.stage === 'cancelling', `CPU child close 前取消中狀態不符：${cancelling.status}/${cancelling.stage}`);
    status = await waitForJob(job.jobId, 30000);
  } else {
    status = await waitForJob(job.jobId);
  }
  const logs = Array.isArray(status.logs) ? status.logs.join('\n') : '';
  const stalePartialArtifacts = fs.readdirSync(workingDir).filter((name) => (
    name === 'whisper-cpp-stale-partial-output'
    || /^whisper-cpp-output\.(?:srt|json)\.(?:partial|tmp|download)$/i.test(name)
  ));
  const outputSrtExists = fs.existsSync(outputSrtPath);
  const outputJsonExists = fs.existsSync(outputJsonPath);
  const draftExists = fs.existsSync(draftPath);
  const outputSrtReady = outputSrtExists && fs.statSync(outputSrtPath).size > 0;
  const outputJsonReady = outputJsonExists && fs.statSync(outputJsonPath).size > 0;
  const draftReady = draftExists && fs.statSync(draftPath).size > 0;
  const invocationPath = path.join(workingDir, 'whisper-cpp-invocations.log');
  const cpuResultPath = path.join(workingDir, 'whisper-cpp-bundled-cpu-result.json');
  const invocations = hybridBundledCpu && fs.existsSync(invocationPath) ? fs.readFileSync(invocationPath, 'utf8').trim().split('\n') : null;
  const cpuResult = hybridBundledCpu && fs.existsSync(cpuResultPath) ? JSON.parse(fs.readFileSync(cpuResultPath, 'utf8')) : null;
  evidence.job.status = status.status;
  evidence.job.stage = status.stage;
  evidence.job.metrics = {
    asrEngine: status.metrics?.asrEngine || null,
    whisperDevice: status.metrics?.whisperDevice || null,
    modelName: status.metrics?.modelName || null,
  };
  evidence.job.logMarkers = {
    metalExit139: logs.includes('Metal exit 139'),
    cpuFallback: logs.includes('CPU fallback'),
    firstCrashMarker: fs.existsSync(path.join(workingDir, 'whisper-cpp-metal-139')),
    fullLogsStored: false,
  };
  evidence.job.outputs = {
    draftSrt: draftReady,
    whisperCppSrt: outputSrtReady,
    whisperCppJson: outputJsonReady,
    stalePartialOutput: stalePartialArtifacts.length > 0,
    stalePartialArtifacts,
    whisperInputCleaned: !fs.existsSync(path.join(workingDir, 'whisper-input.wav')),
  };
  if (cancelBundledCpu) {
    evidence.job.outputs.draftAbsent = !draftExists;
    evidence.job.outputs.whisperCppSrtAbsent = !outputSrtExists;
    evidence.job.outputs.whisperCppJsonAbsent = !outputJsonExists;
    evidence.job.outputs.qualityMetadataCleaned = !fs.existsSync(path.join(workingDir, 'quality-metadata.json'));
    evidence.job.outputs.editPlanPreserved = fs.existsSync(path.join(workingDir, 'edit-plan.json'));
    evidence.job.cancelLifecycle.wrapperSigtermMarker = fs.existsSync(path.join(workingDir, 'whisper-cpp-wrapper-sigterm'));
    evidence.job.cancelLifecycle.bundledCpuClosedMarker = fs.existsSync(path.join(workingDir, 'whisper-cpp-bundled-cpu-closed'));
  }
  evidence.job.fallbackObserved = evidence.job.logMarkers.metalExit139 && evidence.job.logMarkers.cpuFallback;
  if (hybridBundledCpu) {
    evidence.job.invocations = invocations;
    evidence.job.bundledCpuResult = cpuResult;
  }

  requireOk(status.status === (cancelBundledCpu ? 'cancelled' : 'completed'), `production fallback 任務狀態不符：${status.status}／${status.message || ''}`);
  requireOk(status.stage === (cancelBundledCpu ? 'cancelled' : 'ready-review'), `production fallback 任務階段不符：${status.stage}`);
  requireOk(status.metrics?.asrEngine === 'whisper.cpp', `ASR engine 不符：${status.metrics?.asrEngine || ''}`);
  requireOk(status.metrics?.whisperDevice === 'cpu', `production fallback 未完成 CPU retry：${status.metrics?.whisperDevice || ''}`);
  requireOk(evidence.job.fallbackObserved, 'production fallback logs 缺少 Metal exit 139／CPU fallback marker');
  requireOk(evidence.job.logMarkers.firstCrashMarker, 'deterministic wrapper 未記錄首次 Metal crash');
  requireOk(cancelBundledCpu ? !draftExists && !outputSrtExists && !outputJsonExists : draftReady && outputSrtReady && outputJsonReady, cancelBundledCpu ? 'CPU 取消後殘留 draft／partial SRT／JSON' : 'production fallback 完成但 draft／SRT／JSON 輸出不完整');
  requireOk(stalePartialArtifacts.length === 0, `production fallback 殘留 partial output：${stalePartialArtifacts.join(', ')}`);
  requireOk(evidence.job.outputs.whisperInputCleaned, 'production fallback 完成後仍殘留 Whisper 暫存 WAV');
  if (hybridBundledCpu) {
    requireOk(JSON.stringify(invocations) === JSON.stringify(['metal', 'cpu']), `hybrid probe invocation 順序或次數不符：${JSON.stringify(invocations)}`);
    if (cancelBundledCpu) {
      requireOk(evidence.job.cancelLifecycle.wrapperSigtermMarker && evidence.job.cancelLifecycle.bundledCpuClosedMarker, '取消後缺少 SIGTERM／bundled CPU child close marker');
      requireOk(cpuResult?.cancelRequested && cpuResult.signal === 'SIGTERM' && cpuResult.forcedKill === false && cpuResult.errorCode === null, `bundled CPU child 未由 SIGTERM 正常關閉：${JSON.stringify(cpuResult)}`);
      requireOk(evidence.job.outputs.qualityMetadataCleaned && evidence.job.outputs.editPlanPreserved, '取消後 ASR quality 清理或非 ASR edit plan 保留失敗');
    } else {
      requireOk(cpuResult?.exitCode === 0 && cpuResult.signal === null && cpuResult.errorCode === null, `bundled CPU child 未成功退出：${JSON.stringify(cpuResult)}`);
      requireOk(!fs.readFileSync(outputSrtPath, 'utf8').includes('Whisper.cpp mock 字幕'), 'hybrid probe 意外使用 deterministic mock 輸出');
    }
  }

  evidence.status = 'pass';
} catch (error) {
  evidence.error = { message: String(error?.message || error), code: String(error?.code || '') };
  if (observedStatus) {
    evidence.job.status = observedStatus.status || null;
    evidence.job.stage = observedStatus.stage || null;
  }
} finally {
  let fallbackApiCleanup = { attempted: false, outcome: null };
  if (cancelBundledCpu && activeJobId && !['cancelled', 'completed', 'failed', 'interrupted'].includes(observedStatus?.status)) {
    if (simulateCancelApiLoss) fallbackApiCleanup.outcome = 'unavailable-by-probe-injection';
    else {
      fallbackApiCleanup.attempted = true;
      try {
        const response = await api(`/api/jobs/${encodeURIComponent(activeJobId)}/cancel`, { method: 'POST' });
        fallbackApiCleanup.httpStatus = response.status;
        const terminal = await waitForJob(activeJobId, 10000);
        fallbackApiCleanup.outcome = terminal.status;
      } catch (error) {
        fallbackApiCleanup.outcome = 'failed';
        fallbackApiCleanup.errorCode = String(error?.code || error?.message || error);
      }
    }
  }
  const groupCleanup = await stopIsolatedProcessGroup(appProcess);
  const workingDir = activeJobId ? path.join(dataDir, activeJobId, 'working') : null;
  const childResultPath = workingDir ? path.join(workingDir, 'whisper-cpp-bundled-cpu-result.json') : null;
  let childResult = null;
  let childResultReadError = null;
  if (childResultPath && fs.existsSync(childResultPath)) {
    try { childResult = JSON.parse(fs.readFileSync(childResultPath, 'utf8')); }
    catch (error) { childResultReadError = String(error?.code || error?.message || error); }
  }
  evidence.cleanup = {
    ...groupCleanup,
    fallbackApiCleanup,
    wrapperSigtermMarker: !!workingDir && fs.existsSync(path.join(workingDir, 'whisper-cpp-wrapper-sigterm')),
    bundledCpuClosedMarker: !!workingDir && fs.existsSync(path.join(workingDir, 'whisper-cpp-bundled-cpu-closed')),
    bundledCpuResult: childResult,
    childResultReadError,
    tempRootRemoved: false,
  };
  if (groupCleanup.groupGone) {
    try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch (error) { evidence.cleanup.tempRemoveError = String(error?.code || error?.message || error); }
  } else {
    evidence.cleanup.preservedTempRoot = tempRoot;
  }
  evidence.cleanup.tempRootRemoved = !fs.existsSync(tempRoot);
  if (simulateCancelApiLoss) {
    evidence.cleanup.expectedFaultSafelyHandled = groupCleanup.groupGone
      && evidence.cleanup.tempRootRemoved
      && evidence.cleanup.wrapperSigtermMarker
      && evidence.cleanup.bundledCpuClosedMarker
      && childResult?.signal === 'SIGTERM';
  }
  if (!groupCleanup.groupGone || !evidence.cleanup.tempRootRemoved || (simulateCancelApiLoss && !evidence.cleanup.expectedFaultSafelyHandled)) {
    evidence.status = 'fail';
    evidence.error = { message: 'Isolated process group, bundled CPU child, or temporary data did not shut down cleanly', code: 'PROBE_CLEANUP_FAILED' };
  }
  evidence.completedAt = new Date().toISOString();
  evidence.elapsedMs = Date.now() - started;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite existing Whisper production fallback evidence: ${outputPath}`);
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  console.log(JSON.stringify({ outputPath, status: evidence.status, elapsedMs: evidence.elapsedMs, error: evidence.error || null }, null, 2));
  if (evidence.status !== 'pass') process.exitCode = 1;
}
