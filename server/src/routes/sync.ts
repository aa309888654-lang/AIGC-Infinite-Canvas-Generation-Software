import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { encryptForStorage, maskApiKey, hashForLookup, normalizeEmail } from '../utils/encryption';

// SEC M-2 修复：sync 路由接收 workflows 等较大负载，单独放宽 body 限制。
// 全局限制已降到 2mb，此处显式放宽到 20mb 以容纳工作流数据。
syncRouter.use(express.json({ limit: '20mb' }));

syncRouter.use(authenticate);

const DEFAULT_STORAGE_LIMIT = 104857600; // 100MB default after removing membership login system
const DEFAULT_FILE_LIMIT = 1000;

interface FrontendUserProfile {
  userId?: string;
  username: string;
  email: string;
  membershipLevel: 'free' | 'vip' | 'premium';
  membershipExpiry: string | null;
  permanentPoints: number;
  bonusPoints: number;
  bonusExpiry: string | null;
  concurrentTasks: number;
  role?: string;
}

interface FrontendPointsTransaction {
  type: 'earn' | 'spend' | 'bonus' | 'expire' | 'refund' | 'admin' | 'purchase' | 'daily' | 'register' | 'invite';
  amount: number;
  reason?: string;
  createdAt: string;
}

interface FrontendTaskRecord {
  id?: string;
  taskType: string;
  prompt?: string;
  provider: string;
  model?: string;
  mode?: string;
  status: string;
  inputParams: string | Record<string, unknown>;
  outputResult?: string | Record<string, unknown>;
  errorMessage?: string;
  progress: number;
  createdAt: string;
  completedAt?: string;
}

interface FrontendUsageLog {
  action: string;
  actionType: string;
  beforeState?: string;
  afterState?: string;
  source?: string;
  duration?: number;
  metadata?: string;
  createdAt: string;
}

interface FrontendGenerationRecord {
  id?: string;
  nodeId: string;
  type: 'image' | 'video';
  prompt: string;
  negativePrompt?: string;
  config: Record<string, any>;
  resultUrl?: string;
  thumbnailUrl?: string;
  status: string;
  error?: string;
  progress: number;
  createdAt: string;
  completedAt?: string;
  duration?: number;
}

interface FrontendApiKeyConfig {
  provider: string;
  apiKey?: string;
  apiSecret?: string;
  endpoint?: string;
  enabled: boolean;
  selectedModel?: string;
}

interface FrontendNodeFile {
  id: string;
  name: string;
  type: 'workflow' | 'node-config' | 'project-file' | 'template';
  data: Record<string, any>;
  size?: number;
  createdAt: string;
  updatedAt: string;
}

interface SyncPayload {
  userProfile: FrontendUserProfile;
  pointsTransactions?: FrontendPointsTransaction[];
  tasks?: FrontendTaskRecord[];
  usageLogs?: FrontendUsageLog[];
  generationHistory?: FrontendGenerationRecord[];
  apiConfigs?: FrontendApiKeyConfig[];
  workflows?: Array<{
    id: string;
    name: string;
    data: Record<string, any>;
    createdAt: string;
    updatedAt: string;
  }>;
  nodeFiles?: FrontendNodeFile[];
  clientVersion?: string;
  clientInfo?: {
    platform: string;
    osVersion: string;
    appVersion: string;
  };
}

function extractTaskOutputUrl(outputResult?: any): string | null {
  if (!outputResult || typeof outputResult !== 'object') return null;
  return (outputResult.resultUrl as string) || (outputResult.url as string) || null;
}

interface SyncResult {
  success: boolean;
  userId: string;
  summary: {
    userCreatedOrUpdated: boolean;
    pointsSynced: number;
    tasksSynced: number;
    usageLogsSynced: number;
    generationRecordsSynced: number;
    apiConfigsSynced: number;
    workflowsSynced: number;
    nodeFilesSynced: number;
    errors: string[];
  };
  storageQuota: {
    used: number;
    limit: number;
    remaining: number;
    usedPercent: number;
  };
  timestamp: string;
}

