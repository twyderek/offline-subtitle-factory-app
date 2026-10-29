import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanupProcessGroup } from '../lib/process-group-cleanup.mjs';
import { isLocalElectronPageUrl, selectTrustedElectronPageTarget } from '../lib/electron-devtools-target.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceDir = path.join(appDir, 'docs/project-management/evidence');
const sandboxExec = '/usr/bin/sandbox-exec';
const sandboxProfile = '(version 1) (allow default) (deny network-outbound) (deny network-inbound) (deny network-bind) (allow network-bind (local ip "localhost:*")) (allow network-inbound (local ip "localhost:*")) (allow network-outbound (remote ip "localhost:*"))';
const bundleArgument = process.argv[2] || '';
const requestedOutputPath = process.argv[3] || '';
const timeoutMs = Math.min(Math.max(Number(process.argv[4] || 15000), 3000), 30000);
const requestedVariant = process.argv[5] || 'single-process';
const startupFlag = requestedVariant === 'no-zygote' ? '--no-zygote' : '--single-process';
const startedAt = new Date().toISOString();

function fail(message) {
  throw new Error(message);
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readPlistValue(plistPath, key) {
  const result = spawnSync('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plistPath], {
    encoding: 'utf8', timeout: 5000, maxBuffer: 4096,
  });
  return result.status === 0 ? String(result.stdout || '').trim() : '';
}

function inspectBundle(bundlePath) {
  const resolved = fs.realpathSync(bundlePath);
  if (!resolved.endsWith('.app') || !fs.statSync(resolved).isDirectory()) fail('APP_BUNDLE_INVALID');
  const contents = path.join(resolved, 'Contents');
  const plistPath = path.join(contents, 'Info.plist');
  const executableName = readPlistValue(plistPath, 'CFBundleExecutable');
  const bundleIdentifier = readPlistValue(plistPath, 'CFBundleIdentifier');
  const bundleVersion = readPlistValue(plistPath, 'CFBundleShortVersionString');
  if (!executableName || bundleIdentifier !== 'com.offline-subtitle-factory.app') fail('APP_BUNDLE_METADATA_INVALID');
  const executablePath = path.join(contents, 'MacOS', executableName);
  fs.accessSync(executablePath, fs.constants.X_OK);
  const frameworkPath = path.join(contents, 'Frameworks', 'Electron Framework.framework', 'Versions', 'A', 'Electron Framework');
  fs.accessSync(frameworkPath, fs.constants.R_OK);
  return { bundleVersion, executableName, executablePath, frameworkPath };
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (error) { reject(error); }
      });
    });
    request.setTimeout(1200, () => request.destroy(new Error('DEVTOOLS_HTTP_TIMEOUT')));
    request.on('error', reject);
  });
}

async function waitForPage(port, deadline) {
  while (Date.now() < deadline) {
    try {
      const targets = await getJson(`http://127.0.0.1:${port}/json`);
      const page = selectTrustedElectronPageTarget(targets, port);
      if (page) return page;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

async function connectAndInspect(wsUrl, deadline) {
  const socket = new WebSocket(wsUrl);
  const pending = new Map();
  let messageId = 0;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('DEVTOOLS_CONNECT_TIMEOUT')), Math.max(1, deadline - Date.now()));
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('DEVTOOLS_CONNECT_FAILED')); }, { once: true });
  });
  socket.addEventListener('message', (event) => {
    let data;
    try { data = JSON.parse(String(event.data)); } catch { return; }
    const request = pending.get(data.id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(data.id);
    request.resolve(data);
  });
  try {
    const id = ++messageId;
    const response = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('DEVTOOLS_RUNTIME_EVALUATE_TIMEOUT'));
      }, Math.max(1, Math.min(3000, deadline - Date.now())));
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: {
          returnByValue: true,
          expression: `(() => ({ href: location.href, title: document.title, hasHomeDashboard: Boolean(document.getElementById('homeDashboard')) }))()`,
        },
      }));
    });
    return {
      cdpResponseReceived: true,
      cdpResult: response?.result?.result?.value || null,
      cdpError: response?.error?.message || null,
    };
  } catch (error) {
    return { cdpResponseReceived: false, cdpResult: null, cdpError: error.message };
  } finally {
    try { socket.close(); } catch {}
  }
}

