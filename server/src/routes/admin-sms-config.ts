import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { smsService } from '../services/sms-service';

export const adminSmsConfigRouter = Router();

adminSmsConfigRouter.use(authenticate, requireAdmin);

const smsConfigSchema = z.object({
  provider: z.enum(['aliyun_dypns', 'aliyun', 'tencent', 'mock']).optional(),
  accessKeyId: z.string().optional(),
  accessKeySecret: z.string().optional(),
  signName: z.string().optional(),
  templateCode: z.string().optional(),
  schemeName: z.string().optional(),
  isActive: z.boolean().optional(),
});

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function getStoredSmsProvider(value: string | undefined): string {
  if (!value) return 'mock';
  try {
    return JSON.parse(value).provider || 'mock';
  } catch {
    return 'mock';
  }
}

// ==================== 获取短信配置 ====================
adminSmsConfigRouter.get('/', asyncHandler(async (req, res, next) => {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'sms_config' },
    });

    let finalConfig: any = {
      provider: 'mock',
      accessKeyId: '',
      accessKeySecret: '',
      signName: '',
      templateCode: '',
      schemeName: '',
      isActive: false,
    };

    if (config) {
      finalConfig = JSON.parse(config.value);
    }

    // 环境变量覆盖
    const envProvider = process.env.SMS_PROVIDER || '';
    const envAccessKeyId = process.env.SMS_ACCESS_KEY_ID || '';
    const envAccessKeySecret = process.env.SMS_ACCESS_KEY_SECRET || '';
    const envSignName = process.env.SMS_SIGN_NAME || '';
    const envTemplateCode = process.env.SMS_TEMPLATE_CODE || '';
    const envSchemeName = process.env.SMS_SCHEME_NAME || '';

    if (envProvider) finalConfig.provider = envProvider;
    if (envAccessKeyId) finalConfig.accessKeyId = envAccessKeyId;
    if (envSignName) finalConfig.signName = envSignName;
    if (envTemplateCode) finalConfig.templateCode = envTemplateCode;
    if (envSchemeName) finalConfig.schemeName = envSchemeName;

    // 密钥脱敏
    if (finalConfig.accessKeySecret !== '********' && envAccessKeySecret) {
      finalConfig.accessKeySecret = envAccessKeySecret;
    }
    if (finalConfig.accessKeySecret) {
      finalConfig.accessKeySecret = '********';
    }

    finalConfig.isConfigured = !!(finalConfig.accessKeyId && finalConfig.provider !== 'mock');
    finalConfig.runtimeProvider = smsService.getConfig().provider;

    res.json({
      success: true,
      data: finalConfig,
    });
  } catch (error: unknown) {
    next(error);
  }
}));

// ==================== 保存短信配置 ====================
adminSmsConfigRouter.post('/', asyncHandler(async (req, res, next) => {
  try {
    const validatedData = smsConfigSchema.parse(req.body);

    if (isProduction() && validatedData.provider === 'mock') {
      return res.status(400).json({
        success: false,
        error: '生产环境禁止保存模拟短信服务商，请配置阿里云或腾讯云短信。',
      });
    }

    const existingConfig = await prisma.systemConfig.findUnique({
      where: { key: 'sms_config' },
    });

    let currentConfig: any = {};
    if (existingConfig) {
      currentConfig = JSON.parse(existingConfig.value);
    }

    const updatedConfig = {
      ...currentConfig,
      ...validatedData,
      updatedAt: new Date().toISOString(),
    };

    if (isProduction() && updatedConfig.provider === 'mock') {
      return res.status(400).json({
        success: false,
        error: '生产环境禁止使用模拟短信服务商，请切换为真实服务商后保存。',
      });
    }

    // 保留原有密钥（如果传入的是 ********）
    if (updatedConfig.accessKeySecret === '********' && currentConfig.accessKeySecret && currentConfig.accessKeySecret !== '********') {
      updatedConfig.accessKeySecret = currentConfig.accessKeySecret;
    }

    if (existingConfig) {
      await prisma.systemConfig.update({
        where: { key: 'sms_config' },
        data: { value: JSON.stringify(updatedConfig) },
      });
    } else {
      await prisma.systemConfig.create({
        data: {
          key: 'sms_config',
          value: JSON.stringify(updatedConfig),
          description: '阿里云短信服务配置',
        },
      });
    }

    // 同步到环境变量
    await updateEnvFile({
      SMS_PROVIDER: updatedConfig.provider || 'mock',
      SMS_ACCESS_KEY_ID: updatedConfig.accessKeyId || '',
      SMS_ACCESS_KEY_SECRET: updatedConfig.accessKeySecret || '',
      SMS_SIGN_NAME: updatedConfig.signName || '',
      SMS_TEMPLATE_CODE: updatedConfig.templateCode || '',
      SMS_SCHEME_NAME: updatedConfig.schemeName || '',
    });

    // 更新运行时环境变量
    if (updatedConfig.provider) process.env.SMS_PROVIDER = updatedConfig.provider;
    if (updatedConfig.accessKeyId) process.env.SMS_ACCESS_KEY_ID = updatedConfig.accessKeyId;
    if (updatedConfig.accessKeySecret && updatedConfig.accessKeySecret !== '********') {
      process.env.SMS_ACCESS_KEY_SECRET = updatedConfig.accessKeySecret;
    }
    if (updatedConfig.signName) process.env.SMS_SIGN_NAME = updatedConfig.signName;
    if (updatedConfig.templateCode) process.env.SMS_TEMPLATE_CODE = updatedConfig.templateCode;
    if (updatedConfig.schemeName) process.env.SMS_SCHEME_NAME = updatedConfig.schemeName;

    const responseConfig = { ...updatedConfig };
    if (responseConfig.accessKeySecret) {
      responseConfig.accessKeySecret = '********';
    }

    res.json({
      success: true,
      data: responseConfig,
      message: '短信配置已保存，环境变量已同步更新。需要重启后端使 SDK 客户端重新初始化。',
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: '验证错误',
        details: error.errors,
      });
    }
    next(error);
  }
}));

