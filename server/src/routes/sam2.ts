import { Router, Request, Response } from 'express';
import axios from 'axios';
import FormData from 'form-data';
import { authenticate, AuthRequest } from '../middleware/auth';
import { creditService } from '../services/credit-service';
import { logger } from '../utils/logger';
import { fetchRemoteBuffer, getRemoteImportAllowedHosts } from '../utils/safe-remote-fetch';

const sam2Router = Router();

// SAM2 模型路径（已嵌入软件 backend/models/sam2/）
const SAM2_MODEL_DIR = process.env.SAM2_MODEL_DIR || '';
const SAM2_MODEL_PATH = process.env.SAM2_MODEL_PATH || '';
const SAM2_SERVER_URL = process.env.SAM2_SERVER_URL || 'http://127.0.0.1:7100';
const SAM2_ENABLED = process.env.SAM2_ENABLED !== 'false';
const SAM2_POINTS = parseInt(process.env.SAM2_POINTS || '10', 10);

// 默认模型清单（嵌入路径优先，回退到环境变量）
const SAM2_MODELS = [
  { id: 'sam2_hiera_small', name: 'SAM2 Hiera Small', desc: '轻量级，速度最快', file: 'sam2_hiera_small.pt' },
  { id: 'sam2_hiera_base_plus', name: 'SAM2 Hiera Base Plus', desc: '平衡精度与速度', file: 'sam2_hiera_base_plus.pt' },
  { id: 'sam2_hiera_large', name: 'SAM2 Hiera Large', desc: '最高精度，精细边缘', file: 'sam2_hiera_large.pt' },
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

async function checkSam2Server(): Promise<boolean> {
  try {
    const response = await axios.get(`${SAM2_SERVER_URL}/api/health`, { timeout: 3000 });
    return response.status === 200;
  } catch {
    return false;
  }
}

// SAM2 交互式分割端点
sam2Router.post('/segment', authenticate, async (req: AuthRequest, res: Response) => {
  if (!SAM2_ENABLED) {
    return res.status(503).json({ success: false, error: 'SAM2 服务未启用' });
  }

  try {
    const { image_url, image_base64, points, box, model } = req.body;

    if (!image_url && !image_base64) {
      return res.status(400).json({ success: false, error: '请提供 image_url 或 image_base64' });
    }

    // 积分预检查
    const membershipLevel = req.membershipLevel || 'trial';
    const creditCheck = await creditService.preCheck({
      userId: req.userId!,
      membershipLevel,
      type: 'image',
      customPoints: SAM2_POINTS,
      taskId: `sam2_${Date.now()}`,
      reason: 'SAM2交互式分割预检查',
    });

    if (!creditCheck.allowed) {
      return res.status(402).json({ success: false, error: creditCheck.reason });
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

    // 检查 SAM2 Python 服务
    const sam2Online = await checkSam2Server();
    if (!sam2Online) {
      return res.status(503).json({
        success: false,
        error: 'SAM2 Python 服务未启动，请先运行 SAM2 微服务',
      });
    }

    // 调用 SAM2 Python 服务
    const form = new FormData();
    form.append('file', imageBuffer, { filename: 'image.png', contentType: imageMimeType });
    if (model) form.append('model', model);
    if (points) form.append('points', JSON.stringify(points));
    if (box) form.append('box', JSON.stringify(box));

    const response = await axios.post(`${SAM2_SERVER_URL}/api/segment`, form, {
      headers: form.getHeaders(),
      responseType: 'arraybuffer',
      timeout: 120000,
    });

    const resultBase64 = Buffer.from(response.data).toString('base64');

    // 扣除积分
    await creditService.consume({
      userId: req.userId!,
      membershipLevel,
      type: 'image',
      customPoints: SAM2_POINTS,
      taskId: `sam2_${Date.now()}`,
      reason: 'SAM2交互式分割',
    });

    return res.json({
      success: true,
      image: resultBase64,
      format: 'png',
      engine: 'sam2',
      points: SAM2_POINTS,
    });
  } catch (error: unknown) {
    const err = error as any;
    logger.error('[SAM2] Error:', err.message || String(error));

    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: 'SAM2 服务未启动',
      });
    }

    return res.status(500).json({
      success: false,
      error: err.response?.data?.toString() || err.message || 'SAM2 分割失败',
    });
  }
});

// 模型列表
sam2Router.get('/models', async (_req: Request, res: Response) => {
  return res.json({ success: true, models: SAM2_MODELS, enabled: SAM2_ENABLED });
});

// 健康检查
sam2Router.get('/health', async (_req: Request, res: Response) => {
  if (!SAM2_ENABLED) {
    return res.json({ success: true, enabled: false, status: 'disabled' });
  }

  const online = await checkSam2Server();
  return res.json({
    success: true,
    enabled: true,
    status: online ? 'online' : 'offline',
    url: SAM2_SERVER_URL,
  });
});

export { sam2Router };