async function ensureUserQuota(userId: string): Promise<void> {
  const existing = await prisma.userQuota.findUnique({ where: { userId } });
  if (!existing) {
    await prisma.userQuota.create({
      data: {
        userId,
        dailyLimit: 1000,
        dailyUsed: 0,
        monthlyLimit: 10000,
        monthlyUsed: 0,
        concurrentLimit: 3,
        concurrentUsed: 0,
        storageLimit: DEFAULT_STORAGE_LIMIT,
        fileLimit: DEFAULT_FILE_LIMIT,
      },
    });
  }
}

async function getStorageUsed(userId: string): Promise<number> {
  const files = await prisma.userFile.aggregate({
    where: { userId, deletedAt: null },
    _sum: { fileSize: true },
  });
  return files._sum.fileSize || 0;
}

async function calculateDataSize(data: unknown): Promise<number> {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return JSON.stringify(data).length * 2;
  }
}

syncRouter.post('/full', async (req, res, next) => {
  const startTime = Date.now();
  const payload: SyncPayload = req.body;

  if (!payload || !payload.userProfile) {
    return next(new AppError('缺少用户资料数据', 400));
  }

  const result: SyncResult = {
    success: false,
    userId: '',
    summary: {
      userCreatedOrUpdated: false,
      pointsSynced: 0,
      tasksSynced: 0,
      usageLogsSynced: 0,
      generationRecordsSynced: 0,
      apiConfigsSynced: 0,
      workflowsSynced: 0,
      nodeFilesSynced: 0,
      errors: [],
    },
    storageQuota: { used: 0, limit: DEFAULT_STORAGE_LIMIT, remaining: DEFAULT_STORAGE_LIMIT, usedPercent: 0 },
    timestamp: new Date().toISOString(),
  };

  try {
    let dbUser;

    // SEC-01 修复：强制使用认证用户的 userId，忽略客户端传入的 userId，防止越权篡改
    const authenticatedUserId = req.userId!;
    payload.userProfile.userId = authenticatedUserId;

    dbUser = await prisma.user.findUnique({
      where: { id: authenticatedUserId },
    });

    if (dbUser) {
      const updateData: any = {};
      if (payload.userProfile.username && payload.userProfile.username !== dbUser.username) {
        const existing = await prisma.user.findUnique({ where: { username: payload.userProfile.username } });
        if (!existing) updateData.username = payload.userProfile.username;
      }
      if (payload.userProfile.email) {
        const normalizedEmail = normalizeEmail(payload.userProfile.email);
        const emailHash = hashForLookup(normalizedEmail);
        
        if (emailHash !== dbUser.email) {
          const existing = await prisma.user.findUnique({ where: { email: emailHash } });
          if (!existing) {
            updateData.email = emailHash;
            updateData.emailCipher = encryptForStorage(normalizedEmail);
            updateData.emailHash = emailHash;
          }
        }
      }
      if (payload.userProfile.permanentPoints !== undefined) {
        updateData.pointsBalance = payload.userProfile.permanentPoints + (payload.userProfile.bonusPoints || 0);
        updateData.points = payload.userProfile.permanentPoints;
      }
      // SEC-01 修复：禁止客户端通过 sync 接口覆盖 role 字段，防止权限提升

      if (Object.keys(updateData).length > 0) {
        dbUser = await prisma.user.update({
          where: { id: dbUser.id },
          data: updateData,
        });
      }
      result.userId = dbUser.id;
      result.summary.userCreatedOrUpdated = true;
    } else {
      const hashedPassword = await bcrypt.hash('synced_from_frontend_' + Date.now(), 10);

      const membershipLevelToRole: Record<string, string> = {
        free: 'user',
        vip: 'vip',
        premium: 'premium',
      };

      const normalizedEmail = normalizeEmail(payload.userProfile.email);
      const emailHash = hashForLookup(normalizedEmail);
      const emailCipher = encryptForStorage(normalizedEmail);

      // SEC-01 修复：创建新用户时不允许客户端指定 id 和 role
      dbUser = await prisma.user.create({
        data: {
          username: payload.userProfile.username,
          email: emailHash,
          emailCipher,
          emailHash,
          password: hashedPassword,
          role: membershipLevelToRole[payload.userProfile.membershipLevel] || 'user',
          points: payload.userProfile.permanentPoints || 100,
          pointsBalance: (payload.userProfile.permanentPoints || 100) + (payload.userProfile.bonusPoints || 0),
          frozenPoints: 0,
          isActive: true,
        },
      });

      await ensureUserQuota(dbUser.id);

      result.userId = dbUser.id;
      result.summary.userCreatedOrUpdated = true;
    }

    await ensureUserQuota(dbUser!.id);

    if (payload.pointsTransactions && payload.pointsTransactions.length > 0) {
      for (const tx of payload.pointsTransactions) {
        try {
          const currentPoints = await prisma.user.findUnique({
            where: { id: dbUser!.id },
            select: { points: true },
          });

          const balanceBefore = currentPoints?.points || 0;
          const amount = tx.type === 'spend' || tx.type === 'expire' ? -Math.abs(tx.amount) : Math.abs(tx.amount);
          const balanceAfter = balanceBefore + amount;

          await prisma.pointsTransaction.create({
            data: {
              userId: dbUser!.id,
              type: tx.type,
              amount,
              balanceBefore,
              balanceAfter,
              reason: tx.reason || `前端同步: ${tx.type}`,
              createdAt: new Date(tx.createdAt),
            },
          });

          await prisma.user.update({
            where: { id: dbUser!.id },
            data: { points: balanceAfter },
          });

          result.summary.pointsSynced++;
        } catch (err: unknown) {
          result.summary.errors.push(`积分交易同步失败: ${(err instanceof Error ? err.message : String(err))}`);
        }
      }
    }

    if (payload.tasks && payload.tasks.length > 0) {
      for (const task of payload.tasks) {
        try {
          await prisma.task.upsert({
            where: { id: task.id || `sync_${Date.now()}_${crypto.randomBytes(4).toString('hex')}` },
            create: {
              id: task.id || undefined,
              userId: dbUser!.id,
              type: task.taskType,
              prompt: task.prompt || '',
              provider: task.provider,
              model: task.model,
              status: task.status,
              params: (task.inputParams || {}) as any,
              result: (task.outputResult || null) as any,
              error: task.errorMessage,
              progress: task.progress,
              outputUrl: extractTaskOutputUrl(task.outputResult),
              createdAt: new Date(task.createdAt),
            },
            update: {
              status: task.status,
              result: (task.outputResult || undefined) as any,
              error: task.errorMessage,
              progress: task.progress,
              outputUrl: extractTaskOutputUrl(task.outputResult) || undefined,
            },
          });
          result.summary.tasksSynced++;
        } catch (err: unknown) {
          result.summary.errors.push(`任务同步失败 (${task.taskType}): ${(err instanceof Error ? err.message : String(err))}`);
        }
      }
    }

    if (payload.usageLogs && payload.usageLogs.length > 0) {
      for (const log of payload.usageLogs) {
        try {
          await prisma.usageLog.create({
            data: {
              userId: dbUser!.id,
              endpoint: log.action || log.actionType || 'frontend-sync',
              method: log.actionType || log.source || 'SYNC',
              params: log.metadata ? (typeof log.metadata === 'object' ? log.metadata : { raw: String(log.metadata) }) as any : null,
              status: 200,
              duration: log.duration,
              createdAt: new Date(log.createdAt),
            },
          });
          result.summary.usageLogsSynced++;
        } catch (err: unknown) {
          result.summary.errors.push(`使用日志同步失败: ${(err instanceof Error ? err.message : String(err))}`);
        }
      }
    }

    if (payload.generationHistory && payload.generationHistory.length > 0) {
      for (const gen of payload.generationHistory) {
        try {
          const genMetadata = {
            nodeId: gen.nodeId,
            type: gen.type,
            prompt: gen.prompt,
            negativePrompt: gen.negativePrompt,
            config: gen.config,
            resultUrl: gen.resultUrl,
            thumbnailUrl: gen.thumbnailUrl,
            duration: gen.duration,
          };

          await prisma.usageLog.create({
            data: {
              userId: dbUser!.id,
              endpoint: `generation_${gen.type}`,
              method: gen.status || 'SYNC',
              params: genMetadata ? JSON.stringify(genMetadata) : null,
              status: 200,
              createdAt: new Date(gen.createdAt),
            },
          });
          result.summary.generationRecordsSynced++;
        } catch (err: unknown) {
          result.summary.errors.push(`生成记录同步失败: ${(err instanceof Error ? err.message : String(err))}`);
        }
      }
    }

    // 兼容旧客户端发送 apiConfigs，但服务端永不接收或持久化浏览器密钥。
    // Provider 凭据只允许通过管理员凭据接口写入后端加密存储。

    const allWorkflows = payload.workflows || [];
    const nodeFiles = payload.nodeFiles || [];

    if (allWorkflows.length > 0 || nodeFiles.length > 0) {
      let currentStorageUsed = await getStorageUsed(dbUser!.id);
      const userQuota = await prisma.userQuota.findUnique({ where: { userId: dbUser!.id } });
      const storageLimit = Number(userQuota?.storageLimit || DEFAULT_STORAGE_LIMIT);

      const allItems = [
        ...allWorkflows.map(wf => ({ ...wf, _type: 'workflow' as const })),
        ...nodeFiles.map(nf => ({ ...nf, _type: nf.type as string })),
      ];

      for (const item of allItems) {
        try {
          const dataSize = await calculateDataSize(item.data);

          if (currentStorageUsed + dataSize > storageLimit) {
            result.summary.errors.push(`存储空间不足，跳过: ${item.name || item.id} (需要${(dataSize / 1024).toFixed(1)}KB)`);
            continue;
          }

          const fileDataStr = JSON.stringify(item.data);

          await prisma.userFile.upsert({
            where: { id: item.id },
            create: {
              id: item.id,
              userId: dbUser!.id,
              filename: `${item._type}_${item.name || item.id}.json`,
              originalName: item.name || `${item._type}_${item.id}`,
              fileType: 'json',
              fileSize: dataSize,
              size: dataSize,
              mimeType: 'application/json',
              filePath: `/user-files/${dbUser!.id}/${item._type}/${item.id}.json`,
              storagePath: `/user-files/${dbUser!.id}/${item._type}/${item.id}.json`,
              isPublic: false,
              metadata: JSON.stringify({
                type: item._type,
                syncedAt: new Date().toISOString(),
                source: 'frontend-sync',
                version: payload.clientVersion || '1.0.0',
              }),
            },
            update: {
              size: dataSize,
              updatedAt: new Date(),
              metadata: JSON.stringify({
                type: item._type,
                lastSyncedAt: new Date().toISOString(),
                source: 'frontend-sync',
                version: payload.clientVersion || '1.0.0',
              }),
            },
          });

          currentStorageUsed += dataSize;

          if (item._type === 'workflow') {
            result.summary.workflowsSynced++;
          } else {
            result.summary.nodeFilesSynced++;
          }
        } catch (err: unknown) {
          result.summary.errors.push(`${item._type === 'workflow' ? '工作流' : '节点文件'}同步失败 (${item.name || item.id}): ${(err instanceof Error ? err.message : String(err))}`);
        }
      }

      // BUG-10 修复：同步操作不应修改文件配额上限(fileLimit)，移除错误的 increment 逻辑
      // 用户配额上限由会员等级决定，不应因同步而改变
    }

    if (payload.clientInfo) {
      try {
        await prisma.usageLog.create({
          data: {
            userId: dbUser!.id,
            endpoint: 'client_sync',
            method: 'INFO',
            params: payload.clientInfo ? JSON.stringify(payload.clientInfo) : null,
            status: 200,
            createdAt: new Date(),
          },
        });
      } catch {
        // Audit persistence must not fail an otherwise successful sync.
      }
    }

    const finalStorageUsed = await getStorageUsed(dbUser!.id);
    const finalQuota = await prisma.userQuota.findUnique({ where: { userId: dbUser!.id } });
    const limit = Number(finalQuota?.storageLimit || DEFAULT_STORAGE_LIMIT);
    result.storageQuota = {
      used: finalStorageUsed,
      limit,
      remaining: Math.max(0, limit - finalStorageUsed),
      usedPercent: limit > 0 ? parseFloat(((finalStorageUsed / limit) * 100).toFixed(1)) : 0,
    };

    result.success = true;
    result.timestamp = new Date().toISOString();

    res.json({
      success: true,
      data: result,
      message: '数据同步完成',
      processingTimeMs: Date.now() - startTime,
    });
  } catch (error: unknown) {
    next(error);
  }
});

