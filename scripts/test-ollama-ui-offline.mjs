import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import http from 'node:http';
import vm from 'node:vm';
import { EventEmitter, once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createTrustedDevToolsWebSocket, isLocalElectronPageUrl, isTrustedDevToolsWebSocketUrl, selectTrustedElectronPageTarget } from '../lib/electron-devtools-target.mjs';
import { cleanupProcessGroup, probeProcessGroup } from '../lib/process-group-cleanup.mjs';
import { projectReplayProvenance, projectRunnerProvenance, sanitizeRunnerArgv, sanitizeRunnerCommand } from '../lib/runner-provenance.mjs';
import { startLocalAcceptanceDaemon, stopLocalAcceptanceDaemon } from './ollama-ui-local-daemon.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wrapperPath = path.join(appDir, 'scripts/verify-electron-ollama-ui-offline.mjs');
const uiProbePath = path.join(appDir, 'scripts/verify-electron-ollama-ui.mjs');
const startupProbePath = path.join(appDir, 'scripts/probe-electron-single-process.mjs');
const securityAuditPath = path.join(appDir, 'scripts/audit-macos-packaged-security-identity.mjs');
const signingReadinessPath = path.join(appDir, 'scripts/audit-macos-signing-readiness.mjs');
const provenancePath = path.join(appDir, 'lib/runner-provenance.mjs');
const wrapperSource = fs.readFileSync(wrapperPath, 'utf8');
const uiProbeSource = fs.readFileSync(uiProbePath, 'utf8');
const startupProbeSource = fs.readFileSync(startupProbePath, 'utf8');
const securityAuditSource = fs.readFileSync(securityAuditPath, 'utf8');
const signingReadinessSource = fs.readFileSync(signingReadinessPath, 'utf8');
const provenanceSource = fs.readFileSync(provenancePath, 'utf8');
const packageManifest = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));

const splashTarget = { type: 'page', title: '離線字幕工廠', url: 'file:///app/electron/splash.html', webSocketDebuggerUrl: 'ws://127.0.0.1:9990/devtools/page/splash' };
const uiTarget = { type: 'page', title: '離線字幕工廠', url: 'http://127.0.0.1:3000/', webSocketDebuggerUrl: 'ws://127.0.0.1:9990/devtools/page/ui' };
assert.equal(selectTrustedElectronPageTarget([splashTarget], 9990), null, 'splash-only startup must wait without connecting to file://');
assert.equal(selectTrustedElectronPageTarget([splashTarget, uiTarget], 9990), uiTarget, 'splash must not shadow the trusted local UI');
assert.equal(selectTrustedElectronPageTarget([{ ...uiTarget, title: '' }], 9990).url, uiTarget.url, 'trusted local UI selection must not depend on a transient page title');
assert.equal(selectTrustedElectronPageTarget([{ ...uiTarget, url: 'https://example.com/' }], 9990), null, 'remote page must never be selected');
assert.throws(() => selectTrustedElectronPageTarget([{ ...uiTarget, webSocketDebuggerUrl: 'ws://127.0.0.1:9991/devtools/page/ui' }], 9990), /DEVTOOLS_TARGET_URL_REJECTED/, 'local page with untrusted socket must fail closed');

const validArgvProjection = sanitizeRunnerArgv([
  '-p',
  '<outer-sandbox-profile>',
  '/usr/bin/env',
  'PATH=<redacted>',
  'SUBTITLE_AI_API_KEY=<redacted>',
  '<candidate-executable:Offline Subtitle Factory>',
  '--remote-debugging-port=9990',
  '--user-data-dir=<temporary-user-data>',
]);
assert.equal(validArgvProjection.argvRedactionValidated, true, 'known redacted argv must pass the projection contract');
assert.equal(validArgvProjection.argvDroppedCount, 0);
assert.deepEqual(validArgvProjection.argv, [
  '-p',
  '<outer-sandbox-profile>',
  '/usr/bin/env',
  'PATH=<redacted>',
  'SUBTITLE_AI_API_KEY=<redacted>',
  '<candidate-executable:Offline Subtitle Factory>',
  '--remote-debugging-port=9990',
  '--user-data-dir=<temporary-user-data>',
]);

const localizedCandidateArgvProjection = sanitizeRunnerArgv([
  '<candidate-executable:離線字幕工廠>',
  '--remote-debugging-port=9990',
  '--user-data-dir=<temporary-user-data>',
]);
assert.equal(localizedCandidateArgvProjection.argvRedactionValidated, true, 'localized candidate basename should pass argv projection');
assert.equal(localizedCandidateArgvProjection.argvDroppedCount, 0);
assert.deepEqual(localizedCandidateArgvProjection.argv, [
  '<candidate-executable:離線字幕工廠>',
  '--remote-debugging-port=9990',
  '--user-data-dir=<temporary-user-data>',
]);
for (const unsafeCandidate of [
  '<candidate-executable:/home/private/x>',
  '<candidate-executable:..>',
  '<candidate-executable:line\nfeed>',
  `<candidate-executable:${'x'.repeat(129)}>` ,
]) {
  const projection = sanitizeRunnerArgv([unsafeCandidate]);
  assert.equal(projection.argv.length, 0, `unsafe candidate argv must be dropped: ${JSON.stringify(unsafeCandidate)}`);
  assert.equal(projection.argvRedactionValidated, false);
  assert.equal(JSON.stringify(projection).includes('/home/private'), false);
}

const unsafeArgvProjection = sanitizeRunnerArgv([
  '-p',
  '/home/private/Library/Application Support/Offline Subtitle Factory',
  'SUBTITLE_AI_API_KEY=sk-live-secret',
  '--custom-flag=/tmp/user-data',
]);
assert.equal(unsafeArgvProjection.argvRedactionValidated, false, 'unknown argv must fail the projection contract');
assert.equal(unsafeArgvProjection.argvDroppedCount, 3);
assert.deepEqual(unsafeArgvProjection.argv, ['-p']);
assert.equal(JSON.stringify(unsafeArgvProjection).includes('sk-live-secret'), false);
assert.equal(JSON.stringify(unsafeArgvProjection).includes('/home/private'), false);
assert.equal(sanitizeRunnerArgv(null).argvRedactionValidated, false, 'missing argv must fail closed');
const truncatedArgvProjection = sanitizeRunnerArgv(Array.from({ length: 33 }, () => '-p'));
assert.equal(truncatedArgvProjection.argv.length, 32);
assert.equal(truncatedArgvProjection.argvDroppedCount, 1);
assert.equal(truncatedArgvProjection.argvRedactionValidated, false, 'truncated argv must not claim complete validation');

