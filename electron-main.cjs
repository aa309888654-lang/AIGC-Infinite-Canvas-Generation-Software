// AICG Studio Electron 主进程
// 集成 electron-updater 实现自动更新
const { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { spawn, execFile } = require('child_process');
const https = require('https');
const http = require('http');

const APP_DISPLAY_VERSION = 'v2.7.9';

// 自动更新模块（开发环境下可能未安装，做容错处理）
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
  if (autoUpdater) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowDowngrade = false;
  }
} catch (e) {
  console.warn('[updater] electron-updater 未安装，自动更新功能不可用');
}

const isDev = !app.isPackaged;
const DEV_SERVER_URL = 'http://localhost:5178';

// 缓存目录与输出目录（用户可配置，持久化到 userData）
let cacheDir = path.join(app.getPath('userData'), 'cache');
let outputDir = path.join(app.getPath('userData'), 'output');

/** 读取持久化配置 */
function loadPathsConfig() {
  try {
    const cfgPath = path.join(app.getPath('userData'), 'paths.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      if (cfg.cacheDir && typeof cfg.cacheDir === 'string') cacheDir = cfg.cacheDir;
      if (cfg.outputDir && typeof cfg.outputDir === 'string') outputDir = cfg.outputDir;
    }
  } catch (e) {
    console.warn('[paths] 读取配置失败:', e.message);
  }
}

/** 写入持久化配置 */
function savePathsConfig() {
  try {
    const cfgPath = path.join(app.getPath('userData'), 'paths.json');
    fs.writeFileSync(cfgPath, JSON.stringify({ cacheDir, outputDir }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[paths] 保存配置失败:', e.message);
  }
}

/** 确保目录存在 */
async function ensureDir(dirPath) {
  try {
    await fsp.mkdir(dirPath, { recursive: true });
    return true;
  } catch (e) {
    return false;
  }
}

/** 主窗口引用 */
let mainWindow = null;

/** 创建主窗口 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: true,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: !isDev,
      allowRunningInsecureContent: isDev,
    },
    icon: path.join(__dirname, 'build', 'icon.ico'),
  });

  // 窗口准备好后再显示，避免白屏
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    // 启动后延迟检查更新（仅打包环境）
    if (!isDev && autoUpdater) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch((err) => {
          console.warn('[updater] 检查更新失败:', err.message);
        });
      }, 3000);
    }
  });

  // 最大化状态变化通知渲染进程
  const notifyMaximize = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximize-changed', mainWindow.isMaximized());
    }
  };
  mainWindow.on('maximize', notifyMaximize);
  mainWindow.on('unmaximize', notifyMaximize);

  // 外部链接在默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // 加载内容
  if (isDev) {
    let attempts = 0;
    const maxAttempts = 10;
    const retryLoad = () => {
      attempts++;
      mainWindow.loadURL(DEV_SERVER_URL)
        .then(() => {
          console.log(`[Electron] Successfully loaded dev server (attempt ${attempts})`);
          mainWindow.webContents.openDevTools({ mode: 'detach' });
        })
        .catch((err) => {
          console.log(`[Electron] Load attempt ${attempts} failed: ${err.message}`);
          if (attempts < maxAttempts) {
            console.log(`[Electron] Retrying in 1s...`);
            setTimeout(retryLoad, 1000);
          } else {
            console.error(`[Electron] Max attempts reached. Falling back to blank page.`);
            mainWindow.loadURL('about:blank');
          }
        });
    };
    retryLoad();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/** 注册自动更新事件 */
function setupAutoUpdater() {
  if (!autoUpdater) return;

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('updater:checking');
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater:available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    mainWindow?.webContents.send('updater:not-available', { version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('updater:progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updater:downloaded', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('updater:error', { message: err?.message || String(err) });
  });
}

// ==================== IPC: 窗口控制 ====================
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
ipcMain.handle('window:close', () => {
  mainWindow?.close();
});
ipcMain.handle('window:is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// ==================== IPC: 对话框 ====================
ipcMain.handle('dialog:open', async (event, options) => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: options.title,
    filters: options.filters,
    properties: options.properties,
  });
  return { canceled: result.canceled, filePaths: result.filePaths };
});
ipcMain.handle('dialog:save', async (event, options) => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: options.title,
    filters: options.filters,
  });
  return { canceled: result.canceled, filePath: result.filePath };
});

