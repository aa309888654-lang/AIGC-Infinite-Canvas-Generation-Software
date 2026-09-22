import prisma from '../lib/prisma';
import { encryptForStorage } from '../utils/encryption';
import logger from '../utils/logger';
// 已废弃 (2026-07-18): xunfei provider 同步逻辑已移除，不再需要 resolveXunfeiSparkApiKey / XUNFEI_SPARK_X15_BASE_URL
import { isLocalOnlyMode } from '../utils/local-mode';

interface EnvProviderMapping {
  provider: string;
  envKeys: string[];
  endpoint: string;
  displayName: string;
  keyOptions?: (entry: { envName: string; value: string }, index: number) => {
    modelScope?: string | null;
    weight?: number;
    maxConcurrency?: number;
    priority?: number;
  };
}

const WUYIN_API_ENV_KEYS = [
  'WUYIN_API_KEY',
  ...Array.from({ length: 7 }, (_, index) => `WUYIN_API_KEY_${index + 2}`),
];

const ENV_PROVIDER_MAPPINGS: EnvProviderMapping[] = [
  {
    provider: 'doubao',
    envKeys: ['ARK_API_KEY', 'DOUBAO_API_KEY', 'DOUBAO_VIDEO_KEY'],
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3',
    displayName: '豆包/Seedance',
  },
  {
    provider: 'vidu',
    envKeys: ['VIDU_API_KEY'],
    endpoint: 'https://api.vidu.cn',
    displayName: 'Vidu',
  },
  {
    provider: 'jimeng',
    envKeys: ['JIMENG_API_KEY', 'DOUBAO_IMAGE_KEY'],
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3',
    displayName: '即梦 (Jimeng)',
  },
  {
    provider: 'seedream',
    envKeys: ['DOUBAO_IMAGE_KEY', 'ARK_API_KEY', 'DOUBAO_API_KEY'],
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3',
    displayName: 'Seedream (豆包图片/视频)',
  },
  {
    provider: 'wuyinkeji',
    envKeys: WUYIN_API_ENV_KEYS,
    endpoint: process.env.WUYIN_BASE_URL || 'https://api.wuyinkeji.com',
    displayName: '小天API (小天AICG2)',
    keyOptions: () => ({
      modelScope: null,
      maxConcurrency: 5,
    }),
  },
  {
    provider: 'deepseek',
    envKeys: ['DEEPSEEK_API_KEY'],
    endpoint: 'https://api.deepseek.com/v1',
    displayName: 'DeepSeek',
  },
  {
    provider: 'volcano',
    envKeys: ['VOLCANO_API_KEY', 'VOLCANO_ARK_API_KEY'],
    endpoint: 'https://ark.cn-beijing.volces.com/api/coding/v3',
    displayName: '火山引擎 Volcano',
  },
  // 已废弃 (2026-07-18): xunfei provider 文字通道已下线，不再同步密钥到数据库
  {
    provider: 'sensenova',
    envKeys: ['SENSENOVA_API_KEY', 'SENSENOVA_API_KEY_2'],
    endpoint: process.env.SENSENOVA_BASE_URL || 'https://token.sensenova.cn/v1',
    displayName: 'SenseNova',
  },
  {
    provider: 'stepfun',
    envKeys: ['STEPFUN_API_KEY', 'STEPFUN_API_KEY_2', 'STEPFUN_API_KEY_3'],
    endpoint: process.env.STEPFUN_BASE_URL || 'https://api.stepfun.com/step_plan/v1',
    displayName: 'StepFun',
  },
  {
    provider: 'minimax',
    envKeys: ['MINIMAX_API_KEY', 'MINIMAX_API_KEY_2'],
    endpoint: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com',
    displayName: 'MiniMax',
  },
];

function resolveAllEnvKeys(envKeys: string[]): Array<{ envName: string; value: string }> {
  const resolved: Array<{ envName: string; value: string }> = [];
  const seen = new Set<string>();
  // 已废弃 (2026-07-18): xunfei spark mapping 特殊处理已移除（provider 同步逻辑已下线）

  for (const envName of envKeys) {
    const value = process.env[envName]?.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    resolved.push({ envName, value });
  }

  return resolved;
}

