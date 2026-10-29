import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  classifyCodeSign,
  classifyEntitlements,
  classifyGatekeeper,
  classifyStapler,
  compareTeamIdentifiers,
  evaluateSignedCanaryVerification,
  expectedCodeObjectLabels,
  expectedHelperBundleNames,
  normalizeBundleExecutableName,
} from '../lib/macos-signed-canary-verification.mjs';
import { validateEvidence } from './audit-macos-signed-canary-result.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceDir = path.join(appDir, 'docs/project-management/evidence');

const sourceBuildConfig = {
  identityConfiguration: 'auto-discovery',
  hardenedRuntimeConfigured: true,
  gatekeeperAssessConfigured: true,
  entitlementsConfigured: false,
  macTargetConfigured: true,
  sourceConfigReady: true,
};

const validCodeSign = classifyCodeSign({
  status: 0,
  stdout: 'Authority=Developer ID Application: Example (TEAM123)\nTeamIdentifier=TEAM123\nCodeDirectory v=20500 flags=0x10000(runtime)',
  verificationSucceeded: true,
  entitlementsCommandSucceeded: true,
  entitlementsPresent: true,
});
const validExecutableHash = 'b'.repeat(64);
const validDiagnosticForSlot = (index) => `Authority=Developer ID Application: Example (TEAM123)\nTeamIdentifier=TEAM123\nCodeDirectory v=20500 flags=0x10000(runtime)\nObjectSlot=${index}\n`;
const validObjects = expectedCodeObjectLabels.map((label, index) => ({
  label,
  executableSha256: validExecutableHash,
  codeSign: classifyCodeSign({
    status: 0,
    stdout: validDiagnosticForSlot(index).trimEnd(),
    verificationSucceeded: true,
    entitlementsCommandSucceeded: true,
    entitlementsPresent: true,
  }),
}));
const helperInventory = {
  complete: true,
  frameworkAppEntries: [...expectedHelperBundleNames],
  missingHelperBundleNames: [],
  unexpectedHelperBundleNames: [],
};
const validStapler = classifyStapler({ status: 0, stdout: 'The staple and validate action worked!' });
const validGatekeeper = classifyGatekeeper({ status: 0, stdout: '/candidate.app: accepted\nsource=Notarized Developer ID\norigin=Developer ID Application: Example (TEAM123)' });
const validTeamIdentifierDiagnostics = expectedCodeObjectLabels.map((_, index) => validDiagnosticForSlot(index));

assert.equal(validCodeSign.developerIdApplicationPresent, true);
assert.equal(validCodeSign.teamIdentifierPresent, true);
assert.equal(validCodeSign.runtimeFlagObserved, true);
assert.equal(validCodeSign.adHocFlagObserved, false);
assert.equal(Object.hasOwn(validCodeSign, 'identity'), false);
assert.equal(classifyEntitlements({ status: 0, stdout: '<plist><dict><key>com.apple.security.cs.allow-jit</key></dict></plist>' }).present, true);
assert.equal(validStapler.status, 'valid');
assert.equal(validGatekeeper.status, 'accepted');
assert.equal(compareTeamIdentifiers(validTeamIdentifierDiagnostics, validObjects.map((object) => object.codeSign.diagnosticSha256)), true);
assert.equal(compareTeamIdentifiers([validTeamIdentifierDiagnostics[1], validTeamIdentifierDiagnostics[0], ...validTeamIdentifierDiagnostics.slice(2)], validObjects.map((object) => object.codeSign.diagnosticSha256)), false);
assert.equal(compareTeamIdentifiers([...validTeamIdentifierDiagnostics.slice(0, -1), 'Authority=Developer ID Application: Example (OTHER)\nTeamIdentifier=OTHER\nCodeDirectory v=20500 flags=0x10000(runtime)\nObjectSlot=5\n'], validObjects.map((object) => object.codeSign.diagnosticSha256)), false);
assert.equal(classifyStapler({ status: 0, stdout: 'ticket' }).status, 'invalid');
assert.equal(classifyGatekeeper({ status: 0, stdout: 'assessment completed' }).status, 'rejected');
assert.equal(normalizeBundleExecutableName('離線字幕工廠'), '離線字幕工廠');
assert.equal(normalizeBundleExecutableName('  Offline Subtitle Factory  '), 'Offline Subtitle Factory');
for (const malformedName of [null, '', '.', '..', '../escape', '/absolute', 'foo\\bar', 'line\nfeed', 'x'.repeat(256)]) {
  assert.equal(normalizeBundleExecutableName(malformedName), null, `malformed executable name must fail closed: ${JSON.stringify(malformedName)}`);
}

