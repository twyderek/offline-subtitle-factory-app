import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import Busboy from 'busboy';
import { getEditPaths, normalizeEditPlan, readEditPlan, resolveEffectiveMediaPath } from './lib/media-edit.mjs';
import { trimSrtToRange } from './lib/subtitle-timeline.mjs';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(appDir, 'public');
const defaultJobsDir = process.env.OFFLINE_SUBTITLE_DATA_DIR
  ? path.resolve(process.env.OFFLINE_SUBTITLE_DATA_DIR)
  : path.join(appDir, 'jobs');
const defaultToolsDir = process.env.OFFLINE_SUBTITLE_TOOLS_DIR
  ? path.resolve(process.env.OFFLINE_SUBTITLE_TOOLS_DIR)
  : path.join(appDir, 'tools');
const settingsDir = process.env.OFFLINE_SUBTITLE_SETTINGS_DIR
  ? path.resolve(process.env.OFFLINE_SUBTITLE_SETTINGS_DIR)
  : path.join(appDir, 'config');
const settingsPath = path.join(settingsDir, 'settings.json');
const port = Number(process.env.PORT || 8790);
const apiToken = process.env.OFFLINE_SUBTITLE_API_TOKEN || '';

const toolsInfo = resolveToolsInfo();
const toolsDir = toolsInfo.toolsDir;
const toolPaths = toolsInfo.paths;

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.srt': 'text/plain; charset=utf-8',
  '.ass': 'text/plain; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.m4v': 'video/x-m4v',
  '.mov': 'video/quicktime',
};

fs.mkdirSync(settingsDir, { recursive: true });
fs.mkdirSync(toolPaths.whisperModels, { recursive: true });

const runningJobs = new Map();
const runningBurns = new Map();
const runningWaveforms = new Map();
const runningThumbnails = new Map();
const runningTrims = new Map();
const jobQueue = [];
const configuredMaxConcurrentJobs = Number(process.env.OFFLINE_SUBTITLE_MAX_JOBS || 1);
const maxConcurrentJobs = Number.isFinite(configuredMaxConcurrentJobs)
  ? Math.max(1, Math.floor(configuredMaxConcurrentJobs))
  : 1;
let activeJobCount = 0;
let jobsListCache = null;
let basicToolsCache = null;
let basicToolsPromise = null;
let gpuCache = null;
let gpuPromise = null;
const basicToolsCacheTtlMs = 60000;
const gpuCacheTtlMs = 5 * 60000;

const defaultSettings = {
  appLanguage: 'zh-TW',
  projectFolder: defaultJobsDir,
  importFolder: '',
  exportFolder: '',
};

let appSettings = loadSettings();
fs.mkdirSync(getJobsDir(), { recursive: true });

function sendJson(res, status, value) {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function readRequest(req, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let timer = null;
    req.on('data', (chunk) => {
      chunks.push(chunk);
      if (chunks.reduce((sum, c) => sum + c.length, 0) > 2 * 1024 * 1024 * 1024) {
        clearTimeout(timer);
        reject(new Error('Request body too large (max 2GB)'));
      }
    });
    timer = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, timeoutMs);
    req.on('end', () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function readJsonBody(req) {
  return JSON.parse((await readRequest(req)).toString('utf8') || '{}');
}

function streamMultipart(req, tempDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(tempDir, { recursive: true });
    const fields = {};
    const files = {};
    const writes = [];
    const tempPaths = [];
    let settled = false;
    const cleanup = () => tempPaths.forEach((filePath) => {
      try { fs.unlinkSync(filePath); } catch {}
    });
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    let parser;
    try {
      parser = Busboy({
        headers: req.headers,
        limits: { files: 4, fields: 50, fieldSize: 1024 * 1024, fileSize: 2 * 1024 * 1024 * 1024 },
      });
    } catch (error) {
      fail(error);
      return;
    }

    parser.on('field', (name, value) => {
      fields[name] = value.trim();
    });
    parser.on('file', (name, file, info) => {
      const submittedName = String(info.filename || '').trim();
      if (!submittedName) {
        file.resume();
        return;
      }
      const filename = path.basename(submittedName);
      const tempPath = path.join(tempDir, `${crypto.randomUUID()}-${filename}`);
      const output = fs.createWriteStream(tempPath, { flags: 'wx' });
      tempPaths.push(tempPath);
      let size = 0;
      file.on('data', (chunk) => { size += chunk.length; });
      file.on('limit', () => fail(new Error(`檔案過大：${filename}（上限 2GB）`)));
      file.on('error', fail);
      output.on('error', fail);
      const completed = new Promise((resolveWrite, rejectWrite) => {
        output.on('finish', () => {
          if (size > 0) {
            files[name] = { filename, path: tempPath, size, mimeType: info.mimeType };
          } else {
            try { fs.unlinkSync(tempPath); } catch {}
          }
          resolveWrite();
        });
        output.on('error', rejectWrite);
      });
      writes.push(completed);
      file.pipe(output);
    });
    parser.on('filesLimit', () => fail(new Error('上傳檔案數量超過限制')));
    parser.on('fieldsLimit', () => fail(new Error('表單欄位數量超過限制')));
    parser.on('error', fail);
    parser.on('close', async () => {
      if (settled) return;
      try {
        await Promise.all(writes);
        settled = true;
        resolve({ fields, files, cleanup });
      } catch (error) {
        fail(error);
      }
    });
    req.on('aborted', () => fail(new Error('上傳已中斷')));
    req.pipe(parser);
  });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function resolveToolsInfo() {
  const candidates = [
    process.env.OFFLINE_SUBTITLE_TOOLS_DIR,
    path.join(appDir, 'tools'),
    path.resolve(appDir, '..', 'tools'),
  ]
    .filter(Boolean)
    .map((candidate) => path.resolve(candidate));

  const uniqueCandidates = [...new Set(candidates)];
  const selected = uniqueCandidates.find((candidate) => hasAnyTool(candidate)) || uniqueCandidates[0] || defaultToolsDir;
  return buildToolsInfo(selected, uniqueCandidates);
}

function hasAnyTool(candidate) {
  return [
    path.join(candidate, 'python', 'python.exe'),
    path.join(candidate, 'python-embed', 'python.exe'),
    path.join(candidate, 'python-venv', 'Scripts', 'python.exe'),
    path.join(candidate, 'ffmpeg', 'bin', 'ffmpeg.exe'),
    path.join(candidate, 'ffmpeg', 'bin', 'ffmpeg'),
    path.join(candidate, 'whisper-cpp', 'whisper-cli.exe'),
    path.join(candidate, 'whisper-cpp', 'whisper-cli'),
    path.join(candidate, 'node', 'node.exe'),
  ].some((filePath) => fs.existsSync(filePath));
}

function firstExisting(paths, fallback = paths[0]) {
  return paths.find((filePath) => fs.existsSync(filePath)) || fallback;
}

function buildToolsInfo(selectedToolsDir, candidates) {
  const pythonCandidates = [
    path.join(selectedToolsDir, 'python', 'python.exe'),
    path.join(selectedToolsDir, 'python-embed', 'python.exe'),
    path.join(selectedToolsDir, 'python-venv', 'Scripts', 'python.exe'),
  ];
  const whisperCppCandidates = [
    path.join(selectedToolsDir, 'whisper-cpp', process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'),
  ];
  const paths = {
    node: firstExisting([
      path.join(selectedToolsDir, 'node', 'node.exe'),
      process.execPath,
    ]),
    ffmpeg: firstExisting([
      path.join(selectedToolsDir, 'ffmpeg', 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
      'ffmpeg',
    ]),
    ffprobe: firstExisting([
      path.join(selectedToolsDir, 'ffmpeg', 'bin', process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'),
      'ffprobe',
    ]),
    python: firstExisting(pythonCandidates),
    whisper: 'python -m whisper',
    whisperCpp: firstExisting(whisperCppCandidates),
    whisperModels: process.env.WHISPER_CACHE || path.join(selectedToolsDir, 'whisper-models'),
    whisperCppModel: path.join(selectedToolsDir, 'whisper-models', 'ggml-tiny.bin'),
    manifest: path.join(selectedToolsDir, 'manifest.json'),
  };
  return {
    toolsDir: selectedToolsDir,
    candidates,
    paths,
    manifest: loadToolsManifest(path.join(selectedToolsDir, 'manifest.json')),
  };
}

function loadToolsManifest(manifestPath) {
  try {
    if (!fs.existsSync(manifestPath)) return null;
    return readJson(manifestPath);
  } catch {
    return null;
  }
}

function normalizeFolder(value) {
  const text = String(value || '').trim();
  return text ? path.resolve(text) : '';
}

function loadSettings() {
  try {
    if (!fs.existsSync(settingsPath)) return { ...defaultSettings };
    return normalizeSettings(readJson(settingsPath));
  } catch {
    return { ...defaultSettings };
  }
}

function normalizeSettings(value = {}) {
  return {
    appLanguage: ['zh-TW', 'zh-CN', 'en'].includes(value.appLanguage) ? value.appLanguage : defaultSettings.appLanguage,
    projectFolder: normalizeFolder(value.projectFolder) || defaultSettings.projectFolder,
    importFolder: normalizeFolder(value.importFolder),
    exportFolder: normalizeFolder(value.exportFolder),
  };
}

function saveSettings(nextSettings) {
  appSettings = normalizeSettings({ ...appSettings, ...nextSettings });
  fs.mkdirSync(settingsDir, { recursive: true });
  fs.mkdirSync(getJobsDir(), { recursive: true });
  writeJson(settingsPath, appSettings);
  jobsListCache = null;
  return appSettings;
}

function getJobsDir() {
  return appSettings?.projectFolder || defaultJobsDir;
}

function parseMultipart(buffer, contentType = '') {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error('Missing multipart boundary');
  const boundary = `--${boundaryMatch[1] || boundaryMatch[2]}`;
  const raw = buffer.toString('latin1');
  const fields = {};
  const files = {};

  for (const part of raw.split(boundary).slice(1, -1)) {
    const clean = part.replace(/^\r\n/, '').replace(/\r\n$/, '');
    const splitIndex = clean.indexOf('\r\n\r\n');
    if (splitIndex < 0) continue;
    const header = clean.slice(0, splitIndex);
    const bodyLatin1 = clean.slice(splitIndex + 4);
    const name = header.match(/name="([^"]+)"/i)?.[1];
    if (!name) continue;
    const filename = header.match(/filename="([^"]*)"/i)?.[1];
    const body = Buffer.from(bodyLatin1, 'latin1');
    const value = body.subarray(0, body.length >= 2 && body.at(-2) === 13 && body.at(-1) === 10 ? body.length - 2 : body.length);
    if (filename) {
      files[name] = { filename: path.basename(filename), buffer: value };
    } else {
      fields[name] = value.toString('utf8').trim();
    }
  }
  return { fields, files };
}

function loadJob(jobId) {
  const jobRoot = path.join(getJobsDir(), jobId);
  const configPath = path.join(jobRoot, 'job-config.json');
  const statusPath = path.join(jobRoot, 'job-status.json');
  if (!fs.existsSync(configPath) || !fs.existsSync(statusPath)) return null;
  return {
    jobRoot,
    config: readJson(configPath),
    status: readJson(statusPath),
  };
}

function listJobs() {
  if (jobsListCache) return jobsListCache;
  const jobsDir = getJobsDir();
  if (!fs.existsSync(jobsDir)) return [];
  jobsListCache = fs.readdirSync(jobsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const job = loadJob(entry.name);
      if (!job) return null;
      const reviewOutputDir = path.join(job.jobRoot, 'review-output');
      const outputDir = path.join(job.jobRoot, 'output');
      const videoName = job.config.files?.video || '';
      const ruleName = job.config.files?.ruleFile || '';
      return {
        jobId: job.config.jobId || entry.name,
        status: job.status.status || 'unknown',
        stage: job.status.stage || 'unknown',
        progress: Number(job.status.progress || 0),
        message: job.status.message || '',
        createdAt: job.config.createdAt || '',
        updatedAt: job.status.updatedAt || job.config.createdAt || '',
        language: job.config.language || '',
        files: {
          video: videoName,
          ruleFile: ruleName,
          existingSrt: job.config.files?.existingSrt || null,
        },
        hasReviewed: fs.existsSync(path.join(reviewOutputDir, 'reviewed.srt')),
        hasTrim: Boolean(readEditPlan(job.jobRoot)?.appliedAt && fs.existsSync(getEditPaths(job.jobRoot).trimmed)),
        trimUrl: `/trim/${job.config.jobId || entry.name}`,
        hasBurnSettings: fs.existsSync(path.join(reviewOutputDir, 'burn-settings.json')),
        hasOutput: fs.existsSync(outputDir) && fs.readdirSync(outputDir).some((name) => /\.(mp4|mkv|srt|vtt)$/i.test(name)),
        outputFolder: relativeToApp(outputDir),
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return jobsListCache;
}

function saveStatus(job) {
  writeJson(path.join(job.jobRoot, 'job-status.json'), job.status);
}

function updateJob(job, patch, log) {
  job.status = { ...job.status, ...patch, updatedAt: new Date().toISOString() };
  const cleanLog = sanitizeLog(log);
  if (cleanLog) job.status.logs = [...(job.status.logs || []), cleanLog].slice(-120);
  saveStatus(job);
  jobsListCache = null;
}

function sanitizeLog(value) {
  if (!value) return '';
  return String(value)
    .replace(/\r/g, '\n')
    .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
    .replace(/[�]+/g, '')
    .split('\n')
    .map((line) => line.trim().replace(/[^\S\r\n]+/g, ' '))
    .filter((line) => line && !/^[\s\-=|/\\_.:,%\d]+$/.test(line))
    .join('\n')
    .slice(0, 500);
}

function createJob({ fields, files }) {
  if (!files.video || Number(files.video.size || 0) <= 0) {
    throw new Error('請選擇有效的影片或音訊檔案');
  }
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const jobId = `${stamp}-${crypto.randomBytes(3).toString('hex')}`;
  const jobRoot = path.join(getJobsDir(), jobId);
  const inputDir = path.join(jobRoot, 'input');
  const workingDir = path.join(jobRoot, 'working');
  const reviewOutputDir = path.join(jobRoot, 'review-output');
  const outputDir = path.join(jobRoot, 'output');
  const logsDir = path.join(jobRoot, 'logs');
  for (const dir of [inputDir, workingDir, reviewOutputDir, outputDir, logsDir]) fs.mkdirSync(dir, { recursive: true });

  stageUploadedFile(files.video, path.join(inputDir, files.video?.filename || 'media.mp4'));
  stageUploadedFile(files.ruleFile, path.join(inputDir, files.ruleFile?.filename || 'rule.txt'));
  stageUploadedFile(files.existingSrt, path.join(inputDir, files.existingSrt?.filename || 'source.srt'));

  const config = {
    jobId,
    createdAt: new Date().toISOString(),
    language: fields.language || 'zh-TW',
    asrEngine: fields.asrEngine || 'whisper-cpp',
    modelName: fields.modelName || '',
    performancePreset: ['fast', 'balanced', 'accurate'].includes(fields.performancePreset)
      ? fields.performancePreset
      : 'balanced',
    cpuThreads: Math.min(64, Math.max(0, Number(fields.cpuThreads) || 0)),
    outputFormats: fields.outputFormats || 'srt,vtt',
    requirements: fields.requirements || '',
    files: {
      video: files.video?.filename || null,
      ruleFile: files.ruleFile?.filename || null,
      existingSrt: files.existingSrt?.filename || null,
    },
  };
  const status = {
    jobId,
    status: 'created',
    stage: 'created',
    progress: 0,
    message: '任務已建立，等待開始處理',
    logs: ['建立任務資料夾與設定檔'],
    metrics: {},
    folder: jobRoot,
    files: {},
  };
  writeJson(path.join(jobRoot, 'job-config.json'), config);
  writeJson(path.join(jobRoot, 'job-status.json'), status);
  jobsListCache = null;
  return { jobId, folder: jobRoot, status };
}

function stageUploadedFile(file, destination) {
  if (!file) return;
  if (file.path) {
    try {
      fs.renameSync(file.path, destination);
    } catch (error) {
      if (error.code !== 'EXDEV') throw error;
      fs.copyFileSync(file.path, destination);
      fs.unlinkSync(file.path);
    }
    return;
  }
  if (file.buffer) fs.writeFileSync(destination, file.buffer);
}

function commandExists(command, args = ['--version']) {
  return new Promise((resolve) => {
    if (!command) {
      resolve(false);
      return;
    }
    const needsFileCheck = path.isAbsolute(command) || command.includes('\\') || command.includes('/');
    if (needsFileCheck && !fs.existsSync(command)) {
      resolve(false);
      return;
    }
    const child = spawn(command, args, { shell: false, stdio: 'ignore', windowsHide: true });
    child.on('exit', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

async function getBasicToolsStatus(force = false) {
  const now = Date.now();
  if (!force && basicToolsCache && now - basicToolsCache.checkedAt < basicToolsCacheTtlMs) {
    return basicToolsCache;
  }
  if (!force && basicToolsPromise) return basicToolsPromise;
  basicToolsPromise = Promise.all([
    commandExists(toolPaths.node),
    commandExists(toolPaths.ffmpeg, ['-version']),
    commandExists(toolPaths.python),
    commandExists(toolPaths.python, ['-c', 'import whisper; print("ok")']),
    commandExists(toolPaths.whisperCpp, ['--help']),
  ]).then(([node, ffmpeg, python, pythonWhisper, whisperCpp]) => {
    const whisperCppModel = fs.existsSync(toolPaths.whisperCppModel);
    const whisper = pythonWhisper || (whisperCpp && whisperCppModel);
    const asrEngine = pythonWhisper ? 'openai-whisper' : whisperCpp && whisperCppModel ? 'whisper.cpp' : '';
    basicToolsCache = { node, ffmpeg, python, pythonWhisper, whisperCpp, whisperCppModel, whisper, asrEngine, checkedAt: Date.now() };
    return basicToolsCache;
  }).finally(() => { basicToolsPromise = null; });
  return basicToolsPromise;
}

async function getGpuStatus(force = false) {
  const now = Date.now();
  if (!force && gpuCache && now - gpuCache.checkedAt < gpuCacheTtlMs) return gpuCache.value;
  if (!force && gpuPromise) return gpuPromise;
  gpuPromise = detectGpu().then((value) => {
    gpuCache = { value, checkedAt: Date.now() };
    return value;
  }).finally(() => { gpuPromise = null; });
  return gpuPromise;
}

async function detectGpu() {
  const result = {
    available: false,
    status: 'cpu-only',
    deviceName: '',
    memoryMb: 0,
    cudaVersion: '',
    error: null,
  };

  if (!fs.existsSync(toolPaths.python)) {
    if (fs.existsSync(toolPaths.whisperCpp)) {
      if (process.platform === 'darwin' && process.arch === 'arm64') {
        return {
          ...result,
          available: true,
          status: 'mps',
          deviceName: 'Apple Silicon GPU (Metal)',
          error: null,
        };
      }
      return { ...result, status: 'cpu-only', error: null };
    }
    return { ...result, status: 'error', error: '找不到可用的本機轉錄引擎' };
  }

  const script = [
    'import json',
    'r = {"available": False, "status": "cpu-only", "deviceName": "", "memoryMb": 0, "cudaVersion": "", "error": None}',
    'try:',
    '    import torch',
    '    if torch.cuda.is_available():',
    '        r["available"] = True',
    '        r["status"] = "cuda"',
    '        r["deviceName"] = torch.cuda.get_device_name(0)',
    '        r["memoryMb"] = int(torch.cuda.get_device_properties(0).total_memory // (1024 ** 2))',
    '        r["cudaVersion"] = torch.version.cuda or ""',
    '    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():',
    '        r["available"] = True',
    '        r["status"] = "mps"',
    '        r["deviceName"] = "Apple Silicon GPU (Metal)"',
    'except Exception as e:',
    '    r["error"] = str(e)',
    'print(json.dumps(r, ensure_ascii=False))',
  ].join('\n');

  const output = await new Promise((resolve) => {
    const child = spawn(toolPaths.python, ['-c', script], { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: null, stdout, stderr, timedOut: true });
    }, 10000);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut: false });
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: error.message, timedOut: false });
    });
  });

  if (output.timedOut) {
    return { ...result, status: 'error', error: 'GPU 檢測逾時' };
  }

  if (output.code !== 0 && !output.stdout.trim()) {
    return { ...result, status: 'error', error: output.stderr.trim() || 'GPU 檢測失敗' };
  }

  try {
    const parsed = JSON.parse(output.stdout.trim());
    const next = {
      ...result,
      available: Boolean(parsed.available),
      status: parsed.status || 'cpu-only',
      deviceName: parsed.deviceName || '',
      memoryMb: Number(parsed.memoryMb || 0),
      cudaVersion: parsed.cudaVersion || '',
      error: parsed.error || null,
    };
    if (next.error) next.status = 'error';
    return next;
  } catch {
    return { ...result, status: 'error', error: 'PyTorch 輸出解析失敗' };
  }
}

