import { useEffect, useState } from 'react';
import { BrainCircuit, CheckCircle2, KeyRound, Loader2, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import useUnifiedAPIConfigStore from '@/store/useUnifiedAPIConfigStore';
import { userModelCredentialService } from '@/services/user-model-credential-service';

type Protocol = 'openai' | 'anthropic';

export const LLMSettingsPanel = () => {
  const { userCredentialConfigs, userCredentialStorage, fetchUserCredentialConfigs } = useUnifiedAPIConfigStore();
  const [protocol, setProtocol] = useState<Protocol>('openai');
  const [displayName, setDisplayName] = useState('自定义模型');
  const [model, setModel] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const provider = `custom-text-${protocol}`;
  const configured = userCredentialConfigs[provider];

  useEffect(() => { void fetchUserCredentialConfigs(); }, [fetchUserCredentialConfigs]);
  useEffect(() => {
    const entry = userCredentialConfigs[provider];
    setDisplayName(entry?.displayName || '自定义模型');
    setModel(entry?.selectedModel || '');
    setEndpoint(entry?.baseUrl || '');
    setApiKey('');
  }, [provider, userCredentialConfigs]);

  const save = async () => {
    if (!displayName.trim() || !model.trim() || !endpoint.trim() || !apiKey.trim()) {
      toast.error('请填写自定义名称、模型名称、接口地址和 API Key');
      return;
    }
    setSaving(true);
    try {
      await userModelCredentialService.save(provider, {
        enabled: true,
        displayName: displayName.trim(),
        protocol,
        selectedModel: model.trim(),
        baseUrl: endpoint.trim().replace(/\/+$/, ''),
        apiKey: apiKey.trim(),
      });
      setApiKey('');
      await fetchUserCredentialConfigs();
      toast.success('文字推理模型已加密保存');
    } catch (error) {
      toast.error(`保存失败：${error instanceof Error ? error.message : '请检查接口地址与登录状态'}`);
    } finally { setSaving(false); }
  };

  const clear = async () => {
    if (!confirm('确定清除这个文字推理模型配置吗？')) return;
    await userModelCredentialService.remove(provider);
    await fetchUserCredentialConfigs();
    setApiKey('');
  };

  return <div className="h-full overflow-y-auto bg-gray-900 p-6 text-white">
    <div className="mb-6 border-b border-gray-700 pb-5">
      <h2 className="text-2xl font-bold">LLM 兼容接口</h2>
      <p className="mt-2 text-sm text-gray-400">配置文字与推理模型。仅支持 OpenAI、Anthropic 兼容协议；Key 加密保存在本机，不会回显。</p>
      <div className="mt-3 flex items-center gap-2 text-xs text-cyan-300"><KeyRound className="h-4 w-4" />凭据加密空间：{(userCredentialStorage.usedBytes / 1024).toFixed(1)} KB / {(userCredentialStorage.limitBytes / 1024 / 1024).toFixed(0)} MB</div>
    </div>

    <section className="max-w-3xl rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-5">
      <div className="mb-4 flex items-center gap-2 font-semibold"><BrainCircuit className="h-5 w-5 text-cyan-300" />自定义文字推理模型</div>
      <div className="grid gap-3 md:grid-cols-2">
        <select value={protocol} onChange={(event) => setProtocol(event.target.value as Protocol)} className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2.5 text-sm text-white"><option value="openai">OpenAI 兼容接口</option><option value="anthropic">Anthropic 兼容接口</option></select>
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="自定义模型" className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2.5 text-sm text-white" />
        <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="模型名称，例如 gpt-4o / claude-sonnet" className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2.5 text-sm text-white" />
        <input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://api.example.com/v1" className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2.5 text-sm text-white" />
        <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={configured?.hasCredentials ? '已配置 Key；填写后可替换' : 'API Key（加密保存，不回显）'} className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2.5 text-sm text-white md:col-span-2" autoComplete="off" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-sm text-gray-400">{configured?.hasCredentials ? <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-4 w-4" />已匹配配置</span> : '尚未配置'}</div>
        <div className="flex gap-2"><button onClick={() => void clear()} className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"><Trash2 className="mr-1 inline h-4 w-4" />清除</button><button onClick={() => void save()} disabled={saving} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-50">{saving ? <Loader2 className="inline h-4 w-4 animate-spin" /> : <Save className="mr-1 inline h-4 w-4" />}保存文字模型</button></div>
      </div>
    </section>
  </div>;
};

export default LLMSettingsPanel;
