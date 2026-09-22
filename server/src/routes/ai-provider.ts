import { Router } from 'express';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';
import { authenticate, optionalAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { parsePaginationParamsWithNumbers } from '../utils/pagination';
import { decryptFromStorage, encryptForStorage, isEncrypted, maskApiKey } from '../utils/encryption';
import {
  type MembershipLevel,
  isProviderAllowedForMembership,
  isModelAllowedForMembership,
} from './ai-provider-membership';
import { ProviderKeyManager } from '../services/provider-key-manager';
import { WUYINKEJI_AI_VIDEO_MODELS } from '../services/wuyinkeji-provider';
import promptSmart3ProviderConfigs from '../services/promptSmart3/providers.json';
import { getChannelMetadata, type ModelMediaType } from '../services/model-channel-registry';
import { removeUserModelCredential } from '../services/user-model-credential-service';
import { fetchSafeRemoteResponse } from '../utils/safe-remote-fetch';
import { resolveSensenovaApiKey, resolveApipathsApiKey, resolveZhipuApiKey } from '../utils/provider-env-keys';
import {
  asyncHandler,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../middleware/errorHandler';

export const aiProviderRouter = Router();

function getDisplayEndpoint(provider: string, endpoint?: string | null): string | null {
  return endpoint || null;
}

function sanitizeProviderConfig(provider: string, config: unknown): unknown {
  if (!config || typeof config !== 'object') return config;
  const next = { ...(config as Record<string, unknown>) };
  if (typeof next.baseUrl === 'string') {
    next.baseUrl = getDisplayEndpoint(provider, next.baseUrl);
  }
  return next;
}

function sanitizeProviderEndpointPayload<T extends { provider?: string; endpoint?: string | null; config?: unknown }>(payload: T): T {
  const provider = payload.provider || '';
  return {
    ...payload,
    endpoint: getDisplayEndpoint(provider, payload.endpoint),
    config: sanitizeProviderConfig(provider, payload.config),
  };
}

async function getMembershipLevelForUser(_userId?: string): Promise<MembershipLevel> {
  // 会员系统已移除：所有用户视为最高权限（enterprise），AI 提供商与模型不再受限。
  // 会员门控函数（isProviderAllowedForMembership / isModelAllowedForMembership）已为空实现，始终放行。
  return 'enterprise';
}

function getCredentialEnvFallback(): Record<string, { apiKey: string; apiSecret: string | null; endpoint: string | null }> {
  const result: Record<string, { apiKey: string; apiSecret: string | null; endpoint: string | null }> = {};

  const minimaxKey = process.env.MINIMAX_API_KEY;
  if (minimaxKey) {
    result.minimax = { apiKey: minimaxKey, apiSecret: null, endpoint: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com' };
  }

  const jimengKey = process.env.JIMENG_API_KEY || process.env.DOUBAO_IMAGE_KEY;
  if (jimengKey) {
    result.jimeng = { apiKey: jimengKey, apiSecret: null, endpoint: null };
  }

  const wuyinKey = process.env.WUYIN_API_KEY;
  if (wuyinKey) {
    result['wuyinkeji'] = { apiKey: wuyinKey, apiSecret: null, endpoint: 'https://api.wuyinkeji.com' };
  }

  const apipathsKey = resolveApipathsApiKey();
  if (apipathsKey) {
    // 已删除 (2026-07-20): 国外 apipaths (GPT) provider 入口已下线
    // APIPATHS_API_KEY 仍保留为 apipaths-kimi-k3 / apipaths-glm-5.1 的兜底密钥
    // 此处不再注册 'apipaths' provider 入口
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    result['deepseek'] = { apiKey: deepseekKey, apiSecret: null, endpoint: 'https://api.deepseek.com/v1' };
  }

  const baiduKey = process.env.BAIDU_API_KEY;
  if (baiduKey) {
    result['baidu'] = { apiKey: baiduKey, apiSecret: process.env.BAIDU_SECRET_KEY || null, endpoint: null };
  }

  const sensenovaKey = resolveSensenovaApiKey();
  if (sensenovaKey) {
    result['sensenova'] = { apiKey: sensenovaKey, apiSecret: null, endpoint: process.env.SENSENOVA_BASE_URL || 'https://token.sensenova.cn/v1' };
  }

  const stepfunKey = process.env.STEPFUN_API_KEY;
  if (stepfunKey) {
    result['stepfun'] = { apiKey: stepfunKey, apiSecret: null, endpoint: process.env.STEPFUN_BASE_URL || 'https://api.stepfun.com/step_plan/v1' };
  }

  // 已删除 (2026-07-20): 国外模型 NVIDIA NIM 通道已下线

  const zhipuKey = resolveZhipuApiKey();
  if (zhipuKey) {
    result['zhipu'] = { apiKey: zhipuKey, apiSecret: null, endpoint: process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas' };
  }

  return result;
}

/**
 * 解密 ProviderConfig 中的密钥字段
 * 用于需要实际密钥的场景（如调用AI服务商）
 */
export function decryptProviderSecrets(provider: {
  provider?: string;
  apiKey: string | null;
  apiSecret: string | null;
}): { apiKey: string; apiSecret: string | null } {
  let apiKey = provider.apiKey || '';
  let apiSecret = provider.apiSecret;

  try {
    if (apiKey && isEncrypted(apiKey)) {
      apiKey = decryptFromStorage(apiKey);
    }
    if (apiSecret && isEncrypted(apiSecret)) {
      apiSecret = decryptFromStorage(apiSecret);
    }
  } catch (err) {
    logger.warn(`解密ProviderConfig密钥失败 (${provider.provider || 'unknown'})`, {
      error: err instanceof Error ? err.message : String(err),
    });
    if (provider.provider === 'doubao') {
      const envKey = process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY;
      if (envKey) {
        logger.info('使用环境变量中的豆包API密钥作为后备');
        return { apiKey: envKey, apiSecret: null };
      }
    }
    if (provider.provider === 'minimax') {
      const envKey = process.env.MINIMAX_API_KEY;
      if (envKey) {
        logger.info('使用环境变量中的MiniMax API密钥作为后备');
        return { apiKey: envKey, apiSecret: null };
      }
    }
    if (provider.provider === 'vidu') {
      const envKey = process.env.VIDU_API_KEY;
      if (envKey) {
        logger.info('使用环境变量中的Vidu API密钥作为后备');
        return { apiKey: envKey, apiSecret: null };
      }
    }
    if (provider.provider === 'jimeng') {
      const envKey = process.env.JIMENG_API_KEY || process.env.DOUBAO_IMAGE_KEY;
      if (envKey) {
        logger.info('使用环境变量中的即梦API密钥作为后备');
        return { apiKey: envKey, apiSecret: null };
      }
    }
    if (provider.provider === 'seedream') {
      const envKey = process.env.DOUBAO_IMAGE_KEY || process.env.ARK_API_KEY;
      if (envKey) {
        logger.info('使用环境变量中的Seedream API密钥作为后备');
        return { apiKey: envKey, apiSecret: null };
      }
    }
    if (provider.provider === 'wuyinkeji') {
      const envKey = process.env.WUYIN_API_KEY;
      if (envKey) {
        logger.info('使用环境变量中的小天API密钥作为后备');
        return { apiKey: envKey, apiSecret: null };
      }
    }
    if (provider.provider === 'stepfun') {
      const envKey = process.env.STEPFUN_API_KEY;
      if (envKey) {
        logger.info('使用环境变量中的 StepFun API 密钥作为后备');
        return { apiKey: envKey, apiSecret: null };
      }
    }
    if (provider.provider === 'sensenova') {
      const envKey = resolveSensenovaApiKey();
      if (envKey) {
        logger.info('使用环境变量中的 SenseNova API 密钥作为后备');
        return { apiKey: envKey, apiSecret: null };
      }
    }
    // 已删除 (2026-07-20): 国外 NVIDIA NIM 通道已下线
    if (provider.provider === 'zhipu') {
      const envKey = resolveZhipuApiKey();
      if (envKey) {
        logger.info('使用环境变量中的智谱 GLM API 密钥作为后备');
        return { apiKey: envKey, apiSecret: null };
      }
    }
    throw new Error('Provider密钥解密失败');
  }

  // 即使数据库中没有，如果是豆包/MiniMax 也尝试从环境变量读取
  if (!apiKey && provider.provider === 'doubao') {
    const envKey = process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY;
    if (envKey) {
      apiKey = envKey;
    }
  }

  // MiniMax 环境变量后备
  if (!apiKey && provider.provider === 'minimax') {
    const envKey = process.env.MINIMAX_API_KEY;
    if (envKey) {
      apiKey = envKey;
    }
  }

  // Vidu 环境变量后备
  if (!apiKey && provider.provider === 'vidu') {
    const envKey = process.env.VIDU_API_KEY;
    if (envKey) {
      apiKey = envKey;
    }
  }

  // 即梦 环境变量后备
  if (!apiKey && provider.provider === 'jimeng') {
    const envKey = process.env.JIMENG_API_KEY || process.env.DOUBAO_IMAGE_KEY;
    if (envKey) {
      apiKey = envKey;
    }
  }

  // Seedream 环境变量后备
  if (!apiKey && provider.provider === 'seedream') {
    const envKey = process.env.DOUBAO_IMAGE_KEY || process.env.ARK_API_KEY;
    if (envKey) {
      apiKey = envKey;
    }
  }

  // 小天 环境变量后备
  if (!apiKey && provider.provider === 'wuyinkeji') {
    const envKey = process.env.WUYIN_API_KEY;
    if (envKey) {
      apiKey = envKey;
    }
  }

  if (!apiKey && provider.provider === 'stepfun') {
    const envKey = process.env.STEPFUN_API_KEY;
    if (envKey) {
      apiKey = envKey;
    }
  }

  if (!apiKey && provider.provider === 'sensenova') {
    apiKey = resolveSensenovaApiKey();
  }

  return { apiKey, apiSecret };
}

const providerSchemas = {
  create: z.object({
    provider: z.string().min(1),
    name: z.string().min(1),
    displayName: z.string().min(1),
    description: z.string().optional(),
    apiKey: z.string().optional(),
    apiSecret: z.string().optional(),
    endpoint: z.string().optional(),
    isActive: z.boolean().default(true),
    supportedModes: z.array(z.string()).optional(),
    // models 支持字符串或对象格式（对象可携带 type/isActive 等字段）
    models: z.array(z.union([
      z.string(),
      z.object({
        id: z.string(),
        name: z.string().optional(),
        type: z.string().optional(),
        description: z.string().optional(),
        version: z.string().optional(),
        maxResolution: z.string().optional(),
        maxDuration: z.number().optional(),
        supportedAspectRatios: z.array(z.string()).optional(),
        supportedModes: z.array(z.string()).optional(),
        defaultParams: z.any().optional(),
        isActive: z.boolean().optional(),
      }).passthrough(),
    ])).optional(),
    config: z.any().optional(),
    rateLimit: z.number().int().optional(),
  }),
  update: z.object({
    name: z.string().min(1).optional(),
    displayName: z.string().min(1).optional(),
    description: z.string().optional(),
    apiKey: z.string().optional(),
    apiSecret: z.string().optional(),
    endpoint: z.string().optional(),
    isActive: z.boolean().optional(),
    supportedModes: z.array(z.string()).optional(),
    models: z.array(z.union([
      z.string(),
      z.object({
        id: z.string(),
        name: z.string().optional(),
        type: z.string().optional(),
        description: z.string().optional(),
        version: z.string().optional(),
        maxResolution: z.string().optional(),
        maxDuration: z.number().optional(),
        supportedAspectRatios: z.array(z.string()).optional(),
        supportedModes: z.array(z.string()).optional(),
        defaultParams: z.any().optional(),
        isActive: z.boolean().optional(),
      }).passthrough(),
    ])).optional(),
    config: z.any().optional(),
    rateLimit: z.number().int().optional(),
  }),
};

function parseProviderConfig(config: unknown): Record<string, any> {
  if (!config) return {};
  if (typeof config === 'object') return config as Record<string, any>;
  if (typeof config !== 'string') return {};

  try {
    return JSON.parse(config);
  } catch {
    return {};
  }
}

function isCustomModelConfig(config: Record<string, any>): boolean {
  return config.isCustomModel === true;
}

function isProviderVisibleToUser(config: Record<string, any>, userId?: string): boolean {
  if (!isCustomModelConfig(config)) return true;
  return Boolean(userId && config.createdByUserId === userId);
}

function validateCustomModelPayload(input: {
  provider?: string;
  endpoint?: string;
  config?: Record<string, any>;
  models?: Array<string | Record<string, any>>;
}) {
  const config = input.config || {};
  if (!isCustomModelConfig(config)) {
    if (input.provider?.startsWith('custom-image-') || input.provider?.startsWith('custom-video-')) {
      throw new ValidationError('custom-image-* 和 custom-video-* 为个人自定义模型保留命名空间');
    }
    return;
  }

  const mediaType = config.mediaType;
  if (mediaType !== 'image' && mediaType !== 'video') {
    throw new ValidationError('自定义模型必须指定 mediaType 为 image 或 video');
  }
  const expectedPrefix = `custom-${mediaType}-`;
  if (input.provider && !input.provider.startsWith(expectedPrefix)) {
    throw new ValidationError(`自定义${mediaType === 'image' ? '图片' : '视频'}模型 ID 必须以 ${expectedPrefix} 开头`);
  }
  const compatibilityMode = config.compatibilityMode;
  if (compatibilityMode !== `openai-${mediaType}` && compatibilityMode !== `official-${mediaType}`) {
    throw new ValidationError('自定义模型兼容模式与模型类型不匹配');
  }
  if (config.channelScope !== undefined && config.channelScope !== 'personal-custom') {
    throw new ValidationError('个人自定义模型必须使用独立通道');
  }
  if (config.credentialScope !== undefined && config.credentialScope !== 'user-only') {
    throw new ValidationError('个人自定义模型只能使用当前用户自己的云端凭据');
  }
  if (!input.endpoint) throw new ValidationError('自定义模型必须填写 HTTPS 接口地址');
  let endpoint: URL;
  try {
    endpoint = new URL(input.endpoint);
  } catch {
    throw new ValidationError('自定义模型接口地址格式不正确');
  }
  const hostname = endpoint.hostname.toLowerCase();
  const isPrivateIPv4 = /^(?:10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.)/.test(hostname);
  if (endpoint.protocol !== 'https:' || hostname === 'localhost' || hostname.endsWith('.local') || isPrivateIPv4) {
    throw new ValidationError('自定义模型接口必须为公网 HTTPS 地址，不能使用本机或内网地址');
  }
  if (!Array.isArray(input.models) || input.models.length !== 1 || typeof input.models[0] === 'string') {
    throw new ValidationError('每个自定义模型只能配置一个模型记录');
  }
  const model = input.models[0] as Record<string, any>;
  if (model.type !== mediaType || !model.id || !model.providerModel) {
    throw new ValidationError('自定义模型需要唯一模型 ID、上游模型名称及正确的图片/视频类型');
  }
}

function getSupportedModesFromConfig(config: Record<string, any>): string[] {
  const supportedModes = config.supportedModes;
  return Array.isArray(supportedModes) ? supportedModes.filter((mode): mode is string => typeof mode === 'string') : [];
}

function getDefaultModelsForProvider(providerId: string): Array<Record<string, any>> {
  if (providerId === 'wuyinkeji') {
    const imageModels = [
      ['image_seedream', 'Seedream Image'],
    ].map(([id, name]) => ({
      id,
      name,
      type: 'image',
      supportedModes: ['text_to_image', 'image_to_image'],
      capabilities: ['text-to-image', 'image-to-image'],
      isActive: true,
    }));

    const videoModels = WUYINKEJI_AI_VIDEO_MODELS.map((model) => {
      if (model.id === 'Digital_Humans') {
        return {
          id: model.id,
          name: model.label,
          type: 'video',
          supportedModes: ['digital_human'],
          capabilities: ['digital-human', 'lip-sync'],
          fields: ['videoUrl', 'audioUrl'],
          defaultParams: {},
          isActive: true,
        };
      }
      if (model.id === 'Package_1.0') {
        return {
          id: model.id,
          name: model.label,
          type: 'video',
          supportedModes: ['subtitle'],
          capabilities: ['subtitle', 'video-packaging'],
          fields: ['videoUrl', 'templateId'],
          defaultParams: { templateId: 1 },
          isActive: true,
        };
      }
      return {
        id: model.id,
        name: model.label,
        type: 'video',
        supportedModes: ['text_to_video', 'image_to_video'],
        capabilities: ['text-to-video', 'image-to-video'],
        // 已删除 (2026-07-20): 国外模型 google_omni 专属字段分支已下线
        isActive: true,
      };
    });

    return [...imageModels, ...videoModels];
  }

  return [];
}

function getProviderModels(config: Record<string, any>, providerId: string): Array<string | Record<string, any>> {
  const configured = Array.isArray(config.models) ? config.models : [];
  const defaults = getDefaultModelsForProvider(providerId);
  if (defaults.length === 0) return configured;

  const configuredIds = new Set(configured.map((model: string | Record<string, any>) =>
    typeof model === 'string' ? model : (model.id || model.modelId)
  ));

  return [
    ...configured,
    ...defaults.filter((model) => !configuredIds.has(model.id) && !configuredIds.has(model.modelId)),
  ];
}

aiProviderRouter.use(authenticate);

aiProviderRouter.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const { page, pageSize, search, isActive } = req.query;
  const pagination = parsePaginationParamsWithNumbers(
    Number(page) || undefined,
    Number(pageSize) || undefined
  );
  
  const where: any = {};
  
  if (search) {
    where.OR = [
      { provider: { contains: search as string } },
      { name: { contains: search as string } },
      { displayName: { contains: search as string } },
    ];
  }
  
  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  const visibleProviders = (await prisma.providerConfig.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { apiKeys: true } } },
  })).filter((provider) => isProviderVisibleToUser(parseProviderConfig(provider.config), req.userId));
  const total = visibleProviders.length;
  const providers = visibleProviders.slice(pagination.skip, pagination.skip + pagination.take);

  res.json({
    success: true,
    data: providers.map(p => {
      const config = parseProviderConfig(p.config);
      const hasActiveKeyInPool = (p as any)._count?.apiKeys > 0;
      const hasApiKey = Boolean(p.apiKey || hasActiveKeyInPool);
      const hasApiSecret = Boolean(p.apiSecret);
      return {
        ...p,
        apiKey: p.apiKey ? maskApiKey(p.apiKey) : null,
        apiSecret: p.apiSecret ? maskApiKey(p.apiSecret) : null,
        hasApiKey,
        hasApiSecret,
        supportedModes: config.supportedModes || [],
        models: getProviderModels(config, p.provider),
        config,
      };
    }),
    meta: {
      page: pagination.page,
      pageSize: pagination.pageSize || pagination.limit,
      total,
      totalPages: Math.ceil(total / (pagination.pageSize || pagination.limit)),
    },
  });
}));

