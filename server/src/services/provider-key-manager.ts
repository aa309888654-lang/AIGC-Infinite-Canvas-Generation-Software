import prisma from '../lib/prisma';
import { redisService } from './redis-service';
import { decryptFromStorage, encryptForStorage, isEncrypted, maskApiKey } from '../utils/encryption';
import logger from '../utils/logger';

const DEFAULT_MAX_KEYS = 100;

const PROVIDER_KEY_LIMITS: Record<string, number> = {
  vidu: 20,
  doubao: 20,
  minimax: 20,
  wuyinkeji: 20,
  agnes: 20,
  stepfun: 20,
  sensenova: 20,
  jimeng: 20,
  volcano: 20,
  zxteams: 20,
};

const MAX_FAILURES_BEFORE_DISABLE = 8;
const FAILURE_COOLDOWN_MS = 3 * 60 * 1000;

/**
 * 已知无法解密的 keyId 集合（进程内缓存）。
 * 避免对同一把坏秘钥反复尝试解密导致日志洪水与 CPU 浪费。
 * 当秘钥被更新（updateKey）时会从此集合移除，允许重新尝试。
 */
const undecryptableKeyIds = new Set<string>();
const undecryptableLogged = new Set<string>();

function getMaxKeysForProvider(providerName: string): number {
  return PROVIDER_KEY_LIMITS[providerName] ?? DEFAULT_MAX_KEYS;
}

export interface ProviderKeyInfo {
  id: string;
  providerName: string;
  keyLabel: string;
  maskedKey: string;
  modelScope: string | null;
  weight: number;
  maxConcurrency: number;
  quotaTotal: number;
  quotaUsed: number;
  quotaRemaining: number;
  isActive: boolean;
  isExhausted: boolean;
  failureCount: number;
  lastFailureAt: Date | null;
  disabledAt: Date | null;
  priority: number;
  lastUsedAt: Date | null;
  exhaustedAt: Date | null;
  createdAt: Date;
}

export interface AddKeyInput {
  providerName: string;
  keyLabel: string;
  apiKey: string;
  modelScope?: string | null;
  weight?: number;
  maxConcurrency?: number;
  quotaTotal?: number;
  priority?: number;
}

export interface UpdateKeyInput {
  keyLabel?: string;
  apiKey?: string;
  modelScope?: string | null;
  weight?: number;
  maxConcurrency?: number;
  quotaTotal?: number;
  quotaUsed?: number;
  isActive?: boolean;
  priority?: number;
}

function toKeyInfo(row: any): ProviderKeyInfo {
  return {
    id: row.id,
    providerName: row.providerName,
    keyLabel: row.keyLabel,
    maskedKey: row.encryptedKey ? maskApiKey(row.encryptedKey) : '',
    modelScope: row.modelScope ?? null,
    weight: row.weight ?? 1,
    maxConcurrency: row.maxConcurrency ?? 1,
    quotaTotal: row.quotaTotal,
    quotaUsed: row.quotaUsed,
    quotaRemaining: row.quotaRemaining,
    isActive: row.isActive,
    isExhausted: row.isExhausted,
    failureCount: row.failureCount ?? 0,
    lastFailureAt: row.lastFailureAt ?? null,
    disabledAt: row.disabledAt ?? null,
    priority: row.priority,
    lastUsedAt: row.lastUsedAt,
    exhaustedAt: row.exhaustedAt,
    createdAt: row.createdAt,
  };
}

export class ProviderKeyManager {
  private static async getProviderConfigFallbackKey(providerName: string): Promise<{ key: string; keyId: string } | null> {
    const provider = await prisma.providerConfig.findUnique({
      where: { provider: providerName },
    });

    if (!provider?.isActive || !provider.apiKey) return null;

    try {
      const key = isEncrypted(provider.apiKey) ? decryptFromStorage(provider.apiKey) : provider.apiKey;
      if (key?.trim()) {
        return { key: key.trim(), keyId: '__fallback__' };
      }
    } catch (err) {
      logger.error(`[ProviderKeyManager] ${providerName} ProviderConfig.apiKey 解密失败: ${err instanceof Error ? err.message : String(err)}`);
    }

    return null;
  }

