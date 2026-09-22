import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { comicGenerationService, ComicCharacterInput, ComicSceneInput } from '../services/comic-generation-service';
import { websocketPushService } from '../services/websocket-push-service';
import { ComicProject } from '@shared/types/comic';
import { parseTaskResult, stringifyTaskResult } from '../utils/task-result-helper';
import PDFDocument from 'pdfkit';

export const comicProjectRouter = Router();
const COMIC_PROJECT_TASK_TYPE = 'comic_project';

comicProjectRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = '1', limit = '20', status } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { userId: req.userId, type: COMIC_PROJECT_TASK_TYPE };
    if (status) {
      where.status = status;
    }

    const [projects, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true,
          type: true,
          status: true,
          prompt: true,
          result: true,
          taskId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.task.count({ where }),
    ]);

    const parsedProjects = projects.map(p => ({
      ...p,
      result: parseTaskResult<ComicProject>(p.result),
    }));

    res.json({
      success: true,
      data: parsedProjects,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

comicProjectRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await prisma.task.findFirst({
      where: {
        id,
        userId: req.userId,
        type: COMIC_PROJECT_TASK_TYPE,
      },
    });

    if (!project) {
      throw new AppError('项目不存在', 404);
    }

    const parsedResult = parseTaskResult<ComicProject>(project.result);

    res.json({
      success: true,
      data: {
        ...project,
        result: parsedResult
      },
    });
  } catch (error) {
    next(error);
  }
});

comicProjectRouter.post('/', authenticate, async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().min(1).max(200),
      script: z.string().optional(),
      style: z.string().optional().default('anime'),
    });

    const validatedData = schema.parse(req.body);

    const resultData: ComicProject = {
      title: validatedData.title,
      style: validatedData.style,
      characters: [],
      scenes: [],
      timeline: [],
    };

    const project = await prisma.task.create({
      data: {
        userId: req.userId!,
        type: COMIC_PROJECT_TASK_TYPE,
        status: 'draft',
        prompt: validatedData.script || '',
        result: stringifyTaskResult(resultData),
      },
    });

    res.json({
      success: true,
      data: {
        ...project,
        result: resultData
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(error.errors[0].message, 400));
    } else {
      next(error);
    }
  }
});

comicProjectRouter.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      title: z.string().min(1).max(200).optional(),
      script: z.string().optional(),
      style: z.string().optional(),
      status: z.enum(['draft', 'processing', 'completed', 'failed', 'archived']).optional(),
      characters: z.array(z.any()).optional(),
      scenes: z.array(z.any()).optional(),
      timeline: z.array(z.any()).optional(),
      assets: z.array(z.any()).optional(),
      logline: z.string().optional(),
      platform: z.string().optional(),
      targetDurationSec: z.number().optional(),
      genre: z.string().optional(),
    });

    const validatedData = schema.parse(req.body);

    const existingProject = await prisma.task.findFirst({
      where: {
        id,
        userId: req.userId,
        type: COMIC_PROJECT_TASK_TYPE,
      },
    });

    if (!existingProject) {
      throw new AppError('项目不存在', 404);
    }

    const existingResult: ComicProject = parseTaskResult<ComicProject>(existingProject.result, {}) || {};

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (validatedData.title !== undefined) {
      existingResult.title = validatedData.title;
    }

    if (validatedData.script !== undefined) {
      updateData.prompt = validatedData.script;
    }

    if (validatedData.style !== undefined) {
      existingResult.style = validatedData.style;
    }

    if (validatedData.status) {
      updateData.status = validatedData.status;
    }

    if (validatedData.characters !== undefined) {
      existingResult.characters = validatedData.characters;
    }

    if (validatedData.scenes !== undefined) {
      existingResult.scenes = validatedData.scenes;
    }

    if (validatedData.timeline !== undefined) {
      existingResult.timeline = validatedData.timeline;
    }

    if (validatedData.assets !== undefined) {
      existingResult.assets = validatedData.assets;
    }

    if (validatedData.logline !== undefined) {
      existingResult.logline = validatedData.logline;
    }

    if (validatedData.platform !== undefined) {
      existingResult.platform = validatedData.platform;
    }

    if (validatedData.targetDurationSec !== undefined) {
      existingResult.targetDurationSec = validatedData.targetDurationSec;
    }

    if (validatedData.genre !== undefined) {
      existingResult.genre = validatedData.genre;
    }

    updateData.result = stringifyTaskResult(existingResult);

    const project = await prisma.task.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      data: {
        ...project,
        result: existingResult
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(error.errors[0].message, 400));
    } else {
      next(error);
    }
  }
});

