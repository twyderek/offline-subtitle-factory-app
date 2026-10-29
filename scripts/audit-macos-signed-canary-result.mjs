import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { summarizeSourceBuildConfig } from './audit-macos-signing-readiness.mjs';
import { loadSignedCanaryBuildConfig } from '../lib/macos-signed-canary-build-config.mjs';
import {
  classifyCodeSign,
  classifyEntitlements,
  classifyGatekeeper,
  classifyStapler,
  compareTeamIdentifiers,
  evaluateSignedCanaryVerification,
  expectedCodeObjectLabels,
  expectedHelperBundleNames,
} from '../lib/macos-signed-canary-verification.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const appDir = path.resolve(path.dirname(scriptPath), '..');
const evidenceDir = path.join(appDir, 'docs/project-management/evidence');
const bundleArgument = process.argv[2] || '';
const requestedOutputPath = process.argv[3] || '';
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

function run(command, args, timeout = 15000) {
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

function inspectCodeObject(label, target, relativeBinaryPath = null) {
  const executableName = relativeBinaryPath
    ? null
    : readPlistValue(path.join(target, 'Contents', 'Info.plist'), 'CFBundleExecutable');
  const binaryPath = relativeBinaryPath
    ? path.join(target, relativeBinaryPath)
    : executableName ? path.join(target, 'Contents', 'MacOS', executableName) : null;
  let executableSha256 = null;
  try { if (binaryPath) executableSha256 = sha256File(binaryPath); } catch {}
  const display = run('/usr/bin/codesign', ['-dv', '--verbose=4', target]);
  const verify = run('/usr/bin/codesign', ['--verify', '--deep', '--strict', target]);
  const entitlements = classifyEntitlements(run('/usr/bin/codesign', ['-d', '--entitlements', ':-', target]));
  return {
    label,
    teamIdentifierDiagnosticForInternalCheck: `${display.stdout}\n${display.stderr}`,
    executableSha256,
    codeSign: classifyCodeSign({
      ...display,
      verificationSucceeded: verify.status === 0 && !verify.errorCode,
      entitlementsCommandSucceeded: entitlements.commandSucceeded,
      entitlementsPresent: entitlements.present,
    }),
    verification: {
      succeeded: verify.status === 0 && !verify.errorCode,
      status: verify.status,
      errorCode: verify.errorCode,
    },
    entitlements,
  };
}

function sourceRevision() {
  const head = run('/usr/bin/git', ['rev-parse', 'HEAD']);
  const status = run('/usr/bin/git', ['status', '--porcelain']);
  return {
    gitHead: head.status === 0 && /^[a-f0-9]{40}$/.test(head.stdout.trim()) ? head.stdout.trim() : null,
    workingTreeDirty: status.status === 0 && status.stdout.length > 0,
    auditScriptSha256: sha256File(scriptPath),
    verificationModuleSha256: sha256File(path.join(appDir, 'lib/macos-signed-canary-verification.mjs')),
    signingReadinessScriptSha256: sha256File(path.join(appDir, 'scripts/audit-macos-signing-readiness.mjs')),
    signedBuildConfigModuleSha256: sha256File(path.join(appDir, 'lib/macos-signed-canary-build-config.mjs')),
    signedCanaryBuilderConfigSha256: sha256File(path.join(appDir, 'electron-builder.signed-canary.mjs')),
    packageJsonSha256: sha256File(path.join(appDir, 'package.json')),
    packageLockSha256: sha256File(path.join(appDir, 'package-lock.json')),
  };
}

function hasExactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function isSafeVersion(value) {
  return typeof value === 'string' && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value);
}

function isIsoTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

