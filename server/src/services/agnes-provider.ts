import { BaseProvider } from './base-provider';
import { VideoParams, ImageParams, GenerationResult, ApiProviderConfig } from '../types/api';
import { logger } from '../utils/logger';

/**
 * Agnes 独立 Provider
 *
 * 直连 Agnes AI API Gateway (https://apihub.agnes-ai.com)
 * 支持：
 *   - agnes-video-v2.0（文生视频 / 图生视频 / 多图视频 / 关键帧动画）
 *   - agnes-image-2.1-flash（文生图 / 图生图）
 *
 * 官方文档：
 *   - 视频：https://agnes-ai.com/doc/agnes-video-v20
 *   - 图片：https://agnes-ai.com/doc/agnes-image-21-flash
 *
 * 与 wuyinkeji 完全解耦，使用独立的 ProviderConfig(provider='agnes') 与密钥池。
 */
export class AgnesProvider extends BaseProvider {
  readonly name = 'agnes';
  readonly supportedModes = ['text_to_image', 'image_to_image', 'text_to_video', 'image_to_video'];

  private static readonly AGNES_VIDEO_BASE_URL = 'https://apihub.agnes-ai.com/v1';
  private static readonly AGNES_IMAGE_BASE_URL = 'https://apihub.agnes-ai.com/v1';

  // Agnes Image 2.1 Flash 尺寸映射
  private static readonly AGNES_IMAGE_SIZE_BY_RATIO: Record<string, string> = {
    '1:1': '1024x1024',
    '4:3': '1024x768',
    '3:4': '768x1024',
    '16:9': '1360x768',
    '9:16': '768x1360',
    '3:2': '1280x854',
    '2:3': '854x1280',
    '21:9': '1344x576',
    '9:21': '576x1344',
  };

  protected getDefaultEndpoint(): string {
    return process.env.AGNES_BASE_URL || AgnesProvider.AGNES_VIDEO_BASE_URL;
  }

