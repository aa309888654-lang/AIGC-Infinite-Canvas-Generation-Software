import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { creditService } from '../services/credit-service';
import { getBalance } from '../services/points-service';
import {
  inspectPosterQuality,
  type PosterQualityInspectionInput,
} from '../services/poster-quality-inspection-service';
import { persistPosterQualityReport } from '../services/poster-project-service';
import logger from '../utils/logger';

const POSTER_QUALITY_INSPECTION_POINTS = 5;

const posterQualityInspectSchema = z.object({
  imageUrl: z.string().min(1, 'imageUrl is required'),
  tier: z.string().optional(),
  localScore: z.number().optional(),
  expectedText: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    organizer: z.string().optional(),
    date: z.string().optional(),
    location: z.string().optional(),
    contact: z.string().optional(),
    cta: z.string().optional(),
    description: z.string().optional(),
    benefits: z.array(z.string()).optional(),
    personName: z.string().optional(),
    school: z.string().optional(),
    company: z.string().optional(),
    position: z.string().optional(),
    companyDesc: z.string().optional(),
    motto: z.string().optional(),
    hometown: z.string().optional(),
    birthday: z.string().optional(),
    hobbies: z.string().optional(),
    honors: z.string().optional(),
  }).optional(),
  brand: z.object({
    name: z.string().optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    accentColor: z.string().optional(),
    fontFamily: z.string().optional(),
    tone: z.string().optional(),
  }).optional(),
  candidateId: z.string().uuid().optional(),
});

export const posterQualityRouter = Router();

posterQualityRouter.post('/inspect', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const input = posterQualityInspectSchema.parse(req.body) as PosterQualityInspectionInput;
    const membershipLevel = req.membershipLevel || 'trial';
    const taskId = `poster_quality_${Date.now()}`;

    const check = await creditService.preCheck({
      userId: req.userId!,
      membershipLevel,
      type: 'prompt',
      customPoints: POSTER_QUALITY_INSPECTION_POINTS,
      taskId,
      reason: '海报真实质检预检查',
    });

    if (!check.allowed) {
      return res.status(402).json({ success: false, error: check.reason });
    }

    const report = await inspectPosterQuality(input);
    if (input.candidateId) {
      await persistPosterQualityReport({
        candidateId: input.candidateId,
        report,
        engine: [report.engine.ocr, report.engine.vlm].filter(Boolean).join('/'),
        degraded: report.degraded,
      });
    }
    let pointsBalance: number | undefined;

    if (report.usedExternalAnalyzer) {
      await creditService.consume({
        userId: req.userId!,
        membershipLevel,
        type: 'prompt',
        customPoints: POSTER_QUALITY_INSPECTION_POINTS,
        taskId,
        reason: '海报OCR/VLM真实质检',
      });
      const balance = await getBalance(req.userId!);
      pointsBalance = Math.floor(balance.pointsBalance);
    }

    return res.json({
      success: true,
      data: {
        report,
        points: report.usedExternalAnalyzer ? POSTER_QUALITY_INSPECTION_POINTS : 0,
        pointsBalance,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '参数验证失败', details: error.errors });
    }
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[PosterQualityRoute] /inspect 错误: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});