  private static async getRoundRobinStartIndex(providerName: string, keyCount: number): Promise<number> {
    if (keyCount <= 1) return 0;

    const counterKey = `provider-key-manager:rr:${providerName}`;
    const next = await redisService.incrWithExpiry(counterKey, 30 * 24 * 60 * 60);
    if (next > 0) {
      return (next - 1) % keyCount;
    }

    logger.warn(`[ProviderKeyManager] Redis 轮询计数不可用，${providerName} 临时使用随机秘钥起点`);
    return Math.floor(Math.random() * keyCount);
  }

  private static resolveModelScopes(providerName: string, model: string): string[] {
    const scopes = new Set<string>();
    const normalizedProvider = providerName.toLowerCase();
    const normalizedModel = model.toLowerCase();

    // agnes 独立 provider：所有模型都走 agnes-generative 密钥池
    if (normalizedProvider === 'agnes') {
      return ['agnes-generative'];
    }

    // 同时保留原始大小写和小写，确保数据库查询能匹配
    scopes.add(model);
    if (normalizedModel !== model) {
      scopes.add(normalizedModel);
    }

    // 兼容旧前端仍在传的 Vidu 模型别名，确保能命中当前实际启用的 key 池。
    if (normalizedProvider === 'vidu') {
      if (normalizedModel === 'viduq2') {
        scopes.add('viduq2-turbo');
      } else if (normalizedModel === 'viduq2-turbo') {
        scopes.add('viduq2');
      }
    }

    if (normalizedProvider === 'wuyinkeji') {
      if (normalizedModel === 'wan2.7_image' || normalizedModel === 'wan2.7-image') {
        scopes.add('Wan2.6');
        scopes.add('wan2.6');
      } else if (normalizedModel === 'wan2.6') {
        scopes.add('Wan2.7_image');
        scopes.add('wan2.7_image');
      }
    }

    if (normalizedProvider === 'zxteams') {
      // zxteams provider: scope mapping handled elsewhere
    }

    return [...scopes];
  }

