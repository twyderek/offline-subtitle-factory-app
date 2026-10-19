import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { recordTempRootCleanup, removeTempRootAndVerify, safeProcessOutcome, safeProbeFailure, summarizeWhisperStderr } from './whisper-long-media-evidence.mjs';
import { hasSameFileIntegrity, inspectFileIntegrity } from './whisper-long-media-integrity.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toolsDir = path.resolve(process.env.OFFLINE_SUBTITLE_TOOLS_DIR || path.join(appDir, 'tools'));
const inputPath = path.resolve(process.argv[2] || 'path/to/input.mp4');
const modelName = String(process.argv[3] || 'small').toLowerCase();
const outputPath = path.resolve(process.argv[4] || `docs/project-management/evidence/${new Date().toISOString().slice(0, 10)}-whisper-long-media-${modelName}.json`);
const explicitSourceSrtPath = process.argv[5] ? path.resolve(process.argv[5]) : null;
const derivedSourceSrtPath = `${inputPath}.edited.srt`;
const sourceSrtPath = explicitSourceSrtPath || (fs.existsSync(derivedSourceSrtPath) ? derivedSourceSrtPath : null);
const timeoutMs = Number(process.env.WHISPER_LONG_MEDIA_TIMEOUT_MS || 6 * 60 * 60 * 1000);
if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite existing long-media evidence: ${outputPath}`);

const ffmpegPath = path.join(toolsDir, 'ffmpeg', 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
const ffprobePath = path.join(toolsDir, 'ffmpeg', 'bin', process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
const runtimePath = path.join(toolsDir, 'whisper-cpp', process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli');
const modelPath = path.join(toolsDir, 'whisper-models', `ggml-${modelName}.bin`);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-whisper-long-media-'));
const audioPath = path.join(tempRoot, 'input.flac');
const outputBase = path.join(tempRoot, 'whisper-output');
let tempRootRemoved = false;
let inputIntegrityBefore = null;
let sourceSrtIntegrityBefore = null;

function requireOk(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function appendTail(previous, chunk) {
  return `${previous}${chunk.toString('utf8')}`.slice(-4096);
}

function sanitizeDiagnosticText(value) {
  return String(value || '')
    .replaceAll(inputPath, '<input-media>')
    .replaceAll(tempRoot, '<temp-root>')
    .replace(/\/(?:Users|private\/tmp|tmp|var\/folders)\/[^\s"'`,;]+/g, '<path>');
}

function displayCommand(command, args) {
  return [command, ...args].map((value) => sanitizeDiagnosticText(value)).join(' ');
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: appDir, env: options.env || process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let killTimer;
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), 5000);
    }, options.timeoutMs || timeoutMs);
    child.stdout.on('data', (chunk) => { stdout = appendTail(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = appendTail(stderr, chunk); });
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      resolve({ command, args, exitCode: null, signal: null, error: String(error?.message || error), stdout, stderr });
    });
    child.once('close', (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      resolve({ command, args, exitCode, signal, error: null, stdout, stderr });
    });
  });
}

function summarizeWhisperJson(jsonPath) {
  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const segments = Array.isArray(parsed.segments)
    ? parsed.segments
    : (Array.isArray(parsed.transcription) ? parsed.transcription : []);
  const text = segments.map((segment) => String(segment.text || '')).join('');
  const starts = segments.map((segment) => Number.isFinite(Number(segment.start)) ? Number(segment.start) : Number(segment.offsets?.from) / 1000).filter(Number.isFinite);
  const ends = segments.map((segment) => Number.isFinite(Number(segment.end)) ? Number(segment.end) : Number(segment.offsets?.to) / 1000).filter(Number.isFinite);
  const confidenceCount = segments.filter((segment) => Number.isFinite(Number(segment.confidence))).length;
  const noSpeechCount = segments.filter((segment) => Number.isFinite(Number(segment.no_speech_prob))).length;
  const tokenProbabilityCount = segments.flatMap((segment) => Array.isArray(segment.tokens) ? segment.tokens : []).filter((token) => Number.isFinite(Number(token.p))).length;
  return {
    segmentCount: segments.length,
    textCodePointCount: Array.from(text).length,
    firstSegmentStart: starts.length ? Math.min(...starts) : null,
    lastSegmentEnd: ends.length ? Math.max(...ends) : null,
    confidenceFieldCount: confidenceCount,
    noSpeechProbabilityFieldCount: noSpeechCount,
    tokenProbabilityCount,
  };
}