async function healthCheck(force = false) {
  const tools = await getBasicToolsStatus(force);
  const {
    node: hasNode,
    ffmpeg: hasFfmpeg,
    python: hasPython,
    whisper: hasWhisper,
    whisperCpp: hasWhisperCpp,
    whisperCppModel: hasWhisperCppModel,
    asrEngine,
  } = tools;
  const gpuInfo = await getGpuStatus(force);

  // Determine overall readiness
  const criticalMissing = [];
  if (!hasNode) criticalMissing.push('Node.js');
  if (!hasFfmpeg) criticalMissing.push('FFmpeg');
  if (!hasWhisper) criticalMissing.push('Whisper 離線轉錄引擎或預設模型');

  const isReady = criticalMissing.length === 0;
  const canProcessJobs = hasWhisper && hasFfmpeg;

  // Build human-readable install guidance
  let installGuide = null;
  if (criticalMissing.length > 0) {
    const guideParts = [];
    guideParts.push('• 正式安裝包已內建所有必要元件；若檔案缺失或損壞，請重新安裝 APP。');
    installGuide = {
      missingTools: criticalMissing,
      steps: guideParts,
      repairAction: 'reinstall-app',
    };
  }

  return {
    ok: isReady,
    ready: isReady,
    canProcessJobs,
    node: process.version,
    localToolsDir: toolsDir,
    toolsInfo: {
      selectedToolsDir: toolsInfo.toolsDir,
      candidates: toolsInfo.candidates,
      manifest: toolsInfo.manifest,
      manifestPath: toolPaths.manifest,
    },
    settings: {
      settingsFile: settingsPath,
      projectFolder: getJobsDir(),
      importFolder: appSettings.importFolder,
      exportFolder: appSettings.exportFolder,
      appLanguage: appSettings.appLanguage,
    },
    tools: {
      node: hasNode,
      ffmpeg: hasFfmpeg,
      python: hasPython,
      whisper: hasWhisper,
      whisperCpp: hasWhisperCpp,
      whisperCppModel: hasWhisperCppModel,
      asrEngine,
      gpu: gpuInfo,
    },
    paths: toolPaths,
    installGuide,
    criticalMissing,
  };
}

function createJobCancelledError() {
  const error = new Error('任務已取消');
  error.code = 'JOB_CANCELLED';
  return error;
}

function throwIfJobCancelled(signal) {
  if (signal?.aborted) throw createJobCancelledError();
}

function startJob(jobId) {
  if (runningJobs.has(jobId)) return { started: false, alreadyRunning: true };
  if (runningTrims.has(jobId)) return { started: false, error: '影片修剪進行中，完成後才能開始字幕轉錄' };
  if (runningBurns.has(jobId)) return { started: false, error: '影片輸出進行中，無法開始字幕轉錄' };
  const job = loadJob(jobId);
  if (!job) return { started: false, error: '找不到任務' };
  const controller = new AbortController();
  const entry = { controller, promise: null, state: 'queued' };
  runningJobs.set(jobId, entry);
  jobQueue.push({ jobId, job, entry });
  const queued = activeJobCount >= maxConcurrentJobs;
  if (queued) {
    updateJob(job, {
      status: 'queued',
      stage: 'queued',
      progress: 0,
      message: `任務排隊中（前方 ${jobQueue.length - 1} 個）`,
    }, '已加入字幕處理佇列');
  }
  drainJobQueue();
  return { started: true, alreadyRunning: false, queued, queuePosition: queued ? jobQueue.length : 0 };
}

function drainJobQueue() {
  while (activeJobCount < maxConcurrentJobs && jobQueue.length) {
    const queuedJob = jobQueue.shift();
    const { jobId, job, entry } = queuedJob;
    if (entry.controller.signal.aborted) {
      runningJobs.delete(jobId);
      continue;
    }
    activeJobCount += 1;
    entry.state = 'running';
    entry.promise = runJob(job, entry.controller.signal)
    .catch((error) => {
      const cancelled = entry.controller.signal.aborted || error?.code === 'JOB_CANCELLED';
      updateJob(job, cancelled ? {
        status: 'cancelled',
        stage: 'cancelled',
        message: '任務已由使用者取消',
      } : {
        status: 'failed',
        stage: 'failed',
        message: `任務失敗：${error.message}`,
      }, cancelled ? '已停止目前任務' : `任務執行失敗：${error.message}`);
    })
    .finally(() => {
      activeJobCount = Math.max(0, activeJobCount - 1);
      runningJobs.delete(jobId);
      refreshQueuedJobStatuses();
      drainJobQueue();
    });
  }
}

function refreshQueuedJobStatuses() {
  jobQueue.forEach(({ job }, index) => {
    updateJob(job, {
      status: 'queued',
      stage: 'queued',
      progress: 0,
      message: `任務排隊中（前方 ${index + activeJobCount} 個）`,
    });
  });
}

function cancelJob(jobId) {
  const active = runningJobs.get(jobId);
  if (!active) return false;
  active.controller.abort();
  const job = loadJob(jobId);
  if (active.state === 'queued') {
    const queueIndex = jobQueue.findIndex((item) => item.jobId === jobId);
    if (queueIndex >= 0) jobQueue.splice(queueIndex, 1);
    runningJobs.delete(jobId);
    if (job) {
      updateJob(job, {
        status: 'cancelled',
        stage: 'cancelled',
        message: '已取消排隊中的任務',
      }, '使用者取消排隊中的任務');
    }
    refreshQueuedJobStatuses();
    return true;
  }
  if (job) {
    updateJob(job, {
      status: 'cancelled',
      stage: 'cancelling',
      message: '正在停止目前任務...',
    }, '使用者要求取消任務');
  }
  return true;
}

function retryJob(jobId) {
  if (runningJobs.has(jobId)) return { started: false, error: '任務仍在執行中' };
  const job = loadJob(jobId);
  if (!job) return { started: false, error: '找不到任務' };
  if (!['failed', 'cancelled', 'needs-action'].includes(job.status.status)) {
    return { started: false, error: `目前狀態「${job.status.status}」不可重新執行` };
  }
  const workingDir = path.join(job.jobRoot, 'working');
  fs.mkdirSync(workingDir, { recursive: true });
  const preservedTrimFiles = new Set([
    'edit-plan.json',
    'media-trimmed.mp4',
    'trim-status.json',
  ]);
  for (const entry of fs.readdirSync(workingDir)) {
    if (preservedTrimFiles.has(entry) || /^waveform(?:-original)?-\d+\.json$/i.test(entry)) continue;
    fs.rmSync(path.join(workingDir, entry), { recursive: true, force: true });
  }
  updateJob(job, {
    status: 'created',
    stage: 'retry-pending',
    progress: 0,
    message: '任務準備重新執行',
    metrics: {},
    files: {},
  }, '清理前次轉錄暫存並保留非破壞式修剪設定後重新排程');
  return startJob(jobId);
}

async function runJob(job, signal) {
  throwIfJobCancelled(signal);
  updateJob(job, { status: 'running', stage: 'preflight', progress: 8, message: '檢查本機環境與工具' }, '開始環境檢查');
  const tools = await getBasicToolsStatus();
  const { ffmpeg: hasFfmpeg, python: hasPython, whisper: hasWhisper, asrEngine } = tools;
  throwIfJobCancelled(signal);
  updateJob(job, {
    progress: 22,
    message: '環境檢查完成',
    metrics: { hasFfmpeg, hasPython, hasWhisper, asrEngine },
  }, `FFmpeg=${hasFfmpeg ? 'OK' : '缺少'} ASR=${asrEngine || '缺少'}`);

  const inputDir = path.join(job.jobRoot, 'input');
  const workingDir = path.join(job.jobRoot, 'working');
  const existingSrtName = job.config.files.existingSrt;
  const trimmedSrtPath = path.join(job.jobRoot, 'review-output', 'trimmed.srt');
  const uploadedSrtPath = existingSrtName ? path.join(inputDir, existingSrtName) : '';
  const appliedEditPlan = readEditPlan(job.jobRoot);
  if (!fs.existsSync(trimmedSrtPath) && appliedEditPlan?.appliedAt && uploadedSrtPath && fs.existsSync(uploadedSrtPath)) {
    const remapped = trimSrtToRange(fs.readFileSync(uploadedSrtPath, 'utf8'), appliedEditPlan.in, appliedEditPlan.out);
    if (remapped.cues.length) {
      fs.mkdirSync(path.dirname(trimmedSrtPath), { recursive: true });
      fs.writeFileSync(trimmedSrtPath, remapped.subtitle, 'utf8');
    }
  }
  const existingSrtPath = fs.existsSync(trimmedSrtPath) ? trimmedSrtPath : uploadedSrtPath;
  const existingSrtCues = existingSrtPath && fs.existsSync(existingSrtPath)
    ? parseSrtCues(fs.readFileSync(existingSrtPath, 'utf8'))
    : [];
  if (existingSrtCues.length > 0) {
    updateJob(job, { stage: 'import-srt', progress: 42, message: '偵測到既有 SRT，略過 ASR 轉錄' }, '匯入使用者提供的 SRT');
    fs.copyFileSync(existingSrtPath, path.join(workingDir, 'draft.srt'));
  } else if (hasWhisper && job.config.files.video) {
    if (existingSrtName) {
      updateJob(job, { progress: 25, message: '既有 SRT 無有效字幕，改用內建 ASR 轉錄' }, '忽略空白或無效的 SRT');
    }
    updateJob(job, { stage: 'transcribing', progress: 35, message: '使用 Whisper 進行本機轉錄' }, '啟動 Whisper 轉錄');
    await runWhisper(job, inputDir, workingDir, signal);
  } else {
    updateJob(job, {
      status: 'needs-action',
      stage: 'missing-asr',
      progress: 35,
      message: '尚未偵測到可用的內建 ASR。請重新安裝 APP，或上傳既有 SRT 後再執行。',
    }, '缺少 ASR 工具，流程暫停等待處理');
    return;
  }

  throwIfJobCancelled(signal);
  updateJob(job, { stage: 'rule-cleanup', progress: 72, message: '套用字幕規則並產生校稿資料' }, '建立初稿與校稿報告');
  const draft = path.join(workingDir, 'draft.srt');
  if (!fs.existsSync(draft) || parseSrtCues(fs.readFileSync(draft, 'utf8')).length === 0) {
    throw new Error('轉錄未產生有效字幕段落，任務不會標記為完成；請確認影片含有可辨識的語音後重試。');
  }
  const cleaned = path.join(workingDir, 'rule-cleaned.srt');
  const report = path.join(workingDir, 'correction-report.md');
  const settings = path.join(job.jobRoot, 'review-output', 'subtitle-style-settings.json');

  // Load and apply rules from rule.txt
  const ruleFileName = job.config.files.ruleFile;
  let ruleResults = null;
  if (ruleFileName && fs.existsSync(path.join(inputDir, ruleFileName))) {
    const ruleContent = fs.readFileSync(path.join(inputDir, ruleFileName), 'utf8');
    const rules = parseRules(ruleContent);
    const draftContent = fs.readFileSync(draft, 'utf8');
    const forceTraditional = rules.forceTraditional ?? job.config.language === 'zh-TW';
    ruleResults = applyRulesToSrt(draftContent, rules, { forceTraditional });
    fs.writeFileSync(cleaned, ruleResults.cleanedSrt, 'utf8');
    updateJob(job, { progress: 85, message: `規則套用完成（${ruleResults.changedCues}/${ruleResults.totalCues} 段落有修改）` }, `套用 ${Object.values(rules).flat?.()?.length || 0} 條規則`);
  } else {
    if (job.config.language === 'zh-TW') {
      const draftContent = fs.readFileSync(draft, 'utf8');
      ruleResults = applyRulesToSrt(draftContent, parseRules(''), { forceTraditional: true });
      fs.writeFileSync(cleaned, ruleResults.cleanedSrt, 'utf8');
      updateJob(job, { progress: 85, message: `已套用繁體中文清理（${ruleResults.changedCues}/${ruleResults.totalCues} 段落有修改）` }, '未找到 rule.txt，已套用繁體中文轉換');
    } else {
      fs.copyFileSync(draft, cleaned);
      updateJob(job, { progress: 85, message: '無規則檔，直接複製初稿' }, '未找到 rule.txt，跳過規則套用');
    }
  }

  fs.writeFileSync(report, buildCorrectionReport(job, ruleResults), 'utf8');
  writeJson(settings, {
    fontFamily: 'Microsoft JhengHei',
    fontSize: 32,
    position: 'bottom',
    bottomMarginPercent: 8,
    textColor: '#ffffff',
    outlineColor: '#111111',
    outlineWidth: 3,
  });
  updateJob(job, {
    status: 'completed',
    stage: 'ready-review',
    progress: 100,
    message: '字幕初稿已完成，可進入校閱頁面',
    files: { draftSrt: draft, cleanedSrt: cleaned, report, styleSettings: settings, reviewUrl: `/review/${job.config.jobId}` },
  }, '任務完成，等待人工校閱');
}

async function runWhisper(job, inputDir, workingDir, signal) {
  const videoFile = getEffectiveVideoPath(job);
  if (!videoFile) throw new Error('找不到可轉錄的有效影片');
  const audioFile = await prepareWhisperAudio(job, videoFile, workingDir, signal);
  throwIfJobCancelled(signal);
  const tools = await getBasicToolsStatus();
  if (tools.asrEngine === 'whisper.cpp') {
    return runWhisperCpp(job, audioFile, workingDir, signal);
  }
  const gpu = await getGpuStatus();
  const useCuda = gpu.available && gpu.status === 'cuda';
  const preset = job.config.performancePreset || 'balanced';
  const configuredThreads = Number(job.config.cpuThreads || 0);
  const cpuThreads = configuredThreads > 0
    ? configuredThreads
    : Math.max(1, Math.min(16, os.availableParallelism?.() || os.cpus().length || 1));
  updateJob(job, {
    stage: 'transcribing',
    progress: 35,
    message: `使用 Whisper ${preset} 模式轉錄（${useCuda ? 'CUDA' : `CPU ${cpuThreads} threads`}）`,
    metrics: {
      ...(job.status.metrics || {}),
      whisperDevice: useCuda ? 'cuda' : 'cpu',
      performancePreset: preset,
      cpuThreads: useCuda ? null : cpuThreads,
    },
  }, `Whisper 裝置=${useCuda ? 'CUDA' : 'CPU'} 模式=${preset}`);

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createJobCancelledError());
      return;
    }
    const args = [
      '-m', 'whisper',
      audioFile,
      '--language', job.config.language.startsWith('zh') ? 'Chinese' : job.config.language,
      '--output_format', 'srt',
      '--output_dir', workingDir,
      '--model_dir', toolPaths.whisperModels,
      '--device', useCuda ? 'cuda' : 'cpu',
      '--fp16', useCuda ? 'True' : 'False',
    ];
    if (!useCuda) args.push('--threads', String(cpuThreads));
    if (preset === 'fast') args.push('--beam_size', '1');
    if (preset === 'accurate') args.push('--beam_size', '5');
    if (job.config.modelName) args.push('--model', job.config.modelName);
    let lastProgressLogAt = 0;
    const child = spawn(toolPaths.python, args, {
      shell: false,
      env: {
        ...process.env,
        PATH: [path.dirname(toolPaths.ffmpeg), path.dirname(toolPaths.python), process.env.PATH || ''].filter(Boolean).join(path.delimiter),
        XDG_CACHE_HOME: toolsDir,
        WHISPER_CACHE: toolPaths.whisperModels,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      },
      windowsHide: true,
    });
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abortHandler);
      try { fs.unlinkSync(audioFile); } catch {}
      callback();
    };
    const abortHandler = () => {
      child.kill('SIGTERM');
      finish(() => reject(createJobCancelledError()));
    };
    signal?.addEventListener('abort', abortHandler, { once: true });
    child.stdout.on('data', (data) => {
      const log = normalizeWhisperLog(data);
      if (log) updateJob(job, { progress: 48, message: 'Whisper 本機轉錄中' }, log);
    });
    child.stderr.on('data', (data) => {
      const log = normalizeWhisperLog(data);
      const now = Date.now();
      if (log && now - lastProgressLogAt > 1200) {
        lastProgressLogAt = now;
        updateJob(job, { progress: 52, message: 'Whisper 本機轉錄中' }, log);
      }
    });
    child.on('error', (error) => finish(() => reject(error)));
    child.on('exit', (code) => {
      if (signal?.aborted) {
        finish(() => reject(createJobCancelledError()));
        return;
      }
      if (code !== 0) {
        finish(() => reject(new Error(`Whisper exit code ${code}`)));
        return;
      }
      const srtFile = fs.readdirSync(workingDir).find((file) => file.toLowerCase().endsWith('.srt'));
      if (!srtFile) {
        finish(() => reject(new Error('Whisper did not produce an SRT file')));
        return;
      }
      fs.copyFileSync(path.join(workingDir, srtFile), path.join(workingDir, 'draft.srt'));
      finish(resolve);
    });
  });
}

