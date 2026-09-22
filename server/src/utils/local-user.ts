import prisma from '../lib/prisma';
import { isLocalOnlyMode } from './local-mode';
import { logger } from './logger';
import bcrypt from 'bcryptjs';

/**
 * 开源版本地单用户标识。
 * 本地模式下所有未登录请求都会以该固定用户身份处理，
 * 从而绕过注册/登录与会员体系，同时保证以 userId 关联的数据模型正常工作。
 */
export const LOCAL_USER_ID = 'local-user';
export const LOCAL_USER_USERNAME = 'local';
export const LOCAL_USER_EMAIL = 'local@local.local';
export const LOCAL_USER_PASSWORD = 'local';

export function isLocalUser(userId?: string): boolean {
  return userId === LOCAL_USER_ID;
}

/**
 * 确保本地用户存在（仅本地模式）。幂等，可安全重复调用。
 */
export async function ensureLocalUser(): Promise<void> {
  if (!isLocalOnlyMode()) return;

  const existing = await prisma.user.findUnique({
    where: { id: LOCAL_USER_ID },
  });
  if (existing) return;

  const hashedPassword = await bcrypt.hash(LOCAL_USER_PASSWORD, 12);
  try {
    await prisma.user.create({
      data: {
        id: LOCAL_USER_ID,
        username: LOCAL_USER_USERNAME,
        email: LOCAL_USER_EMAIL,
        password: hashedPassword,
        role: 'user',
        isActive: true,
      },
    });
    await prisma.userQuota.upsert({
      where: { userId: LOCAL_USER_ID },
      update: {
        storageLimit: 1000000n * 1024n * 1024n,
      },
      create: {
        userId: LOCAL_USER_ID,
        storageLimit: 1000000n * 1024n * 1024n,
      },
    });
    logger.info('🏠 本地模式：本地用户已创建');
  } catch (error: unknown) {
    logger.warn(`本地用户创建失败（可能已存在）: ${error instanceof Error ? error.message : String(error)}`);
  }
}
