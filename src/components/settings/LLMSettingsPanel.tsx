import { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, CheckCircle2, KeyRound, Loader2, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import useUnifiedAPIConfigStore from '@/store/useUnifiedAPIConfigStore';
import { userModelCredentialService } from '@/services/user-model-credential-service';
import {
  PROMPT_OPTIMIZER_MODELS,
  type PromptOptimizerModelId,
} from '@/config/prompt-optimizer-models';

const PROMPT_OPTIMIZER_PROVIDER = 'prompt-optimizer-llm';
type ModelOption = (typeof PROMPT_OPTIMIZER_MODELS)[number];

export const LLMSettingsPanel = () => {
  const { userCredentialConfigs, userCredentialStorage, fetchUserCredentialConfigs } = useUnifiedAPIConfigStore();
  const configured = userCredentialConfigs[PROMPT_OPTIMIZER_PROVIDER];
  const [selectedModel, setSelectedModel] = useState<PromptOptimizerModelId>('deepseek-v4-pro');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedDefinition = useMemo<ModelOption>(
    () => PROMPT_OPTIMIZER_MODELS.find((model) => model.id === selectedModel) || PROMPT_OPTIMIZER_MODELS[0],
    [selectedModel]
  );

  useEffect(() => { void fetchUserCredentialConfigs(); }, [fetchUserCredentialConfigs]);
  useEffect(() => {
    const storedModel = configured?.selectedModel as PromptOptimizerModelId | undefined;
    if (storedModel && PROMPT_OPTIMIZER_MODELS.some((model) => model.id === storedModel)) {
      setSelectedModel(storedModel);
    }
    setApiKey('');
  }, [configured?.selectedModel, configured?.hasCredentials]);

  const save = async () => {
    if (!apiKey.trim()) {
      toast.error('请输入 API Key');
      return;
    }
    setSaving(true);
    try {
      await userModelCredentialService.save(PROMPT_OPTIMIZER_PROVIDER, {
        enabled: true,
        protocol: selectedDefinition.protocol,
        selectedModel: selectedDefinition.id,
        apiKey: apiKey.trim(),
      });
      setApiKey('');
      await fetchUserCredentialConfigs();
      toast.success('LLM 配置已加密保存');
    } catch (error) {
      toast.error(`保存失败：${error instanceof Error ? error.message : '请检查本地服务是否运行'}`);
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    if (!confirm('确定清除图片优化的 LLM 配置吗？')) return;
    await userModelCredentialService.remove(PROMPT_OPTIMIZER_PROVIDER);
    await fetchUserCredentialConfigs();
    setApiKey('');
    toast.success('LLM 配置已清除');
  };

  return <div className="h-full overflow-y-auto bg-gray-900 p-6 text-white">
    <div className="mb-6 border-b border-gray-700 pb-5">
      <h2 className="text-2xl font-bold">LLM 配置</h2>
      <p className="mt-2 text-sm text-gray-400">图片优化只支持固定模型。模型、协议和接口地址由系统锁定，Key 加密保存且不会回显。</p>
      <div className="mt-3 flex items-center gap-2 text-xs text-cyan-300"><KeyRound className="h-4 w-4" />凭据加密空间：{(userCredentialStorage.usedBytes / 1024).toFixed(1)} KB / {(userCredentialStorage.limitBytes / 1024 / 1024).toFixed(0)} MB</div>
    </div>

    <section className="max-w-3xl rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-5">
      <div className="mb-4 flex items-center gap-2 font-semibold"><BrainCircuit className="h-5 w-5 text-cyan-300" />图片优化模型</div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-white/70 md:col-span-2">
          模型
          <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value as PromptOptimizerModelId)} className="mt-1.5 w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2.5 text-sm text-white">
            {(['DeepSeek', 'GPT', 'Claude', 'SenseNova'] as const).map((group) => (
              <optgroup key={group} label={group}>
                {PROMPT_OPTIMIZER_MODELS.filter((model) => model.group === group).map((model) => (
                  <option key={model.id} value={model.id}>{model.model}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="rounded-lg border border-gray-700 bg-gray-800/70 px-3 py-2.5 text-sm text-white/70">
          协议：<span className="text-white">{selectedDefinition.protocol === 'anthropic' ? 'Anthropic' : 'OpenAI 兼容'}</span>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-800/70 px-3 py-2.5 text-sm text-white/70">
          状态：<span className={configured?.hasCredentials ? 'text-emerald-300' : 'text-amber-200'}>{configured?.hasCredentials ? '已配置' : '未配置'}</span>
        </div>
        <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={configured?.hasCredentials ? '已配置 Key；填写后可替换' : 'API Key（加密保存，不回显）'} className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2.5 text-sm text-white md:col-span-2" autoComplete="off" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-sm text-gray-400">{configured?.hasCredentials ? <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-4 w-4" />已匹配配置</span> : '图片优化需要先配置 LLM'}</div>
        <div className="flex gap-2"><button onClick={() => void clear()} disabled={!configured?.hasCredentials} className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-40"><Trash2 className="mr-1 inline h-4 w-4" />清除</button><button onClick={() => void save()} disabled={saving} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-50">{saving ? <Loader2 className="inline h-4 w-4 animate-spin" /> : <Save className="mr-1 inline h-4 w-4" />}保存配置</button></div>
      </div>
    </section>
  </div>;
};

export default LLMSettingsPanel;
