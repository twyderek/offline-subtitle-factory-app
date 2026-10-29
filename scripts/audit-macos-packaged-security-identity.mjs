import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizeBundleExecutableName } from '../lib/macos-signed-canary-verification.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceDir = path.join(appDir, 'docs/project-management/evidence');
const bundleArgument = process.argv[2] || '';
const requestedOutputPath = process.argv[3] || '';
const requiredCodeSignFlag = process.argv[4] || null;
const startedAt = new Date().toISOString();

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function sha256FileOrNull(filePath) {
  try { return sha256File(filePath); } catch { return null; }
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function run(command, args, timeout = 10000) {
  const result = spawnSync(command, args, {
    encoding: 'utf8', timeout, maxBuffer: 64 * 1024,
    env: { PATH: process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin' },
  });
  return {
    status: Number.isInteger(result.status) ? result.status : null,
    signal: result.signal || null,
    errorCode: result.error?.code || null,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  };
}

function readPlistValue(plistPath, key) {
  const result = run('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plistPath]);
  if (result.status !== 0) return null;
  const value = result.stdout.trim();
  return value || null;
}

function parseCodeSign(result) {
  const text = `${result.stdout}\n${result.stderr}`;
  const first = (pattern) => text.match(pattern)?.[1] || null;
  const authorities = [...text.matchAll(/^Authority=(.+)$/gm)].map((match) => match[1]).slice(0, 4);
  return {
    commandSucceeded: result.status === 0 && !result.errorCode,
    identifier: first(/^Identifier=(.+)$/m),
    teamIdentifier: first(/^TeamIdentifier=(.+)$/m),
    flags: text.match(/CodeDirectory[^\n]*\bflags=([^\s]+)/)?.[1] || null,
    cdHash: first(/^CDHash=(.+)$/m),
    authorities,
    rawDiagnosticSha256: sha256(text),
    rawDiagnosticBytes: Buffer.byteLength(text, 'utf8'),
  };
}

function entitlementSummary(target) {
  const result = run('/usr/bin/codesign', ['-d', '--entitlements', ':-', target]);
  const text = `${result.stdout}\n${result.stderr}`;
  return {
    commandSucceeded: result.status === 0 && !result.errorCode,
    present: /<plist[\s>]|<dict[\s>]|<key>/.test(text),
    sha256: sha256(text),
    bytes: Buffer.byteLength(text, 'utf8'),
  };
}

function inspectCodeObject(label, target, relativeBinaryPath = null) {
  const executableName = relativeBinaryPath
    ? null
    : normalizeBundleExecutableName(readPlistValue(path.join(target, 'Contents', 'Info.plist'), 'CFBundleExecutable'));
  const binaryPath = relativeBinaryPath
    ? path.join(target, relativeBinaryPath)
    : executableName ? path.join(target, 'Contents', 'MacOS', executableName) : null;
  let binarySha256 = null;
  try { if (binaryPath) binarySha256 = sha256File(binaryPath); } catch {}
  const display = run('/usr/bin/codesign', ['-dv', '--verbose=4', target]);
  const verify = run('/usr/bin/codesign', ['--verify', '--deep', '--strict', target]);
  return {
    label,
    bundleIdentifier: readPlistValue(path.join(target, 'Contents', 'Info.plist'), 'CFBundleIdentifier'),
    executableSha256: binarySha256,
    codeSign: parseCodeSign(display),
    verification: { succeeded: verify.status === 0 && !verify.errorCode, status: verify.status, errorCode: verify.errorCode },
    entitlements: entitlementSummary(target),
  };
}

if (process.platform !== 'darwin' || process.arch !== 'arm64') fail('MACOS_ARM64_REQUIRED');
if (!bundleArgument || !requestedOutputPath) fail('BUNDLE_AND_EVIDENCE_REQUIRED');
if (requiredCodeSignFlag && requiredCodeSignFlag !== 'runtime') fail('REQUIRED_CODESIGN_FLAG_INVALID');
const bundlePath = path.resolve(bundleArgument);
const outputPath = path.resolve(requestedOutputPath);
if (!outputPath.startsWith(`${evidenceDir}${path.sep}`) || path.extname(outputPath) !== '.json') fail('EVIDENCE_PATH_INVALID');
if (fs.existsSync(outputPath)) fail('EVIDENCE_ALREADY_EXISTS');
if (!bundlePath.endsWith('.app') || !fs.statSync(bundlePath).isDirectory()) fail('APP_BUNDLE_INVALID');

const frameworkPath = path.join(bundlePath, 'Contents', 'Frameworks', 'Electron Framework.framework');
const frameworkBinary = path.join(frameworkPath, 'Versions', 'A', 'Electron Framework');
const expectedHelperBundleNames = [
  '離線字幕工廠 Helper.app',
  '離線字幕工廠 Helper (GPU).app',
  '離線字幕工廠 Helper (Plugin).app',
  '離線字幕工廠 Helper (Renderer).app',
];
let frameworkAppEntries = [];
try {
  frameworkAppEntries = fs.readdirSync(path.join(bundlePath, 'Contents', 'Frameworks'))
    .filter((name) => name.endsWith('.app'))
    .sort();
} catch {}
const unexpectedHelperBundleNames = frameworkAppEntries.filter((name) => !expectedHelperBundleNames.includes(name));
const missingHelperBundleNames = expectedHelperBundleNames.filter((name) => !frameworkAppEntries.includes(name));
const frameworkEntries = frameworkAppEntries.filter((name) => expectedHelperBundleNames.includes(name));
const helperInventoryComplete = unexpectedHelperBundleNames.length === 0 && missingHelperBundleNames.length === 0;
const packageManifest = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
const infoPlistPath = path.join(bundlePath, 'Contents', 'Info.plist');
const executableName = normalizeBundleExecutableName(readPlistValue(infoPlistPath, 'CFBundleExecutable'));
const candidateMetadataValid = Boolean(executableName);
const executableRelativePath = executableName ? path.join('Contents', 'MacOS', executableName) : null;
const objects = [
  inspectCodeObject('main-app', bundlePath, executableRelativePath),
  inspectCodeObject('electron-framework', frameworkPath, path.join('Versions', 'A', 'Electron Framework')),
  ...expectedHelperBundleNames.map((name) => inspectCodeObject(`helper:${name}`, path.join(bundlePath, 'Contents', 'Frameworks', name))),
];
const allVerified = objects.every((item) => isSha256(item.executableSha256)
  && item.verification.succeeded && item.codeSign.commandSucceeded && item.entitlements.commandSucceeded);
const allAdHoc = objects.every((item) => item.codeSign.flags?.includes('adhoc'));
const allRuntimeFlagsObserved = objects.every((item) => item.codeSign.flags === '0x10002(adhoc,runtime)');
const requiredCodeSignFlagSatisfied = requiredCodeSignFlag === 'runtime' ? allRuntimeFlagsObserved : true;
const noTeamIdentifier = objects.every((item) => item.codeSign.teamIdentifier === 'not set');
const evidence = {
  schema: 'offline-subtitle-factory.macos-packaged-security-identity-audit.v1',
  startedAt,
  completedAt: new Date().toISOString(),
  environment: { platform: process.platform, arch: process.arch, node: process.version, osRelease: os.release() },
  candidate: {
    bundleVersion: readPlistValue(infoPlistPath, 'CFBundleShortVersionString'),
    bundleIdentifier: readPlistValue(infoPlistPath, 'CFBundleIdentifier'),
    executableName,
    executableSha256: executableRelativePath ? sha256FileOrNull(path.join(bundlePath, executableRelativePath)) : null,
    frameworkSha256: sha256FileOrNull(frameworkBinary),
  },
  sourceBuildConfig: {
    macIdentityConfigured: packageManifest.build?.mac?.identity ?? null,
    hardenedRuntimeConfigured: packageManifest.build?.mac?.hardenedRuntime === true,
    gatekeeperAssessConfigured: packageManifest.build?.mac?.gatekeeperAssess === true,
  },
  objects,
  summary: {
    candidateMetadataValid,
    allVerified,
    allAdHoc,
    allRuntimeFlagsObserved,
    requiredCodeSignFlag,
    requiredCodeSignFlagSatisfied,
    noTeamIdentifier,
    anyEntitlementsPresent: objects.some((item) => item.entitlements.present),
    helperCount: frameworkEntries.length,
    helperInventoryComplete,
    helperInventory: {
      frameworkAppEntries,
      expectedHelperBundleNames,
      missingHelperBundleNames,
      unexpectedHelperBundleNames,
    },
  },
  scope: {
    candidateModified: false,
    networkConnectionsAttempted: false,
    packagedAppExecuted: false,
    uiFlowRun: false,
    existingOllamaDaemonStartedOrStopped: false,
    modelDownloaded: false,
    rawCommandOutputPersisted: false,
    absolutePathsPersisted: false,
  },
  status: candidateMetadataValid && allVerified && objects.length >= 3 && helperInventoryComplete && requiredCodeSignFlagSatisfied ? 'pass' : 'fail',
  interpretation: 'This is a read-only identity audit. It records code-sign and entitlement metadata only; it does not establish the cause of the nested Chromium failure, renderer readiness, UI offline acceptance, whole-machine egress control, Windows support, or FR-021 completion. Ad-hoc or missing entitlement metadata indicates a packaging/signing follow-up may be needed, not that sandbox should be disabled.',
};
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
console.log(`macOS packaged security identity audit ${evidence.status}: ${path.basename(outputPath)}`);
if (evidence.status !== 'pass') process.exitCode = 1;
