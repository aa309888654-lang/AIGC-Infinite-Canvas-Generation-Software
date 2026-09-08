import { logger } from '@/lib/logger';
import { API_BASE_URL } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-check';

/**
 * 百度AI图像处理服务
 * 提供人像分割（抠图）和图像清晰度增强功能
 * 
 * API文档：
 * - 抠图：https://aip.baidubce.com/rest/2.0/image-classify/v1/body_seg
 * - 清晰度增强：https://aip.baidubce.com/rest/2.0/image-process/v1/image_definition_enhance
 */

export interface BaiduAIConfig {
  apiKey: string;
  secretKey: string;
}

export interface MattingResult {
  foreground: string; // 前景抠图（透明背景）
  labelmap: string;   // 二值图像
  scoremap: string;   // 灰度图
}

export interface EnhanceResult {
  image: string; // 增强后的图片Base64
}

interface _BaiduTokenResponse {
  access_token: string;
  expires_in: number;
}

interface BaiduBodySegResponse {
  log_id: number;
  labelmap?: string;
  scoremap?: string;
  foreground?: string;
  error_code?: number;
  error_msg?: string;
}

interface _BaiduEnhanceResponse {
  log_id: number;
  image?: string;
  error_code?: number;
  error_msg?: string;
}

class BaiduAIService {
  /** 历史兼容：浏览器传入的密钥会被忽略。 */
  public configure(_config: BaiduAIConfig): void {
    logger.warn('[BaiduAIService] 已忽略浏览器端凭据，百度 AI 由后端托管');
  }

