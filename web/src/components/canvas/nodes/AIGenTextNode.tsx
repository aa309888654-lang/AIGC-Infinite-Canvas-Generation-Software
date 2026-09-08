import { memo, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { NodeProps } from '@xyflow/react';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import AICGNodeShell from './AICGNodeShell';
import AICGNodePromptBar from './AICGNodePromptBar';
import AICGSlashMenu from '../AICGSlashMenu';
import ResultRenderer from './ResultRenderer';
import { NodeControllerStatusBar, NodeControllerErrorBar } from './NodeControllerFooter';
import { useAICGSlashConnect } from '@/hooks/useAICGSlashConnect';
import ScriptNode from './ScriptNode';
import { useNodeControllerCollapse } from '@/hooks/useNodeControllerCollapse';
import {
  Languages,
  Loader2,
  Square,
  ArrowUp,
  Sparkles,
  Video,
  Image as ImageIcon,
  Music,
  Clapperboard,
} from 'lucide-react';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { nodeEventBus } from '@/lib/nodeEventBus';
import { cn } from '@/lib/utils';
import { TextModelSelect } from '@/components/ui/TextModelSelect';
import { SafeStyle } from '@/components/ui/SafeStyle';
import { API_BASE_URL } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-check';
import { toast } from 'sonner';
import {
  NodeControllerSummaryBar,
  type NodeControllerAction,
} from './NodeControllerCapabilityPanel';
import { getNodeControllerPreset } from '@/services/node-controller-capability-registry';
import { DEFAULT_PROMPT_TEXT_MODEL_ID } from '@/config/prompt-optimizer-models';
import { nodeModelMatcher } from '@/core/node-model-matcher';
import {
  spawnControllerToolNode,
  withControllerActionConnection,
} from '@/services/node-controller-action-service';
import { CANVAS_NODE_BASE_WIDTH } from '@/lib/canvas-node-dimensions';

/** 文本节点示例提示词 */
const TRY_EXAMPLE_PROMPT =
  '写下你想讲的故事、场景或角色设定。例如：一个来自未来的机器人，在城市屋顶看星星。';

export interface AIGenTextNodeData {
  type?: 'aiGenText' | 'textInput';
  textWorkspace?: 'generate' | 'script';
  scriptParams?: Record<string, unknown>;
  isControllerCollapsed?: boolean;
  prompt?: string;
  outputText?: string;
  text?: string;
  model?: string;
  label?: string;
  isExpanded?: boolean;
  variableName?: string;
  systemPrompt?: string;
  enableThinking?: boolean;
  temperature?: number;
  task?: {
    status: 'idle' | 'processing' | 'completed' | 'failed';
    progress?: number;
    error?: string;
  };
}

function resolveInitialContent(data: AIGenTextNodeData) {
  const output = (data.outputText || data.text || '').trim();
  const prompt = (data.prompt || data.text || '').trim();
  return { output, prompt: data.prompt ?? prompt };
}

const AIGenTextNode = memo(({ data, selected, id, type }: NodeProps) => {
  const nodeData = data as AIGenTextNodeData;
  const { output: initialOutput, prompt: initialPrompt } = resolveInitialContent(nodeData);

  const { controlsCollapsed, onPreviewDoubleClick, collapseController } = useNodeControllerCollapse(
    id as string,
    nodeData,
    Boolean(nodeData.isControllerCollapsed)
  );

  const model =
    nodeData.model ||
    nodeModelMatcher.getDefaultModelForNode('aiGenText')?.modelId ||
    DEFAULT_PROMPT_TEXT_MODEL_ID;
  const temperature = nodeData.temperature ?? 0.7;
  const task = nodeData.task || { status: 'idle' as const };

  const [localPrompt, setLocalPrompt] = useState(initialPrompt);
  const [localOutputText, setLocalOutputText] = useState(initialOutput);
  const [isComposing, setIsComposing] = useState(false);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const translateAbortRef = useRef<AbortController | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const updateNodeData = canvasStoreApi.updateNodeData;
  const deleteNode = canvasStoreApi.deleteNode;

  useEffect(() => {
    if (!isComposing && !isPromptFocused) {
      const { output, prompt } = resolveInitialContent(nodeData);
      if (prompt !== localPrompt) setLocalPrompt(prompt);
      if (output !== localOutputText) setLocalOutputText(output);
    }
  }, [nodeData, isComposing, isPromptFocused, localPrompt, localOutputText]);

  const persist = useCallback(
    (patch: Partial<AIGenTextNodeData>) => {
      updateNodeData(id as string, { type: 'aiGenText', ...patch });
    },
    [id, updateNodeData]
  );

  const handlePromptChange = useCallback((value: string) => persist({ prompt: value }), [persist]);

  const handleModelChange = useCallback((value: string) => persist({ model: value }), [persist]);

  const handleTemperatureChange = useCallback(
    (value: number) => persist({ temperature: value }),
    [persist]
  );

  const handleStopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    persist({ task: { status: 'completed' } });
  }, [persist]);

  const handleGenerate = useCallback(async () => {
    const promptText = localPrompt.trim();
    if (!promptText) {
      toast.error('请输入内容');
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    persist({ outputText: '', text: '', task: { status: 'processing' } });
    setLocalOutputText('');

    // 重试机制：maxRetries=1，共尝试 2 次
    const maxRetries = 1;
    let lastError: Error | null = null;

    try {
      const token = getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(`${API_BASE_URL}/public/chat`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              message: promptText,
              systemPrompt: nodeData.systemPrompt || undefined,
              enableThinking: nodeData.enableThinking ?? false,
              model,
              temperature: nodeData.temperature ?? 0.7,
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: '请求失败' }));
            throw new Error(errData.error || `请求失败 (${response.status})`);
          }

          const res = await response.json();
          if (res.success !== false && res.content) {
            const result = res.content as string;
            setLocalOutputText(result);
            persist({ outputText: result, text: result, task: { status: 'completed' } });
            return; // 成功则返回
          } else {
            throw new Error(res.error || '生成失败');
          }
        } catch (error) {
          // AbortError 不重试，直接抛出
          if (error instanceof Error && error.name === 'AbortError') {
            throw error;
          }
          lastError = error as Error;
          if (attempt < maxRetries) {
            // 等待 1 秒后重试
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
        }
      }
      if (lastError) throw lastError;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        persist({ task: { status: 'completed' } });
        return;
      }
      const errorMessage = error instanceof Error ? error.message : '生成失败';
      persist({ task: { status: 'failed', error: errorMessage } });
      toast.error(errorMessage);
    } finally {
      abortControllerRef.current = null;
    }
  }, [
    localPrompt,
    model,
    nodeData.enableThinking,
    nodeData.systemPrompt,
    nodeData.temperature,
    persist,
  ]);

  const handleTranslate = useCallback(async () => {
    const text = localPrompt.trim();
    if (!text) {
      toast.error('请先输入要翻译的内容');
      return;
    }

    // 取消之前的翻译请求
    translateAbortRef.current?.abort();
    const controller = new AbortController();
    translateAbortRef.current = controller;

    setIsTranslating(true);
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/public/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: `请将以下内容翻译为英文，只输出译文：\n\n${text}`,
          model,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `翻译失败 (${response.status})`);
      }

      const res = await response.json();
      if (res.content) {
        const translated = String(res.content).trim();
        setLocalPrompt(translated);
        persist({ prompt: translated });
        toast.success('已翻译为英文');
      } else {
        throw new Error(res.error || '翻译失败');
      }
    } catch (err) {
      // 取消请求时不报错
      if (err instanceof Error && err.name === 'AbortError') return;
      toast.error(err instanceof Error ? err.message : '翻译失败');
    } finally {
      setIsTranslating(false);
      translateAbortRef.current = null;
    }
  }, [localPrompt, model, persist]);

  const isGenerating = task.status === 'processing';
  const hasOutput = Boolean(localOutputText.trim());
  const textControllerPreset = getNodeControllerPreset('text');
  const runTextBranchAction = useCallback(
    (actionId: string, replaceExisting = false) => {
      const sourceText = (localOutputText || localPrompt).trim();

      if (actionId === 'write') {
        spawnControllerToolNode(id as string, 'script', {
          controllerActionId: actionId,
          replaceExisting,
          label: '自己编写内容',
          toastLabel: '脚本节点',
          sourceHandle: 'textOutput',
          targetHandle: 'input',
          initialData: {
            script: sourceText,
            prompt: sourceText,
            text: sourceText,
            content: sourceText,
          },
        });
        return;
      }

      if (actionId === 'text-to-video') {
        spawnControllerToolNode(id as string, 'aiVideo', {
          controllerActionId: actionId,
          replaceExisting,
          label: '文生视频',
          toastLabel: '文生视频',
          sourceHandle: 'textOutput',
          targetHandle: 'input',
          initialData: {
            prompt: sourceText,
            text: sourceText,
            params: {
              prompt: sourceText,
              text: sourceText,
              provider: 'doubao',
              modelId: 'doubao-seedance-2-0',
              generationMode: 'text_to_video',
              aspectRatio: '16:9',
              resolution: '1080p',
              duration: 5,
            },
          },
        });
        return;
      }

      if (actionId === 'image-to-prompt') {
        spawnControllerToolNode(id as string, 'imageInput', {
          controllerActionId: actionId,
          replaceExisting,
          label: '图片反推提示词',
          toastLabel: '图片反推提示词',
          sourceHandle: 'textOutput',
          targetHandle: 'input',
          initialData: {
            analysisOnly: true,
            analysisMode: 'prompt_generate',
          },
        });
        return;
      }

      if (actionId === 'text-to-music') {
        spawnControllerToolNode(id as string, 'audioGen', {
          controllerActionId: actionId,
          replaceExisting,
          label: '文生配音',
          toastLabel: '文生配音',
          sourceHandle: 'textOutput',
          targetHandle: 'prompt',
          initialData: {
            text: sourceText,
            prompt: sourceText,
            params: {
              text: sourceText,
              prompt: sourceText,
              mode: 'tts',
            },
          },
        });
        return;
      }

      if (actionId === 'script-to-storyboard') {
        spawnControllerToolNode(id as string, 'scriptStoryboard', {
          controllerActionId: actionId,
          replaceExisting,
          label: '剧本转分镜',
          toastLabel: '剧本转分镜',
          sourceHandle: 'scenes',
          targetHandle: 'scriptInput',
          initialData: {
            prompt: sourceText,
            text: sourceText,
            script: sourceText,
            params: {
              prompt: sourceText,
              script: sourceText,
              mode: 'storyboard',
              preset: 'magic_storyboard',
            },
          },
        });
        return;
      }

      if (actionId === 'ad-copy') {
        spawnControllerToolNode(id as string, 'adCopyText', {
          controllerActionId: actionId,
          replaceExisting,
          label: '广告词',
          toastLabel: '广告词',
          sourceHandle: 'textOutput',
          targetHandle: 'input',
          initialData: {
            prompt:
              sourceText ||
              '请围绕产品核心卖点生成 3 条短视频广告词，包含开场钩子、利益点、行动号召。',
            text: sourceText,
            content: sourceText,
            copyType: 'short_ad',
            platform: 'short_video',
            tone: 'conversion',
          },
        });
        return;
      }

      if (actionId === 'brand-copy') {
        spawnControllerToolNode(id as string, 'brandCopyText', {
          controllerActionId: actionId,
          replaceExisting,
          label: '品牌文案',
          toastLabel: '品牌文案',
          sourceHandle: 'textOutput',
          targetHandle: 'input',
          initialData: {
            prompt:
              sourceText ||
              '请根据品牌定位生成品牌主张、海报标题、视觉关键词和一段适合 AI 生图的画面描述。',
            text: sourceText,
            content: sourceText,
            copyType: 'brand_statement',
            platform: 'brand_campaign',
            tone: 'brand',
          },
        });
        return;
      }
    },
    [id, localOutputText, localPrompt]
  );

  const textBranchActions: NodeControllerAction[] = useMemo(() => {
    const branchNodeTypes: Record<string, string> = {
      write: 'script',
      'text-to-video': 'aiVideo',
      'image-to-prompt': 'imageInput',
      'text-to-music': 'audioGen',
      'ad-copy': 'adCopyText',
      'brand-copy': 'brandCopyText',
      'script-to-storyboard': 'scriptStoryboard',
    };

    const actions: NodeControllerAction[] = [
      ...textControllerPreset.tryActions,
      {
        id: 'ad-copy',
        label: '广告词',
        icon: 'megaphone' as NodeControllerAction['icon'],
        title: '创建并连接「广告词」节点',
      },
      {
        id: 'brand-copy',
        label: '品牌文案',
        icon: 'badge' as NodeControllerAction['icon'],
        title: '创建并连接「品牌文案」节点',
      },
      {
        id: 'script-to-storyboard',
        label: '剧本转分镜',
        icon: 'split',
        title: '创建并连接「剧本转分镜」分镜导演节点',
      },
    ];

    return actions.map((action) =>
      withControllerActionConnection({
        sourceNodeId: id as string,
        action: {
          ...action,
          title: action.title || `创建并连接「${action.label}」子节点`,
          onClick: () => runTextBranchAction(action.id),
        },
        binding: {
          actionId: action.id,
          nodeType: branchNodeTypes[action.id],
          onReplace: () => runTextBranchAction(action.id, true),
        },
      })
    );
  }, [id, runTextBranchAction, textControllerPreset.tryActions]);

  const getTextBranchIcon = useCallback((icon?: NodeControllerAction['icon']) => {
    switch (icon) {
      case 'video':
        return Video;
      case 'image':
        return ImageIcon;
      case 'music':
        return Music;
      case 'split':
        return Clapperboard;
      default:
        return Sparkles;
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      e.stopPropagation();
      if (e.nativeEvent.isComposing || e.key === 'Process') return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (isGenerating) handleStopGeneration();
        else handleGenerate();
      }
    },
    [handleGenerate, handleStopGeneration, isGenerating]
  );

  const {
    slashOpen,
    slashCommands,
    onTextChange: onSlashTextChange,
    applySlashCommand,
  } = useAICGSlashConnect(id as string, 'aiGenText', 'textOutput');

  const isScriptMode = type === 'script' || nodeData.textWorkspace === 'script';

  if (isScriptMode) {
    return (
      <div
        className="group relative flex flex-col overflow-visible"
        style={{ width: CANVAS_NODE_BASE_WIDTH, minHeight: 420 }}
      >
        <AICGUnifiedIOHandles
          nodeId={id as string}
          nodeType="script"
          inputTip="输入"
          outputId="scenes"
          extraOutputs={['script']}
          outputTip="分镜 / 剧本输出"
        />
        <ScriptNode
          {...({
            id,
            data: {
              ...nodeData,
              type: 'script',
              embeddedInAicgText: true,
            },
            selected,
            type: 'script',
          } as unknown as NodeProps)}
        />
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col overflow-visible"
      style={{ width: CANVAS_NODE_BASE_WIDTH, minHeight: 600 }}
    >
      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType="aiGenText"
        inputId="promptInput"
        outputId="textOutput"
        extraInputs={['input']}
        extraOutputs={['scenes', 'script']}
        inputTip="提示词 / 图片输入"
        outputTip="文本输出"
      />

      <AICGNodeShell
        variant="glass-stack"
        aicgType="text"
        title={nodeData.label || '文本节点'}
        subtitle="@ 引用 · / 指令 · AI 生成"
        selected={selected}
        width={CANVAS_NODE_BASE_WIDTH}
        bodyClassName="p-0 [&_.aicg-node-body]:p-0 [&_.jimeng-text-model-select]:!h-8 [&_.jimeng-text-model-select]:!border-0 [&_.jimeng-text-model-select]:!bg-transparent [&_.jimeng-text-model-select]:!px-1 [&_.jimeng-text-model-select]:!text-white/90 [&_.jimeng-text-model-select]:!shadow-none [&_.jimeng-text-model-select:hover]:!bg-white/[0.04] [&_.jimeng-text-model-select-chevron]:!stroke-white/60"
        hideControlHeader
        onDelete={() => {
          deleteNode(id as string);
          nodeEventBus.emitNodeDeleted(id as string);
        }}
        onControllerCollapse={collapseController}
        controlsCollapsed={controlsCollapsed}
        onPreviewDoubleClick={onPreviewDoubleClick}
        preview={
          <div className="relative flex min-h-[500px] flex-col rounded-[14px] bg-[#101012]">
            {isGenerating && !hasOutput ? (
              <div className="flex flex-1 items-center justify-center gap-3 text-[18px] text-white/45">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>正在生成...</span>
              </div>
            ) : hasOutput ? (
              <ResultRenderer
                mediaType="text"
                text={localOutputText}
                className="min-h-[460px] flex-1 px-8 py-8 text-[17px] leading-8"
                textSelectable
              />
            ) : (
              <>
                <div className="absolute left-8 top-7 z-10 flex items-center gap-1.5">
                  <span className="shrink-0 rounded-md border border-white/[0.14] bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-white/72">
                    文本
                  </span>
                  <span className="truncate text-[11px] font-medium text-white/58">
                    在下方输入框编写或选择能力
                  </span>
                </div>
                <div className="flex flex-1 flex-col items-center justify-center bg-[#101012] px-8 pt-16 text-center">
                  <div className="mb-7 text-[26px] font-semibold tracking-wide text-white/38">
                    尝试:
                  </div>
                  <div className="flex flex-col items-start gap-6">
                    {textBranchActions.map((action) => {
                      const Icon = getTextBranchIcon(action.icon);
                      return (
                        <button
                          key={action.id}
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            action.onClick?.();
                          }}
                          disabled={action.disabled}
                          className="nodrag nowheel group flex min-w-0 items-center gap-4 text-left text-white/88 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          title={action.title || action.label}
                        >
                          {Icon ? (
                            <Icon className="h-[25px] w-[25px] shrink-0" strokeWidth={2} />
                          ) : null}
                          <span className="truncate text-[25px] font-semibold leading-none tracking-[-0.03em]">
                            {action.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="drag-handle flex flex-1 cursor-grab flex-col justify-between px-8 pb-7 pt-5 active:cursor-grabbing">
                  <div className="space-y-3">
                    {[96, 88, 72, 54].map((w, i) => (
                      <div
                        key={i}
                        className="h-2.5 rounded-sm bg-white/16"
                        style={{ width: `${w}%` }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        }
        controls={
          <>
            <div className="relative bg-[#101012]">
              <AICGNodePromptBar
                nodeId={id as string}
                value={localPrompt}
                inputRef={promptRef}
                rows={3}
                className="[&_.aicg-text-input-shell]:rounded-[22px] [&_.aicg-text-input-shell]:border-0 [&_.aicg-text-input-shell]:bg-transparent [&_.aicg-text-input-shell]:shadow-none [&_.aicg-text-input-shell]:ring-0 [&_.aicg-text-model-select]:!h-8 [&_.aicg-text-model-select]:!border-0 [&_.aicg-text-model-select]:!bg-transparent [&_.aicg-text-model-select]:!px-1 [&_.aicg-text-model-select]:!text-white/90 [&_.aicg-text-model-select]:!shadow-none [&_.aicg-text-model-select:hover]:!bg-white/[0.04] [&_.aicg-text-model-select-chevron]:!stroke-white/60"
                textareaClassName="min-h-[112px] rounded-[22px] bg-transparent pb-11 pt-3 text-[13px] leading-6 placeholder:text-white/38"
                inputOverlay={
                  <div className="pointer-events-none absolute inset-x-2 bottom-1.5 flex items-center gap-1.5">
                    <div
                      className="aigen-text-model-select-scope pointer-events-auto nodrag nowheel relative min-w-0 flex-none"
                      onMouseDownCapture={(e) => e.stopPropagation()}
                      onPointerDownCapture={(e) => e.stopPropagation()}
                    >
                      <TextModelSelect
                        value={model}
                        onChange={handleModelChange}
                        title="选择文本模型"
                        ariaLabel="文本模型"
                      />
                    </div>
                    <NodeControllerSummaryBar
                      className="pointer-events-auto nodrag nowheel min-w-0 flex-1 px-1"
                      points={1}
                      items={[
                        { id: 'model', label: model, title: '文本模型' },
                        { id: 'mode', label: '文本生成' },
                      ]}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleTranslate();
                      }}
                      disabled={isTranslating || !localPrompt.trim()}
                      className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:text-white/25 disabled:hover:bg-transparent"
                      title="翻译为英文"
                    >
                      {isTranslating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Languages className="h-4 w-4" strokeWidth={1.75} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isGenerating) handleStopGeneration();
                        else void handleGenerate();
                      }}
                      disabled={!isGenerating && !localPrompt.trim()}
                      className={cn(
                        'pointer-events-auto flex h-8 w-8 items-center justify-center rounded-[9px] transition-all active:scale-95',
                        isGenerating
                          ? 'bg-white/70 text-[#252525] cursor-wait'
                          : !localPrompt.trim()
                            ? 'bg-white/12 text-white/35 cursor-not-allowed'
                            : 'bg-white/70 text-[#252525] hover:bg-white'
                      )}
                      title={isGenerating ? '停止生成' : '生成文本(Enter)'}
                    >
                      {isGenerating ? (
                        <Square className="h-3.5 w-3.5 fill-current" />
                      ) : (
                        <ArrowUp className="h-4 w-4" strokeWidth={2.2} />
                      )}
                    </button>
                  </div>
                }
                onChange={(val) => {
                  setLocalPrompt(val);
                  onSlashTextChange(val);
                }}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={(e) => {
                  setIsComposing(false);
                  const val = e.currentTarget.value;
                  setLocalPrompt(val);
                  handlePromptChange(val);
                }}
                onFocus={() => setIsPromptFocused(true)}
                onBlur={() => {
                  setIsPromptFocused(false);
                  handlePromptChange(localPrompt);
                }}
                onKeyDown={handleKeyDown}
                placeholder={TRY_EXAMPLE_PROMPT}
                slashMenu={
                  slashOpen && slashCommands.length > 0 ? (
                    <AICGSlashMenu
                      commands={slashCommands}
                      className="absolute bottom-full left-2 z-20 mb-1"
                      onSelect={(cmd) => {
                        const next = applySlashCommand(cmd, () => {
                          const line = localPrompt.split('\n').pop() || '';
                          const idx = line.lastIndexOf('/');
                          const prefix = localPrompt.slice(0, localPrompt.length - line.length);
                          return idx >= 0 ? prefix + line.slice(0, idx) : localPrompt;
                        });
                        if (typeof next === 'string') {
                          setLocalPrompt(next);
                          handlePromptChange(next);
                        }
                      }}
                    />
                  ) : null
                }
              />
            </div>
            {/* 高级设置：温度滑块 */}
            <div className="border-t border-white/[0.08] bg-[#101012] px-3 py-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAdvancedSettings((v) => !v);
                }}
                className="nodrag flex w-full items-center justify-between text-[10px] text-white/45 hover:text-white/70"
              >
                <span>高级设置</span>
                <span className="text-white/30">{showAdvancedSettings ? '▾' : '▸'}</span>
              </button>
              {showAdvancedSettings ? (
                <div className="nodrag mt-1.5 flex items-center gap-2">
                  <span className="text-[10px] text-white/45">温度</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={temperature}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleTemperatureChange(Number(e.target.value));
                    }}
                    onMouseDownCapture={(e) => e.stopPropagation()}
                    onPointerDownCapture={(e) => e.stopPropagation()}
                    className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-white"
                  />
                  <span className="w-8 text-right text-[10px] tabular-nums text-white/70">
                    {temperature.toFixed(1)}
                  </span>
                </div>
              ) : null}
            </div>
            {task.status === 'processing' && !hasOutput ? (
              <NodeControllerStatusBar>
                <Loader2 className="h-3 w-3 animate-spin text-white/70" />
                <span>正在生成中,可点击「停止」取消…</span>
              </NodeControllerStatusBar>
            ) : null}
            {task.status === 'failed' && task.error ? (
              <NodeControllerErrorBar>
                <span className="mt-0.5">⚠</span>
                <span className="flex-1 break-all">{task.error}</span>
              </NodeControllerErrorBar>
            ) : null}
          </>
        }
      />

      <SafeStyle
        css={`
          .aigen-text-model-select-scope .jimeng-text-model-select {
            position: relative !important;
            left: auto !important;
            top: auto !important;
            z-index: 40 !important;
            display: inline-flex !important;
            height: 36px !important;
            width: auto !important;
            max-width: 188px !important;
            min-width: 0 !important;
            cursor: pointer !important;
            border: 0 !important;
            border-radius: 8px !important;
            background: transparent !important;
            padding: 0 4px !important;
            color: rgba(255, 255, 255, 0.9) !important;
            box-shadow: none !important;
          }
          .aigen-text-model-select-scope .jimeng-text-model-select:hover {
            background: rgba(255, 255, 255, 0.04) !important;
          }
          .aigen-text-model-select-scope .jimeng-text-model-select > span:first-child {
            flex-shrink: 0 !important;
            min-width: 16px !important;
            min-height: 16px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            line-height: 1 !important;
          }
          .aigen-text-model-select-scope .jimeng-text-model-select > span:first-child > svg {
            display: block !important;
            max-width: 16px !important;
            max-height: 16px !important;
            width: 16px !important;
            height: 16px !important;
            flex-shrink: 0 !important;
          }
          .aigen-text-model-select-scope .jimeng-text-model-select-label {
            max-width: none !important;
            min-width: 0 !important;
            flex: 1 1 auto !important;
            font-size: 10px !important;
            font-weight: 700 !important;
            color: rgba(255, 255, 255, 0.92) !important;
          }
          .aigen-text-model-select-scope .jimeng-text-model-select-meta {
            font-size: 8px !important;
            color: rgba(255, 255, 255, 0.45) !important;
          }
          .aigen-text-model-select-scope .jimeng-text-model-select-chevron {
            margin-left: auto !important;
            stroke: rgba(255, 255, 255, 0.6) !important;
            flex-shrink: 0 !important;
          }
          .aigen-text-model-select-scope .jimeng-text-model-dropdown {
            position: absolute !important;
            left: 0 !important;
            bottom: calc(100% + 8px) !important;
            top: auto !important;
            z-index: 9999 !important;
            width: max-content !important;
            min-width: 260px !important;
            max-width: 360px !important;
            max-height: 320px !important;
            overflow-y: auto !important;
            border-radius: 14px !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            background: rgba(16, 16, 18, 0.98) !important;
            box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55) !important;
            padding: 6px !important;
            backdrop-filter: blur(18px) !important;
          }
          .aigen-text-model-select-scope .jimeng-text-model-dropdown-group-label {
            padding: 8px 8px 5px !important;
            font-size: 10px !important;
            font-weight: 600 !important;
            color: rgba(255, 255, 255, 0.38) !important;
          }
          .aigen-text-model-select-scope .jimeng-text-model-dropdown-option {
            display: grid !important;
            grid-template-columns: 28px minmax(0, 1fr) 18px !important;
            align-items: center !important;
            column-gap: 10px !important;
            min-height: 50px !important;
            cursor: pointer !important;
            border-radius: 10px !important;
            padding: 8px 9px 8px 8px !important;
            color: rgba(255, 255, 255, 0.78) !important;
          }
          .aigen-text-model-select-scope .jimeng-text-model-dropdown-option:hover,
          .aigen-text-model-select-scope .jimeng-text-model-dropdown-option.selected {
            background: rgba(255, 255, 255, 0.09) !important;
            color: #fff !important;
          }
          .aigen-text-model-select-scope .jimeng-text-model-dropdown-icon {
            display: inline-flex !important;
            width: 28px !important;
            height: 28px !important;
            min-width: 28px !important;
            align-items: center !important;
            justify-content: center !important;
            justify-self: center !important;
            overflow: visible !important;
            border-radius: 8px !important;
          }
          .aigen-text-model-select-scope .jimeng-text-model-dropdown-icon svg {
            display: block !important;
            width: 20px !important;
            height: 20px !important;
            max-width: 20px !important;
            max-height: 20px !important;
            flex: 0 0 auto !important;
          }
          .aigen-text-model-select-scope .jimeng-text-model-dropdown-copy {
            min-width: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 2px !important;
            justify-content: center !important;
            text-align: left !important;
          }
          .aigen-text-model-select-scope .jimeng-text-model-dropdown-title,
          .aigen-text-model-select-scope .jimeng-text-model-dropdown-desc,
          .aigen-text-model-select-scope .jimeng-text-model-dropdown-id {
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }
          .aigen-text-model-select-scope .jimeng-text-model-dropdown-title {
            font-size: 12px !important;
            font-weight: 700 !important;
            line-height: 1.25 !important;
            color: #fff !important;
          }
          .aigen-text-model-select-scope .jimeng-text-model-dropdown-desc {
            font-size: 10px !important;
            font-weight: 500 !important;
            line-height: 1.3 !important;
            color: rgba(255, 255, 255, 0.52) !important;
          }
          .aigen-text-model-select-scope .jimeng-text-model-dropdown-check {
            width: 18px !important;
            height: 18px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            justify-self: center !important;
          }
          .aigen-text-model-select-scope .jimeng-text-model-dropdown-check svg {
            display: block !important;
            width: 14px !important;
            height: 14px !important;
          }
          .aigen-text-model-select-scope .jimeng-text-model-dropdown-id {
            font-size: 7px !important;
            line-height: 1.1 !important;
            color: rgba(255, 255, 255, 0.34) !important;
          }
        `}
      />
    </div>
  );
});

AIGenTextNode.displayName = 'AIGenTextNode';

export default AIGenTextNode;
