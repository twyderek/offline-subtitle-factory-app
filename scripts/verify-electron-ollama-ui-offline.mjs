import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnManagedChild, stopManagedChild } from '../lib/ai/managed-child-process.mjs';
import { cleanupProcessGroup } from '../lib/process-group-cleanup.mjs';
import { sanitizeRunnerArgv } from '../lib/runner-provenance.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandboxExec = '/usr/bin/sandbox-exec';
const sandboxProfile = '(version 1) (allow default) (deny network-outbound) (deny network-inbound) (deny network-bind) (allow network-bind (local ip "localhost:*")) (allow network-inbound (local ip "localhost:*")) (allow network-outbound (remote ip "localhost:*"))';
const bundlePathArgument = process.argv[2] || '';
const bundleInputKind = classifyBundleInputKind(bundlePathArgument);
const requestedModel = String(process.argv[4] || process.env.OLLAMA_MODEL || 'llama3.2:3b').trim();
const evidenceDefaultName = `${new Date().toISOString().slice(0, 10)}-ollama-${requestedModel.replace(/[^a-z0-9.-]+/gi, '-')}-ui-offline.json`;
const evidencePath = path.resolve(process.argv[3] || path.join(appDir, 'docs/project-management/evidence', evidenceDefaultName));
const configuredOllamaBaseUrl = String(process.env.OLLAMA_BASE_URL || '').trim();
const configuredUiBaseUrl = String(process.env.OSF_OLLAMA_UI_BASE_URL || '').trim();
const testDaemonSpawnCommand = process.env.NODE_ENV === 'test'
  ? String(process.env.OSF_TEST_ONLY_OLLAMA_UI_DAEMON_COMMAND || '').trim()
  : '';
const testUiSpawnCommand = process.env.NODE_ENV === 'test'
  ? String(process.env.OSF_TEST_ONLY_OLLAMA_UI_RUNNER_COMMAND || '').trim()
  : '';
const daemonSpawnCommand = testDaemonSpawnCommand ? path.resolve(testDaemonSpawnCommand) : sandboxExec;
const uiSpawnCommand = testUiSpawnCommand ? path.resolve(testUiSpawnCommand) : process.execPath;
const PATH_VALUE = process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
const startedAt = new Date().toISOString();
const started = Date.now();

const evidence = {
  schema: 'offline-subtitle-factory.ollama-ui-offline-acceptance.v5',
  startedAt,
  completedAt: null,
  elapsedMs: null,
  environment: { platform: process.platform, arch: process.arch, node: process.version, macOSProductVersion: null, macOSBuildVersion: null },
  candidate: { bundleInputKind, bundleVersion: null, bundleIdentifier: null, executableName: null, executableSha256: null },
  provider: 'ollama',
  model: requestedModel,
  status: 'fail',
  failureCode: null,
  failureStage: null,
  isolation: {
    mechanism: 'macOS Seatbelt sandbox-exec',
    profileId: 'deny-network-loopback-only-v1',
    loopbackAllowed: false,
    externalSocketDenied: false,
    externalSocketError: null,
    daemonStartedInSandbox: false,
    electronAppStartedInSandbox: false,
    uiAutomationDriverSandboxed: false,
    networkSandboxInheritedByElectronAndServer: false,
    systemNetworkDisabled: false,
  },
  daemon: { preinstalledModelFound: false, modelDownloadAttempted: false, stopped: true },
  ui: null,
  cleanup: {
    uiRunnerExited: true,
    uiAutomationDriverGroupPresentAtCleanupStart: false,
    uiAutomationDriverGroupAbsentAfterCleanup: true,
    uiAutomationDriverGroupClosedConfirmed: true,
    uiAutomationDriverGroupForcedCleanup: false,
    daemonStopped: true,
    ollamaDaemonGroupPresentAtCleanupStart: false,
    ollamaDaemonGroupAbsentAfterCleanup: true,
    ollamaDaemonGroupClosedConfirmed: true,
    ollamaDaemonGroupForcedCleanup: false,
    daemonPortClosed: true,
    temporaryRootRemoved: true,
  },
  scope: {
    systemNetworkDisabled: false,
    apiKeySupplied: false,
    externalProviderUsed: false,
    lmStudio: 'not-run-by-explicit-scope-exception',
    windows: 'deferred-by-request',
  },
};

