import { redisService } from './redis-service';
import prisma from '../lib/prisma';
import { deductPoints } from './points-service';
import { logger } from '../utils/logger';

export interface QuotaResult {
  success: boolean;
  message: string;
  quota?: UserQuota;
}

export interface UserQuota {
  userId: string;
  storageUsed: number;
  storageLimit: number;
  fileCount: number;
  fileLimit: number;
  apiCallsUsed: number;
  apiCallsLimit: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
}

class QuotaService {
  private readonly DEFAULT_STORAGE_LIMIT = 0;
  private readonly DEFAULT_FILE_LIMIT = 1000;
  private readonly DEFAULT_API_CALL_LIMIT = 1000;

  async getUserQuota(userId: string): Promise<UserQuota> {
    const [user, userQuota, membership] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          usedQuota: true,
          role: true,
        }
      }),
      prisma.userQuota.findUnique({
        where: { userId }
      }),
      prisma.userMembership.findFirst({
        where: {
          userId,
          status: 'active',
          endAt: { gte: new Date() },
        },
        orderBy: { createdAt: 'desc' },
        select: { level: true },
      }),
    ]);

    const storageUsed = await this.calculateStorageUsed(userId);
    const fileCount = await this.getFileCount(userId);
    const membershipLevel = membership?.level || user?.role || 'free';
    const defaultStorageLimit = 104857600; // 100MB default after removing membership system
    const dbStorageLimit = userQuota?.storageLimit ? Number(userQuota.storageLimit) : 0;
    const effectiveStorageLimit = Math.max(dbStorageLimit, defaultStorageLimit, this.DEFAULT_STORAGE_LIMIT);

    return {
      userId,
      storageUsed,
      storageLimit: effectiveStorageLimit,
      fileCount,
      fileLimit: userQuota?.fileLimit || this.DEFAULT_FILE_LIMIT,
      apiCallsUsed: user?.usedQuota || 0,
      apiCallsLimit: userQuota?.apiCallsLimit || this.DEFAULT_API_CALL_LIMIT
    };
  }

  async checkStorageQuota(userId: string, fileSize: number): Promise<QuotaCheckResult> {
    const quota = await this.getUserQuota(userId);
    const remaining = quota.storageLimit - quota.storageUsed;

    return {
      allowed: fileSize <= remaining,
      current: quota.storageUsed,
      limit: quota.storageLimit,
      remaining: Math.max(0, remaining - fileSize)
    };
  }

  async checkFileCountQuota(userId: string): Promise<QuotaCheckResult> {
    const quota = await this.getUserQuota(userId);
    const remaining = quota.fileLimit - quota.fileCount;

    return {
      allowed: remaining > 0,
      current: quota.fileCount,
      limit: quota.fileLimit,
      remaining: Math.max(0, remaining)
    };
  }

  async checkApiQuota(userId: string): Promise<QuotaCheckResult> {
    const [user, userQuota] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { usedQuota: true }
      }),
      prisma.userQuota.findUnique({
        where: { userId },
        select: { apiCallsLimit: true }
      }),
    ]);

    const limit = userQuota?.apiCallsLimit || this.DEFAULT_API_CALL_LIMIT;
    const current = user?.usedQuota || 0;
    const remaining = limit - current;

    return {
      allowed: remaining > 0,
      current,
      limit,
      remaining: Math.max(0, remaining)
    };
  }

  async incrementApiUsage(userId: string, count: number = 1): Promise<boolean> {
    try {
      // 使用原子化积分服务，确保余额检查+扣减在同一事务中
      await deductPoints(userId, count, 'API调用');

      // 缓存失效
      await redisService.deleteCache(`quota:${userId}`);

      return true;
    } catch (error) {
      console.error('[Quota] Increment API usage failed:', error);
      return false;
    }
  }

  async updateUserQuota(
    userId: string,
    updates: {
      storageLimit?: number | bigint;
      fileLimit?: number;
      apiCallsLimit?: number;
      membershipId?: string;
    },
    tx?: any
  ): Promise<QuotaResult> {
    try {
      const db = tx || prisma;
      const quota = await db.userQuota.upsert({
        where: { userId },
        update: updates,
        create: {
          user: {
            connect: { id: userId },
          },
          ...updates
        }
      });

      await redisService.deleteCache(`quota:${userId}`);

      return {
        success: true,
        message: '配额更新成功',
        quota: await this.getUserQuota(userId)
      };
    } catch (error: unknown) {
      console.error('[Quota] Update failed:', error);
      return {
        success: false,
        message: `更新失败: ${(error instanceof Error ? error.message : String(error))}`
      };
    }
  }



  async recordFileUpload(userId: string, fileSize: number, fileId: string): Promise<boolean> {
    try {
      await prisma.userFile.create({
        data: {
          user: {
            connect: { id: userId },
          },
          filename: fileId,
          originalName: fileId,
          fileType: 'workflow',
          fileSize,
          size: fileSize,
          mimeType: 'application/octet-stream',
          filePath: `workflows/${userId}/${fileId}`,
          storagePath: `workflows/${userId}/${fileId}`
        }
      });

      // 缓存失效
      await redisService.deleteCache(`quota:${userId}`);

      return true;
    } catch (error) {
      console.error('[Quota] Record file upload failed:', error);
      return false;
    }
  }

  async recordFileDelete(userId: string, fileId: string): Promise<boolean> {
    try {
      const file = await prisma.userFile.findFirst({
        where: { userId, filename: fileId }
      });

      if (file) {
        await prisma.userFile.delete({
          where: { id: file.id }
        });
      }

      await redisService.deleteCache(`quota:${userId}`);

      return true;
    } catch (error) {
      console.error('[Quota] Record file delete failed:', error);
      return false;
    }
  }

  private async calculateStorageUsed(userId: string): Promise<number> {
    const result = await prisma.userFile.aggregate({
      where: { userId, isDeleted: false, folder: { not: 'avatars' } },
      _sum: { fileSize: true }
    });

    return result._sum.fileSize || 0;
  }

  private async getFileCount(userId: string): Promise<number> {
    return await prisma.userFile.count({
      where: { userId, isDeleted: false, folder: { not: 'avatars' } }
    });
  }

  async getQuotaUsageReport(): Promise<{
    totalUsers: number;
    totalStorageUsed: number;
    totalFiles: number;
    totalApiCalls: number;
  }> {
    const [userCount, storageResult, fileCount, apiResult] = await Promise.all([
      prisma.user.count(),
      prisma.userFile.aggregate({ _sum: { fileSize: true } }),
      prisma.userFile.count(),
      prisma.user.aggregate({ _sum: { usedQuota: true } })
    ]);

    return {
      totalUsers: userCount,
      totalStorageUsed: storageResult._sum.fileSize || 0,
      totalFiles: fileCount,
      totalApiCalls: apiResult._sum.usedQuota || 0
    };
  }

  async checkAndCleanupStorage(userId: string): Promise<{ cleaned: boolean; freedBytes: number; deletedCount: number }> {
    const quota = await this.getUserQuota(userId);
    const usagePercent = quota.storageLimit > 0 ? (quota.storageUsed / quota.storageLimit) * 100 : 0;
    
    if (usagePercent < 90) {
      return { cleaned: false, freedBytes: 0, deletedCount: 0 };
    }

    logger.info(`[Quota] 用户 ${userId} 存储使用率 ${usagePercent.toFixed(1)}%，触发自动清理`);

    const targetUsage = quota.storageLimit * 0.7;
    const bytesToFree = quota.storageUsed - targetUsage;
    let freedBytes = 0;
    let deletedCount = 0;

    const filesToDelete = await prisma.userFile.findMany({
      where: {
        userId,
        isDeleted: false,
        folder: { not: 'avatars' },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        fileSize: true,
        storagePath: true,
        filePath: true,
      },
    });

    for (const file of filesToDelete) {
      if (freedBytes >= bytesToFree) break;

      try {
        await prisma.userFile.update({
          where: { id: file.id },
          data: { isDeleted: true, deletedAt: new Date() }
        });

        freedBytes += file.fileSize || 0;
        deletedCount++;
      } catch (error) {
        console.error(`[Quota] 自动清理文件失败: ${file.id}`, error);
      }
    }

    if (deletedCount > 0) {
      await redisService.deleteCache(`quota:${userId}`);
      logger.info(`[Quota] 用户 ${userId} 自动清理完成: 删除 ${deletedCount} 个文件，释放 ${(freedBytes / 1024 / 1024).toFixed(1)} MB`);
    }

    return { cleaned: deletedCount > 0, freedBytes, deletedCount };
  }
}

export const quotaService = new QuotaService();
export default quotaService;
