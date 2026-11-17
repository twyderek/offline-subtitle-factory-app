import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { spawnManagedChild, stopManagedChild } from '../lib/ai/managed-child-process.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandboxExec = '/usr/bin/sandbox-exec';
const sandboxProfile = '(version 1) (allow default) (deny network*) (allow network-bind (local ip "localhost:*")) (allow network-inbound (local ip "localhost:*")) (allow network-outbound (remote ip "localhost:*"))';
const testDaemonSpawnCommand = process.env.NODE_ENV === 'test'
  ? String(process.env.OSF_TEST_ONLY_OLLAMA_SPAWN_COMMAND || '').trim()
  : '';
const daemonSpawnCommand = testDaemonSpawnCommand ? path.resolve(testDaemonSpawnCommand) : sandboxExec;
const model = String(process.env.OLLAMA_MODEL || 'llama3.2:1b').trim();
const configuredOllamaBaseUrl = String(process.env.OLLAMA_BASE_URL || '').trim();
const defaultEvidenceName = `${new Date().toISOString().slice(0, 10)}-ollama-${model.replace(/[^a-z0-9.-]+/gi, '-')}-product-offline.json`;
const evidencePath = path.resolve(process.argv[2] || path.join(appDir, 'docs/project-management/evidence', defaultEvidenceName));
const startedAt = new Date().toISOString();
const started = Date.now();
const evidence = {
  schema: 'offline-subtitle-factory.ollama-product-offline-acceptance.v1',
  startedAt,
  completedAt: null,
  elapsedMs: null,
  environment: { platform: process.platform, arch: process.arch, node: process.version },
  provider: 'ollama',
  model,
  status: 'fail',
  failureCode: null,
  failureStage: null,
  failureClass: null,
  isolation: {
    mechanism: 'macOS Seatbelt sandbox-exec',
    profileId: 'deny-network-loopback-only-v1',
    loopbackAllowed: true,
    externalSocketDenied: false,
    externalSocketError: null,
    targetProcesses: ['isolated ollama serve', 'product probe and descendant app server'],
    systemNetworkDisabled: false,
  },
  daemon: { startedInSandbox: false, baseUrlLoopbackOnly: true, preinstalledModelFound: false, modelDownloadAttempted: false, stopped: true },
  productFlow: null,
  cleanup: { temporaryRootRemoved: true, daemonStopped: true, daemonPortClosed: true },
};

let tempRoot;
let ollamaProcess;
let daemonPort;
let failureCode = null;
let currentStage = 'preflight';

function fail(code) {
  failureCode ||= code;
  evidence.failureStage ||= currentStage;
  throw new Error(code);
}

function resolveExecutable(name) {
  const candidates = process.env.PATH?.split(path.delimiter).map((dir) => path.join(dir, name)) || [];
  return candidates.find((candidate) => {
    try { fs.accessSync(candidate, fs.constants.X_OK); return true; } catch { return false; }
  }) || null;
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
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 4096,
    env: { PATH: process.env.PATH || '' },
  });
  let parsed;
  try { parsed = JSON.parse(String(result.stdout || '').trim()); } catch { fail('SANDBOX_PROFILE_ASSERTION_FAILED'); }
  if (result.error || result.status !== 0 || parsed?.loopback !== 'loopback-ok' || parsed?.externalError !== 'EPERM') {
    fail('SANDBOX_PROFILE_ASSERTION_FAILED');
  }
  evidence.isolation.externalSocketDenied = true;
  evidence.isolation.externalSocketError = parsed.externalError;
}

async function waitForOllama(baseUrl, child, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.spawnError) {
      currentStage = 'ollama_start';
      fail('SANDBOXED_OLLAMA_SPAWN_FAILED');
    }
    if (child.closeInfo || child.child.exitCode !== null || child.child.signalCode !== null) fail('SANDBOXED_OLLAMA_EXITED');
    try {
      const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(1200), redirect: 'error' });
      if (response.ok) return await response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  fail('SANDBOXED_OLLAMA_READY_TIMEOUT');
}

function runChild(executable, args, options = {}) {
  return new Promise((resolve) => {
    let finished = false;
    const child = spawn(executable, args, { ...options, stdio: 'ignore' });
    const timer = setTimeout(() => {
      if (finished) return;
      child.kill('SIGTERM');
      const forceTimer = setTimeout(() => child.kill('SIGKILL'), 5000);
      forceTimer.unref();
    }, options.timeoutMs || 270000);
    const settle = (result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(result);
    };
    child.once('error', () => settle({ code: null, signal: null, spawnError: true }));
    child.once('close', (code, signal) => settle({ code, signal, spawnError: false }));
  });
}

