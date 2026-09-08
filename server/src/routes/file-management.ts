import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import axios from 'axios';
import { z } from 'zod';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import prisma from '../lib/prisma';
import { quotaService } from '../services/quota-service';
import storageService from '../services/storage-service';
import { minioPublicStorageService } from '../services/minio-public-storage-service';
import { AuthRequest, requireAuth } from '../middleware/auth';

interface MulterRequest extends AuthRequest {
  file?: Express.Multer.File;
}

const router = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const DEFAULT_UPLOAD_FOLDERS = [
  'workflows',
  'avatars',
  'images',
  'videos',
  'audio',
  'temp',
  'exports',
  'thumbnails',
  'poster-brand-assets',
] as const;
const allowedUploadFolders = new Set(
  process.env.ALLOWED_UPLOAD_FOLDERS?.split(',')
    .map((folder) => folder.trim())
    .filter(Boolean) ?? [...DEFAULT_UPLOAD_FOLDERS]
);
const folderSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid folder name');
const fileNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid file name');

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  images: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    // P1 修复 #9：移除 image/svg+xml，SVG 可内嵌 script 导致存储型 XSS
  ],
  videos: [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
  ],
  audio: [
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/flac',
    'audio/aac',
    'audio/mp3',
  ],
  workflows: [
    'application/json',
  ],
  avatars: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ],
  temp: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
  ],
  exports: [
    'video/mp4',
    'video/webm',
    'application/zip',
    'application/pdf',
  ],
  thumbnails: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ],
  'poster-brand-assets': [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml',
  ],
};

// P1 修复 #9：按 folder 分别限制文件大小（字节）
const FOLDER_SIZE_LIMITS: Record<string, number> = {
  images: 20 * 1024 * 1024,       // 20MB
  avatars: 1 * 1024 * 1024,       // 独立头像空间：单张 1MB
  thumbnails: 5 * 1024 * 1024,    // 5MB
  videos: 200 * 1024 * 1024,      // 200MB
  audio: 50 * 1024 * 1024,        // 50MB
  temp: 100 * 1024 * 1024,        // 100MB
  exports: 200 * 1024 * 1024,     // 200MB
  workflows: 1 * 1024 * 1024,     // 1MB
  'poster-brand-assets': 5 * 1024 * 1024, // 单个品牌素材 5MB
};

const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov'],
  'video/x-msvideo': ['.avi'],
  'audio/mpeg': ['.mp3'],
  'audio/mp3': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/ogg': ['.ogg', '.opus'],
  'audio/webm': ['.webm'],
  'audio/flac': ['.flac'],
  'audio/aac': ['.aac', '.m4a'],
  'application/json': ['.json'],
  'application/zip': ['.zip'],
  'application/pdf': ['.pdf'],
};

export interface UploadSecurityInput {
  folder: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}

export type UploadSecurityResult = { allowed: true } | { allowed: false; reason: string };

export function validateUploadSecurity(input: UploadSecurityInput): UploadSecurityResult {
  const extension = path.extname(input.originalName).toLowerCase();
  if (!extension || !MIME_EXTENSIONS[input.mimeType]?.includes(extension)) {
    return { allowed: false, reason: '文件扩展名与声明类型不匹配' };
  }
  if (!validateMimeType(input.mimeType, input.folder)) {
    return { allowed: false, reason: `File type not allowed for folder: ${input.folder}` };
  }
  if (!validateMagicBytes(input.buffer, input.mimeType)) {
    return { allowed: false, reason: '文件内容与声明类型不匹配（magic bytes 校验失败）' };
  }
  if (input.folder === 'workflows') {
    try {
      const parsed = JSON.parse(input.buffer.toString('utf8'));
      if (parsed === null || typeof parsed !== 'object') {
        return { allowed: false, reason: '工作流必须是 JSON 对象或数组' };
      }
    } catch {
      return { allowed: false, reason: '工作流 JSON 格式无效' };
    }
  }
  return { allowed: true };
}
const DEFAULT_SIZE_LIMIT = 50 * 1024 * 1024; // 50MB
const POSTER_BRAND_ASSET_QUOTA = 20 * 1024 * 1024;

