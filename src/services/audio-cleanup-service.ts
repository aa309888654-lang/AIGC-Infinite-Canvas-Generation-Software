import { API_BASE_URL } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-check';
import { logger } from '@/lib/logger';

export type AudioCleanupMode = 'noise-reduce' | 'enhance' | 'normalize';

export interface AudioCleanupInput {
  /** 在线可访问的音频 URL，与 file 二选一 */
  audioUrl?: string;
  /** 本地音频文件，与 audioUrl 二选一 */
  file?: File;
  /** noise-reduce 降噪强度 */
  level?: 'low' | 'medium' | 'high';
  /** enhance / normalize 目标响度（LUFS） */
  targetLufs?: number;
}

export interface AudioCleanupResult {
  success: boolean;
  /** 处理后的音频 URL */
  outputUrl: string;
  /** 原始响应数据，便于调试 */
  raw: unknown;
  mode: AudioCleanupMode;
}

/**
 * 音频清理服务
 * 接入后端 /api/v1/audio/noise-reduce、/enhance、/normalize
 * 后端实际调用 MiniMax 音频处理能力
 */
class AudioCleanupService {
  async processAudio(input: AudioCleanupInput, mode: AudioCleanupMode): Promise<AudioCleanupResult> {
    switch (mode) {
      case 'noise-reduce':
        return this.reduceNoise(input);
      case 'enhance':
        return this.enhance(input);
      case 'normalize':
        return this.normalize(input);
      default:
        throw new Error(`不支持的音频处理模式: ${mode}`);
    }
  }

  async reduceNoise(input: AudioCleanupInput): Promise<AudioCleanupResult> {
    const formData = this.buildFormData(input, { level: input.level || 'medium' });
    const data = await this.call('/audio/noise-reduce', formData, input);
    const outputUrl = data?.result?.cleanedUrl;
    if (!outputUrl) {
      throw new Error('降噪响应缺少 cleanedUrl');
    }
    return {
      success: true,
      outputUrl,
      raw: data,
      mode: 'noise-reduce',
    };
  }

  async enhance(input: AudioCleanupInput): Promise<AudioCleanupResult> {
    const formData = this.buildFormData(input, { targetLufs: input.targetLufs ?? -16 });
    const data = await this.call('/audio/enhance', formData, input);
    const outputUrl = data?.result?.enhancedUrl;
    if (!outputUrl) {
      throw new Error('音频增强响应缺少 enhancedUrl');
    }
    return {
      success: true,
      outputUrl,
      raw: data,
      mode: 'enhance',
    };
  }

  async normalize(input: AudioCleanupInput): Promise<AudioCleanupResult> {
    const formData = this.buildFormData(input, { targetLufs: input.targetLufs ?? -16 });
    const data = await this.call('/audio/normalize', formData, input);
    const outputUrl = data?.result?.url;
    if (!outputUrl) {
      throw new Error('响度归一化响应缺少 url');
    }
    return {
      success: true,
      outputUrl,
      raw: data,
      mode: 'normalize',
    };
  }

  private buildFormData(input: AudioCleanupInput, extra: Record<string, unknown>): FormData {
    const formData = new FormData();
    if (input.file) {
      formData.append('file', input.file);
    } else if (input.audioUrl) {
      formData.append('audioUrl', input.audioUrl);
    } else {
      throw new Error('AudioCleanupInput 需要提供 file 或 audioUrl');
    }
    for (const [key, value] of Object.entries(extra)) {
      formData.append(key, String(value));
    }
    return formData;
  }

  private async call(path: string, formData: FormData, input: AudioCleanupInput): Promise<any> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getAuthToken() || ''}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`音频处理请求失败 ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    if (!data?.success) {
      throw new Error(data?.error || `音频处理返回失败: ${JSON.stringify(data).slice(0, 200)}`);
    }
    logger.info(`[AudioCleanup] ${path} 处理完成`, {
      hasFile: Boolean(input.file),
      hasUrl: Boolean(input.audioUrl),
    });
    return data;
  }
}

export const audioCleanupService = new AudioCleanupService();
