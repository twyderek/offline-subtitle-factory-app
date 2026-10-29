import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const appDir = path.resolve(path.dirname(scriptPath), '..');
const evidenceDir = path.join(appDir, 'docs/project-management/evidence');
const dmgArgument = process.argv[2] || '';
const appArgument = process.argv[3] || '';
const requestedOutputPath = process.argv[4] || '';
const notaryOutputPath = process.argv[5] || '';
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

function run(command, args, timeout = 60000) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout,
    maxBuffer: 64 * 1024,
    env: { PATH: process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin' },
  });
  return {
    status: Number.isInteger(result.status) ? result.status : null,
    errorCode: result.error?.code || null,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  };
}

function readPlistValue(plistPath, key) {
  const result = run('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plistPath]);
  return result.status === 0 ? result.stdout.trim() : null;
}

function diagnosticSummary(result) {
  const diagnostic = `${result.stdout}\n${result.stderr}`;
  return {
    commandSucceeded: result.status === 0 && !result.errorCode,
    status: result.status === 0 && !result.errorCode ? 'valid' : 'invalid',
    diagnosticSha256: sha256(diagnostic),
    diagnosticBytes: Buffer.byteLength(diagnostic),
  };
}

function sourceRevision() {
  const head = run('/usr/bin/git', ['rev-parse', 'HEAD']);
  const status = run('/usr/bin/git', ['status', '--porcelain']);
  return {
    gitHead: head.status === 0 && /^[a-f0-9]{40}$/.test(head.stdout.trim()) ? head.stdout.trim() : null,
    workingTreeDirty: status.status === 0 && status.stdout.length > 0,
    auditScriptSha256: sha256File(scriptPath),
    selectorModuleSha256: sha256File(path.join(appDir, 'lib/macos-signed-canary-artifact-selection.mjs')),
    packageJsonSha256: sha256File(path.join(appDir, 'package.json')),
    packageLockSha256: sha256File(path.join(appDir, 'package-lock.json')),
  };
}

function isIsoTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function readNotaryOutput(outputPath, dmgSha256) {
  if (!outputPath) return { commandSucceeded: false, status: 'unavailable', diagnosticSha256: sha256(''), diagnosticBytes: 0 };
  try {
    const expectedRunId = process.env.GITHUB_RUN_ID || '';
    const expectedRunnerTemp = process.env.RUNNER_TEMP || '';
    if (!/^\d+$/.test(expectedRunId) || !path.isAbsolute(expectedRunnerTemp)) return { commandSucceeded: false, status: 'invalid', diagnosticSha256: sha256(''), diagnosticBytes: 0 };
    const resolvedOutputPath = path.resolve(outputPath);
    const expectedOutputPath = path.resolve(expectedRunnerTemp, `osf-signed-canary-notarytool-${expectedRunId}.json`);
    const outputStat = fs.lstatSync(resolvedOutputPath);
    if (!path.isAbsolute(outputPath)
      || resolvedOutputPath !== expectedOutputPath
      || !outputStat.isFile()
      || (outputStat.mode & 0o777) !== 0o600) {
      return { commandSucceeded: false, status: 'invalid', diagnosticSha256: sha256(''), diagnosticBytes: 0 };
    }
    const rawOutput = fs.readFileSync(resolvedOutputPath, 'utf8');
    const diagnostic = { diagnosticSha256: sha256(rawOutput), diagnosticBytes: Buffer.byteLength(rawOutput) };
    const result = JSON.parse(rawOutput);
    const valid = result && typeof result === 'object' && !Array.isArray(result)
      && typeof result.status === 'string'
      && result.status === 'Accepted'
      && result.sha256 === dmgSha256;
    return { ...diagnostic, commandSucceeded: valid, status: valid ? 'valid' : 'invalid' };
  } catch {
    return { commandSucceeded: false, status: 'invalid', diagnosticSha256: sha256(''), diagnosticBytes: 0 };
  }
}

function hasExactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function validateEvidence(evidence) {
  const topLevelKeys = ['schema', 'startedAt', 'completedAt', 'environment', 'candidate', 'notarytool', 'stapler', 'archive', 'summary', 'sourceRevision', 'scope', 'status', 'interpretation'];
  const environmentKeys = ['platform', 'arch', 'node', 'osRelease'];
  const candidateKeys = ['appMetadataValid', 'appExecutableSha256', 'dmgSha256'];
  const diagnosticCommandKeys = ['commandSucceeded', 'diagnosticBytes', 'diagnosticSha256', 'status'];
  const summaryKeys = ['ready', 'reasons', 'candidateReady', 'notarytoolReady', 'staplerReady', 'archiveReady'];
  const revisionKeys = ['gitHead', 'workingTreeDirty', 'auditScriptSha256', 'selectorModuleSha256', 'packageJsonSha256', 'packageLockSha256'];
  const scopeKeys = ['candidateModified', 'signingAttempted', 'notarizationAttempted', 'keychainModified', 'packagedAppExecuted', 'uiFlowRun', 'networkConnectionsAttempted', 'rawCommandOutputPersisted', 'absolutePathsPersisted', 'identityNamesPersisted', 'identityHashesPersisted', 'entitlementsPersisted', 'secretsPersisted'];
  if (!hasExactKeys(evidence, topLevelKeys) || evidence.schema !== 'offline-subtitle-factory.macos-signed-canary-distribution-audit.v1') fail('DISTRIBUTION_EVIDENCE_SCHEMA_INVALID');
  if (!isIsoTimestamp(evidence.startedAt) || !isIsoTimestamp(evidence.completedAt) || Date.parse(evidence.completedAt) < Date.parse(evidence.startedAt)) fail('DISTRIBUTION_TIMESTAMP_SCHEMA_INVALID');
  if (!hasExactKeys(evidence.environment, environmentKeys) || evidence.environment.platform !== 'darwin' || evidence.environment.arch !== 'arm64' || Object.values(evidence.environment).some((value) => typeof value !== 'string' || value.length === 0)) fail('DISTRIBUTION_ENVIRONMENT_SCHEMA_INVALID');
  if (!hasExactKeys(evidence.candidate, candidateKeys) || typeof evidence.candidate.appMetadataValid !== 'boolean' || !isSha256(evidence.candidate.dmgSha256) || (evidence.candidate.appExecutableSha256 !== null && !isSha256(evidence.candidate.appExecutableSha256)) || evidence.candidate.appMetadataValid !== (evidence.candidate.appExecutableSha256 !== null)) fail('DISTRIBUTION_CANDIDATE_SCHEMA_INVALID');
  for (const key of ['stapler', 'archive']) {
    if (!hasExactKeys(evidence[key], diagnosticCommandKeys) || typeof evidence[key].commandSucceeded !== 'boolean' || !isSha256(evidence[key].diagnosticSha256) || !Number.isInteger(evidence[key].diagnosticBytes) || evidence[key].diagnosticBytes < 0 || evidence[key].status !== (evidence[key].commandSucceeded ? 'valid' : 'invalid')) fail(`DISTRIBUTION_${key.toUpperCase()}_SCHEMA_INVALID`);
  }
  if (!hasExactKeys(evidence.notarytool, diagnosticCommandKeys) || typeof evidence.notarytool.commandSucceeded !== 'boolean' || !isSha256(evidence.notarytool.diagnosticSha256) || !Number.isInteger(evidence.notarytool.diagnosticBytes) || evidence.notarytool.diagnosticBytes < 0 || !['valid', 'unavailable', 'invalid'].includes(evidence.notarytool.status) || evidence.notarytool.commandSucceeded !== (evidence.notarytool.status === 'valid')) fail('DISTRIBUTION_NOTARYTOOL_SCHEMA_INVALID');
  if (!hasExactKeys(evidence.summary, summaryKeys) || !Array.isArray(evidence.summary.reasons) || !evidence.summary.reasons.every((value) => typeof value === 'string')) fail('DISTRIBUTION_SUMMARY_SCHEMA_INVALID');
  const expectedReasons = [];
  if (!evidence.summary.candidateReady) expectedReasons.push('candidate-not-ready');
  if (!evidence.summary.notarytoolReady) expectedReasons.push('notarytool-command-not-ready');
  if (!evidence.summary.staplerReady) expectedReasons.push('dmg-staple-not-ready');
  if (!evidence.summary.archiveReady) expectedReasons.push('dmg-archive-not-ready');
  if (JSON.stringify(evidence.summary.reasons) !== JSON.stringify(expectedReasons)
    || evidence.summary.ready !== (expectedReasons.length === 0)
    || evidence.summary.candidateReady !== evidence.candidate.appMetadataValid
    || evidence.summary.notarytoolReady !== evidence.notarytool.commandSucceeded
    || evidence.summary.staplerReady !== evidence.stapler.commandSucceeded
    || evidence.summary.archiveReady !== evidence.archive.commandSucceeded
    || evidence.status !== (evidence.summary.ready ? 'pass' : 'fail')) fail('DISTRIBUTION_SUMMARY_STATUS_MISMATCH');
  if (!hasExactKeys(evidence.sourceRevision, revisionKeys) || !/^[a-f0-9]{40}$/.test(evidence.sourceRevision.gitHead || '') || typeof evidence.sourceRevision.workingTreeDirty !== 'boolean' || !revisionKeys.slice(2).every((key) => isSha256(evidence.sourceRevision[key]))) fail('DISTRIBUTION_PROVENANCE_INVALID');
  if (!hasExactKeys(evidence.scope, scopeKeys) || Object.values(evidence.scope).some((value) => value !== false) || typeof evidence.interpretation !== 'string' || evidence.interpretation.length === 0) fail('DISTRIBUTION_SCOPE_NOT_FAIL_CLOSED');
  if (/(?:^|[\s"'=:(\[,])\/(?:[^\s"'`]+(?:\/[^\s"`]+)*)|[A-Za-z]:[\\/]|\\\\|sk-[A-Za-z0-9]|-----BEGIN/i.test(JSON.stringify(evidence))) fail('DISTRIBUTION_LEAKAGE_DETECTED');
  return true;
}

export { validateEvidence };

function main() {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') fail('MACOS_ARM64_REQUIRED');
  if (!dmgArgument || !appArgument || !requestedOutputPath) fail('DMG_APP_AND_EVIDENCE_REQUIRED');
  const dmgPath = path.resolve(dmgArgument);
  const appPath = path.resolve(appArgument);
  const outputPath = path.resolve(requestedOutputPath);
  if (!outputPath.startsWith(`${evidenceDir}${path.sep}`) || path.extname(outputPath) !== '.json') fail('EVIDENCE_PATH_INVALID');
  if (fs.existsSync(outputPath)) fail('EVIDENCE_ALREADY_EXISTS');
  if (!fs.statSync(dmgPath).isFile() || !fs.statSync(appPath).isDirectory()) fail('DISTRIBUTION_ARTIFACT_INVALID');
  const executableName = readPlistValue(path.join(appPath, 'Contents', 'Info.plist'), 'CFBundleExecutable');
  const executableNameValid = typeof executableName === 'string' && executableName.length > 0 && !['.', '..'].includes(executableName) && path.basename(executableName) === executableName;
  const executablePath = executableNameValid ? path.join(appPath, 'Contents', 'MacOS', executableName) : null;
  const appExecutableSha256 = executablePath && fs.existsSync(executablePath) ? sha256File(executablePath) : null;
  const candidate = {
    appMetadataValid: Boolean(executableNameValid && appExecutableSha256),
    appExecutableSha256,
    dmgSha256: sha256File(dmgPath),
  };
  const notarytool = readNotaryOutput(notaryOutputPath, candidate.dmgSha256);
  const staplerResult = diagnosticSummary(run('/usr/bin/xcrun', ['stapler', 'validate', dmgPath]));
  const stapler = { ...staplerResult, status: staplerResult.commandSucceeded ? 'valid' : 'invalid' };
  const archive = diagnosticSummary(run('/usr/bin/hdiutil', ['verify', dmgPath]));
  const summary = {
    candidateReady: candidate.appMetadataValid,
    notarytoolReady: notarytool.commandSucceeded,
    staplerReady: stapler.commandSucceeded,
    archiveReady: archive.commandSucceeded,
    reasons: [],
  };
  if (!summary.candidateReady) summary.reasons.push('candidate-not-ready');
  if (!summary.notarytoolReady) summary.reasons.push('notarytool-command-not-ready');
  if (!summary.staplerReady) summary.reasons.push('dmg-staple-not-ready');
  if (!summary.archiveReady) summary.reasons.push('dmg-archive-not-ready');
  summary.ready = summary.reasons.length === 0;
  const evidence = {
    schema: 'offline-subtitle-factory.macos-signed-canary-distribution-audit.v1',
    startedAt,
    completedAt: new Date().toISOString(),
    environment: { platform: process.platform, arch: process.arch, node: process.version, osRelease: os.release() },
    candidate,
    notarytool,
    stapler,
    archive,
    summary,
    sourceRevision: sourceRevision(),
    scope: {
      candidateModified: false,
      signingAttempted: false,
      notarizationAttempted: false,
      keychainModified: false,
      packagedAppExecuted: false,
      uiFlowRun: false,
      networkConnectionsAttempted: false,
      rawCommandOutputPersisted: false,
      absolutePathsPersisted: false,
      identityNamesPersisted: false,
      identityHashesPersisted: false,
      entitlementsPersisted: false,
      secretsPersisted: false,
    },
    status: summary.ready ? 'pass' : 'fail',
    interpretation: 'This is a bounded distribution evidence projection. It records only the workflow notarytool command success projection from a run-scoped JSON output, DMG stapler validation and hdiutil verification; it does not prove Apple ticket validity beyond those command results, does not persist raw output or paths, and does not establish renderer, offline, Windows or FR-021 overall acceptance.',
  };
  validateEvidence(evidence);
  writeEvidenceFile(outputPath, evidence);
  console.log(`macOS signed canary distribution audit ${evidence.status}: ${path.basename(outputPath)}`);
  if (!summary.ready) process.exitCode = 1;
}

function writeEvidenceFile(outputPath, evidence) {
  validateEvidence(evidence);
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
}

export { readNotaryOutput, writeEvidenceFile };

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
