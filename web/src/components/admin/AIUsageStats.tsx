import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, Users, Image, Video, Music, Activity, DollarSign, Search, RefreshCw, ChevronLeft, ChevronRight, Trash2, AlertTriangle, X } from 'lucide-react';
import {
  adminAiUsageService,
  type DailyTrend,
  type OverviewData,
  type ProviderStat,
  type TopUser,
  type UsageRecord,
} from '@/services/admin';

const fmt = (n: number) => {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString();
};

const fmtCost = (n: number) => {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};

const fmtTokens = (n: number) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};

const typeIcon = (type: string) => {
  switch (type) {
    case 'image': return <Image size={14} />;
    case 'video': return <Video size={14} />;
    case 'audio': return <Music size={14} />;
    case 'music': return <Music size={14} />;
    default: return <Activity size={14} />;
  }
};

const typeColor = (type: string) => {
  switch (type) {
    case 'image': return '#3b82f6';
    case 'video': return '#8b5cf6';
    case 'audio': return '#10b981';
    case 'music': return '#f59e0b';
    default: return '#6b7280';
  }
};

const statusBadge = (status: string) => {
  const colors: Record<string, string> = {
    completed: '#10b981',
    processing: '#3b82f6',
    pending: '#f59e0b',
    failed: '#ef4444',
    cancelled: '#6b7280',
  };
  const bgColors: Record<string, string> = {
    completed: 'rgba(16,185,129,0.15)',
    processing: 'rgba(59,130,246,0.15)',
    pending: 'rgba(245,158,11,0.15)',
    failed: 'rgba(239,68,68,0.15)',
    cancelled: 'rgba(107,114,128,0.15)',
  };
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 600,
      color: colors[status] || '#6b7280',
      background: bgColors[status] || 'rgba(107,114,128,0.15)',
    }}>
      {status}
    </span>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string; color: string }> = ({ icon, label, value, sub, color }) => (
  <div style={{
    background: 'var(--bg2, #1a1d27)',
    border: '1px solid var(--rule, #2a2d3a)',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ color, display: 'flex' }}>{icon}</div>
      <span style={{ fontSize: '12px', color: 'var(--muted, #8b8d97)' }}>{label}</span>
    </div>
    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink, #e4e4e7)' }}>{value}</div>
    {sub && <div style={{ fontSize: '11px', color: 'var(--muted, #8b8d97)' }}>{sub}</div>}
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode; right?: React.ReactNode }> = ({ title, children, right }) => (
  <div style={{ marginBottom: '24px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>{title}</h3>
      {right}
    </div>
    {children}
  </div>
);

const AIUsageStats: React.FC = () => {
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [providers, setProviders] = useState<ProviderStat[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [trend, setTrend] = useState<DailyTrend[]>([]);

  // Records state
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [recordPage, setRecordPage] = useState(1);
  const [recordTotal, setRecordTotal] = useState(0);
  const [recordTotalPages, setRecordTotalPages] = useState(0);
  const [recordFilter, setRecordFilter] = useState({ type: '', provider: '', status: '', search: '' });

  // 清除记录弹窗 state
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearScope, setClearScope] = useState<'all' | 'tasks' | 'api_calls'>('all');
  const [clearBeforeDays, setClearBeforeDays] = useState<number>(30);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleClearRecords = async () => {
    setClearing(true);
    setClearResult(null);
    try {
      const before = new Date();
      before.setDate(before.getDate() - clearBeforeDays);
      const resp = await adminAiUsageService.clearRecords({
        before: before.toISOString(),
        scope: clearScope,
      });
      if (resp.success) {
        setClearResult({
          success: true,
          message: resp.message || `已清除 ${resp.data?.deletedTasks || 0} 条任务记录, ${resp.data?.deletedApiCalls || 0} 条 API 调用记录`,
        });
        // 清除后重新拉取数据
        setTimeout(() => {
          setShowClearModal(false);
          setClearResult(null);
          fetchData();
        }, 1800);
      } else {
        setClearResult({ success: false, message: '清除失败' });
      }
    } catch (e) {
      setClearResult({
        success: false,
        message: e instanceof Error ? e.message : '清除失败',
      });
    } finally {
      setClearing(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, pv, tu, td] = await Promise.all([
        adminAiUsageService.getOverview(days),
        adminAiUsageService.getByProvider(days),
        adminAiUsageService.getTopUsers(days, 20),
        adminAiUsageService.getDailyTrend(days),
      ]);
      if (ov.success) setOverview(ov.data);
      if (pv.success) setProviders(pv.data);
      if (tu.success) setTopUsers(tu.data);
      if (td.success) setTrend(td.data);
    } catch (e) {
      console.error('Failed to fetch AI usage stats:', e);
    } finally {
      setLoading(false);
    }
  }, [days]);

  const fetchRecords = useCallback(async () => {
    try {
      const data = await adminAiUsageService.getRecords({
        page: recordPage,
        pageSize: 15,
        ...Object.fromEntries(Object.entries(recordFilter).filter(([, v]) => v)),
      });
      if (data.success) {
        setRecords(data.data.records);
        setRecordTotal(data.data.pagination.total);
        setRecordTotalPages(data.data.pagination.totalPages);
      }
    } catch (e) {
      console.error('Failed to fetch records:', e);
    }
  }, [recordPage, recordFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Simple bar chart for trend
  const maxDaily = Math.max(...trend.map(d => d.images + d.videos + d.audio + d.music), 1);

  return (
    <div style={{ padding: '20px', color: 'var(--ink, #e4e4e7)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>AI 使用统计</h2>
          <p style={{ fontSize: '13px', color: 'var(--muted, #8b8d97)', marginTop: '4px' }}>
            大模型 API 调用情况、用户生成记录与服务商使用详情
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {[7, 14, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid var(--rule, #2a2d3a)',
                background: days === d ? 'var(--accent, #3b82f6)' : 'var(--bg2, #1a1d27)',
                color: days === d ? '#fff' : 'var(--muted, #8b8d97)',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {d}天
            </button>
          ))}
          <button onClick={fetchData} style={{
            padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--rule, #2a2d3a)',
            background: 'var(--bg2, #1a1d27)', color: 'var(--muted, #8b8d97)', cursor: 'pointer',
          }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
          <button
            onClick={() => { setShowClearModal(true); setClearResult(null); }}
            style={{
              padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer',
              fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px',
            }}
            title="清除以前的使用记录"
          >
            <Trash2 size={13} /> 清除记录
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <StatCard icon={<Image size={16} />} label="图片生成" value={fmt(overview?.tasks.images || 0)} color="#3b82f6" />
        <StatCard icon={<Video size={16} />} label="视频生成" value={fmt(overview?.tasks.videos || 0)} color="#8b5cf6" />
        <StatCard icon={<Music size={16} />} label="音频生成" value={fmt((overview?.tasks.audio || 0) + (overview?.tasks.music || 0))} color="#10b981" />
        <StatCard icon={<Activity size={16} />} label="总任务数" value={fmt(overview?.tasks.total || 0)} color="#f59e0b" />
        <StatCard icon={<DollarSign size={16} />} label="API 调用" value={fmt(overview?.apiCalls.total || 0)} sub={`Token: ${fmtTokens((overview?.apiCalls.inputTokens || 0) + (overview?.apiCalls.outputTokens || 0))}`} color="#06b6d4" />
        <StatCard icon={<TrendingUp size={16} />} label="积分消耗" value={fmt(overview?.tasks.totalCredits || 0)} sub={`费用: ${fmtCost(overview?.apiCalls.totalCost || 0)}`} color="#ef4444" />
      </div>

      {/* Daily Trend Chart */}
      <Section title="每日生成趋势">
        <div style={{
          background: 'var(--bg2, #1a1d27)',
          border: '1px solid var(--rule, #2a2d3a)',
          borderRadius: '10px',
          padding: '16px',
        }}>
          {trend.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted, #8b8d97)' }}>暂无数据</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '180px', overflowX: 'auto' }}>
              {trend.map(d => {
                const total = d.images + d.videos + d.audio + d.music;
                const heightPct = (total / maxDaily) * 100;
                return (
                  <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '40px', flex: 1 }}>
                    <div style={{ fontSize: '10px', color: 'var(--muted, #8b8d97)', marginBottom: '4px' }}>{total}</div>
                    <div style={{
                      width: '100%',
                      maxWidth: '32px',
                      height: `${heightPct * 1.4}px`,
                      minHeight: '2px',
                      borderRadius: '3px 3px 0 0',
                      display: 'flex',
                      flexDirection: 'column-reverse',
                      overflow: 'hidden',
                    }}>
                      {d.images > 0 && <div style={{ height: `${(d.images / total) * 100}%`, background: '#3b82f6' }} />}
                      {d.videos > 0 && <div style={{ height: `${(d.videos / total) * 100}%`, background: '#8b5cf6' }} />}
                      {d.audio > 0 && <div style={{ height: `${(d.audio / total) * 100}%`, background: '#10b981' }} />}
                      {d.music > 0 && <div style={{ height: `${(d.music / total) * 100}%`, background: '#f59e0b' }} />}
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--muted, #8b8d97)', marginTop: '4px', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                      {d.date.slice(5)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px', fontSize: '11px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#3b82f6' }} />图片</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#8b5cf6' }} />视频</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10b981' }} />音频</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f59e0b' }} />音乐</span>
          </div>
        </div>
      </Section>

      {/* Provider Stats Table */}
      <Section title="AI 服务商使用详情">
        <div style={{
          background: 'var(--bg2, #1a1d27)',
          border: '1px solid var(--rule, #2a2d3a)',
          borderRadius: '10px',
          overflow: 'auto',
          maxHeight: '400px',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg2, #1a1d27)', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid var(--rule, #2a2d3a)' }}>
                <th style={{ padding: '10px', textAlign: 'left', color: 'var(--muted, #8b8d97)', fontWeight: 600 }}>服务商</th>
                <th style={{ padding: '10px', textAlign: 'center', color: 'var(--muted, #8b8d97)', fontWeight: 600 }}>任务数</th>
                <th style={{ padding: '10px', textAlign: 'center', color: '#3b82f6', fontWeight: 600 }}>图片</th>
                <th style={{ padding: '10px', textAlign: 'center', color: '#8b5cf6', fontWeight: 600 }}>视频</th>
                <th style={{ padding: '10px', textAlign: 'center', color: '#10b981', fontWeight: 600 }}>音频</th>
                <th style={{ padding: '10px', textAlign: 'center', color: 'var(--muted, #8b8d97)', fontWeight: 600 }}>API调用</th>
                <th style={{ padding: '10px', textAlign: 'center', color: 'var(--muted, #8b8d97)', fontWeight: 600 }}>Token</th>
                <th style={{ padding: '10px', textAlign: 'center', color: 'var(--muted, #8b8d97)', fontWeight: 600 }}>模型数</th>
                <th style={{ padding: '10px', textAlign: 'center', color: '#ef4444', fontWeight: 600 }}>积分</th>
                <th style={{ padding: '10px', textAlign: 'center', color: '#06b6d4', fontWeight: 600 }}>费用</th>
              </tr>
            </thead>
            <tbody>
              {providers.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted, #8b8d97)' }}>暂无数据</td></tr>
              ) : providers.map(p => (
                <tr key={p.provider} style={{ borderBottom: '1px solid var(--rule, #2a2d3a)' }}>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{p.provider}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{fmt(p.taskCount)}</td>
                  <td style={{ padding: '10px', textAlign: 'center', color: '#3b82f6' }}>{p.imageCount || '-'}</td>
                  <td style={{ padding: '10px', textAlign: 'center', color: '#8b5cf6' }}>{p.videoCount || '-'}</td>
                  <td style={{ padding: '10px', textAlign: 'center', color: '#10b981' }}>{(p.audioCount || 0) + (p.musicCount || 0) || '-'}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{fmt(p.apiCalls)}</td>
                  <td style={{ padding: '10px', textAlign: 'center', fontSize: '11px' }}>{fmtTokens(p.inputTokens + p.outputTokens)}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{p.modelCount}</td>
                  <td style={{ padding: '10px', textAlign: 'center', color: '#ef4444' }}>{fmt(p.pointsCost)}</td>
                  <td style={{ padding: '10px', textAlign: 'center', color: '#06b6d4' }}>{fmtCost(p.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Top Users */}
      <Section title="用户使用排行 TOP 20">
        <div style={{
          background: 'var(--bg2, #1a1d27)',
          border: '1px solid var(--rule, #2a2d3a)',
          borderRadius: '10px',
          overflow: 'auto',
          maxHeight: '400px',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg2, #1a1d27)', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid var(--rule, #2a2d3a)' }}>
                <th style={{ padding: '10px', textAlign: 'left', color: 'var(--muted, #8b8d97)', fontWeight: 600 }}>#</th>
                <th style={{ padding: '10px', textAlign: 'left', color: 'var(--muted, #8b8d97)', fontWeight: 600 }}>用户</th>
                <th style={{ padding: '10px', textAlign: 'left', color: 'var(--muted, #8b8d97)', fontWeight: 600 }}>邮箱</th>
                <th style={{ padding: '10px', textAlign: 'center', color: 'var(--muted, #8b8d97)', fontWeight: 600 }}>会员</th>
                <th style={{ padding: '10px', textAlign: 'center', color: 'var(--muted, #8b8d97)', fontWeight: 600 }}>总任务</th>
                <th style={{ padding: '10px', textAlign: 'center', color: '#3b82f6', fontWeight: 600 }}>图片</th>
                <th style={{ padding: '10px', textAlign: 'center', color: '#8b5cf6', fontWeight: 600 }}>视频</th>
                <th style={{ padding: '10px', textAlign: 'center', color: '#10b981', fontWeight: 600 }}>音频</th>
                <th style={{ padding: '10px', textAlign: 'center', color: '#ef4444', fontWeight: 600 }}>积分消耗</th>
                <th style={{ padding: '10px', textAlign: 'center', color: 'var(--muted, #8b8d97)', fontWeight: 600 }}>余额</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted, #8b8d97)' }}>暂无数据</td></tr>
              ) : topUsers.map((u, i) => (
                <tr key={u.userId} style={{ borderBottom: '1px solid var(--rule, #2a2d3a)' }}>
                  <td style={{ padding: '10px', color: 'var(--muted, #8b8d97)' }}>{i + 1}</td>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{u.username}</td>
                  <td style={{ padding: '10px', fontSize: '11px', color: 'var(--muted, #8b8d97)' }}>{u.email}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '11px',
                      background: u.membershipLevel === 'professional' ? 'rgba(139,92,246,0.15)' : 'rgba(107,114,128,0.15)',
                      color: u.membershipLevel === 'professional' ? '#8b5cf6' : '#6b7280',
                    }}>
                      {u.membershipLevel}
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 600 }}>{fmt(u.totalTasks)}</td>
                  <td style={{ padding: '10px', textAlign: 'center', color: '#3b82f6' }}>{u.images || '-'}</td>
                  <td style={{ padding: '10px', textAlign: 'center', color: '#8b5cf6' }}>{u.videos || '-'}</td>
                  <td style={{ padding: '10px', textAlign: 'center', color: '#10b981' }}>{(u.audio || 0) + (u.music || 0) || '-'}</td>
                  <td style={{ padding: '10px', textAlign: 'center', color: '#ef4444' }}>{fmt(u.totalCredits)}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{fmt(u.pointsBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Generation Records */}
      <Section
        title="生成记录详情"
        right={
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              value={recordFilter.type}
              onChange={e => { setRecordFilter(f => ({ ...f, type: e.target.value })); setRecordPage(1); }}
              style={{ padding: '4px 8px', borderRadius: '6px', background: 'var(--bg2, #1a1d27)', color: 'var(--ink, #e4e4e7)', border: '1px solid var(--rule, #2a2d3a)', fontSize: '12px' }}
            >
              <option value="">全部类型</option>
              <option value="image">图片</option>
              <option value="video">视频</option>
              <option value="audio">音频</option>
              <option value="music">音乐</option>
            </select>
            <select
              value={recordFilter.status}
              onChange={e => { setRecordFilter(f => ({ ...f, status: e.target.value })); setRecordPage(1); }}
              style={{ padding: '4px 8px', borderRadius: '6px', background: 'var(--bg2, #1a1d27)', color: 'var(--ink, #e4e4e7)', border: '1px solid var(--rule, #2a2d3a)', fontSize: '12px' }}
            >
              <option value="">全部状态</option>
              <option value="completed">已完成</option>
              <option value="processing">处理中</option>
              <option value="pending">等待中</option>
              <option value="failed">失败</option>
            </select>
            <input
              type="text"
              placeholder="搜索用户/提示词..."
              value={recordFilter.search}
              onChange={e => { setRecordFilter(f => ({ ...f, search: e.target.value })); setRecordPage(1); }}
              style={{ padding: '4px 10px', borderRadius: '6px', background: 'var(--bg2, #1a1d27)', color: 'var(--ink, #e4e4e7)', border: '1px solid var(--rule, #2a2d3a)', fontSize: '12px', width: '160px' }}
            />
          </div>
        }
      >
        <div style={{
          background: 'var(--bg2, #1a1d27)',
          border: '1px solid var(--rule, #2a2d3a)',
          borderRadius: '10px',
          overflow: 'auto',
          maxHeight: '500px',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg2, #1a1d27)', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid var(--rule, #2a2d3a)' }}>
                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--muted, #8b8d97)', fontWeight: 600 }}>用户</th>
                <th style={{ padding: '8px', textAlign: 'center', color: 'var(--muted, #8b8d97)', fontWeight: 600 }}>类型</th>
                <th style={{ padding: '8px', textAlign: 'center', color: 'var(--muted, #8b8d97)', fontWeight: 600 }}>状态</th>
                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--muted, #8b8d97)', fontWeight: 600 }}>服务商/模型</th>
                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--muted, #8b8d97)', fontWeight: 600 }}>提示词</th>
                <th style={{ padding: '8px', textAlign: 'center', color: 'var(--muted, #8b8d97)', fontWeight: 600 }}>积分</th>
                <th style={{ padding: '8px', textAlign: 'center', color: 'var(--muted, #8b8d97)', fontWeight: 600 }}>耗时</th>
                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--muted, #8b8d97)', fontWeight: 600 }}>时间</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted, #8b8d97)' }}>暂无记录</td></tr>
              ) : records.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--rule, #2a2d3a)' }}>
                  <td style={{ padding: '8px' }}>
                    <div style={{ fontWeight: 600 }}>{r.username}</div>
                    <div style={{ fontSize: '10px', color: 'var(--muted, #8b8d97)' }}>{r.membershipLevel}</div>
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <span style={{ color: typeColor(r.type), display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                      {typeIcon(r.type)} {r.type}
                    </span>
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>{statusBadge(r.status)}</td>
                  <td style={{ padding: '8px' }}>
                    <div style={{ fontWeight: 600 }}>{r.provider}</div>
                    <div style={{ fontSize: '10px', color: 'var(--muted, #8b8d97)' }}>{r.model}</div>
                  </td>
                  <td style={{ padding: '8px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted, #8b8d97)' }}>
                    {r.prompt || '-'}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', color: '#ef4444' }}>{r.credits || '-'}</td>
                  <td style={{ padding: '8px', textAlign: 'center', color: 'var(--muted, #8b8d97)' }}>
                    {r.duration > 0 ? `${r.duration}s` : '-'}
                  </td>
                  <td style={{ padding: '8px', fontSize: '11px', color: 'var(--muted, #8b8d97)' }}>
                    {new Date(r.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted, #8b8d97)' }}>
            共 {fmt(recordTotal)} 条记录，第 {recordPage}/{recordTotalPages} 页
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setRecordPage(p => Math.max(1, p - 1))}
              disabled={recordPage <= 1}
              style={{
                padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--rule, #2a2d3a)',
                background: 'var(--bg2, #1a1d27)', color: recordPage <= 1 ? 'var(--muted, #8b8d97)' : 'var(--ink, #e4e4e7)',
                cursor: recordPage <= 1 ? 'not-allowed' : 'pointer', fontSize: '12px',
              }}
            >
              上一页
            </button>
            <button
              onClick={() => setRecordPage(p => Math.min(recordTotalPages, p + 1))}
              disabled={recordPage >= recordTotalPages}
              style={{
                padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--rule, #2a2d3a)',
                background: 'var(--bg2, #1a1d27)', color: recordPage >= recordTotalPages ? 'var(--muted, #8b8d97)' : 'var(--ink, #e4e4e7)',
                cursor: recordPage >= recordTotalPages ? 'not-allowed' : 'pointer', fontSize: '12px',
              }}
            >
              下一页
            </button>
          </div>
        </div>
      </Section>

      {/* 清除记录确认弹窗 */}
      {showClearModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }} onClick={() => !clearing && setShowClearModal(false)}>
          <div
            style={{
              background: '#1a1d27', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '12px', padding: '20px', maxWidth: '440px', width: '90%',
              color: 'var(--ink, #e4e4e7)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} color="#ef4444" /> 清除 AI 使用统计记录
              </h3>
              <button
                onClick={() => !clearing && setShowClearModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--muted, #8b8d97)', cursor: 'pointer', padding: 0 }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--muted, #8b8d97)', marginBottom: '14px', lineHeight: 1.6 }}>
              此操作将永久删除指定时间之前的记录，<span style={{ color: '#ef4444' }}>不可恢复</span>。
            </div>

            {/* 范围选择 */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted, #8b8d97)', marginBottom: '6px' }}>清除范围</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {([
                  { v: 'all', label: '全部记录' },
                  { v: 'tasks', label: '仅任务记录' },
                  { v: 'api_calls', label: '仅 API 调用' },
                ] as const).map(opt => (
                  <button
                    key={opt.v}
                    onClick={() => setClearScope(opt.v)}
                    style={{
                      padding: '5px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                      border: `1px solid ${clearScope === opt.v ? '#3b82f6' : 'var(--rule, #2a2d3a)'}`,
                      background: clearScope === opt.v ? '#3b82f6' : 'var(--bg2, #1a1d27)',
                      color: clearScope === opt.v ? '#fff' : 'var(--muted, #8b8d97)',
                      fontWeight: 600,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 时间选择 */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted, #8b8d97)', marginBottom: '6px' }}>
                清除多少天前的记录
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[7, 30, 90, 180].map(d => (
                  <button
                    key={d}
                    onClick={() => setClearBeforeDays(d)}
                    style={{
                      padding: '5px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                      border: `1px solid ${clearBeforeDays === d ? '#3b82f6' : 'var(--rule, #2a2d3a)'}`,
                      background: clearBeforeDays === d ? '#3b82f6' : 'var(--bg2, #1a1d27)',
                      color: clearBeforeDays === d ? '#fff' : 'var(--muted, #8b8d97)',
                      fontWeight: 600,
                    }}
                  >
                    {d} 天前
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted, #8b8d97)', marginTop: '4px' }}>
                将删除创建时间早于 {clearBeforeDays} 天前的记录
              </div>
            </div>

            {clearResult && (
              <div style={{
                padding: '8px 10px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px',
                background: clearResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                color: clearResult.success ? '#10b981' : '#ef4444',
              }}>
                {clearResult.message}
              </div>
            )}

            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowClearModal(false)}
                disabled={clearing}
                style={{
                  padding: '7px 16px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                  border: '1px solid var(--rule, #2a2d3a)',
                  background: 'var(--bg2, #1a1d27)', color: 'var(--muted, #8b8d97)',
                  fontWeight: 600,
                }}
              >
                取消
              </button>
              <button
                onClick={handleClearRecords}
                disabled={clearing}
                style={{
                  padding: '7px 16px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                  border: '1px solid rgba(239,68,68,0.5)',
                  background: clearing ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.15)',
                  color: '#ef4444', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}
              >
                {clearing ? <RefreshCw size={12} className="spin" /> : <Trash2 size={12} />}
                确认清除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIUsageStats;