  static async getKeysForProvider(providerName: string): Promise<ProviderKeyInfo[]> {
    const keys = await prisma.providerApiKey.findMany({
      where: { providerName },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    return keys.map(toKeyInfo);
  }

  static async addKey(input: AddKeyInput): Promise<ProviderKeyInfo> {
    const count = await prisma.providerApiKey.count({
      where: { providerName: input.providerName },
    });

    if (count >= getMaxKeysForProvider(input.providerName)) {
      throw new Error(`服务商 ${input.providerName} 最多添加 ${getMaxKeysForProvider(input.providerName)} 个秘钥`);
    }

    const existing = await prisma.providerApiKey.findUnique({
      where: {
        providerName_keyLabel: {
          providerName: input.providerName,
          keyLabel: input.keyLabel,
        },
      },
    });

    if (existing) {
      throw new Error(`标签 "${input.keyLabel}" 已存在`);
    }

    const provider = await prisma.providerConfig.findUnique({
      where: { provider: input.providerName },
    });

    if (!provider) {
      throw new Error(`服务商 "${input.providerName}" 不存在`);
    }

    const encryptedKey = encryptForStorage(input.apiKey);
    const quotaTotal = input.quotaTotal || 0;

    const key = await prisma.providerApiKey.create({
      data: {
        providerName: input.providerName,
        keyLabel: input.keyLabel,
        encryptedKey,
        modelScope: input.modelScope ?? null,
        weight: input.weight ?? 1,
        maxConcurrency: Math.max(1, input.maxConcurrency ?? 1),
        quotaTotal,
        quotaRemaining: quotaTotal,
        priority: input.priority ?? count,
        isActive: true,
        isExhausted: false,
        failureCount: 0,
      },
    });

    logger.info(`[ProviderKeyManager] 添加秘钥: ${input.providerName}/${input.keyLabel}`);
    return toKeyInfo(key);
  }

  static async updateKey(keyId: string, input: UpdateKeyInput): Promise<ProviderKeyInfo> {
    const existing = await prisma.providerApiKey.findUnique({ where: { id: keyId } });
    if (!existing) throw new Error('秘钥不存在');

    const updateData: any = {};

    if (input.keyLabel !== undefined) updateData.keyLabel = input.keyLabel;
    if (input.apiKey !== undefined) {
      updateData.encryptedKey = encryptForStorage(input.apiKey);
      // 秘钥已更新，清除不可解密标记，允许后续重新尝试
      undecryptableKeyIds.delete(keyId);
      undecryptableLogged.delete(keyId);
    }
    if (input.modelScope !== undefined) updateData.modelScope = input.modelScope;
    if (input.weight !== undefined) updateData.weight = Math.max(1, input.weight);
    if (input.maxConcurrency !== undefined) updateData.maxConcurrency = Math.max(1, input.maxConcurrency);
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
      if (input.isActive) {
        updateData.disabledAt = null;
        updateData.failureCount = 0;
      }
    }

    if (input.quotaTotal !== undefined) {
      updateData.quotaTotal = input.quotaTotal;
      const used = input.quotaUsed ?? existing.quotaUsed;
      updateData.quotaRemaining = Math.max(0, input.quotaTotal - used);
      updateData.isExhausted = updateData.quotaRemaining <= 0;
      if (updateData.isExhausted && !existing.isExhausted) {
        updateData.exhaustedAt = new Date();
      }
    }

    if (input.quotaUsed !== undefined) {
      updateData.quotaUsed = input.quotaUsed;
      const total = input.quotaTotal ?? existing.quotaTotal;
      updateData.quotaRemaining = Math.max(0, total - input.quotaUsed);
      updateData.isExhausted = updateData.quotaRemaining <= 0;
      if (updateData.isExhausted && !existing.isExhausted) {
        updateData.exhaustedAt = new Date();
      }
    }

    const key = await prisma.providerApiKey.update({
      where: { id: keyId },
      data: updateData,
    });

    logger.info(`[ProviderKeyManager] 更新秘钥: ${existing.providerName}/${existing.keyLabel}`);
    return toKeyInfo(key);
  }

  static async deleteKey(keyId: string): Promise<void> {
    const existing = await prisma.providerApiKey.findUnique({ where: { id: keyId } });
    if (!existing) throw new Error('秘钥不存在');

    await prisma.providerApiKey.delete({ where: { id: keyId } });
    logger.info(`[ProviderKeyManager] 删除秘钥: ${existing.providerName}/${existing.keyLabel}`);
  }

  static async reorderKeys(providerName: string, keyIds: string[]): Promise<ProviderKeyInfo[]> {
    const existing = await prisma.providerApiKey.findMany({
      where: { providerName },
    });
    const existingIds = new Set(existing.map(k => k.id));
    for (const kid of keyIds) {
      if (!existingIds.has(kid)) {
        throw new Error(`秘钥 ${kid} 不属于服务商 ${providerName}`);
      }
    }

    const txOps = keyIds.map((kid, idx) =>
      prisma.providerApiKey.update({
        where: { id: kid },
        data: { priority: idx },
      })
    );
    await prisma.$transaction(txOps);

    logger.info(`[ProviderKeyManager] 重排秘钥顺序: ${providerName} (${keyIds.length} 个)`);
    return ProviderKeyManager.getKeysForProvider(providerName);
  }

  static async moveKey(keyId: string, direction: 'up' | 'down'): Promise<ProviderKeyInfo[]> {
    const target = await prisma.providerApiKey.findUnique({ where: { id: keyId } });
    if (!target) throw new Error('秘钥不存在');

    const allKeys = await prisma.providerApiKey.findMany({
      where: { providerName: target.providerName },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    const currentIdx = allKeys.findIndex(k => k.id === keyId);
    if (currentIdx < 0) throw new Error('秘钥不在列表中');

    const swapIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
    if (swapIdx < 0 || swapIdx >= allKeys.length) {
      return ProviderKeyManager.getKeysForProvider(target.providerName);
    }

    const swapTarget = allKeys[swapIdx];

    await prisma.$transaction([
      prisma.providerApiKey.update({
        where: { id: keyId },
        data: { priority: swapTarget.priority },
      }),
      prisma.providerApiKey.update({
        where: { id: swapTarget.id },
        data: { priority: target.priority },
      }),
    ]);

    logger.info(`[ProviderKeyManager] 秘钥 ${target.keyLabel} ${direction === 'up' ? '上移' : '下移'}`);
    return ProviderKeyManager.getKeysForProvider(target.providerName);
  }

  static async getActiveKey(providerName: string): Promise<{ key: string; keyId: string } | null> {
    await ProviderKeyManager.recoverCooledKeys(providerName);

    const allActiveKeys = await prisma.providerApiKey.findMany({
      where: {
        providerName,
        isActive: true,
        isExhausted: false,
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    if (allActiveKeys.length === 0) {
      return ProviderKeyManager.getProviderConfigFallbackKey(providerName);
    }

    const startIdx = await ProviderKeyManager.getRoundRobinStartIndex(providerName, allActiveKeys.length);

    for (let i = 0; i < allActiveKeys.length; i++) {
      const idx = (startIdx + i) % allActiveKeys.length;
      const candidate = allActiveKeys[idx];

      if (candidate.failureCount >= MAX_FAILURES_BEFORE_DISABLE) {
        const timeSinceFailure = candidate.lastFailureAt
          ? Date.now() - new Date(candidate.lastFailureAt).getTime()
          : Infinity;
        if (timeSinceFailure < FAILURE_COOLDOWN_MS) continue;
      }

      try {
        const decrypted = decryptFromStorage(candidate.encryptedKey);
        if (decrypted && !decrypted.includes(':')) {
          return { key: decrypted, keyId: candidate.id };
        }
        logger.error(`[ProviderKeyManager] ${providerName}/${candidate.keyLabel} 解密结果格式异常，跳过`);
      } catch (err) {
        logger.error(`[ProviderKeyManager] ${providerName}/${candidate.keyLabel} 解密失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    logger.warn(`[ProviderKeyManager] ${providerName} 所有秘钥均不可用，尝试使用 ProviderConfig/env 后备密钥`);
    return ProviderKeyManager.getProviderConfigFallbackKey(providerName);
  }

  static async getKeyById(keyId: string): Promise<{ key: string; keyId: string; providerName: string; modelScope: string | null; weight: number; maxConcurrency: number } | null> {
    const row = await prisma.providerApiKey.findUnique({ where: { id: keyId } });
    if (!row) return null;

    try {
      const decrypted = decryptFromStorage(row.encryptedKey);
      if (decrypted && !decrypted.includes(':')) {
        return {
          key: decrypted,
          keyId: row.id,
          providerName: row.providerName,
          modelScope: row.modelScope ?? null,
          weight: row.weight ?? 1,
          maxConcurrency: row.maxConcurrency ?? 1,
        };
      }
      logger.error(`[ProviderKeyManager] getKeyById ${row.id} 解密结果格式异常`);
    } catch (err) {
      logger.error(`[ProviderKeyManager] getKeyById ${row.id} 解密失败: ${err instanceof Error ? err.message : String(err)}`);
    }
    return null;
  }

  static async getActiveKeysForModel(providerName: string, model: string): Promise<Array<{ id: string; providerName: string; keyLabel: string; apiKey: string; priority: number; weight: number; maxConcurrency: number; modelScope: string | null }>> {
    await ProviderKeyManager.recoverCooledKeys(providerName);
    const modelScopes = ProviderKeyManager.resolveModelScopes(providerName, model);
    const strictModelScopedPool = providerName.toLowerCase() === 'agnes';

    const rows = await prisma.providerApiKey.findMany({
      where: {
        providerName,
        isActive: true,
        isExhausted: false,
        OR: strictModelScopedPool
          ? modelScopes.map((scope) => ({ modelScope: scope }))
          : [
              { modelScope: null },
              { modelScope: '' },
              ...modelScopes.map((scope) => ({ modelScope: scope })),
            ],
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    const keys = rows.flatMap((row) => {
      if (undecryptableKeyIds.has(row.id)) {
        return [];
      }
      let apiKey = '';
      try {
        const decrypted = decryptFromStorage(row.encryptedKey);
        if (decrypted && !decrypted.includes(':')) {
          apiKey = decrypted;
        } else {
          undecryptableKeyIds.add(row.id);
          if (!undecryptableLogged.has(row.id)) {
            logger.error(`[ProviderKeyManager] ${row.providerName}/${row.keyLabel} 解密结果格式异常，已标记跳过（后续不再尝试）`);
            undecryptableLogged.add(row.id);
          }
        }
      } catch (err) {
        undecryptableKeyIds.add(row.id);
        if (!undecryptableLogged.has(row.id)) {
          logger.error(`[ProviderKeyManager] ${row.providerName}/${row.keyLabel} 解密失败，已标记跳过（后续不再尝试）: ${err instanceof Error ? err.message : String(err)}`);
          undecryptableLogged.add(row.id);
        }
      }

      if (!apiKey) return [];

      return [{
        id: row.id,
        providerName: row.providerName,
        keyLabel: row.keyLabel,
        apiKey,
        priority: row.priority,
        weight: row.weight ?? 1,
        maxConcurrency: row.maxConcurrency ?? 1,
        modelScope: row.modelScope ?? null,
      }];
    });

    if (keys.length > 0) return keys;

    const fallback = await ProviderKeyManager.getProviderConfigFallbackKey(providerName);
    if (!fallback?.key) return [];

    return [{
      id: fallback.keyId,
      providerName,
      keyLabel: 'ProviderConfig/env',
      apiKey: fallback.key,
      priority: Number.MAX_SAFE_INTEGER,
      weight: 1,
      maxConcurrency: 5,
      modelScope: null,
    }];
  }

  static async getRoundRobinIndex(poolName: string, itemCount: number): Promise<number> {
    return ProviderKeyManager.getRoundRobinStartIndex(poolName, itemCount);
  }

  static async getBalancedActiveKeysForModel(
    providerName: string,
    model: string
  ): Promise<Array<{ id: string; providerName: string; keyLabel: string; apiKey: string; priority: number; weight: number; maxConcurrency: number; modelScope: string | null }>> {
    const keys = await ProviderKeyManager.getActiveKeysForModel(providerName, model);
    if (keys.length <= 1) return keys;
    const start = await ProviderKeyManager.getRoundRobinStartIndex(
      `${providerName}:${model}`,
      keys.length
    );
    return [...keys.slice(start), ...keys.slice(0, start)];
  }

  static async reportSuccess(providerName: string, keyId: string): Promise<void> {
    if (keyId === '__fallback__') return;

    try {
      const key = await prisma.providerApiKey.findUnique({ where: { id: keyId } });
      if (!key) return;

      const newFailureCount = Math.max(0, key.failureCount - 1);
      await prisma.providerApiKey.update({
        where: { id: keyId },
        data: {
          failureCount: newFailureCount,
          lastUsedAt: new Date(),
        },
      });
    } catch (err: unknown) {
      logger.error(`[ProviderKeyManager] reportSuccess 失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  static async reportFailure(providerName: string, keyId: string, reason?: string): Promise<void> {
    if (keyId === '__fallback__') return;

    try {
      const key = await prisma.providerApiKey.findUnique({ where: { id: keyId } });
      if (!key) return;

      const newFailureCount = key.failureCount + 1;
      const shouldDisable = newFailureCount >= MAX_FAILURES_BEFORE_DISABLE;

      await prisma.providerApiKey.update({
        where: { id: keyId },
        data: {
          failureCount: newFailureCount,
          lastFailureAt: new Date(),
          lastUsedAt: new Date(),
          isActive: shouldDisable ? false : key.isActive,
          disabledAt: shouldDisable ? new Date() : key.disabledAt,
        },
      });

      if (shouldDisable) {
        logger.warn(`[ProviderKeyManager] 秘钥 ${providerName}/${key.keyLabel} 连续失败 ${newFailureCount} 次，已自动禁用${reason ? ` (${reason})` : ''}`);
      } else {
        logger.info(`[ProviderKeyManager] 秘钥 ${providerName}/${key.keyLabel} 失败 ${newFailureCount}/${MAX_FAILURES_BEFORE_DISABLE}${reason ? ` (${reason})` : ''}`);
      }
    } catch (err: unknown) {
      logger.error(`[ProviderKeyManager] reportFailure 失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  static async markKeyExhausted(providerName: string, keyId: string, reason?: string): Promise<void> {
    if (keyId === '__fallback__') return;

    try {
      const key = await prisma.providerApiKey.findUnique({ where: { id: keyId } });
      if (!key) return;

      await prisma.providerApiKey.update({
        where: { id: keyId },
        data: {
          isExhausted: true,
          exhaustedAt: new Date(),
          isActive: false,
        },
      });

      logger.warn(`[ProviderKeyManager] 秘钥 ${providerName}/${key.keyLabel} 已耗尽${reason ? ` (${reason})` : ''}`);
    } catch (err: unknown) {
      logger.error(`[ProviderKeyManager] markKeyExhausted 失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  static extractKeyIdFromResult(result: any, providerName: string): string | null {
    const keyId = result?.keyId;
    if (keyId && keyId !== '__fallback__') return keyId;

    return null;
  }

  private static async recoverCooledKeys(providerName: string): Promise<void> {
    const disabledKeys = await prisma.providerApiKey.findMany({
      where: {
        providerName,
        isActive: false,
        isExhausted: false,
        disabledAt: { not: null },
      },
    });

    for (const key of disabledKeys) {
      if (!key.disabledAt) continue;
      const disabledDuration = Date.now() - new Date(key.disabledAt).getTime();
      if (disabledDuration >= FAILURE_COOLDOWN_MS) {
        await prisma.providerApiKey.update({
          where: { id: key.id },
          data: {
            isActive: true,
            failureCount: 0,
            disabledAt: null,
          },
        });
        logger.info(`[ProviderKeyManager] 秘钥 ${providerName}/${key.keyLabel} 冷却完成，自动恢复`);
      }
    }
  }

  static async recordUsage(providerName: string, cost: number = 1, keyId?: string | null): Promise<void> {
    if (keyId && keyId !== '__fallback__') {
      const key = await prisma.providerApiKey.findUnique({ where: { id: keyId } });
      if (!key || key.providerName !== providerName) return;
      await ProviderKeyManager.updateKeyQuota(key, cost);
      return;
    }

    const key = await prisma.providerApiKey.findFirst({
      where: { providerName, isActive: true, isExhausted: false },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    if (!key) return;
    await ProviderKeyManager.updateKeyQuota(key, cost);
  }

  private static async updateKeyQuota(key: any, cost: number): Promise<void> {
    const newUsed = key.quotaUsed + cost;
    const newRemaining = Math.max(0, key.quotaTotal - newUsed);
    const isExhausted = key.quotaTotal > 0 && newRemaining <= 0;

    await prisma.providerApiKey.update({
      where: { id: key.id },
      data: {
        quotaUsed: newUsed,
        quotaRemaining: newRemaining,
        isExhausted,
        lastUsedAt: new Date(),
        exhaustedAt: isExhausted && !key.isExhausted ? new Date() : undefined,
      },
    });

    if (isExhausted && !key.isExhausted) {
      logger.warn(`[ProviderKeyManager] 秘钥额度耗尽: ${key.providerName}/${key.keyLabel}，自动切换到下一个秘钥`);
    }
  }

  static async getKeyStats(providerName: string): Promise<{
    totalKeys: number;
    activeKeys: number;
    exhaustedKeys: number;
    disabledKeys: number;
    totalQuota: number;
    usedQuota: number;
    remainingQuota: number;
  }> {
    const keys = await prisma.providerApiKey.findMany({
      where: { providerName },
    });

    return {
      totalKeys: keys.length,
      activeKeys: keys.filter(k => k.isActive && !k.isExhausted).length,
      exhaustedKeys: keys.filter(k => k.isExhausted).length,
      disabledKeys: keys.filter(k => !k.isActive && !k.isExhausted).length,
      totalQuota: keys.reduce((sum, k) => sum + k.quotaTotal, 0),
      usedQuota: keys.reduce((sum, k) => sum + k.quotaUsed, 0),
      remainingQuota: keys.reduce((sum, k) => sum + k.quotaRemaining, 0),
    };
  }

  static async resetKeyQuota(keyId: string, newQuotaTotal?: number): Promise<ProviderKeyInfo> {
    const existing = await prisma.providerApiKey.findUnique({ where: { id: keyId } });
    if (!existing) throw new Error('秘钥不存在');

    const quotaTotal = newQuotaTotal ?? existing.quotaTotal;
    const key = await prisma.providerApiKey.update({
      where: { id: keyId },
      data: {
        quotaTotal,
        quotaUsed: 0,
        quotaRemaining: quotaTotal,
        isExhausted: false,
        exhaustedAt: null,
        isActive: true,
        failureCount: 0,
        disabledAt: null,
      },
    });

    logger.info(`[ProviderKeyManager] 重置秘钥额度: ${existing.providerName}/${existing.keyLabel}`);
    return toKeyInfo(key);
  }

  static async batchImport(
    providerName: string,
    keys: string[],
    quotaPerKey: number = 30,
    defaults?: {
      modelScope?: string | null;
      weight?: number;
      maxConcurrency?: number;
    }
  ): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    const provider = await prisma.providerConfig.findUnique({ where: { provider: providerName } });
    if (!provider) throw new Error(`服务商 "${providerName}" 不存在`);

    const maxKeys = getMaxKeysForProvider(providerName);
    const currentCount = await prisma.providerApiKey.count({ where: { providerName } });
    const remaining = maxKeys - currentCount;

    const existingKeys = await prisma.providerApiKey.findMany({
      where: { providerName },
      select: { encryptedKey: true },
    });
    const existingDecrypted = new Set(
      existingKeys.map(k => { try { return decryptFromStorage(k.encryptedKey); } catch { return k.encryptedKey; } })
    );

    const results = { imported: 0, skipped: 0, errors: [] as string[] };

    for (let i = 0; i < keys.length; i++) {
      const rawKey = keys[i].trim();
      if (!rawKey) continue;

      if (results.imported >= remaining) {
        results.errors.push(`已达上限 ${maxKeys}，剩余 ${keys.length - i} 个未导入`);
        break;
      }

      if (existingDecrypted.has(rawKey)) {
        results.skipped++;
        continue;
      }

      try {
        const encryptedKey = encryptForStorage(rawKey);
        const label = `batch-${Date.now()}-${i + 1}`;
        await prisma.providerApiKey.create({
          data: {
            providerName,
            keyLabel: label,
            encryptedKey,
            modelScope: defaults?.modelScope ?? null,
            weight: Math.max(1, defaults?.weight ?? 1),
            maxConcurrency: Math.max(1, defaults?.maxConcurrency ?? 1),
            quotaTotal: quotaPerKey,
            quotaRemaining: quotaPerKey,
            priority: currentCount + results.imported,
            isActive: true,
            isExhausted: false,
            failureCount: 0,
          },
        });
        existingDecrypted.add(rawKey);
        results.imported++;
      } catch (err: unknown) {
        results.errors.push(`第 ${i + 1} 个秘钥导入失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    logger.info(`[ProviderKeyManager] 批量导入: ${providerName}, 成功=${results.imported}, 跳过=${results.skipped}, 失败=${results.errors.length}`);
    return results;
  }
}
