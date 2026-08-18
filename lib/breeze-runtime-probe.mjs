import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { BREEZE_ASR_ENGINE, buildBreezeRuntimeProbeArgs, inspectBreezeAsrModel } from './breeze-asr.mjs';

function redactProbeText(value) {
  return String(value || '')
    .replace(/(?:\/Users|\/home|C:\\Users|[A-Za-z]:\\Users)[^\s'"\\]+/g, '<local-path>')
    .replace(/((?:api[_-]?key|token|secret|password))(\s*[=:])\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;]+)/gi, '$1$2<redacted>');
}

function summarizeProbeText(value) {
  const text = redactProbeText(value);
  const moduleError = text.match(/ModuleNotFoundError:\s*No module named\s+['"]([^'"]+)['"]/i);
  if (moduleError) return `ModuleNotFoundError: No module named ${moduleError[1]}`;
  const importError = text.match(/ImportError:\s*([^\n]+)/i);
  if (importError) return `ImportError: ${importError[1].slice(0, 240)}`;
  return text.trim() ? 'runtime probe returned diagnostic output (omitted for privacy)' : '';
}

export function resolveBreezePython({ env = process.env, toolsDir = '', platform = process.platform } = {}) {
  const explicit = String(env.BREEZE_ASR_PYTHON || '').trim();
  const homeDir = String(platform === 'win32'
    ? (env.USERPROFILE || env.HOME || os.homedir())
    : (env.HOME || env.USERPROFILE || os.homedir()) || '').trim();
  const externalRuntimeCandidates = homeDir
    ? platform === 'win32'
      ? [
        path.join(homeDir, 'Breeze-ASR-25', '.venv', 'Scripts', 'python.exe'),
        path.join(homeDir, 'Breeze-ASR-25', '.venv', 'Scripts', 'python3.exe'),
      ]
      : [
        path.join(homeDir, 'Breeze-ASR-25', '.venv', 'bin', 'python'),
        path.join(homeDir, 'Breeze-ASR-25', '.venv', 'bin', 'python3'),
      ]
    : [];
  if (explicit) return explicit;
  const bundledPython = platform === 'win32' ? 'python.exe' : 'python';
  const candidates = [
    ...externalRuntimeCandidates,
    toolsDir && path.join(toolsDir, 'python', bundledPython),
    toolsDir && path.join(toolsDir, 'python-embed', bundledPython),
    toolsDir && path.join(toolsDir, 'python-venv', platform === 'win32' ? 'Scripts' : 'bin', bundledPython),
    platform === 'win32' ? 'python' : 'python3',
    platform === 'win32' ? 'py' : 'python',
  ].filter(Boolean);
  return candidates.find((candidate) => !path.isAbsolute(candidate) || fs.existsSync(candidate)) || candidates.at(-1);
}

export function runBreezeRuntimeProbe({ command, probeArgs = buildBreezeRuntimeProbeArgs(), timeoutMs = 15000, spawnImpl = spawn } = {}) {
  return new Promise((resolve) => {
    if (!command) {
      resolve({ ok: false, code: null, timedOut: false, stdout: '', stderr: '未指定 Python 路徑', elapsedMs: 0 });
      return;
    }
    const startedAt = Date.now();
    const child = spawnImpl(command, probeArgs, { shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timeoutRequested = false;
    let timer;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, error: result.error ? summarizeProbeText(result.error) : undefined, stdout: summarizeProbeText(stdout), stderr: summarizeProbeText(stderr), elapsedMs: Date.now() - startedAt });
    };
    timer = setTimeout(() => {
      timeoutRequested = true;
      const finishTimeout = () => finish({ ok: false, code: null, timedOut: true });
      if (process.platform === 'win32' && child.pid) {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { shell: false, stdio: 'ignore', windowsHide: true });
        killer.once('error', () => child.kill('SIGKILL'));
        killer.once('close', () => { if (!settled) child.kill('SIGKILL'); });
      } else {
        try { if (child.pid) process.kill(-child.pid, 'SIGKILL'); }
        catch { child.kill('SIGKILL'); }
      }
      child.once('close', finishTimeout);
    }, Math.max(250, Number(timeoutMs) || 15000));
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.on('error', (error) => finish({ ok: false, code: null, timedOut: false, error: error.message }));
    child.on('close', (code) => finish(timeoutRequested ? { ok: false, code: null, timedOut: true } : { ok: code === 0, code, timedOut: false }));
  });
}

export async function collectBreezeRuntimeProbe({ python, modelDir, timeoutMs = 15000, inspectModel = true } = {}) {
  const model = inspectModel
    ? await inspectBreezeAsrModel(modelDir || path.join(os.tmpdir(), 'offline-subtitle-breeze-models'))
    : null;
  const runtime = await runBreezeRuntimeProbe({ command: python, timeoutMs });
  return {
    engine: BREEZE_ASR_ENGINE,
    python: python ? path.basename(python) : null,
    modelDirectory: modelDir ? path.basename(modelDir) : null,
    model: model ? { ...model, path: model.path ? path.basename(model.path) : model.path } : null,
    runtime,
    ready: Boolean(model?.valid && runtime.ok),
  };
}
