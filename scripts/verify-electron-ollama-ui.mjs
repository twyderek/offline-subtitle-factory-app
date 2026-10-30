import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createTrustedDevToolsWebSocket, isLocalElectronPageUrl, selectTrustedElectronPageTarget } from '../lib/electron-devtools-target.mjs';
import { cleanupProcessGroup } from '../lib/process-group-cleanup.mjs';
import { aiEndpointPrivacy, isLoopbackAiUrl } from '../lib/ai/local-ai.mjs';
import { projectReplayProvenance, projectRunnerProvenance } from '../lib/runner-provenance.mjs';
import { startLocalAcceptanceDaemon, stopLocalAcceptanceDaemon } from './ollama-ui-local-daemon.mjs';

const exePath = process.argv[2];
const port = Number(process.argv[3] || 9990);
const timeoutMs = Number(process.argv[4] || 30000);
const outputPath = path.resolve(process.argv[5] || `docs/project-management/evidence/${new Date().toISOString().slice(0, 10)}-ollama-ui-live.json`);
const model = String(process.argv[6] || process.env.OSF_OLLAMA_UI_MODEL || process.env.OLLAMA_MODEL || 'llama3.2:1b').trim();
let ollamaBaseUrl = String(process.env.OSF_OLLAMA_UI_BASE_URL || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1').replace(/\/+$/, '');
const isolatedDaemon = process.env.OSF_OLLAMA_UI_ISOLATED_DAEMON === '1';
const sandboxedTargetProcessTree = process.env.OSF_OLLAMA_UI_NETWORK_SANDBOX === '1';
const scenario = process.env.OSF_OLLAMA_UI_SCENARIO || 'complete';
const sandboxProfile = '(version 1) (allow default) (deny network-outbound) (deny network-inbound) (deny network-bind) (allow network-bind (local ip "localhost:*")) (allow network-inbound (local ip "localhost:*")) (allow network-outbound (remote ip "localhost:*"))';

if (!exePath) throw new Error('Usage: node scripts/verify-electron-ollama-ui.mjs <exe-path> [debug-port] [timeout-ms] [evidence-output] [ollama-model]');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`Invalid DevTools port: ${port}`);
if (!Number.isFinite(timeoutMs) || timeoutMs < 5000) throw new Error(`Invalid timeout: ${timeoutMs}`);
if (!model) throw new Error('Ollama model is required');
if (!['complete', 'cancel-resume', 'cancel-resume-restart'].includes(scenario)) throw new Error('Invalid Ollama UI scenario');
if (isolatedDaemon && (process.env.OSF_OLLAMA_UI_BASE_URL || process.env.OLLAMA_BASE_URL)) throw new Error('Isolated daemon cannot use a custom endpoint');
if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite existing Ollama UI evidence: ${outputPath}`);
if (!isLoopbackAiUrl(ollamaBaseUrl)) throw new Error(`Ollama UI probe 只允許 loopback URL：${ollamaBaseUrl}`);

const shortSourceCues = [
  { id: 1, start: '00:00:00,000', end: '00:00:02,500', text: 'Hello，朋友。' },
  { id: 2, start: '00:00:02,500', end: '00:00:05,000', text: 'Thank you，大家。' },
];
// Keep the cancellation checkpoint fixture intentionally simple so the
// preinstalled 1B model exercises cancellation/resume rather than failing on
// an unstable translation-quality response before the first checkpoint.
const cancelResumeSourceCues = [
  { text: '你好。' },
  { text: '謝謝。' },
];
const isCancelResumeScenario = scenario === 'cancel-resume' || scenario === 'cancel-resume-restart';
const requiresAppRestart = scenario === 'cancel-resume-restart';
const sourceCues = isCancelResumeScenario
  ? Array.from({ length: 6 }, (_, index) => ({
    ...cancelResumeSourceCues[index % cancelResumeSourceCues.length],
    id: index + 1,
    start: `00:00:${String(index * 3).padStart(2, '0')},000`,
    end: `00:00:${String(index * 3 + 3).padStart(2, '0')},000`,
  }))
  : shortSourceCues;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return sha256(fs.readFileSync(filePath));
}

const provenanceProjectRoot = process.cwd();
const runnerSourcePath = path.resolve(provenanceProjectRoot, 'scripts/verify-electron-ollama-ui.mjs');
const runnerProvenanceModulePath = path.resolve(provenanceProjectRoot, 'lib/runner-provenance.mjs');
const packageManifestPath = path.resolve(provenanceProjectRoot, 'package.json');

function safeSha256File(filePath) {
  try {
    return sha256File(filePath);
  } catch {
    return null;
  }
}

function readGitOutput(args) {
  try {
    return execFileSync('git', ['-C', provenanceProjectRoot, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
  } catch {
    return null;
  }
}

function readSourceRevision() {
  const headCommit = readGitOutput(['rev-parse', 'HEAD']);
  const worktreeStatus = readGitOutput(['status', '--porcelain=v1', '--untracked-files=all']);
  return {
    headCommit,
    worktreeDirty: typeof worktreeStatus === 'string' ? worktreeStatus.length > 0 : null,
    worktreeStatusSha256: typeof worktreeStatus === 'string' ? sha256(worktreeStatus) : null,
  };
}

function readPackageVersion() {
  try {
    const manifest = JSON.parse(fs.readFileSync(packageManifestPath, 'utf8'));
    return typeof manifest.version === 'string' ? manifest.version : null;
  } catch {
    return null;
  }
}

function resolveFrameworkPath(executablePath) {
  return path.join(path.dirname(path.resolve(executablePath)), '..', 'Frameworks', 'Electron Framework.framework', 'Versions', 'A', 'Electron Framework');
}

function redactLaunchArgument(argument, executablePath, userDataPath) {
  const value = String(argument);
  if (value === path.resolve(executablePath)) return `<candidate-executable:${path.basename(executablePath)}>`;
  if (value === sandboxProfile) return '<outer-sandbox-profile>';
  if (value.startsWith('--user-data-dir=')) return '--user-data-dir=<temporary-user-data>';
  if (/^[A-Z][A-Z0-9_]*=/.test(value)) return `${value.slice(0, value.indexOf('='))}=<redacted>`;
  if (value === userDataPath) return '<temporary-user-data>';
  return value;
}

function summarizeLaunch(command, args, executablePath, userDataPath) {
  return {
    command: path.basename(command),
    argv: args.map((argument) => redactLaunchArgument(argument, executablePath, userDataPath)),
    sandboxedTargetProcessTree,
    outerSandboxProfileApplied: args.includes(sandboxProfile),
  };
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

async function waitForTarget(child) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.spawnError) throw new Error('ELECTRON_SPAWN_FAILED');
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('ELECTRON_EXITED_BEFORE_RENDERER');
    try {
      const targets = await getJson(`http://127.0.0.1:${port}/json`);
      lastTargetSummary = {
        pageCount: targets.filter((target) => target.type === 'page').length,
        localUiPageCount: targets.filter((target) => target.type === 'page' && isLocalElectronPageUrl(target.url)).length,
        filePageCount: targets.filter((target) => target.type === 'page' && String(target.url || '').startsWith('file://')).length,
      };
      const page = selectTrustedElectronPageTarget(targets, port);
      if (page) return page;
    } catch (error) {
      if (error?.message === 'DEVTOOLS_TARGET_URL_REJECTED') throw error;
      // Electron is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('ELECTRON_RENDERER_TIMEOUT');
}