function classifyDiagnostics(output) {
  const categories = [];
  const add = (category, pattern) => { if (pattern.test(output) && !categories.includes(category)) categories.push(category); };
  add('CHROMIUM_CHILD_SANDBOX_INIT_FAILED', /Failed to initialize sandbox|sandbox initialization failed/i);
  add('CHROMIUM_GPU_SANDBOX_UNAVAILABLE', /GPU sandbox is not available|gpu sandbox/i);
  add('OS_PERMISSION_DENIED', /Operation not permitted|Permission denied|EPERM/i);
  add('ELECTRON_EARLY_EXIT', /signal SIG(TRAP|ABRT)|Trace\/BPT trap|exited with code/i);
  return categories;
}

function removeDirectory(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
    return !fs.existsSync(target);
  } catch {
    return false;
  }
}

if (process.platform !== 'darwin' || process.arch !== 'arm64') fail('MACOS_ARM64_REQUIRED');
if (!fs.existsSync(sandboxExec)) fail('SEATBELT_UNAVAILABLE');
if (!bundleArgument || !requestedOutputPath) fail('BUNDLE_AND_EVIDENCE_REQUIRED');
if (!['single-process', 'no-zygote'].includes(requestedVariant)) fail('STARTUP_VARIANT_INVALID');
const outputPath = path.resolve(requestedOutputPath);
if (!outputPath.startsWith(`${evidenceDir}${path.sep}`) || path.extname(outputPath) !== '.json') fail('EVIDENCE_PATH_INVALID');
if (fs.existsSync(outputPath)) fail('EVIDENCE_ALREADY_EXISTS');

