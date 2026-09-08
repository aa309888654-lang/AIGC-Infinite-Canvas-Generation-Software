import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';
import { formatDisplayVersion } from '../config/app-version';

export const softwareUpdateRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'software');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedExts = ['.exe', '.msi', '.zip', '.dmg', '.deb', '.AppImage', '.tar.gz'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext) || file.originalname.toLowerCase().endsWith('.tar.gz')) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${ext}`));
    }
  },
});

async function computeFileChecksum(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  stream.on('data', (chunk) => hash.update(chunk));
  return new Promise<string>((resolve, reject) => {
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function validateVersionFormat(version: string): boolean {
  return /^v?\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(version);
}

function compareSemver(v1: string, v2: string): number {
  const parseVersion = (v: string) => {
    const cleaned = v.replace(/^v/, '');
    const mainPart = cleaned.split('-')[0];
    const parts = mainPart.split('.').map(Number);
    if (parts.some(isNaN)) return null;
    return parts;
  };
  const a = parseVersion(v1);
  const b = parseVersion(v2);
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    const na = a[i] || 0;
    const nb = b[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

softwareUpdateRouter.get('/latest', async (req: Request, res: Response) => {
  try {
    const platform = (req.query.platform as string) || 'win';

    const latest = await prisma.softwareVersion.findFirst({
      where: { isActive: true, platform },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      return res.json({
        success: true,
        data: null,
        message: '暂无可用更新',
      });
    }

    res.json({
      success: true,
      data: {
        id: latest.id,
        version: latest.version,
        name: latest.name,
        description: latest.description,
        releaseNotes: latest.releaseNotes,
        platform: latest.platform,
        fileName: latest.fileName,
        fileSize: latest.fileSize,
        checksum: latest.checksum,
        createdAt: latest.createdAt,
      },
    });
  } catch (error: unknown) {
    logger.error('获取最新版本失败:', error);
    res.status(500).json({
      success: false,
      error: '获取最新版本失败',
    });
  }
});

softwareUpdateRouter.get('/check', async (req: Request, res: Response) => {
  try {
    const currentVersion = req.query.current as string;
    const platform = (req.query.platform as string) || 'win';

    const latest = await prisma.softwareVersion.findFirst({
      where: { isActive: true, platform },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      return res.json({
        success: true,
        data: {
          hasUpdate: false,
          message: '暂无可用更新',
        },
      });
    }

    const hasUpdate = currentVersion
      ? compareSemver(latest.version, currentVersion) > 0
      : true;

    res.json({
      success: true,
      data: {
        hasUpdate,
        currentVersion: currentVersion || null,
        latestVersion: {
          id: latest.id,
          version: latest.version,
          name: latest.name,
          description: latest.description,
          releaseNotes: latest.releaseNotes,
          platform: latest.platform,
          fileName: latest.fileName,
          fileSize: latest.fileSize,
          checksum: latest.checksum,
          createdAt: latest.createdAt,
        },
      },
    });
  } catch (error: unknown) {
    logger.error('检查更新失败:', error);
    res.status(500).json({
      success: false,
      error: '检查更新失败',
    });
  }
});

softwareUpdateRouter.get('/versions', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const versions = await prisma.softwareVersion.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: versions,
    });
  } catch (error: unknown) {
    logger.error('获取版本列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取版本列表失败',
    });
  }
});

softwareUpdateRouter.post(
  '/upload',
  authenticate,
  requireAdmin,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: '请上传软件包文件',
        });
      }

      const { version, name, description, releaseNotes, platform } = req.body;

      if (!version || !name) {
        fs.unlinkSync(file.path);
        return res.status(400).json({
          success: false,
          error: '版本号和名称为必填项',
        });
      }

      if (!validateVersionFormat(version)) {
        fs.unlinkSync(file.path);
        return res.status(400).json({
          success: false,
          error: '版本号格式无效，请使用 1.0.0 或 v2.7.9 这类版本号',
        });
      }

      const existing = await prisma.softwareVersion.findUnique({
        where: { version },
      });

      if (existing) {
        fs.unlinkSync(file.path);
        return res.status(409).json({
          success: false,
          error: `版本 ${version} 已存在`,
        });
      }

      const checksum = await computeFileChecksum(file.path);

      const relativePath = path.relative(process.cwd(), file.path).replace(/\\/g, '/');

      const finalPlatform = platform || 'win';

      const softwareVersion = await prisma.$transaction(async (tx) => {
        const created = await tx.softwareVersion.create({
          data: {
            version,
            name,
            description: description || null,
            releaseNotes: releaseNotes || null,
            platform: finalPlatform,
            filePath: relativePath,
            fileName: file.originalname,
            fileSize: file.size,
            checksum,
            isLatest: true,
            isActive: true,
            uploadedBy: (req as any).userId || null,
          },
        });

        await tx.softwareVersion.updateMany({
          where: {
            id: { not: created.id },
            platform: finalPlatform,
            isLatest: true,
          },
          data: { isLatest: false },
        });

        return created;
      });

      logger.info(`软件版本已上传: ${formatDisplayVersion(version)} - ${file.originalname}`);

      res.status(201).json({
        success: true,
        data: softwareVersion,
        message: '软件版本上传成功',
      });
    } catch (error: unknown) {
      logger.error('上传软件版本失败:', error);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({
        success: false,
        error: '上传软件版本失败',
      });
    }
  }
);

softwareUpdateRouter.put('/versions/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, releaseNotes, isActive, isLatest, platform } = req.body;

    const existing = await prisma.softwareVersion.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '版本不存在',
      });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (releaseNotes !== undefined) updateData.releaseNotes = releaseNotes;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (platform !== undefined) updateData.platform = platform;

    if (isLatest === true) {
      await prisma.softwareVersion.updateMany({
        where: {
          id: { not: id },
          platform: existing.platform,
          isLatest: true,
        },
        data: { isLatest: false },
      });
      updateData.isLatest = true;
    }

    const updated = await prisma.softwareVersion.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      data: updated,
      message: '版本信息已更新',
    });
  } catch (error: unknown) {
    logger.error('更新版本信息失败:', error);
    res.status(500).json({
      success: false,
      error: '更新版本信息失败',
    });
  }
});

softwareUpdateRouter.delete('/versions/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.softwareVersion.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '版本不存在',
      });
    }

    const absolutePath = path.join(process.cwd(), existing.filePath);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    await prisma.softwareVersion.delete({ where: { id } });

    if (existing.isLatest) {
      const nextLatest = await prisma.softwareVersion.findFirst({
        where: { platform: existing.platform, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      if (nextLatest) {
        await prisma.softwareVersion.update({
          where: { id: nextLatest.id },
          data: { isLatest: true },
        });
      }
    }

    logger.info(`软件版本已删除: ${formatDisplayVersion(existing.version)}`);

    res.json({
      success: true,
      message: '版本已删除',
    });
  } catch (error: unknown) {
    logger.error('删除版本失败:', error);
    res.status(500).json({
      success: false,
      error: '删除版本失败',
    });
  }
});

softwareUpdateRouter.get('/download/:version', async (req: Request, res: Response) => {
  try {
    const { version } = req.params;

    const softwareVersion = await prisma.softwareVersion.findUnique({
      where: { version },
    });

    if (!softwareVersion || !softwareVersion.isActive) {
      return res.status(404).json({
        success: false,
        error: '版本不存在或已下架',
      });
    }

    const absolutePath = path.join(process.cwd(), softwareVersion.filePath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        error: '文件不存在',
      });
    }

    const contentDisposition = softwareVersion.fileName
      ? `attachment; filename="${encodeURIComponent(softwareVersion.fileName)}"`
      : `attachment; filename="update-${softwareVersion.version}${path.extname(softwareVersion.filePath)}"`;

    res.setHeader('Content-Disposition', contentDisposition);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', softwareVersion.fileSize);
    if (softwareVersion.checksum) {
      res.setHeader('X-Checksum-Sha256', softwareVersion.checksum);
    }

    const fileStream = fs.createReadStream(absolutePath);

    req.on('close', () => {
      fileStream.destroy();
    });

    fileStream.on('error', (err) => {
      logger.error(`下载文件流错误 [${version}]:`, err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: '文件读取失败' });
      }
    });

    fileStream.pipe(res);
  } catch (error: unknown) {
    logger.error('下载软件版本失败:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: '下载失败',
      });
    }
  }
});