  /**
   * 生成视频任务
   * 官方文档：POST https://apihub.agnes-ai.com/v1/videos
   */
  async generateVideo(params: VideoParams, config: ApiProviderConfig): Promise<GenerationResult> {
    const agnesApiKey = config.apiKey || '';
    if (!agnesApiKey) {
      return this.makeFailedTaskResult('', new Error('未配置Agnes API密钥'));
    }

    const baseUrl = process.env.AGNES_BASE_URL || AgnesProvider.AGNES_VIDEO_BASE_URL;
    const { width, height } = this.resolveVideoDimensions(params);
    const { numFrames, frameRate } = this.resolveVideoDurationParams(params);

    // BUG-P2-10 修复：补全高级参数传递
    // Agnes 官方 API 仅支持基础字段，将运镜/运动强度等追加到 prompt 以影响生成
    const enhancedPrompt = this.augmentPromptWithAdvancedParams(
      params.prompt || '',
      params
    );

    const body: Record<string, any> = {
      model: 'agnes-video-v2.0',
      prompt: enhancedPrompt,
      width,
      height,
      num_frames: numFrames,
      frame_rate: frameRate,
    };

    if (params.negativePrompt) {
      body.negative_prompt = params.negativePrompt;
    }
    if (params.seed !== undefined && params.seed !== -1) {
      body.seed = params.seed;
    }

    // 图生视频 / 多图视频 / 关键帧动画
    const p = params as any;
    const inputImages: string[] = [];
    if (params.imageUrl) inputImages.push(params.imageUrl);
    if (p.referenceImages?.length) inputImages.push(...p.referenceImages);
    if (p.firstFrameUrl) inputImages.push(p.firstFrameUrl);
    if (p.lastFrameUrl) inputImages.push(p.lastFrameUrl);

    if (inputImages.length === 1) {
      // 单图：使用顶层 image 字段
      body.image = inputImages[0];
    } else if (inputImages.length > 1) {
      // 多图：使用 extra_body.image 数组
      body.extra_body = {
        image: inputImages.slice(0, 7),
      };
      // 关键帧动画模式
      if (p.referenceType === 'keyframes' || p.mode === 'keyframes') {
        body.extra_body.mode = 'keyframes';
      }
    }

    // BUG-P2-10 配套：通过 extra_body 传递 Agnes 可能支持的高级参数（不支持的会被 API 忽略）
    if (!body.extra_body) body.extra_body = {};
    if (params.style) body.extra_body.style = params.style;
    if (params.generateAudio !== undefined) body.extra_body.generate_audio = params.generateAudio;
    if (params.promptEnhancer !== undefined) body.extra_body.prompt_enhancer = params.promptEnhancer;
    if (params.watermark !== undefined) body.extra_body.watermark = params.watermark;
    // 若 extra_body 仅含 image 字段且无图片输入，清理空对象
    if (inputImages.length === 0 && Object.keys(body.extra_body).length === 0) {
      delete body.extra_body;
    }

    logger.info(
      `[Agnes] 提交视频任务: prompt=${enhancedPrompt.substring(0, 50)}, ` +
        `size=${width}x${height}, frames=${numFrames}@${frameRate}fps, images=${inputImages.length}`
    );

    try {
      // Agnes 视频提交接口响应较慢，给予 300s 超时（避免 180s 超时导致前端 timeout of 180000ms exceeded）
      const submitData = await this.apiPost(`${baseUrl}/videos`, body, {
        Authorization: `Bearer ${agnesApiKey}`,
        'Content-Type': 'application/json',
      }, 300000);

      if (submitData.error) {
        const errMsg = submitData.error.message || submitData.error.code || '未知错误';
        return this.makeFailedTaskResult('', new Error(`Agnes视频提交失败: ${errMsg}`));
      }

      const taskId = submitData.task_id || submitData.id;
      const videoId = submitData.video_id;
      if (!taskId && !videoId) {
        logger.warn(`[Agnes] API 未返回任务ID，原始响应: ${JSON.stringify(submitData)}`);
        return this.makeFailedTaskResult('', new Error('视频任务创建失败：agnes (agnes-video-v2.0) 未返回任务 ID，请检查该服务商 API 响应格式或密钥配置'));
      }

      // 优先使用 video_id 作为 taskId，因为查询接口仅支持 video_id 查询
      const effectiveTaskId = videoId || taskId;
      logger.info(`[Agnes] 视频任务已提交: taskId=${taskId}, videoId=${videoId}, effectiveTaskId=${effectiveTaskId}`);
      return {
        taskId: effectiveTaskId,
        status: 'pending',
        progress: 0,
        provider: 'agnes',
        model: 'agnes-video-v2.0',
        result: { metadata: { task_id: taskId, video_id: videoId } },
      };
    } catch (error: unknown) {
      logger.error(`[Agnes] 视频生成失败:`, error);
      const errResult = this.handleProviderError(error);
      if (!errResult.error) {
        errResult.error = '视频任务创建失败：agnes (agnes-video-v2.0) 未返回任务 ID，请检查该服务商 API 响应格式或密钥配置';
      }
      return errResult;
    }
  }

