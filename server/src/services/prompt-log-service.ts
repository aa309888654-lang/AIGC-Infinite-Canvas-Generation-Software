import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

export interface CreatePromptLogParams {
  userId?: string;
  prompt: string;
  negativePrompt?: string;
  model?: string;
  provider?: string;
  type?: string;
  source?: string;
  optimizedPrompt?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

class PromptLogService {
  async create(params: CreatePromptLogParams) {
    try {
      return await prisma.promptLog.create({
        data: {
          userId: params.userId || null,
          prompt: params.prompt,
          negativePrompt: params.negativePrompt || '',
          model: params.model || null,
          provider: params.provider || null,
          type: params.type || 'image',
          source: params.source || 'ai-view',
          optimizedPrompt: params.optimizedPrompt || null,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        },
      });
    } catch (error: any) {
      logger.error('[PromptLog] 保存失败:', error.message);
      return null;
    }
  }

  async list(params: {
    page?: number;
    pageSize?: number;
    type?: string;
    source?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    keyword?: string;
  }) {
    const { page = 1, pageSize = 50, type, source, userId, startDate, endDate, keyword } = params;
    const where: any = {};
    if (type) where.type = type;
    if (source) where.source = source;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    if (keyword) {
      where.prompt = { contains: keyword };
    }

    const [items, total] = await Promise.all([
      prisma.promptLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.promptLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async exportAll(params: {
    type?: string;
    source?: string;
    startDate?: string;
    endDate?: string;
    keyword?: string;
    format?: string;
  }) {
    const { type, source, startDate, endDate, keyword, format = 'json' } = params;
    const where: any = {};
    if (type) where.type = type;
    if (source) where.source = source;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    if (keyword) {
      where.prompt = { contains: keyword };
    }

    const items = await prisma.promptLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        prompt: true,
        negativePrompt: true,
        model: true,
        provider: true,
        type: true,
        source: true,
        optimizedPrompt: true,
        ipAddress: true,
        metadata: true,
        createdAt: true,
      },
    });

    if (format === 'csv') {
      const header = 'ID,用户ID,提示词,反向提示词,模型,Provider,类型,来源,优化后提示词,IP,创建时间\n';
      const rows = items.map(item => {
        const escape = (s: string | null) => (s || '').replace(/"/g, '""');
        return `"${escape(item.id)}","${escape(item.userId)}","${escape(item.prompt)}","${escape(item.negativePrompt)}","${escape(item.model)}","${escape(item.provider)}","${escape(item.type)}","${escape(item.source)}","${escape(item.optimizedPrompt)}","${escape(item.ipAddress)}","${item.createdAt.toISOString()}"`;
      }).join('\n');
      return header + rows;
    }

    return items;
  }

  async getStats() {
    const [total, today, byType, bySource] = await Promise.all([
      prisma.promptLog.count(),
      prisma.promptLog.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      prisma.promptLog.groupBy({ by: ['type'], _count: { type: true } }),
      prisma.promptLog.groupBy({ by: ['source'], _count: { source: true } }),
    ]);

    return {
      total,
      today,
      byType: byType.map(b => ({ type: b.type, count: b._count.type })),
      bySource: bySource.map(b => ({ source: b.source, count: b._count.source })),
    };
  }
}

export const promptLogService = new PromptLogService();
