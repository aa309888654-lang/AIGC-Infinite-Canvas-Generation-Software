import { Router, Response } from 'express';
import axios from 'axios';
import { authenticate, adminMiddleware, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';
import prisma from '../lib/prisma';

const adminMediaGatewayRouter = Router();
const MEDIAGATEWAY_URL = process.env.MEDIAGATEWAY_URL || 'http://localhost:3002';
const MG_ENABLED_KEY = 'mediagateway_enabled';
const MG_DOUBAO_KEY = 'mediagateway_doubao_key';
const MG_LOG_PREFIX = '[AdminMediaGateway]';

interface MGLogEntry {
  time: string;
  action: string;
  detail: string;
  userId?: string;
}

const recentLogs: MGLogEntry[] = [];
const MAX_LOGS = 200;

function mgLog(action: string, detail: string, userId?: string) {
  const entry: MGLogEntry = { time: new Date().toISOString(), action, detail, userId };
  recentLogs.unshift(entry);
  if (recentLogs.length > MAX_LOGS) recentLogs.pop();
  logger.info(`${MG_LOG_PREFIX} ${action}: ${detail}${userId ? ` by=${userId}` : ''}`);
}

async function isMediaGatewayEnabled(): Promise<boolean> {
  const config = await prisma.systemConfig.findUnique({ where: { key: MG_ENABLED_KEY } });
  return config?.value === 'true';
}

adminMediaGatewayRouter.get('/enabled', authenticate, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const enabled = await isMediaGatewayEnabled();
    res.json({ success: true, data: { enabled } });
  } catch (error: any) {
    logger.error(`${MG_LOG_PREFIX} Failed to get enabled state:`, error.message);
    res.status(500).json({ success: false, error: '获取开关状态失败' });
  }
});

adminMediaGatewayRouter.post('/toggle', authenticate, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ success: false, error: '参数错误' });
      return;
    }
    await prisma.systemConfig.upsert({
      where: { key: MG_ENABLED_KEY },
      update: { value: String(enabled) },
      create: { key: MG_ENABLED_KEY, value: String(enabled), description: 'MediaGateway 开关' },
    });
    mgLog('TOGGLE', `MediaGateway ${enabled ? '启用' : '关闭'}`, req.userId);
    res.json({ success: true, data: { enabled } });
  } catch (error: any) {
    logger.error(`${MG_LOG_PREFIX} Failed to toggle:`, error.message);
    res.status(500).json({ success: false, error: '切换开关失败' });
  }
});

adminMediaGatewayRouter.get('/status', authenticate, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const enabled = await isMediaGatewayEnabled();
    if (!enabled) {
      res.json({ success: true, data: { vidu: [], doubao: { has_key: false } } });
      return;
    }
    const response = await axios.get(`${MEDIAGATEWAY_URL}/api/v1/admin/status`, { timeout: 5000 });
    const doubaoKeyConfig = await prisma.systemConfig.findUnique({ where: { key: MG_DOUBAO_KEY } });
    const doubaoHasKey = !!(doubaoKeyConfig?.value || response.data?.doubao?.has_key);
    res.json({
      success: true,
      data: {
        ...response.data,
        doubao: { has_key: doubaoHasKey },
      },
    });
  } catch (error: any) {
    logger.error(`${MG_LOG_PREFIX} Failed to get status:`, error.message);
    const doubaoKeyConfig = await prisma.systemConfig.findUnique({ where: { key: MG_DOUBAO_KEY } }).catch(() => null);
    res.json({
      success: true,
      data: {
        vidu: [],
        doubao: { has_key: !!doubaoKeyConfig?.value },
      },
    });
  }
});

adminMediaGatewayRouter.post('/reset-failures', authenticate, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const enabled = await isMediaGatewayEnabled();
    if (!enabled) {
      res.status(403).json({ success: false, error: 'MediaGateway 已关闭，请先启用' });
      return;
    }
    const { provider } = req.body;
    if (!provider || typeof provider !== 'string') {
      res.status(400).json({ success: false, error: 'provider 参数缺失' });
      return;
    }
    const response = await axios.post(`${MEDIAGATEWAY_URL}/api/v1/admin/reset-failures`, null, {
      params: { provider },
      timeout: 5000,
    });
    mgLog('RESET_FAILURES', `provider=${provider}`, req.userId);
    res.json({ success: true, data: response.data });
  } catch (error: any) {
    logger.error(`${MG_LOG_PREFIX} Failed to reset failures:`, error.message);
    res.status(500).json({ success: false, error: '重置失败' });
  }
});

