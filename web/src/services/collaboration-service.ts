/**
 * collaboration-service — 协作服务（存根）
 *
 * AI剪辑板块已移除，此文件保留空实现以维持编译兼容。
 */

class CollaborationService {
  connect(): void {
    // no-op: 协作服务已移除
  }

  disconnect(): void {
    // no-op
  }

  isConnected(): boolean {
    return false;
  }

  async getProjects(): Promise<any[]> {
    return [];
  }

  async saveVersion(_projectId?: string, _name?: string, _tags?: string[]): Promise<void> {
    // no-op
  }
}

export const collaborationService = new CollaborationService();