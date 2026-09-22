import {
  removeBackground,
  subscribeToProgress,
  getCapabilities,
  init,
  type RemoveBackgroundResult,
  type DeviceCapability,
  type ProgressState,
} from 'rembg-webgpu';

export type { DeviceCapability, ProgressState };

export interface RembgWebGPUResult {
  success: boolean;
  imageUrl?: string;
  previewUrl?: string;
  width?: number;
  height?: number;
  processingTimeSeconds?: number;
  backend?: string;
  error?: string;
}

export interface RembgWebGPUProgress {
  phase: 'idle' | 'downloading' | 'building' | 'ready' | 'error';
  progress: number;
  errorMsg?: string;
}

class RembgWebGPUService {
  private initialized = false;
  private capability: DeviceCapability | null = null;
  private progressListeners: Array<(progress: RembgWebGPUProgress) => void> = [];
  private unsubscribeProgress: (() => void) | null = null;

  async getCapabilities(): Promise<DeviceCapability> {
    if (!this.capability) {
      this.capability = await getCapabilities();
    }
    return this.capability;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const cap = await this.getCapabilities();
      return cap.device === 'webgpu' || cap.device === 'wasm';
    } catch {
      return false;
    }
  }

  async getBackendLabel(): Promise<string> {
    const cap = await this.getCapabilities();
    if (cap.device === 'webgpu' && cap.dtype === 'fp16') return 'WebGPU FP16 ⚡';
    if (cap.device === 'webgpu' && cap.dtype === 'fp32') return 'WebGPU FP32';
    return 'WASM FP32';
  }

  onProgress(listener: (progress: RembgWebGPUProgress) => void): () => void {
    this.progressListeners.push(listener);

    if (!this.unsubscribeProgress) {
      this.unsubscribeProgress = subscribeToProgress((state: ProgressState) => {
        const progress: RembgWebGPUProgress = {
          phase: state.phase,
          progress: state.progress,
          errorMsg: state.errorMsg,
        };
        this.progressListeners.forEach((l) => l(progress));
      });
    }

    return () => {
      this.progressListeners = this.progressListeners.filter((l) => l !== listener);
      if (this.progressListeners.length === 0 && this.unsubscribeProgress) {
        this.unsubscribeProgress();
        this.unsubscribeProgress = null;
      }
    };
  }

  async preload(): Promise<void> {
    if (this.initialized) return;
    try {
      await init();
      this.initialized = true;
    } catch (error) {
      console.error('[RembgWebGPU] Preload failed:', error);
      throw error;
    }
  }

  async removeBackground(imageUrl: string): Promise<RembgWebGPUResult> {
    try {
      if (!this.initialized) {
        await this.preload();
      }

      const cap = await this.getCapabilities();
      const backend = `${cap.device}-${cap.dtype}`;

      const result: RemoveBackgroundResult = await removeBackground(imageUrl);

      return {
        success: true,
        imageUrl: result.blobUrl,
        previewUrl: result.previewUrl,
        width: result.width,
        height: result.height,
        processingTimeSeconds: result.processingTimeSeconds,
        backend,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Rembg WebGPU 处理失败';
      console.error('[RembgWebGPU] removeBackground error:', msg);
      return {
        success: false,
        error: msg,
      };
    }
  }
}

export const rembgWebGPUService = new RembgWebGPUService();