function classifyBundleInputKind(bundlePath) {
  if (typeof bundlePath !== 'string' || !bundlePath) return 'missing';
  const normalized = path.resolve(bundlePath);
  if (normalized.endsWith('.app')) return 'app_bundle_directory';
  if (/\.app[\\/]Contents[\\/]MacOS[\\/][^\\/]+$/.test(normalized)) return 'app_executable_path';
  return 'other';
}

function readSanitizedMacOSIdentity() {
  function readValue(argument, pattern) {
    const result = spawnSync('/usr/bin/sw_vers', [argument], {
      encoding: 'utf8', timeout: 5000, maxBuffer: 1024, env: { PATH: PATH_VALUE },
    });
    if (result.error || result.status !== 0) return null;
    const value = String(result.stdout || '').trim();
    return pattern.test(value) ? value : null;
  }
  return {
    productVersion: readValue('-productVersion', /^\d+\.\d+(?:\.\d+)?$/),
    buildVersion: readValue('-buildVersion', /^[A-Za-z0-9]+$/),
  };
}

let currentStage = 'preflight';
let tempRoot = null;
let modelDirectory = null;
let ollamaBinary = null;
let daemonPort = null;
let daemonProcess = null;
let uiRunnerProcess = null;
let uiEvidencePath = null;
let uiRunnerGroupId = null;
let daemonGroupId = null;
let uiRunnerTimedOut = false;
let uiRunnerGroupCleanup = null;
let daemonGroupCleanup = null;

function fail(code) {
  evidence.failureCode ||= code;
  evidence.failureStage ||= currentStage;
  throw new Error(code);
}

function resolveExecutable(name) {
  const candidates = PATH_VALUE.split(path.delimiter).map((directory) => path.join(directory, name));
  return candidates.find((candidate) => {
    try { fs.accessSync(candidate, fs.constants.X_OK); return true; } catch { return false; }
  }) || null;
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.once('error', reject);
    stream.once('end', () => resolve(hash.digest('hex')));
  });
}

function readPlistValue(plistPath, key) {
  const result = spawnSync('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plistPath], {
    encoding: 'utf8', timeout: 5000, maxBuffer: 4096, env: { PATH: PATH_VALUE },
  });
  if (result.error || result.status !== 0) return '';
  return String(result.stdout || '').trim();
}

function inspectBundle(bundlePath) {
  let resolvedBundle;
  try { resolvedBundle = fs.realpathSync(bundlePath); } catch { fail('APP_BUNDLE_NOT_FOUND'); }
  if (!resolvedBundle.endsWith('.app') || !fs.statSync(resolvedBundle).isDirectory()) fail('APP_BUNDLE_INVALID');
  const contentsDir = path.join(resolvedBundle, 'Contents');
  const plistPath = path.join(contentsDir, 'Info.plist');
  const executableName = readPlistValue(plistPath, 'CFBundleExecutable');
  const bundleIdentifier = readPlistValue(plistPath, 'CFBundleIdentifier');
  const bundleVersion = readPlistValue(plistPath, 'CFBundleShortVersionString');
  if (!executableName || !/^[\p{L}\p{N}._ -]+$/u.test(executableName)) fail('APP_BUNDLE_EXECUTABLE_INVALID');
  if (bundleIdentifier !== 'com.offline-subtitle-factory.app') fail('APP_BUNDLE_IDENTIFIER_MISMATCH');
  const packagePath = path.join(contentsDir, 'Resources', 'app', 'package.json');
  let packageVersion = '';
  try { packageVersion = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version || ''; } catch {}
  if (!bundleVersion || bundleVersion !== packageVersion) fail('APP_BUNDLE_VERSION_MISMATCH');
  const executablePath = path.join(contentsDir, 'MacOS', executableName);
  try { fs.accessSync(executablePath, fs.constants.X_OK); } catch { fail('APP_BUNDLE_EXECUTABLE_MISSING'); }
  return { bundleVersion, bundleIdentifier, executableName, executablePath };
}

