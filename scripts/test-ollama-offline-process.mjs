import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { spawnManagedChild, stopManagedChild } from '../lib/ai/managed-child-process.mjs';

const nonexistentCommand = path.join(os.tmpdir(), `osf-no-such-command-${process.pid}-${Date.now()}`);
const child = spawnManagedChild(nonexistentCommand, [], { stdio: 'ignore' });
let timer;
const closeInfo = await Promise.race([child.closed, new Promise((resolve) => { timer = setTimeout(() => resolve(null), 3000); })]);
clearTimeout(timer);

assert.equal(child.started, false, '不存在的 executable 不得標示為已啟動');
assert.equal(child.spawnError?.code, 'ENOENT', 'spawn error 必須被接收並正規化');
assert.ok(closeInfo, 'spawn error 後必須可觀察 child close，供 cleanup 完成');
assert.equal(await stopManagedChild(child), true, '已關閉的 spawn failure child 必須安全完成 cleanup');

const resolveExecutable = (name) => process.env.PATH?.split(path.delimiter)
  .map((directory) => path.join(directory, name))
  .find((candidate) => {
    try { fs.accessSync(candidate, fs.constants.X_OK); return true; } catch { return false; }
  }) || null;
const ollamaPath = resolveExecutable('ollama');
const modelDirectory = path.join(os.homedir(), '.ollama', 'models');
if (process.platform === 'darwin' && fs.existsSync('/usr/bin/sandbox-exec') && ollamaPath && fs.existsSync(modelDirectory)) {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-ollama-wrapper-spawn-test-'));
  const evidencePath = path.join(testRoot, 'spawn-failure.json');
  const missingSandboxCommand = path.join(testRoot, 'intentionally-missing-sandbox-exec');
  try {
    assert.equal(fs.existsSync(missingSandboxCommand), false, 'fault-injection executable 必須確實不存在');
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./probe-ollama-product-offline.mjs', import.meta.url)), evidencePath], {
      cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 4096,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        OLLAMA_BIN: ollamaPath,
        OLLAMA_MODEL: 'llama3.2:1b',
        OLLAMA_MODELS: modelDirectory,
        OLLAMA_BASE_URL: '',
        OSF_TEST_ONLY_OLLAMA_SPAWN_COMMAND: missingSandboxCommand,
      },
    });
    assert.equal(result.error, undefined, `wrapper subprocess 不應 spawnSync error：${result.error?.code || ''}`);
    assert.equal(result.status, 1, 'wrapper 對 daemon spawn failure 必須以非零狀態結束');
    const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    assert.equal(evidence.status, 'fail');
    assert.equal(evidence.failureCode, 'SANDBOXED_OLLAMA_SPAWN_FAILED');
    assert.equal(evidence.failureStage, 'ollama_start');
    assert.equal(evidence.daemon.startedInSandbox, false);
    assert.equal(evidence.cleanup.daemonStopped, true);
    assert.equal(evidence.cleanup.daemonPortClosed, true);
    assert.equal(evidence.cleanup.temporaryRootRemoved, true);
  } finally {
    fs.rmSync(testRoot, { recursive: true, force: true });
  }
} else {
  console.log('Ollama offline wrapper spawn-error integration test skipped: macOS Seatbelt, Ollama executable, or model store unavailable');
}

console.log('Ollama offline managed-child test passed: spawn error is observed, close is awaited, cleanup is safe');
