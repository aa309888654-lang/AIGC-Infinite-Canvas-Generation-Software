import prisma from '../lib/prisma';
import { syncProviderKeysFromEnv } from './provider-key-sync';
import { initRotatorsFromEnv } from './promptSmart3/multiKeyRotator';
import { getFallbackChain } from './promptSmart3/fallbackChain';
import { smartKeyManager } from './smart-key-manager';
import logger from '../utils/logger';
import { isLocalOnlyMode } from '../utils/local-mode';
import { ensureLocalUser } from '../utils/local-user';

export async function initializeSystem(): Promise<void> {
  logger.info('🚀 [SystemInit] 开始系统自动初始化...');

  try {
    // 0. 开源本地模式：创建本地单用户（绕过注册/登录/会员体系）
    await ensureLocalUser();

    // 1. 初始化会员套餐 - REMOVED after deleting membership login system
    // await initMemberships();

    // 2. 初始化 AI Provider 基础配置
    await initProviderConfigs();

    const localOnly = isLocalOnlyMode();

    // 3. 从环境变量同步 API 密钥
    if (localOnly) {
      logger.info('[SystemInit] 本地模式：跳过 Provider API Key 同步');
    } else {
      await syncProviderKeysFromEnv();
    }

    // 3.5 停用已废弃的 Provider
    await deactivateLegacyProviders();

    // 4. 初始化多Key轮询调度器
    if (!localOnly) {
      initRotatorsFromEnv();
    }

    // 5. 初始化降级链状态日志
    const fallbackChain = getFallbackChain();
    logger.info(
      `[SystemInit] FallbackChain: video=${fallbackChain
        .getChainStatus('video')
        .map((e) => `${e.provider}(${e.isActive ? 'active' : 'inactive'})`)
        .join('→')}`
    );
    logger.info(
      `[SystemInit] FallbackChain: image=${fallbackChain
        .getChainStatus('image')
        .map((e) => `${e.provider}(${e.isActive ? 'active' : 'inactive'})`)
        .join('→')}`
    );

    // 6. 启动密钥耗尽自动恢复定时器（每 5 分钟扫描冷却中的耗尽密钥）
    if (!localOnly) {
      smartKeyManager.startAutoRecovery();
    }

    logger.info('✅ [SystemInit] 系统初始化完成');
  } catch (error: unknown) {
    logger.error(
      `❌ [SystemInit] 系统初始化失败: ${error instanceof Error ? error.message : String(error)}`
    );
    // 初始化失败不一定要让进程退出，但应该记录错误
  }
}



