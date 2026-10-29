import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceDir = path.join(appDir, 'docs', 'project-management', 'evidence');
const scriptPath = fileURLToPath(import.meta.url);
const repository = { owner: 'twyderek', name: 'offline-subtitle-factory-app' };
const branchName = 'codex/0.51-anthropic-claude';
const branchRef = `refs/heads/${branchName}`;
const environmentName = 'macos-signed-canary';
const workflowPath = '.github/workflows/macos-signed-canary.yml';
const requiredSecretNames = ['OSF_APPLE_ID', 'OSF_APPLE_APP_SPECIFIC_PASSWORD', 'OSF_APPLE_TEAM_ID'];
const auditSchema = 'offline-subtitle-factory.macos-signed-canary-external-boundary-audit.v1';
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

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 15000, maxBuffer: 128 * 1024 });
  return {
    status: typeof result.status === 'number' ? result.status : null,
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
    errorCode: result.error?.code || null,
  };
}

function classifyGhResult(result) {
  if (result && result.status === 0 && !result.errorCode) {
    try {
      const body = JSON.parse(result.stdout);
      if (!body || typeof body !== 'object' || Array.isArray(body)) return { status: 'invalid-response', body: null };
      return { status: 'ok', body };
    } catch {
      return { status: 'invalid-json', body: null };
    }
  }
  if (result?.errorCode === 'ETIMEDOUT' || result?.errorCode === 'ENOENT' || result?.status === null) {
    return { status: 'unavailable', body: null };
  }
  try {
    const diagnostic = JSON.parse(result?.stderr || '');
    if (diagnostic?.status === 404) return { status: 'not-found', body: null };
    if (diagnostic?.status === 403) return { status: 'forbidden', body: null };
  } catch {
    // Never persist or display raw gh diagnostics.
  }
  const stderr = typeof result?.stderr === 'string' ? result.stderr : '';
  if (/\b(?:HTTP\s*)?404\b/i.test(stderr) || /\bNot Found\b/i.test(stderr)) return { status: 'not-found', body: null };
  if (/\b(?:HTTP\s*)?403\b/i.test(stderr) || /\bForbidden\b/i.test(stderr)) return { status: 'forbidden', body: null };
  return { status: 'command-error', body: null };
}

function queryGitHubApi(endpoint) {
  return classifyGhResult(run('gh', ['api', '--hostname', 'github.com', endpoint]));
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function isGitSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
}

function hasExactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function projectRemoteBranch(response) {
  if (response.status !== 'ok') {
    return { status: response.status, present: response.status === 'not-found' ? false : null, sha: null };
  }
  if (response.body.ref !== branchRef || !isGitSha(response.body.object?.sha)) {
    return { status: 'invalid-response', present: null, sha: null };
  }
  return { status: 'ok', present: true, sha: response.body.object.sha };
}

function projectEnvironment(response) {
  if (response.status !== 'ok') {
    return {
      status: response.status,
      present: response.status === 'not-found' ? false : null,
      requiredReviewerRulePresent: response.status === 'not-found' ? false : null,
      deploymentBranchPolicyConfigured: response.status === 'not-found' ? false : null,
    };
  }
  if (!response.body || typeof response.body !== 'object') {
    return { status: 'invalid-response', present: null, requiredReviewerRulePresent: null, deploymentBranchPolicyConfigured: null };
  }
  const protectionRules = Array.isArray(response.body.protection_rules) ? response.body.protection_rules : [];
  const requiredReviewerRulePresent = protectionRules.some((rule) => {
    const type = typeof rule?.type === 'string' ? rule.type.toLowerCase().replace(/[-_]/g, ' ') : '';
    const reviewers = rule?.reviewers;
    const reviewerMetadataValid = Array.isArray(reviewers)
      && reviewers.length > 0
      && reviewers.every((reviewer) => reviewer
        && typeof reviewer === 'object'
        && !Array.isArray(reviewer)
        && ['user', 'team'].includes(typeof reviewer.type === 'string' ? reviewer.type.toLowerCase() : '')
        && Number.isInteger(reviewer.id)
        && reviewer.id > 0);
    return type === 'required reviewers' && reviewerMetadataValid;
  });
  const policy = response.body.deployment_branch_policy;
  const deploymentBranchPolicyConfigured = Boolean(policy && typeof policy === 'object' && !Array.isArray(policy)
    && (policy.protected_branches === true || policy.custom_branch_policies === true));
  return { status: 'ok', present: true, requiredReviewerRulePresent, deploymentBranchPolicyConfigured };
}

