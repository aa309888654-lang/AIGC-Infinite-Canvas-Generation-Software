import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile, mkdir, exists, BaseDirectory, readDir, remove, copyFile, stat } from '@tauri-apps/plugin-fs';
import { generateId } from '@/lib/utils';

// ==================== 类型定义 ====================

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

// 项目工作空间
export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
  createdAt: Date;
  lastOpened: Date;
  thumbnail?: string;
  nodeCount: number;
}

// 收藏夹书签
export interface Bookmark {
  id: string;
  name: string;
  path: string;
  icon?: string;
  color?: string;
  order: number;
  createdAt: Date;
}

// 历史记录项
export interface HistoryItem {
  id: string;
  type: 'file' | 'directory' | 'project';
  name: string;
  path: string;
  timestamp: Date;
  thumbnail?: string;
}

// 缓存配置
export interface CacheConfig {
  maxSize: number; // MB
  maxAge: number; // 天数
  autoCleanup: boolean;
  cleanupThreshold: number; // 百分比
}

// 搜索选项
export interface SearchOptions {
  query: string;
  type?: 'image' | 'video' | 'all';
  dateFrom?: Date;
  dateTo?: Date;
  sortBy: 'name' | 'date' | 'size';
  sortOrder: 'asc' | 'desc';
}

// ==================== 增强版本地文件系统 ====================

class ProfessionalFileSystem {
  private static instance: ProfessionalFileSystem;
  
  // 项目管理
  private projects: Project[] = [];
  private currentProject: Project | null = null;
  
  // 收藏夹
  private bookmarks: Bookmark[] = [];
  
  // 历史记录
  private history: HistoryItem[] = [];
  private maxHistorySize = 100;
  
  // 缓存配置
  private cacheConfig: CacheConfig = {
    maxSize: 500, // 500MB
    maxAge: 30, // 30天
    autoCleanup: true,
    cleanupThreshold: 90 // 90%
  };
  
  // 缓存目录
  private cacheDir = '.cache';
  
  static getInstance(): ProfessionalFileSystem {
    if (!ProfessionalFileSystem.instance) {
      ProfessionalFileSystem.instance = new ProfessionalFileSystem();
    }
    return ProfessionalFileSystem.instance;
  }

  private constructor() {
    this.loadFromStorage();
  }

  // ==================== 存储管理 ====================
  
  private async loadFromStorage() {
    try {
      const projectsJson = localStorage.getItem('fs_projects');
      const bookmarksJson = localStorage.getItem('fs_bookmarks');
      const historyJson = localStorage.getItem('fs_history');
      const cacheConfigJson = localStorage.getItem('fs_cache_config');
      
      if (projectsJson) this.projects = JSON.parse(projectsJson);
      if (bookmarksJson) this.bookmarks = JSON.parse(bookmarksJson);
      if (historyJson) this.history = JSON.parse(historyJson);
      if (cacheConfigJson) this.cacheConfig = JSON.parse(cacheConfigJson);
    } catch (error) {
      console.error('加载存储失败:', error);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem('fs_projects', JSON.stringify(this.projects));
      localStorage.setItem('fs_bookmarks', JSON.stringify(this.bookmarks));
      localStorage.setItem('fs_history', JSON.stringify(this.history));
      localStorage.setItem('fs_cache_config', JSON.stringify(this.cacheConfig));
    } catch (error) {
      console.error('保存存储失败:', error);
    }
  }

  // ==================== 项目管理 ====================
  
  // 创建项目
  async createProject(name: string, path: string, description?: string): Promise<Project> {
    const project: Project = {
      id: generateId(),
      name,
      path,
      description,
      createdAt: new Date(),
      lastOpened: new Date(),
      nodeCount: 0
    };
    
    this.projects.push(project);
    this.currentProject = project;
    this.saveToStorage();
    
    // 添加到历史
    this.addToHistory({
      type: 'project',
      name: project.name,
      path: project.path,
      timestamp: new Date()
    });
    
    return project;
  }

  // 打开项目
  async openProject(projectId: string): Promise<Project | null> {
    const project = this.projects.find(p => p.id === projectId);
    if (project) {
      project.lastOpened = new Date();
      this.currentProject = project;
      this.saveToStorage();
      
      this.addToHistory({
        type: 'project',
        name: project.name,
        path: project.path,
        timestamp: new Date()
      });
      
      return project;
    }
    return null;
  }

  // 选择项目目录
  async selectProjectDirectory(): Promise<string | null> {
    return this.selectDirectory('选择项目目录');
  }

  // 获取所有项目
  getProjects(): Project[] {
    return [...this.projects].sort((a, b) => 
      b.lastOpened.getTime() - a.lastOpened.getTime()
    );
  }

