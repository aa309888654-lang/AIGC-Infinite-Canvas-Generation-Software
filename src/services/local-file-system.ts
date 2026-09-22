import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeFile, mkdir} from '@tauri-apps/plugin-fs';
import { enhancedDragDropManager } from './tauri-drag-drop';

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: number;
  children?: FileEntry[];
}

export interface LocalFileInfo {
  name: string;
  path: string;
  type: 'image' | 'video' | 'other';
  size: number;
  modified: Date;
  thumbnailUrl?: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    format?: string;
  };
}

class LocalFileSystem {
  private static instance: LocalFileSystem;
  private currentDirectory: string = '';
  private favorites: string[] = [];

  static getInstance(): LocalFileSystem {
    if (!LocalFileSystem.instance) {
      LocalFileSystem.instance = new LocalFileSystem();
    }
    return LocalFileSystem.instance;
  }

  // 获取用户主目录
  async getHomeDirectory(): Promise<string> {
    try {
      return await invoke('get_home_directory');
    } catch (error) {
      console.error('获取主目录失败:', error);
      return '';
    }
  }

  // 选择目录
  async selectDirectory(): Promise<string | null> {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择文件夹',
      });
      
      if (selected && typeof selected === 'string') {
        this.currentDirectory = selected;
        return selected;
      }
      return null;
    } catch (error) {
      console.error('选择目录失败:', error);
      return null;
    }
  }

  // 选择文件
  async selectFiles(filter?: string[]): Promise<string[] | null> {
    try {
      const selected = await open({
        directory: false,
        multiple: true,
        title: '选择文件',
        filters: filter ? [{ name: '文件', extensions: filter }] : undefined,
      });
      
      if (Array.isArray(selected)) {
        return selected;
      } else if (typeof selected === 'string') {
        return [selected];
      }
      return null;
    } catch (error) {
      console.error('选择文件失败:', error);
      return null;
    }
  }

  // 读取目录内容
  async readDirectory(dirPath: string): Promise<FileEntry[]> {
    try {
      const entries = await invoke('read_directory', { path: dirPath }) as FileEntry[];
      return entries;
    } catch (error) {
      console.error('读取目录失败:', error);
      return [];
    }
  }

  // 获取支持的媒体文件
  async getMediaFiles(dirPath: string): Promise<LocalFileInfo[]> {
    try {
      const entries = await this.readDirectory(dirPath);
      const mediaFiles: LocalFileInfo[] = [];
      
      for (const entry of entries) {
        if (entry.type === 'file' && this.isSupportedMediaFile(entry.name)) {
          const fileInfo = await this.getFileInfo(entry.path);
          if (fileInfo && (fileInfo.type === 'image' || fileInfo.type === 'video')) {
            mediaFiles.push({
              name: entry.name,
              path: entry.path,
              type: fileInfo.type,
              size: fileInfo.size,
              modified: new Date(fileInfo.modified || 0),
              metadata: fileInfo.metadata,
            });
          }
        }
      }
      
      return mediaFiles;
    } catch (error) {
      console.error('获取媒体文件失败:', error);
      return [];
    }
  }

  // 获取文件信息
  async getFileInfo(filePath: string): Promise<LocalFileInfo | null> {
    try {
      const fileInfo = await invoke('get_file_info', { path: filePath }) as any;
      
      if (fileInfo) {
        return {
          name: fileInfo.name,
          path: filePath,
          type: fileInfo.type || 'other',
          size: fileInfo.size || 0,
          modified: new Date(fileInfo.modified || 0),
          metadata: fileInfo.metadata,
        };
      }
      return null;
    } catch (error) {
      console.error('获取文件信息失败:', error);
      return null;
    }
  }

  // 检查是否为支持的媒体文件
  private isSupportedMediaFile(fileName: string): boolean {
    const extensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg',
      '.mp4', '.webm', '.mov', '.avi', '.mkv', '.wmv'
    ];
    
    return extensions.some(ext => fileName.toLowerCase().endsWith(ext));
  }

  // 从本地文件创建节点（批量）
  async createNodesFromLocalFiles(filePaths: string[], position: { x: number; y: number }) {
    try {
      const imageFiles: LocalFileInfo[] = [];
      const videoFiles: LocalFileInfo[] = [];
      
      // 分类文件
      for (const filePath of filePaths) {
        const fileInfo = await this.getFileInfo(filePath);
        if (fileInfo) {
          if (fileInfo.type === 'image') {
            imageFiles.push(fileInfo);
          } else if (fileInfo.type === 'video') {
            videoFiles.push(fileInfo);
          }
        }
      }
      
      // 使用拖放管理器处理并创建节点
      return await enhancedDragDropManager.processCanvasDropFiles(
        filePaths.map(path => new File([], path)) as any, 
        position
      );
    } catch (error) {
      console.error('从本地文件创建节点失败:', error);
      return [];
    }
  }

  // 保存文件到本地
  async saveFile(fileName: string, data: Uint8Array): Promise<string | null> {
    try {
      const savePath = await save({
        defaultPath: fileName,
        filters: [{ name: '文件', extensions: [fileName.split('.').pop() || ''] }],
      });
      
      if (savePath) {
        await writeFile(savePath, data);
        return savePath;
      }
      return null;
    } catch (error) {
      console.error('保存文件失败:', error);
      return null;
    }
  }

  // 创建文件夹
  async createDirectory(dirPath: string): Promise<boolean> {
    try {
      await mkdir(dirPath, { recursive: true });
      return true;
    } catch (error) {
      console.error('创建目录失败:', error);
      return false;
    }
  }

  // 获取收藏夹
  getFavorites(): string[] {
    return [...this.favorites];
  }

  // 添加到收藏夹
  addToFavorites(path: string): void {
    if (!this.favorites.includes(path)) {
      this.favorites.push(path);
    }
  }

  // 从收藏夹移除
  removeFromFavorites(path: string): void {
    this.favorites = this.favorites.filter(fav => fav !== path);
  }

  // 获取最近使用的目录
  async getRecentDirectories(): Promise<string[]> {
    try {
      const recent = await invoke('get_recent_directories');
      return Array.isArray(recent) ? recent : [];
    } catch (error) {
      console.error('获取最近目录失败:', error);
      return [];
    }
  }

  // 重命名文件
  async renameFile(oldPath: string, newName: string): Promise<string> {
    try {
      return await invoke('rename_file', { oldPath, newName });
    } catch (error) {
      console.error('重命名文件失败:', error);
      throw error;
    }
  }

  // 读取文件为Base64
  async readFileAsBase64(filePath: string): Promise<string | null> {
    try {
      const data = await invoke('read_file', { path: filePath }) as number[];
      const bytes = new Uint8Array(data);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      let mimeType = 'application/octet-stream';
      if (['jpg', 'jpeg'].includes(ext)) mimeType = 'image/jpeg';
      else if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'gif') mimeType = 'image/gif';
      else if (ext === 'webp') mimeType = 'image/webp';
      else if (ext === 'bmp') mimeType = 'image/bmp';
      else if (ext === 'mp4') mimeType = 'video/mp4';
      else if (ext === 'webm') mimeType = 'video/webm';
      else if (ext === 'mov') mimeType = 'video/quicktime';
      else if (ext === 'avi') mimeType = 'video/x-msvideo';
      
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error('读取文件为Base64失败:', error);
      return null;
    }
  }
}

