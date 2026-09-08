import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';
import { characterLibraryService } from '../services/character-library-service';
import type { CreateCharacterData, CreateVariantData } from '../services/character-library-service';

export const characterLibraryRouter = Router();

characterLibraryRouter.use(authenticate);

// Validation schemas
const createCharacterSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  appearance: z.string().optional(),
  personality: z.string().optional(),
  outfit: z.string().optional(),
  traits: z.array(z.string()).optional(),
  imageUrl: z.string().url().optional().or(z.string().optional()),
  thumbnailUrl: z.string().url().optional().or(z.string().optional()),
  groupType: z.enum(['MAIN', 'SUPPORTING', 'EXTRA', 'ANTAGONIST']).optional(),
});

const updateCharacterSchema = createCharacterSchema.partial();

const createVariantSchema = z.object({
  variantType: z.enum(['EXPRESSION', 'POSE', 'OUTFIT', 'ANGLE']),
  variantName: z.string().min(1).max(100),
  expression: z.string().optional(),
  pose: z.string().optional(),
  outfit: z.string().optional(),
  angle: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.string().optional()),
  thumbnailUrl: z.string().url().optional().or(z.string().optional()),
  prompt: z.string().optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().optional(),
  description: z.string().optional(),
  prompt: z.string().min(1),
  thumbnailUrl: z.string().url().optional().or(z.string().optional()),
  isPublic: z.boolean().optional(),
});

const updateGroupSchema = z.object({
  groupType: z.enum(['MAIN', 'SUPPORTING', 'EXTRA', 'ANTAGONIST']),
});

// ========== Character Management ==========

// Create character
characterLibraryRouter.post('/', async (req, res, next) => {
  try {
    const data = createCharacterSchema.parse(req.body);
    const characterData: CreateCharacterData = {
      name: data.name,
      description: data.description,
      appearance: data.appearance,
      personality: data.personality,
      outfit: data.outfit,
      traits: data.traits,
      imageUrl: data.imageUrl,
      thumbnailUrl: data.thumbnailUrl,
      groupType: data.groupType,
    };
    const character = await characterLibraryService.createCharacter(req.userId!, characterData);

    res.status(201).json({
      success: true,
      data: character,
    });
  } catch (error) {
    next(error);
  }
});

// Get all characters
characterLibraryRouter.get('/', async (req, res, next) => {
  try {
    const { groupType, search, limit, offset } = req.query;
    const characters = await characterLibraryService.getCharacters(req.userId!, {
      groupType: groupType as string,
      search: search as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: characters,
    });
  } catch (error) {
    next(error);
  }
});

