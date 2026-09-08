import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  CalendarCheck2,
  Check,
  CheckCheck,
  Clock3,
  Gift,
  Globe2,
  Mail,
  MailCheck,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import { getAuthToken, clearAuthToken } from '@/lib/auth-check';
import { API_BASE_URL } from '@/lib/api-config';
import { apiClient } from '@/lib/api-client';
import { useDeviceDetection } from '@/components/mobile/DeviceDetection';
import {
  NOTIFICATION_CENTER_DAILY_CHECKIN_REWARDS,
  NOTIFICATION_CENTER_REGISTRATION_BONUS,
} from '@/config/notification-templates';
import {
  NOTIFICATION_AUTO_OPEN_STORAGE_KEY,
  shouldAutoOpenNotifications,
} from './notification-auto-open';

const bellShakeKeyframes = `
@keyframes bellShake {
  0%, 100% { transform: rotate(0deg); }
  10% { transform: rotate(14deg); }
  20% { transform: rotate(-12deg); }
  30% { transform: rotate(10deg); }
  40% { transform: rotate(-8deg); }
  50% { transform: rotate(6deg); }
  60% { transform: rotate(-4deg); }
  70% { transform: rotate(2deg); }
  80% { transform: rotate(-1deg); }
  90% { transform: rotate(0deg); }
}
`;

interface UserNotification {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  priority: string;
  createdAt: string;
}

const typeConfig: Record<string, { label: string; color: string; textColor: string; icon: React.ElementType }> = {
  system: { label: '系统', color: '#0284C7', textColor: '#075985', icon: AlertCircle },
  task: { label: '任务', color: '#7E22CE', textColor: '#581C87', icon: Bell },
  payment: { label: '支付', color: '#059669', textColor: '#065F46', icon: Gift },
  membership: { label: '会员', color: '#D97706', textColor: '#92400E', icon: Check },
  promotion: { label: '推广', color: '#DB2777', textColor: '#9D174D', icon: Mail },
};

/** 通知铃铛只显示在网页首页，进入无线画布不显示。 */
function shouldShowNotificationCenter(pathname: string, isMobile: boolean): boolean {
  const onCanvas = pathname === '/1' || pathname === '/1/';
  const onAiView = pathname.startsWith('/ai-view');
  return !isMobile && !onCanvas && !onAiView;
}

// 本地开发默认不请求未启动的通知后端；如需联调可设置 VITE_ENABLE_NOTIFICATION_API=true。
const notificationApiEnabled = !import.meta.env.DEV || import.meta.env.VITE_ENABLE_NOTIFICATION_API === 'true';
let _apiUnavailable = !notificationApiEnabled;

export const NOTIFICATION_TOGGLE_EVENT = 'xiaotian:notification-toggle';
export const NOTIFICATION_UNREAD_EVENT = 'xiaotian:notification-unread';

