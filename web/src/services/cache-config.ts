export interface CacheConfig {
  cacheDir: string;
  outputDir: string;
  maxCacheSizeMB: number;
  autoCleanDays: number;
}

export interface PathValidationResult {
  valid: boolean;
  exists: boolean;
  writable: boolean;
  error?: string;
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  cacheDir: '',
  outputDir: '',
  maxCacheSizeMB: 5120,
  autoCleanDays: 30,
};

export class CacheConfigService {
  private config: CacheConfig = { ...DEFAULT_CACHE_CONFIG };
  private configLoaded = false;

  async loadConfig(): Promise<CacheConfig> {
    if (this.configLoaded) return this.config;

    if (typeof window !== 'undefined' && (window as any).electronAPI?.fs) {
      try {
        const cacheDir = await (window as any).electronAPI.fs.getCacheDir();
        const outputDir = await (window as any).electronAPI.fs.getOutputDir();
        this.config.cacheDir = cacheDir || '';
        this.config.outputDir = outputDir || '';
      } catch { /* ignored */ }
    }

    try {
      const stored = localStorage.getItem('ai-clip-cache-config');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.config = { ...this.config, ...parsed };
      }
    } catch { /* ignored */ }

    this.configLoaded = true;
    return this.config;
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  async setCacheDir(dir: string): Promise<{ success: boolean; error?: string }> {
    const validation = await this.validatePath(dir);
    if (!validation.valid) {
      return { success: false, error: validation.error || '路径无效' };
    }

    const oldDir = this.config.cacheDir;
    this.config.cacheDir = dir;

    if (typeof window !== 'undefined' && (window as any).electronAPI?.fs) {
      const result = await (window as any).electronAPI.fs.setCacheDir(dir);
      if (!result.success) {
        this.config.cacheDir = oldDir;
        return { success: false, error: result.error || '设置缓存路径失败' };
      }
    }

    if (oldDir && oldDir !== dir) {
      await this.migrateCache(oldDir, dir);
    }

    this.saveToLocalStorage();
    return { success: true };
  }

  async setOutputDir(dir: string): Promise<{ success: boolean; error?: string }> {
    const validation = await this.validatePath(dir);
    if (!validation.valid) {
      return { success: false, error: validation.error || '路径无效' };
    }

    const oldDir = this.config.outputDir;
    this.config.outputDir = dir;

    if (typeof window !== 'undefined' && (window as any).electronAPI?.fs) {
      const result = await (window as any).electronAPI.fs.setOutputDir(dir);
      if (!result.success) {
        this.config.outputDir = oldDir;
        return { success: false, error: result.error || '设置输出路径失败' };
      }
    }

    this.saveToLocalStorage();
    return { success: true };
  }

  async validatePath(dirPath: string): Promise<PathValidationResult> {
    if (!dirPath || dirPath.trim() === '') {
      return { valid: false, exists: false, writable: false, error: '路径不能为空' };
    }

    const pathWithoutDrivePrefix = dirPath.trim().replace(/^[a-zA-Z]:/, '');
    const invalidChars = /[<>:"|?*]/;
    if (invalidChars.test(pathWithoutDrivePrefix)) {
      return { valid: false, exists: false, writable: false, error: '路径包含非法字符' };
    }

    if (typeof window !== 'undefined' && (window as any).electronAPI?.fs) {
      const exists = await (window as any).electronAPI.fs.exists(dirPath);
      if (!exists) {
        try {
          const mkdirResult = await (window as any).electronAPI.fs.mkdir(dirPath);
          if (!mkdirResult.success) {
            return { valid: false, exists: false, writable: false, error: '无法创建目录: ' + (mkdirResult.error || '') };
          }
        } catch (err: any) {
          return { valid: false, exists: false, writable: false, error: '无法创建目录: ' + err.message };
        }
      }

      const writable = await (window as any).electronAPI.fs.isWritable(dirPath);
      if (!writable) {
        return { valid: false, exists: true, writable: false, error: '路径不可写，请选择其他目录' };
      }

      return { valid: true, exists: true, writable: true };
    }

    return { valid: true, exists: false, writable: false };
  }

  async browseForDir(title: string): Promise<string | null> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.showOpenDialog) {
      try {
        const result = await (window as any).electronAPI.showOpenDialog({
          title,
          properties: ['openDirectory', 'createDirectory'],
        });
        if (!result.canceled && result.filePaths?.length) {
          return result.filePaths[0];
        }
      } catch { /* ignored */ }
    }
    return null;
  }

  async getCacheSize(): Promise<number> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.fs && this.config.cacheDir) {
      try {
        const exists = await (window as any).electronAPI.fs.exists(this.config.cacheDir);
        if (!exists) return 0;
        const entries = await (window as any).electronAPI.fs.readDir(this.config.cacheDir);
        if (!entries.success || !entries.data) return 0;
        let totalSize = 0;
        for (const entry of entries.data) {
          const entryPath = this.config.cacheDir + '/' + entry.name;
          const stat = await (window as any).electronAPI.fs.stat(entryPath);
          if (stat.success && stat.data) {
            totalSize += stat.data.size || 0;
          }
        }
        return totalSize;
      } catch { /* ignored */ }
    }
    return 0;
  }

  async clearCache(): Promise<{ success: boolean; error?: string }> {
    if (typeof window === 'undefined' || !(window as any).electronAPI?.fs || !this.config.cacheDir) {
      return { success: false, error: '缓存目录未设置' };
    }
    try {
      const entries = await (window as any).electronAPI.fs.readDir(this.config.cacheDir);
      if (entries.success && entries.data) {
        for (const entry of entries.data) {
          await (window as any).electronAPI.fs.unlink(this.config.cacheDir + '/' + entry.name);
        }
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '清理缓存失败' };
    }
  }

  private async migrateCache(oldDir: string, newDir: string): Promise<void> {
    if (typeof window === 'undefined' || !(window as any).electronAPI?.fs) return;
    try {
      const oldExists = await (window as any).electronAPI.fs.exists(oldDir);
      if (oldExists) {
        await (window as any).electronAPI.fs.copyDir(oldDir, newDir);
      }
    } catch { /* ignored */ }
  }

  private saveToLocalStorage(): void {
    try {
      localStorage.setItem('ai-clip-cache-config', JSON.stringify(this.config));
    } catch { /* ignored */ }
  }
}

export const cacheConfigService = new CacheConfigService();