comicProjectRouter.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingProject = await prisma.task.findFirst({
      where: {
        id,
        userId: req.userId,
        type: COMIC_PROJECT_TASK_TYPE,
      },
    });

    if (!existingProject) {
      throw new AppError('项目不存在', 404);
    }

    await prisma.task.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

comicProjectRouter.post('/:id/batch-generate', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      options: z.object({
        generateCharacterImages: z.boolean().optional().default(true),
        generateSceneImages: z.boolean().optional().default(true),
        generateVideos: z.boolean().optional().default(false),
        generateAudio: z.boolean().optional().default(false),
        videoProvider: z.enum(['doubao', 'vidu', 'minimax']).optional().default('doubao'),
        videoModel: z.string().optional(),
      }),
    });

    const validatedData = schema.parse(req.body);

    const project = await prisma.task.findFirst({
      where: {
        id,
        userId: req.userId,
        type: COMIC_PROJECT_TASK_TYPE,
      },
    });

    if (!project) {
      throw new AppError('项目不存在', 404);
    }

    const result: ComicProject = parseTaskResult<ComicProject>(project.result, {}) || {};

    const characters = result.characters || [];
    const scenes = result.scenes || [];
    const userId = req.userId!;

    // 计算总任务数用于进度推送
    const totalTasks =
      (validatedData.options.generateCharacterImages ? characters.length : 0) +
      (validatedData.options.generateSceneImages ? scenes.length : 0) +
      (validatedData.options.generateVideos ? scenes.length : 0) +
      (validatedData.options.generateAudio
        ? scenes.reduce((sum: number, s: any) => sum + (s.dialogues?.length || 0), 0)
        : 0);

    const batchTaskId = `comic_batch_${id}_${Date.now()}`;

    // 标记项目为处理中
    await prisma.task.update({
      where: { id },
      data: { status: 'processing' },
    });

    // 立即返回 taskId，后台异步执行
    res.status(202).json({
      success: true,
      taskId: batchTaskId,
      projectId: id,
      totalTasks,
      message: '批量生成已提交，将通过 WebSocket 推送进度',
    });

    // 异步执行批量生成（不阻塞响应）
    void (async () => {
      const generatedResults: {
        characters: any[];
        scenes: any[];
        videos: any[];
        audio: any[];
        failed?: any[];
      } = {
        characters: [],
        scenes: [],
        videos: [],
        audio: [],
      };
      let completedTasks = 0;

      const reportProgress = async () => {
        completedTasks++;
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
        try {
          await websocketPushService.notifyTaskProgress(userId, batchTaskId, progress);
        } catch (e) {
          console.error('[ComicProject] WebSocket 进度推送失败:', e);
        }
      };

      try {
        if (validatedData.options.generateCharacterImages && characters.length > 0) {
          for (const character of characters) {
            try {
              const imageUrl = await comicGenerationService.generateCharacterImage({
                character: character as ComicCharacterInput,
                style: result.style || 'anime',
              });
              if (imageUrl) {
                generatedResults.characters.push({ ...character, imageUrl });
              }
            } catch (error) {
              console.error(`Character image generation failed: ${character.name}`, error);
              generatedResults.failed = generatedResults.failed || [];
              generatedResults.failed.push({ id: character.id, name: character.name, error: error instanceof Error ? error.message : String(error) });
            }
            await reportProgress();
          }
        }

        if (validatedData.options.generateSceneImages && scenes.length > 0) {
          for (const scene of scenes) {
            try {
              const imageUrl = await comicGenerationService.generateSceneImage({
                scene: scene as ComicSceneInput,
                style: result.style || 'anime',
              });
              if (imageUrl) {
                generatedResults.scenes.push({ ...scene, imageUrl });
              }
            } catch (error) {
              console.error(`Scene image generation failed: ${scene.name}`, error);
            }
            await reportProgress();
          }
        }

        if (validatedData.options.generateVideos && scenes.length > 0) {
          for (const scene of scenes) {
            try {
              const videoUrl = await comicGenerationService.generateSceneVideo({
                scene: scene as ComicSceneInput,
                style: result.style || 'anime',
                duration: (scene as any).durationSec || 5,
                videoProvider: validatedData.options.videoProvider,
                videoModel: validatedData.options.videoModel,
                userId: req.userId!,
                referenceImageUrl: scene.imageUrl,
                referenceImageRole: 'first_frame',
              });
              if (videoUrl) {
                generatedResults.videos.push({ ...scene, videoUrl });
              }
            } catch (error) {
              console.error(`Scene video generation failed: ${scene.name}`, error);
            }
            await reportProgress();
          }
        }

        if (validatedData.options.generateAudio) {
          const allDialogues: Array<{ sceneName: string; dialogue: any }> = [];
          for (const scene of scenes) {
            const dialogues = scene.dialogues || [];
            for (const dialogue of dialogues) {
              allDialogues.push({ sceneName: scene.name, dialogue });
            }
          }

          for (const { sceneName, dialogue } of allDialogues) {
            try {
              const audioUrl = await comicGenerationService.generateDialogueAudio({
                dialogue: {
                  characterId: dialogue.characterId || '',
                  characterName: dialogue.characterName || '',
                  text: dialogue.text,
                  emotion: dialogue.emotion,
                },
              });
              if (audioUrl) {
                generatedResults.audio.push({
                  sceneName,
                  characterName: dialogue.characterName,
                  text: dialogue.text,
                  audioUrl,
                });
              }
            } catch (error) {
              console.error(`Audio generation failed for dialogue in ${sceneName}:`, error);
            }
            await reportProgress();
          }
        }

        const finalResult = {
          ...result,
          ...generatedResults,
          characters: (result.characters || []).map((c: any) =>
            generatedResults.characters?.find((g: any) => g.id === c.id) || c
          ),
          scenes: (result.scenes || []).map((s: any) =>
            generatedResults.scenes?.find((g: any) => g.id === s.id) || s
          ),
          generatedAt: new Date().toISOString(),
        };

        await prisma.task.update({
          where: { id },
          data: {
            status: 'completed',
            result: stringifyTaskResult(finalResult),
          },
        });

        try {
          await websocketPushService.notifyTaskComplete(userId, batchTaskId, generatedResults);
        } catch (notifyError) {
          console.error('notifyTaskComplete 推送失败:', notifyError);
        }
      } catch (error) {
        console.error('[ComicProject] 批量生成异步任务失败:', error);
        await prisma.task.update({
          where: { id },
          data: { status: 'failed' },
        }).catch(() => void 0);
        try {
          await websocketPushService.notifyTaskFailed(userId, batchTaskId, error instanceof Error ? error.message : '批量生成失败');
        } catch (notifyError) {
          console.error('notifyTaskFailed 推送失败:', notifyError);
        }
      }
    })();
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(error.errors[0].message, 400));
    } else {
      next(error);
    }
  }
});

