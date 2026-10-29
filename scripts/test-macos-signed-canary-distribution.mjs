import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readNotaryOutput, validateEvidence, writeEvidenceFile } from './audit-macos-signed-canary-distribution.mjs';

const hash = 'a'.repeat(64);
const fixture = {
  schema: 'offline-subtitle-factory.macos-signed-canary-distribution-audit.v1',
  startedAt: '2026-10-29T00:00:00.000Z',
  completedAt: '2026-10-29T00:00:01.000Z',
  environment: { platform: 'darwin', arch: 'arm64', node: 'v22', osRelease: 'test' },
  candidate: { appMetadataValid: true, appExecutableSha256: hash, dmgSha256: hash },
  notarytool: { commandSucceeded: false, status: 'unavailable', diagnosticSha256: 'd'.repeat(64), diagnosticBytes: 0 },
  stapler: { commandSucceeded: false, status: 'invalid', diagnosticSha256: 'b'.repeat(64), diagnosticBytes: 0 },
  archive: { commandSucceeded: false, status: 'invalid', diagnosticSha256: 'c'.repeat(64), diagnosticBytes: 0 },
  summary: {
    ready: false,
    reasons: ['notarytool-command-not-ready', 'dmg-staple-not-ready', 'dmg-archive-not-ready'],
    candidateReady: true,
    notarytoolReady: false,
    staplerReady: false,
    archiveReady: false,
  },
  sourceRevision: {
    gitHead: 'a'.repeat(40),
    workingTreeDirty: false,
    auditScriptSha256: hash,
    selectorModuleSha256: hash,
    packageJsonSha256: hash,
    packageLockSha256: hash,
  },
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
  status: 'fail',
  interpretation: 'test',
};

assert.doesNotThrow(() => validateEvidence(fixture));
assert.throws(() => validateEvidence({ ...fixture, extra: true }), /DISTRIBUTION_EVIDENCE_SCHEMA_INVALID/);
const candidateDigestMismatch = structuredClone(fixture);
candidateDigestMismatch.summary.candidateReady = true;
candidateDigestMismatch.candidate.appMetadataValid = true;
candidateDigestMismatch.candidate.appExecutableSha256 = null;
assert.throws(() => validateEvidence(candidateDigestMismatch), /DISTRIBUTION_CANDIDATE_SCHEMA_INVALID/);
const candidateReadyWithoutDigest = structuredClone(fixture);
candidateReadyWithoutDigest.summary.candidateReady = false;
candidateReadyWithoutDigest.candidate.appMetadataValid = false;
candidateReadyWithoutDigest.candidate.appExecutableSha256 = hash;
assert.throws(() => validateEvidence(candidateReadyWithoutDigest), /DISTRIBUTION_CANDIDATE_SCHEMA_INVALID/);
const diagnosticLeafMismatch = structuredClone(fixture);
diagnosticLeafMismatch.stapler.status = 'valid';
assert.throws(() => validateEvidence(diagnosticLeafMismatch), /DISTRIBUTION_STAPLER_SCHEMA_INVALID/);
const summaryLeafMismatch = structuredClone(fixture);
summaryLeafMismatch.summary.archiveReady = true;
assert.throws(() => validateEvidence(summaryLeafMismatch), /DISTRIBUTION_SUMMARY_STATUS_MISMATCH/);
const forgedPass = structuredClone(fixture);
forgedPass.summary.ready = true;
forgedPass.summary.reasons = [];
forgedPass.status = 'pass';
assert.throws(() => validateEvidence(forgedPass), /DISTRIBUTION_SUMMARY_STATUS_MISMATCH/);
const leakedPath = structuredClone(fixture);
leakedPath.interpretation = '/private/secret';
assert.throws(() => validateEvidence(leakedPath), /DISTRIBUTION_LEAKAGE_DETECTED/);
const timestampMismatch = structuredClone(fixture);
timestampMismatch.completedAt = '2026-10-28T23:59:59.000Z';
assert.throws(() => validateEvidence(timestampMismatch), /DISTRIBUTION_TIMESTAMP_SCHEMA_INVALID/);
for (const field of ['node', 'osRelease']) {
  for (const value of [null, '', 42]) {
    const invalidEnvironment = structuredClone(fixture);
    invalidEnvironment.environment[field] = value;
    assert.throws(() => validateEvidence(invalidEnvironment), /DISTRIBUTION_ENVIRONMENT_SCHEMA_INVALID/);
  }
}
for (const value of [null, '']) {
  const invalidInterpretation = structuredClone(fixture);
  invalidInterpretation.interpretation = value;
  assert.throws(() => validateEvidence(invalidInterpretation), /DISTRIBUTION_SCOPE_NOT_FAIL_CLOSED/);
}
const dirty = structuredClone(fixture);
dirty.sourceRevision.workingTreeDirty = true;
assert.doesNotThrow(() => validateEvidence(dirty));
assert.equal(fs.existsSync('docs/project-management/evidence'), true);

const writerFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-signed-canary-distribution-writer-'));
try {
  const evidencePath = path.join(writerFixtureRoot, 'evidence.json');
  writeEvidenceFile(evidencePath, fixture);
  assert.equal((fs.statSync(evidencePath).mode & 0o777), 0o600);
  assert.throws(() => writeEvidenceFile(evidencePath, fixture), /EEXIST/);
  const notaryOutputPath = path.join(writerFixtureRoot, 'osf-signed-canary-notarytool-12345.json');
  const notaryOutput = JSON.stringify({ id: 'redacted-test-submission', status: 'Accepted', sha256: hash });
  fs.writeFileSync(notaryOutputPath, notaryOutput, { mode: 0o600 });
  const previousRunId = process.env.GITHUB_RUN_ID;
  const previousRunnerTemp = process.env.RUNNER_TEMP;
  process.env.GITHUB_RUN_ID = '12345';
  process.env.RUNNER_TEMP = writerFixtureRoot;
  try {
    const validNotary = readNotaryOutput(notaryOutputPath, hash);
    assert.equal(validNotary.commandSucceeded, true);
    assert.equal(validNotary.diagnosticBytes, Buffer.byteLength(notaryOutput));
    assert.equal(validNotary.diagnosticSha256, crypto.createHash('sha256').update(notaryOutput).digest('hex'));
    assert.equal(readNotaryOutput(notaryOutputPath, 'b'.repeat(64)).commandSucceeded, false);
    assert.equal(readNotaryOutput(path.join(writerFixtureRoot, 'forged.json'), hash).status, 'invalid');
    assert.equal(readNotaryOutput(path.join(os.tmpdir(), 'osf-signed-canary-notarytool-12345.json'), hash).status, 'invalid');
    const wrongRunPath = path.join(writerFixtureRoot, 'osf-signed-canary-notarytool-54321.json');
    fs.writeFileSync(wrongRunPath, notaryOutput, { mode: 0o600 });
    assert.equal(readNotaryOutput(wrongRunPath, hash).status, 'invalid');
    fs.writeFileSync(notaryOutputPath, JSON.stringify({ id: 'redacted-test-submission', status: 'accepted', sha256: hash }), { mode: 0o600 });
    assert.equal(readNotaryOutput(notaryOutputPath, hash).status, 'invalid');
    fs.writeFileSync(notaryOutputPath, '{malformed', { mode: 0o600 });
    assert.equal(readNotaryOutput(notaryOutputPath, hash).status, 'invalid');
    fs.writeFileSync(notaryOutputPath, notaryOutput, { mode: 0o600 });
    const symlinkTarget = path.join(writerFixtureRoot, 'notary-output-target.json');
    fs.renameSync(notaryOutputPath, symlinkTarget);
    fs.symlinkSync(symlinkTarget, notaryOutputPath);
    assert.equal(readNotaryOutput(notaryOutputPath, hash).status, 'invalid');
    fs.unlinkSync(notaryOutputPath);
    fs.renameSync(symlinkTarget, notaryOutputPath);
    delete process.env.GITHUB_RUN_ID;
    assert.equal(readNotaryOutput(notaryOutputPath, hash).status, 'invalid');
  } finally {
    if (previousRunId === undefined) delete process.env.GITHUB_RUN_ID;
    else process.env.GITHUB_RUN_ID = previousRunId;
    if (previousRunnerTemp === undefined) delete process.env.RUNNER_TEMP;
    else process.env.RUNNER_TEMP = previousRunnerTemp;
  }
} finally {
  fs.rmSync(writerFixtureRoot, { recursive: true, force: true });
}

console.log('macOS signed canary distribution evidence contract passed: app/DMG digests, notary projection, stapler/archive fail-closed schema and privacy matrix');
