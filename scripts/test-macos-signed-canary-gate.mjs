import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEvidence } from './audit-macos-signed-canary-gate.mjs';
import { evaluateFormalSignedCanaryReadiness } from './assert-macos-signed-canary-ready.mjs';
import { summarizeCredentialPresence, summarizeNotarizationCredentialState, credentialPresenceKeys } from './audit-macos-signing-readiness.mjs';
import { selectSignedCanaryArtifacts } from '../lib/macos-signed-canary-artifact-selection.mjs';
import { loadSignedCanaryBuildConfig } from '../lib/macos-signed-canary-build-config.mjs';

const sourceConfig = {
  identityConfiguration: 'auto-discovery',
  hardenedRuntimeConfigured: true,
  gatekeeperAssessConfigured: true,
  entitlementsConfigured: false,
  macTargetConfigured: true,
  sourceConfigReady: true,
};
const identity = {
  commandSucceeded: true,
  probeReady: true,
  probeStatus: 'ok',
  validIdentityCount: 1,
  matchingIdentityCount: 1,
  developerIdApplicationPresent: true,
  appleDevelopmentPresent: false,
  appleDistributionPresent: false,
  formalIdentityAvailable: true,
  rawOutputPersisted: false,
  identityNamesPersisted: false,
  identityHashesPersisted: false,
};
const toolchain = {
  codesign: { executablePresent: true },
  xcrun: { executablePresent: true },
  xcrunCodesign: { commandSucceeded: true },
  xcrunNotarytool: { commandSucceeded: true },
};
const completeNotarization = {
  appleIdSetComplete: true,
  apiKeySetComplete: false,
  keychainProfileSetComplete: false,
  completeSetCount: 1,
  partialCredentialSetDetected: false,
  status: 'complete',
  ready: true,
};
const completeCredentialPresence = Object.fromEntries(credentialPresenceKeys.map((key) => [key, false]));
completeCredentialPresence.APPLE_ID = true;
completeCredentialPresence.APPLE_APP_SPECIFIC_PASSWORD = true;
completeCredentialPresence.APPLE_TEAM_ID = true;
const derivedCompleteNotarization = summarizeNotarizationCredentialState(completeCredentialPresence);

const ready = evaluateFormalSignedCanaryReadiness({
  platform: 'darwin',
  arch: 'arm64',
  sourceConfig,
  identity,
  toolchain,
  credentialPresence: completeCredentialPresence,
  notarization: derivedCompleteNotarization,
});
assert.equal(ready.ready, true);
assert.deepEqual(ready.reasons, []);
assert.equal(ready.notarizationConsistent, true);
const keychainCredentialPresence = Object.fromEntries(credentialPresenceKeys.map((key) => [key, false]));
keychainCredentialPresence.APPLE_KEYCHAIN_PROFILE = true;
const keychainReady = evaluateFormalSignedCanaryReadiness({
  platform: 'darwin',
  arch: 'arm64',
  sourceConfig,
  identity,
  toolchain,
  credentialPresence: keychainCredentialPresence,
  notarization: summarizeNotarizationCredentialState(keychainCredentialPresence),
});
assert.equal(keychainReady.ready, true);
assert.equal(keychainReady.notarizationConsistent, true);

const evidenceDir = path.join(path.resolve(fileURLToPath(new URL('..', import.meta.url))), 'docs/project-management/evidence');
const gateEvidenceFile = fs.readdirSync(evidenceDir)
  .filter((fileName) => /^2026-10-(?:29|30)-fr-021-signed-canary-gate-execution\d+\.json$/.test(fileName))
  .sort((left, right) => {
    const dateOrder = right.slice(0, 10).localeCompare(left.slice(0, 10));
    return dateOrder || Number(right.match(/execution(\d+)\.json$/)[1]) - Number(left.match(/execution(\d+)\.json$/)[1]);
  })[0];