aiProviderRouter.get('/active', asyncHandler(async (req: AuthRequest, res) => {
  const membershipLevel = await getMembershipLevelForUser(req.userId);
  let providers = await prisma.providerConfig.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  let allDbProviders = await prisma.providerConfig.findMany({
    orderBy: { createdAt: 'desc' },
  });
  providers = providers.filter((provider) =>
    isProviderVisibleToUser(parseProviderConfig(provider.config), req.userId)
  );
  allDbProviders = allDbProviders.filter((provider) =>
    isProviderVisibleToUser(parseProviderConfig(provider.config), req.userId)
  );

  if (providers.length === 0 && allDbProviders.length === 0) {
    const jsonProviders = promptSmart3ProviderConfigs as Array<{
      name: string;
      baseUrl?: string;
      apiKey?: string;
      maxConcurrency?: number;
      models?: unknown[];
    }>;
    const dbProviderNames = new Set(allDbProviders.map((p: any) => p.provider));
    providers = allDbProviders;
    for (const jp of jsonProviders) {
      if (!dbProviderNames.has(jp.name)) {
        providers.push({
          id: jp.name,
          provider: jp.name,
          name: jp.name,
          displayName: jp.name,
          description: `Provider: ${jp.name}`,
          endpoint: getDisplayEndpoint(jp.name, jp.baseUrl || ''),
          config: jp,
          apiKey: jp.apiKey ? maskApiKey(jp.apiKey) : null,
          apiSecret: null,
          isActive: true,
          rateLimit: jp.maxConcurrency || 3,
          models: jp.models || [],
          supportedModes: [],
        } as any);
      }
    }
  }

  const envFallbacks = getCredentialEnvFallback();
  const activeKeyRows = await prisma.providerApiKey.findMany({
    where: {
      providerName: { in: providers.map((p: any) => p.provider) },
      isActive: true,
      isExhausted: false,
    },
    select: { providerName: true },
  });
  const providersWithActiveKeyPool = new Set(activeKeyRows.map((row) => row.providerName));

  const resultData = providers
    .filter((p) => isProviderAllowedForMembership(p.provider, membershipLevel))
    .map((p: any) => {
      const config = parseProviderConfig(p.config);
      const models = getProviderModels(config, p.provider).filter((model: string | Record<string, any>) => {
        // 模型级开关：isActive !== false 才可用
        const isActive = typeof model === 'string' ? true : model.isActive !== false;
        if (!isActive) return false;
        return isModelAllowedForMembership(model, membershipLevel);
      });
      const supportedModes = config.supportedModes || [];
      const hasEnvKey = !!envFallbacks[p.provider]?.apiKey;
      const hasKeyPool = providersWithActiveKeyPool.has(p.provider);

      return {
        id: p.id,
        provider: p.provider,
        name: p.name,
        displayName: p.displayName,
        description: p.description,
        endpoint: getDisplayEndpoint(p.provider, p.endpoint),
        supportedModes,
        models,
        config,
        rateLimit: p.rateLimit,
        hasApiKey: !!p.apiKey || hasEnvKey || hasKeyPool,
        hasApiSecret: !!p.apiSecret || !!envFallbacks[p.provider]?.apiSecret,
        hasKeyPool,
      };
    });

  const dbProviderNames = new Set(allDbProviders.map((p: any) => p.provider));
  for (const [providerId, creds] of Object.entries(envFallbacks)) {
    if (!dbProviderNames.has(providerId) && isProviderAllowedForMembership(providerId, membershipLevel)) {
      resultData.push({
        id: providerId,
        provider: providerId,
        name: providerId,
        displayName: providerId,
        description: `Provider: ${providerId}`,
        endpoint: null,
        supportedModes: [],
        models: getDefaultModelsForProvider(providerId),
        config: {},
        rateLimit: null,
        hasApiKey: !!creds.apiKey,
        hasApiSecret: !!creds.apiSecret,
        hasKeyPool: false,
      });
    }
  }

  res.json({
    success: true,
    data: resultData,
  });
}));