adminMediaGatewayRouter.post('/add-key', authenticate, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const enabled = await isMediaGatewayEnabled();
    if (!enabled) {
      res.status(403).json({ success: false, error: 'MediaGateway 已关闭，请先启用' });
      return;
    }
    const { key } = req.body;
    if (!key || typeof key !== 'string' || key.trim().length < 10) {
      res.status(400).json({ success: false, error: '秘钥格式无效，长度至少10个字符' });
      return;
    }
    const response = await axios.post(`${MEDIAGATEWAY_URL}/api/v1/admin/add-key`, null, {
      params: { key: key.trim() },
      timeout: 5000,
    });
    mgLog('ADD_KEY', `Vidu key added`, req.userId);
    res.json({ success: true, data: response.data });
  } catch (error: any) {
    logger.error(`${MG_LOG_PREFIX} Failed to add key:`, error.message);
    res.status(500).json({ success: false, error: '新增失败' });
  }
});

adminMediaGatewayRouter.post('/batch-add-keys', authenticate, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const enabled = await isMediaGatewayEnabled();
    if (!enabled) {
      res.status(403).json({ success: false, error: 'MediaGateway 已关闭，请先启用' });
      return;
    }
    const { keys } = req.body;
    if (!Array.isArray(keys) || keys.length === 0) {
      res.status(400).json({ success: false, error: 'keys 必须是非空数组' });
      return;
    }
    if (keys.length > 50) {
      res.status(400).json({ success: false, error: '单次最多导入50个秘钥' });
      return;
    }
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];
    for (const key of keys) {
      if (typeof key !== 'string' || key.trim().length < 10) {
        failCount++;
        errors.push(`秘钥格式无效: ${String(key).slice(0, 8)}...`);
        continue;
      }
      try {
        await axios.post(`${MEDIAGATEWAY_URL}/api/v1/admin/add-key`, null, {
          params: { key: key.trim() },
          timeout: 5000,
        });
        successCount++;
      } catch (e: any) {
        failCount++;
        errors.push(`添加失败: ${String(key).slice(0, 8)}... - ${e.message}`);
      }
    }
    mgLog('BATCH_ADD_KEYS', `success=${successCount} fail=${failCount}`, req.userId);
    res.json({ success: true, data: { successCount, failCount, errors } });
  } catch (error: any) {
    logger.error(`${MG_LOG_PREFIX} Batch add keys failed:`, error.message);
    res.status(500).json({ success: false, error: '批量导入失败' });
  }
});

adminMediaGatewayRouter.post('/delete-key', authenticate, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const enabled = await isMediaGatewayEnabled();
    if (!enabled) {
      res.status(403).json({ success: false, error: 'MediaGateway 已关闭，请先启用' });
      return;
    }
    const { idx } = req.body;
    if (typeof idx !== 'number' || idx < 0) {
      res.status(400).json({ success: false, error: 'idx 参数无效' });
      return;
    }
    const response = await axios.post(`${MEDIAGATEWAY_URL}/api/v1/admin/delete-key`, null, {
      params: { idx },
      timeout: 5000,
    });
    mgLog('DELETE_KEY', `Vidu key #${idx} deleted`, req.userId);
    res.json({ success: true, data: response.data });
  } catch (error: any) {
    logger.error(`${MG_LOG_PREFIX} Failed to delete key:`, error.message);
    res.status(500).json({ success: false, error: '删除失败' });
  }
});

adminMediaGatewayRouter.post('/doubao/set-key', authenticate, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const enabled = await isMediaGatewayEnabled();
    if (!enabled) {
      res.status(403).json({ success: false, error: 'MediaGateway 已关闭，请先启用' });
      return;
    }
    const { key } = req.body;
    if (!key || typeof key !== 'string' || key.trim().length < 10) {
      res.status(400).json({ success: false, error: '秘钥格式无效' });
      return;
    }
    await prisma.systemConfig.upsert({
      where: { key: MG_DOUBAO_KEY },
      update: { value: key.trim() },
      create: { key: MG_DOUBAO_KEY, value: key.trim(), description: 'MediaGateway 豆包秘钥' },
    });
    mgLog('SET_DOUBAO_KEY', '豆包秘钥已设置', req.userId);
    res.json({ success: true, data: { has_key: true } });
  } catch (error: any) {
    logger.error(`${MG_LOG_PREFIX} Failed to set doubao key:`, error.message);
    res.status(500).json({ success: false, error: '设置豆包秘钥失败' });
  }
});

