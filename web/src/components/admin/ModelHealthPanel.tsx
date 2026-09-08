import React, { useState, useEffect, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  Key,
  DollarSign,
  Clock,
  AlertTriangle,
  XCircle,
  Ban,
  HelpCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Save,
  Eye,
  EyeOff,
  Loader2,
  Check,
  Bot,
  MessageSquare,
  Link as LinkIcon,
  Power,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  adminModelHealthService,
  type ApiKeyInfo,
  type HealthResponse,
  type HealthModelInfo,
  type TextModelHealth,
  type ProviderHealth,
} from '@/services/admin';
import { aiProviderService } from '@/services/admin/ai-provider-service';
import { modelRegistry } from '@/services/model-registry';
import { unifiedAIAdapter } from '@/services/unified-ai-adapter';

// ==================== 状态配置 ====================
const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string; bars: number }> = {
  healthy: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: <Wifi size={14} />, label: '连通', bars: 4 },
  invalid_key: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: <Key size={14} />, label: '密钥无效', bars: 0 },
  insufficient_balance: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: <DollarSign size={14} />, label: '欠费', bars: 0 },
  timeout: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: <Clock size={14} />, label: '超时', bars: 1 },
  unreachable: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: <WifiOff size={14} />, label: '未连通', bars: 0 },
  rate_limited: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: <AlertTriangle size={14} />, label: '限流', bars: 2 },
  error: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: <XCircle size={14} />, label: '错误', bars: 0 },
  no_key: { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: <Ban size={14} />, label: '无密钥', bars: 0 },
  unknown: { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: <HelpCircle size={14} />, label: '未知', bars: 0 },
};

const CATEGORY_LABELS: Record<string, string> = {
  gpt: 'GPT 系列',
  claude: 'Claude 系列',
  gemini: 'Gemini 系列',
  deepseek: 'DeepSeek 系列',
  glm: 'GLM 系列',
  minimax: 'MiniMax 系列',
  step: 'StepFun 系列',
  volcano: '火山引擎',
  other: '其他',
};

const CATEGORY_COLORS: Record<string, string> = {
  gpt: '#10a37f',
  claude: '#d97757',
  gemini: '#4285f4',
  deepseek: '#5b6eee',
  glm: '#3b82f6',
  minimax: '#f59e0b',
  step: '#8b5cf6',
  volcano: '#ef4444',
  other: '#6b7280',
};

// ==================== 信号条组件 ====================
const SignalBars: React.FC<{ status: string; latency: number }> = ({ status, latency }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  const activeBars = status === 'healthy'
    ? Math.max(1, 4 - Math.floor(latency / 500))
    : config.bars;

  return (
    <div className="flex items-end gap-0.5" style={{ height: '16px' }}>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-sm transition-all"
          style={{
            width: '3px',
            height: `${i * 4}px`,
            backgroundColor: i <= activeBars ? config.color : 'rgba(255,255,255,0.1)',
          }}
        />
      ))}
    </div>
  );
};

