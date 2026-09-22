import prisma from '../lib/prisma';
import { decrypt, encrypt } from '../utils/encryption';

type VaultEntry = Record<string, unknown> & { provider?: string };

function parseVaultEntries(value?: string | null): VaultEntry[] {
  if (!value) return [];
  try {
    const payload = JSON.parse(decrypt(value));
    return Array.isArray(payload?.entries) ? payload.entries : [];
  } catch {
    return [];
  }
}

export interface UserModelCredential {
  apiKey?: string;
  apiSecret?: string;
  accessKey?: string;
  secretKey?: string;
  baseUrl?: string;
  selectedModel?: string;
  protocol?: 'openai' | 'anthropic';
}

/** 仅在服务端解析个人凭据；调用方不得将返回值写入响应、日志或任务参数。 */
export async function getUserModelCredential(userId: string, provider: string): Promise<UserModelCredential | null> {
  const vault = await prisma.userModelCredentialVault.findUnique({
    where: { userId },
    select: { encryptedPayload: true },
  });
  if (!vault?.encryptedPayload) return null;
  try {
    const payload = JSON.parse(decrypt(vault.encryptedPayload));
    const entry = Array.isArray(payload?.entries)
      ? payload.entries.find((item: any) => item?.provider === provider && item?.enabled !== false)
      : null;
    if (!entry || typeof entry !== 'object') return null;
    return {
      apiKey: typeof entry.apiKey === 'string' ? entry.apiKey : undefined,
      apiSecret: typeof entry.apiSecret === 'string' ? entry.apiSecret : undefined,
      accessKey: typeof entry.accessKey === 'string' ? entry.accessKey : undefined,
      secretKey: typeof entry.secretKey === 'string' ? entry.secretKey : undefined,
      baseUrl: typeof entry.baseUrl === 'string' ? entry.baseUrl : undefined,
      selectedModel: typeof entry.selectedModel === 'string' ? entry.selectedModel : undefined,
      protocol: entry.protocol === 'openai' || entry.protocol === 'anthropic' ? entry.protocol : undefined,
    };
  } catch {
    return null;
  }
}

/** 删除个人模型凭据；调用方仍需自行校验模型定义的归属权限。 */
export async function removeUserModelCredential(userId: string, provider: string): Promise<{ usedBytes: number }> {
  const vault = await prisma.userModelCredentialVault.findUnique({ where: { userId } });
  const entries = parseVaultEntries(vault?.encryptedPayload).filter((entry) => entry.provider !== provider);
  const payload = JSON.stringify({ version: 1, entries });
  const payloadBytes = Buffer.byteLength(payload, 'utf8');
  await prisma.userModelCredentialVault.upsert({
    where: { userId },
    create: { userId, encryptedPayload: encrypt(payload), payloadBytes },
    update: { encryptedPayload: encrypt(payload), payloadBytes },
  });
  return { usedBytes: payloadBytes };
}