async function reserveLoopbackPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

function verifySandboxProfile() {
  const probeSource = 'const http=require("node:http"),net=require("node:net");const s=http.createServer((q,r)=>r.end("loopback-ok"));s.listen(0,"127.0.0.1",()=>{const p=s.address().port;http.get("http://127.0.0.1:"+p,r=>{let b="";r.setEncoding("utf8");r.on("data",x=>b+=x);r.on("end",()=>{const c=net.connect({host:"192.0.2.1",port:18114});c.once("connect",()=>{console.log(JSON.stringify({loopback:b,externalError:"CONNECTED"}));c.destroy();s.close(()=>process.exit(2))});c.once("error",e=>{console.log(JSON.stringify({loopback:b,externalError:e.code||"ERROR"}));s.close(()=>process.exit(e.code==="EPERM"?0:3))})})}).on("error",()=>s.close(()=>process.exit(4)))})';
  const result = spawnSync(sandboxExec, ['-p', sandboxProfile, process.execPath, '-e', probeSource], {
    encoding: 'utf8', timeout: 15000, maxBuffer: 4096, env: { PATH: PATH_VALUE },
  });
  let parsed;
  try { parsed = JSON.parse(String(result.stdout || '').trim()); } catch { fail('SANDBOX_PROFILE_ASSERTION_FAILED'); }
  if (result.error || result.status !== 0 || parsed?.loopback !== 'loopback-ok' || parsed?.externalError !== 'EPERM') {
    fail('SANDBOX_PROFILE_ASSERTION_FAILED');
  }
  evidence.isolation.loopbackAllowed = true;
  evidence.isolation.externalSocketDenied = true;
  evidence.isolation.externalSocketError = parsed.externalError;
}

function recordGroupCleanup(prefix, result) {
  evidence.cleanup[`${prefix}PresentAtCleanupStart`] = result.groupPresentAtCleanupStart;
  evidence.cleanup[`${prefix}AbsentAfterCleanup`] = result.groupAbsentAfterCleanup;
  evidence.cleanup[`${prefix}ClosedConfirmed`] = result.groupClosedConfirmed;
  evidence.cleanup[`${prefix}ForcedCleanup`] = result.forcedCleanup;
}

async function cleanupAndRecordGroup(groupId, prefix) {
  const result = await cleanupProcessGroup(groupId, { gracefulMs: 5000, forceMs: 3000 });
  recordGroupCleanup(prefix, result);
  return result;
}

async function waitForOllama(baseUrl, managedChild, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (managedChild.spawnError) fail('SANDBOXED_OLLAMA_SPAWN_FAILED');
    if (managedChild.closeInfo || managedChild.child.exitCode !== null || managedChild.child.signalCode !== null) fail('SANDBOXED_OLLAMA_EXITED');
    try {
      const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(1200), redirect: 'error' });
      if (response.ok) return await response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  fail('SANDBOXED_OLLAMA_READY_TIMEOUT');
}

function waitForManagedChildClose(managedChild, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ closeInfo: null, timedOut: true }), timeoutMs);
    managedChild.closed.then((closeInfo) => {
      clearTimeout(timer);
      resolve({ closeInfo, timedOut: false });
    });
  });
}

