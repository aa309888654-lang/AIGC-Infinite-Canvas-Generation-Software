import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { assertTaskStatusTransition, isTerminalTaskStatus } from '../services/task-state-transition-service';
import { websocketPushService } from '../services/websocket-push-service';
import { videoTaskBindingService } from '../services/video-task-binding-service';
import { videoModelKeyScheduler } from '../services/video-model-key-scheduler';
import { logger } from '../utils/logger';
// 内容审核系统已移除：任务结果始终直接展示，不再做审核遮蔽

export const taskRouter = Router();

/**
 * @swagger
 * /api/task/{taskId}:
 *   get:
 *     summary: 查询任务状态
 *     description: 查询 AI 生成任务的当前状态和进度
 *     tags: [AI 生成]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: 任务 ID
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     taskId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [pending, processing, completed, failed]
 *                     progress:
 *                       type: number
 *                     resultUrl:
 *                       type: string
 *                     error:
 *                       type: string
 *       404:
 *         description: 任务不存在
 *       401:
 *         description: 未授权
 */
taskRouter.get('/:taskId', authenticate, async (req, res, next) => {
  try {
    const { taskId } = req.params;

    const task = await prisma.task.findFirst({
      where: { id: taskId, userId: req.userId },
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
        progress: true,
        result: true,
        outputUrl: true,
        cosUrl: true,
        thumbnailUrl: true,
        error: true,
        updatedAt: true,
      }
    });

    if (!task) {
      throw new AppError('任务不存在或无权访问', 404);
    }

    const visibleTask = task;

    // 解析输出结果（可能是 JSON 字符串）
    let resultUrl: string | undefined;
    let parsedResult: Record<string, unknown> | undefined;
    try {
      if (visibleTask.result) {
        const output = JSON.parse(visibleTask.result) as Record<string, unknown>;
        parsedResult = output;
        resultUrl = (output.resultUrl || output.url || output.audioUrl || (output.urls as string[])?.[0]) as string | undefined;
      }
    } catch {
      resultUrl = visibleTask.outputUrl || undefined;
    }

    res.json({
      success: true,
      data: {
        taskId: task.id,
        type: task.type,
        status: task.status as 'pending' | 'processing' | 'completed' | 'failed',
        progress: task.progress,
        resultAvailable: true,
        resultUrl: resultUrl || visibleTask.outputUrl || undefined,
        result: parsedResult,
        error: task.error
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: 获取任务列表
 *     description: 获取当前用户的所有任务列表
 *     tags: [AI 生成]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 每页数量
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         description: 任务状态筛选
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [image, video]
 *         description: 任务类型筛选
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     tasks:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *       401:
 *         description: 未授权
 */
taskRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const skip = (page - 1) * pageSize;

    const status = req.query.status as string;
    const type = req.query.type as string;

    const where: any = { userId: req.userId };
    
    if (status) {
      where.status = status;
    }
    
    if (type) {
      where.type = type;
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          type: true,
          provider: true,
          model: true,
          status: true,
          progress: true,
          params: true,
          result: true,
          outputUrl: true,
          cosUrl: true,
          thumbnailUrl: true,
          error: true,
          createdAt: true,
          updatedAt: true,
        }
      }),
      prisma.task.count({ where })
    ]);

    const visibleTasks = tasks;

    res.json({
      success: true,
      data: {
        tasks: visibleTasks.map(task => ({
          ...task,
          taskType: task.type,
          inputParams: task.params || {},
          outputResult: task.result || {},
          resultUrl: task.outputUrl || undefined,
          resultAvailable: true,
          errorMessage: task.error,
        }))
      },
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /:taskId/retry — 重试失败/取消的任务
 * Sprint 3：统一任务队列
 * 读取原 task 的 params/prompt/type/provider/model，创建新 Task 记录（status='pending'）。
 * WS 广播 notifyTaskProgress 通知前端新 task。
 */
taskRouter.post('/:taskId/retry', authenticate, async (req, res, next) => {
  try {
    const { taskId } = req.params;

    const originalTask = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId: req.userId,
      },
      select: {
        id: true,
        type: true,
        status: true,
        prompt: true,
        params: true,
        provider: true,
        model: true,
      },
    });

    if (!originalTask) {
      throw new AppError('任务不存在', 404);
    }

    if (!isTerminalTaskStatus(originalTask.status)) {
      throw new AppError(`任务仍在进行中（${originalTask.status}），无法重试`, 409);
    }

    const newTask = await prisma.task.create({
      data: {
        userId: req.userId!,
        type: originalTask.type,
        prompt: originalTask.prompt,
        params: originalTask.params,
        provider: originalTask.provider,
        model: originalTask.model,
        status: 'pending',
        progress: 0,
      },
    });

    if (req.userId) {
      websocketPushService.notifyTaskProgress(req.userId, newTask.id, 0, {
        type: originalTask.type || undefined,
        provider: originalTask.provider || undefined,
        prompt: originalTask.prompt || undefined,
      }).catch((wsErr) => {
        logger.warn(`[TaskRetry] WS 通知用户 ${req.userId} 失败:`, wsErr);
      });
    }

    res.json({
      success: true,
      message: 'Task retry submitted',
      data: { taskId: newTask.id, originalTaskId: taskId, status: 'pending' },
    });
  } catch (error: unknown) {
    next(error);
  }
});

taskRouter.post('/:taskId/cancel', authenticate, async (req, res, next) => {
  try {
    const { taskId } = req.params;

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId: req.userId,
      },
      select: {
        id: true,
        status: true,
        type: true,
        provider: true,
        providerTaskId: true,
        prompt: true,
      },
    });

    if (!task) {
      throw new AppError('任务不存在', 404);
    }

    if (isTerminalTaskStatus(task.status)) {
      return res.json({
        success: true,
        message: 'Task already finished',
        data: { taskId, status: task.status },
      });
    }

    try {
      assertTaskStatusTransition(task.status, 'cancelled');
    } catch {
      throw new AppError(`任务状态 ${task.status} 不允许取消`, 409);
    }

    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'cancelled',
        error: '用户已取消任务',
      },
    });

    // Sprint 3: 释放视频任务密钥租约（如适用）
    if (task.type === 'video') {
      try {
        const binding = await videoTaskBindingService.getByLocalTaskId(taskId);
        if (binding) {
          await videoModelKeyScheduler.release(binding.keyId, binding.leaseToken);
          await videoTaskBindingService.clear(binding);
          logger.info(`[TaskCancel] 视频任务 ${taskId} 租约已释放 (keyId=${binding.keyId})`);
        }
      } catch (releaseErr) {
        logger.warn(`[TaskCancel] 释放任务 ${taskId} 租约失败:`, releaseErr);
      }
    }

    // Sprint 3: WS 广播任务取消通知，前端 task store 同步更新
    if (req.userId) {
      websocketPushService.notifyTaskFailed(req.userId, taskId, '用户已取消任务', {
        type: task.type || undefined,
        provider: task.provider || undefined,
        prompt: task.prompt || undefined,
      }).catch((wsErr) => {
        logger.warn(`[TaskCancel] WS 通知用户 ${req.userId} 失败:`, wsErr);
      });
    }

    res.json({
      success: true,
      message: 'Task cancelled',
      data: { taskId, status: 'cancelled' },
    });
  } catch (error: unknown) {
    next(error);
  }
});
