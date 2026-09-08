import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const communityRouter = Router();

const CATEGORIES = ['视频创作分享', '图片生成交流', '技术问答', '教程资源', '用户反馈', '综合讨论'];

// 获取帖子列表（公开，支持分页和分类筛选）
communityRouter.get('/posts', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const category = req.query.category as string | undefined;
    const keyword = req.query.keyword as string | undefined;
    const sort = (req.query.sort as string) || 'latest';

    const where: any = { isDeleted: false, status: 'published' };
    if (category && category !== 'all' && CATEGORIES.includes(category)) {
      where.category = category;
    }
    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { content: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const orderBy: any[] = [{ isPinned: 'desc' }];
    if (sort === 'hot') {
      orderBy.push({ likeCount: 'desc' }, { createdAt: 'desc' });
    } else if (sort === 'comments') {
      orderBy.push({ commentCount: 'desc' }, { createdAt: 'desc' });
    } else {
      orderBy.push({ createdAt: 'desc' });
    }

    const [posts, total] = await Promise.all([
      prisma.communityPost.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, username: true, avatar: true } },
          _count: { select: { comments: true, likes: true } },
        },
      }),
      prisma.communityPost.count({ where }),
    ]);

    const userId = req.userId;
    let likedPostIds: string[] = [];
    if (userId && posts.length > 0) {
      const likes = await prisma.communityPostLike.findMany({
        where: { userId, postId: { in: posts.map((p) => p.id) } },
        select: { postId: true },
      });
      likedPostIds = likes.map((l) => l.postId);
    }

    const formatted = posts.map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content.length > 200 ? post.content.substring(0, 200) + '...' : post.content,
      fullContent: post.content,
      category: post.category,
      images: post.images,
      viewCount: post.viewCount,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      isPinned: post.isPinned,
      author: {
        id: post.user.id,
        username: post.user.username,
        avatar: post.user.avatar,
      },
      isLiked: likedPostIds.includes(post.id),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    }));

    res.json({
      success: true,
      data: {
        posts: formatted,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
});

// 获取帖子详情
communityRouter.get('/posts/:postId', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { postId } = req.params;

    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
        _count: { select: { comments: true, likes: true } },
      },
    });

    if (!post || post.isDeleted) {
      throw new AppError('帖子不存在', 404);
    }

    await prisma.communityPost.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
    });

    let isLiked = false;
    if (req.userId) {
      const like = await prisma.communityPostLike.findUnique({
        where: { postId_userId: { postId, userId: req.userId } },
      });
      isLiked = !!like;
    }

    res.json({
      success: true,
      data: {
        id: post.id,
        title: post.title,
        content: post.content,
        category: post.category,
        images: post.images,
        viewCount: post.viewCount + 1,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        isPinned: post.isPinned,
        author: {
          id: post.user.id,
          username: post.user.username,
          avatar: post.user.avatar,
        },
        isLiked,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 发帖
communityRouter.post('/posts', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { title, content, category, images } = req.body;
    const userId = req.userId!;

    if (!title?.trim() || !content?.trim()) {
      throw new AppError('标题和内容不能为空', 400);
    }
    if (title.length > 100) {
      throw new AppError('标题不能超过100个字符', 400);
    }
    if (content.length > 10000) {
      throw new AppError('内容不能超过10000个字符', 400);
    }
    if (category && !CATEGORIES.includes(category)) {
      throw new AppError('无效的分类', 400);
    }

    const post = await prisma.communityPost.create({
      data: {
        userId,
        title: title.trim(),
        content: content.trim(),
        category: category || '综合讨论',
        images: images || undefined,
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: post.id,
        title: post.title,
        content: post.content,
        category: post.category,
        images: post.images,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        author: {
          id: post.user.id,
          username: post.user.username,
          avatar: post.user.avatar,
        },
        createdAt: post.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 删除帖子（仅作者）
communityRouter.delete('/posts/:postId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { postId } = req.params;
    const userId = req.userId!;

    const post = await prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post || post.isDeleted) {
      throw new AppError('帖子不存在', 404);
    }
    if (post.userId !== userId) {
      throw new AppError('无权删除此帖子', 403);
    }

    await prisma.communityPost.update({
      where: { id: postId },
      data: { isDeleted: true },
    });

    res.json({ success: true, message: '帖子已删除' });
  } catch (error) {
    next(error);
  }
});

// 点赞/取消点赞
communityRouter.post('/posts/:postId/like', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { postId } = req.params;
    const userId = req.userId!;

    const post = await prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post || post.isDeleted) {
      throw new AppError('帖子不存在', 404);
    }

    const existingLike = await prisma.communityPostLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existingLike) {
      await prisma.communityPostLike.delete({ where: { id: existingLike.id } });
      await prisma.communityPost.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
      });
      res.json({ success: true, data: { liked: false, likeCount: post.likeCount - 1 } });
    } else {
      await prisma.communityPostLike.create({ data: { postId, userId } });
      await prisma.communityPost.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
      });
      res.json({ success: true, data: { liked: true, likeCount: post.likeCount + 1 } });
    }
  } catch (error) {
    next(error);
  }
});