async function runPackagedUiDriver(app, ollamaBaseUrl, devtoolsPort) {
  const verifierPath = path.join(appDir, 'scripts/verify-electron-ollama-ui.mjs');
  const runnerEnv = {
    PATH: PATH_VALUE,
    HOME: tempRoot,
    TMPDIR: path.join(tempRoot, 'ui-tmp'),
    TMP: path.join(tempRoot, 'ui-tmp'),
    TEMP: path.join(tempRoot, 'ui-tmp'),
    LANG: process.env.LANG || 'en_US.UTF-8',
    OSF_OLLAMA_UI_BASE_URL: `${ollamaBaseUrl}/v1`,
    OSF_OLLAMA_UI_MODEL: requestedModel,
    OSF_OLLAMA_UI_NETWORK_SANDBOX: '1',
    SUBTITLE_AI_API_KEY: '',
    SUBTITLE_AI_KEYS_JSON: '{}',
  };
  if (process.env.NODE_ENV === 'test') runnerEnv.NODE_ENV = 'test';
  fs.mkdirSync(runnerEnv.TMPDIR, { recursive: true });
  const args = [
    verifierPath,
    app.executablePath,
    String(devtoolsPort),
    '30000',
    uiEvidencePath,
    requestedModel,
  ];
  currentStage = 'electron_start';
  uiRunnerProcess = spawnManagedChild(uiSpawnCommand, args, {
    cwd: appDir,
    env: runnerEnv,
    stdio: 'ignore',
    detached: true,
  });
  uiRunnerGroupId = uiRunnerProcess.child.pid || null;
  const wait = await waitForManagedChildClose(uiRunnerProcess, 420000);
  uiRunnerTimedOut = wait.timedOut;
  evidence.cleanup.uiRunnerExited = Boolean(wait.closeInfo);
  uiRunnerGroupCleanup = await cleanupAndRecordGroup(uiRunnerGroupId, 'uiAutomationDriverGroup');
  if (uiRunnerTimedOut) {
    const finalWait = await waitForManagedChildClose(uiRunnerProcess, 5000);
    evidence.cleanup.uiRunnerExited = Boolean(finalWait.closeInfo);
  }
  evidence.isolation.uiAutomationDriverSandboxed = false;
  let uiEvidence = null;
  if (fs.existsSync(uiEvidencePath)) {
    try { uiEvidence = JSON.parse(fs.readFileSync(uiEvidencePath, 'utf8')); }
    catch { fail('UI_EVIDENCE_INVALID'); }
    evidence.ui = projectUiEvidence(uiEvidence);
    evidence.isolation.electronAppStartedInSandbox = uiEvidence?.scope?.sandboxedTargetProcessTree === true;
    evidence.isolation.networkSandboxInheritedByElectronAndServer = evidence.isolation.electronAppStartedInSandbox;
  }
  if (uiRunnerTimedOut) fail('UI_RUNNER_TIMEOUT');
  if (uiRunnerProcess.spawnError) fail('UI_RUNNER_SPAWN_FAILED');
  if (!uiRunnerGroupCleanup.groupAbsentAfterCleanup || !uiRunnerGroupCleanup.groupClosedConfirmed) fail('UI_RUNNER_PROCESS_GROUP_LEAK');
  if (!fs.existsSync(uiEvidencePath)) fail('UI_EVIDENCE_MISSING');

  if (!uiEvidence) {
    try { uiEvidence = JSON.parse(fs.readFileSync(uiEvidencePath, 'utf8')); }
    catch { fail('UI_EVIDENCE_INVALID'); }
    evidence.ui = projectUiEvidence(uiEvidence);
    evidence.isolation.electronAppStartedInSandbox = uiEvidence?.scope?.sandboxedTargetProcessTree === true;
    evidence.isolation.networkSandboxInheritedByElectronAndServer = evidence.isolation.electronAppStartedInSandbox;
  }
  const uiBase = new URL(String(uiEvidence?.baseUrl || ''));
  if (uiBase.protocol !== 'http:' || uiBase.hostname !== '127.0.0.1' || Number(uiBase.port) !== Number(new URL(ollamaBaseUrl).port)) {
    fail('UI_ENDPOINT_MISMATCH');
  }
  if (uiEvidence?.scope?.sandboxedTargetProcessTree !== true || uiEvidence?.scope?.apiKeySupplied !== false || uiEvidence?.endpointPrivacy !== 'local') fail('UI_LOCAL_PRIVACY_ASSERTION_FAILED');
  if (uiEvidence?.status !== 'pass') {
    const category = String(uiEvidence?.error?.category || '');
    if (category === 'CHROMIUM_CHILD_SANDBOX_INIT_FAILED' || category === 'MODEL_RESPONSE_CONTRACT_REJECTED'
      || category === 'MODEL_OUTPUT_LANGUAGE_REJECTED' || category === 'MODEL_TRANSLATION_INCOMPLETE') fail(category);
    if (uiEvidence?.error?.startupDiagnosticCategories?.includes('CHROMIUM_CHILD_SANDBOX_INIT_FAILED')) {
      fail('CHROMIUM_CHILD_SANDBOX_INIT_FAILED');
    }
    fail('PACKAGED_UI_FLOW_FAILED');
  }
  const cleanup = uiEvidence?.cleanup || {};
  if (cleanup.electronExited !== true || cleanup.electronProcessGroupAbsentAfterCleanup !== true
    || cleanup.electronProcessGroupClosedConfirmed !== true || cleanup.electronProcessGroupForcedCleanup === true
    || cleanup.appServerPortClosed !== true || cleanup.userDataRemoved !== true) {
    fail('PACKAGED_UI_CLEANUP_FAILED');
  }
  if (wait.closeInfo?.code !== 0) fail('UI_RUNNER_FAILED');
  evidence.ui.status = 'pass';
}