aiProviderRouter.get('/active/credentials', requireAdmin, asyncHandler(async (_req: AuthRequest, res) => {
  res.status(410).json({
    success: false,
    data: {},
    message: '此接口已废弃：大模型密钥不再导出到前端，请通过后端 AI 生成接口调用模型。',
  });
}));

aiProviderRouter.get('/available-models', asyncHandler(async (req: AuthRequest, res) => {
  const membershipLevel = await getMembershipLevelForUser(req.userId);
  const providers = (await prisma.providerConfig.findMany({
    where: { isActive: true },
    select: {
      provider: true,
      name: true,
      displayName: true,
      endpoint: true,
      config: true,
    },
  })).filter((provider) =>
    isProviderVisibleToUser(parseProviderConfig(provider.config), req.userId)
  );

  const models = [];
  const activeProviderNames = new Set(providers.map((provider) => provider.provider));
  for (const p of providers) {
    const config = parseProviderConfig(p.config);
    const customModel = isCustomModelConfig(config);
    if (!customModel && !isProviderAllowedForMembership(p.provider, membershipLevel)) {
      continue;
    }
    const modelList = getProviderModels(config, p.provider).filter((model: string | Record<string, any>) => {
      // 模型级开关：isActive !== false 才可用（兼容旧数据无 isActive 字段）
      const isActive = typeof model === 'string' ? true : model.isActive !== false;
      if (!isActive) return false;
      return isModelAllowedForMembership(
        customModel
          ? typeof model === 'string'
            ? { id: model, isCustomModel: true }
            : { ...model, isCustomModel: true }
          : model,
        membershipLevel
      );
    });
    const supportedModes = config.supportedModes || [];
    
    for (const model of modelList) {
      const modelObj = typeof model === 'string' ? { id: model, name: model } : model;
      const modelMediaType: ModelMediaType | undefined =
        modelObj.type === 'image' || modelObj.type === 'video' ? modelObj.type : undefined;
      const channel = getChannelMetadata(p.provider, modelObj.id, modelMediaType);
      const routeProvider = channel?.provider || p.provider;
      const providerModel = channel?.providerModel || modelObj.providerModel || modelObj.id;
      const routeProviderAvailable = customModel
        ? activeProviderNames.has(p.provider)
        : activeProviderNames.has(routeProvider) && isProviderAllowedForMembership(routeProvider, membershipLevel);
      const disabledReason =
        channel?.disabledReason ||
        (!routeProviderAvailable ? `AI 服务商 ${routeProvider} 未启用` : undefined);
      const isChannelEnabled = channel?.enabled !== false && routeProviderAvailable;
      models.push({
        id: `${p.provider}_${modelObj.id}`,
        modelId: modelObj.id,
        providerModel,
        name: modelObj.name || modelObj.id,
        description: modelObj.description,
        version: modelObj.version,
        type: channel?.mediaType || modelObj.type,
        maxResolution: modelObj.maxResolution,
        supportedResolutions: modelObj.supportedResolutions,
        maxDuration: modelObj.maxDuration,
        supportedAspectRatios: modelObj.supportedAspectRatios,
        supportedModes: channel?.supportedModes || modelObj.supportedModes || supportedModes,
        capabilities: channel?.capabilities || modelObj.capabilities || modelObj.supportedModes || supportedModes,
        modelCategory: channel?.category || modelObj.modelCategory,
        requiredInputs: channel?.requiredInputs || modelObj.requiredInputs || [],
        routeProvider,
        disabledReason,
        fallbackModelId: channel?.fallbackModelId,
        fallbackProvider: channel?.fallbackProvider,
        keyScope: channel?.keyScope,
        defaultParams: modelObj.defaultParams,
        provider: routeProvider,
        configuredProvider: p.provider,
        providerDisplayName: p.displayName,
        // 节点只需模型元数据，避免把自定义上游地址暴露给普通用户。
        endpoint: customModel ? undefined : getDisplayEndpoint(p.provider, p.endpoint),
        authType: config.authType,
        isCustomModel: customModel,
        customSortPriority: customModel ? Number(config.customModel?.sortPriority ?? 0) : undefined,
        mediaType: customModel ? config.mediaType : undefined,
        compatibilityMode: customModel ? config.compatibilityMode : undefined,
        isActive: modelObj.isActive !== false && isChannelEnabled,
      });
    }
  }

  res.json({
    success: true,
    data: {
      providers: providers.map(p => {
        const config = parseProviderConfig(p.config);
        if (!isCustomModelConfig(config) && !isProviderAllowedForMembership(p.provider, membershipLevel)) {
          return null;
        }
        const modelList = getProviderModels(config, p.provider).filter((model: string | Record<string, any>) => {
          // 模型级开关：isActive !== false 才可用
          const isActive = typeof model === 'string' ? true : model.isActive !== false;
          if (!isActive) return false;
          return isModelAllowedForMembership(
            isCustomModelConfig(config)
              ? typeof model === 'string'
                ? { id: model, isCustomModel: true }
                : { ...model, isCustomModel: true }
              : model,
            membershipLevel
          );
        });
        return {
          id: p.provider,
          name: p.name,
          displayName: p.displayName,
          supportedModes: config.supportedModes || [],
          modelCount: modelList.length,
        };
      }).filter(Boolean),
      models,
    },
  });
}));

aiProviderRouter.post('/test-connection', asyncHandler(async (req: AuthRequest, res) => {
  const { providerId, config } = req.body as {
    providerId: string;
    config?: { apiKey?: string; accessKey?: string; secretKey?: string; baseUrl?: string };
  };

  if (!providerId) {
    throw new ValidationError('providerId 必填');
  }

  const startTime = Date.now();
  const result = await testProviderConnection(providerId, config);
  const latency = Date.now() - startTime;

  res.json({
    success: true,
    data: { ...result, latency },
  });
}));

