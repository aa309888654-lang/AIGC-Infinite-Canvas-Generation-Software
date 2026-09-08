import express, { Request, Response, NextFunction } from 'express';
import { frontendMonitoringService } from '../services/frontend-monitoring-service';

const router = express.Router();

// SEC-AUDIT 修复：仅精简根路由返回，避免监控端点目录泄露
// 注意：子路由（session/event/error/pageview/config 等）必须保持公开，
// 因为前端监控上报组件会在未登录页面（如登录页）调用这些接口，加认证会导致监控数据丢失
router.get('/', (_req, res) => {
  res.json({
    success: true,
  });
});

router.post('/session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await frontendMonitoringService.createOrUpdateSession(req.body);
    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        id: session.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/event', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await frontendMonitoringService.trackEvent(req.body);
    res.json({
      success: true,
      data: { id: event.id },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/events/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const events = req.body.events || [];
    const results = [];

    for (const eventData of events) {
      try {
        const event = await frontendMonitoringService.trackEvent(eventData);
        results.push({ success: true, id: event.id });
      } catch (err) {
        results.push({ success: false, error: (err as Error).message });
      }
    }

    res.json({
      success: true,
      data: { results },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/error', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const error = await frontendMonitoringService.trackError(req.body);
    res.json({
      success: true,
      data: { id: error.id },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/errors/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = req.body.errors || [];
    const results = [];

    for (const errorData of errors) {
      try {
        const error = await frontendMonitoringService.trackError(errorData);
        results.push({ success: true, id: error.id });
      } catch (err) {
        results.push({ success: false, error: (err as Error).message });
      }
    }

    res.json({
      success: true,
      data: { results },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/metric', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metric = await frontendMonitoringService.recordMetric(req.body);
    res.json({
      success: true,
      data: { id: metric.id },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/metrics/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = req.body.metrics || [];
    const results = [];

    for (const metricData of metrics) {
      try {
        const metric = await frontendMonitoringService.recordMetric(metricData);
        results.push({ success: true, id: metric.id });
      } catch (err) {
        results.push({ success: false, error: (err as Error).message });
      }
    }

    res.json({
      success: true,
      data: { results },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/pageview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pageView = await frontendMonitoringService.trackPageView(req.body);
    res.json({
      success: true,
      data: { id: pageView.id },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/config', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      enabled: true,
      sampleRate: process.env.FRONTEND_MONITOR_SAMPLE_RATE || '1.0',
      endpoint: '/api/v1/monitor',
      sessionTimeout: 1800000,
      heartbeatInterval: 30000,
    },
  });
});

export const frontendMonitoringRouter = router;
