import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, '..');
const toolsDir = process.env.OFFLINE_SUBTITLE_TOOLS_DIR
  ? path.resolve(process.env.OFFLINE_SUBTITLE_TOOLS_DIR)
  : path.join(appDir, 'tools');
const targetArg = process.argv.find((arg) => arg.startsWith('--target='));
const target = targetArg?.slice('--target='.length) || `${process.platform}-${process.arch}`;
const sourceManifest = path.join(toolsDir, 'manifests', `${target}.json`);
const packagedManifest = path.join(toolsDir, 'manifest.json');
const manifestPath = fs.existsSync(sourceManifest) ? sourceManifest : packagedManifest;

const targetDefinitions = {
  'win32-x64': {
    format: 'pe',
    files: {
      ffmpeg: 'ffmpeg/bin/ffmpeg.exe',
      ffprobe: 'ffmpeg/bin/ffprobe.exe',
      whisper: 'whisper-cpp/whisper-cli.exe',
      whisperDll: 'whisper-cpp/whisper.dll',
      model: 'whisper-models/ggml-tiny.bin',
    },
  },
  'darwin-arm64': {
    format: 'mach-o',
    files: {
      ffmpeg: 'ffmpeg/bin/ffmpeg',
      ffprobe: 'ffmpeg/bin/ffprobe',
      whisper: 'whisper-cpp/whisper-cli',
      model: 'whisper-models/ggml-tiny.bin',
    },
  },
};

const definition = targetDefinitions[target];
const paths = definition
  ? Object.fromEntries(Object.entries(definition.files).map(([key, relativePath]) => [key, path.join(toolsDir, relativePath)]))
  : null;

function fail(message) {
  console.error(`[runtime] ${message}`);
  process.exitCode = 1;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function verifyFile(label, filePath, minimumBytes = 1) {
  if (!fs.existsSync(filePath)) {
    fail(`${label} is missing: ${filePath}`);
    return false;
  }
  const size = fs.statSync(filePath).size;
  if (size < minimumBytes) {
    fail(`${label} is unexpectedly small (${size} bytes): ${filePath}`);
    return false;
  }
  return true;
}

function verifyExecutable(label, filePath) {
  if (!verifyFile(label, filePath, 1024)) return false;
  const fd = fs.openSync(filePath, 'r');
  const signature = Buffer.alloc(4);
  fs.readSync(fd, signature, 0, 4, 0);
  fs.closeSync(fd);
  if (definition.format === 'pe' && signature.subarray(0, 2).toString('ascii') !== 'MZ') {
    fail(`${label} is not a Windows PE executable: ${filePath}`);
    return false;
  }
  const machOMagic = signature.toString('hex');
  if (definition.format === 'mach-o' && !['cffaedfe', 'feedfacf'].includes(machOMagic)) {
    fail(`${label} is not a 64-bit Mach-O executable: ${filePath}`);
    return false;
  }
  return true;
}

if (!paths) {
  fail(`No standalone runtime definition exists for target ${target}.`);
} else {
  const valid = [
    verifyExecutable('FFmpeg', paths.ffmpeg),
    verifyExecutable('FFprobe', paths.ffprobe),
    verifyExecutable('Whisper.cpp CLI', paths.whisper),
    paths.whisperDll ? verifyExecutable('Whisper.cpp runtime DLL', paths.whisperDll) : true,
    verifyFile('Whisper multilingual tiny model', paths.model, 70 * 1024 * 1024),
    verifyFile('Runtime manifest', manifestPath, 100),
  ].every(Boolean);

  if (valid) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
    if (manifest.target !== target) fail(`Runtime manifest target mismatch: expected ${target}, got ${manifest.target}`);
    for (const [key, filePath] of Object.entries(paths)) {
      const expected = manifest.files?.[key]?.sha256;
      if (!expected) fail(`Runtime manifest has no SHA-256 for ${key}`);
      else if (sha256(filePath) !== expected) fail(`Runtime hash mismatch for ${key}: ${filePath}`);
    }

    if (`${process.platform}-${process.arch}` === target) {
      const commands = [
        [paths.ffmpeg, ['-version']],
        [paths.ffprobe, ['-version']],
        [paths.whisper, ['--help']],
      ];
      for (const [command, args] of commands) {
        const result = spawnSync(command, args, { encoding: 'utf8', timeout: 30000, windowsHide: true });
        if (result.error || result.status !== 0) fail(`Runtime smoke test failed: ${command}`);
      }
    }
  }
}

if (!process.exitCode) {
  console.log(`[runtime] OK: ${target}`);
  console.log(`[runtime] FFmpeg: ${paths.ffmpeg}`);
  console.log(`[runtime] Whisper.cpp: ${paths.whisper}`);
  console.log(`[runtime] Default model: ${paths.model}`);
}
