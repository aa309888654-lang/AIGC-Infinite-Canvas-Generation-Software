/**
 * AI Video Editing SDK - TypeScript Frontend SDK
 * 企业级AI视频剪辑SDK前端接口
 *
 * 支持两种运行环境：
 * - Tauri 桌面端：通过 invoke 调用 Rust 后端
 * - Web 浏览器端：通过 HTTP API 调用 Node.js 后端
 */

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<any>;

let tauriInvoke: InvokeFn | null = null;
try {
  const tauriCore = await import('@tauri-apps/api/core');
  tauriInvoke = tauriCore.invoke as InvokeFn;
} catch {
  tauriInvoke = null;
}

const isTauriAvailable = (): boolean => tauriInvoke !== null;

const getApiBaseUrl = (): string => {
  return (window as any as { __API_BASE_URL__?: string }).__API_BASE_URL__ || '/api/v1';
};

async function webApiCall<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}/ai-video/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`AI Video API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export interface VideoClip {
  start_time: number;
  end_time: number;
  duration: number;
  score: number;
  detector: string;
  start_frame?: number;
  end_frame?: number;
}

export interface EditResult {
  success: boolean;
  output_path?: string;
  clips: VideoClip[];
  total_duration: number;
  analysis_time: number;
  export_time: number;
  error?: string;
}

export interface EditorConfig {
  gpu_enabled: boolean;
  detector_threshold: number;
  min_clip_duration: number;
  max_clip_duration: number;
  export_resolution: string;
  export_fps: number;
  log_level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
}

export interface BatchProcessResult {
  total: number;
  success: number;
  failed: number;
  results: EditResult[];
}

export interface BenchmarkResult {
  video: string;
  resolution: string;
  fps: number;
  duration: number;
  analysis_time: number;
  export_time: number;
  peak_memory_mb: number;
  avg_cpu_percent: number;
  realtime_factor: number;
  success: boolean;
  error?: string;
}

export type DetectorType = 'audio' | 'motion' | 'scene' | 'face' | 'saliency' | 'custom';

export class AIVideoSDK {
  private static instance: AIVideoSDK;

  private constructor() { /* noop */ }

  public static getInstance(): AIVideoSDK {
    if (!AIVideoSDK.instance) {
      AIVideoSDK.instance = new AIVideoSDK();
    }
    return AIVideoSDK.instance;
  }

  async analyze(
    inputPath: string,
    detectorType: DetectorType = 'audio',
    config?: Partial<EditorConfig>
  ): Promise<VideoClip[]> {
    try {
      if (isTauriAvailable()) {
        return (await tauriInvoke!('ai_video_analyze', {
          inputPath,
          detectorType,
          config: config || undefined,
        })) as VideoClip[];
      }
      const result = await webApiCall<{ clips: VideoClip[] }>('analyze', {
        inputPath,
        detectorType,
        config: config || undefined,
      });
      return result.clips;
    } catch (error) {
      console.error('[AIVideoSDK] Analyze failed:', error);
      return [];
    }
  }

  async edit(
    inputPath: string,
    outputPath: string,
    detectorType: DetectorType = 'audio',
    config?: Partial<EditorConfig>
  ): Promise<EditResult> {
    try {
      if (isTauriAvailable()) {
        return (await tauriInvoke!('ai_video_edit', {
          inputPath,
          outputPath,
          detectorType,
          config: config || undefined,
        })) as EditResult;
      }
      return await webApiCall<EditResult>('edit', {
        inputPath,
        outputPath,
        detectorType,
        config: config || undefined,
      });
    } catch (error) {
      console.error('[AIVideoSDK] Edit failed:', error);
      return {
        success: false,
        clips: [],
        total_duration: 0,
        analysis_time: 0,
        export_time: 0,
        error: String(error),
      };
    }
  }

  async batchProcess(
    inputPaths: string[],
    outputDir: string,
    detectorType: DetectorType = 'audio',
    config?: Partial<EditorConfig>
  ): Promise<BatchProcessResult> {
    try {
      if (isTauriAvailable()) {
        return (await tauriInvoke!('ai_video_batch_process', {
          inputPaths,
          outputDir,
          detectorType,
          config: config || undefined,
        })) as BatchProcessResult;
      }
      return await webApiCall<BatchProcessResult>('batch-process', {
        inputPaths,
        outputDir,
        detectorType,
        config: config || undefined,
      });
    } catch (error) {
      console.error('[AIVideoSDK] Batch process failed:', error);
      return {
        total: inputPaths.length,
        success: 0,
        failed: inputPaths.length,
        results: [],
      };
    }
  }

  async benchmark(
    videoPath: string,
    config?: Partial<EditorConfig>
  ): Promise<BenchmarkResult> {
    try {
      if (isTauriAvailable()) {
        return (await tauriInvoke!('ai_video_benchmark', {
          videoPath,
          config: config || undefined,
        })) as BenchmarkResult;
      }
      return await webApiCall<BenchmarkResult>('benchmark', {
        videoPath,
        config: config || undefined,
      });
    } catch (error) {
      console.error('[AIVideoSDK] Benchmark failed:', error);
      return {
        video: videoPath,
        resolution: '1920x1080',
        fps: 30,
        duration: 0,
        analysis_time: 0,
        export_time: 0,
        peak_memory_mb: 0,
        avg_cpu_percent: 0,
        realtime_factor: 0,
        success: false,
        error: String(error),
      };
    }
  }

  async getConfig(): Promise<EditorConfig> {
    try {
      if (isTauriAvailable()) {
        return (await tauriInvoke!('ai_video_get_config')) as EditorConfig;
      }
      const result = await webApiCall<EditorConfig>('get-config', {});
      return result;
    } catch (error) {
      console.error('[AIVideoSDK] Get config failed:', error);
      return this.getDefaultConfig();
    }
  }

  async saveConfig(config: EditorConfig, configPath: string): Promise<boolean> {
    try {
      if (isTauriAvailable()) {
        return (await tauriInvoke!('ai_video_save_config', {
          config,
          configPath,
        })) as boolean;
      }
      const result = await webApiCall<{ success: boolean }>('save-config', {
        config,
        configPath,
      });
      return result.success;
    } catch (error) {
      console.error('[AIVideoSDK] Save config failed:', error);
      return false;
    }
  }

  async loadConfig(configPath: string): Promise<EditorConfig> {
    try {
      if (isTauriAvailable()) {
        return (await tauriInvoke!('ai_video_load_config', {
          configPath,
        })) as EditorConfig;
      }
      return await webApiCall<EditorConfig>('load-config', { configPath });
    } catch (error) {
      console.error('[AIVideoSDK] Load config failed:', error);
      return this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): EditorConfig {
    return {
      gpu_enabled: false,
      detector_threshold: 0.5,
      min_clip_duration: 1.0,
      max_clip_duration: 60.0,
      export_resolution: '1920x1080',
      export_fps: 30,
      log_level: 'INFO',
    };
  }
}

export const aiVideoSDK = AIVideoSDK.getInstance();
