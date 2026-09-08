export interface ProjectFileFormat {
  version: string;
  formatVersion: number;
  appName: string;
  createdAt: string;
  modifiedAt: string;
  project: {
    name: string;
    width: number;
    height: number;
    frameRate: number;
    sampleRate: number;
    duration: number;
  };
  timeline: {
    tracks: ProjectTrack[];
    currentTime: number;
    zoom: number;
    snapToGrid: boolean;
    gridSize: number;
  };
  media: ProjectMediaItem[];
  settings: ProjectSettings;
  metadata: ProjectMetadata;
}

export interface ProjectTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text' | 'effect';
  clips: ProjectClip[];
  height: number;
  locked: boolean;
  visible: boolean;
  muted: boolean;
}

export interface ProjectClip {
  id: string;
  type: 'video' | 'audio' | 'image' | 'text' | 'effect';
  name: string;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  url?: string;
  thumbnail?: string;
  volume?: number;
  speed?: number;
  opacity?: number;
  position?: { x: number; y: number };
  scale?: { x: number; y: number };
  rotation?: number;
  filters?: string[];
  transitions?: { in?: string; out?: string };
  locked?: boolean;
  muted?: boolean;
}

export interface ProjectMediaItem {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  url: string;
  duration: number;
  thumbnail?: string;
  addedAt: string;
}

export interface ProjectSettings {
  playbackRate: number;
  loop: boolean;
  volume: number;
  muted: boolean;
}

export interface ProjectMetadata {
  author: string;
  description: string;
  tags: string[];
  revision: number;
  lastAutoSave: string | null;
  autoSaveInterval: number;
}

const CURRENT_FORMAT_VERSION = 1;
const APP_NAME = 'MagicClip Studio';
const FILE_EXTENSION = '.mcproj';

