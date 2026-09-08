import { getMembershipLimits, calculateVideoPoints, calculateAudioPoints, IMAGE_PRICING_RULES, MUSIC_PRICING_RULES } from '../config/membership-permissions';
import { calculateConfiguredVideoPoints } from '../config/video-pricing-table';
import { dailyUsageService } from './daily-usage-service';
import { deductPointsForTask, getBalance, deductPoints, addPoints } from './points-service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';
import { resolvePricingCost } from './pricing-rules-service';
import {
  getVideoCreditPolicy,
  isLightMembershipOrAbove,
  type VideoPointsSource,
} from './video-credit-policy';

export interface ConsumeOptions {
  userId: string;
  membershipLevel: string;
  type: 'music' | 'image' | 'audio' | 'prompt' | 'video';
  amount?: number;
  taskId: string;
  reason: string;
  provider?: string;
  model?: string;
  resolution?: string;
  durationSeconds?: number;
  hasVideoInput?: boolean;
  generateAudio?: boolean;
  generationMode?: string;
  customPoints?: number;
  directDeduction?: boolean;
}

export interface PreCheckResult {
  allowed: boolean;
  pointsNeeded: number;
  reason: string;
  willUseDailyQuota: boolean;
  pointsSource?: VideoPointsSource;
}

interface UsageSnapshot {
  musicCount: number;
  imageCount: number;
  audioMinutes: number;
  promptOptimizationCount: number;
  videoCount: number;
  date: string;
  minimaxImage01Count?: number;
}

interface ChargePlan {
  allowed: boolean;
  pointsNeeded: number;
  reason: string;
  willUseDailyQuota: boolean;
  pointsSource?: VideoPointsSource;
}

function lookupPricingRule(rules: Record<string, number>, key: string): number | null {
  if (key in rules) {
    return rules[key];
  }

  const normalizedKey = key.toLowerCase();
  const matchedKey = Object.keys(rules).find(ruleKey => ruleKey.toLowerCase() === normalizedKey);
  return matchedKey ? rules[matchedKey] : null;
}

const BASE_DAILY_POINTS: Record<string, Record<'music' | 'image' | 'audio' | 'prompt', number>> = {
  trial: { music: 1, image: 1, audio: 0, prompt: 1 },
  free: { music: 1, image: 1, audio: 1, prompt: 1 },
  light: { music: 1, image: 1, audio: 1, prompt: 1 },
  pro: { music: 1, image: 1, audio: 1, prompt: 1 },
  local: { music: 1, image: 1, audio: 1, prompt: 1 },
};

function enforceAudioMinimumCost(modelOrProvider: string | undefined, cost: number): number {
  const key = modelOrProvider?.toLowerCase() || '';
  const isStepAudio =
    key.includes('step-tts') ||
    key.includes('stepaudio') ||
    key.includes('step-1o-audio');

  return isStepAudio ? Math.max(cost, 30) : cost;
}

class CreditService {
  private normalizeMembershipLevel(level: string): string {
    const normalized = level.toLowerCase();

    if (normalized === 'vip' || normalized === 'basic') return 'light';
    if (normalized === 'premium' || normalized === 'professional') return 'pro';
    if (normalized === 'test') return 'free';
    if (normalized === 'enterprise' || normalized === 'admin') return 'local';

    return normalized;
  }

  private getBaseDailyUnitCost(
    membershipLevel: string,
    type: 'music' | 'image' | 'audio' | 'prompt'
  ): number {
    const normalizedLevel = this.normalizeMembershipLevel(membershipLevel);
    return BASE_DAILY_POINTS[normalizedLevel]?.[type] ?? 0;
  }

  private resolveModelUnitCost(type: 'music' | 'image', provider?: string, model?: string): number | null {
    const normalizedModel = model?.toLowerCase();
    const normalizedProvider = provider?.toLowerCase();
    const pricingKeys = [normalizedModel, normalizedProvider].filter(Boolean) as string[];

    if (type === 'image') {
      for (const pricingKey of pricingKeys) {
        const price = lookupPricingRule(IMAGE_PRICING_RULES, pricingKey);
        if (price !== null) {
          return price;
        }
      }
      if (pricingKeys.length === 0) return null;
      return IMAGE_PRICING_RULES.default;
    }

    if (type === 'music') {
      for (const pricingKey of pricingKeys) {
        const price = lookupPricingRule(MUSIC_PRICING_RULES, pricingKey);
        if (price !== null) {
          return price;
        }
      }
      if (pricingKeys.length === 0) return null;
      return MUSIC_PRICING_RULES.default;
    }

    return null;
  }

