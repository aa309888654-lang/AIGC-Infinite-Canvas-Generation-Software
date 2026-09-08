import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { tencentEmailService } from './tencent-email-service';

const CODE_LENGTH = 6;
const CODE_EXPIRE_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export type VerificationType = 'register' | 'reset_password' | 'bind_email' | 'login';

export interface SendVerificationResult {
  success: boolean;
  code?: string;
  token?: string;
  expiresAt?: Date;
  error?: string;
}

export interface VerifyCodeResult {
  success: boolean;
  userId?: string;
  error?: string;
}

export async function sendVerificationCode(
  email: string,
  type: VerificationType,
  ipAddress?: string
): Promise<SendVerificationResult> {
  try {
    logger.info(`[验证码服务] 准备发送验证码到 ${email}, 类型: ${type}`);

    let emailType: 'verification' | 'reset_password' | 'bind_email' = 'verification';
    if (type === 'reset_password') {
      emailType = 'reset_password';
    } else if (type === 'bind_email') {
      emailType = 'bind_email';
    }

    const emailResult = await tencentEmailService.sendVerificationCode(email, emailType, ipAddress);

    if (!emailResult.success) {
      logger.error('[验证码服务] 邮件发送失败:', emailResult.error);
      return {
        success: false,
        error: emailResult.error || 'Failed to send verification email',
      };
    }

    logger.info(`[验证码服务] 验证码已发送成功到 ${email}`);

    return {
      success: true,
      expiresAt: emailResult.expiresAt ? new Date(emailResult.expiresAt) : undefined,
    };
  } catch (error: unknown) {
    logger.error('[验证码服务] 发送验证码失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function verifyCode(
  email: string,
  code: string,
  type: VerificationType
): Promise<VerifyCodeResult> {
  try {
    const purpose = type === 'register' || type === 'login' ? 'verification' : type;
    const result = await tencentEmailService.verifyCode(email, code, purpose);
    return {
      success: result.success,
      userId: result.success ? email : undefined,
      error: result.error,
    };
  } catch (error: unknown) {
    logger.error('[验证码服务] 验证失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function createRegistrationToken(
  email: string,
  username: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const passwordHash = await bcrypt.hash(password, 10);

    // 先检查是否已有注册记录
    const existing = await prisma.userRegistration.findFirst({
      where: { email },
    });

    if (existing) {
      // 更新现有记录
      await prisma.userRegistration.update({
        where: { id: existing.id },
        data: {
          username,
          passwordHash,
          status: 'pending',
          metadata: JSON.stringify({ token, expiresAt }),
        },
      });
    } else {
      // 创建新记录 - 使用 Prisma API 确保跨数据库兼容
      await prisma.userRegistration.create({
        data: {
          id: crypto.randomUUID(),
          userId: '',
          username,
          email,
          passwordHash,
          status: 'pending',
          registrationMethod: 'email',
          metadata: JSON.stringify({ token, expiresAt }),
        },
      });
    }

    return {
      success: true,
      token,
    };
  } catch (error: unknown) {
    logger.error('[验证码服务] 创建注册令牌失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function validateRegistrationToken(
  email: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const codeValid = await tencentEmailService.consumeCode(email, code, 'verification');
    if (!codeValid.success) {
      return { success: false, error: codeValid.error };
    }

    const registration = await prisma.userRegistration.findFirst({
      where: { email },
    });

    if (registration) {
      await prisma.userRegistration.update({
        where: { id: registration.id },
        data: {
          status: 'verified',
        },
      });
    }

    return { success: true };
  } catch (error: unknown) {
    logger.error('[验证码服务] 验证注册令牌失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function approveRegistration(
  registrationId: string,
  adminId: string,
  adminUsername: string,
  note?: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    const registration = await prisma.userRegistration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) {
      return { success: false, error: '注册申请不存在' };
    }

    if (registration.status !== 'verified' && registration.status !== 'pending') {
      return { success: false, error: '注册申请状态无效' };
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: registration.email },
    });

    if (existingUser) {
      return { success: false, error: '用户已存在' };
    }

    const user = await prisma.user.create({
      data: {
        username: registration.username,
        email: registration.email,
        phone: registration.phone || undefined,
        password: registration.passwordHash,
        role: 'user',
        apiQuota: 100,
        usedQuota: 0,
        isActive: true,
        points: 0,
      },
    });

    await prisma.userRegistration.update({
      where: { id: registrationId },
      data: {
        status: 'approved',
        approvalAdminId: adminId,
        approvalNote: note,
        approvedAt: new Date(),
      },
    });

    await prisma.userQuota.create({
      data: {
        userId: user.id,
        dailyLimit: 100,
        dailyUsed: 0,
        monthlyLimit: 1000,
        monthlyUsed: 0,
        concurrentLimit: 3,
        concurrentUsed: 0,
      },
    });

    await prisma.userRateLimit.create({
      data: {
        userId: user.id,
        limit: 60,
        dailyLimit: 1000,
        dailyUsed: 0,
        monthlyLimit: 10000,
        monthlyUsed: 0,
        minuteLimit: 60,
        secondLimit: 10,
        concurrentLimit: 5,
      },
    });

    await prisma.pointsAlert.create({
      data: {
        userId: user.id,
        threshold: 100,
        isEnabled: true,
      },
    });

    logger.info(
      `[验证码服务] 管理员 ${adminUsername} 批准了用户 ${registration.username} 的注册申请`
    );

    return {
      success: true,
      userId: user.id,
    };
  } catch (error: unknown) {
    logger.error('[验证码服务] 批准注册失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function rejectRegistration(
  registrationId: string,
  adminId: string,
  adminUsername: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.userRegistration.update({
      where: { id: registrationId },
      data: {
        status: 'rejected',
        approvalAdminId: adminId,
        approvalNote: reason,
        approvedAt: new Date(),
      },
    });

    logger.info(`[验证码服务] 管理员 ${adminUsername} 拒绝了注册申请 ${registrationId}`);

    return { success: true };
  } catch (error: unknown) {
    logger.error('[验证码服务] 拒绝注册失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
