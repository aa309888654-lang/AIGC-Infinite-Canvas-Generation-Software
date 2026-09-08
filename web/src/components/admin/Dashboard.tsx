import React, { useState, useEffect, useCallback } from 'react';
import { Users, Crown, Image, Activity, Coins, HardDrive, AlertCircle, RefreshCw, Zap, FileText, Shield } from 'lucide-react';
import StatCard from './shared/StatCard';
import { apiClient } from '@/lib/api-client';

interface DashboardStats {
  users: { total: number; active: number; inactive: number };
  files: { count: number; totalSize: number };
  tasks: { total: number };
  points: { totalTransactions: number };
  authentication: { totalAttempts: number; successful: number; failed: number; successRate: number };
  api: { totalCalls: number };
}

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  vipUsers: number;
  recentRegistrations: number;
}

interface RealtimeModelMetric {
  provider: string;
  model: string;
  calls5m: number;
  callsToday: number;
  failed5m: number;
  successRate5m: number;
  avgLatencyMs5m: number;
  pointsCost5m: number;
}

interface RealtimeMonitorStats {
  online: {
    activeUsers5m: number;
    authenticatedUsers5m: number;
    windowSeconds: number;
    updatedAt: string;
  };
  api: {
    calls5m: number;
    callsToday: number;
    success5m: number;
    failed5m: number;
    successRate5m: number;
    avgLatencyMs5m: number;
    pointsCost5m: number;
    inputTokens5m: number;
    outputTokens5m: number;
  };
  models: RealtimeModelMetric[];
}

const safeNum = (v: unknown, fallback: number = 0): number => {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const safeObj = <T extends Record<string, unknown>>(v: unknown, fallback: T): T => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return fallback;
  return { ...fallback, ...(v as Partial<T>) };
};

