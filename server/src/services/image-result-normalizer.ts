import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

function getImageMimeFromBuffer(buffer: Buffer): { mimeType: string; ext: string } | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mimeType: 'image/png', ext: 'png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', ext: 'jpg' };
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { mimeType: 'image/webp', ext: 'webp' };
  }
  if (buffer.length >= 6 && buffer.subarray(0, 3).toString('ascii') === 'GIF') {
    return { mimeType: 'image/gif', ext: 'gif' };
  }
  return null;
}

function extractImageBase64(value?: string): { base64: string; mimeType?: string; ext?: string } | null {
  const source = String(value || '').trim();
  if (!source) return null;

  const dataUrlMatch = source.match(/^data:image\/([a-z0-9.+-]+);base64,([\s\S]+)$/i);
  if (dataUrlMatch?.[2]) {
    const ext = dataUrlMatch[1].toLowerCase() === 'jpeg' ? 'jpg' : dataUrlMatch[1].toLowerCase();
    return {
      base64: dataUrlMatch[2].replace(/\s/g, ''),
      mimeType: `image/${dataUrlMatch[1].toLowerCase()}`,
      ext,
    };
  }

  if (/^(https?:|blob:|file:|\/uploads\/)/i.test(source)) return null;
  const compact = source.replace(/\s/g, '');
  if (compact.length < 256 || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return null;
  if (!/^(iVBORw0KGgo|\/9j\/|R0lGOD|UklGR)/.test(compact)) return null;

  return { base64: compact };
}

export function saveGeneratedImageBase64Asset(userId: string, value: string): string | null {
  const extracted = extractImageBase64(value);
  if (!extracted) return null;

  const buffer = Buffer.from(extracted.base64, 'base64');
  const detected = getImageMimeFromBuffer(buffer);
  if (!detected && !extracted.mimeType) return null;

  const ext = detected?.ext || extracted.ext || 'png';
  const uploadDir = path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'), 'images', userId);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 12);
  const filename = `ai_image_${hash}.${ext}`;
  const targetPath = path.join(uploadDir, filename);
  if (!fs.existsSync(targetPath)) {
    fs.writeFileSync(targetPath, buffer);
  }

  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3200}`;
  return `${baseUrl}/uploads/images/${userId}/${filename}`;
}

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[omitted-deep-metadata]';
  if (typeof value === 'string') {
    const extracted = extractImageBase64(value);
    if (extracted) return `[omitted-base64-image:${Math.round(extracted.base64.length / 1024)}KB]`;
    if (value.length > 20000) return `[omitted-large-string:${value.length}]`;
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadata(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sanitizeMetadata(item, depth + 1),
      ]),
    );
  }
  return value;
}

export async function normalizeImageResultAssets(result: any, userId: string): Promise<any> {
  if (!result || typeof result !== 'object') return result;

  const normalized = { ...result };
  const savedByPayload = new Map<string, string>();
  const normalizeOne = (value?: string): string | undefined => {
    if (!value) return value;
    const extracted = extractImageBase64(value);
    if (!extracted) return value;
    const payloadHash = crypto.createHash('sha256').update(extracted.base64).digest('hex');
    const cached = savedByPayload.get(payloadHash);
    if (cached) return cached;
    const savedUrl = saveGeneratedImageBase64Asset(userId, value);
    if (savedUrl) {
      savedByPayload.set(payloadHash, savedUrl);
      logger.info(`[ImageResultNormalizer] base64 图片已资产化: ${savedUrl}`);
      return savedUrl;
    }
    return value;
  };

  const rawDataImages = Array.isArray(normalized.data)
    ? normalized.data
        .map((item: any) => item?.url || item?.b64_json)
        .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
    : [];
  const sourceUrls = [
    normalized.url,
    normalized.imageUrl,
    ...(Array.isArray(normalized.urls) ? normalized.urls : []),
    ...rawDataImages,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  const normalizedUrls = Array.from(new Set(
    sourceUrls
      .map((url) => normalizeOne(url))
      .filter((url): url is string => typeof url === 'string' && url.length > 0),
  ));

  normalized.url = normalizeOne(normalized.url || normalized.imageUrl || normalizedUrls[0]);
  normalized.imageUrl = normalizeOne(normalized.imageUrl || normalized.url || normalizedUrls[0]);
  if (normalizedUrls.length > 0) {
    normalized.urls = normalizedUrls;
  }
  normalized.metadata = sanitizeMetadata(normalized.metadata);

  return normalized;
}
