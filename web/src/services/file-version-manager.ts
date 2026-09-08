import { invoke } from '@tauri-apps/api/core';
import { exists, mkdir, readDir, copyFile } from '@tauri-apps/plugin-fs';
import { join, basename, extname } from '@tauri-apps/api/path';

export interface FileVersion {
  id: string;
  filePath: string;
  versionPath: string;
  versionNumber: number;
  createdAt: number;
  size: number;
  note?: string;
}

export interface FileVersionHistory {
  filePath: string;
  versions: FileVersion[];
}

class FileVersionManager {
  private static instance: FileVersionManager;
  private versionDir: string = '';
  private versionHistories: Map<string, FileVersion[]> = new Map();

  static getInstance(): FileVersionManager {
    if (!FileVersionManager.instance) {
      FileVersionManager.instance = new FileVersionManager();
    }
    return FileVersionManager.instance;
  }

  private async ensureVersionDir(): Promise<string> {
    if (!this.versionDir) {
      try {
        const homeDir = await invoke('get_home_directory') as string;
        this.versionDir = await join(homeDir, '.aicg_versions');
      } catch (error) {
        console.error('获取版本目录失败:', error);
        this.versionDir = './.aicg_versions';
      }
    }

    try {
      const existsFlag = await exists(this.versionDir);
      if (!existsFlag) {
        await mkdir(this.versionDir, { recursive: true });
      }
    } catch (error) {
      console.error('创建版本目录失败:', error);
    }

    return this.versionDir;
  }

  private async getFileVersionDir(filePath: string): Promise<string> {
    const baseName = await basename(filePath);
    const safeFileName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return safeFileName;
  }

  private generateVersionId(): string {
    return `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async createVersion(filePath: string, note?: string): Promise<FileVersion | null> {
    try {
      const versionDir = await this.ensureVersionDir();
      const fileVersionDir = await this.getFileVersionDir(filePath);
      const fullVersionDir = await join(versionDir, fileVersionDir);

      const existsFlag = await exists(fullVersionDir);
      if (!existsFlag) {
        await mkdir(fullVersionDir, { recursive: true });
      }

      const currentVersions = await this.getVersions(filePath);
      const nextVersionNumber = currentVersions.length + 1;
      const ext = (await extname(filePath)) || '';
      const baseName = (await basename(filePath, ext));
      const versionFileName = `${baseName}_v${nextVersionNumber}${ext}`;
      const versionPath = await join(fullVersionDir, versionFileName);

      await copyFile(filePath, versionPath);

      const version: FileVersion = {
        id: this.generateVersionId(),
        filePath,
        versionPath,
        versionNumber: nextVersionNumber,
        createdAt: Date.now(),
        size: 0,
        note,
      };

      const versions = [...currentVersions, version];
      this.versionHistories.set(filePath, versions);

      return version;
    } catch (error) {
      console.error('创建版本失败:', error);
      return null;
    }
  }

  async getVersions(filePath: string): Promise<FileVersion[]> {
    if (this.versionHistories.has(filePath)) {
      return this.versionHistories.get(filePath)!;
    }

    try {
      const versionDir = await this.ensureVersionDir();
      const fileVersionDir = await this.getFileVersionDir(filePath);
      const fullVersionDir = await join(versionDir, fileVersionDir);

      const existsFlag = await exists(fullVersionDir);
      if (!existsFlag) {
        return [];
      }

      const entries = await readDir(fullVersionDir);
      const versions: FileVersion[] = [];

      for (const entry of entries) {
        if (entry.isFile) {
          const match = entry.name.match(/_v(\d+)\./);
          if (match) {
            versions.push({
              id: this.generateVersionId(),
              filePath,
              versionPath: await join(fullVersionDir, entry.name),
              versionNumber: parseInt(match[1]),
              createdAt: Date.now() - versions.length * 86400000,
              size: 0,
            });
          }
        }
      }

      versions.sort((a, b) => b.versionNumber - a.versionNumber);
      this.versionHistories.set(filePath, versions);

      return versions;
    } catch (error) {
      console.error('获取版本列表失败:', error);
      return [];
    }
  }

  async restoreVersion(version: FileVersion): Promise<boolean> {
    try {
      await copyFile(version.versionPath, version.filePath);
      return true;
    } catch (error) {
      console.error('恢复版本失败:', error);
      return false;
    }
  }

  async deleteVersion(version: FileVersion): Promise<boolean> {
    try {
      await invoke('delete_file', { path: version.versionPath });
      
      const versions = await this.getVersions(version.filePath);
      const filteredVersions = versions.filter(v => v.id !== version.id);
      this.versionHistories.set(version.filePath, filteredVersions);
      
      return true;
    } catch (error) {
      console.error('删除版本失败:', error);
      return false;
    }
  }

  async deleteAllVersions(filePath: string): Promise<boolean> {
    try {
      const versions = await this.getVersions(filePath);
      for (const version of versions) {
        await invoke('delete_file', { path: version.versionPath });
      }
      this.versionHistories.delete(filePath);
      return true;
    } catch (error) {
      console.error('删除所有版本失败:', error);
      return false;
    }
  }
}

export const fileVersionManager = FileVersionManager.getInstance();
