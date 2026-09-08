import { BaseProvider, DEFAULT_ENDPOINTS, STANDARD_VIDEO_STATUS_MAP } from './base-provider';
import { logger } from '../utils/logger';
import { VideoParams, ImageParams, GenerationResult, ApiProviderConfig } from '../types/api';
import { TaskStatus } from '@shared/types';

export class DoubaoProvider extends BaseProvider {
  readonly name = 'doubao';
  readonly supportedModes = [
    'text_to_video',
    'image_to_video',
    'first_last_frame',
    'reference_to_video',
  ];

  protected getDefaultEndpoint(): string {
    return DEFAULT_ENDPOINTS.doubao;
  }

  private getArkBaseEndpoint(config: ApiProviderConfig): string {
    const endpoint = this.getEndpoint(config).replace(/\/$/, '');

    if (endpoint.endsWith('/contents/generations/tasks')) {
      return endpoint.replace(/\/contents\/generations\/tasks$/, '');
    }

    if (endpoint.endsWith('/videos/generations')) {
      return endpoint.replace(/\/videos\/generations$/, '');
    }

    return endpoint;
  }

  async generateVideo(params: VideoParams, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      // 模型 ID 映射
      const MODEL_ID_MAP: Record<string, string> = {
        'doubao-seedance-2-0': 'doubao-seedance-2-0-260128',
        'doubao-seedance-2.0': 'doubao-seedance-2-0-260128',
        'doubao-seedance-2-0-fast': 'doubao-seedance-2-0-260128',
        'doubao-seedance-2.0-fast': 'doubao-seedance-2-0-260128',
        'doubao-seedance-2-0-fast-260128': 'doubao-seedance-2-0-260128',
        'doubao-seedance-1-5-pro': 'doubao-seedance-1-5-pro-251215',
        'doubao-seedance-1-0-pro': 'doubao-seedance-1-0-pro-250528',
        'doubao-seedance-1-0-pro-fast': 'doubao-seedance-1-0-pro-fast-250528',
        'doubao-seedream-5-0-lite': 'doubao-seedream-5-0-260128',
        'doubao-seedream-4-5': 'doubao-seedream-4-5-251128',
      };
      const actualModelId =
        MODEL_ID_MAP[params.model || ''] || params.model || 'doubao-seedance-2-0';

      const isV3 =
        (params.model || '').includes('seedance') ||
        (params.model || '').includes('seedream') ||
        actualModelId.includes('seedance') ||
        actualModelId.includes('seedream') ||
        !actualModelId.startsWith('doubao-');
      const baseEndpoint = isV3 ? this.getArkBaseEndpoint(config) : this.getEndpoint(config);
      const endpoint = isV3
        ? `${baseEndpoint}/contents/generations/tasks`
        : `${baseEndpoint}/videos/generations`;
      const authHeaders = this.getAuthHeaders(config);

      if (isV3) {
        // Seedance V3 API (1.0/1.5/2.0)
        const content = [];
        const promptText = params.prompt?.trim();
        const firstFrameUrl =
          params.firstFrameUrl || params.imageUrl || params.referenceImages?.[0] || undefined;
        const lastFrameUrl =
          params.lastFrameUrl ||
          (params.mode === 'first_last_frame' ? params.referenceImages?.[1] : undefined);
        const wantsAudio =
          params.generateAudio ??
          (typeof params.audioGeneration === 'string' ? params.audioGeneration !== 'none' : false);
        const cameraFixed = (params as VideoParams & { cameraFixed?: boolean }).cameraFixed;
        const watermark = (params as VideoParams & { watermark?: boolean }).watermark;
        const motion =
          (params as VideoParams & { motion?: number }).motion ?? params.motionStrength;

        if (promptText) {
          content.push({ type: 'text', text: promptText });
        }

        // 处理参考内容 (多模态) - 遵循 V3 标准结构 { type: 'image_url', image_url: { url: '...' } }
        if (params.mode === 'first_last_frame') {
          if (firstFrameUrl) {
            content.push({
              type: 'image_url',
              image_url: { url: firstFrameUrl },
              role: 'first_frame',
            });
          }

          if (lastFrameUrl) {
            content.push({
              type: 'image_url',
              image_url: { url: lastFrameUrl },
              role: 'last_frame',
            });
          }
        } else if (
          params.mode === 'image_to_video' ||
          params.mode === 'video_to_video' ||
          !params.mode
        ) {
          if (firstFrameUrl) {
            content.push({
              type: 'image_url',
              image_url: { url: firstFrameUrl },
              role: 'first_frame',
            });
          }
        }

        // 只有在 reference_to_video 模式下才添加 reference_image
        // 注意：image_to_video 模式（ti2vid）只支持 1 张图片，多图会报 "ti2vid supports at most 1 image"
        // image_to_video 模式的首帧已在上方添加为 first_frame，无需再添加 reference_image
        if (params.mode === 'reference_to_video' && params.referenceImages?.length) {
          params.referenceImages.slice(0, 6).forEach((img) => {
            if (img !== firstFrameUrl && img !== lastFrameUrl) {
              content.push({ type: 'image_url', image_url: { url: img }, role: 'reference_image' });
            }
          });
        }

        if (params.referenceVideos?.length) {
          params.referenceVideos.forEach((vid) =>
            content.push({ type: 'video_url', video_url: { url: vid }, role: 'reference_video' })
          );
        }

        if (params.referenceAudios?.length) {
          params.referenceAudios.forEach((aud) =>
            content.push({ type: 'audio_url', audio_url: { url: aud }, role: 'reference_audio' })
          );
        }

        const body: any = {
          model: actualModelId,
          content,
          resolution: params.resolution || '720p',
          ratio: params.aspectRatio || '16:9',
          duration: params.duration ?? 5,
          generate_audio: wantsAudio,
          return_last_frame: params.returnLastFrame === true,
          web_search: params.webSearch === true,
          seed: params.seed !== -1 ? params.seed : undefined,
          watermark: watermark ?? false,
        };

        if (cameraFixed !== undefined) {
          body.camera_fixed = cameraFixed;
        }

        if (motion !== undefined && motion !== -1) {
          body.motion = motion;
        }

        if (params.promptEnhancer === true) {
          body.prompt_enhancer = true;
        }

        if (params.cameraMovement && params.cameraMovement !== 'auto') {
          body.camera_movement = params.cameraMovement;
        }

        if (params.characterConsistency !== undefined && params.characterConsistency > 0) {
          body.character_consistency = params.characterConsistency;
        }

        if (params.styleStrength !== undefined && params.styleStrength > 0) {
          body.style_strength = params.styleStrength;
        }

        if (params.videoPreset) {
          body.video_preset = params.videoPreset;
        }

        if (params.referenceType) {
          body.reference_type = params.referenceType;
        }

        if (params.metaData) {
          body.meta_data = params.metaData;
        }

        if (params.callbackUrl) {
          body.callback_url = params.callbackUrl;
        }

        if (params.payload) {
          body.payload = params.payload;
        }

        // Draft tasks only support 480p. Keep high-res requests on standard mode.
        const normalizedResolution = String(body.resolution || '').toLowerCase();
        const draftResolutionAllowed = normalizedResolution === '480p';
        const enableDraft = draftResolutionAllowed && params.enableDraft !== false;
        if (enableDraft) {
          body.draft = true;
        } else if (params.enableDraft === true && !draftResolutionAllowed) {
          logger.warn(
            `[Doubao] draft disabled for incompatible resolution=${body.resolution}; draft only supports 480p`
          );
        }

        const data = await this.apiPost(endpoint, body, authHeaders);
        return this.buildStandardVideoResult(data.id || data.task_id, actualModelId, data);
      } else {
        // 旧版 API
        const body = this.buildCommonVideoBody(params);
        if (!body.model) body.model = 'doubao-video-v1';

        const dimensions = this.mapResolution(params.resolution, params.pixelResolution);
        if (dimensions) {
          body.dimension = { width: dimensions.width, height: dimensions.height };
        }

        if (
          params.imageUrl &&
          (params.mode === 'image_to_video' || params.mode === 'video_to_video')
        ) {
          body.image_url = params.imageUrl;
        }

        const data = await this.apiPost(endpoint, body, authHeaders);
        return this.buildStandardVideoResult(data.id || data.task_id, params.model, data);
      }
    } catch (error: unknown) {
      return this.handleProviderError(error);
    }
  }

  async generateImage(params: ImageParams, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const modelName = params.model || '';
      const isSeedream = modelName.includes('seedream');

      if (isSeedream) {
        return await this.generateSeedreamImage(params, config);
      }

      const endpoint = this.getEndpoint(config);
      const body = this.buildCommonImageBody(params);
      if (!body.model) body.model = 'doubao-pro-4k';

      const dimensions = this.mapResolution(params.resolution, params.pixelResolution);
      if (dimensions) {
        body.size = `${dimensions.width}x${dimensions.height}`;
      } else if (params.width && params.height) {
        body.size = `${params.width}x${params.height}`;
      } else {
        body.size = '1024x1024';
      }

      if (params.imageCount) body.n = params.imageCount;
      if (params.promptEnhancement !== undefined) body.prompt_optimizer = params.promptEnhancement;
      if (params.hdMode !== undefined) body.hd_mode = params.hdMode;
      if (params.watermark !== undefined) body.watermark = params.watermark;

      const data = await this.apiPost(
        `${endpoint}/images/generations`,
        body,
        this.getAuthHeaders(config)
      );
      return this.buildCompletedImageResult(data.data || [data], params.model, data);
    } catch (error: unknown) {
      return this.handleProviderError(error);
    }
  }

  private async generateSeedreamImage(
    params: ImageParams,
    config: ApiProviderConfig
  ): Promise<GenerationResult> {
    const MODEL_ID_MAP: Record<string, string> = {
      'doubao-seedream-5-0-lite': 'doubao-seedream-5-0-260128',
      'doubao-seedream-5.0-lite': 'doubao-seedream-5-0-260128',
      'doubao-seedream-5-0': 'doubao-seedream-5-0-260128',
      'doubao-seedream-5.0': 'doubao-seedream-5-0-260128',
      'doubao-seedream-5-0-pro': 'doubao-seedream-5-0-pro-260628',
      'doubao-seedream-5.0-pro': 'doubao-seedream-5-0-pro-260628',
      'seedream-5-0-pro': 'doubao-seedream-5-0-pro-260628',
      'seedream-5.0-pro': 'doubao-seedream-5-0-pro-260628',
      'doubao-seedream-4-5': 'doubao-seedream-4-5-251128',
      'doubao-seedream-4.5': 'doubao-seedream-4-5-251128',
      'seedream-5-0-lite': 'doubao-seedream-5-0-260128',
      'seedream-5.0-lite': 'doubao-seedream-5-0-260128',
      'seedream-5-0': 'doubao-seedream-5-0-260128',
      'seedream-5.0': 'doubao-seedream-5-0-260128',
      'seedream-4-5': 'doubao-seedream-4-5-251128',
      'seedream-4.5': 'doubao-seedream-4-5-251128',
      'doubao_seedream_5-0-lite': 'doubao-seedream-5-0-260128',
      'doubao_seedream_4-5': 'doubao-seedream-4-5-251128',
    };
    const actualModelId = MODEL_ID_MAP[params.model] || params.model;
    const isSeedream5Lite =
      actualModelId.includes('5-0-260128') || actualModelId.includes('5-0-lite');
    const isSeedream5Pro = actualModelId.includes('5-0-pro');
    const baseEndpoint = this.getArkBaseEndpoint(config);
    const endpoint = `${baseEndpoint}/images/generations`;
    const imageApiKey = process.env.DOUBAO_IMAGE_KEY || config.apiKey;
    const authHeaders = {
      Authorization: `Bearer ${imageApiKey}`,
      'Content-Type': 'application/json',
    };

    const body: Record<string, any> = {
      model: actualModelId,
      prompt: params.prompt?.trim() || '',
      response_format: 'url',
      watermark: false,
    };

    const maxReferenceImages = isSeedream5Pro ? 10 : 14;
    const referenceImages = Array.from(
      new Set(
        [
          params.referenceImageUrl,
          ...(Array.isArray(params.referenceImages) ? params.referenceImages : []),
        ].filter((url): url is string => typeof url === 'string' && url.length > 0)
      )
    ).slice(0, maxReferenceImages);
    if (referenceImages.length > 0) {
      body.image = referenceImages;
      if (params.mode === 'character_reference') {
        logger.info(
          `[Seedream] 角色参考模式 (character_reference), images: ${referenceImages.length}`
        );
      } else {
        logger.info(`[Seedream] 参考图模式 (image_to_image), images: ${referenceImages.length}`);
      }
    }

    if (params.negativePrompt && !isSeedream5Lite && !isSeedream5Pro) {
      body.negative_prompt = params.negativePrompt;
    }

    const requestedSizeTier = String(
      params.imageSize || params.pixelResolution || ''
    ).toUpperCase();
    const supportedSizeTiers = isSeedream5Pro ? ['1K', '2K'] : ['2K', '3K', '4K'];
    if ((isSeedream5Lite || isSeedream5Pro) && /^\d{3,5}X\d{3,5}$/.test(requestedSizeTier)) {
      body.size = requestedSizeTier.toLowerCase();
    } else if (
      (isSeedream5Lite || isSeedream5Pro) &&
      supportedSizeTiers.includes(requestedSizeTier)
    ) {
      body.size = requestedSizeTier;
      if (params.resolution && params.resolution !== ('auto' as typeof params.resolution)) {
        body.prompt = `${body.prompt}，输出画面宽高比为 ${params.resolution}`;
      }
    } else if (params.resolution) {
      const sizeMap: Record<string, string> = {
        '1:1': '2048x2048',
        '4:3': '2304x1728',
        '3:4': '1728x2304',
        '16:9': '2848x1600',
        '9:16': '1600x2848',
        '9:21': '1296x3024',
        '3:2': '2496x1664',
        '2:3': '1664x2496',
        '21:9': '3136x1344',
      };
      body.size = sizeMap[params.resolution] || '2K';
    } else {
      body.size = '2K';
    }

    if (params.imageCount && params.imageCount > 1 && !isSeedream5Lite && !isSeedream5Pro) {
      body.n = params.imageCount;
    }

    // Seedream 支持 seed 和 guidance_scale (cfg_scale)
    if (params.seed !== undefined && params.seed !== -1 && !isSeedream5Lite && !isSeedream5Pro) {
      body.seed = params.seed;
    }
    // Seedream 5.0 Lite (doubao-seedream-5-0-260128) 不支持 guidance_scale 参数
    // Seedream 5.0 Pro 和 4.5 均支持 guidance_scale
    if (
      params.cfgStrength !== undefined &&
      params.cfgStrength > 0 &&
      !isSeedream5Lite &&
      !isSeedream5Pro
    ) {
      body.guidance_scale = params.cfgStrength;
    }

    const promptOptimizationEnabled =
      params.promptEnhancement ?? params.promptOptimizer ?? params.promptEnhancer;
    if (isSeedream5Lite || isSeedream5Pro) {
      if (promptOptimizationEnabled !== false) {
        body.optimize_prompt_options = {
          mode: isSeedream5Pro && params.seedreamOptimizeMode === 'fast' ? 'fast' : 'standard',
        };
      }
      body.output_format = params.outputFormat === 'png' ? 'png' : 'jpeg';
    } else {
      body.prompt_optimizer = promptOptimizationEnabled ?? false;
    }

    // Group generation, streaming and web search are Lite-only in Seedream 5.0.
    if (isSeedream5Lite && params.sequentialImageGeneration === 'auto') {
      body.sequential_image_generation = 'auto';
      body.sequential_image_generation_options = {
        max_images: Math.min(
          Math.max(1, 15 - referenceImages.length),
          Math.max(1, Number(params.sequentialMaxImages || 6))
        ),
      };
      body.stream = false;
    }
    if (isSeedream5Lite && params.webSearch === true) {
      body.tools = [{ type: 'web_search' }];
    }

    const response = await this.apiPost(endpoint, body, authHeaders);

    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      return this.buildCompletedImageResult(response.data, actualModelId, response);
    }

    const taskId = response.id || response.task_id;
    if (taskId) {
      return {
        taskId,
        status: 'pending',
        provider: this.name,
        model: actualModelId,
      };
    }

    return {
      taskId: '',
      status: 'failed',
      provider: this.name,
      model: actualModelId,
      error: `Seedream 图片生成未返回结果: ${JSON.stringify(response).substring(0, 200)}`,
    };
  }

  async getTaskStatus(taskId: string, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const baseEndpoint = this.getArkBaseEndpoint(config);
      const isV3 = baseEndpoint.includes('ark.cn-beijing.volces.com');
      const endpoint = isV3
        ? `${baseEndpoint}/contents/generations/tasks/${taskId}`
        : `${baseEndpoint}/videos/generations/${taskId}`;

      const data = await this.apiGetWithRetry(
        endpoint,
        this.getAuthHeaders(config),
        30000,
        2,
        1000
      );

      if (isV3) {
        // V3 响应处理
        const statusMap = {
          queued: 'pending',
          running: 'processing',
          succeeded: 'completed',
          failed: 'failed',
          cancelled: 'cancelled',
          expired: 'failed',
        };
        const status = (statusMap[data.status as keyof typeof statusMap] ||
          'processing') as TaskStatus;

        let resultUrl: string | undefined;
        let urls: string[] = [];
        if (data.content?.video_url) {
          resultUrl = data.content.video_url;
        } else if (data.content?.image_url) {
          resultUrl = data.content.image_url;
          urls = [resultUrl];
        } else if (Array.isArray(data.content)) {
          const imageItems = data.content.filter(
            (item: any) => item.type === 'image_url' && item.image_url?.url
          );
          if (imageItems.length > 0) {
            urls = imageItems.map((item: any) => item.image_url.url);
            resultUrl = urls[0];
          }
        }

        return {
          taskId,
          status,
          provider: this.name,
          result: resultUrl
            ? {
                imageUrl: resultUrl,
                videoUrl: data.content?.video_url,
                url: resultUrl,
                urls: urls.length > 1 ? urls : undefined,
              }
            : undefined,
          error: data.error ? `${data.error.code}: ${data.error.message}` : undefined,
        };
      }

      return this.buildStandardTaskResult(taskId, data, STANDARD_VIDEO_STATUS_MAP);
    } catch (error: unknown) {
      return this.makeFailedTaskResult(taskId, error);
    }
  }
}
