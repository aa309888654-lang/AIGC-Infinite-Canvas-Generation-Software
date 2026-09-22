/**
 * site-message-service — 站点消息服务（存根）
 *
 * 登录与会员系统已移除，此文件保留空实现以维持编译兼容。
 */

export interface SiteMessage {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'error' | 'success' | string;
  createdAt: string;
  read: boolean;
  [key: string]: any;
}

/** 获取公共站点消息 — 返回空数组 */
export async function fetchPublicSiteMessages(_options?: any): Promise<SiteMessage[]> {
  return [];
}

/** 标记消息已读 — no-op */
export async function markSiteMessageRead(_id: string): Promise<void> {
  // no-op
}

/** 标记所有消息已读 — no-op */
export async function markAllSiteMessagesRead(): Promise<void> {
  // no-op
}

/** 获取未读消息数 — 返回0 */
export function getUnreadSiteMessageCount(_messages?: any[]): number {
  return 0;
}

class SiteMessageService {
  async getMessages(): Promise<SiteMessage[]> {
    return [];
  }

  async markAsRead(_id: string): Promise<void> {
    // no-op
  }

  async markAllAsRead(): Promise<void> {
    // no-op
  }

  getUnreadCount(): number {
    return 0;
  }
}

export const siteMessageService = new SiteMessageService();