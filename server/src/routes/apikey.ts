/**
 * API密钥管理路由
 * 安全处理用户API密钥，支持AES-256-GCM加密存储
 */

import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { apiKeySchema } from '../utils/validation';
import { AppError } from '../middleware/errorHandler';
import { encryptForStorage, isEncrypted, maskApiKey, isValidApiKeyFormat } from '../utils/encryption';
import { logger } from '../utils/logger';

export const apiKeyRouter = Router();

apiKeyRouter.use(authenticate);

/**
 * 获取用户所有API密钥
 * 返回掩码后的密钥（不解密显示）
 */
apiKeyRouter.get('/', async (req, res, next) => {
  try {
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: req.userId },
      select: {
        id: true,
        provider: true,
        key: true,
        name: true,
        isActive: true,
        createdAt: true,
        lastUsed: true,
      },
    });

    // 对所有密钥进行掩码处理，不暴露实际内容
    const maskedKeys = apiKeys.map(key => ({
      id: key.id,
      provider: key.provider,
      apiKey: maskApiKey(key.key),
      apiSecret: null,
      endpoint: null,
      name: key.name,
      isActive: key.isActive,
      createdAt: key.createdAt,
      updatedAt: key.lastUsed ?? key.createdAt,
    }));

    res.json({
      success: true,
      data: maskedKeys,
    });
  } catch (error) {
    next(error);
  }
});

/** 旧客户端兼容路由：用户密钥也不再返回浏览器明文。 */
apiKeyRouter.get('/:id/plaintext', (_req, res) => {
  res.status(410).json({
    success: false,
    data: null,
    message: 'API 密钥仅保存在后端，请通过后端代理调用',
  });
});

/**
 * 添加新的API密钥
 * 存储前自动加密
 */
apiKeyRouter.post('/', async (req, res, next) => {
  try {
    const validatedData = apiKeySchema.parse(req.body);

    // 验证API密钥格式
    if (!isValidApiKeyFormat(validatedData.apiKey)) {
      throw new AppError('API密钥格式无效', 400);
    }

    // 检查是否已存在该提供商的密钥
    const existingKey = await prisma.apiKey.findFirst({
      where: {
        userId: req.userId!,
        provider: validatedData.provider,
      },
    });

    if (existingKey) {
      throw new AppError('该服务商API密钥已存在，请先删除或更新', 400);
    }

    // 加密API密钥和密钥
    const encryptedApiKey = encryptForStorage(validatedData.apiKey);
    const apiKey = await prisma.apiKey.create({
      data: {
        user: {
          connect: { id: req.userId! },
        },
        name: `${validatedData.provider}-key`,
        provider: validatedData.provider,
        key: encryptedApiKey,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: apiKey.id,
        provider: apiKey.provider,
        isActive: apiKey.isActive,
        createdAt: apiKey.createdAt,
      },
      message: 'API密钥已安全加密存储',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 更新API密钥
 * 更新时重新加密
 */
apiKeyRouter.put('/:id', async (req, res, next) => {
  try {
    const { apiKey, apiSecret, endpoint, isActive } = req.body;

    // 查找现有密钥
    const existingKey = await prisma.apiKey.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!existingKey) {
      throw new AppError('API密钥不存在', 404);
    }

    // 准备更新数据
    const updateData: any = {};
    
    if (apiKey !== undefined) {
      if (!isValidApiKeyFormat(apiKey)) {
        throw new AppError('API密钥格式无效', 400);
      }
      updateData.key = encryptForStorage(apiKey);
    }
    
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    if (req.body.name !== undefined) {
      updateData.name = req.body.name;
    }

    // 更新密钥
    const updatedKey = await prisma.apiKey.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({
      success: true,
      data: {
        id: updatedKey.id,
        provider: updatedKey.provider,
        apiKey: maskApiKey(updatedKey.key),
        isActive: updatedKey.isActive,
        updatedAt: updatedKey.lastUsed ?? updatedKey.createdAt,
      },
      message: 'API密钥已更新并重新加密',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 删除API密钥
 */
apiKeyRouter.delete('/:id', async (req, res, next) => {
  try {
    const existingKey = await prisma.apiKey.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!existingKey) {
      throw new AppError('API密钥不存在', 404);
    }

    await prisma.apiKey.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'API密钥已删除',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 批量导入API密钥
 * 用于数据迁移（从旧系统导入未加密的密钥）
 */
apiKeyRouter.post('/bulk-import', async (req, res, next) => {
  try {
    const { keys } = req.body;
    
    if (!Array.isArray(keys) || keys.length === 0) {
      throw new AppError('无效的密钥数组', 400);
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const keyData of keys) {
      try {
        // 验证数据
        const validatedData = apiKeySchema.parse(keyData);
        
        // 加密存储
        const encryptedApiKey = encryptForStorage(validatedData.apiKey);
        await prisma.apiKey.create({
          data: {
            user: {
              connect: { id: req.userId! },
            },
            name: `${validatedData.provider}-key`,
            provider: validatedData.provider,
            key: encryptedApiKey,
          },
        });

        results.success++;
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        results.errors.push(`${keyData.provider}: ${errorMessage}`);
      }
    }

    res.json({
      success: true,
      data: results,
      message: `批量导入完成: ${results.success}个成功, ${results.failed}个失败`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 迁移现有未加密的密钥
 * 用于一次性加密数据库中已有的明文密钥
 */
apiKeyRouter.post('/migrate-encryption', async (req, res, next) => {
  try {
    // 获取所有未加密的密钥
    const allKeys = await prisma.apiKey.findMany({
      where: { userId: req.userId },
    });

    let migrated = 0;
    let alreadyEncrypted = 0;
    let failed = 0;

    for (const key of allKeys) {
      try {
        // 检查是否已加密
        if (isEncrypted(key.key)) {
          alreadyEncrypted++;
          continue;
        }

        // 加密并更新
        const encryptedApiKey = encryptForStorage(key.key);

        await prisma.apiKey.update({
          where: { id: key.id },
          data: {
            key: encryptedApiKey,
          },
        });

        migrated++;
      } catch (error) {
        failed++;
        logger.error(`迁移密钥 ${key.id} 失败:`, error instanceof Error ? error.message : String(error));
      }
    }

    res.json({
      success: true,
      data: {
        migrated,
        alreadyEncrypted,
        failed,
        total: allKeys.length,
      },
      message: `迁移完成: ${migrated}个已加密, ${alreadyEncrypted}个已加密, ${failed}个失败`,
    });
  } catch (error) {
    next(error);
  }
});