// P1 修复 #9：文件 magic bytes 签名表，用于校验文件实际内容（防止伪造 MIME）
const MAGIC_BYTES_SIGNATURES: Record<string, number[]> = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46, 0x38],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF....WEBP
  'video/mp4': [0x00, 0x00, 0x00],         // ftyp box
  'video/webm': [0x1A, 0x45, 0xDF, 0xA3],  // EBML
  'video/quicktime': [0x00, 0x00, 0x00],
  'video/x-msvideo': [0x52, 0x49, 0x46, 0x46], // RIFF....AVI
  'audio/mpeg': [0xFF, 0xFB, 0xFF],  // MP3
  'audio/mp3': [0xFF, 0xFB, 0xFF],
  'audio/ogg': [0x4F, 0x67, 0x67, 0x53],    // OggS
  'audio/webm': [0x1A, 0x45, 0xDF, 0xA3],   // EBML
  'audio/flac': [0x66, 0x4C, 0x61, 0x43],   // fLaC
  'audio/wav': [0x52, 0x49, 0x46, 0x46],    // RIFF....WAVE
  'application/zip': [0x50, 0x4B, 0x03, 0x04], // PK
  'application/pdf': [0x25, 0x50, 0x44, 0x46],  // %PDF
};

/**
 * P1 修复 #9：通过 magic bytes 校验文件实际类型
 * 不再信任客户端 Content-Type，直接读取文件头字节判定
 */
function validateMagicBytes(buffer: Buffer, claimedMimeType: string): boolean {
  const signature = MAGIC_BYTES_SIGNATURES[claimedMimeType];
  if (!signature) {
    // 无签名记录的类型（如 json/text/javascript）跳过 magic bytes 校验，依赖 MIME 白名单
    return true;
  }
  if (buffer.length < signature.length) {
    return false;
  }
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) {
      return false;
    }
  }
  // webp/wav/avi 都以 RIFF 开头，需进一步检查格式标识
  if (claimedMimeType === 'image/webp') {
    return buffer.length >= 12 && buffer.slice(8, 12).toString('ascii') === 'WEBP';
  }
  if (claimedMimeType === 'audio/wav') {
    return buffer.length >= 12 && buffer.slice(8, 12).toString('ascii') === 'WAVE';
  }
  if (claimedMimeType === 'video/x-msvideo') {
    return buffer.length >= 12 && buffer.slice(8, 12).toString('ascii') === 'AVI ';
  }
  return true;
}

function validateMimeType(mimeType: string, folder: string): boolean {
  const allowedTypes = ALLOWED_MIME_TYPES[folder];
  if (!allowedTypes) {
    return true;
  }
  return allowedTypes.includes(mimeType);
}
const listQuerySchema = z.object({
  folder: z.string().trim().optional(),
  type: z.enum(['image', 'video', 'audio', 'text', 'workflow']).optional(),
  includeDeleted: z.union([z.literal('true'), z.literal('false')]).optional(),
  onlyDeleted: z.union([z.literal('true'), z.literal('false')]).optional(),
});

function isPathInside(basePath: string, targetPath: string): boolean {
  const normalizedBasePath = path.resolve(basePath);
  const normalizedTargetPath = path.resolve(targetPath);
  return (
    normalizedTargetPath === normalizedBasePath ||
    normalizedTargetPath.startsWith(`${normalizedBasePath}${path.sep}`)
  );
}

function resolveFolder(folderInput: unknown): { folder: string; dir: string } {
  const validation = folderSchema.safeParse(folderInput ?? 'workflows');
  if (!validation.success) {
    throw new ValidationError('目录参数不合法', validation.error.issues);
  }

  const folder = validation.data;
  if (!allowedUploadFolders.has(folder)) {
    throw new ValidationError(`不支持的目录: ${folder}`);
  }

  const dir = path.resolve(UPLOAD_DIR, folder);
  if (!isPathInside(UPLOAD_DIR, dir)) {
    throw new ValidationError('目录超出允许范围');
  }

  return { folder, dir };
}

function resolveFileId(fileIdInput: unknown): {
  folder: string;
  filename: string;
  filePath: string;
} {
  if (typeof fileIdInput !== 'string' || !fileIdInput.trim()) {
    throw new ValidationError('文件标识不能为空');
  }

  const normalizedFileId = fileIdInput.replace(/\\/g, '/').trim();
  const segments = normalizedFileId.split('/').filter(Boolean);
  if (segments.length !== 2) {
    throw new ValidationError('文件标识格式不正确');
  }

  const [folderInput, filenameInput] = segments;
  const { folder, dir } = resolveFolder(folderInput);
  const fileNameValidation = fileNameSchema.safeParse(filenameInput);
  if (!fileNameValidation.success) {
    throw new ValidationError('文件名不合法', fileNameValidation.error.issues);
  }

  const filename = fileNameValidation.data;
  const filePath = path.resolve(dir, filename);
  if (!isPathInside(dir, filePath)) {
    throw new ValidationError('文件路径超出允许范围');
  }

  return { folder, filename, filePath };
}

