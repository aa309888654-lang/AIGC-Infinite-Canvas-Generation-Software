/**
 * usePermission — 权限检查 Hook（存根）
 *
 * 登录与会员系统已移除，此文件保留空实现以维持编译兼容。
 */

import { useState, useCallback } from 'react';

export interface PermissionCheckResult {
  allowed: boolean;
  message?: string;
}

export function usePermission() {
  const [hasPermission] = useState(true);

  const checkPermission = useCallback((_permission: string): PermissionCheckResult => {
    return { allowed: true }; // 始终放行
  }, []);

  const requirePermission = useCallback((_permission: string): void => {
    // no-op: 始终放行
  }, []);

  return {
    hasPermission,
    checkPermission,
    requirePermission,
    isAdmin: false,
    permissions: {} as Record<string, boolean>,
  };
}