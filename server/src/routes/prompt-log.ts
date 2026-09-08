import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { promptLogService } from '../services/prompt-log-service';

export const promptLogRouter = Router();

// 保存提示词（用户端调用，需认证）
promptLogRouter.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { prompt, negativePrompt, model, provider, type, source, optimizedPrompt, metadata } = req.body;
    if (!prompt || !prompt.trim()) {
      res.status(400).json({ success: false, error: '提示词不能为空' });
      return;
    }
    const log = await promptLogService.create({
      userId: req.userId,
      prompt: prompt.trim(),
      negativePrompt,
      model,
      provider,
      type: type || 'image',
      source: source || 'ai-view',
      optimizedPrompt,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata,
    });
    res.json({ success: true, data: log });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 公开保存（无需认证，用于未登录用户）
promptLogRouter.post('/public', async (req: Request, res: Response) => {
  try {
    const { prompt, negativePrompt, model, provider, type, source, optimizedPrompt, metadata } = req.body;
    if (!prompt || !prompt.trim()) {
      res.status(400).json({ success: false, error: '提示词不能为空' });
      return;
    }
    const log = await promptLogService.create({
      prompt: prompt.trim(),
      negativePrompt,
      model,
      provider,
      type: type || 'image',
      source: source || 'ai-view',
      optimizedPrompt,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata,
    });
    res.json({ success: true, data: log });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 管理端：列表查询
promptLogRouter.get('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { page, pageSize, type, source, userId, startDate, endDate, keyword } = req.query;
    const result = await promptLogService.list({
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 50,
      type: type as string,
      source: source as string,
      userId: userId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      keyword: keyword as string,
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 管理端：统计
promptLogRouter.get('/stats', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await promptLogService.getStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 管理端：导出下载
promptLogRouter.get('/export', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { type, source, startDate, endDate, keyword, format } = req.query;
    const data = await promptLogService.exportAll({
      type: type as string,
      source: source as string,
      startDate: startDate as string,
      endDate: endDate as string,
      keyword: keyword as string,
      format: (format as string) || 'json',
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=prompt-logs-${new Date().toISOString().slice(0, 10)}.csv`);
      // BOM for Excel UTF-8
      res.send('\uFEFF' + data);
    } else {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=prompt-logs-${new Date().toISOString().slice(0, 10)}.json`);
      res.json(data);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
