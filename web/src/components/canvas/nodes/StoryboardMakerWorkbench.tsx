import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Clapperboard,
  Copy,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Palette,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Wand2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/api-config';
import { getStoryboardRhythmSummary } from './storyboard-maker-professional';
import type { ScriptScene } from '@/types/node-data';
import {
  resolveStoryboardOutputMode,
  STORYBOARD_OUTPUT_MODES,
  STORYBOARD_PANEL_OPTIONS,
  supportsStoryboardPanelCount,
  type StoryboardOutputMode,
  type StoryboardPanelCount,
} from '@/types/storyboard-output-mode';
import type { StoryboardContinuityValidationWarning } from '@/services/storyboard-continuity-validator';
import type { StoryboardDoubaoSeedreamProvider } from './storyboard-sheet-execution';

export type StoryboardSourceMode =
  | 'text'
  | 'image_reference'
  | 'video_reference'
  | 'character_reference';

interface StoryboardMakerWorkbenchProps {
  prompt: string;
  sourceMode: StoryboardSourceMode;
  outputMode: StoryboardOutputMode;
  panelCount: StoryboardPanelCount;
  targetDuration: number;
  tone: string;
  style: string;
  scenes: ScriptScene[];
  references: {
    visual: string[];
    character: string[];
    video: string[];
    text: string[];
  };
  imageModelLabel: string;
  imageModelProvider: StoryboardDoubaoSeedreamProvider;
  imageModelOptions: ReadonlyArray<{ provider: StoryboardDoubaoSeedreamProvider; label: string }>;
  planningPoints: number;
  warnings: StoryboardContinuityValidationWarning[];
  isGenerating: boolean;
  isGeneratingFrames: boolean;
  generationProgress: number;
  generatedGridImageUrl?: string;
  generatedFrames: Array<{
    cellIndex: number;
    imageUrl?: string;
    status: 'succeeded' | 'failed';
    error?: string;
  }>;
  isOptimizingPrompt: boolean;
  error?: string | null;
  canGenerate: boolean;
  onPromptChange: (value: string) => void;
  onSourceModeChange: (mode: StoryboardSourceMode) => void;
  onOutputModeChange: (mode: StoryboardOutputMode) => void;
  onPanelCountChange: (count: StoryboardPanelCount) => void;
  onImageModelProviderChange: (provider: StoryboardDoubaoSeedreamProvider) => void;
  onTargetDurationChange: (value: number) => void;
  onToneChange: (value: string) => void;
  onStyleChange: (value: string) => void;
  onOptimizePrompt: () => void;
  onImport: () => void;
  onGenerate: () => void;
  onConfirm: () => void;
  onAddScene: () => void;
  onUpdateScene: (sceneId: string, patch: Partial<ScriptScene>) => void;
  onMoveScene: (sceneId: string, direction: 'up' | 'down') => void;
  onDuplicateScene: (sceneId: string) => void;
  onDeleteScene: (sceneId: string) => void;
  onBuildWorkflow: () => void;
  onExport: () => void;
}

const SOURCE_OPTIONS: Array<{
  value: StoryboardSourceMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: 'text', label: '文字', icon: FileText },
  { value: 'image_reference', label: '视觉参考', icon: ImageIcon },
  { value: 'video_reference', label: '视频参考', icon: Film },
  { value: 'character_reference', label: '角色参考', icon: UserRound },
];

const TONE_OPTIONS = [
  { value: 'suspense', label: '悬疑' },
  { value: 'casual', label: '自然' },
  { value: 'formal', label: '克制' },
  { value: 'inspirational', label: '昂扬' },
  { value: 'humorous', label: '幽默' },
];

const SHOT_OPTIONS = [
  { value: 'wide', label: '全景' },
  { value: 'medium', label: '中景' },
  { value: 'medium_close', label: '中近景' },
  { value: 'closeup', label: '特写' },
  { value: 'insert', label: '细节' },
];

const ANGLE_OPTIONS = [
  { value: 'eye_level', label: '平视' },
  { value: 'low_angle', label: '低机位' },
  { value: 'high_angle', label: '高机位' },
  { value: 'over_shoulder', label: '过肩' },
  { value: 'pov', label: '主观' },
];

const MOVE_OPTIONS = [
  { value: 'static', label: '固定' },
  { value: 'push_in', label: '推进' },
  { value: 'pull_out', label: '拉远' },
  { value: 'pan', label: '横摇' },
  { value: 'track', label: '跟拍' },
];