function runWhisperCpp(job, audioFile, workingDir, signal) {
  const configuredThreads = Number(job.config.cpuThreads || 0);
  const cpuThreads = configuredThreads > 0
    ? configuredThreads
    : Math.max(1, Math.min(16, os.availableParallelism?.() || os.cpus().length || 1));
  const outputBase = path.join(workingDir, 'whisper-cpp-output');
  const outputSrt = `${outputBase}.srt`;
  const language = job.config.language.startsWith('zh') ? 'zh' : job.config.language;
  const useMetal = process.platform === 'darwin' && process.arch === 'arm64';

  updateJob(job, {
    stage: 'transcribing',
    progress: 35,
    message: `使用內建 Whisper.cpp 轉錄（${useMetal ? 'Apple Metal' : `CPU ${cpuThreads} threads`}）`,
    metrics: {
      ...(job.status.metrics || {}),
      whisperDevice: useMetal ? 'metal' : 'cpu',
      asrEngine: 'whisper.cpp',
      modelName: 'tiny-multilingual',
      cpuThreads,
    },
  }, job.config.modelName && !/tiny/i.test(job.config.modelName)
    ? `安裝包目前內建 tiny 多語模型，已取代要求的 ${job.config.modelName}`
    : '啟動安裝包內建的 Whisper.cpp 與 tiny 多語模型');

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      try { fs.unlinkSync(audioFile); } catch {}
      reject(createJobCancelledError());
      return;
    }

    const args = [
      '-m', toolPaths.whisperCppModel,
      '-f', audioFile,
      '-l', language,
      '-osrt',
      '-of', outputBase,
      '-t', String(cpuThreads),
    ];
    const child = spawn(toolPaths.whisperCpp, args, {
      shell: false,
      cwd: path.dirname(toolPaths.whisperCpp),
      env: {
        ...process.env,
        PATH: [path.dirname(toolPaths.whisperCpp), path.dirname(toolPaths.ffmpeg), process.env.PATH || ''].filter(Boolean).join(path.delimiter),
      },
      windowsHide: true,
    });
    let settled = false;
    let stderr = '';
    let lastProgressLogAt = 0;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abortHandler);
      try { fs.unlinkSync(audioFile); } catch {}
      callback();
    };
    const abortHandler = () => {
      child.kill('SIGTERM');
      finish(() => reject(createJobCancelledError()));
    };
    signal?.addEventListener('abort', abortHandler, { once: true });
    child.stdout.on('data', (data) => {
      const log = normalizeWhisperLog(data);
      if (log && Date.now() - lastProgressLogAt > 1200) {
        lastProgressLogAt = Date.now();
        updateJob(job, { progress: 52, message: 'Whisper.cpp 本機轉錄中' }, log);
      }
    });
    child.stderr.on('data', (data) => {
      stderr = `${stderr}${data.toString('utf8')}`.slice(-4000);
      const log = normalizeWhisperLog(data);
      if (log && Date.now() - lastProgressLogAt > 1200) {
        lastProgressLogAt = Date.now();
        updateJob(job, { progress: 52, message: 'Whisper.cpp 本機轉錄中' }, log);
      }
    });
    child.on('error', (error) => finish(() => reject(error)));
    child.on('exit', (code) => {
      if (signal?.aborted) {
        finish(() => reject(createJobCancelledError()));
        return;
      }
      if (code !== 0) {
        finish(() => reject(new Error(`Whisper.cpp exit code ${code}: ${sanitizeLog(stderr).slice(-500)}`)));
        return;
      }
      if (!fs.existsSync(outputSrt)) {
        finish(() => reject(new Error('Whisper.cpp 未產生 SRT 字幕檔')));
        return;
      }
      fs.copyFileSync(outputSrt, path.join(workingDir, 'draft.srt'));
      finish(resolve);
    });
  });
}

