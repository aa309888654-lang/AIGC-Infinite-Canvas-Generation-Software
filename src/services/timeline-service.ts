/**
 * timeline-service — 时间轴服务（存根）
 *
 * AI剪辑板块已移除，此文件保留空实现以维持编译兼容。
 */

export class TimelineService {
  async createTimeline(_options?: any): Promise<any> {
    return null;
  }

  async getTimeline(_id: string): Promise<any> {
    return null;
  }
}

export const timelineService = new TimelineService();