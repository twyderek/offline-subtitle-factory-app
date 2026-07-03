import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, '..');
const serverPath = path.join(appDir, 'server.mjs');
const bundledNodePath = path.join(appDir, 'tools', 'node', 'node.exe');
const bundledPythonPath = path.join(appDir, 'tools', 'python-venv', 'Scripts', 'python.exe');
const bundledFfmpegPath = path.join(appDir, 'tools', 'ffmpeg', 'bin', 'ffmpeg.exe');
const bundledWhisperPath = path.join(appDir, 'tools', 'python-venv', 'Scripts', 'whisper.exe');
const setupBatPath = path.join(appDir, 'setup-local-tools.bat');

let serverProcess = null;

function createWindow(serverPort) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: '離線字幕工廠',
    icon: path.join(__dirname, 'icons', 'icon.png'),
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  win.loadURL(`http://127.0.0.1:${serverPort}`);
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
  const template = [
    {
      label: '檔案',
      submenu: [
        {
          label: '新增專案檔',
          accelerator: 'Ctrl+N',
          click: () => {
            win.webContents.send('project-new');
          },
        },
        {
          label: '儲存專案檔',
          accelerator: 'Ctrl+S',
          click: () => {
            win.webContents.send('project-save');
          },
        },
        {
          label: '讀取專案檔...',
          accelerator: 'Ctrl+O',
          click: () => {
            win.webContents.send('project-open');
          },
        },
        { type: 'separator' },
        {
          label: 'APP 偏好設定',
          accelerator: 'Ctrl+,',
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
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: '編輯',
      submenu: [
        {
          label: '健康檢查',
          accelerator: 'Ctrl+Shift+H',
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
                '2. 執行健康檢查，確認 Node.js、FFmpeg、Python、Whisper 狀態。',
                '3. 若工具未安裝，請執行 setup-local-tools.bat。',
                '4. 建立任務後等待轉錄與字幕初稿產生。',
                '5. 進入校閱頁修正字幕，並調整燒錄樣式。',
                '6. 儲存校稿包後，可在任務資料夾找到 SRT 與 FFmpeg 樣式設定。',
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
                '版本：0.1.0',
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
    const res = await fetch(`${getServerBaseUrl(win)}/api/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const toolStatus = data.tools
      ? Object.entries(data.tools)
          .map(([name, value]) => `  ${name}: ${formatHealthToolStatus(name, value)}`)
          .join('\n')
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

// ── Pre-flight tool check before starting server ─────────────────────────────
function checkToolExists(path) {
  return fs.existsSync(path);
}

function checkToolRunnable(exePath, args = []) {
  try {
    const result = spawnSync(exePath, args, { timeout: 5000, encoding: 'utf8' });
    return result.error == null && result.status === 0;
  } catch {
    return false;
  }
}

async function preFlightCheck() {
  const checks = {
    node: {
      exists: checkToolExists(bundledNodePath),
      exe: bundledNodePath,
      args: ['--version'],
      label: 'Node.js',
    },
    ffmpeg: {
      exists: checkToolExists(bundledFfmpegPath),
      exe: bundledFfmpegPath,
      args: ['-version'],
      label: 'FFmpeg',
    },
    python: {
      exists: checkToolExists(bundledPythonPath),
      exe: bundledPythonPath,
      args: ['--version'],
      label: 'Python',
    },
    whisper: {
      exists: checkToolExists(bundledWhisperPath),
      exe: bundledPythonPath,
      args: ['-c', 'import whisper; print("ok")'],
      label: 'Whisper',
    },
  };

  const results = {};
  const missing = [];

  for (const [key, check] of Object.entries(checks)) {
    if (!check.exists) {
      results[key] = false;
      missing.push(check.label);
    } else {
      results[key] = checkToolRunnable(check.exe, check.args);
      if (!results[key]) missing.push(check.label);
    }
  }

  return { results, missing, setupScript: setupBatPath };
}

async function showStartupError(title, detail) {
  dialog.showErrorBox(title, detail);
}

async function showPreFlightWarning(win, preflight) {
  const { results, missing, setupScript } = preflight;
  const missingNames = missing.join('、');

  const detailLines = [
    `以下工具尚未就緒：${missingNames}`,
    '',
    '建議操作：',
    `  1. 在檔案總管中開啟應用程式資料夾`,
    `  2. 雙擊執行 ${path.basename(setupScript)}`,
    '  3. 等待工具安裝完成後重新啟動 APP',
    '',
    '注意：',
    '  • 如果電腦上沒有安裝 Python，請先執行：',
    '    winget install Python.Python.3.12',
    '  • Node.js 和 FFmpeg 可以透過 setup-local-tools.bat 自動安裝',
    '',
    `工具安裝腳本路徑：${setupScript}`,
  ].join('\n');

  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    title: '環境工具尚未安裝',
    message: '離線字幕工廠偵測到部分工具尚未安裝',
    detail: detailLines,
    buttons: ['開啟工具資料夾', '稍後再說'],
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0) {
    shell.openPath(path.dirname(setupScript));
  }
}

async function startServer(effectivePort) {
  console.log('[main] Starting server...');
  console.log('[main] appDir:', appDir);
  console.log('[main] serverPath:', serverPath);
  console.log('[main] bundledNodePath:', bundledNodePath);
  console.log('[main] fs.existsSync(bundledNodePath):', fs.existsSync(bundledNodePath));
  console.log('[main] Expected port:', effectivePort);
  const nodeCommand = fs.existsSync(bundledNodePath) ? bundledNodePath : 'node';
  const dataDir = path.join(app.getPath('userData'), 'jobs');
  const settingsDir = path.join(app.getPath('userData'), 'config');

  serverProcess = spawn(nodeCommand, [serverPath], {
    cwd: appDir,
    env: {
      ...process.env,
      PORT: String(effectivePort),
      OFFLINE_SUBTITLE_DATA_DIR: dataDir,
      OFFLINE_SUBTITLE_SETTINGS_DIR: settingsDir,
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
      const res = await fetch(`${checkBase}/api/health`);
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
    await startServer(actualPort);
    const win = createWindow(actualPort);

    // Show preflight warning after window is ready
    if (preflight.missing.length > 0) {
      await showPreFlightWarning(win, preflight);
    }
  } catch (error) {
    const detail = error.stack
      ? `${error.message}\n\n${error.stack.split('\n').slice(0, 4).join('\n')}`
      : error.message;
    dialog.showErrorBox('啟動失敗', `無法啟動本機字幕服務：\n${detail}`);
    app.quit();
  }
});

ipcMain.handle('open-folder', async (_event, relativePath) => {
  const resolvedPath = path.resolve(appDir, relativePath);
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
  fs.mkdirSync(folderPath, { recursive: true });
  const result = await shell.openPath(folderPath);
  if (result) console.error('[main] open-arbitrary-folder error:', result);
  return result;
});

ipcMain.handle('open-external', async (_event, url) => {
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
  return shell.openPath(filePath);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    serverProcess?.kill();
    app.quit();
  }
});

app.on('before-quit', () => {
  serverProcess?.kill('SIGTERM');
});
