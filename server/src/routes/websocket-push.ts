import { Router, Request, Response, NextFunction } from 'express';
import { websocketPushService } from '../services/websocket-push-service';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/stats', (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = websocketPushService.getConnectionStats();
    res.json({
      success: true,
      ...stats
    });
  } catch (error: unknown) {
    next(error); // COM-02 修复：使用 next(error) 走统一 errorHandler
  }
});

router.get('/online-users', (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = websocketPushService.getOnlineUsers();
    res.json({
      success: true,
      users,
      count: users.length
    });
  } catch (error: unknown) {
    next(error); // COM-02 修复
  }
});

router.post('/notify/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { type, data } = req.body;

    if (!type || !data) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段: type, data' // COM-03 修复：统一使用 error 字段
      });
    }

    const result = await websocketPushService.sendToUser(userId, {
      type,
      data,
      timestamp: new Date().toISOString(),
      userId
    });

    res.json({
      success: result,
      message: result ? '发送成功' : '用户不在线',
      sent: result
    });
  } catch (error: unknown) {
    next(error); // COM-02 修复
  }
});

router.post('/broadcast', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, data, excludeUserId } = req.body;

    if (!type || !data) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段: type, data' // COM-03 修复
      });
    }

    await websocketPushService.broadcast({
      type,
      data,
      timestamp: new Date().toISOString()
    }, excludeUserId);

    res.json({
      success: true,
      message: '广播发送成功'
    });
  } catch (error: unknown) {
    next(error); // COM-02 修复
  }
});

router.post('/broadcast-to-role', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, type, data } = req.body;

    if (!role || !type || !data) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段: role, type, data' // COM-03 修复
      });
    }

    await websocketPushService.broadcastToRole(role, {
      type,
      data,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `向角色 ${role} 广播发送成功`
    });
  } catch (error: unknown) {
    next(error); // COM-02 修复
  }
});

router.post('/notify-task-progress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, taskId, progress } = req.body;

    if (!userId || !taskId || progress === undefined) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段: userId, taskId, progress' // COM-03 修复
      });
    }

    await websocketPushService.notifyTaskProgress(userId, taskId, progress);

    res.json({
      success: true,
      message: '任务进度通知发送成功'
    });
  } catch (error: unknown) {
    next(error); // COM-02 修复
  }
});

router.post('/notify-quota-warning', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, usage, limit } = req.body;

    if (!userId || !usage || !limit) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段: userId, usage, limit' // COM-03 修复
      });
    }

    const percentage = Math.round((usage / limit) * 100);
    await websocketPushService.notifyQuotaWarning(userId, usage, limit, percentage);

    res.json({
      success: true,
      message: '配额警告通知发送成功',
      data: { usage, limit, percentage }
    });
  } catch (error: unknown) {
    next(error); // COM-02 修复
  }
});

router.post('/system-alert', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { level, message, details } = req.body;

    if (!level || !message) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段: level, message' // COM-03 修复
      });
    }

    await websocketPushService.notifySystemAlert({ level, message, details });

    res.json({
      success: true,
      message: '系统告警发送成功'
    });
  } catch (error: unknown) {
    next(error); // COM-02 修复
  }
});

export default router;