// 获取帖子评论
communityRouter.get('/posts/:postId/comments', optionalAuth, async (req, res, next) => {
  try {
    const { postId } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 20));

    const post = await prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post || post.isDeleted) {
      throw new AppError('帖子不存在', 404);
    }

    const [comments, total] = await Promise.all([
      prisma.communityComment.findMany({
        where: { postId, isDeleted: false, parentId: null },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, username: true, avatar: true } },
          replies: {
            where: { isDeleted: false },
            orderBy: { createdAt: 'asc' },
            take: 5,
            include: {
              user: { select: { id: true, username: true, avatar: true } },
            },
          },
          _count: { select: { replies: true } },
        },
      }),
      prisma.communityComment.count({ where: { postId, isDeleted: false, parentId: null } }),
    ]);

    const formatted = comments.map((c) => ({
      id: c.id,
      content: c.content,
      likeCount: c.likeCount,
      author: {
        id: c.user.id,
        username: c.user.username,
        avatar: c.user.avatar,
      },
      replies: c.replies.map((r) => ({
        id: r.id,
        content: r.content,
        likeCount: r.likeCount,
        author: {
          id: r.user.id,
          username: r.user.username,
          avatar: r.user.avatar,
        },
        createdAt: r.createdAt,
      })),
      replyCount: c._count.replies,
      createdAt: c.createdAt,
    }));

    res.json({
      success: true,
      data: {
        comments: formatted,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
});

// 发表评论
communityRouter.post('/posts/:postId/comments', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { postId } = req.params;
    const { content, parentId } = req.body;
    const userId = req.userId!;

    if (!content?.trim()) {
      throw new AppError('评论内容不能为空', 400);
    }
    if (content.length > 2000) {
      throw new AppError('评论不能超过2000个字符', 400);
    }

    const post = await prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post || post.isDeleted) {
      throw new AppError('帖子不存在', 404);
    }

    if (parentId) {
      const parentComment = await prisma.communityComment.findUnique({
        where: { id: parentId },
      });
      if (!parentComment || parentComment.postId !== postId) {
        throw new AppError('父评论不存在', 404);
      }
    }

    const comment = await prisma.communityComment.create({
      data: {
        postId,
        userId,
        content: content.trim(),
        parentId: parentId || null,
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
    });

    await prisma.communityPost.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    });

    res.status(201).json({
      success: true,
      data: {
        id: comment.id,
        content: comment.content,
        likeCount: 0,
        author: {
          id: comment.user.id,
          username: comment.user.username,
          avatar: comment.user.avatar,
        },
        replies: [],
        replyCount: 0,
        createdAt: comment.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 删除评论（仅作者）
communityRouter.delete('/comments/:commentId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { commentId } = req.params;
    const userId = req.userId!;

    const comment = await prisma.communityComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.isDeleted) {
      throw new AppError('评论不存在', 404);
    }
    if (comment.userId !== userId) {
      throw new AppError('无权删除此评论', 403);
    }

    await prisma.communityComment.update({
      where: { id: commentId },
      data: { isDeleted: true },
    });

    await prisma.communityPost.update({
      where: { id: comment.postId },
      data: { commentCount: { decrement: 1 } },
    });

    res.json({ success: true, message: '评论已删除' });
  } catch (error) {
    next(error);
  }
});

// 申请加入社区
communityRouter.post('/applications', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { reason } = req.body;
    const userId = req.userId!;

    if (!reason?.trim()) {
      throw new AppError('请填写申请理由', 400);
    }
    if (reason.length > 500) {
      throw new AppError('申请理由不能超过500个字符', 400);
    }

    const existing = await prisma.communityApplication.findFirst({
      where: {
        userId,
        status: { in: ['pending', 'approved'] },
      },
    });

    if (existing) {
      if (existing.status === 'pending') {
        throw new AppError('您已提交申请，请等待审核', 400);
      }
      if (existing.status === 'approved') {
        throw new AppError('您已是社区成员', 400);
      }
    }

    const application = await prisma.communityApplication.create({
      data: {
        userId,
        reason: reason.trim(),
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: application.id,
        status: application.status,
        createdAt: application.createdAt,
      },
      message: '申请已提交，请等待审核',
    });
  } catch (error) {
    next(error);
  }
});

// 查询自己的申请状态
communityRouter.get('/applications/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;

    const application = await prisma.communityApplication.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: application
        ? {
            id: application.id,
            status: application.status,
            reason: application.reason,
            adminNote: application.adminNote,
            createdAt: application.createdAt,
            reviewedAt: application.reviewedAt,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

// 获取社区统计
communityRouter.get('/stats', async (req, res, next) => {
  try {
    const [postCount, memberCount] = await Promise.all([
      prisma.communityPost.count({ where: { isDeleted: false, status: 'published' } }),
      prisma.communityApplication.count({ where: { status: 'approved' } }),
    ]);

    res.json({
      success: true,
      data: {
        postCount,
        memberCount: memberCount + 1200,
        totalViews: 17000,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 获取分类列表
communityRouter.get('/categories', (req, res) => {
  res.json({
    success: true,
    data: CATEGORIES,
  });
});
