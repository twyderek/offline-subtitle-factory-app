import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceDir = path.join(appDir, 'docs/project-management/evidence');
const sandboxExec = '/usr/bin/sandbox-exec';
const canaryExecutable = '/usr/bin/true';
const requestedOutputPath = process.argv[2];
const startedAt = new Date().toISOString();

if (!requestedOutputPath) {
  console.error('Evidence output path is required; pass a new .json path inside docs/project-management/evidence.');
  process.exit(2);
}

const outputPath = path.resolve(requestedOutputPath);

const loopbackOnlyProfile = '(version 1) (allow default) (deny network-outbound) (deny network-inbound) (deny network-bind) (allow network-bind (local ip "localhost:*")) (allow network-inbound (local ip "localhost:*")) (allow network-outbound (remote ip "localhost:*"))';
const chromiumNetworkServiceShapeProfile = '(version 1) (allow default) (allow network-outbound (remote tcp)) (allow network-outbound (remote udp)) (allow network-bind (local tcp)) (allow network-bind (local udp))';
const narrowNetworkPermissionParent = '(version 1) (allow default) (deny network-outbound) (deny network-inbound) (deny network-bind) (allow network-bind (local ip "localhost:*")) (allow network-inbound (local ip "localhost:*")) (allow network-outbound (remote ip "localhost:*")) (allow network-outbound (remote tcp)) (allow network-outbound (remote udp)) (allow network-bind (local tcp)) (allow network-bind (local udp))';
const unrestrictedParent = '(version 1) (allow default)';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function commandOutput(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 3000, maxBuffer: 16 * 1024 });
  return result.status === 0 ? String(result.stdout || '').trim() : null;
}

function runNestedProfile(parentProfile, childProfile) {
  const args = ['-p', parentProfile, sandboxExec, '-p', childProfile, canaryExecutable];
  const result = spawnSync(sandboxExec, args, { encoding: 'utf8', timeout: 5000, maxBuffer: 32 * 1024 });
  const diagnostic = String(result.stderr || '');
  return {
    exitCode: Number.isInteger(result.status) ? result.status : null,
    signal: result.signal || null,
    timedOut: result.error?.code === 'ETIMEDOUT',
    spawnErrorCode: result.error?.code || null,
    operationNotPermitted: /operation not permitted/i.test(diagnostic),
  };
}

if (process.platform !== 'darwin') {
  console.log('macOS Seatbelt nested-profile canary skipped: macOS is required.');
  process.exit(0);
}

if (!outputPath.startsWith(`${evidenceDir}${path.sep}`) || path.extname(outputPath) !== '.json') {
  console.error('Evidence path must be a new .json file inside docs/project-management/evidence.');
  process.exit(2);
}

if (!fs.existsSync(sandboxExec) || !fs.existsSync(canaryExecutable)) {
  console.error('Required macOS Seatbelt canary executable is unavailable.');
  process.exit(2);
}

const cases = [
  {
    name: 'same_restrictive_parent_and_child',
    parentProfileId: 'loopbackOnly',
    childProfileId: 'loopbackOnly',
    expected: 'exit 0',
    result: runNestedProfile(loopbackOnlyProfile, loopbackOnlyProfile),
  },
  {
    name: 'restricted_parent_rejects_network_service_shape',
    parentProfileId: 'loopbackOnly',
    childProfileId: 'chromiumNetworkServiceShape',
    expected: 'exit 71 and Operation not permitted diagnostic',
    result: runNestedProfile(loopbackOnlyProfile, chromiumNetworkServiceShapeProfile),
  },
  {
    name: 'narrow_network_permission_parent_still_rejects_shape',
    parentProfileId: 'narrowNetworkPermission',
    childProfileId: 'chromiumNetworkServiceShape',
    expected: 'exit 71 and Operation not permitted diagnostic',
    result: runNestedProfile(narrowNetworkPermissionParent, chromiumNetworkServiceShapeProfile),
  },
  {
    name: 'unrestricted_parent_accepts_network_service_shape',
    parentProfileId: 'unrestricted',
    childProfileId: 'chromiumNetworkServiceShape',
    expected: 'exit 0',
    result: runNestedProfile(unrestrictedParent, chromiumNetworkServiceShapeProfile),
  },
];