const TRANSITION_OPTIONS = [
  { value: 'cut', label: '硬切' },
  { value: 'match', label: '匹配剪辑' },
  { value: 'dissolve', label: '叠化' },
  { value: 'fade', label: '淡变' },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[9px] font-medium text-white/42">{children}</span>;
}

function CompactSelect({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <label className="min-w-0 flex-1">
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="nodrag nowheel mt-1 h-8 w-full rounded-md border border-white/[0.08] bg-[#15171b] px-2 text-[10px] text-white/78 outline-none transition focus:border-amber-300/35"
        onPointerDownCapture={(event) => event.stopPropagation()}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-[#15171b] text-white">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  label,
  value,
  placeholder,
  rows = 2,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="nodrag nowheel mt-1 w-full resize-none rounded-md border border-white/[0.07] bg-black/25 px-2.5 py-2 text-[10px] leading-5 text-white/76 outline-none placeholder:text-white/22 focus:border-amber-300/30"
        onPointerDownCapture={(event) => event.stopPropagation()}
        onMouseDownCapture={(event) => event.stopPropagation()}
      />
    </label>
  );
}

function parseList(value: string): string[] {
  return value
    .split(/[、,，;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const OUTPUT_MODE_PRESENTATION: Record<
  StoryboardOutputMode,
  {
    icon: React.ComponentType<{ className?: string }>;
    delivery: string;
  }
> = {
  director_storyboard_sheet: { icon: Clapperboard, delivery: '单张黑白手绘分镜成品' },
  storyboard_sheet: { icon: Film, delivery: '单张写实电影分镜参考' },
  character_design_sheet: { icon: Palette, delivery: '单张角色多视图 + 校色与材质设定' },
  cinematic_relationship_board: { icon: ImageIcon, delivery: '单张电影主视觉 + 局部人物参考' },
};

function StoryboardShotRow({
  scene,
  index,
  total,
  expanded,
  warningCount,
  onToggle,
  onUpdate,
  onMove,
  onDuplicate,
  onDelete,
}: {
  scene: ScriptScene;
  index: number;
  total: number;
  expanded: boolean;
  warningCount: number;
  onToggle: () => void;
  onUpdate: (patch: Partial<ScriptScene>) => void;
  onMove: (direction: 'up' | 'down') => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-lg border border-white/[0.07] bg-black/20 transition-colors focus-within:border-amber-300/30 focus-within:bg-black/28">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="nodrag flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-[10px] font-semibold text-white/72 hover:bg-white/[0.1]"
          title={expanded ? '收起镜头详情' : '展开镜头详情'}
        >
          {String(index + 1).padStart(2, '0')}
        </button>
        <input
          value={scene.beat || ''}
          onChange={(event) => onUpdate({ beat: event.target.value })}
          className="nodrag min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-[11px] font-medium text-white/82 outline-none placeholder:text-white/25 transition focus:border-amber-300/25 focus:bg-black/20"
          placeholder="镜头标题／这一镜的剧情作用"
          aria-label={`镜头 ${index + 1} 标题`}
          onPointerDownCapture={(event) => event.stopPropagation()}
        />
        {warningCount > 0 ? (
          <span
            className="flex shrink-0 items-center gap-1 text-[9px] text-amber-200/70"
            title={`${warningCount} 条连续性建议`}
          >
            <AlertTriangle className="h-3 w-3" />
            {warningCount}
          </span>
        ) : null}
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove('up')}
            disabled={index === 0}
            className="nodrag rounded p-1 text-white/30 hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-15"
            title="上移镜头"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove('down')}
            disabled={index === total - 1}
            className="nodrag rounded p-1 text-white/30 hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-15"
            title="下移镜头"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            className="nodrag rounded p-1 text-white/30 hover:bg-white/[0.06] hover:text-white/70"
            title="复制镜头"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="nodrag rounded p-1 text-white/30 hover:bg-red-400/10 hover:text-red-300"
            title="删除镜头"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="nodrag rounded p-1 text-white/36 hover:bg-white/[0.06] hover:text-white/75"
            title={expanded ? '收起详情' : '展开详情'}
          >
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
            />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr_1fr_76px] gap-1.5 border-t border-white/[0.05] px-2.5 py-2">
        <CompactSelect
          label="景别"
          value={scene.shotType || 'medium'}
          options={SHOT_OPTIONS}
          onChange={(shotType) => onUpdate({ shotType })}
        />
        <CompactSelect
          label="机位"
          value={scene.cameraAngle || 'eye_level'}
          options={ANGLE_OPTIONS}
          onChange={(cameraAngle) => onUpdate({ cameraAngle })}
        />
        <CompactSelect
          label="运镜"
          value={scene.cameraMovement || 'static'}
          options={MOVE_OPTIONS}
          onChange={(cameraMovement) => onUpdate({ cameraMovement })}
        />
        <label className="min-w-0">
          <FieldLabel>时长（秒）</FieldLabel>
          <input
            type="number"
            min={1}
            max={30}
            value={scene.duration}
            onChange={(event) =>
              onUpdate({ duration: Math.max(1, Number(event.target.value) || 1) })
            }
            className="nodrag nowheel mt-1 h-8 w-full rounded-md border border-white/[0.08] bg-[#15171b] px-2 text-center text-[10px] tabular-nums text-white/78 outline-none focus:border-amber-300/35"
            title="镜头时长（秒）"
            onPointerDownCapture={(event) => event.stopPropagation()}
          />
        </label>
      </div>

      <div className="border-t border-white/[0.05] px-2.5 py-2">
        <TextField
          label="画面与动作"
          value={scene.subjectAction || scene.description || ''}
          onChange={(event) =>
            onUpdate({ subjectAction: event, description: event })
          }
          placeholder="主体动作、表演与关键视觉变化"
          rows={2}
        />
      </div>

      {expanded ? (
        <div className="space-y-2.5 border-t border-white/[0.05] px-2.5 py-2.5">
          <div className="grid grid-cols-2 gap-2">
            <TextField
              label="环境与空间"
              value={scene.environment || ''}
              onChange={(environment) => onUpdate({ environment })}
            />
            <TextField
              label="构图与焦点"
              value={scene.compositionGuide || ''}
              onChange={(compositionGuide) => onUpdate({ compositionGuide })}
            />
            <TextField
              label="光线设计"
              value={scene.lightingSetup || ''}
              onChange={(lightingSetup) => onUpdate({ lightingSetup })}
            />
            <TextField
              label="情绪节拍"
              value={scene.emotionalBeat || scene.moodAtmosphere || ''}
              onChange={(emotionalBeat) =>
                onUpdate({ emotionalBeat, moodAtmosphere: emotionalBeat })
              }
            />
            <TextField
              label="对白"
              value={scene.dialogue || ''}
              rows={1}
              onChange={(dialogue) => onUpdate({ dialogue })}
            />
            <TextField
              label="旁白 / 声音"
              value={scene.narration || ''}
              rows={1}
              onChange={(narration) => onUpdate({ narration })}
            />
          </div>

          <div className="grid grid-cols-[1fr_1fr_120px] gap-2">
            <TextField
              label="需继承内容"
              value={(scene.continuity?.preserveFromPrevious || []).join('、')}
              rows={1}
              onChange={(value) =>
                onUpdate({
                  continuity: { ...scene.continuity, preserveFromPrevious: parseList(value) },
                })
              }
            />
            <TextField
              label="关键道具"
              value={(scene.continuity?.requiredProps || []).join('、')}
              rows={1}
              onChange={(value) =>
                onUpdate({ continuity: { ...scene.continuity, requiredProps: parseList(value) } })
              }
            />
            <CompactSelect
              label="转场"
              value={scene.transition || 'cut'}
              options={TRANSITION_OPTIONS}
              onChange={(transition) => onUpdate({ transition })}
            />
          </div>

          <TextField
            label="专业分镜提示词"
            value={scene.professionalPrompt || ''}
            rows={3}
            onChange={(professionalPrompt) => onUpdate({ professionalPrompt })}
          />
          <TextField
            label="负面约束"
            value={scene.negativePrompt || ''}
            rows={2}
            onChange={(negativePrompt) => onUpdate({ negativePrompt })}
          />
        </div>
      ) : null}
    </article>
  );
}

export default function StoryboardMakerWorkbench(props: StoryboardMakerWorkbenchProps) {
  const [showPlanSettings, setShowPlanSettings] = useState(false);
  const [showSourceDetails, setShowSourceDetails] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isPlanEditorExpanded, setIsPlanEditorExpanded] = useState(false);
  const [expandedShots, setExpandedShots] = useState<Set<string>>(new Set());
  const rhythm = useMemo(() => getStoryboardRhythmSummary(props.scenes), [props.scenes]);
  const hasPlan = props.scenes.length > 0;
  const selectedOutputMode = resolveStoryboardOutputMode(props.outputMode, props.panelCount);
  const selectedOutputPresentation = OUTPUT_MODE_PRESENTATION[selectedOutputMode.id];
  const resultImageUrl =
    props.generatedGridImageUrl ||
    props.generatedFrames.find((frame) => frame.status === 'succeeded' && frame.imageUrl)?.imageUrl;
  const blockingReason = useMemo(() => {
    if (!hasPlan) return '请先生成分镜方案';
    if (
      selectedOutputMode.requiredShotCount &&
      props.scenes.length !== selectedOutputMode.requiredShotCount
    )
      return `${selectedOutputMode.label}必须包含 ${selectedOutputMode.requiredShotCount} 个镜头，当前为 ${props.scenes.length} 个`;
    if (props.scenes.some((scene) => !(scene.subjectAction || scene.description || '').trim()))
      return '存在空镜头描述';
    if (props.scenes.some((scene) => Number(scene.duration) <= 0)) return '镜头时长必须大于 0';
    return '';
  }, [hasPlan, props.scenes, selectedOutputMode]);
  const warningCount = props.warnings.filter(
    (warning) => warning.severity === 'warning' || warning.severity === 'error'
  ).length;
  const SelectedOutputIcon = selectedOutputPresentation.icon;
  const imageReferenceCount = props.references.visual.length + props.references.character.length;
  const connectedReferenceSummary = [
    props.references.text.length > 0 ? `${props.references.text.length} 文本` : '',
    props.references.visual.length > 0 ? `${props.references.visual.length} 图片` : '',
    props.references.video.length > 0 ? `${props.references.video.length} 视频` : '',
    props.references.character.length > 0 ? `${props.references.character.length} 角色` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const toggleShot = (sceneId: string) => {
    setExpandedShots((current) => {
      const next = new Set(current);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  };

  const handleGenerate = () => {
    setShowSourceDetails(false);
    props.onGenerate();
  };

  const handleDownloadResult = () => {
    if (!resultImageUrl) return;
    const downloadUrl =
      resultImageUrl.startsWith('blob:') || resultImageUrl.startsWith('data:')
        ? resultImageUrl
        : `${API_BASE_URL}/image/proxy-download?url=${encodeURIComponent(resultImageUrl)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${selectedOutputMode.label}-宫格-${Date.now()}.png`;
    link.click();
  };

  useEffect(() => {
    if (!previewImageUrl) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewImageUrl(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImageUrl]);

  return (
    <div className="nowheel space-y-3 p-3">
      <section className="rounded-lg border border-white/[0.08] bg-[#101216] p-3 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
        {!hasPlan || showSourceDetails ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-400/12 text-amber-200">
                <Clapperboard className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-white/88">素材与创作意图</div>
                <div className="truncate text-[9px] text-white/38">
                  阶段 1 / 3 · 统一接入文字、多图、多视频与角色锚点
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-[9px] text-white/42">
              <select
                value={props.imageModelProvider}
                onChange={(event) =>
                  props.onImageModelProviderChange(event.target.value as StoryboardDoubaoSeedreamProvider)
                }
                className="nodrag h-7 max-w-[154px] rounded-md border border-white/[0.07] bg-black/20 px-2 text-[9px] text-white/72 outline-none transition hover:border-white/[0.14]"
                aria-label="故事版出图模型"
                title={`${props.imageModelLabel}，仅使用豆包 Seedream 5.0 Pro`}
              >
                {props.imageModelOptions.map((option) => (
                  <option key={option.provider} value={option.provider} className="bg-[#101216] text-white">
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="rounded-md border border-white/[0.07] bg-black/20 px-2 py-1">
                规划 {props.planningPoints} 积分
              </span>
            </div>
          </div>
        ) : null}

        {!hasPlan || showSourceDetails ? (
          <>
            <div className="mt-3 grid grid-cols-4 gap-1 rounded-lg bg-black/25 p-1">
              {SOURCE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = props.sourceMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => props.onSourceModeChange(option.value)}
                    className={cn(
                      'nodrag flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-[10px] transition-colors',
                      active
                        ? 'bg-white/[0.1] text-white shadow-sm'
                        : 'text-white/42 hover:bg-white/[0.05] hover:text-white/72'
                    )}
                    title={option.label}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between gap-2">
                <FieldLabel>成片风格</FieldLabel>
                <span className="text-[9px] text-white/28">自动应用画幅与出图规格</span>
              </div>
              <div className="mt-1 grid grid-cols-4 gap-1 rounded-lg bg-black/25 p-1">
                {STORYBOARD_OUTPUT_MODES.map((mode) => {
                  const active = props.outputMode === mode.id;
                  const Icon = OUTPUT_MODE_PRESENTATION[mode.id].icon;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => props.onOutputModeChange(mode.id)}
                      className={cn(
                        'nodrag min-w-0 rounded-md px-2 py-2 text-left transition-colors',
                        active
                          ? 'bg-amber-300/12 text-amber-100 shadow-sm'
                          : 'text-white/42 hover:bg-white/[0.05] hover:text-white/72'
                      )}
                      title={mode.summary}
                    >
                      <span className="flex items-center gap-1.5 truncate text-[10px] font-medium">
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {mode.label}
                      </span>
                      <span className="mt-0.5 block truncate text-[8px] opacity-55">
                        {mode.summary}
                      </span>
                    </button>
                  );
                })}
              </div>
              {supportsStoryboardPanelCount(props.outputMode) ? (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-white/[0.07] bg-black/20 px-2 py-1.5">
                  <FieldLabel>单图分镜格数</FieldLabel>
                  <div className="nodrag flex items-center gap-1" role="group" aria-label="分镜格数">
                    {STORYBOARD_PANEL_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => props.onPanelCountChange(option.value)}
                        className={cn(
                          'h-6 min-w-8 rounded px-1.5 text-[9px] font-medium transition-colors',
                          props.panelCount === option.value
                            ? 'bg-amber-300/16 text-amber-100'
                            : 'text-white/40 hover:bg-white/[0.06] hover:text-white/72'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-1.5 flex items-center gap-1.5 px-1 text-[9px] text-white/34">
                <SelectedOutputIcon className="h-3 w-3 shrink-0 text-amber-200/65" />
                <span className="truncate">{selectedOutputPresentation.delivery}</span>
                <span className="text-white/18">·</span>
                <span className="shrink-0">
                  {supportsStoryboardPanelCount(props.outputMode)
                    ? `${selectedOutputMode.grid.cols}×${selectedOutputMode.grid.rows} ${props.panelCount} 格 · `
                    : ''}
                  {selectedOutputMode.aspectRatio} ·{' '}
                  {selectedOutputMode.imageSize.replace('x', '×')}
                </span>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-white/[0.07] bg-black/25 p-2.5">
              <textarea
                value={props.prompt}
                rows={hasPlan ? 3 : 5}
                onChange={(event) => props.onPromptChange(event.target.value)}
                placeholder={
                  props.sourceMode === 'image_reference'
                    ? '连接或导入分镜、场景、动作草图，并补充希望讲述的故事...'
                    : '输入一句话创意、完整脚本或产品叙事需求...'
                }
                className="nodrag nowheel w-full resize-none bg-transparent text-[12px] leading-6 text-white/82 outline-none placeholder:text-white/24"
                onPointerDownCapture={(event) => event.stopPropagation()}
                onMouseDownCapture={(event) => event.stopPropagation()}
              />
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={props.onImport}
                    className="nodrag flex h-7 items-center gap-1 rounded-md px-2 text-[9px] text-white/42 hover:bg-white/[0.06] hover:text-white/72"
                    title="导入脚本、图片或视频"
                  >
                    <Upload className="h-3 w-3" />
                    导入素材
                  </button>
                  {connectedReferenceSummary ? (
                    <span className="truncate text-[9px] text-emerald-200/60">
                      已接入 {connectedReferenceSummary}
                    </span>
                  ) : (
                    <span className="truncate text-[9px] text-white/25">
                      可连接文字、图片、视频与角色节点
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={props.onOptimizePrompt}
                  disabled={props.isOptimizingPrompt || !props.prompt.trim()}
                  className="nodrag flex h-7 shrink-0 items-center gap-1 rounded-md border border-amber-300/20 bg-amber-300/[0.07] px-2 text-[9px] font-medium text-amber-100/78 transition hover:bg-amber-300/[0.13] hover:text-amber-50 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:bg-white/[0.03] disabled:text-white/25"
                  title="将文章、梗概或零散提示词优化为可直接规划分镜的创作输入"
                  aria-label="优化输入"
                >
                  {props.isOptimizingPrompt ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Wand2 className="h-3 w-3" />
                  )}
                  {props.isOptimizingPrompt ? '优化中' : '优化输入'}
                </button>
              </div>
            </div>

            {imageReferenceCount > 0 ? (
              <div className="mt-2 flex h-12 items-center gap-1.5 overflow-hidden">
                {[...props.references.visual, ...props.references.character]
                  .slice(0, 7)
                  .map((url, index) => (
                    <img
                      key={`${url}-${index}`}
                      src={url}
                      alt={`参考素材 ${index + 1}`}
                      className="h-11 w-14 shrink-0 rounded-md border border-white/[0.08] object-cover"
                      draggable={false}
                    />
                  ))}
              </div>
            ) : null}

            {props.error ? (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-300/15 bg-amber-300/[0.05] px-2.5 py-2 text-[9px] leading-4 text-amber-100/68">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                {props.error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={props.isGenerating || props.isGeneratingFrames || !props.canGenerate}
              className="nodrag mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-md bg-amber-500 text-[11px] font-semibold text-black transition hover:bg-amber-400 active:scale-[0.995] disabled:cursor-not-allowed disabled:bg-white/[0.07] disabled:text-white/25"
            >
              {props.isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : hasPlan ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span>
                {props.isGenerating
                  ? '正在规划镜头...'
                  : hasPlan
                    ? '按当前设定重新规划'
                    : '生成分镜方案'}
              </span>
              {!props.isGenerating ? (
                <span className="rounded bg-black/12 px-1.5 py-0.5 text-[9px] font-medium">
                  {props.planningPoints} 积分
                </span>
              ) : null}
            </button>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2">
            <div className="min-w-0">
              <div className="truncate text-[10px] font-medium text-white/68">
                {selectedOutputMode.label}
                <span className="mx-1.5 text-white/20">·</span>
                {selectedOutputMode.aspectRatio}
                <span className="mx-1.5 text-white/20">·</span>
                {props.targetDuration}s<span className="mx-1.5 text-white/20">·</span>
                {props.sourceMode === 'text'
                  ? '文字输入'
                  : SOURCE_OPTIONS.find((option) => option.value === props.sourceMode)?.label}
              </div>
              <div className="mt-0.5 truncate text-[9px] text-white/32">
                {props.prompt || '已使用连接素材生成当前方案'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSourceDetails(true)}
              className="nodrag flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[9px] text-white/46 hover:bg-white/[0.06] hover:text-white/76"
              title="展开并编辑创作输入"
            >
              <Settings2 className="h-3 w-3" />
              编辑输入
            </button>
          </div>
        )}
      </section>

      {hasPlan ? (
        <section className="rounded-lg border border-white/[0.08] bg-[#101216] p-3 shadow-[0_12px_28px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-300/10 text-emerald-200/80">
                <Wand2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-white/88">专业分镜方案</div>
                <div className="truncate text-[9px] text-white/38">
                  阶段 2 / 3 · 校对方案，再生成一张{selectedOutputMode.label}宫格成品
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {warningCount > 0 ? (
                <span
                  className="flex items-center gap-1 rounded-md bg-amber-300/[0.07] px-2 py-1 text-[9px] text-amber-100/62"
                  title="连续性检查建议"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {warningCount} 条建议
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[9px] text-emerald-100/48">
                  <CircleCheck className="h-3 w-3" />
                  字段完整
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsPlanEditorExpanded((value) => !value)}
                className={cn(
                  'nodrag flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/[0.06]',
                  isPlanEditorExpanded ? 'bg-white/[0.06] text-white/78' : 'text-white/38'
                )}
                title={isPlanEditorExpanded ? '收起镜头编辑区' : '扩大镜头编辑区'}
                aria-label={isPlanEditorExpanded ? '收起镜头编辑区' : '扩大镜头编辑区'}
              >
                {isPlanEditorExpanded ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowPlanSettings((value) => !value)}
                className={cn(
                  'nodrag flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/[0.06]',
                  showPlanSettings ? 'text-white/78' : 'text-white/38'
                )}
                title={showPlanSettings ? '收起方案参数' : '编辑方案参数'}
                aria-label="方案参数"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={props.onAddScene}
                className="nodrag flex h-7 items-center gap-1 rounded-md px-2 text-[9px] text-white/48 hover:bg-white/[0.06] hover:text-white/78"
              >
                <Plus className="h-3 w-3" />
                添加镜头
              </button>
            </div>
          </div>

          {showPlanSettings ? (
            <div className="mt-3 grid grid-cols-[116px_1fr_106px] gap-2 rounded-md border border-white/[0.06] bg-black/20 p-2">
              <CompactSelect
                label="叙事语气"
                value={props.tone}
                options={TONE_OPTIONS}
                onChange={props.onToneChange}
              />
              <label className="min-w-0">
                <FieldLabel>视觉风格</FieldLabel>
                <input
                  value={props.style}
                  onChange={(event) => props.onStyleChange(event.target.value)}
                  className="nodrag mt-1 h-8 w-full rounded-md border border-white/[0.08] bg-[#15171b] px-2 text-[10px] text-white/78 outline-none focus:border-amber-300/35"
                  placeholder="电影感写实"
                  onPointerDownCapture={(event) => event.stopPropagation()}
                />
              </label>
              <label className="min-w-0">
                <FieldLabel>目标时长</FieldLabel>
                <div className="mt-1 flex h-8 items-center rounded-md border border-white/[0.08] bg-[#15171b] px-2">
                  <input
                    type="number"
                    min={4}
                    max={180}
                    value={props.targetDuration}
                    onChange={(event) =>
                      props.onTargetDurationChange(Math.max(4, Number(event.target.value) || 4))
                    }
                    className="nodrag nowheel w-full bg-transparent text-[10px] tabular-nums text-white/78 outline-none"
                    onPointerDownCapture={(event) => event.stopPropagation()}
                  />
                  <span className="text-[9px] text-white/28">秒</span>
                </div>
              </label>
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-4 gap-1.5">
            <div className="rounded-md bg-black/25 px-2 py-2">
              <div className="text-[9px] text-white/32">镜头</div>
              <div className="mt-0.5 text-[12px] font-semibold tabular-nums text-white/82">
                {rhythm.shotCount}
              </div>
            </div>
            <div className="rounded-md bg-black/25 px-2 py-2">
              <div className="text-[9px] text-white/32">总时长</div>
              <div className="mt-0.5 text-[12px] font-semibold tabular-nums text-white/82">
                {rhythm.totalDuration}s
              </div>
            </div>
            <div className="rounded-md bg-black/25 px-2 py-2">
              <div className="text-[9px] text-white/32">平均镜长</div>
              <div className="mt-0.5 text-[12px] font-semibold tabular-nums text-white/82">
                {rhythm.averageDuration}s
              </div>
            </div>
            <div className="rounded-md bg-black/25 px-2 py-2">
              <div className="text-[9px] text-white/32">节奏</div>
              <div className="mt-0.5 truncate text-[10px] font-medium text-white/72">
                {rhythm.label}
              </div>
            </div>
          </div>

          <div
            className={cn(
              'mt-3 space-y-2 overflow-y-auto pr-1 transition-[max-height] duration-200 custom-scrollbar',
              isPlanEditorExpanded ? 'max-h-[640px]' : 'max-h-[360px]'
            )}
            data-testid="storyboard-shot-list"
          >
            {props.scenes.map((scene, index) => (
              <StoryboardShotRow
                key={scene.id}
                scene={scene}
                index={index}
                total={props.scenes.length}
                expanded={expandedShots.has(scene.id)}
                warningCount={
                  props.warnings.filter((warning) => warning.frameIndex === index).length
                }
                onToggle={() => toggleShot(scene.id)}
                onUpdate={(patch) => props.onUpdateScene(scene.id, patch)}
                onMove={(direction) => props.onMoveScene(scene.id, direction)}
                onDuplicate={() => props.onDuplicateScene(scene.id)}
                onDelete={() => props.onDeleteScene(scene.id)}
              />
            ))}
          </div>

          <div className="mt-3 border-t border-white/[0.06] pt-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold text-white/72">确认生成</div>
                <div className="text-[9px] text-white/32">
                  阶段 3 / 3 · 单次生成一张图，所有内容均在图内宫格呈现
                </div>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMore((value) => !value)}
                  className="nodrag flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:bg-white/[0.06] hover:text-white/72"
                  title="更多操作"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {showMore ? (
                  <div className="absolute bottom-9 right-0 z-20 w-36 rounded-lg border border-white/[0.1] bg-[#17191e] p-1 shadow-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMore(false);
                        props.onBuildWorkflow();
                      }}
                      className="nodrag flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[10px] text-white/62 hover:bg-white/[0.07] hover:text-white"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      组合完整链路
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMore(false);
                        props.onExport();
                      }}
                      className="nodrag flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[10px] text-white/62 hover:bg-white/[0.07] hover:text-white"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      导出分镜方案
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            {blockingReason ? (
              <div className="mb-2 text-[9px] text-amber-200/55">{blockingReason}</div>
            ) : null}
            <div className="grid grid-cols-[132px_1fr] gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={props.isGenerating}
                className="nodrag flex h-9 items-center justify-center gap-1.5 rounded-md border border-white/[0.09] bg-white/[0.04] text-[10px] text-white/58 hover:bg-white/[0.08] hover:text-white/82 disabled:opacity-35"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重新规划
              </button>
              <button
                type="button"
                onClick={props.onConfirm}
                disabled={Boolean(blockingReason) || props.isGenerating || props.isGeneratingFrames}
                className="nodrag flex h-9 items-center justify-center gap-2 rounded-md bg-emerald-400 text-[11px] font-semibold text-[#082018] hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/[0.07] disabled:text-white/25"
              >
                {props.isGeneratingFrames ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Clapperboard className="h-4 w-4" />
                )}
                {props.isGeneratingFrames
                  ? `正在生成 ${props.generationProgress}%`
                  : `生成一张${selectedOutputMode.label}`}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {props.isGeneratingFrames ||
      props.generatedGridImageUrl ||
      props.generatedFrames.length > 0 ? (
        <section className="rounded-lg border border-emerald-300/15 bg-[#101216] p-3 shadow-[0_12px_28px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold text-white/88">
                {selectedOutputMode.label}生成结果
              </div>
              <div className="mt-0.5 text-[9px] text-white/36">
                {props.isGeneratingFrames
                  ? `正在当前节点生成 · ${props.generationProgress}%`
                  : `一张${selectedOutputMode.label}宫格成品已完成`}
              </div>
            </div>
            {!props.isGeneratingFrames && resultImageUrl ? (
              <div className="flex items-center gap-1">
                <span className="mr-1 flex items-center gap-1 text-[9px] text-emerald-200/62">
                  <CircleCheck className="h-3 w-3" />
                  生成完成
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewImageUrl(resultImageUrl)}
                  className="nodrag flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] text-white/48 hover:bg-white/[0.09] hover:text-white/82"
                  title="放大预览"
                  aria-label="放大预览"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleDownloadResult}
                  className="nodrag flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] text-white/48 hover:bg-white/[0.09] hover:text-white/82"
                  title="下载图片"
                  aria-label="下载图片"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </div>
          {props.isGeneratingFrames ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-emerald-400 transition-[width] duration-300"
                style={{ width: `${Math.max(2, props.generationProgress)}%` }}
              />
            </div>
          ) : null}
          {props.generatedGridImageUrl ? (
            <button
              type="button"
              onClick={() => setPreviewImageUrl(props.generatedGridImageUrl || null)}
              className="nodrag mt-3 block w-full cursor-zoom-in overflow-hidden rounded-md border border-white/[0.08] bg-black"
              aria-label="预览分镜图片"
            >
              <img
                src={props.generatedGridImageUrl}
                alt={`${selectedOutputMode.label}生成结果`}
                className="max-h-[260px] w-full object-contain"
                draggable={false}
              />
            </button>
          ) : props.generatedFrames.some((frame) => frame.imageUrl) ? (
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {props.generatedFrames
                .filter((frame) => frame.imageUrl)
                .map((frame) => (
                  <button
                    key={frame.cellIndex}
                    type="button"
                    onClick={() => setPreviewImageUrl(frame.imageUrl || null)}
                    className="nodrag aspect-video w-full cursor-zoom-in overflow-hidden rounded border border-white/[0.08] bg-black"
                    aria-label={`预览分镜帧 ${frame.cellIndex + 1}`}
                  >
                    <img
                      src={frame.imageUrl}
                      alt={`分镜帧 ${frame.cellIndex + 1}`}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  </button>
                ))}
            </div>
          ) : null}
        </section>
      ) : null}
      {previewImageUrl
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
              onClick={() => setPreviewImageUrl(null)}
              role="dialog"
              aria-modal="true"
              aria-label={`${selectedOutputMode.label}放大预览`}
            >
              <div
                className="relative flex max-h-[94vh] max-w-[96vw] items-center justify-center overflow-hidden rounded-lg bg-black shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <img
                  src={previewImageUrl}
                  alt={`${selectedOutputMode.label}宫格放大预览`}
                  className="max-h-[94vh] max-w-[96vw] object-contain"
                  draggable={false}
                />
                <button
                  type="button"
                  onClick={() => setPreviewImageUrl(null)}
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white/80 transition hover:bg-black/85 hover:text-white"
                  title="关闭预览"
                  aria-label="关闭预览"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