assert.equal(sanitizeRunnerCommand('離線字幕工廠'), '離線字幕工廠', 'localized executable basename should remain traceable');
assert.equal(sanitizeRunnerCommand('offline-subtitle-factory'), 'offline-subtitle-factory');
for (const unsafeCommand of ['', '.', '..', '/home/private/executable', '../executable', 'foo\\bar', 'line\nfeed', 'x'.repeat(129)]) {
  assert.equal(sanitizeRunnerCommand(unsafeCommand), null, `unsafe command must fail closed: ${JSON.stringify(unsafeCommand)}`);
}
assert.equal(sanitizeRunnerCommand(new String('offline-subtitle-factory')), null, 'non-primitive command must fail closed');
const commandProjectionText = JSON.stringify({ command: sanitizeRunnerCommand('/home/private/sk-live-secret') });
assert.equal(commandProjectionText.includes('/home/private'), false);
assert.equal(commandProjectionText.includes('sk-live-secret'), false);

const projectUiEvidenceStart = wrapperSource.indexOf('function projectUiEvidence(source)');
const projectUiEvidenceEnd = wrapperSource.indexOf('\nasync function portClosed', projectUiEvidenceStart);
assert.ok(projectUiEvidenceStart >= 0 && projectUiEvidenceEnd > projectUiEvidenceStart, 'wrapper projection function must remain extractable for deterministic regression');
const projectUiEvidence = vm.runInNewContext(
  `${wrapperSource.slice(projectUiEvidenceStart, projectUiEvidenceEnd)}; projectUiEvidence`,
  { projectRunnerProvenance, sanitizeRunnerArgv },
);
const projectedEvidence = projectUiEvidence({
  artifact: {
    executableSha256: 'b'.repeat(64),
    reviewScriptSha256: 'a'.repeat(64),
    electronFrameworkSha256: 'c'.repeat(64),
    electronFrameworkPresent: true,
    electronFrameworkRelativePath: 'Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework',
  },
  launch: {
    command: 'offline-subtitle-factory',
    argv: [
      '-p',
      '<outer-sandbox-profile>',
      '/home/private/Library/Application Support/Offline Subtitle Factory',
      'SUBTITLE_AI_API_KEY=sk-live-secret',
      '--custom-flag=/tmp/user-data',
      '--remote-debugging-port=9990',
      '--user-data-dir=<temporary-user-data>',
      ...Array.from({ length: 28 }, () => '-p'),
    ],
  },
});
assert.deepEqual(projectedEvidence.runnerProvenance.argv, [
  '-p',
  '<outer-sandbox-profile>',
  '--remote-debugging-port=9990',
  '--user-data-dir=<temporary-user-data>',
  ...Array.from({ length: 28 }, () => '-p'),
].slice(0, 32));
assert.equal(projectedEvidence.runnerProvenance.argvRedactionValidated, false);
assert.equal(projectedEvidence.runnerProvenance.argvDroppedCount, 3);
assert.equal(projectedEvidence.runnerProvenance.argvInputCount, 35);
assert.equal(projectedEvidence.runnerProvenance.candidateExecutableSha256, 'b'.repeat(64));
assert.equal(projectedEvidence.runnerProvenance.candidateReviewScriptSha256, 'a'.repeat(64));
assert.equal(projectedEvidence.runnerProvenance.candidateFrameworkSha256, 'c'.repeat(64));
assert.deepEqual(Object.keys(projectedEvidence.runnerProvenance).sort(), Object.keys(projectRunnerProvenance({ argv: [] })).sort(), 'live/offline runner provenance projections must share one key set');
assert.equal(JSON.stringify(projectedEvidence).includes('sk-live-secret'), false, 'wrapper projection must exclude raw secret-shaped argv');
assert.equal(JSON.stringify(projectedEvidence).includes('/home/private'), false, 'wrapper projection must exclude private argv paths');
const localizedProjectedEvidence = projectUiEvidence({ launch: { command: '離線字幕工廠', argv: [] } });
assert.equal(localizedProjectedEvidence.runnerProvenance.command, '離線字幕工廠');
const pathProjectedEvidence = projectUiEvidence({ launch: { command: '/home/private/離線字幕工廠', argv: [] } });
assert.equal(pathProjectedEvidence.runnerProvenance.command, null);
const tokenCanary = 'token-canary';
const tokenCanaryProjection = projectUiEvidence({
  home: { href: `http://127.0.0.1:8791/?token=${tokenCanary}` },
  launch: { command: 'offline-subtitle-factory', argv: [] },
  error: { reviewNavigation: { href: `http://127.0.0.1:8791/review/job?token=${tokenCanary}` } },
});
assert.equal(JSON.stringify(tokenCanaryProjection).includes(tokenCanary), false, 'offline home/review/error projection must exclude token canaries');
const invalidHashProjectedEvidence = projectUiEvidence({
  artifact: { reviewScriptSha256: '/home/private/review.js' },
  launch: { command: 'offline-subtitle-factory', argv: [] },
});
assert.equal(invalidHashProjectedEvidence.runnerProvenance.candidateReviewScriptSha256, null);
const nonPrimitiveHashProjection = projectRunnerProvenance({ argv: [], candidateReviewScriptSha256: new String('a'.repeat(64)) });
assert.equal(nonPrimitiveHashProjection.candidateReviewScriptSha256, null, 'boxed hash values must fail closed');
const missingHashProjection = projectRunnerProvenance({ argv: [] });
assert.equal(missingHashProjection.candidateReviewScriptSha256, null, 'missing review.js hash must fail closed');
const argvProjectionBypassAttempt = projectRunnerProvenance({
  argvProjection: {
    argv: ['/home/private/runner', 'SUBTITLE_AI_API_KEY=sk-live-secret'],
    argvRedactionValidated: true,
    argvDroppedCount: 0,
    argvInputCount: 2,
  },
});
assert.deepEqual(argvProjectionBypassAttempt.argv, [], 'shared projection must ignore caller-supplied argv projection objects');
assert.equal(JSON.stringify(argvProjectionBypassAttempt).includes('/home/private'), false);
assert.equal(JSON.stringify(argvProjectionBypassAttempt).includes('sk-live-secret'), false);

