import { BaseProvider } from './base-provider';
import { VideoParams, ImageParams, GenerationResult, ApiProviderConfig } from '../types/api';
import { logger } from '../utils/logger';
import axios from 'axios';

export type WuyinkejiVideoModelDefinition = {
  id: string;
  label: string;
  endpoint: string;
  probeBody: Record<string, unknown>;
};

export const WUYINKEJI_AI_VIDEO_MODELS: WuyinkejiVideoModelDefinition[] = [
  {
    id: 'Wan2.7',
    label: 'Wan2.7',
    endpoint: '/api/async/video_wan2.6',
    probeBody: { prompt: 'test', resolution: '1080P', duration: '5', ratio: '16:9' },
  },
  {
    id: 'video_seedance',
    label: 'Seedance 2.0',
    endpoint: '/api/async/video_seedance',
    probeBody: { prompt: 'test', ratio: '16:9', resolution: '720p', duration: '5' },
  },
  {
    id: 'video_vidu',
    label: 'Vidu Q3',
    endpoint: '/api/async/video_vidu',
    probeBody: { prompt: 'test', aspectRatio: '16:9', resolution: '720p', duration: '5' },
  },
  {
    id: 'video_omni',
    label: '可灵 Omni',
    endpoint: '/api/async/video_omni',
    probeBody: { prompt: 'test', aspectRatio: '9:16', resolution: 'pro', duration: '5', sound: 'on' },
  },
  {
    id: 'Digital_Humans',
    label: '数字人对口型 (小天)',
    endpoint: '/api/async/video_digital_humans',
    probeBody: { videoName: 'test', audioUrl: 'https://example.com/test.mp3' },
  },
  {
    id: 'Package_1.0',
    label: '视频字幕包装 (小天)',
    endpoint: '/api/async/video_package',
    probeBody: { video: 'https://example.com/test.mp4', template_id: '1' },
  },
];

export const WUYINKEJI_VIDEO_MODEL_ENDPOINTS = Object.fromEntries(
  WUYINKEJI_AI_VIDEO_MODELS.map((item) => [item.id, item.endpoint])
) as Record<string, string>;

export class WuyinkejiProvider extends BaseProvider {
  readonly name: string = 'wuyinkeji';
  readonly supportedModes = ['text_to_image', 'image_to_image', 'text_to_video', 'image_to_video', 'digital_human', 'subtitle'];

  private static readonly IMAGE_MODEL_ENDPOINTS: Record<string, string> = {
    'Wan2.7_image': '/api/async/image_wan2.6',
    'Wan2.6': '/api/async/image_wan2.6',
  };

  private static readonly VIDEO_MODEL_ENDPOINTS: Record<string, string> = {
    'Wan2.6_video': '/api/async/video_wan2.6',
    Digital_Humans: '/api/async/video_digital_humans',
    'Package_1.0': '/api/async/video_package',
    video_upscale: '/api/async/video_processing',
    ...WUYINKEJI_VIDEO_MODEL_ENDPOINTS,
  };

  private static readonly FORM_URL_ENCODED_MODELS = new Set(['Wan2.7_image', 'Wan2.6']);

  private static readonly POLL_STATUS = { INIT: 0, PROCESSING: 1, SUCCESS: 2, FAILED: 3 } as const;

  protected getDefaultEndpoint(): string {
    return 'https://api.wuyinkeji.com';
  }

  protected override getAuthHeaders(config: ApiProviderConfig): Record<string, string> {
    return {
      Authorization: config.apiKey || '',
      'Content-Type': 'application/json',
    };
  }

  private normalizeReferenceImages(primaryUrl?: string, referenceImages?: unknown): string[] {
    const urls = [
      primaryUrl,
      ...(Array.isArray(referenceImages) ? referenceImages : []),
    ]
      .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
      .map((url) => url.trim());
    return Array.from(new Set(urls));
  }

  private static findEndpoint(endpoints: Record<string, string>, model: string): string | undefined {
    if (endpoints[model]) return endpoints[model];
    const lower = model.toLowerCase();
    for (const key of Object.keys(endpoints)) {
      if (key.toLowerCase() === lower) return endpoints[key];
    }
    return undefined;
  }

