import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { z } from 'zod';
import crypto from 'crypto';
import { parsePaginationParamsWithNumbers } from '../utils/pagination';
import { logOperation } from '../services/operation-log-service';
import { TokenPayload } from '../utils/jwt';
import { UserInfo } from '../services/permission-service';

export const userApiKeyRouter = Router();

function generateApiKey(): string {
  return `sk-${crypto.randomBytes(32).toString('hex')}`;
}

function generateApiSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 对 API Key / Secret 进行单向哈希，仅存储哈希值
 * 原始值仅在创建时返回一次，之后无法恢复
 */
function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * 验证 API Key / Secret 是否匹配
 */
function verifySecret(secret: string, hash: string): boolean {
  return hashSecret(secret) === hash;
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

function getAdminId(admin: TokenPayload | UserInfo): string {
  return 'userId' in admin ? (admin as any).userId : (admin as any).id;
}

const createKeySchema = z.object({
  userId: z.string(),
  keyName: z.string().min(1).max(50),
  provider: z.string().optional(),
  models: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
  isPrimary: z.boolean().optional(),
  rateLimit: z.number().int().min(1).optional(),
  rateLimitWindow: z.enum(['second', 'minute', 'hour', 'day']).optional(),
  expiresAt: z.string().datetime().optional(),
});

const updateKeySchema = z.object({
  keyName: z.string().min(1).max(50).optional(),
  provider: z.string().optional(),
  models: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
  isPrimary: z.boolean().optional(),
  rateLimit: z.number().int().min(1).optional(),
  rateLimitWindow: z.enum(['second', 'minute', 'hour', 'day']).optional(),
  expiresAt: z.string().datetime().optional(),
});

userApiKeyRouter.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { page, pageSize, userId, provider, isActive, search } = req.query;
    const pagination = parsePaginationParamsWithNumbers(
      Number(page) || undefined,
      Number(pageSize) || undefined
    );

    const where: any = {};

    if (userId) where.userId = userId;
    if (provider) where.provider = provider;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    if (search) {
      where.OR = [
        { keyName: { contains: search as string } },
        { apiKey: { contains: search as string } },
      ];
    }

    const [keys, total] = await Promise.all([
      prisma.userApiKey.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              points: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.userApiKey.count({ where }),
    ]);

    res.json({
      success: true,
      data: keys.map(k => ({
        ...k,
        apiKey: maskKey(k.apiKey),
        apiSecret: k.apiSecret ? '****' : null,
      })),
      meta: {
        page: pagination.page,
        pageSize: pagination.pageSize || pagination.limit,
        total,
        totalPages: Math.ceil(total / (pagination.pageSize || pagination.limit)),
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

userApiKeyRouter.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const data = createKeySchema.parse(req.body);
    const admin = req.user!;

    const existingUser = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!existingUser) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    if (data.isPrimary) {
      await prisma.userApiKey.updateMany({
        where: { userId: data.userId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const apiKey = generateApiKey();
    const apiSecret = generateApiSecret();

    const key = await prisma.userApiKey.create({
      data: {
        userId: data.userId,
        keyName: data.keyName,
        apiKey: hashSecret(apiKey),       // 仅存储哈希
        apiSecret: hashSecret(apiSecret), // 仅存储哈希
        provider: data.provider,
        models: data.models ? JSON.stringify(data.models) : null,
        permissions: data.permissions ? JSON.stringify(data.permissions) : null,
        isPrimary: data.isPrimary || false,
        rateLimit: data.rateLimit || 60,
        rateLimitWindow: data.rateLimitWindow || 'minute',
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    await logOperation({
      adminId: getAdminId(admin),
      adminUsername: admin.username,
      action: 'api_key_create',
      targetType: 'api_key',
      targetId: key.id,
      targetName: key.keyName,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      afterValue: { userId: data.userId, provider: data.provider },
    });

    res.status(201).json({
      success: true,
      message: 'API Key创建成功，请妥善保存密钥，系统不会再次显示',
      data: {
        ...key,
        apiKey,        // 明文仅返回一次
        apiSecret,  // 明文仅返回一次
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

userApiKeyRouter.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const data = updateKeySchema.parse(req.body);
    const admin = req.user!;

    const existing = await prisma.userApiKey.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'API Key不存在' });
    }

    if (data.isPrimary) {
      await prisma.userApiKey.updateMany({
        where: { userId: existing.userId, id: { not: id }, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const updated = await prisma.userApiKey.update({
      where: { id },
      data: {
        keyName: data.keyName,
        provider: data.provider,
        models: data.models ? JSON.stringify(data.models) : undefined,
        permissions: data.permissions ? JSON.stringify(data.permissions) : undefined,
        isPrimary: data.isPrimary,
        rateLimit: data.rateLimit,
        rateLimitWindow: data.rateLimitWindow,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    await logOperation({
      adminId: getAdminId(admin),
      adminUsername: admin.username,
      action: 'api_key_update',
      targetType: 'api_key',
      targetId: id,
      targetName: existing.keyName,
      beforeValue: existing,
      afterValue: data,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'API Key更新成功',
      data: updated,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

userApiKeyRouter.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const admin = req.user!;

    const existing = await prisma.userApiKey.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'API Key不存在' });
    }

    await prisma.userApiKey.delete({ where: { id } });

    await logOperation({
      adminId: getAdminId(admin),
      adminUsername: admin.username,
      action: 'api_key_delete',
      targetType: 'api_key',
      targetId: id,
      targetName: existing.keyName,
      beforeValue: existing,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'API Key已删除',
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

userApiKeyRouter.patch('/:id/toggle', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const admin = req.user!;

    const existing = await prisma.userApiKey.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'API Key不存在' });
    }

    const updated = await prisma.userApiKey.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    await logOperation({
      adminId: getAdminId(admin),
      adminUsername: admin.username,
      action: existing.isActive ? 'api_key_disable' : 'api_key_enable',
      targetType: 'api_key',
      targetId: id,
      targetName: existing.keyName,
      afterValue: { isActive: updated.isActive },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: updated.isActive ? 'API Key已启用' : 'API Key已禁用',
      data: updated,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

userApiKeyRouter.get('/:id/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 7 } = req.query;

    const startDate = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

    const key = await prisma.userApiKey.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (!key) {
      return res.status(404).json({ success: false, error: 'API Key不存在' });
    }

    const [dailyStats, totalCalls, totalCost] = await Promise.all([
      prisma.apiCallLog.groupBy({
        by: ['createdAt'],
        where: {
          userApiKeyId: id,
          createdAt: { gte: startDate },
        },
        _count: true,
        _sum: {
          totalCost: true,
          inputTokens: true,
          outputTokens: true,
        },
      }),
      prisma.apiCallLog.count({ where: { userApiKeyId: id } }),
      prisma.apiCallLog.aggregate({
        where: { userApiKeyId: id },
        _sum: { totalCost: true, pointsCost: true },
      }),
    ]);

    const providerStats = await prisma.apiCallLog.groupBy({
      by: ['provider'],
      where: { userApiKeyId: id },
      _count: true,
      _sum: { totalCost: true },
    });

    res.json({
      success: true,
      data: {
        key,
        stats: {
          totalCalls,
          totalCost: totalCost._sum.totalCost || 0,
          totalPointsCost: totalCost._sum.pointsCost || 0,
          providerStats: providerStats.map(p => ({
            provider: p.provider,
            calls: p._count,
            cost: p._sum.totalCost || 0,
          })),
          dailyStats: dailyStats.map(d => ({
            date: d.createdAt,
            calls: d._count,
            inputTokens: d._sum.inputTokens || 0,
            outputTokens: d._sum.outputTokens || 0,
            cost: d._sum.totalCost || 0,
          })),
        },
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

userApiKeyRouter.get('/:id/logs', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { page, pageSize, provider, statusCode, startDate, endDate } = req.query;
    const pagination = parsePaginationParamsWithNumbers(
      Number(page) || undefined,
      Number(pageSize) || undefined
    );

    const where: any = { userApiKeyId: id };

    if (provider) where.provider = provider;
    if (statusCode) where.statusCode = Number(statusCode);

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [logs, total] = await Promise.all([
      prisma.apiCallLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.apiCallLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs,
      meta: {
        page: pagination.page,
        pageSize: pagination.pageSize || pagination.limit,
        total,
        totalPages: Math.ceil(total / (pagination.pageSize || pagination.limit)),
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

userApiKeyRouter.post('/:id/rotate', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const admin = req.user!;

    const existing = await prisma.userApiKey.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'API Key不存在' });
    }

    const newApiKey = generateApiKey();
    const newApiSecret = generateApiSecret();

    const updated = await prisma.userApiKey.update({
      where: { id },
      data: {
        apiKey: hashSecret(newApiKey),       // 仅存储哈希
        apiSecret: hashSecret(newApiSecret), // 仅存储哈希
      },
    });

    await logOperation({
      adminId: getAdminId(admin),
      adminUsername: admin.username,
      action: 'api_key_update',
      targetType: 'api_key',
      targetId: id,
      targetName: existing.keyName,
      beforeValue: { keyRotated: true },
      afterValue: { keyRotated: true },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'API Key已轮换，请妥善保存新密钥，系统不会再次显示',
      data: {
        apiKey: newApiKey,        // 明文仅返回一次
        apiSecret: newApiSecret,  // 明文仅返回一次
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});
