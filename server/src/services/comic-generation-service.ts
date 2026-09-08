import { MinimaxProvider } from './minimax-provider';
import { WuyinkejiProvider } from './wuyinkeji-provider';
import { VideoParams, ImageParams, AudioParams, GenerationResult, ApiProviderConfig } from '../types/api';
import prisma from '../lib/prisma';
import { decryptProviderSecrets, getApiProviderConfig } from '../routes/ai-provider';
import { buildCharacterPrompt as sharedBuildCharacterPrompt, buildScenePrompt as sharedBuildScenePrompt, buildAssetPrompt as sharedBuildAssetPrompt } from './comic-prompt-builder';
import { storageService } from './storage-service';
import { websocketPushService, WebSocketEvent } from './websocket-push-service';
import { unifiedApiService } from './unified-service';
import { resolveImageModelChannel } from './model-channel-registry';
import {
  ComicCharacter,
  ComicScene,
  ComicDialogue,
  ComicCharacterInput,
  ComicSceneInput,
  ComicAssetInput,
  VideoProvider,
  VideoGenerationOptions,
} from '@shared/types/comic';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export type { ComicCharacter, ComicScene, ComicDialogue, ComicCharacterInput, ComicSceneInput, ComicAssetInput };



const DOUBAO_MODEL_MAP: Record<string, string> = {
  'doubao-seedance-1.5-pro': 'doubao-seedance-1-5-pro-251215',
};

export class ComicGenerationService {
  private minimaxProvider: MinimaxProvider;
  private wuyinkejiProvider: WuyinkejiProvider;

  constructor() {
    this.minimaxProvider = new MinimaxProvider();
    this.wuyinkejiProvider = new WuyinkejiProvider();
  }

  async generateCharacterImage(params: {
    character: ComicCharacterInput;
    style?: string;
    aspectRatio?: string;
    referenceImageUrl?: string;
    referenceImages?: string[];
    negativePrompt?: string;
    promptOptimizer?: boolean;
    imageModel?: string;
    imageProvider?: string;
  }): Promise<string> {
    const prompt = this.buildCharacterPrompt(params.character, params.style);
    const referenceImages = this.normalizeReferenceImages(params.referenceImageUrl, params.referenceImages);

    if (params.imageProvider || params.imageModel) {
      const url = await this.generateImageWithSelectedModel({
        prompt,
        negativePrompt: params.negativePrompt,
        aspectRatio: params.aspectRatio,
        referenceImageUrl: params.referenceImageUrl,
        referenceImages,
        promptOptimizer: params.promptOptimizer,
        imageProvider: params.imageProvider,
        imageModel: params.imageModel,
      });
      if (url) return url;
    }

    const config = await this.getProviderConfigByName('wuyinkeji');
    const imageParams: ImageParams = {
      prompt,
      negativePrompt: params.negativePrompt,
      provider: 'wuyinkeji',
      model: 'doubao-seedream-5-0-pro',
      resolution: (params.aspectRatio as ImageParams['resolution']) || '1:1',
      pixelResolution: '720p',
      referenceImageUrl: params.referenceImageUrl,
      referenceImages,
      promptOptimizer: params.promptOptimizer,
    };

    const result = await this.wuyinkejiProvider.generateImage(imageParams, config);
    
    if (result.status === 'completed' && result.result?.url) {
      return result.result.url;
    }
    
    if (result.status !== 'pending' || !result.taskId) {
      throw new Error(result.error || 'Image generation failed');
    }

    const imageUrl = await this.pollForCompletion(result.taskId, 'image');
    return imageUrl;
  }

  async generateSceneImage(params: {
    scene: ComicSceneInput;
    style?: string;
    aspectRatio?: string;
    referenceImageUrl?: string;
    referenceImages?: string[];
    negativePrompt?: string;
    promptOptimizer?: boolean;
    imageModel?: string;
    imageProvider?: string;
  }): Promise<string> {
    const prompt = this.buildScenePrompt(params.scene, params.style);
    const referenceImages = this.normalizeReferenceImages(params.referenceImageUrl, params.referenceImages);

    if (params.imageProvider || params.imageModel) {
      const url = await this.generateImageWithSelectedModel({
        prompt,
        negativePrompt: params.negativePrompt,
        aspectRatio: params.aspectRatio,
        referenceImageUrl: params.referenceImageUrl,
        referenceImages,
        promptOptimizer: params.promptOptimizer,
        imageProvider: params.imageProvider,
        imageModel: params.imageModel,
      });
      if (url) return url;
    }

    const config = await this.getProviderConfigByName('wuyinkeji');
    const imageParams: ImageParams = {
      prompt,
      negativePrompt: params.negativePrompt,
      provider: 'wuyinkeji',
      model: 'doubao-seedream-5-0-pro',
      resolution: (params.aspectRatio as ImageParams['resolution']) || '16:9',
      pixelResolution: '720p',
      referenceImageUrl: params.referenceImageUrl,
      referenceImages,
      promptOptimizer: params.promptOptimizer,
    };

    const result = await this.wuyinkejiProvider.generateImage(imageParams, config);
    
    if (result.status === 'completed' && result.result?.url) {
      return result.result.url;
    }
    
    if (result.status !== 'pending' || !result.taskId) {
      throw new Error(result.error || 'Scene image generation failed');
    }

    const imageUrl = await this.pollForCompletion(result.taskId, 'image');
    return imageUrl;
  }

