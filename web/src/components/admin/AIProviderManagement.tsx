import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { aiProviderService, type AIProvider } from '@/services/admin/ai-provider-service';
import { modelRegistry } from '@/services/model-registry';
import { unifiedAIAdapter } from '@/services/unified-ai-adapter';

type MediaType = 'image' | 'video';
type CompatibilityMode = 'openai-image' | 'openai-video';

interface CustomModelForm {
  displayName: string;
  upstreamModel: string;
  endpoint: string;
  apiKey: string;
  isActive: boolean;
  compatibilityMode: CompatibilityMode;
}

const initialForm = (mediaType: MediaType): CustomModelForm => ({
  displayName: '',
  upstreamModel: '',
  endpoint: '',
  apiKey: '',
  isActive: true,
  compatibilityMode: mediaType === 'image' ? 'openai-image' : 'openai-video',
});

function isCustomModel(provider: AIProvider): boolean {
  return provider.config?.isCustomModel === true;
}

function getMediaType(provider: AIProvider): MediaType {
  return provider.config?.mediaType === 'video' ? 'video' : 'image';
}

function createSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || `model-${Date.now().toString(36)}`;
}

export default function AIProviderManagement({ className }: { className?: string }) {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CustomModelForm>(initialForm('image'));
  const [editing, setEditing] = useState<AIProvider | null>(null);
  const [showKey, setShowKey] = useState(false);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 拉取全部记录后只渲染自定义模型，内置服务商与其密钥永不在这个界面出现。
      const response = await aiProviderService.getProviders({ page: 1, pageSize: 200 });
      if (!response.success) throw new Error('读取自定义模型组失败');
      setProviders(response.data.filter(isCustomModel));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '读取自定义模型组失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchProviders(); }, [fetchProviders]);

  const visibleProviders = useMemo(
    () => providers.filter((provider) => getMediaType(provider) === mediaType),
    [providers, mediaType]
  );

  const resetForm = (nextType = mediaType) => {
    setEditing(null);
    setShowKey(false);
    setForm(initialForm(nextType));
  };

  const openEdit = (provider: AIProvider) => {
    const model = provider.models?.[0];
    const modelRecord = typeof model === 'string' ? { id: model, name: model } : model;
    setEditing(provider);
    setShowKey(false);
    setForm({
      displayName: provider.displayName || modelRecord?.name || '',
      upstreamModel: modelRecord?.providerModel || modelRecord?.id || '',
      endpoint: provider.endpoint || '',
      apiKey: '',
      isActive: provider.isActive,
      compatibilityMode: provider.config?.compatibilityMode === 'openai-video' ? 'openai-video' : 'openai-image',
    });
  };

  const syncModels = async () => {
    await modelRegistry.refreshFromBackend();
    await unifiedAIAdapter.syncBackendModels();
  };

  const save = async () => {
    if (!form.displayName.trim() || !form.upstreamModel.trim() || !form.endpoint.trim()) {
      setError('请完整填写显示名称、上游模型名称和接口地址。');
      return;
    }
    if (!editing && !form.apiKey.trim()) {
      setError('新增模型必须填写 API Key。');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const slug = editing?.provider || `custom-${mediaType}-${createSlug(form.displayName)}`;
      const modelId = `${slug}-model`;
      const supportedModes = mediaType === 'image'
        ? ['text_to_image', 'image_to_image']
        : ['text_to_video', 'image_to_video'];
      const payload = {
        provider: slug,
        name: '自定义模型组',
        displayName: form.displayName.trim(),
        description: `自定义${mediaType === 'image' ? '图片' : '视频'}模型：${form.upstreamModel.trim()}`,
        endpoint: form.endpoint.trim().replace(/\/+$/, ''),
        ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
        isActive: form.isActive,
        supportedModes,
        models: [{
          id: modelId,
          name: form.displayName.trim(),
          providerModel: form.upstreamModel.trim(),
          type: mediaType,
          supportedModes,
          capabilities: supportedModes.map((mode) => mode.replace(/_/g, '-')),
          isActive: form.isActive,
          modelCategory: 'generation' as const,
        }],
        config: {
          isCustomModel: true,
          mediaType,
          compatibilityMode: form.compatibilityMode,
          customModel: { pointsPerSuccess: 1, sortPriority: 0 },
          supportedModes,
        },
      };
      const response = editing
        ? await aiProviderService.updateProvider(editing.id, payload)
        : await aiProviderService.createProvider(payload);
      if (!response.success) throw new Error('保存自定义模型失败');
      await syncModels();
      resetForm();
      await fetchProviders();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存自定义模型失败');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (provider: AIProvider) => {
    try {
      const response = await aiProviderService.toggleProvider(provider.id);
      if (!response.success) throw new Error('更新模型状态失败');
      await syncModels();
      await fetchProviders();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '更新模型状态失败');
    }
  };

  const remove = async (provider: AIProvider) => {
    if (!confirm(`确定删除“${provider.displayName}”吗？删除后该模型将不再显示在节点中。`)) return;
    try {
      const response = await aiProviderService.deleteProvider(provider.id);
      if (!response.success) throw new Error('删除自定义模型失败');
      await syncModels();
      if (editing?.id === provider.id) resetForm();
      await fetchProviders();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '删除自定义模型失败');
    }
  };

  const changeType = (next: MediaType) => {
    setMediaType(next);
    if (!editing) resetForm(next);
  };

  return (
    <div className={cn('rounded-2xl border border-white/[0.07] bg-[#111114] p-6', className)}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 text-white">
            <KeyRound className="h-6 w-6 text-amber-400" />
            <h2 className="text-2xl font-bold">自定义模型组</h2>
          </div>
          <p className="mt-2 text-sm text-gray-400">仅管理自定义接口。内置服务商、内置接口与其密钥已隐藏；API Key 仅加密保存于服务器。</p>
        </div>
        <button onClick={() => void fetchProviders()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-gray-200 hover:bg-white/[0.08]">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />刷新
        </button>
      </div>

      <div className="mb-6 flex gap-2 rounded-xl bg-black/20 p-1.5">
        {(['image', 'video'] as const).map((item) => (
          <button key={item} onClick={() => changeType(item)} className={cn('flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition', mediaType === item ? 'bg-amber-500/20 text-amber-200 shadow-sm' : 'text-gray-400 hover:text-white')}>
            AI {item === 'image' ? '图片模型' : '视频模型'}
          </button>
        ))}
      </div>

      {error && <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"><AlertCircle className="h-4 w-4" />{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-semibold text-white">已添加的{mediaType === 'image' ? '图片' : '视频'}模型</h3><span className="text-sm text-gray-500">节点列表优先显示</span></div>
          {loading ? <div className="flex min-h-40 items-center justify-center text-gray-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" />正在读取</div> : visibleProviders.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 px-6 py-16 text-center text-sm text-gray-500">暂无自定义模型。请在右侧添加。</div> : visibleProviders.map((provider) => {
            const model = provider.models?.[0];
            const data = typeof model === 'string' ? { id: model, providerModel: model } : model;
            return <div key={provider.id} className="rounded-xl border border-white/[0.07] bg-black/15 p-4">
              <div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2"><h4 className="truncate font-medium text-white">{provider.displayName}</h4><span className={cn('rounded px-2 py-0.5 text-xs', provider.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-gray-500/15 text-gray-400')}>{provider.isActive ? '已启用' : '已停用'}</span></div><p className="mt-1 truncate text-xs text-gray-500">上游模型：{data?.providerModel || data?.id}</p><p className="mt-1 truncate text-xs text-gray-500">{provider.endpoint}</p><p className="mt-2 text-xs text-amber-200/80">兼容模式：{provider.config?.compatibilityMode === 'openai-video' ? 'OpenAI 风格视频' : 'OpenAI 风格图片'} · 成功生成 1 积分</p></div><div className="flex shrink-0 gap-1"><button onClick={() => void toggle(provider)} title={provider.isActive ? '停用' : '启用'} className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white">{provider.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button><button onClick={() => openEdit(provider)} title="编辑" className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white"><Pencil className="h-4 w-4" /></button><button onClick={() => void remove(provider)} title="删除" className="rounded-lg p-2 text-gray-400 hover:bg-red-500/15 hover:text-red-300"><Trash2 className="h-4 w-4" /></button></div></div>
            </div>;
          })}
        </section>

        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.035] p-5">
          <div className="mb-5 flex items-center justify-between"><h3 className="font-semibold text-white">{editing ? '编辑自定义模型' : `添加${mediaType === 'image' ? '图片' : '视频'}模型`}</h3>{editing && <button onClick={() => resetForm()} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>}</div>
          <div className="space-y-4">
            <Field label="显示名称"><input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="例如：我的豆包 Seedream 5.0 Pro" /></Field>
            <Field label="上游模型名称"><input value={form.upstreamModel} onChange={(e) => setForm({ ...form, upstreamModel: e.target.value })} placeholder="例如：gemini-3-pro-image-preview" /></Field>
            <Field label="接口地址"><input value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} placeholder="https://api.example.com/v1" /></Field>
            <Field label={editing ? 'API Key（留空则保持原 Key）' : 'API Key'}><div className="relative"><input type={showKey ? 'text' : 'password'} value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={editing ? '不会读取或回显已有密钥' : 'sk-...'} className="pr-11" /><button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-white">{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></Field>
            <Field label="兼容模式"><select value={form.compatibilityMode} onChange={(e) => setForm({ ...form, compatibilityMode: e.target.value as CompatibilityMode })}><option value={mediaType === 'image' ? 'openai-image' : 'openai-video'}>{mediaType === 'image' ? 'OpenAI 风格图片接口' : 'OpenAI 风格异步视频接口'}</option></select></Field>
            <label className="flex cursor-pointer items-center gap-3 text-sm text-gray-300"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 accent-amber-500" />保存后立即在对应节点首位显示</label>
            <button onClick={() => void save()} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 font-medium text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{editing ? '保存修改' : '添加到自定义模型组'}</button>
          </div>
          <div className="mt-4 flex gap-2 text-xs leading-5 text-gray-500"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />模型 ID 由系统生成，避免与内置模型冲突；真实 API Key 不会返回到浏览器。</div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm text-gray-300">{label}</span><div className="[&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-white/10 [&>input]:bg-black/30 [&>input]:px-3.5 [&>input]:py-2.5 [&>input]:text-sm [&>input]:text-white [&>input]:outline-none [&>input:focus]:border-amber-400/60 [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:border-white/10 [&>select]:bg-black/30 [&>select]:px-3.5 [&>select]:py-2.5 [&>select]:text-sm [&>select]:text-white [&>select]:outline-none">{children}</div></label>;
}
