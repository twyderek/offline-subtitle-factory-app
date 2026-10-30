const SAFE_ENV_NAMES = new Set([
  'PATH',
  'HOME',
  'TMPDIR',
  'LANG',
  'SUBTITLE_AI_API_KEY',
  'SUBTITLE_AI_KEYS_JSON',
  'ELECTRON_NO_ATTACH_CONSOLE',
]);

const SAFE_BASENAME = /^(?!\.{1,2}$)[^/\\\u0000-\u001f\u007f]{1,128}$/u;
const SAFE_CANDIDATE_BASENAME = SAFE_BASENAME;
const SAFE_COMMAND_BASENAME = SAFE_BASENAME;
const SAFE_SHA256 = /^[a-f0-9]{64}$/i;
const SAFE_COMMIT = /^[a-f0-9]{40}$/i;
const SAFE_MODEL = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;
const SAFE_FRAMEWORK_RELATIVE_PATH = 'Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework';
const SAFE_DIAGNOSTIC_PORT = /^--remote-debugging-port=(\d{1,5})$/;
const SAFE_REDACTED_ENV = /^([A-Z][A-Z0-9_]*)=<redacted>$/;
const SAFE_CANDIDATE_EXECUTABLE = /^<candidate-executable:([^/\\\u0000-\u001f\u007f]{1,128})>$/u;
const SAFE_REPLAY_SCRIPT = 'scripts/verify-electron-ollama-ui.mjs';
const SAFE_REPLAY_COMMAND = 'node';
const SAFE_REPLAY_COMMAND_TEMPLATE = 'node scripts/verify-electron-ollama-ui.mjs <candidate-executable> <debug-port> <timeout-ms> <evidence-output> <ollama-model>';

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

// Keep command identity useful for localized executable names without ever
// persisting a path, control character, or unbounded runner-supplied value.
export function sanitizeRunnerCommand(command) {
  if (typeof command !== 'string' || !SAFE_COMMAND_BASENAME.test(command)) return null;
  return command;
}

function sanitizeRunnerSha256(value) {
  return typeof value === 'string' && SAFE_SHA256.test(value) ? value : null;
}

function sanitizeReplayText(value, pattern = SAFE_BASENAME) {
  return typeof value === 'string' && pattern.test(value) ? value : null;
}

function sanitizeReplayPort(value) {
  return Number.isInteger(value) && value >= 1024 && value <= 65535 ? value : null;
}

function sanitizeReplayTimeout(value) {
  return Number.isFinite(value) && value >= 5000 && value <= 600000 ? value : null;
}

function sanitizeDiagnosticCategories(categories) {
  return Array.isArray(categories)
    ? categories.filter((item) => /^[A-Z0-9_]+$/.test(String(item))).slice(0, 8)
    : [];
}

export function projectRunnerProvenance({
  command,
  argv,
  sandboxedTargetProcessTree,
  outerSandboxProfileApplied,
  candidateExecutableSha256,
  candidateReviewScriptSha256,
  candidateFrameworkSha256,
  candidateFrameworkPresent,
  candidateFrameworkRelativePath,
  childOutputSha256,
  childOutputBytes,
  captureLimitBytes,
  startupDiagnosticCategories,
  rawChildOutputPersisted,
} = {}) {
  const safeArgvProjection = sanitizeRunnerArgv(argv);
  return {
    command: sanitizeRunnerCommand(command),
    argv: Array.isArray(safeArgvProjection.argv) ? safeArgvProjection.argv : [],
    argvRedactionValidated: safeArgvProjection.argvRedactionValidated === true,
    argvDroppedCount: Number.isInteger(safeArgvProjection.argvDroppedCount) ? safeArgvProjection.argvDroppedCount : null,
    argvInputCount: Number.isInteger(safeArgvProjection.argvInputCount) ? safeArgvProjection.argvInputCount : null,
    sandboxedTargetProcessTree: sandboxedTargetProcessTree === true,
    outerSandboxProfileApplied: outerSandboxProfileApplied === true,
    candidateExecutableSha256: sanitizeRunnerSha256(candidateExecutableSha256),
    candidateReviewScriptSha256: sanitizeRunnerSha256(candidateReviewScriptSha256),
    candidateFrameworkSha256: sanitizeRunnerSha256(candidateFrameworkSha256),
    candidateFrameworkPresent: candidateFrameworkPresent === true,
    candidateFrameworkRelativePath: candidateFrameworkRelativePath === SAFE_FRAMEWORK_RELATIVE_PATH
      ? candidateFrameworkRelativePath : null,
    childOutputSha256: sanitizeRunnerSha256(childOutputSha256),
    childOutputBytes: Number.isInteger(childOutputBytes) ? childOutputBytes : null,
    captureLimitBytes: Number.isInteger(captureLimitBytes) ? captureLimitBytes : null,
    startupDiagnosticCategories: sanitizeDiagnosticCategories(startupDiagnosticCategories),
    rawChildOutputPersisted: rawChildOutputPersisted === true,
  };
}

