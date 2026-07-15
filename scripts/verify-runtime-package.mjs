import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, '..');
const toolsDir = process.env.OFFLINE_SUBTITLE_TOOLS_DIR
  ? path.resolve(process.env.OFFLINE_SUBTITLE_TOOLS_DIR)
  : path.join(appDir, 'tools');

const runtimeCandidates = [
  path.join(toolsDir, 'python', 'python.exe'),
  path.join(toolsDir, 'python-embed', 'python.exe'),
];
const legacyVenvPython = path.join(toolsDir, 'python-venv', 'Scripts', 'python.exe');
const legacyPyvenvCfg = path.join(toolsDir, 'python-venv', 'pyvenv.cfg');

function fail(message) {
  console.error(`[runtime] ${message}`);
  process.exitCode = 1;
}

function warn(message) {
  console.warn(`[runtime] WARNING: ${message}`);
}

function run(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 60000,
    windowsHide: true,
    env: {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    },
  });
}

const python = runtimeCandidates.find((candidate) => fs.existsSync(candidate));

if (!python) {
  fail([
    'No portable Python runtime was found.',
    `Expected one of: ${runtimeCandidates.join(', ')}`,
    legacyVenvPython && fs.existsSync(legacyVenvPython)
      ? 'Only tools/python-venv was found; do not ship venv folders in installer or portable builds.'
      : '',
  ].filter(Boolean).join('\n'));
} else {
  const version = run(python, ['--version']);
  if (version.error || version.status !== 0) {
    fail(`Python runtime is not runnable: ${python}`);
  }

  const whisper = run(python, ['-c', 'import whisper; print("ok")']);
  if (whisper.error || whisper.status !== 0 || !whisper.stdout.includes('ok')) {
    fail(`Whisper is not importable from portable Python: ${python}`);
  }
}

if (fs.existsSync(legacyPyvenvCfg)) {
  const pyvenv = fs.readFileSync(legacyPyvenvCfg, 'utf8');
  if (/^[a-z]:\\/im.test(pyvenv) || pyvenv.includes('AppData\\Local\\Programs\\Python')) {
    if (python) {
      warn(`Legacy venv contains absolute machine paths and must stay excluded from builds: ${legacyPyvenvCfg}`);
    } else {
      fail(`Legacy venv contains absolute machine paths: ${legacyPyvenvCfg}`);
    }
  }
}

if (!process.exitCode) {
  console.log(`[runtime] OK: ${python}`);
}
