import { Router, Request, Response } from 'express';
import { loggingService } from '../services/logging-service';
import { quotaService } from '../services/quota-service';
import { authenticate, requireAdmin } from '../middleware/auth';
import { formatBytes } from '../utils/format';
import { metricsService } from '../services/metrics-service';
import prisma from '../lib/prisma';
const router = Router();

// SEC-AUDIT 修复：根路由加 authenticate + requireAdmin，避免管理端监控端点结构泄露
// 安全最佳实践：监控接口属于管理功能，根路由不应公开返回端点列表
router.get('/', authenticate, requireAdmin, (req, res) => {
  res.json({
    success: true,
    message: 'Monitoring API',
    endpoints: {
      stats: 'GET /api/monitoring/stats (admin)',
      logs: 'GET /api/monitoring/logs (admin)',
      logsErrors: 'GET /api/monitoring/logs/errors (admin)',
      logsUser: 'GET /api/monitoring/logs/user/:userId (admin)',
      prometheus: 'GET /api/monitoring/prometheus',
      health: 'GET /api/monitoring/health',
    },
  });
});

router.get('/stats', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const [
      userCount,
      taskCount,
      paymentStats,
      quotaReport
    ] = await Promise.all([
      prisma.user.count(),
      prisma.task.count(),
      prisma.payment.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { amount: true },
        _count: true
      }),
      quotaService.getQuotaUsageReport()
    ]);

    res.json({
      success: true,
      stats: {
        users: userCount,
        tasks: taskCount,
        totalRevenue: paymentStats._sum.amount || 0,
        totalPayments: paymentStats._count,
        storage: {
          used: quotaReport.totalStorageUsed,
          usedFormatted: formatBytes(quotaReport.totalStorageUsed)
        },
        files: quotaReport.totalFiles,
        apiCalls: quotaReport.totalApiCalls
      }
    });
  } catch (error: unknown) {
    console.error('[Monitor] Stats error:', error);
    res.status(500).json({ success: false, message: (error instanceof Error ? error.message : String(error)) });
  }
});

router.get('/logs', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const count = parseInt(req.query.count as string) || 100;
    const level = req.query.level as string;

    const logs = await loggingService.getRecentLogs(count, level);

    res.json({ success: true, logs });
  } catch (error: unknown) {
    console.error('[Monitor] Logs error:', error);
    res.status(500).json({ success: false, message: (error instanceof Error ? error.message : String(error)) });
  }
});

router.get('/logs/errors', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await loggingService.getErrorStats();

    res.json({ success: true, ...stats });
  } catch (error: unknown) {
    console.error('[Monitor] Error stats error:', error);
    res.status(500).json({ success: false, message: (error instanceof Error ? error.message : String(error)) });
  }
});

router.get('/logs/user/:userId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const count = parseInt(req.query.count as string) || 100;

    const logs = await loggingService.getLogsByUser(userId, count);

    res.json({ success: true, logs });
  } catch (error: unknown) {
    console.error('[Monitor] User logs error:', error);
    res.status(500).json({ success: false, message: (error instanceof Error ? error.message : String(error)) });
  }
});

// SEC-AUDIT 修复：/prometheus 端点添加 Bearer Token 认证，与 /metrics 保持一致
// 认证方式：?token=xxx 查询参数 或 Authorization: Bearer xxx 请求头
// Token 通过环境变量 METRICS_TOKEN 配置；未配置时返回 403 拒绝访问
router.get('/prometheus', async (req: Request, res: Response) => {
  const expectedToken = process.env.METRICS_TOKEN;
  if (!expectedToken) {
    res.status(403).send('# Metrics endpoint disabled (METRICS_TOKEN not configured)');
    return;
  }
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  if (bearerToken !== expectedToken && queryToken !== expectedToken) {
    res.status(401).send('# Unauthorized');
    return;
  }
  try {
    const metrics = await metricsService.metrics();
    res.set('Content-Type', metricsService.getContentType());
    res.send(metrics);
  } catch (error: unknown) {
    console.error('[Monitor] Prometheus error:', error);
    res.status(500).send('# Error collecting metrics');
  }
});

router.get('/health', async (req: Request, res: Response) => {
  try {
    const [userCount, taskCount] = await Promise.all([
      prisma.user.count(),
      prisma.task.count()
    ]);

    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: {
        database: true,
        minio: await checkMinioHealth(),
        loki: await checkLokiHealth()
      },
      stats: {
        users: userCount,
        tasks: taskCount
      }
    });
  } catch (error: unknown) {
    res.status(503).json({
      status: 'unhealthy',
      error: (error instanceof Error ? error.message : String(error))
    });
  }
});

async function checkMinioHealth(): Promise<boolean> {
  try {
    const { minioService } = await import('../services/minio-service');
    return minioService.isAvailable();
  } catch {
    return false;
  }
}

async function checkLokiHealth(): Promise<boolean> {
  const lokiHost = process.env.LOKI_HOST || 'localhost';
  try {
    const response = await fetch(`http://${lokiHost}:3100/ready`);
    return response.ok;
  } catch {
    return false;
  }
}

export default router;
