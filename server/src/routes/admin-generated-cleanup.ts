import { Request, Router } from 'express';
import * as fs from 'fs';
import path from 'path';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { logOperation } from '../services/operation-log-service';

export const adminGeneratedCleanupRouter = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const MEDIA_TYPES = ['image', 'video'] as const;
const SAFE_TASK_STATUSES = ['completed', 'failed', 'cancelled', 'canceled', 'error'] as const;

type CleanupMediaType = (typeof MEDIA_TYPES)[number];
type CleanupFile = {
  id: string;
  fileType: string;
  fileSize: number;
  size?: number | null;
  filePath: string;
  folder: string;
  metadata?: string | null;
};

const previewQuerySchema = z.object({
  mediaTypes: z.string().optional(),
  includeTasks: z.union([z.literal('true'), z.literal('false')]).optional(),
  olderThanDays: z.coerce.number().min(0).max(3650).optional(),
});

const executeSchema = z.object({
  mediaTypes: z.array(z.enum(MEDIA_TYPES)).default(['image', 'video']),
  includeTasks: z.boolean().default(false),
  olderThanDays: z.number().min(0).max(3650).default(30),
  confirmText: z.literal('CLEAN'),
});

function parseMediaTypes(input: string | undefined): CleanupMediaType[] {
  const selected = (input || 'image,video')
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is CleanupMediaType => MEDIA_TYPES.includes(item as CleanupMediaType));
  return selected.length ? Array.from(new Set(selected)) : ['image', 'video'];
}

function getCreatedAtFilter(olderThanDays: number): { lt: Date } | undefined {
  if (!olderThanDays) return undefined;
  return { lt: new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000) };
}

function getFileSize(file: CleanupFile): number {
  return Math.max(0, Number(file.size ?? file.fileSize ?? 0));
}

function getFileSource(file: CleanupFile): string {
  if (!file.metadata) return 'unknown';
  try {
    const parsed = JSON.parse(file.metadata) as Record<string, unknown>;
    const source = parsed.source || parsed.category || parsed.type;
    return typeof source === 'string' && source.trim() ? source.trim() : 'unknown';
  } catch {
    return 'unknown';
  }
}

function isPathInside(basePath: string, targetPath: string): boolean {
  const base = path.resolve(basePath);
  const target = path.resolve(targetPath);
  return target === base || target.startsWith(`${base}${path.sep}`);
}

function resolveCleanupPath(filePath: string): string | null {
  if (!filePath) return null;
  const normalized = filePath.replace(/\\/g, '/');
  const candidate = path.isAbsolute(normalized)
    ? path.resolve(normalized)
    : path.resolve(process.cwd(), normalized);
  const uploadRoot = path.resolve(UPLOAD_DIR);
  const cwdUploads = path.resolve(process.cwd(), 'uploads');
  if (!isPathInside(uploadRoot, candidate) && !isPathInside(cwdUploads, candidate)) return null;
  return candidate;
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}

async function softDeleteCleanupFile(file: CleanupFile): Promise<number> {
  const resolvedPath = resolveCleanupPath(file.filePath);
  let recordDeleted = false;

  try {
    await prisma.userFile.update({
      where: { id: file.id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    recordDeleted = true;

    if (!resolvedPath) return 0;

    try {
      const stat = await fs.promises.stat(resolvedPath);
      if (!stat.isFile()) return 0;
      await fs.promises.unlink(resolvedPath);
      return getFileSize(file);
    } catch (error) {
      if (isMissingFileError(error)) return 0;
      throw error;
    }
  } catch (error) {
    if (recordDeleted) {
      try {
        await prisma.userFile.update({
          where: { id: file.id },
          data: { isDeleted: false, deletedAt: null },
        });
      } catch (rollbackError) {
        const originalMessage = error instanceof Error ? error.message : String(error);
        const rollbackMessage =
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
        throw new Error(`${originalMessage}; 文件记录恢复失败: ${rollbackMessage}`);
      }
    }
    throw error;
  }
}

async function getAdminIdentity(req: Request): Promise<{ id: string; username: string }> {
  const id = req.userId || 'unknown';
  if (id === 'unknown') return { id, username: 'unknown' };
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true },
  });
  return user ? { id: user.id, username: user.username } : { id, username: 'unknown' };
}