function projectUiEvidence(source) {
  const settings = source?.ui?.settings || {};
  const optimize = source?.ui?.optimize || {};
  const accept = source?.ui?.accept || {};
  const history = source?.ui?.history || {};
  const save = source?.ui?.save || {};
  const runnerArgvProjection = sanitizeRunnerArgv(source?.launch?.argv);
  return {
    status: String(source?.status || 'unknown'),
    homeDashboardLoaded: source?.home?.hasHomeDashboard === true,
    job: {
      createStatus: Number(source?.job?.createStatus || 0),
      startStatus: Number(source?.job?.startStatus || 0),
      finalStatus: String(source?.job?.finalStatus || ''),
      cueCount: Number(source?.job?.cueCount || 0),
    },
    settings: {
      provider: String(settings.provider || ''),
      model: String(settings.model || ''),
      language: String(settings.language || ''),
      saved: settings.saved === true,
      keyEmpty: settings.keyEmpty === true,
      keyHasSavedValue: settings.keyHasSavedValue === true,
      privacyIsLocal: settings.privacyIsLocal === true,
      consentDisabled: settings.consentDisabled === true,
    },
    optimize: {
      status: String(optimize.status || ''),
      suggestionCount: Number(optimize.suggestionCount || 0),
      totalRetries: Number.isFinite(optimize.totalRetries) ? optimize.totalRetries : null,
      requestSummary: optimize.requestSummary || null,
    },
    accept: { accepted: Number(accept.accepted || 0), actionsHidden: accept.actionsHidden === true },
    history: { undo: history.undo === true, redo: history.redo === true, undoEnabled: history.undoEnabled === true, redoEnabled: history.redoEnabled === true },
    save: {
      saved: save.saved === true,
      subtitleFileName: String(save.subtitleFileName || ''),
      cueCount: Number(save.cueCount || 0),
      timecodesUnchanged: save.timecodesUnchanged === true,
      hasEnglishTranslation: save.hasEnglishTranslation === true,
      reviewSha256: /^[a-f0-9]{64}$/i.test(String(save.reviewSha256 || '')) ? save.reviewSha256 : null,
    },
    source: {
      cueCount: Number(source?.source?.cueCount || 0),
      timecodes: Array.isArray(source?.source?.timecodes) ? source.source.timecodes : [],
      sourceSubtitleSha256: /^[a-f0-9]{64}$/i.test(String(source?.source?.sourceSubtitleSha256 || '')) ? source.source.sourceSubtitleSha256 : null,
    },
    appServerPortClosed: source?.cleanup?.appServerPortClosed === true,
    electronExited: source?.cleanup?.electronExited === true,
    electronProcessGroupPresentAtCleanupStart: typeof source?.cleanup?.electronProcessGroupPresentAtCleanupStart === 'boolean'
      ? source.cleanup.electronProcessGroupPresentAtCleanupStart : null,
    electronProcessGroupAbsentAfterCleanup: source?.cleanup?.electronProcessGroupAbsentAfterCleanup === true,
    electronProcessGroupClosedConfirmed: source?.cleanup?.electronProcessGroupClosedConfirmed === true,
    electronProcessGroupForcedCleanup: source?.cleanup?.electronProcessGroupForcedCleanup === true,
    userDataRemoved: source?.cleanup?.userDataRemoved === true,
    failureCategory: /^[A-Z0-9_]+$/.test(String(source?.error?.category || '')) ? source.error.category : null,
    electronExitCode: Number.isInteger(source?.error?.electronExitCode) ? source.error.electronExitCode : null,
    electronExitSignal: /^SIG[A-Z0-9]+$/.test(String(source?.error?.electronExitSignal || '')) ? source.error.electronExitSignal : null,
    startupDiagnosticCategories: Array.isArray(source?.error?.startupDiagnosticCategories)
      ? source.error.startupDiagnosticCategories.filter((item) => /^[A-Z0-9_]+$/.test(String(item))).slice(0, 8)
      : [],
    runnerProvenance: {
      command: /^[A-Za-z0-9._ -]+$/.test(String(source?.launch?.command || '')) ? source.launch.command : null,
      argv: runnerArgvProjection.argv,
      argvRedactionValidated: runnerArgvProjection.argvRedactionValidated,
      argvDroppedCount: runnerArgvProjection.argvDroppedCount,
      argvInputCount: runnerArgvProjection.argvInputCount,
      sandboxedTargetProcessTree: source?.launch?.sandboxedTargetProcessTree === true,
      outerSandboxProfileApplied: source?.launch?.outerSandboxProfileApplied === true,
      candidateExecutableSha256: /^[a-f0-9]{64}$/i.test(String(source?.artifact?.executableSha256 || '')) ? source.artifact.executableSha256 : null,
      candidateFrameworkSha256: /^[a-f0-9]{64}$/i.test(String(source?.artifact?.electronFrameworkSha256 || '')) ? source.artifact.electronFrameworkSha256 : null,
      candidateFrameworkPresent: source?.artifact?.electronFrameworkPresent === true,
      candidateFrameworkRelativePath: source?.artifact?.electronFrameworkRelativePath === 'Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework'
        ? source.artifact.electronFrameworkRelativePath : null,
      childOutputSha256: /^[a-f0-9]{64}$/i.test(String(source?.diagnostics?.childOutputSha256 || '')) ? source.diagnostics.childOutputSha256 : null,
      childOutputBytes: Number.isInteger(source?.diagnostics?.childOutputBytes) ? source.diagnostics.childOutputBytes : null,
      captureLimitBytes: Number.isInteger(source?.diagnostics?.captureLimitBytes) ? source.diagnostics.captureLimitBytes : null,
      startupDiagnosticCategories: Array.isArray(source?.diagnostics?.startupDiagnosticCategories)
        ? source.diagnostics.startupDiagnosticCategories.filter((item) => /^[A-Z0-9_]+$/.test(String(item))).slice(0, 8)
        : [],
      rawChildOutputPersisted: source?.diagnostics?.rawChildOutputPersisted === true,
    },
  };
}

