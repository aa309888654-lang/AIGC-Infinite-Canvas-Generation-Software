import { Router, Request, Response } from 'express';
import axios from 'axios';
import FormData from 'form-data';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { fetchRemoteBuffer, getRemoteImportAllowedHosts } from '../utils/safe-remote-fetch';

const upscaleRouter = Router();

// Real-ESRGAN 服务配置（模型已嵌入 server/models/realesrgan/）
const REAL_ESRGAN_SERVER_URL = process.env.REAL_ESRGAN_SERVER_URL || 'http://127.0.0.1:7300';
const REAL_ESRGAN_ENABLED = process.env.REAL_ESRGAN_ENABLED !== 'false';

// 嵌入模型清单
const UPSCALE_MODELS = [
  { id: 'RealESRGAN_x2plus', name: 'RealESRGAN 2× 通用', desc: '通用图像2倍超分', file: 'RealESRGAN_x2plus.pth', scale: 2 },
  { id: 'RealESRGAN_x4plus', name: 'RealESRGAN 4× 通用', desc: '通用图像4倍超分', file: 'RealESRGAN_x4plus.pth', scale: 4 },
  { id: 'RealESRGAN_x4plus_anime_6B', name: 'RealESRGAN 4× 动漫', desc: '动漫图像4倍超分', file: 'RealESRGAN_x4plus_anime_6B.pth', scale: 4 },
  { id: 'realesr-general-x4v3', name: 'RealESR 通用 v3', desc: '通用x4v3超分', file: 'realesr-general-x4v3.pth', scale: 4 },
  { id: 'realesr-general-wdn-x4v3', name: 'RealESR 通用 v3 降噪', desc: '通用x4v3带降噪', file: 'realesr-general-wdn-x4v3.pth', scale: 4 },
];

function parseBase64Image(input: unknown): { buffer: Buffer; mimeType: string } {
  if (typeof input !== 'string' || !input.trim()) {
    throw new Error('图片 base64 数据为空');
  }
  const value = input.trim();
  const dataUrlMatch = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUrlMatch) {
    return { buffer: Buffer.from(dataUrlMatch[2], 'base64'), mimeType: dataUrlMatch[1] };
  }
  return {
    buffer: Buffer.from(value.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ''), 'base64'),
    mimeType: 'image/png',
  };
}

function isDataImageUrl(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value);
}

async function checkUpscaleServer(): Promise<boolean> {
  try {
    const response = await axios.get(`${REAL_ESRGAN_SERVER_URL}/api/health`, { timeout: 3000 });
    return response.status === 200;
  } catch {
    return false;
  }
}

// Real-ESRGAN 超分端点
upscaleRouter.post('/realesrgan', authenticate, async (req: AuthRequest, res: Response) => {
  if (!REAL_ESRGAN_ENABLED) {
    return res.status(503).json({ success: false, error: 'Real-ESRGAN 服务未启用' });
  }

  try {
    const { image_url, image_base64, model, scale, tile, face_enhance } = req.body;

    if (!image_url && !image_base64) {
      return res.status(400).json({ success: false, error: '请提供 image_url 或 image_base64' });
    }

    // 解析图片
    let imageBuffer: Buffer;
    let imageMimeType = 'image/png';

    if (image_base64) {
      const parsed = parseBase64Image(image_base64);
      imageBuffer = parsed.buffer;
      imageMimeType = parsed.mimeType;
    } else if (image_url) {
      if (isDataImageUrl(image_url)) {
        const parsed = parseBase64Image(image_url);
        imageBuffer = parsed.buffer;
        imageMimeType = parsed.mimeType;
      } else {
        const imgResponse = await fetchRemoteBuffer(image_url, {
          allowedHosts: getRemoteImportAllowedHosts(),
          maxBytes: 50 * 1024 * 1024,
          timeoutMs: 30000,
        });
        imageBuffer = Buffer.from(imgResponse.data);
        const contentType = String(imgResponse.headers['content-type'] || '');
        if (contentType.startsWith('image/')) imageMimeType = contentType;
      }
    } else {
      return res.status(400).json({ success: false, error: '无有效图片输入' });
    }

    // 检查 Real-ESRGAN Python 服务
    const upscaleOnline = await checkUpscaleServer();
    if (!upscaleOnline) {
      return res.status(503).json({
        success: false,
        error: 'Real-ESRGAN Python 服务未启动，请先运行超分微服务',
      });
    }

    // 调用 Real-ESRGAN Python 服务
    const form = new FormData();
    form.append('file', imageBuffer, { filename: 'image.png', contentType: imageMimeType });
    if (model) form.append('model', model);
    if (scale) form.append('scale', String(scale));
    if (tile) form.append('tile', String(tile));
    if (face_enhance) form.append('face_enhance', 'true');

    const response = await axios.post(`${REAL_ESRGAN_SERVER_URL}/api/upscale`, form, {
      headers: form.getHeaders(),
      responseType: 'arraybuffer',
      timeout: 300000, // 超分耗时较长，5分钟超时
    });

    const resultBase64 = Buffer.from(response.data).toString('base64');

    return res.json({
      success: true,
      image: resultBase64,
      format: 'png',
      engine: 'realesrgan',
    });
  } catch (error: unknown) {
    const err = error as any;
    logger.error('[Upscale] Error:', err.message || String(error));

    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: 'Real-ESRGAN 服务未启动',
      });
    }

    return res.status(500).json({
      success: false,
      error: err.response?.data?.toString() || err.message || '超分处理失败',
    });
  }
});

// 模型列表
upscaleRouter.get('/models', async (_req: Request, res: Response) => {
  return res.json({ success: true, models: UPSCALE_MODELS, enabled: REAL_ESRGAN_ENABLED });
});

// 健康检查
upscaleRouter.get('/health', async (_req: Request, res: Response) => {
  if (!REAL_ESRGAN_ENABLED) {
    return res.json({ success: true, enabled: false, status: 'disabled' });
  }

  const online = await checkUpscaleServer();
  return res.json({
    success: true,
    enabled: true,
    status: online ? 'online' : 'offline',
    url: REAL_ESRGAN_SERVER_URL,
  });
});

export { upscaleRouter };
