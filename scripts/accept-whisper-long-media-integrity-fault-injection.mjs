import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toolsDir = path.join(appDir, 'tools');
const outputPath = path.resolve(process.argv[2] || 'docs/project-management/evidence/2026-09-23-whisper-long-media-integrity-fault-injection.json');
const cases = [
  { name: 'input-media-hash-mismatch', target: 'media', mutation: 'modify', expectedCode: 'INPUT_MEDIA_MODIFIED', scopeKey: 'originalVideoModified' },
  { name: 'input-media-missing', target: 'media', mutation: 'remove', expectedCode: 'INPUT_MEDIA_MODIFIED', scopeKey: 'originalVideoModified' },
  { name: 'source-srt-hash-mismatch', target: 'srt', mutation: 'modify', expectedCode: 'SOURCE_SRT_MODIFIED', scopeKey: 'originalSrtModified' },
  { name: 'source-srt-missing', target: 'srt', mutation: 'remove', expectedCode: 'SOURCE_SRT_MODIFIED', scopeKey: 'originalSrtModified' },
];

function linkTool(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.symlinkSync(source, destination);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 120_000, ...options });
  if (result.error) throw result.error;
  return result;
}

assert.equal(process.platform, 'darwin', 'fault-injection acceptance requires macOS');
assert.equal(process.arch, 'arm64', 'fault-injection acceptance requires Apple Silicon');
assert.equal(fs.existsSync(outputPath), false, `Refusing to overwrite existing evidence: ${outputPath}`);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-whisper-integrity-faults-'));
const results = [];
try {
const syntheticTools = path.join(tempRoot, 'tools');
const fakeRuntime = path.join(tempRoot, 'fake-whisper-runtime.cjs');
const cleanupFailurePreload = path.join(tempRoot, 'cleanup-failure-preload.cjs');
const ffmpegPath = path.join(toolsDir, 'ffmpeg', 'bin', 'ffmpeg');
const ffprobePath = path.join(toolsDir, 'ffmpeg', 'bin', 'ffprobe');
const modelPath = path.join(toolsDir, 'whisper-models', 'ggml-tiny.bin');
assert.ok(fs.existsSync(ffmpegPath) && fs.existsSync(ffprobePath) && fs.existsSync(modelPath), 'Bundled FFmpeg/FFprobe/Tiny model are required');

fs.writeFileSync(fakeRuntime, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const target = process.env.OSF_INTEGRITY_TARGET;
const mutation = process.env.OSF_INTEGRITY_MUTATION;
if (mutation === 'remove') fs.unlinkSync(target);
if (mutation === 'modify') {
  const bytes = fs.readFileSync(target);
  bytes[0] ^= 0xff;
  fs.writeFileSync(target, bytes);
}
const outputIndex = args.indexOf('-of');
if (outputIndex < 0 || !args[outputIndex + 1]) process.exit(21);
const base = args[outputIndex + 1];
fs.writeFileSync(base + '.srt', '1\\n00:00:00,000 --> 00:00:01,000\\nsynthetic fixture\\n');
fs.writeFileSync(base + '.json', JSON.stringify({ segments: [{ start: 0, end: 1, text: 'synthetic fixture' }] }));
`);
fs.chmodSync(fakeRuntime, 0o755);
fs.writeFileSync(cleanupFailurePreload, `
const fs = require('node:fs');
const path = require('node:path');
const originalRmSync = fs.rmSync.bind(fs);
const originalMkdtempSync = fs.mkdtempSync.bind(fs);
const cleanupTargetRoot = path.resolve(process.env.OSF_CLEANUP_TARGET_ROOT);
const isProbeTempRoot = (target) => path.resolve(String(target)) === cleanupTargetRoot;
fs.mkdtempSync = (prefix, ...args) => {
  if (path.basename(String(prefix)).startsWith('osf-whisper-long-media-')) {
    fs.mkdirSync(cleanupTargetRoot);
    return cleanupTargetRoot;
  }
  return originalMkdtempSync(prefix, ...args);
};
fs.rmSync = (target, options) => {
  if (isProbeTempRoot(target)) {
    const error = new Error('PRIVATE_CLEANUP_DIAGNOSTIC_CANARY');
    error.code = 'EACCES';
    throw error;
  }
  return originalRmSync(target, options);
};
`);
linkTool(ffmpegPath, path.join(syntheticTools, 'ffmpeg', 'bin', 'ffmpeg'));
linkTool(ffprobePath, path.join(syntheticTools, 'ffmpeg', 'bin', 'ffprobe'));
linkTool(modelPath, path.join(syntheticTools, 'whisper-models', 'ggml-tiny.bin'));
linkTool(fakeRuntime, path.join(syntheticTools, 'whisper-cpp', 'whisper-cli'));

const mediaTemplate = path.join(tempRoot, 'synthetic-input.wav');
const tone = run(ffmpegPath, [
  '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
  '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', mediaTemplate,
]);
assert.equal(tone.status, 0, tone.stderr || 'Unable to create synthetic input audio');

  for (const scenario of cases) {
    const caseRoot = path.join(tempRoot, scenario.name);
    fs.mkdirSync(caseRoot, { recursive: true });
    const mediaPath = path.join(caseRoot, 'synthetic-input.wav');
    const sourceSrtPath = path.join(caseRoot, 'synthetic-input.wav.edited.srt');
    const caseEvidencePath = path.join(caseRoot, 'probe-evidence.json');
    fs.copyFileSync(mediaTemplate, mediaPath);
    fs.writeFileSync(sourceSrtPath, 'source fixture bytes\n');

    const result = run(process.execPath, [
      path.join(appDir, 'scripts', 'verify-whisper-long-media.mjs'),
      mediaPath,
      'tiny',
      caseEvidencePath,
      sourceSrtPath,
    ], {
      cwd: appDir,
      env: {
        ...process.env,
        OFFLINE_SUBTITLE_TOOLS_DIR: syntheticTools,
        OSF_INTEGRITY_TARGET: scenario.target === 'media' ? mediaPath : sourceSrtPath,
        OSF_INTEGRITY_MUTATION: scenario.mutation,
      },
    });
    assert.equal(result.status, 1, `${scenario.name}: probe should fail closed`);
    const evidence = JSON.parse(fs.readFileSync(caseEvidencePath, 'utf8'));
    assert.equal(evidence.status, 'fail', `${scenario.name}: evidence status`);
    assert.deepEqual(evidence.integrityViolations, [scenario.expectedCode], `${scenario.name}: violation code`);
    assert.equal(evidence.scope[scenario.scopeKey], true, `${scenario.name}: modified flag`);
    assert.equal(evidence.outputs.tempRootRemoved, true, `${scenario.name}: probe temp cleanup`);
    assert.equal(evidence.error.code, scenario.expectedCode, `${scenario.name}: error code`);
    results.push({
      case: scenario.name,
      expectedProbeExitCode: 1,
      actualProbeExitCode: result.status,
      integrityViolations: evidence.integrityViolations,
      integrityFlag: scenario.scopeKey,
      integrityFlagValue: evidence.scope[scenario.scopeKey],
      tempRootRemoved: evidence.outputs.tempRootRemoved,
      result: 'pass',
    });
  }

  const privacyCaseRoot = path.join(tempRoot, 'custom-source-srt-path');
  fs.mkdirSync(privacyCaseRoot, { recursive: true });
  const privacyMediaPath = path.join(privacyCaseRoot, 'synthetic-input.wav');
  const privateSourceSrtPath = path.join(privacyCaseRoot, 'PRIVATE_TRANSCRIPT_CANARY', 'nested', 'missing-source.srt');
  const privacyEvidencePath = path.join(privacyCaseRoot, 'probe-evidence.json');
  fs.copyFileSync(mediaTemplate, privacyMediaPath);
  const privacyResult = run(process.execPath, [
    path.join(appDir, 'scripts', 'verify-whisper-long-media.mjs'),
    privacyMediaPath,
    'tiny',
    privacyEvidencePath,
    privateSourceSrtPath,
  ], {
    cwd: appDir,
    env: { ...process.env, OFFLINE_SUBTITLE_TOOLS_DIR: syntheticTools },
  });
  assert.equal(privacyResult.status, 1, 'missing custom source SRT must fail');
  const privacyEvidence = JSON.parse(fs.readFileSync(privacyEvidencePath, 'utf8'));
  assert.equal(privacyEvidence.status, 'fail', 'missing custom source SRT evidence status');
  assert.equal(privacyEvidence.error.code, 'PROBE_FAILED', 'missing custom source SRT failure code');
  assert.equal(privacyEvidence.outputs.tempRootRemoved, true, 'privacy case temp cleanup');
  assert.equal(JSON.stringify(privacyEvidence).includes('PRIVATE_TRANSCRIPT_CANARY'), false, 'evidence must not retain custom source path');
  results.push({
    case: 'custom-source-srt-path-redacted',
    expectedProbeExitCode: 1,
    actualProbeExitCode: privacyResult.status,
    evidenceCode: privacyEvidence.error.code,
    tempRootRemoved: privacyEvidence.outputs.tempRootRemoved,
    canaryStored: false,
    result: 'pass',
  });

  const basenameCaseRoot = path.join(tempRoot, 'custom-source-srt-basename');
  fs.mkdirSync(basenameCaseRoot, { recursive: true });
  const basenameMediaPath = path.join(basenameCaseRoot, 'synthetic-input.wav');
  const basenameSourceSrtPath = path.join(basenameCaseRoot, 'PRIVATE_TRANSCRIPT_CANARY.edited.srt');
  const basenameEvidencePath = path.join(basenameCaseRoot, 'probe-evidence.json');
  fs.copyFileSync(mediaTemplate, basenameMediaPath);
  fs.writeFileSync(basenameSourceSrtPath, 'source fixture bytes\n');
  const basenameResult = run(process.execPath, [
    path.join(appDir, 'scripts', 'verify-whisper-long-media.mjs'),
    basenameMediaPath,
    'tiny',
    basenameEvidencePath,
    basenameSourceSrtPath,
  ], {
    cwd: appDir,
    env: { ...process.env, OFFLINE_SUBTITLE_TOOLS_DIR: syntheticTools },
  });
  assert.equal(basenameResult.status, 0, 'custom source SRT basename replay should pass');
  const basenameEvidence = JSON.parse(fs.readFileSync(basenameEvidencePath, 'utf8'));
  assert.equal(basenameEvidence.input.sourceSrt.fileName, 'source.srt', 'evidence must use a non-identifying SRT label');
  assert.equal(JSON.stringify(basenameEvidence).includes('PRIVATE_TRANSCRIPT_CANARY'), false, 'evidence must not retain custom source SRT basename');
  results.push({
    case: 'custom-source-srt-basename-redacted',
    expectedProbeExitCode: 0,
    actualProbeExitCode: basenameResult.status,
    sourceSrtEvidenceLabel: basenameEvidence.input.sourceSrt.fileName,
    canaryStored: false,
    result: 'pass',
  });

  const cleanupCaseRoot = path.join(tempRoot, 'cleanup-failure');
  fs.mkdirSync(cleanupCaseRoot, { recursive: true });
  const cleanupMediaPath = path.join(cleanupCaseRoot, 'synthetic-input.wav');
  const cleanupSourceSrtPath = path.join(cleanupCaseRoot, 'synthetic-input.wav.edited.srt');
  const cleanupEvidencePath = path.join(cleanupCaseRoot, 'probe-evidence.json');
  const cleanupTempRoot = path.join(cleanupCaseRoot, 'osf-whisper-long-media-probe-fixture');
  assert.equal(fs.existsSync(cleanupTempRoot), false, 'fixed probe temp root must not already exist');
  fs.copyFileSync(mediaTemplate, cleanupMediaPath);
  fs.writeFileSync(cleanupSourceSrtPath, 'source fixture bytes\n');
  const cleanupResult = run(process.execPath, [
    path.join(appDir, 'scripts', 'verify-whisper-long-media.mjs'),
    cleanupMediaPath,
    'tiny',
    cleanupEvidencePath,
    cleanupSourceSrtPath,
  ], {
    cwd: appDir,
    env: {
      ...process.env,
      OFFLINE_SUBTITLE_TOOLS_DIR: syntheticTools,
      OSF_CLEANUP_TARGET_ROOT: cleanupTempRoot,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require=${cleanupFailurePreload}`].filter(Boolean).join(' '),
    },
  });
  let cleanupCaseResult = null;
  try {
    assert.equal(cleanupResult.status, 1, 'failed probe temp removal must return failure');
    assert.equal(path.dirname(cleanupTempRoot), cleanupCaseRoot, 'probe temp root must be the preselected direct child of its isolated case directory');
    assert.equal(fs.lstatSync(cleanupTempRoot).isDirectory(), true, 'probe temp root must really remain after injected rmSync failure');
    const cleanupEvidence = JSON.parse(fs.readFileSync(cleanupEvidencePath, 'utf8'));
    assert.equal(cleanupEvidence.status, 'fail', 'failed removal evidence status');
    assert.equal(cleanupEvidence.outputs.tempRootRemoved, false, 'failed removal cleanup flag');
    assert.equal(cleanupEvidence.error.code, 'TEMP_ROOT_CLEANUP_FAILED', 'failed removal error code');
    assert.equal(JSON.stringify(cleanupEvidence).includes('PRIVATE_CLEANUP_DIAGNOSTIC_CANARY'), false, 'evidence must not retain cleanup error text');
    cleanupCaseResult = {
      case: 'probe-cleanup-removal-failed-root-remains',
      expectedProbeExitCode: 1,
      actualProbeExitCode: cleanupResult.status,
      evidenceCode: cleanupEvidence.error.code,
      tempRootRemoved: cleanupEvidence.outputs.tempRootRemoved,
      tempRootPathPreselected: true,
      tempRootPresentBeforeHarnessCleanup: true,
      diagnosticCanaryStored: false,
      result: 'pass',
    };
  } finally {
    fs.rmSync(cleanupTempRoot, { recursive: true, force: true });
  }
  assert.throws(() => fs.lstatSync(cleanupTempRoot), (error) => error?.code === 'ENOENT', 'harness must remove the intentionally retained temp root');
  cleanupCaseResult.tempRootRemovedByHarness = true;
  results.push(cleanupCaseResult);

  const evidence = {
    schema: 'offline-subtitle-factory.whisper-long-media-integrity-fault-injection.v5',
    createdAt: new Date().toISOString(),
    environment: { platform: process.platform, arch: process.arch, node: process.version },
    testRuntime: 'synthetic-whisper-cli-wrapper',
    originalMediaRead: false,
    originalSrtRead: false,
    transcriptStored: false,
    cases: results,
    result: 'pass',
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  console.log(JSON.stringify({ outputPath, result: evidence.result, cases: results.length }, null, 2));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
