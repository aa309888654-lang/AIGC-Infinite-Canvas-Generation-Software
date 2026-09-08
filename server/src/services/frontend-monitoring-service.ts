import prisma from '../lib/prisma';
import { z } from 'zod';

const FrontendEventSchema = z.object({
  sessionId: z.string().optional(),
  eventType: z.string(),
  eventName: z.string(),
  category: z.string().optional(),
  label: z.string().optional(),
  value: z.number().optional(),
  metadata: z.record(z.any()).optional(),
  timestamp: z.number().optional(),
});

const FrontendErrorSchema = z.object({
  sessionId: z.string().optional(),
  errorType: z.string(),
  errorMessage: z.string(),
  stackTrace: z.string().optional(),
  source: z.string().optional(),
  lineNumber: z.number().optional(),
  columnNumber: z.number().optional(),
  metadata: z.record(z.any()).optional(),
  timestamp: z.number().optional(),
});

const FrontendMetricSchema = z.object({
  sessionId: z.string().optional(),
  metricName: z.string(),
  metricValue: z.number(),
  metricUnit: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  timestamp: z.number().optional(),
});

const FrontendPageViewSchema = z.object({
  sessionId: z.string().optional(),
  pageUrl: z.string(),
  pageTitle: z.string().optional(),
  referrer: z.string().optional(),
  utmParams: z.record(z.string()).optional(),
  timestamp: z.number().optional(),
});

const FrontendSessionSchema = z.object({
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  userAgent: z.string().optional(),
  screenWidth: z.number().optional(),
  screenHeight: z.number().optional(),
  viewportWidth: z.number().optional(),
  viewportHeight: z.number().optional(),
  deviceType: z.string().optional(),
  browserName: z.string().optional(),
  browserVersion: z.string().optional(),
  osName: z.string().optional(),
  osVersion: z.string().optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  ipAddress: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  duration: z.number().optional(),
  pageCount: z.number().optional(),
  eventCount: z.number().optional(),
  errorCount: z.number().optional(),
  isBounce: z.boolean().optional(),
  entryPage: z.string().optional(),
  exitPage: z.string().optional(),
  referrer: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
});

export class FrontendMonitoringService {
  async createOrUpdateSession(data: z.infer<typeof FrontendSessionSchema>) {
    const validatedData = FrontendSessionSchema.parse(data);
    const sessionId = validatedData.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const existingSession = await prisma.frontendSession.findFirst({
      where: { sessionId },
    });

    if (existingSession) {
      return await prisma.frontendSession.update({
        where: { id: existingSession.id },
        data: {
          endTime: validatedData.endTime ? new Date(validatedData.endTime) : new Date(),
          duration: validatedData.duration,
          pageCount: validatedData.pageCount,
          eventCount: validatedData.eventCount,
          errorCount: validatedData.errorCount,
        },
      });
    }

    return await prisma.frontendSession.create({
      data: {
        sessionId,
        userId: validatedData.userId || '',
        userAgent: validatedData.userAgent || '',
        screenWidth: validatedData.screenWidth,
        screenHeight: validatedData.screenHeight,
        viewportWidth: validatedData.viewportWidth,
        viewportHeight: validatedData.viewportHeight,
        deviceType: validatedData.deviceType,
        browserName: validatedData.browserName,
        browserVersion: validatedData.browserVersion,
        osName: validatedData.osName,
        osVersion: validatedData.osVersion,
        language: validatedData.language,
        timezone: validatedData.timezone,
        ipAddress: validatedData.ipAddress,
        country: validatedData.country,
        city: validatedData.city,
        startTime: validatedData.startTime ? new Date(validatedData.startTime) : new Date(),
        endTime: validatedData.endTime ? new Date(validatedData.endTime) : undefined,
        duration: validatedData.duration,
        pageCount: validatedData.pageCount,
        eventCount: validatedData.eventCount,
        errorCount: validatedData.errorCount,
        isBounce: validatedData.isBounce,
      },
    });
  }

