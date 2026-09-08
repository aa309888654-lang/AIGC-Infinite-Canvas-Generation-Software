// AICG Studio Electron 预加载脚本
// 通过 contextBridge 暴露安全 API 给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

// 自动更新事件订阅
let updaterListeners = {
  checking: [],
  available: [],
  notAvailable: [],
  progress: [],
  downloaded: [],
  error: [],
};

// 注册自动更新事件转发
ipcRenderer.on('updater:checking', () => {
  updaterListeners.checking.forEach((cb) => cb());
});
ipcRenderer.on('updater:available', (event, info) => {
  updaterListeners.available.forEach((cb) => cb(info));
});
ipcRenderer.on('updater:not-available', (event, info) => {
  updaterListeners.notAvailable.forEach((cb) => cb(info));
});
ipcRenderer.on('updater:progress', (event, progress) => {
  updaterListeners.progress.forEach((cb) => cb(progress));
});
ipcRenderer.on('updater:downloaded', (event, info) => {
  updaterListeners.downloaded.forEach((cb) => cb(info));
});
ipcRenderer.on('updater:error', (event, err) => {
  updaterListeners.error.forEach((cb) => cb(err));
});

// 窗口最大化状态变化
let maximizeChangeCallbacks = [];
ipcRenderer.on('window:maximize-changed', (event, maximized) => {
  maximizeChangeCallbacks.forEach((cb) => cb(maximized));
});

contextBridge.exposeInMainWorld('electronAPI', {
  // ==================== 窗口控制 ====================
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onWindowMaximizeChange: (callback) => {
    maximizeChangeCallbacks.push(callback);
  },

  // ==================== 对话框 ====================
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:open', options),
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:save', options),

  // ==================== 文件系统 ====================
  fs: {
    readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath, data) => ipcRenderer.invoke('fs:writeFile', filePath, data),
    writeBinaryFile: (filePath, base64Data) => ipcRenderer.invoke('fs:writeBinaryFile', filePath, base64Data),
    exists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
    mkdir: (filePath) => ipcRenderer.invoke('fs:mkdir', filePath),
    readDir: (filePath) => ipcRenderer.invoke('fs:readDir', filePath),
    unlink: (filePath) => ipcRenderer.invoke('fs:unlink', filePath),
    stat: (filePath) => ipcRenderer.invoke('fs:stat', filePath),
    isWritable: (filePath) => ipcRenderer.invoke('fs:isWritable', filePath),
    copyDir: (src, dest) => ipcRenderer.invoke('fs:copyDir', src, dest),
    moveDir: (src, dest) => ipcRenderer.invoke('fs:moveDir', src, dest),
    getCacheDir: () => ipcRenderer.invoke('fs:getCacheDir'),
    getOutputDir: () => ipcRenderer.invoke('fs:getOutputDir'),
    setCacheDir: (dir) => ipcRenderer.invoke('fs:setCacheDir', dir),
    setOutputDir: (dir) => ipcRenderer.invoke('fs:setOutputDir', dir),
  },

  // ==================== 项目管理 ====================
  project: {
    newProject: () => ipcRenderer.invoke('project:new'),
    open: () => ipcRenderer.invoke('project:open'),
    save: (filePath, data) => ipcRenderer.invoke('project:save', filePath, data),
    saveAs: (data) => ipcRenderer.invoke('project:saveAs', data),
    getRecent: () => ipcRenderer.invoke('project:getRecent'),
    addRecent: (filePath) => ipcRenderer.invoke('project:addRecent', filePath),
  },

  // ==================== 智能编辑 ====================
  smartEdit: {
    analyzeAudio: (filePath, options) => ipcRenderer.invoke('smartEdit:analyzeAudio', filePath, options),
    applyEdits: (inputPath, outputPath, operations) => ipcRenderer.invoke('smartEdit:applyEdits', inputPath, outputPath, operations),
    checkFfmpeg: () => ipcRenderer.invoke('smartEdit:checkFfmpeg'),
  },

  // ==================== 渲染导出 ====================
  render: {
    exportVideo: (options) => ipcRenderer.invoke('render:exportVideo', options),
    checkEnvironment: () => ipcRenderer.invoke('render:checkEnvironment'),
  },

  // ==================== 自动更新 ====================
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    getInfo: () => ipcRenderer.invoke('updater:getInfo'),
    onChecking: (callback) => { updaterListeners.checking.push(callback); },
    onAvailable: (callback) => { updaterListeners.available.push(callback); },
    onNotAvailable: (callback) => { updaterListeners.notAvailable.push(callback); },
    onProgress: (callback) => { updaterListeners.progress.push(callback); },
    onDownloaded: (callback) => { updaterListeners.downloaded.push(callback); },
    onError: (callback) => { updaterListeners.error.push(callback); },
  },
});
