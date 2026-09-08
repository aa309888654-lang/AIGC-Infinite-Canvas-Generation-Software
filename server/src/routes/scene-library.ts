import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';
import { sceneLibraryService } from '../services/scene-library-service';
import type { CreateSceneData } from '../services/scene-library-service';

export const sceneLibraryRouter = Router();

sceneLibraryRouter.use(authenticate);

const createSceneSchema = z.object({
  name: z.string().min(1).max(100),
  summary: z.string().optional(),
  primaryImage: z.string().optional(),
  lightingPrompt: z.string().optional(),
  environmentPrompt: z.string().optional(),
  prompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const updateSceneSchema = createSceneSchema.partial();

// Create scene
sceneLibraryRouter.post('/', async (req, res, next) => {
  try {
    const data = createSceneSchema.parse(req.body);
    const sceneData: CreateSceneData = {
      name: data.name,
      summary: data.summary,
      primaryImage: data.primaryImage,
      lightingPrompt: data.lightingPrompt,
      environmentPrompt: data.environmentPrompt,
      prompt: data.prompt,
      negativePrompt: data.negativePrompt,
      tags: data.tags,
    };
    const scene = await sceneLibraryService.createScene(req.userId!, sceneData);

    res.status(201).json({
      success: true,
      data: scene,
    });
  } catch (error) {
    next(error);
  }
});

// Get all scenes
sceneLibraryRouter.get('/', async (req, res, next) => {
  try {
    const { search, limit, offset } = req.query;
    const scenes = await sceneLibraryService.getScenes(req.userId!, {
      search: search as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: scenes,
    });
  } catch (error) {
    next(error);
  }
});

// Get scene by id
sceneLibraryRouter.get('/:id', async (req, res, next) => {
  try {
    const scene = await sceneLibraryService.getSceneById(req.userId!, req.params.id);
    res.json({
      success: true,
      data: scene,
    });
  } catch (error) {
    next(error);
  }
});

// Update scene
sceneLibraryRouter.put('/:id', async (req, res, next) => {
  try {
    const data = updateSceneSchema.parse(req.body);
    const scene = await sceneLibraryService.updateScene(req.userId!, req.params.id, data);
    res.json({
      success: true,
      data: scene,
    });
  } catch (error) {
    next(error);
  }
});

// Delete scene
sceneLibraryRouter.delete('/:id', async (req, res, next) => {
  try {
    await sceneLibraryService.deleteScene(req.userId!, req.params.id);
    res.json({
      success: true,
      message: '场景已删除',
    });
  } catch (error) {
    next(error);
  }
});
