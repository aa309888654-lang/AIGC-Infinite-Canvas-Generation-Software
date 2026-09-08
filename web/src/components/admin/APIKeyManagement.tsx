import React, { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Search,
  Loader2,
  Trash2,
  RefreshCw,
  Plus,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Server,
  Shield,
  Upload,
  Settings,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  aiProviderService,
  type AIProvider,
  type AIProviderDashboard,
  type ProviderKeyInfo,
  type ProviderKeyStats,
} from '@/services/admin/ai-provider-service';
import { mediagatewayService } from '@/services/admin/mediagateway-service';
import type {
  GatewayStatus,
  GatewayStats,
  ViduKeyStatus,
} from '@/services/admin/mediagateway-service';

type MainTab = 'ai-providers' | 'video-gateway';

const APIKeyManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MainTab>('ai-providers');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Key className="w-7 h-7 text-amber-400" />
            平台秘钥管理中心
          </h1>
          <p className="text-gray-500 text-base mt-1">
            统一管理平台所有大模型 API 秘钥：AI 服务商主秘钥、秘钥池轮询、视频网关秘钥
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('ai-providers')}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-medium transition-colors',
            activeTab === 'ai-providers'
              ? 'bg-amber-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
          )}
        >
          <Shield className="w-5 h-5" />
          AI 服务商秘钥
        </button>
        <button
          onClick={() => setActiveTab('video-gateway')}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-medium transition-colors',
            activeTab === 'video-gateway'
              ? 'bg-amber-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
          )}
        >
          <Server className="w-5 h-5" />
          视频网关秘钥
        </button>
      </div>

      {activeTab === 'ai-providers' && <AIProviderKeysPanel />}
      {activeTab === 'video-gateway' && <VideoGatewayKeysPanel />}
    </div>
  );
};

