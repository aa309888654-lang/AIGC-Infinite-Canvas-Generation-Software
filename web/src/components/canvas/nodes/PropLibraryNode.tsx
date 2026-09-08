import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { NodeProps } from '@xyflow/react';
import { ExternalLink, Loader2, Sword, RefreshCcw, X as CloseIcon } from 'lucide-react';

import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import { aicgGlass } from './aicg-node-glass';
import { buildPropLibraryPayload } from './prop-payload';
import { cn } from '@/lib/utils';
import { clearPropLibraryDownstreamFromNode, syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { apiClient } from '@/lib/api-client';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { useAppPanelStore } from '@/store/useAppPanelStore';
import { useAssetLibraryStore } from '@/store/useAssetLibraryStore';
import type { PropAsset } from '@/types/asset-library';

interface PropLibraryNodeData {
  label?: string;
  selectedPropId?: string;
  payload?: string;
  propRef?: string;
  params?: {
    selectedPropId?: string;
  };
}

interface PropLibraryResponse {
  success: boolean;
  data: Array<Partial<PropAsset> & { id: string; name: string }>;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
}

function normalizePropAsset(raw: Partial<PropAsset> & { id: string; name: string }): PropAsset {
  return {
    id: raw.id,
    name: raw.name,
    summary: raw.summary || '',
    primaryImage: raw.primaryImage || '',
    materialTags: normalizeStringArray(raw.materialTags),
    prompt: raw.prompt || '',
    negativePrompt: raw.negativePrompt || '',
    tags: normalizeStringArray(raw.tags),
  };
}

const PropLibraryNode = memo(({ data, id, selected }: NodeProps) => {
  const nodeData = data as PropLibraryNodeData;
  const updateNodeData = canvasStoreApi.updateNodeData;
  const deleteNode = canvasStoreApi.deleteNode;
  const propAssets = useAssetLibraryStore((state) => state.propAssets);
  const setPropAssets = useAssetLibraryStore((state) => state.setPropAssets);
  const setAssetLibraryOpen = useAppPanelStore((state) => state.setAssetLibraryOpen);
  const [isLoadingProps, setIsLoadingProps] = useState(false);
  const [hasLoadedProps, setHasLoadedProps] = useState(false);
  const [loadError, setLoadError] = useState('');

  const selectedPropId = nodeData.selectedPropId ?? nodeData.params?.selectedPropId ?? '';

  const selectedProp = useMemo(
    () => propAssets.find((asset) => asset.id === selectedPropId) ?? null,
    [propAssets, selectedPropId],
  );

  const loadPropAssets = useCallback(async () => {
    setIsLoadingProps(true);
    setLoadError('');
    try {
      const response = await apiClient.get<PropLibraryResponse>('/prop-library?limit=100', {
        maxRetries: 0,
      });
      setPropAssets((response.data || []).map(normalizePropAsset));
      setHasLoadedProps(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '道具加载失败');
    } finally {
      setIsLoadingProps(false);
    }
  }, [setPropAssets]);

  useEffect(() => {
    void loadPropAssets();
  }, [loadPropAssets]);

  const handleOpenAssetLibrary = useCallback(() => {
    setAssetLibraryOpen(true, 'all');
  }, [setAssetLibraryOpen]);

  const commitNodeData = useCallback(
    (patch: Partial<PropLibraryNodeData> & Record<string, unknown>, shouldClearDownstream = false) => {
      updateNodeData(id as string, { type: 'propLibrary', ...patch });
      if (shouldClearDownstream) {
        clearPropLibraryDownstreamFromNode(id as string);
        return;
      }
      syncDownstreamFromNode(id as string);
    },
    [id, updateNodeData],
  );

  const clearSelection = useCallback(() => {
    commitNodeData({
      selectedPropId: '',
      propRef: '',
      payload: '',
      imageUrl: '',
      resultUrl: '',
      params: {
        ...(nodeData.params || {}),
        selectedPropId: '',
      },
    }, true);
  }, [commitNodeData, nodeData.params]);

  const commitSelectedProp = useCallback(
    (nextSelectedId: string) => {
      if (!nextSelectedId) {
        clearSelection();
        return;
      }

      const nextProp = propAssets.find((asset) => asset.id === nextSelectedId);
      if (!nextProp) {
        clearSelection();
        return;
      }

      const nextPayload = buildPropLibraryPayload(nextProp);
      const nextPropRef = nextProp.primaryImage;

      commitNodeData({
        selectedPropId: nextSelectedId,
        propRef: nextPropRef,
        payload: nextPayload,
        imageUrl: nextPropRef,
        resultUrl: nextPropRef,
        params: {
          ...(nodeData.params || {}),
          selectedPropId: nextSelectedId,
        },
      });
    },
    [clearSelection, commitNodeData, nodeData.params, propAssets],
  );

  useEffect(() => {
    if (!selectedPropId) {
      if (
        !nodeData.selectedPropId &&
        !nodeData.params?.selectedPropId &&
        !nodeData.propRef &&
        !nodeData.payload
      ) {
        return;
      }
      clearSelection();
      return;
    }

    if (!selectedProp) {
      if (hasLoadedProps) {
        clearSelection();
      }
      return;
    }

    const nextPayload = buildPropLibraryPayload(selectedProp);
    const nextPropRef = selectedProp.primaryImage;

    if (
      nodeData.selectedPropId === selectedPropId &&
      nodeData.params?.selectedPropId === selectedPropId &&
      nodeData.propRef === nextPropRef &&
      nodeData.payload === nextPayload
    ) {
      return;
    }

    commitSelectedProp(selectedPropId);
  }, [
    clearSelection,
    commitSelectedProp,
    nodeData.params?.selectedPropId,
    hasLoadedProps,
    nodeData.payload,
    nodeData.propRef,
    nodeData.selectedPropId,
    selectedProp,
    selectedPropId,
  ]);

  const handleSyncDownstream = useCallback(() => {
    if (!selectedProp) return;
    syncDownstreamFromNode(id as string);
  }, [id, selectedProp]);

  const handleReloadProps = useCallback(() => {
    void loadPropAssets();
  }, [loadPropAssets]);

  return (
    <div className="group relative" data-testid="prop-library-node">
      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType="propLibrary"
        hideInput
        outputId="propRef"
        extraOutputs={['payload']}
        outputTip="道具/数据输出"
      />

      <div
        className={cn(
          selected ? aicgGlass.videoComposeFrameSelected : aicgGlass.videoComposeFrame,
        )}
      >
        <div className={aicgGlass.videoComposeInnerRing} />
        <div className="drag-handle flex cursor-grab items-center justify-between gap-2 rounded-t-[20px] border-b border-white/[0.06] bg-[#101012] px-3 py-2 active:cursor-grabbing">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Sword className="h-3.5 w-3.5 text-white/55" />
            <div className="min-w-0">
              <div className="truncate text-[11px] font-medium text-white/85">道具库</div>
              <div className="truncate text-[9px] text-white/35">道具 · 材质 · 标签</div>
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
            data-testid="prop-library-delete"
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
                disabled={!selectedProp}
                className={cn(
                  aicgGlass.actionBtnPrimary,
                  'h-8 px-3 text-[10px]',
                  !selectedProp && 'cursor-not-allowed opacity-45',
                )}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                同步下游
              </button>
              <button
                type="button"
                onClick={handleReloadProps}
                disabled={isLoadingProps}
                className={cn(
                  'nodrag nowheel flex h-8 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-[10px] text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white',
                  isLoadingProps && 'cursor-not-allowed opacity-45',
                )}
              >
                {isLoadingProps ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                刷新
              </button>
              <span className="ml-auto text-[10px] text-white/45">{isLoadingProps ? '加载中' : `${propAssets.length} 个道具`}</span>
            </div>
            <div className={aicgGlass.section}>
              <label className="mb-1 block text-xs text-white/60">选择道具资产</label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedPropId}
                  onChange={(event) => commitSelectedProp(event.target.value)}
                  onMouseDown={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  className={cn(aicgGlass.select, 'nodrag nowheel')}
                  data-testid="prop-library-select"
                >
                  <option value="">请选择道具</option>
                  {propAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={!selectedPropId}
                  className="nodrag nowheel flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                  title="清空道具"
                  data-testid="prop-library-clear"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {loadError ? (
              <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/80">
                {loadError}
              </div>
            ) : null}

            {selectedProp ? (
              <div className="space-y-3">
                <div className={cn(aicgGlass.section, 'overflow-hidden p-0')}>
                  {selectedProp.primaryImage ? (
                    <img
                      src={selectedProp.primaryImage}
                      alt={selectedProp.name}
                      className="h-40 w-full object-cover"
                      data-testid="prop-library-preview-image"
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-[#101012]">
                      <Sword className="h-10 w-10 text-gray-600" />
                    </div>
                  )}
                </div>

                <div className={aicgGlass.section}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] text-white/72">
                      <Sword className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-white" data-testid="prop-library-name">
                        {selectedProp.name}
                      </h3>
                      <p className="mt-1 text-xs text-white/55">
                        {selectedProp.summary || '未填写道具简介'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(selectedProp.tags?.length ?? 0) > 0 ? (
                      selectedProp.tags.map((tag) => (
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
                    <div data-testid="prop-library-prop-status">道具参考图: {selectedProp.primaryImage ? '已就绪' : '缺失'}</div>
                    <div data-testid="prop-library-payload-status">Payload: {nodeData.payload ? '已生成' : '未生成'}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={cn(aicgGlass.section, 'border-dashed px-4 py-8 text-center text-sm text-white/45')}
                data-testid="prop-library-empty"
              >
                <div>{isLoadingProps ? '正在加载道具资产...' : '先在资产中心创建道具，再在这里选择输出。'}</div>
                <div className="mt-3 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleReloadProps}
                    disabled={isLoadingProps}
                    className="nodrag nowheel inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-xs text-white/70 transition-colors hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isLoadingProps ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                    刷新道具
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenAssetLibrary}
                    className="nodrag nowheel inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-xs text-white/70 transition-colors hover:bg-white/[0.1] hover:text-white"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    打开资产中心
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

PropLibraryNode.displayName = 'PropLibraryNode';

export default PropLibraryNode;