function projectEnvironmentSecrets(response) {
  if (response.status !== 'ok') {
    return {
      status: response.status,
      present: response.status === 'not-found' ? false : null,
      secretCount: null,
      requiredSecretNamesPresent: response.status === 'not-found' ? false : null,
    };
  }
  if (!Array.isArray(response.body.secrets)) {
    return { status: 'invalid-response', present: null, secretCount: null, requiredSecretNamesPresent: null };
  }
  const names = new Set(response.body.secrets.map((secret) => (typeof secret?.name === 'string' ? secret.name : null)));
  return {
    status: 'ok',
    present: true,
    secretCount: response.body.secrets.length,
    requiredSecretNamesPresent: requiredSecretNames.every((name) => names.has(name)),
  };
}

function projectBranchProtection(response) {
  if (response.status !== 'ok') {
    return {
      status: response.status,
      protected: response.status === 'not-found' ? false : null,
      requiredPullRequestReviewsConfigured: response.status === 'not-found' ? false : null,
    };
  }
  if (!response.body || typeof response.body !== 'object') {
    return { status: 'invalid-response', protected: null, requiredPullRequestReviewsConfigured: null };
  }
  return {
    status: 'ok',
    protected: true,
    requiredPullRequestReviewsConfigured: Boolean(response.body.required_pull_request_reviews),
  };
}

function projectWorkflow(response) {
  if (response.status !== 'ok') {
    return { status: response.status, present: response.status === 'not-found' ? false : null, sha: null };
  }
  if (response.body.path !== workflowPath || response.body.type !== 'file' || !isGitSha(response.body.sha)) {
    return { status: 'invalid-response', present: null, sha: null };
  }
  return { status: 'ok', present: true, sha: response.body.sha };
}

function reasonForUnavailable(status, foundReason, missingReason) {
  if (status === 'not-found') return missingReason;
  if (status === 'ok') return null;
  return foundReason;
}

function buildSummary(remoteBranch, environment, environmentSecrets, branchProtection, workflow, localSource) {
  const remoteSourceMatchesLocalHead = remoteBranch.present === true && isGitSha(remoteBranch.sha)
    ? remoteBranch.sha === localSource.head
    : null;
  const reasons = [];
  const remoteBranchReason = reasonForUnavailable(remoteBranch.status, 'remote-branch-not-verified', 'remote-branch-not-found');
  if (remoteBranchReason) reasons.push(remoteBranchReason);
  if (environment.present !== true) reasons.push(environment.present === false ? 'environment-not-configured' : 'environment-not-verified');
  if (environment.requiredReviewerRulePresent !== true) reasons.push('environment-required-reviewer-not-confirmed');
  if (environmentSecrets.requiredSecretNamesPresent !== true) reasons.push('environment-secret-scope-not-confirmed');
  if (branchProtection.protected !== true) reasons.push(branchProtection.protected === false ? 'branch-not-protected' : 'branch-protection-not-verified');
  if (workflow.present !== true) reasons.push(workflow.present === false ? 'workflow-not-on-remote' : 'workflow-not-verified');
  if (remoteSourceMatchesLocalHead !== true) reasons.push(remoteSourceMatchesLocalHead === false ? 'local-source-not-on-remote' : 'local-source-not-verified');
  return {
    ready: reasons.length === 0,
    reasons,
    environmentReady: environment.present === true && environment.requiredReviewerRulePresent === true,
    environmentSecretsReady: environmentSecrets.requiredSecretNamesPresent === true,
    branchProtectionReady: branchProtection.protected === true,
    workflowDeployed: workflow.present === true,
    remoteSourceMatchesLocalHead,
  };
}