assert.ok(gateEvidenceFile, 'authoritative gate evidence must exist');
assert.match(gateEvidenceFile, /^2026-10-30-/);
const blockedEvidence = JSON.parse(fs.readFileSync(path.join(evidenceDir, gateEvidenceFile), 'utf8'));
assert.doesNotThrow(() => validateEvidence(blockedEvidence));
const readyEvidence = structuredClone(blockedEvidence);
readyEvidence.startedAt = '2026-10-30T00:00:00.000Z';
readyEvidence.completedAt = '2026-10-30T00:00:01.000Z';
readyEvidence.gate = {
  ...readyEvidence.gate,
  ready: true,
  reasons: [],
  sourceConfigReady: true,
  requiredToolchainReady: true,
  identityReady: true,
  notarizationReady: true,
  notarizationStatus: 'complete',
  notarizationConsistent: true,
};
readyEvidence.sourceConfig = { ...readyEvidence.sourceConfig, sourceConfigReady: true };
readyEvidence.identity = {
  ...readyEvidence.identity,
  validIdentityCount: 1,
  developerIdApplicationPresent: true,
  formalIdentityAvailable: true,
};
readyEvidence.credentialPresence = {
  ...readyEvidence.credentialPresence,
  APPLE_KEYCHAIN_PROFILE: true,
};
readyEvidence.notarization = {
  ...readyEvidence.notarization,
  keychainProfileSetComplete: true,
  completeSetCount: 1,
  status: 'complete',
  ready: true,
};
assert.doesNotThrow(() => validateEvidence(readyEvidence), 'formal gate evidence must accept ready path');
assert.throws(() => validateEvidence({ ...readyEvidence, gate: { ...readyEvidence.gate, ready: true, reasons: ['unexpected'] } }), /GATE_EVIDENCE_RESULT_INVALID/);
for (const field of ['sourceConfigReady', 'requiredToolchainReady', 'identityReady', 'notarizationReady', 'notarizationConsistent']) {
  assert.throws(() => validateEvidence({ ...readyEvidence, gate: { ...readyEvidence.gate, [field]: false } }), /GATE_EVIDENCE_DERIVED_FIELDS_INVALID/);
}
assert.throws(() => validateEvidence({ ...readyEvidence, sourceConfig: { ...readyEvidence.sourceConfig, sourceConfigReady: false } }), /GATE_EVIDENCE_DERIVED_FIELDS_INVALID/);
assert.throws(() => validateEvidence({ ...readyEvidence, startedAt: null }), /GATE_EVIDENCE_TIMESTAMP_INVALID/);
assert.throws(() => validateEvidence({ ...readyEvidence, completedAt: 'not-a-timestamp' }), /GATE_EVIDENCE_TIMESTAMP_INVALID/);
assert.throws(() => validateEvidence({ ...readyEvidence, completedAt: '2026-10-29T23:59:59.000Z' }), /GATE_EVIDENCE_TIMESTAMP_INVALID/);
assert.throws(() => validateEvidence({ ...readyEvidence, execution: { ...readyEvidence.execution, builderStarted: true } }), /GATE_EVIDENCE_EXECUTION_NOT_FAIL_CLOSED/);

assert.equal(summarizeCredentialPresence({ APPLE_ID: '   ', APPLE_TEAM_ID: 'team', APPLE_APP_SPECIFIC_PASSWORD: 'password' }).APPLE_ID, false);
assert.equal(summarizeCredentialPresence({ APPLE_ID: 'id', APPLE_TEAM_ID: 'team', APPLE_APP_SPECIFIC_PASSWORD: 'password' }).APPLE_ID, true);

for (const notarization of [
  { ...completeNotarization, appleIdSetComplete: false, completeSetCount: 0, status: 'absent', ready: false },
  { ...completeNotarization, appleIdSetComplete: false, completeSetCount: 0, partialCredentialSetDetected: true, status: 'partial', ready: false },
  { ...completeNotarization, apiKeySetComplete: true, completeSetCount: 2, status: 'ambiguous', ready: false },
]) {
  const result = evaluateFormalSignedCanaryReadiness({ platform: 'darwin', arch: 'arm64', sourceConfig, identity, credentialPresence: completeCredentialPresence, toolchain, notarization });
  assert.equal(result.ready, false);
  assert(result.reasons.includes('notarization-credential-set-not-ready'));
}

