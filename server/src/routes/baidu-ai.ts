import { Router } from 'express';
import axios from 'axios';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { getApiProviderConfig } from './ai-provider';

const BAIDU_API_ORIGIN = 'https://aip.baidubce.com';
const MAX_BASE64_LENGTH = 8 * 1024 * 1024;

const imageRequestSchema = z.object({
  image: z.string().min(1).max(MAX_BASE64_LENGTH),
  type: z.enum(['foreground', 'labelmap', 'scoremap']).optional(),
});

interface BaiduCredentials {
  apiKey: string;
  secretKey: string;
}

interface CachedToken {
  value: string;
  expiresAt: number;
  source: string;
}

let cachedToken: CachedToken | null = null;

async function getBaiduCredentials(): Promise<BaiduCredentials> {
  const provider = await getApiProviderConfig('baidu');
  const apiKey = provider?.apiKey || process.env.BAIDU_API_KEY || '';
  const secretKey = provider?.apiSecret || process.env.BAIDU_SECRET_KEY || '';

  if (!apiKey || !secretKey) {
    throw new Error('百度 AI Provider 未配置');
  }

  return { apiKey, secretKey };
}

async function getBaiduAccessToken(): Promise<string> {
  const credentials = await getBaiduCredentials();
  const bearerToken = [credentials.secretKey, credentials.apiKey].find(value => value.startsWith('bce-v3/'));
  if (bearerToken) return bearerToken;

  const source = `${credentials.apiKey}:${credentials.secretKey}`;
  if (cachedToken && cachedToken.source === source && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const response = await axios.post(`${BAIDU_API_ORIGIN}/oauth/2.0/token`, null, {
    params: {
      grant_type: 'client_credentials',
      client_id: credentials.apiKey,
      client_secret: credentials.secretKey,
    },
    timeout: 15_000,
  });

  const accessToken = String(response.data?.access_token || '');
  if (!accessToken) {
    throw new Error('百度 AI Token 获取失败');
  }

  const expiresIn = Math.max(300, Number(response.data?.expires_in || 3600));
  cachedToken = {
    value: accessToken,
    expiresAt: Date.now() + (expiresIn - 300) * 1000,
    source,
  };
  return accessToken;
}

async function callBaiduImageApi(
  endpoint: '/rest/2.0/image-classify/v1/body_seg' | '/rest/2.0/image-process/v1/image_definition_enhance',
  image: string,
  type?: string
): Promise<Record<string, unknown>> {
  const accessToken = await getBaiduAccessToken();
  const bearer = accessToken.startsWith('bce-v3/');
  const body = new URLSearchParams({ image });
  if (type) body.set('type', type);

  const response = await axios.post(
    `${BAIDU_API_ORIGIN}${endpoint}${bearer ? '' : `?access_token=${encodeURIComponent(accessToken)}`}`,
    body.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(bearer ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      timeout: 120_000,
      maxBodyLength: 10 * 1024 * 1024,
      maxContentLength: 20 * 1024 * 1024,
    }
  );

  const data = response.data as Record<string, unknown>;
  if (data.error_code) {
    throw new Error(`百度 AI 请求失败: ${String(data.error_msg || data.error_code)}`);
  }
  return data;
}

export const baiduAiRouter = Router();

baiduAiRouter.use(authenticate);

baiduAiRouter.get('/status', asyncHandler(async (_req: AuthRequest, res) => {
  await getBaiduAccessToken();
  res.json({ success: true, data: { configured: true } });
}));

baiduAiRouter.post('/body-seg', asyncHandler(async (req: AuthRequest, res) => {
  const input = imageRequestSchema.parse(req.body);
  const data = await callBaiduImageApi('/rest/2.0/image-classify/v1/body_seg', input.image, input.type);
  res.json({ success: true, data });
}));

baiduAiRouter.post('/enhance', asyncHandler(async (req: AuthRequest, res) => {
  const input = imageRequestSchema.omit({ type: true }).parse(req.body);
  const data = await callBaiduImageApi('/rest/2.0/image-process/v1/image_definition_enhance', input.image);
  res.json({ success: true, data });
}));
