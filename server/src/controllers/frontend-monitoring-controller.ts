import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { frontendMonitoringService } from '../services/frontend-monitoring-service';

export class FrontendMonitoringController {
  async getDashboardStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, range } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      const rangeParam = range as string | undefined;

      const stats = await frontendMonitoringService.getDashboardStats(start, end, rangeParam);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  async getSessionDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;

      const details = await frontendMonitoringService.getSessionDetails(sessionId);

      res.json({
        success: true,
        data: details,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPerformanceMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const metrics = await frontendMonitoringService.getPerformanceMetrics(start, end);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = await frontendMonitoringService.getUserSessions(userId, page, pageSize);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getEventAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, groupBy } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      const group = (groupBy as 'eventType' | 'eventName' | 'category') || 'eventType';

      const analytics = await frontendMonitoringService.getEventAnalytics(start, end, group);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  }

  async getErrorAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const analytics = await frontendMonitoringService.getErrorAnalytics(start, end);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRecentSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const skip = (page - 1) * pageSize;

      const [sessions, total] = await Promise.all([
        prisma.frontendSession.findMany({
          orderBy: { startTime: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.frontendSession.count(),
      ]);

      res.json({
        success: true,
        data: {
          sessions,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllErrors(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const { errorType, startDate, endDate } = req.query;

      const skip = (page - 1) * pageSize;

      const where: any = {};
      if (errorType) where.errorType = errorType;
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = new Date(startDate as string);
        if (endDate) where.timestamp.lte = new Date(endDate as string);
      }

      const [errors, total] = await Promise.all([
        prisma.frontendError.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.frontendError.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          errors: errors.map((e: any) => ({
            ...e,
            metadata: JSON.parse(e.metadata || '{}'),
          })),
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getRealtimeStats(req: Request, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      const [
        activeSessionsLastHour,
        activeSessionsLast5Min,
        errorsLastHour,
        errorsLast5Min,
        pageViewsLastHour,
        pageViewsLast5Min,
      ] = await Promise.all([
        prisma.frontendSession.count({
          where: { startTime: { gte: oneHourAgo } },
        }),
        prisma.frontendSession.count({
          where: { startTime: { gte: fiveMinutesAgo } },
        }),
        prisma.frontendError.count({
          where: { timestamp: { gte: oneHourAgo } },
        }),
        prisma.frontendError.count({
          where: { timestamp: { gte: fiveMinutesAgo } },
        }),
        prisma.frontendPageView.count({
          where: { timestamp: { gte: oneHourAgo } },
        }),
        prisma.frontendPageView.count({
          where: { timestamp: { gte: fiveMinutesAgo } },
        }),
      ]);

      res.json({
        success: true,
        data: {
          activeSessionsLastHour,
          activeSessionsLast5Min,
          errorsLastHour,
          errorsLast5Min,
          pageViewsLastHour,
          pageViewsLast5Min,
          timestamp: now.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const frontendMonitoringController = new FrontendMonitoringController();