syncRouter.post('/status', async (req, res, next) => {
  try {
    const userId = req.userId!;

    const [user, taskCount, usageLogCount, pointsTxCount, storageUsed, userQuota] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          points: true,
          pointsBalance: true,
          frozenPoints: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              tasks: true,
              usageLogs: true,
              pointsTransactions: true,
              apiKeys: true,
              UserFile: true,
            },
          },
        },
      }),
      prisma.task.count({ where: { userId } }),
      prisma.usageLog.count({ where: { userId } }),
      prisma.pointsTransaction.count({ where: { userId } }),
      getStorageUsed(userId),
      prisma.userQuota.findUnique({ where: { userId } }),
    ]);

    const storageLimit = Number(userQuota?.storageLimit || DEFAULT_STORAGE_LIMIT);
    const fileLimit = userQuota?.fileLimit || DEFAULT_FILE_LIMIT;
    const fileCount = user?._count.UserFile || 0;

    res.json({
      success: true,
      data: {
        user,
        stats: {
          tasks: taskCount,
          usageLogs: usageLogCount,
          pointsTransactions: pointsTxCount,
          files: fileCount,
        },
        storageQuota: {
          used: storageUsed,
          limit: storageLimit,
          remaining: Math.max(0, storageLimit - storageUsed),
          usedPercent: parseFloat(((storageUsed / storageLimit) * 100).toFixed(1)),
          fileCount,
          fileLimit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

syncRouter.get('/storage', async (req, res, next) => {
  try {
    const userId = req.userId!;

    const [storageUsed, userQuota, files] = await Promise.all([
      getStorageUsed(userId),
      prisma.userQuota.findUnique({ where: { userId } }),
      prisma.userFile.findMany({
        where: { userId, deletedAt: null },
        select: {
          id: true,
          filename: true,
          originalName: true,
          size: true,
          mimeType: true,
          createdAt: true,
          updatedAt: true,
          metadata: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const storageLimit = Number(userQuota?.storageLimit || DEFAULT_STORAGE_LIMIT);
    const fileLimit = userQuota?.fileLimit || DEFAULT_FILE_LIMIT;

    res.json({
      success: true,
      data: {
        quota: {
          used: storageUsed,
          limit: storageLimit,
          remaining: Math.max(0, storageLimit - storageUsed),
          usedPercent: parseFloat(((storageUsed / storageLimit) * 100).toFixed(1)),
          fileCount: files.length,
          fileLimit,
        },
        files: files.map(f => ({
          ...f,
          metadata: f.metadata || null,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

syncRouter.get('/export/:userId', async (req: any, res, next) => {
  try {
    const targetUserId = req.params.userId;

    if (req.userId !== targetUserId && req.userRole !== 'admin') {
      throw new AppError('无权访问此数据', 403);
    }

    const [user, tasks, usageLogs, pointsTxs, apiKeys, files] = await Promise.all([
      prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          points: true,
          pointsBalance: true,
          frozenPoints: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.task.findMany({
        where: { userId: targetUserId },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.usageLog.findMany({
        where: { userId: targetUserId },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.pointsTransaction.findMany({
        where: { userId: targetUserId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.apiKey.findMany({
        where: { userId: targetUserId },
      }),
      prisma.userFile.findMany({
        where: { userId: targetUserId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ]);

    if (!user) {
      throw new AppError('用户不存在', 404);
    }

    const exportData = {
      user,
      tasks,
      usageLogs,
      pointsTransactions: pointsTxs,
      apiKeys: apiKeys.map(k => ({
        ...k,
        apiKey: k.key ? maskApiKey(k.key) : null,
        apiSecret: null,
      })),
      files: files.map(f => ({
        ...f,
        metadata: f.metadata || null,
      })),
      exportedAt: new Date().toISOString(),
      exportedBy: req.userId,
    };

    res.json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    next(error);
  }
});