// ==================== 测试发送短信 ====================
adminSmsConfigRouter.post('/test-send', asyncHandler(async (req, res, next) => {
  try {
    const { phone, countryCode } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: '需要提供手机号' });
    }

    if (isProduction()) {
      const config = await prisma.systemConfig.findUnique({
        where: { key: 'sms_config' },
        select: { value: true },
      });
      const runtimeProvider = process.env.SMS_PROVIDER || getStoredSmsProvider(config?.value);
      if (runtimeProvider === 'mock') {
        return res.status(400).json({
          success: false,
          error: '生产环境禁止使用模拟短信发送测试，请先配置真实短信服务商。',
        });
      }
    }

    const result = await smsService.sendVerificationCode(phone, 'verification', undefined, countryCode || '86');

    if (result.success) {
      res.json({
        success: true,
        message: `测试短信已发送至 ${phone}`,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || '短信发送失败',
      });
    }
  } catch (error: unknown) {
    next(error);
  }
}));

// ==================== 短信发送统计 ====================
adminSmsConfigRouter.get('/stats', asyncHandler(async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [totalSent, sentSuccess, sentFailed, recentLogs] = await Promise.all([
      prisma.smsVerification.count({ where }),
      prisma.smsVerification.count({ where: { ...where, status: 'sent' } }),
      prisma.smsVerification.count({ where: { ...where, status: 'failed' } }),
      prisma.smsVerification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          phone: true,
          countryCode: true,
          type: true,
          status: true,
          attempts: true,
          createdAt: true,
        },
      }),
    ]);

    const byType = await prisma.smsVerification.groupBy({
      by: ['type'],
      where,
      _count: true,
    });

    const byStatus = await prisma.smsVerification.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    res.json({
      success: true,
      data: {
        totalSent,
        sentSuccess,
        sentFailed,
        successRate: totalSent > 0 ? ((sentSuccess / totalSent) * 100).toFixed(2) : '0',
        byType,
        byStatus,
        recentLogs,
      },
    });
  } catch (error: unknown) {
    next(error);
  }
}));

// ==================== 重置配置 ====================
adminSmsConfigRouter.post('/reset', asyncHandler(async (req, res, next) => {
  try {
    await prisma.systemConfig.deleteMany({
      where: { key: 'sms_config' },
    });

    res.json({
      success: true,
      message: '短信配置已重置为默认值',
    });
  } catch (error: unknown) {
    next(error);
  }
}));

// ==================== 工具函数 ====================
async function updateEnvFile(envVars: Record<string, string>): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  const envPath = path.join(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) {
    logger.warn('.env file not found, skipping env update');
    return;
  }

  let envContent = fs.readFileSync(envPath, 'utf-8');

  for (const [key, value] of Object.entries(envVars)) {
    if (!value && value !== '0') continue;

    const regex = new RegExp(`^${key}=.*`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(envPath, envContent);
  logger.info('[SMS Config] Environment file updated successfully');
}