async function initProviderConfigs() {
  logger.info('[SystemInit] 正在初始化 Provider 基础配置...');

  // 豆包/Seedance 配置
  const doubaoConfig = {
    supportedModes: ['text-to-image', 'image-to-video', 'text-to-video'],
    models: [
      {
        id: 'doubao-seedance-1-5-pro-251215',
        name: 'Seedance 1.5 Pro',
        description: '即梦视频生成模型 1.5 Pro',
        maxDuration: 12,
        maxResolution: '1080p',
        supportedAspectRatios: ['16:9', '9:16', '4:3', '1:1'],
      },
    ],
    features: {
      imageGeneration: true,
      videoGeneration: true,
      textToImage: true,
      imageToImage: true,
      imageToVideo: true,
      textToVideo: true,
      omniVideo: true,
      multiImageToVideo: true,
    },
    authType: 'api-key',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  };

  await syncProviderConfig('doubao', '豆包 (Doubao)', doubaoConfig);

  // Vidu Q2 配置
  const viduConfig = {
    supportedModes: ['text-to-video', 'image-to-video'],
    features: {
      videoGeneration: true,
      imageToVideo: true,
      textToVideo: true,
    },
    authType: 'api-key',
  };

  await syncProviderConfig('vidu', 'Vidu Q2', viduConfig);

  // MiniMax 配置
  const minimaxConfig = {
    voiceModels: ['speech-2.8-hd', 'speech-2-turbo'],
    musicModels: ['music-2.6', 'lyrics_generation', 'music-cover'],
    imageModels: ['image-01'],
    models: [
      'speech-2.8-hd',
      'speech-2-turbo',
      'music-2.6',
      'lyrics_generation',
      'music-cover',
      'image-01',
    ],
    supportedModes: [
      'text-to-audio',
      'audio-generation',
      'text-to-image',
      'image-generation',
      'music-generation',
      'lyrics-generation',
    ],
    features: {
      audioGeneration: true,
      imageGeneration: true,
      musicGeneration: true,
      lyricsGeneration: true,
    },
    authType: 'api-key',
  };

  await syncProviderConfig('minimax', 'MiniMax', minimaxConfig);

  const wuyinkejiConfig = {
    supportedModes: [
      'text-to-image',
      'image-edit',
      'text-to-video',
      'image-to-video',
      'digital-human',
      'subtitle',
    ],
    features: {
      imageGeneration: true,
      imageEdit: true,
      referenceImage: true,
      videoGeneration: true,
      digitalHuman: true,
      subtitle: true,
    },
    models: [
      'Wan2.7_image',
      'Wan2.6',
      'Wan2.6_video',
      'Wan2.7',
      'video_vidu',
      'video_omni',
      'video_seedance',
      'Digital_Humans',
      'Package_1.0',
    ],
    authType: 'api-key',
    endpoint: process.env.WUYIN_BASE_URL || 'https://api.wuyinkeji.com',
  };

  await syncProviderConfig('wuyinkeji', '小天API (小天AICG2)', wuyinkejiConfig, true);

  // Agnes 独立 provider 配置（XT 模型 agnes-video-v2.0 走独立链路，不经过 wuyinkeji）
  const agnesConfig = {
    supportedModes: [
      'text-to-video',
      'image-to-video',
      'video-to-video',
      'text-to-image',
      'image-to-image',
    ],
    features: {
      videoGeneration: true,
      imageGeneration: true,
      referenceImage: true,
    },
    models: ['agnes-video-v2.0', 'agnes-image-2.1-flash'],
    authType: 'bearer-token',
    endpoint: process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1',
  };

  await syncProviderConfig('agnes', 'Agnes 生成专用池 (XT模型)', agnesConfig, true);

  const sensenovaConfig = {
    supportedModes: ['text-to-image', 'chat', 'text', 'text-generation', 'reasoning'],
    features: {
      imageGeneration: true,
      promptOptimization: true,
      infographics: true,
      textGeneration: true,
      reasoning: true,
    },
    models: [
      {
        id: 'sensenova-u1-fast',
        name: 'SenseNova U1 Fast',
        description: '2K 信息图生成，11 种比例，海报推荐模型',
        maxResolution: '2K',
        supportedAspectRatios: [
          '9:21',
          '9:16',
          '16:9',
          '21:9',
          '4:3',
          '1:1',
          '3:4',
          '2:3',
          '3:2',
          '4:5',
          '5:4',
        ],
        supportedModes: ['text-to-image'],
      },
      {
        id: 'sensenova-6.7-flash-lite',
        name: 'SenseNova 6.7 Flash Lite',
        description: '轻量多模态智能体，256K上下文，支持图像理解，中文理解强',
        supportedModes: ['chat', 'text-generation', 'image-understanding'],
      },
      {
        id: 'deepseek-v4-flash',
        name: 'DeepSeek V4 Flash',
        description: 'DeepSeek V4 Flash 高性能对话模型，1M超长上下文，支持思考模式与工具调用',
        supportedModes: ['chat', 'text-generation', 'reasoning', 'function-calling'],
      },
    ],
    authType: 'bearer',
    endpoint: process.env.SENSENOVA_BASE_URL || 'https://token.sensenova.cn/v1',
  };

  await syncProviderConfig('sensenova', 'SenseNova', sensenovaConfig, true);

  const stepfunConfig = {
    supportedModes: [
      'text-to-image',
      'image-to-image',
      'image-edit',
      'text-to-audio',
      'speech-to-text',
      'audio-chat',
      'realtime-audio',
      'chat',
      'text-generation',
      'reasoning',
      'image-understanding',
      'video-understanding',
    ],
    features: {
      imageGeneration: true,
      imageEdit: true,
      referenceImage: true,
      textToSpeech: true,
      speechToText: true,
      audioChat: true,
      realtimeAudio: true,
      stepPlan: true,
      textGeneration: true,
      reasoning: true,
      visionUnderstanding: true,
    },
    models: [
      {
        id: 'step-image-edit-2',
        name: 'StepFun Image Edit 2',
        description: '高质量图片生成与编辑模型，支持文生图、图生图和图片编辑',
        maxResolution: '1360x768',
        supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        supportedModes: ['text-to-image', 'image-to-image', 'image-edit', 'reference'],
        defaultParams: {
          aspectRatio: '1:1',
          imageSize: '1024x1024',
          imageCount: 1,
          cfgScale: 1,
          steps: 8,
        },
      },
      {
        id: 'step-3.7-flash',
        name: 'Step 3.7 Flash',
        description:
          '长上下文多模态推理旗舰，198B MoE架构，256K上下文，原生支持图片和视频理解，400 TPS高速推理',
        supportedModes: [
          'chat',
          'text-generation',
          'reasoning',
          'image-understanding',
          'video-understanding',
          'function-calling',
        ],
      },
      {
        id: 'step-3.5-flash',
        name: 'Step 3.5 Flash',
        description:
          '长上下文纯文本推理模型，专为智能体构建，256K上下文，稳定可靠的工具调用与长程任务执行',
        supportedModes: ['chat', 'text-generation', 'reasoning', 'function-calling'],
      },
      {
        id: 'stepaudio-2.5-tts',
        name: 'StepAudio 2.5 TTS',
        description: '新一代 Contextual TTS，支持全局语境和文中语境控制',
        supportedModes: ['text-to-speech', 'tts', 'instruction'],
        defaultParams: {
          voiceId: 'cixingnansheng',
          responseFormat: 'mp3',
          sampleRate: 24000,
        },
      },
      {
        id: 'step-tts-mini',
        name: 'Step TTS Mini',
        description: '轻量文本转语音模型，支持高情绪表现力和风格控制',
        supportedModes: ['text-to-speech', 'tts'],
        defaultParams: {
          voiceId: 'cixingnansheng',
          responseFormat: 'mp3',
          sampleRate: 24000,
        },
      },
      {
        id: 'step-tts-2',
        name: 'Step TTS 2',
        description: '高质量文本转语音模型，适合通用高质量配音合成',
        supportedModes: ['text-to-speech', 'tts'],
        defaultParams: {
          voiceId: 'cixingnansheng',
          responseFormat: 'mp3',
          sampleRate: 24000,
        },
      },
      {
        id: 'stepaudio-2.5-asr',
        name: 'StepAudio 2.5 ASR',
        description: '4B MTP 极速语音识别模型，HTTP SSE 流式返回文本',
        supportedModes: ['speech-to-text', 'asr'],
      },
      {
        id: 'stepaudio-2-asr-pro',
        name: 'StepAudio 2 ASR Pro',
        description: '32B 参数 ASR Pro 大参数语音识别模型，更高精度转写，HTTP SSE 流式',
        supportedModes: ['speech-to-text', 'asr'],
      },
      {
        id: 'stepaudio-2.5-chat',
        name: 'StepAudio 2.5 Chat',
        description: '自然语音对话模型，Chat Completions 文本返回',
        supportedModes: ['audio-chat', 'chat', 'text'],
      },
      {
        id: 'step-1o-audio',
        name: 'Step-1o Audio',
        description: '端到端音频理解与语音对话模型',
        supportedModes: ['audio-chat', 'voice-agent', 'audio-understanding'],
      },
      {
        id: 'stepaudio-2.5-realtime',
        name: 'StepAudio 2.5 Realtime',
        description: '端到端实时语音对话模型，WebSocket 双向实时语音',
        supportedModes: ['realtime-audio', 'websocket'],
      },
    ],
    authType: 'bearer',
    endpoint: process.env.STEPFUN_BASE_URL || 'https://api.stepfun.com/step_plan/v1',
  };

  await syncProviderConfig('stepfun', 'StepFun', stepfunConfig, true);

  // Seedream 配置
  const seedreamConfig = {
    supportedModes: ['text-to-image', 'image-to-video', 'text-to-video', 'first-last-frame'],
    models: [
      {
        id: 'doubao-seedream-5-0-lite',
        name: 'Seedream 5.0 Lite',
        description:
          '豆包图片生成模型 5.0 Lite，支持指令遵循、信息图、多图融合、组图输出、流式输出与联网搜索',
        maxResolution: '4K',
        supportedAspectRatios: ['16:9', '9:16', '4:3', '1:1', '3:2', '2:3', '21:9'],
        capabilities: [
          'text-to-image',
          'image-to-image',
          'reference',
          'instruction-following',
          'infographic',
          'multi-image-fusion',
          'sequential-image-generation',
          'streaming-output',
          'web-search',
        ],
      },
      {
        id: 'doubao-seedream-5-0-pro',
        name: 'Seedream 5.0 Pro',
        description:
          '豆包图片生成模型 5.0 Pro，支持点选和框选交互编辑、精准坐标、任意标记、多图融合、图层分离与原生多语种文字生成',
        maxResolution: '2K',
        supportedAspectRatios: ['16:9', '9:16', '4:3', '1:1', '3:2', '2:3', '21:9'],
        capabilities: [
          'text-to-image',
          'image-to-image',
          'reference',
          'inpainting',
          'outpainting',
          'instruction-following',
          'infographic',
          'interactive-edit',
          'precise-coordinate',
          'arbitrary-marking',
          'multi-image-fusion',
        ],
      },
      {
        id: 'doubao-seedream-4-5',
        name: 'Seedream 4.5',
        description: '豆包图片生成模型 4.5',
        maxResolution: '2K',
        supportedAspectRatios: ['16:9', '9:16', '4:3', '1:1', '3:2', '2:3', '21:9'],
      },
    ],
    features: {
      imageGeneration: true,
      videoGeneration: true,
      textToImage: true,
      imageToImage: true,
      imageToVideo: true,
      textToVideo: true,
      firstLastFrame: true,
    },
    authType: 'api-key',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  };

  await syncProviderConfig('seedream', 'Seedream (豆包图片/视频)', seedreamConfig);
}

