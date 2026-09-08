/// <reference types="vite/client" />

declare module '*.css' {
  const content: string;
  export default content;
}

interface ElectronFS {
  readFile(filePath: string): Promise<{ success: boolean; data?: string; error?: string }>;
  writeFile(filePath: string, data: string): Promise<{ success: boolean; error?: string }>;
  writeBinaryFile(filePath: string, base64Data: string): Promise<{ success: boolean; error?: string }>;
  exists(filePath: string): Promise<boolean>;
  mkdir(filePath: string): Promise<{ success: boolean; error?: string }>;
  readDir(filePath: string): Promise<{ success: boolean; data?: Array<{ name: string; isDirectory: boolean }>; error?: string }>;
  unlink(filePath: string): Promise<{ success: boolean; error?: string }>;
  stat(filePath: string): Promise<{ success: boolean; data?: { size: number; isDirectory: boolean; modifiedTime: string }; error?: string }>;
  isWritable(filePath: string): Promise<boolean>;
  copyDir(src: string, dest: string): Promise<{ success: boolean; error?: string }>;
  moveDir(src: string, dest: string): Promise<{ success: boolean; error?: string }>;
  getCacheDir(): Promise<string>;
  getOutputDir(): Promise<string>;
  setCacheDir(dir: string): Promise<{ success: boolean; error?: string }>;
  setOutputDir(dir: string): Promise<{ success: boolean; error?: string }>;
}

interface ElectronProject {
  newProject(): Promise<{ success: boolean }>;
  open(): Promise<{ success: boolean; data?: string; filePath?: string; error?: string; canceled?: boolean }>;
  save(filePath: string, data: string): Promise<{ success: boolean; filePath?: string; error?: string }>;
  saveAs(data: string): Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }>;
  getRecent(): Promise<string[]>;
  addRecent(filePath: string): Promise<{ success: boolean }>;
}

interface ElectronAPI {
  windowMinimize(): Promise<void>;
  windowMaximize(): Promise<void>;
  windowClose(): Promise<void>;
  windowIsMaximized(): Promise<boolean>;
  onWindowMaximizeChange(callback: (maximized: boolean) => void): void;
  showOpenDialog(options: {
    title?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    properties?: string[];
  }): Promise<{ canceled: boolean; filePaths?: string[] }>;
  showSaveDialog(options: {
    title?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<{ canceled: boolean; filePath?: string }>;
  fs: ElectronFS;
  project: ElectronProject;
  smartEdit: {
    analyzeAudio(filePath: string, options?: {
      silenceThreshold?: number;
      minSilenceDuration?: number;
      frameSize?: number;
      sampleRate?: number;
    }): Promise<{
      success: boolean;
      silenceSegments?: Array<{
        id: string;
        startTime: number;
        endTime: number;
        duration: number;
        type: string;
        action: string;
        confidence: number;
      }>;
      averageVolume?: number;
      duration?: number;
      sampleRate?: number;
      format?: string;
      error?: string;
      message?: string;
    }>;
    applyEdits(inputPath: string, outputPath: string, operations: {
      removeSilence?: boolean;
      silenceSegments?: Array<{ startTime: number; endTime: number; action: string }>;
      speed?: number;
      totalDuration?: number;
    }): Promise<{
      success: boolean;
      outputPath?: string;
      command?: string;
      error?: string;
      message?: string;
    }>;
    checkFfmpeg(): Promise<{ available: boolean; version?: string }>;
  };

  render: {
    exportVideo(options: {
      inputFiles: Array<{
        path: string;
        startTime: number;
        duration: number;
        track: number;
        type: string;
      }>;
      outputDir: string;
      outputFileName: string;
      resolution: { width: number; height: number };
      fps: number;
      bitrate: number;
      codec: string;
      format: string;
      audioCodec?: string;
      audioBitrate?: number;
    }): Promise<{
      success: boolean;
      outputPath?: string;
      error?: string;
    }>;
    checkEnvironment(): Promise<{
      ffmpeg: { available: boolean; version?: string };
      outputDir: string;
      outputDirWritable: boolean;
    }>;
  };

  updater: {
    check(): Promise<{ available: boolean; version?: string; error?: string }>;
    download(): Promise<{ success: boolean; error?: string }>;
    install(): Promise<{ success: boolean; error?: string }>;
    getInfo(): Promise<{ version: string; buildVersion?: string } | null>;
    onChecking(callback: () => void): void;
    onAvailable(callback: (info: UpdateInfo) => void): void;
    onNotAvailable(callback: (info: { version: string }) => void): void;
    onProgress(callback: (progress: UpdateProgress) => void): void;
    onDownloaded(callback: (info: UpdateInfo) => void): void;
    onError(callback: (err: { message: string }) => void): void;
  };
}

interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | Array<{ version: string; note: string }>;
}

interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    webkitAudioContext?: typeof AudioContext;
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
  }

  interface Navigator {
    connection?: {
      downlink?: number;
      addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
      removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
    };
    deviceMemory?: number;
  }
}

export {};
