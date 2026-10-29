import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  credentialPresenceKeys,
  summarizeCredentialPresence,
  summarizeIdentityAvailability,
  summarizeNotarizationCredentialState,
  summarizeSourceBuildConfig,
} from './audit-macos-signing-readiness.mjs';
import { loadSignedCanaryBuildConfig } from '../lib/macos-signed-canary-build-config.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const appDir = path.resolve(path.dirname(scriptPath), '..');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: appDir,
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 64 * 1024,
    env: { PATH: process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin' },
  });
  return {
    status: Number.isInteger(result.status) ? result.status : null,
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

function xcrunAvailable(tool) {
  const result = run('/usr/bin/xcrun', ['--find', tool]);
  return { commandSucceeded: result.status === 0 && !result.errorCode };
}

function safeCredentialPresence() {
  return summarizeCredentialPresence();
}

function hasExactBooleanKeys(value, expectedKeys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expectedKeys].sort())
    && expectedKeys.every((key) => typeof value[key] === 'boolean');
}

function validSourceConfigSummary(value) {
  const keys = [
    'identityConfiguration',
    'hardenedRuntimeConfigured',
    'gatekeeperAssessConfigured',
    'entitlementsConfigured',
    'macTargetConfigured',
    'sourceConfigReady',
  ];
  const identitySelectionReady = value?.identityConfiguration === 'auto-discovery'
    || value?.identityConfiguration === 'explicit-string';
  return value && typeof value === 'object'
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort())
    && typeof value.identityConfiguration === 'string'
    && hasExactBooleanKeys(Object.fromEntries(keys.slice(1).map((key) => [key, value[key]])), keys.slice(1))
    && identitySelectionReady
    && value.hardenedRuntimeConfigured === true
    && value.gatekeeperAssessConfigured === true
    && value.macTargetConfigured === true
    && value.sourceConfigReady === true;
}

export function evaluateFormalSignedCanaryReadiness({
  platform,
  arch,
  sourceConfig,
  identity,
  toolchain,
  credentialPresence,
  notarization,
}) {
  const reasons = [];
  const requiredToolchainReady = toolchain?.codesign?.executablePresent === true
    && toolchain?.xcrun?.executablePresent === true
    && toolchain?.xcrunCodesign?.commandSucceeded === true
    && toolchain?.xcrunNotarytool?.commandSucceeded === true;
  const identityReady = identity?.commandSucceeded === true
    && identity?.probeReady === true
    && identity?.probeStatus === 'ok'
    && identity?.formalIdentityAvailable === true
    && identity?.developerIdApplicationPresent === true
    && Number.isInteger(identity?.validIdentityCount)
    && identity.validIdentityCount > 0;
  const sourceConfigReady = validSourceConfigSummary(sourceConfig);
  const credentialKeysValid = hasExactBooleanKeys(credentialPresence, credentialPresenceKeys);
  const expectedNotarization = credentialKeysValid
    ? summarizeNotarizationCredentialState(credentialPresence)
    : null;
  const notarizationConsistent = expectedNotarization !== null
    && JSON.stringify(expectedNotarization) === JSON.stringify(notarization);
  const notarizationReady = notarizationConsistent
    && expectedNotarization.status === 'complete'
    && expectedNotarization.completeSetCount === 1
    && expectedNotarization.partialCredentialSetDetected === false
    && expectedNotarization.ready === true;

  if (platform !== 'darwin' || arch !== 'arm64') reasons.push('macOS-arm64-required');
  if (!sourceConfigReady) reasons.push('source-config-not-ready');
  if (!requiredToolchainReady) reasons.push('required-toolchain-not-ready');
  if (!identityReady) reasons.push('developer-id-application-not-ready');
  if (!notarizationReady) reasons.push('notarization-credential-set-not-ready');

  return {
    ready: reasons.length === 0,
    reasons,
    sourceConfigReady,
    requiredToolchainReady,
    identityReady,
    notarizationReady,
    notarizationStatus: notarizationConsistent ? expectedNotarization.status : 'invalid',
    notarizationConsistent,
  };
}

export function collectFormalSignedCanaryReadiness() {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') {
    return {
      platform: process.platform,
      arch: process.arch,
      sourceConfig: null,
      identity: null,
      toolchain: null,
      credentialPresence: null,
      notarization: null,
      evaluation: {
        ready: false,
        reasons: ['macOS-arm64-required'],
        sourceConfigReady: false,
        requiredToolchainReady: false,
        identityReady: false,
        notarizationReady: false,
        notarizationStatus: 'invalid',
        notarizationConsistent: false,
      },
    };
  }
  const sourceConfig = summarizeSourceBuildConfig(loadSignedCanaryBuildConfig(appDir).mac || {});
  const identityResult = run('/usr/bin/security', ['find-identity', '-v', '-p', 'codesigning']);
  const identity = summarizeIdentityAvailability(identityResult);
  const toolchain = {
    codesign: commandPresent('/usr/bin/codesign'),
    xcrun: commandPresent('/usr/bin/xcrun'),
    xcrunCodesign: xcrunAvailable('codesign'),
    xcrunNotarytool: xcrunAvailable('notarytool'),
  };
  const credentialPresence = safeCredentialPresence();
  const notarization = summarizeNotarizationCredentialState(credentialPresence);
  const evaluation = evaluateFormalSignedCanaryReadiness({
    platform: process.platform,
    arch: process.arch,
    sourceConfig,
    identity,
    toolchain,
    credentialPresence,
    notarization,
  });
  return {
    platform: process.platform,
    arch: process.arch,
    sourceConfig,
    identity,
    toolchain,
    credentialPresence,
    notarization,
    evaluation,
  };
}

function main() {
  const result = collectFormalSignedCanaryReadiness();
  const { evaluation, identity } = result;
  if (result.platform !== 'darwin' || result.arch !== 'arm64') {
    console.error('SIGNED_CANARY_GATE_BLOCKED:macOS-arm64-required');
    process.exitCode = 1;
    return;
  }
  const safeSummary = {
    ready: evaluation.ready,
    reasons: evaluation.reasons,
    sourceConfigReady: evaluation.sourceConfigReady,
    requiredToolchainReady: evaluation.requiredToolchainReady,
    identityProbeReady: identity.probeReady,
    formalIdentityAvailable: identity.formalIdentityAvailable,
    notarizationStatus: evaluation.notarizationStatus,
    notarizationCredentialReady: evaluation.notarizationReady,
    notarizationConsistent: evaluation.notarizationConsistent,
  };
  console.log(JSON.stringify(safeSummary));
  if (!evaluation.ready) {
    console.error(`SIGNED_CANARY_GATE_BLOCKED:${evaluation.reasons.join(',')}`);
    process.exitCode = 1;
    return;
  }
  console.log('SIGNED_CANARY_GATE_READY:builder may start isolated signed canary');
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