const validReplayInput = {
  sourceHeadCommit: 'd'.repeat(40),
  worktreeDirty: true,
  worktreeStatusSha256: 'e'.repeat(64),
  runnerScriptSha256: 'f'.repeat(64),
  runnerProvenanceModuleSha256: 'a'.repeat(64),
  packageManifestSha256: 'b'.repeat(64),
  packageVersion: '0.52.0',
  command: 'node',
  script: 'scripts/verify-electron-ollama-ui.mjs',
  scenario: 'cancel-resume-restart',
  model: 'llama3.2:3b',
  debugPort: 9990,
  timeoutMs: 30000,
  platform: 'darwin',
  arch: 'arm64',
  node: 'v22.22.3',
  osRelease: '25.6.0',
  preLaunchExecutableSha256: 'c'.repeat(64),
  preLaunchReviewScriptSha256: 'd'.repeat(64),
  preLaunchFrameworkSha256: 'e'.repeat(64),
  loadedExecutableSha256: 'c'.repeat(64),
  loadedReviewScriptSha256: 'd'.repeat(64),
  loadedFrameworkSha256: 'e'.repeat(64),
};
const validReplayProvenance = projectReplayProvenance(validReplayInput);
assert.equal(validReplayProvenance.sourceProvenanceComplete, true, 'complete source provenance must pass');
assert.equal(validReplayProvenance.provenanceComplete, true, 'complete replay provenance must pass');
assert.equal(validReplayProvenance.loadedBytesObservation, 'renderer-ready-file-read');
assert.equal(validReplayProvenance.loadedBytesMatchPreLaunch, true);
assert.equal(validReplayProvenance.invocation.commandTemplate, 'node scripts/verify-electron-ollama-ui.mjs <candidate-executable> <debug-port> <timeout-ms> <evidence-output> <ollama-model>');
for (const invalidReplay of [
  { sourceHeadCommit: '/private/path' },
  { worktreeDirty: undefined },
  { worktreeStatusSha256: '/private/path' },
  { command: '/private/node' },
  { model: '/private/model' },
  { timeoutMs: 4000 },
  { loadedExecutableSha256: '/private/path' },
  { loadedFrameworkSha256: 'f'.repeat(64) },
]) {
  const projection = projectReplayProvenance({ ...validReplayInput, ...invalidReplay });
  assert.equal(projection.provenanceComplete, false, 'invalid replay provenance must fail closed');
  assert.equal(JSON.stringify(projection).includes('/private'), false, 'replay provenance must exclude private paths');
}

// Execute the whole actual runner in memory, failing its artifact read after
// spawn. The finally must still clean resources and persist sanitized failure.
const runnerChild = new EventEmitter();
runnerChild.stdout = new EventEmitter();
runnerChild.stderr = new EventEmitter();
runnerChild.pid = 424242;
runnerChild.exitCode = null;
runnerChild.signalCode = null;
let runnerCleanupCalls = 0;
let runnerTempRemovals = 0;
let runnerFailureEvidence;
const runnerContext = vm.createContext({
  crypto, path, os, once, URL, Buffer, setTimeout, clearTimeout, http: {}, net: {},
  execFileSync, projectReplayProvenance, projectRunnerProvenance, sanitizeRunnerArgv,
  console: { log: () => {}, error: () => {} },
  fs: {
    existsSync: (target) => target === '/fixture/executable',
    mkdtempSync: () => '/fixture/owned-temp', mkdirSync: () => {},
    readFileSync: () => { throw Object.assign(new Error('PRIVATE_ARTIFACT_PATH_CANARY'), { code: 'EACCES' }); },
    rmSync: () => { runnerTempRemovals += 1; },
    lstatSync: () => { throw Object.assign(new Error('not found'), { code: 'ENOENT' }); },
    writeFileSync: (_target, body) => { runnerFailureEvidence = JSON.parse(body); },
  },
  spawn: () => runnerChild,
  process: { cwd: () => appDir, argv: ['node', 'runner', '/fixture/executable', '9993', '5000', '/fixture/evidence.json'], env: {}, platform: 'darwin', arch: 'arm64', version: 'v22' },
  isLoopbackAiUrl: () => true, aiEndpointPrivacy: () => 'local',
  cleanupProcessGroup: async () => {
    runnerCleanupCalls += 1;
    runnerChild.exitCode = 0;
    return { groupPresentAtCleanupStart: true, groupAbsentAfterCleanup: true, groupClosedConfirmed: true, forcedCleanup: false };
  },
  stopLocalAcceptanceDaemon: async () => ({ stopped: true, processGroupAbsent: true, forcedCleanup: false, portClosed: true, temporaryRootRemoved: true }),
});
await vm.runInContext(`(async () => {\n${uiProbeSource.replace(/^import .*;\r?\n/gm, '')}\n})()`, runnerContext);
assert.equal(runnerCleanupCalls, 1, 'artifact read failure must clean the spawned app process group');
assert.equal(runnerTempRemovals, 1);
assert.equal(runnerFailureEvidence.status, 'fail');
assert.equal(runnerFailureEvidence.error.stage, 'artifact_preflight');
assert.equal(runnerFailureEvidence.error.code, 'CANDIDATE_ARTIFACT_READ_FAILED');
assert.equal(runnerFailureEvidence.error.category, 'CANDIDATE_ARTIFACT_READ_FAILED');
assert.equal(runnerFailureEvidence.cleanup.userDataRemoved, true);
assert.equal(runnerFailureEvidence.runnerProvenance.argvRedactionValidated, true);
assert.equal(runnerFailureEvidence.runnerProvenance.argvDroppedCount, 0);
assert.ok(Number.isInteger(runnerFailureEvidence.runnerProvenance.childOutputBytes));
assert.equal(runnerFailureEvidence.runnerProvenance.rawChildOutputPersisted, false);
assert.equal(JSON.stringify(runnerFailureEvidence).includes('PRIVATE_ARTIFACT_PATH_CANARY'), false);