  async trackEvent(data: z.infer<typeof FrontendEventSchema>) {
    const validatedData = FrontendEventSchema.parse(data);

    // 如果sessionId不存在，自动创建一个临时session
    let sessionId = validatedData.sessionId;
    if (!sessionId) {
      sessionId = `auto_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await prisma.frontendSession.create({
        data: {
          sessionId,
          userAgent: 'unknown',
        },
      });
    }

    const event = await prisma.frontendEvent.create({
      data: {
        sessionId,
        category: validatedData.category || validatedData.eventType,
        action: validatedData.eventName,
        label: validatedData.label,
        value: validatedData.value !== undefined ? String(validatedData.value) : undefined,
        timestamp: validatedData.timestamp ? new Date(validatedData.timestamp) : new Date(),
      },
    });

    await prisma.frontendSession.updateMany({
      where: { sessionId },
      data: { eventCount: { increment: 1 } },
    });

    return event;
  }

  async trackError(data: z.infer<typeof FrontendErrorSchema>) {
    const validatedData = FrontendErrorSchema.parse(data);

    // 如果sessionId不存在，自动创建一个临时session
    let sessionId = validatedData.sessionId;
    if (!sessionId) {
      sessionId = `auto_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await prisma.frontendSession.create({
        data: {
          sessionId,
          userAgent: 'unknown',
        },
      });
    }

    const error = await prisma.frontendError.create({
      data: {
        sessionId,
        errorType: validatedData.errorType,
        message: validatedData.errorMessage,
        stack: validatedData.stackTrace,
        url: validatedData.source,
        lineNo: validatedData.lineNumber,
        colNo: validatedData.columnNumber,
        userAgent: 'unknown',
        timestamp: validatedData.timestamp ? new Date(validatedData.timestamp) : new Date(),
      },
    });

    await prisma.frontendSession.updateMany({
      where: { sessionId },
      data: { errorCount: { increment: 1 } },
    });

    return error;
  }

  async recordMetric(data: z.infer<typeof FrontendMetricSchema>) {
    const validatedData = FrontendMetricSchema.parse(data);

    // 如果sessionId不存在，自动创建一个临时session
    let sessionId = validatedData.sessionId;
    if (!sessionId) {
      sessionId = `auto_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await prisma.frontendSession.create({
        data: {
          sessionId,
          userAgent: 'unknown',
        },
      });
    }

    return await prisma.frontendEvent.create({
      data: {
        sessionId,
        category: 'metric',
        action: validatedData.metricName,
        label: validatedData.metricUnit,
        value: String(validatedData.metricValue),
        timestamp: validatedData.timestamp ? new Date(validatedData.timestamp) : new Date(),
      },
    });
  }

  async trackPageView(data: z.infer<typeof FrontendPageViewSchema>) {
    const validatedData = FrontendPageViewSchema.parse(data);

    // 如果sessionId不存在，自动创建一个临时session
    let sessionId = validatedData.sessionId;
    if (!sessionId) {
      sessionId = `auto_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await prisma.frontendSession.create({
        data: {
          sessionId,
          userAgent: 'unknown',
        },
      });
    }

    const pageView = await prisma.frontendPageView.create({
      data: {
        sessionId,
        pageUrl: validatedData.pageUrl,
        pageTitle: validatedData.pageTitle,
        referrer: validatedData.referrer,
        timestamp: validatedData.timestamp ? new Date(validatedData.timestamp) : new Date(),
      },
    });

    await prisma.frontendSession.updateMany({
      where: { sessionId },
      data: { pageCount: { increment: 1 } },
    });

    return pageView;
  }

  async getDashboardStats(startDate?: Date, endDate?: Date, range?: string) {
    const dateFilter: any = {};
    const rangeFilter: any = {};
    
    if (range) {
      const now = new Date();
      switch (range) {
        case '1h':
          rangeFilter.gte = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          rangeFilter.gte = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          rangeFilter.gte = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
      }
    } else if (startDate || endDate) {
      if (startDate) dateFilter.gte = startDate;
      if (endDate) dateFilter.lte = endDate;
    }

    const finalFilter = Object.keys(rangeFilter).length > 0 ? rangeFilter : (Object.keys(dateFilter).length > 0 ? dateFilter : {});

    const [
      totalSessions,
      activeSessions,
      totalPageViews,
      totalEvents,
      totalErrors,
      recentErrors,
      topPages,
      deviceBreakdown,
      browserBreakdown,
      recentActivities,
      geoDistribution,
      performanceData,
    ] = await Promise.all([
      prisma.frontendSession.count({
        where: Object.keys(finalFilter).length > 0 ? { startTime: finalFilter } : {},
      }),
      prisma.frontendSession.count({
        where: {
          ...(Object.keys(finalFilter).length > 0 ? { startTime: finalFilter } : {}),
          endTime: null,
        },
      }),
      prisma.frontendPageView.count({
        where: Object.keys(finalFilter).length > 0 ? { timestamp: finalFilter } : {},
      }),
      prisma.frontendEvent.count({
        where: Object.keys(finalFilter).length > 0 ? { timestamp: finalFilter } : {},
      }),
      prisma.frontendError.count({
        where: Object.keys(finalFilter).length > 0 ? { timestamp: finalFilter } : {},
      }),
      prisma.frontendError.findMany({
        where: Object.keys(finalFilter).length > 0 ? { timestamp: finalFilter } : {},
        orderBy: { timestamp: 'desc' },
        take: 10,
      }),
      prisma.frontendPageView.groupBy({
        by: ['pageUrl'],
        _count: { pageUrl: true },
        orderBy: { _count: { pageUrl: 'desc' } },
        take: 10,
      }),
      prisma.frontendSession.groupBy({
        by: ['deviceType'],
        _count: { deviceType: true },
      }),
      prisma.frontendSession.groupBy({
        by: ['browserName'],
        _count: { browserName: true },
        orderBy: { _count: { browserName: 'desc' } },
        take: 10,
      }),
      this.getRecentActivities(finalFilter),
      this.getGeoDistribution(finalFilter),
      this.getPerformanceTimeSeriesData(finalFilter, range || '1h'),
    ]);

    return {
      totalSessions,
      activeSessions,
      totalPageViews,
      totalEvents,
      totalErrors,
      errorRate: totalPageViews > 0 ? ((totalErrors / totalPageViews) * 100).toFixed(2) : '0.00',
      recentErrors: recentErrors.map((e) => ({
        errorType: e.errorType,
        errorMessage: e.message,
        timestamp: e.timestamp,
        sessionId: e.sessionId,
      })),
      topPages: topPages.map((p) => ({
        pageUrl: p.pageUrl,
        views: p._count.pageUrl,
      })),
      deviceBreakdown: deviceBreakdown.map((d) => ({
        deviceType: d.deviceType || 'unknown',
        count: d._count.deviceType,
      })),
      browserBreakdown: browserBreakdown.map((b) => ({
        browserName: b.browserName || 'unknown',
        count: b._count.browserName,
      })),
      recentActivities,
      geoDistribution,
      performanceData,
      deviceStats: this.calculateDeviceStats(deviceBreakdown),
    };
  }

