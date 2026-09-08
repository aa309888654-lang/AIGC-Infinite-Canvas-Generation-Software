import { Router, Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { websocketPushService, WebSocketEvent } from '../../services/websocket-push-service';
import { safeParseInt } from '../../utils/parse';
import { logger } from '../../utils/logger';

const router = Router();

// 获取通知列表（管理员）
router.get('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { 
      page = '1', 
      pageSize = '20', 
      type, 
      userId, 
      isRead 
    } = req.query;

    const pageNum = safeParseInt(page as string, 1);
    const pageSizeNum = safeParseInt(pageSize as string, 20);
    const skip = (pageNum - 1) * pageSizeNum;

    // 构建查询条件
    const where: any = {};
    
    if (type) {
      where.type = type as string;
    }
    
    if (userId) {
      where.userId = userId as string;
    }
    
    if (isRead !== undefined) {
      where.isRead = isRead === 'true';
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSizeNum
      }),
      prisma.notification.count({ where })
    ]);

    res.json({
      success: true,
      data: notifications,
      meta: {
        page: pageNum,
        pageSize: pageSizeNum,
        total,
        totalPages: Math.ceil(total / pageSizeNum)
      }
    });
  } catch (error) {
    logger.error('获取通知列表失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      success: false,
      error: '获取通知列表失败'
    });
  }
});

// 发送通知
router.post('/send', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { 
      userId,           // 接收用户 ID（可选，不填则发送给全体）
      type = 'system',  // 通知类型：system, task, payment
      title,            // 标题
      content,          // 内容
      data,             // 附加数据（JSON）
      priority = 'normal' // 优先级：low, normal, high
    } = req.body;

    // 验证必填字段
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: '标题和内容不能为空'
      });
    }

    // 如果指定了用户 ID，验证用户是否存在
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: '指定用户不存在'
        });
      }
    }

    // 创建通知
    // FIX-AUDIT-03: 广播时不使用 'system' 作为 userId（会违反外键约束），
    // 而是为所有用户批量创建通知记录
    let notification: any;
    
    if (userId) {
      // 单用户通知
      notification = await prisma.notification.create({
        data: {
          userId,
          type,
          title,
          content,
          data: data || null,
          priority,
          isRead: false
        },
        include: {
          user: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });
    } else {
      // 系统广播：为所有用户创建通知记录
      const allUsers = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true }
      });
      
      await prisma.notification.createMany({
        data: allUsers.map(u => ({
          userId: u.id,
          type,
          title,
          content,
          data: data || null,
          priority,
          isRead: false
        }))
      });

      notification = {
        id: 'broadcast',
        type,
        title,
        content,
        priority,
        data: data || null,
        createdAt: new Date().toISOString(),
        broadcastCount: allUsers.length,
      };
    }

    // 通过 WebSocket 推送通知给用户
    // FIX-AUDIT-03: 统一 createdAt 为字符串，避免 Date vs string 类型不一致
    const createdAtStr = typeof notification.createdAt === 'string'
      ? notification.createdAt
      : notification.createdAt.toISOString();

    if (userId) {
      // 单用户通知
      await websocketPushService.notifyNewNotification(userId, {
        id: notification.id,
        type,
        title,
        content,
        priority,
        data,
        createdAt: createdAtStr,
      });
    } else {
      // 系统广播通知
      await websocketPushService.broadcast({
        type: WebSocketEvent.NOTIFICATION,
        data: {
          id: notification.id,
          type,
          title,
          content,
          priority,
          data,
          createdAt: createdAtStr,
        },
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: notification,
      message: '通知发送成功'
    });
  } catch (error) {
    logger.error('发送通知失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      success: false,
      error: '发送通知失败'
    });
  }
});

// 批量发送通知
router.post('/send-batch', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { 
      userIds,          // 用户 ID 数组
      type = 'system',
      title,
      content,
      data,
      priority = 'normal'
    } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '用户 ID 数组不能为空'
      });
    }

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: '标题和内容不能为空'
      });
    }

    // 批量创建通知
    const notifications = await prisma.notification.createMany({
      data: userIds.map(uid => ({
        userId: uid,
        type,
        title,
        content,
        data: data || null,
        priority,
        isRead: false
      }))
    });

    // 通过 WebSocket 批量推送通知
    const notificationData = {
      type,
      title,
      content,
      priority,
      data,
      createdAt: new Date().toISOString(),
    };

    // 并行向所有用户发送 WebSocket 通知
    await Promise.all(
      userIds.map(userId =>
        websocketPushService.notifyNewNotification(userId, notificationData).catch((err: Error) => {
          logger.error(`发送 WebSocket 通知失败 ${userId}:`, err instanceof Error ? err.message : String(err));
        })
      )
    );
    
    res.json({
      success: true,
      data: { count: notifications.count },
      message: `已向 ${notifications.count} 个用户发送通知`
    });
  } catch (error) {
    logger.error('批量发送通知失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      success: false,
      error: '批量发送通知失败'
    });
  }
});

// 标记通知为已读
router.put('/:id/read', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.update({
      where: { id },
      data: { 
        isRead: true,
        readAt: new Date()
      }
    });

    res.json({
      success: true,
      data: notification,
      message: '已标记为已读'
    });
  } catch (error) {
    logger.error('标记通知失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      success: false,
      error: '标记通知失败'
    });
  }
});

// 批量标记已读
router.post('/mark-read-batch', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { notificationIds } = req.body;

    if (!Array.isArray(notificationIds)) {
      return res.status(400).json({
        success: false,
        error: '通知 ID 数组格式不正确'
      });
    }

    await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds }
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    res.json({
      success: true,
      message: '批量标记成功'
    });
  } catch (error) {
    logger.error('批量标记失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      success: false,
      error: '批量标记失败'
    });
  }
});

// 删除通知
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.notification.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    logger.error('删除通知失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      success: false,
      error: '删除通知失败'
    });
  }
});

// 标记所有通知为已读
router.post('/read-all', authenticate, requireAdmin, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { isRead: false },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error('标记所有通知失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      success: false,
      error: '全部标记失败'
    });
  }
});

// 获取通知统计
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const [total, unread, todayCount] = await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { isRead: false } }),
      prisma.notification.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ]);

    const typeStats = await prisma.notification.groupBy({
      by: ['type'],
      _count: true,
    });

    const byType: Record<string, number> = {};
    typeStats.forEach(stat => {
      byType[stat.type] = stat._count;
    });

    res.json({
      success: true,
      data: {
        total,
        unread,
        todayCount,
        byType,
      }
    });
  } catch (error) {
    logger.error('获取通知统计失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      success: false,
      error: '获取统计信息失败'
    });
  }
});

export default router;
