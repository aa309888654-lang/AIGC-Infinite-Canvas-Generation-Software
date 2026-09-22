import { Router } from 'express';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';
import prisma from '../lib/prisma';
import axios from 'axios';
import { comicGenerationService, ComicDialogue, ComicCharacterInput, ComicSceneInput, ComicAssetInput } from '../services/comic-generation-service';
import { parseTaskResult } from '../utils/task-result-helper';
import { websocketPushService } from '../services/websocket-push-service';
import { videoTaskBindingService } from '../services/video-task-binding-service';
import { videoModelKeyScheduler } from '../services/video-model-key-scheduler';
import {
  resolveXunfeiSparkApiKey,
  XUNFEI_SPARK_UPSTREAM_MODEL,
  XUNFEI_SPARK_X15_BASE_URL,
} from '../utils/provider-env-keys';
// TODO: 讯飞星火文字通道已废弃 (2026-07-18)，但 comic.ts 漫剧内容生成核心依赖讯飞 API。
// 此处保留讯飞 imports 仅供漫剧路由使用。后续应将漫剧内容生成迁移到其他可用 LLM provider
// （如 deepseek / apipaths / sensenova 等），迁移完成后可彻底移除讯飞依赖。

export const comicRouter = Router();

const COMIC_ASYNC_ENABLED = process.env.COMIC_ASYNC_ENABLED === 'true';


// 讯飞星火只启用 Spark X1.5 HTTP 兼容通道；旧 astron/maas-coding 模型禁止使用。
// TODO: 讯飞星火文字通道已废弃 (2026-07-18)，漫剧内容生成仍依赖此端点，待后续迁移。
const XUNFEI_CHAT_URL = `${XUNFEI_SPARK_X15_BASE_URL}/chat/completions`;
const XUNFEI_MODEL = XUNFEI_SPARK_UPSTREAM_MODEL;
const XUNFEI_DISPLAY_MODEL = 'spark-x15';

function resolveXunfeiApiKey(): string | undefined {
  return resolveXunfeiSparkApiKey() || undefined;
}

function getXunfeiConfig() {
  const apiKey = resolveXunfeiApiKey();
  if (!apiKey) {
    throw new AppError('讯飞API未配置', 503);
  }
  return apiKey;
}

function parseLLMJsonObject(content: string): Record<string, unknown> {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new AppError('Failed to parse generated content', 500);
  }
}

// 可用的视频生成模型
export const VIDEO_MODELS = {
  doubao: {
    'doubao-seedance-2.0': {
      name: 'Doubao-Seedance-2.0',
      description: '最新版本，支持更高质量和更长视频',
      maxDuration: 12,
      supportAudio: true,
      baseUrl: 'https://ark.cn-beijing.volces.com',
      endpoint: '/api/v3/contents/generations/tasks',
    },
    'doubao-seedance-2.0-fast': {
      name: 'Doubao-Seedance-2.0-Fast',
      description: '快速版本，生成速度更快',
      maxDuration: 6,
      supportAudio: true,
      baseUrl: 'https://ark.cn-beijing.volces.com',
      endpoint: '/api/v3/contents/generations/tasks',
    },
    'doubao-seedance-1.5-pro': {
      name: 'Doubao-Seedance-1.5-Pro',
      description: '专业版，稳定可靠',
      maxDuration: 12,
      supportAudio: true,
      baseUrl: 'https://ark.cn-beijing.volces.com',
      endpoint: '/api/v3/contents/generations/tasks',
    },
  },
  vidu: {
  },
  minimax: {},
} as const;