  private async getRecentActivities(filter: any): Promise<any[]> {
    const [pageViews, events] = await Promise.all([
      prisma.frontendPageView.findMany({
        where: Object.keys(filter).length > 0 ? { timestamp: filter } : {},
        orderBy: { timestamp: 'desc' },
        take: 15,
        select: {
          pageUrl: true,
          timestamp: true,
          sessionId: true,
        },
      }),
      prisma.frontendEvent.findMany({
        where: Object.keys(filter).length > 0 ? { timestamp: filter } : {},
        orderBy: { timestamp: 'desc' },
        take: 10,
        select: {
          category: true,
          action: true,
          timestamp: true,
          sessionId: true,
        },
      }),
    ]);

    const activities: any[] = [];

    pageViews.forEach((pv) => {
      activities.push({
        type: 'page_view',
        detail: `访问页面: ${pv.pageUrl}`,
        timestamp: pv.timestamp,
        sessionId: pv.sessionId,
      });
    });

    events.forEach((e) => {
      activities.push({
        type: e.category,
        detail: e.action,
        timestamp: e.timestamp,
        sessionId: e.sessionId,
      });
    });

    return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 20);
  }

  private async getGeoDistribution(filter: any): Promise<any[]> {
    const sessions = await prisma.frontendSession.groupBy({
      by: ['country'],
      _count: { country: true },
      where: Object.keys(filter).length > 0 ? { startTime: filter } : {},
      orderBy: { _count: { country: 'desc' } },
      take: 10,
    });

    return sessions.map((s) => ({
      country: s.country || 'Unknown',
      count: s._count.country,
    }));
  }

  private async getPerformanceTimeSeriesData(filter: any, range: string): Promise<any[]> {
    let interval: number;
    let dataPoints: number;

    switch (range) {
      case '1h':
        interval = 5 * 60 * 1000;
        dataPoints = 12;
        break;
      case '24h':
        interval = 2 * 60 * 60 * 1000;
        dataPoints = 12;
        break;
      case '7d':
        interval = 14 * 60 * 60 * 1000;
        dataPoints = 12;
        break;
      default:
        interval = 5 * 60 * 1000;
        dataPoints = 12;
    }

    const now = Date.now();
    const data: any[] = [];

    for (let i = 0; i < dataPoints; i++) {
      const start = now - (dataPoints - i) * interval;
      const end = start + interval;
      const startDate = new Date(start);
      const endDate = new Date(end);

      const [pageViews, events, errors] = await Promise.all([
        prisma.frontendPageView.count({
          where: {
            timestamp: {
              gte: startDate,
              lt: endDate,
            },
          },
        }),
        prisma.frontendEvent.count({
          where: {
            timestamp: {
              gte: startDate,
              lt: endDate,
            },
          },
        }),
        prisma.frontendError.count({
          where: {
            timestamp: {
              gte: startDate,
              lt: endDate,
            },
          },
        }),
      ]);

      data.push({
        timestamp: start,
        value: pageViews + events,
        pageViews,
        events,
        errors,
      });
    }

    return data;
  }

  private calculateDeviceStats(deviceBreakdown: any[]): { desktop: number; mobile: number; tablet: number } {
    const stats = { desktop: 0, mobile: 0, tablet: 0 };
    
    deviceBreakdown.forEach((d) => {
      const type = (d.deviceType || 'unknown').toLowerCase();
      if (type.includes('mobile') || type.includes('phone')) {
        stats.mobile += d._count.deviceType;
      } else if (type.includes('tablet') || type.includes('pad')) {
        stats.tablet += d._count.deviceType;
      } else {
        stats.desktop += d._count.deviceType;
      }
    });

    return stats;
  }

  async getSessionDetails(sessionId: string) {
    const [session, events, errors, pageViews] = await Promise.all([
      prisma.frontendSession.findFirst({ where: { sessionId } }),
      prisma.frontendEvent.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' },
      }),
      prisma.frontendError.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' },
      }),
      prisma.frontendPageView.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' },
      }),
    ]);

    const metrics = events.filter((event) => event.category === 'metric');

    return {
      session,
      events,
      errors,
      pageViews,
      metrics: metrics.map((m) => ({
        metricName: m.action,
        metricValue: Number(m.value || 0),
        metricUnit: m.label,
        timestamp: m.timestamp,
        sessionId: m.sessionId,
      })),
    };
  }

  async getPerformanceMetrics(startDate?: Date, endDate?: Date) {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const metrics = await prisma.frontendEvent.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 ? { timestamp: dateFilter } : {}),
        category: 'metric',
      },
      orderBy: { timestamp: 'desc' },
    });

    const groupedMetrics: Record<string, number[]> = {};
    metrics.forEach((m) => {
      const metricName = m.action;
      const metricValue = Number(m.value || 0);

      if (!groupedMetrics[metricName]) {
        groupedMetrics[metricName] = [];
      }
      groupedMetrics[metricName].push(metricValue);
    });

    const aggregatedMetrics: any[] = [];
    for (const [name, values] of Object.entries(groupedMetrics)) {
      const sorted = values.sort((a, b) => a - b);
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
      const p90 = sorted[Math.floor(sorted.length * 0.9)] || 0;
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
      const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

      aggregatedMetrics.push({
        metricName: name,
        avg: Number(avg.toFixed(2)),
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p50,
        p90,
        p95,
        p99,
        count: values.length,
      });
    }

    return aggregatedMetrics;
  }

  async getUserSessions(userId: string, page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;

    const [sessions, total] = await Promise.all([
      prisma.frontendSession.findMany({
        where: { userId },
        orderBy: { startTime: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.frontendSession.count({ where: { userId } }),
    ]);

    return {
      sessions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getEventAnalytics(
    startDate?: Date,
    endDate?: Date,
    groupBy: 'eventType' | 'eventName' | 'category' = 'eventType'
  ) {
    const prismaGroupBy: 'category' | 'action' =
      groupBy === 'eventName' ? 'action' : 'category';
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const events = await prisma.frontendEvent.groupBy({
      by: [prismaGroupBy],
      _count: { [prismaGroupBy]: true },
      where: Object.keys(dateFilter).length > 0 ? { timestamp: dateFilter } : {},
      orderBy: { _count: { [prismaGroupBy]: 'desc' } },
      take: 50,
    });

    return events.map((e) => ({
      [groupBy]: e[prismaGroupBy],
      count: e._count[prismaGroupBy],
    }));
  }

  async getErrorAnalytics(startDate?: Date, endDate?: Date) {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const [totalErrors, errorsByType, recentErrors, criticalErrors] = await Promise.all([
      prisma.frontendError.count({
        where: Object.keys(dateFilter).length > 0 ? { timestamp: dateFilter } : {},
      }),
      prisma.frontendError.groupBy({
        by: ['errorType'],
        _count: { errorType: true },
        where: Object.keys(dateFilter).length > 0 ? { timestamp: dateFilter } : {},
        orderBy: { _count: { errorType: 'desc' } },
      }),
      prisma.frontendError.findMany({
        where: Object.keys(dateFilter).length > 0 ? { timestamp: dateFilter } : {},
        orderBy: { timestamp: 'desc' },
        take: 20,
      }),
      prisma.frontendError.findMany({
        where: {
          ...(Object.keys(dateFilter).length > 0 ? { timestamp: dateFilter } : {}),
          OR: [
            { errorType: { contains: 'ReferenceError' } },
            { errorType: { contains: 'TypeError' } },
            { errorType: { contains: 'SyntaxError' } },
            { errorType: { contains: 'Error' } },
          ],
        },
        take: 10,
      }),
    ]);

    return {
      totalErrors,
      errorsByType: errorsByType.map((e) => ({
        errorType: e.errorType,
        count: e._count.errorType,
        percentage: ((e._count.errorType / totalErrors) * 100).toFixed(2),
      })),
      recentErrors,
      criticalErrors,
    };
  }
}

export const frontendMonitoringService = new FrontendMonitoringService();
