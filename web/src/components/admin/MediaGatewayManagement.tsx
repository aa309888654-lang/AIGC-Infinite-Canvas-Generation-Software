import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw,
  AlertCircle,
  Server,
  Power,
  PowerOff,
  Activity,
  Key,
  Zap,
  Clock,
  FileText,
  Shield,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { mediagatewayService } from '@/services/admin/mediagateway-service';
import type {
  GatewayStatus,
  GatewayHealth,
  GatewayStats,
  MGLogEntry,
} from '@/services/admin/mediagateway-service';

const POLL_INTERVAL = 30000;
const FAILURE_THRESHOLD = 10;
const RECOVERY_COOLDOWN = 300;

type TabId = 'overview' | 'logs';

const MediaGatewayManagement: React.FC = () => {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [health, setHealth] = useState<GatewayHealth | null>(null);
  const [stats, setStats] = useState<GatewayStats | null>(null);
  const [logs, setLogs] = useState<MGLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEnabled = useCallback(async () => {
    try {
      const val = await mediagatewayService.getEnabled();
      setEnabled(val);
    } catch {
      // Keep the previous enabled state when the gateway is unreachable.
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await mediagatewayService.getHealth();
      setHealth(data);
    } catch {
      setHealth({
        status: 'offline',
        uptime: 0,
        version: '',
        viduKeys: 0,
        viduActive: 0,
        doubaoConfigured: false,
        timestamp: new Date().toISOString(),
      });
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await mediagatewayService.getStats();
      setStats(data);
    } catch {
      // Stats are optional for this dashboard; leave the current snapshot in place.
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await mediagatewayService.getStatus();
      setStatus(data);
      setLastRefresh(new Date());
    } catch {
      toast.error('无法连接到后端服务器');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await mediagatewayService.getLogs(100);
      setLogs(data);
    } catch {
      // Logs are best-effort and should not block the management panel.
    }
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.allSettled([fetchHealth(), fetchStats(), fetchStatus(), fetchLogs()]);
  }, [fetchHealth, fetchStats, fetchStatus, fetchLogs]);

  useEffect(() => {
    const init = async () => {
      await fetchEnabled();
      await fetchAll();
    };
    init();
  }, [fetchEnabled, fetchAll]);

  useEffect(() => {
    if (enabled) {
      pollRef.current = setInterval(fetchAll, POLL_INTERVAL);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [enabled, fetchAll]);

  const handleToggle = async () => {
    const newState = !enabled;
    if (newState) {
      setConfirmDialog({
        title: '启用 MediaGateway',
        message: '确定要启用 MediaGateway 服务吗？启用后将开始接受视频生成请求。',
        onConfirm: () => doToggle(newState),
      });
    } else {
      setConfirmDialog({
        title: '关闭 MediaGateway',
        message: '确定要关闭 MediaGateway 服务吗？关闭后所有视频生成请求将被暂停。',
        onConfirm: () => doToggle(newState),
      });
    }
  };

  const doToggle = async (newState: boolean) => {
    setConfirmDialog(null);
    try {
      setToggling(true);
      const result = await mediagatewayService.toggle(newState);
      setEnabled(result);
      toast.success(newState ? 'MediaGateway 已启用' : 'MediaGateway 已关闭');
      if (newState) {
        fetchAll();
      } else {
        setStatus(null);
        setStats(null);
        setHealth(null);
      }
    } catch {
      toast.error('切换失败');
    } finally {
      setToggling(false);
    }
  };

  const healthColor =
    health?.status === 'healthy'
      ? 'text-green-500'
      : health?.status === 'degraded'
        ? 'text-amber-500'
        : health?.status === 'offline'
          ? 'text-red-500'
          : 'text-gray-500';
  const healthLabel =
    health?.status === 'healthy'
      ? '在线'
      : health?.status === 'degraded'
        ? '降级'
        : health?.status === 'offline'
          ? '离线'
          : '已关闭';
  const healthBg =
    health?.status === 'healthy'
      ? 'bg-green-500/10 border-green-500/20'
      : health?.status === 'degraded'
        ? 'bg-amber-500/10 border-amber-500/20'
        : health?.status === 'offline'
          ? 'bg-red-500/10 border-red-500/20'
          : 'bg-gray-500/10 border-gray-500/20';

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: '概览', icon: <Activity className="w-5 h-5" /> },
    { id: 'logs', label: '操作日志', icon: <FileText className="w-5 h-5" /> },
  ];

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/15 flex items-center justify-center">
            <Server className="w-7 h-7 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">MediaGateway 管理</h1>
            <p className="text-gray-400 text-base">监控和管理视频大模型分流网关</p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {enabled && health && (
            <div
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-xl border',
                healthBg
              )}
            >
              <div
                className={cn(
                  'w-2.5 h-2.5 rounded-full',
                  health.status === 'healthy'
                    ? 'bg-green-400 animate-pulse'
                    : health.status === 'degraded'
                      ? 'bg-amber-400'
                      : health.status === 'offline'
                        ? 'bg-red-400'
                        : 'bg-gray-400'
                )}
              />
              <span className={cn('text-base font-medium', healthColor)}>{healthLabel}</span>
              {health.version && <span className="text-gray-500 ml-2 text-sm">v{health.version}</span>}
            </div>
          )}
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={cn(
              'flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-white transition-all duration-200 font-medium shadow-lg',
              enabled ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 shadow-green-500/20' : 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 shadow-black/20'
            )}
          >
            {toggling ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : enabled ? (
              <Power className="w-5 h-5" />
            ) : (
              <PowerOff className="w-5 h-5" />
            )}
            {enabled ? '已启用' : '已关闭'}
          </button>
          {enabled && (
            <button
              onClick={fetchAll}
              disabled={loading}
              className="flex items-center gap-2.5 px-5 py-2.5 bg-[#151518] hover:bg-white/[0.06] rounded-xl text-white transition-all duration-200 border border-white/[0.06]"
            >
              <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
              刷新
            </button>
          )}
        </div>
      </div>

      {/* Disabled Banner */}
      {!enabled && (
        <div className="flex items-center gap-4 px-6 py-5 bg-amber-500/12 border border-amber-500/25 rounded-2xl">
          <PowerOff className="w-6 h-6 text-amber-400 shrink-0" />
          <div>
            <p className="text-amber-300 font-medium text-base">MediaGateway 服务已关闭</p>
            <p className="text-amber-400/70 text-sm mt-1">
              所有分流网关功能已暂停，点击上方开关启用后可查看运行状态
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {enabled && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard
            icon={<Key className="w-6 h-6" />}
            label="在线秘钥"
            value={`${stats.activeKeys}/${stats.totalKeys}`}
            color="blue"
          />
          <StatCard
            icon={<Activity className="w-6 h-6" />}
            label="可用率"
            value={`${stats.successRate}%`}
            color={stats.successRate >= 80 ? 'green' : stats.successRate >= 50 ? 'amber' : 'red'}
          />
          <StatCard
            icon={<Zap className="w-6 h-6" />}
            label="Vidu 活跃"
            value={`${stats.viduActive}/${stats.viduKeys}`}
            color="violet"
          />
          <StatCard
            icon={<AlertCircle className="w-6 h-6" />}
            label="累计失败"
            value={String(stats.totalFailures)}
            color={stats.totalFailures > 0 ? 'red' : 'gray'}
          />
          <StatCard
            icon={<Shield className="w-6 h-6" />}
            label="豆包秘钥"
            value={stats.doubaoKey ? '已配置' : '未配置'}
            color={stats.doubaoKey ? 'green' : 'red'}
          />
          <StatCard
            icon={<Clock className="w-6 h-6" />}
            label="恢复冷却"
            value={`${stats.recoveryCooldown}s`}
            color="gray"
          />
        </div>
      )}

      {/* Last Refresh */}
      {enabled && lastRefresh && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            最后更新: {lastRefresh.toLocaleTimeString()} · 每 {POLL_INTERVAL / 1000}s 自动刷新
          </p>
        </div>
      )}

      {/* Tab Navigation */}
      {enabled && (
        <div className="flex items-center gap-2 bg-[#0d0d0d] rounded-xl p-2 border border-white/[0.06]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'logs') fetchLogs();
              }}
              className={cn(
                'flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-base font-medium transition-all duration-200',
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'logs' && logs.length > 0 ? (
                <span className="ml-1.5 text-sm bg-white/10 px-2 py-0.5 rounded-full">
                  {logs.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {/* Tab Content */}
      {enabled && (
        <div className="min-h-[400px]">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="bg-[#111114] border border-white/[0.06] rounded-2xl p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                  <Info className="w-6 h-6 text-blue-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-white font-medium text-base">秘钥管理已迁移</p>
                  <p className="text-base text-gray-400">
                    秘钥管理已迁移到「AI 平台中心 → 用户 API Key」板块，请前往该板块进行秘钥的添加、删除和管理操作。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="bg-[#111114] border border-white/[0.06] rounded-2xl overflow-hidden shadow-lg">
              <div className="px-6 py-5 border-b border-white/[0.04] bg-[#151518] flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">操作日志</h2>
                <span className="text-sm text-gray-500">最近 {logs.length} 条</span>
              </div>
              <div className="divide-y divide-white/[0.04] max-h-[600px] overflow-y-auto">
                {logs.length > 0 ? (
                  logs.map((log, i) => (
                    <div key={i} className="px-6 py-4 flex items-start gap-4 hover:bg-white/[0.04] transition-colors">
                      <div
                        className={cn(
                          'w-2.5 h-2.5 rounded-full mt-2 shrink-0',
                          log.action.includes('DELETE') ||
                            (log.action.includes('TOGGLE') && log.detail.includes('关闭'))
                            ? 'bg-red-400'
                            : log.action.includes('ADD') ||
                                (log.action.includes('TOGGLE') && log.detail.includes('启用'))
                              ? 'bg-green-400'
                              : log.action.includes('RESET')
                                ? 'bg-blue-400'
                                : 'bg-gray-400'
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-sm font-mono px-2 py-1 bg-white/[0.04] rounded-lg text-gray-300">
                            {log.action}
                          </span>
                          <span className="text-base text-white">{log.detail}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-sm text-gray-500">
                            {new Date(log.time).toLocaleString()}
                          </span>
                          {log.userId && (
                            <span className="text-sm text-gray-500">操作者: {log.userId}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={<FileText className="w-12 h-12" />}
                    message="暂无操作日志"
                    hint="执行秘钥操作后日志将在此显示"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#111114] rounded-2xl border border-white/[0.06] shadow-2xl overflow-hidden">
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-xl font-semibold text-white">{confirmDialog.title}</h3>
              </div>
              <p className="text-base text-gray-400">{confirmDialog.message}</p>
              <div className="flex items-center gap-4 pt-2">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="flex-1 px-5 py-3 bg-[#151518] hover:bg-white/[0.06] rounded-xl text-white transition-all duration-200 text-base font-medium border border-white/[0.06]"
                >
                  取消
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="flex-1 px-5 py-3 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 rounded-xl text-white transition-all duration-200 text-base font-medium border border-amber-500/30"
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/15 text-blue-400',
    green: 'bg-green-500/15 text-green-400',
    amber: 'bg-amber-500/15 text-amber-400',
    red: 'bg-red-500/15 text-red-400',
    violet: 'bg-violet-500/15 text-violet-400',
    gray: 'bg-gray-500/15 text-gray-400',
  };
  const cls = colorMap[color] || colorMap.blue;

  return (
    <div className="bg-[#151518] border border-white/[0.06] rounded-2xl p-5">
      <div className="flex items-center gap-4">
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', cls)}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  message,
  hint,
}: {
  icon: React.ReactNode;
  message: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="text-gray-600">{icon}</div>
      <p className="text-gray-500 italic text-base">{message}</p>
      {hint && <p className="text-gray-600 text-sm">{hint}</p>}
    </div>
  );
}

export default MediaGatewayManagement;
