import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const WHISPER_MODEL_DEFINITIONS = Object.freeze({
  tiny: Object.freeze({
    name: 'tiny',
    label: '快速（Tiny）',
    description: '低資源、速度最快',
    filename: 'ggml-tiny.bin',
    minimumBytes: 70 * 1024 * 1024,
  }),
  base: Object.freeze({
    name: 'base',
    label: '平衡（Base）',
    description: '一般電腦的品質／速度平衡',
    filename: 'ggml-base.bin',
    minimumBytes: 130 * 1024 * 1024,
  }),
  small: Object.freeze({
    name: 'small',
    label: '精準（Small）',
    description: '中文口說品質較高、處理較久',
    filename: 'ggml-small.bin',
    minimumBytes: 400 * 1024 * 1024,
  }),
});

export const DEFAULT_WHISPER_MODEL = 'tiny';

const MODEL_ALIASES = Object.freeze({
  'tiny-multilingual': 'tiny',
  'base-multilingual': 'base',
  'small-multilingual': 'small',
  'ggml-tiny': 'tiny',
  'ggml-base': 'base',
  'ggml-small': 'small',
});

export function normalizeWhisperModelName(value) {
  const raw = String(value || '').trim().toLowerCase();
  const normalized = MODEL_ALIASES[raw] || raw;
  return Object.hasOwn(WHISPER_MODEL_DEFINITIONS, normalized) ? normalized : DEFAULT_WHISPER_MODEL;
}

export function getWhisperModelDefinition(value) {
  return WHISPER_MODEL_DEFINITIONS[normalizeWhisperModelName(value)];
}

export function listWhisperModels() {
  return Object.values(WHISPER_MODEL_DEFINITIONS).map((definition) => ({
    name: definition.name,
    label: definition.label,
    description: definition.description,
    filename: definition.filename,
  }));
}

export function resolveWhisperModelPath(modelsDir, value) {
  const definition = getWhisperModelDefinition(value);
  return {
    ...definition,
    path: path.join(modelsDir, definition.filename),
  };
}

export function inspectWhisperModel({ modelsDir, fallbackModelsDirs = [], manifest, modelName, allowMock = false }) {
  const model = getWhisperModelDefinition(modelName);
  const modelDirectories = [modelsDir, ...fallbackModelsDirs].filter(Boolean).map((directory) => path.resolve(directory));
  const modelPath = modelDirectories
    .map((directory) => path.join(directory, model.filename))
    .find((candidate) => fs.existsSync(candidate)) || path.join(modelDirectories[0] || modelsDir, model.filename);
  const manifestEntry = manifest?.files?.models?.[model.name]
    || manifest?.models?.[model.name]
    || (model.name === 'tiny' ? manifest?.files?.model : null);
  if (!fs.existsSync(modelPath)) {
    return { ...model, installed: false, valid: false, reason: 'missing', path: modelPath, manifestEntry: manifestEntry || null };
  }
  const size = fs.statSync(modelPath).size;
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(modelPath)).digest('hex');
  const sizeValid = size >= model.minimumBytes || allowMock;
  const hashValid = !manifestEntry?.sha256 || manifestEntry.sha256 === sha256;
  const manifestSizeValid = !manifestEntry?.size || manifestEntry.size === size;
  return {
    ...model,
    installed: true,
    valid: sizeValid && hashValid && manifestSizeValid,
    reason: !sizeValid ? 'too-small' : !hashValid ? 'sha256-mismatch' : !manifestSizeValid ? 'size-mismatch' : 'ok',
    path: modelPath,
    size,
    sha256,
    manifestEntry: manifestEntry || null,
  };
}

export function inspectWhisperModels({ modelsDir, fallbackModelsDirs = [], manifest, allowMock = false }) {
  return Object.fromEntries(Object.keys(WHISPER_MODEL_DEFINITIONS).map((name) => [
    name,
    inspectWhisperModel({ modelsDir, fallbackModelsDirs, manifest, modelName: name, allowMock }),
  ]));
}

export function buildWhisperCppArgs({ modelPath, audioFile, outputBase, language = 'zh', cpuThreads = 1, forceCpu = false }) {
  const args = [
    '-m', modelPath,
    '-f', audioFile,
    '-l', language,
    '-osrt',
    '-oj',
    '-ojf',
    '-of', outputBase,
    '-t', String(cpuThreads),
  ];
  if (forceCpu) args.push('--no-gpu');
  return args;
}
