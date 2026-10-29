import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { inspectZipArchive, isBoundSubmittedDmg, isBoundSubmittedZip, readNotaryOutput, validateEvidence, writeEvidenceFile } from './audit-macos-signed-canary-distribution.mjs';

const hash = 'a'.repeat(64);
const fixture = {
  schema: 'offline-subtitle-factory.macos-signed-canary-distribution-audit.v1',
  startedAt: '2026-10-29T00:00:00.000Z',
  completedAt: '2026-10-29T00:00:01.000Z',
  environment: { platform: 'darwin', arch: 'arm64', node: 'v22', osRelease: 'test' },
  candidate: {
    appMetadataValid: true,
    appExecutableSha256: hash,
    dmgSha256: hash,
    zipSha256: hash,
    submittedDmgSha256: hash,
    submittedZipSha256: hash,
    zipAppExecutableSha256: hash,
  },
  notarytoolDmg: { commandSucceeded: false, status: 'unavailable', diagnosticSha256: 'd'.repeat(64), diagnosticBytes: 0 },
  notarytoolZip: { commandSucceeded: false, status: 'unavailable', diagnosticSha256: 'e'.repeat(64), diagnosticBytes: 0 },
  staplerApp: { commandSucceeded: false, status: 'invalid', diagnosticSha256: 'b'.repeat(64), diagnosticBytes: 0 },
  staplerDmg: { commandSucceeded: false, status: 'invalid', diagnosticSha256: 'f'.repeat(64), diagnosticBytes: 0 },
  archive: { commandSucceeded: false, status: 'invalid', diagnosticSha256: 'c'.repeat(64), diagnosticBytes: 0 },
  zipArchive: {
    commandSucceeded: false,
    embeddedAppCommandSucceeded: false,
    embeddedAppMatch: false,
    status: 'invalid',
    diagnosticSha256: '1'.repeat(64),
    diagnosticBytes: 0,
  },
  summary: {
    ready: false,
    reasons: ['dmg-notarytool-command-not-ready', 'zip-notarytool-command-not-ready', 'app-staple-not-ready', 'dmg-staple-not-ready', 'dmg-archive-not-ready', 'zip-archive-not-ready'],
    candidateReady: true,
    dmgNotarytoolReady: false,
    zipNotarytoolReady: false,
    appStaplerReady: false,
    dmgStaplerReady: false,
    archiveReady: false,
    zipArchiveReady: false,
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
diagnosticLeafMismatch.staplerDmg.status = 'valid';
assert.throws(() => validateEvidence(diagnosticLeafMismatch), /DISTRIBUTION_STAPLERDMG_SCHEMA_INVALID/);
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

const zipFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-signed-canary-zip-archive-'));
try {
  const appName = '離線字幕工廠.app';
  const executableName = '離線字幕工廠';
  const executablePath = path.join(zipFixtureRoot, appName, 'Contents', 'MacOS', executableName);
  fs.mkdirSync(path.dirname(executablePath), { recursive: true });
  fs.writeFileSync(executablePath, 'embedded-app-executable-fixture');
  const expectedExecutableHash = crypto.createHash('sha256').update(fs.readFileSync(executablePath)).digest('hex');
  const zipPath = path.join(zipFixtureRoot, 'candidate.zip');
  execFileSync('/usr/bin/zip', ['-q', '-r', zipPath, appName], { cwd: zipFixtureRoot });
  const memberName = `${appName}/Contents/MacOS/${executableName}`;
  const validZip = inspectZipArchive(zipPath, memberName, expectedExecutableHash);
  assert.equal(validZip.commandSucceeded, true);
  assert.equal(validZip.embeddedAppCommandSucceeded, true);
  assert.equal(validZip.embeddedAppMatch, true);
  assert.equal(validZip.status, 'valid');
  assert.equal(inspectZipArchive(zipPath, memberName, 'b'.repeat(64)).embeddedAppMatch, false);
  assert.equal(inspectZipArchive(zipPath, `${appName}/Contents/MacOS/missing`, expectedExecutableHash).status, 'invalid');
} finally {
  fs.rmSync(zipFixtureRoot, { recursive: true, force: true });
}

if (process.platform === 'darwin' && process.arch === 'arm64') {
  const auditFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-signed-canary-distribution-audit-'));
  const auditEvidencePath = path.resolve(`docs/project-management/evidence/focused-${process.pid}-macos-distribution-zip.json`);
  try {
    const appName = '離線字幕工廠.app';
    const executableName = '離線字幕工廠';
    const appExecutablePath = path.join(auditFixtureRoot, appName, 'Contents', 'MacOS', executableName);
    fs.mkdirSync(path.dirname(appExecutablePath), { recursive: true });
    fs.writeFileSync(path.join(auditFixtureRoot, appName, 'Contents', 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>CFBundleExecutable</key><string>${executableName}</string></dict></plist>\n`);
    fs.writeFileSync(appExecutablePath, 'distribution-audit-app-executable');
    const appExecutableHash = crypto.createHash('sha256').update(fs.readFileSync(appExecutablePath)).digest('hex');
    const dmgPath = path.join(auditFixtureRoot, 'candidate.dmg');
    fs.writeFileSync(dmgPath, 'distribution-audit-dmg');
    const dmgHash = crypto.createHash('sha256').update(fs.readFileSync(dmgPath)).digest('hex');
    const submittedDmgPath = path.join(auditFixtureRoot, 'osf-signed-canary-submitted-dmg-98765.dmg');
    fs.copyFileSync(dmgPath, submittedDmgPath);
    fs.chmodSync(submittedDmgPath, 0o600);
    const submittedDmgHash = crypto.createHash('sha256').update(fs.readFileSync(submittedDmgPath)).digest('hex');
    const zipPath = path.join(auditFixtureRoot, 'candidate-macos-arm64.zip');
    execFileSync('/usr/bin/zip', ['-q', '-r', zipPath, appName], { cwd: auditFixtureRoot });
    const submittedZipPath = path.join(auditFixtureRoot, 'osf-signed-canary-submitted-zip-98765.zip');
    fs.copyFileSync(zipPath, submittedZipPath);
    fs.chmodSync(submittedZipPath, 0o600);
    const submittedZipHash = crypto.createHash('sha256').update(fs.readFileSync(submittedZipPath)).digest('hex');
    const notaryDmgPath = path.join(auditFixtureRoot, 'osf-signed-canary-notarytool-dmg-98765.json');
    const notaryZipPath = path.join(auditFixtureRoot, 'osf-signed-canary-notarytool-zip-98765.json');
    fs.writeFileSync(notaryDmgPath, JSON.stringify({ id: 'redacted-dmg', status: 'Accepted', sha256: submittedDmgHash }), { mode: 0o600 });
    fs.writeFileSync(notaryZipPath, JSON.stringify({ id: 'redacted-zip', status: 'Accepted', sha256: submittedZipHash }), { mode: 0o600 });
    const auditResult = spawnSync(process.execPath, [
      path.resolve('scripts/audit-macos-signed-canary-distribution.mjs'),
      dmgPath,
      path.join(auditFixtureRoot, appName),
      zipPath,
      submittedDmgPath,
      submittedZipPath,
      auditEvidencePath,
      notaryDmgPath,
      notaryZipPath,
    ], {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_RUN_ID: '98765', RUNNER_TEMP: auditFixtureRoot },
    });
    assert.equal(auditResult.status, 1, `fixture distribution audit must fail only on fake stapler/archive: ${auditResult.stderr}`);
    const auditEvidence = JSON.parse(fs.readFileSync(auditEvidencePath, 'utf8'));
    assert.doesNotThrow(() => validateEvidence(auditEvidence));
    assert.equal(auditEvidence.status, 'fail');
    assert.equal(auditEvidence.candidate.appMetadataValid, true);
    assert.equal(auditEvidence.candidate.appExecutableSha256, appExecutableHash);
    assert.equal(auditEvidence.candidate.submittedDmgSha256, submittedDmgHash);
    assert.equal(auditEvidence.candidate.zipAppExecutableSha256, appExecutableHash);
    assert.equal(auditEvidence.notarytoolDmg.commandSucceeded, true);
    assert.equal(auditEvidence.notarytoolZip.commandSucceeded, true);
    assert.equal(auditEvidence.zipArchive.status, 'valid');
    assert.equal(auditEvidence.staplerDmg.commandSucceeded, false);
    assert.equal(fs.statSync(auditEvidencePath).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(auditEvidencePath, { force: true });
    fs.rmSync(auditFixtureRoot, { recursive: true, force: true });
  }
}

const writerFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-signed-canary-distribution-writer-'));
try {
  const evidencePath = path.join(writerFixtureRoot, 'evidence.json');
  writeEvidenceFile(evidencePath, fixture);
  assert.equal((fs.statSync(evidencePath).mode & 0o777), 0o600);
  assert.throws(() => writeEvidenceFile(evidencePath, fixture), /EEXIST/);
  const notaryDmgOutputPath = path.join(writerFixtureRoot, 'osf-signed-canary-notarytool-dmg-12345.json');
  const notaryZipOutputPath = path.join(writerFixtureRoot, 'osf-signed-canary-notarytool-zip-12345.json');
  const notaryOutput = JSON.stringify({ id: 'redacted-test-submission', status: 'Accepted', sha256: hash });
  fs.writeFileSync(notaryDmgOutputPath, notaryOutput, { mode: 0o600 });
  fs.writeFileSync(notaryZipOutputPath, notaryOutput, { mode: 0o600 });
  const previousRunId = process.env.GITHUB_RUN_ID;
  const previousRunnerTemp = process.env.RUNNER_TEMP;
  process.env.GITHUB_RUN_ID = '12345';
  process.env.RUNNER_TEMP = writerFixtureRoot;
  try {
    const submittedZipPath = path.join(writerFixtureRoot, 'osf-signed-canary-submitted-zip-12345.zip');
    const submittedDmgPath = path.join(writerFixtureRoot, 'osf-signed-canary-submitted-dmg-12345.dmg');
    fs.writeFileSync(submittedDmgPath, 'submitted-dmg-fixture', { mode: 0o600 });
    assert.equal(isBoundSubmittedDmg(submittedDmgPath), true);
    fs.chmodSync(submittedDmgPath, 0o644);
    assert.equal(isBoundSubmittedDmg(submittedDmgPath), false);
    fs.chmodSync(submittedDmgPath, 0o600);
    const submittedDmgLink = path.join(writerFixtureRoot, 'submitted-dmg-link.dmg');
    fs.symlinkSync(submittedDmgPath, submittedDmgLink);
    assert.equal(isBoundSubmittedDmg(submittedDmgLink), false);
    fs.unlinkSync(submittedDmgLink);
    fs.writeFileSync(submittedZipPath, 'submitted-zip-fixture', { mode: 0o600 });
    assert.equal(isBoundSubmittedZip(submittedZipPath), true);
    fs.chmodSync(submittedZipPath, 0o644);
    assert.equal(isBoundSubmittedZip(submittedZipPath), false);
    fs.chmodSync(submittedZipPath, 0o600);
    const submittedZipLink = path.join(writerFixtureRoot, 'submitted-zip-link.zip');
    fs.symlinkSync(submittedZipPath, submittedZipLink);
    assert.equal(isBoundSubmittedZip(submittedZipLink), false);
    fs.unlinkSync(submittedZipLink);
    const validNotary = readNotaryOutput(notaryDmgOutputPath, hash, 'dmg');
    assert.equal(validNotary.commandSucceeded, true);
    assert.equal(validNotary.diagnosticBytes, Buffer.byteLength(notaryOutput));
    assert.equal(validNotary.diagnosticSha256, crypto.createHash('sha256').update(notaryOutput).digest('hex'));
    assert.equal(readNotaryOutput(notaryZipOutputPath, hash, 'zip').commandSucceeded, true);
    assert.equal(readNotaryOutput(notaryDmgOutputPath, 'b'.repeat(64), 'dmg').commandSucceeded, false);
    assert.equal(readNotaryOutput(notaryDmgOutputPath, null, 'dmg').commandSucceeded, false);
    assert.equal(readNotaryOutput(path.join(writerFixtureRoot, 'forged.json'), hash, 'dmg').status, 'invalid');
    assert.equal(readNotaryOutput(path.join(os.tmpdir(), 'osf-signed-canary-notarytool-dmg-12345.json'), hash, 'dmg').status, 'invalid');
    const wrongRunPath = path.join(writerFixtureRoot, 'osf-signed-canary-notarytool-dmg-54321.json');
    fs.writeFileSync(wrongRunPath, notaryOutput, { mode: 0o600 });
    assert.equal(readNotaryOutput(wrongRunPath, hash, 'dmg').status, 'invalid');
    fs.writeFileSync(notaryDmgOutputPath, JSON.stringify({ id: 'redacted-test-submission', status: 'accepted', sha256: hash }), { mode: 0o600 });
    assert.equal(readNotaryOutput(notaryDmgOutputPath, hash, 'dmg').status, 'invalid');
    const malformedDmgOutput = Buffer.from('{malformed', 'utf8');
    fs.writeFileSync(notaryDmgOutputPath, malformedDmgOutput, { mode: 0o600 });
    const malformedDmgNotary = readNotaryOutput(notaryDmgOutputPath, hash, 'dmg');
    assert.equal(malformedDmgNotary.status, 'invalid');
    assert.equal(malformedDmgNotary.diagnosticBytes, malformedDmgOutput.byteLength);
    assert.equal(malformedDmgNotary.diagnosticSha256, crypto.createHash('sha256').update(malformedDmgOutput).digest('hex'));
    fs.writeFileSync(notaryDmgOutputPath, notaryOutput, { mode: 0o600 });
    const symlinkTarget = path.join(writerFixtureRoot, 'notary-output-target.json');
    fs.renameSync(notaryDmgOutputPath, symlinkTarget);
    fs.symlinkSync(symlinkTarget, notaryDmgOutputPath);
    assert.equal(readNotaryOutput(notaryDmgOutputPath, hash, 'dmg').status, 'invalid');
    fs.unlinkSync(notaryDmgOutputPath);
    fs.renameSync(symlinkTarget, notaryDmgOutputPath);
    const wrongZipRunPath = path.join(writerFixtureRoot, 'osf-signed-canary-notarytool-zip-54321.json');
    fs.writeFileSync(wrongZipRunPath, notaryOutput, { mode: 0o600 });
    assert.equal(readNotaryOutput(wrongZipRunPath, hash, 'zip').status, 'invalid');
    fs.chmodSync(notaryZipOutputPath, 0o644);
    assert.equal(readNotaryOutput(notaryZipOutputPath, hash, 'zip').status, 'invalid');
    fs.chmodSync(notaryZipOutputPath, 0o600);
    const malformedZipOutput = Buffer.from('{malformed-zip', 'utf8');
    fs.writeFileSync(notaryZipOutputPath, malformedZipOutput, { mode: 0o600 });
    const malformedZipNotary = readNotaryOutput(notaryZipOutputPath, hash, 'zip');
    assert.equal(malformedZipNotary.status, 'invalid');
    assert.equal(malformedZipNotary.diagnosticBytes, malformedZipOutput.byteLength);
    assert.equal(malformedZipNotary.diagnosticSha256, crypto.createHash('sha256').update(malformedZipOutput).digest('hex'));
    fs.writeFileSync(notaryZipOutputPath, notaryOutput, { mode: 0o600 });
    const zipSymlinkTarget = path.join(writerFixtureRoot, 'notary-zip-output-target.json');
    fs.renameSync(notaryZipOutputPath, zipSymlinkTarget);
    fs.symlinkSync(zipSymlinkTarget, notaryZipOutputPath);
    assert.equal(readNotaryOutput(notaryZipOutputPath, hash, 'zip').status, 'invalid');
    fs.unlinkSync(notaryZipOutputPath);
    fs.renameSync(zipSymlinkTarget, notaryZipOutputPath);
    const invalidUtf8 = Buffer.from([0xff, 0xfe, 0xfd]);
    fs.writeFileSync(notaryZipOutputPath, invalidUtf8, { mode: 0o600 });
    const invalidUtf8Notary = readNotaryOutput(notaryZipOutputPath, hash, 'zip');
    assert.equal(invalidUtf8Notary.status, 'invalid');
    assert.equal(invalidUtf8Notary.diagnosticBytes, invalidUtf8.byteLength);
    assert.equal(invalidUtf8Notary.diagnosticSha256, crypto.createHash('sha256').update(invalidUtf8).digest('hex'));
    delete process.env.GITHUB_RUN_ID;
    assert.equal(readNotaryOutput(notaryDmgOutputPath, hash, 'dmg').status, 'invalid');
  } finally {
    if (previousRunId === undefined) delete process.env.GITHUB_RUN_ID;
    else process.env.GITHUB_RUN_ID = previousRunId;
    if (previousRunnerTemp === undefined) delete process.env.RUNNER_TEMP;
    else process.env.RUNNER_TEMP = previousRunnerTemp;
  }
} finally {
  fs.rmSync(writerFixtureRoot, { recursive: true, force: true });
}

console.log('macOS signed canary distribution evidence contract passed: app/DMG/ZIP digests, dual notary projection, stapler/archive fail-closed schema and privacy matrix');