  /**
   * 查询视频任务状态
   * 推荐方式：GET https://apihub.agnes-ai.com/agnesapi?video_id=<VIDEO_ID>
   * 兼容方式：GET https://apihub.agnes-ai.com/v1/videos/<TASK_ID>
   */
  async getTaskStatus(taskId: string, config: ApiProviderConfig): Promise<GenerationResult> {
    const agnesApiKey = config.apiKey || '';
    if (!agnesApiKey) {
      return this.makeFailedTaskResult(taskId, new Error('未配置Agnes API密钥'));
    }

    const baseUrl = process.env.AGNES_BASE_URL || AgnesProvider.AGNES_VIDEO_BASE_URL;
    const headers = {
      Authorization: `Bearer ${agnesApiKey}`,
      'Content-Type': 'application/json',
    };

    try {
      let pollData: any;

      // 统一使用 agnesapi?video_id= 方式查询（推荐方式）
      // 无论是 video_xxx 还是纯 ID，都优先用 video_id 查询
      try {
        pollData = await this.apiGetWithRetry(
          `${baseUrl.replace('/v1', '')}/agnesapi?video_id=${encodeURIComponent(taskId)}&model_name=agnes-video-v2.0`,
          headers,
          30000,
          2,
          1000
        );
      } catch (videoIdErr: any) {
        // video_id 查询失败，尝试兼容方式：使用 task_id 查询
        logger.info(`[Agnes] video_id查询失败，尝试task_id查询: taskId=${taskId}`);
        pollData = await this.apiGetWithRetry(`${baseUrl}/videos/${encodeURIComponent(taskId)}`, headers, 30000, 2, 1000);
      }

      return this.parseAgnesVideoTaskResult(taskId, pollData);
    } catch (error: unknown) {
      const status = Number((error as any)?.response?.status || 0);
      if (status >= 400 && status < 500) {
        logger.warn(`[Agnes] 查询被服务商拒绝，终止轮询: taskId=${taskId}, status=${status}`);
        return this.makeFailedTaskResult(
          taskId,
          new Error(`Agnes视频查询失败: 服务商返回 HTTP ${status}`)
        );
      }
      logger.warn(`[Agnes] 单次查询异常，保持处理中: taskId=${taskId}`, error);
      return {
        taskId,
        status: 'processing',
        progress: 0,
        provider: 'agnes',
        model: 'agnes-video-v2.0',
        result: { metadata: { task_id: taskId } },
      };
    }
  }

  /**
   * 生成图片（Agnes Image 2.1 Flash）
   * POST https://apihub.agnes-ai.com/v1/images/generations
   */
  async generateImage(params: ImageParams, config: ApiProviderConfig): Promise<GenerationResult> {
    const agnesApiKey = config.apiKey || '';
    if (!agnesApiKey) {
      return this.makeFailedTaskResult('', new Error('未配置Agnes API密钥'));
    }

    const baseUrl = process.env.AGNES_BASE_URL || AgnesProvider.AGNES_IMAGE_BASE_URL;
    const size = this.resolveAgnesImageSize(params);
    const p = params as any;
    const inputImages = this.normalizeReferenceImages(params.referenceImageUrl, p.referenceImages);

    const body: Record<string, any> = {
      model: 'agnes-image-2.1-flash',
      prompt: params.prompt || '',
      size,
      n: params.imageCount || 1,
    };

    if (inputImages.length > 0) {
      body.extra_body = {
        image: inputImages,
        response_format: 'url',
      };
    }

    logger.info(
      `[Agnes] 提交图片生成: prompt=${(params.prompt || '').substring(0, 50)}, size=${size}, img2img=${inputImages.length > 0}`
    );

    try {
      // Agnes 图片生成响应较慢（实测 30-50s），给予 120s 超时避免 60s 默认超时失败
      const submitData = await this.apiPost(`${baseUrl}/images/generations`, body, {
        Authorization: `Bearer ${agnesApiKey}`,
        'Content-Type': 'application/json',
      }, 120000);

      if (submitData.error) {
        const errMsg = submitData.error.message || submitData.error.code || '未知错误';
        return this.makeFailedTaskResult('', new Error(`Agnes图片生成失败: ${errMsg}`));
      }

      const urls: string[] = [];
      if (submitData.data && Array.isArray(submitData.data)) {
        for (const item of submitData.data) {
          if (item.url) urls.push(item.url);
          else if (item.b64_json) urls.push(`data:image/png;base64,${item.b64_json}`);
        }
      }

      if (urls.length === 0) {
        return this.makeFailedTaskResult('', new Error('Agnes图片API未返回图片URL'));
      }

      logger.info(`[Agnes] 图片生成成功: ${urls.length}张`);
      return {
        taskId: `agnes-img-${Date.now()}`,
        status: 'completed',
        progress: 100,
        provider: 'agnes',
        model: 'agnes-image-2.1-flash',
        result: {
          url: urls[0],
          urls,
          metadata: { model: 'agnes-image-2.1-flash', source: 'agnes-direct', size },
        },
      };
    } catch (error: unknown) {
      logger.error(`[Agnes] 图片生成失败:`, error);
      return this.handleProviderError(error);
    }
  }