function buildAuditEvidence({ responses, localSource, sourceRevision, startedAtValue, completedAtValue = new Date().toISOString() }) {
  const remoteBranch = projectRemoteBranch(responses.remoteBranch);
  const environment = projectEnvironment(responses.environment);
  const environmentSecrets = projectEnvironmentSecrets(responses.environmentSecrets);
  const branchProtection = projectBranchProtection(responses.branchProtection);
  const workflow = projectWorkflow(responses.workflow);
  const summary = buildSummary(remoteBranch, environment, environmentSecrets, branchProtection, workflow, localSource);
  const evidence = {
    schema: auditSchema,
    startedAt: startedAtValue,
    completedAt: completedAtValue,
    repository,
    branch: { name: branchName, ref: branchRef },
    remoteBranch,
    environment,
    environmentSecrets,
    branchProtection,
    workflow,
    localSource,
    summary,
    sourceRevision,
    scope: {
      remoteApiQueried: true,
      networkConnectionsAttempted: true,
      remoteStateModified: false,
      workflowTriggered: false,
      secretMetadataRead: true,
      secretValuesRead: false,
      secretValuesPersisted: false,
      rawCommandOutputPersisted: false,
      absolutePathsPersisted: false,
      identityNamesPersisted: false,
      reviewerNamesPersisted: false,
      candidateModified: false,
      signingAttempted: false,
      notarizationAttempted: false,
    },
    status: summary.ready ? 'pass' : 'fail',
    interpretation: 'This is a read-only external boundary audit. It records bounded remote response status, remote ref metadata, workflow presence and secret metadata count without storing secret values, reviewer names or raw API output; it does not configure GitHub, trigger CI, prove Apple signing or notarization, or establish FR-021 overall acceptance.',
  };
  validateEvidence(evidence);
  return evidence;
}

function projectLocalSource({ headResult, statusResult, workflowPresent, workflowSha256 }) {
  if (headResult.status !== 0 || headResult.errorCode || !isGitSha(headResult.stdout.trim())) fail('EXTERNAL_BOUNDARY_GIT_HEAD_UNAVAILABLE');
  if (statusResult.status !== 0 || statusResult.errorCode) fail('EXTERNAL_BOUNDARY_GIT_STATUS_UNAVAILABLE');
  return {
    head: headResult.stdout.trim(),
    workingTreeDirty: statusResult.stdout.length > 0,
    workflowPresent,
    workflowSha256,
  };
}

function collectLocalSource() {
  const headResult = run('/usr/bin/git', ['rev-parse', 'HEAD']);
  const statusResult = run('/usr/bin/git', ['status', '--porcelain']);
  const workflowAbsolutePath = path.join(appDir, workflowPath);
  const workflowPresent = fs.existsSync(workflowAbsolutePath);
  return projectLocalSource({
    headResult,
    statusResult,
    workflowPresent,
    workflowSha256: workflowPresent ? sha256File(workflowAbsolutePath) : null,
  });
}

function collectSourceRevision(localSource) {
  if (!isGitSha(localSource.head)) fail('EXTERNAL_BOUNDARY_LOCAL_HEAD_UNAVAILABLE');
  return {
    gitHead: localSource.head,
    workingTreeDirty: localSource.workingTreeDirty,
    auditScriptSha256: sha256File(scriptPath),
    packageJsonSha256: sha256File(path.join(appDir, 'package.json')),
    workflowSourceSha256: localSource.workflowSha256,
  };
}