function summarizeFiles(files: CleanupFile[]) {
  const bySource = new Map<
    string,
    { source: string; images: number; videos: number; bytes: number }
  >();
  let images = 0;
  let videos = 0;
  let estimatedBytes = 0;

  files.forEach((file) => {
    const size = getFileSize(file);
    const isVideo = file.fileType === 'video';
    const isImage = file.fileType === 'image';
    if (isImage) images += 1;
    if (isVideo) videos += 1;
    estimatedBytes += size;
    const source = getFileSource(file);
    const current = bySource.get(source) || { source, images: 0, videos: 0, bytes: 0 };
    if (isImage) current.images += 1;
    if (isVideo) current.videos += 1;
    current.bytes += size;
    bySource.set(source, current);
  });

  return {
    images,
    videos,
    totalFiles: files.length,
    estimatedBytes,
    bySource: Array.from(bySource.values()).sort((a, b) => b.bytes - a.bytes),
  };
}

async function findCleanupFiles(
  mediaTypes: CleanupMediaType[],
  olderThanDays: number
): Promise<CleanupFile[]> {
  const createdAt = getCreatedAtFilter(olderThanDays);
  return prisma.userFile.findMany({
    where: {
      isDeleted: false,
      fileType: { in: mediaTypes },
      ...(createdAt ? { createdAt } : {}),
    },
    select: {
      id: true,
      fileType: true,
      fileSize: true,
      size: true,
      filePath: true,
      folder: true,
      metadata: true,
    },
  });
}

async function countCleanupTasks(includeTasks: boolean, olderThanDays: number): Promise<number> {
  if (!includeTasks) return 0;
  const createdAt = getCreatedAtFilter(olderThanDays);
  return prisma.task.count({
    where: {
      status: { in: [...SAFE_TASK_STATUSES] },
      ...(createdAt ? { createdAt } : {}),
    },
  });
}

adminGeneratedCleanupRouter.use(authenticate, requireAdmin);

adminGeneratedCleanupRouter.get('/preview', async (req, res) => {
  try {
    const query = previewQuerySchema.parse(req.query);
    const mediaTypes = parseMediaTypes(query.mediaTypes);
    const includeTasks = query.includeTasks === 'true';
    const olderThanDays = query.olderThanDays ?? 30;
    const [files, tasks] = await Promise.all([
      findCleanupFiles(mediaTypes, olderThanDays),
      countCleanupTasks(includeTasks, olderThanDays),
    ]);
    const summary = summarizeFiles(files);

    res.json({
      success: true,
      data: {
        ...summary,
        tasks,
        olderThanDays,
        mediaTypes,
        includeTasks,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '参数验证失败', details: error.errors });
    }
    return res
      .status(500)
      .json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

adminGeneratedCleanupRouter.post('/execute', async (req, res) => {
  try {
    const body = executeSchema.parse(req.body);
    const files = await findCleanupFiles(body.mediaTypes, body.olderThanDays);
    const failedFiles: Array<{ id: string; path: string; error: string }> = [];
    let deletedImages = 0;
    let deletedVideos = 0;
    let releasedBytes = 0;

    for (const file of files) {
      try {
        const releasedFileBytes = await softDeleteCleanupFile(file);
        if (file.fileType === 'image') deletedImages += 1;
        if (file.fileType === 'video') deletedVideos += 1;
        releasedBytes += releasedFileBytes;
      } catch (error) {
        failedFiles.push({
          id: file.id,
          path: file.filePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const taskResult = body.includeTasks
      ? await prisma.task.updateMany({
          where: {
            status: { in: [...SAFE_TASK_STATUSES] },
            ...(getCreatedAtFilter(body.olderThanDays)
              ? { createdAt: getCreatedAtFilter(body.olderThanDays) }
              : {}),
          },
          data: { status: 'deleted' },
        })
      : { count: 0 };

    const admin = await getAdminIdentity(req);
    await logOperation({
      adminId: admin.id,
      adminUsername: admin.username,
      action: 'generated_cleanup',
      targetType: 'generated_content',
      targetId: `older-than-${body.olderThanDays}-days`,
      targetName: '生成内容清理',
      status: failedFiles.length > 0 ? 'failed' : 'success',
      errorMessage: failedFiles.length > 0 ? `${failedFiles.length} 个文件清理失败` : undefined,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: JSON.stringify({
        mediaTypes: body.mediaTypes,
        includeTasks: body.includeTasks,
        olderThanDays: body.olderThanDays,
        deletedImages,
        deletedVideos,
        deletedTasks: taskResult.count,
        releasedBytes,
        failedCount: failedFiles.length,
      }),
    });

    res.json({
      success: true,
      data: {
        deletedImages,
        deletedVideos,
        deletedTasks: taskResult.count,
        releasedBytes,
        failedFiles,
        failedCount: failedFiles.length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '参数验证失败', details: error.errors });
    }
    return res
      .status(500)
      .json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

export default adminGeneratedCleanupRouter;