const SkeletonBlock = ({ className }: { className?: string }) => (
  <div className={`bg-white/[0.04] rounded-lg animate-pulse ${className || ''}`} />
);

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [realtimeStats, setRealtimeStats] = useState<RealtimeMonitorStats | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRealtimeStats = useCallback(async () => {
    try {
      const response = await apiClient.get<{ success: boolean; data: RealtimeMonitorStats }>('/admin/ai-usage/realtime', { timeout: 8000, maxRetries: 0 });
      if (response?.success) {
        const d = response.data;
        setRealtimeStats({
          online: {
            activeUsers5m: safeNum(d?.online?.activeUsers5m),
            authenticatedUsers5m: safeNum(d?.online?.authenticatedUsers5m),
            windowSeconds: safeNum(d?.online?.windowSeconds, 300),
            updatedAt: d?.online?.updatedAt || new Date().toISOString(),
          },
          api: {
            calls5m: safeNum(d?.api?.calls5m),
            callsToday: safeNum(d?.api?.callsToday),
            success5m: safeNum(d?.api?.success5m),
            failed5m: safeNum(d?.api?.failed5m),
            successRate5m: safeNum(d?.api?.successRate5m),
            avgLatencyMs5m: safeNum(d?.api?.avgLatencyMs5m),
            pointsCost5m: safeNum(d?.api?.pointsCost5m),
            inputTokens5m: safeNum(d?.api?.inputTokens5m),
            outputTokens5m: safeNum(d?.api?.outputTokens5m),
          },
          models: Array.isArray(d?.models) ? d.models.map((item) => ({
            provider: item.provider || 'unknown',
            model: item.model || 'unknown',
            calls5m: safeNum(item.calls5m),
            callsToday: safeNum(item.callsToday),
            failed5m: safeNum(item.failed5m),
            successRate5m: safeNum(item.successRate5m),
            avgLatencyMs5m: safeNum(item.avgLatencyMs5m),
            pointsCost5m: safeNum(item.pointsCost5m),
          })) : [],
        });
        setRealtimeError(null);
      }
    } catch (err) {
      console.warn('Dashboard realtime monitor failed:', err);
      setRealtimeError(err instanceof Error ? err.message : '实时监控数据加载失败');
    }
  }, []);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, userStatsRes] = await Promise.allSettled([
        apiClient.get<{ success: boolean; data: DashboardStats }>('/admin/users/all-stats'),
        apiClient.get<{ success: boolean; data: UserStats }>('/admin/users/stats'),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        const d = statsRes.value.data;
        setStats({
          users: safeObj(d?.users, { total: 0, active: 0, inactive: 0 }),
          files: safeObj(d?.files, { count: 0, totalSize: 0 }),
          tasks: safeObj(d?.tasks, { total: 0 }),
          points: safeObj(d?.points, { totalTransactions: 0 }),
          authentication: safeObj(d?.authentication, { totalAttempts: 0, successful: 0, failed: 0, successRate: 0 }),
          api: safeObj(d?.api, { totalCalls: 0 }),
        });
      } else if (statsRes.status === 'rejected') {
        console.warn('Dashboard all-stats failed:', statsRes.reason);
      }

      if (userStatsRes.status === 'fulfilled' && userStatsRes.value?.success) {
        const d = userStatsRes.value.data;
        setUserStats({
          totalUsers: safeNum(d?.totalUsers),
          activeUsers: safeNum(d?.activeUsers),
          vipUsers: safeNum(d?.vipUsers),
          recentRegistrations: safeNum(d?.recentRegistrations),
        });
      } else if (userStatsRes.status === 'rejected') {
        console.warn('Dashboard user-stats failed:', userStatsRes.reason);
      }

      if (statsRes.status === 'rejected' && userStatsRes.status === 'rejected') {
        setError('加载仪表板数据失败');
      }
    } catch (err: unknown) {
      console.error('加载仪表板数据失败:', err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    loadRealtimeStats();
  }, [loadDashboardData, loadRealtimeStats]);

  useEffect(() => {
    const timer = window.setInterval(loadRealtimeStats, 15000);
    return () => window.clearInterval(timer);
  }, [loadRealtimeStats]);

  const fmt = (n: number) => {
    const safe = safeNum(n);
    return safe >= 10000 ? (safe / 10000).toFixed(1) + '万' : safe.toLocaleString();
  };
  const fmtSize = (b: number) => {
    const safe = safeNum(b);
    if (safe >= 1073741824) return (safe / 1073741824).toFixed(1) + ' GB';
    if (safe >= 1048576) return (safe / 1048576).toFixed(1) + ' MB';
    if (safe >= 1024) return (safe / 1024).toFixed(1) + ' KB';
    return safe + ' B';
  };
  const fmtMs = (ms: number) => {
    const safe = safeNum(ms);
    return safe >= 1000 ? `${(safe / 1000).toFixed(1)}s` : `${Math.round(safe)}ms`;
  };
  const fmtUpdatedAt = (value?: string) => {
    if (!value) return '暂无更新';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '暂无更新';
    return date.toLocaleTimeString('zh-CN', { hour12: false });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-8 w-40" />
          <SkeletonBlock className="h-8 w-20" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#1A1A1E] rounded-xl border border-white/[0.06] p-5">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <SkeletonBlock className="h-3 w-16" />
                  <SkeletonBlock className="h-8 w-24" />
                </div>
                <SkeletonBlock className="h-10 w-10 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-[#1A1A1E] rounded-xl border border-white/[0.06] p-5 space-y-4">
              <SkeletonBlock className="h-5 w-24" />
              {[...Array(3)].map((_, j) => (
                <SkeletonBlock key={j} className="h-16 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !stats && !userStats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-red-400 font-medium">{error}</p>
        <button
          onClick={() => {
            loadDashboardData();
            loadRealtimeStats();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white text-sm transition-colors border border-white/[0.06] shadow-md shadow-black/20"
        >
          <RefreshCw className="w-4 h-4" />重试
        </button>
      </div>
    );
  }

  const successRate = safeNum(stats?.authentication?.successRate).toFixed(1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">管理仪表板</h2>
          <p className="text-gray-400 text-sm mt-0.5">系统运行概览与核心指标</p>
        </div>
        <button
          onClick={() => {
            loadDashboardData();
            loadRealtimeStats();
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg text-gray-200 hover:text-white text-sm transition-colors border border-white/[0.06] shadow-md shadow-black/20"
        >
          <RefreshCw className="w-4 h-4" />刷新
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm text-amber-300">部分数据加载失败，显示的数据可能不完整</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="总用户数"
          value={fmt(userStats?.totalUsers || 0)}
          subtitle={`活跃 ${fmt(userStats?.activeUsers || 0)}`}
          icon={<Users className="w-5 h-5" />}
          variant="blue"
        />
        <StatCard
          title="VIP 会员"
          value={fmt(userStats?.vipUsers || 0)}
          subtitle={`近30天注册 ${fmt(userStats?.recentRegistrations || 0)}`}
          icon={<Crown className="w-5 h-5" />}
          variant="amber"
        />
        <StatCard
          title="总任务数"
          value={fmt(stats?.tasks?.total || 0)}
          subtitle={`API 调用 ${fmt(stats?.api?.totalCalls || 0)}`}
          icon={<Zap className="w-5 h-5" />}
          variant="purple"
        />
        <StatCard
          title="积分交易"
          value={fmt(stats?.points?.totalTransactions || 0)}
          subtitle={`登录成功率 ${successRate}%`}
          icon={<Coins className="w-5 h-5" />}
          variant="green"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-[#1A1A1E] rounded-xl border border-white/[0.06] p-5 xl:col-span-1">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">实时在线人数</h3>
                <p className="text-gray-400 text-xs">最近 5 分钟活跃</p>
              </div>
            </div>
            <span className="text-[11px] text-gray-400">{fmtUpdatedAt(realtimeStats?.online.updatedAt)}</span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-4xl font-bold text-white">{fmt(realtimeStats?.online.activeUsers5m || 0)}</p>
              <p className="text-sm text-gray-400 mt-2">已登录活跃 {fmt(realtimeStats?.online.authenticatedUsers5m || 0)} 人</p>
            </div>
            <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
              {realtimeError ? '数据延迟' : '实时更新'}
            </div>
          </div>
          {realtimeError && <p className="text-xs text-amber-300 mt-4">实时数据暂不可用：{realtimeError}</p>}
        </div>

        <div className="bg-[#1A1A1E] rounded-xl border border-white/[0.06] p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-500/10">
                <Zap className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">大模型 API 调用监控</h3>
                <p className="text-gray-400 text-xs">近 5 分钟实时指标与模型排行</p>
              </div>
            </div>
            <span className="text-[11px] text-gray-400">15 秒自动刷新</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
            {[
              { label: '近5分钟', value: fmt(realtimeStats?.api.calls5m || 0), color: 'text-purple-300' },
              { label: '今日调用', value: fmt(realtimeStats?.api.callsToday || 0), color: 'text-cyan-300' },
              { label: '成功率', value: `${safeNum(realtimeStats?.api.successRate5m).toFixed(1)}%`, color: 'text-emerald-300' },
              { label: '失败数', value: fmt(realtimeStats?.api.failed5m || 0), color: 'text-red-300' },
              { label: '平均耗时', value: fmtMs(realtimeStats?.api.avgLatencyMs5m || 0), color: 'text-amber-300' },
              { label: '积分消耗', value: fmt(realtimeStats?.api.pointsCost5m || 0), color: 'text-green-300' },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                <p className="text-[11px] text-gray-400">{item.label}</p>
                <p className={`text-lg font-bold mt-1 ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-white/[0.06]">
                  <th className="text-left py-2 font-medium">模型</th>
                  <th className="text-left py-2 font-medium">服务商</th>
                  <th className="text-right py-2 font-medium">近5分钟</th>
                  <th className="text-right py-2 font-medium">今日</th>
                  <th className="text-right py-2 font-medium">成功率</th>
                  <th className="text-right py-2 font-medium">耗时</th>
                  <th className="text-right py-2 font-medium">积分</th>
                </tr>
              </thead>
              <tbody>
                {(realtimeStats?.models || []).length > 0 ? (realtimeStats?.models || []).slice(0, 6).map((item) => (
                  <tr key={`${item.provider}-${item.model}`} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-2 text-white max-w-[180px] truncate">{item.model}</td>
                    <td className="py-2 text-gray-300">{item.provider}</td>
                    <td className="py-2 text-right text-purple-300">{fmt(item.calls5m)}</td>
                    <td className="py-2 text-right text-cyan-300">{fmt(item.callsToday)}</td>
                    <td className="py-2 text-right text-emerald-300">{safeNum(item.successRate5m).toFixed(1)}%</td>
                    <td className="py-2 text-right text-amber-300">{fmtMs(item.avgLatencyMs5m)}</td>
                    <td className="py-2 text-right text-green-300">{fmt(item.pointsCost5m)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-gray-400">暂无近 5 分钟大模型调用</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1A1A1E] rounded-xl border border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-gray-500/10">
              <Users className="w-4 h-4 text-gray-400" />
            </div>
            <h3 className="text-white font-semibold text-sm">用户概览</h3>
          </div>
          <div className="space-y-3">
            {[
              { icon: <Users className="w-5 h-5 text-emerald-400" />, bg: 'bg-emerald-500/15', label: '活跃用户', sub: '当前活跃', value: fmt(stats?.users?.active || 0), color: 'text-emerald-400' },
              { icon: <Shield className="w-5 h-5 text-red-400" />, bg: 'bg-red-500/15', label: '非活跃用户', sub: '已禁用', value: fmt(stats?.users?.inactive || 0), color: 'text-red-400' },
              { icon: <HardDrive className="w-5 h-5 text-cyan-400" />, bg: 'bg-cyan-500/15', label: '用户文件', sub: fmtSize(stats?.files?.totalSize || 0), value: fmt(stats?.files?.count || 0), color: 'text-cyan-400' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center`}>{item.icon}</div>
                  <div>
                    <p className="text-white text-sm font-medium">{item.label}</p>
                    <p className="text-gray-300 text-xs">{item.sub}</p>
                  </div>
                </div>
                <span className={`text-xl font-bold ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#1A1A1E] rounded-xl border border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-violet-500/10">
              <Activity className="w-4 h-4 text-violet-400" />
            </div>
            <h3 className="text-white font-semibold text-sm">认证统计</h3>
          </div>
          <div className="space-y-3">
            {[
              { icon: <Activity className="w-5 h-5 text-emerald-400" />, bg: 'bg-emerald-500/15', label: '成功登录', sub: '总次数', value: fmt(stats?.authentication?.successful || 0), color: 'text-emerald-400' },
              { icon: <AlertCircle className="w-5 h-5 text-red-400" />, bg: 'bg-red-500/15', label: '失败登录', sub: '总次数', value: fmt(stats?.authentication?.failed || 0), color: 'text-red-400' },
              { icon: <Coins className="w-5 h-5 text-amber-400" />, bg: 'bg-amber-500/15', label: '积分交易', sub: '总记录', value: fmt(stats?.points?.totalTransactions || 0), color: 'text-amber-400' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center`}>{item.icon}</div>
                  <div>
                    <p className="text-white text-sm font-medium">{item.label}</p>
                    <p className="text-gray-600 text-xs">{item.sub}</p>
                  </div>
                </div>
                <span className={`text-xl font-bold ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#1A1A1E] rounded-xl border border-white/[0.06] p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-cyan-500/10">
            <FileText className="w-4 h-4 text-cyan-400" />
          </div>
          <h3 className="text-white font-semibold text-sm">系统资源</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: <Zap className="w-6 h-6 text-purple-400" />, value: fmt(stats?.tasks?.total || 0), label: '总任务', bg: 'bg-purple-500/10' },
            { icon: <Activity className="w-6 h-6 text-gray-400" />, value: fmt(stats?.api?.totalCalls || 0), label: 'API 调用', bg: 'bg-gray-500/10' },
            { icon: <Image className="w-6 h-6 text-emerald-400" />, value: fmt(stats?.files?.count || 0), label: '用户文件', bg: 'bg-emerald-500/10' },
            { icon: <Coins className="w-6 h-6 text-amber-400" />, value: fmt(stats?.points?.totalTransactions || 0), label: '积分交易', bg: 'bg-amber-500/10' },
          ].map((item, i) => (
            <div key={i} className="text-center p-4 bg-white/[0.03] rounded-xl hover:bg-white/[0.05] transition-colors">
              <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center mx-auto mb-3`}>
                {item.icon}
              </div>
              <p className="text-xl font-bold text-white">{item.value}</p>
              <p className="text-gray-300 text-xs mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
