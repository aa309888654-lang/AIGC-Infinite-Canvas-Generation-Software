import express, { Router, Request, Response } from 'express';
import { smartRouter, type SmartRouteOptions } from '../services/smart-router';
import type { VideoParams as VideoGenerationParams } from '../types/api';
import type { AspectRatio } from '../shared/types';
import { creditManager } from '../services/credit-manager';
import { fallbackChain } from '../services/fallback-chain';
import { modelSelector } from '../services/model-selector';
import { costOptimizer, type UserTier } from '../services/cost-optimizer';
import { tenantKeyPool, type TenantTier } from '../services/tenant-key-pool';
import { realtimeMonitor } from '../services/realtime-monitor';
import { authenticate, requireAdmin } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Internal operations surface for video routing internals.
// Public clients should continue using /api/v1/video.
router.use(authenticate);

const VideoRequestSchema = z.object({
  prompt: z.string().min(1).max(3000),
  model: z.string().optional(),
  duration: z.union([z.number(), z.string()]).optional().transform(v => typeof v === 'string' ? parseFloat(v) : v),
  resolution: z.enum(['480p', '540p', '720p', '1080p', '768p']).optional(),
  aspectRatio: z.enum(['16:9', '4:3', '1:1', '9:16', '3:4']).optional(),
  imageUrl: z.string().url().optional(),
  startImage: z.string().url().optional(),
  endImage: z.string().url().optional(),
  referenceImages: z.array(z.string().url()).optional(),
  provider: z.enum(['vidu', 'doubao']).optional(),
  userId: z.string().optional(),
  userTier: z.enum(['free', 'basic', 'premium', 'enterprise']).optional(),
  costOptimization: z.boolean().optional(),
  maxBudget: z.number().optional(),
  autoSelectModel: z.boolean().optional(),
  generationMode: z.string().optional(),
});

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const validation = VideoRequestSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: validation.error.errors
      });
    }

    const {
      prompt, model, duration, resolution, aspectRatio,
      imageUrl, startImage, endImage, referenceImages, provider,
      userId, userTier, costOptimization, maxBudget, autoSelectModel,
      generationMode
    } = validation.data;

    const params: VideoGenerationParams = {
      provider: provider || 'vidu',
      model: model || 'viduq3-turbo',
      prompt,
      duration: duration || 5,
      resolution: resolution as AspectRatio | undefined,
      aspectRatio: aspectRatio || '16:9',
      mode: (generationMode || 'text_to_video') as any,
    };

    if (imageUrl) params.imageUrl = imageUrl;
    if (startImage) params.firstFrameUrl = startImage;
    if (endImage) params.lastFrameUrl = endImage;
    if (referenceImages && referenceImages.length > 0) params.referenceImages = referenceImages;

    // 兼容逻辑：如果没有 imageUrl 但有 startImage，将 startImage 赋给 imageUrl
    if (!params.imageUrl && params.firstFrameUrl) {
      params.imageUrl = params.firstFrameUrl;
    }

    const options: SmartRouteOptions = {
      userId,
      userTier: userTier as UserTier,
      costOptimization,
      maxBudget,
      autoSelectModel,
    };

    const result = await smartRouter.routeVideoGeneration(params, provider as any, options);

    if (result.success) {
      res.json({
        success: true,
        taskId: result.result?.taskId,
        providerUsed: result.providerUsed,
        keyUsed: result.keyUsed,
        responseTime: result.responseTime,
        fallbackChain: result.fallbackChain,
        creditStatus: result.creditStatus,
        tenantInfo: result.tenantInfo,
        message: 'Video generation task created successfully'
      });
    } else {
      const statusCode = result.errorCategory === 'credit_insufficient' ? 503
        : result.errorCategory === 'rate_limited' ? 429
        : result.errorCategory === 'invalid_request' ? 400
        : 500;

      res.status(statusCode).json({
        success: false,
        error: result.error,
        errorCategory: result.errorCategory,
        providerUsed: result.providerUsed,
        keyUsed: result.keyUsed,
        fallbackChain: result.fallbackChain,
        creditStatus: result.creditStatus,
        tenantInfo: result.tenantInfo,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

router.use(requireAdmin);

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const provider = req.query.provider as string | undefined;
    const stats = await smartRouter.getProviderStats(provider as any);
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await smartRouter.getFullStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.get('/credits', async (req: Request, res: Response) => {
  try {
    const credits = await creditManager.getAllCreditStatuses();
    res.json({ success: true, credits });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.get('/credits/:provider', async (req: Request, res: Response) => {
  try {
    const status = await creditManager.getCreditStatus(req.params.provider as any);
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.get('/consumption', async (req: Request, res: Response) => {
  try {
    const history = creditManager.getConsumptionHistory(req.query.provider as any);
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.get('/estimate-cost', async (req: Request, res: Response) => {
  try {
    const provider = (req.query.provider as string) || 'vidu';
    const model = (req.query.model as string) || 'viduq3-turbo';
    const duration = parseInt(req.query.duration as string) || 5;
    const cost = creditManager.estimateCost(provider as any, model, duration);
    res.json({ success: true, provider, model, duration, estimatedCost: cost });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.get('/fallback-status', async (req: Request, res: Response) => {
  try {
    const status = fallbackChain.getProviderStatus();
    res.json({ success: true, fallbackStatus: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.get('/models', async (req: Request, res: Response) => {
  try {
    const models = modelSelector.getAvailableModels({
      requireImageToVideo: req.query.i2v === 'true',
      requireReference: req.query.reference === 'true',
      duration: req.query.duration ? parseInt(req.query.duration as string) : undefined,
    });
    res.json({ success: true, models });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.post('/select-model', async (req: Request, res: Response) => {
  try {
    const { quality, speed, maxCost, duration, requireImageToVideo, requireReference, costOptimization } = req.body;
    const result = await modelSelector.selectBestModel({
      quality,
      speed,
      maxCost,
      duration,
      requireImageToVideo,
      requireReference,
      costOptimization,
    });
    res.json({ success: true, selection: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.get('/strategies', async (req: Request, res: Response) => {
  try {
    const strategies = costOptimizer.getStrategyInfo();
    const tiers = costOptimizer.getTierDefaults();
    res.json({ success: true, strategies, tiers });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.get('/tenant/:userId', async (req: Request, res: Response) => {
  try {
    const stats = tenantKeyPool.getTenantStats(req.params.userId);
    res.json({ success: true, tenant: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.post('/tenant/:userId/tier', async (req: Request, res: Response) => {
  try {
    const { tier } = req.body;
    if (!tier || !['free', 'basic', 'premium', 'enterprise'].includes(tier)) {
      return res.status(400).json({ success: false, error: 'Invalid tier' });
    }
    const config = tenantKeyPool.updateTenantTier(req.params.userId, tier as TenantTier);
    res.json({ success: true, tenant: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.get('/monitor/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await realtimeMonitor.getSystemMetrics();
    res.json({ success: true, metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.get('/monitor/alerts', async (req: Request, res: Response) => {
  try {
    const level = req.query.level as 'info' | 'warning' | 'critical' | undefined;
    const alerts = realtimeMonitor.getAlerts(level);
    res.json({ success: true, alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.get('/monitor/requests', async (req: Request, res: Response) => {
  try {
    const count = parseInt(req.query.count as string) || 50;
    const requests = realtimeMonitor.getRecentRequests(count);
    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.post('/reset-keys', async (req: Request, res: Response) => {
  try {
    await smartRouter.resetAllExhaustedKeys();
    res.json({ success: true, message: 'All exhausted keys and cooldowns have been reset' });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.post('/clear-cooldown/:provider', async (req: Request, res: Response) => {
  try {
    fallbackChain.clearCooldown(req.params.provider as any);
    res.json({ success: true, message: `Cooldown cleared for ${req.params.provider}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

export const videoProxyRouter = router;
