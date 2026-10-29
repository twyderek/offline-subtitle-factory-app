import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildAuditEvidence,
  classifyGhResult,
  projectLocalSource,
  validateEvidence,
  writeEvidenceFile,
} from './audit-macos-signed-canary-external-boundary.mjs';

const gitSha = 'a'.repeat(40);
const remoteSha = 'b'.repeat(40);
const contentSha = 'c'.repeat(40);
const hash = 'd'.repeat(64);
const localSource = { head: gitSha, workingTreeDirty: true, workflowPresent: true, workflowSha256: hash };
const sourceRevision = {
  gitHead: gitSha,
  workingTreeDirty: true,
  auditScriptSha256: hash,
  packageJsonSha256: hash,
  workflowSourceSha256: hash,
};
const timestamps = { startedAtValue: '2026-10-29T00:00:00.000Z', completedAtValue: '2026-10-29T00:00:01.000Z' };

const completeResponses = {
  remoteBranch: { status: 'ok', body: { ref: 'refs/heads/codex/0.51-anthropic-claude', object: { sha: gitSha } } },
  environment: {
    status: 'ok',
    body: {
      protection_rules: [{ type: 'Required reviewers', reviewers: [{ type: 'User', id: 1, login: 'private-reviewer' }] }],
      deployment_branch_policy: { protected_branches: true, custom_branch_policies: false },
    },
  },
  environmentSecrets: {
    status: 'ok',
    body: {
      total_count: 0,
      secrets: [],
    },
  },
  branchProtection: { status: 'ok', body: { required_pull_request_reviews: { required_approving_review_count: 1 } } },
  workflow: { status: 'ok', body: { path: '.github/workflows/macos-signed-canary.yml', type: 'file', sha: contentSha } },
};

const completeEvidence = buildAuditEvidence({ responses: completeResponses, localSource, sourceRevision, ...timestamps });
assert.doesNotThrow(() => validateEvidence(completeEvidence));
assert.equal(completeEvidence.status, 'pass');
assert.deepEqual(completeEvidence.summary.reasons, []);
assert.equal(completeEvidence.environmentSecrets.secretCount, 0);
assert.equal(JSON.stringify(completeEvidence).includes('private-reviewer'), false);
assert.equal(JSON.stringify(completeEvidence).includes('OSF_APPLE_ID'), false);

for (const reviewers of [[], undefined, { id: 1 }]) {
  const reviewerFixture = structuredClone(completeResponses);
  const rule = { type: 'required_reviewers' };
  if (reviewers !== undefined) rule.reviewers = reviewers;
  reviewerFixture.environment = { status: 'ok', body: { protection_rules: [rule], deployment_branch_policy: { protected_branches: true, custom_branch_policies: false } } };
  const reviewerEvidence = buildAuditEvidence({ responses: reviewerFixture, localSource, sourceRevision, ...timestamps });
  assert.equal(reviewerEvidence.environment.requiredReviewerRulePresent, false);
  assert.equal(reviewerEvidence.summary.environmentReady, false);
  assert.equal(reviewerEvidence.status, 'fail');
}

const externalMissingResponses = structuredClone(completeResponses);
externalMissingResponses.remoteBranch.body.object.sha = remoteSha;
externalMissingResponses.environment = { status: 'not-found', body: null };
externalMissingResponses.environmentSecrets = { status: 'not-found', body: null };
externalMissingResponses.branchProtection = { status: 'not-found', body: null };
externalMissingResponses.workflow = { status: 'not-found', body: null };
const missingEvidence = buildAuditEvidence({ responses: externalMissingResponses, localSource, sourceRevision, ...timestamps });
assert.equal(missingEvidence.status, 'fail');
assert.deepEqual(missingEvidence.summary.reasons, [
  'environment-not-configured',
  'environment-required-reviewer-not-confirmed',
  'environment-secret-scope-not-confirmed',
  'branch-not-protected',
  'workflow-not-on-remote',
  'local-source-not-on-remote',
]);
assert.doesNotThrow(() => validateEvidence(missingEvidence));

assert.deepEqual(classifyGhResult({ status: 0, stdout: '{"ref":"safe"}', stderr: '', errorCode: null }), { status: 'ok', body: { ref: 'safe' } });
assert.deepEqual(classifyGhResult({ status: 1, stdout: '', stderr: '{"message":"Not Found","status":404}', errorCode: null }), { status: 'not-found', body: null });
assert.deepEqual(classifyGhResult({ status: 1, stdout: '', stderr: 'gh: Not Found (HTTP 404)', errorCode: null }), { status: 'not-found', body: null });
assert.deepEqual(classifyGhResult({ status: 1, stdout: '', stderr: '{"message":"Forbidden","status":403}', errorCode: null }), { status: 'forbidden', body: null });
assert.deepEqual(classifyGhResult({ status: 1, stdout: '', stderr: 'private diagnostic with token', errorCode: null }), { status: 'command-error', body: null });
assert.deepEqual(classifyGhResult({ status: 0, stdout: '{malformed', stderr: '', errorCode: null }), { status: 'invalid-json', body: null });
assert.deepEqual(classifyGhResult({ status: null, stdout: '', stderr: '', errorCode: 'ETIMEDOUT' }), { status: 'unavailable', body: null });
assert.throws(() => projectLocalSource({
  headResult: { status: 0, stdout: gitSha, errorCode: null },
  statusResult: { status: 1, stdout: '', errorCode: 'EIO' },
  workflowPresent: true,
  workflowSha256: hash,
}), /EXTERNAL_BOUNDARY_GIT_STATUS_UNAVAILABLE/);

const invalidResponses = structuredClone(completeResponses);
invalidResponses.environmentSecrets = { status: 'ok', body: {} };
const partialSecretsEvidence = buildAuditEvidence({ responses: invalidResponses, localSource, sourceRevision, ...timestamps });
assert.equal(partialSecretsEvidence.environmentSecrets.requiredSecretNamesPresent, null);
assert.equal(partialSecretsEvidence.status, 'fail');
assert.throws(() => validateEvidence({ ...completeEvidence, scope: { ...completeEvidence.scope, secretValuesPersisted: true } }), /EXTERNAL_BOUNDARY_SCOPE_NOT_FAIL_CLOSED/);
assert.throws(() => validateEvidence({ ...completeEvidence, branch: { ...completeEvidence.branch, name: 'other' } }), /EXTERNAL_BOUNDARY_BRANCH_INVALID/);
assert.throws(() => validateEvidence({ ...completeEvidence, interpretation: '/private/raw-api-output' }), /EXTERNAL_BOUNDARY_LEAKAGE_DETECTED/);

const writerRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-external-boundary-writer-'));
try {
  const evidencePath = path.join(writerRoot, 'evidence.json');
  writeEvidenceFile(evidencePath, completeEvidence);
  assert.equal((fs.statSync(evidencePath).mode & 0o777), 0o600);
  assert.throws(() => writeEvidenceFile(evidencePath, completeEvidence), /EEXIST/);
} finally {
  fs.rmSync(writerRoot, { recursive: true, force: true });
}

console.log('macOS signed canary external boundary contract passed: bounded GitHub projections, secret redaction, remote-state gaps and exclusive evidence writer');