comicProjectRouter.get('/:id/export', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;

    const project = await prisma.task.findFirst({
      where: {
        id,
        userId: req.userId,
        type: COMIC_PROJECT_TASK_TYPE,
      },
    });

    if (!project) {
      throw new AppError('项目不存在', 404);
    }

    const result = parseTaskResult<ComicProject>(project.result);

    if (format === 'json') {
      res.json({
        success: true,
        data: {
          id: project.id,
          title: result?.title,
          script: project.prompt,
          style: result?.style,
          characters: result?.characters || [],
          scenes: result?.scenes || [],
          timeline: result?.timeline || [],
          assets: result?.assets || [],
          logline: result?.logline || '',
          platform: result?.platform || '',
          targetDurationSec: result?.targetDurationSec,
          genre: result?.genre || '',
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
      });
    } else if (format === 'pdf') {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));

      doc.fontSize(24).fillColor('#333').text(result?.title || 'Untitled Comic', { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(12).fillColor('#666').text(`Style: ${result?.style || 'anime'}`);
      doc.moveDown(0.5);
      if (project.prompt) {
        doc.fontSize(10).fillColor('#999').text(`Script: ${project.prompt.substring(0, 200)}${project.prompt.length > 200 ? '...' : ''}`);
        doc.moveDown(0.5);
      }

      const characters = result?.characters || [];
      if (characters.length > 0) {
        doc.moveDown(1);
        doc.fontSize(16).fillColor('#333').text('Characters');
        doc.moveDown(0.5);
        for (const char of characters) {
          doc.fontSize(12).fillColor('#555').text(`- ${char.name || 'Unnamed'}`);
          if (char.description) {
            doc.fontSize(10).fillColor('#888').text(`  ${char.description}`, { indent: 20 });
          }
          if (char.imageUrl) {
            doc.fontSize(9).fillColor('#aaa').text(`  Image: ${char.imageUrl}`, { indent: 20 });
          }
          doc.moveDown(0.3);
        }
      }

      const scenes = result?.scenes || [];
      if (scenes.length > 0) {
        doc.moveDown(1);
        doc.fontSize(16).fillColor('#333').text('Scenes');
        doc.moveDown(0.5);
        for (const scene of scenes) {
          doc.fontSize(12).fillColor('#555').text(`- ${scene.name || 'Unnamed Scene'}`);
          if (scene.description) {
            doc.fontSize(10).fillColor('#888').text(`  ${scene.description}`, { indent: 20 });
          }
          if (scene.location) {
            doc.fontSize(9).fillColor('#aaa').text(`  Location: ${scene.location} | Time: ${scene.timeOfDay || 'N/A'} | Mood: ${scene.mood || 'N/A'}`, { indent: 20 });
          }
          doc.moveDown(0.3);
        }
      }

      const timeline = result?.timeline || [];
      if (timeline.length > 0) {
        doc.moveDown(1);
        doc.fontSize(16).fillColor('#333').text('Timeline');
        doc.moveDown(0.5);
        for (const item of timeline) {
          doc.fontSize(10).fillColor('#888').text(`- Panel ${item.panelNumber || '?'}: ${item.description || ''}`, { indent: 10 });
          doc.moveDown(0.2);
        }
      }

      doc.moveDown(2);
      doc.fontSize(8).fillColor('#ccc').text(`Generated by AI Clipping Studio | ${new Date().toISOString()}`, { align: 'center' });

      doc.end();

      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${(result?.title || 'comic').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.pdf"`);
      res.send(pdfBuffer);
    } else {
      throw new AppError('无效的导出格式', 400);
    }
  } catch (error) {
    next(error);
  }
});

comicProjectRouter.post('/:id/duplicate', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const duplicateSchema = z.object({
      newTitle: z.string().optional(),
    });
    const validatedBody = duplicateSchema.parse(req.body);
    const { newTitle } = validatedBody;

    const existingProject = await prisma.task.findFirst({
      where: {
        id,
        userId: req.userId,
        type: COMIC_PROJECT_TASK_TYPE,
      },
    });

    if (!existingProject) {
      throw new AppError('项目不存在', 404);
    }

    const existingResult: ComicProject = parseTaskResult<ComicProject>(existingProject.result, {}) || {};

    const newResult: ComicProject = {
      ...existingResult,
      title: newTitle || `${existingResult.title || 'Untitled'} (Copy)`,
    };

    const newProject = await prisma.task.create({
      data: {
        userId: req.userId!,
        type: COMIC_PROJECT_TASK_TYPE,
        status: 'draft',
        prompt: existingProject.prompt,
        result: stringifyTaskResult(newResult),
      },
    });

    res.json({
      success: true,
      data: {
        ...newProject,
        result: newResult
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(error.errors[0].message, 400));
    } else {
      next(error);
    }
  }
});