for (const invalidIdentity of [
  { ...identity, validIdentityCount: 0, formalIdentityAvailable: false },
  { ...identity, developerIdApplicationPresent: false, formalIdentityAvailable: false },
  { ...identity, probeReady: false, probeStatus: 'malformed-output' },
]) {
  const result = evaluateFormalSignedCanaryReadiness({ platform: 'darwin', arch: 'arm64', sourceConfig, identity: invalidIdentity, credentialPresence: completeCredentialPresence, toolchain, notarization: derivedCompleteNotarization });
  assert.equal(result.ready, false);
  assert(result.reasons.includes('developer-id-application-not-ready'));
}

for (const variant of [
  { sourceConfig: { ...sourceConfig, sourceConfigReady: false } },
  { sourceConfig: { ...sourceConfig, macTargetConfigured: false } },
  { toolchain: { ...toolchain, xcrunNotarytool: { commandSucceeded: false } } },
  { platform: 'linux' },
  { arch: 'x64' },
]) {
  const result = evaluateFormalSignedCanaryReadiness({
    platform: variant.platform || 'darwin',
    arch: variant.arch || 'arm64',
    sourceConfig: variant.sourceConfig || sourceConfig,
    identity,
    toolchain: variant.toolchain || toolchain,
    credentialPresence: completeCredentialPresence,
    notarization: derivedCompleteNotarization,
  });
  assert.equal(result.ready, false);
  assert(result.reasons.length > 0);
}

const inconsistent = evaluateFormalSignedCanaryReadiness({
  platform: 'darwin',
  arch: 'arm64',
  sourceConfig,
  identity,
  toolchain,
  credentialPresence: completeCredentialPresence,
  notarization: { ...derivedCompleteNotarization, completeSetCount: 0, ready: true },
});
assert.equal(inconsistent.ready, false);
assert.equal(inconsistent.notarizationConsistent, false);

const whitespaceCredentialPresence = Object.fromEntries(credentialPresenceKeys.map((key) => [key, false]));
whitespaceCredentialPresence.APPLE_ID = true;
whitespaceCredentialPresence.APPLE_APP_SPECIFIC_PASSWORD = true;
whitespaceCredentialPresence.APPLE_TEAM_ID = true;
const whitespace = evaluateFormalSignedCanaryReadiness({
  platform: 'darwin',
  arch: 'arm64',
  sourceConfig,
  identity,
  toolchain,
  credentialPresence: { ...whitespaceCredentialPresence, APPLE_ID: '   ' },
  notarization: summarizeNotarizationCredentialState({ ...whitespaceCredentialPresence, APPLE_ID: false }),
});
assert.equal(whitespace.ready, false);
assert(whitespace.reasons.includes('notarization-credential-set-not-ready'));

