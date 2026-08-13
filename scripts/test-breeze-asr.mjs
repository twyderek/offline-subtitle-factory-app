import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BREEZE_ASR_ENGINE,
  BREEZE_ASR_MODEL,
  BREEZE_ASR_REVISION,
  breezeRuntimeInstallGuideDetails,
  buildBreezeAsrArgs,
  buildBreezeRuntimeProbeArgs,
  inspectBreezeAsrModel,
} from '../lib/breeze-asr.mjs';
import { collectBreezeRuntimeProbe, resolveBreezePython, runBreezeRuntimeProbe } from '../lib/breeze-runtime-probe.mjs';
import { probeCommand } from '../lib/process-probe.mjs';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'breeze-asr-test-'));
try {
  assert.equal(BREEZE_ASR_ENGINE, 'breeze-asr-25');
  assert.match(BREEZE_ASR_REVISION, /^[a-f0-9]{40}$/);
  assert.equal(BREEZE_ASR_MODEL.size, 3087008569);
  assert.equal(BREEZE_ASR_MODEL.sha256, '9c94a3554ff4f0de83494e2ed7ba5826efa74bd87955c034b4d0fd681746b690');
  assert.match(BREEZE_ASR_MODEL.url, new RegExp(BREEZE_ASR_REVISION));
  assert.doesNotMatch(BREEZE_ASR_MODEL.url, /resolve\/main/);

  const runtimeGuide = breezeRuntimeInstallGuideDetails();
  assert.equal(runtimeGuide.officialRepository, 'https://github.com/mtkresearch/Breeze-ASR-25');
  assert.match(runtimeGuide.officialDocumentation, /Breeze-ASR-25#readme$/);
  assert.match(runtimeGuide.modelPage, /huggingface\.co\/MediaTek-Research\/Breeze-ASR-25$/);
  assert.match(runtimeGuide.platforms.unix.setupCommand, /third_party\/whisper-patch-breeze/);
  assert.match(runtimeGuide.platforms.windows.setupCommand, /third_party[\\\\/]whisper-patch-breeze/);
  assert.match(runtimeGuide.platforms.unix.setupCommand, /--recurse-submodules/);
  assert.match(runtimeGuide.platforms.windows.setupCommand, /--recurse-submodules/);
  assert.match(runtimeGuide.platforms.unix.setupCommand, /BREEZE_REPO=/);
  assert.match(runtimeGuide.platforms.windows.setupCommand, /\$BreezeRepo/);
  assert.match(runtimeGuide.platforms.unix.launchCommand, /BREEZE_ASR_PYTHON/);
  assert.match(runtimeGuide.platforms.windows.launchCommand, /BREEZE_ASR_PYTHON/);
  assert.match(runtimeGuide.platforms.unix.packagedLaunchCommand, /Contents\/MacOS\/離線字幕工廠/);
  assert.match(runtimeGuide.platforms.windows.packagedLaunchCommand, /LOCALAPPDATA/);
  assert.match(runtimeGuide.platforms.unix.launchCommand, /^BREEZE_ASR_PYTHON=/);
  assert.match(runtimeGuide.platforms.windows.launchCommand, /^\$env:BREEZE_ASR_PYTHON/);
  assert.match(runtimeGuide.platforms.unix.packagedLaunchCommand, /^BREEZE_ASR_PYTHON=/);
  assert.match(runtimeGuide.platforms.windows.packagedLaunchCommand, /^\$env:BREEZE_ASR_PYTHON/);
  assert.doesNotMatch(runtimeGuide.platforms.unix.launchCommand, /[\u4e00-\u9fff]/, '開發版 shell 指令不可含未註解中文說明');
  assert.doesNotMatch(runtimeGuide.platforms.windows.launchCommand, /[\u4e00-\u9fff]/, 'Windows 指令不可含未註解中文說明');
  assert.doesNotMatch(runtimeGuide.platforms.unix.launchCommand, /cd Breeze-ASR-25/);
  assert.doesNotMatch(runtimeGuide.platforms.windows.launchCommand, /Set-Location Breeze-ASR-25/);
  assert.doesNotMatch(JSON.stringify(runtimeGuide), /(?:api[_-]?key|token|password|secret)/i, 'runtime guide 不可包含秘密欄位');

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
  const sharedProbeStartedAt = Date.now();
  assert.equal(await probeCommand(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], 250), false, '共用 runtime probe 應逾時失敗');
  assert.ok(Date.now() - sharedProbeStartedAt >= 200, '共用 probe 應等待 child close 後才回報');
  assert.equal(resolveBreezePython({ env: { BREEZE_ASR_PYTHON: '/custom/python' }, platform: 'darwin' }), '/custom/python');
  const passingProbe = await runBreezeRuntimeProbe({ command: process.execPath, probeArgs: ['-e', 'process.exit(0)'], timeoutMs: 1000 });
  assert.equal(passingProbe.ok, true);
  const timingProbe = await runBreezeRuntimeProbe({ command: process.execPath, probeArgs: ['-e', 'setInterval(() => {}, 1000)'], timeoutMs: 250 });
  assert.equal(timingProbe.timedOut, true);
  assert.ok(timingProbe.elapsedMs >= 200, 'timeout probe 應等待 child close 後才回報');
  const collected = await collectBreezeRuntimeProbe({ command: process.execPath, modelDir: tempDir, timeoutMs: 1000, inspectModel: false });
  assert.equal(collected.engine, 'breeze-asr-25');
  assert.equal(collected.ready, false);
  assert.equal(collected.modelDirectory, path.basename(tempDir));
  const redactionProbe = await runBreezeRuntimeProbe({ command: process.execPath, probeArgs: ['-e', "console.error('SECRET_MARKER /Users/example/private')"], timeoutMs: 1000 });
  assert.doesNotMatch(redactionProbe.stderr, /SECRET_MARKER/);
  assert.doesNotMatch(redactionProbe.stderr, /\/Users\/example/);
  assert.match(redactionProbe.stderr, /omitted for privacy/);
  const importRedactionProbe = await runBreezeRuntimeProbe({
    command: process.execPath,
    probeArgs: ['-e', "console.error('ImportError: token=abc password:xyz api-key=secret-value')"],
    timeoutMs: 1000,
  });
  assert.equal(importRedactionProbe.stderr, 'ImportError: token=<redacted> password:<redacted> api-key=<redacted>');
  assert.doesNotMatch(importRedactionProbe.stderr, /abc|xyz|secret-value/);
  const quotedImportRedactionProbe = await runBreezeRuntimeProbe({
    command: process.execPath,
    probeArgs: ['-e', "console.error('ImportError: token=\\\"secret LEAK_MARKER\\\" password=\\\'multi word password\\\'')"],
    timeoutMs: 1000,
  });
  assert.equal(quotedImportRedactionProbe.stderr, 'ImportError: token=<redacted> password=<redacted>');
  assert.doesNotMatch(quotedImportRedactionProbe.stderr, /secret|LEAK_MARKER|multi word password/);
  const moduleSource = fs.readFileSync(new URL('../lib/breeze-asr.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(moduleSource, /(?:open|read|stat)Sync\(/, 'Breeze 模型檢查不可用同步檔案 I/O 阻塞 event loop');
  const appSource = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const indexSource = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(appSource, /openBreezeRuntimeInstallDialog/);
  assert.match(appSource, /recheckBreezeRuntime/);
  assert.match(indexSource, /id="breezeRuntimeModal"/);
  assert.match(indexSource, /id="copyBreezeRuntimeSetup"/);
  assert.match(indexSource, /id="openBreezeRuntimeFromModel"/);
  assert.match(indexSource, /id="openBreezeRuntimeGuideButton"/);
  assert.match(indexSource, /id="copyBreezeRuntimePackagedLaunch"/);
  assert.match(indexSource, /id="breezeRuntimePackagedLaunchCommand"/);
  assert.match(indexSource, /id="useWhisperCppInstead"/);
  console.log('Breeze ASR 25 模型契約、runtime 探針與 CLI 參數測試通過');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
