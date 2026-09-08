import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { spawn } from 'child_process';
import sharp from 'sharp';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { logger } from '../utils/logger';
import { isLocalUser } from '../utils/local-user';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const WATERMARK_IMAGE_PATH =
  process.env.WATERMARK_IMAGE_PATH ||
  path.join(process.cwd(), 'public', 'watermark', 'LOGO222.png');
const OUTPUT_FOLDER = 'watermarked';
const DEFAULT_IMAGE_OPACITY = 0.2;
const HOMEPAGE_IMAGE_OPACITY = 0.3;
const DEFAULT_VIDEO_OPACITY = 0.2;

const activeVideoJobs = new Map<string, Promise<string>>();

export function isTrialMembership(level?: string | null): boolean {
  const normalized = String(level || 'trial').trim().toLowerCase();
  return ['trial', 'free', 'guest', 'user', 'test', 'beta'].includes(normalized);
}

export function resolveWatermarkEnabled(
  requested: unknown,
  membershipLevel?: string | null
): boolean {
  // 开源本地模式：本地用户永不叠加品牌水印
  if (membershipLevel === 'local') return false;
  if (typeof requested === 'boolean') return requested;
  if (typeof requested === 'string') {
    if (requested.toLowerCase() === 'true') return true;
    if (requested.toLowerCase() === 'false') return false;
  }
  return isTrialMembership(membershipLevel);
}

export function resolveImageWatermarkOpacity(source?: string | null): number {
  const normalized = String(source || '').trim().toLowerCase();
  return normalized === 'poster' || normalized === 'ai-poster' || normalized.startsWith('home-')
    ? HOMEPAGE_IMAGE_OPACITY
    : DEFAULT_IMAGE_OPACITY;
}

function buildPublicUrl(relativePath: string): string {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3200}`;
  return `${baseUrl.replace(/\/$/, '')}/uploads/${relativePath.replace(/\\/g, '/')}`;
}

function getOutputDirectory(userId: string, type: 'images' | 'videos'): string {
  const directory = path.join(UPLOAD_DIR, OUTPUT_FOLDER, type, userId);
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function resolveLocalMediaPath(mediaUrl: string): string | null {
  if (!mediaUrl) return null;
  if (path.isAbsolute(mediaUrl) && fs.existsSync(mediaUrl)) return mediaUrl;

  try {
    const parsed = new URL(mediaUrl, 'http://localhost');
    if (parsed.pathname.startsWith('/uploads/')) {
      const relativePath = decodeURIComponent(parsed.pathname.slice('/uploads/'.length));
      const candidate = path.resolve(UPLOAD_DIR, relativePath);
      const uploadRoot = path.resolve(UPLOAD_DIR) + path.sep;
      if ((candidate + path.sep).startsWith(uploadRoot) && fs.existsSync(candidate)) {
        return candidate;
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function readMediaBuffer(mediaUrl: string): Promise<Buffer> {
  if (mediaUrl.startsWith('data:')) {
    const commaIndex = mediaUrl.indexOf(',');
    if (commaIndex < 0) throw new Error('Invalid data URL');
    return Buffer.from(mediaUrl.slice(commaIndex + 1), 'base64');
  }

  const localPath = resolveLocalMediaPath(mediaUrl);
  if (localPath) return fs.promises.readFile(localPath);

  const response = await axios.get<ArrayBuffer>(mediaUrl, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxContentLength: 1024 * 1024 * 1024,
    maxBodyLength: 1024 * 1024 * 1024,
  });
  return Buffer.from(response.data);
}

async function createOpacityAdjustedLogo(width: number, opacity: number): Promise<Buffer> {
  const { data, info } = await sharp(WATERMARK_IMAGE_PATH)
    .resize({ width, withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const alphaMultiplier = Math.max(0, Math.min(1, opacity));
  for (let index = 3; index < data.length; index += info.channels) {
    data[index] = Math.round(data[index] * alphaMultiplier);
  }

  return sharp(data, { raw: info }).png().toBuffer();
}

export async function applyImageWatermark(
  mediaUrl: string,
  userId: string,
  options: { opacity?: number; outputKey?: string } = {}
): Promise<string> {
  // 开源本地模式：本地用户永不加水印
  if (isLocalUser(userId)) return mediaUrl;
  if (!mediaUrl || mediaUrl.includes(`/uploads/${OUTPUT_FOLDER}/images/`)) return mediaUrl;
  if (!fs.existsSync(WATERMARK_IMAGE_PATH)) {
    throw new Error(`Watermark image not found: ${WATERMARK_IMAGE_PATH}`);
  }

  const source = await readMediaBuffer(mediaUrl);
  const metadata = await sharp(source).metadata();
  const sourceWidth = metadata.width || 1024;
  const sourceHeight = metadata.height || 1024;
  const logoWidth = Math.max(72, Math.min(420, Math.round(sourceWidth * 0.16)));
  const margin = Math.max(12, Math.min(56, Math.round(Math.min(sourceWidth, sourceHeight) * 0.025)));
  const logo = await createOpacityAdjustedLogo(logoWidth, options.opacity ?? DEFAULT_IMAGE_OPACITY);
  const logoMetadata = await sharp(logo).metadata();
  const left = Math.max(0, sourceWidth - (logoMetadata.width || logoWidth) - margin);
  const top = Math.max(0, sourceHeight - (logoMetadata.height || logoWidth) - margin);

  const outputDirectory = getOutputDirectory(userId, 'images');
  const outputKey = (options.outputKey || `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`)
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${outputKey}.png`;
  const outputPath = path.join(outputDirectory, filename);

  if (!fs.existsSync(outputPath)) {
    await sharp(source)
      .rotate()
      .composite([{ input: logo, left, top, blend: 'over' }])
      .png({ compressionLevel: 9 })
      .toFile(outputPath);
  }

  return buildPublicUrl(path.join(OUTPUT_FOLDER, 'images', userId, filename));
}

