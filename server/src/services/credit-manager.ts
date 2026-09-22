import prisma from '../lib/prisma';
import { decrypt } from '../utils/encryption';
import { smartKeyManager } from './smart-key-manager';
import type { ProviderType } from './smart-router';
import { logger } from '../utils/logger';

export interface CreditStatus {
  provider: ProviderType;
  estimatedCredits: number;
  isLow: boolean;
  isExhausted: boolean;
  predictedRemainingDays: number;
  avgDailyConsumption: number;
  lastUpdated: Date;
}

export interface CreditReservation {
  id: string;
  provider: ProviderType;
  keyId: string;
  amount: number;
  taskId: string;
  createdAt: Date;
  released: boolean;
}

interface ConsumptionRecord {
  date: string;
  provider: ProviderType;
  credits: number;
  requests: number;
}

const CREDIT_COST_PER_REQUEST: Record<ProviderType, Record<string, number>> = {
  vidu: {
    'viduq3-turbo': 60,
    'viduq3-pro': 100,
    'viduq3-pro-fast': 80,
    'viduq3-mix': 50,
    'viduq2-pro': 40,
    'viduq2-turbo': 30,
    viduq2: 30,
    default: 50,
  },
  doubao: {
    'doubao-seedance-1-5-pro': 60,
    default: 50,
  },
  minimax: {
    default: 50,
  },
  wuyinkeji: {
    google_omni: 60,
    'veo3.1_fast': 50,
    'Wan2.6_video': 80,
    'Wan2.7': 40,
    sora2: 100,
    video_vidu: 100,
    video_omni: 100,
    video_seedance: 100,
    Digital_Humans: 20,
    'Package_1.0': 10,
    default: 50,
  },
};

const LOW_CREDIT_THRESHOLD = 200;
const EXHAUSTED_CREDIT_THRESHOLD = 10;

export class CreditManager {
  private creditCache = new Map<string, CreditStatus>();
  private reservations = new Map<string, CreditReservation>();
  private consumptionHistory = new Map<ProviderType, ConsumptionRecord[]>();
  private lastHistoryUpdate = 0;
  // CONC-02 修复：添加简单的异步互斥锁，防止并发预留导致超额度
  // 风险修复：添加锁超时，防止前一个请求挂起导致所有后续请求永久阻塞
  private reserveLock: Promise<boolean> = Promise.resolve(true);
  private static readonly LOCK_TIMEOUT_MS = 5000; // 5 秒超时

  async getCreditStatus(provider: ProviderType): Promise<CreditStatus> {
    const cached = this.creditCache.get(provider);
    if (cached && Date.now() - cached.lastUpdated.getTime() < 300000) {
      return cached;
    }

    const status = await this.calculateCreditStatus(provider);
    this.creditCache.set(provider, status);
    return status;
  }

  async getAllCreditStatuses(): Promise<Record<ProviderType, CreditStatus>> {
    // BUG-06 修复：从 CREDIT_COST_PER_REQUEST 动态获取 provider 列表
    const providers = Object.keys(CREDIT_COST_PER_REQUEST) as ProviderType[];
    const statuses: Record<string, CreditStatus> = {};

    for (const provider of providers) {
      statuses[provider] = await this.getCreditStatus(provider);
    }

    return statuses as Record<ProviderType, CreditStatus>;
  }

  private async calculateCreditStatus(provider: ProviderType): Promise<CreditStatus> {
    const keys = await smartKeyManager.getActiveKeys(provider);
    let estimatedCredits = 0;

    for (const key of keys) {
      if (key.stats.successRate > 0 || key.stats.totalRequests === 0) {
        estimatedCredits += 500;
      }
    }

    const history = this.consumptionHistory.get(provider) || [];
    const avgDailyConsumption = this.calculateAvgDailyConsumption(history);
    const predictedRemainingDays = avgDailyConsumption > 0
      ? Math.max(0, Math.floor(estimatedCredits / avgDailyConsumption))
      : 999;

    return {
      provider,
      estimatedCredits,
      isLow: estimatedCredits < LOW_CREDIT_THRESHOLD,
      isExhausted: estimatedCredits < EXHAUSTED_CREDIT_THRESHOLD || keys.length === 0,
      predictedRemainingDays,
      avgDailyConsumption,
      lastUpdated: new Date(),
    };
  }