  // 删除项目
  deleteProject(projectId: string): void {
    this.projects = this.projects.filter(p => p.id !== projectId);
    if (this.currentProject?.id === projectId) {
      this.currentProject = null;
    }
    this.saveToStorage();
  }

  // 获取当前项目
  getCurrentProject(): Project | null {
    return this.currentProject;
  }

  // ==================== 收藏夹管理 ====================
  
  // 添加收藏夹
  addBookmark(name: string, path: string, icon?: string, color?: string): Bookmark {
    const bookmark: Bookmark = {
      id: generateId(),
      name,
      path,
      icon,
      color,
      order: this.bookmarks.length,
      createdAt: new Date()
    };
    
    this.bookmarks.push(bookmark);
    this.saveToStorage();
    return bookmark;
  }

  // 移除收藏夹
  removeBookmark(bookmarkId: string): void {
    this.bookmarks = this.bookmarks.filter(b => b.id !== bookmarkId);
    this.reorderBookmarks();
    this.saveToStorage();
  }

  // 更新收藏夹
  updateBookmark(bookmarkId: string, updates: Partial<Bookmark>): void {
    const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
    if (bookmark) {
      Object.assign(bookmark, updates);
      this.saveToStorage();
    }
  }

  // 排序收藏夹
  private reorderBookmarks() {
    this.bookmarks.forEach((b, index) => {
      b.order = index;
    });
  }

  // 获取所有收藏夹
  getBookmarks(): Bookmark[] {
    return [...this.bookmarks].sort((a, b) => a.order - b.order);
  }

  // 移动收藏夹
  moveBookmark(bookmarkId: string, newOrder: number): void {
    const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
    if (bookmark) {
      const oldOrder = bookmark.order;
      this.bookmarks.forEach(b => {
        if (b.id === bookmarkId) {
          b.order = newOrder;
        } else if (b.order >= newOrder && b.order < oldOrder) {
          b.order++;
        } else if (b.order <= newOrder && b.order > oldOrder) {
          b.order--;
        }
      });
      this.saveToStorage();
    }
  }

  // ==================== 历史记录 ====================
  
  // 添加到历史
  addToHistory(item: Omit<HistoryItem, 'id'>): void {
    const historyItem: HistoryItem = {
      ...item,
      id: generateId()
    };
    
    // 避免重复
    const existingIndex = this.history.findIndex(
      h => h.path === item.path && h.type === item.type
    );
    
    if (existingIndex !== -1) {
      this.history.splice(existingIndex, 1);
    }
    
    this.history.unshift(historyItem);
    
    // 限制历史大小
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }
    
