import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadSignedCanaryBuildConfig } from '../lib/macos-signed-canary-build-config.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const appDir = path.resolve(path.dirname(scriptPath), '..');
const evidenceDir = path.join(appDir, 'docs/project-management/evidence');
const startedAt = new Date().toISOString();
const allowedStatuses = new Set([
  'ready-for-isolated-signed-canary',
  'source-config-follow-up-required',
  'blocked-external-signing-identity',
  'identity-probe-unavailable',
  'existing-evidence-invalid',
  'required-toolchain-unavailable',
  'provenance-unavailable',
]);
const requiredScopeKeys = [
  'candidateModified',
  'keychainModified',
  'signingAttempted',
  'notarizationAttempted',
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
const existingEvidenceScopeKeys = [
  'candidateModified',
  'networkConnectionsAttempted',
  'packagedAppExecuted',
  'uiFlowRun',
  'existingOllamaDaemonStartedOrStopped',
  'modelDownloaded',
  'rawCommandOutputPersisted',
  'absolutePathsPersisted',
];
const allowedExistingEvidenceFiles = new Set([
  '2026-10-28-fr-021-packaged-security-identity-audit3.json',
  '2026-10-29-fr-021-adhoc-runtime-signing-canary-audit2.json',
]);
export const credentialPresenceKeys = [
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
const readinessEvidenceKeys = [
  'schema',
  'startedAt',
  'completedAt',
  'environment',
  'sourceRevision',
  'toolchain',
  'identity',
  'sourceBuildConfig',
  'credentialPresence',
  'notarization',
  'existingEvidence',
  'decision',
  'scope',
  'interpretation',
  'status',
];
const sourceRevisionKeys = [
  'gitHead',
  'provenanceScope',
  'sourceScriptSha256',
  'packageJsonSha256',
  'focusedTestSha256',
  'gitCommandSucceeded',
  'workingTreeDirty',
];
const environmentKeys = ['platform', 'arch', 'osRelease', 'node', 'macOSProductVersion', 'macOSBuildVersion'];
const identityKeys = [
  'commandSucceeded',
  'probeReady',
  'probeStatus',
  'validIdentityCount',
  'matchingIdentityCount',
  'developerIdApplicationPresent',
  'appleDevelopmentPresent',
  'appleDistributionPresent',
  'formalIdentityAvailable',
  'rawOutputPersisted',
  'identityNamesPersisted',
  'identityHashesPersisted',
];
const sourceBuildConfigKeys = [
  'identityConfiguration',
  'hardenedRuntimeConfigured',
  'gatekeeperAssessConfigured',
  'entitlementsConfigured',
  'macTargetConfigured',
  'sourceConfigReady',
];
const notarizationKeys = [
  'appleIdSetComplete',
  'apiKeySetComplete',
  'keychainProfileSetComplete',
  'completeSetCount',
  'partialCredentialSetDetected',
  'status',
  'ready',
];
const decisionKeys = [
  'toolchainReady',
  'sourceConfigReady',
  'existingEvidenceReady',
  'provenanceReady',
  'notarizationCredentialReady',
  'formalSigningReady',
  'status',
  'nextAction',
];
const existingEvidenceSummaryKeys = [
  'file',
  'exists',
  'parseable',
  'sha256',
  'bytes',
  'status',
  'allVerified',
  'allAdHoc',
  'noTeamIdentifier',
  'anyEntitlementsPresent',
  'requiredCodeSignFlag',
  'requiredCodeSignFlagSatisfied',
  'scopeKeys',
  'scopeSafe',
];

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function hasExactKeys(value, expectedKeys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expectedKeys].sort());
}

function hasExactBooleanKeys(value, expectedKeys) {
  return hasExactKeys(value, expectedKeys) && expectedKeys.every((key) => typeof value[key] === 'boolean');
}

function validNullableString(value) {
  return value === null || typeof value === 'string';
}

function validIsoTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function validateVersionSummary(value) {
  return hasExactKeys(value, ['commandSucceeded', 'reportedOnStdout', 'value'])
    && typeof value.commandSucceeded === 'boolean'
    && typeof value.reportedOnStdout === 'boolean'
    && validNullableString(value.value);
}

function validateCommandPresence(value) {
  return hasExactKeys(value, ['executablePresent']) && typeof value.executablePresent === 'boolean';
}