  /**
   * 解析视频查询结果
   * 完成时视频 URL 在 remixed_from_video_id 字段
   */
  private parseAgnesVideoTaskResult(taskId: string, pollData: any): GenerationResult {
    if (pollData.error) {
      return this.makeFailedTaskResult(
        taskId,
        new Error(`Agnes视频查询失败: ${pollData.error.message || pollData.error.code || '未知错误'}`)
      );
    }

    const status = pollData.status;
    const progress = pollData.progress || 0;
    const videoId = pollData.video_id;

    if (status === 'completed' || status === 'succeeded') {
      const resultUrl = this.extractAgnesVideoUrl(pollData);
      if (!resultUrl) {
        logger.warn(`[Agnes] 完成但暂未取到URL，保持处理中: taskId=${taskId}`);
        return {
          taskId,
          status: 'processing',
          progress: Math.max(progress, 95),
          model: 'agnes-video-v2.0',
          provider: 'agnes',
          result: { metadata: { video_id: videoId, task_id: taskId } },
        };
      }
      logger.info(`[Agnes] 视频生成成功: url=${resultUrl.substring(0, 80)}...`);
      return {
        taskId,
        status: 'completed',
        progress: 100,
        result: {
          videoUrl: resultUrl,
          url: resultUrl,
          metadata: { video_id: videoId, task_id: taskId },
        },
        model: 'agnes-video-v2.0',
        provider: 'agnes',
      };
    }

    if (status === 'failed') {
      const errMsg = pollData.error?.message || pollData.error || '生成失败';
      return this.makeFailedTaskResult(taskId, new Error(`Agnes视频生成失败: ${errMsg}`));
    }

    return {
      taskId,
      status: 'processing',
      progress,
      model: 'agnes-video-v2.0',
      provider: 'agnes',
      result: { metadata: { video_id: videoId, task_id: taskId } },
    };
  }

  /**
   * 从查询响应中提取视频 URL
   * Agnes API 完成时返回 remixed_from_video_id 字段作为视频 URL
   */
  private extractAgnesVideoUrl(payload: any): string {
    if (!payload) return '';
    if (typeof payload === 'string') return payload.startsWith('http') ? payload : '';
    if (Array.isArray(payload)) {
      for (const item of payload) {
        const url = this.extractAgnesVideoUrl(item);
        if (url) return url;
      }
      return '';
    }
    if (typeof payload !== 'object') return '';

    // Agnes 官方字段：remixed_from_video_id（视频 URL，仅 completed 时可用）
    const direct =
      payload.remixed_from_video_id ||
      payload.video_url ||
      payload.url ||
      payload.output ||
      payload.videoUrl ||
      payload.video;
    if (typeof direct === 'string' && direct.startsWith('http')) return direct;

    if (Array.isArray(payload.output) || typeof payload.output === 'object') {
      const url = this.extractAgnesVideoUrl(payload.output);
      if (url) return url;
    }

    const nested = [payload.data, payload.result, payload.results, payload.videos, payload.assets, payload.files];
    for (const item of nested) {
      const url = this.extractAgnesVideoUrl(item);
      if (url) return url;
    }
    return '';
  }

  /**
   * 根据视频参数解析宽高
   * Agnes 默认 1152x768（16:9）
   *
   * 分辨率映射：
   * - 720p  → 基础尺寸（16:9 = 1152x768）
   * - 1080p → 放大尺寸（16:9 = 1920x1080）
   */
  private resolveVideoDimensions(params: VideoParams): { width: number; height: number } {
    return this.resolveVideoDimensionsImpl(params);
  }