  private async requestBackend(path: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/baidu-ai${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.message || payload?.error || `百度 AI 后端请求失败: ${response.status}`);
    }
    return payload.data || {};
  }

  /**
   * 将图片URL转换为Base64
   * 自动压缩图片以符合API要求（Base64编码后最大4MB）
   */
  private async imageUrlToBase64(imageUrl: string): Promise<string> {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      const sizeInMB = blob.size / (1024 * 1024);

      // 如果图片可能太大，需要压缩
      // Base64会增加约33%大小，所以原图需要控制在 4MB / 1.33 = 3MB以内
      // 但实际测试发现API限制可能是4MB Base64，所以原图控制在2.5MB以内更安全
      if (sizeInMB > 2.5) {
        const compressedBlob = await this.compressImageForAPI(blob);
        
        // 验证压缩后的Base64大小
        const base64Test = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(compressedBlob);
        });
        
        const base64SizeInMB = (base64Test.length * 3) / 4 / (1024 * 1024);
        
        // 如果仍然太大，继续压缩
        if (base64SizeInMB > 3.5) {
          const furtherCompressedBlob = await this.compressImageMore(compressedBlob);
          
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(furtherCompressedBlob);
          });
        }

        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(compressedBlob);
        });
      }

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      logger.error('[BaiduAIService] 图片转Base64失败:', error);
      throw error;
    }
  }

  /**
   * 压缩图片，确保符合智能抠图API要求
   * - Base64编码后不超过4MB
   * - 最短边50-64px
   * - 最长边不超过4096px
   * - 优先使用JPEG格式
   */
  private async compressImageForAPI(blob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        let { width, height } = img;

        // 智能抠图的尺寸要求
        const MIN_DIMENSION = 50;   // 最短边至少50px
        const MAX_DIMENSION = 3000; // 最长边不超过3000px（原文档说4096，但实测3000更安全）

        // 如果尺寸超出限制，等比例缩放
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        // 确保最短边>=50px
        if (width < MIN_DIMENSION && height < MIN_DIMENSION) {
          const scale = MIN_DIMENSION / Math.min(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;

        // 绘制图片
        ctx.drawImage(img, 0, 0, width, height);

        // 逐步降低质量直到满足大小要求
        // 目标：Base64编码后 < 3.5MB（留余量）
        let quality = 0.85;  // 从85%质量开始
        const maxBlobSize = 2.5 * 1024 * 1024; // 2.5MB（原图）

        const tryCompress = () => {
          canvas.toBlob(
            (compressedBlob) => {
              if (!compressedBlob) {
                reject(new Error('图片压缩失败'));
                return;
              }

              if (compressedBlob.size > maxBlobSize && quality > 0.3) {
                quality -= 0.1;
                tryCompress();
              } else {
                resolve(compressedBlob);
              }
            },
            'image/jpeg',  // 优先使用JPEG格式
            quality
          );
        };

        tryCompress();
      };

      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = URL.createObjectURL(blob);
    });
  }

  /**
   * 更激进的图片压缩
   * 用于处理仍然超过大小限制的图片
   */
  private async compressImageMore(blob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        let { width, height } = img;

        // 更激进的缩放：降低到2000px
        const MAX_DIMENSION = 2000;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // 从60%质量开始压缩，更激进
        let quality = 0.6;
        const maxBlobSize = 1.5 * 1024 * 1024; // 1.5MB

        const tryCompress = () => {
          canvas.toBlob(
            (compressedBlob) => {
              if (!compressedBlob) {
                reject(new Error('图片压缩失败'));
                return;
              }

              if (compressedBlob.size > maxBlobSize && quality > 0.2) {
                quality -= 0.1;
                tryCompress();
              } else {
                resolve(compressedBlob);
              }
            },
            'image/jpeg',
            quality
          );
        };

        tryCompress();
      };

      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = URL.createObjectURL(blob);
    });
  }

  /**
   * 智能抠图 (人像分割)
   * API: POST /baidu-ai/rest/2.0/image-classify/v1/body_seg
   * 使用Vite代理避免CORS问题
   * 使用 application/x-www-form-urlencoded 格式提交参数
   */
  public async removeBackground(imageUrl: string): Promise<string> {
    try {
      const base64Image = await this.imageUrlToBase64(imageUrl);
      const result = await this.requestBackend('/body-seg', { image: base64Image, type: 'foreground' });

      const resultImage = result.foreground;
      
      if (!resultImage) {
        throw new Error(`未获取到抠图结果。响应: ${JSON.stringify(result).substring(0, 300)}`);
      }

      // 如果是Base64字符串，转换为data URL
      const resultUrl = typeof resultImage === 'string' && resultImage.startsWith('data:') 
        ? resultImage 
        : `data:image/png;base64,${resultImage}`;
      
      return resultUrl;
    } catch (error) {
      logger.error('[BaiduAIService] 智能抠图失败:', error);
      throw error;
    }
  }

  /**
   * 获取完整的抠图结果（包含所有类型）
   */
  public async getMattingResults(imageUrl: string): Promise<MattingResult> {
    const base64Image = await this.imageUrlToBase64(imageUrl);
    const result = await this.requestBackend('/body-seg', { image: base64Image }) as unknown as BaiduBodySegResponse;

    return {
      foreground: result.foreground ? `data:image/png;base64,${result.foreground}` : '',
      labelmap: result.labelmap ? `data:image/png;base64,${result.labelmap}` : '',
      scoremap: result.scoremap ? `data:image/png;base64,${result.scoremap}` : '',
    };
  }

  /**
   * 图像清晰度增强
   * API: POST /baidu-ai/rest/2.0/image-process/v1/image_definition_enhance
   * 使用Vite代理避免CORS问题
   */
  public async enhanceImage(imageUrl: string): Promise<string> {
    try {
      const base64Image = await this.imageUrlToBase64(imageUrl);
      const result = await this.requestBackend('/enhance', { image: base64Image });

      const enhancedImage = result.image;
      
      if (!enhancedImage) {
        throw new Error('未获取到增强结果');
      }

      const resultUrl = `data:image/png;base64,${enhancedImage}`;
      
      return resultUrl;
    } catch (error) {
      logger.error('[BaiduAIService] 图像增强失败:', error);
      throw error;
    }
  }

  /**
   * 测试API连接
   */
  public async testConnection(): Promise<boolean> {
    try {
      await this.requestBackend('/status');
      return true;
    } catch (error) {
      logger.error('[BaiduAIService] API连接测试失败:', error);
      return false;
    }
  }

  /**
   * 检查配置是否完整
   */
  public isConfigured(): boolean {
    return !!getAuthToken();
  }
}

export const baiduAIService = new BaiduAIService();