function prepareWhisperAudio(job, videoFile, workingDir, signal) {
  const audioFile = path.join(workingDir, 'whisper-input.wav');
  updateJob(job, {
    stage: 'audio-preprocessing',
    progress: 30,
    message: '正在準備 16kHz 單聲道音訊',
  }, '使用 FFmpeg 建立 Whisper 最佳化音訊');
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createJobCancelledError());
      return;
    }
    const child = spawn(toolPaths.ffmpeg, [
      '-y', '-i', videoFile,
      '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le',
      audioFile,
    ], { shell: false, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abortHandler);
      callback();
    };
    const abortHandler = () => {
      child.kill('SIGTERM');
      finish(() => reject(createJobCancelledError()));
    };
    signal?.addEventListener('abort', abortHandler, { once: true });
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk.toString('utf8')}`.slice(-2000); });
    child.on('error', (error) => finish(() => reject(error)));
    child.on('close', (code) => {
      if (signal?.aborted) finish(() => reject(createJobCancelledError()));
      else if (code === 0 && fs.existsSync(audioFile)) finish(() => resolve(audioFile));
      else finish(() => reject(new Error(`音訊前處理失敗（FFmpeg exit ${code}）：${sanitizeLog(stderr).slice(-300)}`)));
    });
  });
}

function normalizeWhisperLog(buffer) {
  const cleaned = sanitizeLog(buffer.toString('utf8'));
  if (!cleaned) return '';
  const percentMatch = cleaned.match(/(\d{1,3})%/);
  const speedMatch = cleaned.match(/([0-9.]+\s*(?:MiB|KiB|B|it)\/s)/i);
  if (percentMatch) {
    const percent = Math.min(100, Math.max(0, Number(percentMatch[1])));
    const speed = speedMatch ? `，速度 ${speedMatch[1]}` : '';
    return `Whisper 轉錄進度 ${percent}%${speed}`;
  }
  if (/Detected language/i.test(cleaned)) return 'Whisper 已偵測語言';
  if (/Loading/i.test(cleaned)) return 'Whisper 載入模型中';
  if (/Downloading/i.test(cleaned)) return 'Whisper 模型下載中';
  if (/UserWarning|FutureWarning|WARNING/i.test(cleaned)) return '';
  return cleaned.length > 120 ? cleaned.slice(0, 120) : cleaned;
}

function parseRules(content) {
  const rules = {
    fillers: [],
    normalizeTerms: [],
    customReplacements: [],
    removePunctuation: new Set(),
    regexReplacements: [],
    literalReplacements: [],
    forceTraditional: null,
  };

  if (!content) return rules;

  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const traditionalMatch = line.match(/^FORCE_TRADITIONAL:\s*(true|false|yes|no|1|0)$/i);
    if (traditionalMatch) {
      rules.forceTraditional = /^(true|yes|1)$/i.test(traditionalMatch[1]);
      continue;
    }

    const fillerMatch = line.match(/^REMOVE_FILLER:\s*(.+)$/i);
    if (fillerMatch) {
      rules.fillers = fillerMatch[1].split('|').map((s) => s.trim()).filter(Boolean);
      continue;
    }

    const normMatch = line.match(/^NORMALIZE_TERM:\s*(.+?)\s*->\s*(.+)$/i);
    if (normMatch) {
      rules.normalizeTerms.push({ from: normMatch[1].trim(), to: normMatch[2].trim() });
      continue;
    }

    const customMatch = line.match(/^CUSTOM_REPLACE:\s*(.+?)\s*->\s*(.+)$/i);
    if (customMatch) {
      rules.customReplacements.push({ from: customMatch[1].trim(), to: customMatch[2].trim() });
      continue;
    }

    const punctMatch = line.match(/^REMOVE_PUNCTUATION:\s*(.+)$/i);
    if (punctMatch) {
      for (const ch of punctMatch[1]) rules.removePunctuation.add(ch);
      continue;
    }

    const regexMatch = line.match(/^REGEX_REPLACE:\s*(.+?)\s*->\s*(.+)$/i);
    if (regexMatch) {
      try {
        const rm = regexMatch[1].match(/^\/(.+)\/([gimsuy]*)$/);
        if (rm) {
          rules.regexReplacements.push({ pattern: new RegExp(rm[1], rm[2]), replacement: regexMatch[2] });
        } else {
          rules.regexReplacements.push({ pattern: new RegExp(regexMatch[1], 'g'), replacement: regexMatch[2] });
        }
      } catch {
        // skip invalid regex
      }
      continue;
    }

    // Fallback: literal replacement "原文 -> 替換文"
    const litMatch = line.match(/^(.+?)\s*->\s*(.+)$/);
    if (litMatch) {
      rules.literalReplacements.push({ from: litMatch[1].trim(), to: litMatch[2].trim() });
      continue;
    }
  }

  return rules;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SIMPLIFIED_PHRASE_MAP = new Map([
  ['上传', '上傳'],
  ['下载', '下載'],
  ['文件', '檔案'],
  ['视频', '影片'],
  ['音频', '音訊'],
  ['屏幕', '螢幕'],
  ['鼠标', '滑鼠'],
  ['默认', '預設'],
  ['设置', '設定'],
  ['项目', '專案'],
  ['导入', '匯入'],
  ['导出', '匯出'],
  ['检查', '檢查'],
  ['检测', '偵測'],
  ['生成', '產生'],
  ['处理', '處理'],
  ['运行', '執行'],
  ['启动', '啟動'],
  ['关闭', '關閉'],
  ['打开', '開啟'],
  ['保存', '儲存'],
  ['数据库', '資料庫'],
  ['资料', '資料'],
  ['数据', '資料'],
  ['网络', '網路'],
  ['服务器', '伺服器'],
  ['链接', '連結'],
  ['复制', '複製'],
  ['粘贴', '貼上'],
  ['删除', '刪除'],
  ['选择', '選擇'],
  ['确认', '確認'],
  ['说明', '說明'],
  ['错误', '錯誤'],
  ['完成', '完成'],
  ['进度', '進度'],
  ['规则', '規則'],
  ['字幕', '字幕'],
  ['识别', '辨識'],
  ['转录', '轉錄'],
  ['转换', '轉換'],
  ['优化', '優化'],
  ['质量', '品質'],
  ['术语', '術語'],
  ['专有名词', '專有名詞'],
  ['繁体中文', '繁體中文'],
  ['简体中文', '簡體中文'],
]);

const SIMPLIFIED_CHAR_MAP = new Map(Object.entries({
  万: '萬', 与: '與', 专: '專', 业: '業', 丛: '叢', 东: '東', 丝: '絲', 丢: '丟',
  两: '兩', 严: '嚴', 丧: '喪', 个: '個', 临: '臨', 为: '為', 举: '舉', 么: '麼',
  义: '義', 乌: '烏', 乐: '樂', 习: '習', 乡: '鄉', 书: '書', 买: '買', 乱: '亂',
  争: '爭', 于: '於', 亏: '虧', 云: '雲', 亘: '亙', 亚: '亞', 产: '產', 亩: '畝',
  亲: '親', 亵: '褻', 亿: '億', 仅: '僅', 从: '從', 仑: '侖', 仓: '倉', 仪: '儀',
  们: '們', 价: '價', 众: '眾', 优: '優', 会: '會', 伛: '傴', 伞: '傘', 伟: '偉',
  传: '傳', 伤: '傷', 伦: '倫', 伪: '偽', 体: '體', 余: '餘', 佛: '佛', 佣: '傭',
  佥: '僉', 侠: '俠', 侣: '侶', 侥: '僥', 侦: '偵', 侧: '側', 侨: '僑', 侩: '儈',
  侪: '儕', 侬: '儂', 俣: '俁', 俦: '儔', 俨: '儼', 俩: '倆', 俪: '儷', 俭: '儉',
  债: '債', 倾: '傾', 偿: '償', 傥: '儻', 傧: '儐', 储: '儲', 儿: '兒', 兑: '兌',
  党: '黨', 兰: '蘭', 关: '關', 兴: '興', 兹: '茲', 养: '養', 兽: '獸', 冁: '囅',
  内: '內', 冈: '岡', 册: '冊', 写: '寫', 军: '軍', 农: '農', 冯: '馮', 冲: '衝',
  决: '決', 况: '況', 冻: '凍', 净: '淨', 凄: '淒', 准: '準', 凉: '涼', 减: '減',
  凑: '湊', 凛: '凜', 几: '幾', 凤: '鳳', 凫: '鳧', 凭: '憑', 凯: '凱', 击: '擊',
  凿: '鑿', 刍: '芻', 划: '劃', 刘: '劉', 则: '則', 刚: '剛', 创: '創', 删: '刪',
  别: '別', 刬: '剗', 刭: '剄', 刹: '剎', 刽: '劊', 刾: '刺', 刿: '劌', 剀: '剴',
  剂: '劑', 剐: '剮', 剑: '劍', 剥: '剝', 剧: '劇', 劝: '勸', 办: '辦', 务: '務',
  动: '動', 励: '勵', 劲: '勁', 劳: '勞', 势: '勢', 勋: '勳', 勐: '猛', 勚: '勩',
  勾: '鉤', 匀: '勻', 匦: '匭', 匮: '匱', 区: '區', 医: '醫', 华: '華', 协: '協',
  单: '單', 卖: '賣', 卢: '盧', 卤: '鹵', 卧: '臥', 卫: '衛', 却: '卻', 厂: '廠',
  厅: '廳', 历: '歷', 厉: '厲', 压: '壓', 厌: '厭', 厕: '廁', 厢: '廂', 厣: '厴',
  厦: '廈', 厨: '廚', 厩: '廄', 厮: '廝', 县: '縣', 参: '參', 双: '雙', 发: '發',
  变: '變', 叙: '敘', 叠: '疊', 叶: '葉', 号: '號', 叹: '嘆', 后: '後', 吓: '嚇',
  吕: '呂', 吗: '嗎', 启: '啟', 吴: '吳', 呒: '嘸', 呓: '囈', 呕: '嘔', 呖: '嚦',
  呗: '唄', 员: '員', 呙: '咼', 呛: '嗆', 呜: '嗚', 咏: '詠', 咙: '嚨', 咛: '嚀',
  咝: '噝', 咤: '吒', 咸: '鹹', 响: '響', 哑: '啞', 哒: '噠', 哓: '嘵', 哔: '嗶',
  哕: '噦', 哗: '嘩', 哙: '噲', 哜: '嚌', 哝: '噥', 哟: '喲', 唛: '嘜', 唝: '嗊',
  唠: '嘮', 唡: '啢', 唢: '嗩', 唤: '喚', 啧: '嘖', 啬: '嗇', 啭: '囀', 啮: '嚙',
  啰: '囉', 啴: '嘽', 啸: '嘯', 喷: '噴', 喽: '嘍', 喾: '嚳', 嗫: '囁', 嗳: '噯',
  嘘: '噓', 嘤: '嚶', 嘱: '囑', 噜: '嚕', 嚣: '囂', 团: '團', 园: '園', 围: '圍',
  囵: '圇', 国: '國', 图: '圖', 圆: '圓', 圣: '聖', 圹: '壙', 场: '場', 坏: '壞',
  块: '塊', 坚: '堅', 坛: '壇', 坜: '壢', 坝: '壩', 坞: '塢', 坟: '墳', 坠: '墜',
  垄: '壟', 垅: '壠', 垆: '壚', 垒: '壘', 垦: '墾', 垩: '堊', 垫: '墊', 垭: '埡',
  垱: '壋', 垲: '塏', 垴: '堖', 埘: '塒', 埙: '塤', 埚: '堝', 堑: '塹', 堕: '墮',
  墙: '牆', 壮: '壯', 声: '聲', 壳: '殼', 壶: '壺', 处: '處', 备: '備', 复: '複',
  够: '夠', 头: '頭', 夹: '夾', 夺: '奪', 奁: '奩', 奂: '奐', 奋: '奮', 奖: '獎',
  奥: '奧', 妆: '妝', 妇: '婦', 妈: '媽', 妩: '嫵', 妪: '嫗', 妫: '媯', 姗: '姍',
  姹: '奼', 娄: '婁', 娅: '婭', 娆: '嬈', 娇: '嬌', 娈: '孌', 娲: '媧', 娴: '嫻',
  婴: '嬰', 婵: '嬋', 婶: '嬸', 嫒: '嬡', 嫔: '嬪', 嫱: '嬙', 孙: '孫', 学: '學',
  孪: '孿', 宁: '寧', 宝: '寶', 实: '實', 宠: '寵', 审: '審', 宪: '憲', 宫: '宮',
  宽: '寬', 宾: '賓', 寝: '寢', 对: '對', 寻: '尋', 导: '導', 寿: '壽', 将: '將',
  尔: '爾', 尘: '塵', 尝: '嘗', 尧: '堯', 尴: '尷', 尸: '屍', 尽: '盡', 层: '層',
  屉: '屜', 届: '屆', 属: '屬', 屡: '屢', 屦: '屨', 屿: '嶼', 岁: '歲', 岂: '豈',
  岖: '嶇', 岗: '崗', 岘: '峴', 岚: '嵐', 岛: '島', 岭: '嶺', 岳: '嶽', 岽: '崬',
  岿: '巋', 峃: '嶨', 峄: '嶧', 峡: '峽', 峣: '嶢', 峤: '嶠', 峥: '崢', 峦: '巒',
  崂: '嶗', 崃: '崍', 崭: '嶄', 嵘: '嶸', 嵚: '嶔', 嵛: '崳', 嵝: '嶁', 巅: '巔',
  巩: '鞏', 巯: '巰', 币: '幣', 帅: '帥', 师: '師', 帐: '帳', 帘: '簾', 帜: '幟',
  带: '帶', 帧: '幀', 帮: '幫', 帱: '幬', 帻: '幘', 帼: '幗', 幂: '冪', 干: '乾',
  并: '並', 广: '廣', 庄: '莊', 庆: '慶', 庐: '廬', 庑: '廡', 库: '庫', 应: '應',
  庙: '廟', 庞: '龐', 废: '廢', 廪: '廩', 开: '開', 异: '異', 弃: '棄', 张: '張',
  弥: '彌', 弪: '弳', 弯: '彎', 弹: '彈', 强: '強', 归: '歸', 当: '當', 录: '錄',
  彦: '彥', 彷: '仿', 彻: '徹', 径: '徑', 徕: '徠', 御: '禦', 忆: '憶', 忏: '懺',
  忧: '憂', 忾: '愾', 怀: '懷', 态: '態', 怂: '慫', 怃: '憮', 怄: '慪', 怅: '悵',
  怆: '愴', 怜: '憐', 总: '總', 怼: '懟', 怿: '懌', 恋: '戀', 恳: '懇', 恶: '惡',
  恸: '慟', 恹: '懨', 恺: '愷', 恻: '惻', 恼: '惱', 恽: '惲', 悦: '悅', 悫: '愨',
  悬: '懸', 悭: '慳', 悯: '憫', 惊: '驚', 惧: '懼', 惨: '慘', 惩: '懲', 惫: '憊',
  惬: '愜', 惭: '慚', 惮: '憚', 惯: '慣', 愤: '憤', 愦: '憒', 愿: '願', 慑: '懾',
  慭: '憖', 懑: '懣', 懒: '懶', 戆: '戇', 戋: '戔', 戏: '戲', 戗: '戧', 战: '戰',
  戬: '戩', 户: '戶', 扑: '撲', 执: '執', 扩: '擴', 扪: '捫', 扫: '掃', 扬: '揚',
  扰: '擾', 抚: '撫', 抛: '拋', 抟: '摶', 抠: '摳', 抡: '掄', 抢: '搶', 护: '護',
  报: '報', 担: '擔', 拟: '擬', 拢: '攏', 拣: '揀', 拥: '擁', 拦: '攔', 拧: '擰',
  拨: '撥', 择: '擇', 挂: '掛', 挚: '摯', 挛: '攣', 挜: '掗', 挝: '撾', 挞: '撻',
  挟: '挾', 挠: '撓', 挡: '擋', 挢: '撟', 挣: '掙', 挤: '擠', 挥: '揮', 挦: '撏',
  挥: '揮', 捞: '撈', 损: '損', 捡: '撿', 换: '換', 捣: '搗', 据: '據', 掳: '擄',
  掴: '摑', 掷: '擲', 掸: '撣', 掺: '摻', 掼: '摜', 揽: '攬', 揿: '撳', 搀: '攙',
  搁: '擱', 搂: '摟', 搅: '攪', 携: '攜', 摄: '攝', 摅: '攄', 摆: '擺', 摇: '搖',
  摈: '擯', 摊: '攤', 撄: '攖', 撑: '撐', 撵: '攆', 撷: '擷',撸: '擼', 撺: '攛',
  擞: '擻', 攒: '攢', 敌: '敵', 敛: '斂', 数: '數', 斋: '齋', 斓: '斕', 斗: '鬥',
  斩: '斬', 断: '斷', 无: '無', 旧: '舊', 时: '時', 旷: '曠', 昙: '曇', 昼: '晝',
  显: '顯', 晋: '晉', 晒: '曬', 晓: '曉', 晔: '曄', 晕: '暈', 晖: '暉', 暂: '暫',
  暧: '曖', 术: '術', 机: '機', 杀: '殺', 杂: '雜', 权: '權', 条: '條', 来: '來',
  杨: '楊', 杩: '榪', 杰: '傑', 极: '極', 构: '構', 枞: '樅', 枢: '樞', 枣: '棗',
  枥: '櫪', 枧: '梘', 枨: '棖', 枪: '槍', 枫: '楓', 枭: '梟', 柜: '櫃', 柠: '檸',
  柽: '檉', 栀: '梔', 栅: '柵', 标: '標', 栈: '棧', 栉: '櫛', 栊: '櫳', 栋: '棟',
  栌: '櫨', 栎: '櫟', 栏: '欄', 树: '樹', 栖: '棲', 样: '樣', 栾: '欒', 桠: '椏',
  桡: '橈', 桢: '楨', 档: '檔', 桤: '榿', 桥: '橋', 桦: '樺', 桧: '檜', 桨: '槳',
  桩: '樁', 梦: '夢', 梼: '檮', 梾: '棶', 梿: '槤', 检: '檢', 棂: '欞', 椁: '槨',
  椟: '櫝', 椠: '槧', 椤: '欏', 椭: '橢', 楼: '樓', 榄: '欖', 榅: '榲', 榇: '櫬',
  榈: '櫚', 榉: '櫸', 槚: '檟', 槛: '檻', 槟: '檳', 槠: '櫧', 横: '橫', 樯: '檣',
  樱: '櫻', 橥: '櫫', 橱: '櫥', 橹: '櫓', 橼: '櫞', 檩: '檁', 欢: '歡', 欤: '歟',
  欧: '歐', 欲: '慾', 歼: '殲', 殁: '歿', 殇: '殤', 残: '殘', 殒: '殞', 殓: '殮',
  殚: '殫', 殡: '殯', 殴: '毆', 毁: '毀', 毂: '轂', 毕: '畢', 毙: '斃', 毡: '氈',
  毵: '毿', 氇: '氌', 气: '氣', 氢: '氫', 氩: '氬', 氲: '氳', 汇: '匯', 汉: '漢',
  汤: '湯', 汹: '洶', 沟: '溝', 没: '沒', 沣: '灃', 沤: '漚', 沥: '瀝', 沦: '淪',
  沧: '滄', 沨: '渢', 沩: '溈', 沪: '滬', 泞: '濘', 注: '註', 泪: '淚', 泶: '澩',
  泷: '瀧', 泸: '瀘', 泺: '濼', 泻: '瀉', 泼: '潑', 泽: '澤', 泾: '涇', 洁: '潔',
  洒: '灑', 洼: '窪', 浃: '浹', 浅: '淺', 浆: '漿', 浇: '澆', 浈: '湞', 浊: '濁',
  测: '測', 浍: '澮', 济: '濟', 浏: '瀏', 浐: '滻', 浑: '渾', 浒: '滸', 浓: '濃',
  浔: '潯', 涛: '濤', 涝: '澇', 涞: '淶', 涟: '漣', 涠: '潿', 涡: '渦', 涣: '渙',
  涤: '滌', 润: '潤', 涧: '澗', 涨: '漲', 涩: '澀', 淀: '澱', 渊: '淵', 渌: '淥',
  渍: '漬', 渎: '瀆', 渐: '漸', 渑: '澠', 渔: '漁', 渖: '瀋', 渗: '滲', 温: '溫',
  游: '遊', 湾: '灣', 湿: '濕', 溃: '潰', 溅: '濺', 溆: '漵', 滚: '滾', 滞: '滯',
  滟: '灩', 滠: '灄', 满: '滿', 滤: '濾', 滥: '濫', 滦: '灤', 滨: '濱', 滩: '灘',
  滪: '澦', 漤: '灠', 潆: '瀠', 潇: '瀟', 潋: '瀲', 潍: '濰', 潜: '潛', 潴: '瀦',
  澜: '瀾', 濑: '瀨', 濒: '瀕', 灏: '灝', 灭: '滅', 灯: '燈', 灵: '靈', 灾: '災',
  灿: '燦', 炀: '煬', 炉: '爐', 炖: '燉', 炜: '煒', 炝: '熗', 点: '點', 炼: '煉',
  炽: '熾', 烁: '爍', 烂: '爛', 烃: '烴', 烛: '燭', 烟: '煙', 烦: '煩', 烧: '燒',
  烨: '燁', 烩: '燴', 烫: '燙', 烬: '燼', 热: '熱', 焕: '煥', 焖: '燜', 焘: '燾',
  煴: '熅', 爱: '愛', 爷: '爺', 牍: '牘', 牦: '氂', 牵: '牽', 牺: '犧', 犊: '犢',
  状: '狀', 犷: '獷', 犸: '獁', 犹: '猶', 狈: '狽', 独: '獨', 狭: '狹', 狮: '獅',
  狯: '獪', 狰: '猙', 狱: '獄', 狲: '猻', 猃: '獫', 猎: '獵', 猕: '獼', 猡: '玀',
  猪: '豬', 猫: '貓', 献: '獻', 獭: '獺', 玑: '璣', 玛: '瑪', 玮: '瑋', 环: '環',
  现: '現', 玱: '瑲', 玺: '璽', 珐: '琺', 珑: '瓏', 珰: '璫', 琐: '瑣', 琼: '瓊',
  瑶: '瑤', 瑷: '璦', 璎: '瓔', 瓒: '瓚', 瓮: '甕', 电: '電', 画: '畫', 畅: '暢',
  畴: '疇', 疖: '癤', 疗: '療', 疟: '瘧', 疠: '癘', 疡: '瘍', 疬: '癧', 疮: '瘡',
  疯: '瘋', 疱: '皰', 疴: '痾', 痈: '癰', 痉: '痙', 痒: '癢', 痨: '癆', 痪: '瘓',
  痫: '癇', 瘅: '癉', 瘗: '瘞', 瘘: '瘻', 瘪: '癟', 瘫: '癱', 瘾: '癮', 瘿: '癭',
  癞: '癩', 癣: '癬', 癫: '癲', 皑: '皚', 皱: '皺', 皲: '皸', 盏: '盞', 盐: '鹽',
  监: '監', 盖: '蓋', 盗: '盜', 盘: '盤', 眍: '瞘', 眦: '眥', 眬: '矓', 着: '著',
  睁: '睜', 睐: '睞', 睑: '瞼', 瞒: '瞞', 瞩: '矚', 矫: '矯', 矶: '磯', 矾: '礬',
  矿: '礦', 码: '碼', 砖: '磚', 砗: '硨', 砚: '硯', 砜: '碸', 砺: '礪', 砻: '礱',
  砾: '礫', 础: '礎', 硁: '硜', 硕: '碩', 硖: '硤', 硗: '磽', 硙: '磑', 硚: '礄',
  确: '確', 碱: '鹼', 礼: '禮', 祎: '禕', 祢: '禰', 祯: '禎', 祷: '禱', 祸: '禍',
  禀: '稟', 禄: '祿', 禅: '禪', 离: '離', 秃: '禿', 秆: '稈', 种: '種', 积: '積',
  称: '稱', 秽: '穢', 税: '稅', 稣: '穌', 稳: '穩', 穑: '穡', 穷: '窮', 窃: '竊',
  窍: '竅', 窎: '窵', 窑: '窯', 窜: '竄', 窝: '窩', 窥: '窺', 窦: '竇', 窭: '窶',
  竖: '豎', 竞: '競', 笃: '篤', 笋: '筍', 笔: '筆', 笕: '筧', 笺: '箋', 笼: '籠',
  笾: '籩', 筚: '篳', 筛: '篩', 筜: '簹', 筝: '箏', 筹: '籌', 签: '簽', 简: '簡',
  箓: '籙', 箦: '簀', 箧: '篋', 箨: '籜', 箩: '籮', 箪: '簞', 箫: '簫', 篑: '簣',
  篓: '簍', 篮: '籃', 篱: '籬', 簖: '籪', 籁: '籟', 籴: '糴', 类: '類', 籼: '秈',
  粜: '糶', 粝: '糲', 粤: '粵', 粪: '糞', 粮: '糧', 糁: '糝', 糇: '餱', 紧: '緊',
  絷: '縶', 纟: '糹', 纠: '糾', 纡: '紆', 红: '紅', 纣: '紂', 纤: '纖', 约: '約',
  级: '級', 纨: '紈', 纪: '紀', 纫: '紉', 纬: '緯', 纯: '純', 纰: '紕', 纱: '紗',
  纲: '綱', 纳: '納', 纵: '縱', 纶: '綸', 纷: '紛', 纸: '紙', 纹: '紋', 纺: '紡',
  纽: '紐', 纾: '紓', 线: '線', 绀: '紺', 绁: '紲', 绂: '紱', 练: '練', 组: '組',
  绅: '紳', 细: '細', 织: '織', 终: '終', 绉: '縐', 绊: '絆', 绋: '紼', 绌: '絀',
  绍: '紹', 绎: '繹', 经: '經', 绐: '紿', 绑: '綁', 绒: '絨', 结: '結', 绔: '絝',
  绕: '繞', 绘: '繪', 给: '給', 绚: '絢', 绛: '絳', 络: '絡', 绝: '絕', 绞: '絞',
  统: '統', 绠: '綆', 绡: '綃', 绢: '絹', 绣: '繡', 绥: '綏', 绦: '絛', 继: '繼',
  绨: '綈', 绩: '績', 绪: '緒', 绫: '綾', 续: '續', 绮: '綺', 绯: '緋', 绰: '綽',
  绱: '緔', 绲: '緄', 绳: '繩', 维: '維', 绵: '綿', 绶: '綬', 绷: '繃', 绸: '綢',
  绹: '綯', 绺: '綹', 绻: '綣', 综: '綜', 绽: '綻', 绾: '綰', 绿: '綠', 缀: '綴',
  缁: '緇', 缂: '緙', 缃: '緗', 缄: '緘', 缅: '緬', 缆: '纜', 缇: '緹', 缈: '緲',
  缉: '緝', 缊: '縕', 缋: '繢', 缌: '緦', 缍: '綞', 缎: '緞', 缏: '緶', 缑: '緱',
  缒: '縋', 缓: '緩', 缔: '締', 缕: '縷', 编: '編', 缗: '緡', 缘: '緣', 缙: '縉',
  缚: '縛', 缛: '縟', 缜: '縝', 缝: '縫', 缟: '縞', 缠: '纏', 缡: '縭', 缢: '縊',
  缣: '縑', 缤: '繽', 缥: '縹', 缦: '縵', 缧: '縲', 缨: '纓', 缩: '縮', 缪: '繆',
  缫: '繅', 缬: '纈', 缭: '繚', 缮: '繕', 缯: '繒', 缰: '韁', 缱: '繾', 缲: '繰',
  缳: '繯', 缴: '繳', 缵: '纘', 罂: '罌', 网: '網', 罗: '羅', 罚: '罰', 罢: '罷',
  罴: '羆', 羁: '羈', 羟: '羥', 羡: '羨', 翘: '翹', 耀: '耀', 耧: '耬', 耸: '聳',
  耻: '恥', 聂: '聶', 聋: '聾', 职: '職', 联: '聯', 聩: '聵', 聪: '聰', 肃: '肅',
  肠: '腸', 肤: '膚', 肮: '骯', 肴: '餚', 肾: '腎', 肿: '腫', 胀: '脹', 胁: '脅',
  胆: '膽', 胜: '勝', 胧: '朧', 胨: '腖', 胪: '臚', 胫: '脛', 胶: '膠', 脉: '脈',
  脍: '膾', 脏: '髒', 脐: '臍', 脑: '腦', 脓: '膿', 脔: '臠', 脚: '腳', 脱: '脫',
  脶: '腡', 脸: '臉', 腊: '臘', 腌: '醃', 腘: '膕', 腻: '膩', 腼: '靦', 腽: '膃',
  腾: '騰', 膑: '臏', 臜: '臢', 舆: '輿', 舍: '捨', 舰: '艦', 舱: '艙', 艰: '艱',
  艳: '艷', 艺: '藝', 节: '節', 芈: '羋', 芗: '薌', 芜: '蕪', 芦: '蘆', 苁: '蓯',
  苇: '葦', 苈: '藶', 苋: '莧', 苌: '萇', 苍: '蒼', 苎: '苧', 苏: '蘇', 苹: '蘋',
  范: '範', 茎: '莖', 茏: '蘢', 茑: '蔦', 茔: '塋', 茕: '煢', 茧: '繭', 荆: '荊',
  荐: '薦', 荙: '薘', 荚: '莢', 荛: '蕘', 荜: '蓽', 荞: '蕎', 荟: '薈', 荠: '薺',
  荡: '蕩', 荣: '榮', 荤: '葷', 荥: '滎', 荦: '犖', 荧: '熒', 荨: '蕁', 荩: '藎',
  荪: '蓀', 荫: '蔭', 荬: '蕒', 荭: '葒', 荮: '葤', 药: '藥', 莅: '蒞', 莆: '莆',
  莲: '蓮', 莳: '蒔', 莴: '萵', 莶: '薟', 获: '獲', 莹: '瑩', 莺: '鶯', 萤: '螢',
  营: '營', 萦: '縈', 萧: '蕭', 萨: '薩', 葱: '蔥', 蒇: '蕆', 蒉: '蕢', 蒋: '蔣',
  蒌: '蔞', 蒙: '蒙', 蓝: '藍', 蓟: '薊', 蓠: '蘺', 蓣: '蕷', 蓥: '鎣', 蓦: '驀',
  蔷: '薔', 蔹: '蘞', 蔺: '藺', 蔼: '藹', 蕲: '蘄', 蕴: '蘊', 薮: '藪', 藓: '蘚',
  虏: '虜', 虑: '慮', 虚: '虛', 虫: '蟲', 虬: '虯', 虮: '蟣', 虽: '雖', 虾: '蝦',
  虿: '蠆', 蚀: '蝕', 蚁: '蟻', 蚂: '螞', 蚕: '蠶', 蚝: '蠔', 蛊: '蠱', 蛎: '蠣',
  蛏: '蟶', 蛮: '蠻', 蛰: '蟄', 蛱: '蛺', 蛲: '蟯', 蛳: '螄', 蛴: '蠐', 蜕: '蛻',
  蜗: '蝸', 蜡: '蠟', 蝇: '蠅', 蝈: '蟈', 蝉: '蟬', 蝎: '蠍', 蝼: '螻', 螀: '螿',
  螨: '蟎', 蟏: '蠨', 衅: '釁', 衔: '銜', 补: '補', 表: '表', 衬: '襯', 袄: '襖',
  袅: '裊', 袜: '襪', 袭: '襲', 袯: '襏', 装: '裝', 裆: '襠', 裢: '褳', 裣: '襝',
  裤: '褲', 裥: '襇', 褛: '褸', 褴: '襤', 襁: '繈', 见: '見', 观: '觀', 规: '規',
  觅: '覓', 视: '視', 觇: '覘', 览: '覽', 觉: '覺', 觊: '覬', 觋: '覡', 觌: '覿',
  觎: '覦', 觏: '覯', 觐: '覲', 觑: '覷', 觞: '觴', 触: '觸', 觯: '觶', 誉: '譽',
  誊: '謄', 讠: '訁', 计: '計', 订: '訂', 讣: '訃', 认: '認', 讥: '譏', 讦: '訐',
  讧: '訌', 讨: '討', 让: '讓', 讪: '訕', 讫: '訖', 训: '訓', 议: '議', 讯: '訊',
  记: '記', 讲: '講', 讳: '諱', 讴: '謳', 讵: '詎', 讶: '訝', 讷: '訥', 许: '許',
  讹: '訛', 论: '論', 讼: '訟', 讽: '諷', 设: '設', 访: '訪', 诀: '訣', 证: '證',
  诂: '詁', 诃: '訶', 评: '評', 诅: '詛', 识: '識', 诈: '詐', 诉: '訴', 诊: '診',
  诋: '詆', 诌: '謅', 词: '詞', 诎: '詘', 诏: '詔', 译: '譯', 诒: '詒', 诓: '誆',
  诔: '誄', 试: '試', 诖: '詿', 诗: '詩', 诘: '詰', 诙: '詼', 诚: '誠', 诛: '誅',
  诜: '詵', 话: '話', 诞: '誕', 诟: '詬', 诠: '詮', 诡: '詭', 询: '詢', 诣: '詣',
  诤: '諍', 该: '該', 详: '詳', 诧: '詫', 诨: '諢', 诩: '詡', 诫: '誡', 诬: '誣',
  语: '語', 诮: '誚', 误: '誤', 诰: '誥', 诱: '誘', 诲: '誨', 诳: '誑', 说: '說',
  诵: '誦', 诶: '誒', 请: '請', 诸: '諸', 诹: '諏', 诺: '諾', 读: '讀', 诼: '諑',
  诽: '誹', 课: '課', 诿: '諉', 谀: '諛', 谁: '誰', 谂: '諗', 调: '調', 谄: '諂',
  谅: '諒', 谆: '諄', 谇: '誶', 谈: '談', 谊: '誼', 谋: '謀', 谌: '諶', 谍: '諜',
  谎: '謊', 谏: '諫', 谐: '諧', 谑: '謔', 谒: '謁', 谓: '謂', 谔: '諤', 谕: '諭',
  谖: '諼', 谗: '讒', 谘: '諮', 谙: '諳', 谚: '諺', 谛: '諦', 谜: '謎', 谝: '諞',
  谟: '謨', 谠: '讜', 谡: '謖', 谢: '謝', 谣: '謠', 谤: '謗', 谥: '諡', 谦: '謙',
  谧: '謐', 谨: '謹', 谩: '謾', 谪: '謫', 谫: '譾', 谬: '謬', 谭: '譚', 谮: '譖',
  谯: '譙', 谰: '讕', 谱: '譜', 谲: '譎', 谳: '讞', 谴: '譴', 谵: '譫', 谶: '讖',
  谷: '穀', 豁: '豁', 象: '象', 贝: '貝', 贞: '貞', 负: '負', 贡: '貢', 财: '財',
  责: '責', 贤: '賢', 败: '敗', 账: '帳', 货: '貨', 质: '質', 贩: '販', 贪: '貪',
  贫: '貧', 贬: '貶', 购: '購', 贮: '貯', 贯: '貫', 贰: '貳', 贱: '賤', 贲: '賁',
  贳: '貰', 贴: '貼', 贵: '貴', 贶: '貺', 贷: '貸', 贸: '貿', 费: '費', 贺: '賀',
  贻: '貽', 贼: '賊', 贽: '贄', 贾: '賈', 贿: '賄', 赀: '貲', 赁: '賃', 赂: '賂',
  赃: '贓', 资: '資', 赅: '賅', 赆: '贐', 赇: '賕', 赈: '賑', 赉: '賚', 赊: '賒',
  赋: '賦', 赌: '賭', 赍: '齎', 赎: '贖', 赏: '賞', 赐: '賜', 赑: '贔', 赒: '賙',
  赔: '賠', 赕: '賧', 赖: '賴', 赗: '賵', 赘: '贅', 赙: '賻', 赚: '賺', 赛: '賽',
  赜: '賾', 赝: '贗', 赞: '贊', 赠: '贈', 赡: '贍', 赢: '贏', 赣: '贛', 赵: '趙',
  赶: '趕', 趋: '趨', 趱: '趲', 趸: '躉', 跃: '躍', 跄: '蹌', 跖: '蹠', 跞: '躒',
  践: '踐', 跶: '躂', 跷: '蹺', 跸: '蹕', 跹: '躚', 跻: '躋', 踊: '踴', 踌: '躊',
  踪: '蹤', 踬: '躓', 踯: '躑', 蹑: '躡', 蹒: '蹣', 蹰: '躕', 蹿: '躥', 躏: '躪',
  躜: '躦', 车: '車', 轧: '軋', 轨: '軌', 轩: '軒', 轪: '軑', 轫: '軔', 转: '轉',
  轭: '軛', 轮: '輪', 软: '軟', 轰: '轟', 轱: '軲', 轲: '軻', 轳: '轤', 轴: '軸',
  轵: '軹', 轶: '軼', 轷: '軤', 轸: '軫', 轹: '轢', 轺: '軺', 轻: '輕', 轼: '軾',
  载: '載', 轾: '輊', 轿: '轎', 辁: '輇', 辂: '輅', 较: '較', 辄: '輒', 辅: '輔',
  辆: '輛', 辇: '輦', 辈: '輩', 辉: '輝', 辊: '輥', 辋: '輞', 辌: '輬', 辍: '輟',
  辎: '輜', 辏: '輳', 辐: '輻', 辑: '輯', 输: '輸', 辔: '轡', 辕: '轅', 辖: '轄',
  辗: '輾', 辙: '轍', 辚: '轔', 辞: '辭', 辟: '闢', 辩: '辯', 辫: '辮', 边: '邊',
  辽: '遼', 达: '達', 迁: '遷', 过: '過', 迈: '邁', 运: '運', 还: '還', 这: '這',
  进: '進', 远: '遠', 违: '違', 连: '連', 迟: '遲', 迩: '邇', 迳: '逕', 迹: '跡',
  适: '適', 选: '選', 逊: '遜', 递: '遞', 逦: '邐', 逻: '邏', 遗: '遺', 遥: '遙',
  邓: '鄧', 邮: '郵', 邻: '鄰', 郁: '鬱', 郏: '郟', 郐: '鄶', 郑: '鄭', 郓: '鄆',
  郦: '酈', 郧: '鄖', 郸: '鄲', 酝: '醞', 酦: '醱', 酱: '醬', 酽: '釅', 酾: '釃',
  酿: '釀', 释: '釋', 里: '裡', 鉴: '鑑', 钅: '釒', 钆: '釓', 钇: '釔', 针: '針',
  钉: '釘', 钊: '釗', 钋: '釙', 钌: '釕', 钍: '釷', 钎: '釺', 钏: '釧', 钐: '釤',
  钒: '釩', 钓: '釣', 钔: '鍆', 钕: '釹', 钖: '鍚', 钗: '釵', 钙: '鈣', 钛: '鈦',
  钝: '鈍', 钞: '鈔', 钟: '鐘', 钠: '鈉', 钡: '鋇', 钢: '鋼', 钣: '鈑', 钤: '鈐',
  钥: '鑰', 钦: '欽', 钧: '鈞', 钨: '鎢', 钩: '鉤', 钪: '鈧', 钫: '鈁', 钬: '鈥',
  钭: '鈄', 钮: '鈕', 钯: '鈀', 钰: '鈺', 钱: '錢', 钲: '鉦', 钳: '鉗', 钴: '鈷',
  钵: '缽', 钶: '鈳', 钷: '鉕', 钸: '鈽', 钹: '鈸', 钺: '鉞', 钻: '鑽', 钼: '鉬',
  钽: '鉭', 钾: '鉀', 钿: '鈿', 铀: '鈾', 铁: '鐵', 铂: '鉑', 铃: '鈴', 铄: '鑠',
  铅: '鉛', 铆: '鉚', 铈: '鈰', 铉: '鉉', 铊: '鉈', 铋: '鉍', 铌: '鈮', 铍: '鈹',
  铎: '鐸', 铐: '銬', 铑: '銠', 铒: '鉺', 铕: '銪', 铗: '鋏', 铘: '鋣', 铙: '鐃',
  铛: '鐺', 铜: '銅', 铝: '鋁', 铞: '銱', 铟: '銦', 铠: '鎧', 铡: '鍘', 铢: '銖',
  铣: '銑', 铤: '鋌', 铥: '銩', 铧: '鏵', 铨: '銓', 铩: '鎩', 铪: '鉿', 铫: '銚',
  铬: '鉻', 铭: '銘', 铮: '錚', 铯: '銫', 铰: '鉸', 铱: '銥', 铲: '鏟', 铳: '銃',
  铴: '鐋', 铵: '銨', 银: '銀', 铷: '銣', 铸: '鑄', 铹: '鐒', 铺: '鋪', 铻: '鋙',
  铼: '錸', 铽: '鋱', 链: '鏈', 铿: '鏗', 销: '銷', 锁: '鎖', 锂: '鋰', 锃: '鋥',
  锄: '鋤', 锅: '鍋', 锆: '鋯', 锇: '鋨', 锈: '鏽', 锉: '銼', 锊: '鋝', 锋: '鋒',
  锌: '鋅', 锍: '鋶', 锎: '鐦', 锏: '鐧', 锐: '銳', 锑: '銻', 锒: '鋃', 锓: '鋟',
  锔: '鋦', 锕: '錒', 锖: '錆', 锗: '鍺', 锘: '鍩', 错: '錯', 锚: '錨', 锛: '錛',
  锜: '錡', 锝: '鍀', 锞: '錁', 锟: '錕', 锡: '錫', 锢: '錮', 锣: '鑼', 锤: '錘',
  锥: '錐', 锦: '錦', 锧: '鑕', 锨: '鍁', 锩: '錈', 锪: '鍃', 锫: '錇', 锬: '錟',
  锭: '錠', 键: '鍵', 锯: '鋸', 锰: '錳', 锱: '錙', 锲: '鍥', 锴: '鍇', 锵: '鏘',
  锶: '鍶', 锷: '鍔', 锸: '鍤', 锹: '鍬', 锺: '鍾', 锻: '鍛', 锼: '鎪', 锾: '鍰',
  锿: '鎄', 镀: '鍍', 镁: '鎂', 镂: '鏤', 镃: '鎡', 镄: '鐨', 镅: '鎇', 镆: '鏌',
  镇: '鎮', 镈: '鎛', 镉: '鎘', 镊: '鑷', 镋: '钂', 镌: '鐫', 镍: '鎳', 镎: '鎿',
  镏: '鎦', 镐: '鎬', 镑: '鎊', 镒: '鎰', 镓: '鎵', 镔: '鑌', 镖: '鏢', 镗: '鏜',
  镘: '鏝', 镙: '鏍', 镚: '鏰', 镛: '鏞', 镜: '鏡', 镝: '鏑', 镞: '鏃', 镟: '鏇',
  镠: '鏐', 镡: '鐔', 镢: '钁', 镣: '鐐', 镤: '鏷', 镥: '鑥', 镦: '鐓', 镧: '鑭',
  镨: '鐠', 镩: '鑹', 镪: '鏹', 镫: '鐙', 镬: '鑊', 镭: '鐳', 镮: '鐶', 镯: '鐲',
  镰: '鐮', 镱: '鐿', 镲: '鑔', 镳: '鑣', 镴: '鑞', 长: '長', 门: '門', 闩: '閂',
  闪: '閃', 闫: '閆', 闭: '閉', 问: '問', 闯: '闖', 闰: '閏', 闱: '闈', 闲: '閒',
  闳: '閎', 间: '間', 闵: '閔', 闶: '閌', 闷: '悶', 闸: '閘', 闹: '鬧', 闺: '閨',
  闻: '聞', 闼: '闥', 闽: '閩', 闾: '閭', 闿: '闓', 阀: '閥', 阁: '閣', 阂: '閡',
  阃: '閫', 阄: '鬮', 阅: '閱', 阆: '閬', 阈: '閾', 阉: '閹', 阊: '閶', 阋: '鬩',
  阌: '閿', 阍: '閽', 阎: '閻', 阏: '閼', 阐: '闡', 阑: '闌', 阒: '闃', 阔: '闊',
  阕: '闋', 阖: '闔', 阗: '闐', 阙: '闕', 阚: '闞', 队: '隊', 阳: '陽', 阴: '陰',
  阵: '陣', 阶: '階', 际: '際', 陆: '陸', 陇: '隴', 陈: '陳', 陉: '陘', 陕: '陝',
  陧: '隉', 陨: '隕', 险: '險', 随: '隨', 隐: '隱', 隶: '隸', 隽: '雋', 难: '難',
  雏: '雛', 雳: '靂', 雾: '霧', 霁: '霽', 霉: '黴', 靓: '靚', 静: '靜', 面: '面',
  鞑: '韃', 鞒: '鞽', 鞯: '韉', 韦: '韋', 韧: '韌', 韩: '韓', 韪: '韙', 韫: '韞',
  韬: '韜', 韵: '韻', 页: '頁', 顶: '頂', 顷: '頃', 项: '項', 顺: '順', 须: '須',
  顽: '頑', 顾: '顧', 顿: '頓', 颀: '頎', 颁: '頒', 颂: '頌', 颃: '頏', 预: '預',
  颅: '顱', 领: '領', 颇: '頗', 颈: '頸', 颉: '頡', 颊: '頰', 颌: '頜', 颍: '潁',
  颏: '頦', 颐: '頤', 频: '頻', 颓: '頹', 颔: '頷', 颖: '穎', 颗: '顆', 题: '題',
  颚: '顎', 颛: '顓', 颜: '顏', 额: '額', 颞: '顳', 颟: '顢', 颠: '顛', 颡: '顙',
  颢: '顥', 颤: '顫', 颥: '顬', 颦: '顰', 颧: '顴', 风: '風', 飏: '颺', 飐: '颭',
  飑: '颮', 飒: '颯', 飓: '颶', 飕: '颼', 飘: '飄', 飙: '飆', 飚: '飈', 飞: '飛',
  饣: '飠', 饥: '飢', 饧: '餳', 饨: '飩', 饩: '餼', 饪: '飪', 饫: '飫', 饬: '飭',
  饭: '飯', 饮: '飲', 饯: '餞', 饰: '飾', 饱: '飽', 饲: '飼', 饳: '飿', 饴: '飴',
  饵: '餌', 饶: '饒', 饷: '餉', 饸: '餄', 饹: '餎', 饺: '餃', 饻: '餏', 饼: '餅',
  饽: '餑', 饿: '餓', 馀: '餘', 馁: '餒', 馂: '餕', 馃: '餜', 馄: '餛', 馅: '餡',
  馆: '館', 馇: '餷', 馈: '饋', 馊: '餿', 馋: '饞', 馍: '饃', 馏: '餾', 馐: '饈',
  馑: '饉', 馒: '饅', 馓: '饊', 馔: '饌', 馕: '饢', 马: '馬', 驭: '馭', 驮: '馱',
  驯: '馴', 驰: '馳', 驱: '驅', 驳: '駁', 驴: '驢', 驵: '駔', 驶: '駛', 驷: '駟',
  驸: '駙', 驹: '駒', 驺: '騶', 驻: '駐', 驼: '駝', 驽: '駑', 驾: '駕', 驿: '驛',
  骀: '駘', 骁: '驍', 骂: '罵', 骄: '驕', 骅: '驊', 骆: '駱', 骇: '駭', 骈: '駢',
  骊: '驪', 骋: '騁', 验: '驗', 骏: '駿', 骐: '騏', 骑: '騎', 骒: '騍', 骓: '騅',
  骖: '驂', 骗: '騙', 骘: '騭', 骚: '騷', 骛: '騖', 骜: '驁', 骝: '騮', 骞: '騫',
  骟: '騸', 骠: '驃', 骡: '騾', 骢: '驄', 骣: '驏', 骤: '驟', 骥: '驥', 骧: '驤',
  髅: '髏', 髋: '髖', 髌: '髕', 鬓: '鬢', 魇: '魘', 鱼: '魚', 鱿: '魷', 鲁: '魯',
  鲂: '魴', 鲅: '鮁', 鲆: '鮃', 鲇: '鮎', 鲈: '鱸', 鲋: '鮒', 鲍: '鮑', 鲎: '鱟',
  鲐: '鮐', 鲑: '鮭', 鲒: '鮚', 鲔: '鮪', 鲕: '鮞', 鲚: '鱭', 鲛: '鮫', 鲜: '鮮',
  鲞: '鯗', 鲟: '鱘', 鲠: '鯁', 鲡: '鱺', 鲢: '鰱', 鲣: '鰹', 鲤: '鯉', 鲥: '鰣',
  鲦: '鰷', 鲧: '鯀', 鲨: '鯊', 鲩: '鯇', 鲫: '鯽', 鲭: '鯖', 鲮: '鯪', 鲰: '鯫',
  鲱: '鯡', 鲲: '鯤', 鲳: '鯧', 鲴: '鯝', 鲵: '鯢', 鲶: '鯰', 鲷: '鯛', 鲸: '鯨',
  鲺: '鯴', 鲻: '鯔', 鲼: '鱝', 鲽: '鰈', 鲾: '鰏', 鲿: '鱨', 鳀: '鯷', 鳁: '鰮',
  鳂: '鰃', 鳃: '鰓', 鳄: '鱷', 鳅: '鰍', 鳆: '鰒', 鳇: '鰉', 鳈: '鰁', 鳉: '鱂',
  鳊: '鯿', 鳋: '鰠', 鳌: '鰲', 鳍: '鰭', 鳎: '鰨', 鳏: '鰥', 鳐: '鰩', 鳓: '鰳',
  鳔: '鰾', 鳕: '鱈', 鳖: '鱉', 鳗: '鰻', 鳘: '鰵', 鳙: '鱅', 鳜: '鱖', 鳝: '鱔',
  鳞: '鱗', 鳟: '鱒', 鳠: '鱯', 鸟: '鳥', 鸠: '鳩', 鸡: '雞', 鸢: '鳶', 鸣: '鳴',
  鸥: '鷗', 鸦: '鴉', 鸧: '鶬', 鸨: '鴇', 鸩: '鴆', 鸪: '鴣', 鸫: '鶇', 鸬: '鸕',
  鸭: '鴨', 鸯: '鴦', 鸱: '鴟', 鸲: '鴝', 鸳: '鴛', 鸵: '鴕', 鸶: '鷥', 鸷: '鷙',
  鸸: '鴯', 鸹: '鴰', 鸺: '鵂', 鸻: '鴴', 鸼: '鵃', 鸽: '鴿', 鸾: '鸞', 鸿: '鴻',
  鹁: '鵓', 鹂: '鸝', 鹃: '鵑', 鹄: '鵠', 鹅: '鵝', 鹆: '鵒', 鹇: '鷳', 鹈: '鵜',
  鹉: '鵡', 鹊: '鵲', 鹋: '鶓', 鹌: '鵪', 鹍: '鵾', 鹎: '鵯', 鹏: '鵬', 鹐: '鵮',
  鹑: '鶉', 鹒: '鶊', 鹓: '鵷', 鹔: '鷫', 鹕: '鶘', 鹖: '鶡', 鹗: '鶚', 鹘: '鶻',
  鹙: '鶖', 鹚: '鶿', 鹛: '鶥', 鹜: '鶩', 鹞: '鷂', 鹟: '鶲', 鹠: '鶹', 鹡: '鶺',
  鹢: '鷁', 鹣: '鶼', 鹤: '鶴', 鹥: '鷖', 鹦: '鸚', 鹧: '鷓', 鹨: '鷚', 鹩: '鷯',
  鹪: '鷦', 鹫: '鷲', 鹬: '鷸', 鹭: '鷺', 鹯: '鸇', 鹰: '鷹', 鹱: '鸌', 鹳: '鸛',
  鹾: '鹺', 麦: '麥', 麸: '麩', 黄: '黃', 黉: '黌', 黩: '黷', 黪: '黲', 黾: '黽',
  鼋: '黿', 鼍: '鼉', 鼹: '鼴', 齐: '齊', 齑: '齏', 齿: '齒', 龀: '齔', 龃: '齟',
  龄: '齡', 龅: '齙', 龆: '齠', 龇: '齜', 龈: '齦', 龉: '齬', 龊: '齪', 龋: '齲',
  龌: '齷', 龙: '龍', 龚: '龔', 龛: '龕',
}));

function toTraditionalChinese(text) {
  if (!text) return text;
  let result = text;
  for (const [from, to] of SIMPLIFIED_PHRASE_MAP) {
    result = result.replace(new RegExp(escapeRegex(from), 'g'), to);
  }
  return [...result].map((ch) => SIMPLIFIED_CHAR_MAP.get(ch) || ch).join('');
}

function applyRulesToSrt(srtContent, rules, options = {}) {
  const changes = [];
  const forceTraditional = options.forceTraditional === true || rules.forceTraditional === true;

  function applyToText(text) {
    let result = text;

    // 1. Remove fillers
    if (rules.fillers.length > 0) {
      for (const filler of rules.fillers) {
        const before = result;
        result = result.replace(new RegExp(escapeRegex(filler), 'gi'), (match) => {
          changes.push({ type: 'remove_filler', original: match, cleaned: '' });
          return '';
        });
      }
    }

    // 2. Normalize terms
    for (const { from, to } of rules.normalizeTerms) {
      const before = result;
      result = result.replace(new RegExp(escapeRegex(from), 'gi'), (match) => {
        if (match !== to) changes.push({ type: 'normalize_term', original: match, cleaned: to });
        return to;
      });
    }

    // 3. Custom replacements (case-insensitive)
    for (const { from, to } of rules.customReplacements) {
      const before = result;
      result = result.replace(new RegExp(escapeRegex(from), 'gi'), (match) => {
        if (match !== to) changes.push({ type: 'custom_replace', original: match, cleaned: to });
        return to;
      });
    }

    // 4. Literal replacements
    for (const { from, to } of rules.literalReplacements) {
      const before = result;
      result = result.replace(new RegExp(escapeRegex(from), 'gi'), (match) => {
        if (match !== to) changes.push({ type: 'literal_replace', original: match, cleaned: to });
        return to;
      });
    }

    // 5. Regex replacements
    for (const { pattern, replacement } of rules.regexReplacements) {
      const before = result;
      pattern.lastIndex = 0;
      result = result.replace(pattern, replacement);
      if (result !== before) {
        changes.push({ type: 'regex_replace', pattern: pattern.source, cleaned: result });
      }
    }

    // 6. Remove specified punctuation
    if (rules.removePunctuation.size > 0) {
      const punctChars = escapeRegex([...rules.removePunctuation].join(''));
      const before = result;
      result = result.replace(new RegExp(`[${punctChars}]`, 'g'), '');
      if (result !== before) {
        changes.push({ type: 'remove_punctuation', cleaned: result });
      }
    }

    // Clean up multiple spaces
    const beforeSpaces = result;
    result = result.replace(/\s{2,}/g, ' ');
    if (result !== beforeSpaces) {
      changes.push({ type: 'space_cleanup', cleaned: result });
    }

    if (forceTraditional) {
      const beforeTraditional = result;
      result = toTraditionalChinese(result);
      if (result !== beforeTraditional) {
        changes.push({ type: 'traditionalize', original: beforeTraditional, cleaned: result });
      }
    }

    return result;
  }

  // Parse SRT and apply rules to text content only
  const blocks = srtContent.split(/\r?\n\r?\n/).filter((b) => b.trim());
  const cues = [];

  for (const block of blocks) {
    const lines = block.trim().split(/\r?\n/);
    if (lines.length < 2) continue;

    const cue = { index: cues.length + 1, timespan: lines[1] || '', textLines: [], originalText: '', cleanedText: '' };

    // Find the timespan line (contains -->)
    let textStart = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        cue.timespan = lines[i];
        textStart = i + 1;
        break;
      }
    }

    // Collect text lines
    for (let i = textStart; i < lines.length; i++) {
      cue.textLines.push(lines[i]);
    }

    // Apply rules to text
    const originalText = cue.textLines.join('\n');
    const cleanedText = applyToText(originalText);
    cue.originalText = originalText;
    cue.cleanedText = cleanedText;
    cue.hasChanges = originalText !== cleanedText;

    cues.push(cue);
  }

  // Rebuild SRT with CRLF
  const rebuilt = cues
    .map((c) => {
      const text = c.cleanedText.replace(/\n/g, '\r\n');
      return `${c.index}\r\n${c.timespan}\r\n${text}`;
    })
    .join('\r\n\r\n');

  return {
    cleanedSrt: rebuilt,
    cues,
    totalCues: cues.length,
    changedCues: cues.filter((c) => c.hasChanges).length,
    changes,
  };
}

function buildCorrectionReport(job, ruleResults) {
  const sections = [
    '# 字幕初稿校閱報告',
    '',
    `- 任務 ID：${job.config.jobId}`,
    `- 語言：${job.config.language}`,
    `- ASR 引擎：${job.config.asrEngine}`,
    `- 輸出格式：${job.config.outputFormats}`,
    '',
    '## 使用者字幕需求',
    '',
    job.config.requirements || '未填寫額外需求。',
    '',
  ];

  if (ruleResults && ruleResults.totalCues > 0) {
    sections.push('## 規則套用結果', '');
    sections.push(
      `- 總字幕段落數：${ruleResults.totalCues}`,
      `- 有修改的段落：${ruleResults.changedCues}`,
      `- 未修改的段落：${ruleResults.totalCues - ruleResults.changedCues}`,
      ''
    );

    // Group changes by type
    const changeTypes = {};
    if (ruleResults.changes) {
      for (const change of ruleResults.changes) {
        const key = change.type;
        if (!changeTypes[key]) changeTypes[key] = [];
        changeTypes[key].push(change);
      }
    }

    const typeLabels = {
      remove_filler: '口語詞移除',
      normalize_term: '專有名詞標準化',
      custom_replace: '自訂替換',
      literal_replace: '一般替換',
      regex_replace: '正規表示式替換',
      remove_punctuation: '標點符號移除',
      space_cleanup: '空白清理',
    };

    for (const [type, items] of Object.entries(changeTypes)) {
      const label = typeLabels[type] || type;
      sections.push(`### ${label}（${items.length} 處）`, '');
      const examples = items.slice(0, 10);
      for (const item of examples) {
        if (item.original !== undefined) {
          sections.push(`- 「${item.original}」 → 「${item.cleaned}」`);
        } else if (item.pattern) {
          sections.push(`- 符合 ${item.pattern} 的內容已套用替換`);
        }
      }
      if (items.length > 10) {
        sections.push(`- ……還有 ${items.length - 10} 處（詳見下方完整清單）`);
      }
      sections.push('');
    }

    // Detail: changed cues
    const changedCues = ruleResults.cues.filter((c) => c.hasChanges);
    if (changedCues.length > 0) {
      sections.push('## 修改段落詳細清單', '');
      for (const cue of changedCues) {
        sections.push(`### 段落 #${cue.index}`, '');
        sections.push(`- **原始**：${cue.originalText.replace(/\r?\n/g, ' ')}`);
        sections.push(`- **修改後**：${cue.cleanedText.replace(/\r?\n/g, ' ')}`);
        sections.push('');
      }
    }
  }

  sections.push(
    '## 待人工確認',
    '',
    '- 專有名詞是否正確',
    '- 課程平台、系統名稱、英文縮寫是否一致',
    '- 斷句、閱讀速度與字幕時間軸是否自然',
    '- 是否需要調整燒錄字幕的字體、大小、顏色與位置',
    '',
  );

  return sections.join('\n');
}

