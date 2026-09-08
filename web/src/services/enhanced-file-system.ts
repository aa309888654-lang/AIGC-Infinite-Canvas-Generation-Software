import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// ==================== 类型定义 ====================

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: number;
  depth?: number;
  parent?: string;
  url?: string;
  thumbnail?: string;
}

export interface FileSystemEvent {
  type: 'created' | 'modified' | 'removed' | 'other';
  paths: string[];
  watchPath: string;
  timestamp: number;
}

export interface CacheStats {
  size: number;
  capacity: number;
  hitRate: number;
}

// ==================== 增强文件系统服务 ====================

class EnhancedFileSystem {
  private static instance: EnhancedFileSystem;
  private watchListeners: Map<string, (event: FileSystemEvent) => void> = new Map();
  private activeWatchers: Map<string, string> = new Map(); // path -> watchId

  static getInstance(): EnhancedFileSystem {
    if (!EnhancedFileSystem.instance) {
      EnhancedFileSystem.instance = new EnhancedFileSystem();
    }
    return EnhancedFileSystem.instance;
  }

  private constructor() {
    this.initializeEventListener();
  }

  // 初始化文件系统事件监听
  private async initializeEventListener() {
    try {
      await listen<FileSystemEvent>('file-system-event', (event) => {
        const data = event.payload;
        
        // 通知所有监听该路径的回调
        this.watchListeners.forEach((callback, path) => {
          if (data.watchPath === path) {
            callback(data);
          }
        });
      });
    } catch (error) {
      console.error('初始化文件系统事件监听失败:', error);
    }
  }

  // ==================== 1. 递归目录扫描 ====================

  /**
   * 递归读取目录内容
   * @param path 目录路径
   * @param maxDepth 最大递归深度（默认10）
   * @param includeHidden 是否包含隐藏文件（默认false）
   */
  async readDirectoryRecursive(
    path: string,
    maxDepth: number = 10,
    includeHidden: boolean = false
  ): Promise<FileEntry[]> {
    try {
      const entries = await invoke<FileEntry[]>('read_directory_recursive', {
        path,
        maxDepth,
        includeHidden,
      });
      return entries;
    } catch (error) {
      console.error('递归读取目录失败:', error);
      throw error;
    }
  }

  /**
   * 获取目录树结构
   * @param path 根目录路径
   * @param maxDepth 最大深度
   */
  async getDirectoryTree(path: string, maxDepth: number = 3): Promise<FileEntry[]> {
    const entries = await this.readDirectoryRecursive(path, maxDepth, false);
    
    // 构建树形结构
    const tree: FileEntry[] = [];
    const map = new Map<string, FileEntry & { children?: FileEntry[] }>();
    
    // 第一遍：创建所有节点
    entries.forEach(entry => {
      map.set(entry.path, { ...entry, children: [] });
    });
    
    // 第二遍：建立父子关系
    entries.forEach(entry => {
      const node = map.get(entry.path);
      if (!node) return;
      
      if (entry.parent && entry.parent !== path) {
        const parent = map.get(entry.parent);
        if (parent && parent.children) {
          parent.children.push(node);
        }
      } else {
        tree.push(node);
      }
    });
    
    return tree;
  }

  /**
   * 搜索文件
   * @param rootPath 搜索根目录
   * @param pattern 搜索模式（支持通配符）
   * @param maxDepth 最大深度
   */
  async searchFiles(
    rootPath: string,
    pattern: string,
    maxDepth: number = 10
  ): Promise<FileEntry[]> {
    const entries = await this.readDirectoryRecursive(rootPath, maxDepth, false);
    
    const regex = new RegExp(
      pattern.replace(/\*/g, '.*').replace(/\?/g, '.'),
      'i'
    );
    
    return entries.filter(entry => 
      entry.type === 'file' && regex.test(entry.name)
    );
  }

  // ==================== 2. 文件监视功能 ====================

  /**
   * 监视目录变化
   * @param path 目录路径
   * @param recursive 是否递归监视子目录
   * @param callback 变化回调函数
   */
  async watchDirectory(
    path: string,
    recursive: boolean = true,
    callback: (event: FileSystemEvent) => void
  ): Promise<string> {
    try {
      const watchId = await invoke<string>('watch_directory', {
        path,
        recursive,
      });
      
      this.activeWatchers.set(path, watchId);
      this.watchListeners.set(path, callback);
      
      return watchId;
    } catch (error) {
      console.error('启动文件监视失败:', error);
      throw error;
    }
  }

