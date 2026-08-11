import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BREEZE_ASR_ENGINE,
  BREEZE_ASR_MODEL,
  BREEZE_ASR_REVISION,
  buildBreezeAsrArgs,
  buildBreezeRuntimeProbeArgs,
  inspectBreezeAsrModel,
} from '../lib/breeze-asr.mjs';
import { probeCommand } from '../lib/process-probe.mjs';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'breeze-asr-test-'));
try {
  assert.equal(BREEZE_ASR_ENGINE, 'breeze-asr-25');
  assert.match(BREEZE_ASR_REVISION, /^[a-f0-9]{40}$/);
  assert.equal(BREEZE_ASR_MODEL.size, 3087008569);
  assert.equal(BREEZE_ASR_MODEL.sha256, '9c94a3554ff4f0de83494e2ed7ba5826efa74bd87955c034b4d0fd681746b690');
  assert.match(BREEZE_ASR_MODEL.url, new RegExp(BREEZE_ASR_REVISION));
  assert.doesNotMatch(BREEZE_ASR_MODEL.url, /resolve\/main/);

  const missing = await inspectBreezeAsrModel(tempDir);
  assert.equal(missing.valid, false);
  assert.equal(missing.reason, 'missing');

  fs.writeFileSync(path.join(tempDir, BREEZE_ASR_MODEL.filename), 'deterministic mock checkpoint');
  const wrongSize = await inspectBreezeAsrModel(tempDir);
  assert.equal(wrongSize.valid, false);
  assert.equal(wrongSize.reason, 'size-mismatch');
  const allowedMock = await inspectBreezeAsrModel(tempDir, { allowMock: true });
  assert.equal(allowedMock.valid, true);

  assert.deepEqual(buildBreezeRuntimeProbeArgs(), ['-c', "import whisper,sys;sys.exit(0 if 'breeze-asr-25' in whisper.available_models() else 2)"]);
  const cpuArgs = buildBreezeAsrArgs({
    audioFile: '/tmp/input.wav',
    outputDir: '/tmp/output',
    modelDir: '/tmp/models',
    language: 'zh-TW',
    device: 'cpu',
    cpuThreads: 6,
    performancePreset: 'accurate',
  });
  assert.deepEqual(cpuArgs.slice(0, 2), ['-m', 'whisper']);
  assert.equal(cpuArgs[cpuArgs.indexOf('--model') + 1], 'breeze-asr-25');
  assert.equal(cpuArgs[cpuArgs.indexOf('--model_dir') + 1], '/tmp/models');
  assert.equal(cpuArgs[cpuArgs.indexOf('--language') + 1], 'zh');
  assert.equal(cpuArgs[cpuArgs.indexOf('--threads') + 1], '6');
  assert.equal(cpuArgs[cpuArgs.indexOf('--beam_size') + 1], '5');

  const cudaArgs = buildBreezeAsrArgs({ audioFile: 'in.wav', outputDir: 'out', modelDir: 'models', device: 'cuda', performancePreset: 'fast' });
  assert.equal(cudaArgs.includes('--threads'), false);
  assert.equal(cudaArgs[cudaArgs.indexOf('--fp16') + 1], 'True');
  assert.equal(cudaArgs[cudaArgs.indexOf('--beam_size') + 1], '1');
  assert.equal(await probeCommand(process.execPath, ['-e', 'process.exit(0)'], 1000), true);
  const probeStartedAt = Date.now();
  assert.equal(await probeCommand(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], 250), false, '卡住的 runtime probe 應逾時失敗');
  assert.ok(Date.now() - probeStartedAt < 2000, 'runtime probe 不可無限等待');
  const moduleSource = fs.readFileSync(new URL('../lib/breeze-asr.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(moduleSource, /(?:open|read|stat)Sync\(/, 'Breeze 模型檢查不可用同步檔案 I/O 阻塞 event loop');
  console.log('Breeze ASR 25 模型契約、runtime 探針與 CLI 參數測試通過');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
