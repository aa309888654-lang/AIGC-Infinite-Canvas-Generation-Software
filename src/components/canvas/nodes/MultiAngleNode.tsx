import { memo, useCallback, useMemo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Aperture, Check, ChevronDown, ImagePlus, Loader2, Sparkles } from 'lucide-react';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import { AICGNodeTopCornerActions } from './AICGNodeShell';
import { cn } from '@/lib/utils';
import { getSafeRenderableMediaUrl } from '@/lib/media-url';
import { canvasStoreApi, useCanvasStore } from '@/store/useCanvasStore';
import { toast } from 'sonner';
import { NodePointsBadge } from './NodePointsBadge';
import { estimateMultiAngleGeneration } from './generation-estimates';

type MultiAnglePreset = {
  id: string;
  label: string;
  short: string;
  prompt: string;
};

const PRESETS: MultiAnglePreset[] = [
  { id: 'front', label: '正面', short: 'Front', prompt: '主体正面视角，结构清晰，保持原图主体一致' },
  { id: 'left', label: '左侧', short: 'Left', prompt: '主体左侧 45 度视角，保持造型、材质和比例一致' },
  { id: 'right', label: '右侧', short: 'Right', prompt: '主体右侧 45 度视角，保持造型、材质和比例一致' },
  { id: 'back', label: '背面', short: 'Back', prompt: '主体背面视角，补全背部结构和细节，风格一致' },
  { id: 'top', label: '俯视', short: 'Top', prompt: '轻微俯视角度，展示顶部结构和整体轮廓' },
  { id: 'low', label: '仰视', short: 'Low', prompt: '低机位仰视角度，增强体积感和空间感' },
  { id: 'detail', label: '细节', short: 'Detail', prompt: '局部细节特写，突出材质、纹理和关键结构' },
  { id: 'hero', label: '主视觉', short: 'Hero', prompt: '电影感主视觉构图，高级光影，适合封面展示' },
];

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function MultiAngleNode({ id, data, selected }: NodeProps) {
  const params = (data?.params as Record<string, unknown> | undefined) || {};
  const imageUrl = getSafeRenderableMediaUrl(
    readString(data?.imageUrl) ||
    readString(data?.receivedImageUrl) ||
    readString(data?.resultUrl) ||
    readString(data?.url) ||
    readString(params.sourceImage)
  );
  const resultUrls = (Array.isArray(data?.resultUrls) ? (data?.resultUrls as string[]) : [])
    .map((u) => getSafeRenderableMediaUrl(u))
    .filter((u) => u.length > 0);
  const taskStatus = (data?.task as { status?: string; progress?: number; error?: string } | undefined)?.status;
  const taskError = (data?.task as { error?: string } | undefined)?.error;
  const isExpanded = data?.isExpanded !== false;
  const isRunning = taskStatus === 'processing' || taskStatus === 'pending';
  const isFailed = taskStatus === 'failed';

  const selectedAngles = useMemo(() => {
    const raw = params.selectedAngles;
    // 仅在未设置时使用默认 6 视角，允许用户清空为空数组
    if (!Array.isArray(raw)) return PRESETS.slice(0, 6).map((p) => p.id);
    return raw.map(String);
  }, [params.selectedAngles]);

  const updateNodeData = useCallback((patch: Record<string, unknown>) => {
    canvasStoreApi.updateNodeData(id as string, patch);
  }, [id]);

  const updateParams = useCallback((patch: Record<string, unknown>) => {
    const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
    const current = ((node?.data as Record<string, unknown> | undefined)?.params as Record<string, unknown> | undefined) || {};
    canvasStoreApi.updateNodeData(id as string, { params: { ...current, ...patch } });
  }, [id]);

  const composedPrompt = useMemo(() => {
    const basePrompt = readString(params.prompt) || '基于输入图片生成多角度视图，保持主体一致、结构一致、材质一致。';
    const anglePrompts = PRESETS.filter((preset) => selectedAngles.includes(preset.id)).map((preset) => `${preset.label}: ${preset.prompt}`);
    return [basePrompt, ...anglePrompts].join('\n');
  }, [params.prompt, selectedAngles]);

  const toggleAngle = useCallback((angleId: string) => {
    const next = selectedAngles.includes(angleId)
      ? selectedAngles.filter((a) => a !== angleId)
      : [...selectedAngles, angleId];
    updateParams({ selectedAngles: next });
  }, [selectedAngles, updateParams]);

  const handleGenerate = useCallback(() => {
    if (!imageUrl) {
      toast.warning('请先连接参考图片');
      return;
    }
    if (selectedAngles.length === 0) {
      toast.warning('请至少选择一个视角');
      return;
    }
    // 应用组合提示词后触发执行（不预设 task，由执行器统一管理）
    updateNodeData({
      prompt: composedPrompt,
      resultUrls: [],
    });
    window.dispatchEvent(new CustomEvent('execute-node', { detail: { nodeId: id } }));
  }, [composedPrompt, imageUrl, id, selectedAngles.length, updateNodeData]);

  const expectedPoints = useMemo(() => {
    const perFrame = 40;
    return perFrame * selectedAngles.length;
  }, [selectedAngles.length]);
  const generationEstimate = useMemo(
    () => estimateMultiAngleGeneration(selectedAngles.length, expectedPoints),
    [expectedPoints, selectedAngles.length],
  );

  return (
    <div
      className="group relative w-[420px] select-none border-0 outline-none transition-all duration-200"
      data-mimomi-node-type="multiAngle"
    >
      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType="multiAngle"
        inputId="input"
        outputId="output"
        outputTip="多角度结果"
        inputTip="参考图片"
        extraOutputs={['prompt']}
      />

      <div
        className={cn(
          'relative overflow-hidden rounded-xl border border-white/10 bg-[#101011]/95 shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur-xl transition-colors',
          selected ? 'border-white/32' : 'hover:border-white/18'
        )}
      >
        <AICGNodeTopCornerActions
          onDelete={() => canvasStoreApi.deleteNode(id as string)}
          onControllerCollapse={() => updateNodeData({ isExpanded: false })}
          showControllerClose={isExpanded}
        />

        <div
          className={cn(
            'relative flex h-[220px] cursor-pointer items-center justify-center overflow-hidden bg-[#080809]',
            isExpanded ? 'rounded-t-xl' : 'rounded-xl'
          )}
          onDoubleClick={(e) => {
            e.stopPropagation();
            updateNodeData({ isExpanded: !isExpanded });
          }}
        >
          {resultUrls.length > 0 ? (
            <div
              className={cn(
                'grid h-full w-full gap-1 bg-[#080809] p-1.5',
                resultUrls.length > 4 ? 'grid-cols-4' : 'grid-cols-2'
              )}
            >
              {resultUrls.slice(0, 8).map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  className="overflow-hidden rounded-md border border-white/8 bg-white/[0.03]"
                >
                  <img
                    src={url}
                    alt={`多角度结果 ${index + 1}`}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </div>
              ))}
            </div>
          ) : imageUrl ? (
            <div className="relative h-full w-full">
              <img
                src={imageUrl}
                alt="多角度参考图"
                className="h-full w-full object-contain opacity-90"
                draggable={false}
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.5)_100%)]" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-white/30">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                <ImagePlus className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <span className="text-[11px]">连接一张参考图</span>
            </div>
          )}

          <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-md border border-white/10 bg-black/60 px-2 py-1 text-[10px] text-white/70 backdrop-blur-md">
            <Aperture className="h-3.5 w-3.5" strokeWidth={1.6} />
            <span className="font-medium">多角度</span>
            <span className="text-white/35">{selectedAngles.length}/8</span>
          </div>

          {isRunning && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 rounded-lg border border-white/12 bg-black/65 px-3 py-2 text-[11px] text-white/82">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                正在生成 {selectedAngles.length} 个视角
              </div>
            </div>
          )}

          {isFailed && taskError && (
            <div className="absolute bottom-2.5 left-2.5 right-10 rounded-md border border-red-400/20 bg-red-500/12 px-2.5 py-1.5 text-[10px] text-red-200 backdrop-blur-md">
              {taskError}
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              updateNodeData({ isExpanded: !isExpanded });
            }}
            className="absolute bottom-2.5 right-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-black/55 text-white/55 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white"
            title={isExpanded ? '收起控制器' : '展开控制器'}
            aria-label={isExpanded ? '收起控制器' : '展开控制器'}
          >
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-180')}
            />
          </button>
        </div>

        <div
          className={cn(
            'transition-all duration-200',
            !isExpanded ? 'h-0 overflow-hidden opacity-0' : 'h-auto opacity-100'
          )}
        >
          <div className="nodrag nowheel space-y-2.5 border-t border-white/8 p-2.5">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium text-white/55">
                <Sparkles className="h-3 w-3" />
                生成要求
              </span>
              <textarea
                value={readString(params.prompt)}
                onChange={(e) => {
                  e.stopPropagation();
                  updateParams({ prompt: e.target.value });
                }}
                onKeyDown={(e) => e.stopPropagation()}
                onKeyUp={(e) => e.stopPropagation()}
                onInput={(e) => e.stopPropagation()}
                onBeforeInput={(e) => e.stopPropagation()}
                onCompositionStart={(e) => e.stopPropagation()}
                onCompositionEnd={(e) => e.stopPropagation()}
                onPointerDownCapture={(e) => e.stopPropagation()}
                onMouseDownCapture={(e) => e.stopPropagation()}
                placeholder="补充主体、风格或光影要求（可选）"
                className="nodrag nowheel h-[60px] w-full resize-none rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-[11px] leading-[1.55] text-white/80 outline-none transition-colors placeholder:text-white/25 focus:border-white/24 focus:bg-black/35 select-text"
              />
            </label>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium text-white/55">
                  视角 <span className="text-white/30">{selectedAngles.length} 个</span>
                </span>
                <div className="flex items-center gap-1 text-[9px]">
                  <button
                    type="button"
                    onClick={() => updateParams({ selectedAngles: PRESETS.slice(0, 6).map((p) => p.id) })}
                    className="rounded-md px-1.5 py-0.5 text-white/42 transition-colors hover:bg-white/[0.05] hover:text-white/75"
                  >
                    标准 6 视角
                  </button>
                  <button
                    type="button"
                    onClick={() => updateParams({ selectedAngles: PRESETS.map((p) => p.id) })}
                    className="rounded-md px-1.5 py-0.5 text-white/42 transition-colors hover:bg-white/[0.05] hover:text-white/75"
                  >
                    全选
                  </button>
                  <button
                    type="button"
                    onClick={() => updateParams({ selectedAngles: [] })}
                    className="rounded-md px-1.5 py-0.5 text-white/42 transition-colors hover:bg-white/[0.05] hover:text-white/75"
                  >
                    清空
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {PRESETS.map((preset) => {
                  const active = selectedAngles.includes(preset.id);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => toggleAngle(preset.id)}
                      className={cn(
                        'flex h-8 items-center justify-center gap-1 rounded-md border px-1.5 text-[10px] font-medium transition-colors',
                        active
                          ? 'border-white/24 bg-white/[0.09] text-white/90'
                          : 'border-white/8 bg-white/[0.02] text-white/38 hover:border-white/16 hover:text-white/65'
                      )}
                      title={preset.prompt}
                    >
                      {active ? <Check className="h-3 w-3" strokeWidth={2} /> : null}
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-1.5 border-t border-white/8 pt-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <NodePointsBadge points={expectedPoints} />
                <span
                  className="truncate text-[9px] text-white/35"
                  title={`预计 ${generationEstimate.requestCount} 次图片生成请求，耗时 ${generationEstimate.timeLabel}`}
                >
                  {generationEstimate.summary}
                </span>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isRunning || !imageUrl || selectedAngles.length === 0}
                className={cn(
                  'flex h-9 min-w-[132px] shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition-all',
                  isRunning || !imageUrl || selectedAngles.length === 0
                    ? 'cursor-not-allowed border border-white/8 bg-white/[0.04] text-white/25'
                    : 'border border-[#FFB45A]/45 bg-[#FF8C00] text-white shadow-[0_0_14px_rgba(255,140,0,0.24)] hover:bg-[#F57C00] active:scale-[0.98]'
                )}
                title={!imageUrl ? '请先连接参考图片' : selectedAngles.length === 0 ? '至少选择一个视角' : '生成多角度图片'}
              >
                {isRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Aperture className="h-3.5 w-3.5" />
                )}
                {isRunning ? '生成中' : `生成 ${selectedAngles.length} 个视角`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(MultiAngleNode);
