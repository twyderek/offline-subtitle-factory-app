import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, '..');
const toolsDir = path.join(appDir, 'tools');
const targetArg = process.argv.find((arg) => arg.startsWith('--target='));
const target = targetArg?.slice('--target='.length) || `${process.platform}-${process.arch}`;

const targetDefinitions = {
  'win32-x64': {
    files: {
      ffmpeg: 'ffmpeg/bin/ffmpeg.exe',
      ffprobe: 'ffmpeg/bin/ffprobe.exe',
      whisper: 'whisper-cpp/whisper-cli.exe',
      whisperDll: 'whisper-cpp/whisper.dll',
      model: 'whisper-models/ggml-tiny.bin',
    },
    ffmpeg: { version: '8.1.2 essentials', source: 'https://www.gyan.dev/ffmpeg/builds/' },
    acceleration: 'CPU',
  },
  'darwin-arm64': {
    files: {
      ffmpeg: 'ffmpeg/bin/ffmpeg',
      ffprobe: 'ffmpeg/bin/ffprobe',
      whisper: 'whisper-cpp/whisper-cli',
      model: 'whisper-models/ggml-tiny.bin',
    },
    ffmpeg: { version: '8.1.2', source: 'https://ffmpeg.martin-riedl.de/' },
    acceleration: 'Apple Metal + Accelerate',
  },
};

const definition = targetDefinitions[target];
if (!definition) throw new Error(`Unsupported runtime target: ${target}`);

const entries = {};
for (const [key, relativePath] of Object.entries(definition.files)) {
  const filePath = path.join(toolsDir, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`Runtime file is missing: ${filePath}`);
  entries[key] = {
    path: relativePath,
    size: fs.statSync(filePath).size,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex'),
  };
}

const manifest = {
  schema: 2,
  app: 'offline-subtitle-factory',
  target,
  generatedAt: new Date().toISOString(),
  strategy: 'fully-bundled-runtime',
  components: {
    ffmpeg: definition.ffmpeg,
    whisperCpp: {
      version: '1.9.1',
      source: 'https://github.com/ggml-org/whisper.cpp/releases/tag/v1.9.1',
      acceleration: definition.acceleration,
    },
    model: { name: 'ggml-tiny multilingual', source: 'https://huggingface.co/ggerganov/whisper.cpp' },
    node: { strategy: 'Electron executable with ELECTRON_RUN_AS_NODE=1' },
  },
  files: entries,
};

const manifestsDir = path.join(toolsDir, 'manifests');
fs.mkdirSync(manifestsDir, { recursive: true });
const targetManifestPath = path.join(manifestsDir, `${target}.json`);
const activeManifestPath = path.join(toolsDir, 'manifest.json');
const content = `${JSON.stringify(manifest, null, 2)}\n`;
fs.writeFileSync(targetManifestPath, content, 'utf8');
fs.writeFileSync(activeManifestPath, content, 'utf8');
console.log(`[runtime] Manifest written: ${targetManifestPath}`);
