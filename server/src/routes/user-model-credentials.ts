import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { decrypt, encrypt } from '../utils/encryption';
import { isLocalOnlyMode } from '../utils/local-mode';

export const userModelCredentialsRouter = Router();

const MAX_VAULT_BYTES = 2 * 1024 * 1024;
const MAX_ENTRIES = 100;
const secretFields = ['apiKey', 'apiSecret', 'accessKey', 'secretKey'] as const;

type CredentialEntry = {
  provider: string;
  enabled: boolean;
  displayName?: string;
  protocol?: 'openai' | 'anthropic';
  selectedModel?: string;
  baseUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  accessKey?: string;
  secretKey?: string;
  updatedAt: string;
};

const entrySchema = z.object({
  provider: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9_.-]+$/, 'provider 格式不正确'),
  enabled: z.boolean().optional(),
  displayName: z.string().trim().max(120).optional(),
  protocol: z.enum(['openai', 'anthropic']).optional(),
  selectedModel: z.string().trim().max(200).optional(),
  baseUrl: z.string().trim().url().max(1000).optional(),
  apiKey: z.string().trim().max(65536).optional(),
  apiSecret: z.string().trim().max(65536).optional(),
  accessKey: z.string().trim().max(65536).optional(),
  secretKey: z.string().trim().max(65536).optional(),
  clearSecretFields: z.boolean().optional(),
});

function validatePublicHttpsEndpoint(baseUrl?: string) {
  if (!baseUrl) return;
  // 开源本地模式：允许本机/内网端点（如 localhost 的 Ollama / LM Studio）
  if (isLocalOnlyMode()) return;
  const parsed = new URL(baseUrl);
  const hostname = parsed.hostname.toLowerCase();
  const privateIPv4 = /^(?:10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.)/.test(hostname);
  if (parsed.protocol !== 'https:' || hostname === 'localhost' || hostname.endsWith('.local') || privateIPv4) {
    throw new AppError('个人模型接口必须为公网 HTTPS 地址，不能使用本机或内网地址', 400);
  }
}

function parseVault(value?: string | null): CredentialEntry[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(decrypt(value));
    return Array.isArray(parsed?.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

function publicEntry(entry: CredentialEntry) {
  const hasCredentials = secretFields.some((field) => Boolean(entry[field]?.trim()));
  const secret = entry.apiKey || entry.accessKey || entry.apiSecret || entry.secretKey || '';
  const maskedApiKey = secret.length > 8
    ? `${secret.slice(0, 4)}••••${secret.slice(-4)}`
    : secret
      ? `${secret.slice(0, 2)}••••`
      : '';
  return {
    provider: entry.provider,
    enabled: entry.enabled !== false,
    displayName: entry.displayName || '',
    protocol: entry.protocol,
    selectedModel: entry.selectedModel || '',
    baseUrl: entry.baseUrl || '',
    hasCredentials,
    maskedApiKey,
    updatedAt: entry.updatedAt,
  };
}

userModelCredentialsRouter.use(authenticate);

userModelCredentialsRouter.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const vault = await prisma.userModelCredentialVault.findUnique({ where: { userId: req.userId! } });
  const entries = parseVault(vault?.encryptedPayload);
  res.json({
    success: true,
    data: {
      entries: entries.map(publicEntry),
      usedBytes: vault?.payloadBytes || 0,
      limitBytes: MAX_VAULT_BYTES,
    },
  });
}));

userModelCredentialsRouter.put('/:provider', asyncHandler(async (req: AuthRequest, res) => {
  const input = entrySchema.parse({ ...req.body, provider: req.params.provider });
  validatePublicHttpsEndpoint(input.baseUrl);
  const vault = await prisma.userModelCredentialVault.findUnique({ where: { userId: req.userId! } });
  const entries = parseVault(vault?.encryptedPayload);
  const existing = entries.find((entry) => entry.provider === input.provider);
  const next: CredentialEntry = {
    ...(existing || { provider: input.provider, enabled: true, updatedAt: new Date().toISOString() }),
    provider: input.provider,
    enabled: input.enabled ?? existing?.enabled ?? true,
    displayName: input.displayName ?? existing?.displayName,
    protocol: input.protocol ?? existing?.protocol,
    selectedModel: input.selectedModel ?? existing?.selectedModel,
    baseUrl: input.baseUrl ?? existing?.baseUrl,
    updatedAt: new Date().toISOString(),
  };
  for (const field of secretFields) {
    if (input.clearSecretFields) delete next[field];
    else if (input[field] !== undefined && input[field] !== '') next[field] = input[field];
  }
  const nextEntries = [...entries.filter((entry) => entry.provider !== input.provider), next];
  if (nextEntries.length > MAX_ENTRIES) throw new AppError('个人模型配置数量超过上限', 413);
  const payload = JSON.stringify({ version: 1, entries: nextEntries });
  const payloadBytes = Buffer.byteLength(payload, 'utf8');
  if (payloadBytes > MAX_VAULT_BYTES) throw new AppError('个人模型配置超过 2MB 空间上限', 413);
  await prisma.userModelCredentialVault.upsert({
    where: { userId: req.userId! },
    create: { userId: req.userId!, encryptedPayload: encrypt(payload), payloadBytes },
    update: { encryptedPayload: encrypt(payload), payloadBytes, version: 1 },
  });
  res.json({ success: true, data: { entry: publicEntry(next), usedBytes: payloadBytes, limitBytes: MAX_VAULT_BYTES } });
}));

userModelCredentialsRouter.delete('/:provider', asyncHandler(async (req: AuthRequest, res) => {
  const vault = await prisma.userModelCredentialVault.findUnique({ where: { userId: req.userId! } });
  const entries = parseVault(vault?.encryptedPayload).filter((entry) => entry.provider !== req.params.provider);
  const payload = JSON.stringify({ version: 1, entries });
  const payloadBytes = Buffer.byteLength(payload, 'utf8');
  await prisma.userModelCredentialVault.upsert({
    where: { userId: req.userId! },
    create: { userId: req.userId!, encryptedPayload: encrypt(payload), payloadBytes },
    update: { encryptedPayload: encrypt(payload), payloadBytes },
  });
  res.json({ success: true, data: { usedBytes: payloadBytes, limitBytes: MAX_VAULT_BYTES } });
}));