async function syncProviderConfig(
  provider: string,
  displayName: string,
  config: any,
  autoActivate: boolean = false
) {
  try {
    const configStr = typeof config === 'string' ? config : JSON.stringify(config);
    const existing = await prisma.providerConfig.findUnique({ where: { provider } });
    if (existing) {
      let existingJson: Record<string, unknown> = {};
      try {
        existingJson =
          typeof existing.config === 'string'
            ? JSON.parse(existing.config)
            : (existing.config as Record<string, unknown>) || {};
      } catch {
        /* ignore parse error */
      }
      const mergedConfig = { ...existingJson, ...config };
      const updateData: Record<string, unknown> = {
        displayName,
        config: JSON.stringify(mergedConfig),
      };
      if (autoActivate && !existing.isActive) {
        updateData.isActive = true;
        updateData.endpoint = config.endpoint || '';
      }
      await prisma.providerConfig.update({
        where: { provider },
        data: updateData,
      });
    } else {
      const hasApiKey =
        provider === 'wuyinkeji'
          ? !!process.env.WUYIN_API_KEY
          : provider === 'stepfun'
            ? !!process.env.STEPFUN_API_KEY
            : provider === 'sensenova'
              ? !!(process.env.SENSENOVA_API_KEY || process.env.SENSENOVA_API_KEY_2)
              : true;
      await prisma.providerConfig.create({
        data: {
          provider,
          name: provider,
          displayName,
          isActive: autoActivate && hasApiKey,
          config: configStr,
          endpoint: config.endpoint || '',
        },
      });
    }
  } catch (error: unknown) {
    logger.error(
      `[SystemInit] 同步 Provider ${provider} 失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function deactivateLegacyProviders() {
  const legacyProviders = [
    'apiyi-gpt',
    'apiyi-flux',
    'apiyi',
    'agnes-video',
    // 国外代理通道（纯转发国外模型，已下线）
    'apipaths',
    'aisz',
  ];
  for (const provider of legacyProviders) {
    try {
      const existing = await prisma.providerConfig.findUnique({ where: { provider } });
      if (existing && existing.isActive) {
        await prisma.providerConfig.update({
          where: { provider },
          data: { isActive: false },
        });
        logger.info(`[SystemInit] 已停用旧 Provider: ${provider}`);
      }
    } catch {
      // provider 不存在，跳过
    }
  }
}
