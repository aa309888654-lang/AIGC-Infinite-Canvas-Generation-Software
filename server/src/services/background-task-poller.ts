import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { unifiedApiService } from './unified-service';
import { decryptProviderSecrets } from '../routes/ai-provider';
import { decrypt } from '../utils/encryption';
import { autoSaveService } from './auto-save-service';
import { creditService } from './credit-service';
import { ProviderKeyManager } from './provider-key-manager';
import { videoOrchestrator } from './video-orchestrator';
import { resolvePosterImageRequestPoints } from './poster-image-pricing';

function parseProviderConfig(configValue?: any): Record<string, unknown> {
  if (!configValue || typeof configValue !== 'object') return {};
  return configValue as Record<string, unknown>;
}

function parseTaskOutput(
  outputResult?: any
): {
  apiTaskId?: string;
  videoUrl?: string;
  url?: string;
  imageUrl?: string;
  metadata?: Record<string, any>;
} | null {
  if (!outputResult) return null;
  try {
    const result = typeof outputResult === 'string' ? JSON.parse(outputResult) : outputResult;
    if (!result || typeof result !== 'object') return null;
    return result as {
      apiTaskId?: string;
      videoUrl?: string;
      url?: string;
      imageUrl?: string;
      metadata?: Record<string, any>;
    };
  } catch (e) {
    return null;
  }
}

function parseTaskParams(params?: any): Record<string, any> | null {
  if (!params) return null;
  try {
    const result = typeof params === 'string' ? JSON.parse(params) : params;
    if (!result || typeof result !== 'object') return null;
    return result as Record<string, any>;
  } catch (e) {
    return null;
  }
}

const PROVIDER_CONFIG_CACHE_TTL = 5 * 60 * 1000;
let providerConfigCache: Map<string, any> | null = null;
let providerConfigCacheTime = 0;

async function getCachedProviderConfig(
  providerName: string,
  modelName?: string | null
): Promise<any | null> {
  const now = Date.now();
  if (!providerConfigCache || now - providerConfigCacheTime > PROVIDER_CONFIG_CACHE_TTL) {
    const allConfigs = await prisma.providerConfig.findMany({ where: { isActive: true } });
    providerConfigCache = new Map();
    for (const pc of allConfigs) {
      try {
        const secrets = decryptProviderSecrets(pc);
        const activeKeyRes = await ProviderKeyManager.getActiveKey(pc.provider);
        const key = activeKeyRes?.key ?? secrets.apiKey;
        const extra = parseProviderConfig(pc.config);
        providerConfigCache.set(pc.provider, {
          apiKey: key,
          apiSecret: secrets.apiSecret || undefined,
          endpoint: pc.endpoint || undefined,
        });
      } catch (e) {
        logger.error('[BackgroundPoller] Failed to build provider config cache:', e);
      } // ERR-02 修复：记录错误而非静默吞掉
    }
    providerConfigCacheTime = now;
  }
  const baseConfig = providerConfigCache.get(providerName) || null;
  if (!baseConfig || !modelName) return baseConfig;

  const modelScopedKeys = await ProviderKeyManager.getActiveKeysForModel(providerName, modelName);
  const activeModelKey = modelScopedKeys.find((item) => !!item.apiKey);
  if (!activeModelKey?.apiKey) return baseConfig;

  return {
    ...baseConfig,
    apiKey: activeModelKey.apiKey,
  };
}

const TASK_AGE_LIMIT_MS = 25 * 60 * 1000;
const VIDEO_TASK_AGE_LIMIT_MS = 24 * 60 * 60 * 1000;
const POLL_BATCH_SIZE = 10;