async function connectWebSocket(wsUrl) {
  const socket = createTrustedDevToolsWebSocket(wsUrl, port);
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

async function waitForHomeDashboard(client) {
  const deadline = Date.now() + Math.min(timeoutMs, 10000);
  while (Date.now() < deadline) {
    try {
      const home = await evaluate(client, '(() => ({ href: location.origin + location.pathname, title: document.title, hasHomeDashboard: Boolean(document.getElementById(\'homeDashboard\')), apiToken: new URL(location.href).searchParams.get(\'token\') || \'\' }))()');
      if (home?.hasHomeDashboard === true) return home;
    } catch {
      // The renderer may still be navigating; keep the bounded startup wait.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('ELECTRON_HOME_DASHBOARD_TIMEOUT');
}

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-subtitle-ollama-ui-electron-'));
const childEnv = {
  PATH: process.env.PATH || '',
  HOME: process.env.HOME || os.homedir(),
  TMPDIR: process.env.TMPDIR || os.tmpdir(),
  LANG: process.env.LANG || 'en_US.UTF-8',
  SUBTITLE_AI_API_KEY: '',
  SUBTITLE_AI_KEYS_JSON: '{}',
  ELECTRON_NO_ATTACH_CONSOLE: '1',
};
const executableArgs = [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
];
const childCommand = sandboxedTargetProcessTree ? '/usr/bin/sandbox-exec' : path.resolve(exePath);
const childArgs = sandboxedTargetProcessTree
  ? ['-p', sandboxProfile, '/usr/bin/env', ...Object.entries(childEnv).map(([key, value]) => `${key}=${value}`), path.resolve(exePath), ...executableArgs]
  : executableArgs;
const launchSummary = summarizeLaunch(childCommand, childArgs, exePath, userDataDir);
let candidateExecutableSha256 = null;
let candidateReviewScriptSha256 = null;
let candidateArtifactReadFailed = false;
const reviewScriptPath = path.resolve(path.dirname(exePath), '../Resources/app/public/review.js');
try {
  candidateExecutableSha256 = sha256File(exePath);
  candidateReviewScriptSha256 = sha256File(reviewScriptPath);
} catch (error) {
  candidateArtifactReadFailed = true;
}
const frameworkPath = resolveFrameworkPath(exePath);
let candidateFrameworkPresent = false;
let candidateFrameworkSha256 = null;
try {
  candidateFrameworkPresent = fs.existsSync(frameworkPath);
  candidateFrameworkSha256 = sha256File(frameworkPath);
} catch {
  // Framework identity is best-effort and must never prevent cleanup evidence.
}
const sourceRevision = readSourceRevision();
const replayProvenanceInput = {
  sourceHeadCommit: sourceRevision.headCommit,
  worktreeDirty: sourceRevision.worktreeDirty,
  worktreeStatusSha256: sourceRevision.worktreeStatusSha256,
  runnerScriptSha256: safeSha256File(runnerSourcePath),
  runnerProvenanceModuleSha256: safeSha256File(runnerProvenanceModulePath),
  packageManifestSha256: safeSha256File(packageManifestPath),
  packageVersion: readPackageVersion(),
  command: 'node',
  script: 'scripts/verify-electron-ollama-ui.mjs',
  scenario,
  model,
  debugPort: port,
  timeoutMs,
  platform: process.platform,
  arch: process.arch,
  node: process.version,
  osRelease: os.release(),
  preLaunchExecutableSha256: candidateExecutableSha256,
  preLaunchReviewScriptSha256: candidateReviewScriptSha256,
  preLaunchFrameworkSha256: candidateFrameworkSha256,
  loadedExecutableSha256: null,
  loadedReviewScriptSha256: null,
  loadedFrameworkSha256: null,
};
let replayProvenance = projectReplayProvenance(replayProvenanceInput);
const childOutputCaptureLimitBytes = 16000;
let childOutputBuffer = Buffer.alloc(0);
let child = null;
let childSpawnError = null;
let appProcessGroupId = null;
let childLaunchCount = 0;
const captureChildOutput = (chunk) => {
  const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
  childOutputBuffer = Buffer.concat([childOutputBuffer, chunkBuffer]);
  if (childOutputBuffer.length > childOutputCaptureLimitBytes) {
    childOutputBuffer = childOutputBuffer.subarray(-childOutputCaptureLimitBytes);
  }
};
function launchElectronChild() {
  const nextChild = spawn(childCommand, childArgs, {
    cwd: path.dirname(path.resolve(exePath)),
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
  let nextSpawnError = null;
  nextChild.once('error', (error) => {
    nextSpawnError = String(error?.code || 'SPAWN_ERROR');
    if (child === nextChild) childSpawnError = nextSpawnError;
  });
  nextChild.stdout.on('data', captureChildOutput);
  nextChild.stderr.on('data', captureChildOutput);
  Object.defineProperty(nextChild, 'spawnError', { get: () => nextSpawnError });
  child = nextChild;
  childSpawnError = null;
  appProcessGroupId = process.platform === 'win32' ? null : nextChild.pid || null;
  childLaunchCount += 1;
  return nextChild;
}
launchElectronChild();

let client;
let ownedDaemon = null;
let appServerPort = null;
const startedAt = new Date().toISOString();
const started = Date.now();
let evidence = {
  schema: 'offline-subtitle-factory.ollama-ui-live-acceptance.v5',
  scenario,
  artifact: {
    executableSha256: candidateExecutableSha256,
    reviewScriptSha256: candidateReviewScriptSha256,
    electronFrameworkSha256: candidateFrameworkSha256,
    electronFrameworkPresent: candidateFrameworkPresent,
    electronFrameworkRelativePath: 'Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework',
  },
  launch: launchSummary,
  runnerProvenance: projectRunnerProvenance({
    command: launchSummary.command,
    argv: launchSummary.argv,
    sandboxedTargetProcessTree,
    outerSandboxProfileApplied: launchSummary.outerSandboxProfileApplied,
    candidateExecutableSha256,
    candidateReviewScriptSha256,
    candidateFrameworkSha256,
    candidateFrameworkPresent,
    candidateFrameworkRelativePath: 'Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework',
    childOutputSha256: null,
    childOutputBytes: 0,
    captureLimitBytes: childOutputCaptureLimitBytes,
    startupDiagnosticCategories: [],
    rawChildOutputPersisted: false,
  }),
  replayProvenance,
  diagnostics: {
    captureLimitBytes: childOutputCaptureLimitBytes,
    rawChildOutputPersisted: false,
    childOutputSha256: null,
    childOutputBytes: 0,
    startupDiagnosticCategories: [],
  },
  startedAt,
  completedAt: null,
  elapsedMs: null,
  environment: { platform: process.platform, arch: process.arch, node: process.version },
  executable: path.basename(exePath),
  provider: 'ollama',
  baseUrl: ollamaBaseUrl,
  endpointPrivacy: aiEndpointPrivacy(ollamaBaseUrl),
  model,
  scope: {
    systemNetworkDisabled: false,
    sandboxedTargetProcessTree,
    loopbackOnlyConfiguration: isLoopbackAiUrl(ollamaBaseUrl),
    apiKeySupplied: false,
    isolatedAcceptanceDaemon: isolatedDaemon,
    lmStudio: 'not-run-by-explicit-scope-exception',
  },
  status: 'fail',
  cleanup: {
    electronExited: false,
    electronProcessGroupPresentAtCleanupStart: null,
    electronProcessGroupAbsentAfterCleanup: false,
    electronProcessGroupClosedConfirmed: false,
    electronProcessGroupForcedCleanup: false,
    appServerPortClosed: false,
    userDataRemoved: false,
    appRestart: {
      attempted: false,
      firstElectronExited: false,
      firstProcessGroupAbsentAfterCleanup: false,
      firstProcessGroupClosedConfirmed: false,
      firstProcessGroupForcedCleanup: false,
      firstAppServerPortClosed: false,
      userDataPreservedBetweenLaunches: false,
      secondLaunchReady: false,
      secondAppServerPortCaptured: false,
      secondAppServerPortClosed: false,
    },
  },
};

function refreshReplayProvenance() {
  replayProvenance = projectReplayProvenance({
    ...replayProvenanceInput,
    loadedExecutableSha256: safeSha256File(exePath),
    loadedReviewScriptSha256: safeSha256File(reviewScriptPath),
    loadedFrameworkSha256: safeSha256File(frameworkPath),
  });
  evidence.replayProvenance = replayProvenance;
}

let uiTrace = {};
let cancelledSessionId = null;
let reviewNavigation = null;
let currentStage = 'artifact_preflight';
let lastTargetSummary = { pageCount: 0, localUiPageCount: 0, filePageCount: 0 };

function waitForChildClose(timeoutMs = 5000) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    once(child, 'close').then(() => { clearTimeout(timer); resolve(true); });
  });
}

async function stopChild() {
  if (!child) return { electronExited: false, groupPresentAtCleanupStart: null, groupAbsentAfterCleanup: false, groupClosedConfirmed: false, forcedCleanup: false };
  if (childSpawnError) {
    const electronExited = await waitForChildClose(5000);
    return { electronExited, ...await cleanupProcessGroup(null), forcedCleanup: false };
  }
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    await once(killer, 'close').catch(() => {});
    const electronExited = await waitForChildClose(5000);
    return {
      electronExited,
      groupPresentAtCleanupStart: null,
      groupAbsentAfterCleanup: electronExited,
      groupClosedConfirmed: electronExited,
      forcedCleanup: false,
    };
  }
  const group = await cleanupProcessGroup(appProcessGroupId);
  const electronExited = await waitForChildClose(5000);
  return { electronExited, ...group, forcedCleanup: group.forcedCleanup };
}

async function isPortClosed(targetPort) {
  if (!targetPort) return false;
  return await new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port: targetPort });
    socket.setTimeout(1200);
    socket.once('connect', () => { socket.destroy(); resolve(false); });
    socket.once('error', (error) => resolve(error.code === 'ECONNREFUSED'));
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
  });
}

