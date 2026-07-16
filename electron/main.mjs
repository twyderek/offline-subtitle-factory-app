import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, '..');
const serverPath = path.join(appDir, 'server.mjs');

let serverProcess = null;
let serverApiToken = '';
let currentServerPort = null;
let mainWindow = null;

function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 640,
    height: 360,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    show: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#071a36',
    icon: path.join(__dirname, 'icons', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  splash.loadFile(path.join(__dirname, 'splash.html'));
  splash.once('ready-to-show', () => splash.show());
  return splash;
}

function createWindow(serverPort, apiToken) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: '離線字幕工廠',
    icon: path.join(__dirname, 'icons', 'icon.png'),
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  const appOrigin = `http://127.0.0.1:${serverPort}`;
  win.loadURL(`${appOrigin}/?token=${encodeURIComponent(apiToken)}`);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`${appOrigin}/`)) return { action: 'allow' };
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${appOrigin}/`)) event.preventDefault();
  });
  if (!app.isPackaged && process.env.ELECTRON_ENV === 'development') {
    win.webContents.openDevTools();
  }

  createApplicationMenu(win);
  return win;
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => {
      probe.close(() => resolve(true));
    });
    probe.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(startPort = 8790) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available local port found from ${startPort} to ${startPort + 19}`);
}

function openSettingsWindow(win) {
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => {
      openSettingsWindow(win);
    });
    return;
  }
  win.webContents.send('open-settings');
  win.webContents.executeJavaScript(
    "window.dispatchEvent(new CustomEvent('open-app-settings')); if (!document.getElementById('appSettings')?.classList.contains('is-open')) location.hash = 'settings';",
    true
  ).catch(() => {});
}

