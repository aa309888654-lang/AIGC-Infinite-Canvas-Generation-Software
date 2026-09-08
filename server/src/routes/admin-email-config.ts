import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { z } from 'zod';
import * as TencentCloud from 'tencentcloud-sdk-nodejs';
import { buildPublicUrl } from '../utils/public-urls';

export const adminEmailConfigRouter = Router();
const SESClient = TencentCloud.ses.v20201002.Client;

adminEmailConfigRouter.use(authenticate, requireAdmin);

const emailConfigSchema = z.object({
  secretId: z.string().optional(),
  secretKey: z.string().optional(),
  region: z.string().optional(),
  domain: z.string().optional(),
  sender: z.string().optional(),
  templateId: z.number().optional(),
  callbackUrl: z.string().optional(),
  callbackSecret: z.string().optional(),
  isActive: z.boolean().optional(),
});

adminEmailConfigRouter.get('/', asyncHandler(async (req, res, next) => {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'tencent_email_config' },
    });

    let finalConfig: any = {
      secretId: '',
      secretKey: '',
      region: 'ap-guangzhou',
      domain: '',
      sender: '',
      templateId: 0,
      callbackUrl: '',
      callbackSecret: '',
      isActive: false,
    };

    if (config) {
      finalConfig = JSON.parse(config.value);
    }

    const envSecretId = process.env.TENCENT_EMAIL_SECRET_ID || '';
    const envSecretKey = process.env.TENCENT_EMAIL_SECRET_KEY || '';
    const envDomain = process.env.TENCENT_EMAIL_DOMAIN || '';
    const envSender = process.env.TENCENT_EMAIL_SENDER || '';
    const envTemplateId = process.env.TENCENT_EMAIL_TEMPLATE_ID || '';
    const defaultCallbackUrl = buildPublicUrl('/api/email-callback/account');
    const envCallbackUrl = process.env.TENCENT_EMAIL_ACCOUNT_CALLBACK_URL || defaultCallbackUrl;
    const envRegion = process.env.TENCENT_EMAIL_REGION || 'ap-guangzhou';

    if (envSecretId) finalConfig.secretId = envSecretId;
    if (envDomain) finalConfig.domain = envDomain;
    if (envSender) finalConfig.sender = envSender;
    if (envTemplateId) finalConfig.templateId = parseInt(envTemplateId) || 0;
    if (envCallbackUrl) finalConfig.callbackUrl = envCallbackUrl;
    if (envRegion) finalConfig.region = envRegion;

    if (finalConfig.secretKey !== '********' && envSecretKey) {
      finalConfig.secretKey = envSecretKey;
    }

    if (finalConfig.secretKey) {
      finalConfig.secretKey = '********';
    }

    finalConfig.isConfigured = !!(finalConfig.secretId && finalConfig.sender && finalConfig.templateId);

    res.json({
      success: true,
      data: finalConfig,
    });
  } catch (error: unknown) {
    next(error);
  }
}));

adminEmailConfigRouter.post('/', asyncHandler(async (req, res, next) => {
  try {
    const validatedData = emailConfigSchema.parse(req.body);

    const existingConfig = await prisma.systemConfig.findUnique({
      where: { key: 'tencent_email_config' },
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

    if (updatedConfig.secretKey === '********' && currentConfig.secretKey && currentConfig.secretKey !== '********') {
      updatedConfig.secretKey = currentConfig.secretKey;
    }

    if (existingConfig) {
      await prisma.systemConfig.update({
        where: { key: 'tencent_email_config' },
        data: {
          value: JSON.stringify(updatedConfig),
        },
      });
    } else {
      await prisma.systemConfig.create({
        data: {
          key: 'tencent_email_config',
          value: JSON.stringify(updatedConfig),
          description: '腾讯云邮件服务配置',
        },
      });
    }

    await updateEnvFile({
      TENCENT_EMAIL_SECRET_ID: updatedConfig.secretId || '',
      TENCENT_EMAIL_SECRET_KEY: updatedConfig.secretKey || '',
      TENCENT_EMAIL_REGION: updatedConfig.region || 'ap-guangzhou',
      TENCENT_EMAIL_DOMAIN: updatedConfig.domain || '',
      TENCENT_EMAIL_SENDER: updatedConfig.sender || '',
      TENCENT_EMAIL_TEMPLATE_ID: String(updatedConfig.templateId || ''),
      TENCENT_EMAIL_ACCOUNT_CALLBACK_URL: updatedConfig.callbackUrl || '',
    });

    const responseConfig = { ...updatedConfig };
    if (responseConfig.secretKey) {
      responseConfig.secretKey = '********';
    }

    res.json({
      success: true,
      data: {
        ...responseConfig,
      },
      message: 'Email configuration saved successfully. Environment file updated.',
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
    if (!value) continue;

    const regex = new RegExp(`^${key}=.*`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(envPath, envContent);
  logger.info('[Email Config] Environment file updated successfully');
}

adminEmailConfigRouter.post('/test', asyncHandler(async (req, res, next) => {
  try {
    const testEmailSchema = z.object({
      email: z.string().email('Invalid email format').optional(),
      config: emailConfigSchema.optional(),
    });

    const { email, config: testConfig } = testEmailSchema.parse(req.body);

    let configToUse = testConfig;

    if (!configToUse) {
      const savedConfig = await prisma.systemConfig.findUnique({
        where: { key: 'tencent_email_config' },
      });

      if (savedConfig) {
        configToUse = JSON.parse(savedConfig.value);
      }
    }

    if (!configToUse) {
      configToUse = {
        secretId: process.env.TENCENT_EMAIL_SECRET_ID || '',
        secretKey: process.env.TENCENT_EMAIL_SECRET_KEY || '',
        region: process.env.TENCENT_EMAIL_REGION || 'ap-guangzhou',
        domain: process.env.TENCENT_EMAIL_DOMAIN || '',
        sender: process.env.TENCENT_EMAIL_SENDER || '',
        templateId: parseInt(process.env.TENCENT_EMAIL_TEMPLATE_ID || '0') || 0,
      };
    }

    if (!configToUse.secretId || !configToUse.sender || !configToUse.templateId) {
      return res.status(400).json({
        success: false,
        error: '未找到邮箱配置，请先进行配置',
      });
    }

    const secretKey = configToUse.secretKey === '********'
      ? process.env.TENCENT_EMAIL_SECRET_KEY || ''
      : configToUse.secretKey;

    const client = new SESClient({
      credential: {
        secretId: configToUse.secretId,
        secretKey,
      },
      region: configToUse.region || 'ap-guangzhou',
    });

    if (!email) {
      res.json({
        success: true,
        message: 'Email configuration is valid (no email sent)',
      });
      return;
    }

    const testCode = Math.floor(Math.random() * 900000 + 100000).toString();

    const response = await client.SendEmail({
      Destination: [email],
      FromEmailAddress: configToUse.sender,
      Subject: 'AICGXT 验证码',
      Template: {
        TemplateID: configToUse.templateId,
        TemplateData: JSON.stringify({ code: testCode }),
      },
    });

    if (response.MessageId) {
      await prisma.emailSendLog.create({
        data: {
          email,
          type: 'test',
          status: 'sent',
          messageId: response.MessageId,
        },
      });

      res.json({
        success: true,
        message: 'Test email sent successfully',
        messageId: response.MessageId,
      });
    } else {
      throw new Error('No MessageId returned');
    }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: '验证错误',
        details: error.errors,
      });
    }
    logger.error('[Email Test] Error:', error);

    await prisma.emailSendLog.create({
      data: {
        email: req.body.email || 'unknown',
        type: 'test',
        status: 'failed',
        errorMessage: (error instanceof Error ? error.message : String(error)) || 'Unknown error',
      },
    });

    res.status(400).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)) || 'Failed to send test email',
    });
  }
}));

adminEmailConfigRouter.get('/stats', asyncHandler(async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    const [totalSent, sentSuccess, sentFailed, recentLogs] = await Promise.all([
      prisma.emailSendLog.count({ where }),
      prisma.emailSendLog.count({ where: { ...where, status: 'sent' } }),
      prisma.emailSendLog.count({ where: { ...where, status: 'failed' } }),
      prisma.emailSendLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const byType = await prisma.emailSendLog.groupBy({
      by: ['type'],
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
        recentLogs,
      },
    });
  } catch (error: unknown) {
    next(error);
  }
}));