// A continuously trickling response must not extend the absolute startup
// deadline. Only this local HTTP fixture is real; daemon/fs are controlled.
let oversizedTagsBody = null;
const trickleServer = http.createServer((_request, response) => {
  if (oversizedTagsBody) { response.end(oversizedTagsBody); return; }
  response.writeHead(200);
  response.flushHeaders();
  const interval = setInterval(() => response.write(' '), 10);
  const completion = setTimeout(() => response.end(JSON.stringify({ models: [{ name: 'fixture-model' }] })), 250);
  response.once('close', () => { clearInterval(interval); clearTimeout(completion); });
});
await new Promise((resolve) => trickleServer.listen(0, '127.0.0.1', resolve));
try {
  const port = trickleServer.address().port;
  const stream = new EventEmitter();
  const source = fs.readFileSync(new URL('./ollama-ui-local-daemon.mjs', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
  const context = vm.createContext({
    path, http, os, setTimeout, clearTimeout, Date, Buffer,
    process: { platform: 'darwin', env: {} },
    fs: { constants: { X_OK: 1 }, accessSync: () => {}, statSync: () => ({ isDirectory: () => true }), mkdtempSync: () => '/fixture/root' },
    net: { createServer: () => ({ once: () => {}, listen: (_port, _host, callback) => callback(), address: () => ({ port }), close: (callback) => callback() }) },
    spawnManagedChild: () => ({ child: { stdout: stream, stderr: stream }, spawnError: null, closeInfo: null }),
  });
  vm.runInContext(source, context);
  const result = await context.startLocalAcceptanceDaemon({ model: 'fixture-model', binary: '/fixture/bin', modelsDirectory: '/fixture/models', timeoutMs: 50 });
  assert.equal(result.failureCode, 'LOCAL_DAEMON_START_TIMEOUT', 'trickle body must not be accepted after the startup deadline');
  assert.equal(result.preinstalledModelFound, false);
  for (const text of ['a'.repeat(1_100_000), '界'.repeat(400_000)]) {
    oversizedTagsBody = JSON.stringify({ models: [], padding: text });
    assert.ok(Buffer.byteLength(oversizedTagsBody) > 1024 * 1024);
    await assert.rejects(context.readTags(port, 1000), /TAGS_RESPONSE_TOO_LARGE/, 'ASCII and multi-byte UTF-8 tags bodies must obey the byte cap');
  }
} finally {
  await new Promise((resolve) => trickleServer.close(resolve));
}

const missingDaemon = await startLocalAcceptanceDaemon({ model: 'missing-test-model', binary: '/nonexistent-osf-local-daemon', modelsDirectory: os.tmpdir() });
assert.ok(missingDaemon.failureCode, 'missing daemon binary must fail preflight without throwing out of cleanup');
assert.equal(missingDaemon.process, null);
assert.equal(missingDaemon.root, null);
assert.deepEqual(await stopLocalAcceptanceDaemon(missingDaemon), { stopped: true, processGroupAbsent: true, forcedCleanup: false, portClosed: true, temporaryRootRemoved: true });
assert.deepEqual(await stopLocalAcceptanceDaemon(null), { stopped: true, processGroupAbsent: true, forcedCleanup: false, portClosed: true, temporaryRootRemoved: true });

const localOllamaBinary = '/Applications/Ollama.app/Contents/Resources/ollama';
if (process.platform === 'darwin' && fs.existsSync(localOllamaBinary)) {
  const emptyStore = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-empty-model-store-'));
  let missingModelDaemon;
  try {
    missingModelDaemon = await startLocalAcceptanceDaemon({ model: 'missing-test-model', binary: localOllamaBinary, modelsDirectory: emptyStore });
    assert.equal(missingModelDaemon.failureCode, 'MODEL_NOT_PREINSTALLED', 'empty store must not trigger a model download');
    assert.equal(missingModelDaemon.preinstalledModelFound, false);
    const cleanup = await stopLocalAcceptanceDaemon(missingModelDaemon);
    assert.deepEqual(cleanup, { stopped: true, processGroupAbsent: true, forcedCleanup: false, portClosed: true, temporaryRootRemoved: true });
    assert.equal(fs.existsSync(path.join(emptyStore, 'blobs')) && fs.readdirSync(path.join(emptyStore, 'blobs')).length > 0, false, 'model gate must not create/download model blobs');
  } finally {
    await stopLocalAcceptanceDaemon(missingModelDaemon);
    fs.rmSync(emptyStore, { recursive: true, force: true });
  }
  console.log('Ollama local UI daemon missing-model integration passed (no download; owned process/port/temp cleaned)');
}

assert.match(wrapperSource, /\(deny network-outbound\)/, 'offline UI runner must deny external outbound network in Seatbelt');
assert.match(wrapperSource, /\(deny network-inbound\)/, 'offline UI runner must deny external inbound network in Seatbelt');
assert.match(wrapperSource, /\(deny network-bind\)/, 'offline UI runner must deny external network binds in Seatbelt');
assert.match(wrapperSource, /network-bind \(local ip "localhost:\*"\)/, 'offline UI runner must permit loopback bind only');
assert.match(wrapperSource, /network-inbound \(local ip "localhost:\*"\)/, 'offline UI runner must permit loopback inbound only');
assert.match(wrapperSource, /network-outbound \(remote ip "localhost:\*"\)/, 'offline UI runner must permit loopback outbound only');
assert.match(wrapperSource, /externalSocketError = parsed\.externalError/, 'offline UI runner must record the OS external-socket denial');
assert.match(wrapperSource, /parsed\?\.externalError !== 'EPERM'/, 'offline UI runner must fail closed unless the OS returns EPERM');
assert.match(wrapperSource, /CUSTOM_OLLAMA_URL_NOT_ALLOWED/, 'offline UI runner must reject custom endpoints');
assert.match(wrapperSource, /MODEL_NOT_PREINSTALLED/, 'offline UI runner must refuse to proceed without an exact preinstalled model');
assert.match(wrapperSource, /modelDownloadAttempted: false/, 'offline UI evidence must not imply a model download');
assert.match(wrapperSource, /OSF_TEST_ONLY_OLLAMA_UI_RUNNER_COMMAND/, 'UI spawn injection must be available only to test mode');
assert.match(wrapperSource, /networkSandboxInheritedByElectronAndServer/, 'offline UI evidence must identify the sandboxed app/server process tree');
assert.match(wrapperSource, /flag: 'wx', mode: 0o600/, 'offline UI evidence must be exclusive and owner-readable only');
assert.match(uiProbeSource, /flag: 'wx', mode: 0o600/, 'normal UI evidence must be exclusive and owner-readable only');
assert.match(wrapperSource, /flag: 'wx'/, 'offline UI evidence must use exclusive create');
assert.match(wrapperSource, /systemNetworkDisabled: false/, 'offline UI evidence must not claim whole-machine disconnection');
assert.match(wrapperSource, /macOSProductVersion: null, macOSBuildVersion: null/, 'offline UI evidence must reserve sanitized macOS version and build fields');
assert.match(wrapperSource, /bundleInputKind, bundleVersion: null/, 'offline UI evidence must record the sanitized bundle argument kind');
assert.match(wrapperSource, /offline-subtitle-factory\.ollama-ui-offline-acceptance\.v5/, 'offline UI evidence schema must identify runner provenance fields');
assert.match(wrapperSource, /uiAutomationDriverGroupAbsentAfterCleanup/, 'offline UI runner must verify automation-driver group absence after cleanup');
assert.match(wrapperSource, /ollamaDaemonGroupAbsentAfterCleanup/, 'offline UI runner must verify daemon group absence after cleanup');
assert.match(wrapperSource, /daemonPortClosed/, 'offline UI runner must verify daemon port cleanup');
assert.match(wrapperSource, /temporaryRootRemoved/, 'offline UI runner must verify temporary-root cleanup');
assert.doesNotMatch(wrapperSource, /OLLAMA_BASE_URL=.*https?:\/\//, 'offline UI runner must not embed a remote Ollama endpoint');

assert.match(uiProbeSource, /Page\.navigate/, 'packaged UI probe must navigate to the review page');
assert.match(uiProbeSource, /cancel-resume-restart/, 'packaged UI probe must expose the app-restart resume scenario');
assert.match(uiProbeSource, /cancelRequestHttpStatus/, 'packaged UI evidence must preserve sanitized cancel POST observability');
assert.match(uiProbeSource, /firstProcessGroupAbsentAfterCleanup/, 'app-restart evidence must verify the first Electron process group cleanup');
assert.match(uiProbeSource, /userDataPreservedBetweenLaunches/, 'app-restart evidence must verify persistent userData between launches');
assert.match(uiProbeSource, /secondAppServerPortCaptured/, 'app-restart evidence must capture the second app server port');
assert.match(uiProbeSource, /secondAppServerPortClosed/, 'app-restart evidence must verify the second app server port cleanup');
assert.match(uiProbeSource, /if \(!Number\.isInteger\(targetPort\).*return false/, 'missing app server port must fail closed during cleanup');
assert.match(uiProbeSource, /pageTimeOriginChangedAfterAppRestart/, 'app-restart evidence must distinguish a new renderer launch');
assert.match(uiProbeSource, /getElementById\('runAiOptimize'\)\.click/, 'packaged UI probe must start optimization through the UI');
assert.match(uiProbeSource, /getElementById\('acceptAllAiSuggestions'\)\.click/, 'packaged UI probe must accept suggestions through the UI');
assert.match(uiProbeSource, /clickAndWait\('undoAiSession'/, 'packaged UI probe must verify UI undo');
assert.match(uiProbeSource, /clickAndWait\('redoAiSession'/, 'packaged UI probe must verify UI redo');
assert.match(uiProbeSource, /const save = document\.getElementById\('saveSrt'\)/, 'packaged UI probe must save the reviewed SRT through the UI');
assert.match(uiProbeSource, /appServerPortClosed/, 'packaged UI probe must verify its app server port is closed');
assert.match(uiProbeSource, /sandboxedTargetProcessTree/, 'offline UI probe must launch the packaged app and descendants under Seatbelt');
assert.match(uiProbeSource, /CHROMIUM_CHILD_SANDBOX_INIT_FAILED/, 'offline UI evidence must classify nested Chromium sandbox initialization failures');
assert.match(uiProbeSource, /electronProcessGroupPresentAtCleanupStart/, 'offline UI evidence must distinguish initial process-group state');
assert.match(uiProbeSource, /electronProcessGroupAbsentAfterCleanup/, 'offline UI evidence must verify final process-group absence');
assert.match(uiProbeSource, /userDataRemoved/, 'packaged UI probe must verify isolated userData removal');
assert.doesNotMatch(`${wrapperSource}\n${uiProbeSource}`, /--no-sandbox/, 'offline UI acceptance must not disable Chromium process sandboxing');
assert.doesNotMatch(uiProbeSource, /childLogTail|childLogs/, 'packaged UI evidence must not preserve raw child logs');
assert.doesNotMatch(uiProbeSource, /error: \{ message:/, 'packaged UI evidence must not preserve raw exception text');
assert.doesNotMatch(`${wrapperSource}\n${uiProbeSource}`, /OSF_DEBUG_UI_STARTUP|redactedStartupDiagnosticLines|redactedStartupLines/, 'offline UI runner must not emit raw or redacted startup output');
assert.match(uiProbeSource, /outerSandboxProfileApplied/, 'packaged UI evidence must record whether the outer sandbox profile was applied');
assert.match(uiProbeSource, /waitForHomeDashboard/, 'packaged UI startup must wait for the renderer DOM before probing the home dashboard');
assert.match(uiProbeSource, /reviewNavigation/, 'packaged UI evidence must preserve a sanitized review-navigation diagnostic');
const homeProbeStart = uiProbeSource.indexOf("const home = await evaluate(client, '(() => ({");
const homeProbeEnd = uiProbeSource.indexOf("}))()');", homeProbeStart);
assert.ok(homeProbeStart >= 0 && homeProbeEnd > homeProbeStart, 'home dashboard probe expression must remain extractable for deterministic regression');
const homeProbeSource = uiProbeSource.slice(homeProbeStart, homeProbeEnd);
assert.match(homeProbeSource, /href: location\.origin \+ location\.pathname/, 'home renderer snapshot must strip query and hash from persisted hrefs');
assert.match(uiProbeSource, /let navigationToken = typeof home\.apiToken === 'string' \? home\.apiToken : ''/, 'normal UI runner must retain the API token only in memory for navigation');
function extractReviewNavigationRegion(source, startAt = 0) {
  const start = source.indexOf('reviewUrl = new URL', startAt);
  const end = source.indexOf("await client.call('Page.navigate'", start);
  assert.ok(start >= 0 && end > start, 'review navigation source region must remain extractable for deterministic regression');
  return { source: source.slice(start, end), end };
}
const firstReviewNavigation = extractReviewNavigationRegion(uiProbeSource);
assert.match(firstReviewNavigation.source, /reviewUrl\.searchParams\.set\('token', navigationToken\)/, 'initial review navigation must use the in-memory API token');
assert.doesNotMatch(firstReviewNavigation.source, /reviewUrl\.searchParams\.set\('token',\s*new URL\(homeNavigationUrl\)/, 'initial review navigation must not recover the token from the sanitized home URL');
const restartReviewNavigation = extractReviewNavigationRegion(uiProbeSource, firstReviewNavigation.end);
assert.match(restartReviewNavigation.source, /reviewUrl\.searchParams\.set\('token', navigationToken\)/, 'restart review navigation must use the refreshed in-memory API token');
assert.doesNotMatch(restartReviewNavigation.source, /reviewUrl\.searchParams\.set\('token',\s*new URL\(homeNavigationUrl\)/, 'restart review navigation must not recover the token from the sanitized home URL');
assert.match(uiProbeSource, /const homeEvidence = \{ href: home\.href, title: home\.title, hasHomeDashboard: home\.hasHomeDashboard \}/, 'normal UI evidence must not persist the API token');
assert.match(uiProbeSource, /ELECTRON_HOME_DASHBOARD_TIMEOUT/, 'packaged UI startup must expose a stable bounded home-dashboard timeout');
assert.doesNotMatch(uiProbeSource, /NetworkServiceInProcess2|--disable-gpu-sandbox/, 'ineffective Chromium sandbox workarounds must not remain in the formal acceptance runner');
assert.match(uiProbeSource, /CANDIDATE_ARTIFACT_READ_FAILED/, 'packaged UI artifact-read failures must use a stable evidence code');
assert.match(uiProbeSource, /electronFrameworkSha256/, 'packaged UI evidence must record the candidate Electron Framework pre-launch hash');
assert.match(wrapperSource, /candidateReviewScriptSha256/, 'offline UI evidence must project the candidate review.js hash');
assert.match(uiProbeSource, /projectRunnerProvenance/, 'live UI evidence must use the shared runner provenance projection');
assert.match(uiProbeSource, /projectReplayProvenance/, 'live UI evidence must use the replay provenance projection');
assert.match(uiProbeSource, /replayProvenance/, 'live UI evidence must persist normalized replay provenance');
assert.match(uiProbeSource, /REPLAY_PROVENANCE_UNAVAILABLE/, 'live UI evidence must fail closed when replay provenance is unavailable');
assert.match(uiProbeSource, /ollama-ui-live-acceptance\.v5/, 'live UI evidence schema must identify replay provenance hardening');
assert.match(wrapperSource, /projectRunnerProvenance/, 'offline UI evidence must use the shared runner provenance projection');
assert.ok(uiProbeSource.indexOf('const frameworkPath = resolveFrameworkPath') < uiProbeSource.indexOf('function launchElectronChild'), 'candidate Framework identity must be captured before the Electron child is spawned');
assert.ok(uiProbeSource.indexOf('let candidateExecutableSha256') < uiProbeSource.indexOf('function launchElectronChild'), 'candidate executable identity must be captured before the Electron child is spawned');
assert.ok(uiProbeSource.indexOf('const sourceRevision = readSourceRevision') < uiProbeSource.indexOf('function launchElectronChild'), 'source revision must be captured before the Electron child is spawned');
assert.match(uiProbeSource, /childOutputSha256/, 'packaged UI evidence must record a bounded child-output fingerprint');
assert.match(uiProbeSource, /childOutputCaptureLimitBytes = 16000/, 'packaged UI child-output capture must use an explicit byte cap');
assert.match(uiProbeSource, /childOutputBuffer\.length/, 'packaged UI child-output evidence must measure bytes, not UTF-16 characters');
assert.match(uiProbeSource, /rawChildOutputPersisted: false/, 'packaged UI evidence must explicitly exclude raw child output');
assert.match(wrapperSource, /runnerProvenance/, 'offline UI evidence must project sanitized runner provenance');
assert.match(provenanceSource, /argvRedactionValidated/, 'shared provenance projection must expose argv validation');
assert.match(provenanceSource, /argvDroppedCount/, 'shared provenance projection must expose dropped argv count');
assert.match(provenanceSource, /candidateFrameworkSha256/, 'shared provenance projection must project the candidate Framework hash');
assert.match(wrapperSource, /startupDiagnosticCategories: source\?\.diagnostics\?\.startupDiagnosticCategories/, 'offline UI evidence must pass live runner diagnostic categories to shared projection');
assert.match(provenanceSource, /export function projectRunnerProvenance/, 'shared provenance projection must be exported');
assert.match(startupProbeSource, /cleanupProcessGroup/, 'startup diagnostic must use the shared process-group cleanup helper');
assert.match(startupProbeSource, /selectTrustedElectronPageTarget/, 'startup diagnostic must use the exact-port loopback DevTools target guard');
assert.match(startupProbeSource, /--single-process/, 'startup diagnostic must cover the bounded single-process variant');
assert.match(startupProbeSource, /--no-zygote/, 'startup diagnostic must cover the bounded no-zygote variant');
assert.match(startupProbeSource, /spawnErrorCode/, 'startup diagnostic must record bounded spawn errors');
assert.match(startupProbeSource, /childExitedBeforeCleanup/, 'startup diagnostic success must fail closed if the child exits before cleanup');
assert.match(startupProbeSource, /validCdpResult/, 'startup diagnostic success must require a valid local CDP result');
assert.match(startupProbeSource, /finally \{/, 'startup diagnostic must retain temp/process cleanup on unexpected exceptions');
assert.match(startupProbeSource, /networkConnectionsAttempted: true/, 'startup diagnostic must record loopback control-plane network use');
assert.match(startupProbeSource, /loopbackConnectionsAttempted: true/, 'startup diagnostic must distinguish loopback control-plane connections');
assert.match(securityAuditSource, /codesign/, 'packaged identity audit must inspect code signatures');
assert.match(securityAuditSource, /entitlements/, 'packaged identity audit must inspect entitlement presence without persisting raw XML');
assert.match(securityAuditSource, /rawCommandOutputPersisted: false/, 'packaged identity audit must not persist raw command output');
assert.match(securityAuditSource, /candidateModified: false/, 'packaged identity audit must be read-only');
assert.match(securityAuditSource, /flag: 'wx'/, 'packaged identity audit evidence must use exclusive create');
assert.match(securityAuditSource, /frameworkAppEntries/, 'packaged identity audit must inventory all Frameworks .app entries');
assert.match(securityAuditSource, /unexpectedHelperBundleNames/, 'packaged identity audit must record unexpected helper bundles');
assert.match(securityAuditSource, /helperInventoryComplete/, 'packaged identity audit must fail closed on incomplete helper inventory');
assert.match(securityAuditSource, /allRuntimeFlagsObserved/, 'packaged identity audit must compute the exact runtime CodeDirectory flag');
assert.match(securityAuditSource, /requiredCodeSignFlagSatisfied/, 'packaged identity audit must fail closed when the required runtime flag is absent');
assert.match(securityAuditSource, /0x10002\(adhoc,runtime\)/, 'packaged identity audit must use the exact ad-hoc runtime flag contract');
assert.doesNotMatch(securityAuditSource, /--no-sandbox|ELECTRON_DISABLE_SANDBOX/, 'packaged identity audit must not disable Chromium/Electron sandboxing');
assert.match(signingReadinessSource, /find-identity/, 'signing readiness must inspect code-sign identity availability');
assert.match(signingReadinessSource, /xcrunToolAvailable/, 'signing readiness must resolve tools through xcrun');
assert.match(signingReadinessSource, /formalIdentityAvailable/, 'signing readiness must distinguish formal signing identity from ad-hoc metadata');
assert.match(signingReadinessSource, /requiredScopeKeys/, 'signing readiness must define a complete scope/privacy contract');
assert.match(signingReadinessSource, /keychainModified/, 'signing readiness must be read-only for keychain state');
assert.match(signingReadinessSource, /signingAttempted/, 'signing readiness must not attempt signing');
assert.match(signingReadinessSource, /rawCommandOutputPersisted/, 'signing readiness must not persist raw command output');
assert.match(signingReadinessSource, /identityNamesPersisted: false/, 'signing readiness must not persist identity names');
assert.match(signingReadinessSource, /identityHashesPersisted: false/, 'signing readiness must not persist identity hashes');
assert.match(signingReadinessSource, /secretsPersisted/, 'signing readiness must not persist secrets');
assert.match(signingReadinessSource, /flag: 'wx'/, 'signing readiness evidence must use exclusive create');
assert.doesNotMatch(signingReadinessSource, /--no-sandbox|ELECTRON_DISABLE_SANDBOX/, 'signing readiness must not disable Chromium/Electron sandboxing');
assert.match(startupProbeSource, /rawChildOutputPersisted: false/, 'startup diagnostic must not persist raw child output');
assert.match(startupProbeSource, /packagedUiAcceptanceRun: false/, 'startup diagnostic must not be treated as packaged UI acceptance');
assert.doesNotMatch(startupProbeSource, /--no-sandbox|ELECTRON_DISABLE_SANDBOX/, 'startup diagnostic must not disable Chromium/Electron sandboxing');
assert.match(startupProbeSource, /flag: 'wx'/, 'startup diagnostic evidence must use exclusive create');
assert.equal(packageManifest.scripts['acceptance:ollama:ui:offline'], 'node scripts/verify-electron-ollama-ui-offline.mjs', 'packaged Ollama offline UI acceptance must have a repeatable npm script');
assert.ok(packageManifest.scripts.check.includes('node --check scripts/verify-electron-ollama-ui-offline.mjs'), 'full check must syntax-check the offline UI runner');
assert.ok(packageManifest.scripts.check.includes('node --check lib/electron-devtools-target.mjs'), 'full check must syntax-check the DevTools target guard');
assert.ok(packageManifest.scripts.check.includes('node --check lib/process-group-cleanup.mjs'), 'full check must syntax-check process-group cleanup');
assert.ok(packageManifest.scripts.check.includes('node --check scripts/probe-electron-single-process.mjs'), 'full check must syntax-check the startup diagnostic');
assert.ok(packageManifest.scripts.check.includes('node --check scripts/audit-macos-packaged-security-identity.mjs'), 'full check must syntax-check the packaged identity audit');
assert.ok(packageManifest.scripts.test.includes('node scripts/test-ollama-ui-offline.mjs'), 'full check must execute focused offline UI tests');

const devtoolsPort = 9990;
const trustedSocketUrl = `ws://127.0.0.1:${devtoolsPort}/devtools/page/abc123`;
assert.equal(isTrustedDevToolsWebSocketUrl(trustedSocketUrl, devtoolsPort), true);
assert.equal(isLocalElectronPageUrl('http://127.0.0.1:12345/?token=local'), true);
for (const invalidUrl of [
  `wss://127.0.0.1:${devtoolsPort}/devtools/page/abc123`,
  `ws://localhost:${devtoolsPort}/devtools/page/abc123`,
  `ws://192.0.2.1:${devtoolsPort}/devtools/page/abc123`,
  `ws://attacker.example:${devtoolsPort}/devtools/page/abc123`,
  `ws://127.0.0.1:${devtoolsPort + 1}/devtools/page/abc123`,
  `ws://user@127.0.0.1:${devtoolsPort}/devtools/page/abc123`,
  `ws://127.0.0.1:${devtoolsPort}/json`,
]) {
  assert.equal(isTrustedDevToolsWebSocketUrl(invalidUrl, devtoolsPort), false, `untrusted DevTools target rejected: ${invalidUrl}`);
}
for (const invalidUrl of ['https://127.0.0.1:12345/', 'http://localhost:12345/', 'http://192.0.2.1:12345/']) {
  assert.equal(isLocalElectronPageUrl(invalidUrl), false, `non-loopback Electron page rejected: ${invalidUrl}`);
}
let webSocketConstructionCount = 0;
class CountingWebSocket {
  constructor() { webSocketConstructionCount += 1; }
}
assert.throws(() => createTrustedDevToolsWebSocket(`ws://192.0.2.1:${devtoolsPort}/devtools/page/fake`, devtoolsPort, CountingWebSocket), /DEVTOOLS_TARGET_URL_REJECTED/);
assert.throws(() => createTrustedDevToolsWebSocket(`ws://127.0.0.1:${devtoolsPort + 1}/devtools/page/fake`, devtoolsPort, CountingWebSocket), /DEVTOOLS_TARGET_URL_REJECTED/);
assert.equal(webSocketConstructionCount, 0, 'rejected WebSocket targets must not instantiate a connection');

if (process.platform !== 'win32') {
  assert.equal(probeProcessGroup(1), null, 'invalid process-group IDs must fail closed without probing a broadcast target');
  let invalidGroupSignalCount = 0;
  const invalidGroupCleanup = await cleanupProcessGroup(1, { signal: () => { invalidGroupSignalCount += 1; } });
  assert.equal(invalidGroupCleanup.groupClosedConfirmed, false);
  assert.equal(invalidGroupSignalCount, 0, 'invalid process-group IDs must never be signalled');

  async function launchProcess(script) {
    const child = spawn(process.execPath, ['-e', script], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] });
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.stdout.on('data', (chunk) => {
        if (String(chunk).includes('READY')) resolve();
      });
    });
    return child;
  }
  async function waitForClose(child) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise((resolve) => child.once('close', resolve));
  }

  const gracefulChild = await launchProcess('process.on("SIGTERM", () => process.exit(0)); process.stdout.write("READY"); setInterval(() => {}, 1000)');
  const gracefulCleanup = await cleanupProcessGroup(gracefulChild.pid, { gracefulMs: 1500, forceMs: 1000 });
  await waitForClose(gracefulChild);
  assert.equal(gracefulCleanup.groupPresentAtCleanupStart, true);
  assert.equal(gracefulCleanup.groupAbsentAfterCleanup, true);
  assert.equal(gracefulCleanup.groupClosedConfirmed, true);
  assert.equal(gracefulCleanup.forcedCleanup, false);

  const forcedChild = await launchProcess('process.on("SIGTERM", () => {}); process.stdout.write("READY"); setInterval(() => {}, 1000)');
  const forcedCleanup = await cleanupProcessGroup(forcedChild.pid, { gracefulMs: 100, forceMs: 1500 });
  await waitForClose(forcedChild);
  assert.equal(forcedCleanup.groupPresentAtCleanupStart, true);
  assert.equal(forcedCleanup.groupAbsentAfterCleanup, true);
  assert.equal(forcedCleanup.groupClosedConfirmed, true);
  assert.equal(forcedCleanup.forcedCleanup, true, 'SIGKILL escalation must be reported');

  const unconfirmedSignals = [];
  const unconfirmedCleanup = await cleanupProcessGroup(12345, {
    gracefulMs: 0,
    forceMs: 0,
    probe: () => true,
    signal: (_groupId, signal) => unconfirmedSignals.push(signal),
  });
  assert.deepEqual(unconfirmedSignals, ['SIGTERM', 'SIGKILL']);
  assert.equal(unconfirmedCleanup.groupAbsentAfterCleanup, false);
  assert.equal(unconfirmedCleanup.groupClosedConfirmed, false);
  assert.equal(unconfirmedCleanup.forcedCleanup, true);
}

const appBundle = path.join(appDir, '../dist/release-0.51.0-macos-53956cc/mac-arm64/離線字幕工廠.app');
const macOSCandidateAvailable = process.platform === 'darwin' && process.arch === 'arm64'
  && fs.existsSync('/usr/bin/sandbox-exec') && fs.existsSync(appBundle);

if (macOSCandidateAvailable) {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-ollama-ui-preflight-test-'));
  const missingOllamaBinary = path.join(testRoot, 'intentionally-missing-ollama');
  try {
    assert.equal(fs.existsSync(missingOllamaBinary), false, 'preflight guard binary must not exist');
    const executableNameResult = spawnSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleExecutable', path.join(appBundle, 'Contents', 'Info.plist')], {
      encoding: 'utf8', timeout: 5000, maxBuffer: 1024,
    });
    assert.equal(executableNameResult.status, 0, 'packaged candidate must expose its executable name');
    const executableInsteadOfBundle = path.join(appBundle, 'Contents', 'MacOS', String(executableNameResult.stdout || '').trim());
    const cases = [
      { name: 'executable', input: executableInsteadOfBundle, kind: 'app_executable_path', code: 'APP_BUNDLE_INVALID', stage: 'app_bundle_preflight' },
      { name: 'bundle', input: appBundle, kind: 'app_bundle_directory', code: 'OLLAMA_EXECUTABLE_NOT_ACCESSIBLE', stage: 'ollama_binary_preflight' },
      { name: 'bundle-trailing-separator', input: `${appBundle}${path.sep}`, kind: 'app_bundle_directory', code: 'OLLAMA_EXECUTABLE_NOT_ACCESSIBLE', stage: 'ollama_binary_preflight' },
    ];
    for (const testCase of cases) {
      const evidencePath = path.join(testRoot, `${testCase.name}.json`);
      const result = spawnSync(process.execPath, [wrapperPath, testCase.input, evidencePath, 'llama3.2:3b'], {
        cwd: appDir, encoding: 'utf8', timeout: 15000, maxBuffer: 4096,
        env: {
          PATH: process.env.PATH || '',
          HOME: process.env.HOME || os.homedir(),
          OLLAMA_BIN: missingOllamaBinary,
          NODE_ENV: 'test',
          OSF_TEST_ONLY_OLLAMA_UI_DAEMON_COMMAND: missingOllamaBinary,
          OSF_TEST_ONLY_OLLAMA_UI_RUNNER_COMMAND: missingOllamaBinary,
        },
      });
      assert.equal(result.error, undefined, `${testCase.name} preflight wrapper must spawn: ${result.error?.code || ''}`);
      assert.equal(result.status, 1, `${testCase.name} must fail before any network probe or daemon`);
      const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
      assert.equal(evidence.schema, 'offline-subtitle-factory.ollama-ui-offline-acceptance.v5');
      assert.equal(evidence.failureCode, testCase.code);
      assert.equal(evidence.failureStage, testCase.stage);
      assert.equal(evidence.candidate.bundleInputKind, testCase.kind);
      assert.match(evidence.environment.macOSProductVersion, /^\d+\.\d+(?:\.\d+)?$/);
      assert.match(evidence.environment.macOSBuildVersion, /^[A-Za-z0-9]+$/);
      assert.equal(evidence.ui, null);
      assert.equal(evidence.isolation.loopbackAllowed, false, 'preflight case must fail before network probe');
      assert.equal(evidence.isolation.externalSocketDenied, false);
      assert.equal(evidence.isolation.daemonStartedInSandbox, false);
      assert.equal(evidence.isolation.electronAppStartedInSandbox, false);
      assert.equal(evidence.cleanup.ollamaDaemonGroupPresentAtCleanupStart, false);
      assert.equal(evidence.cleanup.uiAutomationDriverGroupPresentAtCleanupStart, false);
      for (const privatePath of [testCase.input, path.resolve(testCase.input), testRoot]) {
        assert.equal(JSON.stringify(evidence).includes(privatePath), false, 'evidence must not expose supplied paths');
      }
    }
    console.log('Ollama offline UI bundle preflight integration test passed (3 cases; no Ollama/model required)');
  } finally {
    fs.rmSync(testRoot, { recursive: true, force: true });
  }
} else {
  console.log('Ollama offline UI bundle preflight integration test skipped: macOS arm64 candidate or Seatbelt unavailable');
}

const ollamaPath = process.env.OLLAMA_BIN || process.env.PATH?.split(path.delimiter).map((directory) => path.join(directory, 'ollama')).find((candidate) => {
  try { fs.accessSync(candidate, fs.constants.X_OK); return true; } catch { return false; }
});
const modelDirectory = path.resolve(process.env.OLLAMA_MODELS || path.join(os.homedir(), '.ollama', 'models'));
let installedModelAvailable = false;
if (ollamaPath && fs.existsSync(modelDirectory)) {
  const list = spawnSync(ollamaPath, ['list'], { encoding: 'utf8', timeout: 10000, env: { PATH: process.env.PATH || '', OLLAMA_MODELS: modelDirectory } });
  installedModelAvailable = list.status === 0 && /^llama3\.2:3b\s/m.test(String(list.stdout || ''));
}

if (macOSCandidateAvailable && ollamaPath && installedModelAvailable) {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-ollama-ui-offline-test-'));
  const evidencePath = path.join(testRoot, 'spawn-failure.json');
  const missingUiRunner = path.join(testRoot, 'intentionally-missing-ui-runner');
  try {
    assert.equal(fs.existsSync(missingUiRunner), false, 'fault-injection runner must not exist');
    const result = spawnSync(process.execPath, [wrapperPath, appBundle, evidencePath, 'llama3.2:3b'], {
      cwd: appDir,
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 4096,
      env: {
        PATH: process.env.PATH || '',
        HOME: process.env.HOME || os.homedir(),
        OLLAMA_BIN: ollamaPath,
        OLLAMA_MODELS: modelDirectory,
        NODE_ENV: 'test',
        OSF_TEST_ONLY_OLLAMA_UI_RUNNER_COMMAND: missingUiRunner,
      },
    });
    assert.equal(result.error, undefined, `offline UI runner test process must not fail to spawn: ${result.error?.code || ''}`);
    assert.equal(result.status, 1, 'offline UI runner must fail on injected ENOENT');
    const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    assert.equal(evidence.status, 'fail');
    assert.equal(evidence.failureCode, 'UI_RUNNER_SPAWN_FAILED');
    assert.equal(evidence.failureStage, 'electron_start');
    assert.equal(evidence.isolation.externalSocketDenied, true);
    assert.equal(evidence.isolation.externalSocketError, 'EPERM');
    assert.equal(evidence.isolation.daemonStartedInSandbox, true);
    assert.equal(evidence.daemon.preinstalledModelFound, true);
    assert.equal(evidence.daemon.modelDownloadAttempted, false);
    assert.equal(evidence.cleanup.uiRunnerExited, true);
    assert.equal(evidence.cleanup.uiAutomationDriverGroupAbsentAfterCleanup, true);
    assert.equal(evidence.cleanup.uiAutomationDriverGroupClosedConfirmed, true);
    assert.equal(evidence.cleanup.daemonStopped, true);
    assert.equal(evidence.cleanup.ollamaDaemonGroupAbsentAfterCleanup, true);
    assert.equal(evidence.cleanup.ollamaDaemonGroupClosedConfirmed, true);
    assert.equal(evidence.cleanup.daemonPortClosed, true);
    assert.equal(evidence.cleanup.temporaryRootRemoved, true);
    assert.equal(JSON.stringify(evidence).includes(testRoot), false, 'evidence must not expose test temp paths');
  } finally {
    fs.rmSync(testRoot, { recursive: true, force: true });
  }
} else {
  console.log('Ollama offline UI spawn-error integration test skipped: packaged macOS candidate, Seatbelt, Ollama, or preinstalled 3B model unavailable');
}

console.log('Ollama offline packaged UI contract test passed');
