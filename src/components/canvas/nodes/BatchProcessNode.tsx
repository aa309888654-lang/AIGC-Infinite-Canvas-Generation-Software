/**
 * 批量处理节点
 * 批量执行工作流，支持并行/串行
 */

import { memo, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { NodeProps } from '@xyflow/react';
import {
  Layers,
  Play,
  Pause,
  CheckCircle,
  Settings2,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import AICGNodeShell from './AICGNodeShell';
import { aicgGlass } from './aicg-node-glass';
import { executeAICGGroup, aicgGroupService } from '@/services/aicg-group-service';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { executeBatchWorkflowItem } from '@/store/real-api-executor';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { nodeEventBus } from '@/lib/nodeEventBus';

interface BatchProcessNodeData {
  batchSize?: number;
  parallel?: boolean;
  retryOnFail?: boolean;
  maxRetries?: number;
  delayBetweenBatches?: number;
  workflowPayload?: string;
  batchItems?: Array<Record<string, unknown>>;
  items?: string[];
  results?: string[];
  isRunning?: boolean;
  progress?: number;
  task?: {
    status: 'idle' | 'processing' | 'done' | 'error';
    progress?: number;
    results?: string[];
  };
}

type WorkflowPayload = {
  nodes?: Array<Record<string, unknown>>;
  batchItems?: Array<Record<string, unknown>>;
};

const BatchProcessNode = memo(({ data, id, selected }: NodeProps) => {
  const nodeData = data as any as BatchProcessNodeData;
  const updateNodeData = canvasStoreApi.updateNodeData;

  const [batchSize, setBatchSize] = useState(nodeData.batchSize ?? 4);
  const [parallel, setParallel] = useState(nodeData.parallel ?? true);
  const [retryOnFail, setRetryOnFail] = useState(nodeData.retryOnFail ?? true);
  const [maxRetries, setMaxRetries] = useState(nodeData.maxRetries ?? 3);
  const [delayBetweenBatches, setDelayBetweenBatches] = useState(nodeData.delayBetweenBatches ?? 1000);
  const [items, setItems] = useState<string[]>(nodeData.items || []);
  const [results, setResults] = useState<string[]>(nodeData.results || []);
  const [isRunning, setIsRunning] = useState(nodeData.isRunning ?? false);
  const [progress, setProgress] = useState(nodeData.progress ?? 0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [inputText, setInputText] = useState('');

  const abortControllerRef = useRef<AbortController | null>(null);
  const workflowPayload = typeof nodeData.workflowPayload === 'string' ? nodeData.workflowPayload : '';
  const batchItems = Array.isArray(nodeData.batchItems) ? nodeData.batchItems : [];
  const parsedWorkflowPayload = useMemo<WorkflowPayload | null>(() => {
    if (!workflowPayload) {
      return null;
    }

    try {
      return JSON.parse(workflowPayload) as WorkflowPayload;
    } catch {
      return null;
    }
  }, [workflowPayload]);

  const resolvedBatchItems = useMemo(() => {
    if (parsedWorkflowPayload && Array.isArray(parsedWorkflowPayload.batchItems) && parsedWorkflowPayload.batchItems.length > 0) {
      return parsedWorkflowPayload.batchItems.map((item: any, index) => ({
        itemId: String(item.itemId || `payload-${index}`),
        ...item,
      }));
    }

    if (workflowPayload && !parsedWorkflowPayload) {
      return [];
    }

    if (batchItems.length > 0) {
      return batchItems.map((item: any, index) => ({
        itemId: String(item.itemId || `batch-${index}`),
        ...item,
      }));
    }

    return items.map((item, index) => ({
      itemId: `manual-${index}`,
      value: item,
    }));
  }, [parsedWorkflowPayload, workflowPayload, batchItems, items]);

  const isReadyToRun = resolvedBatchItems.length > 0;
  const taskListCount = workflowPayload && parsedWorkflowPayload?.batchItems?.length ? resolvedBatchItems.length : items.length;
  const executionContext = useMemo(() => {
    return parsedWorkflowPayload
      ? {
          workflowPayload: parsedWorkflowPayload,
        }
      : undefined;
  }, [parsedWorkflowPayload]);

  // 使用 ref 跟踪上一次同步到 store 的数据，避免循环
  const lastSyncedData = useRef<string>('');

  // 同步数据到 store
  useEffect(() => {
    const currentData = {
      batchSize,
      parallel,
      retryOnFail,
      maxRetries,
      delayBetweenBatches,
      workflowPayload,
      batchItems,
      items,
      results,
      isRunning,
      progress,
    };
    const dataString = JSON.stringify(currentData);
    
    // 只有当本地状态与上次同步的数据不同时，才更新 store
    if (dataString !== lastSyncedData.current) {
      lastSyncedData.current = dataString;
      updateNodeData(id as string, currentData);
    }
  }, [batchSize, parallel, retryOnFail, maxRetries, delayBetweenBatches, workflowPayload, batchItems, items, results, isRunning, progress, id, updateNodeData]);

  const handleAddItems = useCallback(() => {
    if (!inputText.trim()) return;
    const newItems = inputText.split('\n').filter(item => item.trim());
    setItems(prev => [...prev, ...newItems]);
    setInputText('');
    toast.success(`添加了 ${newItems.length} 个任务项`);
  }, [inputText]);

  const handleRemoveItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearItems = useCallback(() => {
    setItems([]);
    setResults([]);
    setProgress(0);
    toast.success('已清空所有任务项');
  }, []);

  const handleStartBatch = useCallback(async () => {
    if (resolvedBatchItems.length === 0) {
      toast.warning('请先添加任务项');
      return;
    }

    setIsRunning(true);
    setResults([]);
    setProgress(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    updateNodeData(id as string, {
      task: { status: 'processing', progress: 0 },
    });

    toast.success(`批量处理开始，共 ${resolvedBatchItems.length} 项`);

    const totalItems = resolvedBatchItems.length;
    const newResults: string[] = [];
    let successCount = 0;
    let failedCount = 0;

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const executeWithRetry = async (item: any, context: any, retries: number): Promise<{
      status: string;
      itemId: string;
      error?: string;
      resultUrl?: string;
      resultUrls?: string[];
    }> => {
      let lastError = '';
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const result = await executeBatchWorkflowItem(item, context);
          if (result.status === 'done') {
            // ✅ P0-2：保留 resultUrl/resultUrls，供下游同步使用
            return {
              status: result.status,
              itemId: result.itemId,
              resultUrl: (result as any).resultUrl,
              resultUrls: (result as any).resultUrls,
            };
          }
          lastError = result.error || '处理失败';
          if (attempt < retries) await sleep(1000);
        } catch (err) {
          lastError = err instanceof Error ? err.message : '处理失败';
          if (attempt < retries) await sleep(1000);
        }
      }
      return { status: 'error', itemId: item.itemId || 'unknown', error: lastError };
    };

    const retries = retryOnFail ? maxRetries : 0;
    let completedCount = 0;
    // ✅ P0-2：收集所有成功结果的 URL，用于通知下游
    const successUrls: string[] = [];

    const formatResult = (result: { status: string; itemId: string; error?: string; resultUrl?: string }, index: number) => {
      return result.status === 'done'
        ? `处理结果 ${index + 1}: ${result.itemId}`
        : `[失败] ${result.itemId}: ${result.error || '处理失败'}`;
    };

    const updateProgress = (done: number) => {
      const currentProgress = Math.round((done / totalItems) * 100);
      setProgress(currentProgress);
      updateNodeData(id as string, {
        task: { status: 'processing', progress: currentProgress },
      });
    };

    if (parallel) {
      const batches: typeof resolvedBatchItems[] = [];
      for (let i = 0; i < totalItems; i += batchSize) {
        batches.push(resolvedBatchItems.slice(i, i + batchSize));
      }

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        if (controller.signal.aborted) break;

        const batch = batches[batchIdx];
        const baseIndex = batchIdx * batchSize;

        const settledResults = await Promise.allSettled(
          batch.map((item, i) => executeWithRetry(item, executionContext, retries).then(result => ({ result, index: baseIndex + i })))
        );

        // ✅ P1-2：用 forEach 索引替代 indexOf（indexOf 返回第一个匹配，多个 rejected 时索引错误）
        settledResults.forEach((settled, i) => {
          if (settled.status === 'fulfilled') {
            const { result, index } = settled.value;
            const label = formatResult(result, index);
            if (result.status === 'done') {
              successCount++;
              // ✅ P0-2：收集成功结果的 URL
              if (result.resultUrl) successUrls.push(result.resultUrl);
              if (Array.isArray(result.resultUrls)) {
                result.resultUrls.forEach((u: string) => u && successUrls.push(u));
              }
            } else {
              failedCount++;
            }
            newResults.push(label);
          } else {
            failedCount++;
            const index = baseIndex + i; // ✅ P1-2：直接用循环索引
            newResults.push(`[失败] 未知错误 (任务 ${index + 1})`);
          }
        });

        completedCount += batch.length;
        setResults([...newResults]);
        updateProgress(completedCount);

        if (batchIdx < batches.length - 1 && !controller.signal.aborted && delayBetweenBatches > 0) {
          await sleep(delayBetweenBatches);
        }
      }
    } else {
      for (let i = 0; i < totalItems; i++) {
        if (controller.signal.aborted) break;

        const item = resolvedBatchItems[i];
        const result = await executeWithRetry(item, executionContext, retries);
        const label = formatResult(result, i);

        if (result.status === 'done') {
          successCount++;
          // ✅ P0-2：收集成功结果的 URL
          if (result.resultUrl) successUrls.push(result.resultUrl);
          if (Array.isArray(result.resultUrls)) {
            result.resultUrls.forEach((u: string) => u && successUrls.push(u));
          }
        } else {
          failedCount++;
        }

        newResults.push(label);
        completedCount++;
        setResults([...newResults]);
        updateProgress(completedCount);

        if (i < totalItems - 1 && !controller.signal.aborted && delayBetweenBatches > 0) {
          await sleep(delayBetweenBatches);
        }
      }
    }

    if (controller.signal.aborted) {
      updateNodeData(id as string, {
        task: { status: 'idle', progress },
      });
      toast.info('批量处理已取消');
    } else {
      const status: 'done' | 'error' = failedCount > 0 ? 'error' : 'done';
      // ✅ P0-2：写入 resultUrl/resultUrls/mediaType，供下游节点接收
      const firstSuccessUrl = successUrls[0] || '';
      updateNodeData(id as string, {
        task: { status, progress: 100, results: newResults },
        ...(firstSuccessUrl ? { resultUrl: firstSuccessUrl } : {}),
        ...(successUrls.length > 0 ? { resultUrls: successUrls } : {}),
        ...(successUrls.length > 0 ? { mediaType: 'image' as const } : {}), // 默认 image，executeBatchWorkflowItem 多为图片
        results: newResults,
      });

      // ✅ P0-2：通知下游节点（仅在收集到 URL 时）
      if (successUrls.length > 0) {
        try {
          syncDownstreamFromNode(id as string);
          nodeEventBus.emitNodeExecuted(id as string, true);
        } catch (e) {
          console.warn('[BatchProcessNode] 下游同步失败', e);
        }
      }

      if (failedCount > 0) {
        toast.warning(`批量处理完成，成功 ${successCount} 项，失败 ${failedCount} 项`);
      } else {
        toast.success(`批量处理完成，共处理 ${successCount} 项`);
      }
    }

    setIsRunning(false);
    abortControllerRef.current = null;
  }, [parallel, batchSize, retryOnFail, maxRetries, delayBetweenBatches, executionContext, resolvedBatchItems, id, updateNodeData, progress]);

  const handleStopBatch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsRunning(false);
    updateNodeData(id as string, {
      task: { status: 'idle', progress },
    });
    toast.info('批量处理已停止');
  }, [progress, id, updateNodeData]);

  const handleDelete = useCallback(() => {
    canvasStoreApi.deleteNode(id as string);
  }, [id]);

  const handleExecuteGroup = useCallback(async () => {
    const groups = aicgGroupService.getGroupsContainingNode(id as string);
    if (groups.length > 0) {
      await executeAICGGroup(groups[0].id);
      return;
    }
    const containing = aicgGroupService.getAll().find((g) => g.nodeIds.includes(id as string));
    if (containing) {
      await executeAICGGroup(containing.id);
    } else {
      toast.info('请先用 Ctrl+G 将相关节点打组');
    }
  }, [id]);



  return (
    <div className="relative w-[420px] group border-0 outline-none select-none" style={{ overflow: 'visible' }}>
      {/* 输入 Handle */}
      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType="batchProcess"
        inputTip="输入数据"
        outputId="results"
        outputTip="结果集"
      />

      {/* 节点主体 */}
      <div className={selected ? aicgGlass.videoComposeFrameSelected : aicgGlass.videoComposeFrame}>
        <div className={aicgGlass.videoComposeInnerRing} />
        <AICGNodeShell
          aicgType="tool"
          title="批量 / 整组执行"
          subtitle="任务列表 · 编组后 Ctrl+Shift+Enter"
          width={420}
          onDelete={() => handleDelete()}
          bodyClassName="p-0"
        >
        <div className="p-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
            <button
              type="button"
              onClick={() => void handleStartBatch()}
              disabled={isRunning || !isReadyToRun}
              className={cn(aicgGlass.actionBtnPrimary, 'h-8 px-3 text-[10px]', (isRunning || !isReadyToRun) && 'cursor-not-allowed opacity-45')}
            >
              <Play className="h-3.5 w-3.5" />
              开始批量
            </button>
            <button
              type="button"
              onClick={handleStopBatch}
              disabled={!isRunning}
              className={cn(aicgGlass.actionBtn, 'h-8 px-3 text-[10px]', !isRunning && 'cursor-not-allowed opacity-45')}
            >
              <Pause className="h-3.5 w-3.5" />
              停止
            </button>
            <button type="button" onClick={() => void handleExecuteGroup()} className={cn(aicgGlass.actionBtn, 'h-8 px-3 text-[10px]')}>
              <Zap className="h-3.5 w-3.5" />
              执行整组
            </button>
            <button type="button" onClick={() => setShowAdvanced((value) => !value)} className={cn(aicgGlass.actionBtn, 'h-8 px-3 text-[10px]')}>
              <Settings2 className="h-3.5 w-3.5" />
              参数
            </button>
            <span className="ml-auto text-[10px] text-white/45">{taskListCount} 项 · {parallel ? '并行' : '串行'}</span>
          </div>

          {/* 任务项输入 */}
          <div className="space-y-2">
            <span className="text-[8px] text-white/50 uppercase tracking-wider">添加任务项（每行一个）</span>
            <textarea
              value={inputText}
              onChange={(e) => {
                e.stopPropagation();
                setInputText(e.target.value);
              }}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onInput={(e) => e.stopPropagation()}
              onBeforeInput={(e) => e.stopPropagation()}
              onCompositionStart={(e) => e.stopPropagation()}
              onCompositionEnd={(e) => e.stopPropagation()}
              onPointerDownCapture={(e) => e.stopPropagation()}
              onMouseDownCapture={(e) => e.stopPropagation()}
              placeholder="输入任务项，每行一个..."
              className={cn(aicgGlass.input, 'text-sm resize-none')}
              rows={3}
            />
            <button
              onClick={handleAddItems}
              disabled={!inputText.trim()}
              className={cn(
                'w-full py-1.5 rounded-lg text-[10px] font-medium transition-all',
                !inputText.trim()
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : 'border border-white/18 bg-white/[0.08] text-white hover:border-white/28 hover:bg-white/[0.12]'
              )}
            >
              添加任务项
            </button>
          </div>

          {/* 任务项列表 */}
          {taskListCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[8px] text-white/50 uppercase tracking-wider">
                  任务列表 ({taskListCount})
                </span>
                {!workflowPayload && (
                  <button
                    onClick={handleClearItems}
                    className="text-[9px] text-white/40 hover:text-red-400 transition-colors"
                  >
                    清空
                  </button>
                )}
              </div>
              <div className="max-h-[100px] overflow-y-auto space-y-1">
                {workflowPayload && parsedWorkflowPayload?.batchItems?.length
                  ? resolvedBatchItems.map((item: any, index) => (
                      <div
                        key={String(item.itemId || index)}
                        className="flex items-center justify-between px-2 py-1 bg-black/20 rounded text-[10px] text-white/70"
                      >
                        <span className="truncate flex-1">{String(item.prompt || item.value || item.itemId || `任务 ${index + 1}`)}</span>
                      </div>
                    ))
                  : items.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between px-2 py-1 bg-black/20 rounded text-[10px] text-white/70"
                      >
                        <span className="truncate flex-1">{item}</span>
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="ml-2 text-white/40 hover:text-red-400"
                        >
                          ×
                        </button>
                      </div>
                    ))}
              </div>
            </div>
          )}

          {/* 进度条 */}
          {isRunning && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[8px] text-white/50">处理进度</span>
                <span className="text-[8px] text-white/60">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white/70 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* 结果统计 */}
          {results.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-1.5 bg-white/[0.04] rounded-lg border border-white/[0.12]">
              <CheckCircle className="w-3 h-3 text-white/70" />
              <span className="text-[9px] text-white/72">
                已完成 {results.length}/{resolvedBatchItems.length} 项
              </span>
            </div>
          )}

          {/* 高级选项 */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={cn(
              'flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] transition-all',
              showAdvanced
                ? 'bg-white/[0.08] text-white border border-white/20'
                : 'bg-black/40 text-white/60 border border-white/10 hover:border-white/20'
            )}
          >
            <Settings2 className="w-3 h-3" />
            {showAdvanced ? '收起高级选项' : '高级选项'}
          </button>

          {/* 高级选项内容 */}
          {showAdvanced && (
            <div className="space-y-3 p-2 bg-white/[0.035] rounded-lg border border-white/[0.1]">
              {/* 批处理大小 */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[8px] text-white/50">批处理大小</span>
                  <span className="text-[8px] text-white/60">{batchSize}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="w-full h-1 mt-1 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
              </div>

              {/* 延迟 */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[8px] text-white/50">批次间隔 (ms)</span>
                  <span className="text-[8px] text-white/60">{delayBetweenBatches}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5000"
                  step="100"
                  value={delayBetweenBatches}
                  onChange={(e) => setDelayBetweenBatches(Number(e.target.value))}
                  className="w-full h-1 mt-1 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
              </div>

              {/* 重试次数 */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[8px] text-white/50">最大重试次数</span>
                  <span className="text-[8px] text-white/60">{maxRetries}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="1"
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(Number(e.target.value))}
                  className="w-full h-1 mt-1 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
              </div>

              {/* 选项 */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={parallel}
                    onChange={(e) => setParallel(e.target.checked)}
                    className="w-3 h-3 rounded accent-white"
                  />
                  <span className="text-[9px] text-white/70">并行处理</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={retryOnFail}
                    onChange={(e) => setRetryOnFail(e.target.checked)}
                    className="w-3 h-3 rounded accent-white"
                  />
                  <span className="text-[9px] text-white/70">失败重试</span>
                </label>
              </div>
            </div>
          )}

          {/* 控制按钮 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleExecuteGroup();
              }}
              className="px-3 py-2.5 rounded-lg bg-white/[0.06] text-white/70 hover:bg-white/10 border border-white/10 text-[10px] font-medium transition-all flex items-center justify-center gap-1.5"
              title="执行当前 AICG 编组 (Ctrl+Shift+Enter)"
            >
              <Layers className="w-3.5 h-3.5" />
              编组执行
            </button>
            {isRunning ? (
              <button
                onClick={handleStopBatch}
                className="flex-1 py-2.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 text-[10px] font-medium transition-all flex items-center justify-center gap-2"
              >
                <Pause className="w-3.5 h-3.5" />
                停止处理
              </button>
            ) : (
              <button
                onClick={handleStartBatch}
                disabled={!isReadyToRun}
                className={cn(
                  'flex-1 py-2.5 rounded-lg font-medium text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2',
                  !isReadyToRun
                    ? 'bg-white/[0.04] text-white/35 cursor-not-allowed'
                    : 'border border-white/20 bg-white/[0.1] text-white hover:border-white/32 hover:bg-white/[0.14] shadow-lg shadow-black/20'
                )}
              >
                <Play className="w-3.5 h-3.5" />
                开始批量处理
              </button>
            )}
          </div>
        </div>
      </AICGNodeShell>
        </div>
    </div>
  );
});

BatchProcessNode.displayName = 'BatchProcessNode';

export default BatchProcessNode;
