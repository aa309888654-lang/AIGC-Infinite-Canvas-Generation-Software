import { Router, Request, Response } from 'express';
import axios from 'axios';
import FormData from 'form-data';
import { authenticate, AuthRequest } from '../middleware/auth';
import { fetchRemoteBuffer, getRemoteImportAllowedHosts } from '../utils/safe-remote-fetch';

const rembgRouter = Router();

const REMBG_SERVER_URL = process.env.REMBG_SERVER_URL || 'http://127.0.0.1:7000';
const REMBG_ENABLED = process.env.REMBG_ENABLED !== 'false';
const REMBG_BUILTIN_ENABLED = process.env.REMBG_BUILTIN_ENABLED === 'true';

let imglyRemoveBackground: typeof import('@imgly/background-removal').removeBackground | null = null;
let imglyLoaded = false;

async function loadImgly() {
  if (imglyLoaded) return imglyRemoveBackground;
  imglyLoaded = true;
  if (!REMBG_BUILTIN_ENABLED) return null;
  try {
    const mod = await import('@imgly/background-removal');
    imglyRemoveBackground = mod.removeBackground;
    console.log('[Rembg] @imgly/background-removal 加载成功 (内置引擎)');
  } catch (e) {
    console.warn('[Rembg] @imgly/background-removal 加载失败:', (e as Error).message);
  }
  return imglyRemoveBackground;
}

loadImgly();

function parseBase64Image(input: unknown): { buffer: Buffer; mimeType: string } {
  if (typeof input !== 'string' || !input.trim()) {
    throw new Error('图片 base64 数据为空');
  }

  const value = input.trim();
  const dataUrlMatch = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUrlMatch) {
    return {
      buffer: Buffer.from(dataUrlMatch[2], 'base64'),
      mimeType: dataUrlMatch[1],
    };
  }

  return {
    buffer: Buffer.from(value.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ''), 'base64'),
    mimeType: 'image/png',
  };
}

function isDataImageUrl(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value);
}

async function removeBackgroundBuiltIn(imageBuffer: Buffer, model?: string, mimeType = 'image/png'): Promise<Buffer> {
  const removeBg = await loadImgly();
  if (!removeBg) {
    throw new Error('内置背景移除引擎不可用');
  }

  const imglyModel = model === 'isnet' ? 'isnet' : model === 'isnet_quint8' ? 'isnet_quint8' : 'isnet_fp16';

  const blob = new Blob([imageBuffer], { type: mimeType });

  const resultBlob = await removeBg(blob, {
    model: imglyModel,
    output: { format: 'image/png', quality: 0.9 },
  });

  const arrayBuffer = await resultBlob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function checkPythonRembg(): Promise<boolean> {
  try {
    const response = await axios.get(`${REMBG_SERVER_URL}/api/health`, { timeout: 3000 });
    return response.status === 200;
  } catch {
    return false;
  }
}

rembgRouter.post('/remove-background', authenticate, async (req: AuthRequest, res: Response) => {
  if (!REMBG_ENABLED) {
    return res.status(503).json({ success: false, error: 'Rembg 服务未启用' });
  }

  try {
    const { image_url, model, return_mask, alpha_matting, alpha_matting_foreground_threshold, alpha_matting_background_threshold, alpha_matting_erode_size } = req.body;

    if (!image_url && !req.body.image_base64) {
      return res.status(400).json({ success: false, error: '请提供 image_url 或 image_base64' });
    }

    let imageBuffer: Buffer;
    let imageMimeType = 'image/png';

    if (req.body.image_base64) {
      const parsed = parseBase64Image(req.body.image_base64);
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

    const pythonOnline = await checkPythonRembg();
    let engine = '';

    if (pythonOnline) {
      try {
        const rembgUrl = `${REMBG_SERVER_URL}/api/remove`;
        const form = new FormData();
        form.append('file', imageBuffer, { filename: 'image.png', contentType: imageMimeType });
        if (model) form.append('model', model);
        if (return_mask) form.append('only_mask', 'true');
        if (alpha_matting) {
          form.append('a', 'true');
          if (alpha_matting_foreground_threshold) form.append('af', String(alpha_matting_foreground_threshold));
          if (alpha_matting_background_threshold) form.append('ab', String(alpha_matting_background_threshold));
          if (alpha_matting_erode_size) form.append('ae', String(alpha_matting_erode_size));
        }

        const response = await axios.post(rembgUrl, form, {
          headers: form.getHeaders(),
          responseType: 'arraybuffer',
          timeout: 120000,
        });

        const resultBase64 = Buffer.from(response.data).toString('base64');
        engine = 'python-rembg';

        return res.json({ success: true, image: resultBase64, format: 'png', engine });
      } catch (pyError: unknown) {
        const pyErr = pyError as any;
        console.warn('[Rembg] Python Rembg 调用失败，回退到内置引擎:', pyErr.message);
      }
    }

    try {
      if (!REMBG_BUILTIN_ENABLED) {
        return res.status(503).json({
          success: false,
          error: 'Python Rembg 服务未启动，后端内置引擎未启用',
        });
      }
      const resultBuffer = await removeBackgroundBuiltIn(imageBuffer, model, imageMimeType);
      const resultBase64 = resultBuffer.toString('base64');
      engine = 'imgly-built-in';

      return res.json({ success: true, image: resultBase64, format: 'png', engine });
    } catch (builtInError: unknown) {
      const biErr = builtInError as any;
      console.error('[Rembg] 内置引擎也失败:', biErr.message);
      return res.status(500).json({
        success: false,
        error: biErr.message || '背景移除失败',
      });
    }
  } catch (error: unknown) {
    const err = error as any;
    console.error('[Rembg] Error:', err.message || String(error));

    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: 'Rembg 服务未启动，请先运行: rembg s --host 0.0.0.0 --port 7000',
      });
    }

    return res.status(500).json({
      success: false,
      error: err.response?.data?.toString() || err.message || 'Rembg 处理失败',
    });
  }
});