function validateEvidence(evidence) {
  const topLevelKeys = ['schema', 'startedAt', 'completedAt', 'repository', 'branch', 'remoteBranch', 'environment', 'environmentSecrets', 'branchProtection', 'workflow', 'localSource', 'summary', 'sourceRevision', 'scope', 'status', 'interpretation'];
  const responseStatus = ['ok', 'not-found', 'forbidden', 'unavailable', 'invalid-json', 'invalid-response', 'command-error'];
  if (!hasExactKeys(evidence, topLevelKeys) || evidence.schema !== auditSchema) fail('EXTERNAL_BOUNDARY_SCHEMA_INVALID');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(evidence.startedAt)
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(evidence.completedAt)
    || Number.isNaN(Date.parse(evidence.startedAt))
    || Number.isNaN(Date.parse(evidence.completedAt))
    || Date.parse(evidence.completedAt) < Date.parse(evidence.startedAt)) fail('EXTERNAL_BOUNDARY_TIMESTAMP_INVALID');
  if (!hasExactKeys(evidence.repository, ['owner', 'name']) || evidence.repository.owner !== repository.owner || evidence.repository.name !== repository.name) fail('EXTERNAL_BOUNDARY_REPOSITORY_INVALID');
  if (!hasExactKeys(evidence.branch, ['name', 'ref']) || evidence.branch.name !== branchName || evidence.branch.ref !== branchRef) fail('EXTERNAL_BOUNDARY_BRANCH_INVALID');
  if (!hasExactKeys(evidence.remoteBranch, ['status', 'present', 'sha']) || !responseStatus.includes(evidence.remoteBranch.status) || ![true, false, null].includes(evidence.remoteBranch.present) || (evidence.remoteBranch.sha !== null && !isGitSha(evidence.remoteBranch.sha))) fail('EXTERNAL_BOUNDARY_REMOTE_BRANCH_INVALID');
  if (!hasExactKeys(evidence.environment, ['status', 'present', 'requiredReviewerRulePresent', 'deploymentBranchPolicyConfigured']) || !responseStatus.includes(evidence.environment.status) || ![true, false, null].includes(evidence.environment.present) || ![true, false, null].includes(evidence.environment.requiredReviewerRulePresent) || ![true, false, null].includes(evidence.environment.deploymentBranchPolicyConfigured)) fail('EXTERNAL_BOUNDARY_ENVIRONMENT_INVALID');
  if (!hasExactKeys(evidence.environmentSecrets, ['status', 'present', 'secretCount', 'requiredSecretNamesPresent']) || !responseStatus.includes(evidence.environmentSecrets.status) || ![true, false, null].includes(evidence.environmentSecrets.present) || (evidence.environmentSecrets.secretCount !== null && (!Number.isInteger(evidence.environmentSecrets.secretCount) || evidence.environmentSecrets.secretCount < 0)) || ![true, false, null].includes(evidence.environmentSecrets.requiredSecretNamesPresent)) fail('EXTERNAL_BOUNDARY_SECRETS_INVALID');
  if (!hasExactKeys(evidence.branchProtection, ['status', 'protected', 'requiredPullRequestReviewsConfigured']) || !responseStatus.includes(evidence.branchProtection.status) || ![true, false, null].includes(evidence.branchProtection.protected) || ![true, false, null].includes(evidence.branchProtection.requiredPullRequestReviewsConfigured)) fail('EXTERNAL_BOUNDARY_PROTECTION_INVALID');
  if (!hasExactKeys(evidence.workflow, ['status', 'present', 'sha']) || !responseStatus.includes(evidence.workflow.status) || ![true, false, null].includes(evidence.workflow.present) || (evidence.workflow.sha !== null && !isGitSha(evidence.workflow.sha))) fail('EXTERNAL_BOUNDARY_WORKFLOW_INVALID');
  if (!hasExactKeys(evidence.localSource, ['head', 'workingTreeDirty', 'workflowPresent', 'workflowSha256']) || !isGitSha(evidence.localSource.head) || typeof evidence.localSource.workingTreeDirty !== 'boolean' || typeof evidence.localSource.workflowPresent !== 'boolean' || (evidence.localSource.workflowSha256 !== null && !isSha256(evidence.localSource.workflowSha256))) fail('EXTERNAL_BOUNDARY_LOCAL_SOURCE_INVALID');
  const revisionKeys = ['gitHead', 'workingTreeDirty', 'auditScriptSha256', 'packageJsonSha256', 'workflowSourceSha256'];
  if (!hasExactKeys(evidence.sourceRevision, revisionKeys) || !isGitSha(evidence.sourceRevision.gitHead) || typeof evidence.sourceRevision.workingTreeDirty !== 'boolean' || !isSha256(evidence.sourceRevision.auditScriptSha256) || !isSha256(evidence.sourceRevision.packageJsonSha256) || (evidence.sourceRevision.workflowSourceSha256 !== null && !isSha256(evidence.sourceRevision.workflowSourceSha256))) fail('EXTERNAL_BOUNDARY_PROVENANCE_INVALID');
  if (evidence.sourceRevision.gitHead !== evidence.localSource.head || evidence.sourceRevision.workingTreeDirty !== evidence.localSource.workingTreeDirty || evidence.sourceRevision.workflowSourceSha256 !== evidence.localSource.workflowSha256) fail('EXTERNAL_BOUNDARY_PROVENANCE_MISMATCH');
  const summaryKeys = ['ready', 'reasons', 'environmentReady', 'environmentSecretsReady', 'branchProtectionReady', 'workflowDeployed', 'remoteSourceMatchesLocalHead'];
  if (!hasExactKeys(evidence.summary, summaryKeys) || typeof evidence.summary.ready !== 'boolean' || !Array.isArray(evidence.summary.reasons) || !evidence.summary.reasons.every((value) => typeof value === 'string') || typeof evidence.summary.environmentReady !== 'boolean' || typeof evidence.summary.environmentSecretsReady !== 'boolean' || typeof evidence.summary.branchProtectionReady !== 'boolean' || typeof evidence.summary.workflowDeployed !== 'boolean' || ![true, false, null].includes(evidence.summary.remoteSourceMatchesLocalHead)) fail('EXTERNAL_BOUNDARY_SUMMARY_INVALID');
  const expectedSummary = buildSummary(evidence.remoteBranch, evidence.environment, evidence.environmentSecrets, evidence.branchProtection, evidence.workflow, evidence.localSource);
  if (JSON.stringify(evidence.summary) !== JSON.stringify(expectedSummary) || evidence.status !== (evidence.summary.ready ? 'pass' : 'fail')) fail('EXTERNAL_BOUNDARY_SUMMARY_MISMATCH');
  const scopeKeys = ['remoteApiQueried', 'networkConnectionsAttempted', 'remoteStateModified', 'workflowTriggered', 'secretMetadataRead', 'secretValuesRead', 'secretValuesPersisted', 'rawCommandOutputPersisted', 'absolutePathsPersisted', 'identityNamesPersisted', 'reviewerNamesPersisted', 'candidateModified', 'signingAttempted', 'notarizationAttempted'];
  if (!hasExactKeys(evidence.scope, scopeKeys) || evidence.scope.remoteApiQueried !== true || evidence.scope.networkConnectionsAttempted !== true || evidence.scope.secretMetadataRead !== true || Object.entries(evidence.scope).some(([key, value]) => !['remoteApiQueried', 'networkConnectionsAttempted', 'secretMetadataRead'].includes(key) && value !== false)) fail('EXTERNAL_BOUNDARY_SCOPE_NOT_FAIL_CLOSED');
  if (!['pass', 'fail'].includes(evidence.status) || typeof evidence.interpretation !== 'string' || evidence.interpretation.length === 0) fail('EXTERNAL_BOUNDARY_INTERPRETATION_INVALID');
  if (/(?:^|[\s"'=:(\[,])\/(?:[^\s"'`]+(?:\/[^\s"`]+)*)|[A-Za-z]:[\\/]|\\\\|sk-[A-Za-z0-9]|-----BEGIN/i.test(JSON.stringify(evidence))) fail('EXTERNAL_BOUNDARY_LEAKAGE_DETECTED');
  return true;
}

function writeEvidenceFile(outputPath, evidence) {
  validateEvidence(evidence);
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
}

export {
  buildAuditEvidence,
  classifyGhResult,
  projectLocalSource,
  projectBranchProtection,
  projectEnvironment,
  projectEnvironmentSecrets,
  projectRemoteBranch,
  projectWorkflow,
  validateEvidence,
  writeEvidenceFile,
};

function main() {
  const outputArgument = process.argv[2];
  if (!outputArgument) fail('EXTERNAL_BOUNDARY_EVIDENCE_PATH_REQUIRED');
  const outputPath = path.resolve(outputArgument);
  if (!outputPath.startsWith(`${evidenceDir}${path.sep}`) || path.extname(outputPath) !== '.json') fail('EXTERNAL_BOUNDARY_EVIDENCE_PATH_INVALID');
  if (fs.existsSync(outputPath)) fail('EXTERNAL_BOUNDARY_EVIDENCE_ALREADY_EXISTS');
  const localSource = collectLocalSource();
  const sourceRevision = collectSourceRevision(localSource);
  const apiRoot = `repos/${repository.owner}/${repository.name}`;
  const responses = {
    remoteBranch: queryGitHubApi(`${apiRoot}/git/ref/heads/${branchName}`),
    environment: queryGitHubApi(`${apiRoot}/environments/${environmentName}`),
    environmentSecrets: queryGitHubApi(`${apiRoot}/environments/${environmentName}/secrets`),
    branchProtection: queryGitHubApi(`${apiRoot}/branches/${encodeURIComponent(branchName)}/protection`),
    workflow: queryGitHubApi(`${apiRoot}/contents/${workflowPath}?ref=${encodeURIComponent(branchName)}`),
  };
  const evidence = buildAuditEvidence({ responses, localSource, sourceRevision, startedAtValue: startedAt });
  writeEvidenceFile(outputPath, evidence);
  console.log(`macOS signed canary external boundary audit ${evidence.status}: ${path.basename(outputPath)}`);
  if (!evidence.summary.ready) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
