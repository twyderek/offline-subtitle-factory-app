import assert from 'node:assert/strict';
import {
  describeWhisperProcessFailure,
  isWhisperProcessFailure,
  parseWhisperFallbackLogMarkers,
  shouldRetryWhisperOnCpu,
} from '../lib/whisper-fallback-policy.mjs';
import { sanitizeDiagnosticOutput } from '../lib/whisper-probe-diagnostics.mjs';

assert.equal(shouldRetryWhisperOnCpu({ platform: 'darwin', arch: 'arm64', forceCpu: false, exitCode: 139 }), true);
assert.equal(shouldRetryWhisperOnCpu({ platform: 'darwin', arch: 'arm64', forceCpu: false, exitCode: 1 }), true);
assert.equal(shouldRetryWhisperOnCpu({ platform: 'darwin', arch: 'arm64', forceCpu: false, exitCode: null, signal: 'SIGSEGV' }), true);
assert.equal(shouldRetryWhisperOnCpu({ platform: 'darwin', arch: 'arm64', forceCpu: true, exitCode: 139 }), false);
assert.equal(shouldRetryWhisperOnCpu({ platform: 'darwin', arch: 'arm64', forceCpu: true, exitCode: null, signal: 'SIGSEGV' }), false);
assert.equal(shouldRetryWhisperOnCpu({ platform: 'win32', arch: 'x64', forceCpu: false, exitCode: 1 }), false);
assert.equal(shouldRetryWhisperOnCpu({ platform: 'darwin', arch: 'x64', forceCpu: false, exitCode: 1 }), false);
assert.equal(shouldRetryWhisperOnCpu({ platform: 'darwin', arch: 'arm64', forceCpu: false, exitCode: 0 }), false);
assert.equal(shouldRetryWhisperOnCpu({ platform: 'darwin', arch: 'arm64', forceCpu: false, exitCode: null }), false);
assert.equal(shouldRetryWhisperOnCpu({ platform: 'darwin', arch: 'arm64', forceCpu: false, exitCode: '0' }), false);
assert.equal(shouldRetryWhisperOnCpu({ platform: 'darwin', arch: 'arm64', forceCpu: false, exitCode: Number.NaN }), false);

assert.equal(isWhisperProcessFailure({ exitCode: 139 }), true);
assert.equal(isWhisperProcessFailure({ exitCode: null, signal: 'SIGSEGV' }), true);
assert.equal(isWhisperProcessFailure({ exitCode: 0, signal: null }), false);
assert.equal(isWhisperProcessFailure({ exitCode: null, signal: '' }), false);
assert.equal(describeWhisperProcessFailure({ exitCode: 139 }), 'exit 139');
assert.equal(describeWhisperProcessFailure({ exitCode: null, signal: 'SIGSEGV' }), 'signal SIGSEGV');
assert.equal(describeWhisperProcessFailure({ exitCode: null, signal: null }), 'unknown process failure');

assert.deepEqual(parseWhisperFallbackLogMarkers('Metal exit 139，開始 CPU fallback'), {
  metalFailure: true,
  metalExit: true,
  metalExit139: true,
  metalSignal: false,
  cpuFallback: true,
  fallbackObserved: true,
});
assert.equal(parseWhisperFallbackLogMarkers('Metal exit 1，開始 CPU fallback').fallbackObserved, true);
assert.equal(parseWhisperFallbackLogMarkers('Metal signal SIGSEGV，開始 CPU fallback').fallbackObserved, true);
assert.equal(parseWhisperFallbackLogMarkers('Metal exit 0，開始 CPU fallback').fallbackObserved, false);
assert.equal(parseWhisperFallbackLogMarkers('Metal signal SIGSEGV').fallbackObserved, false);

const diagnosticSamples = [
  'authorization: "SECRET VALUE"',
  'token=SECRET VALUE',
  'Bearer SECRET VALUE',
  'Basic SECRET VALUE',
  '/tmp/osf-whisper-real-fallback/private.wav',
  '/private/tmp/osf-whisper-real-fallback/private.wav',
];
for (const sample of diagnosticSamples) {
  const sanitized = sanitizeDiagnosticOutput(sample);
  assert.equal(sanitized.includes('SECRET VALUE'), false, `credential leaked: ${sample}`);
  assert.equal(sanitized.includes('/tmp/'), false, `temporary path leaked: ${sample}`);
}
const probeToken = 'probe-token-secret-value';
assert.equal(sanitizeDiagnosticOutput(`server output ${probeToken}`, [probeToken]).includes(probeToken), false);
assert.ok(sanitizeDiagnosticOutput('x'.repeat(2000)).length <= 1600);

console.log('Whisper fallback 策略測試通過：平台、架構、forceCpu、非零退出、終止 signal 與 log marker 矩陣');
