import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectFormalSignedCanaryReadiness } from './assert-macos-signed-canary-ready.mjs';

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

function validateEvidence(evidence) {
  if (evidence.schema !== 'offline-subtitle-factory.macos-signed-canary-gate-execution.v1') fail('GATE_EVIDENCE_SCHEMA_INVALID');
  if (!evidence.gate || evidence.gate.ready !== false || !Array.isArray(evidence.gate.reasons) || evidence.gate.reasons.length === 0) fail('GATE_EVIDENCE_RESULT_INVALID');
  if (!evidence.execution || Object.keys(evidence.execution).sort().join(',') !== 'builderStarted,candidateCreated,runtimeManifestStarted') fail('GATE_EVIDENCE_EXECUTION_SCHEMA_INVALID');
  if (Object.values(evidence.execution).some((value) => value !== false)) fail('GATE_EVIDENCE_EXECUTION_NOT_FAIL_CLOSED');
  if (!evidence.scope || JSON.stringify(Object.keys(evidence.scope).sort()) !== JSON.stringify([...scopeKeys].sort())) fail('GATE_EVIDENCE_SCOPE_KEYS_INVALID');
  if (Object.values(evidence.scope).some((value) => value !== false)) fail('GATE_EVIDENCE_SCOPE_NOT_FAIL_CLOSED');
  if (!evidence.sourceRevision || !/^[a-f0-9]{64}$/.test(evidence.sourceRevision.gateScriptSha256)
    || !/^[a-f0-9]{64}$/.test(evidence.sourceRevision.packageJsonSha256)
    || !/^[a-f0-9]{64}$/.test(evidence.sourceRevision.focusedTestSha256)) fail('GATE_EVIDENCE_PROVENANCE_INVALID');
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

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