  private async buildChargePlan(options: ConsumeOptions, usage: UsageSnapshot): Promise<ChargePlan> {
    const { membershipLevel, type, amount = 1 } = options;

    if (type === 'video') {
      const policy = getVideoCreditPolicy(options.provider, options.model);
      if (
        policy.requiresLightMembership &&
        !isLightMembershipOrAbove(membershipLevel)
      ) {
        return {
          allowed: false,
          pointsNeeded: 0,
          reason: '该视频模型需要轻享版或更高等级会员',
          willUseDailyQuota: false,
          pointsSource: policy.pointsSource,
        };
      }

      const pricingKey = options.model || options.provider || 'default';
      const configuredCost = calculateConfiguredVideoPoints(
        pricingKey,
        options.resolution || 'default',
        options.durationSeconds || 5,
        {
          hasVideoInput: options.hasVideoInput,
          generateAudio: options.generateAudio,
          generationMode: options.generationMode,
        }
      );
      const dbCost = configuredCost === null
        ? await resolvePricingCost('video', options.model, options.provider)
        : null;
      const pointsNeeded = options.customPoints
        ?? (configuredCost ?? (dbCost !== null ? dbCost : calculateVideoPoints(
          pricingKey,
          options.resolution || 'default',
          options.durationSeconds || 5
        )));
      return {
        allowed: true,
        pointsNeeded,
        reason: pointsNeeded > 0
          ? (policy.pointsSource === 'recharge'
            ? '该视频模型仅支持充值积分'
            : '视频按模型积分抵扣')
          : '视频无需扣费',
        willUseDailyQuota: false,
        pointsSource: policy.pointsSource,
      };
    }

    if (type === 'audio') {
      const pricingKey = options.model || options.provider || 'default';
      const dbCost = await resolvePricingCost('audio', options.model, options.provider);
      const pointsNeeded = options.customPoints
        ?? (dbCost !== null
          ? enforceAudioMinimumCost(pricingKey, dbCost)
          : calculateAudioPoints(pricingKey, amount));

      return {
        allowed: true,
        pointsNeeded,
        reason: pointsNeeded > 0 ? 'AI配音按模型积分抵扣' : 'AI配音无需扣费',
        willUseDailyQuota: false,
      };
    }

    if (type === 'music') {
      // 数据库定价规则命中：覆盖音乐单价（单首固定积分）
      const dbMusicCost = await resolvePricingCost('music', options.model, options.provider);
      if (dbMusicCost !== null) {
        return {
          allowed: true,
          pointsNeeded: options.customPoints ?? dbMusicCost * amount,
          reason: '按模型积分扣除',
          willUseDailyQuota: false,
        };
      }
    } else if (type === 'image') {
      // 数据库定价规则命中：覆盖图片单价（单张固定积分）
      const dbImageCost = await resolvePricingCost('image', options.model, options.provider);
      if (dbImageCost !== null) {
        return {
          allowed: true,
          pointsNeeded: options.customPoints ?? dbImageCost * amount,
          reason: '按模型积分扣除',
          willUseDailyQuota: false,
        };
      }
    } else {
      // 数据库定价规则命中：覆盖文本单价（单次固定积分）
      const dbTextCost = await resolvePricingCost('text', options.model, options.provider);
      if (dbTextCost !== null) {
        return {
          allowed: true,
          pointsNeeded: options.customPoints ?? dbTextCost * amount,
          reason: '按模型积分扣除',
          willUseDailyQuota: false,
        };
      }
    }

    const modelUnitCost = (type === 'image' || type === 'music')
      ? this.resolveModelUnitCost(type, options.provider, options.model)
      : null;
    const baseUnitCost = modelUnitCost ?? this.getBaseDailyUnitCost(membershipLevel, type);

    const pointsNeeded = options.customPoints ?? baseUnitCost * amount;
    return {
      allowed: true,
      pointsNeeded,
      reason: pointsNeeded > 0 ? '按模型积分扣除' : '该功能未配置积分价格',
      willUseDailyQuota: false,
    };
  }

  async preCheck(options: ConsumeOptions): Promise<PreCheckResult> {
    const usage = await dailyUsageService.getDailyUsage(options.userId);
    const chargePlan = await this.buildChargePlan(options, usage);

    if (!chargePlan.allowed) {
      return chargePlan;
    }

    if (chargePlan.pointsNeeded <= 0) {
      return chargePlan;
    }

    const { pointsBalance, rechargePointsBalance } = await getBalance(options.userId);
    const availableBalance = chargePlan.pointsSource === 'recharge'
      ? rechargePointsBalance
      : pointsBalance;
    if (availableBalance < chargePlan.pointsNeeded) {
      return {
        allowed: false,
        pointsNeeded: chargePlan.pointsNeeded,
        reason: chargePlan.pointsSource === 'recharge'
          ? '充值积分不足，需要 ' + chargePlan.pointsNeeded + ' 充值积分'
          : '积分不足，需要 ' + chargePlan.pointsNeeded + ' 积分',
        willUseDailyQuota: false,
        pointsSource: chargePlan.pointsSource,
      };
    }

    return chargePlan;
  }

  async calculatePoints(options: ConsumeOptions): Promise<number> {
    if (options.customPoints) return options.customPoints;
    const usage: UsageSnapshot = {
      musicCount: 0,
      imageCount: 0,
      audioMinutes: 0,
      promptOptimizationCount: 0,
      videoCount: 0,
      date: '',
    };
    return (await this.buildChargePlan(options, usage)).pointsNeeded;
  }