aiProviderRouter.post('/test-all-connections', asyncHandler(async (_req: AuthRequest, res) => {
  const providers = await prisma.providerConfig.findMany({
    where: { isActive: true },
    select: { provider: true, displayName: true, apiKey: true, apiSecret: true, endpoint: true, config: true },
  });

  const envFallbacks = getCredentialEnvFallback();
  const results: Array<{
    provider: string;
    displayName: string;
    online: boolean;
    latency?: number;
    error?: string;
    authType?: string;
  }> = [];

  const testPromises = providers.map(async (p) => {
    const secrets = ((): { apiKey: string; apiSecret: string | null } => {
      try { return decryptProviderSecrets(p); } catch { return { apiKey: '', apiSecret: null }; }
    })();

    const apiKey = secrets.apiKey || envFallbacks[p.provider]?.apiKey || '';
    const apiSecret = secrets.apiSecret || envFallbacks[p.provider]?.apiSecret || null;
    const endpoint = p.endpoint || envFallbacks[p.provider]?.endpoint || null;
    const cfg = parseProviderConfig(p.config);

    if (!apiKey) {
      return {
        provider: p.provider,
        displayName: p.displayName,
        online: false,
        error: '未配置API密钥',
        authType: (cfg.authType as string) || 'bearer',
      };
    }

    const start = Date.now();
    const testResult = await testProviderConnection(p.provider, {
      apiKey,
      accessKey: apiKey,
      secretKey: apiSecret || undefined,
      baseUrl: endpoint || undefined,
    });

    return {
      provider: p.provider,
      displayName: p.displayName,
      online: testResult.success,
      latency: Date.now() - start,
      error: testResult.message,
      authType: (cfg.authType as string) || 'bearer',
    };
  });

  const envOnlyProviders = Object.entries(envFallbacks).filter(
    ([id]) => !providers.some(p => p.provider === id)
  );

  for (const [providerId, creds] of envOnlyProviders) {
    testPromises.push((async () => {
      const start = Date.now();
      const testResult = await testProviderConnection(providerId, {
        apiKey: creds.apiKey,
        accessKey: creds.apiKey,
        secretKey: creds.apiSecret || undefined,
        baseUrl: creds.endpoint || undefined,
      });
      return {
        provider: providerId,
        displayName: providerId,
        online: testResult.success,
        latency: Date.now() - start,
        error: testResult.message,
        authType: 'bearer',
      };
    })());
  }

  const settled = await Promise.allSettled(testPromises);
  for (const r of settled) {
    if (r.status === 'fulfilled') results.push(r.value);
    else results.push({ provider: 'unknown', displayName: '未知', online: false, error: r.reason?.message || '测试异常' });
  }

  const onlineCount = results.filter(r => r.online).length;
  const totalCount = results.length;

  res.json({
    success: true,
    data: {
      providers: results,
      summary: { total: totalCount, online: onlineCount, offline: totalCount - onlineCount },
    },
  });
}));

aiProviderRouter.get('/dashboard', requireAdmin, asyncHandler(async (_req: AuthRequest, res) => {
  const providers = await prisma.providerConfig.findMany({
    include: { apiKeys: true },
    orderBy: [{ isActive: 'desc' }, { priority: 'asc' }, { createdAt: 'desc' }],
  });
  const envFallbacks = getCredentialEnvFallback();
  const providerNames = new Set(providers.map(p => p.provider));

  const totalKeys = providers.reduce((sum, p) => sum + p.apiKeys.length, 0);
  const activeKeys = providers.reduce((sum, p) => sum + p.apiKeys.filter(k => k.isActive && !k.isExhausted).length, 0);
  const exhaustedKeys = providers.reduce((sum, p) => sum + p.apiKeys.filter(k => k.isExhausted).length, 0);
  const disabledKeys = providers.reduce((sum, p) => sum + p.apiKeys.filter(k => !k.isActive).length, 0);
  const totalQuota = providers.reduce((sum, p) => sum + p.apiKeys.reduce((inner, k) => inner + k.quotaTotal, 0), 0);
  const usedQuota = providers.reduce((sum, p) => sum + p.apiKeys.reduce((inner, k) => inner + k.quotaUsed, 0), 0);
  const remainingQuota = providers.reduce((sum, p) => sum + p.apiKeys.reduce((inner, k) => inner + k.quotaRemaining, 0), 0);
  const quotaUsagePercent = totalQuota > 0 ? Math.round((usedQuota / totalQuota) * 100) : 0;

  const providerSummaries = providers.map((p) => {
    const config = parseProviderConfig(p.config);
    const supportedModes = getSupportedModesFromConfig(config);
    const hasMainKey = !!p.apiKey;
    const hasEnvKey = !!envFallbacks[p.provider]?.apiKey;
    const keyPoolTotal = p.apiKeys.length;
    const keyPoolActive = p.apiKeys.filter(k => k.isActive && !k.isExhausted).length;
    const keyPoolExhausted = p.apiKeys.filter(k => k.isExhausted).length;
    const keyPoolDisabled = p.apiKeys.filter(k => !k.isActive).length;
    const keyPoolQuotaTotal = p.apiKeys.reduce((sum, k) => sum + k.quotaTotal, 0);
    const keyPoolQuotaUsed = p.apiKeys.reduce((sum, k) => sum + k.quotaUsed, 0);
    const keyPoolQuotaRemaining = p.apiKeys.reduce((sum, k) => sum + k.quotaRemaining, 0);
    const highFailureKeys = p.apiKeys.filter(k => (k.failureCount ?? 0) >= 3).length;
    const latestLastUsedAt = p.apiKeys
      .map(k => k.lastUsedAt)
      .filter((date): date is Date => !!date)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    return {
      id: p.id,
      provider: p.provider,
      displayName: p.displayName || p.name || p.provider,
      isActive: p.isActive,
      endpoint: getDisplayEndpoint(p.provider, p.endpoint),
      hasMainKey,
      hasEnvKey,
      hasAnyKey: hasMainKey || hasEnvKey || keyPoolActive > 0,
      modelCount: getProviderModels(config, p.provider).length,
      supportedModes,
      keyPool: {
        total: keyPoolTotal,
        active: keyPoolActive,
        exhausted: keyPoolExhausted,
        disabled: keyPoolDisabled,
        highFailure: highFailureKeys,
        quotaTotal: keyPoolQuotaTotal,
        quotaUsed: keyPoolQuotaUsed,
        quotaRemaining: keyPoolQuotaRemaining,
        quotaUsagePercent: keyPoolQuotaTotal > 0 ? Math.round((keyPoolQuotaUsed / keyPoolQuotaTotal) * 100) : 0,
        lastUsedAt: latestLastUsedAt,
      },
    };
  });

  const envOnlyProviders = Object.entries(envFallbacks)
    .filter(([provider]) => !providerNames.has(provider))
    .map(([provider, credentials]) => ({
      id: provider,
      provider,
      displayName: provider,
      isActive: true,
      endpoint: getDisplayEndpoint(provider, credentials.endpoint),
      hasMainKey: false,
      hasEnvKey: true,
      hasAnyKey: true,
      modelCount: 0,
      supportedModes: [] as string[],
      keyPool: {
        total: 0,
        active: 0,
        exhausted: 0,
        disabled: 0,
        highFailure: 0,
        quotaTotal: 0,
        quotaUsed: 0,
        quotaRemaining: 0,
        quotaUsagePercent: 0,
        lastUsedAt: null,
      },
    }));

  const allProviderSummaries = [...providerSummaries, ...envOnlyProviders];
  const activeProviderCount = allProviderSummaries.filter(p => p.isActive).length;
  const configuredProviderCount = allProviderSummaries.filter(p => p.hasAnyKey).length;
  const activeProvidersWithoutKey = allProviderSummaries.filter(p => p.isActive && !p.hasAnyKey);
  const providersWithoutModels = allProviderSummaries.filter(p => p.isActive && p.modelCount === 0);
  const providersWithExhaustedKeys = allProviderSummaries.filter(p => p.keyPool.exhausted > 0);
  const providersWithHighFailureKeys = allProviderSummaries.filter(p => p.keyPool.highFailure > 0);
  const highQuotaProviders = allProviderSummaries.filter(p => p.keyPool.quotaTotal > 0 && p.keyPool.quotaUsagePercent >= 80);

  const modeDistribution = allProviderSummaries.reduce<Record<string, number>>((acc, provider) => {
    const modes = provider.supportedModes.length > 0 ? provider.supportedModes : ['未配置模式'];
    for (const mode of modes) {
      acc[mode] = (acc[mode] ?? 0) + 1;
    }
    return acc;
  }, {});

  const recommendations: Array<{
    severity: 'critical' | 'warning' | 'info';
    title: string;
    message: string;
    provider?: string;
  }> = [];

  for (const provider of activeProvidersWithoutKey) {
    recommendations.push({
      severity: 'critical',
      title: '启用服务商缺少可用 KEY',
      message: `${provider.displayName} 已启用，但没有主密钥、环境变量后备或可用 Key 池。`,
      provider: provider.provider,
    });
  }

  for (const provider of highQuotaProviders) {
    recommendations.push({
      severity: provider.keyPool.quotaUsagePercent >= 95 ? 'critical' : 'warning',
      title: 'Key 池额度接近耗尽',
      message: `${provider.displayName} 已使用 ${provider.keyPool.quotaUsagePercent}% 额度，建议补充或重置 Key 池。`,
      provider: provider.provider,
    });
  }

  for (const provider of providersWithExhaustedKeys) {
    recommendations.push({
      severity: 'warning',
      title: '存在耗尽的 Key',
      message: `${provider.displayName} 有 ${provider.keyPool.exhausted} 把 Key 已耗尽。`,
      provider: provider.provider,
    });
  }

  for (const provider of providersWithHighFailureKeys) {
    recommendations.push({
      severity: 'warning',
      title: '存在高失败次数 Key',
      message: `${provider.displayName} 有 ${provider.keyPool.highFailure} 把 Key 失败次数偏高，建议测试连接或更换 KEY。`,
      provider: provider.provider,
    });
  }

  for (const provider of providersWithoutModels) {
    recommendations.push({
      severity: 'info',
      title: '模型列表未配置',
      message: `${provider.displayName} 没有配置模型列表，前端模型选择可能无法完整展示。`,
      provider: provider.provider,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      severity: 'info',
      title: '后端模型配置状态稳定',
      message: '当前未发现阻断性 KEY、额度或模型配置风险。',
    });
  }

  const healthPenalty =
    activeProvidersWithoutKey.length * 12 +
    highQuotaProviders.length * 6 +
    providersWithExhaustedKeys.length * 4 +
    providersWithHighFailureKeys.length * 4 +
    providersWithoutModels.length * 2;
  const healthScore = Math.max(0, Math.min(100, 100 - healthPenalty));
  const healthStatus =
    healthScore >= 90 ? 'excellent' :
    healthScore >= 75 ? 'good' :
    healthScore >= 55 ? 'warning' :
    'critical';

  res.json({
    success: true,
    data: {
      generatedAt: new Date().toISOString(),
      health: {
        score: healthScore,
        status: healthStatus,
      },
      summary: {
        totalProviders: allProviderSummaries.length,
        databaseProviders: providers.length,
        envOnlyProviders: envOnlyProviders.length,
        activeProviders: activeProviderCount,
        configuredProviders: configuredProviderCount,
        activeProvidersWithoutKey: activeProvidersWithoutKey.length,
        totalModels: allProviderSummaries.reduce((sum, p) => sum + p.modelCount, 0),
      },
      keys: {
        total: totalKeys,
        active: activeKeys,
        exhausted: exhaustedKeys,
        disabled: disabledKeys,
        quotaTotal: totalQuota,
        quotaUsed: usedQuota,
        quotaRemaining: remainingQuota,
        quotaUsagePercent,
      },
      modeDistribution,
      providers: allProviderSummaries,
      recommendations: recommendations.slice(0, 12),
    },
  });
}));

