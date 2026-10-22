import fs from 'node:fs';

export function summarizeWhisperStderr(value) {
  const lines = String(value || '').split(/\r?\n/).filter(Boolean);
  return {
    lineCount: lines.length,
    diagnosticLineCount: lines.filter((line) => /\b(?:warning|warn|error|failed|invalid)\b/i.test(line)).length,
    contentStored: false,
  };
}

export function safeProcessOutcome(result) {
  if (result?.signal) return `signal ${result.signal}`;
  if (Number.isInteger(result?.exitCode)) return `exit ${result.exitCode}`;
  if (result?.error) return 'process could not be started';
  return 'unknown process outcome';
}

export function safeProbeFailure() {
  return { message: 'Probe failed; detailed diagnostics omitted for privacy.', code: 'PROBE_FAILED' };
}

export function removeTempRootAndVerify(tempRoot, fileSystem = fs) {
  try {
    fileSystem.rmSync(tempRoot, { recursive: true, force: true });
  } catch {
    // Verify the path below; never persist a raw filesystem error or path.
  }
  try {
    fileSystem.lstatSync(tempRoot);
    return false;
  } catch (error) {
    return error?.code === 'ENOENT';
  }
}

export function recordTempRootCleanup(evidence, removed, integrityFailure = false) {
  evidence.outputs.tempRootRemoved = removed;
  if (!removed) {
    evidence.status = 'fail';
    evidence.error = {
      message: [evidence.error?.message, '無法確認 probe 暫存目錄已移除'].filter(Boolean).join('；'),
      code: integrityFailure ? 'FINALIZATION_FAILED' : 'TEMP_ROOT_CLEANUP_FAILED',
    };
  }
  return evidence;
}