export function buildLocalFileUrl(filename: string, folder: string, userId?: string): string {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3200}`;
  const ownerSegment = userId ? `/${encodeURIComponent(userId)}` : '';
  return `${baseUrl}/uploads/${folder}${ownerSegment}/${filename}`;
}

function getLocalFilePath(filename: string, folder: string): string {
  return path.join(UPLOAD_DIR, folder, filename);
}

function createStoredFileName(originalName: string): string {
  const ext = path.extname(originalName) || '';
  return `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
}

function normalizeAssetType(folder: string, mimeType: string, fileName: string): string {
  if (folder === 'workflows') return 'workflow';
  if (folder === 'exports') return 'video';
  if (folder === 'thumbnails') return 'image';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';

  const ext = path.extname(fileName).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) return 'image';
  if (['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.ogg', '.flac', '.aac'].includes(ext)) return 'audio';
  if (['.txt', '.md', '.json', '.csv', '.srt', '.lrc'].includes(ext)) return 'text';

  return folder;
}

function buildFileMetadata(fileType: string, mimeType: string, fileName: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: path.extname(fileName).replace('.', '').toLowerCase(),
    mimeType,
    category: fileType,
    ...extra,
  });
}

async function persistFile(
  userId: string,
  folder: string,
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<{
  storedName: string;
  fileUrl: string;
  filePath: string;
  storagePath?: string;
  cosUrl?: string;
  localUrl: string;
}> {
  const storedName = createStoredFileName(originalName);

  // 1. 本地永久写入（主存储）
  const { dir } = resolveFolder(folder);
  const userDir = path.resolve(dir, userId);
  if (!isPathInside(dir, userDir)) {
    throw new ValidationError('用户文件目录超出允许范围');
  }
  fs.mkdirSync(userDir, { recursive: true });
  const filePath = path.join(userDir, storedName);
  fs.writeFileSync(filePath, buffer);

  const localUrl = buildLocalFileUrl(storedName, folder, userId);
  let fileUrl = localUrl;
  let storagePath: string | undefined;
  let cosUrl: string | undefined;

  // 2. 媒体文件临时上传 MinIO（中转，供跨设备/大模型 API 访问）
  const assetType = normalizeAssetType(folder, mimeType, originalName);
  if ((assetType === 'image' || assetType === 'video' || assetType === 'audio') &&
      minioPublicStorageService.isEnabled()) {
    try {
      const minioType = assetType as 'image' | 'video' | 'audio';
      const minioResult = await minioPublicStorageService.uploadGeneratedBuffer(
        userId,
        minioType,
        buffer,
        storedName,
        mimeType
      );
      if (minioResult) {
        storagePath = minioResult.key;
        cosUrl = minioResult.url;
        // 主 URL 优先用 MinIO（跨设备可访问），本地 URL 作为永久备份
        fileUrl = minioResult.url;
        logger.info(`[File] MinIO 中转上传成功: key=${minioResult.key}`);
      } else {
        logger.warn(`[File] MinIO 中转上传返回空，使用本地 URL`);
      }
    } catch (error) {
      // MinIO 上传失败不影响本地写入，降级用本地 URL
      logger.warn(`[File] MinIO 中转上传失败，降级本地 URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    storedName,
    fileUrl,
    filePath,
    storagePath,
    cosUrl,
    localUrl,
  };
}

async function resolveRecordByIdentifier(userId: string, identifier: string) {
  const byId = await prisma.userFile.findFirst({
    where: {
      id: identifier,
      userId,
    },
  });

  if (byId) {
    return byId;
  }

  const { folder, filename } = resolveFileId(identifier);
  return prisma.userFile.findFirst({
    where: {
      userId,
      folder,
      filename,
    },
  });
}

type FileRecord = NonNullable<Awaited<ReturnType<typeof resolveRecordByIdentifier>>>;

function getSafeDownloadName(fileRecord: FileRecord): string {
  const originalName = path.basename(fileRecord.originalName || fileRecord.filename);
  const safeName = originalName.replace(/[\r\n"]/g, '_');
  return safeName || fileRecord.filename || 'download';
}

function setDownloadHeaders(res: Response, fileRecord: FileRecord, contentLength?: number): void {
  const safeName = getSafeDownloadName(fileRecord);
  const asciiFallback = safeName.replace(/[^\x20-\x7E]/g, '_');
  res.setHeader('Content-Type', fileRecord.mimeType || 'application/octet-stream');
  res.setHeader('Content-Length', String(contentLength || fileRecord.size || fileRecord.fileSize));
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`
  );
}

function resolveExistingLocalFilePath(fileRecord: FileRecord): string | null {
  const candidates = new Set<string>();
  const safeRoots = [
    path.resolve(UPLOAD_DIR),
    path.resolve(process.cwd(), 'uploads'),
  ];

  if (fileRecord.filePath) {
    candidates.add(
      path.isAbsolute(fileRecord.filePath)
        ? path.resolve(fileRecord.filePath)
        : path.resolve(UPLOAD_DIR, fileRecord.filePath)
    );
  }
  candidates.add(path.resolve(UPLOAD_DIR, fileRecord.folder, fileRecord.filename));

  for (const candidate of candidates) {
    const isAllowedPath = safeRoots.some((root) => isPathInside(root, candidate));
    if (!isAllowedPath) {
      logger.warn(`[File] 拒绝下载越界路径: ${candidate}`);
      continue;
    }

    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function isHttpUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// P1 修复 #9：multer 全局上限调整为各 folder 上限的最大值（200MB），
// 实际按 folder 的 FOLDER_SIZE_LIMITS 二次校验，避免 500MB 过大
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

const thumbnailUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// SEC-AUDIT 修复：根路由加 requireAuth，避免端点结构未授权泄露
// 安全最佳实践：文件管理接口属于用户功能，根路由不应公开返回端点列表
router.get('/', requireAuth, (req, res) => {
  res.json({
    success: true,
    message: 'File Management API',
    endpoints: {
      upload: 'POST /api/files/upload (auth required)',
      list: 'GET /api/files/list (auth required)',
      delete: 'DELETE /api/files/:fileId (auth required)',
    },
  });
});

router.post(
  '/upload',
  requireAuth,
  upload.single('file'),
  async (req: MulterRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file provided' });
      }

      const userId = req.userId!;
      let uploadBuffer = req.file.buffer;
      let uploadMimeType = req.file.mimetype;
      let uploadName = req.file.originalname;
      let fileSize = req.file.size;

      const { folder } = resolveFolder(req.body.folder);

      // SVG 仅允许用于海报品牌素材，并在入库前转为 PNG，防止存储型 XSS。
      if (folder === 'poster-brand-assets' && uploadMimeType === 'image/svg+xml') {
        const sharp = (await import('sharp')).default;
        uploadBuffer = await sharp(uploadBuffer, { density: 300 }).png().toBuffer();
        uploadMimeType = 'image/png';
        uploadName = `${path.parse(uploadName).name}.png`;
        fileSize = uploadBuffer.length;
      }

      const uploadSecurity = validateUploadSecurity({
        folder,
        originalName: uploadName,
        mimeType: uploadMimeType,
        buffer: uploadBuffer,
      });
      if (!uploadSecurity.allowed) {
        return res.status(400).json({
          success: false,
          message: 'reason' in uploadSecurity ? uploadSecurity.reason : '文件上传被安全策略拒绝',
          code: 'UNSAFE_UPLOAD_REJECTED',
        });
      }

      // P1 修复 #9：按 folder 校验文件大小，避免单一 500MB 上限被滥用
      const folderSizeLimit = FOLDER_SIZE_LIMITS[folder] ?? DEFAULT_SIZE_LIMIT;
      if (fileSize > folderSizeLimit) {
        return res.status(413).json({
          success: false,
          message: `文件大小超过限制: ${folder} 目录上限 ${(folderSizeLimit / 1024 / 1024).toFixed(0)}MB`,
          code: 'FILE_TOO_LARGE',
        });
      }

      if (folder === 'poster-brand-assets') {
        const assetKind = req.body.assetKind === 'qrcode'
          ? 'qrcode'
          : req.body.assetKind === 'logo'
            ? 'logo'
            : req.body.assetKind === 'portrait'
              ? 'portrait'
              : null;
        if (!assetKind) {
          return res.status(400).json({ success: false, message: '海报素材类型必须为 logo、qrcode 或 portrait' });
        }
        const usage = await prisma.userFile.aggregate({
          where: { userId, folder, isDeleted: false },
          _sum: { fileSize: true },
        });
        const usedBytes = usage._sum.fileSize || 0;
        if (usedBytes + fileSize > POSTER_BRAND_ASSET_QUOTA) {
          return res.status(413).json({
            success: false,
            message: 'LOGO 与二维码云空间已达到 20MB 上限，请先删除不用的素材',
            code: 'POSTER_BRAND_ASSET_QUOTA_EXCEEDED',
            quota: { usedBytes, limitBytes: POSTER_BRAND_ASSET_QUOTA },
          });
        }
      }

      let quotaCheck = folder === 'avatars'
        ? { allowed: true, current: 0, limit: 1024 * 1024, remaining: 1024 * 1024 - fileSize }
        : await quotaService.checkStorageQuota(userId, fileSize);

      if (folder !== 'avatars' && !quotaCheck.allowed) {
        logger.info(`[File] 用户 ${userId} 存储配额不足，尝试自动清理...`);
        const cleanupResult = await quotaService.checkAndCleanupStorage(userId);

        if (cleanupResult.cleaned) {
          logger.info(`[File] 自动清理完成，释放 ${(cleanupResult.freedBytes / 1024 / 1024).toFixed(1)} MB，重新检查配额`);
          quotaCheck = await quotaService.checkStorageQuota(userId, fileSize);
        }
        
        if (!quotaCheck.allowed) {
          if (req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(403).json({
            success: false,
            message: 'Storage quota exceeded',
            quota: {
              current: quotaCheck.current,
              limit: quotaCheck.limit,
              remaining: quotaCheck.remaining,
            },
          });
        }
      }

      const persisted = await persistFile(
        userId,
        folder,
        uploadBuffer,
        uploadName,
        uploadMimeType
      );
      const fileType = normalizeAssetType(folder, uploadMimeType, uploadName);
      const thumbnailUrl = fileType === 'image' ? persisted.fileUrl : null;

      // 记录到数据库
      const fileRecord = await prisma.userFile.create({
        data: {
          userId,
          filename: persisted.storedName,
          originalName: req.file.originalname,
          fileType,
          fileSize,
          size: fileSize,
          mimeType: uploadMimeType,
          filePath: persisted.filePath,
          storagePath: persisted.storagePath,
          folder,
          url: persisted.fileUrl,
          cosUrl: persisted.cosUrl,
          thumbnailUrl,
          metadata: buildFileMetadata(fileType, uploadMimeType, uploadName, folder === 'poster-brand-assets' ? { assetKind: req.body.assetKind } : {}),
        },
      });

      if (folder === 'avatars') {
        const previousAvatars = await prisma.userFile.findMany({
          where: { userId, folder: 'avatars', id: { not: fileRecord.id } },
          select: { id: true, storagePath: true },
        });
        await Promise.allSettled(
          previousAvatars.map(async (avatar) => {
            if (avatar.storagePath) await storageService.deleteFile(avatar.storagePath);
            await prisma.userFile.delete({ where: { id: avatar.id } });
          })
        );
      }

      logger.info(
        `[File] Upload: userId=${userId}, file=${req.file.originalname}, size=${fileSize}, folder=${folder}, minio=${!!persisted.cosUrl}`
      );

      res.json({
        success: true,
        message: '上传成功',
        id: fileRecord.id,
        fileId: fileRecord.id,
        fileName: req.file.originalname,
        fileUrl: persisted.fileUrl,
        cosUrl: persisted.cosUrl,
        localUrl: persisted.localUrl,
        thumbnailUrl,
        fileSize,
      });
    } catch (error: unknown) {
      console.error('[File] Upload error:', error);
      if (error instanceof ValidationError) {
        return res
          .status(400)
          .json({ success: false, message: (error instanceof Error ? error.message : String(error)), details: error.details });
      }
      res.status(500).json({ success: false, message: '文件上传失败' });
    }
  }
);

router.post('/upload-url', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { url, type, name, folder: folderInput } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL 不能为空' });
    }

    const userId = req.userId!;

    const response = await fetchRemoteBuffer(url, {
      allowedHosts: getRemoteImportAllowedHosts(),
      maxBytes: 50 * 1024 * 1024,
      timeoutMs: 60000,
    });
    const buffer = Buffer.from(response.data);
    const fileSize = buffer.length;

    // 检查配额
    let quotaCheck = await quotaService.checkStorageQuota(userId, fileSize);
    if (!quotaCheck.allowed) {
      logger.info(`[File] 用户 ${userId} 存储配额不足，尝试自动清理...`);
      const cleanupResult = await quotaService.checkAndCleanupStorage(userId);
      if (cleanupResult.cleaned) {
        logger.info(`[File] 自动清理完成，释放 ${(cleanupResult.freedBytes / 1024 / 1024).toFixed(1)} MB，重新检查配额`);
        quotaCheck = await quotaService.checkStorageQuota(userId, fileSize);
      }
      if (!quotaCheck.allowed) {
        return res.status(403).json({
          success: false,
          message: '存储空间已满',
          quota: {
            current: quotaCheck.current,
            limit: quotaCheck.limit,
            remaining: quotaCheck.remaining,
          },
        });
      }
    }

    const folderName =
      folderInput || (type === 'video' ? 'videos' : type === 'image' ? 'images' : 'audio');
    const { folder } = resolveFolder(folderName);

    const ext =
      path.extname(new URL(url).pathname) ||
      (type === 'video' ? '.mp4' : type === 'image' ? '.png' : '.mp3');
    const originalName = name || `remote${ext}`;
    const mimeType =
      typeof response.headers['content-type'] === 'string'
        ? response.headers['content-type'].split(';')[0]
        : type === 'video'
          ? 'video/mp4'
          : type === 'image'
            ? 'image/png'
            : 'audio/mpeg';
    const uploadSecurity = validateUploadSecurity({
      folder,
      originalName,
      mimeType,
      buffer,
    });
    if (!uploadSecurity.allowed) {
      return res.status(400).json({
        success: false,
        message: 'reason' in uploadSecurity ? uploadSecurity.reason : '远程文件被安全策略拒绝',
        code: 'UNSAFE_REMOTE_UPLOAD_REJECTED',
      });

    }
    const persisted = await persistFile(userId, folder, buffer, originalName, mimeType);
    const fileType = normalizeAssetType(folder, mimeType, originalName);
    const thumbnailUrl = fileType === 'image' ? persisted.fileUrl : null;

    // 记录到数据库
      const fileRecord = await prisma.userFile.create({
      data: {
        userId,
        filename: persisted.storedName,
        originalName,
        fileType,
        fileSize,
        size: fileSize,
        mimeType,
        filePath: persisted.filePath,
        storagePath: persisted.storagePath,
        folder,
        url: persisted.fileUrl,
        cosUrl: persisted.cosUrl,
        thumbnailUrl,
        metadata: buildFileMetadata(fileType, mimeType, originalName),
      },
    });

    res.json({
      success: true,
      message: '同步成功',
      id: fileRecord.id,
      fileId: fileRecord.id,
      fileName: originalName,
      fileUrl: persisted.fileUrl,
      cosUrl: persisted.cosUrl,
      localUrl: persisted.localUrl,
      thumbnailUrl,
      fileSize,
    });
  } catch (error: unknown) {
    console.error('[File] Upload URL error:', error);
    res.status(500).json({ success: false, message: '同步远程文件失败' });
  }
});

router.get('/list', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const membershipLevel = req.membershipLevel || 'trial';
    const queryValidation = listQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      throw new ValidationError('查询参数不合法', queryValidation.error.issues);
    }

    // 会员等级按存储空间限制 removed after deleting membership login system
    const storageSpace = 104857600; // 100MB default
    const quota = await quotaService.getUserQuota(userId);

    const { folder: folderQuery, type, includeDeleted, onlyDeleted } = queryValidation.data;
    const targetFolders =
      typeof folderQuery === 'string' && folderQuery.trim()
        ? [resolveFolder(folderQuery).folder]
        : [...allowedUploadFolders];
    const deletedFilter =
      onlyDeleted === 'true' ? true : includeDeleted === 'true' ? undefined : false;

    const fileRecords = await prisma.userFile.findMany({
      where: {
        userId,
        folder: { in: targetFolders },
        ...(type ? { fileType: type } : {}),
        ...(deletedFilter === undefined ? {} : { isDeleted: deletedFilter }),
      },
      orderBy: { createdAt: 'desc' },
    });

    const files = await Promise.all(
      fileRecords.map(async (fileRecord) => {
        let resolvedUrl = fileRecord.url || '';

        // Stored MinIO URLs may be presigned and expire. Re-issue a fresh URL
        // on every listing so cloud-synced assets remain viewable on mobile.
        if (fileRecord.storagePath && minioPublicStorageService.isEnabled()) {
          const freshUrl = await storageService.getFileUrl(fileRecord.storagePath).catch(() => null);
          if (freshUrl) resolvedUrl = freshUrl;
        }

        if (!resolvedUrl) {
          resolvedUrl = buildLocalFileUrl(fileRecord.filename, fileRecord.folder, userId);
        }

        let thumbnailUrl = fileRecord.thumbnailUrl || '';
        if (!thumbnailUrl && fileRecord.fileType === 'image') {
          thumbnailUrl = resolvedUrl;
        }

        return {
          id: fileRecord.id,
          fileId: fileRecord.id,
          filename: fileRecord.filename,
          originalName: fileRecord.originalName,
          fileType: fileRecord.fileType,
          type: normalizeAssetType(fileRecord.folder, fileRecord.mimeType, fileRecord.filename),
          size: fileRecord.size || fileRecord.fileSize,
          fileSize: fileRecord.fileSize,
          folder: fileRecord.folder,
          mimeType: fileRecord.mimeType,
          createdAt: fileRecord.createdAt.toISOString(),
          uploadedAt: fileRecord.createdAt.toISOString(),
          url: resolvedUrl,
          thumbnailUrl,
          storagePath: fileRecord.storagePath,
          metadata: fileRecord.metadata || null,
          isDeleted: fileRecord.isDeleted,
          deletedAt: fileRecord.deletedAt?.toISOString() || null,
        };
      })
    );

    res.json({
      success: true,
      files,
      membershipAccess: {
        level: membershipLevel,
        storageSpace,
        storageUsed: quota.storageUsed,
        storageRemaining: Math.max(0, storageSpace - quota.storageUsed),
        fileCount: quota.fileCount,
        currentCount: files.length,
      },
    });
  } catch (error: unknown) {
    console.error('[File] List error:', error);
    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json({ success: false, message: (error instanceof Error ? error.message : String(error)), details: error.details });
    }
    res.status(500).json({ success: false, message: '文件列表读取失败' });
  }
});