  /**
   * 停止监视目录
   * @param path 目录路径或监视ID
   */
  async unwatchDirectory(path: string): Promise<boolean> {
    try {
      // 如果是路径，获取对应的watchId
      let watchId = path;
      if (this.activeWatchers.has(path)) {
        watchId = this.activeWatchers.get(path)!;
        this.activeWatchers.delete(path);
        this.watchListeners.delete(path);
      }
      
      const result = await invoke<boolean>('unwatch_directory', {
        watchId,
      });
      
      return result;
    } catch (error) {
      console.error('停止文件监视失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有活动的监视器
   */
  getActiveWatchers(): string[] {
    return Array.from(this.activeWatchers.keys());
  }

  /**
   * 停止所有监视器
   */
  async unwatchAll(): Promise<void> {
    const paths = Array.from(this.activeWatchers.keys());
    await Promise.all(paths.map(path => this.unwatchDirectory(path)));
  }

  // ==================== 3. 文件预览缓存 ====================

  /**
   * 生成文件缩略图
   * @param filePath 文件路径
   * @param maxWidth 最大宽度（默认200）
   * @param maxHeight 最大高度（默认200）
   */
  async generateThumbnail(
    filePath: string,
    maxWidth: number = 200,
    maxHeight: number = 200
  ): Promise<string> {
    try {
      const thumbnail = await invoke<string>('generate_thumbnail', {
        filePath,
        maxWidth,
        maxHeight,
      });
      return thumbnail;
    } catch (error) {
      console.error('生成缩略图失败:', error);
      throw error;
    }
  }

  /**
   * 批量生成缩略图
   * @param filePaths 文件路径数组
   * @param maxWidth 最大宽度
   * @param maxHeight 最大高度
   */
  async generateThumbnails(
    filePaths: string[],
    maxWidth: number = 200,
    maxHeight: number = 200
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    await Promise.all(
      filePaths.map(async (path) => {
        try {
          const thumbnail = await this.generateThumbnail(path, maxWidth, maxHeight);
          results.set(path, thumbnail);
        } catch (error) {
          console.error(`生成缩略图失败 ${path}:`, error);
        }
      })
    );
    
    return results;
  }

  /**
   * 清除缩略图缓存
   */
  async clearThumbnailCache(): Promise<number> {
    try {
      const count = await invoke<number>('clear_thumbnail_cache');
      return count;
    } catch (error) {
      console.error('清除缩略图缓存失败:', error);
      throw error;
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<CacheStats> {
    try {
      const stats = await invoke<CacheStats>('get_cache_stats');
      return stats;
    } catch (error) {
      console.error('获取缓存统计失败:', error);
      throw error;
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取目录大小（递归计算）
   * @param path 目录路径
   */
  async getDirectorySize(path: string): Promise<number> {
    const entries = await this.readDirectoryRecursive(path, 100, false);
    return entries
      .filter(e => e.type === 'file')
      .reduce((sum, e) => sum + (e.size || 0), 0);
  }

  /**
   * 获取文件数量统计
   * @param path 目录路径
   */
  async getFileStats(path: string): Promise<{
    totalFiles: number;
    totalDirs: number;
    totalSize: number;
    filesByType: Map<string, number>;
  }> {
    const entries = await this.readDirectoryRecursive(path, 100, false);
    
    const stats = {
      totalFiles: 0,
      totalDirs: 0,
      totalSize: 0,
      filesByType: new Map<string, number>(),
    };
    
    entries.forEach(entry => {
      if (entry.type === 'file') {
        stats.totalFiles++;
        stats.totalSize += entry.size || 0;
        
        const ext = entry.name.split('.').pop()?.toLowerCase() || 'unknown';
        stats.filesByType.set(ext, (stats.filesByType.get(ext) || 0) + 1);
      } else {
        stats.totalDirs++;
      }
    });
    
    return stats;
  }
}

// 导出单例
export const enhancedFileSystem = EnhancedFileSystem.getInstance();

// 导出便捷函数
export const {
  readDirectoryRecursive,
  getDirectoryTree,
  searchFiles,
  watchDirectory,
  unwatchDirectory,
  generateThumbnail,
  generateThumbnails,
  clearThumbnailCache,
  getCacheStats,
  getDirectorySize,
  getFileStats,
} = enhancedFileSystem;