function summarizeWhisperStdout(value) {
  const lines = String(value || '').split(/\r?\n/).filter(Boolean);
  return {
    lineCount: lines.length,
    transcriptLineCount: lines.filter((line) => /^\s*\[\d{2}:\d{2}:\d{2}\.\d{3}\s+-->/.test(line)).length,
    contentStored: false,
  };
}

const evidence = {
  schema: 'offline-subtitle-factory.whisper-long-media.v5',
  startedAt: new Date().toISOString(),
  completedAt: null,
  elapsedMs: null,
  environment: { platform: process.platform, arch: process.arch, node: process.version },
  input: { fileName: path.basename(inputPath), fileSizeBytes: null, fileSizeBytesAfter: null, sha256: null, sha256After: null, userMediaRead: true, mediaMetadata: null, sourceSrt: { fileName: sourceSrtPath ? 'source.srt' : null, fileSizeBytes: null, fileSizeBytesAfter: null, sha256Before: null, sha256After: null, checked: false } },
  assets: { toolsDir: path.basename(toolsDir), ffmpeg: path.basename(ffmpegPath), ffprobe: path.basename(ffprobePath), runtime: path.basename(runtimePath), model: path.basename(modelPath), runtimeSha256: null, modelSha256: null },
  extraction: { command: null, exitCode: null, signal: null, durationMs: null, audioFileSizeBytes: null, audioSha256: null },
  inference: { modelName, command: null, exitCode: null, signal: null, durationMs: null, requestedGpu: true, deviceObserved: null, stdoutSummary: { lineCount: 0, transcriptLineCount: 0, contentStored: false }, stderrSummary: { lineCount: 0, diagnosticLineCount: 0, contentStored: false }, summary: null },
  outputs: { srt: null, json: null, tempRootRemoved: false },
  scope: { externalNetwork: false, lmStudio: 'not-run-by-explicit-scope-exception', originalVideoModified: null, inputMediaHashChecked: false, originalSrtModified: null, sourceSrtHashChecked: false, fullTranscriptStored: false },
  integrityViolations: [],
  status: 'fail',
};

const started = Date.now();
try {
  requireOk(process.platform === 'darwin' && process.arch === 'arm64', '本 probe 只接受目前 macOS arm64 bundled Whisper 驗收環境');
  requireOk(fs.existsSync(inputPath), `找不到本機輸入影片：${inputPath}`);
  requireOk(fs.existsSync(ffmpegPath) && fs.existsSync(ffprobePath), 'bundled FFmpeg／FFprobe 不完整');
  requireOk(fs.existsSync(runtimePath), `找不到 bundled whisper-cli：${runtimePath}`);
  requireOk(fs.existsSync(modelPath), `找不到 bundled Whisper 模型：${modelPath}`);
  requireOk(['tiny', 'base', 'small'].includes(modelName), `不支援的 bundled 模型：${modelName}`);
  inputIntegrityBefore = await inspectFileIntegrity(inputPath);
  requireOk(inputIntegrityBefore.exists && inputIntegrityBefore.stable, '無法取得穩定的輸入影片 before SHA-256');
  evidence.input.fileSizeBytes = inputIntegrityBefore.fileSizeBytes;
  evidence.input.sha256 = inputIntegrityBefore.sha256;
  evidence.assets.runtimeSha256 = sha256File(runtimePath);
  evidence.assets.modelSha256 = sha256File(modelPath);
  if (sourceSrtPath) {
    requireOk(fs.existsSync(sourceSrtPath), `找不到來源 SRT：${sourceSrtPath}`);
    sourceSrtIntegrityBefore = await inspectFileIntegrity(sourceSrtPath);
    requireOk(sourceSrtIntegrityBefore.exists && sourceSrtIntegrityBefore.stable, '無法取得穩定的來源 SRT before SHA-256');
    evidence.input.sourceSrt = {
      fileName: 'source.srt',
      fileSizeBytes: sourceSrtIntegrityBefore.fileSizeBytes,
      fileSizeBytesAfter: null,
      sha256Before: sourceSrtIntegrityBefore.sha256,
      sha256After: null,
      checked: true,
    };
  }

  const probeResult = await runCommand(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,sample_rate,channels', '-of', 'json', inputPath]);
  requireOk(probeResult.exitCode === 0, `FFprobe 失敗：${safeProcessOutcome(probeResult)}`);
  evidence.input.mediaMetadata = JSON.parse(probeResult.stdout);

  const extractionStarted = Date.now();
  const extraction = await runCommand(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'flac', '-compression_level', '5', audioPath]);
  evidence.extraction = {
    command: displayCommand(ffmpegPath, extraction.args),
    exitCode: extraction.exitCode,
    signal: extraction.signal,
    durationMs: Date.now() - extractionStarted,
    audioFileSizeBytes: fs.existsSync(audioPath) ? fs.statSync(audioPath).size : null,
    audioSha256: fs.existsSync(audioPath) ? sha256File(audioPath) : null,
  };
  requireOk(extraction.exitCode === 0 && fs.existsSync(audioPath), `FFmpeg 音訊抽取失敗：${safeProcessOutcome(extraction)}`);

  const inferenceStarted = Date.now();
  const inference = await runCommand(runtimePath, ['-m', modelPath, '-f', audioPath, '-l', 'zh', '-t', '4', '-osrt', '-oj', '-ojf', '-of', outputBase, '-np']);
  const outputSrtPath = `${outputBase}.srt`;
  const outputJsonPath = `${outputBase}.json`;
  evidence.inference = {
    modelName,
    command: displayCommand(runtimePath, inference.args),
    exitCode: inference.exitCode,
    signal: inference.signal,
    durationMs: Date.now() - inferenceStarted,
    requestedGpu: true,
    deviceObserved: /metal/i.test(`${inference.stdout}\n${inference.stderr}`) ? 'metal' : null,
    stdoutSummary: summarizeWhisperStdout(inference.stdout),
    stderrSummary: summarizeWhisperStderr(inference.stderr),
    summary: null,
  };
  if (fs.existsSync(outputJsonPath)) evidence.inference.summary = summarizeWhisperJson(outputJsonPath);
  evidence.outputs.srt = fs.existsSync(outputSrtPath) ? { sizeBytes: fs.statSync(outputSrtPath).size, sha256: sha256File(outputSrtPath) } : null;
  evidence.outputs.json = fs.existsSync(outputJsonPath) ? { sizeBytes: fs.statSync(outputJsonPath).size, sha256: sha256File(outputJsonPath) } : null;
  requireOk(inference.exitCode === 0, `Whisper 長音訊執行失敗：${safeProcessOutcome(inference)}`);
  requireOk(evidence.outputs.srt?.sizeBytes > 0 && evidence.outputs.json?.sizeBytes > 0, 'Whisper 完成但未產生非空 SRT／JSON');
  requireOk(Number(evidence.inference.summary?.segmentCount || 0) > 0, 'Whisper JSON 沒有 segment');
  evidence.status = 'pass';
} catch {
  evidence.error = safeProbeFailure();
} finally {
  evidence.completedAt = new Date().toISOString();
  evidence.elapsedMs = Date.now() - started;
  const integrityViolations = [];
  if (inputIntegrityBefore) {
    try {
      const inputIntegrityAfter = await inspectFileIntegrity(inputPath);
      evidence.input.fileSizeBytesAfter = inputIntegrityAfter.exists ? inputIntegrityAfter.fileSizeBytes : null;
      evidence.input.sha256After = inputIntegrityAfter.exists ? inputIntegrityAfter.sha256 : null;
      evidence.scope.inputMediaHashChecked = true;
      evidence.scope.originalVideoModified = !hasSameFileIntegrity(inputIntegrityBefore, inputIntegrityAfter);
      if (evidence.scope.originalVideoModified) integrityViolations.push('INPUT_MEDIA_MODIFIED');
    } catch {
      evidence.scope.inputMediaHashChecked = false;
      evidence.scope.originalVideoModified = null;
      integrityViolations.push('INPUT_MEDIA_HASH_CHECK_FAILED');
    }
  }
  if (evidence.input.sourceSrt.checked && sourceSrtPath && sourceSrtIntegrityBefore) {
    try {
      const sourceSrtIntegrityAfter = await inspectFileIntegrity(sourceSrtPath);
      evidence.input.sourceSrt.fileSizeBytesAfter = sourceSrtIntegrityAfter.exists ? sourceSrtIntegrityAfter.fileSizeBytes : null;
      evidence.input.sourceSrt.sha256After = sourceSrtIntegrityAfter.exists ? sourceSrtIntegrityAfter.sha256 : null;
      evidence.scope.sourceSrtHashChecked = true;
      evidence.scope.originalSrtModified = !hasSameFileIntegrity(sourceSrtIntegrityBefore, sourceSrtIntegrityAfter);
      if (evidence.scope.originalSrtModified) integrityViolations.push('SOURCE_SRT_MODIFIED');
    } catch {
      evidence.scope.sourceSrtHashChecked = false;
      evidence.scope.originalSrtModified = null;
      integrityViolations.push('SOURCE_SRT_HASH_CHECK_FAILED');
    }
  }
  evidence.integrityViolations = integrityViolations;
  if (integrityViolations.length) {
    const descriptions = {
      INPUT_MEDIA_MODIFIED: '輸入影片在 probe 前後 hash 不一致或檔案消失',
      INPUT_MEDIA_HASH_CHECK_FAILED: '無法完成輸入影片 after SHA-256 完整性檢查',
      SOURCE_SRT_MODIFIED: '來源 SRT 在 probe 前後 hash 不一致或檔案消失',
      SOURCE_SRT_HASH_CHECK_FAILED: '無法完成來源 SRT after SHA-256 完整性檢查',
    };
    evidence.status = 'fail';
    evidence.error = {
      message: integrityViolations.map((code) => descriptions[code]).join('；'),
      code: integrityViolations.length === 1 ? integrityViolations[0] : 'INPUT_INTEGRITY_FAILURE',
    };
  }
  tempRootRemoved = removeTempRootAndVerify(tempRoot);
  recordTempRootCleanup(evidence, tempRootRemoved, integrityViolations.length > 0);
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite long-media evidence: ${outputPath}`);
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    console.log(JSON.stringify({ outputPath, status: evidence.status, elapsedMs: evidence.elapsedMs, error: evidence.error || null }, null, 2));
  } finally {
    if (evidence.status !== 'pass' || !tempRootRemoved) process.exitCode = 1;
  }
}
