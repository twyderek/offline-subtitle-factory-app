import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';

// Keep this revision immutable so a future upstream replacement cannot silently
// change what the application installs. The hashes are SHA-256 values from the
// official ggerganov/whisper.cpp multilingual model files.
export const WHISPER_MODEL_DOWNLOAD_REVISION = '5359861c739e955e79d9a303bcbc70fb988958b1';
const WHISPER_MODEL_BASE_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/${WHISPER_MODEL_DOWNLOAD_REVISION}`;

export const WHISPER_MODEL_DOWNLOADS = Object.freeze({
  tiny: Object.freeze({
    name: 'tiny',
    filename: 'ggml-tiny.bin',
    size: 77691713,
    sha256: 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21',
    url: `${WHISPER_MODEL_BASE_URL}/ggml-tiny.bin?download=true`,
  }),
  base: Object.freeze({
    name: 'base',
    filename: 'ggml-base.bin',
    size: 147951465,
    sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
    url: `${WHISPER_MODEL_BASE_URL}/ggml-base.bin?download=true`,
  }),
  small: Object.freeze({
    name: 'small',
    filename: 'ggml-small.bin',
    size: 487601967,
    sha256: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
    url: `${WHISPER_MODEL_BASE_URL}/ggml-small.bin?download=true`,
  }),
});

export function getWhisperModelDownloadDefinition(modelName) {
  const name = String(modelName || '').trim().toLowerCase();
  return WHISPER_MODEL_DOWNLOADS[name] || null;
}

export function listWhisperModelDownloads() {
  return Object.values(WHISPER_MODEL_DOWNLOADS).map((definition) => ({ ...definition }));
}

export function mergeWhisperModelManifest(manifest = {}) {
  const modelEntries = Object.fromEntries(Object.values(WHISPER_MODEL_DOWNLOADS).map((definition) => [definition.name, {
    path: `whisper-models/${definition.filename}`,
    size: definition.size,
    sha256: definition.sha256,
  }]));
  return {
    ...manifest,
    files: {
      ...(manifest.files || {}),
      models: {
        ...modelEntries,
        ...(manifest.files?.models || {}),
      },
    },
  };
}

export function formatModelDownloadError(error, definition) {
  const message = String(error?.message || error || '未知錯誤');
  const modelLabel = definition?.name ? definition.name.toUpperCase() : 'Whisper';
  const wrapped = new Error(`${modelLabel} 模型下載失敗：${message}。可改用手動下載後放入模型快取：${definition?.url || '官方 Whisper.cpp 模型頁'}`);
  wrapped.code = error?.code || 'MODEL_DOWNLOAD_FAILED';
  wrapped.cause = error;
  return wrapped;
}

function replaceDownloadedModel({ tempPath, targetPath, platform = process.platform }) {
  if (platform !== 'win32' || !fs.existsSync(targetPath)) {
    fs.renameSync(tempPath, targetPath);
    return;
  }
  // Windows does not allow renameSync to replace an existing file. Move the
  // old file aside first, then put the verified temporary file in place. If
  // the second rename fails, restore the old file so a valid model is never
  // silently lost.
  const backupPath = `${targetPath}.${process.pid}.${crypto.randomUUID()}.previous`;
  fs.renameSync(targetPath, backupPath);
  try {
    fs.renameSync(tempPath, targetPath);
  } catch (error) {
    try { fs.unlinkSync(targetPath); } catch {}
    try { fs.renameSync(backupPath, targetPath); } catch {}
    throw error;
  }
  try { fs.unlinkSync(backupPath); } catch {}
}

export async function downloadWhisperModelFile({ definition, modelsDir, fetchImpl = globalThis.fetch, onProgress = () => {}, platform = process.platform, timeoutMs = 15 * 60 * 1000, signal }) {
  if (!definition?.name || !definition.filename || !definition.url || !Number.isSafeInteger(definition.size) || !/^[a-f0-9]{64}$/i.test(definition.sha256 || '')) {
    throw new Error('模型下載定義不完整');
  }
  if (typeof fetchImpl !== 'function') throw new Error('目前執行環境不支援模型下載');
  fs.mkdirSync(modelsDir, { recursive: true });
  const targetPath = path.join(modelsDir, definition.filename);
  const tempPath = path.join(modelsDir, `.${definition.filename}.${process.pid}.${crypto.randomUUID()}.download`);
  let output;
  let committed = false;
  let timedOut = false;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const abortFromCaller = () => controller?.abort(signal?.reason || new Error('模型下載已取消'));
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = controller && Number.isFinite(timeoutMs) && timeoutMs > 0
    ? setTimeout(() => {
      timedOut = true;
      controller.abort(new Error('模型下載逾時'));
    }, timeoutMs)
    : null;
  try {
    const response = await fetchImpl(definition.url, { redirect: 'follow', signal: controller?.signal });
    if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
    if (!response.body) throw new Error('回應沒有下載內容');
    const declaredSize = Number(response.headers?.get?.('content-length') || 0);
    if (declaredSize > definition.size) throw new Error(`回應大小超過預期（${declaredSize} > ${definition.size} bytes）`);
    output = fs.createWriteStream(tempPath, { flags: 'wx' });
    const hash = crypto.createHash('sha256');
    let bytesDownloaded = 0;
    onProgress({ bytesDownloaded, totalBytes: definition.size, progress: 0 });
    for await (const chunk of response.body) {
      const buffer = Buffer.from(chunk);
      bytesDownloaded += buffer.length;
      if (bytesDownloaded > definition.size) throw new Error(`下載大小超過預期（${bytesDownloaded} > ${definition.size} bytes）`);
      hash.update(buffer);
      if (!output.write(buffer)) await once(output, 'drain');
      onProgress({ bytesDownloaded, totalBytes: definition.size, progress: Math.min(100, Math.round((bytesDownloaded / definition.size) * 100)) });
    }
    output.end();
    await once(output, 'close');
    output = null;
    if (bytesDownloaded !== definition.size) throw new Error(`下載大小不符（${bytesDownloaded}，預期 ${definition.size} bytes）`);
    const sha256 = hash.digest('hex');
    if (sha256 !== definition.sha256) throw new Error(`SHA-256 不符（${sha256}）`);
    replaceDownloadedModel({ tempPath, targetPath, platform });
    committed = true;
    onProgress({ bytesDownloaded, totalBytes: definition.size, progress: 100 });
    return { path: targetPath, size: bytesDownloaded, sha256 };
  } catch (error) {
    if (controller?.signal.aborted && timedOut) {
      const timeoutError = new Error(`下載逾時（超過 ${Math.round(timeoutMs / 1000)} 秒）`);
      timeoutError.code = 'MODEL_DOWNLOAD_TIMEOUT';
      throw timeoutError;
    }
    if (controller?.signal.aborted || signal?.aborted || error?.name === 'AbortError') {
      const cancelledError = new Error('模型下載已取消');
      cancelledError.code = 'MODEL_DOWNLOAD_CANCELLED';
      throw cancelledError;
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
    if (output) output.destroy();
    if (!committed) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
  }
}
