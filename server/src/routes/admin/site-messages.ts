import { Router, Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { safeParseInt } from '../../utils/parse';
import { logger } from '../../utils/logger';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = safeParseInt(req.query.page as string, 1);
    const pageSize = safeParseInt(req.query.pageSize as string, 20);
    const skip = (page - 1) * pageSize;
    const isActive = req.query.isActive;

    const where: Record<string, unknown> = {};
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;

    const [messages, total] = await Promise.all([
      prisma.siteMessage.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      prisma.siteMessage.count({ where }),
    ]);

    res.json({
      success: true,
      data: messages,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (error) {
    logger.error('[Admin SiteMessage] list error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ success: false, error: '获取消息列表失败' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      title,
      content,
      type = 'system',
      priority = 'normal',
      audience = 'all',
      showInLogin = true,
      autoPopup = false,
      isActive = true,
      sortOrder = 0,
      linkUrl,
      linkLabel,
      startsAt,
      endsAt,
    } = req.body;

    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ success: false, error: '标题和内容不能为空' });
    }

    const message = await prisma.siteMessage.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        type,
        priority,
        audience,
        showInLogin: Boolean(showInLogin),
        autoPopup: Boolean(autoPopup),
        isActive: Boolean(isActive),
        sortOrder: Number(sortOrder) || 0,
        linkUrl: linkUrl || null,
        linkLabel: linkLabel || null,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
      },
    });

    res.json({ success: true, data: message, message: '消息创建成功' });
  } catch (error) {
    logger.error('[Admin SiteMessage] create error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ success: false, error: '创建消息失败' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      type,
      priority,
      audience,
      showInLogin,
      autoPopup,
      isActive,
      sortOrder,
      linkUrl,
      linkLabel,
      startsAt,
      endsAt,
    } = req.body;

    const message = await prisma.siteMessage.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: String(title).trim() }),
        ...(content !== undefined && { content: String(content).trim() }),
        ...(type !== undefined && { type }),
        ...(priority !== undefined && { priority }),
        ...(audience !== undefined && { audience }),
        ...(showInLogin !== undefined && { showInLogin: Boolean(showInLogin) }),
        ...(autoPopup !== undefined && { autoPopup: Boolean(autoPopup) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) || 0 }),
        ...(linkUrl !== undefined && { linkUrl: linkUrl || null }),
        ...(linkLabel !== undefined && { linkLabel: linkLabel || null }),
        ...(startsAt !== undefined && { startsAt: startsAt ? new Date(startsAt) : null }),
        ...(endsAt !== undefined && { endsAt: endsAt ? new Date(endsAt) : null }),
      },
    });

    res.json({ success: true, data: message, message: '消息更新成功' });
  } catch (error) {
    logger.error('[Admin SiteMessage] update error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ success: false, error: '更新消息失败' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.siteMessage.delete({ where: { id } });
    res.json({ success: true, message: '消息已删除' });
  } catch (error) {
    logger.error('[Admin SiteMessage] delete error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ success: false, error: '删除消息失败' });
  }
});

export default router;