function getReviewSubtitlePath(job) {
  const editedCandidates = [
    path.join(job.jobRoot, 'review-output', 'reviewed.srt'),
    path.join(job.jobRoot, 'review-output', 'trimmed.srt'),
  ].filter((candidate) => fs.existsSync(candidate))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  const candidates = [
    ...editedCandidates,
    path.join(job.jobRoot, 'working', 'rule-cleaned.srt'),
    path.join(job.jobRoot, 'working', 'draft.srt'),
    job.config.files.existingSrt ? path.join(job.jobRoot, 'input', job.config.files.existingSrt) : null,
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

function getBaseSubtitlePath(job) {
  const candidates = [
    path.join(job.jobRoot, 'review-output', 'reviewed.srt'),
    path.join(job.jobRoot, 'working', 'rule-cleaned.srt'),
    path.join(job.jobRoot, 'working', 'draft.srt'),
    job.config.files.existingSrt ? path.join(job.jobRoot, 'input', job.config.files.existingSrt) : null,
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

function getOriginalVideoPath(job) {
  if (!job.config.files.video) return null;
  const videoPath = path.join(job.jobRoot, 'input', job.config.files.video);
  return fs.existsSync(videoPath) ? videoPath : null;
}

function getEffectiveVideoPath(job) {
  return resolveEffectiveMediaPath(job.jobRoot, getOriginalVideoPath(job));
}

function readTrimStatus(job) {
  const statusPath = getEditPaths(job.jobRoot).trimStatus;
  if (!fs.existsSync(statusPath)) return { status: 'idle', stage: 'trim-planned', progress: 0, message: '尚未套用修剪' };
  try {
    return readJson(statusPath);
  } catch {
    return { status: 'idle', stage: 'trim-planned', progress: 0, message: '修剪狀態需要重新建立' };
  }
}

function updateTrimStatus(job, patch) {
  const status = { ...readTrimStatus(job), ...patch, jobId: job.config.jobId, updatedAt: new Date().toISOString() };
  const statusPath = getEditPaths(job.jobRoot).trimStatus;
  fs.mkdirSync(path.dirname(statusPath), { recursive: true });
  writeJson(statusPath, status);
  return status;
}

function invalidateMediaCaches(job) {
  const workingDir = path.join(job.jobRoot, 'working');
  if (!fs.existsSync(workingDir)) return;
  for (const name of fs.readdirSync(workingDir)) {
    if (/^waveform(?:-original)?-\d+\.json$/i.test(name) || name === 'home-thumbnail.jpg') {
      fs.rmSync(path.join(workingDir, name), { force: true });
    }
  }
}

async function saveEditPlan(job, value) {
  const original = getOriginalVideoPath(job);
  if (!original) throw new Error('找不到原始影片');
  const sourceDuration = await probeDurationSeconds(original);
  const plan = normalizeEditPlan(value, sourceDuration);
  const planPath = getEditPaths(job.jobRoot).plan;
  fs.mkdirSync(path.dirname(planPath), { recursive: true });
  writeJson(planPath, plan);
  updateTrimStatus(job, { status: 'idle', stage: 'trim-planned', progress: 0, message: '修剪區間已儲存' });
  return plan;
}

function assertTrimAvailable(jobId) {
  if (runningJobs.has(jobId)) throw Object.assign(new Error('字幕轉錄進行中，無法同時修剪影片'), { statusCode: 409 });
  if (runningBurns.has(jobId)) throw Object.assign(new Error('影片輸出進行中，無法同時修剪影片'), { statusCode: 409 });
  if (runningTrims.has(jobId)) throw Object.assign(new Error('影片修剪已在進行中'), { statusCode: 409 });
}

function startTrim(jobId) {
  const job = loadJob(jobId);
  if (!job) return { error: '找不到任務', statusCode: 404 };
  try {
    assertTrimAvailable(jobId);
  } catch (error) {
    return { error: error.message, statusCode: error.statusCode || 409 };
  }
  const plan = readEditPlan(job.jobRoot);
  if (!plan) return { error: '請先設定修剪起點與終點', statusCode: 400 };
  const controller = new AbortController();
  const previousJobState = { status: job.status.status, stage: job.status.stage, progress: job.status.progress, message: job.status.message };
  const promise = applyTrim(job, plan, controller.signal, previousJobState)
    .catch((error) => {
      const cancelled = controller.signal.aborted;
      const paths = getEditPaths(job.jobRoot);
      fs.rmSync(paths.partial, { force: true });
      updateTrimStatus(job, {
        status: cancelled ? 'cancelled' : 'failed',
        stage: cancelled ? 'trim-cancelled' : 'trim-failed',
        message: cancelled ? '影片修剪已取消' : `影片修剪失敗：${error.message}`,
      });
      updateJob(job, cancelled ? {
        ...previousJobState,
        message: '影片修剪已取消，原始影片保持不變',
      } : {
        status: 'failed',
        stage: 'trim-failed',
        message: `影片修剪失敗：${error.message}`,
      }, cancelled ? '使用者取消影片修剪' : `影片修剪失敗：${error.message}`);
    })
    .finally(() => runningTrims.delete(jobId));
  runningTrims.set(jobId, { controller, promise });
  return { started: true };
}

function cancelTrim(jobId) {
  const active = runningTrims.get(jobId);
  if (!active) return false;
  active.controller.abort();
  return true;
}

async function applyTrim(job, rawPlan, signal, previousJobState) {
  const original = getOriginalVideoPath(job);
  if (!original) throw new Error('找不到原始影片');
  const sourceDuration = await probeDurationSeconds(original);
  const plan = normalizeEditPlan(rawPlan, sourceDuration);
  const paths = getEditPaths(job.jobRoot);
  fs.mkdirSync(path.dirname(paths.partial), { recursive: true });
  fs.rmSync(paths.partial, { force: true });
  const estimatedBytes = Math.ceil(fs.statSync(original).size * (plan.outputDuration / plan.sourceDuration)) + 1024 * 1024 * 1024;
  if (typeof fs.statfsSync === 'function') {
    const stats = fs.statfsSync(path.dirname(paths.partial));
    const available = Number(stats.bavail) * Number(stats.bsize);
    if (Number.isFinite(available) && available < estimatedBytes) throw new Error('磁碟空間不足，請至少保留預估輸出容量加 1 GB');
  }
  updateTrimStatus(job, { status: 'running', stage: 'trim-preparing', progress: 1, message: '正在準備非破壞式影片修剪', plan });
  updateJob(job, { status: 'running', stage: 'trimming', progress: 1, message: '正在修剪影片' }, `修剪區間 ${plan.in}–${plan.out} 秒`);

  const encoders = plan.strategy === 'fast'
    ? ['copy']
    : (process.platform === 'darwin' ? ['h264_videotoolbox', 'libx264'] : ['libx264']);
  let lastError = null;
  for (const encoder of encoders) {
    fs.rmSync(paths.partial, { force: true });
    try {
      await runTrimProcess(job, original, paths.partial, plan, encoder, signal);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (signal.aborted || encoder === encoders.at(-1)) throw error;
      updateTrimStatus(job, { message: '硬體編碼不可用，改用相容編碼器重試' });
    }
  }
  if (lastError) throw lastError;
  const info = await probeMediaInfo(paths.partial);
  if (!info.hasVideo || !Number.isFinite(info.duration) || Math.abs(info.duration - plan.outputDuration) > Math.max(0.75, plan.outputDuration * 0.03)) {
    throw new Error(`修剪成品驗證失敗（預期 ${plan.outputDuration.toFixed(2)} 秒，實際 ${Number(info.duration || 0).toFixed(2)} 秒）`);
  }
  fs.rmSync(paths.trimmed, { force: true });
  fs.renameSync(paths.partial, paths.trimmed);

  const appliedPlan = { ...plan, appliedAt: new Date().toISOString(), effectiveFile: 'working/media-trimmed.mp4' };
  writeJson(paths.plan, appliedPlan);
  const baseSubtitle = getBaseSubtitlePath(job);
  let trimmedSubtitle = null;
  let subtitleResult = null;
  if (baseSubtitle) {
    subtitleResult = trimSrtToRange(fs.readFileSync(baseSubtitle, 'utf8'), plan.in, plan.out);
    if (subtitleResult.cues.length) {
      trimmedSubtitle = path.join(job.jobRoot, 'review-output', 'trimmed.srt');
      fs.mkdirSync(path.dirname(trimmedSubtitle), { recursive: true });
      fs.writeFileSync(trimmedSubtitle, subtitleResult.subtitle, 'utf8');
      writeJson(path.join(job.jobRoot, 'review-output', 'trim-report.json'), {
        sourceSubtitle: relativeToApp(baseSubtitle),
        sourceCount: subtitleResult.sourceCount,
        keptCount: subtitleResult.cues.length,
        removedCount: subtitleResult.removedCount,
        boundaryCount: subtitleResult.boundaryCount,
        createdAt: new Date().toISOString(),
      });
    }
  }
  invalidateMediaCaches(job);
  const completedStatus = updateTrimStatus(job, {
    status: 'completed',
    stage: 'trim-completed',
    progress: 100,
    message: '影片修剪完成，可進入字幕校對',
    plan: appliedPlan,
    mediaInfo: info,
    subtitle: subtitleResult ? {
      keptCount: subtitleResult.cues.length,
      removedCount: subtitleResult.removedCount,
      boundaryCount: subtitleResult.boundaryCount,
    } : null,
  });
  updateJob(job, {
    status: previousJobState.status === 'created' ? 'created' : 'completed',
    stage: previousJobState.status === 'created' ? 'trim-completed' : 'ready-review',
    progress: previousJobState.status === 'created' ? 0 : 100,
    message: previousJobState.status === 'created' ? '影片修剪完成，可開始字幕生成' : '影片修剪與字幕時間重算完成',
    files: {
      ...(job.status.files || {}),
      effectiveVideo: paths.trimmed,
      ...(trimmedSubtitle ? { trimmedSrt: trimmedSubtitle } : {}),
    },
  }, '影片修剪完成並切換有效影片');
  return completedStatus;
}

function runTrimProcess(job, input, output, plan, encoder, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(createJobCancelledError());
    const duration = String(plan.outputDuration);
    const args = encoder === 'copy'
      ? ['-y', '-ss', String(plan.in), '-i', input, '-t', duration, '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy', '-avoid_negative_ts', 'make_zero', '-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', output]
      : ['-y', '-ss', String(plan.in), '-i', input, '-t', duration, '-map', '0:v:0', '-map', '0:a:0?', '-c:v', encoder, ...(encoder === 'h264_videotoolbox' ? ['-q:v', '65'] : ['-preset', 'veryfast', '-crf', '20']), '-c:a', 'aac', '-b:a', '192k', '-avoid_negative_ts', 'make_zero', '-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', output];
    const child = spawn(toolPaths.ffmpeg, args, { shell: false, windowsHide: true });
    let stderr = '';
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abortHandler);
      callback();
    };
    const abortHandler = () => {
      child.kill('SIGTERM');
      finish(() => reject(createJobCancelledError()));
    };
    signal.addEventListener('abort', abortHandler, { once: true });
    child.stdout.on('data', (chunk) => {
      const timeMs = parseFfmpegProgressMs(chunk.toString('utf8'));
      if (timeMs < 0) return;
      const progress = Math.max(2, Math.min(96, Math.round((timeMs / 1000000 / plan.outputDuration) * 94 + 2)));
      updateTrimStatus(job, { status: 'running', stage: 'trimming', progress, message: encoder === 'copy' ? '正在快速修剪影片' : '正在精準修剪影片' });
      updateJob(job, { status: 'running', stage: 'trimming', progress, message: '正在修剪影片' });
    });
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk.toString('utf8')}`.slice(-5000); });
    child.on('error', (error) => finish(() => reject(error)));
    child.on('close', (code) => {
      if (signal.aborted) finish(() => reject(createJobCancelledError()));
      else if (code === 0 && fs.existsSync(output)) finish(resolve);
      else finish(() => reject(new Error(`FFmpeg 修剪失敗（${encoder}, exit ${code}）：${sanitizeLog(stderr).slice(-400)}`)));
    });
  });
}

function restoreOriginalMedia(job) {
  if (runningTrims.has(job.config.jobId)) throw Object.assign(new Error('影片修剪進行中，請先取消'), { statusCode: 409 });
  const paths = getEditPaths(job.jobRoot);
  for (const filePath of [paths.trimmed, paths.partial, paths.plan, paths.trimStatus, path.join(job.jobRoot, 'review-output', 'trimmed.srt'), path.join(job.jobRoot, 'review-output', 'trim-report.json')]) {
    fs.rmSync(filePath, { force: true });
  }
  invalidateMediaCaches(job);
  updateJob(job, {
    status: job.status.status === 'running' ? 'created' : job.status.status,
    stage: job.status.status === 'completed' ? 'ready-review' : 'created',
    message: '已還原原始影片',
    files: Object.fromEntries(Object.entries(job.status.files || {}).filter(([key]) => !['effectiveVideo', 'trimmedSrt'].includes(key))),
  }, '停用修剪並還原原始影片');
  return { ok: true, message: '已還原原始影片' };
}

function getWaveform(job, requestedPoints = 640, source = 'effective') {
  const points = Math.max(160, Math.min(1200, Math.floor(Number(requestedPoints) || 640)));
  const useOriginal = source === 'original';
  const videoPath = useOriginal ? getOriginalVideoPath(job) : getEffectiveVideoPath(job);
  if (!videoPath) return Promise.reject(new Error('找不到任務影片'));
  if (!toolPaths.ffmpeg) return Promise.reject(new Error('找不到內建 FFmpeg'));
  const cachePath = path.join(job.jobRoot, 'working', `waveform${useOriginal ? '-original' : ''}-${points}.json`);
  if (fs.existsSync(cachePath)) {
    try {
      const cached = readJson(cachePath);
      if (Array.isArray(cached.peaks) && cached.peaks.length === points) return Promise.resolve(cached);
    } catch {}
  }
  const key = `${job.config.jobId}:${source}:${points}`;
  if (runningWaveforms.has(key)) return runningWaveforms.get(key);
  const promise = new Promise((resolve, reject) => {
    const chunks = [];
    let stderr = '';
    const sampleRate = 800;
    const child = spawn(toolPaths.ffmpeg, [
      '-v', 'error', '-i', videoPath, '-map', '0:a:0', '-vn', '-ac', '1', '-ar', String(sampleRate), '-f', 's16le', 'pipe:1',
    ], { shell: false, windowsHide: true });
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`無法解析影片音軌：${sanitizeLog(stderr).slice(-180) || `FFmpeg exit ${code}`}`));
        return;
      }
      const pcm = Buffer.concat(chunks);
      const sampleCount = Math.floor(pcm.length / 2);
      if (!sampleCount) {
        reject(new Error('影片沒有可用的音訊取樣'));
        return;
      }
      const peaks = new Array(points).fill(0);
      for (let bucket = 0; bucket < points; bucket += 1) {
        const start = Math.floor((bucket * sampleCount) / points);
        const end = Math.max(start + 1, Math.floor(((bucket + 1) * sampleCount) / points));
        let peak = 0;
        for (let index = start; index < end; index += 1) {
          peak = Math.max(peak, Math.abs(pcm.readInt16LE(index * 2)) / 32768);
        }
        peaks[bucket] = peak;
      }
      const high = Math.max(...peaks, 0.01);
      const normalized = peaks.map((value) => Number(Math.min(1, Math.pow(value / high, 0.68)).toFixed(4)));
      const result = { peaks: normalized, duration: sampleCount / sampleRate, points, source: 'ffmpeg-pcm' };
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      writeJson(cachePath, result);
      resolve(result);
    });
  }).finally(() => runningWaveforms.delete(key));
  runningWaveforms.set(key, promise);
  return promise;
}

function getProjectThumbnail(job) {
  const videoPath = getEffectiveVideoPath(job);
  if (!videoPath) return Promise.reject(new Error('找不到任務影片'));
  const outputPath = path.join(job.jobRoot, 'working', 'home-thumbnail.jpg');
  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) return Promise.resolve(outputPath);
  const key = job.config.jobId;
  if (runningThumbnails.has(key)) return runningThumbnails.get(key);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const promise = new Promise((resolve, reject) => {
    let stderr = '';
    const child = spawn(toolPaths.ffmpeg, [
      '-v', 'error', '-ss', '1', '-i', videoPath, '-frames:v', '1', '-vf', 'scale=320:-2', '-q:v', '4', '-y', outputPath,
    ], { shell: false, windowsHide: true });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) resolve(outputPath);
      else reject(new Error(`無法產生專案縮圖：${sanitizeLog(stderr).slice(-160) || `FFmpeg exit ${code}`}`));
    });
  }).finally(() => runningThumbnails.delete(key));
  runningThumbnails.set(key, promise);
  return promise;
}

function startBurn(jobId, options) {
  if (runningBurns.has(jobId)) return { started: false, alreadyRunning: true };
  if (runningTrims.has(jobId)) return { started: false, error: '影片修剪進行中，完成後才能輸出' };
  const job = loadJob(jobId);
  if (!job) return { started: false, error: '找不到任務' };
  const controller = new AbortController();
  const promise = burnSubtitle(job, options, controller.signal)
    .catch((error) => {
      const freshJob = loadJob(jobId) || job;
      if (controller.signal.aborted) {
        updateJob(freshJob, {
          status: 'cancelled',
          stage: 'burn-cancelled',
          message: '字幕輸出已取消',
        }, '使用者取消字幕輸出');
        return;
      }
      updateJob(freshJob, {
        status: 'failed',
        stage: 'burn-failed',
        progress: 100,
        message: `字幕輸出失敗：${error.message}`,
      }, error.message);
    })
    .finally(() => runningBurns.delete(jobId));
  runningBurns.set(jobId, { controller, promise });
  return { started: true };
}

function cancelBurn(jobId) {
  const active = runningBurns.get(jobId);
  if (!active) return false;
  active.controller.abort();
  return true;
}

async function burnSubtitle(job, options = {}, signal) {
  const videoPath = getEffectiveVideoPath(job);
  if (!videoPath) throw new Error('找不到任務影片，無法輸出');

  const subtitlePath = getReviewSubtitlePath(job);
  if (!subtitlePath) throw new Error('找不到可輸出的字幕，請先完成字幕生成或匯入 SRT');

  const outputDir = path.join(job.jobRoot, 'output');
  fs.mkdirSync(outputDir, { recursive: true });

  const mode = ['hardsub', 'softsub', 'both'].includes(options.mode) ? options.mode : 'hardsub';
  const outputFormat = ['mp4', 'mkv'].includes(options.outputFormat) ? options.outputFormat : 'mp4';
  const quality = ['h264-fast', 'h264-medium', 'original'].includes(options.quality) ? options.quality : 'h264-medium';
  const safeBaseName = path.parse(job.config.files.video || job.config.jobId).name.replace(/[^\w\u4e00-\u9fff-]+/g, '_') || job.config.jobId;
  const duration = await probeDurationSeconds(videoPath);
  const settings = loadBurnSettings(job);
  const assPath = path.join(outputDir, 'subtitle.ass');
  fs.writeFileSync(assPath, buildAssFromSrt(fs.readFileSync(subtitlePath, 'utf8'), settings), 'utf8');

  updateJob(job, {
    status: 'running',
    stage: 'export-start',
    progress: 6,
    message: '準備輸出字幕與影片',
  }, `輸出模式=${mode} 格式=${outputFormat}`);

  const outputs = {};
  if (mode === 'softsub' || mode === 'both') {
    const softExt = outputFormat === 'mp4' ? 'mp4' : 'mkv';
    const softPath = path.join(outputDir, `${safeBaseName}_softsub.${softExt}`);
    const codecArgs = softExt === 'mp4'
      ? ['-c', 'copy', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=chi']
      : ['-c', 'copy', '-c:s', 'srt'];
    const args = ['-y', '-i', videoPath, '-i', subtitlePath, ...codecArgs, '-progress', 'pipe:1', '-nostats', softPath];
    await runFfmpegWithProgress(job, args, {
      duration,
      stage: 'softsub-export',
      start: 10,
      end: mode === 'both' ? 45 : 94,
      message: '正在輸出軟字幕影片',
      signal,
    });
    outputs.softsubVideo = softPath;
  }

  if (mode === 'hardsub' || mode === 'both') {
    const hardPath = path.join(outputDir, `${safeBaseName}_hardsub.mp4`);
    const videoArgs = quality === 'h264-fast'
      ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26']
      : ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23'];
    const args = [
      '-y',
      '-i', videoPath,
      '-vf', 'ass=subtitle.ass',
      ...videoArgs,
      '-c:a', 'copy',
      '-movflags', '+faststart',
      '-progress', 'pipe:1',
      '-nostats',
      hardPath,
    ];
    await runFfmpegWithProgress(job, args, {
      duration,
      stage: 'hardsub-burn',
      start: mode === 'both' ? 48 : 10,
      end: 96,
      message: '正在硬燒錄字幕到影片',
      cwd: outputDir,
      signal,
    });
    outputs.hardsubVideo = hardPath;
  }

  const subtitleCopy = path.join(outputDir, `${safeBaseName}_reviewed.srt`);
  fs.copyFileSync(subtitlePath, subtitleCopy);
  outputs.subtitle = subtitleCopy;
  outputs.assSubtitle = assPath;

  const manifestPath = path.join(outputDir, 'export-manifest.json');
  writeJson(manifestPath, {
    jobId: job.config.jobId,
    exportedAt: new Date().toISOString(),
    mode,
    outputFormat,
    quality,
    sourceVideo: relativeToApp(videoPath),
    sourceSubtitle: relativeToApp(subtitlePath),
    files: Object.fromEntries(Object.entries(outputs).map(([key, value]) => [key, relativeToApp(value)])),
  });

  updateJob(job, {
    status: 'completed',
    stage: 'export-completed',
    progress: 100,
    message: '輸出完成，可開啟 output 資料夾檢查檔案',
    files: {
      ...(job.status.files || {}),
      outputs,
      exportManifest: manifestPath,
      outputFolder: outputDir,
    },
  }, '字幕輸出完成');

  return outputs;
}

function loadBurnSettings(job) {
  const settingsPath = path.join(job.jobRoot, 'review-output', 'burn-settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      return normalizeBurnSettings(readJson(settingsPath));
    } catch {}
  }
  return normalizeBurnSettings({});
}

function runFfmpegWithProgress(job, args, { duration, stage, start, end, message, signal, cwd }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('輸出已取消'));
      return;
    }
    let stderr = '';
    let lastProgress = -1;
    const child = spawn(toolPaths.ffmpeg, args, { shell: false, windowsHide: true, cwd });
    const abortHandler = () => {
      child.kill('SIGTERM');
      reject(new Error('輸出已取消'));
    };
    signal?.addEventListener('abort', abortHandler, { once: true });
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      const timeMs = parseFfmpegProgressMs(text);
      if (duration > 0 && timeMs >= 0) {
        const percent = Math.min(end, Math.max(start, start + (timeMs / 1000000 / duration) * (end - start)));
        const rounded = Math.floor(percent);
        if (rounded >= lastProgress + 4 || rounded >= end) {
          lastProgress = rounded;
          updateJob(job, { stage, progress: rounded, message }, `${message} ${rounded}%`);
        }
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
      const clean = sanitizeLog(chunk.toString('utf8'));
      if (clean && clean.length > 12) updateJob(job, { stage, message }, clean);
    });
    child.on('error', (error) => {
      signal?.removeEventListener('abort', abortHandler);
      reject(error);
    });
    child.on('close', (code) => {
      signal?.removeEventListener('abort', abortHandler);
      if (signal?.aborted) {
        reject(new Error('輸出已取消'));
      } else if (code === 0) {
        updateJob(job, { stage, progress: end, message }, `${message} ${end}%`);
        resolve();
      } else {
        reject(new Error(`FFmpeg 輸出失敗（exit ${code}）：${sanitizeLog(stderr).slice(-300)}`));
      }
    });
  });
}

function parseFfmpegProgressMs(text) {
  const matches = [...text.matchAll(/out_time_ms=(\d+)/g)];
  if (!matches.length) return -1;
  return Number(matches.at(-1)[1]);
}

function probeDurationSeconds(videoPath) {
  return new Promise((resolve) => {
    const ffprobe = toolPaths.ffprobe;
    const child = spawn(ffprobe, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath,
    ], { shell: false, windowsHide: true });
    let stdout = '';
    child.stdout.on('data', (chunk) => (stdout += chunk.toString('utf8')));
    child.on('close', () => {
      const seconds = Number.parseFloat(stdout.trim());
      resolve(Number.isFinite(seconds) && seconds > 0 ? seconds : 0);
    });
    child.on('error', () => resolve(0));
  });
}

function probeMediaInfo(videoPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(toolPaths.ffprobe, [
      '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', videoPath,
    ], { shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`FFprobe 驗證失敗：${sanitizeLog(stderr).slice(-250)}`));
      try {
        const data = JSON.parse(stdout);
        const video = data.streams?.find((stream) => stream.codec_type === 'video');
        resolve({
          duration: Number(data.format?.duration || 0),
          hasVideo: Boolean(video),
          hasAudio: Boolean(data.streams?.some((stream) => stream.codec_type === 'audio')),
          width: Number(video?.width || 0),
          height: Number(video?.height || 0),
        });
      } catch (error) {
        reject(new Error(`FFprobe 回傳資料無法解析：${error.message}`));
      }
    });
  });
}

function buildAssFromSrt(srtContent, settings) {
  const cues = parseSrtCues(srtContent);
  const style = buildAssStyleLine(settings);
  const events = cues.map((cue) => {
    const text = cue.text
      .replace(/\r?\n/g, '\\N')
      .replace(/[{}]/g, '')
      .replace(/,/g, '，');
    return `Dialogue: 0,${formatAssTime(cue.start)},${formatAssTime(cue.end)},Default,,0,0,0,,${text}`;
  });
  return [
    '[Script Info]',
    'Title: Offline Subtitle Factory Export',
    'ScriptType: v4.00+',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    'PlayResX: 1920',
    'PlayResY: 1080',
    '',
    '[V4+ Styles]',
    'Format: Name, FontName, FontSize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    style,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events,
    '',
  ].join('\n');
}

function buildAssStyleLine(settings) {
  return [
    'Style: Default',
    settings.fontFamily,
    settings.fontSize,
    hexToAssColor(settings.fontColor),
    '&H000000FF',
    hexToAssColor(settings.outlineColor),
    '&H80000000',
    settings.bold ? '-1' : '0',
    '0',
    '0',
    '0',
    '100',
    '100',
    '0',
    '0',
    '1',
    settings.outlineWidth,
    '0',
    settings.alignment,
    '40',
    '40',
    settings.marginV,
    '1',
  ].join(',');
}

function parseSrtCues(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
      const timeIndex = lines.findIndex((line) => line.includes('-->'));
      if (timeIndex < 0) return null;
      const [startRaw, endRaw] = lines[timeIndex].split('-->').map((part) => part.trim());
      const cueText = lines.slice(timeIndex + 1).join('\n').trim();
      if (!cueText) return null;
      return {
        start: parseSrtTime(startRaw),
        end: parseSrtTime(endRaw),
        text: cueText,
      };
    })
    .filter((cue) => cue && cue.end > cue.start);
}

function parseSrtTime(value) {
  const match = String(value || '').match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
  if (!match) return 0;
  const [, hh, mm, ss, ms] = match;
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms.padEnd(3, '0')) / 1000;
}

function formatAssTime(seconds) {
  const totalCentiseconds = Math.max(0, Math.round(seconds * 100));
  const cs = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function normalizeBurnSettings(settings) {
  const position = ['top', 'middle', 'bottom'].includes(settings.position) ? settings.position : 'bottom';
  return {
    fontFamily: String(settings.fontFamily || 'Microsoft JhengHei'),
    fontSize: clampNumber(settings.fontSize, 8, 96, 24),
    fontColor: normalizeColor(settings.fontColor, '#ffffff'),
    outlineColor: normalizeColor(settings.outlineColor, '#000000'),
    outlineWidth: clampNumber(settings.outlineWidth, 0, 8, 2),
    position,
    marginV: clampNumber(settings.marginV, 0, 300, 42),
    bold: Boolean(settings.bold),
    alignment: position === 'top' ? 8 : position === 'middle' ? 5 : 2,
  };
}

function buildFfmpegStyle(settings) {
  return [
    `FontName=${settings.fontFamily}`,
    `FontSize=${settings.fontSize}`,
    `Bold=${settings.bold ? 1 : 0}`,
    `PrimaryColour=${hexToAssColor(settings.fontColor)}`,
    `OutlineColour=${hexToAssColor(settings.outlineColor)}`,
    'BorderStyle=1',
    `Outline=${settings.outlineWidth}`,
    'Shadow=0',
    `Alignment=${settings.alignment}`,
    `MarginV=${settings.marginV}`,
  ].join(',');
}

function hexToAssColor(hex) {
  const clean = normalizeColor(hex, '#ffffff').slice(1);
  return `&H00${clean.slice(4, 6)}${clean.slice(2, 4)}${clean.slice(0, 2)}`.toUpperCase();
}

function normalizeColor(value, fallback) {
  const text = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : fallback;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function relativeToApp(filePath) {
  const absolutePath = path.resolve(filePath);
  const relativePath = path.relative(appDir, absolutePath);
  if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
    return relativePath.replace(/\\/g, '/');
  }
  return absolutePath;
}

function jobMediaUrl(job, filePath) {
  const relative = path.relative(job.jobRoot, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('影片路徑不在任務資料夾內');
  const encoded = relative.split(path.sep).map(encodeURIComponent).join('/');
  return `/job-media/${encodeURIComponent(job.config.jobId)}/${encoded}`;
}

function resolveJobFolder(job, target) {
  const map = {
    job: job.jobRoot,
    input: path.join(job.jobRoot, 'input'),
    working: path.join(job.jobRoot, 'working'),
    output: path.join(job.jobRoot, 'output'),
    'review-output': path.join(job.jobRoot, 'review-output'),
  };
  const folder = path.resolve(map[target] || map.job);
  if (!folder.startsWith(path.resolve(job.jobRoot))) return null;
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

function openFolderInExplorer(folder) {
  return new Promise((resolve, reject) => {
    const child = spawn('explorer.exe', [folder], { detached: true, stdio: 'ignore', shell: false });
    child.on('error', reject);
    child.on('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

function serveFile(req, res, filePath) {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendText(res, 404, 'Not Found');
    return;
  }
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const type = contentTypes[ext] || 'application/octet-stream';
  const range = req.headers.range;
  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (!match) {
      res.writeHead(416);
      res.end();
      return;
    }
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : stat.size - 1;
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
  fs.createReadStream(filePath).pipe(res);
}

function getSafeJobFile(job, parts) {
  const target = path.resolve(job.jobRoot, ...parts);
  return target.startsWith(path.resolve(job.jobRoot)) ? target : null;
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const reviewMatch = url.pathname.match(/^\/review\/([^/]+)$/);
  if (reviewMatch) {
    serveFile(req, res, path.join(publicDir, 'review.html'));
    return;
  }
  const trimMatch = url.pathname.match(/^\/trim\/([^/]+)$/);
  if (trimMatch) {
    serveFile(req, res, path.join(publicDir, 'trim.html'));
    return;
  }
  const mediaMatch = url.pathname.match(/^\/job-media\/([^/]+)\/(.+)$/);
  if (mediaMatch) {
    const job = loadJob(mediaMatch[1]);
    if (!job) {
      sendText(res, 404, 'Job Not Found');
      return;
    }
    serveFile(req, res, getSafeJobFile(job, mediaMatch[2].split('/').map(decodeURIComponent)));
    return;
  }
  const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const filePath = path.normalize(path.join(publicDir, pathname));
  if (!filePath.startsWith(publicDir)) {
    sendText(res, 403, 'Forbidden');
    return;
  }
  serveFile(req, res, filePath);
}

async function handleApi(req, res) {
  const url = new URL(req.url, 'http://localhost');
  console.log('[api]', req.method, url.pathname);
  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, await healthCheck(url.searchParams.get('refresh') === '1'));
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/bootstrap') {
    // Lightweight bootstrap check — no GPU detection (avoids torch import cost)
    const tools = await getBasicToolsStatus(url.searchParams.get('refresh') === '1');
    const { node: hasNode, ffmpeg: hasFfmpeg, whisper: hasWhisper, asrEngine } = tools;

    const missing = [];
    if (!hasNode) missing.push('Node.js');
    if (!hasFfmpeg) missing.push('FFmpeg');
    if (!hasWhisper) missing.push('Whisper');

    const ready = missing.length === 0;
    const canProcess = hasWhisper && hasFfmpeg;

    let installGuide = null;
    if (!ready) {
      installGuide = {
        missingTools: missing,
        steps: ['• 正式安裝包已內建所有必要元件；若檔案缺失或損壞，請重新安裝 APP。'],
        repairAction: 'reinstall-app',
      };
    }

    sendJson(res, 200, {
      ready,
      canProcessJobs: canProcess,
      asrEngine,
      missingTools: missing,
      installGuide,
      localToolsDir: toolsDir,
      toolsInfo: {
        selectedToolsDir: toolsInfo.toolsDir,
        candidates: toolsInfo.candidates,
        manifest: toolsInfo.manifest,
        manifestPath: toolPaths.manifest,
      },
      paths: toolPaths,
    });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/settings') {
    sendJson(res, 200, {
      ...appSettings,
      settingsFile: settingsPath,
      projectFolder: getJobsDir(),
    });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/settings') {
    try {
      sendJson(res, 200, {
        ok: true,
        settings: saveSettings(await readJsonBody(req)),
      });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }
  // ── /api/video/probe (FormData: 直接上傳檔案 probing) ──
  if (req.method === 'POST' && url.pathname === '/api/video/probe') {
    let upload = null;
    try {
      const tempDir = path.join(getJobsDir(), '.temp-probe');
      upload = await streamMultipart(req, tempDir);
      const { files } = upload;
      if (!files.video) {
        sendJson(res, 400, { error: '請上傳影片檔案' });
        return;
      }
      const tempPath = files.video.path;

      const probeCmd = toolPaths.ffprobe;
      const probeArgs = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        tempPath,
      ];
      const { stdout } = await new Promise((resolve, reject) => {
        const proc = spawn(probeCmd, probeArgs, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        proc.stdout.on('data', (chunk) => { out += chunk; });
        proc.stderr.on('data', () => { /* silence */ });
        proc.on('close', (code) => {
          if (code === 0) resolve({ stdout: out });
          else reject(new Error(`ffprobe exit code ${code}`));
        });
        proc.on('error', reject);
      });

      const info = JSON.parse(stdout);
      const videoStream = info.streams?.find((s) => s.codec_type === 'video');
      const format = info.format || {};
      const durationSec = parseFloat(format.duration) || 0;
      const width = parseInt(videoStream?.width || '0', 10);
      const height = parseInt(videoStream?.height || '0', 10);
      sendJson(res, 200, {
        duration: durationSec,
        resolution: width && height ? `${width}×${height}` : '-',
      });
    } catch (error) {
      console.error('[api] video probe error:', error.message);
      sendJson(res, 500, { error: error.message });
    } finally {
      upload?.cleanup();
    }
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/jobs') {
    try {
      const jobs = listJobs();
      const requestedOffset = Number(url.searchParams.get('offset') || 0);
      const requestedLimit = Number(url.searchParams.get('limit'));
      const offset = Number.isFinite(requestedOffset) ? Math.max(0, Math.floor(requestedOffset)) : 0;
      const hasLimit = Number.isFinite(requestedLimit) && requestedLimit > 0;
      const limit = hasLimit ? Math.min(500, Math.floor(requestedLimit)) : jobs.length;
      sendJson(res, 200, {
        jobs: jobs.slice(offset, offset + limit),
        total: jobs.length,
        offset,
        limit,
        hasMore: offset + limit < jobs.length,
      });
    } catch (error) {
      console.error('[api] Job list error:', error.message);
      sendJson(res, 500, { error: error.message });
    }
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/jobs') {
    let upload = null;
    try {
      upload = await streamMultipart(req, path.join(getJobsDir(), '.temp-upload'));
      const result = createJob(upload);
      console.log('[api] Job created:', result.jobId);
      sendJson(res, 201, result);
    } catch (error) {
      console.error('[api] Job creation error:', error.message, error.stack);
      sendJson(res, 400, { error: error.message });
    } finally {
      upload?.cleanup();
    }
    return;
  }

  const match = url.pathname.match(/^\/api\/jobs\/([^/]+)(?:\/([^/]+))?$/);
  if (!match) {
    sendJson(res, 404, { error: 'Unknown API' });
    return;
  }
  const jobId = match[1];
  const action = match[2];
  const job = loadJob(jobId);
  if (!job) {
    sendJson(res, 404, { error: '找不到任務' });
    return;
  }

  if (req.method === 'POST' && action === 'start') {
    const result = startJob(jobId);
    if (result.error) sendJson(res, 400, { ok: false, error: result.error });
    else sendJson(res, 202, { ok: true, ...result });
    return;
  }
  if (req.method === 'POST' && action === 'cancel') {
    const cancelled = cancelJob(jobId);
    if (!cancelled) {
      sendJson(res, 409, { ok: false, error: '目前沒有執行中的任務' });
    } else {
      sendJson(res, 202, { ok: true, cancelled: true });
    }
    return;
  }
  if (req.method === 'POST' && action === 'retry') {
    const result = retryJob(jobId);
    if (result.error) sendJson(res, 409, { ok: false, error: result.error });
    else sendJson(res, 202, { ok: true, ...result });
    return;
  }
  if (req.method === 'GET' && action === 'status') {
    sendJson(res, 200, job.status);
    return;
  }
  if (req.method === 'GET' && action === 'files') {
    sendJson(res, 200, job.status.files || {});
    return;
  }
  if (req.method === 'GET' && action === 'edit-plan') {
    try {
      const original = getOriginalVideoPath(job);
      if (!original) throw new Error('找不到原始影片');
      const sourceDuration = await probeDurationSeconds(original);
      const effective = getEffectiveVideoPath(job);
      const effectiveDuration = effective ? await probeDurationSeconds(effective) : sourceDuration;
      sendJson(res, 200, {
        jobId,
        plan: readEditPlan(job.jobRoot),
        sourceDuration,
        effectiveDuration,
        sourceFileName: path.basename(original),
        effectiveVideoUrl: jobMediaUrl(job, effective),
        originalVideoUrl: jobMediaUrl(job, original),
        trimStatus: readTrimStatus(job),
        jobStatus: { status: job.status.status, stage: job.status.stage },
      });
    } catch (error) {
      sendJson(res, 422, { error: error.message });
    }
    return;
  }
  if (req.method === 'PUT' && action === 'edit-plan') {
    try {
      const payload = await readJsonBody(req);
      const plan = await saveEditPlan(job, payload);
      sendJson(res, 200, { ok: true, plan });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }
  if (req.method === 'POST' && action === 'apply-trim') {
    const result = startTrim(jobId);
    if (result.error) sendJson(res, result.statusCode || 400, { ok: false, error: result.error });
    else sendJson(res, 202, { ok: true, started: true, message: '影片修剪已啟動' });
    return;
  }
  if (req.method === 'GET' && action === 'trim-status') {
    sendJson(res, 200, readTrimStatus(job));
    return;
  }
  if (req.method === 'POST' && action === 'cancel-trim') {
    const cancelled = cancelTrim(jobId);
    if (!cancelled) sendJson(res, 409, { ok: false, error: '目前沒有進行中的修剪任務' });
    else sendJson(res, 202, { ok: true, cancelled: true });
    return;
  }
  if (req.method === 'DELETE' && action === 'trim') {
    try {
      sendJson(res, 200, restoreOriginalMedia(job));
    } catch (error) {
      sendJson(res, error.statusCode || 400, { ok: false, error: error.message });
    }
    return;
  }
  if (req.method === 'POST' && action === 'open-folder') {
    try {
      const folder = resolveJobFolder(job, url.searchParams.get('target') || 'job');
      if (!folder) throw new Error('Invalid folder target');
      await openFolderInExplorer(folder);
      sendJson(res, 200, { ok: true, folder: relativeToApp(folder) });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }
  if (req.method === 'GET' && action === 'review-data') {
    const subtitlePath = getReviewSubtitlePath(job);
    const videoPath = getEffectiveVideoPath(job);
    if (!subtitlePath) {
      sendJson(res, 404, { error: '找不到可校閱字幕，請先完成字幕生成' });
      return;
    }
    if (!videoPath) {
      sendJson(res, 404, { error: '找不到任務影片' });
      return;
    }
    sendJson(res, 200, {
      jobId,
      videoFileName: path.basename(videoPath),
      subtitleFileName: path.basename(subtitlePath),
      videoUrl: jobMediaUrl(job, videoPath),
      subtitle: fs.readFileSync(subtitlePath, 'utf8'),
    });
    return;
  }
  if (req.method === 'GET' && action === 'thumbnail') {
    try {
      serveFile(req, res, await getProjectThumbnail(job));
    } catch (error) {
      sendJson(res, 422, { error: error.message });
    }
    return;
  }
  if (req.method === 'GET' && action === 'waveform') {
    try {
      const result = await getWaveform(job, url.searchParams.get('points'), url.searchParams.get('source') || 'effective');
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 422, { error: error.message });
    }
    return;
  }
  if (req.method === 'POST' && action === 'save-review') {
    try {
      const payload = await readJsonBody(req);
      if (typeof payload.subtitle !== 'string') throw new Error('Missing subtitle');
      const reviewOutputDir = path.join(job.jobRoot, 'review-output');
      fs.mkdirSync(reviewOutputDir, { recursive: true });
      const subtitlePath = path.join(reviewOutputDir, 'reviewed.srt');
      fs.writeFileSync(subtitlePath, payload.subtitle.replace(/\r?\n/g, '\r\n'), 'utf8');
      updateJob(job, { files: { ...(job.status.files || {}), reviewedSrt: subtitlePath } }, '已儲存校閱後字幕');
      sendJson(res, 200, { ok: true, files: { subtitle: relativeToApp(subtitlePath) } });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }
  if (req.method === 'POST' && action === 'save-review-package') {
    try {
      const payload = await readJsonBody(req);
      if (typeof payload.subtitle !== 'string') throw new Error('Missing subtitle');
      if (!payload.settings || typeof payload.settings !== 'object') throw new Error('Missing burn settings');
      const reviewOutputDir = path.join(job.jobRoot, 'review-output');
      fs.mkdirSync(reviewOutputDir, { recursive: true });
      const subtitlePath = path.join(reviewOutputDir, 'reviewed.srt');
      const settingsPath = path.join(reviewOutputDir, 'burn-settings.json');
      const stylePath = path.join(reviewOutputDir, 'burn-settings.ffmpeg-style.txt');
      const manifestPath = path.join(reviewOutputDir, 'export-manifest.json');
      const settings = normalizeBurnSettings(payload.settings);
      const manifest = {
        ...(payload.manifest || {}),
        savedAt: new Date().toISOString(),
        files: {
          subtitle: relativeToApp(subtitlePath),
          settings: relativeToApp(settingsPath),
          ffmpegStyle: relativeToApp(stylePath),
          manifest: relativeToApp(manifestPath),
        },
      };
      fs.writeFileSync(subtitlePath, payload.subtitle.replace(/\r?\n/g, '\r\n'), 'utf8');
      writeJson(settingsPath, settings);
      fs.writeFileSync(stylePath, `${buildFfmpegStyle(settings)}\n`, 'utf8');
      writeJson(manifestPath, manifest);
      updateJob(job, {
        files: { ...(job.status.files || {}), reviewedSrt: subtitlePath, burnSettings: settingsPath, ffmpegStyle: stylePath, manifest: manifestPath },
      }, '已儲存完整校稿包');
      sendJson(res, 200, { ok: true, folder: relativeToApp(reviewOutputDir), files: manifest.files });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }
  if (req.method === 'POST' && action === 'burn') {
    try {
      const payload = await readJsonBody(req);
      const result = startBurn(jobId, payload || {});
      if (result.error) {
        sendJson(res, 404, { ok: false, error: result.error });
      } else {
        sendJson(res, 202, {
          ok: true,
          started: result.started,
          alreadyRunning: Boolean(result.alreadyRunning),
          message: result.alreadyRunning ? '輸出已在進行中' : '字幕輸出已啟動',
        });
      }
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }
  if (req.method === 'POST' && action === 'cancel-burn') {
    const cancelled = cancelBurn(jobId);
    sendJson(res, 200, { ok: true, cancelled });
    return;
  }

  sendJson(res, 404, { error: 'Unknown API' });
}

const server = createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      const origin = req.headers.origin || '';
      const localOrigin = !origin || /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(origin);
      if (!localOrigin) {
        sendJson(res, 403, { error: '不允許的請求來源' });
        return;
      }
      if (apiToken && req.headers['x-offline-subtitle-token'] !== apiToken) {
        sendJson(res, 401, { error: '本機 API 驗證失敗' });
        return;
      }
      await handleApi(req, res);
    }
    else serveStatic(req, res);
  } catch (error) {
    console.error('[server] Request error:', error.message);
    if (!res.headersSent) sendJson(res, 500, { error: error.message });
  }
});

process.on('uncaughtException', (error) => {
  console.error('[server] Uncaught exception:', error.message, error.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled rejection:', reason);
});

function findAvailablePort(startPort, maxAttempts = 20) {
  return new Promise((resolve) => {
    let attempts = 0;
    function tryPort(p) {
      const tempServer = createServer();
      tempServer.listen(p, '127.0.0.1', () => {
        tempServer.close(() => resolve(p));
      });
      tempServer.on('error', () => {
        attempts++;
        if (attempts >= maxAttempts) {
          resolve(startPort);
          return;
        }
        tryPort(startPort + attempts);
      });
    }
    tryPort(startPort);
  });
}

findAvailablePort(port).then((finalPort) => {
  if (finalPort !== port) {
    console.log(`Port ${port} is in use, using ${finalPort} instead`);
  }
  // Write actual port to a temp file so main process can read it
  const portFilePath = path.join(process.env.TEMP || '/tmp', 'offline-subtitle-port.tmp');
  try {
    fs.writeFileSync(portFilePath, String(finalPort), 'utf8');
  } catch {}
  server.listen(finalPort, '127.0.0.1', () => {
    console.log(`Offline Subtitle Factory running at http://127.0.0.1:${finalPort}`);
  });
}).catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
