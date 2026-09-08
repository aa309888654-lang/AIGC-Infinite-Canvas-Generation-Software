import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PUBLIC_URLS } from '@/config/resources';
import {
  LayoutDashboard,
  Users,
  Crown,
  Cpu,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ArrowLeft,
  Menu,
  X,
  Bell,
  Search,
  Server,
  CheckCheck,
  Wallet,
  Sparkles,
  ShieldCheck,
  Coins,
  PlaySquare,
} from 'lucide-react';
import { getAuthToken } from '@/lib/auth-check';
import { notificationService, type Notification } from '@/services/admin/notification-service';
import { stabilityService } from '@/services/admin/stability-service';
import { cn } from '@/lib/utils';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onBack?: () => void;
}

const menuItems = [
  { id: 'dashboard', label: '仪表板', icon: LayoutDashboard, group: '概览' },
  { id: 'users', label: '用户中心', icon: Users, group: '概览' },
  { id: 'app-config', label: '应用配置中心', icon: Settings, group: '业务' },
  { id: 'membership-center', label: '会员中心', icon: Crown, group: '业务' },
  { id: 'ai-platform', label: 'AI 平台中心', icon: Cpu, group: '业务' },
  { id: 'task-content', label: '任务与内容', icon: Sparkles, group: '运营' },
  { id: 'finance', label: '财务中心', icon: Wallet, group: '财务' },
  { id: 'points-pricing', label: '积分定价', icon: Coins, group: '财务' },
  { id: 'messages', label: '消息中心', icon: Bell, group: '沟通' },
  { id: 'governance', label: '治理中心', icon: ShieldCheck, group: '系统' },
  { id: 'operations', label: '运营增强', icon: BarChart3, group: '运营' },
  { id: 'tutorial-videos', label: '教程视频', icon: PlaySquare, group: '运营' },
  { id: 'system-ops', label: '系统运维', icon: Server, group: '系统' },
  { id: 'site-config', label: '站点配置', icon: Settings, group: '系统' },
];