// ==================== IPC: 文件系统 ====================
ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const data = await fsp.readFile(filePath, 'utf-8');
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle('fs:writeFile', async (event, filePath, data) => {
  try {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, data, 'utf-8');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle('fs:writeBinaryFile', async (event, filePath, base64Data) => {
  try {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    const buf = Buffer.from(base64Data, 'base64');
    await fsp.writeFile(filePath, buf);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle('fs:exists', async (event, filePath) => {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
});
ipcMain.handle('fs:mkdir', async (event, filePath) => {
  try {
    await fsp.mkdir(filePath, { recursive: true });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle('fs:readDir', async (event, filePath) => {
  try {
    const entries = await fsp.readdir(filePath, { withFileTypes: true });
    const data = entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle('fs:unlink', async (event, filePath) => {
  try {
    await fsp.unlink(filePath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle('fs:stat', async (event, filePath) => {
  try {
    const st = await fsp.stat(filePath);
    return {
      success: true,
      data: {
        size: st.size,
        isDirectory: st.isDirectory(),
        modifiedTime: st.mtime.toISOString(),
      },
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle('fs:isWritable', async (event, filePath) => {
  try {
    await fsp.access(filePath, fs.constants.W_OK);
    return true;
  } catch {
    // 文件不存在时尝试创建临时文件测试写权限
    try {
      const testFile = path.join(filePath, '.write-test-' + Date.now());
      await fsp.writeFile(testFile, 'test');
      await fsp.unlink(testFile);
      return true;
    } catch {
      return false;
    }
  }
});
ipcMain.handle('fs:copyDir', async (event, src, dest) => {
  try {
    await fsp.mkdir(dest, { recursive: true });
    const entries = await fsp.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const s = path.join(src, entry.name);
      const d = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await copyDirRecursive(s, d);
      } else {
        await fsp.copyFile(s, d);
      }
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
async function copyDirRecursive(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(s, d);
    } else {
      await fsp.copyFile(s, d);
    }
  }
}
ipcMain.handle('fs:moveDir', async (event, src, dest) => {
  try {
    await fsp.rename(src, dest);
    return { success: true };
  } catch (e) {
    // 跨盘符时 rename 可能失败，回退到复制+删除
    try {
      await copyDirRecursive(src, dest);
      await fsp.rm(src, { recursive: true, force: true });
      return { success: true };
    } catch (e2) {
      return { success: false, error: e2.message };
    }
  }
});
ipcMain.handle('fs:getCacheDir', () => cacheDir);
ipcMain.handle('fs:getOutputDir', () => outputDir);
ipcMain.handle('fs:setCacheDir', async (event, dir) => {
  cacheDir = dir;
  savePathsConfig();
  return { success: true };
});
ipcMain.handle('fs:setOutputDir', async (event, dir) => {
  outputDir = dir;
  savePathsConfig();
  return { success: true };
});

// ==================== IPC: 项目管理 ====================
const RECENT_FILE = () => path.join(app.getPath('userData'), 'recent-projects.json');

function readRecent() {
  try {
    if (fs.existsSync(RECENT_FILE())) {
      return JSON.parse(fs.readFileSync(RECENT_FILE(), 'utf-8'));
    }
  } catch {}
  return [];
}
function writeRecent(list) {
  try {
    fs.writeFileSync(RECENT_FILE(), JSON.stringify(list.slice(0, 20)), 'utf-8');
  } catch {}
}

ipcMain.handle('project:new', async () => {
  return { success: true };
});
ipcMain.handle('project:open', async () => {
  if (!mainWindow) return { success: false, error: '无可用窗口' };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开项目',
    filters: [{ name: 'AICG 项目', extensions: ['aicg', 'json'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) {
    return { success: false, canceled: true };
  }
  const fp = result.filePaths[0];
  try {
    const data = await fsp.readFile(fp, 'utf-8');
    // 添加到最近打开
    const recent = readRecent().filter((p) => p !== fp);
    recent.unshift(fp);
    writeRecent(recent);
    return { success: true, data, filePath: fp };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle('project:save', async (event, filePath, data) => {
  try {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, data, 'utf-8');
    const recent = readRecent().filter((p) => p !== filePath);
    recent.unshift(filePath);
    writeRecent(recent);
    return { success: true, filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle('project:saveAs', async (event, data) => {
  if (!mainWindow) return { success: false, error: '无可用窗口' };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存项目',
    filters: [{ name: 'AICG 项目', extensions: ['aicg'] }],
  });
  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }
  try {
    await fsp.mkdir(path.dirname(result.filePath), { recursive: true });
    await fsp.writeFile(result.filePath, data, 'utf-8');
    const recent = readRecent().filter((p) => p !== result.filePath);
    recent.unshift(result.filePath);
    writeRecent(recent);
    return { success: true, filePath: result.filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle('project:getRecent', () => readRecent());
ipcMain.handle('project:addRecent', (event, filePath) => {
  const recent = readRecent().filter((p) => p !== filePath);
  recent.unshift(filePath);
  writeRecent(recent);
  return { success: true };
});

// ==================== IPC: 智能编辑（FFmpeg） ====================
function findFfmpeg() {
  // 优先使用打包内的 ffmpeg
  const candidates = [
    path.join(process.resourcesPath || '', 'ffmpeg', 'ffmpeg.exe'),
    path.join(__dirname, 'ffmpeg', 'ffmpeg.exe'),
    'ffmpeg',
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return 'ffmpeg';
}

ipcMain.handle('smartEdit:analyzeAudio', async (event, filePath, options) => {
  try {
    const ffmpeg = findFfmpeg();
    // 使用 silencedetect 检测静音段
    const args = [
      '-i', filePath,
      '-af', `silencedetect=noise=${(options?.silenceThreshold || -40)}dB:d=${(options?.minSilenceDuration || 0.5)}`,
      '-f', 'null', '-',
    ];
    const result = await runProcess(ffmpeg, args);
    // 解析 stderr 中的静音段
    const segments = [];
    const regex = /silence_start: ([\d.]+).*?silence_end: ([\d.]+).*?silence_duration: ([\d.]+)/g;
    let match;
    while ((match = regex.exec(result.stderr)) !== null) {
      segments.push({
        id: `seg-${segments.length}`,
        startTime: parseFloat(match[1]),
        endTime: parseFloat(match[2]),
        duration: parseFloat(match[3]),
        type: 'silence',
        action: 'remove',
        confidence: 0.9,
      });
    }
    return { success: true, silenceSegments: segments };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('smartEdit:applyEdits', async (event, inputPath, outputPath, operations) => {
  try {
    const ffmpeg = findFfmpeg();
    const args = ['-i', inputPath];
    // 简化实现：仅处理速度调整
    if (operations.speed && operations.speed !== 1) {
      args.push('-filter:a', `atempo=${operations.speed}`);
    }
    args.push('-y', outputPath);
    await runProcess(ffmpeg, args);
    return { success: true, outputPath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('smartEdit:checkFfmpeg', async () => {
  try {
    const ffmpeg = findFfmpeg();
    const result = await runProcess(ffmpeg, ['-version']);
    const versionMatch = result.stderr.match(/ffmpeg version ([\d.]+)/);
    return { available: true, version: versionMatch ? versionMatch[1] : 'unknown' };
  } catch {
    return { available: false };
  }
});

function runProcess(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`进程退出码 ${code}: ${stderr}`));
    });
    proc.on('error', reject);
  });
}

// ==================== IPC: 渲染导出 ====================
ipcMain.handle('render:exportVideo', async (event, options) => {
  try {
    const ffmpeg = findFfmpeg();
    const { inputFiles, outputDir, outputFileName, resolution, fps, bitrate, codec, format, audioCodec, audioBitrate } = options;
    await ensureDir(outputDir);
    const outputPath = path.join(outputDir, outputFileName);

    // 简化实现：单文件转码
    if (inputFiles.length === 1) {
      const args = ['-i', inputFiles[0].path];
      args.push('-s', `${resolution.width}x${resolution.height}`);
      args.push('-r', String(fps));
      args.push('-b:v', String(bitrate));
      args.push('-c:v', codec || 'libx264');
      if (audioCodec) args.push('-c:a', audioCodec);
      if (audioBitrate) args.push('-b:a', String(audioBitrate));
      args.push('-y', outputPath);
      await runProcess(ffmpeg, args);
      return { success: true, outputPath };
    }

    // 多文件：使用 concat
    const listFile = path.join(outputDir, '.concat-list.txt');
    const listContent = inputFiles.map((f) => `file '${f.path.replace(/'/g, "'\\''")}'`).join('\n');
    await fsp.writeFile(listFile, listContent, 'utf-8');
    const args = ['-f', 'concat', '-safe', '0', '-i', listFile];
    args.push('-s', `${resolution.width}x${resolution.height}`);
    args.push('-r', String(fps));
    args.push('-b:v', String(bitrate));
    args.push('-c:v', codec || 'libx264');
    if (audioCodec) args.push('-c:a', audioCodec);
    if (audioBitrate) args.push('-b:a', String(audioBitrate));
    args.push('-y', outputPath);
    await runProcess(ffmpeg, args);
    await fsp.unlink(listFile).catch(() => {});
    return { success: true, outputPath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('render:checkEnvironment', async () => {
  try {
    const ffmpeg = findFfmpeg();
    const result = await runProcess(ffmpeg, ['-version']);
    const versionMatch = result.stderr.match(/ffmpeg version ([\d.]+)/);
    await ensureDir(outputDir);
    let writable = false;
    try {
      const testFile = path.join(outputDir, '.write-test');
      await fsp.writeFile(testFile, 'test');
      await fsp.unlink(testFile);
      writable = true;
    } catch {}
    return {
      ffmpeg: { available: true, version: versionMatch ? versionMatch[1] : 'unknown' },
      outputDir,
      outputDirWritable: writable,
    };
  } catch {
    return {
      ffmpeg: { available: false },
      outputDir,
      outputDirWritable: false,
    };
  }
});

// ==================== IPC: 自动更新 ====================
ipcMain.handle('updater:check', async () => {
  if (!autoUpdater) return { available: false, error: '自动更新未启用' };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { available: !!result?.updateInfo, version: result?.updateInfo?.version };
  } catch (e) {
    return { available: false, error: e.message };
  }
});

ipcMain.handle('updater:download', async () => {
  if (!autoUpdater) return { success: false, error: '自动更新未启用' };
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('updater:install', async () => {
  if (!autoUpdater) return { success: false, error: '自动更新未启用' };
  try {
    autoUpdater.quitAndInstall();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('updater:getInfo', async () => {
  if (!autoUpdater) return null;
  try {
    const info = autoUpdater.currentVersion;
    return { version: APP_DISPLAY_VERSION, buildVersion: info?.version || app.getVersion() };
  } catch {
    return { version: APP_DISPLAY_VERSION, buildVersion: app.getVersion() };
  }
});

// ==================== 应用生命周期 ====================
app.whenReady().then(() => {
  loadPathsConfig();
  ensureDir(cacheDir);
  ensureDir(outputDir);
  setupAutoUpdater();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // 退出前保存配置
  savePathsConfig();
});

// 安全：阻止网页导航到外部
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (!isDev || parsedUrl.origin !== DEV_SERVER_URL) {
      event.preventDefault();
    }
  });
});
