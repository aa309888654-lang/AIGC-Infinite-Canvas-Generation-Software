import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { authenticate, requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';

interface TutorialVideoItem {
  id: string;
  title: string;
  videoUrl: string;
  video2kUrl?: string;
  coverUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

const router = Router();
const uploadsDir = path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'), 'tutorial-videos');
const dataFilePath = path.join(uploadsDir, 'tutorial-videos.json');

function ensureStorage() {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(dataFilePath)) fs.writeFileSync(dataFilePath, '[]', 'utf8');
}

function readVideos(): TutorialVideoItem[] {
  ensureStorage();
  try {
    const raw = fs.readFileSync(dataFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeVideos(videos: TutorialVideoItem[]) {
  ensureStorage();
  fs.writeFileSync(dataFilePath, JSON.stringify(videos, null, 2), 'utf8');
}

function removeLocalFile(fileUrl?: string) {
  if (!fileUrl?.startsWith('/uploads/tutorial-videos/')) return;
  const filename = path.basename(fileUrl);
  const filePath = path.join(uploadsDir, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function captureFirstFrame(videoPath: string): Promise<string | undefined> {
  ensureStorage();
  const filename = `cover-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.jpg`;
  const outputPath = path.join(uploadsDir, filename);
  const ffmpegBinary = process.env.FFMPEG_PATH || 'ffmpeg';

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };
    const proc = spawn(ffmpegBinary, [
      '-y',
      '-i', videoPath,
      '-frames:v', '1',
      '-q:v', '2',
      outputPath,
    ]);
    const timeout = setTimeout(() => {
      try { proc.kill(); } catch { /* best effort */ }
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      finish(undefined);
    }, 15000);

    proc.on('error', () => finish(undefined));
    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        finish(`/uploads/tutorial-videos/${filename}`);
        return;
      }
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      finish(undefined);
    });
  });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureStorage();
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  // 教程板块专用上传额度：不影响通用文件、视频或素材上传接口。
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isVideo = file.fieldname === 'video' && file.mimetype.startsWith('video/');
    const isCover = file.fieldname === 'cover' && file.mimetype.startsWith('image/');
    if (isVideo || isCover) return cb(null, true);
    cb(new Error('只允许上传视频文件和封面图片'));
  },
});

router.get('/', (_req: Request, res: Response) => {
  res.json({ success: true, data: readVideos() });
});

router.use('/admin', authenticate, requireAdmin);

router.post('/admin', upload.fields([{ name: 'video', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), async (req: Request, res: Response) => {
  try {
    const title = String(req.body.title || '').trim();
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const videoFile = files?.video?.[0];
    const coverFile = files?.cover?.[0];

    if (!title) return res.status(400).json({ success: false, message: '请输入标题' });
    if (!videoFile) return res.status(400).json({ success: false, message: '请上传视频文件' });

    const videos = readVideos();
    const videoUrl = `/uploads/tutorial-videos/${videoFile.filename}`;
    const coverUrl = coverFile
      ? `/uploads/tutorial-videos/${coverFile.filename}`
      : await captureFirstFrame(videoFile.path);
    const item: TutorialVideoItem = {
      id: crypto.randomUUID(),
      title,
      videoUrl,
      coverUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    videos.push(item);
    writeVideos(videos);
    res.json({ success: true, data: item, message: '新增成功' });
  } catch (error) {
    logger.error('[TutorialVideos] 新增视频失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ success: false, message: '服务器内部错误，请稍后重试' });
  }
});

router.put('/admin/:id', upload.fields([{ name: 'video', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), async (req: Request, res: Response) => {
  try {
    const videos = readVideos();
    const index = videos.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ success: false, message: '视频不存在' });

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const videoFile = files?.video?.[0];
    const coverFile = files?.cover?.[0];
    const title = String(req.body.title || '').trim();
    const next = { ...videos[index] };
    const previousVideoUrl = next.videoUrl;
    const previousCoverUrl = next.coverUrl;

    if (title) next.title = title;
    if (videoFile) {
      next.videoUrl = `/uploads/tutorial-videos/${videoFile.filename}`;
      next.coverUrl = coverFile
        ? `/uploads/tutorial-videos/${coverFile.filename}`
        : (await captureFirstFrame(videoFile.path)) || previousCoverUrl;
    } else if (coverFile) {
      next.coverUrl = `/uploads/tutorial-videos/${coverFile.filename}`;
    }

    // 同名视频被替换时，前端以该版本号重新请求媒体，避免浏览器复用旧缓冲。
    next.updatedAt = new Date().toISOString();

    videos[index] = next;
    writeVideos(videos);
    // 只有新版本已经写入索引后才删除旧文件，避免自动截帧失败时破坏原视频。
    if (videoFile) removeLocalFile(previousVideoUrl);
    if (coverFile || (videoFile && next.coverUrl !== previousCoverUrl)) {
      removeLocalFile(previousCoverUrl);
    }
    res.json({ success: true, data: next, message: '保存成功' });
  } catch (error) {
    logger.error('[TutorialVideos] 更新视频失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ success: false, message: '服务器内部错误，请稍后重试' });
  }
});

router.delete('/admin/:id', (req: Request, res: Response) => {
  const videos = readVideos();
  const target = videos.find((item) => item.id === req.params.id);
  if (!target) return res.status(404).json({ success: false, message: '视频不存在' });

  removeLocalFile(target.videoUrl);
  removeLocalFile(target.video2kUrl);
  removeLocalFile(target.coverUrl);
  writeVideos(videos.filter((item) => item.id !== req.params.id));
  res.json({ success: true, message: '删除成功' });
});

// 批量调整排序：接收有序的 id 数组，按顺序重写 JSON
router.patch('/admin/reorder', (req: Request, res: Response) => {
  try {
    const { ids } = req.body as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '缺少排序 id 列表' });
    }
    const videos = readVideos();
    const map = new Map(videos.map((v) => [v.id, v]));
    const reordered: TutorialVideoItem[] = [];
    for (const id of ids) {
      const item = map.get(id);
      if (item) {
        reordered.push(item);
        map.delete(id);
      }
    }
    // 保留未在 ids 中的视频（追加到末尾）
    for (const remaining of map.values()) {
      reordered.push(remaining);
    }
    writeVideos(reordered);
    res.json({ success: true, data: reordered, message: '排序成功' });
  } catch (error) {
    logger.error('[TutorialVideos] 排序视频失败:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ success: false, message: '服务器内部错误，请稍后重试' });
  }
});

export const tutorialVideosRouter = router;