  async consume(options: ConsumeOptions): Promise<void> {
    const preCheckResult = await this.preCheck(options);
    if (!preCheckResult.allowed) {
      throw new AppError(preCheckResult.reason, preCheckResult.pointsNeeded > 0 ? 402 : 403);
    }

    const pointsNeeded = preCheckResult.pointsNeeded;
    let usageIncremented = false;
    try {
      if (options.type !== 'video') {
        await dailyUsageService.incrementUsage(options.userId, options.type, options.amount || 1);
        usageIncremented = true;
      }
    } catch (error) {
      console.error('[CreditService] 增量使用量失败:', error);
      throw new AppError('使用量记录失败，请重试', 500);
    }

    if (pointsNeeded <= 0) {
      return;
    }

    try {
      const deductionOptions = {
        rechargeOnly: preCheckResult.pointsSource === 'recharge',
      };
      if (options.type === 'prompt' || options.directDeduction) {
        await deductPoints(
          options.userId,
          pointsNeeded,
          options.reason,
          undefined,
          deductionOptions,
        );
      } else {
        await deductPointsForTask(
          options.userId,
          options.taskId,
          pointsNeeded,
          options.reason,
          deductionOptions,
        );
      }
    } catch (error) {
      console.error('[CreditService] 积分扣减失败，执行使用量回滚:', error);
      try {
        if (usageIncremented) {
          await dailyUsageService.decrementUsage(options.userId, options.type, options.amount || 1);
          logger.info('[CreditService] 使用量回滚成功');
        }
      } catch (rollbackError) {
        console.error('[CreditService] 使用量回滚失败，需要人工处理:', rollbackError);
      }
      throw new AppError('积分扣减失败，请重试', 500);
    }
  }

  /**
   * 风险修复：退还积分 — 当业务执行失败时（如 AI 处理失败、外部 API 调用失败）调用
   * P0 修复：添加 taskId 幂等检查 + 重置 task.credits 防止免费视频
   * P1 修复：退款失败抛出异常而非静默吞掉，让调用方感知
   */
  async refund(options: {
    userId: string;
    type: 'music' | 'image' | 'audio' | 'prompt' | 'video';
    customPoints?: number;
    taskId?: string;
    reason: string;
  }): Promise<void> {
    const pointsToRefund = options.customPoints || await this.calculatePoints(options as ConsumeOptions);
    if (pointsToRefund <= 0) return;

    // P0 修复：基于 taskId 的幂等检查，防止重复退款
    // P2 修复：用 relatedType='task_refund' + relatedId=taskId 作为主查重键，
    // 同时保留旧文案匹配（reason contains '退款'）以兼容历史数据
    if (options.taskId) {
      const existingRefund = await prisma.pointsTransaction.findFirst({
        where: {
          userId: options.userId,
          type: { in: ['REFUND', 'RECHARGE'] },
          orderNo: options.taskId,
          OR: [
            { relatedType: 'task_refund', relatedId: options.taskId },
            { reason: { contains: '退款' } },
          ],
        },
        select: { id: true },
      });
      if (existingRefund) {
        logger.warn(`[CreditService] taskId=${options.taskId} 已退款过，跳过重复退款`);
        return;
      }
    }

    try {
      const originalConsumption = options.taskId
        ? await prisma.pointsTransaction.findFirst({
            where: {
              userId: options.userId,
              type: 'CONSUME',
              OR: [
                { relatedType: 'task', relatedId: options.taskId },
                { orderNo: options.taskId },
              ],
            },
            orderBy: { createdAt: 'desc' },
            select: { rechargeAmount: true },
          })
        : null;
      const rechargeAmountToRefund = Math.min(
        pointsToRefund,
        Math.abs(originalConsumption?.rechargeAmount ?? 0),
      );

      await addPoints(
        options.userId,
        pointsToRefund,
        `退款: ${options.reason}`,
        options.taskId,
        undefined,
        {
          type: 'REFUND',
          relatedType: 'task_refund',
          relatedId: options.taskId,
          rechargeAmount: rechargeAmountToRefund,
        },
      );
      // P0 修复：退款成功后重置 task.credits，防止后续轮询误判为"已扣费"导致免费视频
      if (options.taskId) {
        await prisma.task.updateMany({
          where: { id: options.taskId, credits: { gt: 0 } },
          data: { credits: 0 },
        }).catch(e => logger.error(`[CreditService] 重置 task.credits 失败: taskId=${options.taskId}`, e));
      }
      logger.info(`[CreditService] 积分退还成功: userId=${options.userId}, points=${pointsToRefund}, reason=${options.reason}`);
    } catch (error) {
      // P1 修复：抛出异常让调用方感知退款失败，而非静默吞掉
      logger.error(`[CreditService] 积分退还失败: userId=${options.userId}, points=${pointsToRefund}`, error);
      throw new AppError('积分退还失败，请联系客服处理', 500);
    }
  }
}

export const creditService = new CreditService();
