import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import AICGNodeShell from './AICGNodeShell';
import { canvasStoreApi, useCanvasStore } from '@/store/useCanvasStore';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { spawnControllerToolNode } from '@/services/node-controller-action-service';
import { runAICGNodeAction, type AICGNodeActionId } from '@/services/aicg-node-action-registry';
import { cn } from '@/lib/utils';
import { NodePointsBadge } from './NodePointsBadge';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-check';

type FocusedNodeConfig = {
  title: string;
  subtitle: string;
  aicgType: 'text' | 'script' | 'tool';
  icon: string;
  inputId: string;
  outputId: string;
  inputTip: string;
  outputTip: string;
  extraInputs?: string[];
  extraOutputs?: string[];
  placeholder: string;
  chips: string[];
  defaultPrompt: string;
  actions: Array<{
    id: string;
    label: string;
    actionId?: AICGNodeActionId;
    targetType: string;
    sourceHandle?: string;
    targetHandle?: string;
    initialData?: Record<string, unknown>;
  }>;
};

const NODE_CONFIGS: Record<string, FocusedNodeConfig> = {
  adCopyText: {
    title: '广告词',
    subtitle: '卖点 / 转化 / 短文案',
    aicgType: 'text',
    icon: 'AD',
    inputId: 'input',
    outputId: 'output',
    inputTip: '产品/脚本输入',
    outputTip: '广告文案',
    extraOutputs: ['prompt'],
    placeholder: '输入产品、目标人群、投放平台、核心卖点，生成短视频广告词...',
    chips: ['卖点提炼', '短视频口播', '电商转化', '强 CTA'],
    defaultPrompt: '请围绕产品核心卖点生成 3 条短视频广告词，包含开场钩子、利益点、行动号召。',
    actions: [
      {
        id: 'ad-copy-to-image',
        actionId: 'text-to-image',
        label: '接 AI图片',
        targetType: 'aiImage',
        sourceHandle: 'prompt',
        targetHandle: 'prompt',
      },
      {
        id: 'ad-copy-to-video',
        actionId: 'text-to-video',
        label: '接 AI视频',
        targetType: 'aiVideo',
        sourceHandle: 'prompt',
        targetHandle: 'prompt',
      },
      {
        id: 'ad-copy-to-audio',
        actionId: 'text-to-audio',
        label: '接 配音',
        targetType: 'audioGen',
        sourceHandle: 'output',
        targetHandle: 'prompt',
      },
    ],
  },
  brandCopyText: {
    title: '品牌文案',
    subtitle: '品牌调性 / 主张 / 海报文案',
    aicgType: 'text',
    icon: 'BR',
    inputId: 'input',
    outputId: 'output',
    inputTip: '品牌资料输入',
    outputTip: '品牌文案',
    extraOutputs: ['prompt'],
    placeholder: '输入品牌定位、受众、关键词、视觉风格，生成品牌文案...',
    chips: ['品牌主张', '海报标题', '视觉关键词', '统一调性'],
    defaultPrompt: '请根据品牌定位生成品牌主张、海报标题、视觉关键词和一段适合 AI 生图的画面描述。',
    actions: [
      {
        id: 'brand-copy-to-image',
        actionId: 'text-to-image',
        label: '接 AI图片',
        targetType: 'aiImage',
        sourceHandle: 'prompt',
        targetHandle: 'prompt',
      },
      {
        id: 'brand-copy-to-ad',
        label: '接 广告词',
        targetType: 'adCopyText',
        sourceHandle: 'output',
        targetHandle: 'input',
      },
      {
        id: 'brand-copy-to-output',
        label: '接 输出',
        targetType: 'output',
        sourceHandle: 'output',
        targetHandle: 'image',
      },
    ],
  },
  storyboardEdit: {
    title: '分镜编辑',
    subtitle: '镜头节奏 / 宫格裁剪 / 重排',
    aicgType: 'script',
    icon: 'SB',
    inputId: 'scriptInput',
    outputId: 'output',
    inputTip: '分镜/剧本输入',
    outputTip: '编辑后分镜',
    extraInputs: ['imageInput'],
    extraOutputs: ['scenes'],
    placeholder: '描述分镜调整：节奏、镜头顺序、画幅、裁剪重点、补镜需求...',
    chips: ['镜头重排', '宫格裁剪', '补镜提示', '节奏标记'],
    defaultPrompt: '请把输入分镜整理为可执行镜头清单，标记景别、运镜、时长、裁剪重点与补镜建议。',
    actions: [
      {
        id: 'storyboard-edit-to-image',
        actionId: 'storyboard-to-image',
        label: '接 批量生图',
        targetType: 'aiImage',
        sourceHandle: 'output',
        targetHandle: 'input',
      },
      {
        id: 'storyboard-edit-to-video',
        actionId: 'storyboard-to-video',
        label: '接 批量生视频',
        targetType: 'aiVideo',
        sourceHandle: 'output',
        targetHandle: 'input',
      },
      {
        id: 'storyboard-edit-to-batch',
        label: '接 批量处理',
        targetType: 'batchProcess',
        sourceHandle: 'scenes',
        targetHandle: 'input',
      },
    ],
  },
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function FocusedToolNode(props: NodeProps) {
  const { id, data, selected } = props;
  const nodeType =
    asString(data?.type) || asString((props as unknown as { type?: string }).type) || 'adCopyText';
  const config = NODE_CONFIGS[nodeType] ?? NODE_CONFIGS.adCopyText;
  const params = (data?.params as Record<string, unknown> | undefined) || {};
  const prompt = asString(params.prompt) || asString(data?.prompt) || config.defaultPrompt;
  const outputText = asString(data?.outputText) || asString(data?.outputPrompt) || prompt;
  const [isGenerating, setIsGenerating] = useState(false);
  const isRetiredVrController = nodeType === 'vr360Preview';

  useEffect(() => {
    if (isRetiredVrController) canvasStoreApi.deleteNode(id as string);
  }, [id, isRetiredVrController]);

  const updateNodeData = useCallback(
    (patch: Record<string, unknown>) => {
      canvasStoreApi.updateNodeData(id as string, patch);
    },
    [id]
  );

  const updatePrompt = useCallback(
    (nextPrompt: string) => {
      const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
      const currentParams =
        ((node?.data as Record<string, unknown> | undefined)?.params as
          | Record<string, unknown>
          | undefined) || {};
      canvasStoreApi.updateNodeData(id as string, {
        prompt: nextPrompt,
        outputText: nextPrompt,
        outputPrompt: nextPrompt,
        params: { ...currentParams, prompt: nextPrompt },
      });
    },
    [id]
  );

  const statusItems = useMemo(
    () => [
      { label: config.inputTip, value: data?.spawnedFrom ? '已连接' : '可连接' },
      { label: '节点职责', value: config.chips.slice(0, 2).join(' / ') },
    ],
    [config.chips, config.inputTip, data?.spawnedFrom]
  );

  const handleSync = useCallback(() => {
    updateNodeData({ outputText: prompt, outputPrompt: prompt });
    syncDownstreamFromNode(id as string);
    toast.success('已同步到下游节点');
  }, [id, prompt, updateNodeData]);

  // AI 生成：调用 /public/chat，使用节点配置中的 defaultPrompt 作为系统提示词
  const handleGenerate = useCallback(async () => {
    const promptText = prompt.trim();
    if (!promptText) {
      toast.error('请输入内容');
      return;
    }

    setIsGenerating(true);
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const nodeData = (data || {}) as Record<string, any>;
      const selectedModel =
        (typeof nodeData.model === 'string' && nodeData.model.trim()) || 'apipaths';

      const response = await fetch(`${API_BASE_URL}/public/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: promptText,
          systemPrompt: config.defaultPrompt,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: '生成失败' }));
        throw new Error(errData.error || `生成失败 (${response.status})`);
      }

      const res = await response.json();
      if (res.success !== false && res.content) {
        const result = String(res.content).trim();
        updateNodeData({ outputText: result, outputPrompt: result });
        syncDownstreamFromNode(id as string);
        toast.success('AI 生成完成并已同步下游');
      } else {
        throw new Error(res.error || '生成失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '生成失败';
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  }, [config.defaultPrompt, data, id, prompt, updateNodeData]);

  const handleSpawn = useCallback(
    (action: FocusedNodeConfig['actions'][number]) => {
      if (action.actionId) {
        runAICGNodeAction(id as string, action.actionId, {
          controllerActionId: action.id,
          label: action.label.replace(/^接\s*/, ''),
          toastLabel: action.label.replace(/^接\s*/, ''),
          sourceHandle: action.sourceHandle || config.outputId,
          targetHandle: action.targetHandle,
          initialData: {
            prompt,
            outputText,
            outputPrompt: prompt,
            params: {
              prompt,
              ...(action.initialData?.params as Record<string, unknown> | undefined),
            },
            ...action.initialData,
          },
        });
        return;
      }
      spawnControllerToolNode(id as string, action.targetType, {
        controllerActionId: action.id,
        label: action.label.replace(/^接\s*/, ''),
        toastLabel: action.label.replace(/^接\s*/, ''),
        sourceHandle: action.sourceHandle || config.outputId,
        targetHandle: action.targetHandle,
        initialData: {
          prompt,
          outputText,
          outputPrompt: prompt,
          params: {
            prompt,
            ...(action.initialData?.params as Record<string, unknown> | undefined),
          },
          ...action.initialData,
        },
      });
    },
    [config.outputId, id, outputText, prompt]
  );

  if (isRetiredVrController) return null;

  return (
    <div className="relative w-[360px] select-none">
      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType={nodeType}
        inputId={config.inputId}
        outputId={config.outputId}
        inputTip={config.inputTip}
        outputTip={config.outputTip}
        extraInputs={config.extraInputs}
        extraOutputs={config.extraOutputs}
      />

      <AICGNodeShell
        aicgType={config.aicgType}
        title={config.title}
        subtitle={config.subtitle}
        selected={selected}
        width={360}
        variant="glass-modern"
        hideHeader
        onDelete={() => canvasStoreApi.deleteNode(id as string)}
        status={
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[9px] font-semibold text-white/45">
            轻节点
          </span>
        }
        controls={
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-[11px] font-bold text-white/85">
                {config.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-white/86">{config.title}</div>
                <div className="truncate text-[10px] text-white/38">
                  只负责 {config.chips.slice(0, 2).join(' / ')}，复杂流程交给下游节点
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {statusItems.map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-white/8 bg-black/25 px-2 py-1.5"
                >
                  <div className="text-[9px] text-white/32">{item.label}</div>
                  <div className="mt-0.5 truncate text-[10px] font-semibold text-white/68">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <textarea
              value={prompt}
              onChange={(e) => updatePrompt(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onPointerDownCapture={(e) => e.stopPropagation()}
              onMouseDownCapture={(e) => e.stopPropagation()}
              placeholder={config.placeholder}
              className="nodrag nowheel min-h-[92px] w-full resize-none rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[11px] leading-relaxed text-white/80 outline-none placeholder:text-white/24 focus:border-white/35"
            />

            <div className="flex flex-wrap gap-1.5">
              {config.chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-1 text-[9px] text-white/48"
                >
                  {chip}
                </span>
              ))}
            </div>

            <div className="flex flex-nowrap items-center gap-1 overflow-hidden">
              <NodePointsBadge points={1} />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleGenerate();
                }}
                disabled={isGenerating || !prompt.trim()}
                className={cn(
                  'nodrag flex h-6 shrink-0 items-center gap-1 rounded-md border px-1.5 text-[9px] font-medium leading-none transition-colors',
                  isGenerating
                    ? 'border-white/24 bg-white/[0.08] text-white/70 cursor-wait'
                    : 'border-white/18 bg-white/[0.06] text-white/78 hover:bg-white/[0.1]',
                  !prompt.trim() && !isGenerating && 'opacity-50 cursor-not-allowed'
                )}
              >
                {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                <span>{isGenerating ? '生成中' : '生成'}</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSync();
                }}
                className="nodrag h-6 shrink-0 rounded-md border border-white/18 bg-white/[0.06] px-1.5 text-[9px] font-medium leading-none text-white/78 transition-colors hover:bg-white/[0.1]"
              >
                同步
              </button>
              {config.actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSpawn(action);
                  }}
                  className={cn(
                    'nodrag h-6 min-w-0 shrink rounded-md border border-white/10 bg-white/[0.045] px-1.5 text-[9px] font-medium leading-none text-white/58 transition-colors',
                    'hover:border-white/18 hover:bg-white/[0.075] hover:text-white/82'
                  )}
                >
                  <span className="block truncate">{action.label.replace(/^接\s*/, '')}</span>
                </button>
              ))}
            </div>
          </div>
        }
      />
    </div>
  );
}

export default memo(FocusedToolNode);
