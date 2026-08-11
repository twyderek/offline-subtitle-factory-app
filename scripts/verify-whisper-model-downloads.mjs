import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { downloadWhisperModelFile, getWhisperModelDownloadDefinition } from '../lib/whisper-model-download.mjs';

const args = process.argv.slice(2);
const readArg = (name, fallback = '') => {
  const index = args.indexOf(name);
  return index >= 0 ? String(args[index + 1] || fallback) : fallback;
};
const models = readArg('--models', 'base,small').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
const outputPath = readArg('--output');
const requestedCache = readArg('--cache-dir');
const keepCache = args.includes('--keep-cache');
if (!outputPath) throw new Error('Usage: node scripts/verify-whisper-model-downloads.mjs --output <json> [--models base,small] [--cache-dir <dir>] [--keep-cache]');
if (!models.length || models.some((name) => !['base', 'small'].includes(name))) throw new Error('只允許驗證 base 或 small 模型');

const cacheDir = requestedCache || fs.mkdtempSync(path.join(os.tmpdir(), 'offline-subtitle-whisper-acceptance-'));
const results = [];
const startedAt = new Date().toISOString();
try {
  for (const name of models) {
    const definition = getWhisperModelDownloadDefinition(name);
    const started = Date.now();
    let lastProgress = -1;
    try {
      const result = await downloadWhisperModelFile({
        definition,
        modelsDir: cacheDir,
        timeoutMs: 30 * 60 * 1000,
        onProgress: ({ progress }) => {
          if (progress >= lastProgress + 10 || progress === 100) {
            lastProgress = progress;
            console.log(`${name}: ${progress}%`);
          }
        },
      });
      const actualSha256 = crypto.createHash('sha256').update(fs.readFileSync(result.path)).digest('hex');
      results.push({
        model: name,
        status: actualSha256 === definition.sha256 && result.size === definition.size ? 'pass' : 'fail',
        size: result.size,
        expectedSize: definition.size,
        sha256: actualSha256,
        expectedSha256: definition.sha256,
        elapsedMs: Date.now() - started,
      });
    } catch (error) {
      results.push({ model: name, status: 'fail', error: String(error?.message || error), elapsedMs: Date.now() - started });
    }
  }
} finally {
  if (!keepCache && !requestedCache) fs.rmSync(cacheDir, { recursive: true, force: true });
}

const evidence = {
  schema: 'offline-subtitle-factory.whisper-download-acceptance.v1',
  startedAt,
  completedAt: new Date().toISOString(),
  platform: process.platform,
  arch: process.arch,
  node: process.version,
  revision: '5359861c739e955e79d9a303bcbc70fb988958b1',
  results,
};
fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
console.log(`外部模型下載驗收證據已寫入 ${path.resolve(outputPath)}`);
if (results.some((result) => result.status !== 'pass')) process.exitCode = 1;