router.get('/storage-stats', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const quota = await quotaService.getUserQuota(userId);

    const typeStats = await prisma.userFile.groupBy({
      by: ['fileType'],
      where: { userId, isDeleted: false },
      _sum: { fileSize: true },
      _count: true,
    });

    res.json({
      success: true,
      data: {
        storageUsed: quota.storageUsed,
        storageLimit: quota.storageLimit,
        fileCount: quota.fileCount,
        fileLimit: quota.fileLimit,
        usagePercent: quota.storageLimit > 0 ? Math.round((quota.storageUsed / quota.storageLimit) * 100) : 0,
        byType: typeStats.map(s => ({
          type: s.fileType,
          size: s._sum.fileSize || 0,
          count: s._count,
        })),
      },
    });
  } catch (error: unknown) {
    console.error('[File] Storage stats error:', error);
    res.status(500).json({ success: false, message: '获取存储统计失败' });
  }
});

router.get('/:fileId/download', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const fileRecord = await resolveRecordByIdentifier(userId, req.params.fileId);

    if (!fileRecord || fileRecord.isDeleted) {
      throw new NotFoundError('文件不存在');
    }

    const localFilePath = resolveExistingLocalFilePath(fileRecord);
    if (localFilePath) {
      const stat = fs.statSync(localFilePath);
      setDownloadHeaders(res, fileRecord, stat.size);
      const stream = fs.createReadStream(localFilePath);
      stream.on('error', (error) => {
        logger.error(`[File] Download stream error: ${error instanceof Error ? error.message : String(error)}`);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: '文件读取失败' });
        } else {
          res.destroy(error instanceof Error ? error : undefined);
        }
      });

      stream.pipe(res);
      return;
    }

    if (fileRecord.storagePath && storageService.isAvailable()) {
      const downloadUrl = await storageService.getFileUrl(fileRecord.storagePath, 900);
      if (isHttpUrl(downloadUrl)) {
        return res.redirect(downloadUrl);
      }

      const fileBuffer = await storageService.getFile(fileRecord.storagePath);
      if (fileBuffer) {
        setDownloadHeaders(res, fileRecord, fileBuffer.length);
        return res.send(fileBuffer);
      }
    }

    if (isHttpUrl(fileRecord.cosUrl || fileRecord.url)) {
      return res.redirect(fileRecord.cosUrl || fileRecord.url!);
    }

    throw new NotFoundError('文件存储不可用');
  } catch (error: unknown) {
    console.error('[File] Download error:', error);
    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json({ success: false, message: (error instanceof Error ? error.message : String(error)), details: error.details });
    }
    if (error instanceof NotFoundError) {
      return res.status(404).json({ success: false, message: (error instanceof Error ? error.message : String(error)) });
    }
    res.status(500).json({ success: false, message: '文件下载失败' });
  }
});

