import { BaseProvider, DEFAULT_ENDPOINTS } from './base-provider';
import logger from '../utils/logger';
import {
  VideoParams,
  ImageParams,
  AudioParams,
  GenerationResult,
  ApiProviderConfig,
} from '../types/api';
import crypto from 'crypto';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const HAILUO_MODEL_IDS = ['hailuo-2.3-fast-768p-6s', 'hailuo-2.3-768p-6s', 'hailuo-video-2.3'];

const HAILUO_API_MODEL_MAP: Record<string, string> = {
  'hailuo-video-2.3': 'disabled-hailuo-video',
  'hailuo-2.3-fast-768p-6s': 'disabled-hailuo-video',
  'hailuo-2.3-768p-6s': 'disabled-hailuo-video',
};

const MINIMAX_LEGACY_VOICE_ALIASES: Record<string, string> = {
  'male-xiaohei': 'male-qn-qingse',
  'male-xiaobai': 'male-qn-jingying',
  'male-xiaogang': 'male-qn-badao',
  'male-xiaoyang': 'male-qn-daxuesheng',
  'female-xiaoyuan': 'female-chengshu',
  'male-john': 'presenter_male',
  'male-davis': 'audiobook_male_1',
  'female-emma': 'presenter_female',
  'female-bella': 'audiobook_female_1',
};

function isHailuoModel(model?: string): boolean {
  if (!model) return false;
  const normalized = model.trim().toLowerCase();
  return (
    HAILUO_MODEL_IDS.includes(normalized) ||
    normalized.startsWith('hailuo') ||
    normalized.includes('hailuo')
  );
}

export class MinimaxProvider extends BaseProvider {
  readonly name = 'minimax';
  readonly supportedModes = [
    'text_to_video',
    'image_to_video',
    'video_to_video',
    'text_to_audio',
    'voice_clone',
    'voice_design',
    'voice_management',
  ];

  protected getDefaultEndpoint(): string {
    return DEFAULT_ENDPOINTS.minimax;
  }

  private generateSignature(secret: string, timestamp: number): string {
    const message = `${timestamp}`;
    return crypto.createHmac('sha256', secret).update(message).digest('hex');
  }

  private signedHeaders(config: ApiProviderConfig, timestamp: number): Record<string, string> {
    const signature = this.generateSignature(config.apiKey, timestamp);
    return {
      Authorization: `Bearer ${config.apiKey}`,
      'X-Signature': signature,
      'X-Timestamp': timestamp.toString(),
      'X-Group-Id': config.apiSecret || '',
    };
  }

  async generateVideo(params: VideoParams, config: ApiProviderConfig): Promise<GenerationResult> {
    if (isHailuoModel(params.model)) {
      return this.makeFailedTaskResult(
        '',
        new Error('海螺视频模型已禁用，请使用 Google Omni / 无垠科技视频模型')
      );
    }
    try {
      const endpoint = config.endpoint || 'https://api.minimaxi.com/v1';
      const timestamp = Math.floor(Date.now() / 1000);
      const body = this.buildCommonVideoBody(params);
      if (!body.model) body.model = 'minimax-video-01';

      const dimensions = this.mapResolution(params.resolution, params.pixelResolution);
      if (dimensions) {
        body.width = dimensions.width;
        body.height = dimensions.height;
      }

      if (params.quality) body.quality = params.quality;
      if (params.motionIntensity) body.motion_strength = params.motionIntensity;
      if (params.cameraControl) body.camera = params.cameraControl;

      if (params.imageUrl && params.mode === 'image_to_video') {
        body.image_url = params.imageUrl;
      }

      const data = await this.apiPost(
        `${endpoint}/video_generation`,
        body,
        this.signedHeaders(config, timestamp)
      );
      if (!data.task_id)
        throw new Error(data.base_resp?.status_msg || 'MiniMax API returned no task_id');
      return this.makePendingResult(data.task_id, params.model, data);
    } catch (error: unknown) {
      return this.handleProviderError(error);
    }
  }