// Check API connection
comicRouter.get('/check-connection', authenticate, async (req, res, next) => {
  try {
    const results: {
      imageAssets: { connected: boolean; error: string };
      xunfei: { connected: boolean; error: string };
    } = {
      imageAssets: { connected: false, error: '' },
      xunfei: { connected: false, error: '' },
    };

    // Check 小天图片资产 provider configuration without consuming generation credits.
    const wuyinConfig = await prisma.providerConfig.findUnique({
      where: { provider: 'wuyinkeji' },
    });
    if (wuyinConfig?.isActive) {
      results.imageAssets.connected = true;
    } else {
      results.imageAssets.error = '小天图片资产 API 未启用';
    }

    // Check 讯飞 connection (OpenAI兼容协议)
    const xunfeiApiKey = resolveXunfeiApiKey();
    if (xunfeiApiKey) {
      try {
        const response = await axios.post(
          XUNFEI_CHAT_URL,
          {
            model: XUNFEI_MODEL,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 10,
          },
          {
            headers: {
              Authorization: `Bearer ${xunfeiApiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 5000,
          }
        );
        results.xunfei.connected = response.status === 200;
      } catch (error: unknown) {
        results.xunfei.error = (error as any)?.response?.data?.error?.message || (error instanceof Error ? error.message : String(error));
      }
    } else {
      results.xunfei.error = 'API key not configured';
    }

    res.json({
      success: true,
      ...results,
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      imageAssets: { connected: false, error: 'Connection check failed' },
      xunfei: { connected: false, error: 'Connection check failed' },
    });
  }
});

// Get available models
comicRouter.get('/models', authenticate, async (req, res, next) => {
  try {
    const formatVideoModels = (provider: keyof typeof VIDEO_MODELS) => {
      return Object.entries(VIDEO_MODELS[provider]).map(([id, config]) => ({
        id,
        name: config.name,
        description: config.description,
        maxDuration: config.maxDuration,
      }));
    };

    res.json({
      success: true,
      data: {
        image: [
          'image-01',
          'image-01-preview',
          'ep-20260321212919-vfr2q'
        ],
        video: {
          doubao: formatVideoModels('doubao'),
          vidu: formatVideoModels('vidu'),
          minimax: formatVideoModels('minimax'),
        },
        audio: [
          'speech-2.8-hd',
          'speech-2-turbo',
          'music-2.6'
        ],
        llm: [XUNFEI_DISPLAY_MODEL],
      },
    });
  } catch (error: unknown) {
    next(new AppError('Failed to fetch models', 500));
  }
});

// Get video model configuration
comicRouter.get('/video-models', authenticate, async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: VIDEO_MODELS,
    });
  } catch (error: unknown) {
    next(new AppError('Failed to fetch video models', 500));
  }
});

// Generate comic content using LLM
comicRouter.post(
  '/generate-content',
  authenticate,
  async (req, res, next) => {
  try {
    const schema = z.object({
      type: z.enum(['character', 'scene', 'dialogue', 'script']),
      prompt: z.string().min(1),
      style: z.string().optional().default('anime'),
      context: z.record(z.any()).optional(),
    });

    const validatedData = schema.parse(req.body);

    // Build content based on type
    let content = '';

    const styleLabel = validatedData.style || 'anime';

    switch (validatedData.type) {
      case 'character':
        content = `生成一个详细的${styleLabel}风格角色描述，包括：
1. 角色名称（中文）
2. 外貌描述（详细的脸部特征、发型、眼睛颜色等）
3. 服装描述
4. 性格特点
5.  distinctive特征

以JSON格式返回，字段：name, appearance, personality, outfit, traits[]`;

        break;

      case 'scene':
        content = `生成一个详细的${styleLabel}风格场景描述，包括：
1. 场景名称
2. 地点描述（室内/室外，具体位置）
3. 时间（黎明/早晨/正午/下午/黄昏/夜晚/午夜）
4. 氛围/情绪（开心/悲伤/戏剧性/浪漫/神秘/动作/平静/紧张）
5. 详细视觉描述
6. 关键视觉元素

以JSON格式返回，字段：name, location, timeOfDay, mood, description, elements[]`;

        break;

      case 'dialogue':
        content = `为以下${styleLabel}风格场景生成自然的人物对话：
${validatedData.prompt}

生成3-5句对话，包括：
- 角色名
- 对话内容
- 情绪（开心/悲伤/愤怒/惊讶/平静等）
- 可选的动作描述

以JSON格式返回，字段：dialogues[{characterId, characterName, text, emotion, action}]`;

        break;

      case 'script':
        content = `分析并增强以下${styleLabel}风格漫剧剧本，拆分为场景：
${validatedData.prompt}

返回一个完整的漫剧结构，包括：
- 标题
- 场景列表（每个场景包含：位置、时间、描述、人物、对话）
- 预估总面板数
- 角色列表

以JSON格式返回`;

        break;
    }

    // Call 讯飞 API for content generation (OpenAI兼容协议)
    const xunfeiApiKey = getXunfeiConfig();
    logger.debug('[ComicRouter] 讯飞API请求:', {
      url: XUNFEI_CHAT_URL,
      model: XUNFEI_DISPLAY_MODEL,
      promptLength: validatedData.prompt?.length,
      type: validatedData.type,
    });

    let response;
    try {
      response = await axios.post(
        XUNFEI_CHAT_URL,
        {
          model: XUNFEI_MODEL,
          messages: [
            { role: 'system', content },
            { role: 'user', content: validatedData.prompt },
          ],
          max_tokens: 2048,
          temperature: 0.7,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${xunfeiApiKey}`,
          },
          timeout: 30000,
        }
      );
    } catch (networkError: unknown) {
      const nwErr = networkError as any;
      console.error('[ComicRouter] 讯飞API网络错误:', {
        message: (networkError instanceof Error ? networkError.message : String(networkError)),
        code: nwErr?.code,
        errno: nwErr?.errno,
        type: nwErr?.type,
        url: XUNFEI_CHAT_URL,
        response: nwErr?.response?.data,
      });
      throw new AppError(`讯飞API网络错误: ${(networkError instanceof Error ? networkError.message : String(networkError))}`, 500);
    }

    logger.info('[ComicRouter] 讯飞API响应状态:', response.status);
    logger.info('[ComicRouter] 讯飞API响应数据:', (JSON.stringify(response.data) || '').substring(0, 200) + '...');

    const responseContent = response.data?.choices?.[0]?.message?.content;

    if (!responseContent) {
      console.error('[ComicRouter] 讯飞API返回内容为空:', response.data);
      throw new AppError('讯飞API返回内容为空', 500);
    }

    // Parse JSON（使用平衡括号解析，避免非贪婪正则截断嵌套结构）
    let jsonContent: Record<string, unknown>;
    try {
      jsonContent = parseLLMJsonObject(responseContent);
    } catch {
      throw new AppError('Failed to parse generated content', 500);
    }

    res.json({
      success: true,
      type: validatedData.type,
      data: jsonContent,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      next(new AppError(error.errors[0].message, 400));
    } else {
      const errData = (error as any)?.response?.data;
      if (errData?.error) {
        next(new AppError(errData.error.message || 'API Error', (error as any).response?.status || 500));
      } else {
        next(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }
});

// Generate character image
comicRouter.post(
  '/generate-character-image',
  authenticate,
  async (req, res, next) => {
  try {
    const schema = z.object({
      character: z.object({
        id: z.string().optional().default(''),
        name: z.string(),
        description: z.string(),
        appearance: z.string(),
        personality: z.string(),
        outfit: z.string(),
        traits: z.array(z.string()),
      }),
      style: z.string().optional().default('anime'),
      aspectRatio: z.string().optional().default('3:4'),
      referenceImageUrl: z.string().optional(),
      referenceImages: z.array(z.string()).optional().default([]),
      negativePrompt: z.string().optional(),
      promptOptimizer: z.boolean().optional().default(true),
      imageModel: z.string().optional(),
      imageProvider: z.string().optional(),
    });

    const validatedData = schema.parse(req.body);

    if (COMIC_ASYNC_ENABLED) {
      const { taskId, status, url } = await comicGenerationService.submitCharacterImage({
        character: validatedData.character as ComicCharacterInput,
        style: validatedData.style,
        aspectRatio: validatedData.aspectRatio,
        referenceImageUrl: validatedData.referenceImageUrl,
        referenceImages: validatedData.referenceImages,
        negativePrompt: validatedData.negativePrompt,
        promptOptimizer: validatedData.promptOptimizer,
        imageModel: validatedData.imageModel,
        imageProvider: validatedData.imageProvider,
        userId: req.userId!,
      });
      res.json({ success: true, taskId, status, imageUrl: url });
      return;
    }

    const imageUrl = await comicGenerationService.generateCharacterImage({
      character: validatedData.character as ComicCharacterInput,
      style: validatedData.style,
      aspectRatio: validatedData.aspectRatio,
      referenceImageUrl: validatedData.referenceImageUrl,
      referenceImages: validatedData.referenceImages,
      negativePrompt: validatedData.negativePrompt,
      promptOptimizer: validatedData.promptOptimizer,
      imageModel: validatedData.imageModel,
      imageProvider: validatedData.imageProvider,
    });

    res.json({
      success: true,
      imageUrl,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      next(new AppError(error.errors[0].message, 400));
    } else {
      next(error);
    }
  }
});

// Generate scene image
comicRouter.post(
  '/generate-scene-image',
  authenticate,
  async (req, res, next) => {
  try {
    const schema = z.object({
      scene: z.object({
        id: z.string().optional().default(''),
        name: z.string(),
        location: z.string(),
        timeOfDay: z.string(),
        mood: z.string(),
        description: z.string(),
        elements: z.array(z.string()),
        dialogues: z.array(z.any()).optional().default([]),
      }),
      style: z.string().optional().default('anime'),
      aspectRatio: z.string().optional().default('16:9'),
      referenceImageUrl: z.string().optional(),
      referenceImages: z.array(z.string()).optional().default([]),
      negativePrompt: z.string().optional(),
      promptOptimizer: z.boolean().optional().default(true),
      imageModel: z.string().optional(),
      imageProvider: z.string().optional(),
    });

    const validatedData = schema.parse(req.body);

    if (COMIC_ASYNC_ENABLED) {
      const { taskId, status, url } = await comicGenerationService.submitSceneImage({
        scene: validatedData.scene as ComicSceneInput,
        style: validatedData.style,
        aspectRatio: validatedData.aspectRatio,
        referenceImageUrl: validatedData.referenceImageUrl,
        referenceImages: validatedData.referenceImages,
        negativePrompt: validatedData.negativePrompt,
        promptOptimizer: validatedData.promptOptimizer,
        imageModel: validatedData.imageModel,
        imageProvider: validatedData.imageProvider,
        userId: req.userId!,
      });
      res.json({ success: true, taskId, status, imageUrl: url });
      return;
    }

    const imageUrl = await comicGenerationService.generateSceneImage({
      scene: validatedData.scene as ComicSceneInput,
      style: validatedData.style,
      aspectRatio: validatedData.aspectRatio,
      referenceImageUrl: validatedData.referenceImageUrl,
      referenceImages: validatedData.referenceImages,
      negativePrompt: validatedData.negativePrompt,
      promptOptimizer: validatedData.promptOptimizer,
      imageModel: validatedData.imageModel,
      imageProvider: validatedData.imageProvider,
    });

    res.json({
      success: true,
      imageUrl,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      next(new AppError(error.errors[0].message, 400));
    } else {
      next(error);
    }
  }
});

// Generate generic asset image (prop/accessory/weapon/artifact)
comicRouter.post(
  '/generate-asset-image',
  authenticate,
  async (req, res, next) => {
  try {
    const schema = z.object({
      asset: z.object({
        id: z.string().optional().default(''),
        name: z.string(),
        description: z.string(),
        category: z.string().optional().default('prop'),
        material: z.string().optional(),
        function: z.string().optional(),
      }),
      style: z.string().optional().default('anime'),
      aspectRatio: z.string().optional().default('1:1'),
      referenceImageUrl: z.string().optional(),
      referenceImages: z.array(z.string()).optional().default([]),
      negativePrompt: z.string().optional(),
      promptOptimizer: z.boolean().optional().default(true),
      imageModel: z.string().optional(),
      imageProvider: z.string().optional(),
    });

    const validatedData = schema.parse(req.body);

    if (COMIC_ASYNC_ENABLED) {
      const { taskId, status, url } = await comicGenerationService.submitAssetImage({
        asset: validatedData.asset as ComicAssetInput,
        style: validatedData.style,
        aspectRatio: validatedData.aspectRatio,
        referenceImageUrl: validatedData.referenceImageUrl,
        referenceImages: validatedData.referenceImages,
        negativePrompt: validatedData.negativePrompt,
        promptOptimizer: validatedData.promptOptimizer,
        imageModel: validatedData.imageModel,
        imageProvider: validatedData.imageProvider,
        userId: req.userId!,
      });
      res.json({ success: true, taskId, status, imageUrl: url });
      return;
    }

    const imageUrl = await comicGenerationService.generateAssetImage({
      asset: validatedData.asset as ComicAssetInput,
      style: validatedData.style,
      aspectRatio: validatedData.aspectRatio,
      referenceImageUrl: validatedData.referenceImageUrl,
      referenceImages: validatedData.referenceImages,
      negativePrompt: validatedData.negativePrompt,
      promptOptimizer: validatedData.promptOptimizer,
      imageModel: validatedData.imageModel,
      imageProvider: validatedData.imageProvider,
    });

    res.json({
      success: true,
      imageUrl,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      next(new AppError(error.errors[0].message, 400));
    } else {
      next(error);
    }
  }
});

// Generate scene video
comicRouter.post(
  '/generate-scene-video',
  authenticate,
  async (req, res, next) => {
  try {
    const schema = z.object({
      scene: z.object({
        id: z.string().optional().default(''),
        name: z.string(),
        location: z.string(),
        timeOfDay: z.string(),
        mood: z.string(),
        description: z.string(),
        elements: z.array(z.string()),
        dialogues: z.array(z.any()).optional().default([]),
      }),
      style: z.string().optional().default('anime'),
      duration: z.number().min(2).max(12).optional().default(6),
      videoModel: z.string().optional().default('doubao-seedance-2.0'),
      videoProvider: z.enum(['doubao', 'vidu', 'minimax']).optional().default('doubao'),
      referenceImageUrl: z.string().optional(),
      referenceImageRole: z.enum(['first_frame', 'last_frame']).optional(),
      controlNetEnabled: z.boolean().optional().default(false),
      controlNetType: z.enum(['pose', 'canny', 'depth', 'seg']).optional(),
      controlNetStrength: z.number().min(0).max(1).optional(),
      ipAdapterEnabled: z.boolean().optional().default(false),
      ipAdapterStrength: z.number().min(0).max(1).optional(),
    });

    const validatedData = schema.parse(req.body);

    if (COMIC_ASYNC_ENABLED) {
      const { taskId, status } = await comicGenerationService.submitSceneVideo({
        scene: validatedData.scene as ComicSceneInput,
        style: validatedData.style,
        duration: validatedData.duration,
        videoModel: validatedData.videoModel,
        videoProvider: validatedData.videoProvider,
        userId: req.userId!,
        referenceImageUrl: validatedData.referenceImageUrl,
        referenceImageRole: validatedData.referenceImageRole,
        controlNetEnabled: validatedData.controlNetEnabled,
        controlNetType: validatedData.controlNetType,
        controlNetStrength: validatedData.controlNetStrength,
        ipAdapterEnabled: validatedData.ipAdapterEnabled,
        ipAdapterStrength: validatedData.ipAdapterStrength,
      });
      res.json({ success: true, taskId, status });
      return;
    }

    const videoUrl = await comicGenerationService.generateSceneVideo({
      scene: validatedData.scene as ComicSceneInput,
      style: validatedData.style,
      duration: validatedData.duration,
      videoModel: validatedData.videoModel,
      videoProvider: validatedData.videoProvider,
      userId: req.userId!,
      referenceImageUrl: validatedData.referenceImageUrl,
      referenceImageRole: validatedData.referenceImageRole,
      controlNetEnabled: validatedData.controlNetEnabled,
      controlNetType: validatedData.controlNetType,
      controlNetStrength: validatedData.controlNetStrength,
      ipAdapterEnabled: validatedData.ipAdapterEnabled,
      ipAdapterStrength: validatedData.ipAdapterStrength,
    });

    res.json({
      success: true,
      videoUrl,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      next(new AppError(error.errors[0].message, 400));
    } else {
      next(error);
    }
  }
});

// Generate dialogue audio
comicRouter.post(
  '/generate-dialogue-audio',
  authenticate,
  async (req, res, next) => {
  try {
    const schema = z.object({
      dialogue: z.object({
        characterId: z.string(),
        characterName: z.string(),
        text: z.string(),
        emotion: z.string().optional(),
        action: z.string().optional(),
      }),
      voiceId: z.string().optional().default('female-tianmei'),
      audioModel: z.string().optional(),
      audioProvider: z.string().optional(),
    });

    const validatedData = schema.parse(req.body);

    const audioUrl = await comicGenerationService.generateDialogueAudio({
      dialogue: validatedData.dialogue as ComicDialogue,
      voiceId: validatedData.voiceId,
      audioModel: validatedData.audioModel,
      audioProvider: validatedData.audioProvider,
    });

    res.json({
      success: true,
      audioUrl,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      next(new AppError(error.errors[0].message, 400));
    } else {
      next(error);
    }
  }
});

// Parse script into scenes
comicRouter.post(
  '/parse-script',
  authenticate,
  async (req, res, next) => {
  try {
    const schema = z.object({
      script: z.string().min(10),
      style: z.string().optional().default('anime'),
    });

    const validatedData = schema.parse(req.body);

    // 直接调用讯飞API (OpenAI兼容协议)
    const xunfeiApiKey = getXunfeiConfig();
    const scriptContent = `分析并增强以下漫剧剧本，拆分为场景：
${validatedData.script}

返回一个完整的漫剧结构，包括：
- 标题
- 场景列表（每个场景包含：位置、时间、描述、人物、对话）
- 预估总面板数
- 角色列表

以JSON格式返回`;

    logger.info('[ComicRouter] 剧本解析请求:', {
      scriptLength: validatedData.script.length,
      style: validatedData.style,
    });

    const response = await axios.post(
      XUNFEI_CHAT_URL,
      {
        model: XUNFEI_MODEL,
        messages: [
          { role: 'system', content: scriptContent },
          { role: 'user', content: validatedData.script },
        ],
        max_tokens: 2048,
        temperature: 0.7,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${xunfeiApiKey}`,
        },
        timeout: 30000,
      }
    );

    logger.info('[ComicRouter] 剧本解析响应状态:', response.status);

    const responseContent = response.data?.choices?.[0]?.message?.content;

    if (!responseContent) {
      console.error('[ComicRouter] 剧本解析返回内容为空:', response.data);
      throw new AppError('剧本解析返回内容为空', 500);
    }

    // Parse JSON（使用平衡括号解析，避免非贪婪正则截断嵌套结构）
    let jsonContent: Record<string, unknown>;
    try {
      jsonContent = parseLLMJsonObject(responseContent);
    } catch {
      throw new AppError('Failed to parse generated content', 500);
    }

    res.json({
      success: true,
      data: jsonContent,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      next(new AppError(error.errors[0].message, 400));
    } else {
      const errData = (error as any)?.response?.data;
      if (errData?.error) {
        next(new AppError(errData.error.message || 'API Error', (error as any).response?.status || 500));
      } else {
        next(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }
});

// Analyze story into a structured director plan for the AI comic panel
comicRouter.post(
  '/analyze-story',
  authenticate,
  async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().optional().default('未命名漫剧项目'),
      genre: z.string().optional().default('都市'),
      platform: z.string().optional().default('竖屏短剧'),
      targetDurationSec: z.number().min(15).max(600).optional().default(60),
      scriptText: z.string().min(10),
      existingAssets: z.object({
        characters: z.array(z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().optional(),
          appearance: z.string().optional(),
          outfit: z.string().optional(),
          traits: z.array(z.string()).optional(),
        })).optional().default([]),
        scenes: z.array(z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().optional(),
          location: z.string().optional(),
          timeOfDay: z.string().optional(),
          mood: z.string().optional(),
          elements: z.array(z.string()).optional(),
        })).optional().default([]),
        assets: z.array(z.object({
          id: z.string(),
          type: z.enum(['prop', 'accessory', 'weapon', 'artifact']),
          name: z.string(),
          description: z.string().optional(),
          category: z.string().optional(),
          material: z.string().optional(),
          function: z.string().optional(),
          binding: z.string().optional(),
          tags: z.array(z.string()).optional(),
        })).optional().default([]),
      }).optional().default({ characters: [], scenes: [], assets: [] }),
    });

    const validatedData = schema.parse(req.body);
    const xunfeiApiKey = getXunfeiConfig();
    const systemPrompt = `你是顶尖AI漫剧导演和制片统筹。请把用户剧本拆解为可生产的结构化漫剧项目。

必须只返回严格 JSON，不要 Markdown，不要解释。

JSON 字段：
{
  "title": "项目名",
  "logline": "一句话故事",
  "characters": [
    {"name":"角色名","role":"主角/反派/配角","description":"身份性格","appearance":"外观识别点","outfit":"服装与配饰","traits":["标签"],"linkedAssetId":"可选，若能匹配已有角色资产"}
  ],
  "scenes": [
    {"name":"场景名","location":"地点","timeOfDay":"时间","mood":"dramatic/peaceful/mysterious/warm/tense","description":"空间描述","elements":["元素"],"linkedAssetId":"可选，若能匹配已有场景资产"}
  ],
  "assets": [
    {"type":"prop/accessory/weapon/artifact","name":"资产名","category":"类别","description":"外形和剧情作用","material":"材质纹样","functionText":"功能能力","binding":"绑定角色/场景/章节","tags":["标签"],"linkedAssetId":"可选，若能匹配已有资产"}
  ],
  "storyboard": [
    {"title":"镜头标题","description":"画面内容","dialogue":"台词，没有则空字符串","narration":"旁白，没有则空字符串","characters":["角色名"],"scene":"场景名","assets":["资产名"],"shotSize":"extreme_close_up/close_up/medium_shot/long_shot/extreme_long_shot","cameraMove":"static/push_in/pull_out/pan/track/tilt/handheld","durationSec":3,"emotion":"dramatic/peaceful/mysterious/warm/tense","soundEffect":"音效建议","transition":"cut/fade/flash/push/black","videoPrompt":"可直接用于图生视频/文生视频的中文提示词","linkedCharacterIds":["已有角色资产ID"],"linkedSceneId":"已有场景资产ID或空","linkedAssetIds":["已有资产ID"],"status":"planned"}
  ]
}

要求：
- 分镜数量 4-10 个，按剧情顺序。
- 角色、场景、资产必须和分镜互相引用。
- 自动匹配已有资产 ID；不能确定则不要编造 ID。
- 关键道具、饰品、武器、法器要尽量从剧情里提取。
- 镜头语言要专业：景别、机位运动、时长、转场、音效都要合理。
- videoPrompt 要包含人物、场景、资产、景别、镜头运动和情绪。`;

    const userPrompt = JSON.stringify({
      title: validatedData.title,
      genre: validatedData.genre,
      platform: validatedData.platform,
      targetDurationSec: validatedData.targetDurationSec,
      scriptText: validatedData.scriptText,
      existingAssets: validatedData.existingAssets,
    });

    logger.info('[ComicRouter] AI漫剧剧本导演拆解请求:', {
      title: validatedData.title,
      genre: validatedData.genre,
      scriptLength: validatedData.scriptText.length,
      characterAssets: validatedData.existingAssets.characters.length,
      sceneAssets: validatedData.existingAssets.scenes.length,
      genericAssets: validatedData.existingAssets.assets.length,
    });

    const response = await axios.post(
      XUNFEI_CHAT_URL,
      {
        model: XUNFEI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 4096,
        temperature: 0.35,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${xunfeiApiKey}`,
        },
        timeout: 45000,
      }
    );

    const responseContent = response.data?.choices?.[0]?.message?.content;
    if (!responseContent) {
      throw new AppError('AI漫剧剧本导演拆解返回内容为空', 500);
    }

    const jsonContent = parseLLMJsonObject(responseContent);

    res.json({
      success: true,
      data: jsonContent,
      meta: {
        provider: 'xunfei',
        model: XUNFEI_DISPLAY_MODEL,
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      next(new AppError(error.errors[0].message, 400));
    } else {
      const errData = (error as any)?.response?.data;
      if (errData?.error) {
        next(new AppError(errData.error.message || 'API Error', (error as any).response?.status || 500));
      } else {
        next(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }
});

// Get generation history
comicRouter.get('/history', authenticate, async (req, res, next) => {
  try {
    const history = await prisma.task.findMany({
      where: {
        userId: req.userId,
        OR: [
          { type: 'comic_project' },
          { type: { in: ['character', 'scene', 'comic_video', 'comic_audio', 'comic_asset'] } },
          { params: { contains: '"source":"comic"' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: history.map(item => ({
        id: item.id,
        type: item.type,
        title: item.prompt?.substring(0, 50) || 'Untitled',
        thumbnail: (() => {
          const result = parseTaskResult<any>(item.result);
          if (result?.url || result?.imageUrl || result?.videoUrl || result?.audioUrl) {
            return result.url || result.imageUrl || result.videoUrl || result.audioUrl;
          }
          if (result?.characters?.[0]?.imageUrl) return result.characters[0].imageUrl;
          if (result?.scenes?.[0]?.imageUrl) return result.scenes[0].imageUrl;
          if (result?.videos?.[0]?.videoUrl) return result.videos[0].videoUrl;
          if (result?.assets?.[0]?.imageUrl) return result.assets[0].imageUrl;
          return '';
        })(),
        timestamp: item.createdAt,
        status: item.status,
        taskId: item.id,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Cancel generation
// Sprint 3: 已废弃，建议前端改用 POST /api/v1/task/:taskId/cancel
// 此端点保留向后兼容，内部逻辑已与 /task/:taskId/cancel 对齐
comicRouter.post('/cancel/:taskId', authenticate, async (req, res, next) => {
  try {
    const { taskId } = req.params;

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId: req.userId,
        OR: [
          { type: 'comic_project' },
          { type: { in: ['character', 'scene', 'comic_video', 'comic_audio', 'comic_asset'] } },
          { params: { contains: '"source":"comic"' } },
        ],
      },
      select: {
        id: true,
        status: true,
        type: true,
        provider: true,
        prompt: true,
      },
    });

    if (!task) {
      throw new AppError('任务不存在', 404);
    }

    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      return res.json({
        success: true,
        message: 'Task already finished',
        data: { taskId: task.id, status: task.status },
      });
    }

    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'cancelled',
        error: '用户已取消任务',
      },
    });

    // 释放视频任务密钥租约
    if (task.type === 'video') {
      try {
        const binding = await videoTaskBindingService.getByLocalTaskId(task.id);
        if (binding) {
          await videoModelKeyScheduler.release(binding.keyId, binding.leaseToken);
          await videoTaskBindingService.clear(binding);
          logger.info(`[ComicCancel] 视频任务 ${task.id} 租约已释放 (keyId=${binding.keyId})`);
        }
      } catch (releaseErr) {
        logger.warn(`[ComicCancel] 释放任务 ${task.id} 租约失败:`, releaseErr);
      }
    }

    // WS 广播任务取消通知
    if (req.userId) {
      websocketPushService.notifyTaskFailed(req.userId, task.id, '用户已取消任务', {
        type: task.type || undefined,
        provider: task.provider || undefined,
        prompt: task.prompt || undefined,
      }).catch((wsErr) => {
        logger.warn(`[ComicCancel] WS 通知用户 ${req.userId} 失败:`, wsErr);
      });
    }

    res.json({
      success: true,
      message: 'Generation cancelled',
      data: { taskId: task.id, status: 'cancelled' },
    });
  } catch (error) {
    next(error);
  }
});