const ready = evaluateSignedCanaryVerification({
  sourceBuildConfig,
  helperInventory,
  objects: validObjects,
  stapler: validStapler,
  gatekeeper: validGatekeeper,
  teamIdentifierDiagnostics: validTeamIdentifierDiagnostics,
});
assert.equal(ready.ready, true);
assert.deepEqual(ready.reasons, []);

const cases = [
  ['missing executable digest', { objects: validObjects.map((object, index) => (index === 0 ? { ...object, executableSha256: null } : object)) }, 'code-object-signature-not-ready'],
  ['ad-hoc signature', { objects: validObjects.map((object) => ({ ...object, codeSign: { ...object.codeSign, adHocFlagObserved: true } })) }, 'code-object-signature-not-ready'],
  ['missing helper', { helperInventory: { ...helperInventory, complete: false, missingHelperBundleNames: [expectedHelperBundleNames[0]] } }, 'helper-inventory-not-ready'],
  ['non Developer ID', { objects: validObjects.map((object) => ({ ...object, codeSign: { ...object.codeSign, developerIdApplicationPresent: false } })) }, 'code-object-signature-not-ready'],
  ['inconsistent Team ID', { teamIdentifierDiagnostics: [...validTeamIdentifierDiagnostics.slice(0, -1), 'TeamIdentifier=OTHER'] }, 'team-identity-not-ready'],
  ['missing effective entitlements', { objects: validObjects.map((object) => ({ ...object, codeSign: { ...object.codeSign, entitlementsPresent: false } })) }, 'code-object-signature-not-ready'],
  ['entitlement command failure', { objects: validObjects.map((object) => ({ ...object, codeSign: { ...object.codeSign, entitlementsCommandSucceeded: false } })) }, 'code-object-signature-not-ready'],
  ['invalid staple', { stapler: { ...validStapler, status: 'invalid', recognizedSuccess: false } }, 'notarization-or-gatekeeper-not-ready'],
  ['Gatekeeper rejection', { gatekeeper: { ...validGatekeeper, status: 'rejected', recognizedRejection: true } }, 'notarization-or-gatekeeper-not-ready'],
  ['source config mismatch', { sourceBuildConfig: { ...sourceBuildConfig, hardenedRuntimeConfigured: false, sourceConfigReady: false } }, 'source-config-not-ready'],
];
for (const [name, overrides, reason] of cases) {
  const result = evaluateSignedCanaryVerification({
    sourceBuildConfig,
    helperInventory,
    objects: validObjects,
    stapler: validStapler,
    gatekeeper: validGatekeeper,
    teamIdentifierDiagnostics: validTeamIdentifierDiagnostics,
    ...overrides,
  });
  assert.equal(result.ready, false, `${name} must fail closed`);
  assert(result.reasons.includes(reason), `${name} must expose ${reason}`);
}