aiProviderRouter.get('/:providerId/status', asyncHandler(async (req: AuthRequest, res) => {
  const { providerId } = req.params;

  const provider = await prisma.providerConfig.findFirst({
    where: { provider: providerId },
    select: { provider: true, displayName: true, apiKey: true, apiSecret: true, endpoint: true, config: true, isActive: true },
  });

  const envFallbacks = getCredentialEnvFallback();
  const envCreds = envFallbacks[providerId];

  if (!provider && !envCreds) {
    throw new NotFoundError('提供商不存在');
  }

  let apiKey = '';
  let apiSecret: string | null = null;
  let endpoint: string | null = null;

  if (provider) {
    try {
      const secrets = decryptProviderSecrets(provider);
      apiKey = secrets.apiKey;
      apiSecret = secrets.apiSecret;
      endpoint = provider.endpoint;
    } catch {
      apiKey = envCreds?.apiKey || '';
      apiSecret = envCreds?.apiSecret || null;
      endpoint = envCreds?.endpoint || null;
    }
  } else {
    apiKey = envCreds?.apiKey || '';
    apiSecret = envCreds?.apiSecret || null;
    endpoint = envCreds?.endpoint || null;
  }

  if (!apiKey) {
    return res.json({
      success: true,
      data: { online: false, error: '未配置API密钥', provider: providerId },
    });
  }

  const startTime = Date.now();
  const testResult = await testProviderConnection(providerId, {
    apiKey,
    accessKey: apiKey,
    secretKey: apiSecret || undefined,
    baseUrl: endpoint || undefined,
  });

  res.json({
    success: true,
    data: {
      online: testResult.success,
      latency: Date.now() - startTime,
      error: testResult.message,
      provider: providerId,
      displayName: provider?.displayName || providerId,
      isActive: provider?.isActive ?? true,
      models: testResult.models,
    },
  });
}));

type ProviderConnectionModelResult = {
  model: string;
  label: string;
  endpoint: string;
  status: number;
  online: boolean;
  message: string;
};

function normalizeRootUrl(baseUrl: string | undefined, fallback: string): string {
  return (baseUrl || fallback).replace(/\/+$/, '');
}

function buildArkModelsUrl(baseUrl?: string): string {
  const root = normalizeRootUrl(baseUrl, 'https://ark.cn-beijing.volces.com/api/v3');
  if (root.endsWith('/models')) return root;
  return root.endsWith('/api/v3') ? `${root}/models` : `${root}/api/v3/models`;
}

function buildWuyinkejiKeyProbeUrl(baseUrl: string | undefined, apiKey: string): string {
  const root = normalizeRootUrl(baseUrl, 'https://api.wuyinkeji.com');
  return `${root}/api/async/detail?key=${encodeURIComponent(apiKey)}&id=codex_health_probe`;
}

async function readProbeText(resp: Response): Promise<string> {
  return (await resp.text().catch(() => '')).slice(0, 500);
}

function isAuthFailureProbe(status: number, bodyText: string): boolean {
  const text = bodyText.toLowerCase();
  return status === 401 || status === 403 ||
    text.includes('api key doesn') ||
    text.includes('invalid api key') ||
    text.includes('unauthorized') ||
    text.includes('forbidden') ||
    text.includes('invalid token') ||
    bodyText.includes('无效的令牌') ||
    bodyText.includes('认证失败') ||
    bodyText.includes('KEY不正确') ||
    bodyText.includes('Key不正确') ||
    bodyText.includes('key不正确');
}

function isBusinessBlockedProbe(bodyText: string): boolean {
  const text = bodyText.toLowerCase();
  return bodyText.includes('余额不足') ||
    bodyText.includes('欠费') ||
    bodyText.includes('没有权限') ||
    bodyText.includes('无权限') ||
    text.includes('insufficient balance') ||
    text.includes('insufficient quota') ||
    text.includes('quota exceeded');
}

function classifyKeyProbe(
  status: number,
  bodyText: string,
  successMessage: string,
  businessBlockedMessage = 'API可达，KEY已识别（账号余额/权限限制）',
): { online: boolean; message: string } {
  if (isAuthFailureProbe(status, bodyText)) {
    return { online: false, message: `认证失败 HTTP ${status || '未知'}` };
  }

  if (isBusinessBlockedProbe(bodyText)) {
    return { online: true, message: businessBlockedMessage };
  }

  if ((status >= 200 && status < 300) || [400, 404, 422, 429].includes(status)) {
    return { online: true, message: successMessage };
  }

  return { online: false, message: status ? `HTTP ${status}` : '无响应' };
}

async function testProviderConnection(
  providerId: string,
  config?: { apiKey?: string; accessKey?: string; secretKey?: string; baseUrl?: string }
): Promise<{ success: boolean; message?: string; models?: ProviderConnectionModelResult[] }> {
  const apiKey = config?.apiKey || config?.accessKey || '';
  const apiSecret = config?.secretKey;
  const baseUrl = config?.baseUrl;

  if (!apiKey) {
    return { success: false, message: '未配置API密钥' };
  }

  const timeout = 15000;

  try {
    switch (providerId) {
      case 'doubao':
      case 'doubao-video': {
        const url = buildArkModelsUrl(baseUrl);
        const resp = await fetch(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(timeout),
        });
        const bodyText = await readProbeText(resp);
        const result = classifyKeyProbe(resp.status, bodyText, '豆包API连接正常');
        return { success: result.online, message: result.message };
      }

      case 'seedream': {
        const url = buildArkModelsUrl(baseUrl);
        const resp = await fetch(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(timeout),
        });
        const bodyText = await readProbeText(resp);
        const result = classifyKeyProbe(resp.status, bodyText, 'Seedream API连接正常');
        return { success: result.online, message: result.message };
      }

      case 'minimax': {
        const base = baseUrl || 'https://api.minimaxi.com';
        const url = base.endsWith('/v1') ? `${base}/music_generation` : `${base}/v1/music_generation`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'music-2.6', prompt: 'test', duration: 1 }),
          signal: AbortSignal.timeout(timeout),
        });
        if (resp.ok) return { success: true, message: 'MiniMax音乐API连接正常' };
        if (resp.status === 401 || resp.status === 403) return { success: false, message: `认证失败 HTTP ${resp.status}` };
        if (resp.status === 400 || resp.status === 422 || resp.status === 429) return { success: true, message: 'MiniMax音乐API可达(认证通过)' };
        return { success: false, message: `HTTP ${resp.status}` };
      }

      case 'vidu': {
        const url = `${baseUrl || 'https://api.vidu.cn'}/ent/v2/reference2video`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'viduq3-turbo', prompt: 'test' }),
          signal: AbortSignal.timeout(timeout),
        });
        if (resp.ok) return { success: true, message: 'Vidu API连接正常' };
        if (resp.status === 401 || resp.status === 403) return { success: false, message: `认证失败 HTTP ${resp.status}` };
        if (resp.status === 400) return { success: true, message: 'Vidu API可达(认证通过)' };
        return { success: false, message: `HTTP ${resp.status}` };
      }

      case 'jimeng': {
        const url = `${baseUrl || 'https://jimeng.jianying.com'}/molo/v1/encrypted_request`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(timeout),
        });
        if (resp.status !== 404 && resp.status !== 0) return { success: true, message: '即梦API可达' };
        return { success: false, message: `HTTP ${resp.status}` };
      }

      case 'wuyinkeji': {
        const resp = await fetch(buildWuyinkejiKeyProbeUrl(baseUrl, apiKey), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(timeout),
        });
        const bodyText = await readProbeText(resp);
        const probe = classifyKeyProbe(resp.status, bodyText, '模拟检测通过：通信正常，KEY已识别');
        const modelResults = WUYINKEJI_AI_VIDEO_MODELS.map((model) => ({
          model: model.id,
          label: model.label,
          endpoint: model.endpoint,
          status: resp.status,
          online: probe.online,
          message: probe.message,
        }));
        const onlineCount = modelResults.filter((item) => item.online).length;
        if (onlineCount > 0) {
          return { success: true, message: `小天视频模型模拟检测完成：${onlineCount}/${modelResults.length} 可用`, models: modelResults };
        }
        return {
          success: false,
          message: `小天视频模型全部不可用：${modelResults.map((item) => `${item.model} ${item.message}`).join('；')}`,
          models: modelResults,
        };
      }

      case 'stepfun': {
        const url = `${baseUrl || 'https://api.stepfun.com/step_plan/v1'}/chat/completions`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'step-3.5-flash',
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 1,
          }),
          signal: AbortSignal.timeout(timeout),
        });
        if (resp.ok) return { success: true, message: 'StepFun API连接正常' };
        if (resp.status === 401 || resp.status === 403) return { success: false, message: `认证失败 HTTP ${resp.status}` };
        if (resp.status === 400 || resp.status === 422 || resp.status === 429) return { success: true, message: 'StepFun API可达(认证通过)' };
        return { success: false, message: `HTTP ${resp.status}` };
      }

      case 'sensenova': {
        const url = `${baseUrl || 'https://token.sensenova.cn/v1'}/chat/completions`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'sensenova-6.7-flash-lite', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
          signal: AbortSignal.timeout(timeout),
        });
        if (resp.ok) return { success: true, message: 'SenseNova API连接正常' };
        if (resp.status === 401 || resp.status === 403) return { success: false, message: `认证失败 HTTP ${resp.status}` };
        if (resp.status === 400 || resp.status === 422 || resp.status === 429) return { success: true, message: 'SenseNova API可达(认证通过)' };
        return { success: false, message: `HTTP ${resp.status}` };
      }

      case 'deepseek': {
        const url = `${baseUrl || 'https://api.deepseek.com/v1'}/chat/completions`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'deepseek-v4-pro', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
          signal: AbortSignal.timeout(timeout),
        });
        if (resp.ok) return { success: true, message: 'DeepSeek API连接正常' };
        if (resp.status === 401 || resp.status === 403) return { success: false, message: `认证失败 HTTP ${resp.status}` };
        if (resp.status === 400 || resp.status === 422 || resp.status === 429) return { success: true, message: 'DeepSeek API可达(认证通过)' };
        return { success: false, message: `HTTP ${resp.status}` };
      }


      default: {
        if (baseUrl) {
          const resp = await fetch(baseUrl, {
            method: 'GET',
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(timeout),
          });
          if (resp.ok || resp.status === 401) return { success: true, message: `端点可达 (HTTP ${resp.status})` };
          return { success: false, message: `HTTP ${resp.status}` };
        }
        return { success: false, message: `不支持的Provider: ${providerId}` };
      }
    }
  } catch (err: unknown) {
    const e = err as Error;
    if (e.name === 'AbortError' || e.message?.includes('timeout')) {
      return { success: false, message: '连接超时(15s)' };
    }
    if (e.message?.includes('ECONNREFUSED')) {
      return { success: false, message: '连接被拒绝，服务不可用' };
    }
    if (e.message?.includes('ENOTFOUND') || e.message?.includes('getaddrinfo')) {
      return { success: false, message: 'DNS解析失败(域名不可达)' };
    }
    if (e.message?.includes('ECONNRESET')) {
      return { success: false, message: '连接被重置(可能被防火墙阻断)' };
    }
    if (e.message?.includes('CERT') || e.message?.includes('SSL') || e.message?.includes('TLS')) {
      return { success: false, message: 'SSL/TLS证书错误(可能被中间人攻击)' };
    }
    return { success: false, message: `连接失败: ${e.message || '未知错误'}` };
  }
}

