import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  WHISPER_MODEL_DOWNLOAD_REVISION,
  WHISPER_MODEL_DOWNLOADS,
  downloadWhisperModelFile,
  getWhisperModelDownloadDefinition,
  mergeWhisperModelManifest,
} from '../lib/whisper-model-download.mjs';
import { inspectWhisperModel } from '../lib/whisper-models.mjs';

assert.match(WHISPER_MODEL_DOWNLOAD_REVISION, /^[a-f0-9]{40}$/);
assert.equal(getWhisperModelDownloadDefinition('base').size, 147951465);
assert.equal(getWhisperModelDownloadDefinition('small').sha256, '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b');
assert.equal(getWhisperModelDownloadDefinition('../settings'), null, '下載器不得接受任意模型名稱');
const merged = mergeWhisperModelManifest({ files: { models: { tiny: { sha256: 'packaged-tiny' } } } });
assert.equal(merged.files.models.base.sha256, WHISPER_MODEL_DOWNLOADS.base.sha256);
assert.equal(merged.files.models.tiny.sha256, 'packaged-tiny', '封裝 manifest 的既有 tiny hash 應優先保留');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-subtitle-model-download-'));
const payload = Buffer.from('verified model fixture');
const fixture = {
  name: 'fixture',
  filename: 'ggml-fixture.bin',
  size: payload.length,
  sha256: crypto.createHash('sha256').update(payload).digest('hex'),
  url: 'https://fixture.invalid/ggml-fixture.bin',
};
const fixtureFetch = async () => new Response(payload, { status: 200, headers: { 'content-length': String(payload.length) } });
try {
  const progress = [];
  const result = await downloadWhisperModelFile({ definition: fixture, modelsDir: tempDir, fetchImpl: fixtureFetch, onProgress: (value) => progress.push(value) });
  assert.equal(fs.readFileSync(result.path).toString(), payload.toString());
  assert.equal(progress.at(-1).progress, 100);
  assert.equal(fs.readdirSync(tempDir).filter((file) => file.endsWith('.download')).length, 0);

  const windowsTargetDir = path.join(tempDir, 'windows-replace');
  fs.mkdirSync(windowsTargetDir, { recursive: true });
  fs.writeFileSync(path.join(windowsTargetDir, fixture.filename), 'old invalid model');
  await downloadWhisperModelFile({ definition: fixture, modelsDir: windowsTargetDir, fetchImpl: fixtureFetch, platform: 'win32' });
  assert.equal(fs.readFileSync(path.join(windowsTargetDir, fixture.filename)).toString(), payload.toString(), 'Windows 應可替換既有損壞模型');
  assert.equal(fs.readdirSync(windowsTargetDir).some((file) => file.endsWith('.previous')), false, 'Windows 替換後不得留下備份檔');

  const cached = inspectWhisperModel({
    modelsDir: tempDir,
    modelName: 'tiny',
    manifest: { files: { models: { tiny: { size: payload.length, sha256: fixture.sha256 } } } },
    allowMock: true,
  });
  assert.equal(cached.valid, false, '不同檔名的 fixture 不可被誤認成 Tiny');

  const wrongDefinition = { ...fixture, sha256: '0'.repeat(64) };
  await assert.rejects(() => downloadWhisperModelFile({ definition: wrongDefinition, modelsDir: path.join(tempDir, 'wrong-hash'), fetchImpl: fixtureFetch }), /SHA-256 不符/);
  assert.equal(fs.readdirSync(path.join(tempDir, 'wrong-hash')).filter((file) => file.endsWith('.download')).length, 0, 'SHA 失敗不得留下暫存檔');

  const oversized = { ...fixture, size: payload.length - 1 };
  await assert.rejects(() => downloadWhisperModelFile({ definition: oversized, modelsDir: path.join(tempDir, 'oversized'), fetchImpl: fixtureFetch }), /超過預期|大小不符/);
  const unavailable = async () => new Response('nope', { status: 503 });
  await assert.rejects(() => downloadWhisperModelFile({ definition: fixture, modelsDir: path.join(tempDir, 'http-error'), fetchImpl: unavailable }), /HTTP 503/);
  const neverResponds = async (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
  });
  await assert.rejects(() => downloadWhisperModelFile({ definition: fixture, modelsDir: path.join(tempDir, 'timeout'), fetchImpl: neverResponds, timeoutMs: 5 }), /下載逾時/);
  const cancelController = new AbortController();
  const cancelDirectory = path.join(tempDir, 'cancelled');
  const cancelledDownload = downloadWhisperModelFile({
    definition: fixture,
    modelsDir: cancelDirectory,
    fetchImpl: neverResponds,
    signal: cancelController.signal,
    timeoutMs: 1000,
  });
  cancelController.abort(new Error('cancel fixture'));
  await assert.rejects(cancelledDownload, (error) => error.code === 'MODEL_DOWNLOAD_CANCELLED' && /已取消/.test(error.message));
  assert.equal(fs.readdirSync(cancelDirectory).filter((file) => file.endsWith('.download')).length, 0, '使用者取消不得留下暫存檔');

  const partialCancelController = new AbortController();
  const partialCancelDirectory = path.join(tempDir, 'partial-cancelled');
  let resolvePartialWrite;
  const partialWriteStarted = new Promise((resolve) => { resolvePartialWrite = resolve; });
  const partialBodyFetch = async (_url, { signal }) => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(payload.subarray(0, 7));
      const abort = () => controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    },
  }), { status: 200 });
  const partiallyWrittenDownload = downloadWhisperModelFile({
    definition: fixture,
    modelsDir: partialCancelDirectory,
    fetchImpl: partialBodyFetch,
    signal: partialCancelController.signal,
    timeoutMs: 1000,
    onProgress: ({ bytesDownloaded }) => {
      if (bytesDownloaded > 0) resolvePartialWrite();
    },
  });
  await partialWriteStarted;
  let partialFiles = [];
  const partialFileDeadline = Date.now() + 1000;
  while (Date.now() < partialFileDeadline) {
    partialFiles = fs.readdirSync(partialCancelDirectory).filter((file) => file.endsWith('.download'));
    if (partialFiles.length === 1 && fs.statSync(path.join(partialCancelDirectory, partialFiles[0])).size > 0) break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(partialFiles.length, 1, '取消前應已建立暫存檔');
  assert.ok(fs.statSync(path.join(partialCancelDirectory, partialFiles[0])).size > 0, '取消前暫存檔應已有部分內容');
  partialCancelController.abort(new Error('cancel after partial body'));
  await assert.rejects(partiallyWrittenDownload, (error) => error.code === 'MODEL_DOWNLOAD_CANCELLED');
  assert.equal(fs.readdirSync(partialCancelDirectory).filter((file) => file.endsWith('.download')).length, 0, '部分內容寫入後取消仍不得留下暫存檔');
  assert.equal(fs.readdirSync(partialCancelDirectory).some((file) => file.endsWith('.previous')), false, '部分內容取消不得留下 Windows 替換備份');
  console.log('Whisper 模型下載測試通過：固定來源、大小／SHA 驗證、下載前與部分內容寫入後取消、暫存檔清理與 fallback manifest');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