function validateCommandAvailability(value) {
  return hasExactKeys(value, ['commandSucceeded', 'status', 'signal', 'errorCode'])
    && typeof value.commandSucceeded === 'boolean'
    && (value.status === null || Number.isInteger(value.status))
    && validNullableString(value.signal)
    && validNullableString(value.errorCode);
}

function validateSourceRevision(value) {
  return hasExactKeys(value, sourceRevisionKeys)
    && /^[a-f0-9]{40}$/.test(value.gitHead)
    && value.provenanceScope === 'audit-script-package-json-focused-test'
    && /^[a-f0-9]{64}$/.test(value.sourceScriptSha256)
    && /^[a-f0-9]{64}$/.test(value.packageJsonSha256)
    && /^[a-f0-9]{64}$/.test(value.focusedTestSha256)
    && typeof value.gitCommandSucceeded === 'boolean'
    && typeof value.workingTreeDirty === 'boolean';
}

function validateEnvironment(value) {
  return hasExactKeys(value, environmentKeys)
    && value.platform === 'darwin'
    && value.arch === 'arm64'
    && typeof value.osRelease === 'string'
    && typeof value.node === 'string'
    && validateVersionSummary(value.macOSProductVersion)
    && validateVersionSummary(value.macOSBuildVersion);
}

function validateToolchain(value) {
  return hasExactKeys(value, ['required', 'optional'])
    && hasExactKeys(value.required, ['codesign', 'xcrun', 'xcrunCodesign'])
    && hasExactKeys(value.optional, ['productbuild', 'spctl', 'xcodeSelect', 'xcrunNotarytool'])
    && validateCommandPresence(value.required.codesign)
    && validateCommandPresence(value.required.xcrun)
    && validateCommandAvailability(value.required.xcrunCodesign)
    && validateCommandPresence(value.optional.productbuild)
    && validateCommandPresence(value.optional.spctl)
    && validateCommandAvailability(value.optional.xcodeSelect)
    && validateCommandAvailability(value.optional.xcrunNotarytool);
}

function validateIdentity(value) {
  const booleanKeys = [
    'commandSucceeded',
    'probeReady',
    'developerIdApplicationPresent',
    'appleDevelopmentPresent',
    'appleDistributionPresent',
    'formalIdentityAvailable',
    'rawOutputPersisted',
    'identityNamesPersisted',
    'identityHashesPersisted',
  ];
  return hasExactKeys(value, identityKeys)
    && booleanKeys.every((key) => typeof value[key] === 'boolean')
    && ['command-failed', 'malformed-output', 'ok'].includes(value.probeStatus)
    && (value.validIdentityCount === null || (Number.isInteger(value.validIdentityCount) && value.validIdentityCount >= 0))
    && (value.matchingIdentityCount === null || (Number.isInteger(value.matchingIdentityCount) && value.matchingIdentityCount >= 0));
}

function validateSourceBuildConfig(value) {
  const booleanKeys = [
    'hardenedRuntimeConfigured',
    'gatekeeperAssessConfigured',
    'entitlementsConfigured',
    'macTargetConfigured',
    'sourceConfigReady',
  ];
  return hasExactKeys(value, sourceBuildConfigKeys)
    && ['auto-discovery', 'explicit-null', 'explicit-adhoc', 'explicit-string', 'explicit-empty-string', 'boolean', 'object', 'number'].includes(value.identityConfiguration)
    && booleanKeys.every((key) => typeof value[key] === 'boolean');
}

function validateNotarization(value) {
  return hasExactKeys(value, notarizationKeys)
    && typeof value.appleIdSetComplete === 'boolean'
    && typeof value.apiKeySetComplete === 'boolean'
    && typeof value.keychainProfileSetComplete === 'boolean'
    && Number.isInteger(value.completeSetCount)
    && value.completeSetCount >= 0
    && value.completeSetCount <= 3
    && typeof value.partialCredentialSetDetected === 'boolean'
    && ['absent', 'partial', 'complete', 'ambiguous'].includes(value.status)
    && typeof value.ready === 'boolean';
}