// ============================================================
// AI 服务商秘钥面板
// ============================================================
const AIProviderKeysPanel: React.FC = () => {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [dashboard, setDashboard] = useState<AIProviderDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [providerKeys, setProviderKeys] = useState<ProviderKeyInfo[]>([]);
  const [keyStats, setKeyStats] = useState<ProviderKeyStats | null>(null);
  const [keysLoading, setKeysLoading] = useState(false);

  // 主秘钥编辑
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [mainKeyForm, setMainKeyForm] = useState<{ apiKey: string; apiSecret: string }>({ apiKey: '', apiSecret: '' });
  const [showMainKey, setShowMainKey] = useState(false);
  const [savingMainKey, setSavingMainKey] = useState(false);

  // 新增秘钥池
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyQuota, setNewKeyQuota] = useState('0');
  const [newKeyModelScope, setNewKeyModelScope] = useState('');
  const [newKeyWeight, setNewKeyWeight] = useState('1');
  const [newKeyMaxConcurrency, setNewKeyMaxConcurrency] = useState('1');

  // 批量导入
  const [batchKeys, setBatchKeys] = useState('');
  const [batchQuota, setBatchQuota] = useState('30');
  const [batchModelScope, setBatchModelScope] = useState('');
  const [batchWeight, setBatchWeight] = useState('1');
  const [batchMaxConcurrency, setBatchMaxConcurrency] = useState('1');
  const [batchImporting, setBatchImporting] = useState(false);
  const [batchResult, setBatchResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, dashRes] = await Promise.allSettled([
        aiProviderService.getProviders({ page: 1, pageSize: 100, search: searchQuery || undefined }),
        aiProviderService.getDashboard(),
      ]);
      if (listRes.status === 'fulfilled' && listRes.value.success) {
        setProviders(listRes.value.data);
      }
      if (dashRes.status === 'fulfilled' && dashRes.value.success) {
        setDashboard(dashRes.value.data);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载服务商失败');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const t = setTimeout(fetchProviders, 300);
    return () => clearTimeout(t);
  }, [fetchProviders]);

  const fetchProviderKeys = useCallback(async (providerId: string) => {
    setKeysLoading(true);
    try {
      const res = await aiProviderService.getProviderKeys(providerId);
      if (res.success) {
        setProviderKeys(res.data.keys);
        setKeyStats(res.data.stats);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '获取秘钥列表失败');
    } finally {
      setKeysLoading(false);
    }
  }, []);

  const handleExpand = (provider: AIProvider) => {
    if (expandedProvider === provider.id) {
      setExpandedProvider(null);
      setProviderKeys([]);
      setKeyStats(null);
    } else {
      setExpandedProvider(provider.id);
      fetchProviderKeys(provider.id);
    }
    setEditingProvider(null);
    setMainKeyForm({ apiKey: '', apiSecret: '' });
  };

  const handleSaveMainKey = async (provider: AIProvider) => {
    if (!mainKeyForm.apiKey && !mainKeyForm.apiSecret) {
      toast.error('请输入 apiKey 或 apiSecret');
      return;
    }
    setSavingMainKey(true);
    try {
      const data: { apiKey?: string; apiSecret?: string } = {};
      if (mainKeyForm.apiKey) data.apiKey = mainKeyForm.apiKey;
      if (mainKeyForm.apiSecret) data.apiSecret = mainKeyForm.apiSecret;
      await aiProviderService.updateCredentials(provider.id, data);
      toast.success('主秘钥已更新');
      setEditingProvider(null);
      setMainKeyForm({ apiKey: '', apiSecret: '' });
      fetchProviders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新主秘钥失败');
    } finally {
      setSavingMainKey(false);
    }
  };

  const handleAddKey = async (provider: AIProvider) => {
    if (!newKeyLabel.trim() || !newKeyValue.trim()) {
      toast.error('请填写标签和秘钥内容');
      return;
    }
    try {
      await aiProviderService.addProviderKey(provider.id, {
        keyLabel: newKeyLabel.trim(),
        apiKey: newKeyValue.trim(),
        modelScope: newKeyModelScope.trim() || null,
        weight: parseInt(newKeyWeight) || 1,
        maxConcurrency: parseInt(newKeyMaxConcurrency) || 1,
        quotaTotal: parseInt(newKeyQuota) || 0,
      });
      toast.success('秘钥已添加');
      setNewKeyLabel('');
      setNewKeyValue('');
      setNewKeyQuota('0');
      setNewKeyModelScope('');
      setNewKeyWeight('1');
      setNewKeyMaxConcurrency('1');
      fetchProviderKeys(provider.id);
      fetchProviders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '添加秘钥失败');
    }
  };

  const handleDeleteKey = async (provider: AIProvider, keyId: string) => {
    if (!confirm('确定删除此秘钥？此操作不可撤销。')) return;
    try {
      await aiProviderService.deleteProviderKey(provider.id, keyId);
      toast.success('秘钥已删除');
      fetchProviderKeys(provider.id);
      fetchProviders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除秘钥失败');
    }
  };

  const handleToggleKey = async (provider: AIProvider, keyId: string, isActive: boolean) => {
    try {
      await aiProviderService.updateProviderKey(provider.id, keyId, { isActive: !isActive });
      toast.success(isActive ? '秘钥已禁用' : '秘钥已启用');
      fetchProviderKeys(provider.id);
      fetchProviders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '切换秘钥状态失败');
    }
  };

  const handleMoveKey = async (provider: AIProvider, keyId: string, direction: 'up' | 'down') => {
    try {
      const res = await aiProviderService.moveProviderKey(provider.id, keyId, direction);
      if (res.success && res.data.keys) {
        setProviderKeys(res.data.keys);
      } else {
        fetchProviderKeys(provider.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '排序失败');
    }
  };

  const handleResetKeyQuota = async (provider: AIProvider, keyId: string) => {
    try {
      await aiProviderService.resetProviderKeyQuota(provider.id, keyId);
      toast.success('额度已重置');
      fetchProviderKeys(provider.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '重置额度失败');
    }
  };

  const handleBatchImport = async (provider: AIProvider) => {
    const keys = batchKeys
      .split(/[\n,;]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    if (keys.length === 0) {
      toast.error('请输入至少一个秘钥');
      return;
    }
    setBatchImporting(true);
    try {
      const res = await aiProviderService.batchImportKeys(
        provider.id,
        keys,
        parseInt(batchQuota) || 0,
        {
          modelScope: batchModelScope.trim() || null,
          weight: parseInt(batchWeight) || 1,
          maxConcurrency: parseInt(batchMaxConcurrency) || 1,
        }
      );
      setBatchResult({
        imported: res.data.imported,
        skipped: res.data.skipped,
        errors: res.data.errors,
      });
      toast.success(`成功导入 ${res.data.imported} 个秘钥`);
      fetchProviderKeys(provider.id);
      fetchProviders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '批量导入失败');
    } finally {
      setBatchImporting(false);
    }
  };

  if (loading && providers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <p className="text-gray-400 text-sm">加载中...</p>
      </div>
    );
  }

  const totalKeys = dashboard?.keys?.total ?? 0;
  const activeKeys = dashboard?.keys?.active ?? 0;
  const exhaustedKeys = dashboard?.keys?.exhausted ?? 0;
  const disabledKeys = dashboard?.keys?.disabled ?? 0;

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Key className="w-6 h-6" />} label="总秘钥数" value={String(totalKeys)} color="amber" />
        <StatCard icon={<CheckCircle className="w-6 h-6" />} label="可用" value={String(activeKeys)} color="green" />
        <StatCard icon={<AlertCircle className="w-6 h-6" />} label="已耗尽" value={String(exhaustedKeys)} color="red" />
        <StatCard icon={<XCircle className="w-6 h-6" />} label="已禁用" value={String(disabledKeys)} color="gray" />
      </div>

      {/* 搜索 */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          placeholder="搜索服务商..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-3 bg-[#1A1A1E] border border-white/[0.08] rounded-xl text-white text-base placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {/* 服务商列表 */}
      <div className="space-y-2">
        {providers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Key className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>暂无服务商</p>
          </div>
        ) : (
          providers.map((provider) => {
            const isExpanded = expandedProvider === provider.id;
            const isEditing = editingProvider === provider.id;
            return (
              <div
                key={provider.id}
                className={cn(
                  'bg-[#1A1A1E] rounded-2xl border transition-colors',
                  isExpanded ? 'border-amber-500/30' : 'border-white/[0.08]'
                )}
              >
                {/* 服务商行 */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-white/[0.06]"
                  onClick={() => handleExpand(provider)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={cn(
                        'w-2.5 h-2.5 rounded-full',
                        provider.hasApiKey ? 'bg-green-500' : 'bg-red-500'
                      )}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold text-base truncate">{provider.displayName || provider.name}</span>
                        <span className="text-sm text-gray-500 font-mono">{provider.provider}</span>
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {provider.hasApiKey ? '主秘钥已配置' : '主秘钥未配置'} · {provider.models?.length || 0} 个模型
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>

                {/* 展开内容 */}
                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4 border-t border-white/[0.08] pt-5">
                    {/* 主秘钥编辑 */}
                    <div className="bg-[#0E0E11] rounded-xl p-5 border border-white/[0.06]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Shield className="w-5 h-5 text-blue-400" />
                          <span className="text-base font-medium text-gray-300">服务商主秘钥</span>
                          {provider.hasApiKey ? (
                            <span className="px-2.5 py-1 text-sm rounded-full bg-green-500/20 text-green-400">已配置</span>
                          ) : (
                            <span className="px-2.5 py-1 text-sm rounded-full bg-red-500/20 text-red-400">未配置</span>
                          )}
                        </div>
                        {!isEditing && (
                          <button
                            onClick={() => {
                              setEditingProvider(provider.id);
                              setMainKeyForm({ apiKey: '', apiSecret: '' });
                            }}
                            className="text-sm px-4 py-2 bg-blue-600/20 text-blue-400 rounded-xl hover:bg-blue-600/30 transition-colors flex items-center gap-1"
                          >
                            <Settings className="w-4 h-4" />
                            {provider.hasApiKey ? '更换主秘钥' : '设置主秘钥'}
                          </button>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm text-gray-500 mb-1">API Key</label>
                            <div className="relative">
                              <input
                                type={showMainKey ? 'text' : 'password'}
                                value={mainKeyForm.apiKey}
                                onChange={(e) => setMainKeyForm({ ...mainKeyForm, apiKey: e.target.value })}
                                placeholder="输入新的 API Key（留空不修改）"
                                className="w-full px-4 py-3 pr-10 bg-[#1A1A1E] border border-white/[0.08] rounded-xl text-white text-base focus:outline-none focus:border-blue-500"
                              />
                              <button
                                onClick={() => setShowMainKey(!showMainKey)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                              >
                                {showMainKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-500 mb-1">API Secret（可选）</label>
                            <input
                              type={showMainKey ? 'text' : 'password'}
                              value={mainKeyForm.apiSecret}
                              onChange={(e) => setMainKeyForm({ ...mainKeyForm, apiSecret: e.target.value })}
                              placeholder="输入 API Secret（如需）"
                              className="w-full px-4 py-3 bg-[#1A1A1E] border border-white/[0.08] rounded-xl text-white text-base focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingProvider(null);
                                setMainKeyForm({ apiKey: '', apiSecret: '' });
                              }}
                              className="px-4 py-2 bg-white/5 hover:bg-white/[0.06] text-white text-sm rounded-xl transition-colors"
                            >
                              取消
                            </button>
                            <button
                              onClick={() => handleSaveMainKey(provider)}
                              disabled={savingMainKey}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-xl transition-colors flex items-center gap-1"
                            >
                              {savingMainKey && <Loader2 className="w-4 h-4 animate-spin" />}
                              保存
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">
                          主秘钥用于调用该服务商的 AI 服务。如需多 Key 轮询，请在下方秘钥池添加。
                        </p>
                      )}
                    </div>

                    {/* 秘钥池统计 */}
                    {keyStats && (
                      <div className="grid grid-cols-4 gap-2">
                        <div className="bg-[#0E0E11] rounded-xl p-3 text-center">
                          <div className="text-xl font-bold text-gray-300">{keyStats.totalKeys}</div>
                          <div className="text-xs text-gray-500">总秘钥</div>
                        </div>
                        <div className="bg-[#0E0E11] rounded-xl p-3 text-center">
                          <div className="text-xl font-bold text-green-400">{keyStats.activeKeys}</div>
                          <div className="text-xs text-gray-500">可用</div>
                        </div>
                        <div className="bg-[#0E0E11] rounded-xl p-3 text-center">
                          <div className="text-xl font-bold text-orange-400">{keyStats.disabledKeys ?? 0}</div>
                          <div className="text-xs text-gray-500">已禁用</div>
                        </div>
                        <div className="bg-[#0E0E11] rounded-xl p-3 text-center">
                          <div className="text-xl font-bold text-red-400">{keyStats.exhaustedKeys}</div>
                          <div className="text-xs text-gray-500">已耗尽</div>
                        </div>
                      </div>
                    )}

                    {/* 添加秘钥 */}
                    <div className="bg-[#0E0E11] rounded-xl p-5 border border-white/[0.06]">
                      <div className="text-base font-medium text-gray-300 mb-3">添加秘钥到池</div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={newKeyLabel}
                            onChange={(e) => setNewKeyLabel(e.target.value)}
                            className="w-full px-4 py-3 bg-[#1A1A1E] border border-white/[0.08] rounded-xl text-white text-base focus:outline-none focus:border-amber-500"
                            placeholder="标签 (如: key-1)"
                          />
                          <input
                            type="number"
                            value={newKeyQuota}
                            onChange={(e) => setNewKeyQuota(e.target.value)}
                            className="w-full px-4 py-3 bg-[#1A1A1E] border border-white/[0.08] rounded-xl text-white text-base focus:outline-none focus:border-amber-500"
                            placeholder="额度 (0=不限)"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <input
                            type="text"
                            value={newKeyModelScope}
                            onChange={(e) => setNewKeyModelScope(e.target.value)}
                            className="w-full px-4 py-3 bg-[#1A1A1E] border border-white/[0.08] rounded-xl text-white text-base focus:outline-none focus:border-amber-500"
                            placeholder="模型范围"
                          />
                          <input
                            type="number"
                            min="1"
                            value={newKeyWeight}
                            onChange={(e) => setNewKeyWeight(e.target.value)}
                            className="w-full px-4 py-3 bg-[#1A1A1E] border border-white/[0.08] rounded-xl text-white text-base focus:outline-none focus:border-amber-500"
                            placeholder="权重"
                          />
                          <input
                            type="number"
                            min="1"
                            value={newKeyMaxConcurrency}
                            onChange={(e) => setNewKeyMaxConcurrency(e.target.value)}
                            className="w-full px-4 py-3 bg-[#1A1A1E] border border-white/[0.08] rounded-xl text-white text-base focus:outline-none focus:border-amber-500"
                            placeholder="最大并发"
                          />
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={newKeyValue}
                            onChange={(e) => setNewKeyValue(e.target.value)}
                            className="flex-1 px-4 py-3 bg-[#1A1A1E] border border-white/[0.08] rounded-xl text-white text-base focus:outline-none focus:border-amber-500"
                            placeholder="输入 API Key"
                          />
                          <button
                            onClick={() => handleAddKey(provider)}
                            disabled={!newKeyLabel.trim() || !newKeyValue.trim()}
                            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-base transition-colors flex items-center gap-1"
                          >
                            <Plus className="w-5 h-5" />
                            添加
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 批量导入 */}
                    <div className="bg-[#0E0E11] rounded-xl p-5 border border-white/[0.06]">
                      <div className="text-base font-medium text-gray-300 mb-3">批量导入</div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <input
                            type="number"
                            value={batchQuota}
                            onChange={(e) => setBatchQuota(e.target.value)}
                            className="px-3 py-2 bg-[#1A1A1E] border border-white/[0.08] rounded-xl text-white text-base focus:outline-none focus:border-amber-500"
                            placeholder="每秘钥额度"
                          />
                          <input
                            type="text"
                            value={batchModelScope}
                            onChange={(e) => setBatchModelScope(e.target.value)}
                            className="px-3 py-2 bg-[#1A1A1E] border border-white/[0.08] rounded-xl text-white text-base focus:outline-none focus:border-amber-500"
                            placeholder="模型范围"
                          />
                          <input
                            type="number"
                            min="1"
                            value={batchWeight}
                            onChange={(e) => setBatchWeight(e.target.value)}
                            className="px-3 py-2 bg-[#1A1A1E] border border-white/[0.08] rounded-xl text-white text-base focus:outline-none focus:border-amber-500"
                            placeholder="权重"
                          />
                          <input
                            type="number"
                            min="1"
                            value={batchMaxConcurrency}
                            onChange={(e) => setBatchMaxConcurrency(e.target.value)}
                            className="px-3 py-2 bg-[#1A1A1E] border border-white/[0.08] rounded-xl text-white text-base focus:outline-none focus:border-amber-500"
                            placeholder="最大并发"
                          />
                        </div>
                        <textarea
                          value={batchKeys}
                          onChange={(e) => { setBatchKeys(e.target.value); setBatchResult(null); }}
                          className="w-full h-32 px-4 py-3 bg-[#1A1A1E] border border-white/[0.08] rounded-xl text-white text-base focus:outline-none focus:border-amber-500 resize-none font-mono"
                          placeholder="粘贴多个 API Key，每行一个或用逗号/分号分隔"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">
                            {batchKeys.trim() ? `识别 ${batchKeys.split(/[\n,;]+/).filter(k => k.trim()).length} 个秘钥` : ''}
                          </span>
                          <button
                            onClick={() => handleBatchImport(provider)}
                            disabled={!batchKeys.trim() || batchImporting}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-base transition-colors flex items-center gap-1"
                          >
                            {batchImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                            批量导入
                          </button>
                        </div>
                        {batchResult && (
                          <div className={cn(
                            'rounded-xl p-3 text-base',
                            batchResult.errors.length > 0 ? 'bg-yellow-500/10 text-yellow-300' : 'bg-green-500/10 text-green-300'
                          )}>
                            <div>成功导入: {batchResult.imported} 个 | 重复跳过: {batchResult.skipped} 个</div>
                            {batchResult.errors.length > 0 && (
                              <div className="mt-1 text-sm text-yellow-400">
                                {batchResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 秘钥列表 */}
                    <div className="bg-[#0E0E11] rounded-xl p-5 border border-white/[0.06]">
                      <div className="text-base font-medium text-gray-300 mb-3">秘钥列表</div>
                      {keysLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                        </div>
                      ) : providerKeys.length === 0 ? (
                        <div className="text-center py-6 text-gray-500 text-sm">
                          <Key className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p>暂无秘钥，请添加</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {providerKeys.map((key, index) => (
                            <div
                              key={key.id}
                              className={cn(
                                'bg-[#141417] rounded-xl p-4 border flex items-center gap-2',
                                key.isExhausted ? 'border-red-500/30' : key.isActive ? 'border-green-500/30' : 'border-orange-500/30'
                              )}
                            >
                              <div className="w-12 flex flex-col items-center gap-1">
                                <span className="text-sm text-gray-400 font-mono">#{index + 1}</span>
                                <div className="flex items-center gap-0.5">
                                  <button
                                    onClick={() => handleMoveKey(provider, key.id, 'up')}
                                    disabled={index === 0}
                                    className={cn(
                                      'p-1 rounded transition-colors',
                                      index === 0 ? 'text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
                                    )}
                                    title="上移"
                                  >
                                    <ChevronUp className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveKey(provider, key.id, 'down')}
                                    disabled={index === providerKeys.length - 1}
                                    className={cn(
                                      'p-1 rounded transition-colors',
                                      index === providerKeys.length - 1 ? 'text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
                                    )}
                                    title="下移"
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="text-base font-medium text-white">{key.keyLabel}</span>
                                  {key.modelScope && (
                                    <span className="px-2.5 py-1 text-sm rounded-full bg-blue-500/20 text-blue-300">{key.modelScope}</span>
                                  )}
                                  <span className="px-2.5 py-1 text-sm rounded-full bg-white/10 text-gray-300">权重 {key.weight}</span>
                                  <span className="px-2.5 py-1 text-sm rounded-full bg-white/10 text-gray-300">并发 {key.maxConcurrency}</span>
                                  <span className={cn(
                                    'px-2.5 py-1 text-sm rounded-full',
                                    key.isExhausted ? 'bg-red-500/20 text-red-400' : key.isActive ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                                  )}>
                                    {key.isExhausted ? '已耗尽' : key.isActive ? '可用' : '已禁用'}
                                  </span>
                                  <span className="text-sm text-gray-500 font-mono truncate">{key.maskedKey}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-400 flex-wrap">
                                  <span>额度: {key.quotaTotal > 0 ? `${key.quotaUsed}/${key.quotaTotal}` : '不限'}</span>
                                  {key.quotaTotal > 0 && (
                                    <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden max-w-[160px] min-w-[60px]">
                                      <div
                                        className={cn('h-full rounded-full', key.isExhausted ? 'bg-red-500' : 'bg-green-500')}
                                        style={{ width: `${Math.min(100, (key.quotaUsed / key.quotaTotal) * 100)}%` }}
                                      />
                                    </div>
                                  )}
                                  {key.lastUsedAt && (
                                    <span>最后使用: {new Date(key.lastUsedAt).toLocaleString('zh-CN')}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleToggleKey(provider, key.id, key.isActive)}
                                  className={cn(
                                    'p-2 w-5 h-5 rounded transition-colors',
                                    key.isActive ? 'text-yellow-400 hover:bg-yellow-500/10' : 'text-green-400 hover:bg-green-500/10'
                                  )}
                                  title={key.isActive ? '禁用' : '启用'}
                                >
                                  {key.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                </button>
                                {key.isExhausted && (
                                  <button
                                    onClick={() => handleResetKeyQuota(provider, key.id)}
                                    className="p-2 w-5 h-5 text-gray-400 hover:bg-gray-500/10 rounded transition-colors"
                                    title="重置额度"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteKey(provider, key.id)}
                                  className="p-2 w-5 h-5 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                  title="删除"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                          <div className="text-sm text-gray-500 pt-1">
                            排序靠前的秘钥优先使用 · 点击 ↑↓ 按钮调整顺序
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ============================================================
// 视频网关秘钥面板（Vidu 池 + 豆包主秘钥）
// ============================================================
const VideoGatewayKeysPanel: React.FC = () => {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [stats, setStats] = useState<GatewayStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showDoubaoModal, setShowDoubaoModal] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [batchKeys, setBatchKeys] = useState('');
  const [doubaoKey, setDoubaoKey] = useState('');
  const [resetting, setResetting] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [statusRes, statsRes] = await Promise.allSettled([
        mediagatewayService.getStatus(),
        mediagatewayService.getStats(),
      ]);
      if (statusRes.status === 'fulfilled') setStatus(statusRes.value);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
    } catch {
      toast.error('加载网关数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleAddKey = async () => {
    if (!newKey.trim()) {
      toast.error('请输入秘钥内容');
      return;
    }
    try {
      setAdding(true);
      await mediagatewayService.addKey(newKey.trim());
      toast.success('秘钥添加成功');
      setNewKey('');
      setShowAddModal(false);
      fetchAll();
    } catch {
      toast.error('添加失败');
    } finally {
      setAdding(false);
    }
  };

  const handleBatchAdd = async () => {
    const keys = batchKeys.split('\n').map((k) => k.trim()).filter((k) => k.length > 0);
    if (keys.length === 0) {
      toast.error('请输入至少一个秘钥');
      return;
    }
    try {
      setAdding(true);
      const result = await mediagatewayService.batchAddKeys(keys);
      toast.success(`成功添加 ${result.successCount} 个秘钥${result.failCount > 0 ? `，${result.failCount} 个失败` : ''}`);
      setBatchKeys('');
      setShowBatchModal(false);
      fetchAll();
    } catch {
      toast.error('批量导入失败');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteKey = async (idx: number) => {
    if (!confirm(`确定要删除秘钥 #${idx + 1} 吗？此操作不可恢复。`)) return;
    try {
      await mediagatewayService.deleteKey(idx);
      toast.success('秘钥删除成功');
      fetchAll();
    } catch {
      toast.error('删除失败');
    }
  };

  const handleSetDoubaoKey = async () => {
    if (!doubaoKey.trim() || doubaoKey.trim().length < 10) {
      toast.error('请输入有效的豆包秘钥');
      return;
    }
    try {
      setAdding(true);
      await mediagatewayService.setDoubaoKey(doubaoKey.trim());
      toast.success('豆包秘钥设置成功');
      setDoubaoKey('');
      setShowDoubaoModal(false);
      fetchAll();
    } catch {
      toast.error('设置豆包秘钥失败');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteDoubaoKey = async () => {
    if (!confirm('确定要删除豆包系统主秘钥吗？删除后豆包视频生成将不可用。')) return;
    try {
      await mediagatewayService.deleteDoubaoKey();
      toast.success('豆包秘钥已删除');
      fetchAll();
    } catch {
      toast.error('删除豆包秘钥失败');
    }
  };

  const handleReset = async (provider: string) => {
    try {
      setResetting(true);
      await mediagatewayService.resetFailures(provider);
      toast.success('重置成功');
      fetchAll();
    } catch {
      toast.error('重置失败');
    } finally {
      setResetting(false);
    }
  };

  const toggleKeyExpand = (idx: number) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const filteredViduKeys =
    status?.vidu.filter((k) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        String(k.key_idx + 1).includes(q) ||
        (k.masked_key || '').toLowerCase().includes(q) ||
        (k.label || '').toLowerCase().includes(q)
      );
    }) || [];

  if (loading && !status) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <p className="text-gray-400 text-sm">加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<Key className="w-6 h-6" />} label="Vidu 在线" value={`${stats.viduActive}/${stats.viduKeys}`} color="violet" />
          <StatCard icon={<Activity className="w-6 h-6" />} label="可用率" value={`${stats.successRate}%`} color={stats.successRate >= 80 ? 'green' : stats.successRate >= 50 ? 'amber' : 'red'} />
          <StatCard icon={<AlertCircle className="w-6 h-6" />} label="累计失败" value={String(stats.totalFailures)} color={stats.totalFailures > 0 ? 'red' : 'gray'} />
          <StatCard icon={<Shield className="w-6 h-6" />} label="豆包秘钥" value={stats.doubaoKey ? '已配置' : '未配置'} color={stats.doubaoKey ? 'green' : 'red'} />
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowBatchModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-xl text-white text-base font-medium transition-colors"
        >
          <Upload className="w-5 h-5" />
          批量导入 Vidu
        </button>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-white text-base font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          新增 Vidu 秘钥
        </button>
        <button
          onClick={() => handleReset('vidu')}
          disabled={resetting}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-xl text-base font-medium transition-colors"
        >
          <RefreshCw className={cn('w-5 h-5', resetting && 'animate-spin')} />
          重置失败计数
        </button>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/[0.06] rounded-xl text-white text-base transition-colors"
        >
          <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
          刷新
        </button>
      </div>

      {/* Vidu 秘钥池 */}
      <div className="bg-[#1A1A1E] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.08] bg-white/[0.03] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-violet-400" />
            <h2 className="text-base font-semibold text-white">Vidu 秘钥池</h2>
            <span className={cn(
              'text-sm px-2.5 py-1 rounded-full',
              stats?.viduActive && stats.viduActive > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            )}>
              {stats?.viduActive || 0}/{stats?.viduKeys || 0} 活跃
            </span>
          </div>
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索秘钥..."
              className="pl-9 pr-3 py-2 bg-white/5 border border-white/[0.08] rounded-xl text-white text-base placeholder:text-gray-600 focus:outline-none focus:border-amber-500 w-48"
            />
          </div>
        </div>
        <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
          {filteredViduKeys.length > 0 ? (
            filteredViduKeys.map((k) => (
              <ViduKeyRow
                key={k.key_idx}
                k={k}
                expanded={expandedKeys.has(k.key_idx)}
                onToggle={() => toggleKeyExpand(k.key_idx)}
                onDelete={handleDeleteKey}
              />
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Key className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>{searchQuery ? '没有匹配的秘钥' : '暂无 Vidu 秘钥'}</p>
            </div>
          )}
        </div>
      </div>

      {/* 豆包主秘钥 */}
      <div className="bg-[#1A1A1E] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.08] bg-white/[0.03]">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            豆包系统主秘钥
          </h2>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className={cn('w-2.5 h-2.5 rounded-full', status?.doubao.has_key ? 'bg-green-500' : 'bg-red-500')} />
              <span className="text-white font-semibold text-base">系统主秘钥</span>
            </div>
            <div className="flex items-center gap-2">
              {status?.doubao.has_key ? (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-base">已配置</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-400">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-base">未配置</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setShowDoubaoModal(true)}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-white text-base font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Settings className="w-5 h-5" />
              {status?.doubao.has_key ? '更换秘钥' : '设置秘钥'}
            </button>
            {status?.doubao.has_key && (
              <button
                onClick={handleDeleteDoubaoKey}
                className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-base transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                删除
              </button>
            )}
          </div>
          <div className="mt-3 bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-400 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">单秘钥策略说明</span>
            </div>
            <ul className="text-sm text-gray-400 space-y-0.5 ml-5 list-disc">
              <li>豆包模型严格遵循单秘钥策略，不参与多 Key 轮询</li>
              <li>秘钥存储在系统配置中，重启后仍然有效</li>
              <li>支持 ARK API Key 和火山引擎 API Key</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 新增 Vidu 秘钥 Modal */}
      {showAddModal && (
        <Modal title="新增 Vidu 秘钥" onClose={() => setShowAddModal(false)}>
          <div className="space-y-3">
            <label className="text-sm text-gray-400">秘钥内容</label>
            <textarea
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="请输入完整的 Vidu API 秘钥 (vda_...)"
              className="w-full h-28 px-4 py-3 bg-white/5 border border-white/[0.08] rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-5 py-3 bg-white/5 hover:bg-white/[0.06] rounded-xl text-white text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleAddKey}
                disabled={adding || !newKey.trim()}
                className="flex-1 px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2"
              >
                {adding && <Loader2 className="w-4 h-4 animate-spin" />}
                确认添加
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 批量导入 Modal */}
      {showBatchModal && (
        <Modal title="批量导入 Vidu 秘钥" onClose={() => setShowBatchModal(false)}>
          <div className="space-y-3">
            <label className="text-sm text-gray-400">每行一个秘钥</label>
            <textarea
              value={batchKeys}
              onChange={(e) => setBatchKeys(e.target.value)}
              placeholder={'vda_xxxxxxxx\nvda_yyyyyyyy'}
              className="w-full h-40 px-4 py-3 bg-white/5 border border-white/[0.08] rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500 resize-none font-mono text-base"
            />
            <p className="text-sm text-gray-500">
              已输入 {batchKeys.split('\n').filter((k) => k.trim()).length} 个秘钥
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBatchModal(false)}
                className="flex-1 px-5 py-3 bg-white/5 hover:bg-white/[0.06] rounded-xl text-white text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleBatchAdd}
                disabled={adding || !batchKeys.trim()}
                className="flex-1 px-5 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2"
              >
                {adding && <Loader2 className="w-4 h-4 animate-spin" />}
                批量导入
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 豆包秘钥 Modal */}
      {showDoubaoModal && (
        <Modal
          title={`${status?.doubao.has_key ? '更换' : '设置'}豆包秘钥`}
          onClose={() => setShowDoubaoModal(false)}
        >
          <div className="space-y-3">
            <label className="text-sm text-gray-400">豆包 API 秘钥</label>
            <textarea
              value={doubaoKey}
              onChange={(e) => setDoubaoKey(e.target.value)}
              placeholder="请输入豆包 API Key（ARK API Key 或火山引擎 Key）"
              className="w-full h-24 px-4 py-3 bg-white/5 border border-white/[0.08] rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500 resize-none"
            />
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3">
              <p className="text-sm text-amber-400/80">
                秘钥将安全存储在系统配置中，仅显示配置状态，不会暴露完整内容。
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDoubaoModal(false)}
                className="flex-1 px-5 py-3 bg-white/5 hover:bg-white/[0.06] rounded-xl text-white text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleSetDoubaoKey}
                disabled={adding || !doubaoKey.trim()}
                className="flex-1 px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2"
              >
                {adding && <Loader2 className="w-4 h-4 animate-spin" />}
                确认保存
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ============================================================
// 通用组件
// ============================================================
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
    amber: 'bg-amber-500/10 text-amber-400',
    green: 'bg-green-500/10 text-green-400',
    red: 'bg-red-500/10 text-red-400',
    violet: 'bg-violet-500/10 text-violet-400',
    gray: 'bg-gray-500/10 text-gray-400',
    blue: 'bg-blue-500/10 text-blue-400',
  };
  const cls = colorMap[color] || colorMap.amber;
  return (
    <div className="bg-[#1A1A1E] border border-white/[0.08] rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', cls)}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-xl font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

const FAILURE_THRESHOLD = 10;

function ViduKeyRow({
  k,
  expanded,
  onToggle,
  onDelete,
}: {
  k: ViduKeyStatus;
  expanded: boolean;
  onToggle: () => void;
  onDelete: (idx: number) => void;
}) {
  const failurePercent = Math.min((k.failure_count / FAILURE_THRESHOLD) * 100, 100);
  return (
    <div
      className={cn(
        'group rounded-xl border transition-colors',
        k.is_active ? 'bg-white/5 border-white/[0.06]' : 'bg-red-500/5 border-red-500/10'
      )}
    >
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', k.is_active ? 'bg-green-500' : 'bg-red-500')} />
          <span className="text-white font-medium text-base shrink-0">秘钥 #{k.key_idx + 1}</span>
          {k.masked_key && <span className="text-sm text-gray-500 font-mono truncate">{k.masked_key}</span>}
          {k.label && (
            <span className="text-sm text-gray-400 bg-white/5 px-2 py-1 rounded shrink-0">{k.label}</span>
          )}
          {!k.is_active && (
            <span className="text-sm text-red-400 bg-red-500/10 px-2 py-1 rounded shrink-0">已禁用</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-500">失败 {k.failure_count}/{FAILURE_THRESHOLD}</p>
            <div className="w-16 h-1 bg-white/5 rounded-full mt-0.5">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  failurePercent >= 100 ? 'bg-red-500' : failurePercent >= 60 ? 'bg-amber-500' : 'bg-green-500'
                )}
                style={{ width: `${failurePercent}%` }}
              />
            </div>
          </div>
          <button
            onClick={onToggle}
            className="p-2 hover:bg-white/[0.06] rounded transition-colors text-gray-500"
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          <button
            onClick={() => onDelete(k.key_idx)}
            className="p-2 w-5 h-5 text-red-400 hover:bg-red-500/10 rounded transition-colors"
            title="删除秘钥"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-2 border-t border-white/[0.06] mt-1">
          <div className="grid grid-cols-2 gap-2 pt-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">索引</span>
              <span className="text-white font-mono">{k.key_idx}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">状态</span>
              <span className={k.is_active ? 'text-green-400' : 'text-red-400'}>
                {k.is_active ? '活跃' : '已禁用'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">失败计数</span>
              <span className={k.failure_count > 0 ? 'text-orange-400' : 'text-gray-400'}>{k.failure_count}</span>
            </div>
            {k.last_failure_at && (
              <div className="flex justify-between">
                <span className="text-gray-500">上次失败</span>
                <span className="text-gray-400">{new Date(k.last_failure_at).toLocaleString()}</span>
              </div>
            )}
          </div>
          {failurePercent >= 80 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-500/5 border border-red-500/10 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-sm text-red-300">秘钥即将达到失败阈值，可能被自动禁用</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#1A1A1E] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06] bg-white/5">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/[0.06] rounded transition-colors text-white/50"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default APIKeyManagement;