adminEmailConfigRouter.post('/test-send', asyncHandler(async (req, res, next) => {
  try {
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ success: false, error: '需要提供收件人邮箱' });
    }

    const savedConfig = await prisma.systemConfig.findUnique({
      where: { key: 'tencent_email_config' },
    });

    let configToUse: any = null;
    if (savedConfig) {
      configToUse = JSON.parse(savedConfig.value);
    }

    if (!configToUse) {
      configToUse = {
        secretId: process.env.TENCENT_EMAIL_SECRET_ID || '',
        secretKey: process.env.TENCENT_EMAIL_SECRET_KEY || '',
        region: process.env.TENCENT_EMAIL_REGION || 'ap-guangzhou',
        domain: process.env.TENCENT_EMAIL_DOMAIN || '',
        sender: process.env.TENCENT_EMAIL_SENDER || '',
        templateId: parseInt(process.env.TENCENT_EMAIL_TEMPLATE_ID || '0') || 0,
      };
    }

    if (!configToUse.secretId || !configToUse.sender || !configToUse.templateId) {
      return res.status(400).json({
        success: false,
        error: '未找到邮箱配置，请先进行配置',
      });
    }

    const secretKey = configToUse.secretKey === '********'
      ? process.env.TENCENT_EMAIL_SECRET_KEY || ''
      : configToUse.secretKey;

    const client = new SESClient({
      credential: { secretId: configToUse.secretId, secretKey },
      region: configToUse.region || 'ap-guangzhou',
    });

    const testCode = Math.floor(Math.random() * 900000 + 100000).toString();

    const response = await client.SendEmail({
      Destination: [to],
      FromEmailAddress: configToUse.sender,
      Subject: 'AICGXT 测试邮件',
      Template: {
        TemplateID: configToUse.templateId,
        TemplateData: JSON.stringify({ code: testCode }),
      },
    });

    if (response.MessageId) {
      await prisma.emailSendLog.create({
        data: { email: to, type: 'test', status: 'sent', messageId: response.MessageId },
      });
      res.json({ success: true, message: 'Test email sent successfully' });
    } else {
      throw new Error('No MessageId returned');
    }
  } catch (error: unknown) {
    logger.error('[Email Test-Send] Error:', error);
    await prisma.emailSendLog.create({
      data: {
        email: req.body.to || 'unknown',
        type: 'test',
        status: 'failed',
        errorMessage: (error instanceof Error ? error.message : String(error)) || 'Unknown error',
      },
    });
    res.status(400).json({ success: false, error: (error instanceof Error ? error.message : String(error)) || 'Failed to send test email' });
  }
}));

adminEmailConfigRouter.post('/reset', asyncHandler(async (req, res, next) => {
  try {
    await prisma.systemConfig.deleteMany({
      where: { key: 'tencent_email_config' },
    });

    res.json({
      success: true,
      message: 'Email configuration reset to defaults',
    });
  } catch (error: unknown) {
    next(error);
  }
}));