function resolveEnvKey(envKeys: string[]): string | null {
  return resolveAllEnvKeys(envKeys)[0]?.value ?? null;
}

export async function syncProviderKeysFromEnv(): Promise<void> {
  if (isLocalOnlyMode()) {
    logger.info('[ProviderSync] 本地模式：跳过环境变量密钥同步和健康检查');
    return;
  }

  let synced = 0;
  let skipped = 0;

  for (const mapping of ENV_PROVIDER_MAPPINGS) {
    const envKeyEntries = resolveAllEnvKeys(mapping.envKeys);
    const apiKey = envKeyEntries[0]?.value;
    if (!apiKey) {
      logger.debug(`[ProviderSync] ${mapping.provider}: 环境变量未配置，跳过`);
      skipped++;
      continue;
    }

    try {
      const encryptedPrimary = encryptForStorage(apiKey);
      logger.info(`[ProviderSync] ${mapping.provider}: 正在同步环境变量密钥 (${envKeyEntries.length} 个)`);

      const existing = await prisma.providerConfig.findUnique({
        where: { provider: mapping.provider },
      });

      if (existing) {
        await prisma.providerConfig.update({
          where: { provider: mapping.provider },
          data: {
            apiKey: encryptedPrimary,
            endpoint: mapping.endpoint,
            displayName: mapping.displayName,
            isActive: true,
          },
        });
        logger.info(`[ProviderSync] ${mapping.provider}: 已从环境变量同步密钥并激活`);
      } else {
        await prisma.providerConfig.create({
          data: {
            provider: mapping.provider,
            name: mapping.provider,
            displayName: mapping.displayName,
            apiKey: encryptedPrimary,
            endpoint: mapping.endpoint,
            isActive: true,
          },
        });
        logger.info(`[ProviderSync] ${mapping.provider}: 已创建并绑定环境变量密钥`);
      }

      // 生成当前同步会使用的所有 keyLabel，用于后续清理孤立旧标签
      const currentLabels = new Set<string>();
      for (const [index, entry] of envKeyEntries.entries()) {
        currentLabels.add(index === 0 ? 'env-default' : `env-${entry.envName.toLowerCase()}`);
      }

      for (const [index, entry] of envKeyEntries.entries()) {
        const keyLabel = index === 0 ? 'env-default' : `env-${entry.envName.toLowerCase()}`;
        const encryptedKey = encryptForStorage(entry.value);
        const keyOptions = mapping.keyOptions?.(entry, index) ?? {};
        const modelScope = keyOptions.modelScope ?? null;
        const weight = Math.max(1, keyOptions.weight ?? 1);
        const maxConcurrency = Math.max(1, keyOptions.maxConcurrency ?? 5);
        const priority = keyOptions.priority ?? index;

        await prisma.providerApiKey.upsert({
          where: {
            providerName_keyLabel: {
              providerName: mapping.provider,
              keyLabel,
            },
          },
          update: {
            encryptedKey,
            modelScope,
            weight,
            maxConcurrency,
            quotaTotal: 0,
            quotaUsed: 0,
            quotaRemaining: 0,
            priority,
            isActive: true,
            isExhausted: false,
            failureCount: 0,
            lastFailureAt: null,
            disabledAt: null,
            exhaustedAt: null,
          },
          create: {
            providerName: mapping.provider,
            keyLabel,
            encryptedKey,
            modelScope,
            weight,
            maxConcurrency,
            quotaTotal: 0,
            quotaUsed: 0,
            quotaRemaining: 0,
            priority,
            isActive: true,
            isExhausted: false,
            failureCount: 0,
          },
        });
        logger.info(`[ProviderSync] ${mapping.provider}: ${keyLabel} 秘钥已同步到 key pool`);
      }

      // 清理孤立的旧标签 env-* 秘钥（如旧版本生成的 env-1, env-2 等）
      // 只清理以 "env-" 开头但不在当前标签集合中的记录，避免删除手动添加的秘钥
      const orphanKeys = await prisma.providerApiKey.findMany({
        where: {
          providerName: mapping.provider,
          keyLabel: { startsWith: 'env-' },
          NOT: { keyLabel: { in: [...currentLabels] } },
        },
        select: { id: true, keyLabel: true },
      });

      if (orphanKeys.length > 0) {
        await prisma.providerApiKey.deleteMany({
          where: { id: { in: orphanKeys.map(k => k.id) } },
        });
        logger.info(`[ProviderSync] ${mapping.provider}: 清理 ${orphanKeys.length} 个孤立旧标签秘钥 (${orphanKeys.map(k => k.keyLabel).join(', ')})`);
      }

      synced++;
    } catch (error: unknown) {
      logger.error(`[ProviderSync] ${mapping.provider}: 同步失败 - ${(error instanceof Error ? error.message : String(error))}`);
    }
  }

  logger.info(`[ProviderSync] 完成: ${synced} 个已同步, ${skipped} 个已跳过`);

  // —— 加固：同步后密钥健康检查 ——
  // 防止因 .env 配置错误（如 key 重复、key 缺失）导致线上服务不可用
  await validateProviderKeyHealth();
}

