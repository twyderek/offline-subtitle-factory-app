function normalizedSignal(signal) {
  return typeof signal === 'string' && signal.trim() ? signal.trim() : '';
}

export function isWhisperProcessFailure({ exitCode, signal }) {
  return (Number.isInteger(exitCode) && exitCode !== 0) || Boolean(normalizedSignal(signal));
}

export function describeWhisperProcessFailure({ exitCode, signal }) {
  const normalized = normalizedSignal(signal);
  if (normalized) return `signal ${normalized}`;
  if (Number.isInteger(exitCode)) return `exit ${exitCode}`;
  return 'unknown process failure';
}

export function shouldRetryWhisperOnCpu({ platform, arch, forceCpu, exitCode, signal }) {
  return platform === 'darwin'
    && arch === 'arm64'
    && !forceCpu
    && isWhisperProcessFailure({ exitCode, signal });
}

export function parseWhisperFallbackLogMarkers(value) {
  const logs = String(value || '');
  const metalExit = /Metal exit (?:-[0-9]+|[1-9][0-9]*)\b/.test(logs);
  const metalSignal = /Metal signal [A-Za-z][A-Za-z0-9]*\b/.test(logs);
  const cpuFallback = logs.includes('CPU fallback');
  return {
    metalFailure: metalExit || metalSignal,
    metalExit,
    metalExit139: logs.includes('Metal exit 139'),
    metalSignal,
    cpuFallback,
    fallbackObserved: (metalExit || metalSignal) && cpuFallback,
  };
}
