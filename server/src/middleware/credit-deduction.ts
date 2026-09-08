import { Request, Response, NextFunction } from 'express';
import { creditService } from '../services/credit-service';
import { AppError } from './errorHandler';
import type { AuthRequest } from './auth';
import { logger } from '../utils/logger';

export interface CreditDeductionConfig {
  type: 'music' | 'image' | 'audio' | 'prompt' | 'video';
  amount?: number;
  reason: string;
  provider?: string;
  model?: string;
  resolution?: string;
  durationSeconds?: number;
  hasVideoInput?: boolean;
  generateAudio?: boolean;
  generationMode?: string;
  customPoints?: number;
}

export type CreditDeductionConfigFactory = (req: AuthRequest) => CreditDeductionConfig | Promise<CreditDeductionConfig>;

const DEFAULT_MEMBERSHIP_LEVEL = 'trial';

async function resolveConfig(
  configOrFactory: CreditDeductionConfig | CreditDeductionConfigFactory,
  req: AuthRequest
): Promise<CreditDeductionConfig> {
  if (typeof configOrFactory === 'function') {
    return await (configOrFactory as CreditDeductionConfigFactory)(req);
  }
  return configOrFactory;
}

export function withCreditDeduction(
  configOrFactory: CreditDeductionConfig | CreditDeductionConfigFactory
) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.userId!;
    const membershipLevel = DEFAULT_MEMBERSHIP_LEVEL; // Simplified after removing membership login system
    const taskId = `temp_${Date.now()}`;

    try {
      const config = await resolveConfig(configOrFactory, req);

      const checkResult = await creditService.preCheck({
        userId,
        membershipLevel,
        type: config.type,
        amount: config.amount,
        taskId,
        reason: `${config.reason} - 预检查`,
        provider: config.provider,
        model: config.model,
        resolution: config.resolution,
        durationSeconds: config.durationSeconds,
        hasVideoInput: config.hasVideoInput,
        generateAudio: config.generateAudio,
        generationMode: config.generationMode,
        customPoints: config.customPoints,
      });

      if (!checkResult.allowed) {
        console.warn(`[CreditDeduction] 积分预检查失败: userId=${userId}, type=${config.type}, reason=${checkResult.reason}`);
        throw new AppError(checkResult.reason, 402);
      }

      console.log(`[CreditDeduction] 积分预检查成功: userId=${userId}, type=${config.type}, pointsNeeded=${checkResult.pointsNeeded}`);

      // CFG-03 修复：使用 req.creditCheck 而非 (req as any).creditCheck，类型通过 unknown 转换
      (req as unknown as Record<string, unknown>).creditCheck = checkResult;
      (req as unknown as Record<string, unknown>).creditConfig = config;

      next();
    } catch (error) {
      logger.error(`[CreditDeduction] 积分预检查异常: userId=${userId}`, error instanceof Error ? error.message : String(error));
      next(error);
    }
  };
}

export async function executeCreditDeduction(
  req: AuthRequest,
  actualTaskId: string
): Promise<void> {
  // CFG-03 修复：使用 unknown 转换替代 as any
  const creditConfig = (req as unknown as Record<string, unknown>).creditConfig as CreditDeductionConfig | undefined;
  const userId = req.userId!;
  const membershipLevel = DEFAULT_MEMBERSHIP_LEVEL; // Simplified after removing membership login system

  if (!creditConfig) {
    console.warn('[CreditDeduction] 未找到积分配置，跳过扣除');
    return;
  }

  try {
    await creditService.consume({
      userId,
      membershipLevel,
      type: creditConfig.type,
      amount: creditConfig.amount,
      taskId: actualTaskId,
      reason: creditConfig.reason,
      provider: creditConfig.provider,
      model: creditConfig.model,
      resolution: creditConfig.resolution,
      durationSeconds: creditConfig.durationSeconds,
      hasVideoInput: creditConfig.hasVideoInput,
      generateAudio: creditConfig.generateAudio,
      generationMode: creditConfig.generationMode,
      customPoints: creditConfig.customPoints,
    });

    console.log(`[CreditDeduction] 积分扣除成功: userId=${userId}, taskId=${actualTaskId}, type=${creditConfig.type}`);
  } catch (error) {
    logger.error(`[CreditDeduction] 积分扣除失败: userId=${userId}, taskId=${actualTaskId}, type=${creditConfig.type}`, error instanceof Error ? error.message : String(error));
    throw new AppError('积分扣除失败，请重试', 500);
  }
}