  /**
   * BUG-P2-10 修复：将 Agnes 不直接支持的高级参数追加到 prompt
   * 包括：运镜、运动强度、风格预设等
   */
  private augmentPromptWithAdvancedParams(prompt: string, params: VideoParams): string {
    const base = (prompt || '').trim();
    const parts: string[] = [];

    // 运镜
    if (params.cameraMovement && params.cameraMovement !== 'auto') {
      const cameraLabels: Record<string, string> = {
        zoom_in: '镜头推近',
        zoom_out: '镜头拉远',
        pan_left: '镜头左移',
        pan_right: '镜头右移',
        pan_up: '镜头上移',
        pan_down: '镜头下移',
        rotate_cw: '顺时针旋转',
        rotate_ccw: '逆时针旋转',
        tilt_left: '左倾',
        tilt_right: '右倾',
        tracking: '跟随运镜',
        parallax: '视差运镜',
        static: '固定镜头',
      };
      const label = cameraLabels[params.cameraMovement];
      if (label) parts.push(label);
    }

    // 运动强度
    if (typeof params.motionStrength === 'number' && params.motionStrength > 0) {
      if (params.motionStrength > 70) parts.push('高动态运动');
      else if (params.motionStrength < 30) parts.push('低动态运动');
    }

    // 画面风格
    if (params.viduStyle) parts.push(`画面风格：${params.viduStyle}`);
    else if (params.creativeStyle) parts.push(`创作风格：${params.creativeStyle}`);

    // 视频预设
    if (params.videoPreset) parts.push(`风格预设：${params.videoPreset}`);

    if (parts.length === 0) return base;
    return base ? `${base}，${parts.join('，')}` : parts.join('，');
  }

  private resolveVideoDimensionsImpl(params: VideoParams): { width: number; height: number } {
    const ratio = String((params as any).aspectRatio || '16:9').trim();
    const resolution = String(params.resolution || '720p').toLowerCase();

    // 直接像素分辨率优先
    const pixel = (params as any).pixelResolution as string | undefined;
    if (pixel && /^\d{3,5}x\d{3,5}$/i.test(pixel)) {
      const [w, h] = pixel.toLowerCase().split('x').map(Number);
      if (w && h) return { width: w, height: h };
    }

    // 基础尺寸（720p 级别）
    const baseDimensions: Record<string, { width: number; height: number }> = {
      '16:9': { width: 1152, height: 768 },
      '9:16': { width: 768, height: 1152 },
      '1:1': { width: 896, height: 896 },
      '4:3': { width: 1024, height: 768 },
      '3:4': { width: 768, height: 1024 },
    };

    // 1080p 放大尺寸
    if (resolution.includes('1080')) {
      const targetDimensions: Record<string, { width: number; height: number }> = {
        '16:9': { width: 1920, height: 1080 },
        '9:16': { width: 1080, height: 1920 },
        '1:1': { width: 1440, height: 1440 },
        '4:3': { width: 1440, height: 1080 },
        '3:4': { width: 1080, height: 1440 },
      };
      return targetDimensions[ratio] || targetDimensions['16:9'];
    }

    return baseDimensions[ratio] || baseDimensions['16:9'];
  }