function validateDecision(value) {
  const booleanKeys = [
    'toolchainReady',
    'sourceConfigReady',
    'existingEvidenceReady',
    'provenanceReady',
    'notarizationCredentialReady',
    'formalSigningReady',
  ];
  return hasExactKeys(value, decisionKeys)
    && booleanKeys.every((key) => typeof value[key] === 'boolean')
    && allowedStatuses.has(value.status)
    && typeof value.nextAction === 'string';
}

function run(command, args, { timeout = 10000, cwd = appDir, maxBuffer = 64 * 1024 } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout,
    maxBuffer,
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

function commandPresent(command) {
  try {
    fs.accessSync(command, fs.constants.X_OK);
    return { executablePresent: fs.statSync(command).isFile() };
  } catch {
    return { executablePresent: false };
  }
}

function commandAvailable(command, args) {
  const result = run(command, args);
  return {
    commandSucceeded: result.status === 0 && !result.errorCode,
    status: result.status,
    signal: result.signal,
    errorCode: result.errorCode,
  };
}

function xcrunToolAvailable(tool) {
  const result = run('/usr/bin/xcrun', ['--find', tool]);
  return {
    commandSucceeded: result.status === 0 && !result.errorCode,
    status: result.status,
    signal: result.signal,
    errorCode: result.errorCode,
  };
}

function sanitizedVersion(command, args) {
  const result = run(command, args);
  const value = result.stdout.trim();
  return {
    commandSucceeded: result.status === 0 && !result.errorCode,
    reportedOnStdout: value.length > 0,
    value: /^[A-Za-z0-9.()_ -]{1,80}$/.test(value) ? value : null,
  };
}

export function summarizeIdentityAvailability(result) {
  const text = `${result.stdout}\n${result.stderr}`;
  const validMatch = text.match(/(\d+)\s+valid identities found/);
  const matchingMatch = text.match(/(\d+)\s+matching identities/);
  const validIdentityCount = validMatch ? Number(validMatch[1]) : null;
  const matchingIdentityCount = matchingMatch ? Number(matchingMatch[1]) : validMatch ? Number(validMatch[1]) : null;
  const commandSucceeded = result.status === 0 && !result.errorCode;
  const outputShapeValid = commandSucceeded && Boolean(validMatch);
  const developerIdApplicationPresent = /Developer ID Application:/i.test(text);
  const appleDevelopmentPresent = /Apple Development:/i.test(text);
  const appleDistributionPresent = /Apple Distribution:/i.test(text);
  return {
    commandSucceeded,
    probeReady: outputShapeValid,
    probeStatus: !commandSucceeded ? 'command-failed' : !outputShapeValid ? 'malformed-output' : 'ok',
    validIdentityCount,
    matchingIdentityCount,
    developerIdApplicationPresent,
    appleDevelopmentPresent,
    appleDistributionPresent,
    formalIdentityAvailable: outputShapeValid && validIdentityCount > 0 && developerIdApplicationPresent,
    rawOutputPersisted: false,
    identityNamesPersisted: false,
    identityHashesPersisted: false,
  };
}

function safeEvidenceFileName(fileName) {
  return typeof fileName === 'string' && allowedExistingEvidenceFiles.has(fileName);
}

function safeBooleanScope(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return false;
  const keys = Object.keys(scope).sort();
  const expectedKeys = [...requiredScopeKeys].sort();
  return JSON.stringify(keys) === JSON.stringify(expectedKeys)
    && requiredScopeKeys.every((key) => scope[key] === false);
}

function safeExistingEvidenceScope(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return false;
  const keys = Object.keys(scope).sort();
  const expectedKeys = [...existingEvidenceScopeKeys].sort();
  return JSON.stringify(keys) === JSON.stringify(expectedKeys)
    && existingEvidenceScopeKeys.every((key) => scope[key] === false);
}

export function validateExistingEvidenceSummary(summary) {
  if (!hasExactKeys(summary, existingEvidenceSummaryKeys)) return false;
  if (!summary || summary.exists !== true || summary.parseable !== true || !safeEvidenceFileName(summary.file)) return false;
  if (!/^[a-f0-9]{64}$/.test(summary.sha256) || !Number.isInteger(summary.bytes) || summary.bytes < 1) return false;
  if (!['pass'].includes(summary.status)) return false;
  if (summary.allVerified !== true || summary.allAdHoc !== true || summary.noTeamIdentifier !== true) return false;
  if (summary.anyEntitlementsPresent !== false || summary.scopeSafe !== true) return false;
  if (!Array.isArray(summary.scopeKeys) || JSON.stringify([...summary.scopeKeys].sort()) !== JSON.stringify([...existingEvidenceScopeKeys].sort())) return false;
  if (summary.requiredCodeSignFlag !== null && summary.requiredCodeSignFlag !== 'runtime') return false;
  if (summary.requiredCodeSignFlag === null && summary.requiredCodeSignFlagSatisfied !== null) return false;
  if (summary.requiredCodeSignFlag === 'runtime' && summary.requiredCodeSignFlagSatisfied !== true) return false;
  if (summary.requiredCodeSignFlag === 'runtime' && typeof summary.requiredCodeSignFlagSatisfied !== 'boolean') return false;
  return true;
}

export function validateExistingEvidenceSet(entries) {
  if (!Array.isArray(entries) || entries.length !== allowedExistingEvidenceFiles.size) return false;
  const filenames = entries.map((entry) => entry?.file);
  if (new Set(filenames).size !== allowedExistingEvidenceFiles.size) return false;
  if (!filenames.every((fileName) => allowedExistingEvidenceFiles.has(fileName))) return false;
  return entries.every(validateExistingEvidenceSummary);
}

export function summarizeSourceBuildConfig(macConfig = {}) {
  const hasIdentityProperty = Object.prototype.hasOwnProperty.call(macConfig, 'identity');
  let identityConfiguration = 'auto-discovery';
  if (hasIdentityProperty && macConfig.identity === null) {
    identityConfiguration = 'explicit-null';
  } else if (hasIdentityProperty && typeof macConfig.identity === 'string') {
    const normalizedIdentity = macConfig.identity.trim();
    identityConfiguration = normalizedIdentity === '-'
      ? 'explicit-adhoc'
      : normalizedIdentity.length > 0
        ? 'explicit-string'
        : 'explicit-empty-string';
  } else if (hasIdentityProperty) {
    identityConfiguration = typeof macConfig.identity;
  }
  const identitySelectionReady = identityConfiguration === 'auto-discovery'
    || identityConfiguration === 'explicit-string';
  const macTargetConfigured = Array.isArray(macConfig.target)
    && macConfig.target.length > 0
    && macConfig.target.every((entry) => entry
      && typeof entry === 'object'
      && !Array.isArray(entry)
      && JSON.stringify(Object.keys(entry).sort()) === JSON.stringify(['arch', 'target'])
      && ['dmg', 'zip', 'dir'].includes(entry.target)
      && Array.isArray(entry.arch)
      && entry.arch.length > 0
      && entry.arch.every((arch) => arch === 'arm64'));
  return {
    identityConfiguration,
    hardenedRuntimeConfigured: macConfig.hardenedRuntime === true,
    gatekeeperAssessConfigured: macConfig.gatekeeperAssess === true,
    entitlementsConfigured: Boolean(macConfig.entitlements),
    macTargetConfigured,
    sourceConfigReady: identitySelectionReady
      && macConfig.hardenedRuntime === true
      && macConfig.gatekeeperAssess === true
      && macTargetConfigured,
  };
}

export function summarizeNotarizationCredentialState(presence = {}) {
  const appleIdAny = Boolean(presence.APPLE_ID || presence.APPLE_APP_SPECIFIC_PASSWORD || presence.APPLE_TEAM_ID);
  const appleIdSetComplete = Boolean(presence.APPLE_ID && presence.APPLE_APP_SPECIFIC_PASSWORD && presence.APPLE_TEAM_ID);
  const appleIdSetPartial = appleIdAny && !appleIdSetComplete;
  const apiKeyAny = Boolean(presence.APPLE_API_KEY || presence.APPLE_API_KEY_ID || presence.APPLE_API_ISSUER);
  const apiKeySetComplete = Boolean(presence.APPLE_API_KEY && presence.APPLE_API_KEY_ID && presence.APPLE_API_ISSUER);
  const apiKeySetPartial = apiKeyAny && !apiKeySetComplete;
  const keychainAny = Boolean(presence.APPLE_KEYCHAIN || presence.APPLE_KEYCHAIN_PROFILE);
  const keychainProfileSetComplete = Boolean(presence.APPLE_KEYCHAIN_PROFILE);
  const keychainSetPartial = keychainAny && !keychainProfileSetComplete;
  const completeSetCount = [appleIdSetComplete, apiKeySetComplete, keychainProfileSetComplete].filter(Boolean).length;
  const partialCredentialSetDetected = appleIdSetPartial || apiKeySetPartial || keychainSetPartial;
  const status = completeSetCount === 1 && !partialCredentialSetDetected
    ? 'complete'
    : completeSetCount > 0
      ? 'ambiguous'
      : partialCredentialSetDetected
        ? 'partial'
        : 'absent';
  return {
    appleIdSetComplete,
    apiKeySetComplete,
    keychainProfileSetComplete,
    completeSetCount,
    partialCredentialSetDetected,
    status,
    ready: status === 'complete',
  };
}

export function summarizeCredentialPresence(environment = process.env) {
  return Object.fromEntries(credentialPresenceKeys.map((name) => [
    name,
    typeof environment[name] === 'string' && environment[name].trim().length > 0,
  ]));
}

function summarizeExistingEvidence(fileName) {
  const filePath = path.join(evidenceDir, fileName);
  if (!fs.existsSync(filePath)) return { file: fileName, exists: false, parseable: false };
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const stats = fs.statSync(filePath);
    return {
      file: fileName,
      exists: true,
      parseable: true,
      sha256: sha256File(filePath),
      bytes: stats.size,
      status: value.status || null,
      allVerified: value.summary?.allVerified ?? null,
      allAdHoc: value.summary?.allAdHoc ?? null,
      noTeamIdentifier: value.summary?.noTeamIdentifier ?? null,
      anyEntitlementsPresent: value.summary?.anyEntitlementsPresent ?? null,
      requiredCodeSignFlag: value.summary?.requiredCodeSignFlag ?? null,
      requiredCodeSignFlagSatisfied: value.summary?.requiredCodeSignFlagSatisfied ?? null,
      scopeKeys: value.scope && typeof value.scope === 'object' ? Object.keys(value.scope).sort() : null,
      scopeSafe: safeExistingEvidenceScope(value.scope),
    };
  } catch {
    return { file: fileName, exists: true, parseable: false };
  }
}

