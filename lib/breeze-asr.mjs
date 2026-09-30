import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const BREEZE_ASR_ENGINE = 'breeze-asr-25';
export const BREEZE_ASR_REVISION = 'cffe7ccb404d025296a00758d0a33468bec3a9d0';
export const BREEZE_ASR_MODEL = Object.freeze({
  name: BREEZE_ASR_ENGINE,
  label: 'Breeze ASR 25',
  filename: 'breeze-asr-25.pt',
  size: 3087008569,
  sha256: '9c94a3554ff4f0de83494e2ed7ba5826efa74bd87955c034b4d0fd681746b690',
  url: `https://huggingface.co/MediaTek-Research/Breeze-ASR-25/resolve/${BREEZE_ASR_REVISION}/whisper-github/9c94a3554ff4f0de83494e2ed7ba5826efa74bd87955c034b4d0fd681746b690/breeze-asr-25.pt?download=true`,
  license: 'Apache-2.0',
  runtime: 'MediaTek patched Whisper CLI',
});

const BREEZE_ASR_REPOSITORY = 'https://github.com/mtkresearch/Breeze-ASR-25';

/**
 * Return fixed, non-secret commands that help a user install the optional
 * Breeze runtime. The App deliberately does not execute these commands.
 */
export function breezeRuntimeInstallGuideDetails() {
  return {
    officialRepository: BREEZE_ASR_REPOSITORY,
    officialDocumentation: `${BREEZE_ASR_REPOSITORY}#readme`,
    modelPage: 'https://huggingface.co/MediaTek-Research/Breeze-ASR-25',
    runtimeRequirement: 'Python 3.8–3.11 與 MediaTek patched Whisper runtime（third_party/whisper-patch-breeze）',
    platforms: {
      unix: {
        label: 'macOS／Linux',
        setupCommand: [
          'BREEZE_REPO="$HOME/Breeze-ASR-25"',
          `git clone --recurse-submodules ${BREEZE_ASR_REPOSITORY}.git "$BREEZE_REPO"`,
          'PYTHON_BIN="$(command -v python3.11 || true)"',
          'test -n "$PYTHON_BIN" || { echo "需要 Python 3.11（Python 3.8–3.11 皆可，請調整 PYTHON_BIN）" >&2; exit 1; }',
          '"$PYTHON_BIN" -m venv "$BREEZE_REPO/.venv"',
          '"$BREEZE_REPO/.venv/bin/python" -m pip install --upgrade pip',
          '"$BREEZE_REPO/.venv/bin/python" -m pip install "$BREEZE_REPO/third_party/whisper-patch-breeze"',
          `"$BREEZE_REPO/.venv/bin/python" -c "import whisper; assert '${BREEZE_ASR_ENGINE}' in whisper.available_models(); print('Breeze runtime OK')"`,
        ].join('\n'),
        launchCommand: 'BREEZE_ASR_PYTHON="$HOME/Breeze-ASR-25/.venv/bin/python" npm start',
        packagedLaunchCommand: 'BREEZE_ASR_PYTHON="$HOME/Breeze-ASR-25/.venv/bin/python" "/Applications/離線字幕工廠.app/Contents/MacOS/離線字幕工廠"',
        runtimePathExample: '$HOME/Breeze-ASR-25/.venv/bin/python',
      },
      windows: {
        label: 'Windows PowerShell',
        setupCommand: [
          "$BreezeRepo = Join-Path $HOME 'Breeze-ASR-25'",
          `git clone --recurse-submodules ${BREEZE_ASR_REPOSITORY}.git $BreezeRepo`,
          "py -3.11 -m venv (Join-Path $BreezeRepo '.venv')",
          "$BreezePython = Join-Path $BreezeRepo '.venv\\Scripts\\python.exe'",
          '& $BreezePython -m pip install --upgrade pip',
          "& $BreezePython -m pip install (Join-Path $BreezeRepo 'third_party\\whisper-patch-breeze')",
          `& $BreezePython -c "import whisper; assert '${BREEZE_ASR_ENGINE}' in whisper.available_models(); print('Breeze runtime OK')"`,
        ].join('\n'),
        launchCommand: "$env:BREEZE_ASR_PYTHON = (Join-Path $HOME 'Breeze-ASR-25\\.venv\\Scripts\\python.exe'); npm start",
        packagedLaunchCommand: "$env:BREEZE_ASR_PYTHON = (Join-Path $HOME 'Breeze-ASR-25\\.venv\\Scripts\\python.exe'); & (Join-Path $env:LOCALAPPDATA 'Programs\\離線字幕工廠\\離線字幕工廠.exe')",
        runtimePathExample: "$HOME\\Breeze-ASR-25\\.venv\\Scripts\\python.exe",
      },
    },
    afterInstall: '安裝區塊不會進入 Breeze repo，也不會執行本 App；它會把 runtime 放在家目錄。完成後請依「開發版」或「已安裝 App」指令啟動，確保 BREEZE_ASR_PYTHON 與 App 在同一個 process environment，再按「重新檢查 runtime」。若安裝位置自訂，只替換已安裝 App 的 executable 路徑。',
  };
}

