import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { NodeProps } from '@xyflow/react';
import { Clipboard, Eye, Mountain, RefreshCcw, X as CloseIcon } from 'lucide-react';

import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import { aicgGlass } from './aicg-node-glass';
import { buildSceneLibraryPayload } from './scene-payload';
import { cn } from '@/lib/utils';
import { clearSceneLibraryDownstreamFromNode, syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { useAssetLibraryStore } from '@/store/useAssetLibraryStore';
import { toast } from 'sonner';

interface SceneLibraryNodeData {
  label?: string;
  selectedSceneId?: string;
  payload?: string;
  sceneRef?: string;
  params?: {
    selectedSceneId?: string;
  };
}

const SceneLibraryNode = memo(({ data, id, selected }: NodeProps) => {
  const nodeData = data as SceneLibraryNodeData;
  const updateNodeData = canvasStoreApi.updateNodeData;
  const deleteNode = canvasStoreApi.deleteNode;
  const sceneAssets = useAssetLibraryStore((state) => state.sceneAssets);
  const [showPayload, setShowPayload] = useState(false);

  const selectedSceneId = nodeData.selectedSceneId ?? nodeData.params?.selectedSceneId ?? '';

  const selectedScene = useMemo(
    () => sceneAssets.find((asset) => asset.id === selectedSceneId) ?? null,
    [sceneAssets, selectedSceneId],
  );

  const commitNodeData = useCallback(
    (patch: Partial<SceneLibraryNodeData> & Record<string, unknown>, shouldClearDownstream = false) => {
      updateNodeData(id as string, { type: 'sceneLibrary', ...patch });
      if (shouldClearDownstream) {
        clearSceneLibraryDownstreamFromNode(id as string);
        return;
      }
      syncDownstreamFromNode(id as string);
    },
    [id, updateNodeData],
  );

  const clearSelection = useCallback(() => {
    commitNodeData({
      selectedSceneId: '',
      sceneRef: '',
      payload: '',
      imageUrl: '',
      resultUrl: '',
      params: {
        ...(nodeData.params || {}),
        selectedSceneId: '',
      },
    }, true);
  }, [commitNodeData, nodeData.params]);

  const commitSelectedScene = useCallback(
    (nextSelectedId: string) => {
      if (!nextSelectedId) {
        clearSelection();
        return;
      }

      const nextScene = sceneAssets.find((asset) => asset.id === nextSelectedId);
      if (!nextScene) {
        clearSelection();
        return;
      }

      const nextPayload = buildSceneLibraryPayload(nextScene);
      const nextSceneRef = nextScene.primaryImage;

      commitNodeData({
        selectedSceneId: nextSelectedId,
        sceneRef: nextSceneRef,
        payload: nextPayload,
        imageUrl: nextSceneRef,
        resultUrl: nextSceneRef,
        params: {
          ...(nodeData.params || {}),
          selectedSceneId: nextSelectedId,
        },
      });
    },
    [clearSelection, commitNodeData, nodeData.params, sceneAssets],
  );

  useEffect(() => {
    if (!selectedSceneId) {
      if (
        !nodeData.selectedSceneId &&
        !nodeData.params?.selectedSceneId &&
        !nodeData.sceneRef &&
        !nodeData.payload
      ) {
        return;
      }
      clearSelection();
      return;
    }

    if (!selectedScene) {
      clearSelection();
      return;
    }

    const nextPayload = buildSceneLibraryPayload(selectedScene);
    const nextSceneRef = selectedScene.primaryImage;

    if (
      nodeData.selectedSceneId === selectedSceneId &&
      nodeData.params?.selectedSceneId === selectedSceneId &&
      nodeData.sceneRef === nextSceneRef &&
      nodeData.payload === nextPayload
    ) {
      return;
    }

    commitSelectedScene(selectedSceneId);
  }, [
    clearSelection,
    commitSelectedScene,
    nodeData.params?.selectedSceneId,
    nodeData.payload,
    nodeData.sceneRef,
    nodeData.selectedSceneId,
    selectedScene,
    selectedSceneId,
  ]);

  const handleSyncDownstream = useCallback(() => {
    if (!selectedScene) return;
    const count = syncDownstreamFromNode(id as string);
    if (count > 0) {
      toast.success(`已同步 ${count} 个下游节点`);
      return;
    }
    toast.info('没有可同步的下游节点');
  }, [id, selectedScene]);

  const handleCopyPayload = useCallback(async () => {
    if (!nodeData.payload) return;
    await navigator.clipboard.writeText(nodeData.payload);
    toast.success('场景 Payload 已复制');
  }, [nodeData.payload]);

  return (
    <div className="group relative" data-testid="scene-library-node">
      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType="sceneLibrary"
        hideInput
        outputId="sceneRef"
        extraOutputs={['payload']}
        outputTip="场景/数据输出"
      />

      <div
        className={cn(
          selected ? aicgGlass.videoComposeFrameSelected : aicgGlass.videoComposeFrame,
        )}
      >
        <div className={aicgGlass.videoComposeInnerRing} />
        <div className="drag-handle flex cursor-grab items-center justify-between gap-2 rounded-t-[20px] border-b border-white/[0.06] bg-[#101012] px-3 py-2 active:cursor-grabbing">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Mountain className="h-3.5 w-3.5 text-white/55" />
            <div className="min-w-0">
              <div className="truncate text-[11px] font-medium text-white/85">场景库</div>
              <div className="truncate text-[9px] text-white/35">场景 · 环境 · 光照</div>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              deleteNode(id as string);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="nodrag nowheel flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white/75"
            title="关闭节点"
            data-testid="scene-library-delete"
          >
            <CloseIcon className="h-3 w-3" />
          </button>
        </div>
        <div className="p-3">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
              <button
                type="button"
                onClick={handleSyncDownstream}
                disabled={!selectedScene}
                className={cn(
                  aicgGlass.actionBtnPrimary,
                  'h-8 px-3 text-[10px]',
                  !selectedScene && 'cursor-not-allowed opacity-45',
                )}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                同步下游
              </button>
              <button
                type="button"
                onClick={() => setShowPayload((value) => !value)}
                disabled={!nodeData.payload}
                className={cn(
                  aicgGlass.actionBtn,
                  'h-8 px-3 text-[10px]',
                  !nodeData.payload && 'cursor-not-allowed opacity-45',
                )}
                data-testid="scene-library-toggle-payload"
              >
                <Eye className="h-3.5 w-3.5" />
                Payload
              </button>
              <button
                type="button"
                onClick={handleCopyPayload}
                disabled={!nodeData.payload}
                className={cn(
                  aicgGlass.actionBtn,
                  'h-8 px-3 text-[10px]',
                  !nodeData.payload && 'cursor-not-allowed opacity-45',
                )}
                data-testid="scene-library-copy-payload"
              >
                <Clipboard className="h-3.5 w-3.5" />
                复制
              </button>
              <span className="ml-auto text-[10px] text-white/45">{sceneAssets.length} 个场景</span>
            </div>
            <div className={aicgGlass.section}>
              <label className="mb-1 block text-xs text-white/60">选择场景资产</label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedSceneId}
                  onChange={(event) => commitSelectedScene(event.target.value)}
                  onMouseDown={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  className={cn(aicgGlass.select, 'nodrag nowheel')}
                  data-testid="scene-library-select"
                >
                  <option value="">请选择场景</option>
                  {sceneAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={!selectedSceneId}
                  className="nodrag nowheel flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                  title="清空场景"
                  data-testid="scene-library-clear"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {selectedScene ? (
              <div className="space-y-3">
                <div className={cn(aicgGlass.section, 'overflow-hidden p-0')}>
                  {selectedScene.primaryImage ? (
                    <img
                      src={selectedScene.primaryImage}
                      alt={selectedScene.name}
                      className="h-40 w-full object-cover"
                      data-testid="scene-library-preview-image"
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-[#101012]">
                      <Mountain className="h-10 w-10 text-gray-600" />
                    </div>
                  )}
                </div>

                <div className={aicgGlass.section}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] text-white/72">
                      <Mountain className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-white" data-testid="scene-library-name">
                        {selectedScene.name}
                      </h3>
                      <p className="mt-1 text-xs text-white/55">
                        {selectedScene.summary || '未填写场景简介'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(selectedScene.tags?.length ?? 0) > 0 ? (
                      selectedScene.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-white/62"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/45">
                        未设置标签
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-2 text-xs text-white/60">
                    <div data-testid="scene-library-scene-status">场景参考图: {selectedScene.primaryImage ? '已就绪' : '缺失'}</div>
                    <div data-testid="scene-library-payload-status">Payload: {nodeData.payload ? '已生成' : '未生成'}</div>
                  </div>

                  <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-black/20 p-2.5 text-xs text-white/60">
                    <ScenePromptField label="环境" value={selectedScene.environmentPrompt} />
                    <ScenePromptField label="光照" value={selectedScene.lightingPrompt} />
                    <ScenePromptField label="提示词" value={selectedScene.prompt} />
                    <ScenePromptField label="负向" value={selectedScene.negativePrompt} />
                  </div>
                </div>

                {showPayload && nodeData.payload ? (
                  <pre className="nodrag nowheel max-h-36 overflow-auto rounded-lg border border-white/10 bg-black/30 p-2 text-[10px] leading-relaxed text-white/55" data-testid="scene-library-payload-preview">
                    {nodeData.payload}
                  </pre>
                ) : null}
              </div>
            ) : (
              <div
                className={cn(aicgGlass.section, 'border-dashed px-4 py-8 text-center text-sm text-white/45')}
                data-testid="scene-library-empty"
              >
                先在资产中心创建场景，再在这里选择输出。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

function ScenePromptField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="text-white/38">{label}: </span>
      <span className="whitespace-pre-wrap text-white/68">{value?.trim() || '未填写'}</span>
    </div>
  );
}

SceneLibraryNode.displayName = 'SceneLibraryNode';

export default SceneLibraryNode;
