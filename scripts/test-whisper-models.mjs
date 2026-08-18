import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildWhisperCppArgs,
  inspectWhisperModel,
  normalizeWhisperModelName,
  WHISPER_MODEL_DEFINITIONS,
} from '../lib/whisper-models.mjs';
import { parseWhisperQualityJson } from '../lib/whisper-quality.mjs';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-subtitle-whisper-models-'));
const modelsDir = path.join(tempDir, 'whisper-models');
fs.mkdirSync(modelsDir, { recursive: true });
const mockRunner = path.join(tempDir, 'mock-whisper-runner.mjs');
fs.writeFileSync(mockRunner, `
import fs from 'node:fs';
const args = process.argv.slice(2);
const value = (flag) => args[args.indexOf(flag) + 1];
const model = value('-m').match(/ggml-(tiny|base|small)\\.bin$/)?.[1];
if (!model) process.exit(2);
const output = value('-of');
fs.writeFileSync(output + '.srt', '1\\n00:00:00,000 --> 00:00:00,800\\nmock ' + model + ' 中文測試\\n', 'utf8');
fs.writeFileSync(output + '.json', JSON.stringify({ transcription: [{ from: 0, to: 0.8, text: 'mock ' + model + ' 中文測試', avg_logprob: -0.1, no_speech_prob: 0.01 }] }), 'utf8');
`, 'utf8');

try {
  assert.equal(normalizeWhisperModelName(''), 'tiny');
  assert.equal(normalizeWhisperModelName('tiny-multilingual'), 'tiny');
  assert.equal(normalizeWhisperModelName('base'), 'base');
  assert.equal(normalizeWhisperModelName('small-multilingual'), 'small');
  assert.equal(normalizeWhisperModelName('large-v3'), 'tiny');

  for (const name of Object.keys(WHISPER_MODEL_DEFINITIONS)) {
    const definition = WHISPER_MODEL_DEFINITIONS[name];
    const modelPath = path.join(modelsDir, definition.filename);
    fs.writeFileSync(modelPath, Buffer.from(`mock-${name}`));
    const digest = crypto.createHash('sha256').update(fs.readFileSync(modelPath)).digest('hex');
    const inspected = inspectWhisperModel({
      modelsDir,
      modelName: name,
      allowMock: true,
      manifest: { files: { models: { [name]: { size: fs.statSync(modelPath).size, sha256: digest } } } },
    });
    assert.equal(inspected.valid, true, `${name} mock model should pass manifest validation`);

    const outputBase = path.join(tempDir, `output-${name}`);
    const args = buildWhisperCppArgs({
      modelPath: inspected.path,
      audioFile: path.join(tempDir, 'input.wav'),
      outputBase,
      language: 'zh',
      cpuThreads: 2,
      forceCpu: true,
    });
    assert.equal(args[args.indexOf('-m') + 1], modelPath);
    assert.ok(args.includes('--no-gpu'));
    const run = spawnSync(process.execPath, [mockRunner, ...args], { encoding: 'utf8' });
    assert.equal(run.status, 0, `${name} mock runner failed: ${run.stderr}`);
    assert.match(fs.readFileSync(`${outputBase}.srt`, 'utf8'), new RegExp(`mock ${name}`));
    const json = JSON.parse(fs.readFileSync(`${outputBase}.json`, 'utf8'));
    assert.equal(json.transcription[0].text, `mock ${name} 中文測試`);
    const quality = parseWhisperQualityJson(json);
    assert.equal(quality[0].start, 0);
    assert.equal(quality[0].end, 0.8);
    assert.equal(quality[0].noSpeechProbability, 0.01);
  }

  const basePath = path.join(modelsDir, WHISPER_MODEL_DEFINITIONS.base.filename);
  const baseSize = fs.statSync(basePath).size;
  const baseDigest = crypto.createHash('sha256').update(fs.readFileSync(basePath)).digest('hex');
  const tooSmall = inspectWhisperModel({
    modelsDir,
    modelName: 'base',
    manifest: { files: { models: { base: { size: baseSize, sha256: baseDigest } } } },
  });
  assert.equal(tooSmall.valid, false);
  assert.equal(tooSmall.reason, 'too-small');
  const badHash = inspectWhisperModel({
    modelsDir,
    modelName: 'base',
    allowMock: true,
    manifest: { files: { models: { base: { size: baseSize, sha256: '0'.repeat(64) } } } },
  });
  assert.equal(badHash.valid, false);
  assert.equal(badHash.reason, 'sha256-mismatch');
  const badSize = inspectWhisperModel({
    modelsDir,
    modelName: 'base',
    allowMock: true,
    manifest: { files: { models: { base: { size: baseSize + 1, sha256: baseDigest } } } },
  });
  assert.equal(badSize.valid, false);
  assert.equal(badSize.reason, 'size-mismatch');

  const appDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const indexHtml = fs.readFileSync(path.join(appDir, 'public', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(appDir, 'public', 'app.js'), 'utf8');
  for (const name of ['tiny', 'base', 'small']) assert.match(indexHtml, new RegExp(`value="${name}"`));
  assert.match(indexHtml, /<option value="breeze-asr-25">Breeze ASR 25<\/option>/);
  assert.doesNotMatch(indexHtml, /Breeze ASR 25（實驗性/, 'Breeze 選單不可把實驗性說明混入產品名稱');
  assert.match(appJs, /\/api\/breeze-asr/);
  assert.match(appJs, /ensureBreezeAsrReady/);
  assert.match(indexHtml, /id="downloadWhisperModel"/);
  assert.match(indexHtml, /首次選擇 Base／Small 時可由 App 從官方固定版本下載/);
  assert.match(indexHtml, /id="modelDownloadModal"/);
  assert.match(indexHtml, /id="modelDownloadCacheDirectory"/);
  assert.match(appJs, /method: 'DELETE'/, '下載視窗取消操作應停止背景下載');

  const packageJson = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
  for (const platform of ['win', 'mac']) {
    const modelResources = packageJson.build[platform].extraResources
      .map((entry) => String(entry.from || ''))
      .filter((entry) => entry.includes('whisper-models/'));
    assert.ok(modelResources.some((entry) => entry.endsWith('ggml-tiny.bin')), `${platform} 應內建 Tiny`);
    assert.equal(modelResources.some((entry) => /ggml-(base|small)\.bin$/.test(entry)), false, `${platform} 不應把 Base／Small 塞入安裝包`);
  }

  const missingDir = path.join(tempDir, 'missing-models');
  fs.mkdirSync(missingDir);
  const missing = inspectWhisperModel({ modelsDir: missingDir, modelName: 'base', manifest: null });
  assert.equal(missing.valid, false);
  assert.equal(missing.reason, 'missing');
  console.log('Whisper 三模型模擬 runtime 測試通過：tiny／base／small 選擇、模型路徑、CLI 參數、SRT／JSON 輸出與缺檔邊界');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