export function classifyReadiness({ identity, toolchainReady, sourceConfigReady, existingEvidenceReady, provenanceReady }) {
  if (!provenanceReady) {
    return {
      formalSigningReady: false,
      status: 'provenance-unavailable',
      nextAction: 'Restore source and evidence provenance checks before interpreting signing readiness.',
    };
  }
  if (!identity.probeReady) {
    return {
      formalSigningReady: false,
      status: 'identity-probe-unavailable',
      nextAction: 'Repeat the read-only identity query in a supported macOS signing environment; do not infer identity absence from an unparseable result.',
    };
  }
  if (!existingEvidenceReady) {
    return {
      formalSigningReady: false,
      status: 'existing-evidence-invalid',
      nextAction: 'Stop and inspect the referenced immutable evidence; do not create a signed canary from an invalid evidence set.',
    };
  }
  if (!toolchainReady) {
    return {
      formalSigningReady: false,
      status: 'required-toolchain-unavailable',
      nextAction: 'Provide the required codesign/xcrun toolchain before creating a signed/hardened canary.',
    };
  }
  if (!identity.formalIdentityAvailable) {
    return {
      formalSigningReady: false,
      status: 'blocked-external-signing-identity',
      nextAction: 'Obtain an approved Developer ID Application identity and entitlements in an external signing environment before creating another signed/hardened canary.',
    };
  }
  if (!sourceConfigReady) {
    return {
      formalSigningReady: false,
      status: 'source-config-follow-up-required',
      nextAction: 'Prepare a separately reviewed formal signing configuration before creating the signed/hardened canary.',
    };
  }
  return {
    formalSigningReady: true,
    status: 'ready-for-isolated-signed-canary',
    nextAction: 'Create a separate isolated signed/hardened packaging canary with new immutable audit and startup evidence.',
  };
}