async function portClosed(port) {
  if (!port) return false;
  return await new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.setTimeout(1200);
    socket.once('connect', () => { socket.destroy(); resolve(false); });
    socket.once('error', (error) => resolve(error.code === 'ECONNREFUSED'));
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
  });
}

async function waitForPortClosed(port) {
  if (!port) return true;
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    if (await portClosed(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

async function main() {
  currentStage = 'platform_preflight';
  if (process.platform !== 'darwin' || process.arch !== 'arm64' || !fs.existsSync(sandboxExec)) fail('MACOS_ARM64_SEATBELT_UNAVAILABLE');
  const macOSIdentity = readSanitizedMacOSIdentity();
  if (!macOSIdentity.productVersion || !macOSIdentity.buildVersion) fail('MACOS_IDENTITY_UNAVAILABLE');
  evidence.environment.macOSProductVersion = macOSIdentity.productVersion;
  evidence.environment.macOSBuildVersion = macOSIdentity.buildVersion;
  currentStage = 'model_preflight';
  if (!requestedModel || !/^[\w.-]+(?::[\w.-]+)?$/.test(requestedModel)) fail('MODEL_NAME_INVALID');
  currentStage = 'endpoint_preflight';
  if (configuredOllamaBaseUrl || configuredUiBaseUrl) fail('CUSTOM_OLLAMA_URL_NOT_ALLOWED');
  currentStage = 'evidence_preflight';
  if (fs.existsSync(evidencePath)) fail('EVIDENCE_ALREADY_EXISTS');
  if (!bundlePathArgument) fail('APP_BUNDLE_ARGUMENT_REQUIRED');

  currentStage = 'app_bundle_preflight';
  const app = inspectBundle(path.resolve(bundlePathArgument));
  evidence.candidate.bundleVersion = app.bundleVersion;
  evidence.candidate.bundleIdentifier = app.bundleIdentifier;
  evidence.candidate.executableName = app.executableName;
  evidence.candidate.executableSha256 = await sha256File(app.executablePath);

  currentStage = 'ollama_binary_preflight';
  ollamaBinary = process.env.OLLAMA_BIN ? path.resolve(process.env.OLLAMA_BIN) : resolveExecutable('ollama');
  if (!ollamaBinary) fail('OLLAMA_EXECUTABLE_NOT_FOUND');
  try { fs.accessSync(ollamaBinary, fs.constants.X_OK); } catch { fail('OLLAMA_EXECUTABLE_NOT_ACCESSIBLE'); }
  currentStage = 'model_store_preflight';
  modelDirectory = path.resolve(process.env.OLLAMA_MODELS || path.join(os.homedir(), '.ollama', 'models'));
  if (!fs.existsSync(modelDirectory)) fail('OLLAMA_MODEL_STORE_NOT_FOUND');

  currentStage = 'profile_check';
  verifySandboxProfile();
  currentStage = 'temporary_state';
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-ollama-ui-offline-'));
  daemonPort = await reserveLoopbackPort();
  const ollamaBaseUrl = `http://127.0.0.1:${daemonPort}`;
  const serverEnv = {
    PATH: PATH_VALUE,
    HOME: tempRoot,
    TMPDIR: tempRoot,
    OLLAMA_MODELS: modelDirectory,
    OLLAMA_HOST: `127.0.0.1:${daemonPort}`,
  };

  currentStage = 'ollama_start';
  daemonProcess = spawnManagedChild(daemonSpawnCommand, ['-p', sandboxProfile, '/usr/bin/env', ...Object.entries(serverEnv).map(([key, value]) => `${key}=${value}`), ollamaBinary, 'serve'], {
    cwd: appDir,
    stdio: 'ignore',
    detached: true,
  });
  daemonGroupId = daemonProcess.child.pid || null;
  currentStage = 'model_list';
  const tags = await waitForOllama(ollamaBaseUrl, daemonProcess);
  evidence.isolation.daemonStartedInSandbox = daemonProcess.started;
  evidence.daemon.preinstalledModelFound = Array.isArray(tags?.models)
    && tags.models.some((entry) => entry?.name === requestedModel || entry?.model === requestedModel);
  if (!evidence.daemon.preinstalledModelFound) fail('MODEL_NOT_PREINSTALLED');

  uiEvidencePath = path.join(tempRoot, 'packaged-ui-evidence.json');
  const devtoolsPort = await reserveLoopbackPort();
  await runPackagedUiDriver(app, ollamaBaseUrl, devtoolsPort);
  evidence.status = 'pass';
}

try {
  await main();
} catch (error) {
  evidence.status = 'fail';
  evidence.failureStage ||= currentStage;
  evidence.failureCode ||= /^[A-Z0-9_]+$/.test(String(error?.message || '')) ? String(error.message) : 'UNEXPECTED_ACCEPTANCE_FAILURE';
}

currentStage = 'cleanup';
if (uiRunnerProcess && !uiRunnerGroupCleanup) {
  uiRunnerGroupCleanup = await cleanupAndRecordGroup(uiRunnerGroupId, 'uiAutomationDriverGroup');
  const finalWait = await waitForManagedChildClose(uiRunnerProcess, 5000);
  evidence.cleanup.uiRunnerExited = Boolean(finalWait.closeInfo);
}
if (uiRunnerTimedOut || evidence.cleanup.uiAutomationDriverGroupForcedCleanup
  || !evidence.cleanup.uiAutomationDriverGroupAbsentAfterCleanup
  || !evidence.cleanup.uiAutomationDriverGroupClosedConfirmed) {
  evidence.status = 'fail';
  evidence.failureCode ||= uiRunnerTimedOut ? 'UI_RUNNER_TIMEOUT' : 'UI_RUNNER_PROCESS_GROUP_LEAK';
}

if (daemonProcess) {
  const gracefulStop = await stopManagedChild(daemonProcess);
  evidence.cleanup.daemonStopped = gracefulStop && Boolean(daemonProcess.closeInfo);
  daemonGroupCleanup = await cleanupAndRecordGroup(daemonGroupId, 'ollamaDaemonGroup');
  evidence.daemon.stopped = evidence.cleanup.daemonStopped
    && daemonGroupCleanup.groupAbsentAfterCleanup
    && daemonGroupCleanup.groupClosedConfirmed
    && !daemonGroupCleanup.forcedCleanup;
  evidence.cleanup.daemonPortClosed = await waitForPortClosed(daemonPort);
} else {
  evidence.daemon.stopped = true;
}

if (tempRoot) {
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    try { fs.lstatSync(tempRoot); evidence.cleanup.temporaryRootRemoved = false; }
    catch (error) { evidence.cleanup.temporaryRootRemoved = error.code === 'ENOENT'; }
  } catch { evidence.cleanup.temporaryRootRemoved = false; }
}
if (!evidence.cleanup.uiRunnerExited || !evidence.cleanup.uiAutomationDriverGroupClosedConfirmed
  || !evidence.cleanup.daemonStopped || !evidence.cleanup.ollamaDaemonGroupClosedConfirmed
  || !evidence.cleanup.daemonPortClosed || !evidence.cleanup.temporaryRootRemoved
  || evidence.cleanup.uiAutomationDriverGroupForcedCleanup || evidence.cleanup.ollamaDaemonGroupForcedCleanup) {
  evidence.status = 'fail';
  evidence.failureCode ||= 'CLEANUP_NOT_CONFIRMED';
  evidence.failureStage ||= 'cleanup';
}
evidence.completedAt = new Date().toISOString();
evidence.elapsedMs = Date.now() - started;

try {
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
} catch {
  console.error('Packaged Ollama UI offline acceptance evidence could not be safely written.');
  process.exitCode = 1;
}
console.log(JSON.stringify({
  outputPath: evidencePath,
  status: evidence.status,
  model: requestedModel,
  elapsedMs: evidence.elapsedMs,
  failureCode: evidence.failureCode,
  cleanup: evidence.cleanup,
}, null, 2));
if (evidence.status !== 'pass') process.exitCode = 1;