adminMediaGatewayRouter.post('/doubao/delete-key', authenticate, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const enabled = await isMediaGatewayEnabled();
    if (!enabled) {
      res.status(403).json({ success: false, error: 'MediaGateway 已关闭，请先启用' });
      return;
    }
    await prisma.systemConfig.deleteMany({ where: { key: MG_DOUBAO_KEY } });
    mgLog('DELETE_DOUBAO_KEY', '豆包秘钥已删除', req.userId);
    res.json({ success: true, data: { has_key: false } });
  } catch (error: any) {
    logger.error(`${MG_LOG_PREFIX} Failed to delete doubao key:`, error.message);
    res.status(500).json({ success: false, error: '删除豆包秘钥失败' });
  }
});

adminMediaGatewayRouter.get('/health', authenticate, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const enabled = await isMediaGatewayEnabled();
    if (!enabled) {
      res.json({ success: true, data: { status: 'disabled', uptime: 0, version: '', viduKeys: 0, viduActive: 0, doubaoConfigured: false, timestamp: new Date().toISOString() } });
      return;
    }
    const response = await axios.get(`${MEDIAGATEWAY_URL}/health`, { timeout: 3000 });
    res.json({ success: true, data: { ...response.data, timestamp: new Date().toISOString() } });
  } catch (error: any) {
    logger.error(`${MG_LOG_PREFIX} Health check failed:`, error.message);
    res.json({ success: true, data: { status: 'offline', uptime: 0, version: '', viduKeys: 0, viduActive: 0, doubaoConfigured: false, timestamp: new Date().toISOString() } });
  }
});

adminMediaGatewayRouter.get('/stats', authenticate, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const enabled = await isMediaGatewayEnabled();
    if (!enabled) {
      res.json({
        success: true,
        data: {
          totalKeys: 0, activeKeys: 0, totalRequests: 0,
          successRate: 0, avgResponseTime: 0, totalFailures: 0,
          viduKeys: 0, viduActive: 0, doubaoKey: false,
          failureThreshold: 10, recoveryCooldown: 300,
        },
      });
      return;
    }
    const [statsResp, statusResp] = await Promise.allSettled([
      axios.get(`${MEDIAGATEWAY_URL}/api/v1/admin/stats`, { timeout: 5000 }),
      axios.get(`${MEDIAGATEWAY_URL}/api/v1/admin/status`, { timeout: 5000 }),
    ]);
    const pyStats = statsResp.status === 'fulfilled' ? statsResp.value.data : null;
    const pyStatus = statusResp.status === 'fulfilled' ? statusResp.value.data : null;
    const viduKeys = pyStatus?.vidu || [];
    const doubaoHasKey = await prisma.systemConfig
      .findUnique({ where: { key: MG_DOUBAO_KEY } })
      .then(c => !!c?.value)
      .catch(() => pyStatus?.doubao?.has_key || false);
    const viduActive = pyStats?.vidu_active ?? viduKeys.filter((k: any) => k.is_active).length;
    const totalActive = viduActive + (doubaoHasKey ? 1 : 0);
    const totalKeys = (pyStats?.vidu_keys ?? viduKeys.length) + (doubaoHasKey ? 1 : 0);
    const totalFailures = pyStats?.total_failures ?? viduKeys.reduce((sum: number, k: any) => sum + (k.failure_count || 0), 0);

    res.json({
      success: true,
      data: {
        totalKeys,
        activeKeys: totalActive,
        totalRequests: pyStats?.total_requests ?? 0,
        successRate: pyStats?.success_rate ?? (totalKeys > 0 ? Math.round(((totalKeys - viduKeys.filter((k: any) => !k.is_active).length) / totalKeys) * 100) : 0),
        avgResponseTime: pyStats?.avg_response_time ?? 0,
        totalFailures,
        viduKeys: pyStats?.vidu_keys ?? viduKeys.length,
        viduActive,
        doubaoKey: doubaoHasKey,
        failureThreshold: pyStats?.failure_threshold ?? 10,
        recoveryCooldown: pyStats?.recovery_cooldown ?? 300,
      },
    });
  } catch (error: any) {
    logger.error(`${MG_LOG_PREFIX} Stats failed:`, error.message);
    res.json({
      success: true,
      data: {
        totalKeys: 0, activeKeys: 0, totalRequests: 0,
        successRate: 0, avgResponseTime: 0, totalFailures: 0,
        viduKeys: 0, viduActive: 0, doubaoKey: false,
        failureThreshold: 10, recoveryCooldown: 300,
      },
    });
  }
});

adminMediaGatewayRouter.get('/logs', authenticate, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    res.json({ success: true, data: recentLogs.slice(0, limit) });
  } catch (error: any) {
    res.json({ success: true, data: [] });
  }
});

export default adminMediaGatewayRouter;