  private async generateHailuoVideo(
    params: VideoParams,
    config: ApiProviderConfig
  ): Promise<GenerationResult> {
    try {
      const baseUrl = config.hailuoEndpoint || config.endpoint || 'https://api.minimaxi.com';
      const endpoint = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
      const apiKey = config.hailuoApiKey || config.apiKey;

      const hasFirstFrame = !!(params.imageUrl || params.firstFrameUrl);
      const hasLastFrame = !!params.lastFrameUrl;
      const hasSubjectRef = !!params.subjectReference;

      let mode: string;
      let model: string;
      const requestBody: Record<string, any> = { prompt: params.prompt };

      if (hasSubjectRef) {
        mode = 's2v';
        model = 'S2V-01';
        requestBody.model = model;
        requestBody.subject_reference = [
          { type: params.subjectReference!.type, image: [params.subjectReference!.image] },
        ];
      } else if (hasFirstFrame && hasLastFrame) {
        mode = 'fl2v';
        model =
          params.apiModelName ||
          HAILUO_API_MODEL_MAP[params.model || ''] ||
          'disabled-hailuo-video';
        requestBody.model = model;
        requestBody.first_frame_image = params.imageUrl || params.firstFrameUrl;
        requestBody.last_frame_image = params.lastFrameUrl;
        requestBody.resolution = params.resolution
          ? this.normalizeResolution(params.resolution)
          : '768P';
        if (params.duration === 10) requestBody.duration = 10;
      } else if (hasFirstFrame) {
        mode = 'i2v';
        model =
          params.apiModelName ||
          HAILUO_API_MODEL_MAP[params.model || ''] ||
          'disabled-hailuo-video';
        requestBody.model = model;
        requestBody.first_frame_image = params.imageUrl || params.firstFrameUrl;
        this.applyHailuoResolutionAndDuration(requestBody, model, params);
        if (params.camera) requestBody.camera = params.camera;
      } else {
        mode = 't2v';
        model =
          params.apiModelName ||
          HAILUO_API_MODEL_MAP[params.model || ''] ||
          'disabled-hailuo-video';
        requestBody.model = model;
        this.applyHailuoResolutionAndDuration(requestBody, model, params);
        if (params.camera) requestBody.camera = params.camera;
      }

      requestBody.prompt_optimizer = params.promptEnhancement !== false;

      if (params.seed !== undefined && params.seed !== -1) {
        requestBody.seed = params.seed;
      }

      const response = await this.apiPost(`${endpoint}/video_generation`, requestBody, {
        Authorization: `Bearer ${apiKey}`,
      });

      const statusCode = response.base_resp?.status_code;
      if (statusCode === 2056) {
        throw new Error(
          `MiniMax rate limit (status_code=2056): ${response.base_resp?.status_msg || 'too many requests'}`
        );
      }

      if (!response.task_id || statusCode !== 0) {
        return {
          taskId: '',
          status: 'failed',
          provider: this.name,
          error: response.base_resp?.status_msg || 'MiniMax API 返回错误',
        };
      }

      return this.makePendingResult(`hailuo_${response.task_id}`, params.model, {
        ...response,
        _mode: mode,
        _model: model,
      });
    } catch (error: unknown) {
      return this.handleProviderError(error);
    }
  }

  private applyHailuoResolutionAndDuration(
    body: Record<string, any>,
    model: string,
    params: VideoParams
  ): void {
    if (this.supportsHailuoResolution(model)) {
      if (params.pixelResolution) {
        body.resolution = this.normalizeResolution(params.pixelResolution);
      } else if (params.resolution) {
        body.resolution = this.normalizeResolution(params.resolution);
      }
      if (params.duration) body.duration = params.duration;
    }
  }

  private supportsHailuoResolution(model: string): boolean {
    return !['T2V-01', 'T2V-01-Director', 'I2V-01', 'I2V-01-live', 'I2V-01-Director'].includes(
      model
    );
  }

  private normalizeResolution(res: string | undefined): string {
    if (!res) return '768P';
    const upper = res.toUpperCase();
    if (upper === '2K' || upper === '4K') return '1080P';
    if (upper === '720P') return '768P';
    if (upper.endsWith('P')) return upper;
    return '768P';
  }

