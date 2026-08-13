import os from 'node:os';
import path from 'node:path';
import { BREEZE_ASR_MODEL } from '../lib/breeze-asr.mjs';
import { collectBreezeRuntimeProbe, resolveBreezePython } from '../lib/breeze-runtime-probe.mjs';

const args = process.argv.slice(2);
const readOption = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : '';
};
if (args.includes('--help')) {
  console.log('用法：BREEZE_ASR_MODEL_DIR=/path/to/cache BREEZE_ASR_PYTHON=/path/to/python npm run probe:breeze [-- --json]');
  process.exit(0);
}

const modelDir = readOption('--model-dir') || process.env.BREEZE_ASR_MODEL_DIR || '';
const python = readOption('--python') || resolveBreezePython({ toolsDir: process.env.OFFLINE_SUBTITLE_TOOLS_DIR || '' });
const timeoutMs = Number(readOption('--timeout-ms') || process.env.BREEZE_ASR_PROBE_TIMEOUT_MS || 15000);
const report = await collectBreezeRuntimeProbe({
  python,
  modelDir: modelDir || path.join(os.tmpdir(), 'offline-subtitle-breeze-models'),
  timeoutMs,
});
const output = JSON.stringify({
  ...report,
  checkedAt: new Date().toISOString(),
  expectedModel: {
    filename: BREEZE_ASR_MODEL.filename,
    size: BREEZE_ASR_MODEL.size,
    sha256: BREEZE_ASR_MODEL.sha256,
    revision: BREEZE_ASR_MODEL.url.match(/resolve\/([^/]+)/)?.[1] || null,
  },
}, null, 2);
console.log(args.includes('--json') ? output : output);
if (!report.ready) process.exitCode = 1;
