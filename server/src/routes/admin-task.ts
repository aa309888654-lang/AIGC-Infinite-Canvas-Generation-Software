import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { parsePaginationParamsWithNumbers } from '../utils/pagination';
import { z } from 'zod';
import { websocketPushService } from '../services/websocket-push-service';

export const adminTaskRouter = Router();

const batchDeleteSchema = z.object({
  taskIds: z.array(z.string()).min(1).max(100),
});

const reviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(500).optional(),
});

const reviewSettingsSchema = z.object({ enabled: z.boolean() });
const batchReviewSchema = z.object({
  taskIds: z.array(z.string()).min(1).max(100),
  status: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(500).optional(),
});

function parseTaskResult(result: string | null): Record<string, unknown> | null {
  if (!result) return null;
  try {
    const parsed: unknown = JSON.parse(result);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return /^https?:\/\//i.test(result) ? { url: result } : null;
  }
}

async function getAdminUsername(adminId?: string): Promise<string> {
  if (!adminId) return 'admin';
  const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { username: true } });
  return admin?.username || 'admin';
}

// 获取所有任务（内容管理）
adminTaskRouter.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { page, pageSize, status, type, search } = req.query;
    const pagination = parsePaginationParamsWithNumbers(Number(page), Number(pageSize));

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    } else {
      // 默认不返回已删除的任务，避免删除后仍显示在列表中
      where.status = { not: 'deleted' };
    }
    if (type && type !== 'all') where.type = type;
    if (search) {
      where.OR = [
        { id: { contains: search as string } },
        { prompt: { contains: search as string } },
        { user: { username: { contains: search as string } } },
        { user: { email: { contains: search as string } } },
      ];
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { username: true, email: true, avatar: true }
          }
        }
      }),
      prisma.task.count({ where }),
    ]);

    const tasksWithThumbnail = tasks.map((task: any) => {
      let thumbnailUrl: string | null = null;
      let resultUrl: string | null = null;

      try {
        const result = parseTaskResult(task.result);
        if (result) {
          if (task.type === 'image') {
            thumbnailUrl = String(result.url || result.imageUrl || (result.urls as string[] | undefined)?.[0] || '') || null;
            resultUrl = thumbnailUrl;
          } else if (task.type === 'video') {
            thumbnailUrl = String(result.coverUrl || result.thumbnailUrl || result.posterUrl || '') || null;
            resultUrl = String(result.url || result.videoUrl || (result.urls as string[] | undefined)?.[0] || '') || null;
          } else if (task.type === 'audio') {
            resultUrl = String(result.url || result.audioUrl || '') || null;
          } else {
            resultUrl = String(result.url || result.resultUrl || '') || null;
          }
        }
      } catch {
        // Keep task listing available when a legacy result payload is malformed.
      }

      return {
        ...task,
        username: task.user?.username || undefined,
        email: task.user?.email || undefined,
        avatar: task.user?.avatar || undefined,
        thumbnailUrl: thumbnailUrl || task.thumbnailUrl || null,
        resultUrl: resultUrl || task.outputUrl || task.cosUrl || null,
      };
    });

    res.json({
      success: true,
      tasks: tasksWithThumbnail,
      pagination: {
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: Math.ceil(total / (pagination.pageSize || 10)),
      }
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

// 获取任务统计
adminTaskRouter.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const notDeleted = { status: { not: 'deleted' } };
    const [total, pending, processing, completed, failed, images, videos, audio, music] = await Promise.all([
      prisma.task.count({ where: notDeleted }),
      prisma.task.count({ where: { status: 'pending' } }),
      prisma.task.count({ where: { status: 'processing' } }),
      prisma.task.count({ where: { status: 'completed' } }),
      prisma.task.count({ where: { status: 'failed' } }),
      prisma.task.count({ where: { type: 'image', ...notDeleted } }),
      prisma.task.count({ where: { type: 'video', ...notDeleted } }),
      prisma.task.count({ where: { type: 'audio', ...notDeleted } }),
      prisma.task.count({ where: { type: 'music', ...notDeleted } }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        pending,
        processing,
        completed,
        failed,
        images,
        videos,
        audio,
        music,
      }
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

// 内容审核端点（review-settings / batch-review / :id/review）已随审核系统移除

// 取消任务
adminTaskRouter.post('/:id/cancel', authenticate, requireAdmin, async (req, res) => {
  try {
    await prisma.task.update({
      where: { id: req.params.id },
      data: { status: 'cancelled' }
    });
    res.json({ success: true, message: 'Task cancelled' });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

// 重试任务
adminTaskRouter.post('/:id/retry', authenticate, requireAdmin, async (req, res) => {
  try {
    await prisma.task.update({
      where: { id: req.params.id },
      data: { status: 'pending', error: null }
    });
    res.json({ success: true, message: 'Task retry initiated' });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

// 删除任务（软删除或状态更新）
adminTaskRouter.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在' });
    }
    await prisma.task.update({
      where: { id: req.params.id },
      data: { status: 'deleted' }
    });
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

// 恢复任务（仅对已软删除的任务生效，按 result/error 启发式还原状态，避免一律置为 completed）
adminTaskRouter.post('/:id/restore', authenticate, requireAdmin, async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      select: { status: true, result: true, error: true },
    });
    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在' });
    }
    if (task.status !== 'deleted') {
      return res.status(400).json({ success: false, error: '该任务未处于已删除状态，无需恢复' });
    }
    // 启发式还原：有结果→已完成；有错误→失败；否则→等待中（可继续处理）
    const restoredStatus = task.result ? 'completed' : (task.error ? 'failed' : 'pending');
    await prisma.task.update({
      where: { id: req.params.id },
      data: { status: restoredStatus }
    });
    res.json({ success: true, data: { status: restoredStatus } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

// 批量删除任务
adminTaskRouter.post('/batch-delete', authenticate, requireAdmin, async (req, res) => {
  try {
    const { taskIds } = batchDeleteSchema.parse(req.body);

    const result = await prisma.task.updateMany({
      where: { id: { in: taskIds } },
      data: { status: 'deleted' },
    });

    res.json({
      success: true,
      data: { deletedCount: result.count, requestedCount: taskIds.length },
      message: `已删除 ${result.count} 个任务`,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '参数验证失败', details: error.errors });
    }
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

export default adminTaskRouter;