const serialized = JSON.stringify(ready);
assert.doesNotMatch(serialized, /-----BEGIN|sk-|\/Users\/|\/private\//i);
const appDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const isolatedOutput = loadSignedCanaryBuildConfig(appDir, { outputDirectory: '/tmp/osf-signed-canary-test-output' });
assert.equal(isolatedOutput.directories.output, '/tmp/osf-signed-canary-test-output');
assert.throws(() => loadSignedCanaryBuildConfig(appDir, { outputDirectory: 'relative-output' }), /absolute path/);
assert.throws(() => loadSignedCanaryBuildConfig(appDir, { outputDirectory: appDir }), /outside the source tree/);
const workflow = fs.readFileSync(new URL('../.github/workflows/macos-signed-canary.yml', import.meta.url), 'utf8');
assert.match(workflow, /scripts\/select-macos-signed-canary-artifacts\.mjs/);
assert.match(workflow, /zip_path=.*value\.zipPath/);
assert.match(workflow, /OSF_SIGNED_CANARY_ZIP/);
assert.match(workflow, /osf-signed-canary-notarytool-dmg-\$GITHUB_RUN_ID\.json/);
assert.match(workflow, /osf-signed-canary-notarytool-zip-\$GITHUB_RUN_ID\.json/);
assert.match(workflow, /OSF_SIGNED_CANARY_SUBMITTED_DMG/);
assert.match(workflow, /OSF_SIGNED_CANARY_NOTARY_DMG_OUTPUT/);
assert.match(workflow, /OSF_SIGNED_CANARY_NOTARY_ZIP_OUTPUT/);
assert.match(workflow, /OSF_SIGNED_CANARY_SUBMITTED_ZIP/);
assert.equal((workflow.match(/APPLE_KEYCHAIN_PROFILE: osf-signed-canary/g) || []).length, 4);
assert.doesNotMatch(workflow, /OSF_APPLE_(?:ID|APP_SPECIFIC_PASSWORD|TEAM_ID)/);
assert.doesNotMatch(workflow, /--(?:apple-id|password|team-id)/);
const profileProbeStep = workflow.slice(
  workflow.indexOf('      - name: Verify notarytool keychain profile resolution'),
  workflow.indexOf('      - name: Prepare isolated signed-canary output'),
);
assert.match(profileProbeStep, /test "\$\{APPLE_KEYCHAIN_PROFILE:-\}" = "osf-signed-canary"/);
const normalizedProfileProbeStep = profileProbeStep.replace(/\\\n\s*/g, ' ');
const profileProbeContract = /xcrun notarytool history\s+--keychain-profile "\$APPLE_KEYCHAIN_PROFILE"\s+--output-format json\s+--no-progress\s+>\/dev\/null 2>\/dev\/null(?!\s*\|\|)/;
assert.match(normalizedProfileProbeStep, profileProbeContract);
assert.doesNotMatch(normalizedProfileProbeStep, /xcrun notarytool submit/);
assert.doesNotMatch(normalizedProfileProbeStep, /--password|--apple-id|--team-id/);
assert.match(profileProbeStep, /set -euo pipefail/);
assert.doesNotMatch(profileProbeStep, /\|\|\s*true/);
assert.equal(
  profileProbeContract.test(normalizedProfileProbeStep.replace('--keychain-profile "$APPLE_KEYCHAIN_PROFILE" ', '')),
  false,
);
assert.equal(
  profileProbeContract.test(normalizedProfileProbeStep.replace('history', 'submit')),
  false,
);
assert.equal(
  profileProbeContract.test(normalizedProfileProbeStep.replace('2>\/dev\/null', '2>\/dev\/null || true')),
  false,
);
assert.match(workflow, /ditto -c -k --sequesterRsrc --keepParent/);
assert.match(workflow, /\/usr\/bin\/unzip -tqq "\$OSF_SIGNED_CANARY_ZIP"/);
assert.doesNotMatch(workflow, /ditto -t -k/);
assert.match(workflow, /cleanup_distribution_inputs/);
assert.match(workflow, /cleanup_notary_on_failure/);
assert.match(workflow, /osf-signed-canary-submitted-dmg-\$GITHUB_RUN_ID\.dmg/);
assert.match(workflow, /OSF_GITHUB_REF_PROTECTED: \$\{\{ github\.ref_protected \}\}/);
assert.match(workflow, /test "\$\{OSF_GITHUB_REF_PROTECTED:-false\}" = "true"/);
const cleanupStep = workflow.slice(workflow.indexOf('      - name: Clean run-scoped signed-canary output'));
const notarizeStep = workflow.slice(
  workflow.indexOf('      - name: Notarize and staple signed canary'),
  workflow.indexOf('      - name: Verify notarized DMG container'),
);
assert(workflow.indexOf('      - name: Verify notarytool keychain profile resolution') < workflow.indexOf('      - name: Prepare isolated signed-canary output'));
assert(workflow.indexOf('      - name: Verify notarytool keychain profile resolution') < workflow.indexOf('      - name: Build isolated signed canary'));
assert.match(notarizeStep, /xcrun notarytool submit "\$OSF_SIGNED_CANARY_DMG"/);
assert.match(notarizeStep, /xcrun notarytool submit "\$OSF_SIGNED_CANARY_ZIP"/);
assert.match(notarizeStep, /test "\$\{APPLE_KEYCHAIN_PROFILE:-\}" = "osf-signed-canary"/);
assert.match(notarizeStep, /--keychain-profile "\$APPLE_KEYCHAIN_PROFILE"/g);
assert.equal((notarizeStep.match(/--keychain-profile "\$APPLE_KEYCHAIN_PROFILE"/g) || []).length, 2);
assert.doesNotMatch(notarizeStep, /--password|--apple-id|--team-id/);
assert.match(notarizeStep, /cp "\$OSF_SIGNED_CANARY_DMG" "\$submitted_dmg"/);
assert.match(notarizeStep, /cp "\$OSF_SIGNED_CANARY_DMG" "\$submitted_dmg"\s+chmod 600 "\$submitted_dmg"/);
assert.match(notarizeStep, /cp "\$OSF_SIGNED_CANARY_ZIP" "\$submitted_zip"\s+chmod 600 "\$submitted_zip"/);
assert.match(notarizeStep, /test -s "\$notary_dmg_output"\s+chmod 600 "\$notary_dmg_output" "\$notary_dmg_stderr"/);
assert.match(notarizeStep, /test -s "\$notary_zip_output"\s+chmod 600 "\$notary_zip_output" "\$notary_zip_stderr"/);
assert.match(notarizeStep, /rm -f -- "\$OSF_SIGNED_CANARY_ZIP"/);
assert.match(notarizeStep, /ditto -c -k --sequesterRsrc --keepParent "\$OSF_SIGNED_CANARY_APP" "\$OSF_SIGNED_CANARY_ZIP"/);
assert.match(notarizeStep, /if ! rm -f -- "\$notary_dmg_output"; then cleanup_status=1; fi/);
assert.match(notarizeStep, /if ! rm -f -- "\$notary_zip_output"; then cleanup_status=1; fi/);
assert.match(notarizeStep, /if ! rm -f -- "\$submitted_dmg"; then cleanup_status=1; fi/);
assert.match(notarizeStep, /if ! rm -f -- "\$submitted_zip"; then cleanup_status=1; fi/);
const distributionStep = workflow.slice(
  workflow.indexOf('      - name: Write app, DMG and ZIP distribution evidence'),
  workflow.indexOf('      - name: Verify signed canary result'),
);
const normalizedDistributionStep = distributionStep.replace(/\\\n\s*/g, ' ');
assert.match(
  normalizedDistributionStep,
  /npm run audit:mac:signed-canary:distribution --\s+"\$OSF_SIGNED_CANARY_DMG"\s+"\$OSF_SIGNED_CANARY_APP"\s+"\$OSF_SIGNED_CANARY_ZIP"\s+"\$OSF_SIGNED_CANARY_SUBMITTED_DMG"\s+"\$OSF_SIGNED_CANARY_SUBMITTED_ZIP"\s+"\$evidence"\s+"\$\{OSF_SIGNED_CANARY_NOTARY_DMG_OUTPUT:-\}"\s+"\$\{OSF_SIGNED_CANARY_NOTARY_ZIP_OUTPUT:-\}"/,
);
assert.doesNotMatch(
  normalizedDistributionStep.replace('"$OSF_SIGNED_CANARY_SUBMITTED_DMG" ', ''),
  /npm run audit:mac:signed-canary:distribution --\s+"\$OSF_SIGNED_CANARY_DMG"\s+"\$OSF_SIGNED_CANARY_APP"\s+"\$OSF_SIGNED_CANARY_ZIP"\s+"\$OSF_SIGNED_CANARY_SUBMITTED_DMG"/,
);
assert.doesNotMatch(notarizeStep.replace('chmod 600 "$submitted_zip"', ''), /cp "\$OSF_SIGNED_CANARY_ZIP" "\$submitted_zip"\s+chmod 600 "\$submitted_zip"/);
assert.doesNotMatch(notarizeStep.replace('if ! rm -f -- "$submitted_zip"; then cleanup_status=1; fi', ''), /if ! rm -f -- "\$submitted_zip"; then cleanup_status=1; fi/);
assert.match(cleanupStep, /if: always\(\)/);
assert.match(cleanupStep, /osf-signed-canary-notarytool-dmg-\$GITHUB_RUN_ID\.json/);
assert.match(cleanupStep, /osf-signed-canary-notarytool-dmg-\$GITHUB_RUN_ID\.stderr/);
assert.match(cleanupStep, /osf-signed-canary-notarytool-zip-\$GITHUB_RUN_ID\.json/);
assert.match(cleanupStep, /osf-signed-canary-notarytool-zip-\$GITHUB_RUN_ID\.stderr/);
assert.match(cleanupStep, /osf-signed-canary-submitted-zip-\$GITHUB_RUN_ID\.zip/);
assert.match(cleanupStep, /osf-signed-canary-submitted-dmg-\$GITHUB_RUN_ID\.dmg/);
assert.match(distributionStep, /if ! rm -f -- "\$RUNNER_TEMP\/osf-signed-canary-notarytool-dmg-\$GITHUB_RUN_ID\.json"; then cleanup_status=1; fi/);
assert.match(distributionStep, /if ! rm -f -- "\$RUNNER_TEMP\/osf-signed-canary-notarytool-zip-\$GITHUB_RUN_ID\.json"; then cleanup_status=1; fi/);
assert.match(distributionStep, /if ! rm -f -- "\$RUNNER_TEMP\/osf-signed-canary-submitted-dmg-\$GITHUB_RUN_ID\.dmg"; then cleanup_status=1; fi/);
assert.match(distributionStep, /if ! rm -f -- "\$RUNNER_TEMP\/osf-signed-canary-submitted-zip-\$GITHUB_RUN_ID\.zip"; then cleanup_status=1; fi/);
assert.match(
  cleanupStep,
  /result_evidence="docs\/project-management\/evidence\/ci-\$\{GITHUB_RUN_ID\}-macos-signed-canary-result\.json"\s+cleanup_status=0\s+if ! rm -f -- "\$result_evidence"; then cleanup_status=1; fi/,
);
assert.doesNotMatch(workflow, /OSF_SIGNED_CANARY_NOTARY_OUTPUT/);
assert.doesNotMatch(workflow, /find "\$OSF_SIGNED_CANARY_OUTPUT_DIR"[^\n]*-name '\*\.app'/);
const artifactFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-signed-canary-artifact-selection-'));
try {
  const outputDirectory = path.join(artifactFixtureRoot, 'dist');
  const mainApp = path.join(outputDirectory, 'mac-arm64', '離線字幕工廠.app');
  const dmgPath = path.join(outputDirectory, 'offline-subtitle-factory-0.52.0-macos-arm64.dmg');
  const zipPath = path.join(outputDirectory, 'offline-subtitle-factory-0.52.0-macos-arm64.zip');
  fs.mkdirSync(path.join(mainApp, 'Contents', 'Frameworks', '離線字幕工廠 Helper.app'), { recursive: true });
  fs.writeFileSync(dmgPath, 'fixture');
  fs.writeFileSync(zipPath, 'fixture');
  assert.deepEqual(selectSignedCanaryArtifacts(outputDirectory), {
    appPath: mainApp,
    dmgPath,
    zipPath,
  });
  fs.mkdirSync(path.join(outputDirectory, 'mac-arm64', 'second.app'));
  assert.throws(() => selectSignedCanaryArtifacts(outputDirectory), /MAIN_APP_CARDINALITY_INVALID/);
  fs.rmSync(path.join(outputDirectory, 'mac-arm64', 'second.app'), { recursive: true, force: true });
  fs.writeFileSync(path.join(outputDirectory, 'second-macos-arm64.dmg'), 'fixture');
  assert.throws(() => selectSignedCanaryArtifacts(outputDirectory), /DMG_CARDINALITY_INVALID/);
  fs.rmSync(path.join(outputDirectory, 'second-macos-arm64.dmg'));
  fs.rmSync(zipPath);
  assert.throws(() => selectSignedCanaryArtifacts(outputDirectory), /ZIP_CARDINALITY_INVALID/);
  fs.writeFileSync(zipPath, 'fixture');
  fs.writeFileSync(path.join(outputDirectory, 'second-macos-arm64.zip'), 'fixture');
  assert.throws(() => selectSignedCanaryArtifacts(outputDirectory), /ZIP_CARDINALITY_INVALID/);
} finally {
  fs.rmSync(artifactFixtureRoot, { recursive: true, force: true });
}
console.log('macOS signed canary gate contract passed: identity, toolchain, source config and notarization fail-closed matrix');