  async generateImage(params: ImageParams, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const baseUrl = config.endpoint || 'https://api.minimaxi.com';
      const endpoint = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
      const timestamp = Math.floor(Date.now() / 1000);
      const body = this.buildCommonImageBody(params);
      if (!body.model) body.model = 'image-01';

      const MINIMAX_IMAGE_MODEL_ALIASES: Record<string, string> = {
        'minimax-image-01': 'image-01',
        'minimax_image-01': 'image-01',
        'minimax-image-01-preview': 'image-01-preview',
        'minimax_image-01-preview': 'image-01-preview',
      };
      if (body.model && MINIMAX_IMAGE_MODEL_ALIASES[body.model]) {
        body.model = MINIMAX_IMAGE_MODEL_ALIASES[body.model];
      }

      // MiniMax image-01：使用 aspect_ratio 而非 width/height，避免 2048 高分辨率触发上游 RPC 超时
      // 经测试：2048x2048 请求会导致 MiniMax 内部 amadeus-server RPC 超时（1m0s），1024 及以下正常
      const HIGH_RES_MAP: Record<string, { width: number; height: number }> = {
        '1:1': { width: 1024, height: 1024 },
        '16:9': { width: 1024, height: 576 },
        '9:16': { width: 576, height: 1024 },
        '4:3': { width: 1024, height: 768 },
        '3:4': { width: 768, height: 1024 },
        '3:2': { width: 1024, height: 680 },
        '2:3': { width: 680, height: 1024 },
        '21:9': { width: 1024, height: 440 },
        '4:5': { width: 816, height: 1024 },
      };
      // pixelResolution 降采样系数：根据用户选择的清晰度档位缩放输出尺寸
      const PIXEL_RESOLUTION_SCALE: Record<string, number> = {
        '720p': 0.5, // 最长边 ~1024
        '1080p': 0.75, // 最长边 ~1536
        '2k': 1.0, // 最长边 2048（默认）
        '4k': 1.0, // API 上限 2048，保持不变
      };
      const resScale = PIXEL_RESOLUTION_SCALE[params.pixelResolution || '2k'] ?? 1.0;
      const toMultipleOf8 = (n: number) => Math.max(512, Math.round(n / 8) * 8);

      if (params.width && params.height) {
        body.width = toMultipleOf8(params.width * resScale);
        body.height = toMultipleOf8(params.height * resScale);
      } else if (params.resolution && HIGH_RES_MAP[params.resolution]) {
        const hr = HIGH_RES_MAP[params.resolution];
        body.width = toMultipleOf8(hr.width * resScale);
        body.height = toMultipleOf8(hr.height * resScale);
      } else if (params.resolution) {
        body.aspect_ratio = params.resolution;
      } else {
        // 默认 16:9 最高清 2048x1152
        body.width = toMultipleOf8(2048 * resScale);
        body.height = toMultipleOf8(1152 * resScale);
      }

      // MiniMax image-01 API 不支持 style/cfg_scale/steps/hd_mode/watermark 字段
      // buildCommonImageBody 可能已添加这些字段，需清理避免 "invalid params" 错误
      delete body.cfg_scale;
      delete body.steps;
      delete body.hd_mode;
      delete body.watermark;
      delete body.style;

      // 优先使用 imageCount，其次 n，确保下限 1 上限 9
      const rawCount = params.imageCount ?? params.n ?? 1;
      body.n = Math.max(1, Math.min(rawCount, 9));
      console.log(
        `[Minimax] generateImage n=${body.n}, model=${body.model}, size=${body.width}x${body.height || ''} aspect_ratio=${body.aspect_ratio || ''}, prompt=${(params.prompt || '').substring(0, 80)}`
      );
      if (params.promptOptimizer !== undefined) {
        body.prompt_optimizer = params.promptOptimizer;
      } else if (params.promptEnhancer !== undefined) {
        body.prompt_optimizer = params.promptEnhancer;
      }

      // 参考图处理：优先 referenceImageUrl（单张），其次 referenceImages（数组）
      const allRefs: string[] = [];
      if (params.referenceImageUrl) allRefs.push(params.referenceImageUrl);
      if (Array.isArray(params.referenceImages)) {
        for (const img of params.referenceImages) {
          if (typeof img === 'string' && img && !allRefs.includes(img)) allRefs.push(img);
        }
      }

      if (allRefs.length > 0) {
        const processedUrl = allRefs[0];
        let referencePreview = processedUrl.substring(0, 100);

        if (processedUrl.startsWith('data:')) {
          const base64Match = processedUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
          if (base64Match?.[1]) {
            console.log(
              `[Minimax] 使用 Data URL 参考图, 大小: ${(
                (base64Match[1].length * 0.75) /
                1024
              ).toFixed(1)}KB`
            );
            referencePreview = `data-url(${((base64Match[1].length * 0.75) / 1024).toFixed(1)}KB)`;
          }
        } else {
          console.log(`[Minimax] 使用 URL 参考图: ${referencePreview}...`);
        }

        // 根据生成模式选择参考图类型，避免所有场景都硬编码 'character'
        const refType = params.mode === 'character_reference' ? 'character' : 'subject';
        body.subject_reference = allRefs.map((url) => ({
          type: refType,
          image_file: url,
        }));

        // 兼容保留旧字段，避免历史环境仍依赖旧参数。
        body.reference_image_url = processedUrl;

        console.log(
          `[Minimax] 已附加 ${allRefs.length} 张参考图 subject_reference, mode=${params.mode || 'image_to_image'}, ref=${referencePreview}`
        );
      }

      if (process.env.DEBUG_IMAGE_LOG === '1') {
        try {
          const logPath = path.join(process.cwd(), 'debug-image.log');
          fs.appendFileSync(
            logPath,
            `[${new Date().toISOString()}] minimax apiKeyConfigured=${Boolean(config.apiKey)} endpoint=${endpoint}\n`
          );
        } catch {
          /* debug log write failure should never crash the request */
        }
      }
      const data = await this.apiPost(
        `${endpoint}/image_generation`,
        body,
        {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        180000
      );
      logger.info(
        `[Minimax] image_generation endpoint=${endpoint}, keyLen=${config.apiKey?.length}`
      );
      const imageUrls: string[] = data.data?.image_urls || data.images || data.image_urls || [];
      console.log(`[Minimax] API returned ${imageUrls.length} images, requested n=${body.n}`);
      const limitedUrls = imageUrls.slice(0, body.n || 1);
      const statusCode = Number(data.base_resp?.status_code ?? 0);
      const rawStatusMessage = data.base_resp?.status_msg || data.error?.message;
      const errorMessage =
        statusCode !== 0 && rawStatusMessage && rawStatusMessage !== 'success'
          ? rawStatusMessage
          : undefined;
      const hasImageResult = limitedUrls.length > 0;

      if (!hasImageResult && errorMessage) {
        return {
          taskId: data.task_id || Date.now().toString(),
          status: 'failed',
          provider: this.name,
          model: params.model,
          error: errorMessage,
          result: {
            url: '',
            urls: [],
            metadata: data,
          },
        };
      }

      return {
        taskId: data.task_id || Date.now().toString(),
        status: 'completed',
        provider: this.name,
        model: params.model,
        result: {
          url: limitedUrls[0] || '',
          urls: limitedUrls,
          metadata: data,
        },
      };
    } catch (error: unknown) {
      return this.handleProviderError(error);
    }
  }