rembgRouter.get('/models', async (_req: Request, res: Response) => {
  // 模型来源：
  // - Python Rembg 服务：通过 U2NET_HOME 环境变量指向嵌入路径 server/models/rembg/ 或外部路径
  // - 内置 @imgly 引擎：使用 web/public/ai-models/background-removal/models/ 下的 isnet 系列
  const models = [
    { id: 'birefnet-general', name: 'BiRefNet 通用', desc: '最新SOTA通用分割（推荐）' },
    { id: 'birefnet-portrait', name: 'BiRefNet 人像', desc: '最新SOTA人像分割' },
    { id: 'u2net', name: 'U2Net 通用', desc: '通用背景去除，适合大多数场景' },
    { id: 'u2netp', name: 'U2Net 轻量', desc: '轻量版，速度更快' },
    { id: 'u2net_human_seg', name: 'U2Net 人像', desc: '专用人像分割' },
    { id: 'u2net_cloth_segm', name: 'U2Net 服装', desc: '服装分割' },
    { id: 'silueta', name: 'Silueta', desc: '高精度人像分割' },
    { id: 'isnet-general-use', name: 'ISNet 通用', desc: '高精度通用分割' },
    { id: 'isnet-anime', name: 'ISNet 动漫', desc: '动漫角色分割' },
    { id: 'sam', name: 'SAM', desc: 'Segment Anything，支持点/框提示' },
    { id: 'isnet_fp16', name: 'ISNet FP16', desc: '内置引擎 - FP16精度，速度快' },
    { id: 'isnet', name: 'ISNet 全精度', desc: '内置引擎 - 最高精度' },
    { id: 'isnet_quint8', name: 'ISNet 量化', desc: '内置引擎 - 量化模型，体积最小' },
  ];

  return res.json({ success: true, models, enabled: REMBG_ENABLED });
});

rembgRouter.get('/health', async (_req: Request, res: Response) => {
  if (!REMBG_ENABLED) {
    return res.json({ success: true, enabled: false, status: 'disabled' });
  }

  const pythonOnline = await checkPythonRembg();
  const builtInAvailable = REMBG_BUILTIN_ENABLED && !!imglyRemoveBackground;

  if (pythonOnline) {
    return res.json({ success: true, enabled: true, status: 'online', engine: 'python-rembg', builtIn: builtInAvailable });
  }

  if (builtInAvailable) {
    return res.json({ success: true, enabled: true, status: 'online', engine: 'imgly-built-in', builtIn: true });
  }

  return res.json({ success: true, enabled: true, status: 'offline', url: REMBG_SERVER_URL, builtIn: false });
});

export { rembgRouter };
