import { logger } from '@/lib/logger';
import { apiClient } from '@/lib/api-client';

export interface RembgModel {
  id: string;
  name: string;
  desc: string;
}

export interface RembgRemoveOptions {
  model?: string;
  returnMask?: boolean;
  alphaMatting?: boolean;
  alphaMattingForegroundThreshold?: number;
  alphaMattingBackgroundThreshold?: number;
  alphaMattingErodeSize?: number;
}

export interface RembgResult {
  success: boolean;
  imageUrl?: string;
  maskUrl?: string;
  model?: string;
  error?: string;
}

class RembgService {
  private baseUrl = '/api/v1/rembg';
  private healthCache: { online: boolean; timestamp: number } | null = null;
  private cacheTTL = 60000;

  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    if (this.healthCache && now - this.healthCache.timestamp < this.cacheTTL) {
      return this.healthCache.online;
    }

    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      const online = data.success && data.enabled && data.status === 'online';
      this.healthCache = { online, timestamp: now };
      return online;
    } catch {
      this.healthCache = { online: false, timestamp: now };
      return false;
    }
  }

  async getModels(): Promise<RembgModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`);
      const data = await response.json();
      return data.models || [];
    } catch {
      return [];
    }
  }

  async removeBackground(imageUrl: string, options: RembgRemoveOptions = {}): Promise<RembgResult> {
    try {
      const data = await apiClient.post<{
        success: boolean;
        image?: string;
        format?: string;
        error?: string;
      }>(
        '/rembg/remove-background',
        {
          image_url: imageUrl,
          model: options.model || 'birefnet-general',
          return_mask: options.returnMask || false,
          alpha_matting: options.alphaMatting || false,
          alpha_matting_foreground_threshold: options.alphaMattingForegroundThreshold,
          alpha_matting_background_threshold: options.alphaMattingBackgroundThreshold,
          alpha_matting_erode_size: options.alphaMattingErodeSize,
        },
        { timeout: 120000, maxRetries: 0 },
      );

      if (!data.success) {
        return { success: false, error: data.error || 'Rembg 处理失败' };
      }

      const resultImageUrl = `data:image/${data.format};base64,${data.image}`;

      return {
        success: true,
        imageUrl: resultImageUrl,
        model: options.model,
      };
    } catch (error) {
      logger.error('[RembgService] removeBackground error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Rembg 服务调用失败',
      };
    }
  }

  async removeBackgroundFromBase64(base64Data: string, options: RembgRemoveOptions = {}): Promise<RembgResult> {
    try {
      const data = await apiClient.post<{
        success: boolean;
        image?: string;
        format?: string;
        error?: string;
      }>(
        '/rembg/remove-background',
        {
          image_base64: base64Data,
          model: options.model || 'birefnet-general',
          return_mask: options.returnMask || false,
        },
        { timeout: 120000, maxRetries: 0 },
      );

      if (!data.success) {
        return { success: false, error: data.error || 'Rembg 处理失败' };
      }

      const resultImageUrl = `data:image/${data.format};base64,${data.image}`;

      return {
        success: true,
        imageUrl: resultImageUrl,
        model: options.model,
      };
    } catch (error) {
      logger.error('[RembgService] removeBackgroundFromBase64 error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Rembg 服务调用失败',
      };
    }
  }

  async getMask(imageUrl: string, model?: string): Promise<RembgResult> {
    return this.removeBackground(imageUrl, { model, returnMask: true });
  }
}

export const rembgService = new RembgService();