  async generateAssetImage(params: {
    asset: ComicAssetInput;
    style?: string;
    aspectRatio?: string;
    referenceImageUrl?: string;
    referenceImages?: string[];
    negativePrompt?: string;
    promptOptimizer?: boolean;
    imageModel?: string;
    imageProvider?: string;
  }): Promise<string> {
    const prompt = this.buildAssetPrompt(params.asset, params.style);
    const referenceImages = this.normalizeReferenceImages(params.referenceImageUrl, params.referenceImages);

    if (params.imageProvider || params.imageModel) {
      const url = await this.generateImageWithSelectedModel({
        prompt,
        negativePrompt: params.negativePrompt,
        aspectRatio: params.aspectRatio,
        referenceImageUrl: params.referenceImageUrl,
        referenceImages,
        promptOptimizer: params.promptOptimizer,
        imageProvider: params.imageProvider,
        imageModel: params.imageModel,
      });
      if (url) return url;
    }

    const config = await this.getProviderConfigByName('wuyinkeji');
    const imageParams: ImageParams = {
      prompt,
      negativePrompt: params.negativePrompt,
      provider: 'wuyinkeji',
      model: 'doubao-seedream-5-0-pro',
      resolution: (params.aspectRatio as ImageParams['resolution']) || '1:1',
      pixelResolution: '720p',
      referenceImageUrl: params.referenceImageUrl,
      referenceImages,
      promptOptimizer: params.promptOptimizer,
    };

    const result = await this.wuyinkejiProvider.generateImage(imageParams, config);

    if (result.status === 'completed' && result.result?.url) {
      return result.result.url;
    }

    if (result.status !== 'pending' || !result.taskId) {
      throw new Error(result.error || 'Asset image generation failed');
    }

    const imageUrl = await this.pollForCompletion(result.taskId, 'image');
    return imageUrl;
  }

  async generateSceneVideo(params: {
    scene: ComicSceneInput;
    style?: string;
    duration?: number;
    videoModel?: string;
    videoProvider?: 'doubao' | 'vidu' | 'minimax';
    userId?: string;
    referenceImageUrl?: string;
    referenceImageRole?: 'first_frame' | 'last_frame';
    controlNetEnabled?: boolean;
    controlNetType?: 'pose' | 'canny' | 'depth' | 'seg';
    controlNetStrength?: number;
    ipAdapterEnabled?: boolean;
    ipAdapterStrength?: number;
  }): Promise<string> {
    const provider = params.videoProvider || 'doubao';
    const model = params.videoModel || 'doubao-seedance-2.0';

    if (provider === 'doubao') {
      return this.generateDoubaoVideo(params, model);
    } else if (provider === 'vidu') {
      return this.generateViduVideo(params, model);
    } else if (provider === 'minimax') {
      return this.generateMinimaxVideo(params, model);
    }

    throw new Error('Unsupported video provider');
  }

  private async getProviderConfigByName(providerName: string): Promise<ApiProviderConfig> {
    const providerConfig = await prisma.providerConfig.findUnique({
      where: { provider: providerName }
    });

    if (!providerConfig || !providerConfig.isActive) {
      throw new Error(`Provider ${providerName} is not available`);
    }

    const secrets = decryptProviderSecrets(providerConfig);
    return {
      apiKey: secrets.apiKey || '',
      apiSecret: secrets.apiSecret || undefined,
      endpoint: providerConfig.endpoint || undefined,
    };
  }

