import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

const PRICING_RULES_PROVIDER = '__system_points_pricing__';

export type PricingTaskType = 'image' | 'video' | 'text' | 'audio' | 'music';

export interface PricingRule {
  id: string;
  taskType: PricingTaskType;
  provider: string | null;
  model: string;
  pointsCost: number;
  isActive: boolean;
  effectiveAt: string;
  note?: string;
}

interface CacheEntry {
  rules: PricingRule[];
  expireAt: number;
}

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60s

async function loadRulesFromDb(): Promise<PricingRule[]> {
  const providerConfig = await prisma.providerConfig.findUnique({
    where: { provider: PRICING_RULES_PROVIDER },
    select: { config: true },
  });
  if (!providerConfig?.config) return [];
  try {
    const parsed = JSON.parse(providerConfig.config as any) as { pricingRules?: PricingRule[] };
    return Array.isArray(parsed.pricingRules) ? parsed.pricingRules : [];
  } catch {
    return [];
  }
}

async function getActiveRules(): Promise<PricingRule[]> {
  if (cache && Date.now() < cache.expireAt) {
    return cache.rules;
  }
  try {
    const all = await loadRulesFromDb();
    const active = all.filter(
      (r) => r.isActive && typeof r.model === 'string' && r.model.trim()
    );
    cache = { rules: active, expireAt: Date.now() + CACHE_TTL_MS };
    return active;
  } catch (error) {
    logger.error('[PricingRulesService] 读取定价规则失败，将使用 fallback:', error);
    return cache?.rules || [];
  }
}

/**
 * 解析模型积分。命中返回 pointsCost，未命中返回 null（由调用方 fallback）。
 * 匹配优先级：model + provider 双匹配 > model 匹配 + provider 为 null（全局）
 */
export async function resolvePricingCost(
  taskType: PricingTaskType,
  model: string | undefined,
  provider?: string
): Promise<number | null> {
  if (!model || !model.trim()) return null;
  const normalizedModel = model.toLowerCase().trim();
  const normalizedProvider = provider?.toLowerCase().trim();
  const rules = (await getActiveRules()).filter((r) => r.taskType === taskType);

  // 优先：model + provider 双匹配
  if (normalizedProvider) {
    const exact = rules.find(
      (r) =>
        r.model.toLowerCase().trim() === normalizedModel &&
        r.provider &&
        r.provider.toLowerCase().trim() === normalizedProvider
    );
    if (exact) return exact.pointsCost;
  }
  // 次选：model 匹配 + provider 为 null（全局规则）
  const global = rules.find(
    (r) => r.model.toLowerCase().trim() === normalizedModel && !r.provider
  );
  if (global) return global.pointsCost;

  return null;
}

/** 写入操作后调用，清除缓存使下次读取拉取最新数据 */
export function invalidatePricingCache(): void {
  cache = null;
}
