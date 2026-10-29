import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyReadiness,
  summarizeIdentityAvailability,
  summarizeNotarizationCredentialState,
  summarizeSourceBuildConfig,
  validateExistingEvidenceSet,
  validateReadinessEvidence,
} from './audit-macos-signing-readiness.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceDir = path.join(appDir, 'docs/project-management/evidence');
const evidenceFile = fs.readdirSync(evidenceDir)
  .filter((fileName) => /^2026-10-29-fr-021-prerequisite-readiness-recheck-next\d+\.json$/.test(fileName))
  .sort((left, right) => Number(right.match(/next(\d+)\.json$/)[1]) - Number(left.match(/next(\d+)\.json$/)[1]))[0];
const evidencePath = path.join(evidenceDir, evidenceFile || 'missing-authoritative-readiness-evidence.json');
assert.equal(fs.existsSync(evidencePath), true, 'authoritative signing readiness evidence must exist');
const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
assert.doesNotThrow(() => validateReadinessEvidence(evidence), 'authoritative readiness evidence must satisfy executable privacy/provenance gates');
assert.equal(evidence.status, 'blocked-external-signing-identity');
assert.equal(evidence.identity.probeReady, true);
assert.equal(evidence.identity.validIdentityCount, 0);
assert.equal(evidence.decision.toolchainReady, true);
assert.equal(evidence.decision.formalSigningReady, false);
assert.equal(evidence.sourceBuildConfig.identityConfiguration, 'auto-discovery');
assert.equal(evidence.sourceBuildConfig.hardenedRuntimeConfigured, true);
assert.equal(evidence.sourceBuildConfig.gatekeeperAssessConfigured, true);
assert.equal(evidence.decision.sourceConfigReady, true);
assert.equal(evidence.decision.notarizationCredentialReady, false);
assert.deepEqual(evidence.notarization, {
  appleIdSetComplete: false,
  apiKeySetComplete: false,
  keychainProfileSetComplete: false,
  completeSetCount: 0,
  partialCredentialSetDetected: false,
  status: 'absent',
  ready: false,
});
assert.equal(evidence.sourceRevision.provenanceScope, 'audit-script-package-json-focused-test');
assert.match(evidence.sourceRevision.focusedTestSha256, /^[a-f0-9]{64}$/);

const autoDiscoveryConfig = summarizeSourceBuildConfig({ hardenedRuntime: true, gatekeeperAssess: true, target: [{ target: 'dir', arch: ['arm64'] }] });
assert.deepEqual(autoDiscoveryConfig, {
  identityConfiguration: 'auto-discovery',
  hardenedRuntimeConfigured: true,
  gatekeeperAssessConfigured: true,
  entitlementsConfigured: false,
  macTargetConfigured: true,
  sourceConfigReady: true,
});
assert.equal(summarizeSourceBuildConfig({ hardenedRuntime: true, gatekeeperAssess: true }).sourceConfigReady, false);
assert.equal(summarizeSourceBuildConfig({ hardenedRuntime: true, gatekeeperAssess: true, target: [{}] }).sourceConfigReady, false);
assert.equal(summarizeSourceBuildConfig({ hardenedRuntime: true, gatekeeperAssess: true, target: [{ target: 'not-a-mac-target', arch: ['arm64'] }] }).sourceConfigReady, false);
assert.equal(summarizeSourceBuildConfig({ hardenedRuntime: true, gatekeeperAssess: true, target: [{ target: 'dmg', arch: ['x64'] }] }).sourceConfigReady, false);
assert.equal(summarizeSourceBuildConfig({ hardenedRuntime: true, gatekeeperAssess: true, target: [{ target: 'dmg', arch: ['arm64'] }] }).sourceConfigReady, true);
assert.equal(summarizeSourceBuildConfig({ identity: null, hardenedRuntime: true, gatekeeperAssess: true }).sourceConfigReady, false);
assert.equal(summarizeSourceBuildConfig({ identity: '-', hardenedRuntime: true, gatekeeperAssess: true }).identityConfiguration, 'explicit-adhoc');
assert.equal(summarizeSourceBuildConfig({ identity: '-', hardenedRuntime: true, gatekeeperAssess: true }).sourceConfigReady, false);
assert.equal(summarizeSourceBuildConfig({ hardenedRuntime: false, gatekeeperAssess: true }).sourceConfigReady, false);