  /**
   * 通过 unifiedApiService 使用指定的 provider/model 生成图片，
   * 复用 AI 图片节点的 provider 解析与密钥管理链路。
   * 当 imageProvider/imageModel 未提供时返回 null，由调用方走默认 wuyinkeji 链路。
   */
  private async generateImageWithSelectedModel(params: {
    prompt: string;
    negativePrompt?: string;
    aspectRatio?: string;
    referenceImageUrl?: string;
    referenceImages?: string[];
    promptOptimizer?: boolean;
    imageProvider?: string;
    imageModel?: string;
  }): Promise<string | null> {
    const { imageProvider, imageModel } = params;
    if (!imageProvider && !imageModel) return null;

    // 复用 model-channel-registry 解析渠道；未命中时按 model 名称做基础推断
    const resolvedChannel = resolveImageModelChannel(imageProvider, imageModel);
    let providerName: string;
    let modelName: string;
    if (resolvedChannel?.channel.enabled) {
      providerName = resolvedChannel.provider;
      modelName = resolvedChannel.model || imageModel || '';
    } else {
      const normalizedModel = String(imageModel || '').toLowerCase();
      if (normalizedModel === 'sensenova-u1-fast' || normalizedModel.startsWith('sensenova-u1')) {
        providerName = 'sensenova';
        modelName = imageModel || 'sensenova-u1-fast';
      } else if (normalizedModel === 'step-image-edit-2') {
        providerName = 'stepfun';
        modelName = 'step-image-edit-2';
      } else if (normalizedModel.startsWith('agnes-image')) {
        providerName = 'agnes';
        modelName = imageModel || '';
      } else {
        providerName = imageProvider || 'wuyinkeji';
        modelName = imageModel || '';
      }
    }

    const apiConfig = await getApiProviderConfig(providerName);
    if (!apiConfig || !apiConfig.apiKey) {
      throw new Error(`图片服务商 ${providerName} 未配置可用密钥`);
    }

    const config: ApiProviderConfig = {
      apiKey: apiConfig.apiKey,
      apiSecret: apiConfig.apiSecret || undefined,
      endpoint: apiConfig.endpoint || undefined,
    };

    const imageParams: ImageParams = {
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      provider: providerName,
      model: modelName,
      resolution: (params.aspectRatio as ImageParams['resolution']) || '1:1',
      pixelResolution: '720p',
      referenceImageUrl: params.referenceImageUrl,
      referenceImages: params.referenceImages,
      promptOptimizer: params.promptOptimizer,
    };

    const result = await unifiedApiService.generateImage(imageParams, config);

    if (result.status === 'completed' && result.result?.url) {
      return result.result.url;
    }

    if (result.status !== 'pending' || !result.taskId) {
      throw new Error(result.error || '图片生成失败');
    }

    return this.pollForCompletion(result.taskId, 'image');
  }

