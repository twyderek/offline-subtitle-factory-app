import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectFormalSignedCanaryReadiness, evaluateFormalSignedCanaryReadiness } from './assert-macos-signed-canary-ready.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const appDir = path.resolve(path.dirname(scriptPath), '..');
const evidenceDir = path.join(appDir, 'docs/project-management/evidence');
const scopeKeys = [
  'runtimeManifestStarted',
  'builderStarted',
  'candidateCreated',
  'signingAttempted',
  'notarizationAttempted',
  'keychainModified',
  'networkConnectionsAttempted',
  'packagedAppExecuted',
  'uiFlowRun',
  'existingOllamaDaemonStartedOrStopped',
  'modelDownloaded',
  'rawCommandOutputPersisted',
  'absolutePathsPersisted',
  'identityNamesPersisted',
  'identityHashesPersisted',
  'secretsPersisted',
];
const executionKeys = ['runtimeManifestStarted', 'builderStarted', 'candidateCreated'];
const credentialPresenceKeys = [
  'CSC_NAME',
  'CSC_LINK',
  'CSC_KEY_PASSWORD',
  'APPLE_ID',
  'APPLE_APP_SPECIFIC_PASSWORD',
  'APPLE_TEAM_ID',
  'APPLE_API_KEY',
  'APPLE_API_KEY_ID',
  'APPLE_API_ISSUER',
  'APPLE_KEYCHAIN',
  'APPLE_KEYCHAIN_PROFILE',
];

