import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { comicGenerationService } from '../services/comic-generation-service';
import { buildExpressionPrompt } from '../services/comic-prompt-builder';
import prisma from '../lib/prisma';
import crypto from 'crypto';

const router = Router();

router.use(authenticate);

router.post('/generate-character', async (req: AuthRequest, res, next) => {
  try {
    const characterSchema = z.object({
      name: z.string().min(1),
      description: z.string().min(1),
      style: z.string().optional(),
      gender: z.string().optional(),
      age: z.string().optional(),
    });
    const validatedData = characterSchema.parse(req.body);
    const { name, description, style, gender, age } = validatedData;

    const imageUrl = await comicGenerationService.generateCharacterImage({
      character: {
        name,
        description,
        appearance: description,
        personality: '',
        outfit: '',
        traits: [],
      },
      style,
    });

    return res.json({
      success: true,
      data: { frontView: imageUrl, name, description, style, gender, age },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0]?.message || '参数校验失败' });
    }
    console.error('[ComicWorkspace] 生成角色失败:', error);
    return next(error);
  }
});

router.post('/generate-scene', async (req: AuthRequest, res, next) => {
  try {
    const sceneSchema = z.object({
      type: z.string().optional(),
      timeOfDay: z.string().optional(),
      weather: z.string().optional(),
      description: z.string().min(1),
      style: z.string().optional(),
    });
    const validatedData = sceneSchema.parse(req.body);
    const { type, timeOfDay, weather, description, style } = validatedData;

    const imageUrl = await comicGenerationService.generateSceneImage({
      scene: {
        name: type || 'scene',
        location: type || 'outdoor',
        timeOfDay: timeOfDay || 'afternoon',
        mood: weather || 'sunny',
        description,
        elements: [],
      },
      style,
    });

    return res.json({
      success: true,
      data: { backgroundImage: imageUrl, type, timeOfDay, weather, description },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0]?.message || '参数校验失败' });
    }
    console.error('[ComicWorkspace] 生成场景失败:', error);
    return next(error);
  }
});

router.post('/generate-expression', async (req: AuthRequest, res, next) => {
  try {
    const expressionSchema = z.object({
      characterId: z.string().min(1),
      expression: z.string().min(1),
      style: z.string().optional(),
    });
    const validatedData = expressionSchema.parse(req.body);
    const { characterId, expression, style } = validatedData;

    let characterDescription = 'character';
    if (characterId) {
      const character = await prisma.characterLibrary.findFirst({
        where: { id: characterId, userId: req.userId },
      });
      if (character) {
        characterDescription = character.description || character.name || 'character';
      }
    }

    const prompt = buildExpressionPrompt({
      expression: expression || 'neutral',
      style,
      characterDescription,
    });

    const imageUrl = await comicGenerationService.generateCharacterImage({
      character: {
        name: 'expression',
        description: prompt,
        appearance: characterDescription,
        personality: '',
        outfit: '',
        traits: [],
      },
      style,
    });

    return res.json({
      success: true,
      data: { expressionImage: imageUrl, expression },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0]?.message || '参数校验失败' });
    }
    console.error('[ComicWorkspace] 生成表情失败:', error);
    return next(error);
  }
});

router.post('/generate-voice', async (req: AuthRequest, res, next) => {
  try {
    const voiceSchema = z.object({
      text: z.string().min(1),
      characterId: z.string().optional(),
      emotion: z.string().optional(),
      speed: z.number().min(0.5).max(2).optional(),
      pitch: z.number().min(0.5).max(2).optional(),
    });
    const validatedData = voiceSchema.parse(req.body);
    const { text, characterId, emotion, speed = 1.0, pitch = 1.0 } = validatedData;

    const audioUrl = await comicGenerationService.generateDialogueAudio({
      dialogue: {
        characterId: characterId || '',
        characterName: '',
        text,
        emotion,
      },
      speed,
      pitch,
    });

    const duration = Math.ceil(text.length / 3.5);

    return res.json({
      success: true,
      data: { audioUrl, duration, text },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0]?.message || '参数校验失败' });
    }
    console.error('[ComicWorkspace] 生成语音失败:', error);
    return next(error);
  }
});

// 已废弃：该接口仅按标点切分句子，不调用 LLM，能力远弱于 /v1/comic/analyze-story。
// 统一使用 POST /v1/comic/analyze-story 进行剧本智能拆解。
router.post('/batch-generate-from-script', async (req, res) => {
  return res.status(410).json({
    success: false,
    error: '该接口已废弃，请使用 POST /v1/comic/analyze-story 进行剧本智能拆解（支持 LLM 导演拆解人物/场景/资产/分镜）。',
    deprecated: true,
    replacement: '/v1/comic/analyze-story',
  });
});

router.post('/generate-panels-ai', async (req: AuthRequest, res, next) => {
  try {
    const panelsSchema = z.object({
      panels: z.array(z.object({
        script: z.string().optional(),
        description: z.string().optional(),
      }).passthrough()).min(1),
      style: z.string().optional(),
    });
    const validatedData = panelsSchema.parse(req.body);
    const { panels, style } = validatedData;

    const results = [];

    for (const panel of panels) {
      try {
        const imageUrl = await comicGenerationService.generateSceneImage({
          scene: {
            name: `Panel ${panel.id}`,
            location: '',
            timeOfDay: 'afternoon',
            mood: '',
            description: panel.script || panel.description || '',
            elements: [],
          },
          style,
        });

        results.push({
          panelId: panel.id,
          success: !!imageUrl,
          imageUrl: imageUrl || null,
          error: !imageUrl ? 'No image URL' : null,
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        results.push({ panelId: panel.id, success: false, imageUrl: null, error: errMsg });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successCount = results.filter(r => r.success).length;

    return res.json({
      success: true,
      data: { results, successCount, totalCount: results.length },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0]?.message || '参数校验失败' });
    }
    console.error('[ComicWorkspace] AI生成面板失败:', error);
    return next(error);
  }
});

router.post('/batch-voice', async (req: AuthRequest, res, next) => {
  try {
    const batchVoiceSchema = z.object({
      dialogues: z.array(z.object({
        text: z.string().min(1),
        characterId: z.string().optional(),
        emotion: z.string().optional(),
      }).passthrough()).min(1),
    });
    const validatedData = batchVoiceSchema.parse(req.body);
    const { dialogues } = validatedData;

    const results = [];

    for (const dialogue of dialogues) {
      try {
        const audioUrl = await comicGenerationService.generateDialogueAudio({
          dialogue: {
            characterId: dialogue.characterId || '',
            characterName: (dialogue.characterName as string) || '',
            text: dialogue.text,
            emotion: dialogue.emotion,
          },
        });

        results.push({
          dialogueId: dialogue.id,
          success: true,
          audioUrl,
          duration: Math.ceil((dialogue.text || '').length / 3.5),
          error: null,
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        results.push({ dialogueId: dialogue.id, success: false, audioUrl: null, duration: 0, error: errMsg });
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successCount = results.filter(r => r.success).length;

    return res.json({
      success: true,
      data: { results, successCount, totalCount: results.length },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0]?.message || '参数校验失败' });
    }
    console.error('[ComicWorkspace] 批量语音合成失败:', error);
    return next(error);
  }
});

router.get('/expressions/:characterId', async (req: AuthRequest, res, next) => {
  try {
    const { characterId } = req.params;

    const variants = await prisma.characterVariant.findMany({
      where: { characterId, variantType: 'expression' },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: variants });
  } catch (error) {
    console.error('[ComicWorkspace] 获取表情列表失败:', error);
    return next(error);
  }
});

export default router;
