const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: (relativePath) => ipcRenderer.invoke('open-folder', relativePath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  selectFolder: (options) => ipcRenderer.invoke('select-folder', options),
  openArbitraryFolder: (folderPath) => ipcRenderer.invoke('open-arbitrary-folder', folderPath),
  openSettingsFile: (filePath) => ipcRenderer.invoke('open-settings-file', filePath),
  saveProjectFile: (project) => ipcRenderer.invoke('save-project-file', project),
  openProjectFile: () => ipcRenderer.invoke('open-project-file'),
  onOpenSettings: (callback) => {
    ipcRenderer.removeAllListeners('open-settings');
    ipcRenderer.on('open-settings', callback);
  },
  onProjectNew: (callback) => {
    ipcRenderer.removeAllListeners('project-new');
    ipcRenderer.on('project-new', callback);
  },
  onProjectSave: (callback) => {
    ipcRenderer.removeAllListeners('project-save');
    ipcRenderer.on('project-save', callback);
  },
  onProjectOpen: (callback) => {
    ipcRenderer.removeAllListeners('project-open');
    ipcRenderer.on('project-open', callback);
  },
  isElectron: true,
});
