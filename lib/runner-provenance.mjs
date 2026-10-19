const SAFE_ENV_NAMES = new Set([
  'PATH',
  'HOME',
  'TMPDIR',
  'LANG',
  'SUBTITLE_AI_API_KEY',
  'SUBTITLE_AI_KEYS_JSON',
  'ELECTRON_NO_ATTACH_CONSOLE',
]);

const SAFE_CANDIDATE_BASENAME = /^[A-Za-z0-9._ -]{1,128}$/;
const SAFE_DIAGNOSTIC_PORT = /^--remote-debugging-port=(\d{1,5})$/;
const SAFE_REDACTED_ENV = /^([A-Z][A-Z0-9_]*)=<redacted>$/;
const SAFE_CANDIDATE_EXECUTABLE = /^<candidate-executable:([A-Za-z0-9._ -]{1,128})>$/;

function isSafeRunnerArgvToken(value) {
  if (value === '-p' || value === '/usr/bin/env' || value === '<outer-sandbox-profile>'
    || value === '<temporary-user-data>' || value === '--user-data-dir=<temporary-user-data>') {
    return true;
  }
  const portMatch = value.match(SAFE_DIAGNOSTIC_PORT);
  if (portMatch) {
    const port = Number(portMatch[1]);
    return Number.isInteger(port) && port >= 1024 && port <= 65535;
  }
  const candidateMatch = value.match(SAFE_CANDIDATE_EXECUTABLE);
  if (candidateMatch) return SAFE_CANDIDATE_BASENAME.test(candidateMatch[1]);
  const redactedEnvMatch = value.match(SAFE_REDACTED_ENV);
  return Boolean(redactedEnvMatch && SAFE_ENV_NAMES.has(redactedEnvMatch[1]));
}

export function sanitizeRunnerArgv(argv) {
  if (!Array.isArray(argv)) {
    return { argv: [], argvRedactionValidated: false, argvDroppedCount: 0, argvInputCount: null };
  }

  const safeArgv = argv.filter((item) => typeof item === 'string' && item.length <= 512 && isSafeRunnerArgvToken(item));
  const argvDroppedCount = argv.length - safeArgv.length;
  const boundedArgv = safeArgv.slice(0, 32);
  const truncatedCount = safeArgv.length - boundedArgv.length;
  return {
    argv: boundedArgv,
    argvRedactionValidated: argv.length > 0 && argvDroppedCount === 0 && truncatedCount === 0,
    argvDroppedCount: argvDroppedCount + truncatedCount,
    argvInputCount: argv.length,
  };
}