function requiredToolchainReady(toolchain) {
  return toolchain?.required?.codesign?.executablePresent === true
    && toolchain?.required?.xcrun?.executablePresent === true
    && toolchain?.required?.xcrunCodesign?.commandSucceeded === true;
}

function provenanceReady(sourceRevision) {
  return sourceRevision?.gitCommandSucceeded === true
    && /^[a-f0-9]{40}$/.test(sourceRevision?.gitHead || '')
    && /^[a-f0-9]{64}$/.test(sourceRevision?.sourceScriptSha256 || '')
    && /^[a-f0-9]{64}$/.test(sourceRevision?.packageJsonSha256 || '')
    && /^[a-f0-9]{64}$/.test(sourceRevision?.focusedTestSha256 || '');
}

function validateDerivedReadinessFields(evidence) {
  const identity = evidence.identity;
  const validIdentityCount = identity.validIdentityCount;
  const matchingIdentityCount = identity.matchingIdentityCount;
  if (validIdentityCount !== null && matchingIdentityCount !== null && matchingIdentityCount > validIdentityCount) return false;
  const expectedFormalIdentityAvailable = identity.commandSucceeded === true
    && identity.probeReady === true
    && Number.isInteger(validIdentityCount)
    && validIdentityCount > 0
    && identity.developerIdApplicationPresent === true;
  if (identity.formalIdentityAvailable !== expectedFormalIdentityAvailable) return false;

  const expectedToolchainReady = requiredToolchainReady(evidence.toolchain);
  const expectedSourceConfigReady = evidence.sourceBuildConfig.sourceConfigReady === true;
  const expectedExistingEvidenceReady = validateExistingEvidenceSet(evidence.existingEvidence);
  const expectedProvenanceReady = provenanceReady(evidence.sourceRevision);
  if (evidence.decision.toolchainReady !== expectedToolchainReady
    || evidence.decision.sourceConfigReady !== expectedSourceConfigReady
    || evidence.decision.existingEvidenceReady !== expectedExistingEvidenceReady
    || evidence.decision.provenanceReady !== expectedProvenanceReady) return false;

  const expectedDecision = classifyReadiness({
    identity,
    toolchainReady: expectedToolchainReady,
    sourceConfigReady: expectedSourceConfigReady,
    existingEvidenceReady: expectedExistingEvidenceReady,
    provenanceReady: expectedProvenanceReady,
  });
  return evidence.decision.formalSigningReady === expectedDecision.formalSigningReady
    && evidence.decision.status === expectedDecision.status
    && evidence.decision.nextAction === expectedDecision.nextAction;
}