  /**
   * 根据时长参数解析 num_frames 和 frame_rate
   * Agnes 要求 num_frames ≤ 441 且满足 8n+1
   * seconds = num_frames / frame_rate
   *
   * 帧数上限按分辨率区分（来自 API 错误信息）：
   *   - 1080p: 241 帧（约 10s）
   *   - 720p:  481 帧（约 15s+）
   *   - 480p:  961 帧
   * 若请求时长在当前分辨率下超限，自动降级到该分辨率下的最大允许时长。
   */
  private resolveVideoDurationParams(params: VideoParams): { numFrames: number; frameRate: number } {
    const duration = Number(params.duration) || 6;
    // 支持前端传入的 fps，默认 24（Agnes 要求帧数满足 8n+1）
    const frameRate = (typeof params.fps === 'number' && [24, 30, 60].includes(params.fps)) ? params.fps : 24;

    // 时长 → num_frames 映射（均满足 8n+1）
    const durationToFrames: Record<number, number> = {
      3: 81, // 3s → 81 frames
      5: 121, // 5s → 121 frames
      6: 145, // 6s → 145 frames (8*18+1)
      8: 193, // 8s → 193 frames (8*24+1)
      10: 241, // 10s → 241 frames
      12: 289, // 12s → 289 frames (8*36+1)
      15: 361, // 15s → 361 frames (8*45+1)
      18: 441, // 18s → 441 frames (最大)
    };

    // 各分辨率下最大允许 num_frames（来自 Agnes API 错误信息）
    const maxFramesByResolution: Record<string, number> = {
      '1080p': 241,
      '720p': 481,
      '480p': 961,
    };

    const resolution = String(params.resolution || '720p').toLowerCase();
    const maxFrames = maxFramesByResolution[resolution] || 481;

    let numFrames = durationToFrames[duration] || 145; // 默认 6s

    // 兜底：若请求帧数超过当前分辨率上限，降级到最大允许时长
    if (numFrames > maxFrames) {
      const fallbackDuration = Object.entries(durationToFrames)
        .filter(([, frames]) => frames <= maxFrames)
        .map(([sec, frames]) => ({ sec: Number(sec), frames }))
        .sort((a, b) => b.frames - a.frames)[0];
      if (fallbackDuration) {
        logger.warn(
          `[Agnes] 时长 ${duration}s (num_frames=${numFrames}) 超过 ${resolution} 上限 ${maxFrames}，自动降级到 ${fallbackDuration.sec}s (num_frames=${fallbackDuration.frames})`
        );
        numFrames = fallbackDuration.frames;
      }
    }

    return { numFrames, frameRate };
  }

  private resolveAgnesImageSize(params: ImageParams): string {
    const p = params as any;
    // 1. 优先使用直接传入的像素尺寸 (如 "4096x4096")
    const candidates = [params.imageSize, params.pixelResolution, p.size, params.resolution];
    for (const candidate of candidates) {
      const value = String(candidate || '').trim();
      if (/^\d{3,5}x\d{3,5}$/i.test(value)) return value.toLowerCase();
    }

    // 2. 如果传入的是档位 (如 "2K", "4K")，按比例映射到大像素尺寸
    const tier = String(params.imageSize || params.pixelResolution || '').trim().toUpperCase();
    const ratio = String(params.resolution || p.aspectRatio || p.ratio || '1:1').trim();

    if (tier === '4K') {
      const SIZE_4K: Record<string, string> = {
        '1:1': '4096x4096', '4:3': '4096x3072', '3:4': '3072x4096',
        '16:9': '3840x2160', '9:16': '2160x3840', '3:2': '4096x2731',
        '2:3': '2731x4096', '21:9': '4096x1758', '9:21': '1758x4096',
      };
      if (SIZE_4K[ratio]) return SIZE_4K[ratio];
    }
    if (tier === '2K') {
      const SIZE_2K: Record<string, string> = {
        '1:1': '2048x2048', '4:3': '2048x1536', '3:4': '1536x2048',
        '16:9': '2560x1440', '9:16': '1440x2560', '3:2': '2560x1707',
        '2:3': '1707x2560', '21:9': '2688x1152', '9:21': '1152x2688',
      };
      if (SIZE_2K[ratio]) return SIZE_2K[ratio];
    }

    // 3. 按比例映射到基础尺寸
    return AgnesProvider.AGNES_IMAGE_SIZE_BY_RATIO[ratio] || '1024x1024';
  }

  private normalizeReferenceImages(...sources: any[]): string[] {
    const urls: string[] = [];
    for (const source of sources) {
      if (!source) continue;
      if (typeof source === 'string') {
        if (source.startsWith('http')) urls.push(source);
      } else if (Array.isArray(source)) {
        for (const item of source) {
          if (typeof item === 'string' && item.startsWith('http')) urls.push(item);
        }
      }
    }
    return urls;
  }
}