export function projectReplayProvenance({
  sourceHeadCommit,
  worktreeDirty,
  worktreeStatusSha256,
  runnerScriptSha256,
  runnerProvenanceModuleSha256,
  packageManifestSha256,
  packageVersion,
  command,
  script,
  scenario,
  model,
  debugPort,
  timeoutMs,
  platform,
  arch,
  node,
  osRelease,
  preLaunchExecutableSha256,
  preLaunchReviewScriptSha256,
  preLaunchFrameworkSha256,
  loadedExecutableSha256,
  loadedReviewScriptSha256,
  loadedFrameworkSha256,
} = {}) {
  const safeCommand = command === SAFE_REPLAY_COMMAND ? SAFE_REPLAY_COMMAND : null;
  const safeScript = script === SAFE_REPLAY_SCRIPT ? SAFE_REPLAY_SCRIPT : null;
  const safeScenario = ['complete', 'cancel-resume', 'cancel-resume-restart'].includes(scenario) ? scenario : null;
  const safeModel = sanitizeReplayText(model, SAFE_MODEL);
  const safePlatform = sanitizeReplayText(platform);
  const safeArch = sanitizeReplayText(arch);
  const safeNode = sanitizeReplayText(node, /^[A-Za-z0-9._+-]{1,64}$/u);
  const safeOsRelease = sanitizeReplayText(osRelease, /^[A-Za-z0-9._+-]{1,128}$/u);
  const safePackageVersion = sanitizeReplayText(packageVersion, /^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/u);
  const invocation = {
    command: safeCommand,
    script: safeScript,
    commandTemplate: safeCommand && safeScript ? SAFE_REPLAY_COMMAND_TEMPLATE : null,
    scenario: safeScenario,
    model: safeModel,
    debugPort: sanitizeReplayPort(debugPort),
    timeoutMs: sanitizeReplayTimeout(timeoutMs),
    candidateExecutable: '<candidate-executable>',
    evidenceOutput: '<exclusive-evidence-output>',
  };
  const sourceRevision = {
    headCommit: sanitizeReplayText(sourceHeadCommit, SAFE_COMMIT),
    worktreeDirty: typeof worktreeDirty === 'boolean' ? worktreeDirty : null,
    worktreeStatusSha256: sanitizeRunnerSha256(worktreeStatusSha256),
  };
  const sourceBytes = {
    runnerScriptSha256: sanitizeRunnerSha256(runnerScriptSha256),
    runnerProvenanceModuleSha256: sanitizeRunnerSha256(runnerProvenanceModuleSha256),
    packageManifestSha256: sanitizeRunnerSha256(packageManifestSha256),
    packageVersion: safePackageVersion,
  };
  const environment = {
    platform: safePlatform,
    arch: safeArch,
    node: safeNode,
    osRelease: safeOsRelease,
  };
  const loadedBytes = {
    executableSha256: sanitizeRunnerSha256(loadedExecutableSha256),
    reviewScriptSha256: sanitizeRunnerSha256(loadedReviewScriptSha256),
    electronFrameworkSha256: sanitizeRunnerSha256(loadedFrameworkSha256),
  };
  const preLaunchBytes = {
    executableSha256: sanitizeRunnerSha256(preLaunchExecutableSha256),
    reviewScriptSha256: sanitizeRunnerSha256(preLaunchReviewScriptSha256),
    electronFrameworkSha256: sanitizeRunnerSha256(preLaunchFrameworkSha256),
  };
  const loadedBytesMatchPreLaunch = Boolean(
    preLaunchBytes.executableSha256 && loadedBytes.executableSha256
      && preLaunchBytes.executableSha256 === loadedBytes.executableSha256
      && preLaunchBytes.reviewScriptSha256 && loadedBytes.reviewScriptSha256
      && preLaunchBytes.reviewScriptSha256 === loadedBytes.reviewScriptSha256
      && preLaunchBytes.electronFrameworkSha256 && loadedBytes.electronFrameworkSha256
      && preLaunchBytes.electronFrameworkSha256 === loadedBytes.electronFrameworkSha256
  );
  const sourceProvenanceComplete = Boolean(
    sourceRevision.headCommit
      && typeof sourceRevision.worktreeDirty === 'boolean'
      && sourceRevision.worktreeStatusSha256
      && sourceBytes.runnerScriptSha256
      && sourceBytes.runnerProvenanceModuleSha256
      && sourceBytes.packageManifestSha256
      && sourceBytes.packageVersion
      && invocation.command
      && invocation.script
      && invocation.scenario
      && invocation.model
      && invocation.debugPort
      && invocation.timeoutMs
      && environment.platform
      && environment.arch
      && environment.node
      && environment.osRelease
  );
  const provenanceComplete = Boolean(
    sourceProvenanceComplete
      && preLaunchBytes.executableSha256
      && preLaunchBytes.reviewScriptSha256
      && preLaunchBytes.electronFrameworkSha256
      && loadedBytes.executableSha256
      && loadedBytes.reviewScriptSha256
      && loadedBytes.electronFrameworkSha256
      && loadedBytesMatchPreLaunch
  );
  return {
    schema: 'offline-subtitle-factory.ollama-ui-replay-provenance.v1',
    sourceProvenanceComplete,
    provenanceComplete,
    sourceRevision,
    sourceBytes,
    invocation,
    environment,
    preLaunchBytes,
    loadedBytes,
    loadedBytesObservation: loadedBytes.executableSha256 ? 'renderer-ready-file-read' : null,
    loadedBytesMatchPreLaunch,
  };
}
