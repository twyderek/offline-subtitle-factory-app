import assert from 'node:assert/strict';
import { recordTempRootCleanup, removeTempRootAndVerify, safeProcessOutcome, safeProbeFailure, summarizeWhisperStderr } from './whisper-long-media-evidence.mjs';

const canary = 'PRIVATE_TRANSCRIPT_CANARY_7F3A';
const stderr = [
  'whisper warning: diagnostic fixture',
  `[00:00:00.000 --> 00:00:01.000] ${canary}`,
  `Error: ${canary}`,
].join('\n');
const summary = summarizeWhisperStderr(stderr);
const serializedSummary = JSON.stringify(summary);
assert.deepEqual(summary, { lineCount: 3, diagnosticLineCount: 2, contentStored: false });
assert.equal(serializedSummary.includes(canary), false, 'stderr summary must not store transcript-like canary text');
assert.equal(safeProcessOutcome({ exitCode: 7, stderr }), 'exit 7');
assert.equal(safeProcessOutcome({ signal: 'SIGSEGV', stderr }), 'signal SIGSEGV');
assert.equal(safeProcessOutcome({ error: new Error(canary), stderr }), 'process could not be started');
assert.equal(JSON.stringify(safeProcessOutcome({ error: new Error(canary) })).includes(canary), false, 'failure summary must not store process error text');
assert.equal(JSON.stringify(safeProbeFailure(new Error(`/Volumes/${canary}/nested/source.srt`))).includes(canary), false, 'probe failure summary must not store custom source paths');

const noEntry = Object.assign(new Error('not found'), { code: 'ENOENT' });
const denied = Object.assign(new Error('permission denied'), { code: 'EACCES' });
assert.equal(removeTempRootAndVerify('/tmp/synthetic-removed', {
  rmSync() {},
  lstatSync() { throw noEntry; },
}), true, 'cleanup must pass only when the path is confirmed missing');
assert.equal(removeTempRootAndVerify('/tmp/synthetic-remains', {
  rmSync() { throw new Error(canary); },
  lstatSync() { return {}; },
}), false, 'cleanup must fail when the path remains');
assert.equal(removeTempRootAndVerify('/tmp/synthetic-unverifiable', {
  rmSync() { throw new Error(canary); },
  lstatSync() { throw denied; },
}), false, 'cleanup must fail when removal cannot be verified');
const cleanupFailureEvidence = { status: 'pass', outputs: { tempRootRemoved: true }, error: null };
recordTempRootCleanup(cleanupFailureEvidence, false);
assert.equal(cleanupFailureEvidence.status, 'fail', 'unconfirmed temp cleanup must fail probe evidence');
assert.equal(cleanupFailureEvidence.error.code, 'TEMP_ROOT_CLEANUP_FAILED');
assert.equal(cleanupFailureEvidence.outputs.tempRootRemoved, false);

console.log('Whisper evidence 隱私測試通過：stderr 與 process failure 摘要不保留字幕 canary');
