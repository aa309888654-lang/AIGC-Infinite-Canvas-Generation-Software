import { Router } from 'express';
import { loggingService } from '../services/logging-service';
import { authenticate, requireAdmin } from '../middleware/auth';
import { parsePaginationParams } from '../utils/pagination';

export const logsRouter = Router();

logsRouter.use(authenticate);

logsRouter.get('/payment', requireAdmin, async (req, res) => {
  try {
    const { userId, status, startDate, endDate } = req.query;
    const pagination = parsePaginationParams(req);

    const result = await loggingService.getPaymentLogs({
      userId: userId as string,
      status: status as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: pagination.page,
      limit: pagination.limit,
    });

    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
    });
  }
});

logsRouter.get('/login', requireAdmin, async (req, res) => {
  try {
    const { userId, loginResult, startDate, endDate, page, limit } = req.query;

    const result = await loggingService.getLoginLogs({
      userId: userId as string,
      loginResult: loginResult as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
    });
  }
});

logsRouter.get('/usage', requireAdmin, async (req, res) => {
  try {
    const { userId, action, actionType, startDate, endDate, page, limit } = req.query;

    const result = await loggingService.getUsageLogs({
      userId: userId as string,
      action: action as string,
      actionType: actionType as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
    });
  }
});

logsRouter.get('/stats', requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [paymentStats, loginStats, usageStats] = await Promise.all([
      loggingService.getPaymentLogs({ startDate: today }),
      loggingService.getLoginLogs({ startDate: today }),
      loggingService.getUsageLogs({ startDate: today }),
    ]);

    const paymentAmount = paymentStats.logs
      .filter((log: any) => log.status === 'completed')
      .reduce((sum: number, log: any) => sum + log.amount, 0);

    const failedLogins = loginStats.logs.filter((log: any) => log.loginResult === 'failed').length;

    res.json({
      success: true,
      data: {
        today: {
          payments: paymentStats.pagination.total,
          paymentAmount,
          logins: loginStats.pagination.total,
          failedLogins,
          usageEvents: usageStats.pagination.total,
        },
      },
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
    });
  }
});

logsRouter.get('/verify-integrity', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const result = await loggingService.verifyLogIntegrity({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
    });
  }
});

logsRouter.get('/export/payment', requireAdmin, async (req, res) => {
  try {
    const { userId, status, startDate, endDate } = req.query;

    const result = await loggingService.getPaymentLogs({
      userId: userId as string,
      status: status as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: 1,
      limit: 10000,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=payment-logs.csv');

    const csv = [
      'Order No,User,Amount,Currency,Payment Method,Status,Transaction ID,Created At',
      ...result.logs.map((log: any) =>
        `${log.orderNo},${log.user?.username || 'N/A'},${log.amount},${log.currency},${log.paymentMethod},${log.status},${log.transactionId || ''},${log.createdAt.toISOString()}`
      ),
    ].join('\n');

    res.send(csv);
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
    });
  }
});

logsRouter.get('/export/login', requireAdmin, async (req, res) => {
  try {
    const { userId, loginResult, startDate, endDate } = req.query;

    const result = await loggingService.getLoginLogs({
      userId: userId as string,
      loginResult: loginResult as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: 1,
      limit: 10000,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=login-logs.csv');

    const csv = [
      'Username,IP Address,Device,Result,Failure Reason,Created At',
      ...result.logs.map((log: any) =>
        `${log.username},${log.ipAddress},${log.deviceInfo || ''},${log.loginResult},${log.failureReason || ''},${log.createdAt.toISOString()}`
      ),
    ].join('\n');

    res.send(csv);
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
    });
  }
});

logsRouter.get('/export/usage', requireAdmin, async (req, res) => {
  try {
    const { userId, action, actionType, startDate, endDate } = req.query;

    const result = await loggingService.getUsageLogs({
      userId: userId as string,
      action: action as string,
      actionType: actionType as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: 1,
      limit: 10000,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=usage-logs.csv');

    const csv = [
      'User,Action,Type,Source,Duration,Created At',
      ...result.logs.map((log: any) =>
        `${log.userId},${log.action},${log.actionType},${log.source},${log.duration || ''},${log.createdAt.toISOString()}`
      ),
    ].join('\n');

    res.send(csv);
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
    });
  }
});