async function materializeVideoInput(mediaUrl: string, temporaryPath: string): Promise<{ path: string; temporary: boolean }> {
  const localPath = resolveLocalMediaPath(mediaUrl);
  if (localPath) return { path: localPath, temporary: false };

  if (mediaUrl.startsWith('data:')) {
    await fs.promises.writeFile(temporaryPath, await readMediaBuffer(mediaUrl));
    return { path: temporaryPath, temporary: true };
  }

  const response = await axios.get(mediaUrl, {
    responseType: 'stream',
    timeout: 120000,
    maxContentLength: 2 * 1024 * 1024 * 1024,
    maxBodyLength: 2 * 1024 * 1024 * 1024,
  });
  await pipeline(response.data, fs.createWriteStream(temporaryPath));
  return { path: temporaryPath, temporary: true };
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn(ffmpegInstaller.path, args, { windowsHide: true });
    let stderr = '';

    process.stderr.on('data', (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 16000) stderr = stderr.slice(-16000);
    });
    process.on('error', reject);
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-3000)}`));
    });
  });
}

export async function applyVideoWatermark(
  mediaUrl: string,
  userId: string,
  options: { opacity?: number; outputKey?: string } = {}
): Promise<string> {
  // 开源本地模式：本地用户永不加水印
  if (isLocalUser(userId)) return mediaUrl;
  if (!mediaUrl || mediaUrl.includes(`/uploads/${OUTPUT_FOLDER}/videos/`)) return mediaUrl;
  if (!fs.existsSync(WATERMARK_IMAGE_PATH)) {
    throw new Error(`Watermark image not found: ${WATERMARK_IMAGE_PATH}`);
  }

  const outputDirectory = getOutputDirectory(userId, 'videos');
  const outputKey = (options.outputKey || `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`)
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${outputKey}.mp4`;
  const outputPath = path.join(outputDirectory, filename);
  const publicUrl = buildPublicUrl(path.join(OUTPUT_FOLDER, 'videos', userId, filename));

  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) return publicUrl;
  const existingJob = activeVideoJobs.get(outputPath);
  if (existingJob) return existingJob;

  const job = (async () => {
    const temporaryInputPath = path.join(outputDirectory, `${outputKey}.input.tmp`);
    const temporaryOutputPath = path.join(outputDirectory, `${outputKey}.output.tmp.mp4`);
    const input = await materializeVideoInput(mediaUrl, temporaryInputPath);
    const opacity = Math.max(0, Math.min(1, options.opacity ?? DEFAULT_VIDEO_OPACITY));
    const filter = [
      `[1:v]format=rgba,colorchannelmixer=aa=${opacity.toFixed(3)}[logo]`,
      '[logo][0:v]scale2ref=w=main_w*0.16:h=-1[wm][base]',
      '[base][wm]overlay=x=main_w-overlay_w-main_w*0.02:y=main_h-overlay_h-main_h*0.02[outv]',
    ].join(';');

    try {
      await runFfmpeg([
        '-y',
        '-i', input.path,
        '-i', WATERMARK_IMAGE_PATH,
        '-filter_complex', filter,
        '-map', '[outv]',
        '-map', '0:a?',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        temporaryOutputPath,
      ]);
      await fs.promises.rename(temporaryOutputPath, outputPath);
      return publicUrl;
    } finally {
      if (input.temporary) await fs.promises.unlink(input.path).catch(() => {});
      await fs.promises.unlink(temporaryOutputPath).catch(() => {});
    }
  })();

  activeVideoJobs.set(outputPath, job);
  try {
    return await job;
  } finally {
    activeVideoJobs.delete(outputPath);
  }
}

export async function safelyApplyImageWatermark(
  mediaUrl: string,
  userId: string,
  options: { opacity?: number; outputKey?: string } = {}
): Promise<string> {
  try {
    return await applyImageWatermark(mediaUrl, userId, options);
  } catch (error) {
    logger.error('[Watermark] Image watermark failed, returning original media:', error);
    return mediaUrl;
  }
}

export async function safelyApplyVideoWatermark(
  mediaUrl: string,
  userId: string,
  options: { opacity?: number; outputKey?: string } = {}
): Promise<string> {
  try {
    return await applyVideoWatermark(mediaUrl, userId, options);
  } catch (error) {
    logger.error('[Watermark] Video watermark failed, returning original media:', error);
    return mediaUrl;
  }
}