const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  onBack,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [systemHealth, setSystemHealth] = useState<'checking' | 'healthy' | 'unhealthy'>('checking');
  const notifPanelRef = useRef<HTMLDivElement>(null);

  const fetchSystemHealth = useCallback(async () => {
    if (!getAuthToken()) {
      setSystemHealth('unhealthy');
      return;
    }

    try {
      const health = await stabilityService.getHealthCheck();
      setSystemHealth(health.status === 'healthy' ? 'healthy' : 'unhealthy');
    } catch (error) {
      console.error('[AdminLayout] 获取系统健康状态失败:', error);
      setSystemHealth('unhealthy');
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    if (!getAuthToken()) {
      setUnreadCount(0);
      return;
    }

    try {
      const res = await notificationService.getNotificationStats();
      if (res.success) {
        setUnreadCount(res.data?.unread || 0);
      }
    } catch (error) {
      console.error('[AdminLayout] 获取未读通知数失败:', error);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!getAuthToken()) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      setNotifLoading(true);
      const res = await notificationService.getNotifications({ page: 1, pageSize: 20 });
      if (res.success) {
        const nextNotifications = res.data || res.notifications || [];
        setNotifications(nextNotifications);
        const unread = nextNotifications.filter((n) => !n.isRead).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('[AdminLayout] 获取通知列表失败:', error);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('[AdminLayout] 标记通知已读失败:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('[AdminLayout] 标记全部已读失败:', error);
    }
  };

  useEffect(() => { fetchUnreadCount(); }, [fetchUnreadCount]);

  useEffect(() => {
    void fetchSystemHealth();
    const timer = window.setInterval(fetchSystemHealth, 30000);
    return () => window.clearInterval(timer);
  }, [fetchSystemHealth]);

  useEffect(() => {
    if (showNotifications) fetchNotifications();
  }, [showNotifications, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [activeTab]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const filteredMenuItems = searchQuery
    ? menuItems.filter((item) => item.label.includes(searchQuery))
    : menuItems;

  const groupedItems: Record<string, typeof menuItems> = {};
  filteredMenuItems.forEach((item) => {
    if (!groupedItems[item.group]) groupedItems[item.group] = [];
    groupedItems[item.group].push(item);
  });

  const handleLogout = () => {
    localStorage.removeItem('admin_token_v1');
    localStorage.removeItem('authToken');
    window.location.reload();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSearch(false);
      setSearchQuery('');
    }
  };

  return (
    <div className="h-screen bg-[#0B0B0E] flex overflow-hidden">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 flex flex-col border-r border-white/[0.08] bg-[#111114] transition-all duration-300 ease-in-out shadow-2xl shadow-black/20',
          collapsed ? 'w-[72px]' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className={cn(
          'h-16 flex items-center border-b border-white/[0.08] shrink-0 transition-all duration-300',
          collapsed ? 'px-3 justify-center' : 'px-5 justify-between'
        )}>
          {!collapsed && (
            <div className="flex items-center gap-3 overflow-hidden">
              <img src={PUBLIC_URLS.logo} alt="小天AICG" className="w-9 h-9 rounded-xl shrink-0 object-cover shadow-lg" />
              <div className="overflow-hidden">
                <h1 className="text-base font-bold text-white truncate">管理后台</h1>
              </div>
            </div>
          )}
          {collapsed && (
            <img src={PUBLIC_URLS.logo} alt="小天AICG" className="w-9 h-9 rounded-xl shrink-0 object-cover shadow-lg" />
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-2 hover:bg-white/[0.08] rounded-xl transition-colors text-gray-400 hover:text-white"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {!collapsed && (
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="搜索菜单..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-10 pr-4 py-2.5 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/10 transition-all"
              />
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-2 px-3 scrollbar-thin">
          {Object.entries(groupedItems).map(([group, items]) => (
            <div key={group} className="mb-3">
              {!collapsed && (
                <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-widest">
                  {group}
                </p>
              )}
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={cn(
                      'w-full flex items-center gap-3.5 rounded-xl text-base font-medium transition-all duration-200',
                      collapsed ? 'px-3 py-3 justify-center' : 'px-4 py-2.5',
                      isActive
                        ? 'bg-gradient-to-r from-amber-500/15 to-orange-500/10 text-white shadow-lg shadow-amber-500/10 border border-amber-500/20'
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.08]'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className={cn('shrink-0', isActive ? 'w-[20px] h-[20px] text-amber-400' : 'w-5 h-5')} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {isActive && !collapsed && (
                      <div className="ml-auto w-2 h-2 rounded-full bg-amber-400 shadow-lg shadow-amber-400/50" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={cn(
          'border-t border-white/[0.08] p-3 shrink-0',
          collapsed ? 'flex flex-col items-center gap-2' : 'flex flex-col gap-2'
        )}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-400">
              <div className={cn(
                'w-2 h-2 rounded-full shadow-lg',
                systemHealth === 'healthy' && 'bg-emerald-500 animate-pulse shadow-emerald-500/30',
                systemHealth === 'unhealthy' && 'bg-red-500 shadow-red-500/30',
                systemHealth === 'checking' && 'bg-amber-400 animate-pulse shadow-amber-400/30'
              )} />
              <span>{systemHealth === 'healthy' ? '系统运行正常' : systemHealth === 'unhealthy' ? '系统异常' : '正在检查系统'}</span>
            </div>
          )}
          {collapsed && (
            <div
              className={cn(
                'w-2 h-2 rounded-full mx-auto shadow-lg',
                systemHealth === 'healthy' && 'bg-emerald-500 animate-pulse shadow-emerald-500/30',
                systemHealth === 'unhealthy' && 'bg-red-500 shadow-red-500/30',
                systemHealth === 'checking' && 'bg-amber-400 animate-pulse shadow-amber-400/30'
              )}
              title={systemHealth === 'healthy' ? '系统运行正常' : systemHealth === 'unhealthy' ? '系统异常' : '正在检查系统'}
            />
          )}
          {onBack && (
            <button
              onClick={onBack}
              className={cn(
                'flex items-center gap-2 text-gray-400 hover:text-white rounded-xl transition-all text-sm',
                collapsed ? 'p-3 justify-center' : 'px-4 py-2.5 hover:bg-white/[0.08]'
              )}
              title="返回工作台"
            >
              <ArrowLeft className="w-4 h-4" />
              {!collapsed && <span>返回工作台</span>}
            </button>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-2 text-gray-300 hover:text-red-400 rounded-lg transition-colors text-xs',
              collapsed ? 'p-2 justify-center' : 'px-3 py-2 hover:bg-white/[0.06]'
            )}
            title="退出管理"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>退出管理</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-white/[0.08] bg-[#111114]/90 backdrop-blur-xl shrink-0 z-30 flex items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2.5 hover:bg-white/[0.08] rounded-xl text-gray-400"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-3">
              <h2 className="text-white font-bold text-lg">
                {menuItems.find((i) => i.id === activeTab)?.label || '管理后台'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2.5 hover:bg-white/[0.08] rounded-xl text-gray-400 hover:text-white transition-all"
              title="全局搜索"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2.5 hover:bg-white/[0.08] rounded-xl text-gray-400 hover:text-white transition-all relative"
              title="通知"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
              )}
            </button>
            {showNotifications && (
              <div ref={notifPanelRef} className="absolute right-8 top-16 w-[420px] max-h-[520px] bg-[#151518] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/30 z-50 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
                  <h3 className="text-white font-bold text-base">通知中心</h3>
                  <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead} className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1.5 font-medium">
                        <CheckCheck className="w-4 h-4" />全部已读
                      </button>
                    )}
                    <button onClick={() => setShowNotifications(false)} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {notifLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-6 h-6 border-2 border-amber-500/50 border-t-amber-500 rounded-full animate-spin" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <Bell className="w-10 h-10 mb-3 opacity-30" />
                      <p className="text-sm">暂无通知</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => { if (!n.isRead) markAsRead(n.id); }}
                        className={cn(
                          'px-5 py-4 border-b border-white/[0.06] cursor-pointer hover:bg-white/[0.06] transition-all',
                          !n.isRead && 'bg-amber-500/[0.03]'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          {!n.isRead && <div className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-2 shrink-0 shadow-lg shadow-amber-500/30" />}
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-base truncate', n.isRead ? 'text-gray-400' : 'text-white font-semibold')}>{n.title}</p>
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{n.content}</p>
                            <p className="text-xs text-gray-600 mt-1.5">{new Date(n.createdAt).toLocaleString('zh-CN')}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            <div className="w-px h-8 bg-white/[0.08] mx-2" />
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.06] transition-all cursor-default">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-base font-bold shadow-lg shadow-amber-500/30">
                A
              </div>
              <div className="hidden sm:block">
                <p className="text-sm text-white font-bold leading-tight">管理员</p>
                <p className="text-xs text-gray-500">
                  {currentTime.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' })}
                </p>
              </div>
            </div>
          </div>
        </header>

        {showSearch && (
          <div className="border-b border-white/[0.06] bg-[#111114] px-4 lg:px-6 py-3 flex items-center gap-3 animate-in slide-in-from-top duration-200 shrink-0">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="搜索菜单项..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="flex-1 bg-transparent text-white text-sm placeholder-gray-400 focus:outline-none"
            />
            <kbd className="hidden sm:inline-flex px-1.5 py-0.5 bg-white/[0.06] rounded text-[10px] text-gray-400 font-mono">ESC</kbd>
            <button onClick={() => { setShowSearch(false); setSearchQuery(''); }}>
              <X className="w-4 h-4 text-gray-400 hover:text-white" />
            </button>
          </div>
        )}

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto h-full">
          <div className="animate-in fade-in duration-200">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