assert.deepEqual(summarizeNotarizationCredentialState({
  APPLE_ID: true,
  APPLE_APP_SPECIFIC_PASSWORD: true,
  APPLE_TEAM_ID: true,
}), {
  appleIdSetComplete: true,
  apiKeySetComplete: false,
  keychainProfileSetComplete: false,
  completeSetCount: 1,
  partialCredentialSetDetected: false,
  status: 'complete',
  ready: true,
});
assert.equal(summarizeNotarizationCredentialState({ APPLE_API_KEY: true, APPLE_API_KEY_ID: true }).status, 'partial');
assert.equal(summarizeNotarizationCredentialState({ APPLE_KEYCHAIN_PROFILE: true, APPLE_API_KEY: true, APPLE_API_KEY_ID: true, APPLE_API_ISSUER: true }).status, 'ambiguous');
assert.equal(summarizeNotarizationCredentialState({ APPLE_KEYCHAIN: true }).ready, false);
assert.equal(summarizeNotarizationCredentialState({}).status, 'absent');
assert.equal(summarizeNotarizationCredentialState({
  APPLE_ID: true,
  APPLE_APP_SPECIFIC_PASSWORD: true,
  APPLE_TEAM_ID: true,
  APPLE_API_KEY: true,
  APPLE_API_KEY_ID: true,
}).status, 'ambiguous');

const identityProbeFailure = summarizeIdentityAvailability({ status: 1, errorCode: 'EACCES', stdout: '', stderr: 'security unavailable' });
assert.equal(identityProbeFailure.probeReady, false);
assert.equal(identityProbeFailure.formalIdentityAvailable, false);
assert.equal(classifyReadiness({
  identity: identityProbeFailure,
  toolchainReady: true,
  sourceConfigReady: true,
  existingEvidenceReady: true,
  provenanceReady: true,
}).status, 'identity-probe-unavailable');

const malformedIdentityOutput = summarizeIdentityAvailability({ status: 0, errorCode: null, stdout: 'Developer ID Application: misleading text', stderr: '' });
assert.equal(malformedIdentityOutput.probeReady, false);
assert.equal(malformedIdentityOutput.formalIdentityAvailable, false);
assert.equal(classifyReadiness({
  identity: malformedIdentityOutput,
  toolchainReady: true,
  sourceConfigReady: true,
  existingEvidenceReady: true,
  provenanceReady: true,
}).status, 'identity-probe-unavailable');

const toolchainFailure = classifyReadiness({
  identity: evidence.identity,
  toolchainReady: false,
  sourceConfigReady: true,
  existingEvidenceReady: true,
  provenanceReady: true,
});
assert.equal(toolchainFailure.status, 'required-toolchain-unavailable');

const privacyTampered = structuredClone(evidence);
privacyTampered.scope.rawCommandOutputPersisted = true;
assert.throws(() => validateReadinessEvidence(privacyTampered), /SCOPE_PRIVACY_INVALID/);

const importedEvidenceTampered = structuredClone(evidence);
importedEvidenceTampered.existingEvidence[0].status = 'pass /private/var/raw-output';
assert.throws(() => validateReadinessEvidence(importedEvidenceTampered), /EXISTING_EVIDENCE_INVALID/);

const unknownScopeTampered = structuredClone(evidence);
unknownScopeTampered.existingEvidence[0].scopeKeys.push('secretsPersisted');
assert.throws(() => validateReadinessEvidence(unknownScopeTampered), /EXISTING_EVIDENCE_INVALID/);

const emptySet = [];
assert.equal(validateExistingEvidenceSet(emptySet), false, 'existing evidence must not accept an empty set');
const oneEntrySet = evidence.existingEvidence.slice(0, 1);
assert.equal(validateExistingEvidenceSet(oneEntrySet), false, 'existing evidence must require both fixed entries');
const duplicateSet = [evidence.existingEvidence[0], evidence.existingEvidence[0]];
assert.equal(validateExistingEvidenceSet(duplicateSet), false, 'existing evidence must reject duplicate entries');
const topLevelUnknownScope = structuredClone(evidence);
topLevelUnknownScope.scope.unknownFutureKey = false;
assert.throws(() => validateReadinessEvidence(topLevelUnknownScope), /SCOPE_PRIVACY_INVALID/);
const topLevelSensitiveScope = structuredClone(evidence);
topLevelSensitiveScope.scope.secretsPersisted = true;
assert.throws(() => validateReadinessEvidence(topLevelSensitiveScope), /SCOPE_PRIVACY_INVALID/);