for (const item of cases) {
  item.pass = item.name === 'restricted_parent_rejects_network_service_shape'
    || item.name === 'narrow_network_permission_parent_still_rejects_shape'
    ? item.result.exitCode === 71 && item.result.operationNotPermitted
    : item.result.exitCode === 0 && !item.result.spawnErrorCode && !item.result.timedOut;
}

const evidence = {
  schema: 'offline-subtitle-factory.macos-seatbelt-nested-profile-canary.v2',
  startedAt,
  completedAt: new Date().toISOString(),
  environment: {
    macOSProductVersion: commandOutput('/usr/bin/sw_vers', ['-productVersion']),
    macOSBuildVersion: commandOutput('/usr/bin/sw_vers', ['-buildVersion']),
    architecture: os.arch(),
    nodeVersion: process.version,
    sandboxExecSha256: sha256(fs.readFileSync(sandboxExec)),
    canaryExecutableSha256: sha256(fs.readFileSync(canaryExecutable)),
  },
  comparison: {
    priorPackagedUiEvidence: '2026-09-30-ollama-llama3.2-3b-ui-offline-replay11.json',
    packagedCandidateExecuted: false,
    packagedCandidateSha256: null,
    purpose: 'Seatbelt profile-composition canary only; not a packaged Electron replay',
  },
  invocation: {
    executable: sandboxExec,
    argumentPattern: ['-p', '<parent-profile>', sandboxExec, '-p', '<child-profile>', canaryExecutable],
    shellRequired: false,
    networkApiUsedByHarness: false,
    networkConnectionsAttempted: false,
    externalSocketAttempted: false,
  },
  profiles: {
    loopbackOnly: loopbackOnlyProfile,
    chromiumNetworkServiceShape: chromiumNetworkServiceShapeProfile,
    narrowNetworkPermission: narrowNetworkPermissionParent,
    unrestricted: unrestrictedParent,
    chromiumNetworkServiceShapeIsExactGeneratedProfile: false,
  },
  cases,
  scope: {
    systemNetworkDisabled: false,
    systemNetworkConfigurationChanged: false,
    existingOllamaDaemonStartedOrStopped: false,
    modelDownloaded: false,
    packagedElectronRerun: false,
    uiFlowRun: false,
  },
  interpretation: 'The replay records the exact synthetic profiles and argv used by this local Seatbelt composition canary. It executes only /usr/bin/true and the harness opens no sockets. The child policy is a minimal network-service permission shape informed by the pinned Chromium network.sb source reference below, not Chromium’s exact generated profile. In this test, the restrictive parent rejects that child shape; adding only explicit TCP/UDP rules remains insufficient; a parent with allow default accepts it. These outcomes demonstrate this synthetic parent/child profile interaction only; they do not establish the sole cause of the separate packaged Electron failure or constitute UI/offline acceptance.',
  sourceReferences: [
    'https://releases.electronjs.org/release/v43.3.0',
    'https://chromium.googlesource.com/codesearch/chromium/src/+/refs/tags/150.0.7871.212/sandbox/policy/mac/network.sb',
    'https://developer.apple.com/documentation/networkextension/nefilterdataprovider',
    'https://developer.apple.com/documentation/xcode/configuring-network-extensions',
  ],
  sourceReferencePolicy: 'The Chromium network.sb reference is pinned to tag 150.0.7871.212; mutable HEAD is not used as evidence. The tag resolves to commit 69bf1c67cb894365d151bd020bb0171fd583633a6 and the referenced blob is 58477d8d17902258b3f361d72751a32c034e0645.',
  status: cases.every((item) => item.pass) ? 'pass' : 'fail',
};

try {
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
} catch (error) {
  console.error(error?.code === 'EEXIST' ? 'Evidence file already exists; refusing to overwrite.' : 'Unable to create canary evidence.');
  process.exit(2);
}

console.log(`macOS Seatbelt nested-profile canary ${evidence.status}: ${path.basename(outputPath)}`);
if (evidence.status !== 'pass') process.exitCode = 1;
