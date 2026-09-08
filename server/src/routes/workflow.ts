import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import { storageService } from '../services/storage-service';

const router = Router();

router.post('/save', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { name, data, saveToCloud = false } = req.body;

    if (!name || !data) {
      return res.status(400).json({ success: false, error: '工作流名称和数据不能为空' });
    }

    const jsonString = typeof data === 'string' ? data : JSON.stringify(data);

    const uploadDir = path.join(process.cwd(), 'uploads', 'workflows', userId);
    if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir, { recursive: true }); }

    const timestamp = Date.now();
    const localFilename = `${timestamp}_${name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')}.json`;
    const localPath = path.join(uploadDir, localFilename);
    fs.writeFileSync(localPath, jsonString, 'utf-8');

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3200}`;
    const localUrl = `${baseUrl}/uploads/workflows/${userId}/${localFilename}`;

    let cloudUrl: string | null = null;
    let cloudError: string | null = null;
    if (saveToCloud) {
      if (storageService.isAvailable()) {
        const buffer = Buffer.from(jsonString, 'utf-8');
        const cloudFilename = `wf_${timestamp}_${name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')}.json`;
        const uploadResult = await storageService.uploadBuffer(userId, buffer, cloudFilename, 'application/json', 'workflows');
        if (uploadResult.success && uploadResult.fileUrl) {
          cloudUrl = uploadResult.fileUrl;
        } else {
          cloudError = uploadResult.message || '云端上传失败';
        }
      } else {
        cloudError = '云端存储服务未配置';
      }
    }

    // 检查是否已存在同名工作流
    const existing = await prisma.userFile.findFirst({
      where: { 
        userId, 
        fileType: 'workflow',
        originalName: `${name}.json`
      }
    });

    if (existing) {
      // 如果本地文件存在，先删除旧的本地文件
      const oldLocalPath = path.join(process.cwd(), 'uploads', existing.filePath);
      if (fs.existsSync(oldLocalPath)) {
        try {
          fs.unlinkSync(oldLocalPath);
        } catch {
          // The database record is still updated when its stale local file is unavailable.
        }
      }

      await prisma.userFile.update({
        where: { id: existing.id },
        data: {
          filename: localFilename,
          filePath: `workflows/${userId}/${localFilename}`,
          fileSize: Buffer.byteLength(jsonString),
          size: Buffer.byteLength(jsonString),
          updatedAt: new Date(),
          storagePath: cloudUrl || existing.storagePath,
          folder: 'workflows',
          url: localUrl,
          metadata: JSON.stringify({ category: 'workflow', workflowId: data.id || null, nodeSummary: data.nodeSummary || null }),
          isDeleted: false,
          deletedAt: null,
        },
      });
    } else {
      await prisma.userFile.create({
        data: {
          userId,
          filename: localFilename,
          originalName: `${name}.json`,
          fileType: 'workflow',
          filePath: `workflows/${userId}/${localFilename}`,
          fileSize: Buffer.byteLength(jsonString),
          size: Buffer.byteLength(jsonString),
          mimeType: 'application/json',
          storagePath: cloudUrl || undefined,
          folder: 'workflows',
          url: localUrl,
          metadata: JSON.stringify({ category: 'workflow', workflowId: data.id || null, nodeSummary: data.nodeSummary || null }),
        },
      });
    }

    return res.json({
      success: true,
      localUrl,
      cloudUrl,
      savedToCloud: saveToCloud,
      storageMode: cloudUrl ? 'object-storage' : 'server-local',
      error: cloudError,
    });
  } catch (err: any) {
    console.error('[Workflow] Save error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/list', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const localDir = path.join(process.cwd(), 'uploads', 'workflows', userId);
    const localFiles: Array<{ name: string; url: string; size: number; modified: string; source: string }> = [];
    if (fs.existsSync(localDir)) {
      const files = fs.readdirSync(localDir).filter(f => f.endsWith('.json'));
      for (const f of files) {
        const stat = fs.statSync(path.join(localDir, f));
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3200}`;
        localFiles.push({
          name: f.replace(/^\d+_/, '').replace(/\.json$/, ''),
          url: `${baseUrl}/uploads/workflows/${userId}/${f}`,
          size: stat.size,
          modified: stat.mtime.toISOString(),
          source: 'local',
        });
      }
    }

    const dbFiles = await prisma.userFile.findMany({
      where: { userId, fileType: 'workflow' },
      orderBy: { createdAt: 'desc' },
    });

    const cloudFiles = dbFiles
      .filter(f => f.storagePath && f.storagePath !== f.url)
      .map(f => ({
        name: f.originalName?.replace(/\.json$/, '') || f.filename,
        url: f.storagePath!,
        size: f.fileSize,
        modified: f.updatedAt?.toISOString() || f.createdAt.toISOString(),
        source: 'cloud',
      }));

    const seen = new Set<string>();
    const merged = [...cloudFiles, ...localFiles].filter(f => {
      const key = f.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return res.json({ success: true, workflows: merged });
  } catch (err: any) {
    console.error('[Workflow] List error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/load/:filename', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    // 安全过滤：仅取 basename，防止路径穿越（如 ../../etc/passwd）
    const filename = path.basename(req.params.filename);
    const localPath = path.join(process.cwd(), 'uploads', 'workflows', userId, filename);

    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf-8');
      return res.json({ success: true, data: JSON.parse(content), source: 'local' });
    }

    const dbFile = await prisma.userFile.findFirst({
      where: { userId, fileType: 'workflow', filename },
    });

    if (dbFile?.storagePath && dbFile.storagePath.startsWith('http')) {
      const axios = (await import('axios')).default;
      const resp = await axios.get(dbFile.storagePath, { timeout: 10000 });
      return res.json({ success: true, data: resp.data, source: 'cloud' });
    }

    return res.status(404).json({ success: false, error: '工作流文件不存在' });
  } catch (err: any) {
    console.error('[Workflow] Load error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/delete/:filename', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    // 安全过滤：仅取 basename，防止路径穿越
    const filename = path.basename(req.params.filename);

    const localPath = path.join(process.cwd(), 'uploads', 'workflows', userId, filename);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }

    await prisma.userFile.deleteMany({
      where: { userId, fileType: 'workflow', filename },
    });

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[Workflow] Delete error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
