/**
 * 每日使用量追踪服务
 * 记录用户每种功能的每日使用次数
 */

import prisma from '../lib/prisma';
import { redisService } from './redis-service';

export interface DailyUsageRecord {
  date: string;  // 格式: YYYY-MM-DD
  musicCount: number;
  imageCount: number;
  audioMinutes: number;
  promptOptimizationCount: number;
  videoCount: number;
  minimaxImage01Count: number; // MiniMax Image-01 使用次数
}

export interface UsageCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  message: string;
}

class DailyUsageService {
  private cachePrefix = 'daily_usage:';
  private minimaxCachePrefix = 'minimax_image01_usage:'; // MiniMax Image-01 独立使用量
  private cacheTTL = 24 * 60 * 60; // 24小时
  private resetCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (process.env.NODE_ENV !== 'test') {
      this.startResetScheduler();
    }
  }

  private startResetScheduler() {
    const checkInterval = 60 * 60 * 1000;
    this.resetCheckInterval = setInterval(() => {
      this.checkAndResetUsage().catch(err => {
        console.error('[DailyUsage] 自动重置检查失败:', err);
      });
    }, checkInterval);
    console.log('[DailyUsage] 每日使用量自动重置定时任务已启动');
  }

  private async checkAndResetUsage(): Promise<void> {
    const now = new Date();
    const lastReset = await redisService.get('daily_usage:last_reset_date');
    const today = this.getDateKey(now);

    if (lastReset === today) {
      return;
    }

    console.log('[DailyUsage] 执行每日使用量重置...');

    // BUG-03 修复：仅删除过期记录，而非全表删除
    const cutoffDateStr = this.getDateKey(now); // YYYY-MM-DD 格式
    // P2 修复 #21：删除过期 DailyUsage 与重置 UserQuota.dailyUsed 必须原子完成，
    // 否则中途失败会导致使用量统计不一致。
    await prisma.$transaction([
      prisma.dailyUsage.deleteMany({
        where: { date: { lt: cutoffDateStr } },
      }),
      prisma.userQuota.updateMany({
        data: {
          dailyUsed: 0,
        },
      }),
    ]);

    await redisService.set('daily_usage:last_reset_date', today, 48 * 60 * 60);

    console.log('[DailyUsage] 每日使用量重置完成');
  }

  private getDateKey(date: Date = new Date()): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private getCacheKey(userId: string, date: string): string {
    return `${this.cachePrefix}${userId}:${date}`;
  }

  private getMiniMaxCacheKey(userId: string, date: string): string {
    return `${this.minimaxCachePrefix}${userId}:${date}`;
  }

  async getDailyUsage(userId: string, date: Date = new Date()): Promise<DailyUsageRecord> {
    const dateKey = this.getDateKey(date);
    const cacheKey = this.getCacheKey(userId, dateKey);

    // 尝试从缓存获取
    const cached = await redisService.get(cacheKey);
    if (cached) {
      try {
        const usage = JSON.parse(cached); // ERR-05 修复：包裹 try-catch，解析失败时回源查询
        const minimaxCount = await this.getMiniMaxImage01Count(userId, dateKey);
        return { ...usage, minimaxImage01Count: minimaxCount };
      } catch {
        // 缓存数据损坏，回源查询数据库
      }
    }

    // 从数据库获取
    const record = await prisma.dailyUsage.findFirst({
      where: {
        userId,
        date: dateKey,
      },
    });

    // 获取 MiniMax Image-01 使用量
    const minimaxCount = await this.getMiniMaxImage01Count(userId, dateKey);

    const usage: DailyUsageRecord = {
      date: dateKey,
      musicCount: record?.musicCount || 0,
      imageCount: record?.imageCount || 0,
      audioMinutes: record?.audioMinutes || 0,
      promptOptimizationCount: record?.promptOptimizationCount || 0,
      videoCount: record?.videoCount || 0,
      minimaxImage01Count: minimaxCount,
    };

    // 缓存结果
    await redisService.set(cacheKey, JSON.stringify(usage), this.cacheTTL);

    return usage;
  }

  private async getMiniMaxImage01Count(userId: string, dateKey: string): Promise<number> {
    const cacheKey = this.getMiniMaxCacheKey(userId, dateKey);
    const cached = await redisService.get(cacheKey);
    return cached ? parseInt(cached, 10) : 0;
  }

  private async incrementMiniMaxImage01Count(userId: string, amount: number = 1): Promise<number> {
    const normalizedAmount = Math.max(1, Math.floor(amount));
    const cacheKey = this.getMiniMaxCacheKey(userId, this.getDateKey());

    if (normalizedAmount === 1) {
      return redisService.incrWithExpiry(cacheKey, this.cacheTTL);
    }

    return redisService.incrByWithExpiry(cacheKey, normalizedAmount, this.cacheTTL);
  }

  async incrementUsage(
    userId: string,
    type: 'music' | 'image' | 'audio' | 'prompt' | 'video',
    amount: number = 1
  ): Promise<DailyUsageRecord> {
    const dateKey = this.getDateKey();
    const cacheKey = this.getCacheKey(userId, dateKey);

    // 更新数据库
    const updateData: any = {};
    switch (type) {
      case 'music':
        updateData.musicCount = { increment: amount };
        break;
      case 'image':
        updateData.imageCount = { increment: amount };
        break;
      case 'audio':
        updateData.audioMinutes = { increment: amount };
        break;
      case 'prompt':
        updateData.promptOptimizationCount = { increment: amount };
        break;
      case 'video':
        updateData.videoCount = { increment: amount };
        break;
    }

    const record = await prisma.dailyUsage.upsert({
      where: {
        userId_date: {
          userId,
          date: dateKey,
        },
      },
      update: updateData,
      create: {
        userId,
        date: dateKey,
        musicCount: type === 'music' ? amount : 0,
        imageCount: type === 'image' ? amount : 0,
        audioMinutes: type === 'audio' ? amount : 0,
        promptOptimizationCount: type === 'prompt' ? amount : 0,
        videoCount: type === 'video' ? amount : 0,
      },
    });

    const usage: DailyUsageRecord = {
      date: dateKey,
      musicCount: record.musicCount,
      imageCount: record.imageCount,
      audioMinutes: record.audioMinutes,
      promptOptimizationCount: record.promptOptimizationCount,
      videoCount: record.videoCount,
      minimaxImage01Count: 0,
    };

    // 更新缓存
    await redisService.set(cacheKey, JSON.stringify(usage), this.cacheTTL);

    return usage;
  }

  async decrementUsage(
    userId: string,
    type: 'music' | 'image' | 'audio' | 'prompt' | 'video',
    amount: number = 1
  ): Promise<DailyUsageRecord> {
    const dateKey = this.getDateKey();
    const cacheKey = this.getCacheKey(userId, dateKey);

    const updateData: any = {};
    switch (type) {
      case 'music':
        updateData.musicCount = { increment: -amount };
        break;
      case 'image':
        updateData.imageCount = { increment: -amount };
        break;
      case 'audio':
        updateData.audioMinutes = { increment: -amount };
        break;
      case 'prompt':
        updateData.promptOptimizationCount = { increment: -amount };
        break;
      case 'video':
        updateData.videoCount = { increment: -amount };
        break;
    }

    const record = await prisma.dailyUsage.upsert({
      where: {
        userId_date: {
          userId,
          date: dateKey,
        },
      },
      update: updateData,
      create: {
        userId,
        date: dateKey,
        musicCount: type === 'music' ? -amount : 0,
        imageCount: type === 'image' ? -amount : 0,
        audioMinutes: type === 'audio' ? -amount : 0,
        promptOptimizationCount: type === 'prompt' ? -amount : 0,
        videoCount: type === 'video' ? -amount : 0,
      },
    });

    const usage: DailyUsageRecord = {
      date: dateKey,
      musicCount: Math.max(0, record.musicCount),
      imageCount: Math.max(0, record.imageCount),
      audioMinutes: Math.max(0, record.audioMinutes),
      promptOptimizationCount: Math.max(0, record.promptOptimizationCount),
      videoCount: Math.max(0, record.videoCount),
      minimaxImage01Count: 0,
    };

    await redisService.set(cacheKey, JSON.stringify(usage), this.cacheTTL);

    return usage;
  }

  // DEAD-04 修复：删除从未被外部调用的 checkAndIncrement 死代码方法

  async getUsageSummary(userId: string, membershipLevel: string) {
    const usage = await this.getDailyUsage(userId);
    const limits = { dailyMusic: -1, dailyImage: -1, dailyAudioMinutes: -1, dailyPromptOptimization: -1, dailyVideo: -1 }; // Simplified unlimited after removing membership system

    return {
      date: usage.date,
      music: {
        used: usage.musicCount,
        limit: limits.dailyMusic,
        remaining: limits.dailyMusic === -1 ? -1 : Math.max(0, limits.dailyMusic - usage.musicCount),
        unlimited: limits.dailyMusic === -1,
      },
      image: {
        used: usage.imageCount,
        limit: limits.dailyImage,
        remaining: limits.dailyImage === -1 ? -1 : Math.max(0, limits.dailyImage - usage.imageCount),
        unlimited: limits.dailyImage === -1,
      },
      audio: {
        used: usage.audioMinutes,
        limit: limits.dailyAudioMinutes,
        remaining: limits.dailyAudioMinutes === -1 ? -1 : Math.max(0, limits.dailyAudioMinutes - usage.audioMinutes),
        unlimited: limits.dailyAudioMinutes === -1,
      },
      prompt: {
        used: usage.promptOptimizationCount,
        limit: limits.dailyPromptOptimization,
        remaining: limits.dailyPromptOptimization === -1 ? -1 : Math.max(0, limits.dailyPromptOptimization - usage.promptOptimizationCount),
        unlimited: limits.dailyPromptOptimization === -1,
      },
      video: {
        used: usage.videoCount,
        limit: limits.dailyVideo,
        remaining: limits.dailyVideo === -1 ? -1 : Math.max(0, limits.dailyVideo - usage.videoCount),
        unlimited: limits.dailyVideo === -1,
      },
    };
  }

  async incrementMiniMaxImage01Usage(userId: string, amount: number = 1): Promise<DailyUsageRecord> {
    await this.incrementMiniMaxImage01Count(userId, amount);
    return this.getDailyUsage(userId);
  }

  // BUG-07 修复：添加 MiniMax Image-01 使用量回滚方法
  async decrementMiniMaxImage01Usage(userId: string, amount: number = 1): Promise<DailyUsageRecord> {
    await this.decrementMiniMaxImage01Count(userId, amount);
    return this.getDailyUsage(userId);
  }

  private async decrementMiniMaxImage01Count(userId: string, amount: number = 1): Promise<number> {
    const normalizedAmount = Math.max(1, Math.floor(amount));
    const cacheKey = this.getMiniMaxCacheKey(userId, this.getDateKey());

    if (normalizedAmount === 1) {
      return redisService.decrClamped(cacheKey);
    }

    return redisService.decrByClamped(cacheKey, normalizedAmount);
  }

  async resetUsage(userId: string, date?: Date): Promise<void> {
    const dateKey = this.getDateKey(date || new Date());
    const cacheKey = this.getCacheKey(userId, dateKey);

    await prisma.dailyUsage.deleteMany({
      where: {
        userId,
        date: dateKey,
      },
    });

    await redisService.deleteCache(cacheKey);
  }
}

export const dailyUsageService = new DailyUsageService();
export default dailyUsageService;