type ElectronFsAPI = {
  readFile: (path: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  writeFile: (path: string, data: string) => Promise<{ success: boolean; error?: string }>;
  mkdir: (path: string) => Promise<void>;
  readDir: (path: string) => Promise<{ success: boolean; data?: { name: string }[] }>;
  unlink: (path: string) => Promise<void>;
};

type ElectronWindow = Window & {
  electronAPI: {
    showSaveDialog: (options: Record<string, unknown>) => Promise<{ canceled: boolean; filePath?: string }>;
    showOpenDialog: (options: Record<string, unknown>) => Promise<{ canceled: boolean; filePaths: string[] }>;
    fs: ElectronFsAPI;
  };
};

export type SaveStatus = 'idle' | 'saved' | 'saving' | 'error' | 'unsaved';

export interface AutoSaveConfig {
  enabled: boolean;
  intervalMs: number;
  maxBackups: number;
}

const DEFAULT_AUTO_SAVE: AutoSaveConfig = {
  enabled: true,
  intervalMs: 5 * 60 * 1000,
  maxBackups: 5,
};

export class ProjectStorageService {
  private currentProjectPath: string | null = null;
  private currentProjectName: string = '未命名项目';
  private saveStatus: SaveStatus = 'idle';
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private autoSaveConfig: AutoSaveConfig = { ...DEFAULT_AUTO_SAVE };
  private lastSaveTime: number = 0;
  private saveRetryCount = 0;
  private maxRetries = 3;
  private retryDelayMs = 2000;
  private hasUnsavedChanges = false;
  private onStatusChange?: (status: SaveStatus) => void;
  private onProjectChange?: (name: string, path: string | null) => void;
  private autoSaveGetters?: {
    getTimelineData: () => { tracks: unknown[]; currentTime: number; zoom: number; snapToGrid: boolean; gridSize: number; duration: number; playbackRate: number; loop: boolean };
    getMediaFiles: () => unknown[];
    getVolume: () => number;
    getMuted: () => boolean;
  };

  constructor(callbacks?: {
    onStatusChange?: (status: SaveStatus) => void;
    onProjectChange?: (name: string, path: string | null) => void;
  }) {
    this.onStatusChange = callbacks?.onStatusChange;
    this.onProjectChange = callbacks?.onProjectChange;
  }

  get projectName(): string {
    return this.currentProjectName;
  }

  get projectPath(): string | null {
    return this.currentProjectPath;
  }

  get status(): SaveStatus {
    return this.saveStatus;
  }

  get isUnsaved(): boolean {
    return this.hasUnsavedChanges;
  }

  get autoSaveInterval(): number {
    return this.autoSaveConfig.intervalMs;
  }

  setAutoSaveConfig(config: Partial<AutoSaveConfig>): void {
    this.autoSaveConfig = { ...this.autoSaveConfig, ...config };
    if (this.autoSaveTimer && this.autoSaveGetters) {
      this.stopAutoSave();
      this.startAutoSave(
        this.autoSaveGetters.getTimelineData,
        this.autoSaveGetters.getMediaFiles,
        this.autoSaveGetters.getVolume,
        this.autoSaveGetters.getMuted
      );
    }
  }

  setAutoSaveInterval(minutes: number): void {
    const clamped = Math.max(1, Math.min(30, minutes));
    this.autoSaveConfig.intervalMs = clamped * 60 * 1000;
    if (this.autoSaveTimer && this.autoSaveGetters) {
      this.stopAutoSave();
      this.startAutoSave(
        this.autoSaveGetters.getTimelineData,
        this.autoSaveGetters.getMediaFiles,
        this.autoSaveGetters.getVolume,
        this.autoSaveGetters.getMuted
      );
    }
  }

  markDirty(): void {
    this.hasUnsavedChanges = true;
    if (this.saveStatus !== 'saving') {
      this.updateStatus('unsaved');
    }
  }

  createProjectFile(
    timelineData: {
      tracks: unknown[];
      currentTime: number;
      zoom: number;
      snapToGrid: boolean;
      gridSize: number;
      duration: number;
      playbackRate: number;
      loop: boolean;
    },
    mediaFiles: unknown[],
    volume: number,
    muted: boolean,
    projectName?: string
  ): ProjectFileFormat {
    const now = new Date().toISOString();
    return {
      version: '1.0.0',
      formatVersion: CURRENT_FORMAT_VERSION,
      appName: APP_NAME,
      createdAt: now,
      modifiedAt: now,
      project: {
        name: projectName || this.currentProjectName,
        width: 1920,
        height: 1080,
        frameRate: 30,
        sampleRate: 48000,
        duration: timelineData.duration,
      },
      timeline: {
        tracks: timelineData.tracks.map((track: Record<string, unknown>) => ({
          id: track.id as string,
          name: track.name as string,
          type: track.type as 'video' | 'audio' | 'text' | 'effect',
          clips: (track.clips as Record<string, unknown>[]).map((clip: Record<string, unknown>) => ({
            id: clip.id as string,
            type: clip.type as 'video' | 'audio' | 'image' | 'text' | 'effect',
            name: clip.name as string,
            startTime: clip.startTime as number,
            duration: clip.duration as number,
            trimStart: clip.trimStart as number,
            trimEnd: clip.trimEnd as number,
            url: clip.url as string | undefined,
            thumbnail: clip.thumbnail as string | undefined,
            volume: clip.volume as number | undefined,
            speed: clip.speed as number | undefined,
            opacity: clip.opacity as number | undefined,
            position: clip.position as { x: number; y: number } | undefined,
            scale: clip.scale as { x: number; y: number } | undefined,
            rotation: clip.rotation as number | undefined,
            filters: clip.filters as string[] | undefined,
            transitions: clip.transitions as { in?: string; out?: string } | undefined,
            locked: clip.locked as boolean | undefined,
            muted: clip.muted as boolean | undefined,
          })),
          height: track.height as number,
          locked: track.locked as boolean,
          visible: track.visible as boolean,
          muted: track.muted as boolean,
        })),
        currentTime: timelineData.currentTime,
        zoom: timelineData.zoom,
        snapToGrid: timelineData.snapToGrid,
        gridSize: timelineData.gridSize,
      },
      media: mediaFiles.map((m: Record<string, unknown>) => ({
        id: m.id as string,
        name: m.name as string,
        type: m.type as 'video' | 'audio' | 'image',
        url: m.url as string,
        duration: m.duration as number,
        thumbnail: m.thumbnail as string | undefined,
        addedAt: now,
      })),
      settings: {
        playbackRate: timelineData.playbackRate,
        loop: timelineData.loop,
        volume,
        muted,
      },
      metadata: {
        author: '',
        description: '',
        tags: [],
        revision: 1,
        lastAutoSave: null,
        autoSaveInterval: this.autoSaveConfig.intervalMs / 60000,
      },
    };
  }

  async saveProject(
    timelineData: Parameters<typeof this.createProjectFile>[0],
    mediaFiles: Parameters<typeof this.createProjectFile>[1],
    volume: number,
    muted: boolean,
    filePath?: string
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    this.updateStatus('saving');
    this.saveRetryCount = 0;

    const projectFile = this.createProjectFile(timelineData, mediaFiles, volume, muted);
    projectFile.metadata.revision += 1;
    projectFile.modifiedAt = new Date().toISOString();

    const targetPath = filePath || this.currentProjectPath;

    if (targetPath) {
      const result = await this.writeWithRetry(targetPath, JSON.stringify(projectFile, null, 2));
      if (result.success) {
        this.currentProjectPath = targetPath;
        this.currentProjectName = projectFile.project.name;
        this.hasUnsavedChanges = false;
        this.lastSaveTime = Date.now();
        this.updateStatus('saved');
        this.onProjectChange?.(this.currentProjectName, this.currentProjectPath);
        return { success: true, path: targetPath };
      }
      this.updateStatus('error');
      return { success: false, error: result.error };
    }

    if (typeof window !== 'undefined' && (window as any as ElectronWindow).electronAPI) {
      try {
        const result = await ((window as any as ElectronWindow).electronAPI).showSaveDialog({
          title: '保存项目',
          defaultPath: this.currentProjectName + FILE_EXTENSION,
          filters: [
            { name: 'MagicClip 项目', extensions: ['mcproj'] },
            { name: '所有文件', extensions: ['*'] },
          ],
        });
        if (result.canceled || !result.filePath) {
          this.updateStatus(this.hasUnsavedChanges ? 'unsaved' : 'saved');
          return { success: false, error: '用户取消' };
        }
        const savePath = result.filePath;
        const writeResult = await this.writeWithRetry(savePath, JSON.stringify(projectFile, null, 2));
        if (writeResult.success) {
          this.currentProjectPath = savePath;
          this.currentProjectName = projectFile.project.name;
          this.hasUnsavedChanges = false;
          this.lastSaveTime = Date.now();
          this.updateStatus('saved');
          this.onProjectChange?.(this.currentProjectName, this.currentProjectPath);
          return { success: true, path: savePath };
        }
        this.updateStatus('error');
        return { success: false, error: writeResult.error };
      } catch (err: unknown) {
        this.updateStatus('error');
        return { success: false, error: (err as Error).message || '保存失败' };
      }
    }

    try {
      localStorage.setItem('ai-clip-project', JSON.stringify(projectFile));
      this.hasUnsavedChanges = false;
      this.lastSaveTime = Date.now();
      this.updateStatus('saved');
      return { success: true, path: 'localStorage' };
    } catch (err: unknown) {
      this.updateStatus('error');
      return { success: false, error: (err as Error).message || '本地存储失败' };
    }
  }

  async loadProject(filePath?: string): Promise<{ success: boolean; data?: ProjectFileFormat; error?: string }> {
    let targetPath = filePath || this.currentProjectPath;

    if (!targetPath && typeof window !== 'undefined' && (window as any as ElectronWindow).electronAPI) {
      try {
        const result = await (window as any as ElectronWindow).electronAPI.showOpenDialog({
          title: '打开项目',
          filters: [
            { name: 'MagicClip 项目', extensions: ['mcproj'] },
            { name: '所有文件', extensions: ['*'] },
          ],
          properties: ['openFile'],
        });
        if (result.canceled || !result.filePaths?.length) {
          return { success: false, error: '用户取消' };
        }
        targetPath = result.filePaths[0];
      } catch (err: unknown) {
        return { success: false, error: (err as Error).message || '打开对话框失败' };
      }
    }

    if (targetPath && typeof window !== 'undefined' && (window as any as ElectronWindow).electronAPI?.fs) {
      const readResult = await (window as any as ElectronWindow).electronAPI.fs.readFile(targetPath);
      if (readResult.success && readResult.data) {
        try {
          const projectFile = this.migrateProjectFile(JSON.parse(readResult.data));
          this.currentProjectPath = targetPath;
          this.currentProjectName = projectFile.project.name;
          this.hasUnsavedChanges = false;
          this.updateStatus('saved');
          this.onProjectChange?.(this.currentProjectName, this.currentProjectPath);
          return { success: true, data: projectFile };
        } catch (err: unknown) {
          return { success: false, error: '项目文件格式错误: ' + (err as Error).message };
        }
      }
      return { success: false, error: readResult.error || '读取文件失败' };
    }

    try {
      const stored = localStorage.getItem('ai-clip-project');
      if (stored) {
        const projectFile = this.migrateProjectFile(JSON.parse(stored));
        this.currentProjectName = projectFile.project.name;
        this.hasUnsavedChanges = false;
        this.updateStatus('saved');
        this.onProjectChange?.(this.currentProjectName, null);
        return { success: true, data: projectFile };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message || '读取本地存储失败' };
    }

    return { success: false, error: '未找到项目文件' };
  }

  async autoSave(
    timelineData: Parameters<typeof this.createProjectFile>[0],
    mediaFiles: Parameters<typeof this.createProjectFile>[1],
    volume: number,
    muted: boolean
  ): Promise<void> {
    if (!this.autoSaveConfig.enabled || !this.hasUnsavedChanges) return;

    const projectFile = this.createProjectFile(timelineData, mediaFiles, volume, muted);
    projectFile.metadata.lastAutoSave = new Date().toISOString();

    if (this.currentProjectPath) {
      const backupDir = this.currentProjectPath + '.backups';
      if (typeof window !== 'undefined' && (window as any as ElectronWindow).electronAPI?.fs) {
        await (window as any as ElectronWindow).electronAPI.fs.mkdir(backupDir);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = backupDir + `/autosave-${timestamp}${FILE_EXTENSION}`;
        await (window as any as ElectronWindow).electronAPI.fs.writeFile(backupPath, JSON.stringify(projectFile, null, 2));
        this.cleanOldBackups(backupDir);
      }
    }

    try {
      localStorage.setItem('ai-clip-project-autosave', JSON.stringify(projectFile));
      this.hasUnsavedChanges = false;
      this.lastSaveTime = Date.now();
      this.updateStatus('saved');
    } catch { /* ignored */ }
  }

  startAutoSave(
    getTimelineData: () => Parameters<typeof this.createProjectFile>[0],
    getMediaFiles: () => Parameters<typeof this.createProjectFile>[1],
    getVolume: () => number,
    getMuted: () => boolean
  ): void {
    this.autoSaveGetters = { getTimelineData, getMediaFiles, getVolume, getMuted };
    this.stopAutoSave();
    if (!this.autoSaveConfig.enabled) return;

    this.autoSaveTimer = setInterval(() => {
      this.autoSave(getTimelineData(), getMediaFiles(), getVolume(), getMuted());
    }, this.autoSaveConfig.intervalMs);
  }

  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  newProject(name?: string): void {
    this.currentProjectPath = null;
    this.currentProjectName = name || '未命名项目';
    this.hasUnsavedChanges = false;
    this.saveRetryCount = 0;
    this.updateStatus('idle');
    this.onProjectChange?.(this.currentProjectName, null);
  }

  private async writeWithRetry(filePath: string, data: string, attempt = 0): Promise<{ success: boolean; error?: string }> {
    if (typeof window !== 'undefined' && (window as any as ElectronWindow).electronAPI?.fs) {
      const result = await (window as any as ElectronWindow).electronAPI.fs.writeFile(filePath, data);
      if (result.success) return { success: true };
      if (attempt < this.maxRetries) {
        await new Promise(r => setTimeout(r, this.retryDelayMs * (attempt + 1)));
        return this.writeWithRetry(filePath, data, attempt + 1);
      }
      return { success: false, error: result.error || '写入失败' };
    }
    return { success: false, error: '文件系统不可用' };
  }

  private async cleanOldBackups(backupDir: string): Promise<void> {
    if (typeof window === 'undefined' || !(window as any as ElectronWindow).electronAPI?.fs) return;
    try {
      const result = await (window as any as ElectronWindow).electronAPI.fs.readDir(backupDir);
      if (!result.success || !result.data) return;
      const backups = (result.data as Record<string, unknown>[])
        .filter((e: Record<string, unknown>) => (e.name as string).startsWith('autosave-') && (e.name as string).endsWith(FILE_EXTENSION))
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.name as string).localeCompare(a.name as string));
      while (backups.length > this.autoSaveConfig.maxBackups) {
        const old = backups.pop();
        if (old) await (window as any as ElectronWindow).electronAPI.fs.unlink(backupDir + '/' + (old as Record<string, unknown>).name);
      }
    } catch { /* ignored */ }
  }

  private migrateProjectFile(data: unknown): ProjectFileFormat {
    const record = data as Record<string, unknown>;
    const formatVersion = (record.formatVersion as number) || 0;
    let migrated: Record<string, unknown> = { ...record };

    if (formatVersion < 1) {
      const project = (migrated.project as Record<string, unknown>) || {};
      const metadata = (migrated.metadata as Record<string, unknown>) || {};
      migrated = {
        ...migrated,
        formatVersion: CURRENT_FORMAT_VERSION,
        appName: migrated.appName || APP_NAME,
        project: {
          ...project,
          width: (project as Record<string, unknown>).width || 1920,
          height: (project as Record<string, unknown>).height || 1080,
          frameRate: (project as Record<string, unknown>).frameRate || 30,
          sampleRate: (project as Record<string, unknown>).sampleRate || 48000,
        },
        metadata: {
          author: (metadata as Record<string, unknown>).author || '',
          description: (metadata as Record<string, unknown>).description || '',
          tags: (metadata as Record<string, unknown>).tags || [],
          revision: (metadata as Record<string, unknown>).revision || 1,
          lastAutoSave: (metadata as Record<string, unknown>).lastAutoSave || null,
          autoSaveInterval: (metadata as Record<string, unknown>).autoSaveInterval || 5,
        },
      };
    }

    return migrated as any as ProjectFileFormat;
  }

  private updateStatus(status: SaveStatus): void {
    this.saveStatus = status;
    this.onStatusChange?.(status);
  }

  destroy(): void {
    this.stopAutoSave();
  }
}

export const projectStorage = new ProjectStorageService();
