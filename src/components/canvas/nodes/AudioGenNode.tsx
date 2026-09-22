import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { NodeProps, NodeResizer } from '@xyflow/react';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import AICGNodeShell from './AICGNodeShell';
import AICGSlashMenu from '../AICGSlashMenu';
import { useAICGSlashConnect } from '@/hooks/useAICGSlashConnect';
import { useNodeControllerCollapse } from '@/hooks/useNodeControllerCollapse';
import {
  ArrowUp,
  ChevronUp,
  Download,
  Loader2,
  Pause,
  Play,
  Maximize2,
  Mic2,
  Music,
  RotateCcw,
  Scissors,
  Trash2,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { API_BASE_URL } from '@/lib/api-config';
import { normalizeMediaUrl } from '@/lib/media-url';
import { persistImportedCanvasFile } from '@/services/canvas-asset-actions';
import { sendCanvasMediaToClipEditor } from '@/services/canvas-clip-bridge-service';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import realAPIExecutor from '@/store/real-api-executor';
import { getModelIconConfig } from '@/config/model-icons';
import { useFileStore } from '@/store/useFileStore';
import { permissionService } from '@/services/permission-service';
import type { AudioGenerationParams } from '@/types/ai-models';
import { toast } from 'sonner';
import { NodePointsBadge } from './NodePointsBadge';
import type { NodeControllerAction } from './NodeControllerCapabilityPanel';
import { getNodeControllerPreset } from '@/services/node-controller-capability-registry';
import {
  spawnControllerToolNode,
  withControllerActionConnection,
} from '@/services/node-controller-action-service';
import { CANVAS_NODE_BASE_WIDTH } from '@/lib/canvas-node-dimensions';
import {
  DEFAULT_AUDIO_MUSIC_MODEL_ID,
  DEFAULT_AUDIO_MUSIC_PROVIDER,
  DEFAULT_AUDIO_TTS_MODEL_ID,
  DEFAULT_AUDIO_TTS_PROVIDER,
  DEFAULT_AUDIO_TTS_VOICE_ID,
} from './audio-defaults';

export interface AudioGenNodeData {
  type?: 'audioGen' | 'audioInput';
  text?: string;
  mode?: AudioGenerationParams['mode'];
  voiceId?: string;
  modelProvider?: string;
  modelId?: string;
  audioUrl?: string;
  resultUrl?: string;
  audioAssetId?: string;
  fileName?: string;
  duration?: number;
  referenceAudioUrl?: string;
  referenceFileName?: string;
  isExpanded?: boolean;
  task?: {
    status: 'idle' | 'processing' | 'completed' | 'failed';
    progress?: number;
    error?: string;
  };
  params?: Partial<AudioGenerationParams>;
  isControllerCollapsed?: boolean;
}

const PLACEHOLDER_PROMPT = '输入音乐描述、歌词或配音文本';
const SUPPORTED_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.webm', '.m4a'];
const ACCEPT_FORMATS = '.mp3,.wav,.ogg,.flac,.aac,.webm,.m4a';

const DEFAULT_PARAMS: Partial<AudioGenerationParams> = {
  modelProvider: DEFAULT_AUDIO_TTS_PROVIDER,
  modelId: DEFAULT_AUDIO_TTS_MODEL_ID,
  text: '',
  mode: 'tts',
  voiceId: DEFAULT_AUDIO_TTS_VOICE_ID,
  speed: 1,
  vol: 1,
  pitch: 0,
  emotion: 'neutral',
  sampleRate: 32000,
  bitrate: 128000,
  format: 'mp3',
  channel: 1,
  stream: false,
  languageBoost: 'auto',
  subtitleEnable: false,
  outputFormat: 'url',
  aigcWatermark: false,
};

const AUDIO_TTS_MODELS = [
  'step-tts-2',
  'speech-2.8-hd',
  'speech-2.8-turbo',
  'speech-2.6-hd',
  'speech-2.6-turbo',
] as const;
const MINIMAX_VOICE_PRESETS = [
  { id: 'male-qn-qingse', label: '青涩男声' },
  { id: 'male-qn-jingying', label: '精英男声' },
  { id: 'male-qn-badao', label: '霸道男声' },
  { id: 'male-qn-daxuesheng', label: '大学男声' },
  { id: 'female-shaonv', label: '少女音色' },
  { id: 'female-yujie', label: '御姐音色' },
  { id: 'female-chengshu', label: '成熟女声' },
  { id: 'female-tianmei', label: '甜美女声' },
  { id: 'presenter_male', label: '男主持' },
  { id: 'presenter_female', label: '女主持' },
  { id: 'audiobook_male_1', label: '男旁白 1' },
  { id: 'audiobook_male_2', label: '男旁白 2' },
  { id: 'audiobook_female_1', label: '女旁白 1' },
  { id: 'audiobook_female_2', label: '女旁白 2' },
  { id: 'clever_boy', label: '聪明男孩' },
  { id: 'cute_boy', label: '可爱男孩' },
  { id: 'lovely_girl', label: '可爱女孩' },
  { id: 'cartoon_pig', label: '卡通小猪' },
  { id: 'Chinese (Mandarin)_Reliable_Executive', label: '沉稳高管' },
  { id: 'Chinese (Mandarin)_News_Anchor', label: '新闻女声' },
] as const;

const STEPFUN_VOICE_PRESETS = [
  { id: 'cixingnansheng', label: '磁性男声' },
  { id: 'linjiajiejie', label: '邻家姐姐' },
] as const;

function getProviderForAudioModel(modelId?: string): AudioGenerationParams['modelProvider'] {
  if (!modelId) return DEFAULT_AUDIO_TTS_PROVIDER;
  if (modelId?.startsWith('step')) return 'stepfun' as AudioGenerationParams['modelProvider'];
  return 'minimax';
}

function getVoicePresets(modelId?: string) {
  if (!modelId || modelId.startsWith('step')) return STEPFUN_VOICE_PRESETS;
  return MINIMAX_VOICE_PRESETS;
}

function getModelLabel(modelId?: string) {
  const resolvedModel = modelId || DEFAULT_PARAMS.modelId || DEFAULT_AUDIO_TTS_MODEL_ID;
  const provider = getProviderForAudioModel(resolvedModel);
  return `${provider === 'stepfun' ? 'StepFun' : 'MiniMax'}-${resolvedModel}`;
}

function resolveAudioMode(value: unknown): AudioGenerationParams['mode'] {
  return value === 'music' ||
    value === 'clone' ||
    value === 'design' ||
    value === 'async_tts' ||
    value === 'voice_management'
    ? value
    : 'tts';
}

function AudioLauncherIcon({ actionId }: { actionId: string }) {
  if (actionId === 'voiceover') return <Mic2 className="h-6 w-6" strokeWidth={2} />;
  if (actionId === 'upload-music') return <Upload className="h-6 w-6" strokeWidth={2} />;
  return <Music className="h-6 w-6" strokeWidth={2} />;
}

function AudioPlaceholder({ title, actions }: { title: string; actions: NodeControllerAction[] }) {
  return (
    <div
      className="drag-handle relative flex min-h-[500px] cursor-grab flex-col rounded-[14px] bg-[#101012] px-8 py-7 active:cursor-grabbing"
      data-testid="audio-node-preview"
    >
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 rounded-md border border-white/[0.14] bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/72">
          {title}
        </span>
      </div>
      <div className="mx-auto mt-16 w-24 space-y-3">
        {[92, 78, 66, 48].map((w, i) => (
          <div key={i} className="h-2.5 rounded-sm bg-white/16" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="mt-auto pb-7">
        <p className="mb-7 text-[25px] font-medium tracking-wide text-white/38">尝试:</p>
        <div className="flex flex-col gap-5">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={action.disabled}
              data-testid={`audio-launcher-${action.id}`}
              onMouseDownCapture={(e) => e.stopPropagation()}
              onPointerDownCapture={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick?.();
              }}
              className={cn(
                'nodrag nowheel group flex min-w-0 items-center gap-4 rounded-[12px] text-left text-white/86 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-35',
                action.state === 'connected' && 'text-white'
              )}
              title={
                action.connectedLabel
                  ? `${action.label} · 已连接：${action.connectedLabel}`
                  : action.title || action.label
              }
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center text-white/80 transition-colors group-hover:text-white">
                <AudioLauncherIcon actionId={action.id} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[25px] font-semibold leading-none tracking-normal">
                {action.label}
              </span>
              {action.state === 'connected' ? (
                <span className="shrink-0 rounded-md border border-white/18 bg-white/[0.05] px-2 py-1 text-[10px] font-medium text-white/58">
                  已连接
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const AudioGenNode = memo(({ data, selected, id }: NodeProps) => {
  const nodeData = data as unknown as AudioGenNodeData;
  const mergedParams = useMemo(
    () => ({ ...DEFAULT_PARAMS, ...nodeData.params }),
    [nodeData.params]
  );
  const updateNodeData = canvasStoreApi.updateNodeData;

  const [localPrompt, setLocalPrompt] = useState(nodeData.text ?? mergedParams.text ?? '');
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const nodeType = nodeData.type === 'audioInput' ? 'audioInput' : 'audioGen';
  const isAudioInputNode = nodeType === 'audioInput';
  const audioMode = resolveAudioMode(nodeData.mode ?? mergedParams.mode);
  const currentModelId = String(
    mergedParams.modelId || DEFAULT_PARAMS.modelId || DEFAULT_AUDIO_TTS_MODEL_ID
  );
  const voicePresets = useMemo(() => getVoicePresets(currentModelId), [currentModelId]);
  const modelLabel = getModelLabel(currentModelId);
  const voiceId = String(
    voicePresets.some((voice) => voice.id === mergedParams.voiceId)
      ? mergedParams.voiceId
      : voicePresets[0].id
  );
  const [audioUrl, setAudioUrl] = useState(nodeData.audioUrl ?? nodeData.resultUrl);
  const normalizedAudioUrl = useMemo(() => normalizeMediaUrl(audioUrl), [audioUrl]);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [referenceFileName, setReferenceFileName] = useState(nodeData.referenceFileName);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const {
    controlsCollapsed: isControllerCollapsed,
    expandController,
    onPreviewDoubleClick,
  } = useNodeControllerCollapse(id as string, nodeData, Boolean(nodeData.isControllerCollapsed));

  const task = nodeData.task ?? { status: 'idle' as const };
  const isGenerating = task.status === 'processing';

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const refAudioInputRef = useRef<HTMLInputElement | null>(null);
  // 标记 audioUrl 是否由本地 setSafeAudioUrl 更新，避免 useEffect 双重同步竞态
  const isLocalUpdate = useRef(false);

  const persist = useCallback(
    (patch: Partial<AudioGenNodeData>) => {
      updateNodeData(id as string, { type: nodeType, ...patch });
    },
    [id, nodeType, updateNodeData]
  );

  const setSafeAudioUrl = useCallback((url: string | undefined) => {
    isLocalUpdate.current = true;
    if (blobUrlRef.current && blobUrlRef.current !== url) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (url?.startsWith('blob:')) blobUrlRef.current = url;
    setAudioUrl(url);
  }, []);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (isLocalUpdate.current) {
      isLocalUpdate.current = false;
      return;
    }
    const url = nodeData.audioUrl ?? nodeData.resultUrl;
    if (url && url !== audioUrl) setAudioUrl(url);
  }, [nodeData.audioUrl, nodeData.resultUrl, audioUrl]);

  // 同步外部更新的 referenceFileName
  useEffect(() => {
    setReferenceFileName(nodeData.referenceFileName);
  }, [nodeData.referenceFileName]);

  // 试听生成后自动播放（audioUrl 变化时触发）
  useEffect(() => {
    if (normalizedAudioUrl && audioRef.current) {
      audioRef.current.load();
      audioRef.current.play().catch(() => undefined);
    }
  }, [normalizedAudioUrl]);

  useEffect(() => {
    if (!isPromptFocused && nodeData.text !== undefined && nodeData.text !== localPrompt) {
      setLocalPrompt(nodeData.text);
    }
  }, [nodeData.text, isPromptFocused, localPrompt]);

  const processAudioFile = useCallback(
    async (file: File, kind: 'main' | 'reference') => {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        toast.error('不支持的音频格式');
        return;
      }
      if (file.size > 200 * 1024 * 1024) {
        toast.warning('音频文件过大（最大 200MB）');
        return;
      }

      try {
        const previewUrl = URL.createObjectURL(file);
        let finalUrl = previewUrl;
        let audioAssetId: string | undefined;

        try {
          const persisted = await persistImportedCanvasFile({
            nodeId: id as string,
            kind: 'audio',
            file,
          });
          audioAssetId = persisted.asset.id;
          if (persisted.runtimeUrl && !persisted.runtimeUrl.startsWith('blob:')) {
            finalUrl = persisted.runtimeUrl;
          }
        } catch {
          /* 本地预览仍可用 */
        }

        const usesPreviewUrl = finalUrl.startsWith('blob:');

        if (kind === 'main') {
          const duration = await new Promise<number | undefined>((resolve) => {
            const audio = document.createElement('audio');
            audio.preload = 'metadata';
            audio.onloadedmetadata = () => {
              resolve(Number.isFinite(audio.duration) ? audio.duration : undefined);
              audio.src = '';
            };
            audio.onerror = () => resolve(undefined);
            audio.src = previewUrl;
          });
          setSafeAudioUrl(usesPreviewUrl ? previewUrl : finalUrl);
          if (!usesPreviewUrl) {
            URL.revokeObjectURL(previewUrl);
          }
          persist({
            audioUrl: finalUrl,
            resultUrl: finalUrl,
            fileName: file.name,
            duration,
            audioAssetId,
            task: { status: 'completed' },
          });
          syncDownstreamFromNode(id as string);
          toast.success('音频已加载');
        } else {
          if (!usesPreviewUrl) {
            URL.revokeObjectURL(previewUrl);
          }
          setReferenceFileName(file.name);
          persist({
            referenceAudioUrl: finalUrl,
            referenceFileName: file.name,
          });
          toast.success('已设置参考音色');
        }
      } catch (err) {
        console.error('[AudioGenNode] 处理参考音频失败:', err);
        toast.error('音频处理失败');
      }
    },
    [id, persist, setSafeAudioUrl]
  );

  const handleUploadReference = useCallback(() => {
    refAudioInputRef.current?.click();
  }, []);

  const handleUploadMainAudio = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDropAudio = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const file = Array.from(e.dataTransfer.files).find((item) => {
        const ext = item.name.substring(item.name.lastIndexOf('.')).toLowerCase();
        return item.type.startsWith('audio/') || SUPPORTED_EXTENSIONS.includes(ext);
      });
      if (!file) {
        toast.warning('请拖入音频文件');
        return;
      }
      void processAudioFile(file, 'main');
    },
    [processAudioFile]
  );

  const handleToggleAudioPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (audio.paused) {
      audio
        .play()
        .then(() => setIsAudioPlaying(true))
        .catch(() => toast.warning('音频播放失败'));
    } else {
      audio.pause();
      setIsAudioPlaying(false);
    }
  }, [audioUrl]);

  const handleSendToClip = useCallback(() => {
    const url = audioUrl || nodeData.audioUrl || nodeData.resultUrl;
    if (!url) {
      toast.warning('请先上传或生成音频');
      return;
    }
    sendCanvasMediaToClipEditor(
      [
        {
          url,
          type: 'audio',
          name: nodeData.fileName || '音频节点',
          duration: nodeData.duration,
        },
      ],
      id as string
    );
    toast.success('已发送到 AI 剪辑');
  }, [audioUrl, id, nodeData.audioUrl, nodeData.duration, nodeData.fileName, nodeData.resultUrl]);

  const handleRemoveAudio = useCallback(() => {
    const removedUrl = audioUrl || nodeData.audioUrl || nodeData.resultUrl;
    audioRef.current?.pause();
    setIsAudioPlaying(false);
    setSafeAudioUrl(undefined);
    persist({
      audioUrl: '',
      resultUrl: '',
      fileName: '',
      audioAssetId: undefined,
      duration: undefined,
      task: { status: 'idle' },
    });

    const clearSyncedDownstreamAudio = () => {
      const outgoingTargetIds = new Set(
        canvasStoreApi
          .getEdges()
          .filter((edge) => edge.source === id)
          .map((edge) => edge.target)
      );

      for (const target of canvasStoreApi.getNodes()) {
        if (target.id === id) continue;
        const targetData = (target.data ?? {}) as Record<string, unknown>;
        const syncedFromThisNode = targetData._aicgSyncedFrom === id;
        const targetHasRemovedUrl =
          !!removedUrl &&
          [
            targetData.audioUrl,
            targetData.receivedAudioUrl,
            targetData.resultUrl,
            targetData.url,
          ].includes(removedUrl);
        if (!outgoingTargetIds.has(target.id) && !syncedFromThisNode && !targetHasRemovedUrl)
          continue;
        canvasStoreApi.updateNodeData(target.id, {
          audioUrl: '',
          receivedAudioUrl: '',
          resultUrl: '',
          output: '',
          url: '',
          mediaType: undefined,
          _aicgSyncedFrom: undefined,
          _aicgSyncedAt: Date.now(),
        });
      }
    };

    clearSyncedDownstreamAudio();
    window.setTimeout(clearSyncedDownstreamAudio, 500);
    window.setTimeout(clearSyncedDownstreamAudio, 1500);
    toast.success('音频已移除');
  }, [audioUrl, id, nodeData.audioUrl, nodeData.resultUrl, persist, setSafeAudioUrl]);

  const runAudioLauncherAction = useCallback(
    (actionId: string, replaceExisting = false) => {
      const prompt = localPrompt.trim();
      const baseParams = {
        ...DEFAULT_PARAMS,
        ...mergedParams,
        text: prompt,
        prompt,
      };

      if (actionId === 'text-to-music') {
        spawnControllerToolNode(id as string, 'audioGen', {
          controllerActionId: actionId,
          replaceExisting,
          label: '文生配音',
          toastLabel: '文生配音',
          sourceHandle: 'audioOutput',
          targetHandle: 'prompt',
          initialData: {
            text: prompt,
            prompt,
            mode: 'tts',
            params: {
              ...baseParams,
              mode: 'tts',
              modelProvider: DEFAULT_AUDIO_TTS_PROVIDER,
              modelId: DEFAULT_AUDIO_TTS_MODEL_ID,
            },
          },
        });
        return;
      }

      if (actionId === 'voiceover') {
        spawnControllerToolNode(id as string, 'audioGen', {
          controllerActionId: actionId,
          replaceExisting,
          label: 'AI配音',
          toastLabel: 'AI配音',
          sourceHandle: 'audioOutput',
          targetHandle: 'prompt',
          initialData: {
            text: prompt,
            prompt,
            mode: 'tts',
            params: {
              ...baseParams,
              mode: 'tts',
              voiceId,
            },
          },
        });
        return;
      }

      if (actionId === 'upload-music') {
        spawnControllerToolNode(id as string, 'audioInput', {
          controllerActionId: actionId,
          replaceExisting,
          label: '上传音乐',
          toastLabel: '上传音乐',
          sourceHandle: 'audioOutput',
          targetHandle: 'input',
          initialData: {
            type: 'audioInput',
            text: prompt,
            prompt,
            params: {
              ...baseParams,
              mode: 'tts',
            },
          },
        });
        return;
      }
    },
    [id, localPrompt, mergedParams, voiceId]
  );

  const runAudioDownstreamAction = useCallback(
    (actionId: string, replaceExisting = false) => {
      const prompt = localPrompt.trim() || '根据音频内容生成视频';
      const sourceAudioUrl = audioUrl || nodeData.audioUrl || nodeData.resultUrl || '';

      if (actionId === 'audio-to-video') {
        spawnControllerToolNode(id as string, 'aiVideo', {
          controllerActionId: actionId,
          replaceExisting,
          label: '音频生视频',
          toastLabel: '音频生视频',
          sourceHandle: 'audioOutput',
          targetHandle: 'input',
          initialData: {
            audioUrl: sourceAudioUrl,
            receivedAudioUrl: sourceAudioUrl,
            params: {
              prompt,
              generationMode: 'text_to_video',
              audioGeneration: 'audio-driven',
            },
          },
        });
        return;
      }

      if (actionId === 'audio-output') {
        spawnControllerToolNode(id as string, 'output', {
          controllerActionId: actionId,
          replaceExisting,
          label: '音频导出',
          toastLabel: '音频导出',
          sourceHandle: 'audioOutput',
          targetHandle: 'audio',
          initialData: {
            audioUrl: sourceAudioUrl,
            url: sourceAudioUrl,
            mediaType: 'audio',
            fileName: nodeData.fileName || '音频输出',
          },
        });
      }
    },
    [audioUrl, id, localPrompt, nodeData.audioUrl, nodeData.fileName, nodeData.resultUrl]
  );

  const handleGenerate = useCallback(async () => {
    const content = localPrompt.trim();
    if (!content) {
      toast.error('请输入音频描述或文本');
      return;
    }

    // P1 修复 BUG-S4：权限校验
    const permProvider =
      audioMode === 'music'
        ? DEFAULT_AUDIO_MUSIC_PROVIDER
        : getProviderForAudioModel(currentModelId);
    const permModel = audioMode === 'music' ? DEFAULT_AUDIO_MUSIC_MODEL_ID : currentModelId;
    try {
      const permCheck = await permissionService.checkPermission('audio', 1, {
        provider: permProvider,
        model: permModel,
      });
      if (!permCheck.allowed) {
        toast.error(permCheck.message || '额度不足，请升级会员或充值积分');
        return;
      }
    } catch (err) {
      console.warn('[AudioGenNode] 权限检查失败:', err);
      toast.error('权限检查失败，请稍后重试');
      return;
    }

    persist({ task: { status: 'processing', progress: 0 } });

    try {
      const params: AudioGenerationParams = {
        ...DEFAULT_PARAMS,
        ...mergedParams,
        text: content,
        prompt: content,
        mode: audioMode,
        modelId: audioMode === 'music' ? DEFAULT_AUDIO_MUSIC_MODEL_ID : currentModelId,
        voiceId,
        modelProvider:
          audioMode === 'music'
            ? DEFAULT_AUDIO_MUSIC_PROVIDER
            : getProviderForAudioModel(currentModelId),
      };

      const result = await realAPIExecutor.executeAudioGen({
        id: id as string,
        params,
      });

      if (result.status === 'failed' || !result.resultUrl) {
        persist({ task: { status: 'failed', error: result.error || '生成失败' } });
        toast.error(result.error || '音频生成失败');
        return;
      }

      const generatedAudioUrl = normalizeMediaUrl(result.resultUrl);
      setSafeAudioUrl(generatedAudioUrl);
      persist({
        audioUrl: generatedAudioUrl,
        resultUrl: generatedAudioUrl,
        mode: audioMode,
        task: { status: 'completed', progress: 100 },
      });
      await useFileStore.getState().registerGeneratedFile({
        name: `${audioMode === 'music' ? 'AI音乐' : 'AI配音'}_${Date.now()}.mp3`,
        type: 'audio',
        url: generatedAudioUrl,
        size: 0,
        source: 'generated',
        metadata: {
          format: 'mp3',
          model: params.modelId,
          provider: params.modelProvider,
          prompt: content,
          category: audioMode === 'music' ? 'music' : 'dubbing',
        },
      });
      syncDownstreamFromNode(id as string);
      toast.success('音频生成完成');
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败';
      persist({ task: { status: 'failed', error: message } });
      toast.error(message);
    }
  }, [localPrompt, audioMode, mergedParams, id, persist, setSafeAudioUrl, currentModelId, voiceId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      e.stopPropagation();
      if (e.nativeEvent.isComposing || e.key === 'Process') return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isGenerating) handleGenerate();
      }
    },
    [handleGenerate, isGenerating]
  );

  const {
    slashOpen,
    slashCommands,
    onTextChange: onSlashTextChange,
    applySlashCommand,
  } = useAICGSlashConnect(id as string, nodeType, 'audioOutput');

  const updatePrompt = useCallback(
    (next: string) => {
      setLocalPrompt(next);
      onSlashTextChange(next);
      persist({
        text: next,
        params: { ...mergedParams, text: next, prompt: next, mode: audioMode },
      });
    },
    [audioMode, mergedParams, onSlashTextChange, persist]
  );

  const appendToken = useCallback(
    (token: string) => {
      const next = localPrompt ? `${localPrompt}${token}` : token;
      updatePrompt(next);
    },
    [localPrompt, updatePrompt]
  );

  const handlePreviewVoice = useCallback(async () => {
    const previewText = (localPrompt.trim() || '你好，我是你的配音演员。').slice(0, 120);
    persist({ task: { status: 'processing', progress: 0 } });
    try {
      const params: AudioGenerationParams = {
        ...DEFAULT_PARAMS,
        ...mergedParams,
        text: previewText,
        prompt: previewText,
        mode: 'tts',
        modelId: currentModelId,
        voiceId,
        modelProvider: getProviderForAudioModel(currentModelId),
      };
      const result = await realAPIExecutor.executeAudioGen({ id: id as string, params });
      if (result.status === 'failed' || !result.resultUrl) {
        persist({ task: { status: 'failed', error: result.error || '试听失败' } });
        toast.error(result.error || '试听失败');
        return;
      }
      const generatedAudioUrl = normalizeMediaUrl(result.resultUrl);
      setSafeAudioUrl(generatedAudioUrl);
      persist({
        audioUrl: generatedAudioUrl,
        resultUrl: generatedAudioUrl,
        mode: 'tts',
        task: { status: 'completed', progress: 100 },
      });
      await useFileStore.getState().registerGeneratedFile({
        name: `AI配音试听_${Date.now()}.mp3`,
        type: 'audio',
        url: generatedAudioUrl,
        size: 0,
        source: 'generated',
        metadata: {
          format: 'mp3',
          model: params.modelId,
          provider: params.modelProvider,
          prompt: previewText,
          category: 'dubbing-preview',
        },
      });
      syncDownstreamFromNode(id as string);
      toast.success('试听已生成');
    } catch (error) {
      const message = error instanceof Error ? error.message : '试听失败';
      persist({ task: { status: 'failed', error: message } });
      toast.error(message);
    }
  }, [id, localPrompt, mergedParams, persist, setSafeAudioUrl, currentModelId, voiceId]);

  const selectModel = useCallback(
    (modelId: string) => {
      const nextVoices = getVoicePresets(modelId);
      const nextVoiceId = nextVoices.some((voice) => voice.id === mergedParams.voiceId)
        ? mergedParams.voiceId
        : nextVoices[0].id;
      persist({
        params: {
          ...mergedParams,
          modelId,
          modelProvider: getProviderForAudioModel(modelId),
          voiceId: nextVoiceId,
        },
      });
      toast.success(`模型：${getModelLabel(modelId)}`);
      setShowModelMenu(false);
    },
    [mergedParams, persist]
  );

  const audioControllerPreset = getNodeControllerPreset('audio');
  const audioTryActions: NodeControllerAction[] = useMemo(() => {
    const branchNodeTypes: Record<string, string> = {
      'text-to-music': 'audioGen',
      voiceover: 'audioGen',
      'upload-music': 'audioInput',
    };

    return audioControllerPreset.tryActions.map((action) =>
      withControllerActionConnection({
        sourceNodeId: id as string,
        action: {
          ...action,
          title: action.title || `创建并连接「${action.label}」子节点`,
          onClick: () => runAudioLauncherAction(action.id),
        },
        binding: {
          actionId: action.id,
          nodeType: branchNodeTypes[action.id],
          onReplace: () => runAudioLauncherAction(action.id, true),
        },
      })
    );
  }, [audioControllerPreset.tryActions, id, runAudioLauncherAction]);
  const audioResultActions: NodeControllerAction[] = useMemo(
    () => [
      {
        id: 'generate-audio',
        label: '生成音频',
        icon: 'sparkles',
        tone: 'primary',
        disabled: isGenerating || !localPrompt.trim(),
        state: audioUrl ? 'connected' : localPrompt.trim() ? 'ready' : 'idle',
        onClick: () => {
          if (!isGenerating) void handleGenerate();
        },
      },
      {
        id: 'send-to-clip',
        label: 'AI剪辑',
        icon: 'split',
        tone: 'primary',
        disabled: !audioUrl,
        state: audioUrl ? 'ready' : 'idle',
        onClick: handleSendToClip,
      },
      {
        ...withControllerActionConnection({
          sourceNodeId: id as string,
          action: {
            id: 'audio-to-video',
            label: '音频生视频',
            icon: 'video',
            disabled: !audioUrl && !localPrompt.trim(),
            onClick: () => runAudioDownstreamAction('audio-to-video'),
          },
          binding: {
            actionId: 'audio-to-video',
            nodeType: 'aiVideo',
            onReplace: () => runAudioDownstreamAction('audio-to-video', true),
          },
        }),
      },
      {
        ...withControllerActionConnection({
          sourceNodeId: id as string,
          action: {
            id: 'audio-output',
            label: '导出节点',
            icon: 'export',
            disabled: !audioUrl,
            onClick: () => runAudioDownstreamAction('audio-output'),
          },
          binding: {
            actionId: 'audio-output',
            nodeType: 'output',
            onReplace: () => runAudioDownstreamAction('audio-output', true),
          },
        }),
      },
      {
        id: 'remove-audio',
        label: '移除',
        icon: 'trash',
        tone: 'muted',
        disabled: !audioUrl,
        onClick: handleRemoveAudio,
      },
    ],
    [
      audioUrl,
      handleGenerate,
      handleRemoveAudio,
      handleSendToClip,
      id,
      isGenerating,
      localPrompt,
      runAudioDownstreamAction,
    ]
  );

  return (
    <div
      className="group relative flex flex-col overflow-visible"
      style={{ width: CANVAS_NODE_BASE_WIDTH, minHeight: 600 }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_FORMATS}
        className="hidden"
        data-testid="audio-node-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processAudioFile(file, 'main');
          e.target.value = '';
        }}
      />
      <input
        ref={refAudioInputRef}
        type="file"
        accept={ACCEPT_FORMATS}
        className="hidden"
        data-testid="audio-node-reference-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processAudioFile(file, 'reference');
          e.target.value = '';
        }}
      />

      {selected && (
        <NodeResizer
          color="rgba(255,255,255,0.25)"
          handleClassName="!h-3 !w-3 !rounded-sm !border-0 !bg-white/30 !opacity-0"
          lineClassName="!hidden"
          minWidth={CANVAS_NODE_BASE_WIDTH}
          minHeight={520}
          maxWidth={760}
          isVisible
          keepAspectRatio={false}
        />
      )}

      <AICGNodeShell
        variant="glass-stack"
        aicgType="audio"
        title={isAudioInputNode ? '音频输入' : '音频'}
        subtitle={isAudioInputNode ? '上传 / 预览 / 下游同步' : `${modelLabel} · / 指令`}
        selected={selected}
        width={CANVAS_NODE_BASE_WIDTH}
        bodyClassName="p-0 [&_.aicg-node-body]:p-0 [&_.audio-model-select]:!h-8 [&_.audio-model-select]:!border-0 [&_.audio-model-select]:!bg-transparent [&_.audio-model-select]:!px-0 [&_.audio-model-select]:!text-white/90 [&_.audio-model-select]:!shadow-none"
        hideControlHeader
        onDelete={() => {
          audioRef.current?.pause();
          canvasStoreApi.deleteNode(id as string);
        }}
        controlsCollapsed={isControllerCollapsed}
        onPreviewDoubleClick={onPreviewDoubleClick}
        preview={
          <AudioPlaceholder
            title={isAudioInputNode ? '音频输入' : '音频'}
            actions={audioTryActions}
          />
        }
        controls={
          <>
            {slashOpen && slashCommands.length > 0 && (
              <AICGSlashMenu
                commands={slashCommands}
                className="absolute bottom-full left-2 mb-1 z-20"
                onSelect={(cmd) => {
                  const next = applySlashCommand(cmd, () => {
                    const line = localPrompt.split('\n').pop() || '';
                    const idx = line.lastIndexOf('/');
                    const prefix = localPrompt.slice(0, localPrompt.length - line.length);
                    return idx >= 0 ? prefix + line.slice(0, idx) : localPrompt;
                  });
                  if (typeof next === 'string') {
                    setLocalPrompt(next);
                    persist({
                      text: next,
                      params: { ...mergedParams, text: next, prompt: next, mode: audioMode },
                    });
                  }
                }}
              />
            )}
            {/* 音频控制器已拆分为独立节点：双击预览区或点击“音乐控制器”创建/聚焦 */}
            <div
              className="nodrag nowheel relative bg-[#101012]"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={handleDropAudio}
            >
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUploadMainAudio();
                  }}
                  className="nodrag nowheel inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 text-[11px] font-medium text-white/78 transition-colors hover:bg-white/[0.1] hover:text-white"
                  data-testid="audio-node-upload"
                  aria-label="上传音频"
                >
                  <Upload className="h-3.5 w-3.5" />
                  上传
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUploadReference();
                  }}
                  className="nodrag nowheel inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 text-[11px] font-medium text-white/62 transition-colors hover:bg-white/[0.08] hover:text-white"
                  data-testid="audio-node-reference-upload"
                  aria-label="上传参考音色"
                >
                  参考音色
                </button>
                <div className="min-w-0 flex-1 text-[11px] text-white/45">
                  <span className="block truncate" data-testid="audio-node-file-name">
                    {nodeData.fileName ||
                      (audioUrl ? '已加载音频' : '支持 MP3, WAV, OGG, FLAC, AAC, WebM, M4A')}
                  </span>
                  {referenceFileName ? (
                    <span className="block truncate text-[10px] text-white/32">
                      参考：{referenceFileName}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleAudioPlay();
                  }}
                  disabled={!audioUrl}
                  className="nodrag nowheel flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                  data-testid="audio-node-play-toggle"
                  aria-label={isAudioPlaying ? '暂停音频' : '播放音频'}
                >
                  {isAudioPlaying ? (
                    <Pause className="h-4 w-4 fill-current" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendToClip();
                  }}
                  disabled={!audioUrl}
                  className="nodrag nowheel flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                  data-testid="audio-node-send-to-clip"
                  aria-label="发送音频到AI剪辑"
                >
                  <Scissors className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (audioUrl) {
                      const targetUrl = new URL(audioUrl, window.location.origin);
                      const backendOrigin = new URL(API_BASE_URL, window.location.origin).origin;
                      const downloadUrl =
                        targetUrl.origin === window.location.origin || targetUrl.origin === backendOrigin
                          ? targetUrl.toString()
                          : `${API_BASE_URL}/audio/proxy-download?url=${encodeURIComponent(targetUrl.toString())}`;
                      const a = document.createElement('a');
                      a.href = downloadUrl;
                      a.download = `audio-${Date.now()}.mp3`;
                      a.click();
                    }
                  }}
                  disabled={!audioUrl}
                  className="nodrag nowheel flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                  data-testid="audio-node-download"
                  aria-label="下载音频"
                  title="下载音频"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveAudio();
                  }}
                  disabled={!audioUrl}
                  className="nodrag nowheel flex h-8 w-8 items-center justify-center rounded-lg text-red-300/75 transition-colors hover:bg-red-500/15 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-35"
                  data-testid="audio-node-remove"
                  aria-label="移除音频"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {audioUrl ? (
                <audio
                  ref={audioRef}
                  src={normalizedAudioUrl}
                  className="nodrag nowheel mx-3 mt-2 h-9 w-[calc(100%-1.5rem)]"
                  controls
                  data-testid="audio-node-player"
                  onPlay={() => setIsAudioPlaying(true)}
                  onPause={() => setIsAudioPlaying(false)}
                  onEnded={() => setIsAudioPlaying(false)}
                />
              ) : null}
              {task.status === 'failed' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGenerate();
                  }}
                  className="nodrag nowheel mx-3 mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-500/15 px-3 text-[11px] font-medium text-red-200 transition-colors hover:bg-red-500/25"
                  data-testid="audio-node-retry"
                >
                  <RotateCcw className="h-3 w-3" />
                  重试
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  expandController();
                }}
                className="nodrag nowheel absolute right-3 top-[52px] z-10 flex h-6 w-6 items-center justify-center rounded-md text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white/70"
                title="展开输入框"
                data-testid="audio-node-expand"
              >
                <Maximize2 className="h-4 w-4" strokeWidth={1.8} />
              </button>
              <textarea
                value={localPrompt}
                onChange={(e) => {
                  e.stopPropagation();
                  const v = e.target.value;
                  setLocalPrompt(v);
                  onSlashTextChange(v);
                }}
                onFocus={(e) => {
                  e.stopPropagation();
                  setIsPromptFocused(true);
                }}
                onBlur={(e) => {
                  e.stopPropagation();
                  setIsPromptFocused(false);
                  persist({
                    text: localPrompt,
                    params: {
                      ...mergedParams,
                      text: localPrompt,
                      prompt: localPrompt,
                      mode: audioMode,
                    },
                  });
                }}
                onKeyDown={handleKeyDown}
                onKeyUp={(e) => e.stopPropagation()}
                onInput={(e) => e.stopPropagation()}
                onBeforeInput={(e) => e.stopPropagation()}
                onCompositionStart={(e) => e.stopPropagation()}
                onCompositionEnd={(e) => e.stopPropagation()}
                onPointerDownCapture={(e) => e.stopPropagation()}
                onMouseDownCapture={(e) => e.stopPropagation()}
                placeholder={PLACEHOLDER_PROMPT}
                rows={4}
                maxLength={50000}
                className="nodrag nowheel min-h-[92px] w-full resize-none rounded-[22px] bg-transparent pb-11 pt-3 text-[13px] leading-6 text-white placeholder:text-white/38 focus:outline-none select-text"
                data-testid="audio-node-prompt"
                style={{ userSelect: 'text', cursor: 'text' }}
              />
              <div className="pointer-events-none absolute inset-x-2 bottom-1.5 flex items-center gap-1.5">
                <div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-1.5">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowModelMenu((prev) => !prev);
                      }}
                      className="nodrag nowheel flex max-w-[150px] shrink-0 items-center gap-1.5 rounded-[5px] bg-transparent px-2 text-[11px] font-medium text-white/65 transition-colors hover:bg-white/[0.04] hover:text-white/90"
                      title="切换音频模型"
                      data-testid="audio-node-model-cycle"
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/35 text-[10px] text-white/60">
                        {getModelIconConfig(currentModelId).icon}
                      </span>
                      <span className="truncate">{modelLabel}</span>
                      <ChevronUp
                        className={cn(
                          'h-3.5 w-3.5 shrink-0 text-white/45 transition-transform',
                          showModelMenu && '-rotate-180'
                        )}
                        strokeWidth={1.8}
                      />
                    </button>
                    {showModelMenu && (
                      <div className="absolute bottom-full left-0 mb-1 z-50 w-48 max-h-[200px] overflow-y-auto rounded-xl border border-white/10 bg-[#151518] shadow-2xl">
                        {AUDIO_TTS_MODELS.map((model) => {
                          const iconConfig = getModelIconConfig(model);
                          return (
                            <button
                              key={model}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectModel(model);
                              }}
                              className={cn(
                                'w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] font-medium transition-colors',
                                model === currentModelId
                                  ? 'bg-white/[0.08] text-white'
                                  : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                              )}
                            >
                              {model === currentModelId && (
                                <span className="text-white/70 text-[8px]">✓</span>
                              )}
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[10px]">
                                {iconConfig.icon}
                              </span>
                              <span className="truncate">{getModelLabel(model)}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      appendToken('<#1#>');
                    }}
                    className="nodrag nowheel inline-flex h-6 items-center gap-1 rounded-[5px] bg-transparent px-2 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/[0.04] hover:text-white/90"
                    title="插入 1 秒停顿"
                    data-testid="audio-node-insert-pause"
                  >
                    <span className="text-[10px] text-white/45">1s</span>
                    停顿
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      appendToken('(laughs)');
                    }}
                    className="nodrag nowheel inline-flex h-6 items-center rounded-[5px] bg-transparent px-2 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/[0.04] hover:text-white/90"
                    title="插入笑声语气"
                    data-testid="audio-node-insert-emotion"
                  >
                    笑声
                  </button>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreviewVoice();
                  }}
                  disabled={isGenerating}
                  className="nodrag nowheel pointer-events-auto flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                  title="试听音色"
                  data-testid="audio-node-preview-voice"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                  ) : (
                    <Play className="h-4 w-4 fill-current" strokeWidth={1.75} />
                  )}
                </button>
                <div className="pointer-events-auto relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowVoiceMenu((prev) => !prev);
                      setShowModelMenu(false);
                    }}
                    className="nodrag nowheel flex h-8 w-[118px] items-center gap-1.5 rounded-[9px] border border-white/[0.08] bg-white/[0.045] px-2 transition-colors hover:border-white/[0.14] hover:bg-white/[0.08]"
                    title={`音色：${voiceId}`}
                    data-testid="audio-node-voice-select"
                  >
                    <Mic2 className="h-3.5 w-3.5 text-white/65" strokeWidth={1.8} />
                    <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white/78">
                      {voicePresets.find((v) => v.id === voiceId)?.label || voiceId}
                    </span>
                    <ChevronUp
                      className={cn(
                        'h-3.5 w-3.5 text-white/45 transition-transform',
                        showVoiceMenu && '-rotate-180'
                      )}
                      strokeWidth={1.8}
                    />
                  </button>
                  {showVoiceMenu && (
                    <div className="absolute bottom-full left-0 mb-1 z-50 w-40 max-h-[200px] overflow-y-auto rounded-xl border border-white/10 bg-[#151518] shadow-2xl">
                      {voicePresets.map((voice) => (
                        <button
                          key={voice.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            persist({ params: { ...mergedParams, voiceId: voice.id } });
                            toast.success(`音色：${voice.label}`);
                            setShowVoiceMenu(false);
                          }}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] font-medium transition-colors',
                            voice.id === voiceId
                              ? 'bg-white/[0.08] text-white'
                              : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                          )}
                        >
                          {voice.id === voiceId && (
                            <span className="text-white/70 text-[8px]">✓</span>
                          )}
                          <Mic2
                            className={cn(
                              'h-3.5 w-3.5 shrink-0',
                              voice.id === voiceId ? 'text-white/72' : 'text-white/45'
                            )}
                            strokeWidth={1.8}
                          />
                          <span className="truncate">{voice.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="pointer-events-none text-[12px] text-white/35 tabular-nums">
                  {localPrompt.length}/50000
                </span>
                <NodePointsBadge points={1} />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isGenerating) handleGenerate();
                  }}
                  disabled={isGenerating || !localPrompt.trim()}
                  className={cn(
                    'pointer-events-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] transition-all active:scale-95',
                    isGenerating
                      ? 'bg-white/70 text-[#252525] cursor-wait'
                      : localPrompt.trim()
                        ? 'bg-white/70 text-[#252525] hover:bg-white'
                        : 'cursor-not-allowed bg-white/12 text-white/35'
                  )}
                  title="生成音频"
                  data-testid="audio-node-generate"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" strokeWidth={2.2} />
                  )}
                </button>
              </div>
            </div>
          </>
        }
      />
      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType={nodeType}
        inputId="input"
        extraInputs={['prompt']}
        outputId="audioOutput"
        inputTip="音频 / 文本输入"
        outputTip="音频输出"
      />
    </div>
  );
});

AudioGenNode.displayName = 'AudioGenNode';

export default AudioGenNode;
