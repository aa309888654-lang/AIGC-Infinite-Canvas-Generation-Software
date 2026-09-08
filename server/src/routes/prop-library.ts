import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';
import { propLibraryService } from '../services/prop-library-service';
import type { CreatePropData } from '../services/prop-library-service';

export const propLibraryRouter = Router();

propLibraryRouter.use(authenticate);

const createPropSchema = z.object({
  name: z.string().min(1).max(100),
  summary: z.string().optional(),
  primaryImage: z.string().optional(),
  materialTags: z.array(z.string()).optional(),
  prompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const updatePropSchema = createPropSchema.partial();

// Create prop
propLibraryRouter.post('/', async (req, res, next) => {
  try {
    const data = createPropSchema.parse(req.body);
    const propData: CreatePropData = {
      name: data.name,
      summary: data.summary,
      primaryImage: data.primaryImage,
      materialTags: data.materialTags,
      prompt: data.prompt,
      negativePrompt: data.negativePrompt,
      tags: data.tags,
    };
    const prop = await propLibraryService.createProp(req.userId!, propData);

    res.status(201).json({
      success: true,
      data: prop,
    });
  } catch (error) {
    next(error);
  }
});

// Get all props
propLibraryRouter.get('/', async (req, res, next) => {
  try {
    const { search, limit, offset } = req.query;
    const props = await propLibraryService.getProps(req.userId!, {
      search: search as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: props,
    });
  } catch (error) {
    next(error);
  }
});

// Get prop by id
propLibraryRouter.get('/:id', async (req, res, next) => {
  try {
    const prop = await propLibraryService.getPropById(req.userId!, req.params.id);
    res.json({
      success: true,
      data: prop,
    });
  } catch (error) {
    next(error);
  }
});

// Update prop
propLibraryRouter.put('/:id', async (req, res, next) => {
  try {
    const data = updatePropSchema.parse(req.body);
    const prop = await propLibraryService.updateProp(req.userId!, req.params.id, data);
    res.json({
      success: true,
      data: prop,
    });
  } catch (error) {
    next(error);
  }
});

// Delete prop
propLibraryRouter.delete('/:id', async (req, res, next) => {
  try {
    await propLibraryService.deleteProp(req.userId!, req.params.id);
    res.json({
      success: true,
      message: '道具已删除',
    });
  } catch (error) {
    next(error);
  }
});
