/**
 * 安全代理路由
 * 将前端对第三方 AI API 的请求统一代理到后端，避免 API Key 暴露给客户端
 *
 * 路由格式: /api/v1/proxy/:provider/*
 * - :provider = doubao | vidu | minimax | hailuo | jimeng | seedream 等
 * - * = 原始 API 路径（如 /ent/v2/text2video）
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { decryptProviderSecrets } from './ai-provider';
import prisma from '../lib/prisma';
import { resolveSensenovaApiKey, resolveStepfunApiKey } from '../utils/provider-env-keys';

const router = Router();

/**
 * Provider 配置映射
 * 每个 provider 定义：baseUrl、apiKey 环境变量名、认证方式
 */
const PROVIDER_CONFIGS: Record<string, {
  baseUrl: string;
  envKey: string;
  authType: 'bearer' | 'token' | 'hmac';
  dbProvider?: string;
}> = {
  doubao: {
    baseUrl: process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com',
    envKey: 'DOUBAO_API_KEY',
    authType: 'bearer',
    dbProvider: 'doubao',
  },
  vidu: {
    baseUrl: process.env.VIDU_BASE_URL || 'https://api.vidu.cn',
    envKey: 'VIDU_API_KEY',
    authType: 'token',
    dbProvider: 'vidu',
  },
  minimax: {
    baseUrl: process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat',
    envKey: 'MINIMAX_API_KEY',
    authType: 'bearer',
    dbProvider: 'minimax',
  },
  hailuo: {
    baseUrl: process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat',
    envKey: 'MINIMAX_API_KEY',
    authType: 'bearer',
    dbProvider: 'minimax',
  },
  jimeng: {
    baseUrl: process.env.JIMENG_BASE_URL || 'https://jimeng.jianying.com',
    envKey: 'JIMENG_API_KEY',
    authType: 'bearer',
    dbProvider: 'jimeng',
  },
  seedream: {
    baseUrl: process.env.SEEDREAM_BASE_URL || 'https://jimeng.jianying.com',
    envKey: 'SEEDREAM_API_KEY',
    authType: 'bearer',
    dbProvider: 'seedream',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    envKey: 'DEEPSEEK_API_KEY',
    authType: 'bearer',
  },
  stability: {
    baseUrl: 'https://api.stability.ai',
    envKey: 'STABILITY_API_KEY',
    authType: 'bearer',
  },
  sensenova: {
    baseUrl: process.env.SENSENOVA_BASE_URL || 'https://token.sensenova.cn/v1',
    envKey: 'SENSENOVA_API_KEY',
    authType: 'bearer',
    dbProvider: 'sensenova',
  },
  stepfun: {
    baseUrl: process.env.STEPFUN_BASE_URL || 'https://api.stepfun.com/step_plan/v1',
    envKey: 'STEPFUN_API_KEY',
    authType: 'bearer',
    dbProvider: 'stepfun',
  },
};

/**
 * 从环境变量或数据库获取 API Key
 */
async function resolveApiKey(provider: string): Promise<string | undefined> {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) return undefined;

  // 1. 先从环境变量获取
  const envKey = process.env[config.envKey]
    || (provider === 'sensenova' ? resolveSensenovaApiKey() : undefined)
    || (provider === 'stepfun' ? resolveStepfunApiKey() : undefined);
  if (envKey) return envKey;

  // 2. 从数据库获取
  if (config.dbProvider) {
    try {
      const providerConfig = await prisma.providerConfig.findUnique({
        where: { provider: config.dbProvider },
      });
      if (providerConfig && providerConfig.isActive && providerConfig.apiKey) {
        const secrets = decryptProviderSecrets(providerConfig);
        if (secrets.apiKey) return secrets.apiKey;
      }
    } catch (e) {
      console.warn(`[Proxy] 从数据库获取 ${provider} API Key 失败:`, e instanceof Error ? e.message : String(e));
    }
  }

  return undefined;
}

/**
 * 构建认证头
 */
function buildAuthHeaders(authType: string, apiKey: string): Record<string, string> {
  switch (authType) {
    case 'token':
      return { Authorization: `Token ${apiKey}` };
    case 'bearer':
    default:
      return { Authorization: `Bearer ${apiKey}` };
  }
}

/**
 * 通用代理处理
 * GET/POST /api/v1/proxy/:provider/*
 */
async function handleProxy(req: AuthRequest, res: Response): Promise<void> {
  const provider = req.params.provider;
  const subPath = req.params[0] || '';

  const config = PROVIDER_CONFIGS[provider];
  if (!config) {
    res.status(400).json({ success: false, error: `不支持的 provider: ${provider}` });
    return;
  }

  const apiKey = await resolveApiKey(provider);
  if (!apiKey) {
    res.status(503).json({ success: false, error: `${provider} API 未配置` });
    return;
  }

  const targetUrl = `${config.baseUrl}/${subPath}`.replace(/\/+/g, (m, offset) => offset === 0 ? '/' : m);
  const method = req.method.toUpperCase();

  const authHeaders = buildAuthHeaders(config.authType, apiKey);

  try {
    const axiosConfig: any = {
      method: method === 'GET' ? 'GET' : 'POST',
      url: targetUrl,
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
      validateStatus: () => true, // 不自动抛错
    };

    if (method !== 'GET' && req.body) {
      axiosConfig.data = req.body;
    }

    // GET 请求传递 query 参数
    if (method === 'GET' && Object.keys(req.query).length > 0) {
      axiosConfig.params = req.query;
    }

    const response = await axios(axiosConfig);

    if (response.status >= 400) {
      console.error(`[Proxy] ${provider} API 错误: ${response.status}`, response.data);
      res.status(response.status).json({
        success: false,
        error: `${provider} API 请求失败`,
        details: response.data,
      });
      return;
    }

    res.json(response.data);
  } catch (error: any) {
    console.error(`[Proxy] ${provider} 代理错误:`, error.message);
    res.status(500).json({
      success: false,
      error: `${provider} 代理请求失败: ${error.message}`,
    });
  }
}

// 注册路由 - 需要登录认证
router.all('/:provider/*', requireAuth, handleProxy);

export const secureProxyRouter = router;