const hashCache = new Map();

async function sha256File(filePath, stat) {
  const cacheKey = `${path.resolve(filePath)}:${stat.size}:${stat.mtimeMs}`;
  if (hashCache.has(cacheKey)) return hashCache.get(cacheKey);
  const hash = crypto.createHash('sha256');
  // Stream the multi-gigabyte checkpoint so API status/cancel requests keep
  // getting event-loop turns while integrity verification is in progress.
  for await (const chunk of fs.createReadStream(filePath, { highWaterMark: 8 * 1024 * 1024 })) hash.update(chunk);
  const digest = hash.digest('hex');
  hashCache.clear();
  hashCache.set(cacheKey, digest);
  return digest;
}

export async function inspectBreezeAsrModel(modelsDir, { allowMock = false } = {}) {
  const modelPath = path.join(modelsDir, BREEZE_ASR_MODEL.filename);
  let stat;
  try {
    stat = await fs.promises.stat(modelPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return { ...BREEZE_ASR_MODEL, path: modelPath, installed: false, valid: false, reason: 'missing' };
  }
  if (!stat.isFile()) {
    return { ...BREEZE_ASR_MODEL, path: modelPath, installed: false, valid: false, reason: 'not-file' };
  }
  if (!allowMock && stat.size !== BREEZE_ASR_MODEL.size) {
    return { ...BREEZE_ASR_MODEL, path: modelPath, installed: true, valid: false, reason: 'size-mismatch', actualSize: stat.size };
  }
  const sha256 = allowMock ? BREEZE_ASR_MODEL.sha256 : await sha256File(modelPath, stat);
  const valid = sha256 === BREEZE_ASR_MODEL.sha256;
  return {
    ...BREEZE_ASR_MODEL,
    path: modelPath,
    installed: true,
    valid,
    reason: valid ? 'ok' : 'sha256-mismatch',
    actualSize: stat.size,
    actualSha256: sha256,
  };
}

export function buildBreezeRuntimeProbeArgs() {
  return ['-c', `import whisper,sys;sys.exit(0 if '${BREEZE_ASR_ENGINE}' in whisper.available_models() else 2)`];
}

export function buildBreezeAsrArgs({ audioFile, outputDir, modelDir, language = 'zh', device = 'cpu', cpuThreads = 1, performancePreset = 'balanced' }) {
  const args = [
    '-m', 'whisper',
    audioFile,
    '--model', BREEZE_ASR_ENGINE,
    '--model_dir', modelDir,
    '--language', String(language || 'zh').startsWith('zh') ? 'zh' : String(language),
    '--output_format', 'srt',
    '--output_dir', outputDir,
    '--device', device,
    '--fp16', device === 'cuda' ? 'True' : 'False',
    '--verbose', 'False',
  ];
  if (device !== 'cuda') args.push('--threads', String(Math.max(1, Number(cpuThreads) || 1)));
  if (performancePreset === 'fast') args.push('--beam_size', '1');
  if (performancePreset === 'accurate') args.push('--beam_size', '5');
  return args;
}

export function breezeRuntimeInstallGuide() {
  return '請先安裝 Python 3.8–3.11，再依 MediaTek Research 官方 Breeze-ASR-25 說明安裝 third_party/whisper-patch-breeze；完成後重新啟動 App。';
}
