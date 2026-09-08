import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
export const chatRouter = Router();

const sendMessageSchema = z.object({
  content: z.string().min(1, '消息内容不能为空').max(2000, '消息内容不能超过2000字'),
});

const adminReplySchema = z.object({
  content: z.string().min(1, '回复内容不能为空').max(2000, '回复内容不能超过2000字'),
});

chatRouter.post('/conversations', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    let conversation = await prisma.chatConversation.findFirst({
      where: { userId, status: 'active' },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (!conversation) {
      conversation = await prisma.chatConversation.create({
        data: { userId, status: 'active' },
      });
    }

    res.json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
});

chatRouter.get('/conversations', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const conversations = await prisma.chatConversation.findMany({
      where: { userId },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    const unreadCount = await prisma.chatMessage.count({
      where: {
        conversation: { userId },
        senderType: 'admin',
        isRead: false,
      },
    });

    res.json({ success: true, data: { conversations, unreadCount } });
  } catch (error) {
    next(error);
  }
});

chatRouter.get('/conversations/:id/messages', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const conversationId = req.params.id;
    const before = req.query.before as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const conversation = await prisma.chatConversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new AppError('对话不存在', 404);
    }

    const where: any = { conversationId };
    if (before) {
      where.createdAt = { lt: new Date(before) };
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    await prisma.chatMessage.updateMany({
      where: { conversationId, senderType: 'admin', isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true, data: messages.reverse() });
  } catch (error) {
    next(error);
  }
});

chatRouter.post('/conversations/:id/messages', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const conversationId = req.params.id;
    const { content } = sendMessageSchema.parse(req.body);

    const conversation = await prisma.chatConversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new AppError('对话不存在', 404);
    }

    if (conversation.status === 'closed') {
      await prisma.chatConversation.update({
        where: { id: conversationId },
        data: { status: 'active' },
      });
    }

    const message = await prisma.chatMessage.create({
      data: {
        conversationId,
        senderType: 'user',
        senderId: userId,
        content,
      },
    });

    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    res.json({ success: true, data: message });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '参数验证失败', details: error.errors });
    }
    next(error);
  }
});

chatRouter.get('/unread-count', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const unreadCount = await prisma.chatMessage.count({
      where: {
        conversation: { userId },
        senderType: 'admin',
        isRead: false,
      },
    });
    res.json({ success: true, data: { unreadCount } });
  } catch (error) {
    next(error);
  }
});

// ==================== 管理员接口 ====================

const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { role: true },
  });
  if (!user || (user.role !== 'ADMIN' && user.role !== 'admin')) {
    return res.status(403).json({ success: false, error: '需要管理员权限' });
  }
  next();
};

chatRouter.get('/admin/conversations', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const status = req.query.status as string | undefined;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const [conversations, total] = await Promise.all([
      prisma.chatConversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, username: true, email: true, avatar: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      prisma.chatConversation.count({ where }),
    ]);

    const unreadStats = await prisma.chatMessage.groupBy({
      by: ['conversationId'],
      where: { senderType: 'user', isRead: false },
      _count: true,
    });

    const unreadMap = new Map(unreadStats.map(s => [s.conversationId, s._count]));
    const result = conversations.map(c => ({
      ...c,
      unreadAdminCount: unreadMap.get(c.id) || 0,
    }));

    res.json({
      success: true,
      data: {
        conversations: result,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    next(error);
  }
});

chatRouter.get('/admin/conversations/:id/messages', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversationId = req.params.id;
    const before = req.query.before as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: { user: { select: { id: true, username: true, email: true, avatar: true } } },
    });

    if (!conversation) {
      throw new AppError('对话不存在', 404);
    }

    const where: any = { conversationId };
    if (before) {
      where.createdAt = { lt: new Date(before) };
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    await prisma.chatMessage.updateMany({
      where: { conversationId, senderType: 'user', isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true, data: { conversation, messages: messages.reverse() } });
  } catch (error) {
    next(error);
  }
});

chatRouter.post('/admin/conversations/:id/reply', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.userId!;
    const conversationId = req.params.id;
    const { content } = adminReplySchema.parse(req.body);

    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new AppError('对话不存在', 404);
    }

    const message = await prisma.chatMessage.create({
      data: {
        conversationId,
        senderType: 'admin',
        senderId: adminId,
        content,
      },
    });

    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    res.json({ success: true, data: message });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '参数验证失败', details: error.errors });
    }
    next(error);
  }
});

chatRouter.patch('/admin/conversations/:id/status', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversationId = req.params.id;
    const { status } = req.body as { status: string };

    if (!['active', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, error: '无效的状态值' });
    }

    const conversation = await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { status },
    });

    res.json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
});

chatRouter.get('/admin/stats', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalConversations, activeConversations, unreadUserMessages] = await Promise.all([
      prisma.chatConversation.count(),
      prisma.chatConversation.count({ where: { status: 'active' } }),
      prisma.chatMessage.count({ where: { senderType: 'user', isRead: false } }),
    ]);

    res.json({
      success: true,
      data: { totalConversations, activeConversations, unreadUserMessages },
    });
  } catch (error) {
    next(error);
  }
});

export default chatRouter;