const typeTampered = structuredClone(evidence);
typeTampered.existingEvidence[1].requiredCodeSignFlagSatisfied = 'true';
assert.throws(() => validateReadinessEvidence(typeTampered), /EXISTING_EVIDENCE_INVALID/);

const missingCredentialKey = structuredClone(evidence);
delete missingCredentialKey.credentialPresence.APPLE_ID;
assert.throws(() => validateReadinessEvidence(missingCredentialKey), /CREDENTIAL_PRESENCE_SCHEMA_INVALID/);
const unknownCredentialKey = structuredClone(evidence);
unknownCredentialKey.credentialPresence.FUTURE_SECRET = false;
assert.throws(() => validateReadinessEvidence(unknownCredentialKey), /CREDENTIAL_PRESENCE_SCHEMA_INVALID/);
const derivedMismatch = structuredClone(evidence);
derivedMismatch.notarization.status = 'complete';
derivedMismatch.notarization.ready = true;
derivedMismatch.notarization.completeSetCount = 1;
derivedMismatch.notarization.appleIdSetComplete = true;
derivedMismatch.decision.notarizationCredentialReady = true;
assert.throws(() => validateReadinessEvidence(derivedMismatch), /NOTARIZATION_CONTRACT_MISMATCH/);
const contradictoryIdentity = structuredClone(evidence);
contradictoryIdentity.identity.formalIdentityAvailable = true;
assert.throws(() => validateReadinessEvidence(contradictoryIdentity), /DERIVED_FIELDS_CONSISTENCY_INVALID/);
const contradictoryDecision = structuredClone(evidence);
contradictoryDecision.decision.formalSigningReady = true;
assert.throws(() => validateReadinessEvidence(contradictoryDecision), /DERIVED_FIELDS_CONSISTENCY_INVALID/);
const inconsistentToolchainDecision = structuredClone(evidence);
inconsistentToolchainDecision.decision.toolchainReady = false;
assert.throws(() => validateReadinessEvidence(inconsistentToolchainDecision), /DERIVED_FIELDS_CONSISTENCY_INVALID/);
const matchingCountExceedsValid = structuredClone(evidence);
matchingCountExceedsValid.identity.matchingIdentityCount = matchingCountExceedsValid.identity.validIdentityCount + 1;
assert.throws(() => validateReadinessEvidence(matchingCountExceedsValid), /DERIVED_FIELDS_CONSISTENCY_INVALID/);
const unknownTopLevel = structuredClone(evidence);
unknownTopLevel.futureKey = false;
assert.throws(() => validateReadinessEvidence(unknownTopLevel), /READINESS_SCHEMA_KEYS_INVALID/);
for (const forbiddenPath of ['/opt/credential', '/Applications/Foo.app', '/Library/Keychains/foo']) {
  const pathTampered = structuredClone(evidence);
  pathTampered.interpretation = forbiddenPath;
  assert.throws(() => validateReadinessEvidence(pathTampered), /READINESS_LEAKAGE_DETECTED/);
}
for (const genericAbsolutePath of ['/foo/bar', '/bin/tool', '/dev/null']) {
  const pathTampered = structuredClone(evidence);
  pathTampered.interpretation = genericAbsolutePath;
  assert.throws(() => validateReadinessEvidence(pathTampered), /READINESS_LEAKAGE_DETECTED/);
}
const nestedEnvironmentUnknown = structuredClone(evidence);
nestedEnvironmentUnknown.environment.macOSProductVersion.futureField = false;
assert.throws(() => validateReadinessEvidence(nestedEnvironmentUnknown), /ENVIRONMENT_SCHEMA_INVALID/);
const nestedToolchainUnknown = structuredClone(evidence);
nestedToolchainUnknown.toolchain.required.codesign.futureField = false;
assert.throws(() => validateReadinessEvidence(nestedToolchainUnknown), /TOOLCHAIN_CONTRACT_INVALID/);
const nestedToolchainType = structuredClone(evidence);
nestedToolchainType.toolchain.optional.xcrunNotarytool.status = '0';
assert.throws(() => validateReadinessEvidence(nestedToolchainType), /TOOLCHAIN_CONTRACT_INVALID/);

console.log('macOS signing readiness focused contract passed: identity failure, malformed output, toolchain gate, provenance and privacy fail-closed cases');