export function validateReadinessEvidence(evidence) {
  if (!hasExactKeys(evidence, readinessEvidenceKeys)) fail('READINESS_SCHEMA_KEYS_INVALID');
  if (!evidence || evidence.schema !== 'offline-subtitle-factory.macos-signing-readiness-audit.v1') fail('READINESS_SCHEMA_INVALID');
  if (!validIsoTimestamp(evidence.startedAt) || !validIsoTimestamp(evidence.completedAt) || Date.parse(evidence.completedAt) < Date.parse(evidence.startedAt)) fail('READINESS_TIMESTAMP_INVALID');
  if (!allowedStatuses.has(evidence.status) || evidence.status !== evidence.decision?.status) fail('READINESS_STATUS_INVALID');
  if (!validateSourceRevision(evidence.sourceRevision)) fail('SOURCE_REVISION_SCHEMA_INVALID');
  if (!validateEnvironment(evidence.environment)) fail('ENVIRONMENT_SCHEMA_INVALID');
  if (!validateIdentity(evidence.identity)) fail('IDENTITY_SCHEMA_INVALID');
  if (!validateSourceBuildConfig(evidence.sourceBuildConfig)) fail('SOURCE_CONFIG_SCHEMA_INVALID');
  if (!validateNotarization(evidence.notarization)) fail('NOTARIZATION_SCHEMA_INVALID');
  if (!validateDecision(evidence.decision)) fail('DECISION_SCHEMA_KEYS_INVALID');
  if (!evidence.sourceRevision || !/^[a-f0-9]{64}$/.test(evidence.sourceRevision.sourceScriptSha256)) fail('SOURCE_SCRIPT_PROVENANCE_INVALID');
  if (!/^[a-f0-9]{64}$/.test(evidence.sourceRevision.packageJsonSha256)) fail('PACKAGE_PROVENANCE_INVALID');
  if (evidence.sourceRevision.provenanceScope !== undefined
    && evidence.sourceRevision.provenanceScope !== 'audit-script-package-json-focused-test') fail('PROVENANCE_SCOPE_INVALID');
  if (evidence.sourceRevision.focusedTestSha256 !== undefined
    && !/^[a-f0-9]{64}$/.test(evidence.sourceRevision.focusedTestSha256)) fail('FOCUSED_TEST_PROVENANCE_INVALID');
  if (!/^[a-f0-9]{40}$/.test(evidence.sourceRevision.gitHead)) fail('GIT_PROVENANCE_INVALID');
  if (typeof evidence.sourceRevision.workingTreeDirty !== 'boolean') fail('WORKTREE_PROVENANCE_INVALID');
  if (!evidence.environment || evidence.environment.platform !== 'darwin' || evidence.environment.arch !== 'arm64') fail('ENVIRONMENT_INVALID');
  if (!evidence.identity || evidence.identity.probeReady !== true || evidence.identity.commandSucceeded !== true) fail('IDENTITY_PROBE_NOT_READY');
  if (evidence.identity.validIdentityCount === null || !Number.isInteger(evidence.identity.validIdentityCount) || evidence.identity.validIdentityCount < 0) fail('IDENTITY_COUNT_INVALID');
  for (const key of ['rawOutputPersisted', 'identityNamesPersisted', 'identityHashesPersisted']) {
    if (evidence.identity[key] !== false) fail(`IDENTITY_PRIVACY_${key.toUpperCase()}`);
  }
  if (!validateToolchain(evidence.toolchain)) fail('TOOLCHAIN_CONTRACT_INVALID');
  if (typeof evidence.decision?.toolchainReady !== 'boolean' || typeof evidence.decision?.sourceConfigReady !== 'boolean' || typeof evidence.decision?.formalSigningReady !== 'boolean') fail('DECISION_CONTRACT_INVALID');
  if (evidence.decision.notarizationCredentialReady !== undefined && typeof evidence.decision.notarizationCredentialReady !== 'boolean') fail('NOTARIZATION_DECISION_CONTRACT_INVALID');
  if (!validateExistingEvidenceSet(evidence.existingEvidence)) fail('EXISTING_EVIDENCE_INVALID');
  if (!hasExactBooleanKeys(evidence.credentialPresence, credentialPresenceKeys)) fail('CREDENTIAL_PRESENCE_SCHEMA_INVALID');
  const expectedNotarization = summarizeNotarizationCredentialState(evidence.credentialPresence);
  if (JSON.stringify(evidence.notarization) !== JSON.stringify(expectedNotarization)) fail('NOTARIZATION_CONTRACT_MISMATCH');
  if (evidence.decision.notarizationCredentialReady !== expectedNotarization.ready) fail('NOTARIZATION_DECISION_MISMATCH');
  if (!validateDerivedReadinessFields(evidence)) fail('DERIVED_FIELDS_CONSISTENCY_INVALID');
  if (!safeBooleanScope(evidence.scope)) fail('SCOPE_PRIVACY_INVALID');
  const serialized = JSON.stringify(evidence);
  if (/(?:^|[\s"'=:(\[,])\/(?:[^\s"'`]+(?:\/[^\s"'`]+)*)|[A-Za-z]:[\\/]|\\\\|sk-[A-Za-z0-9]|-----BEGIN/i.test(serialized)) fail('READINESS_LEAKAGE_DETECTED');
  return true;
}

function sourceRevision() {
  const headResult = run('/usr/bin/git', ['rev-parse', 'HEAD']);
  const dirtyResult = run('/usr/bin/git', ['status', '--porcelain', '--untracked-files=all'], { maxBuffer: 1024 * 1024 });
  const gitHead = headResult.status === 0 && !headResult.errorCode && /^[a-f0-9]{40}$/.test(headResult.stdout.trim())
    ? headResult.stdout.trim()
    : null;
  return {
    gitHead,
    provenanceScope: 'audit-script-package-json-focused-test',
    sourceScriptSha256: sha256File(scriptPath),
    packageJsonSha256: sha256File(path.join(appDir, 'package.json')),
    focusedTestSha256: sha256File(path.join(appDir, 'scripts/test-macos-signing-readiness.mjs')),
    gitCommandSucceeded: headResult.status === 0 && dirtyResult.status === 0 && !headResult.errorCode && !dirtyResult.errorCode,
    workingTreeDirty: dirtyResult.status === 0 && !dirtyResult.errorCode ? dirtyResult.stdout.trim().length > 0 : null,
  };
}

function main() {
  const requestedOutputPath = process.argv[2] || '';
  if (process.platform !== 'darwin' || process.arch !== 'arm64') fail('MACOS_ARM64_REQUIRED');
  if (!requestedOutputPath) fail('EVIDENCE_PATH_REQUIRED');
  const outputPath = path.resolve(requestedOutputPath);
  if (!outputPath.startsWith(`${evidenceDir}${path.sep}`) || path.extname(outputPath) !== '.json') fail('EVIDENCE_PATH_INVALID');
  if (fs.existsSync(outputPath)) fail('EVIDENCE_ALREADY_EXISTS');

  const macConfig = loadSignedCanaryBuildConfig(appDir).mac || {};
  const identityResult = run('/usr/bin/security', ['find-identity', '-v', '-p', 'codesigning']);
  const identity = summarizeIdentityAvailability(identityResult);
  const toolchain = {
    required: {
      codesign: commandPresent('/usr/bin/codesign'),
      xcrun: commandPresent('/usr/bin/xcrun'),
      xcrunCodesign: xcrunToolAvailable('codesign'),
    },
    optional: {
      productbuild: commandPresent('/usr/bin/productbuild'),
      spctl: commandPresent('/usr/sbin/spctl'),
      xcodeSelect: commandAvailable('/usr/bin/xcode-select', ['-p']),
      xcrunNotarytool: xcrunToolAvailable('notarytool'),
    },
  };
  const versions = {
    node: process.version,
    macOSProductVersion: sanitizedVersion('/usr/bin/sw_vers', ['-productVersion']),
    macOSBuildVersion: sanitizedVersion('/usr/bin/sw_vers', ['-buildVersion']),
  };
  const sourceBuildConfig = summarizeSourceBuildConfig(macConfig);
  const credentialPresence = summarizeCredentialPresence();
  const notarization = summarizeNotarizationCredentialState(credentialPresence);
  const existingEvidence = [
    summarizeExistingEvidence('2026-10-28-fr-021-packaged-security-identity-audit3.json'),
    summarizeExistingEvidence('2026-10-29-fr-021-adhoc-runtime-signing-canary-audit2.json'),
  ];
  const requiredToolchainValues = Object.values(toolchain.required);
  const toolchainReady = requiredToolchainValues.every((value) => value.executablePresent === true || value.commandSucceeded === true);
  const sourceConfigReady = sourceBuildConfig.sourceConfigReady;
  const existingEvidenceReady = validateExistingEvidenceSet(existingEvidence);
  const revision = sourceRevision();
  const provenanceReady = revision.gitCommandSucceeded === true
    && /^[a-f0-9]{40}$/.test(revision.gitHead || '')
    && /^[a-f0-9]{64}$/.test(revision.sourceScriptSha256)
    && /^[a-f0-9]{64}$/.test(revision.packageJsonSha256);
  const decision = classifyReadiness({ identity, toolchainReady, sourceConfigReady, existingEvidenceReady, provenanceReady });
  const evidence = {
    schema: 'offline-subtitle-factory.macos-signing-readiness-audit.v1',
    startedAt,
    completedAt: new Date().toISOString(),
    environment: { platform: process.platform, arch: process.arch, osRelease: os.release(), ...versions },
    sourceRevision: revision,
    toolchain,
    identity,
    sourceBuildConfig,
    credentialPresence,
    notarization,
    existingEvidence,
    decision: { toolchainReady, sourceConfigReady, existingEvidenceReady, provenanceReady, notarizationCredentialReady: notarization.ready, ...decision },
    scope: Object.fromEntries(requiredScopeKeys.map((key) => [key, false])),
    interpretation: 'This is a read-only signing and notarization-prerequisite audit. Notarization credential status records only boolean presence and does not invoke notarytool or prove credential validity. A blocked status is an external packaging prerequisite result, not an FR-021 pass or a renderer diagnosis. It does not authorize keychain changes, signing, notarization, sandbox relaxation, network-policy changes, or release publication.',
    status: decision.status,
  };
  validateReadinessEvidence(evidence);
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(`macOS signing readiness audit ${evidence.status}: ${path.basename(outputPath)}`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
