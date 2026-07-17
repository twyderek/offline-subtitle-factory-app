import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // 開啟系統資料夾（接收伺服器回傳的相對路徑，由 main process 解析為絕對路徑）
  openFolder: (relativePath) => ipcRenderer.invoke('open-folder', relativePath),
  // 開啟外部連結
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  // 開啟系統資料夾選擇器
  selectFolder: (options) => ipcRenderer.invoke('select-folder', options),
  // 開啟任意絕對路徑資料夾（用於設定頁面）
  openArbitraryFolder: (folderPath) => ipcRenderer.invoke('open-arbitrary-folder', folderPath),
  aiKeyStatus: (provider) => ipcRenderer.invoke('ai-key-status', provider),
  saveAiKey: (provider, apiKey) => ipcRenderer.invoke('ai-key-save', provider, apiKey),
  clearAiKey: (provider) => ipcRenderer.invoke('ai-key-clear', provider),
  // 從 Electron 上方選單開啟設定
  onOpenSettings: (callback) => {
    ipcRenderer.removeAllListeners('open-settings');
    ipcRenderer.on('open-settings', callback);
  },
  // 告知 renderer 目前是 Electron 環境
  isElectron: true,
});