export function validateEvidence(evidence) {
  const topLevelKeys = ['schema', 'startedAt', 'completedAt', 'environment', 'candidate', 'sourceBuildConfig', 'helperInventory', 'objects', 'stapler', 'gatekeeper', 'summary', 'sourceRevision', 'scope', 'status', 'interpretation'];
  const environmentKeys = ['platform', 'arch', 'node', 'osRelease'];
  const candidateKeys = ['metadataValid', 'executableSha256', 'frameworkSha256'];
  const sourceConfigKeys = ['identityConfiguration', 'hardenedRuntimeConfigured', 'gatekeeperAssessConfigured', 'entitlementsConfigured', 'macTargetConfigured', 'sourceConfigReady'];
  const helperKeys = ['complete', 'expectedHelperCount', 'actualHelperCount', 'missingHelperCount', 'unexpectedHelperCount'];
  const stapleKeys = ['commandSucceeded', 'recognizedSuccess', 'status', 'diagnosticSha256', 'diagnosticBytes'];
  const gatekeeperKeys = ['commandSucceeded', 'recognizedRejection', 'recognizedSuccess', 'status', 'diagnosticSha256', 'diagnosticBytes'];
  const summaryKeys = ['ready', 'reasons', 'sourceReady', 'candidateMetadataValid', 'sourceProvenanceReady', 'inventoryReady', 'objectSetReady', 'objectsReady', 'teamIdentifiersConsistent', 'notarizationReady'];
  const revisionKeys = ['gitHead', 'workingTreeDirty', 'auditScriptSha256', 'verificationModuleSha256', 'signingReadinessScriptSha256', 'signedBuildConfigModuleSha256', 'signedCanaryBuilderConfigSha256', 'packageJsonSha256', 'packageLockSha256'];
  const scopeKeys = ['candidateModified', 'signingAttempted', 'notarizationAttempted', 'keychainModified', 'packagedAppExecuted', 'uiFlowRun', 'networkConnectionsAttempted', 'rawCommandOutputPersisted', 'absolutePathsPersisted', 'identityNamesPersisted', 'identityHashesPersisted', 'entitlementsPersisted', 'secretsPersisted'];
  const codeSignKeys = ['commandSucceeded', 'developerIdApplicationPresent', 'teamIdentifierPresent', 'runtimeFlagObserved', 'adHocFlagObserved', 'flagsObserved', 'diagnosticSha256', 'diagnosticBytes', 'verificationSucceeded', 'entitlementsCommandSucceeded', 'entitlementsPresent'];
  const verificationKeys = ['succeeded', 'status', 'errorCode'];
  const entitlementKeys = ['commandSucceeded', 'present', 'diagnosticSha256', 'diagnosticBytes'];

  if (!hasExactKeys(evidence, topLevelKeys) || evidence.schema !== 'offline-subtitle-factory.macos-signed-canary-result-audit.v1'
    || !isIsoTimestamp(evidence.startedAt) || !isIsoTimestamp(evidence.completedAt)
    || typeof evidence.interpretation !== 'string' || evidence.interpretation.length === 0) fail('SIGNED_RESULT_EVIDENCE_SCHEMA_INVALID');
  if (!hasExactKeys(evidence.environment, environmentKeys)
    || evidence.environment.platform !== 'darwin'
    || evidence.environment.arch !== 'arm64'
    || Object.values(evidence.environment).some((value) => typeof value !== 'string')) fail('SIGNED_RESULT_ENVIRONMENT_SCHEMA_INVALID');
  if (!hasExactKeys(evidence.candidate, candidateKeys)
    || typeof evidence.candidate.metadataValid !== 'boolean'
    || !isSha256(evidence.candidate.executableSha256)
    || !isSha256(evidence.candidate.frameworkSha256)) fail('SIGNED_RESULT_CANDIDATE_SCHEMA_INVALID');
  if (!hasExactKeys(evidence.sourceBuildConfig, sourceConfigKeys)
    || !['auto-discovery', 'explicit-string'].includes(evidence.sourceBuildConfig.identityConfiguration)
    || typeof evidence.sourceBuildConfig.hardenedRuntimeConfigured !== 'boolean'
    || typeof evidence.sourceBuildConfig.gatekeeperAssessConfigured !== 'boolean'
    || typeof evidence.sourceBuildConfig.entitlementsConfigured !== 'boolean'
    || typeof evidence.sourceBuildConfig.macTargetConfigured !== 'boolean'
    || typeof evidence.sourceBuildConfig.sourceConfigReady !== 'boolean'
    || evidence.sourceBuildConfig.sourceConfigReady !== (evidence.sourceBuildConfig.hardenedRuntimeConfigured
      && evidence.sourceBuildConfig.gatekeeperAssessConfigured
      && evidence.sourceBuildConfig.macTargetConfigured)) fail('SIGNED_RESULT_SOURCE_CONFIG_SCHEMA_INVALID');
  if (!hasExactKeys(evidence.helperInventory, helperKeys)
    || evidence.helperInventory.expectedHelperCount !== expectedHelperBundleNames.length
    || typeof evidence.helperInventory.complete !== 'boolean'
    || !['actualHelperCount', 'missingHelperCount', 'unexpectedHelperCount'].every((key) => Number.isInteger(evidence.helperInventory[key]) && evidence.helperInventory[key] >= 0)
    || evidence.helperInventory.missingHelperCount > evidence.helperInventory.expectedHelperCount
    || evidence.helperInventory.actualHelperCount !== evidence.helperInventory.expectedHelperCount - evidence.helperInventory.missingHelperCount + evidence.helperInventory.unexpectedHelperCount
    || evidence.helperInventory.complete !== (evidence.helperInventory.missingHelperCount === 0 && evidence.helperInventory.unexpectedHelperCount === 0)) fail('SIGNED_RESULT_HELPER_SCHEMA_INVALID');
  if (!Array.isArray(evidence.objects) || evidence.objects.length !== expectedCodeObjectLabels.length) fail('SIGNED_RESULT_OBJECT_COUNT_INVALID');
  evidence.objects.forEach((object, index) => {
    if (!hasExactKeys(object, ['label', 'executableSha256', 'codeSign', 'verification', 'entitlements'])
      || object.label !== expectedCodeObjectLabels[index]
      || (object.executableSha256 !== null && !isSha256(object.executableSha256))
      || !hasExactKeys(object.codeSign, codeSignKeys)
      || !hasExactKeys(object.verification, verificationKeys)
      || !hasExactKeys(object.entitlements, entitlementKeys)
      || !isSha256(object.codeSign.diagnosticSha256)
      || !isSha256(object.entitlements.diagnosticSha256)
      || !Number.isInteger(object.codeSign.diagnosticBytes) || object.codeSign.diagnosticBytes < 0
      || !Number.isInteger(object.entitlements.diagnosticBytes) || object.entitlements.diagnosticBytes < 0
      || typeof object.codeSign.commandSucceeded !== 'boolean'
      || typeof object.codeSign.developerIdApplicationPresent !== 'boolean'
      || typeof object.codeSign.teamIdentifierPresent !== 'boolean'
      || typeof object.codeSign.runtimeFlagObserved !== 'boolean'
      || typeof object.codeSign.adHocFlagObserved !== 'boolean'
      || typeof object.codeSign.flagsObserved !== 'boolean'
      || typeof object.codeSign.verificationSucceeded !== 'boolean'
      || typeof object.codeSign.entitlementsCommandSucceeded !== 'boolean'
      || typeof object.codeSign.entitlementsPresent !== 'boolean'
      || object.codeSign.verificationSucceeded !== object.verification.succeeded
      || object.codeSign.entitlementsCommandSucceeded !== object.entitlements.commandSucceeded
      || object.codeSign.entitlementsPresent !== object.entitlements.present
      || typeof object.verification.succeeded !== 'boolean'
      || (object.verification.succeeded && object.verification.status !== 0)
      || (!object.verification.succeeded && object.verification.status === 0)
      || (object.verification.succeeded && object.verification.errorCode !== null)
      || (object.verification.status !== null && !Number.isInteger(object.verification.status))
      || (object.verification.errorCode !== null && typeof object.verification.errorCode !== 'string')
      || typeof object.entitlements.commandSucceeded !== 'boolean'
      || typeof object.entitlements.present !== 'boolean') fail('SIGNED_RESULT_OBJECT_SCHEMA_INVALID');
  });
  if (!hasExactKeys(evidence.stapler, stapleKeys) || !['valid', 'invalid'].includes(evidence.stapler.status) || !isSha256(evidence.stapler.diagnosticSha256)
    || Object.values(evidence.stapler).some((value, fieldIndex) => fieldIndex < 2 && typeof value !== 'boolean')
    || !Number.isInteger(evidence.stapler.diagnosticBytes) || evidence.stapler.diagnosticBytes < 0
    || (evidence.stapler.recognizedSuccess && !evidence.stapler.commandSucceeded)
    || evidence.stapler.status !== (evidence.stapler.commandSucceeded && evidence.stapler.recognizedSuccess ? 'valid' : 'invalid')) fail('SIGNED_RESULT_STAPLER_SCHEMA_INVALID');
  if (!hasExactKeys(evidence.gatekeeper, gatekeeperKeys) || !['accepted', 'rejected'].includes(evidence.gatekeeper.status) || !isSha256(evidence.gatekeeper.diagnosticSha256)
    || typeof evidence.gatekeeper.commandSucceeded !== 'boolean'
    || typeof evidence.gatekeeper.recognizedRejection !== 'boolean'
    || typeof evidence.gatekeeper.recognizedSuccess !== 'boolean'
    || !Number.isInteger(evidence.gatekeeper.diagnosticBytes) || evidence.gatekeeper.diagnosticBytes < 0
    || (evidence.gatekeeper.recognizedSuccess && (!evidence.gatekeeper.commandSucceeded || evidence.gatekeeper.recognizedRejection))
    || evidence.gatekeeper.status !== (evidence.gatekeeper.commandSucceeded && !evidence.gatekeeper.recognizedRejection && evidence.gatekeeper.recognizedSuccess ? 'accepted' : 'rejected')) fail('SIGNED_RESULT_GATEKEEPER_SCHEMA_INVALID');
  if (!hasExactKeys(evidence.summary, summaryKeys) || !Array.isArray(evidence.summary.reasons) || !evidence.summary.reasons.every((value) => typeof value === 'string')
    || Object.entries(evidence.summary).filter(([key]) => key !== 'reasons').some(([, value]) => typeof value !== 'boolean')) fail('SIGNED_RESULT_SUMMARY_INVALID');
  const expectedSourceReady = evidence.sourceBuildConfig.sourceConfigReady;
  const expectedCandidateMetadataValid = evidence.candidate.metadataValid;
  const expectedSourceProvenanceReady = Boolean(evidence.sourceRevision?.gitHead) && evidence.sourceRevision.workingTreeDirty === false;
  const expectedInventoryReady = evidence.helperInventory.complete
    && evidence.helperInventory.missingHelperCount === 0
    && evidence.helperInventory.unexpectedHelperCount === 0
    && evidence.helperInventory.actualHelperCount === evidence.helperInventory.expectedHelperCount;
  const expectedObjectSetReady = evidence.objects.every((object, index) => object.label === expectedCodeObjectLabels[index]);
  const expectedObjectsReady = expectedObjectSetReady && evidence.objects.every((object) => object.codeSign.commandSucceeded
    && object.codeSign.verificationSucceeded && object.codeSign.developerIdApplicationPresent
    && object.codeSign.teamIdentifierPresent && object.codeSign.runtimeFlagObserved
    && !object.codeSign.adHocFlagObserved && object.codeSign.entitlementsCommandSucceeded && object.codeSign.entitlementsPresent);
  const expectedNotarizationReady = evidence.stapler.status === 'valid' && evidence.stapler.recognizedSuccess
    && evidence.gatekeeper.status === 'accepted' && evidence.gatekeeper.recognizedSuccess && !evidence.gatekeeper.recognizedRejection;
  const expectedReasons = [];
  if (!expectedSourceReady) expectedReasons.push('source-config-not-ready');
  if (!expectedCandidateMetadataValid) expectedReasons.push('candidate-metadata-not-ready');
  if (!expectedSourceProvenanceReady) expectedReasons.push('source-provenance-not-ready');
  if (!expectedInventoryReady) expectedReasons.push('helper-inventory-not-ready');
  if (!expectedObjectSetReady) expectedReasons.push('code-object-inventory-not-ready');
  if (!expectedObjectsReady) expectedReasons.push('code-object-signature-not-ready');
  if (!evidence.summary.teamIdentifiersConsistent) expectedReasons.push('team-identity-not-ready');
  if (!expectedNotarizationReady) expectedReasons.push('notarization-or-gatekeeper-not-ready');
  if (JSON.stringify(evidence.summary.reasons) !== JSON.stringify(expectedReasons)
    || evidence.summary.sourceReady !== expectedSourceReady
    || evidence.summary.candidateMetadataValid !== expectedCandidateMetadataValid
    || evidence.summary.sourceProvenanceReady !== expectedSourceProvenanceReady
    || evidence.summary.inventoryReady !== expectedInventoryReady
    || evidence.summary.objectSetReady !== expectedObjectSetReady
    || evidence.summary.objectsReady !== expectedObjectsReady
    || evidence.summary.notarizationReady !== expectedNotarizationReady
    || evidence.summary.ready !== (expectedReasons.length === 0)
    || evidence.status !== (evidence.summary.ready ? 'pass' : 'fail')) fail('SIGNED_RESULT_SUMMARY_STATUS_MISMATCH');
  if (!hasExactKeys(evidence.sourceRevision, revisionKeys)
    || (evidence.sourceRevision.gitHead !== null && !/^[a-f0-9]{40}$/.test(evidence.sourceRevision.gitHead))
    || typeof evidence.sourceRevision.workingTreeDirty !== 'boolean'
    || !revisionKeys.slice(2).every((key) => isSha256(evidence.sourceRevision[key]))) fail('SIGNED_RESULT_PROVENANCE_INVALID');
  if (!hasExactKeys(evidence.scope, scopeKeys) || Object.values(evidence.scope).some((value) => value !== false)) fail('SIGNED_RESULT_SCOPE_NOT_FAIL_CLOSED');
  if (/(?:^|[\s"'=:(\[,])\/(?:[^\s"'`]+(?:\/[^\s"`]+)*)|[A-Za-z]:[\\/]|\\\\|sk-[A-Za-z0-9]|-----BEGIN/i.test(JSON.stringify(evidence))) fail('SIGNED_RESULT_LEAKAGE_DETECTED');
}

function main() {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') fail('MACOS_ARM64_REQUIRED');
  if (!bundleArgument || !requestedOutputPath) fail('BUNDLE_AND_EVIDENCE_REQUIRED');
  const bundlePath = path.resolve(bundleArgument);
  const outputPath = path.resolve(requestedOutputPath);
  if (!outputPath.startsWith(`${evidenceDir}${path.sep}`) || path.extname(outputPath) !== '.json') fail('EVIDENCE_PATH_INVALID');
  if (fs.existsSync(outputPath)) fail('EVIDENCE_ALREADY_EXISTS');
  if (!bundlePath.endsWith('.app') || !fs.statSync(bundlePath).isDirectory()) fail('APP_BUNDLE_INVALID');

  const sourceBuildConfig = summarizeSourceBuildConfig(loadSignedCanaryBuildConfig(appDir).mac || {});
  const frameworkRoot = path.join(bundlePath, 'Contents', 'Frameworks');
  const frameworkPath = path.join(frameworkRoot, 'Electron Framework.framework');
  const frameworkBinary = path.join(frameworkPath, 'Versions', 'A', 'Electron Framework');
  const frameworkAppEntries = fs.readdirSync(frameworkRoot).filter((name) => name.endsWith('.app')).sort();
  const missingHelperBundleNames = expectedHelperBundleNames.filter((name) => !frameworkAppEntries.includes(name));
  const unexpectedHelperBundleNames = frameworkAppEntries.filter((name) => !expectedHelperBundleNames.includes(name));
  const infoPlistPath = path.join(bundlePath, 'Contents', 'Info.plist');
  const executableName = readPlistValue(infoPlistPath, 'CFBundleExecutable');
  const bundleVersion = readPlistValue(infoPlistPath, 'CFBundleShortVersionString');
  const candidateMetadataValid = isSafeVersion(bundleVersion);
  const objects = [
    inspectCodeObject('main-app', bundlePath, path.join('Contents', 'MacOS', executableName)),
    inspectCodeObject('electron-framework', frameworkPath, path.join('Versions', 'A', 'Electron Framework')),
    ...expectedHelperBundleNames.filter((name) => frameworkAppEntries.includes(name))
      .map((name) => inspectCodeObject(`helper:${name}`, path.join(frameworkRoot, name))),
  ];
  const teamIdentifierDiagnostics = objects.map((object) => object.teamIdentifierDiagnosticForInternalCheck);
  const sourceRevisionSummary = sourceRevision();
  const sourceProvenanceReady = Boolean(sourceRevisionSummary.gitHead)
    && sourceRevisionSummary.workingTreeDirty === false;
  const stapler = classifyStapler(run('/usr/bin/xcrun', ['stapler', 'validate', bundlePath]));
  const gatekeeper = classifyGatekeeper(run('/usr/sbin/spctl', ['--assess', '--type', 'execute', '--verbose=4', bundlePath]));
  const evaluation = evaluateSignedCanaryVerification({
    sourceBuildConfig,
    helperInventory: {
      complete: missingHelperBundleNames.length === 0 && unexpectedHelperBundleNames.length === 0,
      frameworkAppEntries,
      missingHelperBundleNames,
      unexpectedHelperBundleNames,
    },
    objects,
    stapler,
    gatekeeper,
    teamIdentifierDiagnostics,
    candidateMetadataValid,
    sourceProvenanceReady,
  });
  for (const object of objects) delete object.teamIdentifierDiagnosticForInternalCheck;
  const evidence = {
    schema: 'offline-subtitle-factory.macos-signed-canary-result-audit.v1',
    startedAt,
    completedAt: new Date().toISOString(),
    environment: { platform: process.platform, arch: process.arch, node: process.version, osRelease: os.release() },
    candidate: {
      metadataValid: candidateMetadataValid,
      executableSha256: sha256File(path.join(bundlePath, 'Contents', 'MacOS', executableName)),
      frameworkSha256: sha256File(frameworkBinary),
    },
    sourceBuildConfig,
    helperInventory: {
      complete: missingHelperBundleNames.length === 0 && unexpectedHelperBundleNames.length === 0,
      expectedHelperCount: expectedHelperBundleNames.length,
      actualHelperCount: frameworkAppEntries.length,
      missingHelperCount: missingHelperBundleNames.length,
      unexpectedHelperCount: unexpectedHelperBundleNames.length,
    },
    objects,
    stapler,
    gatekeeper,
    summary: evaluation,
    sourceRevision: sourceRevisionSummary,
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
    status: evaluation.ready ? 'pass' : 'fail',
    interpretation: 'This is a read-only post-build verification contract. It requires every expected code object to be Developer ID signed with hardened runtime, effective entitlements inspection, a valid notarization staple, and Gatekeeper acceptance. It does not establish renderer readiness, UI offline acceptance, whole-machine egress control, Windows support, or FR-021 completion.',
  };
  validateEvidence(evidence);
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(`macOS signed canary result audit ${evidence.status}: ${path.basename(outputPath)}`);
  if (!evaluation.ready) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