async function waitForPortClosed(targetPort) {
  if (!Number.isInteger(targetPort) || targetPort < 1024 || targetPort > 65535) return false;
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await isPortClosed(targetPort)) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

async function removeAndConfirm(target) {
  try {
    await removeUserDataWithRetries(target);
    try { fs.lstatSync(target); return false; }
    catch (error) { return error.code === 'ENOENT'; }
  } catch {
    return false;
  }
}

function failureCategory(error) {
  const message = String(error?.message || '');
  if (message === 'CANDIDATE_ARTIFACT_READ_FAILED') return 'CANDIDATE_ARTIFACT_READ_FAILED';
  if (/REPLAY_PROVENANCE_(?:UNAVAILABLE|INCOMPLETE)/.test(message)) return 'REPLAY_PROVENANCE_UNAVAILABLE';
  if (message === 'DEVTOOLS_TARGET_URL_REJECTED') return 'DEVTOOLS_TARGET_URL_REJECTED';
  if (message === 'ELECTRON_SPAWN_FAILED' || error?.code === 'ENOENT') return 'ELECTRON_SPAWN_FAILED';
  if (message === 'ELECTRON_EXITED_BEFORE_RENDERER') return 'ELECTRON_EARLY_EXIT';
  if (message === 'ELECTRON_RENDERER_TIMEOUT') return 'ELECTRON_RENDERER_TIMEOUT';
  if (message === 'Failed to connect to Electron DevTools') return 'ELECTRON_DEVTOOLS_CONNECT_FAILED';
  if (message === 'Timed out connecting to Electron DevTools') return 'ELECTRON_DEVTOOLS_CONNECT_TIMEOUT';
  if (message === 'ELECTRON_HOME_DASHBOARD_TIMEOUT') return 'ELECTRON_HOME_DASHBOARD_TIMEOUT';
  if (currentStage === 'electron_start' && safeStartupDiagnosticCategories().includes('CHROMIUM_CHILD_SANDBOX_INIT_FAILED')) return 'CHROMIUM_CHILD_SANDBOX_INIT_FAILED';
  if (/MODEL_RESPONSE_CONTRACT_REJECTED|AI 回傳內容不是有效 JSON|cue 順序不符|段落數量不符/.test(message)) return 'MODEL_RESPONSE_CONTRACT_REJECTED';
  if (/翻譯語言與輸出語言/.test(message)) return 'MODEL_OUTPUT_LANGUAGE_REJECTED';
  if (/翻譯內容過短|翻譯建議過短/.test(message)) return 'MODEL_TRANSLATION_INCOMPLETE';
  if (/Timed out|timeout/i.test(message)) return 'UI_FLOW_TIMEOUT';
  return 'UI_ACCEPTANCE_ASSERTION_FAILED';
}

