export function shouldRetryWhisperOnCpu({ platform, arch, forceCpu, exitCode }) {
  return platform === 'darwin' && arch === 'arm64' && !forceCpu && exitCode !== 0;
}