const app = inspectBundle(path.resolve(bundleArgument));
const devtoolsPort = await reservePort();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-electron-single-process-'));
const userDataDir = path.join(tempRoot, 'user-data');
let child = null;
let cleanup = null;
let temporaryRootRemoved = false;
try {
fs.mkdirSync(userDataDir, { recursive: true });
const environment = {
  PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
  HOME: tempRoot,
  TMPDIR: tempRoot,
  LANG: process.env.LANG || 'en_US.UTF-8',
  ELECTRON_NO_ATTACH_CONSOLE: '1',
};
const launchArgv = [
  '-p', '<loopback-only-profile>', '/usr/bin/env', '<sanitized-environment>',
  '<candidate-executable>', startupFlag, `--remote-debugging-port=${devtoolsPort}`, '<temporary-user-data>',
];
child = spawn(sandboxExec, [
  '-p', sandboxProfile,
  '/usr/bin/env',
  ...Object.entries(environment).map(([key, value]) => `${key}=${value}`),
  app.executablePath,
  startupFlag,
  `--remote-debugging-port=${devtoolsPort}`,
  `--user-data-dir=${userDataDir}`,
], { cwd: appDir, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
let spawnErrorCode = null;
child.once('error', (error) => { spawnErrorCode = error?.code || 'SPAWN_ERROR'; });
let output = '';
const capture = (chunk) => { output = `${output}${chunk.toString('utf8')}`.slice(-12000); };
child.stdout.on('data', capture);
child.stderr.on('data', capture);
const deadline = Date.now() + timeoutMs;
let page = null;
let cdp = { cdpResponseReceived: false, cdpResult: null, cdpError: null };
let waitError = null;
try {
  page = await waitForPage(devtoolsPort, deadline);
  if (!page) waitError = 'DEVTOOLS_PAGE_TIMEOUT';
  if (page) cdp = await connectAndInspect(page.webSocketDebuggerUrl, deadline);
} catch (error) {
  waitError = error.message;
}
const preCleanupExitCode = Number.isInteger(child.exitCode) ? child.exitCode : null;
const preCleanupExitSignal = typeof child.signalCode === 'string' ? child.signalCode : null;
const childExitedBeforeCleanup = preCleanupExitCode !== null || preCleanupExitSignal !== null;
cleanup = await cleanupProcessGroup(child.pid, { gracefulMs: 3000, forceMs: 3000 });
temporaryRootRemoved = removeDirectory(tempRoot);
const diagnostics = classifyDiagnostics(output);
if (preCleanupExitSignal && !diagnostics.includes('ELECTRON_EARLY_EXIT')) diagnostics.push('ELECTRON_EARLY_EXIT');
const pageUrlLocal = Boolean(page && isLocalElectronPageUrl(page.url));
const validCdpResult = Boolean(cdp.cdpResponseReceived && cdp.cdpResult
  && isLocalElectronPageUrl(cdp.cdpResult.href));
const evidence = {
  schema: 'offline-subtitle-factory.electron-single-process-startup-probe.v1',
  startedAt,
  completedAt: new Date().toISOString(),
  environment: { platform: process.platform, arch: process.arch, node: process.version },
  candidate: {
    bundleVersion: app.bundleVersion || null,
    executableName: app.executableName,
    executableSha256: sha256File(app.executablePath),
    frameworkSha256: sha256File(app.frameworkPath),
  },
  invocation: {
    command: '/usr/bin/sandbox-exec',
    argv: launchArgv,
    profileId: 'deny-network-loopback-only-v1',
    startupVariant: requestedVariant,
    startupFlag,
    shellRequired: false,
    uiFlowRun: false,
    networkConnectionsAttempted: true,
    loopbackConnectionsAttempted: true,
    externalSocketAttempted: false,
  },
  startup: {
    devtoolsPortReserved: Number.isInteger(devtoolsPort),
    localPagePublished: Boolean(page),
    pageUrlLocal,
    pageTitlePresent: Boolean(page?.title),
    cdpResponseReceived: cdp.cdpResponseReceived,
    cdpResult: cdp.cdpResult,
    cdpError: cdp.cdpError,
    waitError,
    childExitCode: preCleanupExitCode,
    childExitSignal: preCleanupExitSignal,
    childExitedBeforeCleanup,
    spawnErrorCode,
    validCdpResult,
    diagnosticCategories: diagnostics,
    childOutputSha256: sha256(output),
    childOutputBytes: Buffer.byteLength(output, 'utf8'),
    rawChildOutputPersisted: false,
  },
  cleanup: {
    processGroupPresentAtCleanupStart: cleanup.groupPresentAtCleanupStart,
    processGroupAbsentAfterCleanup: cleanup.groupAbsentAfterCleanup,
    processGroupClosedConfirmed: cleanup.groupClosedConfirmed,
    processGroupForcedCleanup: cleanup.forcedCleanup,
    temporaryRootRemoved,
  },
  scope: {
    systemNetworkDisabled: false,
    outerSandboxProfileApplied: true,
    sandboxedTargetProcessTree: true,
    modelDownloaded: false,
    existingOllamaDaemonStartedOrStopped: false,
    packagedUiAcceptanceRun: false,
  },
  status: pageUrlLocal && validCdpResult && !childExitedBeforeCleanup && !spawnErrorCode
    && cleanup.groupClosedConfirmed && temporaryRootRemoved ? 'pass' : 'fail',
  interpretation: 'This is a bounded startup-only diagnostic for Chromium process composition. The tested startup variants are not production acceptance workarounds and a pass does not establish renderer sandbox security, offline UI acceptance, full-machine egress control, Windows support, or FR-021 completion.',
};
try {
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
} catch (error) {
  console.error(error?.code === 'EEXIST' ? 'Evidence file already exists; refusing to overwrite.' : 'Unable to create probe evidence.');
  process.exitCode = 2;
}
console.log(`Electron single-process startup probe ${evidence.status}: ${path.basename(outputPath)}`);
if (evidence.status !== 'pass') process.exitCode = 1;
} finally {
  if (child && (!cleanup || !cleanup.groupClosedConfirmed)) {
    try { cleanup = await cleanupProcessGroup(child.pid, { gracefulMs: 3000, forceMs: 3000 }); } catch {}
  }
  if (!temporaryRootRemoved) removeDirectory(tempRoot);
}