/** 旧客户端兼容路由：模型密钥不再导出到浏览器。 */
aiProviderRouter.get('/credentials/:providerId', asyncHandler(async (_req: AuthRequest, res) => {
  res.status(410).json({
    success: false,
    data: null,
    message: 'Provider 密钥仅保存在后端，请通过后端模型代理接口调用',
  });
}));

aiProviderRouter.get('/export-frontend-config', requireAdmin, asyncHandler(async (_req, res) => {
  const providers = await prisma.providerConfig.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  const config: Record<string, any> = {};
  const envFallbacks = getCredentialEnvFallback();

  for (const provider of providers) {
    const providerId = provider.provider;
    const providerConfig = parseProviderConfig(provider.config);
    const envCreds = envFallbacks[providerId];
    const hasApiKey = !!provider.apiKey || !!envCreds?.apiKey;
    const hasApiSecret = !!provider.apiSecret || !!envCreds?.apiSecret;

    config[providerId] = {
      providerId,
      displayName: provider.displayName || provider.name,
      enabled: provider.isActive,
      hasApiKey,
      hasApiSecret,
      maskedApiKey: provider.apiKey ? maskApiKey(provider.apiKey) : (envCreds?.apiKey ? 'env:********' : null),
      maskedApiSecret: provider.apiSecret ? maskApiKey(provider.apiSecret) : (envCreds?.apiSecret ? 'env:********' : null),
      endpoint: getDisplayEndpoint(providerId, provider.endpoint || envCreds?.endpoint || null),
      authType: providerConfig?.authType || 'api-key',
      modelCount: getProviderModels(providerConfig, providerId).length,
    };
  }

  res.json({
    success: true,
    data: config,
    message: `同步成功，共 ${Object.keys(config).length} 个Provider配置`,
  });
}));

aiProviderRouter.get('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const provider = await prisma.providerConfig.findUnique({
    where: { id: req.params.id },
  });

  if (!provider) {
    throw new NotFoundError('提供商不存在');
  }

  const config = parseProviderConfig(provider.config);
  if (!isProviderVisibleToUser(config, req.userId)) {
    throw new NotFoundError('提供商不存在');
  }
  res.json({
    success: true,
    data: {
      ...provider,
      apiKey: provider.apiKey ? maskApiKey(provider.apiKey) : null,
      apiSecret: provider.apiSecret ? maskApiKey(provider.apiSecret) : null,
      supportedModes: config.supportedModes || [],
      models: getProviderModels(config, provider.provider),
      config: sanitizeProviderConfig(provider.provider, config),
    },
  });
}));

aiProviderRouter.get('/:id/models', asyncHandler(async (req: AuthRequest, res) => {
  const provider = await prisma.providerConfig.findUnique({
    where: { id: req.params.id },
    select: { config: true, provider: true }
  });

  if (!provider) {
    throw new NotFoundError('提供商不存在');
  }

  const config = parseProviderConfig(provider.config);
  if (!isProviderVisibleToUser(config, req.userId)) {
    throw new NotFoundError('提供商不存在');
  }
  const models = getProviderModels(config, provider.provider);
  res.json({ success: true, data: models });
}));

/**
 * 模型级别启用/禁用切换
 * 在 ProviderConfig.config.models JSON 数组中为单个模型设置 isActive 字段。
 * 旧数据（纯字符串模型）会自动升级为对象格式 { id, name, isActive }。
 */
aiProviderRouter.patch('/:id/models/:modelId/toggle', requireAdmin, asyncHandler(async (req, res) => {
  const { id, modelId } = req.params;

  const existing = await prisma.providerConfig.findUnique({
    where: { id },
    select: { config: true, provider: true, name: true, displayName: true },
  });

  if (!existing) {
    throw new NotFoundError('提供商不存在');
  }

  const config = parseProviderConfig(existing.config);
  const models: Array<string | Record<string, any>> = getProviderModels(config, existing.provider);

  let found = false;
  const updatedModels = models.map((model) => {
    const isTarget = typeof model === 'string'
      ? model === modelId
      : (model.id === modelId || model.modelId === modelId);

    if (!isTarget) return model;

    found = true;
    if (typeof model === 'string') {
      // 旧格式字符串升级为对象，当前活跃则切换为禁用
      return { id: model, name: model, isActive: false };
    }
    // 对象格式：切换 isActive（默认 true）
    const currentActive = model.isActive !== false;
    return { ...model, isActive: !currentActive };
  });

  if (!found) {
    throw new NotFoundError(`模型 ${modelId} 不存在于该提供商下`);
  }

  config.models = updatedModels;

  const provider = await prisma.providerConfig.update({
    where: { id },
    data: { config: JSON.stringify(config) },
  });

  // 返回更新后的模型列表（含 isActive 状态）
  const returnModels = updatedModels.map((m) => {
    if (typeof m === 'string') return { id: m, name: m, isActive: true };
    return { ...m, isActive: m.isActive !== false };
  });

  res.json({
    success: true,
    data: {
      providerId: id,
      providerName: existing.displayName || existing.name,
      models: returnModels,
    },
    message: `模型 ${modelId} 已切换`,
  });
}));

/**
 * 所有已登录会员可新增“无公共 Key”的自定义模型接口。
 * Key 永远保存在用户自己的凭据库；管理员接口仍负责管理内置服务商与公共配置。
 */
aiProviderRouter.post('/custom-models', asyncHandler(async (req: AuthRequest, res) => {
  const validatedData = providerSchemas.create.parse(req.body);
  if (validatedData.apiKey || validatedData.apiSecret) {
    throw new ValidationError('自定义模型接口不允许保存公共 API Key，请在个人 API 配置中保存');
  }
  validateCustomModelPayload(validatedData);

  const existing = await prisma.providerConfig.findUnique({ where: { provider: validatedData.provider } });
  if (existing) throw new ConflictError('该自定义模型接口已存在，请使用不同的显示名称');

  const config: any = { ...(validatedData.config || {}) };
  config.models = validatedData.models || [];
  config.supportedModes = validatedData.supportedModes || [];
  config.createdByUserId = req.userId;

  const provider = await prisma.providerConfig.create({
    data: {
      provider: validatedData.provider,
      name: validatedData.name,
      displayName: validatedData.displayName,
      description: validatedData.description,
      endpoint: validatedData.endpoint,
      isActive: validatedData.isActive ?? true,
      config: JSON.stringify(config),
      rateLimit: validatedData.rateLimit,
    },
  });

  res.status(201).json({
    success: true,
    data: {
      ...provider,
      apiKey: null,
      apiSecret: null,
      hasApiKey: false,
      hasApiSecret: false,
      supportedModes: config.supportedModes,
      models: getProviderModels(config, provider.provider),
      config: sanitizeProviderConfig(provider.provider, config),
    },
  });
}));

