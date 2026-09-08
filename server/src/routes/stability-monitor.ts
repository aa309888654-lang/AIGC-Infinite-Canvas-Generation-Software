import { Router, Request, Response } from 'express';
import { backendStabilityMonitor } from '../services/backend-stability-monitor';
import { authenticate, requireAdmin } from '../middleware/auth';
import os from 'os';

const router = Router();

// 所有监控端点需要认证+管理员权限
router.use(authenticate, requireAdmin);

// 健康检查端点
router.get('/health', async (req: Request, res: Response) => {
  try {
    let metrics = backendStabilityMonitor.getMetrics();
    
    if (!metrics || !metrics.services || !metrics.services.database) {
      metrics = await backendStabilityMonitor.performHealthCheck();
    }
    
    const dbStatus = metrics.services?.database;
    const redisStatus = metrics.services?.redis;
    const minioStatus = metrics.services?.storage;
    
    // 只有数据库和Redis都是healthy时系统才healthy
    const isHealthy = dbStatus?.status === 'healthy' && redisStatus?.status === 'healthy';
    
    res.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      uptime: metrics.uptime || 0,
      checks: {
        database: dbStatus?.status === 'healthy' || false,
        redis: redisStatus?.status === 'healthy' || false,
        minio: minioStatus?.status === 'healthy' || false,
        loki: false,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('[Stability] Health error:', error);
    res.status(500).json({
      status: 'unhealthy',
      uptime: 0,
      checks: { database: false },
      timestamp: new Date().toISOString(),
    });
  }
});

// 稳定性统计端点
router.get('/stats', async (req: Request, res: Response) => {
  try {
    let metrics = backendStabilityMonitor.getMetrics();
    
    if (!metrics || !metrics.services) {
      metrics = await backendStabilityMonitor.performHealthCheck();
    }
    
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    res.json({
      success: true,
      data: {
        uptime: metrics.uptime || 0,
        memoryUsage: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          rss: memUsage.rss,
        },
        systemMemory: {
          total: totalMem,
          free: freeMem,
          used: totalMem - freeMem,
        },
        cpuUsage: os.loadavg()[0] * 100 / os.cpus().length,
        requestCount: metrics.requests?.total || 0,
        errorRate: metrics.requests?.errors || 0,
        avgResponseTime: metrics.requests?.avgResponseTime || 0,
      },
    });
  } catch (error: unknown) {
    console.error('[Stability] Stats error:', error);
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
    });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const metrics = backendStabilityMonitor.getMetrics();
    const serviceStatus = backendStabilityMonitor.getServiceStatus();
    
    res.json({
      success: true,
      data: {
        metrics,
        services: serviceStatus,
      },
    });
  } catch (error: unknown) {
    console.error('[Stability] Status error:', error);
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

router.get('/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const history = backendStabilityMonitor.getMetricsHistory(limit);
    
    res.json({
      success: true,
      data: history,
    });
  } catch (error: unknown) {
    console.error('[Stability] History error:', error);
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

router.get('/report', async (req: Request, res: Response) => {
  try {
    const report = await backendStabilityMonitor.getSystemReport();
    res.json({
      success: true,
      report,
    });
  } catch (error: unknown) {
    console.error('[Stability] Report error:', error);
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

router.post('/config', async (req: Request, res: Response) => {
  try {
    const { memoryThreshold, cpuThreshold, errorRateThreshold, responseTimeThreshold } = req.body;
    
    backendStabilityMonitor.updateAlertConfig({
      memoryThreshold,
      cpuThreshold,
      errorRateThreshold,
      responseTimeThreshold,
    });
    
    res.json({
      success: true,
      message: 'Alert config updated',
    });
  } catch (error: unknown) {
    console.error('[Stability] Config error:', error);
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

router.post('/check', async (req: Request, res: Response) => {
  try {
    const metrics = await backendStabilityMonitor.performHealthCheck();
    
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: unknown) {
    console.error('[Stability] Check error:', error);
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

router.get('/services', async (req: Request, res: Response) => {
  try {
    const services = backendStabilityMonitor.getServiceStatus();
    
    res.json({
      success: true,
      data: services,
    });
  } catch (error: unknown) {
    console.error('[Stability] Services error:', error);
    res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)) });
  }
});

export const stabilityMonitorRouter = router;
export default stabilityMonitorRouter;
