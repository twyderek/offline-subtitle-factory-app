import assert from 'node:assert/strict';
import { shouldRetryWhisperOnCpu } from '../lib/whisper-fallback-policy.mjs';

assert.equal(shouldRetryWhisperOnCpu({ platform: 'darwin', arch: 'arm64', forceCpu: false, exitCode: 139 }), true);
assert.equal(shouldRetryWhisperOnCpu({ platform: 'darwin', arch: 'arm64', forceCpu: true, exitCode: 139 }), false);
assert.equal(shouldRetryWhisperOnCpu({ platform: 'win32', arch: 'x64', forceCpu: false, exitCode: 1 }), false);
assert.equal(shouldRetryWhisperOnCpu({ platform: 'darwin', arch: 'x64', forceCpu: false, exitCode: 1 }), false);
assert.equal(shouldRetryWhisperOnCpu({ platform: 'darwin', arch: 'arm64', forceCpu: false, exitCode: 0 }), false);
assert.equal(shouldRetryWhisperOnCpu({ platform: 'darwin', arch: 'arm64', forceCpu: false, exitCode: null }), true);
assert.equal(shouldRetryWhisperOnCpu({ platform: 'darwin', arch: 'arm64', forceCpu: false, exitCode: '0' }), true);
console.log('Whisper fallback 策略測試通過：平台、架構、forceCpu 與退出碼矩陣');
