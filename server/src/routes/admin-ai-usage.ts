import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import prisma from '../lib/prisma';

export const adminAiUsageRouter = Router();

adminAiUsageRouter.use(authenticate, requireAdmin);

type ProviderModelKey = string;

function providerModelKey(provider: string | null | undefined, model: string | null | undefined): ProviderModelKey {
  return `${provider || 'unknown'}::${model || 'unknown'}`;
}

function splitProviderModelKey(key: ProviderModelKey): { provider: string; model: string } {
  const [provider, model] = key.split('::');
  return { provider: provider || 'unknown', model: model || 'unknown' };
}

adminAiUsageRouter.get('/realtime', async (_req, res) => {
  try {
    const now = new Date();
    const since5m = new Date(now.getTime() - 5 * 60 * 1000);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const [activeApiUsers, activeTaskUsers, calls5m, callsToday, failed5m, aggregate5m, model5mStats, failedModel5mStats, modelTodayStats] = await Promise.all([
      prisma.apiCallLog.findMany({
        where: { createdAt: { gte: since5m } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.task.findMany({
        where: { createdAt: { gte: since5m } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.apiCallLog.count({ where: { createdAt: { gte: since5m } } }),
      prisma.apiCallLog.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.apiCallLog.count({
        where: {
          createdAt: { gte: since5m },
          OR: [
            { statusCode: { gte: 400 } },
            { errorMessage: { not: null } },
          ],
        },
      }),
      prisma.apiCallLog.aggregate({
        where: { createdAt: { gte: since5m } },
        _avg: { latencyMs: true },
        _sum: { inputTokens: true, outputTokens: true, pointsCost: true },
      }),
      prisma.apiCallLog.groupBy({
        by: ['provider', 'model'],
        where: { createdAt: { gte: since5m } },
        _count: { _all: true },
        _avg: { latencyMs: true },
        _sum: { pointsCost: true },
      }),
      prisma.apiCallLog.groupBy({
        by: ['provider', 'model'],
        where: {
          createdAt: { gte: since5m },
          OR: [
            { statusCode: { gte: 400 } },
            { errorMessage: { not: null } },
          ],
        },
        _count: { _all: true },
      }),
      prisma.apiCallLog.groupBy({
        by: ['provider', 'model'],
        where: { createdAt: { gte: todayStart } },
        _count: { _all: true },
      }),
    ]);

    const activeUserIds = new Set<string>();
    activeApiUsers.forEach((item) => { if (item.userId) activeUserIds.add(item.userId); });
    activeTaskUsers.forEach((item) => { if (item.userId) activeUserIds.add(item.userId); });

    const failedByModel = new Map<ProviderModelKey, number>();
    failedModel5mStats.forEach((item) => {
      failedByModel.set(providerModelKey(item.provider, item.model), item._count._all);
    });

    const todayByModel = new Map<ProviderModelKey, number>();
    modelTodayStats.forEach((item) => {
      todayByModel.set(providerModelKey(item.provider, item.model), item._count._all);
    });

    const models = model5mStats
      .map((item) => {
        const key = providerModelKey(item.provider, item.model);
        const failed = failedByModel.get(key) || 0;
        const total = item._count._all;
        const { provider, model } = splitProviderModelKey(key);
        return {
          provider,
          model,
          calls5m: total,
          callsToday: todayByModel.get(key) || 0,
          failed5m: failed,
          successRate5m: total > 0 ? Math.round(((total - failed) / total) * 1000) / 10 : 0,
          avgLatencyMs5m: Math.round(item._avg.latencyMs || 0),
          pointsCost5m: item._sum.pointsCost || 0,
        };
      })
      .sort((a, b) => b.calls5m - a.calls5m)
      .slice(0, 10);

    const success5m = Math.max(0, calls5m - failed5m);

    res.json({
      success: true,
      data: {
        online: {
          activeUsers5m: activeUserIds.size,
          authenticatedUsers5m: activeUserIds.size,
          windowSeconds: 300,
          updatedAt: now.toISOString(),
        },
        api: {
          calls5m,
          callsToday,
          success5m,
          failed5m,
          successRate5m: calls5m > 0 ? Math.round((success5m / calls5m) * 1000) / 10 : 0,
          avgLatencyMs5m: Math.round(aggregate5m._avg.latencyMs || 0),
          pointsCost5m: aggregate5m._sum.pointsCost || 0,
          inputTokens5m: aggregate5m._sum.inputTokens || 0,
          outputTokens5m: aggregate5m._sum.outputTokens || 0,
        },
        models,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ==================== AI 使用统计总览 ====================
adminAiUsageRouter.get('/overview', async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [tasks, apiCalls] = await Promise.all([
      prisma.task.groupBy({
        by: ['type'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.apiCallLog.aggregate({
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalCost: true,
          pointsCost: true,
        },
      }),
    ]);

    const taskByType: Record<string, { count: number }> = {};
    for (const t of tasks) {
      taskByType[t.type] = {
        count: t._count._all,
      };
    }

    res.json({
      success: true,
      data: {
        days,
        since: since.toISOString(),
        tasks: {
          total: Object.values(taskByType).reduce((a, b) => a + b.count, 0),
          images: taskByType['image']?.count || 0,
          videos: taskByType['video']?.count || 0,
          audio: taskByType['audio']?.count || 0,
          music: taskByType['music']?.count || 0,
        },
        apiCalls: {
          total: apiCalls._count._all,
          inputTokens: apiCalls._sum.inputTokens || 0,
          outputTokens: apiCalls._sum.outputTokens || 0,
          totalCost: Number((apiCalls._sum.totalCost || 0).toFixed(4)),
          pointsCost: apiCalls._sum.pointsCost || 0,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ==================== Provider 维度统计 ====================
adminAiUsageRouter.get('/by-provider', async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [taskStats, apiStats] = await Promise.all([
      prisma.task.groupBy({
        by: ['provider', 'type'],
        where: {
          createdAt: { gte: since },
          provider: { not: null },
        },
        _count: { _all: true },
      }),
      prisma.apiCallLog.groupBy({
        by: ['provider', 'model'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalCost: true,
          pointsCost: true,
        },
      }),
    ]);

    // Task 按 provider 聚合
    const providerMap: Record<string, any> = {};

    for (const t of taskStats) {
      const p = t.provider || 'unknown';
      if (!providerMap[p]) {
        providerMap[p] = {
          provider: p,
          taskCount: 0,
          imageCount: 0,
          videoCount: 0,
          audioCount: 0,
          musicCount: 0,
          apiCalls: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 0,
          pointsCost: 0,
          models: new Set<string>(),
        };
      }
      providerMap[p].taskCount += t._count._all;
      const typeKey = `${t.type}Count` as keyof typeof providerMap[string];
      if (typeof providerMap[p][typeKey] === 'number') {
        (providerMap[p] as any)[typeKey] += t._count._all;
      }
    }

    // API 调用按 provider 聚合
    for (const a of apiStats) {
      const p = a.provider || 'unknown';
      if (!providerMap[p]) {
        providerMap[p] = {
          provider: p,
          taskCount: 0,
          imageCount: 0,
          videoCount: 0,
          audioCount: 0,
          musicCount: 0,
          apiCalls: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 0,
          pointsCost: 0,
          models: new Set<string>(),
        };
      }
      providerMap[p].apiCalls += a._count._all;
      providerMap[p].inputTokens += a._sum.inputTokens || 0;
      providerMap[p].outputTokens += a._sum.outputTokens || 0;
      providerMap[p].totalCost += a._sum.totalCost || 0;
      providerMap[p].pointsCost += a._sum.pointsCost || 0;
      if (a.model) providerMap[p].models.add(a.model);
    }

    const result = Object.values(providerMap)
      .map((p: any) => ({
        ...p,
        models: Array.from(p.models as Set<string>),
        modelCount: (p.models as Set<string>).size,
        totalCost: Number(p.totalCost.toFixed(4)),
      }))
      .sort((a, b) => b.taskCount + b.apiCalls - (a.taskCount + a.apiCalls));

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ==================== 用户使用排行 ====================
adminAiUsageRouter.get('/top-users', async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const userStats = await prisma.task.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { userId: 'desc' } },
      take: limit,
    });

    const userIds = userStats.map((u) => u.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
      },
    });

    // 获取每个用户的 type 分布
    const typeBreakdown = await prisma.task.groupBy({
      by: ['userId', 'type'],
      where: { createdAt: { gte: since }, userId: { in: userIds } },
      _count: { _all: true },
    });

    const typeMap: Record<string, Record<string, number>> = {};
    for (const t of typeBreakdown) {
      if (!typeMap[t.userId]) typeMap[t.userId] = {};
      typeMap[t.userId][t.type] = t._count._all;
    }

    const userMap = new Map(users.map((u) => [u.id, u]));
    const result = userStats.map((u) => {
      const user = userMap.get(u.userId);
      const types = typeMap[u.userId] || {};
      return {
        userId: u.userId,
        username: user?.username || '未知用户',
        email: user?.email || '',
        role: user?.role || 'USER',
        membershipLevel: user?.role === 'ADMIN' ? 'admin' : 'user',
        totalTasks: u._count._all,
        images: types['image'] || 0,
        videos: types['video'] || 0,
        audio: types['audio'] || 0,
        music: types['music'] || 0,
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ==================== 生成记录详情 ====================
adminAiUsageRouter.get('/records', async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 100);
    const type = req.query.type as string | undefined;
    const provider = req.query.provider as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = {};
    if (type) where.type = type;
    if (provider) where.provider = provider;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { prompt: { contains: search } },
        { model: { contains: search } },
        { user: { username: { contains: search } } },
        { user: { email: { contains: search } } },
      ];
    }

    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const records = tasks.map((t) => ({
      id: t.id,
      userId: t.userId,
      username: t.user?.username || '未知',
      email: t.user?.email || '',
      membershipLevel: t.user?.role === 'ADMIN' ? 'admin' : 'user',
      type: t.type,
      status: t.status,
      progress: t.progress,
      provider: t.provider || '-',
      model: t.model || '-',
      prompt: t.prompt?.substring(0, 120) || '',
      outputUrl: t.outputUrl || '',
      thumbnailUrl: t.thumbnailUrl || '',
      error: t.error?.substring(0, 100) || '',
      createdAt: t.createdAt.toISOString(),
      duration: Math.round((t.updatedAt.getTime() - t.createdAt.getTime()) / 1000),
    }));

    res.json({
      success: true,
      data: {
        records,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ==================== 每日趋势 ====================
adminAiUsageRouter.get('/daily-trend', async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const tasks = await prisma.task.findMany({
      where: { createdAt: { gte: since } },
      select: { type: true, status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const dayMap: Record<string, {
      date: string;
      images: number;
      videos: number;
      audio: number;
      music: number;
      completed: number;
      failed: number;
    }> = {};

    for (const t of tasks) {
      const dayKey = t.createdAt.toISOString().slice(0, 10);
      if (!dayMap[dayKey]) {
        dayMap[dayKey] = {
          date: dayKey,
          images: 0, videos: 0, audio: 0, music: 0,
          completed: 0, failed: 0,
        };
      }
      const typeKey = `${t.type}s` as keyof typeof dayMap[string];
      if (typeof dayMap[dayKey][typeKey] === 'number') {
        (dayMap[dayKey] as any)[typeKey]++;
      }
      if (t.status === 'completed') dayMap[dayKey].completed++;
      if (t.status === 'failed') dayMap[dayKey].failed++;
    }

    const result = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ==================== 清除 AI 使用统计记录 ====================
// 删除指定时间范围之前的 Task 和 ApiCallLog 记录
// before: ISO 日期字符串，删除 createdAt < before 的记录
// scope: 'all' | 'tasks' | 'api_calls'，默认 'all'
adminAiUsageRouter.delete('/clear-records', async (req, res) => {
  try {
    const before = req.query.before ? new Date(req.query.before as string) : new Date();
    const scope = (req.query.scope as string) || 'all';

    if (isNaN(before.getTime())) {
      return res.status(400).json({ success: false, error: 'before 参数不是有效的日期' });
    }

    if (!['all', 'tasks', 'api_calls'].includes(scope)) {
      return res.status(400).json({ success: false, error: 'scope 参数必须是 all / tasks / api_calls' });
    }

    const result: { tasks: number; apiCalls: number } = { tasks: 0, apiCalls: 0 };

    if (scope === 'all' || scope === 'tasks') {
      const r = await prisma.task.deleteMany({
        where: { createdAt: { lt: before } },
      });
      result.tasks = r.count;
    }

    if (scope === 'all' || scope === 'api_calls') {
      const r = await prisma.apiCallLog.deleteMany({
        where: { createdAt: { lt: before } },
      });
      result.apiCalls = r.count;
    }

    res.json({
      success: true,
      message: `已清除 ${result.tasks} 条任务记录, ${result.apiCalls} 条 API 调用记录`,
      data: {
        before: before.toISOString(),
        scope,
        deletedTasks: result.tasks,
        deletedApiCalls: result.apiCalls,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