  estimateCost(provider: ProviderType, model: string, duration: number): number {
    const providerCosts = CREDIT_COST_PER_REQUEST[provider];
    if (!providerCosts) return 50;

    const baseCost = providerCosts[model] || providerCosts.default;
    const durationMultiplier = duration > 5 ? 1 + (duration - 5) * 0.2 : 1;

    return Math.ceil(baseCost * durationMultiplier);
  }

  async reserveCredit(taskId: string, provider: ProviderType, model: string, duration: number): Promise<boolean> {
    // CONC-02 修复：通过 Promise 链实现简单的异步互斥，防止并发预留竞态
    // 风险修复：锁等待添加超时，避免前一个请求异常导致永久阻塞
    // P1 修复：超时定时器在锁获取后立即清理，防止虚假告警日志和定时器堆积
    const prevLock = this.reserveLock;
    let resolveRelease!: () => void;
    this.reserveLock = new Promise<boolean>((resolve) => { resolveRelease = () => resolve(true); });

    let timer: NodeJS.Timeout | undefined;
    try {
      const timeoutPromise = new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          logger.warn('[CreditManager] reserveCredit 锁等待超时，跳过锁直接执行');
          resolve();
        }, CreditManager.LOCK_TIMEOUT_MS);
      });
      await Promise.race([prevLock, timeoutPromise]);
      if (timer) clearTimeout(timer); // 锁快速获取时清理定时器，防止 5s 后的虚假告警
      const cost = this.estimateCost(provider, model, duration);
      const status = await this.getCreditStatus(provider);

      if (status.isExhausted) {
        return false;
      }

      const keys = await smartKeyManager.getActiveKeys(provider);
      if (keys.length === 0) {
        return false;
      }

      const bestKey = keys[0];

      const reservation: CreditReservation = {
        id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        provider,
        keyId: bestKey.id,
        amount: cost,
        taskId,
        createdAt: new Date(),
        released: false,
      };

      this.reservations.set(reservation.id, reservation);
      return true;
    } finally {
      if (timer) clearTimeout(timer); // 确保任何路径都清理定时器
      resolveRelease();
    }
  }

  releaseCredit(reservationId: string): void {
    const reservation = this.reservations.get(reservationId);
    if (reservation) {
      reservation.released = true;
      this.recordConsumption(reservation.provider, reservation.amount);
    }
  }

  recordConsumption(provider: ProviderType, credits: number): void {
    const today = new Date().toISOString().split('T')[0];
    const history = this.consumptionHistory.get(provider) || [];

    const todayRecord = history.find(r => r.date === today);
    if (todayRecord) {
      todayRecord.credits += credits;
      todayRecord.requests += 1;
    } else {
      history.push({ date: today, provider, credits, requests: 1 });
    }

    if (history.length > 30) {
      history.shift();
    }

    this.consumptionHistory.set(provider, history);
    this.creditCache.delete(provider);
  }

  async findProviderWithCredit(model: string, duration: number): Promise<ProviderType | null> {
    // BUG-06 修复：从 CREDIT_COST_PER_REQUEST 动态获取 provider 列表
    const providers = Object.keys(CREDIT_COST_PER_REQUEST) as ProviderType[];

    for (const provider of providers) {
      const status = await this.getCreditStatus(provider);
      const cost = this.estimateCost(provider, model, duration);

      if (!status.isExhausted && status.estimatedCredits >= cost) {
        return provider;
      }
    }

    return null;
  }

  shouldAlert(provider: ProviderType): boolean {
    const status = this.creditCache.get(provider);
    if (!status) return false;

    return status.isLow || status.predictedRemainingDays < 3;
  }

  private calculateAvgDailyConsumption(history: ConsumptionRecord[]): number {
    if (history.length === 0) return 0;

    const recentDays = history.slice(-7);
    const totalCredits = recentDays.reduce((sum, r) => sum + r.credits, 0);

    return totalCredits / recentDays.length;
  }

  getConsumptionHistory(provider?: ProviderType): ConsumptionRecord[] {
    if (provider) {
      return this.consumptionHistory.get(provider) || [];
    }

    const allRecords: ConsumptionRecord[] = [];
    this.consumptionHistory.forEach(records => allRecords.push(...records));
    return allRecords.sort((a, b) => a.date.localeCompare(b.date));
  }
}

export const creditManager = new CreditManager();
