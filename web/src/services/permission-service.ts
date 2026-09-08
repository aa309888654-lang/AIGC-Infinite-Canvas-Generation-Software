/**
 * permission-service — 权限服务（存根）
 *
 * 登录与会员系统已移除，此文件保留空实现以维持编译兼容。
 */

export interface PermissionCheckResult {
  allowed: boolean;
  message?: string;
}

class PermissionService {
  /** 检查权限 — 始终返回 true（无权限限制） */
  hasPermission(_permission: string): boolean {
    return true;
  }

  /** 检查权限（异步版） — 始终返回允许 */
  async checkPermission(_feature: string, _count?: number, _options?: any): Promise<PermissionCheckResult> {
    return { allowed: true, message: '' };
  }

  /** 检查管理员权限 — 始终返回 false */
  isAdmin(): boolean {
    return false;
  }

  /** 获取权限列表 — 返回空数组 */
  getPermissions(): string[] {
    return [];
  }

  /** 获取用户权限 — 返回空对象 */
  getUserPermissions(): Record<string, boolean> {
    return {};
  }

  /** 检查功能访问 — 始终返回 true */
  canAccess(_feature: string): boolean {
    return true;
  }

  /** 要求权限 — no-op */
  requirePermission(_permission: string): void {
    // no-op
  }

  /** 权限列表属性 */
  permissions: Record<string, boolean> = {};
}

export const permissionService = new PermissionService();