function productFailureCategory(childEvidence) {
  const message = String(childEvidence?.error?.message || '');
  if (message.includes('字幕工廠測試 server 啟動逾時')) return 'APP_SERVER_TIMEOUT';
  if (message.includes('實際 Ollama AI 任務等待逾時')) return 'OLLAMA_TASK_TIMEOUT';
  if (message.includes('翻譯語言與輸出語言')) return 'MODEL_OUTPUT_LANGUAGE_REJECTED';
  if (message.includes('翻譯內容過短') || message.includes('翻譯建議過短')) return 'MODEL_TRANSLATION_INCOMPLETE';
  if (message.includes('AI 回傳內容不是有效 JSON') || message.includes('AI 回傳缺少 cues 陣列') || message.includes('cue 順序不符') || message.includes('段落數量不符')) return 'MODEL_RESPONSE_CONTRACT_REJECTED';
  if (/ECONNREFUSED|ECONNRESET|ETIMEDOUT|fetch failed|socket/i.test(message)) return 'LOCAL_MODEL_TRANSPORT_FAILED';
  if (message.includes('Ollama AI 任務未完成')) return 'OLLAMA_TASK_FAILED';
  if (message.includes('Ollama 設定保存失敗')) return 'OLLAMA_SETTINGS_REJECTED';
  if (message.includes('本機字幕任務建立失敗')) return 'SUBTITLE_JOB_REJECTED';
  if (message.includes('Ollama AI 任務啟動失敗')) return 'OLLAMA_TASK_START_REJECTED';
  if (message.includes('建議數量不符')) return 'SUGGESTION_COUNT_MISMATCH';
  if (message.includes('undo 失敗')) return 'UNDO_REJECTED';
  if (message.includes('redo 失敗')) return 'REDO_REJECTED';
  if (message.includes('保存校閱結果失敗')) return 'REVIEW_SAVE_REJECTED';
  return 'PRODUCT_ASSERTION_FAILED';
}

async function isPortClosed(port) {
  if (!port) return true;
  return await new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.setTimeout(1500);
    socket.once('connect', () => { socket.destroy(); resolve(false); });
    socket.once('error', (error) => resolve(error.code === 'ECONNREFUSED'));
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
  });
}