    this.saveToStorage();
  }

  // 清空历史
  clearHistory(): void {
    this.history = [];
    this.saveToStorage();
  }

  // 获取历史记录
  getHistory(type?: 'file' | 'directory' | 'project'): HistoryItem[] {
    if (type) {
      return this.history.filter(h => h.type === type);
    }
    return [...this.history];
  }

  // 获取最近文件
  getRecentFiles(limit = 10): HistoryItem[] {
    return this.history
      .filter(h => h.type === 'file')
      .slice(0, limit);
  }

  // 获取最近目录
  getRecentDirectories(limit = 10): HistoryItem[] {
    return this.history
      .filter(h => h.type === 'directory')
      .slice(0, limit);
  }

  // ==================== 搜索功能 ====================
  
  // 搜索文件
  async search(options: SearchOptions): Promise<LocalFileInfo[]> {
    const { query, type, dateFrom, dateTo, sortBy, sortOrder } = options;
    const results: LocalFileInfo[] = [];
    
    // 搜索项目目录
    for (const project of this.projects) {
      const files = await this.getMediaFiles(project.path);
      results.push(...files);
    }
    
    // 过滤结果
    const filtered = results.filter(file => {
      // 名称搜索
      if (query) {
        const lowerQuery = query.toLowerCase();
        if (!file.name.toLowerCase().includes(lowerQuery)) {
          return false;
        }
      }
      
      // 类型过滤
      if (type && type !== 'all' && file.type !== type) {
        return false;
      }
      
      // 日期过滤
      if (dateFrom && file.modified < dateFrom) {
        return false;
      }
      if (dateTo && file.modified > dateTo) {
        return false;
      }
      
      return true;
    });
    
    // 排序
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = a.modified.getTime() - b.modified.getTime();
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }

  // 模糊搜索
  fuzzySearch(query: string, items: LocalFileInfo[]): LocalFileInfo[] {
    const lowerQuery = query.toLowerCase();
    
    return items.filter(item => {
      // 简单匹配
      if (item.name.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      
      // 模糊匹配 (允许拼写错误)
      const name = item.name.toLowerCase();
      let queryIndex = 0;
      
      for (let i = 0; i < name.length && queryIndex < lowerQuery.length; i++) {
        if (name[i] === lowerQuery[queryIndex]) {
          queryIndex++;
        }
      }
      
      return queryIndex === lowerQuery.length;
    });
  }

  // ==================== 缓存管理 ====================
  
  // 获取缓存配置
  getCacheConfig(): CacheConfig {
    return { ...this.cacheConfig };
  }

  // 更新缓存配置
  updateCacheConfig(config: Partial<CacheConfig>): void {
    this.cacheConfig = { ...this.cacheConfig, ...config };
    this.saveToStorage();
  }

  // 获取缓存大小
  async getCacheSize(): Promise<number> {
    try {
      const cachePath = this.cacheDir;
      const cacheExists = await exists(cachePath, { baseDir: BaseDirectory.AppData });
      
      if (!cacheExists) {
        return 0;
      }
      
      let totalSize = 0;
      const entries = await readDir(cachePath, { baseDir: BaseDirectory.AppData });
      
      for (const entry of entries) {
        if (entry.isFile) {
          const fileStat = await stat(entry.name, { baseDir: BaseDirectory.AppData });
          totalSize += fileStat.size;
        }
      }
      
      return totalSize / (1024 * 1024); // MB
    } catch (error) {
      console.error('获取缓存大小失败:', error);
      return 0;
    }
  }

  // 清理过期缓存
  async cleanupExpiredCache(): Promise<number> {
    try {
      const cachePath = this.cacheDir;
      const cacheExists = await exists(cachePath, { baseDir: BaseDirectory.AppData });
      
      if (!cacheExists) {
        return 0;
      }
      
      let cleanedCount = 0;
      const entries = await readDir(cachePath, { baseDir: BaseDirectory.AppData });
      const maxAge = this.cacheConfig.maxAge * 24 * 60 * 60 * 1000; // 毫秒
      const now = Date.now();
      
      for (const entry of entries) {
        if (entry.isFile) {
          try {
            const fileStat = await stat(entry.name, { baseDir: BaseDirectory.AppData });
            const fileAge = now - (fileStat.mtime?.getTime() || 0);
            
            if (fileAge > maxAge) {
              const filePath = `${cachePath}/${entry.name}`;
              await remove(filePath, { baseDir: BaseDirectory.AppData });
              cleanedCount++;
            }
          } catch (error) {
            console.error(`检查文件失败: ${entry.name}`, error);
          }
        }
      }
      
      return cleanedCount;
    } catch (error) {
      console.error('清理缓存失败:', error);
      return 0;
    }
  }

  // 清理所有缓存
  async clearAllCache(): Promise<void> {
    try {
      const cachePath = this.cacheDir;
      const cacheExists = await exists(cachePath, { baseDir: BaseDirectory.AppData });
      
      if (cacheExists) {
        await remove(cachePath, { baseDir: BaseDirectory.AppData, recursive: true });
      }
      
      // 重新创建缓存目录
      await mkdir(cachePath, { baseDir: BaseDirectory.AppData, recursive: true });
    } catch (error) {
      console.error('清空缓存失败:', error);
    }
  }

  // 自动检查并清理缓存
  async autoCleanupIfNeeded(): Promise<void> {
    if (!this.cacheConfig.autoCleanup) {
      return;
    }
    
    const currentSize = await this.getCacheSize();
    const usagePercent = (currentSize / this.cacheConfig.maxSize) * 100;
    
    if (usagePercent >= this.cacheConfig.cleanupThreshold) {
      await this.cleanupExpiredCache();
    }
  }

  // ==================== 文件操作 ====================
  
  // 选择目录
  async selectDirectory(title = '选择文件夹'): Promise<string | null> {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title,
      });
      
      if (selected && typeof selected === 'string') {
        this.addToHistory({
          type: 'directory',
          name: selected.split(/[/\\]/).pop() || selected,
          path: selected,
          timestamp: new Date()
        });
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

  // 读取目录
  async readDirectory(dirPath: string): Promise<FileEntry[]> {
    try {
      const entries = await invoke('read_directory', { path: dirPath }) as FileEntry[];
      return entries;
    } catch (error) {
      console.error('读取目录失败:', error);
      return [];
    }
  }

  // 获取媒体文件
  async getMediaFiles(dirPath: string): Promise<LocalFileInfo[]> {
    try {
      const entries = await this.readDirectory(dirPath);
      const mediaFiles: LocalFileInfo[] = [];
      
      for (const entry of entries) {
        if (entry.type === 'file' && this.isSupportedMediaFile(entry.name)) {
          const fileInfo = await this.getFileInfo(entry.path);
          if (fileInfo && (fileInfo.type === 'image' || fileInfo.type === 'video')) {
            mediaFiles.push(fileInfo);
            
            // 添加到历史
            this.addToHistory({
              type: 'file',
              name: entry.name,
              path: entry.path,
              timestamp: new Date()
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
          metadata: fileInfo.metadata
        };
      }
      return null;
    } catch (error) {
      console.error('获取文件信息失败:', error);
      return null;
    }
  }

  // 检查支持的媒体文件
  private isSupportedMediaFile(fileName: string): boolean {
    const extensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg',
      '.mp4', '.webm', '.mov', '.avi', '.mkv', '.wmv'
    ];
    return extensions.some(ext => fileName.toLowerCase().endsWith(ext));
  }

  // 生成缩略图
  async generateThumbnail(filePath: string, type: 'image' | 'video'): Promise<string | null> {
    try {
      const fileData = await readFile(filePath);
      const blob = new Blob([fileData], { 
        type: type === 'image' ? 'image/*' : 'video/*' 
      });
      
      if (type === 'image') {
        return URL.createObjectURL(blob);
      } else {
        // 视频：返回第一帧
        return new Promise((resolve) => {
          const video = document.createElement('video');
          video.src = URL.createObjectURL(blob);
          video.currentTime = 0.1;
          
          video.onloadeddata = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 160;
            canvas.height = 90;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
              resolve(thumbnailUrl);
            } else {
              resolve(null);
            }
          };
          
          video.onerror = () => resolve(null);
        });
      }
    } catch (error) {
      console.error('生成缩略图失败:', error);
      return null;
    }
  }

  // 保存文件
  async saveFile(fileName: string, data: Uint8Array): Promise<string | null> {
    try {
      const savePath = await save({
        defaultPath: fileName,
        filters: [{ name: '文件', extensions: [fileName.split('.').pop() || ''] }],
      });
      
      if (savePath) {
        await writeFile(savePath, data);
        
        this.addToHistory({
          type: 'file',
          name: fileName,
          path: savePath,
          timestamp: new Date()
        });
        
        return savePath;
      }
      return null;
    } catch (error) {
      console.error('保存文件失败:', error);
      return null;
    }
  }

  // 创建目录
  async createDirectory(dirPath: string): Promise<boolean> {
    try {
      await mkdir(dirPath, { recursive: true });
      return true;
    } catch (error) {
      console.error('创建目录失败:', error);
      return false;
    }
  }

  // 复制文件
  async copyFile(source: string, destination: string): Promise<boolean> {
    try {
      await copyFile(source, destination);
      return true;
    } catch (error) {
      console.error('复制文件失败:', error);
      return false;
    }
  }

  // 删除文件
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      await remove(filePath);
      return true;
    } catch (error) {
      console.error('删除文件失败:', error);
      return false;
    }
  }

  // ==================== 导入/导出 ====================
  
  // 导出项目
  async exportProject(projectId: string): Promise<string | null> {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return null;
    
    const exportData = {
      project,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    const data = new TextEncoder().encode(JSON.stringify(exportData, null, 2));
    
    return this.saveFile(`${project.name}.ifsp`, new Uint8Array(data));
  }

  // 导入项目
  async importProject(): Promise<Project | null> {
    const files = await this.selectFiles(['ifsp']);
    if (!files || files.length === 0) return null;
    
    try {
      const fileData = await readFile(files[0]);
      const content = new TextDecoder().decode(fileData);
      const importData = JSON.parse(content);
      
      if (importData.project) {
        const project: Project = {
          ...importData.project,
          id: generateId(), // 生成新ID
          createdAt: new Date(),
          lastOpened: new Date()
        };
        
        this.projects.push(project);
        this.saveToStorage();
        
        return project;
      }
      return null;
    } catch (error) {
      console.error('导入项目失败:', error);
      return null;
    }
  }

  // 批量导入文件
  async batchImport(): Promise<string[]> {
    const files = await this.selectFiles([
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp',
      'mp4', 'webm', 'mov', 'avi', 'mkv', 'wmv'
    ]);
    
    return files || [];
  }

  // 批量导出
  async batchExport(files: LocalFileInfo[], destinationDir: string): Promise<number> {
    let exportedCount = 0;
    
    for (const file of files) {
      try {
        const destPath = `${destinationDir}/${file.name}`;
        const fileData = await readFile(file.path);
        await writeFile(destPath, fileData);
        exportedCount++;
      } catch (error) {
        console.error(`导出文件失败: ${file.name}`, error);
      }
    }
    
    return exportedCount;
  }
}

// 导出单例
export const professionalFileSystem = ProfessionalFileSystem.getInstance();