  async generateAudio(params: AudioParams, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const baseUrl = config.endpoint || 'https://api.minimaxi.com';
      const endpoint = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
      const timestamp = Math.floor(Date.now() / 1000);
      const headers = this.signedHeaders(config, timestamp);

      // 1. 语音克隆
      if (params.mode === 'clone') {
        const body = {
          voice_id: params.voiceId,
          file_id: params.cloneFileId,
          prompt_text: params.clonePromptText,
        };
        const data = await this.apiPost(`${endpoint}/voice_cloning/clone`, body, headers);
        return {
          taskId: data.task_id || Date.now().toString(),
          status: 'completed',
          provider: this.name,
          model: params.model,
          result: { voiceId: data.voice_id, metadata: data },
        };
      }

      // 2. 语音设计
      if (params.mode === 'design') {
        const body = {
          gender: params.voiceDesignGender || 'female',
          age: params.voiceDesignAge || 25,
          accent: params.voiceDesignAccent || 'Chinese',
          description: params.voiceDesignPrompt || params.text,
        };
        const data = await this.apiPost(`${endpoint}/voice_design/design`, body, headers);
        return {
          taskId: data.task_id || Date.now().toString(),
          status: 'completed',
          provider: this.name,
          model: params.model,
          result: { voiceId: data.voice_id, metadata: data },
        };
      }

      // 3. 音乐合成
      if (params.mode === 'music') {
        const saveMusicBufferToFile = (buffer: Buffer, format?: string): string => {
          const taskId = `music_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          const ext = format === 'wav' ? '.wav' : '.mp3';
          const audioDir = path.join(process.cwd(), 'public', 'audio');
          if (!fs.existsSync(audioDir)) {
            fs.mkdirSync(audioDir, { recursive: true });
          }
          const filePath = path.join(audioDir, `${taskId}${ext}`);
          fs.writeFileSync(filePath, buffer);
          console.log(
            `[MinimaxProvider] 音乐已保存: ${filePath} (${(buffer.length / 1024).toFixed(1)} KB)`
          );
          return `/audio/${taskId}${ext}`;
        };

        const isHexCandidate = (s: string) =>
          !s.startsWith('http://') &&
          !s.startsWith('https://') &&
          !s.startsWith('data:') &&
          !s.startsWith('/') &&
          /^[0-9a-fA-F]+$/.test(s);

        const body = {
          model: params.model || 'music-2.6',
          prompt: params.prompt || params.text || '',
          lyrics: params.lyrics || '',
          audio_setting: {
            sample_rate: params.sampleRate || 44100,
            bitrate: params.bitrate || 256000,
            format: params.format || 'mp3',
          },
        };
        const data = await this.apiPost(`${endpoint}/music_generation`, body, {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        });

        if (data.base_resp && data.base_resp.status_code !== 0) {
          return {
            taskId: '',
            status: 'failed',
            provider: this.name,
            model: params.model,
            error:
              data.base_resp.status_code === 1004
                ? 'MiniMax 音乐接口认证失败：当前 API Key 可能未开通 music_generation 权限或密钥类型不匹配'
                : data.base_resp.status_msg || 'MiniMax 音乐生成返回业务错误',
          };
        }

        // 音乐生成可能是异步的，返回 task_id
        const taskId = data.task_id || data.data?.task_id || data.output?.task_id;
        if (taskId) {
          return this.makePendingResult(taskId, params.model, data);
        }

        const audioUrl =
          data.data?.audio_url ||
          data.output?.audio_url ||
          data.audio_url ||
          data.data?.audio?.url ||
          data.output?.audio?.url;
        const audioValue =
          data.data?.audio ||
          data.output?.audio ||
          data.audio ||
          data.data?.music ||
          data.output?.music;

        let audioFileUrl: string | null = null;
        if (typeof audioValue === 'string') {
          if (
            audioValue.startsWith('http://') ||
            audioValue.startsWith('https://') ||
            audioValue.startsWith('/')
          ) {
            audioFileUrl = audioValue;
          } else if (isHexCandidate(audioValue)) {
            const audioBuffer = Buffer.from(audioValue, 'hex');
            if (audioBuffer.length > 0) {
              audioFileUrl = saveMusicBufferToFile(audioBuffer, params.format);
            }
          }
        }

        if (audioFileUrl) {
          return {
            taskId: Date.now().toString(),
            status: 'completed',
            provider: this.name,
            model: params.model,
            result: { audioUrl: audioFileUrl, url: audioFileUrl, metadata: data },
          };
        }

        if (audioUrl) {
          return {
            taskId: Date.now().toString(),
            status: 'completed',
            provider: this.name,
            model: params.model,
            result: { url: audioUrl, metadata: data },
          };
        }

        return {
          taskId: '',
          status: 'failed',
          provider: this.name,
          model: params.model,
          error: 'MiniMax 音乐生成未返回 task_id 或音频地址',
        };
      }

      // 4. 语音合成 (TTS)
      const isAsync = params.mode === 'async_tts';
      const ttsEndpoint = isAsync ? `${endpoint}/t2a_async_create_v2` : `${endpoint}/t2a_v2`;

      const body: Record<string, any> = {
        model: params.model || 'speech-2.8-hd',
        text: params.text,
        stream: params.stream ?? false,
        voice_setting: {
          voice_id:
            MINIMAX_LEGACY_VOICE_ALIASES[params.voiceId || ''] ||
            params.voiceId ||
            'male-qn-qingse',
          speed: params.speed ?? 1.0,
          vol: params.vol ?? 1.0,
          pitch: params.pitch ?? 0,
        },
        audio_setting: {
          sample_rate: params.sampleRate || 32000,
          bitrate: params.bitrate || 128000,
          format: params.format || 'mp3',
          channel: params.channel || 1,
        },
      };

      if (params.emotion) {
        body.voice_setting.emotion = params.emotion;
      }

      if (params.languageBoost) body.language_boost = params.languageBoost;
      if (params.subtitleEnable !== undefined) body.subtitle_enable = params.subtitleEnable;
      if (params.aigcWatermark !== undefined) body.aigc_watermark = params.aigcWatermark;

      // 4. 语音修正与高级设置 (MiniMax TTS HD)
      if (params.voiceModify) {
        body.voice_modify = {
          pitch: params.voiceModify.pitch ?? 0,
          intensity: params.voiceModify.intensity ?? 0,
          timbre: params.voiceModify.timbre ?? 0,
        };
        if (params.voiceModify.soundEffects) {
          body.voice_modify.sound_effects = params.voiceModify.soundEffects;
        }
      }

      if (params.timbreWeights && params.timbreWeights.length > 0) {
        body.timbre_weights = params.timbreWeights.map((tw) => ({
          voice_id: tw.voiceId,
          weight: tw.weight,
        }));
      }

      if (
        params.pronunciationDict &&
        Array.isArray(params.pronunciationDict.tone) &&
        params.pronunciationDict.tone.length > 0
      ) {
        body.pronunciation_dict = params.pronunciationDict;
      }

      // MiniMax TTS v2 使用 Bearer Token 认证，不需要 HMAC 签名
      const authHeaders = {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      };
      const data = await this.apiPost(ttsEndpoint, body, authHeaders);

      // 记录完整的 API 响应，便于调试
      console.log(
        '[MinimaxProvider.generateAudio] TTS v2 API 响应:',
        JSON.stringify(data, null, 2).substring(0, 2000)
      );
      console.log('[MinimaxProvider.generateAudio] 响应结构分析:', {
        hasAudio: !!data.audio,
        audioType: typeof data.audio,
        audioIsObject: typeof data.audio === 'object',
        hasDataAudio: !!data.data?.audio,
        dataAudioType: typeof data.data?.audio,
        hasOutputAudio: !!data.output?.audio,
        outputAudioType: typeof data.output?.audio,
        hasAudioUrl: !!data.audio?.url,
        hasDataAudioUrl: !!data.data?.audio_url,
        hasOutputAudioUrl: !!data.output?.audio_url,
      });

      // 检查 API 错误
      if (data.base_resp && data.base_resp.status_code !== 0) {
        console.error('[MinimaxProvider.generateAudio] API 业务错误:', data.base_resp.status_msg);
        return {
          taskId: '',
          status: 'failed',
          provider: this.name,
          model: params.model,
          error: data.base_resp.status_msg || 'MiniMax API 业务错误',
        };
      }

      if (isAsync) {
        return this.makePendingResult(data.task_id, params.model, data);
      } else {
        // 同步返回音频 URL 或 Base64
        // MiniMax TTS v2 响应格式可能是:
        // 1. { audio: { url: "..." } } - MiniMax 新版 API 格式
        // 2. { data: { audio_url: "..." } } - 旧版格式
        // 3. { data: { audio: "hex_string" } } - 返回 hex 编码的音频数据
        // 4. { output: { audio_url: "..." } } - 有些版本用 output
        let audioUrl: string | null = null;
        if (typeof data.audio === 'string' && data.audio.startsWith('http')) {
          audioUrl = data.audio;
        } else if (data.audio?.url) {
          audioUrl = data.audio.url;
        }
        if (
          !audioUrl &&
          typeof data.data?.audio === 'string' &&
          data.data.audio.startsWith('http')
        ) {
          audioUrl = data.data.audio;
        }
        if (!audioUrl) {
          audioUrl = data.data?.audio_url || data.output?.audio_url || data.audio_url || null;
        }
        let hexAudio: string | undefined;
        const isHexCandidate = (s: string) =>
          !s.startsWith('http://') &&
          !s.startsWith('https://') &&
          !s.startsWith('data:') &&
          !s.startsWith('/') &&
          /^[0-9a-fA-F]+$/.test(s);
        if (typeof data.data?.audio === 'string' && isHexCandidate(data.data.audio)) {
          hexAudio = data.data.audio;
        } else if (typeof data.output?.audio === 'string' && isHexCandidate(data.output.audio)) {
          hexAudio = data.output.audio;
        } else if (typeof data.audio === 'string' && isHexCandidate(data.audio)) {
          hexAudio = data.audio;
        }
        let audioFileUrl: string | null = null;
        let audioSaveError: Error | null = null;

        const saveBufferToFile = (buffer: Buffer, format?: string): string => {
          const taskId = `tts_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          const ext = format === 'wav' ? '.wav' : '.mp3';
          const musicDir = path.join(process.cwd(), 'public', 'audio');
          if (!fs.existsSync(musicDir)) {
            fs.mkdirSync(musicDir, { recursive: true });
          }
          const filePath = path.join(musicDir, `${taskId}${ext}`);
          fs.writeFileSync(filePath, buffer);
          const isValidMP3 =
            buffer.length > 4 &&
            ((buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) ||
              (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0));
          if (!isValidMP3 && ext === '.mp3') {
            console.warn(
              `[MinimaxProvider] 警告: 保存的文件不是有效MP3格式, 前4字节: ${buffer.slice(0, 4).toString('hex')}`
            );
          }
          console.log(
            `[MinimaxProvider] 音频已保存: ${filePath} (${(buffer.length / 1024).toFixed(1)} KB, valid=${isValidMP3})`
          );
          return `/audio/${taskId}${ext}`;
        };

        if (hexAudio) {
          try {
            const audioBuffer = Buffer.from(hexAudio, 'hex');
            console.log(
              `[MinimaxProvider] hex 音频长度: ${hexAudio.length}, 解码后: ${audioBuffer.length} bytes`
            );
            if (audioBuffer.length > 0) {
              audioFileUrl = saveBufferToFile(audioBuffer, params.format);
            }
          } catch (err: unknown) {
            audioSaveError = err instanceof Error ? err : new Error(String(err));
            console.error(
              '[MinimaxProvider] 保存 hex 音频失败:',
              audioSaveError.message
            );
          }
        }

        if (!audioFileUrl && audioUrl) {
          try {
            console.log(`[MinimaxProvider] 下载远程音频: ${audioUrl.substring(0, 200)}`);
            const response = await axios.get(audioUrl, {
              responseType: 'arraybuffer',
              timeout: 30000,
              headers: { 'User-Agent': 'Mozilla/5.0' },
            });
            const buffer = Buffer.from(response.data);
            console.log(`[MinimaxProvider] 下载音频完成: ${buffer.length} bytes`);
            if (buffer.length > 0) {
              audioFileUrl = saveBufferToFile(buffer, params.format);
            }
          } catch (err: unknown) {
            console.error(
              '[MinimaxProvider] 下载远程音频失败:',
              err instanceof Error ? err.message : String(err)
            );
            audioFileUrl = audioUrl;
          }
        }

        if (!audioFileUrl) {
          console.error(
            '[MinimaxProvider.generateAudio] 未找到音频数据，响应:',
            JSON.stringify(data).substring(0, 500)
          );
          return {
            taskId: '',
            status: 'failed',
            provider: this.name,
            model: params.model,
            error: audioSaveError
              ? `音频已生成，但保存结果失败: ${audioSaveError.message}`
              : '未获取到音频数据，请检查 API 配置和响应格式',
          };
        }

        return {
          taskId: data.task_id || Date.now().toString(),
          status: 'completed',
          provider: this.name,
          model: params.model,
          result: {
            audioUrl: audioFileUrl,
            metadata: data,
          },
        };
      }
    } catch (error: unknown) {
      return this.handleProviderError(error);
    }
  }

  async getTaskStatus(taskId: string, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const isHailuo = taskId.startsWith('hailuo_') || config.hailuoEndpoint;
      if (isHailuo) {
        return this.getHailuoTaskStatus(taskId, config);
      }

      const endpoint = config.endpoint || 'https://api.minimaxi.com/v1';
      const timestamp = Math.floor(Date.now() / 1000);
      const headers = this.signedHeaders(config, timestamp);

      // 判断是否为音频任务 (通常音频任务 ID 是 cgt_ 开头或者在 params 中标记)
      // 实际上 MiniMax T2A V2 异步任务查询端点不同
      const isAudioTask = taskId.includes('t2a'); // 这是一个假设，或者我们可以尝试音频查询端点

      let data;
      try {
        // 尝试音频查询端点
        data = await this.apiGetWithRetry(
          `${endpoint}/t2a_async_query_v2?task_id=${taskId}`,
          headers,
          30000,
          2,
          1000
        );
      } catch (err) {
        // 如果失败，回退到视频查询端点
        data = await this.apiGetWithRetry(
          `${endpoint}/video_generation/${taskId}`,
          headers,
          30000,
          2,
          1000
        );
      }

      const statusMap: Record<string, GenerationResult['status']> = {
        pending: 'pending',
        preparing: 'pending',
        processing: 'processing',
        completed: 'completed',
        success: 'completed',
        Success: 'completed',
        failed: 'failed',
        fail: 'failed',
      };

      const status = data.status || data.data?.status;
      const taskStatus = this.mapStatus(status, statusMap);

      const audioUrl = data.data?.audio_url || data.output?.audio_url;
      const videoUrl = data.output?.video_url;

      return {
        taskId,
        status: taskStatus,
        provider: this.name,
        result: {
          audioUrl,
          videoUrl,
          thumbnailUrl: data.output?.thumbnail_url,
          metadata: data,
        },
        error: data.error?.message || data.base_resp?.status_msg,
        progress: data.progress,
      };
    } catch (error: unknown) {
      return this.makeFailedTaskResult(taskId, error);
    }
  }

  private async getHailuoTaskStatus(
    taskId: string,
    config: ApiProviderConfig
  ): Promise<GenerationResult> {
    try {
      const baseUrl = config.hailuoEndpoint || config.endpoint || 'https://api.minimaxi.com';
      const endpoint = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
      const apiKey = config.hailuoApiKey || config.apiKey;
      const realTaskId = taskId.replace(/^hailuo_/, '');

      const data = await this.apiGetWithRetry(
        `${endpoint}/video_generation/query?task_id=${realTaskId}`,
        {
          Authorization: `Bearer ${apiKey}`,
        },
        30000,
        2,
        1000
      );

      const statusMap: Record<string, GenerationResult['status']> = {
        Preparing: 'pending',
        Queueing: 'pending',
        Processing: 'processing',
        Success: 'completed',
        Fail: 'failed',
      };

      const apiStatus = data.status;
      const taskStatus = this.mapStatus(apiStatus, statusMap);

      let videoUrl: string | undefined;
      const metadata: Record<string, any> = { ...data };

      if (apiStatus === 'Success' && data.file_id) {
        metadata.file_id = data.file_id;
        metadata.video_width = data.video_width;
        metadata.video_height = data.video_height;
        try {
          const fileData = await this.apiGet(`${endpoint}/files/${data.file_id}`, {
            Authorization: `Bearer ${apiKey}`,
          });
          if (fileData.file?.download_url) {
            videoUrl = fileData.file.download_url;
            metadata.download_url = fileData.file.download_url;
          }
        } catch (downloadError: unknown) {
          console.warn(
            '[MiniMaxProvider] Failed to get download URL:',
            downloadError instanceof Error ? downloadError.message : String(downloadError)
          );
        }
      }

      return {
        taskId,
        status: taskStatus,
        provider: this.name,
        result: videoUrl ? { videoUrl, metadata } : { metadata },
        error: apiStatus === 'Fail' ? data.base_resp?.status_msg || 'Generation failed' : undefined,
      };
    } catch (error: unknown) {
      return this.makeFailedTaskResult(taskId, error);
    }
  }
}