const NotificationPopup: React.FC = () => {
  const { pathname } = useLocation();
  const { isMobile } = useDeviceDetection();
  const showOnRoute = shouldShowNotificationCenter(pathname, isMobile);
  const isMobileHome = false;
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = bellShakeKeyframes;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const fetchUnreadCount = useCallback(async (cancelledRef?: React.MutableRefObject<boolean>) => {
    try {
      if (_apiUnavailable) {
        setUnreadCount(0);
        return;
      }
      const token = getAuthToken();
      if (!token || cancelledRef?.current) {
        setUnreadCount(0);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (cancelledRef?.current) return;

      if (!response.ok) {
        if (response.status === 401) {
          clearAuthToken();
        }
        setUnreadCount(0);
        return;
      }

      const res = await response.json() as { count: number };
      if (cancelledRef?.current) return;
      setUnreadCount(res.count || 0);
    } catch (_e) {
      if (cancelledRef?.current) return;
      _apiUnavailable = true;
      setUnreadCount(0);
    }
  }, []);

  const fetchNotifications = useCallback(async (cancelledRef?: React.MutableRefObject<boolean>) => {
    try {
      if (_apiUnavailable) {
        setNotifications([]);
        return;
      }
      setLoading(true);
      const token = getAuthToken();
      if (!token || cancelledRef?.current) {
        setNotifications([]);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/notifications?page=1&pageSize=20`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (cancelledRef?.current) return;

      if (!response.ok) {
        if (response.status === 401) {
          clearAuthToken();
        }
        setNotifications([]);
        return;
      }

      const res = await response.json() as { notifications: UserNotification[] };
      if (cancelledRef?.current) return;
      setNotifications(res.notifications || []);
    } catch (_e) {
      if (cancelledRef?.current) return;
      _apiUnavailable = true;
      setNotifications([]);
    } finally {
      if (!cancelledRef?.current) {
        setLoading(false);
      }
    }
  }, []);

  // BUG-5: 使用 ref 稳定化 fetchUnreadCount，避免因引用变化导致 effect 频繁重建 interval
  const fetchUnreadCountRef = useRef(fetchUnreadCount);
  fetchUnreadCountRef.current = fetchUnreadCount;

  useEffect(() => {
    if (!showOnRoute) {
      setIsOpen(false);
      return;
    }
    const cancelledRef = { current: false };
    // 防护：清除可能残留的旧 interval
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = undefined;
    }
    fetchUnreadCountRef.current(cancelledRef);
    // 轮询间隔 24 小时，未读数仅在用户打开通知面板时实时拉取
    pollRef.current = setInterval(() => fetchUnreadCountRef.current(cancelledRef), 24 * 60 * 60 * 1000); // 24 小时

    return () => {
      cancelledRef.current = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = undefined;
      }
    };
  }, [showOnRoute]);

  useEffect(() => {
    if (isOpen) {
      const cancelledRef = { current: false };
      fetchNotifications(cancelledRef);
      return () => { cancelledRef.current = true; };
    }
  }, [isOpen, fetchNotifications]);

  useEffect(() => {
    const onToggle = () => setIsOpen((open) => !open);
    window.addEventListener(NOTIFICATION_TOGGLE_EVENT, onToggle);
    return () => window.removeEventListener(NOTIFICATION_TOGGLE_EVENT, onToggle);
  }, []);

  useEffect(() => {
    if (!showOnRoute) return;
    const token = getAuthToken();
    const now = Date.now();
    const lastOpenedAt = localStorage.getItem(NOTIFICATION_AUTO_OPEN_STORAGE_KEY);
    if (token && shouldAutoOpenNotifications(lastOpenedAt, now)) {
      localStorage.setItem(NOTIFICATION_AUTO_OPEN_STORAGE_KEY, String(now));
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [showOnRoute]);

  useEffect(() => {
    if (!showOnRoute) return;
    window.dispatchEvent(
      new CustomEvent(NOTIFICATION_UNREAD_EVENT, { detail: { count: unreadCount } }),
    );
  }, [unreadCount, showOnRoute]);

  useEffect(() => {
    if (isMobileHome) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isMobileHome]);

  const handleMarkRead = async (id: string) => {
    try {
      await apiClient.post(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (_e) {
      // silently ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (_e) {
      // silently ignore
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (!showOnRoute) return null;

  return (
    <div
      className={isMobileHome ? 'fixed inset-0 z-[9999] pointer-events-none' : 'fixed top-20 right-3 z-[1200]'}
      ref={panelRef}
    >
      {isOpen && (
        <>
          {isMobileHome && (
            <button
              type="button"
              className="fixed inset-0 bg-black/50 pointer-events-auto"
              aria-label="关闭通知"
              onClick={() => setIsOpen(false)}
            />
          )}
        <div
          className={
            isMobileHome
              ? 'fixed left-3 right-3 top-14 max-h-[min(72vh,520px)] flex flex-col rounded-2xl overflow-hidden shadow-2xl pointer-events-auto'
              : 'absolute top-12 right-0 w-[380px] max-h-[520px] flex flex-col rounded-2xl overflow-hidden shadow-2xl'
          }
          style={{
            background: 'rgba(255, 250, 245, 0.95)',
            border: '1px solid rgba(224, 155, 109, 0.2)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
            <div className="flex items-center gap-2">
              <Bell size={16} color="#0F172A" />
              <span className="text-slate-900 text-sm font-semibold">通知中心</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: '#0F172A' }}>
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-slate-800 hover:bg-slate-900/[0.08] hover:text-slate-950 transition-colors"
                >
                  <CheckCheck size={12} />
                  全部已读
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-900/[0.08] transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div
            className="space-y-2.5 px-4 py-3.5"
            style={{
              borderBottom: '1px solid rgba(15,23,42,0.08)',
              background:
                'linear-gradient(145deg, rgba(255,247,237,0.96) 0%, rgba(245,243,255,0.94) 52%, rgba(239,246,255,0.92) 100%)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-rose-500 shadow-[0_6px_16px_rgba(244,63,94,0.22)]">
                  <Sparkles size={15} strokeWidth={2} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-slate-900">新用户福利</div>
                  <div className="mt-0.5 text-[11px] font-semibold text-slate-600">积分奖励一览</div>
                </div>
              </div>
              <span className="shrink-0 rounded-md border border-emerald-200/80 bg-emerald-50/90 px-2 py-1 text-[10px] font-bold text-emerald-700">
                持续有效
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-emerald-200/75 bg-white/72 px-2.5 py-2 shadow-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                <UserPlus size={14} strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900">完成账号注册</div>
                <div className="mt-0.5 text-[10px] font-medium text-slate-600">注册成功后自动到账</div>
              </div>
              <strong className="shrink-0 text-sm font-extrabold tabular-nums text-emerald-700">
                +{NOTIFICATION_CENTER_REGISTRATION_BONUS} 积分
              </strong>
            </div>

            <div className="rounded-lg border border-blue-200/80 bg-white/76 p-2.5 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 text-blue-700">
                    <CalendarCheck2 size={14} strokeWidth={2} />
                  </span>
                  每日签到
                </div>
                <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                  每日 6 次
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {NOTIFICATION_CENTER_DAILY_CHECKIN_REWARDS.map((points, index) => (
                  <div
                    key={points}
                    className="flex items-center justify-between rounded-md border border-blue-100/90 bg-blue-50/65 px-2 py-1.5"
                  >
                    <span className="text-[10px] font-semibold text-slate-600">第 {index + 1} 次</span>
                    <strong className="text-[11px] font-extrabold tabular-nums text-blue-700">
                      +{points}
                    </strong>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-3 border-t border-blue-100/80 pt-2 text-[10px] font-semibold text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <Clock3 size={11} className="text-blue-600" /> 每次间隔 1 小时
                </span>
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck size={11} className="text-blue-600" /> 有效期 7 天
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex min-w-0 items-center gap-2 rounded-lg border border-violet-200/70 bg-white/68 px-2 py-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700">
                  <MailCheck size={14} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-slate-900">绑定账号</div>
                  <div className="text-[10px] font-extrabold text-violet-700">+50 积分 · 1年有效</div>
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-2 rounded-lg border border-pink-200/70 bg-white/68 px-2 py-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-pink-100 text-pink-700">
                  <UsersRound size={14} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-slate-900">邀请好友注册</div>
                  <div className="text-[10px] font-extrabold text-pink-700">+50 积分 · 1个月有效</div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-amber-200/70 bg-amber-50/62 px-2.5 py-2">
              <Trophy size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="min-w-0 text-[10px] font-semibold leading-4 text-slate-700">
                好友使用积分超过 200，再奖励 <strong className="text-amber-700">100 积分</strong>；
                单个好友累计最高可获 <strong className="text-amber-700">150 积分</strong>。
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-0.5 text-[10px] font-medium text-slate-600">
              <Globe2 size={11} className="shrink-0 text-slate-400" />
              推荐浏览器：Chrome、Firefox
            </div>
          </div>

          <div className="flex-1 overflow-y-auto" style={{ maxHeight: '420px' }}>
            {loading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-2" />
                <span className="text-xs">加载中...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                <Bell size={32} className="mb-2 opacity-30" />
                <span className="text-xs">暂无通知</span>
              </div>
            ) : (
            <div className="divide-y divide-slate-900/[0.08]">
                {notifications.map(n => {
                  const cfg = typeConfig[n.type] || typeConfig.system;
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={n.id}
                      className="px-4 py-3 hover:bg-slate-900/[0.04] transition-colors cursor-pointer group"
                      style={{
                        background: n.isRead ? 'transparent' : 'rgba(15, 23, 42, 0.045)',
                      }}
                      onClick={() => !n.isRead && handleMarkRead(n.id)}
                    >
                      <div className="flex gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}30` }}
                        >
                          <Icon size={14} color={cfg.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold truncate ${n.isRead ? 'text-slate-700' : 'text-slate-950'}`}>
                              {n.title}
                            </span>
                            {!n.isRead && (
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.color }} />
                            )}
                          </div>
                          <p className={`text-xs mt-0.5 line-clamp-2 ${n.isRead ? 'text-slate-600' : 'text-slate-800'}`}>
                            {n.content}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-slate-500">{formatTime(n.createdAt)}</span>
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{ background: `${cfg.color}1F`, color: cfg.textColor }}
                            >
                              {cfg.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="border-t border-slate-900/[0.08] px-4 py-2 text-center text-[10px] font-medium text-slate-500">
            卡顿请关闭VPN
          </div>
        </div>
        </>
      )}
    </div>
  );
};

export default NotificationPopup;