  private static findEndpointKey(endpoints: Record<string, string>, model: string): string | undefined {
    if (endpoints[model]) return model;
    const lower = model.toLowerCase();
    for (const key of Object.keys(endpoints)) {
      if (key.toLowerCase() === lower) return key;
    }
    return undefined;
  }

  private resolveAspectRatio(params: ImageParams, fallback = '1:1'): string {
    const p = params as any;
    const value = String(params.resolution || p.aspectRatio || '').trim();
    return value || fallback;
  }

  private appendReferenceUrls(body: Record<string, any>, key: string, urls: string[], maxCount: number): void {
    if (urls.length > 0) {
      body[key] = urls.slice(0, maxCount);
    }
  }

  async generateImage(params: ImageParams, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const model = params.model || 'Wan2.7_image';

      const endpoint = this.getEndpoint(config);
      const apiPath = WuyinkejiProvider.findEndpoint(WuyinkejiProvider.IMAGE_MODEL_ENDPOINTS, model);

      if (!apiPath) {
        return this.makeFailedTaskResult('', new Error(`不支持的小天图片模型: ${model}, 支持的模型: ${Object.keys(WuyinkejiProvider.IMAGE_MODEL_ENDPOINTS).join(', ')}`));
      }

      const canonicalModel = WuyinkejiProvider.findEndpointKey(WuyinkejiProvider.IMAGE_MODEL_ENDPOINTS, model) || model;
      const body = this.buildImageBody(canonicalModel, params);

      logger.info(`[Wuyinkeji] 提交图片任务: model=${model}`);
      const isFormUrlEncoded = WuyinkejiProvider.FORM_URL_ENCODED_MODELS.has(model);
      let submitData: any;
      if (isFormUrlEncoded) {
        const formHeaders: Record<string, string> = {
          Authorization: config.apiKey || '',
          'Content-Type': 'application/x-www-form-urlencoded',
        };
        const formParams = new URLSearchParams();
        for (const [key, value] of Object.entries(body)) {
          if (Array.isArray(value)) {
            formParams.append(key, JSON.stringify(value));
          } else if (typeof value === 'boolean') {
            formParams.append(key, value ? 'true' : 'false');
          } else {
            formParams.append(key, String(value));
          }
        }
        submitData = await this.apiPostForm(`${endpoint}${apiPath}`, formParams.toString(), formHeaders);
      } else {
        submitData = await this.apiPost(`${endpoint}${apiPath}`, body, this.getAuthHeaders(config));
      }

      if (submitData.code !== 200) {
        const errMsg = submitData.msg || `HTTP ${submitData.code || '未知'}`;
        const isChannelUnavailable = typeof errMsg === 'string' && errMsg.includes('No available channel');
        const detail = submitData.code === 400 && !submitData.msg
          ? '请求参数错误或模型暂不可用(400)'
          : isChannelUnavailable
            ? `${errMsg}（该模型当前无可用通道，请切换其他模型重试）`
            : errMsg;
        return this.makeFailedTaskResult('', new Error(`小天API提交失败: ${detail}`));
      }

      const taskId = submitData.data?.id;
      if (!taskId) {
        return this.makeFailedTaskResult('', new Error('小天API未返回任务ID'));
      }

      const isPosterRequest = params.source === 'poster';
      // 海报请求 maxAttempts=140（约7分钟），其他模型=80
      const maxAttempts = isPosterRequest ? 140 : 80;
      logger.info(`[Wuyinkeji] 图片任务已提交: taskId=${taskId}, source=${params.source || 'image'}, maxWait=${Math.round((maxAttempts * 3000) / 1000)}s, 开始轮询...`);
      return this.pollForResult(endpoint, config.apiKey!, taskId, model, 'image', maxAttempts, 3000);
    } catch (error: unknown) {
      logger.error(`[Wuyinkeji] 图片生成失败:`, error);
      return this.handleProviderError(error);
    }
  }

  async generateVideo(params: VideoParams, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const model = params.model || 'Wan2.7';
      const canonicalModel = WuyinkejiProvider.findEndpointKey(WuyinkejiProvider.VIDEO_MODEL_ENDPOINTS, model) || model;

      const endpoint = this.getEndpoint(config);
      const apiPath = WuyinkejiProvider.findEndpoint(WuyinkejiProvider.VIDEO_MODEL_ENDPOINTS, model);

      if (!apiPath) {
        return this.makeFailedTaskResult('', new Error(`小天API不支持视频模型: ${model}, 支持的模型: ${Object.keys(WuyinkejiProvider.VIDEO_MODEL_ENDPOINTS).join(', ')}`));
      }

      const body = this.buildVideoBody(canonicalModel, params);

      logger.info(`[Wuyinkeji] 提交视频任务: model=${model}`);
      let submitData: any;
      try {
        submitData = await this.apiPost(`${endpoint}${apiPath}`, body, this.getAuthHeaders(config));
      } catch (submitError: any) {
        // HTTP 502 等异常场景：检查是否为"未绑定参数"错误，自动去除问题参数后重试
        const errText = String(submitError?.response?.data?.msg || submitError?.message || '');
        const unboundMatch = errText.match(/未绑定的参数[:：]\s*(\w+)/);
        if (unboundMatch) {
          const badParam = unboundMatch[1];
          logger.warn(`[Wuyinkeji] 视频提交失败，检测到未绑定参数 "${badParam}"，自动去除后重试: model=${model}`);
          const retryBody = { ...body };
          delete retryBody[badParam];
          submitData = await this.apiPost(`${endpoint}${apiPath}`, retryBody, this.getAuthHeaders(config));
        } else {
          throw submitError;
        }
      }
      // HTTP 200 但 code !== 200 场景：检查是否为"未绑定参数"错误，自动去除问题参数后重试
      if (submitData.code !== 200) {
        const errMsg = String(submitData.msg || '');
        const unboundMatch = errMsg.match(/未绑定的参数[:：]\s*(\w+)/);
        if (unboundMatch) {
          const badParam = unboundMatch[1];
          if (body[badParam] !== undefined) {
            logger.warn(`[Wuyinkeji] 视频提交返回错误，检测到未绑定参数 "${badParam}"，自动去除后重试: model=${model}`);
            const retryBody = { ...body };
            delete retryBody[badParam];
            submitData = await this.apiPost(`${endpoint}${apiPath}`, retryBody, this.getAuthHeaders(config));
          }
        }
      }

      if (submitData.code !== 200) {
        const errMsg = submitData.msg || `HTTP ${submitData.code || '未知'}`;
        const isChannelUnavailable = typeof errMsg === 'string' && errMsg.includes('No available channel');
        const detail = submitData.code === 400 && !submitData.msg
          ? '请求参数错误或模型暂不可用(400)'
          : isChannelUnavailable
            ? `${errMsg}（该模型当前无可用通道，请切换其他模型重试）`
            : errMsg;
        return this.makeFailedTaskResult('', new Error(`小天API视频提交失败: ${detail}`));
      }

      const taskId = submitData.data?.id;
      if (!taskId) {
        return this.makeFailedTaskResult('', new Error('小天API未返回任务ID'));
      }

      logger.info(`[Wuyinkeji] 视频任务已提交: taskId=${taskId}, model=${canonicalModel}, 开始轮询...`);
      return this.pollForResult(endpoint, config.apiKey!, taskId, model, 'video', 200, 5000);
    } catch (error: unknown) {
      logger.error(`[Wuyinkeji] 视频生成失败:`, error);
      return this.handleProviderError(error);
    }
  }

  async generateVideoUpscale(videoUrl: string, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const endpoint = this.getEndpoint(config);
      const apiPath = '/api/async/video_processing';
      const body = { video_url: videoUrl };

      logger.info(`[Wuyinkeji] 提交视频超分任务: videoUrl=${videoUrl}`);
      const submitData = await this.apiPost(`${endpoint}${apiPath}`, body, this.getAuthHeaders(config));

      if (submitData.code !== 200) {
        const errMsg = submitData.msg || `HTTP ${submitData.code || '未知'}`;
        return this.makeFailedTaskResult('', new Error(`小天API视频超分提交失败: ${errMsg}`));
      }

      const taskId = submitData.data?.id;
      if (!taskId) {
        return this.makeFailedTaskResult('', new Error('小天API未返回任务ID'));
      }

      logger.info(`[Wuyinkeji] 视频超分任务已提交: taskId=${taskId}, 开始轮询...`);
      return this.pollForResult(endpoint, config.apiKey!, taskId, 'video_upscale', 'video', 200, 5000);
    } catch (error: unknown) {
      logger.error(`[Wuyinkeji] 视频超分失败:`, error);
      return this.handleProviderError(error);
    }
  }

  async getTaskStatus(taskId: string, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const endpoint = this.getEndpoint(config);
      const pollData = await this.apiGetWithRetry(
        `${endpoint}/api/async/detail?key=${config.apiKey}&id=${taskId}`,
        { 'Content-Type': 'application/json' },
        30000,
        2,
        1000,
      );

      return this.parsePollResponse(taskId, pollData, 'unknown');
    } catch (error: unknown) {
      return this.handleProviderError(error);
    }
  }

  private buildImageBody(model: string, params: ImageParams): Record<string, any> {
    const body: Record<string, any> = { prompt: params.prompt };
    const p = params as any;
    const referenceImages = this.normalizeReferenceImages(params.referenceImageUrl, p.referenceImages);

    switch (model) {
      case 'Wan2.7_image':
      case 'Wan2.6':
        body.size = p.size || this.resolveImageSize(params.resolution || p.aspectRatio, '1280*1280');
        if (p.negativePrompt) body.negative_prompt = p.negativePrompt;
        if (p.promptEnhancer !== undefined) body.prompt_extend = p.promptEnhancer;
        if (p.watermark !== undefined) body.watermark = p.watermark;
        if (p.seed !== undefined && p.seed !== -1) body.seed = String(p.seed);
        this.appendReferenceUrls(body, 'urls', referenceImages, 4);
        break;
    }

    return body;
  }

  private resolveImageSize(aspectRatio: string | undefined, fallback: string): string {
    const sizeMap: Record<string, string> = {
      '1:1': '1280*1280',
      '16:9': '1280*720',
      '9:16': '720*1280',
      '4:3': '1280*960',
      '3:4': '960*1280',
    };
    return aspectRatio && sizeMap[aspectRatio] ? sizeMap[aspectRatio] : fallback;
  }

  private resolveVideoSize(params: VideoParams, fallback: string): string {
    const p = params as any;
    if (p.size) return String(p.size);

    const aspectRatio = String(params.aspectRatio || p.ratio || '16:9');
    const resolution = String(params.resolution || '').toLowerCase();
    const isPortrait = aspectRatio === '9:16' || aspectRatio === '3:4' || aspectRatio.toLowerCase().includes('portrait');

    if (resolution.includes('1080') || resolution.includes('4k')) {
      return isPortrait ? '1080x1920' : '1920x1080';
    }

    if (resolution.includes('720') || resolution.includes('768')) {
      return isPortrait ? '720x1280' : '1280x720';
    }

    return fallback;
  }

  private buildVideoBody(model: string, params: VideoParams): Record<string, any> {
    const body: Record<string, any> = {};
    const p = params as any;

    switch (model) {
      case 'Digital_Humans':
        body.videoName = p.videoName || 'digital_human';
        if (p.audioUrl) body.audioUrl = p.audioUrl;
        if (p.videoUrl) body.videoUrl = p.videoUrl;
        if (p.avatarId) body.avatarId = p.avatarId;
        if (p.avatarName) body.avatarName = p.avatarName;
        if (p.avatarImageUrl) body.avatarImageUrl = p.avatarImageUrl;
        if (params.aspectRatio) body.aspectRatio = params.aspectRatio;
        if (params.resolution) body.resolution = params.resolution;
        if (typeof p.lipSyncStrength === 'number') body.lipSyncStrength = p.lipSyncStrength;
        if (p.language) body.language = p.language;
        if (!body.audioUrl && !body.videoUrl) {
          throw new Error('Digital_Humans 需要提供 audioUrl 或 videoUrl');
        }
        break;

      case 'Package_1.0':
        body.video = p.videoUrl || p.video;
        if (!body.video) {
          throw new Error('Package_1.0 需要提供 video');
        }
        if (p.templateId) body.template_id = String(p.templateId);
        if (p.language) body.language = p.language;
        break;

      case 'google_omni':
        // 已废弃：google_omni 为国外 Google 模型，已下线。
        // 保留 case 仅用于向后兼容旧任务查询，不再构造请求体。
        body.prompt = params.prompt || '';
        body.size = this.resolveVideoSize(params, '1280x720');
        if (params.duration) body.duration = String(params.duration);
        else body.duration = '4';
        break;

      case 'veo3.1_fast':
        // 已废弃：veo3.1_fast 为国外 Google Veo 模型，已下线。
        body.prompt = params.prompt || '';
        body.aspectRatio = params.aspectRatio || '16:9';
        body.duration = String([4, 6, 8].includes(Number(params.duration)) ? Number(params.duration) : 8);
        break;

      case 'Wan2.6_video':
      case 'Wan2.7':
        body.prompt = params.prompt || '';
        if (p.resolution) body.resolution = p.resolution;
        else body.resolution = model === 'Wan2.7' ? '1080P' : '720P';
        if (params.duration) body.duration = String(params.duration);
        else body.duration = '5';
        if (p.negativePrompt) body.negative_prompt = p.negativePrompt;
        if (p.audioUrl) body.audio_url = p.audioUrl;
        else if (p.referenceAudios?.length) body.audio_url = p.referenceAudios[0];
        if (p.firstFrameUrl || params.imageUrl) body.firstFrameUrl = p.firstFrameUrl || params.imageUrl;
        if (p.promptExtend !== undefined) body.prompt_extend = String(p.promptExtend);
        if (p.shotType) body.shot_type = p.shotType;
        // Wan2.7 文档不支持 watermark 参数
        if (p.seed !== undefined) body.seed = String(p.seed);
        if (p.ratio || params.aspectRatio) body.ratio = p.ratio || params.aspectRatio;
        {
          const refUrls: string[] = [];
          if (typeof p.urls === 'string' && p.urls.trim()) {
            body.urls = p.urls.trim();
            break;
          }
          if (p.referenceImages?.length) refUrls.push(...p.referenceImages);
          if (params.videoUrl) refUrls.push(params.videoUrl);
          if (p.videoUrl) refUrls.push(p.videoUrl);
          if (p.referenceVideos?.length) refUrls.push(...p.referenceVideos);
          if (refUrls.length > 0) body.urls = refUrls.slice(0, 5).join(',');
        }
        break;

      case 'sora2':
      case 'Sora2':
      case 'video_sora2':
        // 已废弃：sora2 为国外 OpenAI Sora 模型，已下线。保留 case 仅用于向后兼容旧任务查询。
        body.prompt = params.prompt || '';
        body.aspectRatio = params.aspectRatio || p.ratio || '9:16';
        if (p.url || params.imageUrl || p.firstFrameUrl) body.url = p.url || params.imageUrl || p.firstFrameUrl;
        if (params.duration) body.duration = String(params.duration);
        else body.duration = '12';
        body.size = p.size || params.resolution || 'small';
        if (p.remixTargetId) body.remixTargetId = String(p.remixTargetId);
        break;

      case 'video_vidu':
        body.prompt = params.prompt || '';
        body.aspectRatio = params.aspectRatio || '16:9';
        // resolution: 枚举 540p/720p/1080p，默认720p
        if (p.resolution) body.resolution = p.resolution;
        else body.resolution = '720p';
        // duration: 枚举1-10，默认5
        if (params.duration) body.duration = String(Math.min(10, Math.max(1, Number(params.duration))));
        else body.duration = '5';
        // bgm: 默认false
        if (p.bgm !== undefined) body.bgm = p.bgm ? 'true' : 'false';
        // watermark: 默认1(添加)
        if (p.watermark !== undefined) body.watermark = p.watermark ? '1' : '0';
        {
          // subjects: 主体图片1-7张
          if (p.subjects?.length) body.subjects = p.subjects.slice(0, 7).join(',');
          // image_url: 参考图1-7张
          const refImgs: string[] = [];
          if (params.imageUrl) refImgs.push(params.imageUrl);
          if (p.referenceImages?.length) refImgs.push(...p.referenceImages);
          if (refImgs.length > 0) body.image_url = refImgs.slice(0, 7).join(',');
          // video_url: 参考视频1-2个
          const videoRefs: string[] = [];
          if (params.videoUrl) videoRefs.push(params.videoUrl);
          if (p.videoUrl) videoRefs.push(p.videoUrl);
          if (p.referenceVideos?.length) videoRefs.push(...p.referenceVideos);
          if (videoRefs.length > 0) body.video_url = videoRefs.slice(0, 2).join(',');
        }
        break;

      case 'video_omni':
        body.prompt = params.prompt || '';
        body.aspectRatio = params.aspectRatio || '16:9';
        // resolution: 枚举 std/pro/4k，默认pro（不是720p/1080p）
        if (p.resolution && ['std', 'pro', '4k'].includes(String(p.resolution))) {
          body.resolution = String(p.resolution);
        } else {
          body.resolution = 'pro';
        }
        // sound: on/off，默认on
        if (p.sound) body.sound = p.sound;
        else if (p.generateAudio !== undefined) body.sound = p.generateAudio ? 'on' : 'off';
        else body.sound = 'on';
        // duration: 枚举3-15，默认5
        if (params.duration) body.duration = String(Math.min(15, Math.max(3, Number(params.duration))));
        else body.duration = '5';
        // watermark: 默认1(添加)
        if (p.watermark !== undefined) body.watermark = p.watermark ? '1' : '0';
        // firstFrameUrl / lastFrameUrl
        if (p.firstFrameUrl || params.imageUrl) body.firstFrameUrl = p.firstFrameUrl || params.imageUrl;
        if (p.lastFrameUrl) body.lastFrameUrl = p.lastFrameUrl;
        {
          // image_url: 参考图，逗号分隔
          const refImgs: string[] = [];
          if (params.imageUrl && !body.firstFrameUrl) refImgs.push(params.imageUrl);
          if (p.referenceImages?.length) refImgs.push(...p.referenceImages);
          if (refImgs.length > 0) body.image_url = refImgs.join(',');
          // video_url: 参考视频1段，有视频时sound=off
          const videoRefs: string[] = [];
          if (params.videoUrl) videoRefs.push(params.videoUrl);
          if (p.videoUrl) videoRefs.push(p.videoUrl);
          if (p.referenceVideos?.length) videoRefs.push(...p.referenceVideos);
          if (videoRefs.length > 0) {
            body.video_url = videoRefs.slice(0, 1).join(',');
            body.sound = 'off';
          }
        }
        // video_omni(可灵Omni) 文档不支持 negative_prompt 和 seed
        break;

      case 'video_seedance':
        body.prompt = params.prompt || '';
        body.ratio = params.aspectRatio || 'adaptive';
        if (p.resolution) body.resolution = p.resolution;
        else body.resolution = '720p';
        if (params.duration) body.duration = String(params.duration);
        else body.duration = '5';
        // Seedance 2.0 文档仅支持 prompt/firstFrameUrl/lastFrameUrl/image_url/ratio/resolution/video_url/audio_url/duration
        // 不支持 prompt_extend、negative_prompt、seed
        if (p.firstFrameUrl || params.imageUrl) body.firstFrameUrl = p.firstFrameUrl || params.imageUrl;
        if (p.lastFrameUrl) body.lastFrameUrl = p.lastFrameUrl;
        {
          const refImgs: string[] = [];
          if (params.imageUrl && !body.firstFrameUrl) refImgs.push(params.imageUrl);
          // 修复：seedance ti2vid 图生视频只支持 1 张图，当已有 firstFrameUrl 时不再添加 referenceImages
          // 首尾帧模式通过 firstFrameUrl + lastFrameUrl 传递，不通过 image_url
          if (!body.firstFrameUrl && p.referenceImages?.length) refImgs.push(...p.referenceImages);
          if (refImgs.length > 0) body.image_url = refImgs.join(',');
          const videoRefs: string[] = [];
          if (params.videoUrl) videoRefs.push(params.videoUrl);
          if (p.videoUrl) videoRefs.push(p.videoUrl);
          if (p.referenceVideos?.length) videoRefs.push(...p.referenceVideos);
          if (videoRefs.length > 0) body.video_url = videoRefs.join(',');
          const audioRefs: string[] = [];
          if (p.audioUrl) audioRefs.push(p.audioUrl);
          if (p.referenceAudios?.length) audioRefs.push(...p.referenceAudios);
          if (audioRefs.length > 0) body.audio_url = audioRefs.join(',');
        }
        break;

      default:
        body.prompt = params.prompt || '';
        if (params.duration) body.duration = String(params.duration);
        if (params.aspectRatio) body.aspect_ratio = params.aspectRatio;
        {
          const imageUrls: string[] = [];
          if (params.imageUrl) imageUrls.push(params.imageUrl);
          if (params.firstFrameUrl && params.firstFrameUrl !== params.imageUrl) {
            imageUrls.push(params.firstFrameUrl);
          }
          if (p.referenceImages?.length) imageUrls.push(...p.referenceImages);
          if (imageUrls.length > 0) body.image_urls = imageUrls;
        }
        break;
    }

    return body;
  }

  private async pollForResult(
    endpoint: string,
    apiKey: string,
    taskId: string,
    model: string,
    type: 'image' | 'video',
    maxAttempts: number,
    interval: number,
  ): Promise<GenerationResult> {
    // 跟踪最近一次轮询是否因网络错误未能确认 provider 状态。
    // 若轮询耗尽且最后一次是网络错误，返回 processing 交由后台轮询器兜底，
    // 避免因网络抖动丢失 provider 已实际生成的结果。
    let lastContactReachable = true;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, interval));

      let pollData: any;
      try {
        pollData = await this.apiGetWithRetry(
          `${endpoint}/api/async/detail?key=${apiKey}&id=${taskId}`,
          { 'Content-Type': 'application/json' },
          30000,
          2,
          1000,
        );
        lastContactReachable = true;
      } catch (error: unknown) {
        // 网络错误：不中断整个轮询，交由下一轮继续尝试
        lastContactReachable = false;
        logger.warn(`[Wuyinkeji] ${type}轮询网络错误: taskId=${taskId}, attempt=${attempt}, err=${error instanceof Error ? error.message : String(error)}`);
        continue;
      }

      const result = this.parsePollResponse(taskId, pollData, model);

      if (result.status === 'completed' || result.status === 'failed') {
        return result;
      }

      if (attempt % 10 === 0) {
        logger.info(`[Wuyinkeji] ${type}轮询中: taskId=${taskId}, attempt=${attempt}, status=${result.status}`);
      }
    }

    const timeoutSeconds = Math.round((maxAttempts * interval) / 1000);
    // 网络原因导致未能确认结果：返回 processing 让后台轮询器继续捞取，避免丢失已生成的结果
    if (!lastContactReachable) {
      logger.warn(`[Wuyinkeji] ${type}轮询因网络错误耗尽: taskId=${taskId}, 返回 processing 交由后台兜底`);
      return {
        taskId,
        status: 'processing',
        progress: 10,
        provider: 'wuyinkeji',
        model,
        error: `网络异常，已生成结果可能未接收，后台将继续尝试（${timeoutSeconds}秒）`,
      };
    }
    return this.makeFailedTaskResult(
      taskId,
      new Error(`小天API生成超时：${timeoutSeconds}秒内未返回结果，请重试或切换其它图片模型`)
    );
  }

  private parsePollResponse(taskId: string, pollData: any, model: string): GenerationResult {
    const pollResult = pollData.data;
    const taskStatus = pollResult?.status;
    const taskResult = pollResult?.result;

    // 处理API返回业务错误的情况：data为空数组[]或code非200
    if (!pollResult || Array.isArray(pollResult) || typeof taskStatus === 'undefined') {
      const errMsg = pollData.msg || pollResult?.message || '未知错误';
      if (pollData.code === 400 || (Array.isArray(pollResult) && pollResult.length === 0)) {
        return this.makeFailedTaskResult(taskId, new Error(`小天API查询失败: ${errMsg}`));
      }
      // data为null或status未定义，可能是临时异常，返回processing让轮询继续
      return { taskId, status: 'processing', progress: 10, provider: 'wuyinkeji' };
    }

    if (taskStatus === WuyinkejiProvider.POLL_STATUS.SUCCESS ||
        taskStatus === WuyinkejiProvider.POLL_STATUS.PROCESSING) {
      let resultUrl = '';

      if (typeof taskResult === 'string' && taskResult.startsWith('http')) {
        resultUrl = taskResult;
      } else if (Array.isArray(taskResult) && taskResult.length > 0) {
        resultUrl = typeof taskResult[0] === 'string' ? taskResult[0] : taskResult[0]?.url || '';
      } else if (typeof taskResult === 'object' && taskResult !== null) {
        resultUrl = taskResult.url || taskResult.video_url || taskResult.videoUrl
          || taskResult.output || taskResult.image_url || taskResult.image || '';
        if (!resultUrl && Array.isArray(taskResult.images) && taskResult.images.length > 0) {
          resultUrl = typeof taskResult.images[0] === 'string' ? taskResult.images[0] : taskResult.images[0]?.url || '';
        }
        if (!resultUrl && Array.isArray(taskResult.videos) && taskResult.videos.length > 0) {
          resultUrl = typeof taskResult.videos[0] === 'string' ? taskResult.videos[0] : taskResult.videos[0]?.url || '';
        }
        if (!resultUrl && Array.isArray(taskResult.results) && taskResult.results.length > 0) {
          resultUrl = typeof taskResult.results[0] === 'string' ? taskResult.results[0] : taskResult.results[0]?.url || '';
        }
      }

      if (!resultUrl) {
        if (taskStatus === WuyinkejiProvider.POLL_STATUS.PROCESSING) {
          return { taskId, status: 'processing', progress: 50, provider: 'wuyinkeji' };
        }
        return this.makeFailedTaskResult(taskId, new Error('小天API生成完成但未返回有效URL'));
      }

      const isVideo = resultUrl.match(/\.(mp4|mov|avi|webm)/i) ||
        model.includes('video') || model === 'Digital_Humans' || model === 'Package_1.0' ||
        ['Wan2.6_video', 'Wan2.7'].includes(model);

      logger.info(`[Wuyinkeji] 生成成功: model=${model}, url=${resultUrl.substring(0, 80)}...`);
      return {
        taskId,
        status: 'completed',
        progress: 100,
        result: isVideo
          ? { videoUrl: resultUrl, url: resultUrl }
          : { imageUrl: resultUrl, url: resultUrl },
        model,
        provider: 'wuyinkeji',
      };
    } else if (taskStatus === WuyinkejiProvider.POLL_STATUS.FAILED) {
      return this.makeFailedTaskResult(taskId, new Error(`小天API生成失败: ${pollResult?.message || pollData.msg || '未知错误'}`));
    } else if (taskStatus !== 0 && taskStatus !== 1 && taskStatus !== 2) {
      return this.makeFailedTaskResult(taskId, new Error(`小天API异常状态: ${taskStatus}, ${pollResult?.message || ''}`));
    }

    return {
      taskId,
      status: 'processing',
      progress: Math.min(90, taskStatus === 0 ? 10 : 50),
      provider: 'wuyinkeji',
    };
  }

  private async apiPostForm(url: string, formBody: string, headers: Record<string, string>, timeout: number = 300000): Promise<any> {
    try {
      const response = await axios.post(url, formBody, { headers, timeout });
      return response.data;
    } catch (error: unknown) {
      const errAxios = error as any;
      if (errAxios?.response) {
        logger.error(`[Wuyinkeji] API POST FORM ${url} failed with ${errAxios.response.status}:`, JSON.stringify(errAxios.response.data, null, 2));
      } else {
        logger.error(`[Wuyinkeji] API POST FORM ${url} failed:`, (error instanceof Error ? error.message : String(error)));
      }
      throw error;
    }
  }
}