router.delete('/:fileId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const fileRecord = await resolveRecordByIdentifier(userId, req.params.fileId);

    if (!fileRecord) {
      throw new NotFoundError('文件不存在');
    }

    await prisma.userFile.update({
      where: { id: fileRecord.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    res.json({ success: true, message: '已移入回收站' });
  } catch (error: unknown) {
    console.error('[File] Delete error:', error);
    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json({ success: false, message: (error instanceof Error ? error.message : String(error)), details: error.details });
    }
    if (error instanceof NotFoundError) {
      return res.status(404).json({ success: false, message: (error instanceof Error ? error.message : String(error)) });
    }
    res.status(500).json({ success: false, message: '文件删除失败' });
  }
});

router.post('/:fileId/restore', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const fileRecord = await resolveRecordByIdentifier(userId, req.params.fileId);

    if (!fileRecord) {
      throw new NotFoundError('文件不存在');
    }

    await prisma.userFile.update({
      where: { id: fileRecord.id },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    });

    res.json({ success: true, message: '文件已恢复' });
  } catch (error: unknown) {
    console.error('[File] Restore error:', error);
    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json({ success: false, message: (error instanceof Error ? error.message : String(error)), details: error.details });
    }
    if (error instanceof NotFoundError) {
      return res.status(404).json({ success: false, message: (error instanceof Error ? error.message : String(error)) });
    }
    res.status(500).json({ success: false, message: '文件恢复失败' });
  }
});

