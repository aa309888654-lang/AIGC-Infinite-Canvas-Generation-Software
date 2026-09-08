/**
 * useMembershipStore — 会员状态管理（存根）
 *
 * 登录与会员系统已移除，此文件保留空实现以维持编译兼容。
 * 所有会员相关功能均返回默认/免费版行为。
 */

import { create } from 'zustand';

// === 类型定义 ===
export type MembershipLevel = 'trial' | 'free' | 'basic' | 'pro' | 'vip' | 'premium' | 'enterprise';

export interface MembershipInfo {
  isLoggedIn: boolean;
  membershipLevel: MembershipLevel;
  membershipDisplayName: string;
  storageLimit: number;
  storageUsed: number;
  username: string;
  userId?: string;
  email?: string;
  nickname?: string;
  avatarUrl?: string;
  expiresAt?: string | null;
}

interface MembershipState {
  membership: MembershipInfo | null;
  isLoading: boolean;
  error: string | null;
  refreshMembership: () => Promise<void>;
  clearMembership: () => void;
  openLoginModal: (_reason?: string) => void;
}

const defaultMembership: MembershipInfo = {
  isLoggedIn: false,
  membershipLevel: 'trial',
  membershipDisplayName: '体验版',
  storageLimit: 100 * 1024 * 1024, // 100MB
  storageUsed: 0,
  username: '',
};

export const useMembershipStore = create<MembershipState>()((set) => ({
  membership: defaultMembership,
  isLoading: false,
  error: null,
  refreshMembership: async () => {
    // no-op: 会员系统已移除
    set({ isLoading: false });
  },
  clearMembership: () => {
    set({ membership: defaultMembership, isLoading: false, error: null });
  },
  openLoginModal: (_reason?: string) => {
    // no-op: 登录系统已移除
  },
}));

// === 会员辅助函数（存根） ===

/** 获取会员等级显示名 */
export function getTierDisplayName(level?: string | null): string {
  const names: Record<string, string> = {
    trial: '体验版',
    free: '免费版',
    basic: '基础版',
    pro: '专业版',
    enterprise: '企业版',
  };
  return names[level || 'trial'] || '体验版';
}

/** 检查是否可使用某功能 — 始终返回 true（无限制） */
export function canUseFeature(_feature: string): boolean {
  return true;
}

/** 获取会员等级图标 */
export function getMembershipLevelIcon(_level?: string | null): string {
  return '🆓';
}

/** 获取会员等级名称 */
export function getMembershipLevelName(level?: string | null, displayName?: string | null): string {
  if (displayName) return displayName;
  return getTierDisplayName(level);
}

/** 检查是否可访问专业工作室功能 — 始终返回 false */
export function canAccessProStudioFeature(_feature: string): boolean {
  return false;
}

/** 派发专业功能被拒绝事件 */
export function dispatchProFeatureDenied(_feature: string): void {
  // no-op: 会员系统已移除
}

/** 检查图片提供商是否对会员等级隐藏 — 始终不隐藏 */
export function isImageProviderHiddenForMembership(_provider: string | undefined, _level: string): boolean {
  return false;
}

/** 检查图片模型是否对会员等级隐藏 — 始终不隐藏 */
export function isImageModelHiddenForMembership(_modelId: string, _provider: string | undefined, _level: string): boolean {
  return false;
}

/** 获取会员隐藏的视频模型 ID 集合 — 始终为空 */
export function getMembershipHiddenVideoModelIds(_level: string, _models: any[]): Set<string> {
  return new Set();
}

/** 合并图片模型预设（按会员等级过滤） — 原样返回 */
export function mergeImageModelPresets<T>(presets: T[], _level?: string): T[] {
  return presets;
}