async function main() {
  currentStage = 'platform_preflight';
  if (process.platform !== 'darwin' || !fs.existsSync(sandboxExec)) fail('MACOS_SEATBELT_UNAVAILABLE');
  currentStage = 'model_preflight';
  if (!model || !/^[\w.-]+(?::[\w.-]+)?$/.test(model)) fail('MODEL_NAME_INVALID');
  currentStage = 'endpoint_preflight';
  if (configuredOllamaBaseUrl) fail('CUSTOM_OLLAMA_URL_NOT_ALLOWED');
  currentStage = 'evidence_preflight';
  if (fs.existsSync(evidencePath)) fail('EVIDENCE_ALREADY_EXISTS');

  currentStage = 'ollama_binary_preflight';
  const ollamaPath = process.env.OLLAMA_BIN ? path.resolve(process.env.OLLAMA_BIN) : resolveExecutable('ollama');
  if (!ollamaPath) fail('OLLAMA_EXECUTABLE_NOT_FOUND');
  currentStage = 'model_store_preflight';
  const modelDirectory = path.resolve(process.env.OLLAMA_MODELS || path.join(os.homedir(), '.ollama', 'models'));
  if (!fs.existsSync(modelDirectory)) fail('OLLAMA_MODEL_STORE_NOT_FOUND');

  currentStage = 'profile_check';
  verifySandboxProfile();
  currentStage = 'temporary_state';
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-ollama-offline-'));
  daemonPort = await reserveLoopbackPort();
  const ollamaBaseUrl = `http://127.0.0.1:${daemonPort}`;
  const serverEnv = {
    PATH: process.env.PATH || '',
    HOME: tempRoot,
    OLLAMA_MODELS: modelDirectory,
    OLLAMA_HOST: `127.0.0.1:${daemonPort}`,
  };

  currentStage = 'ollama_start';
  ollamaProcess = spawnManagedChild(daemonSpawnCommand, ['-p', sandboxProfile, '/usr/bin/env', ...Object.entries(serverEnv).map(([key, value]) => `${key}=${value}`), ollamaPath, 'serve'], {
    cwd: appDir,
    stdio: 'ignore',
  });
  currentStage = 'model_list';
  const tags = await waitForOllama(ollamaBaseUrl, ollamaProcess);
  evidence.daemon.startedInSandbox = ollamaProcess.started;
  const installedModels = Array.isArray(tags?.models) ? tags.models : [];
  evidence.daemon.preinstalledModelFound = installedModels.some((entry) => entry?.name === model || entry?.model === model);
  if (!evidence.daemon.preinstalledModelFound) fail('MODEL_NOT_PREINSTALLED');

  const childEvidencePath = path.join(tempRoot, 'ollama-product-probe.json');
  const probePath = path.join(appDir, 'scripts/probe-ollama-product-live.mjs');
  const probeEnv = {
    PATH: process.env.PATH || '',
    HOME: tempRoot,
    TMPDIR: tempRoot,
    TMP: tempRoot,
    TEMP: tempRoot,
    OLLAMA_MODEL: model,
    OLLAMA_BASE_URL: `${ollamaBaseUrl}/v1`,
  };
  currentStage = 'product_probe';
  const result = await runChild(sandboxExec, ['-p', sandboxProfile, '/usr/bin/env', ...Object.entries(probeEnv).map(([key, value]) => `${key}=${value}`), process.execPath, probePath, childEvidencePath]);
  if (!fs.existsSync(childEvidencePath)) fail('PRODUCT_PROBE_EVIDENCE_MISSING');
  const childEvidence = JSON.parse(fs.readFileSync(childEvidencePath, 'utf8'));
  evidence.productFlow = {
    status: childEvidence.status,
    endpointPrivacy: childEvidence.endpointPrivacy,
    job: childEvidence.job,
    session: childEvidence.session,
    review: childEvidence.review,
    networkSandboxInheritedByProductServer: true,
    failureCategory: childEvidence.status === 'pass' ? null : productFailureCategory(childEvidence),
  };
  if (result.code !== 0 || childEvidence.status !== 'pass' || childEvidence.model !== model || childEvidence.baseUrl !== `${ollamaBaseUrl}/v1`) {
    fail(evidence.productFlow.failureCategory || 'PRODUCT_PROBE_FAILED');
  }
  evidence.status = 'pass';
}

try {
  await main();
} catch (error) {
  evidence.status = 'fail';
  evidence.failureStage ||= currentStage;
  evidence.failureClass = /^[A-Za-z]+Error$/.test(String(error?.name || '')) ? error.name : 'Error';
  failureCode ||= ({ ENOENT: 'RUNTIME_EXECUTABLE_MISSING', EACCES: 'RUNTIME_ACCESS_DENIED', EINVAL: 'RUNTIME_ARGUMENT_INVALID', EPERM: 'OS_POLICY_DENIED' })[error?.code] || 'UNEXPECTED_ERROR';
}

currentStage = 'cleanup';
evidence.daemon.startedInSandbox ||= Boolean(ollamaProcess?.started);
const daemonStopped = await stopManagedChild(ollamaProcess);
evidence.cleanup.daemonStopped = daemonStopped;
evidence.daemon.stopped = daemonStopped;
evidence.cleanup.daemonPortClosed = daemonPort ? await isPortClosed(daemonPort) : true;
if (tempRoot) {
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    try { fs.lstatSync(tempRoot); evidence.cleanup.temporaryRootRemoved = false; }
    catch (error) { evidence.cleanup.temporaryRootRemoved = error.code === 'ENOENT'; }
  } catch { evidence.cleanup.temporaryRootRemoved = false; }
}
if (!evidence.cleanup.daemonStopped || !evidence.cleanup.daemonPortClosed || !evidence.cleanup.temporaryRootRemoved) {
  evidence.status = 'fail';
  failureCode ||= 'CLEANUP_NOT_CONFIRMED';
}
evidence.failureCode = evidence.status === 'pass' ? null : failureCode || 'ACCEPTANCE_FAILED';
evidence.completedAt = new Date().toISOString();
evidence.elapsedMs = Date.now() - started;

try {
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
} catch {
  console.error('Ollama offline acceptance evidence could not be safely written.');
  process.exitCode = 1;
}
console.log(JSON.stringify({ outputPath: evidencePath, status: evidence.status, model, elapsedMs: evidence.elapsedMs, failureCode: evidence.failureCode }, null, 2));
if (evidence.status !== 'pass') process.exitCode = 1;
