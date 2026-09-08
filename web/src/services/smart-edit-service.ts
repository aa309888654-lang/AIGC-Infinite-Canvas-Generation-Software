/**
 * smart-edit-service — 智能编辑服务（存根）
 *
 * AI剪辑板块已移除，此文件保留空实现以维持编译兼容。
 */

export class SmartEditService {
  async suggestEdits(_mediaUrl: string, _options?: any): Promise<any[]> {
    return [];
  }

  async applyEdit(_editId: string): Promise<boolean> {
    return false;
  }
}

export const smartEditService = new SmartEditService();