/** 验证个人自定义模型的 Key；验证通过前不写入凭据库。 */
aiProviderRouter.post('/custom-models/:provider/test', asyncHandler(async (req: AuthRequest, res) => {
  const providerId = String(req.params.provider || '');
  const apiKey = z.string().trim().min(1, '请先输入 API Key').max(65536).parse(req.body?.apiKey);
  const provider = await prisma.providerConfig.findUnique({ where: { provider: providerId } });
  if (!provider) throw new NotFoundError('自定义模型不存在');
  const config = parseProviderConfig(provider.config);
  if (!isCustomModelConfig(config) || !isProviderVisibleToUser(config, req.userId)) {
    throw new NotFoundError('自定义模型不存在');
  }
  if (!provider.isActive || !provider.endpoint) {
    throw new ValidationError('自定义模型接口不可用');
  }

  const endpoint = provider.endpoint.replace(/\/+$/, '');
  const mediaType = config.mediaType === 'video' ? 'video' : 'image';
  const protocol = `openai-${mediaType}` as const;
  const generationEndpoint = `${endpoint}/${mediaType === 'video' ? 'videos' : 'images'}/generations`;
  const supportedModes = getSupportedModesFromConfig(config);
  const checks: Array<{
    id: 'endpoint' | 'authentication' | 'modelList' | 'modelAccess' | 'generationProtocol';
    label: string;
    status: 'passed' | 'warning' | 'failed';
    message: string;
  }> = [{
    id: 'endpoint',
    label: '接口地址',
    status: 'passed',
    message: `已连接公网 HTTPS 地址 ${endpoint}`,
  }];
  let response: Response;
  let modelsPayload: any = null;
  try {
    const remote = await fetchSafeRemoteResponse(`${endpoint}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeoutMs: 15_000,
      maxBytes: 1024 * 1024,
    });
    response = remote.response;
    try {
      if (response.ok) modelsPayload = await response.json().catch(() => null);
      else await response.body?.cancel().catch(() => undefined);
    } finally {
      remote.dispose();
    }
  } catch {
    throw new ValidationError('接口连接失败或超时，请检查接口地址');
  }

  if (response.status === 401 || response.status === 403) {
    throw new ValidationError('API Key 验证失败，请检查密钥');
  }
  if (!response.ok && ![400, 404, 405, 422, 429].includes(response.status)) {
    throw new ValidationError(`接口验证失败：HTTP ${response.status}`);
  }

  checks.push({
    id: 'authentication',
    label: 'API Key 鉴权',
    status: response.status === 429 ? 'warning' : 'passed',
    message: response.status === 429 ? '密钥已被接口识别，但当前请求受到频率限制' : '接口未返回未授权状态',
  });

  let resolvedModel: string | undefined;
  if (response.ok) {
    const availableModelIds = Array.isArray(modelsPayload?.data)
      ? modelsPayload.data
          .map((item: any) => String(item?.id || '').trim())
          .filter(Boolean)
      : [];
    const configuredModel = Array.isArray(config.models)
      ? config.models.find((item: any) => item && typeof item === 'object')
      : undefined;
    const configuredUpstreamModel = String(configuredModel?.providerModel || '').trim();

    checks.push({
      id: 'modelList',
      label: '模型列表',
      status: availableModelIds.length > 0 ? 'passed' : 'warning',
      message: availableModelIds.length > 0
        ? `接口返回 ${availableModelIds.length} 个可用模型`
        : '接口可访问，但没有返回标准 data[].id 模型列表',
    });

    if (availableModelIds.length > 0 && configuredUpstreamModel) {
      resolvedModel = availableModelIds.find((id: string) => id === configuredUpstreamModel)
        || availableModelIds.find(
          (id: string) => id.toLowerCase() === configuredUpstreamModel.toLowerCase()
        );
      if (!resolvedModel) {
        throw new ValidationError(
          `API Key 有效，但当前账号不支持模型 "${configuredUpstreamModel}"`
        );
      }

      checks.push({
        id: 'modelAccess',
        label: '模型匹配',
        status: 'passed',
        message: `账号可访问模型 ${resolvedModel}`,
      });

      if (resolvedModel !== configuredUpstreamModel) {
        config.models = config.models.map((item: any) =>
          item && typeof item === 'object' && item.id === configuredModel.id
            ? { ...item, providerModel: resolvedModel }
            : item
        );
        await prisma.providerConfig.update({
          where: { provider: providerId },
          data: { config: JSON.stringify(config) },
        });
      }
    }
    if (!resolvedModel && configuredUpstreamModel) {
      checks.push({
        id: 'modelAccess',
        label: '模型匹配',
        status: 'warning',
        message: `无法通过模型列表确认 ${configuredUpstreamModel}，首次生成时仍需上游校验`,
      });
    }
  } else {
    checks.push({
      id: 'modelList',
      label: '模型列表',
      status: 'warning',
      message: `接口未提供标准 /models 能力（HTTP ${response.status}），不影响保存`,
    });
    checks.push({
      id: 'modelAccess',
      label: '模型匹配',
      status: 'warning',
      message: '当前接口无法预检模型权限，首次生成时由上游确认',
    });
  }

  checks.push({
    id: 'generationProtocol',
    label: '生成协议',
    status: 'warning',
    message: `将使用 ${generationEndpoint}；为避免费用，本次未提交生成任务`,
  });

  res.json({
    success: true,
    data: {
      online: true,
      provider: providerId,
      protocol,
      resolvedModel,
      generationEndpoint,
      supportedModes,
      checks,
      message: resolvedModel ? `连接成功，模型已匹配为 ${resolvedModel}` : '连接成功，生成协议将在首次任务中确认',
    },
  });
}));

/** 删除当前用户自己的自定义模型定义及其个人云端凭据。 */
aiProviderRouter.delete('/custom-models/:provider', asyncHandler(async (req: AuthRequest, res) => {
  const providerId = String(req.params.provider || '');
  const provider = await prisma.providerConfig.findUnique({ where: { provider: providerId } });
  if (!provider) throw new NotFoundError('自定义模型不存在');
  const config = parseProviderConfig(provider.config);
  if (!isCustomModelConfig(config) || !isProviderVisibleToUser(config, req.userId)) {
    throw new NotFoundError('自定义模型不存在');
  }

  await removeUserModelCredential(req.userId!, providerId);
  await prisma.providerConfig.delete({ where: { provider: providerId } });
  res.json({ success: true, message: '自定义模型已删除' });
}));

aiProviderRouter.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const validatedData = providerSchemas.create.parse(req.body);

  validateCustomModelPayload(validatedData);

  const existing = await prisma.providerConfig.findUnique({
    where: { provider: validatedData.provider },
  });

  if (existing) {
    throw new ConflictError('已存在同ID的提供商');
  }

  const encryptedApiKey = validatedData.apiKey ? encryptForStorage(validatedData.apiKey) : null;
  const encryptedApiSecret = validatedData.apiSecret ? encryptForStorage(validatedData.apiSecret) : null;

  const config: any = validatedData.config || {};
  if (validatedData.models) {
    config.models = validatedData.models;
  }
  if (validatedData.supportedModes) {
    config.supportedModes = validatedData.supportedModes;
  }

  const provider = await prisma.providerConfig.create({
    data: {
      provider: validatedData.provider,
      name: validatedData.name,
      displayName: validatedData.displayName,
      description: validatedData.description,
      apiKey: encryptedApiKey,
      apiSecret: encryptedApiSecret,
      endpoint: validatedData.endpoint,
      isActive: validatedData.isActive ?? false,
      config: JSON.stringify(config),
      rateLimit: validatedData.rateLimit,
    },
  });

  res.status(201).json({
    success: true,
    data: {
      ...provider,
      apiKey: provider.apiKey ? maskApiKey(provider.apiKey) : null,
      apiSecret: provider.apiSecret ? maskApiKey(provider.apiSecret) : null,
      supportedModes: config.supportedModes || [],
      models: getProviderModels(config, provider.provider),
      config: sanitizeProviderConfig(provider.provider, config),
    },
  });
}));

aiProviderRouter.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const validatedData = providerSchemas.update.parse(req.body);

  const existing = await prisma.providerConfig.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    throw new NotFoundError('提供商不存在');
  }

  const existingConfig = parseProviderConfig(existing.config);
  const config: any = { ...existingConfig, ...validatedData.config };
  if (validatedData.models !== undefined) {
    config.models = validatedData.models;
  }
  if (validatedData.supportedModes !== undefined) {
    config.supportedModes = validatedData.supportedModes;
  }

  validateCustomModelPayload({
    provider: existing.provider,
    endpoint: validatedData.endpoint ?? existing.endpoint ?? undefined,
    config,
    models: config.models,
  });

  const updateData: any = {};
  if (validatedData.name !== undefined) updateData.name = validatedData.name;
  if (validatedData.displayName !== undefined) updateData.displayName = validatedData.displayName;
  if (validatedData.description !== undefined) updateData.description = validatedData.description;
  if (validatedData.endpoint !== undefined) updateData.endpoint = validatedData.endpoint;
  if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
  if (validatedData.rateLimit !== undefined) updateData.rateLimit = validatedData.rateLimit;
  updateData.config = JSON.stringify(config);
  if (validatedData.apiKey) {
    updateData.apiKey = encryptForStorage(validatedData.apiKey);
  }
  if (validatedData.apiSecret) {
    updateData.apiSecret = encryptForStorage(validatedData.apiSecret);
  }

  const provider = await prisma.providerConfig.update({
    where: { id: req.params.id },
    data: updateData,
  });

  res.json({
    success: true,
    data: {
      ...provider,
      apiKey: provider.apiKey ? maskApiKey(provider.apiKey) : null,
      apiSecret: provider.apiSecret ? maskApiKey(provider.apiSecret) : null,
      supportedModes: config.supportedModes || [],
      models: getProviderModels(config, provider.provider),
      config,
    },
  });
}));

aiProviderRouter.patch('/:id/credentials', requireAdmin, asyncHandler(async (req, res) => {
  const { apiKey, apiSecret } = req.body;

  const existing = await prisma.providerConfig.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    throw new NotFoundError('提供商不存在');
  }

  const updateData: any = {};
  if (apiKey !== undefined) {
    updateData.apiKey = apiKey ? encryptForStorage(apiKey) : null;
  }
  if (apiSecret !== undefined) {
    updateData.apiSecret = apiSecret ? encryptForStorage(apiSecret) : null;
  }

  const provider = await prisma.providerConfig.update({
    where: { id: req.params.id },
    data: updateData,
  });

  res.json({
    success: true,
    data: {
      id: provider.id,
      provider: provider.provider,
      hasApiKey: !!provider.apiKey,
      hasApiSecret: !!provider.apiSecret,
    },
    message: '密钥更新成功',
  });
}));

aiProviderRouter.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = await prisma.providerConfig.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    throw new NotFoundError('提供商不存在');
  }

  await prisma.providerConfig.delete({
    where: { id: req.params.id },
  });

  res.json({
    success: true,
    message: 'Provider deleted successfully',
  });
}));

aiProviderRouter.patch('/:id/toggle', requireAdmin, asyncHandler(async (req, res) => {
  const existing = await prisma.providerConfig.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    throw new NotFoundError('提供商不存在');
  }

  const provider = await prisma.providerConfig.update({
    where: { id: req.params.id },
    data: { isActive: !existing.isActive },
  });

  res.json({
    success: true,
    data: {
      ...provider,
      apiKey: provider.apiKey ? maskApiKey(provider.apiKey) : null,
      apiSecret: provider.apiSecret ? maskApiKey(provider.apiSecret) : null,
    },
    message: `Provider ${provider.isActive ? 'enabled' : 'disabled'} successfully`,
  });
}));

/**
 * 迁移现有未加密的ProviderConfig密钥
 * 用于一次性加密数据库中已有的明文密钥
 */
aiProviderRouter.post('/migrate-encryption', requireAdmin, asyncHandler(async (_req, res) => {
  const allProviders = await prisma.providerConfig.findMany();

  let migrated = 0;
  let alreadyEncrypted = 0;
  let failed = 0;

  for (const provider of allProviders) {
    try {
      let needsUpdate = false;
      const updateData: any = {};

      if (provider.apiKey && !isEncrypted(provider.apiKey)) {
        updateData.apiKey = encryptForStorage(provider.apiKey);
        needsUpdate = true;
      }

      if (provider.apiSecret && !isEncrypted(provider.apiSecret)) {
        updateData.apiSecret = encryptForStorage(provider.apiSecret);
        needsUpdate = true;
      }

      if (needsUpdate) {
        await prisma.providerConfig.update({
          where: { id: provider.id },
          data: updateData,
        });
        migrated++;
      } else {
        alreadyEncrypted++;
      }
    } catch (error) {
      failed++;
      logger.error(`迁移Provider ${provider.id} 密钥失败`, {
        providerId: provider.id,
        provider: provider.provider,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  res.json({
    success: true,
    data: {
      migrated,
      alreadyEncrypted,
      failed,
      total: allProviders.length,
    },
    message: `迁移完成: ${migrated}个已加密, ${alreadyEncrypted}个已跳过, ${failed}个失败`,
  });
}));

// ========== 秘钥管理 API ==========

aiProviderRouter.get('/:id/keys', requireAdmin, asyncHandler(async (req, res) => {
  const provider = await prisma.providerConfig.findUnique({ where: { id: req.params.id } });
  if (!provider) {
    throw new NotFoundError('服务商不存在');
  }

  const keys = await ProviderKeyManager.getKeysForProvider(provider.provider);
  const stats = await ProviderKeyManager.getKeyStats(provider.provider);

  res.json({ success: true, data: { keys, stats } });
}));

aiProviderRouter.post('/:id/keys', requireAdmin, asyncHandler(async (req, res) => {
  const provider = await prisma.providerConfig.findUnique({ where: { id: req.params.id } });
  if (!provider) {
    throw new NotFoundError('服务商不存在');
  }

  const { keyLabel, apiKey, quotaTotal, priority, modelScope, weight, maxConcurrency } = req.body;
  if (!keyLabel || !apiKey) {
    throw new ValidationError('keyLabel 和 apiKey 为必填');
  }

  const key = await ProviderKeyManager.addKey({
    providerName: provider.provider,
    keyLabel,
    apiKey,
    modelScope,
    weight,
    maxConcurrency,
    quotaTotal: quotaTotal || 0,
    priority,
  });

  res.status(201).json({ success: true, data: key });
}));

aiProviderRouter.put('/:id/keys/:keyId', requireAdmin, asyncHandler(async (req, res) => {
  const { keyLabel, apiKey, quotaTotal, quotaUsed, isActive, priority, modelScope, weight, maxConcurrency } = req.body;
  const key = await ProviderKeyManager.updateKey(req.params.keyId, {
    keyLabel,
    apiKey,
    modelScope,
    weight,
    maxConcurrency,
    quotaTotal,
    quotaUsed,
    isActive,
    priority,
  });

  res.json({ success: true, data: key });
}));

aiProviderRouter.delete('/:id/keys/:keyId', requireAdmin, asyncHandler(async (req, res) => {
  await ProviderKeyManager.deleteKey(req.params.keyId);
  res.json({ success: true, message: '秘钥已删除' });
}));

aiProviderRouter.post('/:id/keys/:keyId/reset', requireAdmin, asyncHandler(async (req, res) => {
  const { quotaTotal } = req.body;
  const key = await ProviderKeyManager.resetKeyQuota(req.params.keyId, quotaTotal);
  res.json({ success: true, data: key });
}));

aiProviderRouter.get('/:id/keys/stats', requireAdmin, asyncHandler(async (req, res) => {
  const provider = await prisma.providerConfig.findUnique({ where: { id: req.params.id } });
  if (!provider) {
    throw new NotFoundError('服务商不存在');
  }

  const stats = await ProviderKeyManager.getKeyStats(provider.provider);
  res.json({ success: true, data: stats });
}));

aiProviderRouter.post('/:id/keys/batch-import', requireAdmin, asyncHandler(async (req, res) => {
  const provider = await prisma.providerConfig.findUnique({ where: { id: req.params.id } });
  if (!provider) {
    throw new NotFoundError('服务商不存在');
  }

  const { keys, quotaPerKey, modelScope, weight, maxConcurrency } = req.body;
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new ValidationError('keys 必须为非空数组');
  }

  const result = await ProviderKeyManager.batchImport(
    provider.provider,
    keys,
    typeof quotaPerKey === 'number' ? quotaPerKey : 30,
    {
      modelScope: typeof modelScope === 'string' ? modelScope : null,
      weight: typeof weight === 'number' ? weight : 1,
      maxConcurrency: typeof maxConcurrency === 'number' ? maxConcurrency : 1,
    }
  );

  res.json({ success: true, data: result });
}));

aiProviderRouter.patch('/:id/keys/reorder', requireAdmin, asyncHandler(async (req, res) => {
  const provider = await prisma.providerConfig.findUnique({ where: { id: req.params.id } });
  if (!provider) {
    throw new NotFoundError('服务商不存在');
  }

  const { keyIds } = req.body;
  if (!Array.isArray(keyIds) || keyIds.length === 0) {
    throw new ValidationError('keyIds 必须为非空数组');
  }

  const keys = await ProviderKeyManager.reorderKeys(provider.provider, keyIds);
  res.json({ success: true, data: { keys } });
}));

aiProviderRouter.patch('/:id/keys/:keyId/move', requireAdmin, asyncHandler(async (req, res) => {
  const { direction } = req.body;
  if (direction !== 'up' && direction !== 'down') {
    throw new ValidationError('direction 必须是 up 或 down');
  }

  const keys = await ProviderKeyManager.moveKey(req.params.keyId, direction);
  res.json({ success: true, data: { keys } });
}));

/**
 * 获取指定 AI Provider 的配置
 * 用于其他路由模块获取 Provider API 密钥
 */
export async function getApiProviderConfig(provider: string): Promise<{
  apiKey: string | null;
  apiSecret: string | null;
  endpoint: string | null;
} | null> {
  try {
    const activeKey = await ProviderKeyManager.getActiveKey(provider);
    if (activeKey) {
      const providerConfig = await prisma.providerConfig.findUnique({
        where: { provider },
        select: { endpoint: true, apiSecret: true },
      });
      let apiSecret: string | null = null;
      if (providerConfig?.apiSecret) {
        try {
          apiSecret = decryptFromStorage(providerConfig.apiSecret);
        } catch {
          apiSecret = providerConfig.apiSecret;
        }
      }
      return {
        apiKey: activeKey.key,
        apiSecret,
        endpoint: providerConfig?.endpoint || null,
      };
    }

    const providerConfig = await prisma.providerConfig.findUnique({
      where: { provider },
      select: {
        provider: true,
        apiKey: true,
        apiSecret: true,
        endpoint: true,
        isActive: true,
      },
    });

    if (!providerConfig || !providerConfig.isActive) {
      return null;
    }

    const secrets = decryptProviderSecrets(providerConfig);

    return {
      apiKey: secrets.apiKey,
      apiSecret: secrets.apiSecret,
      endpoint: providerConfig.endpoint,
    };
  } catch (error) {
    logger.error(`[getApiProviderConfig] 获取 ${provider} 配置失败`, {
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export const aiProviderPublicRouter = Router();

aiProviderPublicRouter.use(optionalAuth);

aiProviderPublicRouter.get('/', asyncHandler(async (_req, res) => {
  const providers = await prisma.providerConfig.findMany({
    where: { isActive: true },
    select: {
      provider: true,
      name: true,
      displayName: true,
      isActive: true,
      config: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const result = providers.filter((provider) =>
    !isCustomModelConfig(parseProviderConfig(provider.config))
  ).map(p => {
    const config = parseProviderConfig(p.config);
    return {
      name: p.provider,
      displayName: p.displayName || p.name,
      available: true,
      models: getProviderModels(config, p.provider).filter((model) =>
        typeof model === 'string' ? true : model.isActive !== false
      ),
    };
  });

  // 补充环境变量中已配置但数据库中不存在的 provider
  const envFallbacks = getCredentialEnvFallback();
  const envDisplayNames: Record<string, string> = {
    doubao: '豆包/Seedance',
    vidu: 'Vidu',
    minimax: 'MiniMax',
    jimeng: '即梦 (Jimeng)',
    seedream: 'Seedream (豆包图片/视频)',
    wuyinkeji: '小天API (小天AICG2)',
    sensenova: 'SenseNova',
    stepfun: 'StepFun',
    };
  const allDbProviders = await prisma.providerConfig.findMany({
    select: { provider: true },
  });
  const dbProviderNames = new Set(allDbProviders.map(p => p.provider));
  for (const [providerId, creds] of Object.entries(envFallbacks)) {
    if (!dbProviderNames.has(providerId) && creds.apiKey) {
      result.push({
        name: providerId,
        displayName: envDisplayNames[providerId] || providerId,
        available: true,
        models: getDefaultModelsForProvider(providerId),
      });
    }
  }

  res.json({ success: true, data: result });
}));