  private async generateDoubaoVideo(params: {
    scene: ComicSceneInput;
    style?: string;
    duration?: number;
    userId?: string;
    referenceImageUrl?: string;
    referenceImageRole?: 'first_frame' | 'last_frame';
    controlNetEnabled?: boolean;
    controlNetType?: 'pose' | 'canny' | 'depth' | 'seg';
    controlNetStrength?: number;
    ipAdapterEnabled?: boolean;
    ipAdapterStrength?: number;
  }, model: string): Promise<string> {
    const config = await this.getProviderConfigByName('doubao');
    const baseUrl = config.endpoint || 'https://ark.cn-beijing.volces.com';
    const apiKey = config.apiKey;

    if (!apiKey) {
      throw new Error('豆包视频API密钥未配置');
    }

    const apiModel = DOUBAO_MODEL_MAP[model] || model;
    const prompt = this.buildScenePrompt(params.scene, params.style, true);

    const content: any[] = [{ type: 'text', text: prompt }];

    if (params.referenceImageUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: params.referenceImageUrl },
        role: params.referenceImageRole || 'first_frame',
      });
    }

    if (params.ipAdapterEnabled && params.referenceImageUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: params.referenceImageUrl },
        ip_adapter_strength: params.ipAdapterStrength || 0.7,
      });
    }

    const requestBody: any = {
      model: apiModel,
      content,
      duration: params.duration || 5,
      resolution: '720p',
      ratio: '16:9',
      seed: -1,
      watermark: false,
      generate_audio: false,
    };

    if (params.controlNetEnabled && params.referenceImageUrl) {
      requestBody.controlnet = {
        type: params.controlNetType || 'pose',
        image_url: params.referenceImageUrl,
        strength: params.controlNetStrength || 0.8,
      };
    }

    const response = await axios.post(
      `${baseUrl}/api/v3/contents/generations/tasks`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000,
      }
    );

    const taskId = response.data?.id;
    if (!taskId) {
      throw new Error('豆包视频生成失败');
    }

    websocketPushService.sendToUser(params.userId || '', {
      type: WebSocketEvent.TASK_PROGRESS,
      data: { taskId, provider: 'doubao', status: 'submitted', progress: 0 },
      timestamp: new Date().toISOString(),
    });

    return await this.pollForDoubaoVideoCompletion(taskId, params.userId);
  }

  private async generateViduVideo(params: { scene: ComicSceneInput; style?: string; duration?: number }, model: string): Promise<string> {
    const config = await this.getProviderConfigByName('vidu');
    const apiKey = config.apiKey;
    const baseUrl = config.endpoint || 'https://api.vidu.cn';
    
    if (!apiKey) {
      throw new Error('Vidu API密钥未配置');
    }

    const prompt = this.buildScenePrompt(params.scene, params.style, true);

    const response = await axios.post(
      `${baseUrl}/ent/v2/reference2video`,
      {
        model,
        prompt,
        duration: params.duration || 6,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000,
      }
    );

    const taskId = response.data?.task_id;
    if (!taskId) {
      throw new Error('Vidu视频生成失败');
    }

    return await this.pollForViduVideoCompletion(taskId);
  }

  private async generateMinimaxVideo(params: { scene: ComicSceneInput; style?: string; duration?: number }, model: string): Promise<string> {
    const config = await this.getProviderConfigByName('minimax');
    
    const prompt = this.buildScenePrompt(params.scene, params.style, true);
    
    const videoParams: VideoParams = {
      prompt,
      provider: 'minimax',
      duration: params.duration || 6,
      pixelResolution: '720p',
      resolution: '16:9',
      model,
    };

    const result = await this.minimaxProvider.generateVideo(videoParams, config);
    
    if (result.status !== 'pending' || !result.taskId) {
      throw new Error(result.error || 'MiniMax视频生成失败');
    }

    return await this.pollForCompletion(result.taskId, 'video');
  }

  private async pollForDoubaoVideoCompletion(taskId: string, userId?: string): Promise<string> {
    const config = await this.getProviderConfigByName('doubao');
    const apiKey = config.apiKey;
    const baseUrl = config.endpoint || 'https://ark.cn-beijing.volces.com';
    const maxAttempts = 60;
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));

      try {
        const response = await axios.get(
          `${baseUrl}/api/v3/contents/generations/tasks/${taskId}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (response.data.status === 'succeeded') {
          const videoUrl = response.data.video_url || response.data.output?.video_url;
          if (!videoUrl) {
            throw new Error('视频生成完成但未返回有效URL');
          }
          if (userId) {
            websocketPushService.sendToUser(userId, {
              type: WebSocketEvent.TASK_COMPLETE,
              data: { taskId, provider: 'doubao', videoUrl },
              timestamp: new Date().toISOString(),
            });
          }
          return videoUrl;
        }

        if (response.data.status === 'failed') {
          const errMsg = response.data.error?.message || '豆包视频生成失败';
          if (userId) {
            websocketPushService.sendToUser(userId, {
              type: WebSocketEvent.TASK_FAILED,
              data: { taskId, provider: 'doubao', error: errMsg },
              timestamp: new Date().toISOString(),
            });
          }
          throw new Error(errMsg);
        }

        attempts++;
      } catch (error) {
        // 业务错误（视频生成失败）立即抛出，网络错误继续轮询
        if (error instanceof Error && error.message.includes('视频生成失败')) {
          throw error;
        }
        console.error('Doubao 轮询查询失败:', error);
        attempts++;
      }
    }

    throw new Error('视频生成超时');
  }

  private async pollForViduVideoCompletion(taskId: string): Promise<string> {
    const config = await this.getProviderConfigByName('vidu');
    const apiKey = config.apiKey;
    const baseUrl = config.endpoint || 'https://api.vidu.cn';
    const maxAttempts = 60;
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));

      try {
        const response = await axios.get(
          `${baseUrl}/ent/v2/tasks/${taskId}/creations`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (response.data.state === 'success') {
          const videoUrl = response.data.creations?.[0]?.url;
          if (!videoUrl) {
            throw new Error('视频生成完成但未返回有效URL');
          }
          return videoUrl;
        }

        if (response.data.state === 'failed') {
          throw new Error(response.data.error?.message || 'Vidu视频生成失败');
        }

        attempts++;
      } catch (error) {
        // 业务错误（视频生成失败）立即抛出，网络错误继续轮询
        if (error instanceof Error && (error.message.includes('视频生成失败') || error.message.includes('生成失败'))) {
          throw error;
        }
        console.error('Vidu 轮询查询失败:', error);
        attempts++;
      }
    }

    throw new Error('视频生成超时');
  }

  async generateDialogueAudio(params: {
    dialogue: Partial<ComicDialogue> & { text: string; characterId?: string };
    voiceId?: string;
    speed?: number;
    pitch?: number;
    audioModel?: string;
    audioProvider?: string;
  }): Promise<string> {
    const audioProvider = params.audioProvider || 'minimax';

    // 非 minimax provider 走统一音频生成链路（stepfun 等）
    if (audioProvider !== 'minimax') {
      const apiConfig = await getApiProviderConfig(audioProvider);
      if (!apiConfig || !apiConfig.apiKey) {
        throw new Error(`音频服务商 ${audioProvider} 未配置可用密钥`);
      }
      const config: ApiProviderConfig = {
        apiKey: apiConfig.apiKey,
        apiSecret: apiConfig.apiSecret || undefined,
        endpoint: apiConfig.endpoint || undefined,
      };
      const audioParams: AudioParams = {
        provider: audioProvider,
        model: params.audioModel || '',
        text: params.dialogue.text,
        voiceId: params.voiceId || 'female-tianmei',
        speed: params.speed ?? 1.0,
        pitch: params.pitch ?? 0,
        format: 'mp3',
        sampleRate: 32000,
        bitrate: 128000,
        channel: 1,
      };
      const result = await unifiedApiService.generateAudio(audioParams, config);
      if (result.status === 'completed' && result.result?.url) {
        return result.result.url;
      }
      throw new Error(result.error || `音频服务商 ${audioProvider} 暂不支持漫剧对话音频生成`);
    }

    const config = await this.getProviderConfigByName('minimax');
    const baseUrl = config.endpoint?.replace(/\/v1\/?$/, '') || 'https://api.minimaxi.com';

    const response = await axios.post(
      `${baseUrl}/v1/t2a_v2`,
      {
        model: params.audioModel || 'speech-2.8-hd',
        text: params.dialogue.text,
        voice_setting: {
          voice_id: params.voiceId || 'female-tianmei',
          speed: params.speed ?? 1.0,
          pitch: params.pitch ?? 0,
          vol: 1.0,
        },
        audio_setting: {
          format: 'mp3',
          sample_rate: 32000,
          bitrate: 128000,
          channel: 1,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const respData = response.data;
    if (respData.base_resp?.status_code !== 0) {
      throw new Error(respData.base_resp?.status_msg || 'TTS API error');
    }

    const hexAudio = respData.data?.audio;
    if (hexAudio && /^[0-9a-fA-F]+$/.test(hexAudio)) {
      const audioBuffer = Buffer.from(hexAudio, 'hex');
      if (audioBuffer.length > 0) {
        const audioId = uuidv4();
        const fileName = `${audioId}.mp3`;

        const musicDir = path.join(process.cwd(), 'uploads', 'comic-tts', 'comic-audio');
        if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir, { recursive: true });
        const filePath = path.join(musicDir, fileName);
        fs.writeFileSync(filePath, audioBuffer);
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3200}`;
        return `${baseUrl}/uploads/comic-tts/comic-audio/${fileName}`;
      }
    }

    if (respData.data?.audio_url || respData.output?.audio_url) {
      return respData.data?.audio_url || respData.output.audio_url;
    }

    throw new Error('Audio generation failed: no audio data in response');
  }

  private buildCharacterPrompt(character: ComicCharacterInput, style?: string): string {
    return sharedBuildCharacterPrompt({
      name: character.name,
      description: character.description,
      style,
      appearance: character.appearance,
      outfit: character.outfit,
      personality: character.personality,
    });
  }

  private normalizeReferenceImages(primaryUrl?: string, referenceImages?: string[]): string[] | undefined {
    const primary = primaryUrl?.trim();
    const images = Array.from(new Set((referenceImages || []).map((url) => url.trim()).filter(Boolean)));
    const normalized = primary ? images.filter((url) => url !== primary) : images;
    return normalized.length > 0 ? normalized : undefined;
  }

  private buildScenePrompt(scene: ComicSceneInput, style?: string, isVideo: boolean = false): string {
    return sharedBuildScenePrompt({
      type: scene.location,
      timeOfDay: scene.timeOfDay,
      description: scene.description,
      style,
      isVideo,
      location: scene.location,
      mood: scene.mood,
    });
  }

  private buildAssetPrompt(asset: ComicAssetInput, style?: string): string {
    return sharedBuildAssetPrompt({
      name: asset.name,
      description: asset.description,
      category: asset.category,
      material: asset.material,
      function: asset.function,
      style,
    });
  }

  private async pollForCompletion(taskId: string, type: 'image' | 'video'): Promise<string> {
    const maxAttempts = 60;
    let attempts = 0;
    const config = await this.getProviderConfigByName('minimax');
    const baseUrl = config.endpoint?.replace(/\/v1\/?$/, '') || 'https://api.minimaxi.com';
    const queryEndpoint = type === 'image'
      ? `${baseUrl}/v1/query/image_generation`
      : `${baseUrl}/v1/query/video_generation`;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        const response = await axios.get(
          queryEndpoint,
          {
            params: { task_id: taskId },
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
            },
          }
        );

        const taskStatus = response.data;

        if (taskStatus.status === 'success' || taskStatus.status === 'completed') {
          if (type === 'image') {
            const imageUrl = taskStatus.data?.images?.[0]?.url;
            if (!imageUrl) {
              throw new Error('图片生成完成但未返回有效URL');
            }
            return imageUrl;
          } else {
            const videoUrl = taskStatus.data?.video_url;
            if (!videoUrl) {
              throw new Error('视频生成完成但未返回有效URL');
            }
            return videoUrl;
          }
        }

        if (taskStatus.status === 'failed') {
          const errorMsg = typeof taskStatus.error === 'string'
            ? taskStatus.error
            : (taskStatus.error?.message || 'Generation failed');
          throw new Error(errorMsg);
        }

        attempts++;
      } catch (error) {
        console.error(`Polling error for task ${taskId}:`, error);
        attempts++;
      }
    }

    throw new Error('Generation timeout');
  }

  // ============ Sprint 3: 异步提交方法（创建 Task 记录，不阻塞等待） ============

  async submitCharacterImage(params: {
    character: ComicCharacterInput;
    style?: string;
    aspectRatio?: string;
    referenceImageUrl?: string;
    referenceImages?: string[];
    negativePrompt?: string;
    promptOptimizer?: boolean;
    imageModel?: string;
    imageProvider?: string;
    userId?: string;
  }): Promise<{ taskId: string; status: string; url?: string }> {
    const prompt = this.buildCharacterPrompt(params.character, params.style);
    return this.submitImageAndCreateTask({
      prompt,
      params,
      userId: params.userId || '',
      defaultAspect: '1:1',
    });
  }

  async submitSceneImage(params: {
    scene: ComicSceneInput;
    style?: string;
    aspectRatio?: string;
    referenceImageUrl?: string;
    referenceImages?: string[];
    negativePrompt?: string;
    promptOptimizer?: boolean;
    imageModel?: string;
    imageProvider?: string;
    userId?: string;
  }): Promise<{ taskId: string; status: string; url?: string }> {
    const prompt = this.buildScenePrompt(params.scene, params.style);
    return this.submitImageAndCreateTask({
      prompt,
      params,
      userId: params.userId || '',
      defaultAspect: '16:9',
    });
  }

  async submitAssetImage(params: {
    asset: ComicAssetInput;
    style?: string;
    aspectRatio?: string;
    referenceImageUrl?: string;
    referenceImages?: string[];
    negativePrompt?: string;
    promptOptimizer?: boolean;
    imageModel?: string;
    imageProvider?: string;
    userId?: string;
  }): Promise<{ taskId: string; status: string; url?: string }> {
    const prompt = this.buildAssetPrompt(params.asset, params.style);
    return this.submitImageAndCreateTask({
      prompt,
      params,
      userId: params.userId || '',
      defaultAspect: '1:1',
    });
  }

  private async submitImageAndCreateTask(opts: {
    prompt: string;
    params: Record<string, unknown>;
    userId: string;
    defaultAspect: ImageParams['resolution'];
  }): Promise<{ taskId: string; status: string; url?: string }> {
    const p = opts.params as {
      negativePrompt?: string;
      aspectRatio?: string;
      referenceImageUrl?: string;
      referenceImages?: string[];
      promptOptimizer?: boolean;
      imageProvider?: string;
      imageModel?: string;
    };
    const referenceImages = this.normalizeReferenceImages(p.referenceImageUrl, p.referenceImages);

    let providerTaskId: string | undefined;
    let providerName: string;
    let modelName: string;
    let outputUrl: string | undefined;

    if (p.imageProvider || p.imageModel) {
      const selected = await this.submitImageWithSelectedModel({
        prompt: opts.prompt,
        negativePrompt: p.negativePrompt,
        aspectRatio: p.aspectRatio || opts.defaultAspect,
        referenceImageUrl: p.referenceImageUrl,
        referenceImages,
        promptOptimizer: p.promptOptimizer,
        imageProvider: p.imageProvider,
        imageModel: p.imageModel,
      });
      if (selected) {
        providerTaskId = selected.providerTaskId;
        providerName = selected.provider;
        modelName = selected.model;
        outputUrl = selected.url;
      } else {
        const config = await this.getProviderConfigByName('wuyinkeji');
        const result = await this.wuyinkejiProvider.generateImage({
          prompt: opts.prompt,
          negativePrompt: p.negativePrompt,
          provider: 'wuyinkeji',
          model: 'doubao-seedream-5-0-pro',
          resolution: (p.aspectRatio as ImageParams['resolution']) || opts.defaultAspect,
          pixelResolution: '720p',
          referenceImageUrl: p.referenceImageUrl,
          referenceImages,
          promptOptimizer: p.promptOptimizer,
        }, config);
        providerName = 'wuyinkeji';
        modelName = 'doubao-seedream-5-0-pro';
        if (result.status === 'completed' && result.result?.url) {
          outputUrl = result.result.url;
        } else if (result.status === 'pending' && result.taskId) {
          providerTaskId = result.taskId;
        } else {
          throw new Error(result.error || '图片提交失败');
        }
      }
    } else {
      const config = await this.getProviderConfigByName('wuyinkeji');
      const result = await this.wuyinkejiProvider.generateImage({
        prompt: opts.prompt,
        negativePrompt: p.negativePrompt,
        provider: 'wuyinkeji',
        model: 'doubao-seedream-5-0-pro',
        resolution: (p.aspectRatio as ImageParams['resolution']) || opts.defaultAspect,
        pixelResolution: '720p',
        referenceImageUrl: p.referenceImageUrl,
        referenceImages,
        promptOptimizer: p.promptOptimizer,
      }, config);
      providerName = 'wuyinkeji';
      modelName = 'doubao-seedream-5-0-pro';
      if (result.status === 'completed' && result.result?.url) {
        outputUrl = result.result.url;
      } else if (result.status === 'pending' && result.taskId) {
        providerTaskId = result.taskId;
      } else {
        throw new Error(result.error || '图片提交失败');
      }
    }

    const status = outputUrl ? 'completed' : 'pending';
    const task = await prisma.task.create({
      data: {
        userId: opts.userId,
        type: 'image',
        prompt: opts.prompt,
        params: JSON.stringify({ ...opts.params, source: 'comic' }),
        status,
        progress: outputUrl ? 100 : 0,
        provider: providerName!,
        model: modelName!,
        providerTaskId: providerTaskId || null,
        outputUrl: outputUrl || null,
        result: outputUrl ? JSON.stringify({ url: outputUrl }) : null,
      },
    });

    if (outputUrl && opts.userId) {
      websocketPushService.notifyTaskComplete(opts.userId, task.id, { url: outputUrl }, {
        type: 'image',
        provider: providerName!,
        prompt: opts.prompt,
      });
    }

    return { taskId: task.id, status, url: outputUrl };
  }

  private async submitImageWithSelectedModel(params: {
    prompt: string;
    negativePrompt?: string;
    aspectRatio?: string;
    referenceImageUrl?: string;
    referenceImages?: string[];
    promptOptimizer?: boolean;
    imageProvider?: string;
    imageModel?: string;
  }): Promise<{ providerTaskId?: string; provider: string; model: string; url?: string } | null> {
    const { imageProvider, imageModel } = params;
    if (!imageProvider && !imageModel) return null;

    const resolvedChannel = resolveImageModelChannel(imageProvider, imageModel);
    let providerName: string;
    let modelName: string;
    if (resolvedChannel?.channel.enabled) {
      providerName = resolvedChannel.provider;
      modelName = resolvedChannel.model || imageModel || '';
    } else {
      const normalizedModel = String(imageModel || '').toLowerCase();
      if (normalizedModel === 'sensenova-u1-fast' || normalizedModel.startsWith('sensenova-u1')) {
        providerName = 'sensenova';
        modelName = imageModel || 'sensenova-u1-fast';
      } else if (normalizedModel === 'step-image-edit-2') {
        providerName = 'stepfun';
        modelName = 'step-image-edit-2';
      } else if (normalizedModel.startsWith('agnes-image')) {
        providerName = 'agnes';
        modelName = imageModel || '';
      } else {
        providerName = imageProvider || 'wuyinkeji';
        modelName = imageModel || '';
      }
    }

    const apiConfig = await getApiProviderConfig(providerName);
    if (!apiConfig || !apiConfig.apiKey) {
      throw new Error(`图片服务商 ${providerName} 未配置可用密钥`);
    }

    const config: ApiProviderConfig = {
      apiKey: apiConfig.apiKey,
      apiSecret: apiConfig.apiSecret || undefined,
      endpoint: apiConfig.endpoint || undefined,
    };

    const result = await unifiedApiService.generateImage({
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      provider: providerName,
      model: modelName,
      resolution: (params.aspectRatio as ImageParams['resolution']) || '1:1',
      pixelResolution: '720p',
      referenceImageUrl: params.referenceImageUrl,
      referenceImages: params.referenceImages,
      promptOptimizer: params.promptOptimizer,
    }, config);

    if (result.status === 'completed' && result.result?.url) {
      return { provider: providerName, model: modelName, url: result.result.url };
    }
    if (result.status === 'pending' && result.taskId) {
      return { providerTaskId: result.taskId, provider: providerName, model: modelName };
    }
    throw new Error(result.error || '图片提交失败');
  }

  async submitSceneVideo(params: {
    scene: ComicSceneInput;
    style?: string;
    duration?: number;
    videoModel?: string;
    videoProvider?: 'doubao' | 'vidu' | 'minimax';
    userId?: string;
    referenceImageUrl?: string;
    referenceImageRole?: 'first_frame' | 'last_frame';
    controlNetEnabled?: boolean;
    controlNetType?: 'pose' | 'canny' | 'depth' | 'seg';
    controlNetStrength?: number;
    ipAdapterEnabled?: boolean;
    ipAdapterStrength?: number;
  }): Promise<{ taskId: string; status: string }> {
    const provider = params.videoProvider || 'doubao';
    const model = params.videoModel || 'doubao-seedance-2.0';
    const prompt = this.buildScenePrompt(params.scene, params.style, true);

    let providerTaskId: string;
    let providerName: string;
    let modelName: string;

    if (provider === 'doubao') {
      const result = await this.submitDoubaoVideo(params, model);
      providerTaskId = result.providerTaskId;
      providerName = result.provider;
      modelName = result.model;
    } else if (provider === 'vidu') {
      const result = await this.submitViduVideo(params, model);
      providerTaskId = result.providerTaskId;
      providerName = result.provider;
      modelName = result.model;
    } else if (provider === 'minimax') {
      const result = await this.submitMinimaxVideo(params, model);
      providerTaskId = result.providerTaskId;
      providerName = result.provider;
      modelName = result.model;
    } else {
      throw new Error('Unsupported video provider');
    }

    const task = await prisma.task.create({
      data: {
        userId: params.userId || '',
        type: 'video',
        prompt,
        params: JSON.stringify({ ...params, source: 'comic' }),
        status: 'processing',
        progress: 0,
        provider: providerName,
        model: modelName,
        providerTaskId,
      },
    });

    if (params.userId) {
      websocketPushService.notifyTaskProgress(params.userId, task.id, 0, {
        type: 'video',
        provider: providerName,
        prompt,
      });
    }

    return { taskId: task.id, status: 'processing' };
  }

  private async submitDoubaoVideo(params: {
    scene: ComicSceneInput;
    style?: string;
    duration?: number;
    userId?: string;
    referenceImageUrl?: string;
    referenceImageRole?: 'first_frame' | 'last_frame';
    controlNetEnabled?: boolean;
    controlNetType?: 'pose' | 'canny' | 'depth' | 'seg';
    controlNetStrength?: number;
    ipAdapterEnabled?: boolean;
    ipAdapterStrength?: number;
  }, model: string): Promise<{ providerTaskId: string; provider: string; model: string }> {
    const config = await this.getProviderConfigByName('doubao');
    const baseUrl = config.endpoint || 'https://ark.cn-beijing.volces.com';
    const apiKey = config.apiKey;
    if (!apiKey) throw new Error('豆包视频API密钥未配置');

    const apiModel = DOUBAO_MODEL_MAP[model] || model;
    const prompt = this.buildScenePrompt(params.scene, params.style, true);

    const content: any[] = [{ type: 'text', text: prompt }];

    if (params.referenceImageUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: params.referenceImageUrl },
        role: params.referenceImageRole || 'first_frame',
      });
    }

    if (params.ipAdapterEnabled && params.referenceImageUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: params.referenceImageUrl },
        ip_adapter_strength: params.ipAdapterStrength || 0.7,
      });
    }

    const requestBody: any = {
      model: apiModel,
      content,
      duration: params.duration || 5,
      resolution: '720p',
      ratio: '16:9',
      seed: -1,
      watermark: false,
      generate_audio: false,
    };

    if (params.controlNetEnabled && params.referenceImageUrl) {
      requestBody.controlnet = {
        type: params.controlNetType || 'pose',
        image_url: params.referenceImageUrl,
        strength: params.controlNetStrength || 0.8,
      };
    }

    const response = await axios.post(
      `${baseUrl}/api/v3/contents/generations/tasks`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000,
      }
    );

    const taskId = response.data?.id;
    if (!taskId) throw new Error('豆包视频生成失败');

    return { providerTaskId: taskId, provider: 'doubao', model };
  }

  private async submitViduVideo(params: {
    scene: ComicSceneInput;
    style?: string;
    duration?: number;
  }, model: string): Promise<{ providerTaskId: string; provider: string; model: string }> {
    const config = await this.getProviderConfigByName('vidu');
    const apiKey = config.apiKey;
    const baseUrl = config.endpoint || 'https://api.vidu.cn';
    if (!apiKey) throw new Error('Vidu API密钥未配置');

    const prompt = this.buildScenePrompt(params.scene, params.style, true);

    const response = await axios.post(
      `${baseUrl}/ent/v2/reference2video`,
      {
        model,
        prompt,
        duration: params.duration || 6,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000,
      }
    );

    const taskId = response.data?.task_id;
    if (!taskId) throw new Error('Vidu视频生成失败');

    return { providerTaskId: taskId, provider: 'vidu', model };
  }

  private async submitMinimaxVideo(params: {
    scene: ComicSceneInput;
    style?: string;
    duration?: number;
  }, model: string): Promise<{ providerTaskId: string; provider: string; model: string }> {
    const config = await this.getProviderConfigByName('minimax');
    const prompt = this.buildScenePrompt(params.scene, params.style, true);

    const result = await this.minimaxProvider.generateVideo({
      prompt,
      provider: 'minimax',
      duration: params.duration || 6,
      pixelResolution: '720p',
      resolution: '16:9',
      model,
    }, config);

    if (result.status !== 'pending' || !result.taskId) {
      throw new Error(result.error || 'MiniMax视频生成失败');
    }

    return { providerTaskId: result.taskId, provider: 'minimax', model };
  }
}

export const comicGenerationService = new ComicGenerationService();