function createApplicationMenu(win) {
  const shortcutPrefix = process.platform === 'darwin' ? 'Command' : 'Ctrl';
  const template = [
    {
      label: '檔案',
      submenu: [
        {
          label: '新增專案檔',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            win.webContents.send('project-new');
          },
        },
        {
          label: '儲存專案檔',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            win.webContents.send('project-save');
          },
        },
        {
          label: '讀取專案檔...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            win.webContents.send('project-open');
          },
        },
        { type: 'separator' },
        {
          label: 'APP 偏好設定',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            openSettingsWindow(win);
          },
        },
        { type: 'separator' },
        {
          label: '開啟任務資料夾',
          click: () => {
            shell.openPath(path.join(app.getPath('userData'), 'jobs'));
          },
        },
        {
          label: '開啟設定資料夾',
          click: () => {
            shell.openPath(path.join(app.getPath('userData'), 'config'));
          },
        },
        { type: 'separator' },
        {
          label: '結束',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: '編輯',
      submenu: [
        { label: '復原', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪下', role: 'cut' },
        { label: '複製', role: 'copy' },
        { label: '貼上', role: 'paste' },
        { label: '全選', role: 'selectAll' },
        { type: 'separator' },
        {
          label: '健康檢查',
          accelerator: 'CmdOrCtrl+Shift+H',
          click: () => showHealthCheckDialog(win),
        },
        { type: 'separator' },
        { label: '重新載入', role: 'reload' },
        { label: '強制重新載入', role: 'forceReload' },
      ],
    },
    {
      label: '檢視',
      submenu: [
        { label: '放大', role: 'zoomIn' },
        { label: '縮小', role: 'zoomOut' },
        { label: '重設縮放', role: 'resetZoom' },
        { type: 'separator' },
        { label: '切換全螢幕', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: '開發者工具', role: 'toggleDevTools' },
      ],
    },
    {
      label: '說明',
      submenu: [
        {
          label: '使用說明',
          click: () => {
            dialog.showMessageBox(win, {
              type: 'info',
              title: '使用說明',
              message: '離線字幕工廠操作流程',
              detail: [
                '1. 選擇影片、規則檔，或匯入既有 SRT。',
                '2. APP 會自動檢查內建 FFmpeg、Whisper.cpp、模型與 Metal／GPU 狀態。',
                '3. 若離線元件異常，請執行健康檢查並依畫面提示修復。',
                '4. 建立任務後等待轉錄與字幕初稿產生。',
                '5. 進入校閱頁修正字幕，並調整燒錄樣式。',
                '6. 校閱內容會自動保存，也可儲存校稿包或輸出字幕與影片。',
              ].join('\n'),
            });
          },
        },
        {
          label: '快捷鍵一覽',
          click: () => {
            dialog.showMessageBox(win, {
              type: 'info',
              title: '快捷鍵一覽',
              message: '離線字幕工廠快捷鍵',
              detail: [
                `${shortcutPrefix}+N　新增專案檔`,
                `${shortcutPrefix}+O　讀取專案檔`,
                `${shortcutPrefix}+S　儲存專案檔`,
                `${shortcutPrefix}+,　開啟偏好設定`,
                `${shortcutPrefix}+Shift+H　健康檢查`,
                '',
                '校閱頁：',
                'Space　播放／暫停',
                'Alt+← / Alt+→　快退／快進 5 秒',
                `${shortcutPrefix}+↑ / ${shortcutPrefix}+↓　上一段／下一段字幕`,
              ].join('\n'),
            });
          },
        },
        { type: 'separator' },
        {
          label: '回報問題',
          click: () => {
            dialog.showMessageBox(win, {
              type: 'info',
              title: '回報問題',
              message: '回報問題',
              detail: [
                '請附上問題描述、操作步驟，以及任務資料夾中的 log 或錯誤訊息。',
                '',
                '聯絡資訊：',
                'Email：derek@nycu.edu.tw',
                '分機 / 電話：62101',
                '',
                '單位：國立陽明交通大學 教務處數位教學中心',
              ].join('\n'),
            });
          },
        },
        { type: 'separator' },
        {
          label: '關於離線字幕工廠',
          click: () => {
            dialog.showMessageBox(win, {
              type: 'info',
              title: '關於離線字幕工廠',
              message: '離線字幕工廠',
              detail: [
                `版本：${app.getVersion()}`,
                '',
                '學校：國立陽明交通大學',
                '單位：教務處數位教學中心',
                '',
                '© 2026 國立陽明交通大學 教務處數位教學中心。保留所有權利。',
                '',
                'Offline Subtitle Factory',
              ].join('\n'),
            });
          },
        },
      ],
    },
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about', label: '關於離線字幕工廠' },
        { type: 'separator' },
        { role: 'services', label: '服務' },
        { type: 'separator' },
        { role: 'hide', label: '隱藏離線字幕工廠' },
        { role: 'hideOthers', label: '隱藏其他項目' },
        { role: 'unhide', label: '顯示全部' },
        { type: 'separator' },
        { role: 'quit', label: '結束離線字幕工廠' },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function getServerBaseUrl(win) {
  const url = win.webContents.getURL();
  const portMatch = url.match(/:(\d+)/);
  const port = portMatch ? portMatch[1] : '8790';
  return `http://127.0.0.1:${port}`;
}

async function showHealthCheckDialog(win) {
  try {
    const res = await fetch(`${getServerBaseUrl(win)}/api/health?refresh=1`, {
      headers: { 'X-Offline-Subtitle-Token': serverApiToken },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const toolStatus = data.tools
      ? [
          `  FFmpeg：${formatHealthToolStatus('ffmpeg', data.tools.ffmpeg)}`,
          `  轉錄引擎：${data.tools.asrEngine || '不可用'}`,
          `  Whisper.cpp：${formatHealthToolStatus('whisperCpp', data.tools.whisperCpp)}`,
          `  內建模型：${formatHealthToolStatus('whisperCppModel', data.tools.whisperCppModel)}`,
          `  Metal／GPU：${formatHealthToolStatus('gpu', data.tools.gpu)}`,
        ].join('\n')
      : '  無工具狀態資料';

    const projectFolder = data.settings?.projectFolder || '';
    const settingsFile = data.settings?.settingsFile || '';

    const buttons = ['開啟任務資料夾', '開啟設定檔'];
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      title: '健康檢查結果',
      message: '目前執行環境狀態',
      detail: [
        `Node.js: ${data.node || '未知'}`,
        '',
        '本機工具：',
        toolStatus,
        '',
        '設定路徑：',
        `  任務資料夾：${projectFolder || '未知'}`,
        `  設定檔：${settingsFile || '未知'}`,
      ].join('\n'),
      buttons,
      defaultId: 0,
      cancelId: 1,
    });

    if (response === 0 && projectFolder) {
      shell.openPath(projectFolder);
    } else if (response === 1 && settingsFile) {
      shell.openPath(settingsFile);
    }
  } catch (err) {
    dialog.showMessageBox(win, {
      type: 'error',
      title: '健康檢查失敗',
      message: '無法連線到本機字幕服務',
      detail: err.message,
    });
  }
}

function formatHealthToolStatus(name, value) {
  if (name === 'gpu' && value && typeof value === 'object') {
    if (value.available) return value.deviceName || value.status || '可用';
    return value.error ? `CPU 運算 (${value.error})` : 'CPU 運算';
  }
  return value ? '可用' : '未找到';
}

function resolveToolsInfo() {
  const candidates = [
    process.env.OFFLINE_SUBTITLE_TOOLS_DIR,
    app.isPackaged ? path.join(process.resourcesPath, 'tools') : null,
    path.join(app.getPath('userData'), 'tools'),
    path.join(appDir, 'tools'),
    path.resolve(appDir, '..', 'tools'),
  ]
    .filter(Boolean)
    .map((candidate) => path.resolve(candidate));
  const uniqueCandidates = [...new Set(candidates)];
  const toolsDir = uniqueCandidates.find((candidate) => hasAnyTool(candidate)) || uniqueCandidates[0];
  return buildToolsInfo(toolsDir, uniqueCandidates);
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

function isFileCommand(command) {
  return Boolean(command) && (
    path.isAbsolute(command)
    || command.includes('\\')
    || command.includes('/')
  );
}

function commandDir(command) {
  return isFileCommand(command) ? path.dirname(command) : null;
}

function buildToolsInfo(toolsDir, candidates) {
  const paths = {
    node: firstExisting([
      path.join(toolsDir, 'node', 'node.exe'),
      process.execPath,
    ]),
    ffmpeg: firstExisting([
      path.join(toolsDir, 'ffmpeg', 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
      'ffmpeg',
    ]),
    python: firstExisting([
      path.join(toolsDir, 'python', 'python.exe'),
      path.join(toolsDir, 'python-embed', 'python.exe'),
      path.join(toolsDir, 'python-venv', 'Scripts', 'python.exe'),
    ]),
    whisperCpp: path.join(toolsDir, 'whisper-cpp', process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'),
    whisperModels: path.join(toolsDir, 'whisper-models'),
    whisperCppModel: path.join(toolsDir, 'whisper-models', 'ggml-tiny.bin'),
    manifest: path.join(toolsDir, 'manifest.json'),
  };
  return { toolsDir, candidates, paths };
}

// ── Pre-flight tool check before starting server ─────────────────────────────
function checkToolExists(exePath) {
  if (!exePath) return false;
  return isFileCommand(exePath) ? fs.existsSync(exePath) : true;
}

function checkToolRunnable(exePath, args = []) {
  if (!checkToolExists(exePath)) return false;
  try {
    const useElectronAsNode = path.resolve(exePath) === path.resolve(process.execPath);
    const result = spawnSync(exePath, args, {
      timeout: 8000,
      encoding: 'utf8',
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
        ELECTRON_RUN_AS_NODE: useElectronAsNode ? '1' : process.env.ELECTRON_RUN_AS_NODE,
      },
    });
    return result.error == null && result.status === 0;
  } catch {
    return false;
  }
}

async function preFlightCheck() {
  const toolInfo = resolveToolsInfo();
  const { paths } = toolInfo;
  const checks = {
    node: {
      exists: checkToolExists(paths.node),
      exe: paths.node,
      args: ['--version'],
      label: 'Node.js',
    },
    ffmpeg: {
      exists: checkToolExists(paths.ffmpeg),
      exe: paths.ffmpeg,
      args: ['-version'],
      label: 'FFmpeg',
    },
    python: {
      exists: checkToolExists(paths.python),
      exe: paths.python,
      args: ['--version'],
      label: 'Python',
    },
    whisper: {
      exists: checkToolExists(paths.python),
      exe: paths.python,
      args: ['-c', 'import whisper; print("ok")'],
      label: 'Whisper',
    },
    whisperCpp: {
      exists: checkToolExists(paths.whisperCpp),
      exe: paths.whisperCpp,
      args: ['--help'],
      label: 'Whisper.cpp',
    },
  };

  const results = {};
  const missing = [];

  for (const [key, check] of Object.entries(checks)) {
    if (!check.exists) {
      results[key] = false;
    } else {
      results[key] = checkToolRunnable(check.exe, check.args);
    }
  }

  results.whisperCppModel = fs.existsSync(paths.whisperCppModel);
  if (!results.node) missing.push('內建 Node.js 執行環境');
  if (!results.ffmpeg) missing.push('FFmpeg');
  if (!(results.whisper || (results.whisperCpp && results.whisperCppModel))) {
    missing.push('Whisper 離線轉錄引擎或預設模型');
  }

  return { results, missing, toolInfo };
}

async function showStartupError(title, detail) {
  dialog.showErrorBox(title, detail);
}

async function showPreFlightWarning(win, preflight) {
  const { missing } = preflight;
  const missingNames = missing.join('、');

  const detailLines = [
    `以下工具尚未就緒：${missingNames}`,
    '',
    '正式安裝包已包含所有必要元件，不需要另外安裝 Python、Node.js、FFmpeg 或 Whisper。',
    '',
    '請重新執行安裝程式以修復缺少或損壞的元件。',
  ].join('\n');

  await dialog.showMessageBox(win, {
    type: 'warning',
    title: '內建元件需要修復',
    message: '離線字幕工廠偵測到部分內建元件缺少或損壞',
    detail: detailLines,
    buttons: ['確定'],
    defaultId: 0,
  });
}

async function startServer(effectivePort, apiToken) {
  const toolInfo = resolveToolsInfo();
  const pathEntries = [
    commandDir(toolInfo.paths.ffmpeg),
    commandDir(toolInfo.paths.python),
    commandDir(toolInfo.paths.whisperCpp),
    commandDir(toolInfo.paths.node),
  ].filter(Boolean);
  const nodeCommand = checkToolExists(toolInfo.paths.node) ? toolInfo.paths.node : process.execPath;
  const useElectronAsNode = path.resolve(nodeCommand) === path.resolve(process.execPath);

  console.log('[main] Starting server...');
  console.log('[main] appDir:', appDir);
  console.log('[main] serverPath:', serverPath);
  console.log('[main] toolsDir:', toolInfo.toolsDir);
  console.log('[main] nodeCommand:', nodeCommand);
  console.log('[main] Expected port:', effectivePort);
  const dataDir = path.join(app.getPath('userData'), 'jobs');
  const settingsDir = path.join(app.getPath('userData'), 'config');

  serverProcess = spawn(nodeCommand, [serverPath], {
    cwd: appDir,
    env: {
      ...process.env,
      PORT: String(effectivePort),
      OFFLINE_SUBTITLE_DATA_DIR: dataDir,
      OFFLINE_SUBTITLE_SETTINGS_DIR: settingsDir,
      OFFLINE_SUBTITLE_TOOLS_DIR: toolInfo.toolsDir,
      OFFLINE_SUBTITLE_API_TOKEN: apiToken,
      XDG_CACHE_HOME: toolInfo.toolsDir,
      WHISPER_CACHE: toolInfo.paths.whisperModels,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      ELECTRON_RUN_AS_NODE: useElectronAsNode ? '1' : process.env.ELECTRON_RUN_AS_NODE,
      PATH: [...pathEntries, process.env.PATH || ''].filter(Boolean).join(path.delimiter),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  serverProcess.stdout.on('data', (data) => {
    process.stdout.write(data.toString());
  });
  serverProcess.stderr.on('data', (data) => {
    process.stderr.write(data.toString());
  });

  const checkBase = `http://127.0.0.1:${effectivePort}`;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(`${checkBase}/api/health`, { headers: { 'X-Offline-Subtitle-Token': apiToken } });
      if (res.ok) {
        console.log('[main] Server ready on port', effectivePort);
        return;
      }
    } catch {
      // Server is still starting.
    }
  }
  throw new Error(`Server failed to start on port ${effectivePort} within 15 seconds`);
}

// ── App startup with preflight check ──────────────────────────────────────────
app.whenReady().then(async () => {
  const splash = createSplashWindow();
  // Run preflight before starting server
  const preflight = await preFlightCheck();
  if (preflight.missing.length > 0) {
    console.warn('[main] Preflight warning: missing tools:', preflight.missing);
    // Defer dialog until window is created (dialog must be called on main thread)
    // We'll show it after createWindow, but for now log and proceed
    // The server will also detect missing tools at runtime
  }

  try {
    const actualPort = await findAvailablePort(8790);
    currentServerPort = actualPort;
    serverApiToken = crypto.randomBytes(32).toString('hex');
    await startServer(actualPort, serverApiToken);
    const win = createWindow(actualPort, serverApiToken);
    mainWindow = win;
    win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
    win.once('ready-to-show', () => {
      win.show();
      if (!splash.isDestroyed()) splash.close();
    });

    // Show preflight warning after window is ready
    if (preflight.missing.length > 0) {
      await showPreFlightWarning(win, preflight);
    }
  } catch (error) {
    if (!splash.isDestroyed()) splash.close();
    const detail = error.stack
      ? `${error.message}\n\n${error.stack.split('\n').slice(0, 4).join('\n')}`
      : error.message;
    dialog.showErrorBox('啟動失敗', `無法啟動本機字幕服務：\n${detail}`);
    app.quit();
  }
});

ipcMain.handle('open-folder', async (_event, relativePath) => {
  const resolvedPath = path.resolve(appDir, relativePath);
  const relative = path.relative(appDir, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('不允許開啟應用程式目錄外的路徑');
  return shell.openPath(resolvedPath);
});

ipcMain.handle('select-folder', async (_event, options = {}) => {
  const result = await dialog.showOpenDialog({
    title: options.title || '選擇資料夾',
    defaultPath: options.defaultPath || undefined,
    properties: ['openDirectory', 'createDirectory'],
    message: options.message || '請選擇資料夾',
  });
  if (result.canceled || !result.filePaths?.[0]) return null;
  return result.filePaths[0];
});

ipcMain.handle('open-arbitrary-folder', async (_event, folderPath) => {
  if (!folderPath || !path.isAbsolute(folderPath)) return;
  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) return '資料夾不存在';
  const result = await shell.openPath(folderPath);
  if (result) console.error('[main] open-arbitrary-folder error:', result);
  return result;
});

ipcMain.handle('open-external', async (_event, url) => {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('無效的外部網址'); }
  if (!['https:', 'http:', 'file:'].includes(parsed.protocol)) throw new Error('不允許此外部網址協定');
  if (parsed.protocol === 'file:') {
    const filePath = path.resolve(decodeURIComponent(parsed.pathname.replace(/^\/(?:([A-Za-z]:))/, '$1')));
    const relative = path.relative(appDir, filePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('不允許開啟應用程式目錄外的檔案');
  }
  return shell.openExternal(url);
});

ipcMain.handle('save-project-file', async (_event, project = {}) => {
  const defaultName = project?.jobId
    ? `subtitle-project-${project.jobId}.osfp`
    : `subtitle-project-${new Date().toISOString().slice(0, 10)}.osfp`;
  const result = await dialog.showSaveDialog({
    title: '儲存專案檔',
    defaultPath: defaultName,
    filters: [
      { name: 'Offline Subtitle Factory Project', extensions: ['osfp'] },
      { name: 'JSON', extensions: ['json'] },
    ],
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };

  const payload = {
    fileType: 'offline-subtitle-factory-project',
    version: 1,
    savedAt: new Date().toISOString(),
    project,
  };
  fs.writeFileSync(result.filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return { ok: true, filePath: result.filePath };
});

ipcMain.handle('open-project-file', async () => {
  const result = await dialog.showOpenDialog({
    title: '讀取專案檔',
    properties: ['openFile'],
    filters: [
      { name: 'Offline Subtitle Factory Project', extensions: ['osfp'] },
      { name: 'JSON', extensions: ['json'] },
    ],
  });
  if (result.canceled || !result.filePaths?.[0]) return { ok: false, canceled: true };

  const filePath = result.filePaths[0];
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^﻿/, ''));
  if (payload.fileType !== 'offline-subtitle-factory-project' || !payload.project) {
    throw new Error('不是有效的離線字幕工廠專案檔');
  }
  return { ok: true, filePath, project: payload.project };
});

ipcMain.handle('open-settings-file', async (_event, filePath) => {
  if (!filePath || !path.isAbsolute(filePath)) return;
  if (!fs.existsSync(filePath)) return;
  const settingsRoot = path.join(app.getPath('userData'), 'config');
  const relative = path.relative(settingsRoot, path.resolve(filePath));
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('不允許開啟設定目錄外的檔案');
  return shell.openPath(filePath);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    serverProcess?.kill();
    app.quit();
  }
});

app.on('activate', () => {
  if (!mainWindow && currentServerPort && serverApiToken) {
    mainWindow = createWindow(currentServerPort, serverApiToken);
    mainWindow.on('closed', () => { mainWindow = null; });
    mainWindow.once('ready-to-show', () => mainWindow?.show());
  }
});

app.on('before-quit', () => {
  serverProcess?.kill('SIGTERM');
});