router.delete('/:fileId/permanent', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const fileRecord = await resolveRecordByIdentifier(userId, req.params.fileId);

    if (!fileRecord) {
      throw new NotFoundError('文件不存在');
    }

    if (fileRecord.storagePath) {
      const deleted = await storageService.deleteFile(fileRecord.storagePath);
      if (!deleted) {
        return res.status(500).json({ success: false, message: '对象存储文件删除失败' });
      }
    } else if (fileRecord.filePath && fs.existsSync(fileRecord.filePath)) {
      fs.unlinkSync(fileRecord.filePath);
    }

    await prisma.userFile.delete({
      where: { id: fileRecord.id },
    });

    res.json({ success: true, message: '文件已永久删除' });
  } catch (error: unknown) {
    console.error('[File] Permanent delete error:', error);
    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json({ success: false, message: (error instanceof Error ? error.message : String(error)), details: error.details });
    }
    if (error instanceof NotFoundError) {
      return res.status(404).json({ success: false, message: (error instanceof Error ? error.message : String(error)) });
    }
    res.status(500).json({ success: false, message: '文件永久删除失败' });
  }
});

router.post(
  '/:fileId/thumbnail',
  requireAuth,
  thumbnailUpload.single('thumbnail'),
  async (req: MulterRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const fileRecord = await resolveRecordByIdentifier(userId, req.params.fileId);

      if (!fileRecord) {
        throw new NotFoundError('文件不存在');
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: '请选择缩略图文件' });
      }

      // P1 修复 #9：缩略图 magic bytes 校验，防止伪造 MIME 上传 SVG/脚本
      if (!validateMagicBytes(req.file.buffer, req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: '缩略图内容与声明类型不匹配（magic bytes 校验失败）',
          code: 'MAGIC_BYTES_MISMATCH',
        });
      }

      const thumbDir = path.join(process.cwd(), 'uploads', 'thumbnails', userId);
      if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });
      const thumbName = `thumb_${fileRecord.filename}.jpg`;
      const thumbPath = path.join(thumbDir, thumbName);
      fs.writeFileSync(thumbPath, req.file.buffer);
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3200}`;
      const thumbnailUrl = `${baseUrl}/uploads/thumbnails/${userId}/${thumbName}`;

      await prisma.userFile.update({
        where: { id: fileRecord.id },
        data: { thumbnailUrl },
      });

      res.json({ success: true, thumbnailUrl });
    } catch (error: unknown) {
      console.error('[File] Thumbnail upload error:', error);
      if (error instanceof NotFoundError) {
        return res.status(404).json({ success: false, message: (error instanceof Error ? error.message : String(error)) });
      }
      res.status(500).json({ success: false, message: '缩略图上传失败' });
    }
  }
);

export default router;
