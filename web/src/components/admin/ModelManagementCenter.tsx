import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Eye,
  EyeOff,
  Film,
  ImageIcon,
  Loader2,
  Music,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
  Video,
  Volume2,
  X,
  CheckCircle2,
  XCircle,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminAppConfigService, type AppModelConfig, type AppModelType } from '@/services/app-config-service';

const MODEL_TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  video: { label: '视频模型', icon: Video, color: 'text-purple-400', bg: 'bg-purple-500/15' },
  image: { label: '图片模型', icon: ImageIcon, color: 'text-blue-400', bg: 'bg-blue-500/15' },
  audio: { label: '音频模型', icon: Volume2, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  music: { label: '音乐模型', icon: Music, color: 'text-amber-400', bg: 'bg-amber-500/15' },
  text: { label: '文本模型', icon: Box, color: 'text-cyan-400', bg: 'bg-cyan-500/15' },
  both: { label: '图文模型', icon: Film, color: 'text-pink-400', bg: 'bg-pink-500/15' },
};

const ALL_TYPES = ['video', 'image', 'audio', 'music', 'text', 'both'] as const;

export default function ModelManagementCenter() {
  const [models, setModels] = useState<AppModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminAppConfigService.getModels();
      if (res.success) {
        setModels(res.data.models || []);
      } else {
        setError(res.error || '获取模型列表失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const filteredModels = models.filter((m) => {
    const matchType = filterType === 'all' || m.type === filterType;
    const matchSearch = !searchQuery ||
      m.modelId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.provider?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchType && matchSearch;
  });

  const typeCounts = ALL_TYPES.reduce((acc, type) => {
    acc[type] = models.filter((m) => m.type === type).length;
    return acc;
  }, {} as Record<string, number>);

  const handleToggleStatus = async (model: AppModelConfig) => {
    try {
      const res = await adminAppConfigService.setModelStatus(
        model.provider,
        model.modelId,
        !model.isActive
      );
      if (res.success) {
        setModels((prev) => prev.map((m) =>
          m.provider === model.provider && m.modelId === model.modelId
            ? { ...m, isActive: !m.isActive }
            : m
        ));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (model: AppModelConfig) => {
    if (!confirm(`确定删除模型「${model.name || model.modelId}」吗？`)) return;
    try {
      const res = await adminAppConfigService.archiveModel(model.provider, model.modelId);
      if (res.success) {
        setModels((prev) => prev.filter((m) =>
          !(m.provider === model.provider && m.modelId === model.modelId)
        ));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishMsg(null);
    try {
      const res = await adminAppConfigService.publish();
      if (res.success) {
        setPublishMsg(`配置已发布（版本 ${res.data.version}），前端节点将自动同步`);
        setTimeout(() => setPublishMsg(null), 5000);
      } else {
        setPublishMsg(`发布失败: ${res.error || '未知错误'}`);
      }
    } catch (err) {
      setPublishMsg(`发布失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="p-8 bg-[#111114] rounded-2xl border border-white/[0.06]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/15 flex items-center justify-center">
            <Box className="w-7 h-7 text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">模型管理中心</h2>
            <p className="text-base text-gray-400">新增和管理视频、图片、音频、音乐模型，保存后自动同步到前端所有节点</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchModels}
            disabled={loading}
            className="flex items-center gap-2.5 px-4 py-2.5 bg-[#151518] border border-white/[0.06] rounded-xl text-base text-gray-300 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
          >
            <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
            刷新
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-white rounded-xl border border-amber-500/30 transition-all duration-200 shadow-lg shadow-amber-500/10"
          >
            <Plus className="w-5 h-5" />
            新增模型
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl transition-all duration-200 shadow-lg shadow-green-500/20 disabled:opacity-50"
          >
            {publishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            发布同步
          </button>
        </div>
      </div>

      {/* Publish message */}
      {publishMsg && (
        <div className="mb-6 p-4 bg-green-500/12 border border-green-500/25 rounded-xl text-base text-green-300 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5" />
          {publishMsg}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/12 border border-red-500/25 rounded-xl text-base text-red-300 flex items-center gap-3">
          <XCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Type filter cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        <button
          onClick={() => setFilterType('all')}
          className={cn(
            'rounded-2xl border p-4 transition-all duration-200 text-left',
            filterType === 'all'
              ? 'border-amber-500/30 bg-amber-500/10'
              : 'border-white/[0.06] bg-[#151518] hover:bg-white/[0.04]'
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <Zap className={cn('w-5 h-5', filterType === 'all' ? 'text-amber-400' : 'text-gray-400')} />
            <span className="text-sm text-gray-400">全部</span>
          </div>
          <p className="text-2xl font-bold text-white">{models.length}</p>
        </button>
        {ALL_TYPES.map((type) => {
          const meta = MODEL_TYPE_META[type];
          const Icon = meta.icon;
          const active = filterType === type;
          return (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                'rounded-2xl border p-4 transition-all duration-200 text-left',
                active
                  ? 'border-amber-500/30 bg-amber-500/10'
                  : 'border-white/[0.06] bg-[#151518] hover:bg-white/[0.04]'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={cn('w-5 h-5', active ? meta.color : 'text-gray-400')} />
                <span className="text-sm text-gray-400">{meta.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{typeCounts[type] || 0}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜索模型名称、ID或服务商..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-5 py-3 bg-[#0d0d0d] border border-white/[0.06] rounded-xl text-base text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Model list */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d0d] overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-gray-500" />
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Box className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-base">暂无模型数据</p>
            <p className="text-sm mt-2 text-gray-500">点击「新增模型」添加第一个模型</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filteredModels.map((model) => {
              const meta = MODEL_TYPE_META[model.type || 'text'] || MODEL_TYPE_META.text;
              const Icon = meta.icon;
              return (
                <div key={`${model.provider}-${model.modelId}`} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.04] transition-colors">
                  <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', meta.bg)}>
                    <Icon className={cn('w-6 h-6', meta.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-medium text-white truncate">{model.name || model.modelId}</span>
                      <span className={cn(
                        'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
                        model.isActive ? 'bg-green-500/15 text-green-400' : 'bg-gray-500/15 text-gray-400'
                      )}>
                        {model.isActive ? '启用' : '禁用'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      <span>ID: {model.modelId}</span>
                      <span>·</span>
                      <span>服务商: {model.providerDisplayName || model.provider}</span>
                      {model.supportedModes?.length > 0 && (
                        <>
                          <span>·</span>
                          <span>模式: {model.supportedModes.slice(0, 3).join(', ')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleStatus(model)}
                      className={cn(
                        'p-2.5 rounded-lg transition-all duration-200',
                        model.isActive
                          ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10'
                          : 'text-gray-400 hover:text-green-400 hover:bg-green-500/10'
                      )}
                      title={model.isActive ? '禁用' : '启用'}
                    >
                      {model.isActive ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(model)}
                      className="p-2.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
                      title="删除"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Model Modal */}
      {showAddModal && (
        <AddModelModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchModels();
          }}
        />
      )}
    </div>
  );
}

// ==================== Add Model Modal ====================

function AddModelModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    modelId: '',
    name: '',
    provider: '',
    type: 'video' as AppModelType,
    supportedModes: '',
    description: '',
    providerModel: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!formData.modelId || !formData.name || !formData.provider) {
      setError('请填写模型ID、名称和服务商');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        provider: formData.provider,
        modelId: formData.modelId,
        name: formData.name,
        type: formData.type,
        providerModel: formData.providerModel || formData.modelId,
        description: formData.description || undefined,
        supportedModes: formData.supportedModes
          ? formData.supportedModes.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        capabilities: [],
        requiredInputs: [],
        isActive: true,
      };
      const res = await adminAppConfigService.createModel(payload);
      if (res.success) {
        // Auto-publish after creating
        await adminAppConfigService.publish();
        onSuccess();
      } else {
        setError(res.error || '创建失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111114] rounded-2xl border border-white/[0.06] w-full max-w-2xl max-h-[90vh] overflow-auto shadow-2xl shadow-black/40">
        {/* Modal Header */}
        <div className="p-6 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#111114] z-10">
          <div className="flex items-center gap-3">
            <Plus className="w-6 h-6 text-amber-400" />
            <h3 className="text-xl font-bold text-white">新增模型</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all duration-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-4 bg-red-500/12 border border-red-500/25 rounded-xl text-base text-red-300 flex items-center gap-3">
              <XCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {/* Model type selector */}
          <div>
            <label className="block text-base text-gray-400 mb-3">模型类型</label>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {ALL_TYPES.map((type) => {
                const meta = MODEL_TYPE_META[type];
                const Icon = meta.icon;
                const selected = formData.type === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, type })}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border p-4 transition-all duration-200',
                      selected
                        ? 'border-amber-500/40 bg-amber-500/10'
                        : 'border-white/[0.06] bg-[#0d0d0d] hover:bg-white/[0.04]'
                    )}
                  >
                    <Icon className={cn('w-6 h-6', selected ? meta.color : 'text-gray-400')} />
                    <span className={cn('text-sm', selected ? 'text-white' : 'text-gray-400')}>
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model ID & Name */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-base text-gray-400 mb-2">模型 ID *</label>
              <input
                type="text"
                value={formData.modelId}
                onChange={(e) => setFormData({ ...formData, modelId: e.target.value })}
                className="w-full px-4 py-3 bg-[#0d0d0d] border border-white/[0.06] rounded-xl text-base text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                placeholder="如: doubao-seedance-1-5-pro"
              />
            </div>
            <div>
              <label className="block text-base text-gray-400 mb-2">模型名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-[#0d0d0d] border border-white/[0.06] rounded-xl text-base text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                placeholder="如: 豆包视频 1.5 Pro"
              />
            </div>
          </div>

          {/* Provider & Provider Model */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-base text-gray-400 mb-2">服务商 *</label>
              <input
                type="text"
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                className="w-full px-4 py-3 bg-[#0d0d0d] border border-white/[0.06] rounded-xl text-base text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                placeholder="如: doubao, minimax, apipaths"
              />
            </div>
            <div>
              <label className="block text-base text-gray-400 mb-2">上游模型 ID</label>
              <input
                type="text"
                value={formData.providerModel}
                onChange={(e) => setFormData({ ...formData, providerModel: e.target.value })}
                className="w-full px-4 py-3 bg-[#0d0d0d] border border-white/[0.06] rounded-xl text-base text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                placeholder="留空则与模型 ID 相同"
              />
            </div>
          </div>

          {/* Supported modes */}
          <div>
            <label className="block text-base text-gray-400 mb-2">支持模式（逗号分隔）</label>
            <input
              type="text"
              value={formData.supportedModes}
              onChange={(e) => setFormData({ ...formData, supportedModes: e.target.value })}
              className="w-full px-4 py-3 bg-[#0d0d0d] border border-white/[0.06] rounded-xl text-base text-white focus:outline-none focus:border-amber-500/50 transition-colors"
              placeholder="如: text-to-video, image-to-video, video-to-video"
            />
            <p className="text-sm text-gray-500 mt-2">视频: text-to-video, image-to-video | 图片: text-to-image, image-to-image | 音频: text-to-audio</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-base text-gray-400 mb-2">描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 bg-[#0d0d0d] border border-white/[0.06] rounded-xl text-base text-white focus:outline-none focus:border-amber-500/50 transition-colors"
              placeholder="模型描述（可选）"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-white/[0.06] flex items-center justify-between gap-4">
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            保存后将自动发布并同步到前端所有节点
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-[#151518] border border-white/[0.06] rounded-xl text-base text-gray-300 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-white text-base rounded-xl border border-amber-500/30 transition-all duration-200 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              保存并同步
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
