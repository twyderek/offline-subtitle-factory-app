import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const BREEZE_ASR_ENGINE = 'breeze-asr-25';
export const BREEZE_ASR_REVISION = 'cffe7ccb404d025296a00758d0a33468bec3a9d0';
export const BREEZE_ASR_MODEL = Object.freeze({
  name: BREEZE_ASR_ENGINE,
  label: 'Breeze ASR 25',
  filename: 'breeze-asr-25.pt',
  size: 3087008569,
  sha256: '9c94a3554ff4f0de83494e2ed7ba5826efa74bd87955c034b4d0fd681746b690',
  url: `https://huggingface.co/MediaTek-Research/Breeze-ASR-25/resolve/${BREEZE_ASR_REVISION}/whisper-github/9c94a3554ff4f0de83494e2ed7ba5826efa74bd87955c034b4d0fd681746b690/breeze-asr-25.pt?download=true`,
  license: 'Apache-2.0',
  runtime: 'MediaTek patched Whisper CLI',
});

const hashCache = new Map();

async function sha256File(filePath, stat) {
  const cacheKey = `${path.resolve(filePath)}:${stat.size}:${stat.mtimeMs}`;
  if (hashCache.has(cacheKey)) return hashCache.get(cacheKey);
  const hash = crypto.createHash('sha256');
  // Stream the multi-gigabyte checkpoint so API status/cancel requests keep
  // getting event-loop turns while integrity verification is in progress.
  for await (const chunk of fs.createReadStream(filePath, { highWaterMark: 8 * 1024 * 1024 })) hash.update(chunk);
  const digest = hash.digest('hex');
  hashCache.clear();
  hashCache.set(cacheKey, digest);
  return digest;
}

export async function inspectBreezeAsrModel(modelsDir, { allowMock = false } = {}) {
  const modelPath = path.join(modelsDir, BREEZE_ASR_MODEL.filename);
  let stat;
  try {
    stat = await fs.promises.stat(modelPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return { ...BREEZE_ASR_MODEL, path: modelPath, installed: false, valid: false, reason: 'missing' };
  }
  if (!stat.isFile()) {
    return { ...BREEZE_ASR_MODEL, path: modelPath, installed: false, valid: false, reason: 'not-file' };
  }
  if (!allowMock && stat.size !== BREEZE_ASR_MODEL.size) {
    return { ...BREEZE_ASR_MODEL, path: modelPath, installed: true, valid: false, reason: 'size-mismatch', actualSize: stat.size };
  }
  const sha256 = allowMock ? BREEZE_ASR_MODEL.sha256 : await sha256File(modelPath, stat);
  const valid = sha256 === BREEZE_ASR_MODEL.sha256;
  return {
    ...BREEZE_ASR_MODEL,
    path: modelPath,
    installed: true,
    valid,
    reason: valid ? 'ok' : 'sha256-mismatch',
    actualSize: stat.size,
    actualSha256: sha256,
  };
}

export function buildBreezeRuntimeProbeArgs() {
  return ['-c', `import whisper,sys;sys.exit(0 if '${BREEZE_ASR_ENGINE}' in whisper.available_models() else 2)`];
}

export function buildBreezeAsrArgs({ audioFile, outputDir, modelDir, language = 'zh', device = 'cpu', cpuThreads = 1, performancePreset = 'balanced' }) {
  const args = [
    '-m', 'whisper',
    audioFile,
    '--model', BREEZE_ASR_ENGINE,
    '--model_dir', modelDir,
    '--language', String(language || 'zh').startsWith('zh') ? 'zh' : String(language),
    '--output_format', 'srt',
    '--output_dir', outputDir,
    '--device', device,
    '--fp16', device === 'cuda' ? 'True' : 'False',
    '--verbose', 'False',
  ];
  if (device !== 'cuda') args.push('--threads', String(Math.max(1, Number(cpuThreads) || 1)));
  if (performancePreset === 'fast') args.push('--beam_size', '1');
  if (performancePreset === 'accurate') args.push('--beam_size', '5');
  return args;
}

export function breezeRuntimeInstallGuide() {
  return '請先安裝 Python 3.8–3.11，再依 MediaTek Research 官方 Breeze-ASR-25 說明安裝 third_party/whisper-patch-breeze；完成後重新啟動 App。';
}