function fail(message) {
  throw new Error(message);
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function safeScope() {
  return Object.fromEntries(scopeKeys.map((key) => [key, false]));
}

function safeIdentity(identity) {
  if (!identity) return null;
  return {
    commandSucceeded: identity.commandSucceeded,
    probeReady: identity.probeReady,
    probeStatus: identity.probeStatus,
    validIdentityCount: identity.validIdentityCount,
    developerIdApplicationPresent: identity.developerIdApplicationPresent,
    formalIdentityAvailable: identity.formalIdentityAvailable,
  };
}

function safeToolchain(toolchain) {
  if (!toolchain) return null;
  return {
    codesignPresent: toolchain.codesign.executablePresent,
    xcrunPresent: toolchain.xcrun.executablePresent,
    xcrunCodesignAvailable: toolchain.xcrunCodesign.commandSucceeded,
    xcrunNotarytoolAvailable: toolchain.xcrunNotarytool.commandSucceeded,
  };
}

function hasExactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function isIsoTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function validateEvidence(evidence) {
  const topLevelKeys = [
    'schema', 'startedAt', 'completedAt', 'environment', 'command', 'gate', 'sourceConfig', 'identity',
    'toolchain', 'credentialPresence', 'notarization', 'execution', 'scope', 'sourceRevision', 'interpretation',
  ];
  if (!hasExactKeys(evidence, topLevelKeys) || evidence.schema !== 'offline-subtitle-factory.macos-signed-canary-gate-execution.v1') fail('GATE_EVIDENCE_SCHEMA_INVALID');
  if (!isIsoTimestamp(evidence.startedAt) || !isIsoTimestamp(evidence.completedAt) || Date.parse(evidence.completedAt) < Date.parse(evidence.startedAt)) fail('GATE_EVIDENCE_TIMESTAMP_INVALID');
  if (!hasExactKeys(evidence.environment, ['platform', 'arch', 'osRelease', 'node'])
    || evidence.environment.platform !== 'darwin'
    || evidence.environment.arch !== 'arm64'
    || typeof evidence.environment.osRelease !== 'string'
    || typeof evidence.environment.node !== 'string') fail('GATE_EVIDENCE_ENVIRONMENT_INVALID');
  if (evidence.command !== 'electron:build:mac:signed-canary') fail('GATE_EVIDENCE_COMMAND_INVALID');
  const gateKeys = ['ready', 'reasons', 'sourceConfigReady', 'requiredToolchainReady', 'identityReady', 'notarizationReady', 'notarizationStatus', 'notarizationConsistent'];
  if (!hasExactKeys(evidence.gate, gateKeys)
    || typeof evidence.gate.ready !== 'boolean'
    || !Array.isArray(evidence.gate.reasons)
    || !evidence.gate.reasons.every((value) => typeof value === 'string')
    || evidence.gate.ready !== (evidence.gate.reasons.length === 0)
    || !['absent', 'partial', 'complete', 'ambiguous'].includes(evidence.gate.notarizationStatus)
    || !['sourceConfigReady', 'requiredToolchainReady', 'identityReady', 'notarizationReady', 'notarizationConsistent'].every((key) => typeof evidence.gate[key] === 'boolean')) fail('GATE_EVIDENCE_RESULT_INVALID');
  if (!hasExactKeys(evidence.sourceConfig, ['identityConfiguration', 'hardenedRuntimeConfigured', 'gatekeeperAssessConfigured', 'entitlementsConfigured', 'macTargetConfigured', 'sourceConfigReady'])
    || typeof evidence.sourceConfig.sourceConfigReady !== 'boolean'
    || !['hardenedRuntimeConfigured', 'gatekeeperAssessConfigured', 'entitlementsConfigured', 'macTargetConfigured'].every((key) => typeof evidence.sourceConfig[key] === 'boolean')) fail('GATE_EVIDENCE_SOURCE_CONFIG_INVALID');
  if (!hasExactKeys(evidence.identity, ['commandSucceeded', 'probeReady', 'probeStatus', 'validIdentityCount', 'developerIdApplicationPresent', 'formalIdentityAvailable'])
    || !['commandSucceeded', 'probeReady', 'developerIdApplicationPresent', 'formalIdentityAvailable'].every((key) => typeof evidence.identity[key] === 'boolean')
    || !['command-failed', 'malformed-output', 'ok'].includes(evidence.identity.probeStatus)
    || !(evidence.identity.validIdentityCount === null || (Number.isInteger(evidence.identity.validIdentityCount) && evidence.identity.validIdentityCount >= 0))) fail('GATE_EVIDENCE_IDENTITY_INVALID');
  if (!hasExactKeys(evidence.toolchain, ['codesignPresent', 'xcrunPresent', 'xcrunCodesignAvailable', 'xcrunNotarytoolAvailable'])
    || !Object.values(evidence.toolchain).every((value) => typeof value === 'boolean')) fail('GATE_EVIDENCE_TOOLCHAIN_INVALID');
  if (!hasExactKeys(evidence.credentialPresence, credentialPresenceKeys) || !Object.values(evidence.credentialPresence).every((value) => typeof value === 'boolean')) fail('GATE_EVIDENCE_CREDENTIALS_INVALID');
  if (!hasExactKeys(evidence.notarization, ['appleIdSetComplete', 'apiKeySetComplete', 'keychainProfileSetComplete', 'completeSetCount', 'partialCredentialSetDetected', 'status', 'ready'])
    || !['appleIdSetComplete', 'apiKeySetComplete', 'keychainProfileSetComplete', 'partialCredentialSetDetected', 'ready'].every((key) => typeof evidence.notarization[key] === 'boolean')
    || !Number.isInteger(evidence.notarization.completeSetCount)
    || !['absent', 'partial', 'complete', 'ambiguous'].includes(evidence.notarization.status)) fail('GATE_EVIDENCE_NOTARIZATION_INVALID');
  const expectedEvaluation = evaluateFormalSignedCanaryReadiness({
    platform: evidence.environment.platform,
    arch: evidence.environment.arch,
    sourceConfig: evidence.sourceConfig,
    identity: evidence.identity,
    toolchain: {
      codesign: { executablePresent: evidence.toolchain.codesignPresent },
      xcrun: { executablePresent: evidence.toolchain.xcrunPresent },
      xcrunCodesign: { commandSucceeded: evidence.toolchain.xcrunCodesignAvailable },
      xcrunNotarytool: { commandSucceeded: evidence.toolchain.xcrunNotarytoolAvailable },
    },
    credentialPresence: evidence.credentialPresence,
    notarization: evidence.notarization,
  });
  const actualEvaluation = evidence.gate;
  if (actualEvaluation.ready !== expectedEvaluation.ready
    || JSON.stringify(actualEvaluation.reasons) !== JSON.stringify(expectedEvaluation.reasons)
    || actualEvaluation.sourceConfigReady !== expectedEvaluation.sourceConfigReady
    || actualEvaluation.requiredToolchainReady !== expectedEvaluation.requiredToolchainReady
    || actualEvaluation.identityReady !== expectedEvaluation.identityReady
    || actualEvaluation.notarizationReady !== expectedEvaluation.notarizationReady
    || actualEvaluation.notarizationStatus !== expectedEvaluation.notarizationStatus
    || actualEvaluation.notarizationConsistent !== expectedEvaluation.notarizationConsistent) fail('GATE_EVIDENCE_DERIVED_FIELDS_INVALID');
  if (!hasExactKeys(evidence.execution, executionKeys) || Object.values(evidence.execution).some((value) => value !== false)) fail('GATE_EVIDENCE_EXECUTION_NOT_FAIL_CLOSED');
  if (!hasExactKeys(evidence.scope, scopeKeys) || Object.values(evidence.scope).some((value) => value !== false)) fail('GATE_EVIDENCE_SCOPE_NOT_FAIL_CLOSED');
  if (!hasExactKeys(evidence.sourceRevision, ['gateScriptSha256', 'packageJsonSha256', 'focusedTestSha256'])
    || !/^[a-f0-9]{64}$/.test(evidence.sourceRevision.gateScriptSha256)
    || !/^[a-f0-9]{64}$/.test(evidence.sourceRevision.packageJsonSha256)
    || !/^[a-f0-9]{64}$/.test(evidence.sourceRevision.focusedTestSha256)) fail('GATE_EVIDENCE_PROVENANCE_INVALID');
  if (typeof evidence.interpretation !== 'string' || evidence.interpretation.length === 0) fail('GATE_EVIDENCE_INTERPRETATION_INVALID');
  if (/(?:^|[\s"'=:(\[,])\/(?:[^\s"'`]+(?:\/[^\s"`]+)*)|[A-Za-z]:[\\/]|\\\\|sk-[A-Za-z0-9]|-----BEGIN/i.test(JSON.stringify(evidence))) fail('GATE_EVIDENCE_LEAKAGE_DETECTED');
  return true;
}

function main() {
  const requestedOutputPath = process.argv[2] || '';
  if (process.platform !== 'darwin' || process.arch !== 'arm64') fail('MACOS_ARM64_REQUIRED');
  if (!requestedOutputPath) fail('EVIDENCE_PATH_REQUIRED');
  const outputPath = path.resolve(requestedOutputPath);
  if (!outputPath.startsWith(`${evidenceDir}${path.sep}`) || path.extname(outputPath) !== '.json') fail('EVIDENCE_PATH_INVALID');
  if (fs.existsSync(outputPath)) fail('EVIDENCE_ALREADY_EXISTS');

  const startedAt = new Date().toISOString();
  const result = collectFormalSignedCanaryReadiness();
  const evidence = {
    schema: 'offline-subtitle-factory.macos-signed-canary-gate-execution.v1',
    startedAt,
    completedAt: new Date().toISOString(),
    environment: { platform: result.platform, arch: result.arch, osRelease: os.release(), node: process.version },
    command: 'electron:build:mac:signed-canary',
    gate: {
      ready: result.evaluation.ready,
      reasons: result.evaluation.reasons,
      sourceConfigReady: result.evaluation.sourceConfigReady,
      requiredToolchainReady: result.evaluation.requiredToolchainReady,
      identityReady: result.evaluation.identityReady,
      notarizationReady: result.evaluation.notarizationReady,
      notarizationStatus: result.evaluation.notarizationStatus,
      notarizationConsistent: result.evaluation.notarizationConsistent,
    },
    sourceConfig: result.sourceConfig,
    identity: safeIdentity(result.identity),
    toolchain: safeToolchain(result.toolchain),
    credentialPresence: result.credentialPresence,
    notarization: result.notarization,
    execution: { runtimeManifestStarted: false, builderStarted: false, candidateCreated: false },
    scope: safeScope(),
    sourceRevision: {
      gateScriptSha256: sha256File(scriptPath),
      packageJsonSha256: sha256File(path.join(appDir, 'package.json')),
      focusedTestSha256: sha256File(path.join(appDir, 'scripts/test-macos-signed-canary-gate.mjs')),
    },
    interpretation: 'This immutable record captures only the read-only gate decision before runtime manifest and electron-builder. A blocked result is an external signing prerequisite, not a signed package, notarization, renderer acceptance, or FR-021 completion.',
  };
  validateEvidence(evidence);
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(`macOS signed canary gate evidence ${result.evaluation.reasons.join(',')}: ${path.basename(outputPath)}`);
}

export { validateEvidence };

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