// ==================== 服务商配置弹窗（模型/地址/秘钥） ====================
const KeyEditModal: React.FC<{
  provider: ProviderHealth;
  onSaveKey: (envVar: string, apiKey: string) => Promise<boolean>;
  onSaveEndpoint: (providerId: string, endpoint: string) => Promise<boolean>;
  onToggleModel: (providerId: string, modelId: string) => Promise<boolean>;
  onClose: () => void;
}> = ({ provider, onSaveKey, onSaveEndpoint, onToggleModel, onClose }) => {
  const [editingEnv, setEditingEnv] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [showValue, setShowValue] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);

  // endpoint 编辑状态
  const [endpointInput, setEndpointInput] = useState(provider.endpoint || '');
  const [editingEndpoint, setEditingEndpoint] = useState(false);
  const [savingEndpoint, setSavingEndpoint] = useState(false);

  // 模型 toggle loading 状态
  const [togglingModel, setTogglingModel] = useState<string | null>(null);
  // 本地模型列表（用于立即反映 toggle 状态）
  const [localModels, setLocalModels] = useState<HealthModelInfo[]>(provider.models || []);

  const handleSaveKey = async () => {
    if (!editingEnv || !inputValue) return;
    setSaving(true);
    const ok = await onSaveKey(editingEnv, inputValue);
    setSaving(false);
    if (ok) {
      setSaveResult({ success: true, message: '密钥已更新' });
      setInputValue('');
      setEditingEnv(null);
      setTimeout(() => setSaveResult(null), 2000);
    } else {
      setSaveResult({ success: false, message: '密钥更新失败' });
    }
  };

  const handleSaveEndpoint = async () => {
    if (!endpointInput || endpointInput === provider.endpoint) {
      setEditingEndpoint(false);
      return;
    }
    setSavingEndpoint(true);
    const ok = await onSaveEndpoint(provider.providerId, endpointInput);
    setSavingEndpoint(false);
    if (ok) {
      setSaveResult({ success: true, message: '地址已更新' });
      setEditingEndpoint(false);
      setTimeout(() => setSaveResult(null), 2000);
    } else {
      setSaveResult({ success: false, message: '地址更新失败' });
    }
  };

  const handleToggleModel = async (modelId: string) => {
    setTogglingModel(modelId);
    const ok = await onToggleModel(provider.providerId, modelId);
    setTogglingModel(null);
    if (ok) {
      // 立即反映到本地状态
      setLocalModels(prev =>
        prev.map(m => (m.id === modelId ? { ...m, isActive: !m.isActive } : m))
      );
      setSaveResult({ success: true, message: '模型状态已切换' });
      setTimeout(() => setSaveResult(null), 2000);
    } else {
      setSaveResult({ success: false, message: '模型切换失败' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#1a1a1f] border border-white/[0.08] rounded-2xl p-5 max-w-2xl w-full mx-4 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between sticky top-0 bg-[#1a1a1f] pb-2 -mt-1 z-10">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Key className="w-4 h-4" /> {provider.displayName} · 服务商配置
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        {/* 模型列表（含启用/关闭按钮） */}
        <div>
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5" /> 模型列表 ({localModels.length})
          </div>
          {localModels.length === 0 ? (
            <div className="text-xs text-gray-500 bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 text-center">
              暂无模型数据
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {localModels.map((m) => {
                const toggling = togglingModel === m.id;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border transition-colors',
                      m.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-white/[0.02] text-gray-500 border-white/[0.06]'
                    )}
                  >
                    <span className="font-mono">{m.id}</span>
                    <button
                      onClick={() => handleToggleModel(m.id)}
                      disabled={toggling}
                      className={cn(
                        'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border transition-colors',
                        m.isActive
                          ? 'bg-emerald-500/20 border-emerald-500/30 hover:bg-emerald-500/30'
                          : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08]',
                        toggling && 'opacity-50 cursor-wait'
                      )}
                      title={m.isActive ? '点击关闭' : '点击启用'}
                    >
                      {toggling ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <Power className="w-2.5 h-2.5" />
                      )}
                      {m.isActive ? '已启用' : '已关闭'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* API 地址 */}
        <div>
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5" /> API 地址
          </div>
          {editingEndpoint ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={endpointInput}
                onChange={(e) => setEndpointInput(e.target.value)}
                placeholder="https://api.example.com/v1/models"
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white font-mono placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                autoFocus
              />
              <button
                onClick={handleSaveEndpoint}
                disabled={savingEndpoint || !endpointInput}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-50"
              >
                {savingEndpoint ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                保存
              </button>
              <button
                onClick={() => { setEditingEndpoint(false); setEndpointInput(provider.endpoint || ''); }}
                className="px-2 py-1 rounded-lg text-xs bg-white/[0.04] text-gray-400 border border-white/[0.06]"
              >
                取消
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg p-2.5">
              <code className="flex-1 text-xs text-blue-400 font-mono break-all">
                {provider.endpoint || '(未配置)'}
              </code>
              <button
                onClick={() => setEditingEndpoint(true)}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 shrink-0"
              >
                <LinkIcon className="w-3 h-3" /> 修改地址
              </button>
            </div>
          )}
        </div>

        {/* API 秘钥 */}
        <div>
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5" /> API 秘钥 ({provider.apiKeys.length})
          </div>
          <div className="space-y-2">
            {provider.apiKeys.map((k) => (
              <div key={k.env} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <code className="text-xs text-blue-400 font-mono">{k.env}</code>
                  {k.configured ? (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> 已配置
                    </span>
                  ) : (
                    <span className="text-[10px] text-red-400">未配置</span>
                  )}
                </div>
                {k.preview && (
                  <div className="text-xs text-gray-400 font-mono mb-2">{k.preview}</div>
                )}
                {editingEnv === k.env ? (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showValue ? 'text' : 'password'}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="输入新密钥..."
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 pr-8 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                        autoFocus
                      />
                      <button
                        onClick={() => setShowValue(!showValue)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                      >
                        {showValue ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <button
                      onClick={handleSaveKey}
                      disabled={saving || !inputValue}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      保存
                    </button>
                    <button
                      onClick={() => { setEditingEnv(null); setInputValue(''); }}
                      className="px-2 py-1 rounded-lg text-xs bg-white/[0.04] text-gray-400 border border-white/[0.06]"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingEnv(k.env); setInputValue(''); setSaveResult(null); }}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Key className="w-3 h-3" /> 修改秘钥
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {saveResult && (
          <div className={cn(
            'flex items-center gap-2 p-2 rounded-lg text-xs',
            saveResult.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          )}>
            {saveResult.success ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {saveResult.message}
          </div>
        )}

        <p className="text-[11px] text-gray-500">
          模型开关、地址与秘钥修改后会同步写入数据库与 .env 文件。模型开关即时生效，秘钥修改需要重启后端使 SDK 重新初始化。
        </p>
      </div>
    </div>
  );
};

// ==================== 主组件 ====================
const ModelHealthPanel: React.FC = () => {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['gpt', 'claude', 'gemini']));
  // 当前选中的 provider（用于打开配置弹窗）
  const [selectedProvider, setSelectedProvider] = useState<ProviderHealth | null>(null);
  // 当前选中的文本模型（用于打开秘钥弹窗）
  const [textKeyTarget, setTextKeyTarget] = useState<TextModelHealth | null>(null);
  const [activeTab, setActiveTab] = useState<'providers' | 'text'>('providers');

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await adminModelHealthService.check();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || '检测失败');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const handleUpdateKey = async (envVar: string, apiKey: string): Promise<boolean> => {
    try {
      const json = await adminModelHealthService.updateKey(envVar, apiKey);
      return json.success;
    } catch {
      return false;
    }
  };

  // 更新 Provider endpoint 地址
  const handleUpdateEndpoint = async (providerId: string, endpoint: string): Promise<boolean> => {
    try {
      const json = await adminModelHealthService.updateEndpoint(providerId, endpoint);
      if (json.success) {
        // 同步本地 data 中的 endpoint
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            providers: prev.providers.map(p =>
              p.providerId === providerId ? { ...p, endpoint } : p
            ),
          };
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // 切换模型启用/关闭状态（复用 ai-provider 的 toggle API）
  const handleToggleModel = async (providerId: string, modelId: string): Promise<boolean> => {
    try {
      const resp = await aiProviderService.toggleModel(providerId, modelId);
      if (resp.success) {
        // 同步前端模型注册表
        const providerName = selectedProvider?.provider as any;
        if (providerName) {
          modelRegistry.applyProviderModelStates(
            providerName,
            resp.data.models.map(m => ({ id: m.id, isActive: m.isActive }))
          );
        }
        await modelRegistry.refreshFromBackend();
        await unifiedAIAdapter.syncBackendModels();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const toggleProvider = (provider: string) => {
    setExpandedProviders(prev => {
      const next = new Set(prev);
      if (next.has(provider)) next.delete(provider);
      else next.add(provider);
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // 按类别分组文本模型
  const textModelsByCategory = React.useMemo(() => {
    if (!data?.textModels) return {};
    const grouped: Record<string, TextModelHealth[]> = {};
    for (const tm of data.textModels) {
      if (!grouped[tm.category]) grouped[tm.category] = [];
      grouped[tm.category].push(tm);
    }
    return grouped;
  }, [data]);

  const summary = data?.summary;

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">模型健康度</h3>
            <p className="text-xs text-gray-400">
              {summary ? `${summary.healthy}/${summary.total} 正常` : '加载中...'}
              {summary && summary.avgLatency > 0 && ` · 平均延迟 ${summary.avgLatency}ms`}
            </p>
          </div>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/[0.04] border border-white/[0.06] text-gray-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          {loading ? '检测中...' : '刷新检测'}
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-3">
          {[
            { label: '连通', value: summary.healthy, color: '#10b981' },
            { label: '密钥无效', value: summary.invalid_key, color: '#ef4444' },
            { label: '欠费', value: summary.insufficient_balance, color: '#f59e0b' },
            { label: '未连通', value: summary.unreachable + summary.timeout, color: '#ef4444' },
            { label: '无密钥', value: summary.no_key, color: '#6b7280' },
            { label: '错误', value: summary.error + summary.unknown, color: '#f59e0b' },
          ].map((s) => (
            <div key={s.label} className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2 text-center">
              <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Switch */}
      <div className="flex gap-1 px-3 pb-2">
        <button
          onClick={() => setActiveTab('providers')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            activeTab === 'providers'
              ? 'bg-white/10 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
          )}
        >
          <Bot className="w-3.5 h-3.5" />
          图片/视频服务商 ({data?.providers?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            activeTab === 'text'
              ? 'bg-white/10 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
          )}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          文本/对话模型 ({data?.textModels?.length || 0})
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mb-3 p-2 rounded-lg bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
          <XCircle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      )}

      {/* Provider List */}
      {activeTab === 'providers' && data && (
        <div className="px-3 pb-3 space-y-1.5">
          {data.providers.map((p) => {
            const config = STATUS_CONFIG[p.status] || STATUS_CONFIG.unknown;
            const isExpanded = expandedProviders.has(p.provider);
            return (
              <div key={p.provider} className="bg-white/[0.02] border border-white/[0.04] rounded-lg overflow-hidden">
                <div
                  className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-white/[0.02]"
                  onClick={() => toggleProvider(p.provider)}
                >
                  <SignalBars status={p.status} latency={p.latency} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-medium truncate">{p.displayName}</span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{ color: config.color, backgroundColor: config.bg }}
                      >
                        {config.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {p.message}
                      {p.latency > 0 && ` · ${p.latency}ms`}
                    </div>
                  </div>
                  {p.apiKeys.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedProvider(p); }}
                      className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-blue-400 transition-colors"
                      title="服务商配置（模型/地址/秘钥）"
                    >
                      <Key className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>

                {isExpanded && p.models.length > 0 && (
                  <div className="px-2.5 pb-2.5 pt-0">
                    <div className="flex flex-wrap gap-1">
                      {p.models.map((m) => (
                        <span
                          key={m.id}
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] border',
                            m.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10'
                              : 'bg-white/[0.02] text-gray-500 border-white/[0.06] line-through'
                          )}
                          title={m.isActive ? '已启用' : '已关闭'}
                        >
                          {m.id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {isExpanded && p.apiKeys.length > 0 && (
                  <div className="px-2.5 pb-2.5 pt-0 space-y-1">
                    {p.apiKeys.map((k) => (
                      <div key={k.env} className="flex items-center gap-2 text-[11px]">
                        <code className="text-blue-400 font-mono">{k.env}</code>
                        <span className={k.configured ? 'text-emerald-400' : 'text-red-400'}>
                          {k.configured ? `✓ ${k.preview}` : '✗ 未配置'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Text Models List */}
      {activeTab === 'text' && data && (
        <div className="px-3 pb-3 space-y-2">
          {Object.entries(textModelsByCategory).map(([cat, models]) => {
            const isExpanded = expandedCategories.has(cat);
            const catColor = CATEGORY_COLORS[cat] || '#6b7280';
            const catLabel = CATEGORY_LABELS[cat] || cat;
            const healthyCount = models.filter(m => m.status === 'healthy').length;

            return (
              <div key={cat} className="bg-white/[0.02] border border-white/[0.04] rounded-lg overflow-hidden">
                <div
                  className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-white/[0.02]"
                  onClick={() => toggleCategory(cat)}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: catColor }}
                  />
                  <div className="flex-1">
                    <span className="text-sm text-white font-medium">{catLabel}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {healthyCount}/{models.length} 连通
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>

                {isExpanded && (
                  <div className="px-2 pb-2 space-y-1">
                    {models.map((tm) => {
                      const config = STATUS_CONFIG[tm.status] || STATUS_CONFIG.unknown;
                      return (
                        <div
                          key={tm.model}
                          className="flex items-center gap-3 p-2 bg-white/[0.01] rounded-lg hover:bg-white/[0.03] transition-colors"
                        >
                          <SignalBars status={tm.status} latency={tm.latency} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-white font-medium">{tm.displayName}</span>
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                style={{ color: config.color, backgroundColor: config.bg }}
                              >
                                {config.label}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-400 truncate">
                              <code className="text-gray-500">{tm.model}</code>
                              {tm.latency > 0 && ` · ${tm.latency}ms`}
                              {tm.message && tm.status !== 'healthy' && ` · ${tm.message}`}
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-500 px-1.5 py-0.5 rounded bg-white/[0.04]">
                            {tm.provider}
                          </span>
                          {tm.apiKeys.length > 0 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setTextKeyTarget(tm); }}
                              className="p-1 rounded hover:bg-white/[0.06] text-gray-400 hover:text-blue-400 transition-colors"
                              title="修改密钥"
                            >
                              <Key className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 服务商配置弹窗（模型/地址/秘钥） */}
      {selectedProvider && (
        <KeyEditModal
          provider={selectedProvider}
          onSaveKey={handleUpdateKey}
          onSaveEndpoint={handleUpdateEndpoint}
          onToggleModel={handleToggleModel}
          onClose={() => setSelectedProvider(null)}
        />
      )}

      {/* 文本模型秘钥弹窗（只支持改秘钥） */}
      {textKeyTarget && (
        <TextKeyModal
          model={textKeyTarget}
          onSave={handleUpdateKey}
          onClose={() => setTextKeyTarget(null)}
        />
      )}
    </div>
  );
};

// ==================== 文本模型秘钥弹窗（简易版，只改秘钥） ====================
const TextKeyModal: React.FC<{
  model: TextModelHealth;
  onSave: (envVar: string, apiKey: string) => Promise<boolean>;
  onClose: () => void;
}> = ({ model, onSave, onClose }) => {
  const [editingEnv, setEditingEnv] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [showValue, setShowValue] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSave = async () => {
    if (!editingEnv || !inputValue) return;
    setSaving(true);
    const ok = await onSave(editingEnv, inputValue);
    setSaving(false);
    if (ok) {
      setSaveResult({ success: true, message: '密钥已更新' });
      setInputValue('');
      setEditingEnv(null);
      setTimeout(() => setSaveResult(null), 2000);
    } else {
      setSaveResult({ success: false, message: '更新失败' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#1a1a1f] border border-white/[0.08] rounded-2xl p-5 max-w-md w-full mx-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Key className="w-4 h-4" /> {model.displayName} · 修改 API 密钥
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="text-[11px] text-gray-400 bg-white/[0.02] border border-white/[0.04] rounded p-2">
          <div>模型：<code className="text-blue-400 font-mono">{model.model}</code></div>
          <div>提供商：<span className="text-gray-300">{model.provider}</span></div>
        </div>

        <div className="space-y-2">
          {model.apiKeys.map((k) => (
            <div key={k.env} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <code className="text-xs text-blue-400 font-mono">{k.env}</code>
                {k.configured ? (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> 已配置
                  </span>
                ) : (
                  <span className="text-[10px] text-red-400">未配置</span>
                )}
              </div>
              {k.preview && (
                <div className="text-xs text-gray-400 font-mono mb-2">{k.preview}</div>
              )}
              {editingEnv === k.env ? (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showValue ? 'text' : 'password'}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="输入新密钥..."
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 pr-8 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                      autoFocus
                    />
                    <button
                      onClick={() => setShowValue(!showValue)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showValue ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={saving || !inputValue}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    保存
                  </button>
                  <button
                    onClick={() => { setEditingEnv(null); setInputValue(''); }}
                    className="px-2 py-1 rounded-lg text-xs bg-white/[0.04] text-gray-400 border border-white/[0.06]"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingEnv(k.env); setInputValue(''); setSaveResult(null); }}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <Key className="w-3 h-3" /> 修改秘钥
                </button>
              )}
            </div>
          ))}
        </div>

        {saveResult && (
          <div className={cn(
            'flex items-center gap-2 p-2 rounded-lg text-xs',
            saveResult.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          )}>
            {saveResult.success ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {saveResult.message}
          </div>
        )}

        <p className="text-[11px] text-gray-500">
          密钥修改后会同步写入 .env 文件和数据库，需要重启后端使 SDK 重新初始化。
        </p>
      </div>
    </div>
  );
};

export default ModelHealthPanel;