/**
 * 同步后密钥健康检查：
 * 1. 检查同一 provider 的多个 key 是否重复（去重检查）
 * 2. 检查期望的 key 数量与实际数量是否匹配
 * 3. 记录每个活跃 provider 的非敏感配置状态，便于排查
 */
async function validateProviderKeyHealth(): Promise<void> {
  const { decryptFromStorage } = await import('../utils/encryption');
  for (const mapping of ENV_PROVIDER_MAPPINGS) {
    try {
      const keys = await prisma.providerApiKey.findMany({
        where: { providerName: mapping.provider, isActive: true },
        select: { keyLabel: true, encryptedKey: true, modelScope: true },
      });

      if (keys.length === 0) {
        logger.warn(`[ProviderSync] ⚠️ 健康检查: ${mapping.provider} 没有活跃密钥！期望 ${mapping.envKeys.length} 个`);
        continue;
      }

      // 去重检查：检测是否有重复密钥
      const seenKeys = new Map<string, string>(); // decryptedKey -> keyLabel
      for (const k of keys) {
        let decKey = k.encryptedKey;
        try {
          decKey = decryptFromStorage(k.encryptedKey);
        } catch { /* 解密失败则用原始值比较 */ }

        if (seenKeys.has(decKey)) {
          logger.error(
            `[ProviderSync] 🚨 健康检查告警: ${mapping.provider} 的 ${k.keyLabel} 与 ${seenKeys.get(decKey)} 密钥重复！` +
            `请检查 .env 文件中 ${mapping.envKeys.join(', ')} 的值是否配置正确。`
          );
        } else {
          seenKeys.set(decKey, k.keyLabel);
        }
      }

      // 数量检查
      const expectedCount = mapping.envKeys.length;
      const actualCount = seenKeys.size; // 去重后的数量
      if (actualCount < expectedCount) {
        logger.warn(
          `[ProviderSync] ⚠️ 健康检查: ${mapping.provider} 期望 ${expectedCount} 个不重复密钥，实际只有 ${actualCount} 个。` +
          `缺失的密钥可能影响服务可用性。`
        );
      }

      // 日志可能被集中采集或长期保留，不能记录任何密钥片段、长度或派生摘要。
      // 标签和数量足以支持运行排障，实际密钥仅保留在受控存储中。
      logger.info(
        `[ProviderSync] 健康检查: ${mapping.provider} 活跃密钥=${actualCount}/${expectedCount}，` +
        `标签=${keys.map((key) => key.keyLabel).join(', ')}`
      );
    } catch (error: unknown) {
      logger.warn(`[ProviderSync] 健康检查失败: ${mapping.provider} - ${(error instanceof Error ? error.message : String(error))}`);
    }
  }
}