async function resolveUserMembershipLevel(userId: string): Promise<string> {
  const activeMembership = await prisma.userMembership.findFirst({
    where: {
      userId,
      status: 'active',
      endAt: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
  return activeMembership?.level || 'trial';
}

// P1 修复：添加轮询重叠守卫，防止 setInterval 在上一轮未完成时触发重复轮询
let isPolling = false;

export async function pollPendingTasks(): Promise<void> {
  // 防止轮询周期重叠：如果上一轮仍在执行，跳过本次
  if (isPolling) {
    logger.debug('[BackgroundPoller] 上一轮轮询尚未完成，跳过本次');
    return;
  }
  isPolling = true;
  try {
    await videoOrchestrator.pollPendingTasks().catch((error) => {
      logger.warn('[BackgroundPoller] videoOrchestrator.pollPendingTasks failed:', error);
    });

    const cutoffTime = new Date(Date.now() - TASK_AGE_LIMIT_MS);
    const pendingTasks = await prisma.task.findMany({
      where: {
        status: { in: ['pending', 'processing'] },
        type: 'image',
        createdAt: { gte: cutoffTime },
      },
      orderBy: { createdAt: 'asc' },
      take: POLL_BATCH_SIZE,
    });

    if (pendingTasks.length === 0) return;

    for (const task of pendingTasks) {
      try {
        // FIX-AUDIT-01: 自动标记无效任务为 failed（provider=unknown 或 model=null）
        if (!task.provider || task.provider === 'unknown' || !task.model) {
          logger.warn(
            `[BackgroundPoller] 任务 ${task.id} 缺少有效的 provider/model，自动标记为失败`
          );
          await prisma.task.update({
            where: { id: task.id },
            data: {
              status: 'failed',
              error: '无效任务: provider 或 model 缺失',
              updatedAt: new Date(),
            },
          });
          continue;
        }

        const baseConfig = await getCachedProviderConfig(task.provider, task.model);
        const apiConfig = baseConfig;
        if (!apiConfig) continue;

        const binding = null;
        // The local task ID is not recognized by external providers.
        let providerTaskId = task.providerTaskId || task.taskId || task.id;
        const output = parseTaskOutput(task.result);
        if (!task.providerTaskId && !task.taskId && !binding && output) {
          // agnes-video-v2.0 查询用 task_id（video_id 查询返回 task_not_exist）
          const isAgnesVideo =
            task.model === 'agnes-video-v2.0' || task.model === 'Agnes-Video-V2.0';
          if (isAgnesVideo) {
            providerTaskId =
              output.metadata?.task_id ||
              output.apiTaskId ||
              output.metadata?.video_id ||
              output.metadata?.videoId ||
              output.metadata?.id ||
              output.metadata?.request_id ||
              task.id;
          } else {
            providerTaskId =
              output.metadata?.video_id ||
              output.metadata?.videoId ||
              output.apiTaskId ||
              output.metadata?.task_id ||
              output.metadata?.id ||
              output.metadata?.request_id ||
              task.id;
          }
        }
        if (
          !task.providerTaskId &&
          !task.taskId &&
          task.provider === 'minimax' &&
          output?.metadata?.task_id
        ) {
          providerTaskId = 'hailuo_' + output.metadata.task_id;
        }

        const taskResult = await unifiedApiService.getTaskStatus(
          providerTaskId,
          task.provider,
          apiConfig
        );
        const newStatus = taskResult.status;

        if (newStatus === 'pending' || newStatus === 'processing') {
          if (taskResult.progress !== undefined && taskResult.progress !== task.progress) {
            await prisma.task.update({
              where: { id: task.id },
              data: { progress: taskResult.progress },
            });
          }
          continue;
        }

        const mergedResult = { ...taskResult.result, apiTaskId: providerTaskId };
        await prisma.task.update({
          where: { id: task.id },
          data: {
            status: newStatus,
            result: JSON.stringify(mergedResult),
            error: newStatus === 'completed' ? null : taskResult.error || undefined,
            progress: newStatus === 'completed' ? 100 : (taskResult.progress ?? task.progress),
          },
        });

        if (newStatus === 'completed') {
          try {
            if (task.type === 'image') {
              const membershipLevel = await resolveUserMembershipLevel(task.userId);
              const taskParams = parseTaskParams(task.params);
              const isPosterTask = taskParams?.source === 'poster';
              const imageCount = Math.max(
                1,
                Number(taskParams?.imageCount) || Number(taskParams?.n) || 1
              );
              const posterPoints = isPosterTask
                ? resolvePosterImageRequestPoints({
                    provider: task.provider,
                    model: task.model || '',
                    imageCount,
                    candidateCount: taskParams?.posterCandidateCount,
                  })
                : undefined;
              await creditService.consume({
                userId: task.userId,
                membershipLevel,
                type: 'image',
                taskId: task.id,
                reason: isPosterTask ? 'AI海报生成(后台轮询)' : '图片生成(后台轮询)',
                provider: task.provider,
                model: task.model || undefined,
                customPoints: posterPoints,
              });
            } else if (task.type === 'audio' || task.type === 'music') {
              const membershipLevel = await resolveUserMembershipLevel(task.userId);
              await creditService.consume({
                userId: task.userId,
                membershipLevel,
                type: 'audio',
                taskId: task.id,
                reason: `${task.type === 'music' ? '音乐' : '语音'}生成(后台轮询)`,
                provider: task.provider,
              });
            }
          } catch (pointsError) {
            console.error('[BackgroundPoller] 积分扣除失败:', pointsError);
            // BUG-08 修复：改为 failed 状态并记录错误，便于用户重试，而非 payment_pending 死状态
            await prisma.task.update({
              where: { id: task.id },
              data: {
                status: 'failed',
                error: `积分扣除失败，请重试: ${pointsError instanceof Error ? pointsError.message : String(pointsError)}`,
              },
            });
            // 通知用户任务失败
            try {
              const { websocketPushService } = await import('./websocket-push-service');
              websocketPushService
                .notifyTaskFailed(task.userId, task.id, '积分扣除失败，请重试')
                .catch((e) => logger.error('[BackgroundPoller] WS notify failed:', e));
            } catch (e) {
              logger.error('[BackgroundPoller] WS import failed:', e);
            }
          }

          if (task.type === 'image') {
            const imageUrl = taskResult.result?.url || taskResult.result?.imageUrl;
            if (imageUrl) {
              try {
                const savedResult = await autoSaveService.autoSaveUrl(
                  task.userId,
                  imageUrl,
                  'image',
                  `图片_${Date.now()}`
                );
                if (savedResult.primaryUrl) {
                  await prisma.task
                    .update({
                      where: { id: task.id },
                      data: {
                        outputUrl: savedResult.primaryUrl,
                        cosUrl: savedResult.cosUrl,
                      },
                    })
                    .catch((e) =>
                      logger.error('[BackgroundPoller] Failed to update task with saved URL:', e)
                    );
                  logger.info(
                    `[BackgroundPoller] 图片已保存: local=${!!savedResult.localUrl}, cos=${!!savedResult.cosUrl}`
                  );
                }
              } catch (err) {
                console.error('[BackgroundPoller] 自动保存失败:', err);
              }
            }
          }

          try {
            const { websocketPushService } = await import('./websocket-push-service');
            websocketPushService
              .notifyTaskComplete(task.userId, task.id, taskResult.result)
              .catch((e) => logger.error('[BackgroundPoller] WS notifyTaskComplete failed:', e));
          } catch (e) {
            logger.error('[BackgroundPoller] WS import failed:', e);
          }
        } else if (newStatus === 'failed') {
          try {
            const { websocketPushService } = await import('./websocket-push-service');
            websocketPushService
              .notifyTaskFailed(task.userId, task.id, taskResult.error || '生成失败')
              .catch((e) => logger.error('[BackgroundPoller] WS notifyTaskFailed failed:', e));
          } catch (e) {
            logger.error('[BackgroundPoller] WS import failed:', e);
          }
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err);
        console.error(`[BackgroundPoller] 任务 ${task.id} 轮询失败:`, msg);
      }
    }
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err);
    console.error('[BackgroundPoller] 轮询批次失败:', msg);
  } finally {
    isPolling = false; // P1 修复：确保任何路径都重置守卫
  }
}

let pollerInterval: NodeJS.Timeout | null = null;
const POLL_INTERVAL_MS = 3000; // 3秒轮询（原5秒），快速获取draft结果

// FIX-AUDIT-01: 清理超时卡死任务
async function cleanupStaleTasks(): Promise<void> {
  const imageCutoffTime = new Date(Date.now() - TASK_AGE_LIMIT_MS);
  const videoCutoffTime = new Date(Date.now() - VIDEO_TASK_AGE_LIMIT_MS);
  const staleTasks = await prisma.task.findMany({
    where: {
      status: { in: ['pending', 'processing'] },
      OR: [
        { type: 'video', createdAt: { lt: videoCutoffTime } },
        { type: { not: 'video' }, createdAt: { lt: imageCutoffTime } },
      ],
    },
    select: { id: true, type: true, provider: true, model: true, createdAt: true },
  });

  if (staleTasks.length === 0) return;

  logger.warn(`[BackgroundTaskPoller] 发现 ${staleTasks.length} 个超时卡死任务，正在清理...`);

  for (const task of staleTasks) {
    const reason =
      !task.provider || task.provider === 'unknown' || !task.model
        ? '无效任务: provider 或 model 缺失'
        : '任务超时未完成';
    await prisma.task.update({
      where: { id: task.id },
      data: { status: 'failed', error: reason, updatedAt: new Date() },
    });
    logger.warn(
      `[BackgroundTaskPoller] 已清理卡死任务 ${task.id} (${task.type}/${task.provider || 'unknown'})`
    );
  }
}

export function startBackgroundTaskPoller(): void {
  if (pollerInterval) return;
  logger.info(`[BackgroundTaskPoller] 启动后台任务轮询器 (间隔: ${POLL_INTERVAL_MS / 1000}秒)`);

  // FIX-AUDIT-01: 启动时清理超时的卡死任务（超过 TASK_AGE_LIMIT_MS 仍 pending/processing）
  cleanupStaleTasks().catch((err) => {
    logger.warn('[BackgroundTaskPoller] 启动清理失败:', err);
  });

  pollerInterval = setInterval(pollPendingTasks, POLL_INTERVAL_MS);
}

export function stopBackgroundTaskPoller(): void {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    logger.info('[BackgroundTaskPoller] 已停止');
  }
}
