import { BaseProvider, DEFAULT_ENDPOINTS, STANDARD_VIDEO_STATUS_MAP } from './base-provider';
import type { ApiProviderConfig, GenerationResult, VideoParams } from '../types/api';

const KLING_30_TURBO = 'kling-3.0-turbo';
const KLING_30_OMNI = 'kling-3.0';
const OMNI_ALIASES = new Set([KLING_30_OMNI, 'kling-3.0-omni', 'kling-v3-omni']);

function normalizeResolution(value: unknown, supports4k: boolean): '720p' | '1080p' | '4k' {
  const normalized = String(value || '').trim().toLowerCase();
  if (supports4k && (normalized === '4k' || normalized === '2160p')) return '4k';
  if (normalized === '1080p' || normalized === 'pro') return '1080p';
  return '720p';
}

function clampDuration(value: unknown): number {
  const duration = Math.round(Number(value) || 5);
  return Math.min(15, Math.max(3, duration));
}

function normalizeBaseUrl(config: ApiProviderConfig): string {
  const raw = config.endpoint || DEFAULT_ENDPOINTS.kling;
  return raw
    .replace(/\/$/, '')
    .replace(/\/image-to-video\/kling-3\.0(?:-turbo)?$/, '')
    .replace(/\/tasks$/, '');
}

export class KlingProvider extends BaseProvider {
  readonly name = 'kling';
  readonly supportedModes = ['image_to_video', 'first_last_frame'];

  protected getDefaultEndpoint(): string {
    return DEFAULT_ENDPOINTS.kling;
  }

  async generateVideo(params: VideoParams, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const requestedModel = String(params.model || KLING_30_OMNI).trim().toLowerCase();
      const isTurbo = requestedModel === KLING_30_TURBO;
      const isOmni = OMNI_ALIASES.has(requestedModel);
      if (!isTurbo && !isOmni) {
        return this.makeFailedTaskResult('', new Error(`不支持的可灵旗舰模型: ${requestedModel}`));
      }

      const firstFrame = params.firstFrameUrl || params.imageUrl || params.startImage;
      const lastFrame = params.lastFrameUrl || params.endImage;
      if (!firstFrame) {
        return this.makeFailedTaskResult('', new Error('Kling 3.0 图生视频必须提供首帧图片'));
      }
      if (isTurbo && lastFrame) {
        return this.makeFailedTaskResult('', new Error('Kling 3.0 Turbo 暂不支持尾帧，请改用 Kling 3.0 / 3.0 Omni'));
      }

      const prompt = String(params.prompt || '').trim();
      if (!prompt) {
        return this.makeFailedTaskResult('', new Error('Kling 3.0 图生视频必须提供提示词'));
      }
      if (prompt.length > 2500) {
        return this.makeFailedTaskResult('', new Error('Kling 3.0 提示词不能超过 2500 个字符'));
      }

      const contents: Array<Record<string, unknown>> = [
        { type: 'prompt', text: prompt },
        { type: 'first_frame', url: firstFrame },
      ];
      if (isOmni && lastFrame) contents.push({ type: 'last_frame', url: lastFrame });

      const settings: Record<string, unknown> = {
        resolution: normalizeResolution(params.pixelResolution || params.resolution, isOmni),
        duration: clampDuration(params.duration),
      };
      if (isOmni) {
        settings.audio = params.generateAudio ? 'native' : 'off';
        // 镜头路径控制器要求一个连续镜头；只有用户显式开启时才允许多镜头。
        settings.multi_shot = params.multiShot === true;
      }

      const options: Record<string, unknown> = {
        watermark_info: { enabled: params.watermark === true },
      };
      if (params.callbackUrl) options.callback_url = params.callbackUrl;

      const endpoint = `${normalizeBaseUrl(config)}/image-to-video/${isTurbo ? KLING_30_TURBO : KLING_30_OMNI}`;
      const data = await this.apiPost(endpoint, { contents, settings, options }, this.getAuthHeaders(config));
      if (data?.code !== 0 || !data?.data?.id) {
        throw new Error(data?.message || 'Kling API 未返回任务 ID');
      }

      return this.makePendingResult(String(data.data.id), isTurbo ? KLING_30_TURBO : KLING_30_OMNI, data);
    } catch (error: unknown) {
      return this.handleProviderError(error);
    }
  }

  async getTaskStatus(taskId: string, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const endpoint = `${normalizeBaseUrl(config)}/tasks?task_ids=${encodeURIComponent(taskId)}`;
      const data = await this.apiGetWithRetry(endpoint, this.getAuthHeaders(config));
      if (data?.code !== 0) throw new Error(data?.message || 'Kling 任务查询失败');
      const task = Array.isArray(data?.data) ? data.data[0] : undefined;
      if (!task) throw new Error('Kling 任务不存在');
      const video = Array.isArray(task.outputs)
        ? task.outputs.find((output: Record<string, unknown>) => output?.type === 'video')
        : undefined;
      const status = this.mapStatus(String(task.status || 'processing'), STANDARD_VIDEO_STATUS_MAP);
      return {
        taskId,
        status,
        provider: this.name,
        progress: status === 'completed' ? 100 : status === 'processing' ? 50 : 0,
        result: video
          ? {
              url: video.url,
              videoUrl: video.url,
              metadata: { ...data, task },
            }
          : { metadata: { ...data, task } },
        error: status === 'failed' ? String(task.message || data.message || 'Kling 视频生成失败') : undefined,
      };
    } catch (error: unknown) {
      return this.makeFailedTaskResult(taskId, error);
    }
  }
}