const auditSource = fs.readFileSync(new URL('./audit-macos-signed-canary-result.mjs', import.meta.url), 'utf8');
const packagedIdentitySource = fs.readFileSync(new URL('./audit-macos-packaged-security-identity.mjs', import.meta.url), 'utf8');
assert.match(auditSource, /rawCommandOutputPersisted: false/);
assert.match(auditSource, /identityNamesPersisted: false/);
assert.match(auditSource, /entitlementsPersisted: false/);
assert.match(auditSource, /xcrun', \['stapler', 'validate'/);
assert.match(auditSource, /spctl', \['--assess', '--type', 'execute'/);
assert.match(auditSource, /signingReadinessScriptSha256/);
assert.match(auditSource, /signedCanaryBuilderConfigSha256/);
assert.match(auditSource, /packageLockSha256/);
assert.match(auditSource, /candidateMetadataValid = Boolean\(executableName\) && isSafeVersion\(bundleVersion\)/);
assert.match(auditSource, /sha256FileOrNull\(frameworkBinary\)/);
assert.match(auditSource, /expectedHelperBundleNames\.map\(\(name\) => inspectCodeObject/);
assert.match(packagedIdentitySource, /normalizeBundleExecutableName/);
assert.match(packagedIdentitySource, /candidateMetadataValid = Boolean\(executableName\)/);
assert.match(packagedIdentitySource, /isSha256\(item\.executableSha256\)/);
assert.match(packagedIdentitySource, /candidateMetadataValid && allVerified/);
assert.match(packagedIdentitySource, /sha256FileOrNull\(frameworkBinary\)/);

const hash = 'a'.repeat(64);
const fixtureObject = (label) => ({
  label,
  executableSha256: hash,
  codeSign: {
    commandSucceeded: false,
    developerIdApplicationPresent: false,
    teamIdentifierPresent: false,
    runtimeFlagObserved: false,
    adHocFlagObserved: false,
    flagsObserved: false,
    diagnosticSha256: hash,
    diagnosticBytes: 0,
    verificationSucceeded: false,
    entitlementsCommandSucceeded: false,
    entitlementsPresent: false,
  },
  verification: { succeeded: false, status: 1, errorCode: null },
  entitlements: { commandSucceeded: false, present: false, diagnosticSha256: hash, diagnosticBytes: 0 },
});
const fixture = {
  schema: 'offline-subtitle-factory.macos-signed-canary-result-audit.v1',
  startedAt: '2026-10-29T00:00:00.000Z',
  completedAt: '2026-10-29T00:00:01.000Z',
  environment: { platform: 'darwin', arch: 'arm64', node: 'v22', osRelease: 'test' },
  candidate: { metadataValid: true, executableSha256: hash, frameworkSha256: hash },
  sourceBuildConfig: { identityConfiguration: 'auto-discovery', hardenedRuntimeConfigured: true, gatekeeperAssessConfigured: true, entitlementsConfigured: false, macTargetConfigured: true, sourceConfigReady: true },
  helperInventory: { complete: false, expectedHelperCount: 4, actualHelperCount: 0, missingHelperCount: 4, unexpectedHelperCount: 0 },
  objects: expectedCodeObjectLabels.map(fixtureObject),
  stapler: { commandSucceeded: false, recognizedSuccess: false, status: 'invalid', diagnosticSha256: hash, diagnosticBytes: 0 },
  gatekeeper: { commandSucceeded: false, recognizedRejection: true, recognizedSuccess: false, status: 'rejected', diagnosticSha256: hash, diagnosticBytes: 0 },
  summary: { ready: false, reasons: ['helper-inventory-not-ready', 'code-object-signature-not-ready', 'team-identity-not-ready', 'notarization-or-gatekeeper-not-ready'], sourceReady: true, candidateMetadataValid: true, sourceProvenanceReady: true, inventoryReady: false, objectSetReady: true, objectsReady: false, teamIdentifiersConsistent: false, notarizationReady: false },
  sourceRevision: { gitHead: 'a'.repeat(40), workingTreeDirty: false, auditScriptSha256: hash, verificationModuleSha256: hash, signingReadinessScriptSha256: hash, signedBuildConfigModuleSha256: hash, signedCanaryBuilderConfigSha256: hash, packageJsonSha256: hash, packageLockSha256: hash },
  scope: { candidateModified: false, signingAttempted: false, notarizationAttempted: false, keychainModified: false, packagedAppExecuted: false, uiFlowRun: false, networkConnectionsAttempted: false, rawCommandOutputPersisted: false, absolutePathsPersisted: false, identityNamesPersisted: false, identityHashesPersisted: false, entitlementsPersisted: false, secretsPersisted: false },
  status: 'fail',
  interpretation: 'test',
};
assert.doesNotThrow(() => validateEvidence(fixture));
const malformedCandidateFixture = structuredClone(fixture);
malformedCandidateFixture.candidate.metadataValid = false;
malformedCandidateFixture.candidate.executableSha256 = null;
malformedCandidateFixture.candidate.frameworkSha256 = null;
malformedCandidateFixture.summary.reasons = ['candidate-metadata-not-ready', 'helper-inventory-not-ready', 'code-object-signature-not-ready', 'team-identity-not-ready', 'notarization-or-gatekeeper-not-ready'];
malformedCandidateFixture.summary.candidateMetadataValid = false;
malformedCandidateFixture.status = 'fail';
assert.doesNotThrow(() => validateEvidence(malformedCandidateFixture), 'missing CFBundleExecutable must remain bounded fail evidence');
assert.throws(() => validateEvidence({ ...fixture, extra: true }), /SIGNED_RESULT_EVIDENCE_SCHEMA_INVALID/);
assert.throws(() => validateEvidence({ ...fixture, status: 'pass' }), /SIGNED_RESULT_SUMMARY_STATUS_MISMATCH/);
assert.throws(() => validateEvidence({ ...fixture, scope: { ...fixture.scope, unexpected: false } }), /SIGNED_RESULT_SCOPE_NOT_FAIL_CLOSED/);
const wrongEnvironmentType = structuredClone(fixture);
wrongEnvironmentType.environment.platform = 42;
assert.throws(() => validateEvidence(wrongEnvironmentType), /SIGNED_RESULT_ENVIRONMENT_SCHEMA_INVALID/);
const wrongCodeSignType = structuredClone(fixture);
wrongCodeSignType.objects[0].codeSign.commandSucceeded = 'false';
assert.throws(() => validateEvidence(wrongCodeSignType), /SIGNED_RESULT_OBJECT_SCHEMA_INVALID/);
const wrongAppleType = structuredClone(fixture);
wrongAppleType.stapler.diagnosticBytes = '0';
assert.throws(() => validateEvidence(wrongAppleType), /SIGNED_RESULT_STAPLER_SCHEMA_INVALID/);
const sourceConfigContradiction = structuredClone(fixture);
sourceConfigContradiction.sourceBuildConfig.sourceConfigReady = true;
sourceConfigContradiction.sourceBuildConfig.hardenedRuntimeConfigured = false;
assert.throws(() => validateEvidence(sourceConfigContradiction), /SIGNED_RESULT_SOURCE_CONFIG_SCHEMA_INVALID/);
const forgedSummary = structuredClone(fixture);
forgedSummary.summary.ready = true;
forgedSummary.summary.reasons = [];
forgedSummary.status = 'pass';
assert.throws(() => validateEvidence(forgedSummary), /SIGNED_RESULT_SUMMARY_STATUS_MISMATCH/);
const wrongTimestamp = structuredClone(fixture);
wrongTimestamp.startedAt = 42;
assert.throws(() => validateEvidence(wrongTimestamp), /SIGNED_RESULT_EVIDENCE_SCHEMA_INVALID/);
const wrongPlatform = structuredClone(fixture);
wrongPlatform.environment.platform = 'linux';
assert.throws(() => validateEvidence(wrongPlatform), /SIGNED_RESULT_ENVIRONMENT_SCHEMA_INVALID/);
const wrongArch = structuredClone(fixture);
wrongArch.environment.arch = 'x64';
assert.throws(() => validateEvidence(wrongArch), /SIGNED_RESULT_ENVIRONMENT_SCHEMA_INVALID/);
const helperContradiction = structuredClone(fixture);
helperContradiction.helperInventory.complete = true;
assert.throws(() => validateEvidence(helperContradiction), /SIGNED_RESULT_HELPER_SCHEMA_INVALID/);
const verificationContradiction = structuredClone(fixture);
verificationContradiction.objects[0].verification.succeeded = true;
verificationContradiction.objects[0].verification.status = 1;
verificationContradiction.objects[0].codeSign.verificationSucceeded = true;
assert.throws(() => validateEvidence(verificationContradiction), /SIGNED_RESULT_OBJECT_SCHEMA_INVALID/);
const appleFlagContradiction = structuredClone(fixture);
appleFlagContradiction.gatekeeper.recognizedRejection = true;
appleFlagContradiction.gatekeeper.recognizedSuccess = true;
assert.throws(() => validateEvidence(appleFlagContradiction), /SIGNED_RESULT_GATEKEEPER_SCHEMA_INVALID/);
const wrongInterpretationType = structuredClone(fixture);
wrongInterpretationType.interpretation = 42;
assert.throws(() => validateEvidence(wrongInterpretationType), /SIGNED_RESULT_EVIDENCE_SCHEMA_INVALID/);

const malformedTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-macos-signed-canary-malformed-'));
const malformedBundle = path.join(malformedTempDir, 'Malformed.app');
const malformedResultOutput = path.join(evidenceDir, `focused-${process.pid}-macos-signed-canary-malformed-result.json`);
const malformedIdentityOutput = path.join(evidenceDir, `focused-${process.pid}-macos-packaged-identity-malformed.json`);
const fakeDarwinBootstrap = `data:text/javascript,${encodeURIComponent('Object.defineProperty(process,"platform",{value:"darwin"});Object.defineProperty(process,"arch",{value:"arm64"});')}`;
try {
  fs.mkdirSync(path.join(malformedBundle, 'Contents', 'Frameworks'), { recursive: true });
  const resultAudit = spawnSync(process.execPath, [
    '--import', fakeDarwinBootstrap,
    path.join(appDir, 'scripts/audit-macos-signed-canary-result.mjs'),
    malformedBundle,
    malformedResultOutput,
  ], { encoding: 'utf8' });
  assert.equal(resultAudit.status, 1, `malformed result audit must fail closed: ${resultAudit.stderr}`);
  const malformedResultEvidence = JSON.parse(fs.readFileSync(malformedResultOutput, 'utf8'));
  assert.doesNotThrow(() => validateEvidence(malformedResultEvidence));
  assert.equal(malformedResultEvidence.status, 'fail');
  assert.equal(malformedResultEvidence.candidate.metadataValid, false);
  assert.equal(malformedResultEvidence.candidate.executableSha256, null);
  assert.equal(malformedResultEvidence.objects.length, expectedCodeObjectLabels.length);
  assert.equal(fs.statSync(malformedResultOutput).mode & 0o777, 0o600);

  const identityAudit = spawnSync(process.execPath, [
    '--import', fakeDarwinBootstrap,
    path.join(appDir, 'scripts/audit-macos-packaged-security-identity.mjs'),
    malformedBundle,
    malformedIdentityOutput,
  ], { encoding: 'utf8' });
  assert.equal(identityAudit.status, 1, `malformed identity audit must fail closed: ${identityAudit.stderr}`);
  const malformedIdentityEvidence = JSON.parse(fs.readFileSync(malformedIdentityOutput, 'utf8'));
  assert.equal(malformedIdentityEvidence.status, 'fail');
  assert.equal(malformedIdentityEvidence.summary.candidateMetadataValid, false);
  assert.equal(malformedIdentityEvidence.candidate.executableSha256, null);
  assert.equal(malformedIdentityEvidence.objects.length, expectedCodeObjectLabels.length);
  assert.equal(fs.statSync(malformedIdentityOutput).mode & 0o777, 0o600);
} finally {
  fs.rmSync(malformedResultOutput, { force: true });
  fs.rmSync(malformedIdentityOutput, { force: true });
  fs.rmSync(malformedTempDir, { recursive: true, force: true });
}

console.log('macOS signed canary result verification contract passed: inventory, Developer ID, runtime, entitlements, staple and Gatekeeper fail-closed matrix');