export const localFileSystem = LocalFileSystem.getInstance();

// 文件系统事件类型
export interface FileSystemEvent {
  type: 'fileAdded' | 'fileRemoved' | 'directoryChanged';
  path: string;
  timestamp: number;
}

// 文件系统监视器
export class FileSystemWatcher {
  private watchers = new Map<string, () => void>();
  private callbacks: ((event: FileSystemEvent) => void)[] = [];

  // 监视目录
  async watchDirectory(dirPath: string): Promise<void> {
    if (this.watchers.has(dirPath)) {
      return;
    }

    try {
      // 在Tauri中实现目录监视
      const unwatch = await invoke('watch_directory', { path: dirPath });
      this.watchers.set(dirPath, unwatch as () => void);
    } catch (error) {
      console.error('监视目录失败:', error);
    }
  }

  // 停止监视
  unwatchDirectory(dirPath: string): void {
    const unwatch = this.watchers.get(dirPath);
    if (unwatch) {
      unwatch();
      this.watchers.delete(dirPath);
    }
  }

  // 添加事件监听器
  addListener(callback: (event: FileSystemEvent) => void): void {
    this.callbacks.push(callback);
  }

  // 移除事件监听器
  removeListener(callback: (event: FileSystemEvent) => void): void {
    this.callbacks = this.callbacks.filter(cb => cb !== callback);
  }

  // 触发事件
  private emit(event: FileSystemEvent): void {
    this.callbacks.forEach(callback => callback(event));
  }
}

export const fileSystemWatcher = new FileSystemWatcher();