// Get character stats
characterLibraryRouter.get('/stats', async (req, res, next) => {
  try {
    const stats = await characterLibraryService.getCharacterStats(req.userId!);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

// Get single character
characterLibraryRouter.get('/:id', async (req, res, next) => {
  try {
    const character = await characterLibraryService.getCharacter(req.userId!, req.params.id);

    res.json({
      success: true,
      data: character,
    });
  } catch (error) {
    next(error);
  }
});

// Update character
characterLibraryRouter.put('/:id', async (req, res, next) => {
  try {
    const data = updateCharacterSchema.parse(req.body);
    const character = await characterLibraryService.updateCharacter(req.userId!, req.params.id, data);

    res.json({
      success: true,
      data: character,
    });
  } catch (error) {
    next(error);
  }
});

// Delete character
characterLibraryRouter.delete('/:id', async (req, res, next) => {
  try {
    await characterLibraryService.deleteCharacter(req.userId!, req.params.id);

    res.json({
      success: true,
      message: 'Character deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Duplicate character
characterLibraryRouter.post('/:id/duplicate', async (req, res, next) => {
  try {
    const { newName } = req.body;
    const character = await characterLibraryService.duplicateCharacter(req.userId!, req.params.id, newName);

    res.status(201).json({
      success: true,
      data: character,
    });
  } catch (error) {
    next(error);
  }
});

// Update character group
characterLibraryRouter.put('/:id/group', async (req, res, next) => {
  try {
    const { groupType } = updateGroupSchema.parse(req.body);
    const character = await characterLibraryService.updateGroup(req.userId!, req.params.id, groupType);

    res.json({
      success: true,
      data: character,
    });
  } catch (error) {
    next(error);
  }
});

// ========== Variant Management ==========

// Create variant
characterLibraryRouter.post('/:id/variant', async (req, res, next) => {
  try {
    const data = createVariantSchema.parse(req.body);
    const variantData: CreateVariantData = {
      variantType: data.variantType,
      variantName: data.variantName,
      expression: data.expression,
      pose: data.pose,
      outfit: data.outfit,
      angle: data.angle,
      imageUrl: data.imageUrl,
      thumbnailUrl: data.thumbnailUrl,
      prompt: data.prompt,
    };
    const variant = await characterLibraryService.createVariant(req.userId!, req.params.id, variantData);

    res.status(201).json({
      success: true,
      data: variant,
    });
  } catch (error) {
    next(error);
  }
});

// Get variants
characterLibraryRouter.get('/:id/variants', async (req, res, next) => {
  try {
    const { type } = req.query;
    const variants = await characterLibraryService.getVariants(
      req.userId!,
      req.params.id,
      type as string
    );

    res.json({
      success: true,
      data: variants,
    });
  } catch (error) {
    next(error);
  }
});

// Update variant
characterLibraryRouter.put('/:id/variant/:variantId', async (req, res, next) => {
  try {
    const data = createVariantSchema.partial().parse(req.body);
    const variant = await characterLibraryService.updateVariant(
      req.userId!,
      req.params.id,
      req.params.variantId,
      data
    );

    res.json({
      success: true,
      data: variant,
    });
  } catch (error) {
    next(error);
  }
});

// Delete variant
characterLibraryRouter.delete('/:id/variant/:variantId', async (req, res, next) => {
  try {
    await characterLibraryService.deleteVariant(req.userId!, req.params.id, req.params.variantId);

    res.json({
      success: true,
      message: 'Variant deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ========== Usage Tracking ==========

// Record usage
characterLibraryRouter.post('/:id/usage', async (req, res, next) => {
  try {
    const { sceneId, sceneName, usageContext, generatedImage } = req.body;
    const usage = await characterLibraryService.recordUsage(
      req.userId!,
      req.params.id,
      sceneId,
      sceneName,
      usageContext,
      generatedImage
    );

    res.status(201).json({
      success: true,
      data: usage,
    });
  } catch (error) {
    next(error);
  }
});

// ========== Templates ==========

// Get templates
characterLibraryRouter.get('/templates/list', async (req, res, next) => {
  try {
    const { category } = req.query;
    const templates = await characterLibraryService.getTemplates(category as string);

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
});

// Create template
characterLibraryRouter.post('/templates', async (req, res, next) => {
  try {
    const data = createTemplateSchema.parse(req.body);
    const template = await characterLibraryService.createTemplate(req.userId!, {
      name: data.name,
      category: data.category,
      description: data.description,
      prompt: data.prompt,
      thumbnailUrl: data.thumbnailUrl,
      isPublic: data.isPublic,
    });

    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    next(error);
  }
});

// ========== Character Generation with IPAdapter ==========

// Generate character with variant reference
characterLibraryRouter.post('/:id/generate', async (req, res, next) => {
  try {
    const { style, variantId, prompt, aspectRatio } = req.body;
    const character = await characterLibraryService.getCharacter(req.userId!, req.params.id);

    let referenceImage = character.imageUrl;

    if (variantId) {
      const variants = character.variants;
      const variant = variants.find((v: any) => v.id === variantId);
      if (variant?.imageUrl) {
        referenceImage = variant.imageUrl;
      }
    }

    res.json({
      success: true,
      data: {
        character,
        referenceImage,
        prompt: prompt || `Anime character: ${character.appearance}, ${character.outfit}`,
        style,
        aspectRatio: aspectRatio || '3:4',
      },
    });
  } catch (error) {
    next(error);
  }
});
