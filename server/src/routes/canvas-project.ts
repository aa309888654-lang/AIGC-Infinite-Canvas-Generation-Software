import express, { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth';
import { AppError } from '../types/error';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();

// SEC M-2 修复：canvas project 保存包含节点数据，单独放宽 body 限制到 20mb。
// 全局限制已降到 2mb，此处显式放宽以容纳画布项目数据。
router.use(express.json({ limit: '20mb' }));

// 校验字符串字段：返回字符串或 undefined
function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

// 校验数组字段：返回数组或 undefined
function asArray(v: unknown): unknown[] | undefined {
  return Array.isArray(v) ? v : undefined;
}

// 校验对象字段：返回对象或 undefined
function asObject(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

// 校验数字字段：返回数字或 undefined
function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && !Number.isNaN(v) ? v : undefined;
}

// 校验布尔字段：返回布尔或 undefined
function asBoolean(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

function isSafeProjectId(id: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(id);
}

// 将 Prisma 返回的 project（nodes/edges/viewport 为 JSON 字符串）解析为对象/数组
// 前端 CanvasProjectData 期望 nodes/edges 为数组、viewport 为对象
function parseProjectJsonFields<T extends Record<string, unknown>>(project: T): T {
  if (!project) return project;
  const result = { ...project };
  for (const key of ['nodes', 'edges', 'viewport'] as const) {
    const raw = result[key];
    if (typeof raw === 'string' && raw) {
      try {
        (result as Record<string, unknown>)[key] = JSON.parse(raw);
      } catch {
        // 解析失败保留原值（可能是旧数据 "[object Object]" 等）
      }
    }
  }
  return result;
}

// 校验分页参数，避免 NaN 导致 Prisma 查询异常
function parsePagination(page: unknown, limit: unknown): { pageNum: number; limitNum: number } {
  const p = parseInt(typeof page === 'string' ? page : '1', 10);
  const l = parseInt(typeof limit === 'string' ? limit : '20', 10);
  const pageNum = Number.isFinite(p) && p > 0 ? p : 1;
  const limitNum = Number.isFinite(l) && l > 0 ? Math.min(100, l) : 20;
  return { pageNum, limitNum };
}

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, search } = req.query;
    const { pageNum, limitNum } = parsePagination(page, limit);
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = { userId: req.userId };
    const searchStr = asString(search);
    if (searchStr && searchStr.trim()) {
      where.name = { contains: searchStr.trim() };
    }

    const [projectsRaw, total] = await Promise.all([
      prisma.canvasProject.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.canvasProject.count({ where }),
    ]);
    // 列表接口通常只展示元信息，但前端可能直接使用 nodes/edges，统一解析
    const projects = projectsRaw.map((p) => parseProjectJsonFields(p as unknown as Record<string, unknown>));

    res.json({
      success: true,
      data: projects,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/count', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.canvasProject.count({
      where: { userId: req.userId },
    });

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const projectRaw = await prisma.canvasProject.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!projectRaw) {
      throw new AppError('项目不存在', 404);
    }

    const project = parseProjectJsonFields(projectRaw as unknown as Record<string, unknown>);

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('未认证', 401);

    // 输入校验：避免恶意 JSON 破坏数据完整性
    const name = asString(req.body.name);
    const description = asString(req.body.description);
    const nodes = asArray(req.body.nodes) ?? [];
    const edges = asArray(req.body.edges) ?? [];
    const viewport = asObject(req.body.viewport);
    const requestedId = asString(req.body.id);
    const projectId = requestedId && isSafeProjectId(requestedId) ? requestedId : crypto.randomUUID();

    // 名称长度限制
    if (name && name.length > 100) {
      throw new AppError('项目名称不能超过 100 字符', 400);
    }

    const projectRaw = await prisma.canvasProject.create({
      data: {
        id: projectId,
        userId,
        name: name || '未命名工程',
        description: description || null,
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
        viewport: viewport ? JSON.stringify(viewport) : null,
      },
    });

    logger.info('Canvas project created', { userId, projectId: projectRaw.id });

    const project = parseProjectJsonFields(projectRaw as unknown as Record<string, unknown>);

    res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('未认证', 401);
    const { id } = req.params;
    if (!isSafeProjectId(id)) throw new AppError('项目 ID 格式无效', 400);
    const revision = asNumber(req.body.revision);
    if (!Number.isInteger(revision) || revision! < 0) {
      throw new AppError('保存项目必须提供有效 revision', 400);
    }

    // 输入校验
    const updateData: Record<string, unknown> = {};
    const name = asString(req.body.name);
    if (name !== undefined) {
      if (name.length > 100) throw new AppError('项目名称不能超过 100 字符', 400);
      updateData.name = name;
    }
    const description = asString(req.body.description);
    if (description !== undefined) updateData.description = description;
    const nodes = asArray(req.body.nodes);
    if (nodes !== undefined) updateData.nodes = JSON.stringify(nodes);
    const edges = asArray(req.body.edges);
    if (edges !== undefined) updateData.edges = JSON.stringify(edges);
    const viewport = asObject(req.body.viewport);
    if (viewport !== undefined) updateData.viewport = JSON.stringify(viewport);
    const thumbnail = asString(req.body.thumbnail);
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail;
    const isFavorite = asBoolean(req.body.isFavorite);
    if (isFavorite !== undefined) updateData.isFavorite = isFavorite;
    const sortOrder = asNumber(req.body.sortOrder);
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    // 使用 updateMany 带 userId 条件，避免 TOCTOU 竞态导致越权
    const result = await prisma.canvasProject.updateMany({
      where: { id, userId, revision },
      data: { ...updateData, revision: { increment: 1 } },
    });

    if (result.count === 0) {
      const exists = await prisma.canvasProject.findFirst({ where: { id, userId }, select: { revision: true } });
      if (!exists) throw new AppError('项目不存在', 404);
      throw new AppError(`项目已被其他操作更新，请基于 revision ${exists.revision} 重新加载`, 409);
    }
    const projectRaw = await prisma.canvasProject.findUnique({ where: { id } });
    const project = projectRaw
      ? parseProjectJsonFields(projectRaw as unknown as Record<string, unknown>)
      : null;

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('未认证', 401);
    const { id } = req.params;

    // 使用 deleteMany 带 userId 条件，避免 TOCTOU 竞态导致越权
    const result = await prisma.canvasProject.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      throw new AppError('项目不存在', 404);
    }

    logger.info('Canvas project deleted', { userId, projectId: id });

    res.json({
      success: true,
      message: '项目已删除',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/cleanup', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('未认证', 401);
    const MAX_PROJECTS = 50;

    const totalCount = await prisma.canvasProject.count({
      where: { userId },
    });

    if (totalCount <= MAX_PROJECTS) {
      res.json({
        success: true,
        data: { deletedCount: 0 },
      });
      return;
    }

    const excessCount = totalCount - MAX_PROJECTS;

    // 直接用 deleteMany 带条件删除，避免 findMany 与 deleteMany 之间的竞态
    const deleteResult = await prisma.canvasProject.deleteMany({
      where: {
        userId,
        isFavorite: false,
        // 删除最旧的 excessCount 个：通过 updatedAt 升序无法在 deleteMany 直接表达，
        // 这里仍先查 id 再删，但删除时带 userId + isFavorite 条件保证安全
        id: {
          in: (
            await prisma.canvasProject.findMany({
              where: { userId, isFavorite: false },
              orderBy: { updatedAt: 'asc' },
              take: excessCount,
              select: { id: true },
            })
          ).map((c) => c.id),
        },
      },
    });

    logger.info(
      'Canvas projects cleanup completed',
      { userId, deletedCount: deleteResult.count }
    );

    res.json({
      success: true,
      data: { deletedCount: deleteResult.count },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
