import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { TextDecoder } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const appDir = path.resolve(path.dirname(scriptPath), '..');
const evidenceDir = path.join(appDir, 'docs/project-management/evidence');
const dmgArgument = process.argv[2] || '';
const appArgument = process.argv[3] || '';
const zipArgument = process.argv[4] || '';
const submittedDmgArgument = process.argv[5] || '';
const submittedZipArgument = process.argv[6] || '';
const requestedOutputPath = process.argv[7] || '';
const notaryDmgOutputPath = process.argv[8] || '';
const notaryZipOutputPath = process.argv[9] || '';
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

function readNotaryOutput(outputPath, archiveSha256, archiveLabel) {
  if (!outputPath) return { commandSucceeded: false, status: 'unavailable', diagnosticSha256: sha256(''), diagnosticBytes: 0 };
  try {
    const expectedRunId = process.env.GITHUB_RUN_ID || '';
    const expectedRunnerTemp = process.env.RUNNER_TEMP || '';
    if (!/^\d+$/.test(expectedRunId) || !path.isAbsolute(expectedRunnerTemp) || !['dmg', 'zip'].includes(archiveLabel)) return { commandSucceeded: false, status: 'invalid', diagnosticSha256: sha256(''), diagnosticBytes: 0 };
    const resolvedOutputPath = path.resolve(outputPath);
    const expectedOutputPath = path.resolve(expectedRunnerTemp, `osf-signed-canary-notarytool-${archiveLabel}-${expectedRunId}.json`);
    const outputStat = fs.lstatSync(resolvedOutputPath);
    if (!path.isAbsolute(outputPath)
      || resolvedOutputPath !== expectedOutputPath
      || !outputStat.isFile()
      || (outputStat.mode & 0o777) !== 0o600) {
      return { commandSucceeded: false, status: 'invalid', diagnosticSha256: sha256(''), diagnosticBytes: 0 };
    }
    const rawOutput = fs.readFileSync(resolvedOutputPath);
    const diagnostic = { diagnosticSha256: sha256(rawOutput), diagnosticBytes: rawOutput.byteLength };
    let decodedOutput;
    try {
      decodedOutput = new TextDecoder('utf-8', { fatal: true }).decode(rawOutput);
    } catch {
      return { ...diagnostic, commandSucceeded: false, status: 'invalid' };
    }
    let result;
    try {
      result = JSON.parse(decodedOutput);
    } catch {
      return { ...diagnostic, commandSucceeded: false, status: 'invalid' };
    }
    const valid = result && typeof result === 'object' && !Array.isArray(result)
      && typeof result.status === 'string'
      && result.status === 'Accepted'
      && isSha256(archiveSha256)
      && result.sha256 === archiveSha256;
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

function isBoundSubmittedArchive(filePath, archiveLabel, extension) {
  try {
    const expectedRunId = process.env.GITHUB_RUN_ID || '';
    const expectedRunnerTemp = process.env.RUNNER_TEMP || '';
    if (!/^\d+$/.test(expectedRunId)
      || !path.isAbsolute(expectedRunnerTemp)
      || !path.isAbsolute(filePath)
      || !['dmg', 'zip'].includes(archiveLabel)
      || !['dmg', 'zip'].includes(extension)) return false;
    const expectedPath = path.resolve(expectedRunnerTemp, `osf-signed-canary-submitted-${archiveLabel}-${expectedRunId}.${extension}`);
    const stat = fs.lstatSync(path.resolve(filePath));
    return path.resolve(filePath) === expectedPath && stat.isFile() && (stat.mode & 0o777) === 0o600;
  } catch {
    return false;
  }
}

function isBoundSubmittedDmg(filePath) {
  return isBoundSubmittedArchive(filePath, 'dmg', 'dmg');
}

function isBoundSubmittedZip(filePath) {
  return isBoundSubmittedArchive(filePath, 'zip', 'zip');
}

function inspectZipArchive(zipPath, expectedMemberName, expectedAppExecutableSha256) {
  const integrity = run('/usr/bin/unzip', ['-tqq', zipPath]);
  const listing = run('/usr/bin/unzip', ['-Z1', zipPath]);
  const members = listing.status === 0 && !listing.errorCode
    ? listing.stdout.split(/\r?\n/).filter(Boolean)
    : [];
  const listingSucceeded = listing.status === 0 && !listing.errorCode && members.length > 0;
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-signed-canary-zip-audit-'));
  const extractedPath = path.join(tempDirectory, 'embedded-app-executable');
  let memberResult = { status: null, errorCode: 'ZIP_MEMBER_NOT_CHECKED', stderr: '' };
  let zipAppExecutableSha256 = null;
  try {
    if (expectedMemberName && listingSucceeded) {
      const fd = fs.openSync(extractedPath, 'w', 0o600);
      try {
        const result = spawnSync('/usr/bin/unzip', ['-p', zipPath, expectedMemberName], {
          stdio: ['ignore', fd, 'pipe'],
          encoding: 'utf8',
          timeout: 60000,
          maxBuffer: 64 * 1024,
        });
        memberResult = {
          status: Number.isInteger(result.status) ? result.status : null,
          errorCode: result.error?.code || null,
          stderr: String(result.stderr || ''),
        };
      } finally {
        fs.closeSync(fd);
      }
      if (memberResult.status === 0 && !memberResult.errorCode) zipAppExecutableSha256 = sha256FileOrNull(extractedPath);
    }
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
  const memberCommandSucceeded = listingSucceeded && memberResult.status === 0 && !memberResult.errorCode && isSha256(zipAppExecutableSha256);
  const embeddedAppMatch = memberCommandSucceeded && zipAppExecutableSha256 === expectedAppExecutableSha256;
  const diagnostic = [
    integrity.stdout,
    integrity.stderr,
    listing.stdout,
    listing.stderr,
    memberResult.stderr,
  ].join('\n');
  const commandSucceeded = integrity.status === 0 && !integrity.errorCode;
  return {
    commandSucceeded,
    embeddedAppCommandSucceeded: memberCommandSucceeded,
    embeddedAppMatch,
    status: commandSucceeded && embeddedAppMatch ? 'valid' : 'invalid',
    diagnosticSha256: sha256(diagnostic),
    diagnosticBytes: Buffer.byteLength(diagnostic, 'utf8'),
    zipAppExecutableSha256,
  };
}

function validateEvidence(evidence) {
  const topLevelKeys = ['schema', 'startedAt', 'completedAt', 'environment', 'candidate', 'notarytoolDmg', 'notarytoolZip', 'staplerApp', 'staplerDmg', 'archive', 'zipArchive', 'summary', 'sourceRevision', 'scope', 'status', 'interpretation'];
  const environmentKeys = ['platform', 'arch', 'node', 'osRelease'];
  const candidateKeys = ['appMetadataValid', 'appExecutableSha256', 'dmgSha256', 'zipSha256', 'submittedDmgSha256', 'submittedZipSha256', 'zipAppExecutableSha256'];
  const diagnosticCommandKeys = ['commandSucceeded', 'diagnosticBytes', 'diagnosticSha256', 'status'];
  const zipArchiveKeys = ['commandSucceeded', 'embeddedAppCommandSucceeded', 'embeddedAppMatch', 'status', 'diagnosticSha256', 'diagnosticBytes'];
  const summaryKeys = ['ready', 'reasons', 'candidateReady', 'dmgNotarytoolReady', 'zipNotarytoolReady', 'appStaplerReady', 'dmgStaplerReady', 'archiveReady', 'zipArchiveReady'];
  const revisionKeys = ['gitHead', 'workingTreeDirty', 'auditScriptSha256', 'selectorModuleSha256', 'packageJsonSha256', 'packageLockSha256'];
  const scopeKeys = ['candidateModified', 'signingAttempted', 'notarizationAttempted', 'keychainModified', 'packagedAppExecuted', 'uiFlowRun', 'networkConnectionsAttempted', 'rawCommandOutputPersisted', 'absolutePathsPersisted', 'identityNamesPersisted', 'identityHashesPersisted', 'entitlementsPersisted', 'secretsPersisted'];
  if (!hasExactKeys(evidence, topLevelKeys) || evidence.schema !== 'offline-subtitle-factory.macos-signed-canary-distribution-audit.v1') fail('DISTRIBUTION_EVIDENCE_SCHEMA_INVALID');
  if (!isIsoTimestamp(evidence.startedAt) || !isIsoTimestamp(evidence.completedAt) || Date.parse(evidence.completedAt) < Date.parse(evidence.startedAt)) fail('DISTRIBUTION_TIMESTAMP_SCHEMA_INVALID');
  if (!hasExactKeys(evidence.environment, environmentKeys) || evidence.environment.platform !== 'darwin' || evidence.environment.arch !== 'arm64' || Object.values(evidence.environment).some((value) => typeof value !== 'string' || value.length === 0)) fail('DISTRIBUTION_ENVIRONMENT_SCHEMA_INVALID');
  if (!hasExactKeys(evidence.candidate, candidateKeys) || typeof evidence.candidate.appMetadataValid !== 'boolean'
    || ![evidence.candidate.appExecutableSha256, evidence.candidate.dmgSha256, evidence.candidate.zipSha256, evidence.candidate.submittedDmgSha256, evidence.candidate.submittedZipSha256, evidence.candidate.zipAppExecutableSha256].every((value) => value === null || isSha256(value))
    || evidence.candidate.appMetadataValid !== (evidence.candidate.appExecutableSha256 !== null)) fail('DISTRIBUTION_CANDIDATE_SCHEMA_INVALID');
  for (const key of ['staplerApp', 'staplerDmg', 'archive']) {
    if (!hasExactKeys(evidence[key], diagnosticCommandKeys) || typeof evidence[key].commandSucceeded !== 'boolean' || !isSha256(evidence[key].diagnosticSha256) || !Number.isInteger(evidence[key].diagnosticBytes) || evidence[key].diagnosticBytes < 0 || evidence[key].status !== (evidence[key].commandSucceeded ? 'valid' : 'invalid')) fail(`DISTRIBUTION_${key.toUpperCase()}_SCHEMA_INVALID`);
  }
  for (const key of ['notarytoolDmg', 'notarytoolZip']) {
    if (!hasExactKeys(evidence[key], diagnosticCommandKeys) || typeof evidence[key].commandSucceeded !== 'boolean' || !isSha256(evidence[key].diagnosticSha256) || !Number.isInteger(evidence[key].diagnosticBytes) || evidence[key].diagnosticBytes < 0 || !['valid', 'unavailable', 'invalid'].includes(evidence[key].status) || evidence[key].commandSucceeded !== (evidence[key].status === 'valid')) fail(`DISTRIBUTION_${key.toUpperCase()}_SCHEMA_INVALID`);
  }
  if (!hasExactKeys(evidence.zipArchive, zipArchiveKeys)
    || typeof evidence.zipArchive.commandSucceeded !== 'boolean'
    || typeof evidence.zipArchive.embeddedAppCommandSucceeded !== 'boolean'
    || typeof evidence.zipArchive.embeddedAppMatch !== 'boolean'
    || !isSha256(evidence.zipArchive.diagnosticSha256)
    || !Number.isInteger(evidence.zipArchive.diagnosticBytes) || evidence.zipArchive.diagnosticBytes < 0
    || !['valid', 'invalid'].includes(evidence.zipArchive.status)
    || evidence.zipArchive.embeddedAppMatch !== (evidence.zipArchive.embeddedAppCommandSucceeded
      && evidence.candidate.zipAppExecutableSha256 !== null
      && evidence.candidate.zipAppExecutableSha256 === evidence.candidate.appExecutableSha256)
    || evidence.zipArchive.status !== (evidence.zipArchive.commandSucceeded && evidence.zipArchive.embeddedAppMatch ? 'valid' : 'invalid')) fail('DISTRIBUTION_ZIP_ARCHIVE_SCHEMA_INVALID');
  if (!hasExactKeys(evidence.summary, summaryKeys) || !Array.isArray(evidence.summary.reasons) || !evidence.summary.reasons.every((value) => typeof value === 'string')) fail('DISTRIBUTION_SUMMARY_SCHEMA_INVALID');
  const expectedReasons = [];
  if (!evidence.summary.candidateReady) expectedReasons.push('candidate-not-ready');
  if (!evidence.summary.dmgNotarytoolReady) expectedReasons.push('dmg-notarytool-command-not-ready');
  if (!evidence.summary.zipNotarytoolReady) expectedReasons.push('zip-notarytool-command-not-ready');
  if (!evidence.summary.appStaplerReady) expectedReasons.push('app-staple-not-ready');
  if (!evidence.summary.dmgStaplerReady) expectedReasons.push('dmg-staple-not-ready');
  if (!evidence.summary.archiveReady) expectedReasons.push('dmg-archive-not-ready');
  if (!evidence.summary.zipArchiveReady) expectedReasons.push('zip-archive-not-ready');
  if (JSON.stringify(evidence.summary.reasons) !== JSON.stringify(expectedReasons)
    || evidence.summary.ready !== (expectedReasons.length === 0)
    || evidence.summary.candidateReady !== (evidence.candidate.appMetadataValid
      && [evidence.candidate.appExecutableSha256, evidence.candidate.dmgSha256, evidence.candidate.zipSha256, evidence.candidate.submittedDmgSha256, evidence.candidate.submittedZipSha256, evidence.candidate.zipAppExecutableSha256].every(isSha256)
      && evidence.candidate.zipAppExecutableSha256 === evidence.candidate.appExecutableSha256)
    || evidence.summary.dmgNotarytoolReady !== evidence.notarytoolDmg.commandSucceeded
    || evidence.summary.zipNotarytoolReady !== evidence.notarytoolZip.commandSucceeded
    || evidence.summary.appStaplerReady !== evidence.staplerApp.commandSucceeded
    || evidence.summary.dmgStaplerReady !== evidence.staplerDmg.commandSucceeded
    || evidence.summary.archiveReady !== evidence.archive.commandSucceeded
    || evidence.summary.zipArchiveReady !== (evidence.zipArchive.commandSucceeded && evidence.zipArchive.embeddedAppMatch)
    || evidence.status !== (evidence.summary.ready ? 'pass' : 'fail')) fail('DISTRIBUTION_SUMMARY_STATUS_MISMATCH');
  if (!hasExactKeys(evidence.sourceRevision, revisionKeys) || !/^[a-f0-9]{40}$/.test(evidence.sourceRevision.gitHead || '') || typeof evidence.sourceRevision.workingTreeDirty !== 'boolean' || !revisionKeys.slice(2).every((key) => isSha256(evidence.sourceRevision[key]))) fail('DISTRIBUTION_PROVENANCE_INVALID');
  if (!hasExactKeys(evidence.scope, scopeKeys) || Object.values(evidence.scope).some((value) => value !== false) || typeof evidence.interpretation !== 'string' || evidence.interpretation.length === 0) fail('DISTRIBUTION_SCOPE_NOT_FAIL_CLOSED');
  if (/(?:^|[\s"'=:(\[,])\/(?:[^\s"'`]+(?:\/[^\s"`]+)*)|[A-Za-z]:[\\/]|\\\\|sk-[A-Za-z0-9]|-----BEGIN/i.test(JSON.stringify(evidence))) fail('DISTRIBUTION_LEAKAGE_DETECTED');
  return true;
}

export { inspectZipArchive, isBoundSubmittedDmg, isBoundSubmittedZip, validateEvidence };

function main() {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') fail('MACOS_ARM64_REQUIRED');
  if (!dmgArgument || !appArgument || !zipArgument || !requestedOutputPath) fail('DMG_APP_ZIP_AND_EVIDENCE_REQUIRED');
  const dmgPath = path.resolve(dmgArgument);
  const appPath = path.resolve(appArgument);
  const zipPath = path.resolve(zipArgument);
  const submittedDmgPath = submittedDmgArgument ? path.resolve(submittedDmgArgument) : null;
  const submittedZipPath = submittedZipArgument ? path.resolve(submittedZipArgument) : null;
  const outputPath = path.resolve(requestedOutputPath);
  if (!outputPath.startsWith(`${evidenceDir}${path.sep}`) || path.extname(outputPath) !== '.json') fail('EVIDENCE_PATH_INVALID');
  if (fs.existsSync(outputPath)) fail('EVIDENCE_ALREADY_EXISTS');
  if (!fs.statSync(dmgPath).isFile() || !fs.statSync(appPath).isDirectory() || !fs.statSync(zipPath).isFile()) fail('DISTRIBUTION_ARTIFACT_INVALID');
  const executableName = readPlistValue(path.join(appPath, 'Contents', 'Info.plist'), 'CFBundleExecutable');
  const executableNameValid = typeof executableName === 'string' && executableName.length > 0 && !['.', '..'].includes(executableName) && path.basename(executableName) === executableName;
  const executablePath = executableNameValid ? path.join(appPath, 'Contents', 'MacOS', executableName) : null;
  const appExecutableSha256 = executablePath && fs.existsSync(executablePath) ? sha256FileOrNull(executablePath) : null;
  const submittedDmgSha256 = submittedDmgPath && submittedDmgPath !== dmgPath && isBoundSubmittedDmg(submittedDmgPath)
    ? sha256FileOrNull(submittedDmgPath)
    : null;
  const submittedZipSha256 = submittedZipPath && submittedZipPath !== zipPath && isBoundSubmittedZip(submittedZipPath)
    ? sha256FileOrNull(submittedZipPath)
    : null;
  const candidate = {
    appMetadataValid: Boolean(executableNameValid && isSha256(appExecutableSha256)),
    appExecutableSha256,
    dmgSha256: sha256FileOrNull(dmgPath),
    zipSha256: sha256FileOrNull(zipPath),
    submittedDmgSha256,
    submittedZipSha256,
    zipAppExecutableSha256: null,
  };
  const zipMemberName = executableNameValid ? `${path.basename(appPath)}/Contents/MacOS/${executableName}` : null;
  const zipArchive = inspectZipArchive(zipPath, zipMemberName, candidate.appExecutableSha256);
  candidate.zipAppExecutableSha256 = zipArchive.zipAppExecutableSha256;
  const notarytoolDmg = readNotaryOutput(notaryDmgOutputPath, candidate.submittedDmgSha256, 'dmg');
  const notarytoolZip = readNotaryOutput(notaryZipOutputPath, candidate.submittedZipSha256, 'zip');
  const appStaplerResult = diagnosticSummary(run('/usr/bin/xcrun', ['stapler', 'validate', appPath]));
  const staplerApp = { ...appStaplerResult, status: appStaplerResult.commandSucceeded ? 'valid' : 'invalid' };
  const dmgStaplerResult = diagnosticSummary(run('/usr/bin/xcrun', ['stapler', 'validate', dmgPath]));
  const staplerDmg = { ...dmgStaplerResult, status: dmgStaplerResult.commandSucceeded ? 'valid' : 'invalid' };
  const archive = diagnosticSummary(run('/usr/bin/hdiutil', ['verify', dmgPath]));
  const summary = {
    candidateReady: candidate.appMetadataValid
      && [candidate.appExecutableSha256, candidate.dmgSha256, candidate.zipSha256, candidate.submittedDmgSha256, candidate.submittedZipSha256, candidate.zipAppExecutableSha256].every(isSha256)
      && candidate.zipAppExecutableSha256 === candidate.appExecutableSha256,
    dmgNotarytoolReady: notarytoolDmg.commandSucceeded,
    zipNotarytoolReady: notarytoolZip.commandSucceeded,
    appStaplerReady: staplerApp.commandSucceeded,
    dmgStaplerReady: staplerDmg.commandSucceeded,
    archiveReady: archive.commandSucceeded,
    zipArchiveReady: zipArchive.commandSucceeded && zipArchive.embeddedAppMatch,
    reasons: [],
  };
  if (!summary.candidateReady) summary.reasons.push('candidate-not-ready');
  if (!summary.dmgNotarytoolReady) summary.reasons.push('dmg-notarytool-command-not-ready');
  if (!summary.zipNotarytoolReady) summary.reasons.push('zip-notarytool-command-not-ready');
  if (!summary.appStaplerReady) summary.reasons.push('app-staple-not-ready');
  if (!summary.dmgStaplerReady) summary.reasons.push('dmg-staple-not-ready');
  if (!summary.archiveReady) summary.reasons.push('dmg-archive-not-ready');
  if (!summary.zipArchiveReady) summary.reasons.push('zip-archive-not-ready');
  summary.ready = summary.reasons.length === 0;
  const evidence = {
    schema: 'offline-subtitle-factory.macos-signed-canary-distribution-audit.v1',
    startedAt,
    completedAt: new Date().toISOString(),
    environment: { platform: process.platform, arch: process.arch, node: process.version, osRelease: os.release() },
    candidate,
    notarytoolDmg,
    notarytoolZip,
    staplerApp,
    staplerDmg,
    archive,
    zipArchive: {
      commandSucceeded: zipArchive.commandSucceeded,
      embeddedAppCommandSucceeded: zipArchive.embeddedAppCommandSucceeded,
      embeddedAppMatch: zipArchive.embeddedAppMatch,
      status: zipArchive.status,
      diagnosticSha256: zipArchive.diagnosticSha256,
      diagnosticBytes: zipArchive.diagnosticBytes,
    },
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
    interpretation: 'This is a bounded distribution evidence projection. It records separate run-scoped notarytool success projections for the submitted DMG and submitted ZIP, validates the stapled app and final DMG, verifies the final re-packed ZIP and binds its embedded app executable digest to the stapled app. The submitted DMG is preserved separately because stapling changes the final DMG bytes; ZIP cannot be stapled directly, so the submitted ZIP and final ZIP are also distinct artifacts. This does not establish renderer, offline, Windows or FR-021 overall acceptance.',
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