function safeStartupDiagnosticCategories() {
  const checks = [
    [/Failed to initialize sandbox|sandbox initialization failed/i, 'CHROMIUM_CHILD_SANDBOX_INIT_FAILED'],
    [/GPU process isn't usable|GPU process exited unexpectedly/i, 'CHROMIUM_GPU_SANDBOX_UNAVAILABLE'],
    [/Server failed to start/, 'APP_SERVER_START_FAILED'],
    [/EADDRINUSE/, 'APP_PORT_IN_USE'],
    [/EACCES|EPERM|operation not permitted/i, 'OS_PERMISSION_DENIED'],
    [/MODULE_NOT_FOUND|Cannot find (?:module|package)/, 'BUNDLED_MODULE_MISSING'],
    [/ENOENT|No such file or directory/, 'RUNTIME_FILE_MISSING'],
    [/Bad CPU type|wrong architecture/i, 'BUNDLE_ARCHITECTURE_MISMATCH'],
    [/dyld\[|Library not loaded/, 'DYNAMIC_LOADER_FAILURE'],
  ];
  return checks.filter(([pattern]) => pattern.test(childOutputBuffer.toString('utf8'))).map(([, category]) => category);
}

function safeUiTrace(trace) {
  const optimize = trace.optimize || {};
  const settings = trace.settings || {};
  const accept = trace.accept || {};
  const history = trace.history || {};
  const save = trace.save || {};
  return {
    start: trace.start || null,
    settings: {
      opened: settings.opened === true,
      saved: settings.saved === true,
      provider: settings.provider || '',
      model: settings.model || '',
      language: settings.language || '',
      keyEmpty: settings.keyEmpty === true,
      keyHasSavedValue: settings.keyHasSavedValue === true,
      privacyIsLocal: settings.privacyIsLocal === true,
      consentDisabled: settings.consentDisabled === true,
    },
    optimize: {
      status: optimize.status || '',
      suggestionCount: Number(optimize.suggestionCount || 0),
      totalRetries: Number.isFinite(optimize.totalRetries) ? optimize.totalRetries : null,
      requestSummary: optimize.requestSummary || null,
      toolbarExpanded: optimize.toolbarExpanded === true,
    },
    accept: { accepted: Number(accept.accepted || 0), actionsHidden: accept.actionsHidden === true },
    history: { undo: history.undo === true, redo: history.redo === true, undoEnabled: history.undoEnabled === true, redoEnabled: history.redoEnabled === true },
    save: {
      saved: save.saved === true,
      subtitleFileName: save.subtitleFileName || '',
      cueCount: Number(save.cueCount || 0),
      timecodesUnchanged: save.timecodesUnchanged === true,
      hasEnglishTranslation: save.hasEnglishTranslation === true,
      reviewHashPresent: /^[a-f0-9]{64}$/i.test(String(save.reviewHash || '')),
    },
    cancelResume: trace.cancelResume || null,
  };
}

try {
  if (candidateArtifactReadFailed) {
    const artifactError = new Error('CANDIDATE_ARTIFACT_READ_FAILED');
    artifactError.code = 'CANDIDATE_ARTIFACT_READ_FAILED';
    throw artifactError;
  }
  if (!replayProvenance.sourceProvenanceComplete) {
    const provenanceError = new Error('REPLAY_PROVENANCE_UNAVAILABLE');
    provenanceError.code = 'REPLAY_PROVENANCE_UNAVAILABLE';
    throw provenanceError;
  }
  currentStage = 'electron_start';
  const target = await waitForTarget(child);
  client = await connectWebSocket(target.webSocketDebuggerUrl);
  const home = await waitForHomeDashboard(client);
  refreshReplayProvenance();
  let homeNavigationUrl = home.href;
  let navigationToken = typeof home.apiToken === 'string' ? home.apiToken : '';
  const homeEvidence = { href: home.href, title: home.title, hasHomeDashboard: home.hasHomeDashboard };
  appServerPort = Number(new URL(homeNavigationUrl).port) || null;
  if (isolatedDaemon) {
    currentStage = 'local_daemon_start';
    ownedDaemon = await startLocalAcceptanceDaemon({
      model,
      binary: process.env.OLLAMA_BIN || '/Applications/Ollama.app/Contents/Resources/ollama',
      modelsDirectory: process.env.OLLAMA_MODELS || path.join(os.homedir(), '.ollama', 'models'),
    });
    evidence.daemon = { preinstalledModelFound: ownedDaemon.preinstalledModelFound, contextLength: ownedDaemon.contextLength, modelDownloadAttempted: false, sandboxedDaemonOnly: false, existingServiceModified: false, failureCode: ownedDaemon.failureCode, diagnostics: ownedDaemon.diagnostics };
    requireOk(!ownedDaemon.failureCode && ownedDaemon.preinstalledModelFound, 'LOCAL_DAEMON_UNAVAILABLE');
    ollamaBaseUrl = ownedDaemon.baseUrl;
    evidence.baseUrl = ollamaBaseUrl;
  }
  currentStage = 'synthetic_job_setup';

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
  requireOk(/^[a-zA-Z0-9_-]+$/.test(setup.jobId), 'Invalid synthetic job ID');
  const syntheticJobRoot = path.join(userDataDir, 'jobs', setup.jobId);
  const originalSrtPath = path.join(syntheticJobRoot, 'input', 'ollama-ui-test.srt');
  const originalSrtHash = sha256(fs.readFileSync(originalSrtPath));
  evidence.source = { cueCount: setup.cueCount, timecodes: setup.timecodes, sourceSubtitleSha256: setup.sourceHash, originalSubtitleFileName: setup.subtitleFileName, originalSrtSha256Before: originalSrtHash };

  let reviewUrl = new URL(`/review/${encodeURIComponent(setup.jobId)}`, homeNavigationUrl);
  currentStage = 'review_navigation';
  reviewUrl.searchParams.set('token', navigationToken);
  await client.call('Page.navigate', { url: reviewUrl.toString() });
  const reviewLoaded = await evaluate(client, `(async () => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (document.getElementById('cueCount')?.textContent.trim() === ${JSON.stringify(String(sourceCues.length))} && document.getElementById('runAiOptimize')) return { ready: true, href: location.origin + location.pathname, title: document.title };
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return { ready: false, href: location.origin + location.pathname, title: document.title, cueCount: document.getElementById('cueCount')?.textContent.trim() || '' };
  })()`);
  reviewNavigation = {
    ready: reviewLoaded?.ready === true,
    href: typeof reviewLoaded?.href === 'string' && /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/(?:review|index|trim)(?:\/|$)/.test(reviewLoaded.href) ? reviewLoaded.href : '',
    title: typeof reviewLoaded?.title === 'string' && reviewLoaded.title.length <= 128 ? reviewLoaded.title : '',
    cueCount: typeof reviewLoaded?.cueCount === 'string' && /^\d{1,4}$/.test(reviewLoaded.cueCount) ? reviewLoaded.cueCount : '',
  };
  requireOk(reviewLoaded.ready, `校閱頁未載入 ${sourceCues.length} 段字幕：${reviewLoaded.cueCount || 'unknown'}`);
  currentStage = 'ai_settings';

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
    setValue('aiBatchSize', ${isCancelResumeScenario ? 1 : 2});
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
  currentStage = 'ai_start';

  await evaluate(client, `(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init = {}) => {
      const requestUrl = new URL(typeof input === 'string' ? input : input.url, location.href);
      const method = String(init.method || 'GET').toUpperCase();
      if (requestUrl.pathname.endsWith('/ai-optimize') && method === 'POST') {
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
      const response = await originalFetch(input, init);
      if (requestUrl.pathname.endsWith('/cancel-ai-optimize') && method === 'POST') {
        let result = null;
        try { result = await response.clone().json(); } catch {}
        window.__osfOllamaUiCancelResponse = {
          status: response.status,
          ok: response.ok && result?.ok === true,
          cancelled: result?.cancelled === true,
        };
      }
      return response;
    };
    return true;
  })()`);

  const startFlow = await evaluate(client, `(async () => {
    if (document.getElementById('aiToolbar').classList.contains('collapsed')) document.getElementById('toggleAiToolbar').click();
    document.querySelector('.ai-mode[data-ai-mode="translate"]').click();
    document.getElementById('aiScope').value = 'all';
    document.getElementById('aiScope').dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('aiPreserveTiming').checked = true;
    document.getElementById('runAiOptimize').click();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const response = await fetch('/api/jobs/' + encodeURIComponent(${JSON.stringify(setup.jobId)}) + '/ai-optimize', { cache: 'no-store' });
    const record = await response.json();
    return { runDisabled: document.getElementById('runAiOptimize').disabled, taskHttpStatus: response.status, taskStatus: record.status || '', requestCaptured: Boolean(window.__osfOllamaUiRequestSummary), errorPresent: Boolean(record.error), requestSummary: window.__osfOllamaUiRequestSummary || null };
  })()`);
  uiTrace.start = startFlow;
  console.log(JSON.stringify({ stage: currentStage, ...startFlow }));
  requireOk(startFlow.requestCaptured && startFlow.taskHttpStatus === 200 && ['running', 'completed'].includes(startFlow.taskStatus), 'UI did not start an AI task');

  if (isCancelResumeScenario) {
    currentStage = 'checkpoint_cancel';
    const cancellation = await evaluate(client, `(async () => {
      const endpoint = '/api/jobs/' + encodeURIComponent(${JSON.stringify(setup.jobId)});
      const deadline = Date.now() + 180000;
      while (Date.now() < deadline) {
        const record = await fetch(endpoint + '/ai-optimize', { cache: 'no-store' }).then((response) => response.json());
        if (record.status === 'running' && record.progress?.completedBatches > 0 && record.progress.completedBatches < record.progress.totalBatches) {
          document.getElementById('cancelAiOptimize').click();
          const stopDeadline = Date.now() + 10000;
          let stopped;
          while (Date.now() < stopDeadline) {
            stopped = await fetch(endpoint + '/ai-optimize', { cache: 'no-store' }).then((response) => response.json());
            if (stopped.status === 'cancelled' && document.getElementById('cancelAiOptimize').hidden) break;
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          // Give the product's ordinary UI poll a chance to reconcile its terminal state.
          await new Promise((resolve) => setTimeout(resolve, 1500));
          const review = await fetch(endpoint + '/review-data', { cache: 'no-store' }).then((response) => response.json());
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(review.subtitle || ''));
          return {
            status: stopped.status,
            sessionId: stopped.sessionId,
            retryable: stopped.retryable === true,
            completedBatches: Number(stopped.progress?.completedBatches || 0),
            totalBatches: Number(stopped.progress?.totalBatches || 0),
            resumeVisibleBeforeReload: document.getElementById('resumeAiOptimize').hidden === false,
            runEnabledAfterCancel: !document.getElementById('runAiOptimize').disabled,
            cancelHidden: document.getElementById('cancelAiOptimize').hidden === true,
            suggestionsHidden: document.getElementById('aiSuggestionActions').hidden === true,
            sourceSubtitleSha256: [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join(''),
            requestSummary: window.__osfOllamaUiRequestSummary || null,
            cancelResponse: window.__osfOllamaUiCancelResponse || null,
            pageTimeOrigin: performance.timeOrigin,
          };
        }
        if (['completed', 'failed', 'cancelled', 'interrupted'].includes(record.status)) return { status: 'checkpoint-window-missed', observedTaskStatus: record.status, errorPresent: Boolean(record.error) };
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return { status: 'timeout' };
    })()`, 200000);
    const cancelResume = {
      cancelled: cancellation.status === 'cancelled',
      observedStatus: cancellation.status,
      observedTaskStatus: cancellation.observedTaskStatus || '',
      errorPresent: cancellation.errorPresent === true,
      retryable: cancellation.retryable === true,
      completedBatches: cancellation.completedBatches || 0,
      totalBatches: cancellation.totalBatches || 0,
      resumeVisibleBeforeReload: cancellation.resumeVisibleBeforeReload === true,
      runEnabledAfterCancel: cancellation.runEnabledAfterCancel === true,
      cancelHidden: cancellation.cancelHidden === true,
      suggestionsHidden: cancellation.suggestionsHidden === true,
      sourceSubtitleUnchangedAfterCancel: cancellation.sourceSubtitleSha256 === setup.sourceHash,
      originalSrtUnchangedAfterCancel: sha256(fs.readFileSync(originalSrtPath)) === originalSrtHash,
      cancelRequestHttpStatus: Number(cancellation.cancelResponse?.status || 0),
      cancelRequestAccepted: cancellation.cancelResponse?.ok === true,
      cancelRequestCancelled: cancellation.cancelResponse?.cancelled === true,
    };
    uiTrace.cancelResume = cancelResume;
    requireOk(cancelResume.cancelled && cancelResume.retryable && cancelResume.completedBatches > 0 && cancelResume.completedBatches < cancelResume.totalBatches, 'Checkpoint cancellation window not confirmed');
    requireOk(cancelResume.cancelRequestHttpStatus === 200 && cancelResume.cancelRequestAccepted && cancelResume.cancelRequestCancelled, 'Cancel POST response was not observed as accepted');
    const checkpoint = JSON.parse(fs.readFileSync(path.join(syntheticJobRoot, 'ai-output', 'checkpoint.json'), 'utf8'));
    cancelResume.checkpointPersisted = checkpoint.checkpoint?.nextBatchIndex === cancelResume.completedBatches;
    cancelResume.checkpointSuggestionCount = checkpoint.checkpoint?.suggestions?.length || 0;
    requireOk(cancelResume.checkpointPersisted && cancelResume.checkpointSuggestionCount === cancelResume.completedBatches, 'Persisted checkpoint does not match cancellation');
    const requestSummary = cancellation.requestSummary;
    currentStage = 'checkpoint_reload';
    await client.call('Page.navigate', { url: reviewUrl.toString() });
    const restored = await evaluate(client, `(async () => {
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        if (performance.timeOrigin !== ${JSON.stringify(cancellation.pageTimeOrigin)} && document.getElementById('cueCount')?.textContent.trim() === ${JSON.stringify(String(sourceCues.length))} && document.getElementById('resumeAiOptimize')?.hidden === false) {
          const record = await fetch('/api/jobs/' + encodeURIComponent(${JSON.stringify(setup.jobId)}) + '/ai-optimize', { cache: 'no-store' }).then((response) => response.json());
          return { ready: true, sessionId: record.sessionId, completedBatches: record.progress?.completedBatches, status: record.status, cancelHidden: document.getElementById('cancelAiOptimize').hidden === true };
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return { ready: false };
    })()`);
    cancelResume.resumeVisibleAfterReload = restored.ready === true;
    cancelResume.sessionUnchangedAfterReload = restored.sessionId === cancellation.sessionId;
    cancelResume.checkpointUnchangedAfterReload = restored.completedBatches === cancelResume.completedBatches && restored.status === 'cancelled' && restored.cancelHidden === true;
    requireOk(cancelResume.resumeVisibleAfterReload && cancelResume.sessionUnchangedAfterReload && cancelResume.checkpointUnchangedAfterReload, 'Reload did not restore cancelled checkpoint');
    if (requiresAppRestart) {
      currentStage = 'checkpoint_app_restart';
      const firstAppServerPort = appServerPort;
      const userDataPresentBeforeRestart = fs.existsSync(userDataDir) && fs.existsSync(syntheticJobRoot);
      client?.close();
      client = null;
      const firstCleanup = await stopChild();
      const firstAppServerPortClosed = await waitForPortClosed(firstAppServerPort);
      evidence.cleanup.appRestart.attempted = true;
      evidence.cleanup.appRestart.firstElectronExited = firstCleanup.electronExited;
      evidence.cleanup.appRestart.firstProcessGroupAbsentAfterCleanup = firstCleanup.groupAbsentAfterCleanup;
      evidence.cleanup.appRestart.firstProcessGroupClosedConfirmed = firstCleanup.groupClosedConfirmed;
      evidence.cleanup.appRestart.firstProcessGroupForcedCleanup = firstCleanup.forcedCleanup;
      evidence.cleanup.appRestart.firstAppServerPortClosed = firstAppServerPortClosed;
      evidence.cleanup.appRestart.userDataPreservedBetweenLaunches = userDataPresentBeforeRestart;
      requireOk(firstCleanup.electronExited && firstCleanup.groupAbsentAfterCleanup && firstCleanup.groupClosedConfirmed && !firstCleanup.forcedCleanup && firstAppServerPortClosed && userDataPresentBeforeRestart, 'First Electron launch did not close while preserving restart data');
      appServerPort = null;
      launchElectronChild();
      const restartedTarget = await waitForTarget(child);
      client = await connectWebSocket(restartedTarget.webSocketDebuggerUrl);
      const restartedHome = await waitForHomeDashboard(client);
      refreshReplayProvenance();
      homeNavigationUrl = restartedHome.href;
      navigationToken = typeof restartedHome.apiToken === 'string' ? restartedHome.apiToken : '';
      appServerPort = Number(new URL(homeNavigationUrl).port) || null;
      evidence.cleanup.appRestart.secondAppServerPortCaptured = Number.isInteger(appServerPort);
      requireOk(evidence.cleanup.appRestart.secondAppServerPortCaptured, 'Second Electron launch did not expose a valid app server port');
      reviewUrl = new URL(`/review/${encodeURIComponent(setup.jobId)}`, homeNavigationUrl);
      reviewUrl.searchParams.set('token', navigationToken);
      await client.call('Page.navigate', { url: reviewUrl.toString() });
      const restoredAfterRestart = await evaluate(client, `(async () => {
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
          if (document.getElementById('cueCount')?.textContent.trim() === ${JSON.stringify(String(sourceCues.length))} && document.getElementById('resumeAiOptimize')?.hidden === false) {
            const record = await fetch('/api/jobs/' + encodeURIComponent(${JSON.stringify(setup.jobId)}) + '/ai-optimize', { cache: 'no-store' }).then((response) => response.json());
            return {
              ready: true,
              pageTimeOrigin: performance.timeOrigin,
              sessionId: record.sessionId,
              completedBatches: record.progress?.completedBatches,
              status: record.status,
              cancelHidden: document.getElementById('cancelAiOptimize').hidden === true,
            };
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return { ready: false, pageTimeOrigin: performance.timeOrigin };
      })()`, 20000);
      cancelResume.appRestartAttempted = true;
      cancelResume.appRestarted = restoredAfterRestart.ready === true;
      cancelResume.resumeVisibleAfterAppRestart = restoredAfterRestart.ready === true;
      cancelResume.sessionUnchangedAfterAppRestart = restoredAfterRestart.sessionId === cancellation.sessionId;
      cancelResume.checkpointUnchangedAfterAppRestart = restoredAfterRestart.completedBatches === cancelResume.completedBatches && restoredAfterRestart.status === 'cancelled' && restoredAfterRestart.cancelHidden === true;
      cancelResume.pageTimeOriginChangedAfterAppRestart = restoredAfterRestart.pageTimeOrigin !== cancellation.pageTimeOrigin;
      evidence.cleanup.appRestart.secondLaunchReady = restoredAfterRestart.ready === true;
      requireOk(cancelResume.resumeVisibleAfterAppRestart && cancelResume.sessionUnchangedAfterAppRestart && cancelResume.checkpointUnchangedAfterAppRestart && cancelResume.pageTimeOriginChangedAfterAppRestart, 'App restart did not restore cancelled checkpoint/session');
    }
    await evaluate(client, `(() => {
      window.__osfOllamaUiRequestSummary = ${JSON.stringify(requestSummary)};
      const originalFetch = window.fetch;
      window.fetch = async (input, init = {}) => {
        const response = await originalFetch(input, init);
        const url = new URL(typeof input === 'string' ? input : input.url, location.href);
        if (url.pathname.endsWith('/resume-ai-optimize') && String(init.method || 'GET').toUpperCase() === 'POST') {
          const result = await response.clone().json();
          window.__osfOllamaUiResume = { ok: response.ok && result.ok === true, resumedFromBatch: result.resumedFromBatch };
        }
        return response;
      };
      document.getElementById('resumeAiOptimize').click();
      return true;
    })()`);
    cancelledSessionId = cancellation.sessionId;
  }

  currentStage = 'ai_complete';
  const runFlow = await evaluate(client, `(async () => {
    const deadline = Date.now() + 300000;
    while (Date.now() < deadline) {
      const recordResponse = await fetch('/api/jobs/' + encodeURIComponent(${JSON.stringify(setup.jobId)}) + '/ai-optimize', { cache: 'no-store' });
      const record = recordResponse.ok ? await recordResponse.json() : null;
      const cancelHidden = document.getElementById('cancelAiOptimize')?.hidden;
      if (record && ['completed', 'failed', 'cancelled', 'interrupted'].includes(record.status) && cancelHidden && (${JSON.stringify(scenario)} === 'complete' || window.__osfOllamaUiResume?.ok === true)) {
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
          resumeResponse: window.__osfOllamaUiResume || null,
          resumedFromBatch: record.result?.resumedFromBatch ?? null,
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
  if (isCancelResumeScenario) {
    const trace = uiTrace.cancelResume;
    trace.resumeRequestAccepted = runFlow.resumeResponse?.ok === true;
    trace.resumedFromBatch = runFlow.resumedFromBatch;
    trace.resumeStartsAtCheckpoint = trace.resumedFromBatch === trace.completedBatches && runFlow.resumeResponse?.resumedFromBatch === trace.completedBatches;
    trace.sessionUnchangedAfterResume = cancelledSessionId === runFlow.sessionId;
    requireOk(trace.resumeRequestAccepted && trace.resumeStartsAtCheckpoint && trace.sessionUnchangedAfterResume, 'UI resume did not continue the same checkpoint/session');
  }

  const acceptFlow = await evaluate(client, `(async () => {
    document.getElementById('acceptAllAiSuggestions').click();
    const deadline = Date.now() + 10000;
    let sessions = null;
    while (Date.now() < deadline) {
      const response = await fetch('/api/jobs/' + encodeURIComponent(${JSON.stringify(setup.jobId)}) + '/ai-sessions', { cache: 'no-store' });
      sessions = response.ok ? await response.json() : null;
      const session = sessions?.sessions?.find((item) => item.sessionId === ${JSON.stringify(runFlow.sessionId)});
      if (session?.statistics?.accepted === ${sourceCues.length}) return { accepted: session.statistics.accepted, actionsHidden: document.getElementById('aiSuggestionActions')?.hidden === true, changedCount: document.getElementById('changedCount')?.textContent.trim() || '' };
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
      if (review?.subtitleFileName === 'reviewed.srt' && review.bilingualCues?.length === ${sourceCues.length}) {
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
  evidence.source.originalSrtSha256After = sha256(fs.readFileSync(originalSrtPath));
  evidence.source.originalSrtUnchanged = evidence.source.originalSrtSha256After === originalSrtHash;
  requireOk(evidence.source.originalSrtUnchanged, 'Original synthetic SRT changed');
  if (isCancelResumeScenario) {
    const trace = uiTrace.cancelResume;
    requireOk(trace.resumeVisibleBeforeReload && trace.runEnabledAfterCancel && trace.cancelHidden && trace.suggestionsHidden && trace.sourceSubtitleUnchangedAfterCancel && trace.originalSrtUnchangedAfterCancel, 'Cancellation UI or source invariants failed');
  }

  requireOk(evidence.replayProvenance?.provenanceComplete === true, 'REPLAY_PROVENANCE_INCOMPLETE');
  evidence.status = 'pass';
  evidence.home = homeEvidence;
  evidence.appServerPort = appServerPort;
  evidence.job = { createStatus: setup.createStatus, startStatus: setup.startStatus, finalStatus: setup.finalStatus, cueCount: setup.cueCount };
  evidence.ui = {
    reviewLoaded,
    settings: settingsFlow,
    optimize: { status: runFlow.status, sessionIdPresent: Boolean(runFlow.sessionId), suggestionCount: runFlow.suggestionCount, totalRetries: runFlow.totalRetries, progress: runFlow.progress, toolbarExpanded: runFlow.toolbarExpanded },
    accept: acceptFlow,
    history: historyFlow,
    save: { saved: saveFlow.saved, subtitleFileName: saveFlow.subtitleFileName, cueCount: saveFlow.cueCount, timecodesUnchanged: saveFlow.timecodesUnchanged, hasEnglishTranslation: saveFlow.hasEnglishTranslation, reviewSha256: saveFlow.reviewHash },
    cancelResume: uiTrace.cancelResume || null,
  };
} catch (error) {
  evidence.error = {
    stage: currentStage,
    targetSummary: lastTargetSummary,
    category: failureCategory(error),
    code: /^[A-Z0-9_]+$/.test(String(error?.code || '')) ? String(error.code) : '',
    electronExitCode: Number.isInteger(child.exitCode) ? child.exitCode : null,
    electronExitSignal: /^SIG[A-Z0-9]+$/.test(String(child.signalCode || '')) ? child.signalCode : null,
    startupDiagnosticCategories: safeStartupDiagnosticCategories(),
    reviewNavigation,
  };
  evidence.ui = safeUiTrace(uiTrace);
} finally {
  evidence.completedAt = new Date().toISOString();
  evidence.elapsedMs = Date.now() - started;
  evidence.diagnostics = {
    captureLimitBytes: childOutputCaptureLimitBytes,
    rawChildOutputPersisted: false,
    childOutputSha256: sha256(childOutputBuffer),
    childOutputBytes: childOutputBuffer.length,
    startupDiagnosticCategories: safeStartupDiagnosticCategories(),
  };
  evidence.runnerProvenance = {
    ...evidence.runnerProvenance,
    childOutputSha256: evidence.diagnostics.childOutputSha256,
    childOutputBytes: evidence.diagnostics.childOutputBytes,
    captureLimitBytes: evidence.diagnostics.captureLimitBytes,
    startupDiagnosticCategories: evidence.diagnostics.startupDiagnosticCategories,
    rawChildOutputPersisted: evidence.diagnostics.rawChildOutputPersisted,
  };
  client?.close();
  const childCleanup = await stopChild();
  evidence.cleanup.electronExited = childCleanup.electronExited;
  evidence.cleanup.electronProcessGroupPresentAtCleanupStart = childCleanup.groupPresentAtCleanupStart;
  evidence.cleanup.electronProcessGroupAbsentAfterCleanup = childCleanup.groupAbsentAfterCleanup;
  evidence.cleanup.electronProcessGroupClosedConfirmed = childCleanup.groupClosedConfirmed;
  evidence.cleanup.electronProcessGroupForcedCleanup = childCleanup.forcedCleanup;
  evidence.cleanup.appServerPortClosed = await waitForPortClosed(appServerPort);
  if (evidence.cleanup.appRestart.attempted) evidence.cleanup.appRestart.secondAppServerPortClosed = evidence.cleanup.appServerPortClosed;
  evidence.cleanup.userDataRemoved = await removeAndConfirm(userDataDir);
  evidence.cleanup.ownedDaemon = await stopLocalAcceptanceDaemon(ownedDaemon);
  const daemonCleanup = evidence.cleanup.ownedDaemon;
  if (!evidence.cleanup.electronExited || !evidence.cleanup.electronProcessGroupAbsentAfterCleanup
    || !evidence.cleanup.electronProcessGroupClosedConfirmed || evidence.cleanup.electronProcessGroupForcedCleanup
    || !evidence.cleanup.appServerPortClosed || !evidence.cleanup.userDataRemoved
    || !daemonCleanup.stopped || !daemonCleanup.processGroupAbsent || daemonCleanup.forcedCleanup || !daemonCleanup.portClosed || !daemonCleanup.temporaryRootRemoved) {
    evidence.status = 'fail';
    evidence.error ||= { category: 'CLEANUP_NOT_CONFIRMED', code: '' };
  }
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  } catch {
    console.error('Ollama UI acceptance evidence could not be safely written.');
    evidence.status = 'fail';
  }
  console.log(JSON.stringify({ outputPath, status: evidence.status, model, elapsedMs: evidence.elapsedMs, error: evidence.error || null, cleanup: evidence.cleanup }, null, 2));
  if (evidence.status !== 'pass') process.exitCode = 1;
}
