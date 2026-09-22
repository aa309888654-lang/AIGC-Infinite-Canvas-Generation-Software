import { memo, useCallback, useEffect, useMemo } from 'react';
import { NodeProps } from '@xyflow/react';
import { BookUser, RefreshCcw, User, X as CloseIcon } from 'lucide-react';

import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import { aicgGlass } from './aicg-node-glass';
import { buildCharacterLibraryPayload } from './character-payload';
import { cn } from '@/lib/utils';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { useAssetLibraryStore } from '@/store/useAssetLibraryStore';
import { spawnControllerToolNode } from '@/services/node-controller-action-service';

interface CharacterLibraryNodeData {
  label?: string;
  selectedCharacterId?: string;
  payload?: string;
  characterRef?: string;
  outfitRef?: string;
  params?: {
    selectedCharacterId?: string;
  };
}

const CharacterLibraryNode = memo(({ data, id, selected }: NodeProps) => {
  const nodeData = data as CharacterLibraryNodeData;
  const updateNodeData = canvasStoreApi.updateNodeData;
  const deleteNode = canvasStoreApi.deleteNode;
  const characterAssets = useAssetLibraryStore((state) => state.characterAssets);

  const selectedCharacterId = nodeData.selectedCharacterId ?? nodeData.params?.selectedCharacterId ?? '';

  const selectedCharacter = useMemo(
    () => characterAssets.find((asset) => asset.id === selectedCharacterId) ?? null,
    [characterAssets, selectedCharacterId],
  );

  const clearSyncedDownstream = useCallback(() => {
    const outgoing = canvasStoreApi.getEdges().filter((edge) => edge.source === id);

    for (const edge of outgoing) {
      const target = canvasStoreApi.getNodes().find((entry) => entry.id === edge.target);
      if (!target) continue;

      const sourceHandle = edge.sourceHandle || 'characterRef';
      const targetHandle = edge.targetHandle || 'input';
      const targetType = String(target.type || (target.data as Record<string, unknown> | undefined)?.type || '');
      const targetData = (target.data || {}) as Record<string, unknown>;
      const existingParams =
        targetData.params && typeof targetData.params === 'object' && !Array.isArray(targetData.params)
          ? (targetData.params as Record<string, unknown>)
          : {};
      const clearsPayload =
        sourceHandle === 'payload' ||
        ['promptInput', 'scriptInput', 'text', 'script'].includes(targetHandle);

      const patch: Record<string, unknown> = {
        _aicgSyncedFrom: undefined,
        _aicgSyncedAt: Date.now(),
      };

      if (clearsPayload) {
        patch.prompt = '';
        patch.text = '';
        patch.content = '';
        patch.payload = '';
        patch.characterPayload = '';
        if (targetType === 'gridDirector') {
          patch.params = { ...existingParams, prompt: '' };
        }
      } else {
        patch.imageUrl = '';
        patch.resultUrl = '';
        patch.url = '';
        patch.receivedImageUrl = '';
        patch.originalImageUrl = '';
        patch.characterRef = '';
        patch.outfitRef = '';
        patch.mediaType = undefined;
        if (targetHandle === 'characterImage') patch.characterImageUrl = '';
        if (targetHandle === 'targetImage') patch.targetImageUrl = '';
        if (targetType === 'output') patch.output = '';
        if (targetType === 'gridDirector') {
          patch.params = {
            ...existingParams,
            ...(sourceHandle === 'outfitRef' ? { outfitRef: '' } : { characterRef: '' }),
          };
        }
      }

      canvasStoreApi.updateNodeData(edge.target, patch);
    }
  }, [id]);

  const commitNodeData = useCallback(
    (patch: Partial<CharacterLibraryNodeData> & Record<string, unknown>, shouldClearDownstream = false) => {
      updateNodeData(id as string, { type: 'characterLibrary', ...patch });
      if (shouldClearDownstream) {
        clearSyncedDownstream();
        return;
      }
      syncDownstreamFromNode(id as string);
    },
    [clearSyncedDownstream, id, updateNodeData],
  );

  const clearSelection = useCallback(() => {
    commitNodeData({
      selectedCharacterId: '',
      characterRef: '',
      outfitRef: '',
      payload: '',
      imageUrl: '',
      resultUrl: '',
      params: {
        ...(nodeData.params || {}),
        selectedCharacterId: '',
      },
    }, true);
  }, [commitNodeData, nodeData.params]);

  const commitSelectedCharacter = useCallback((nextSelectedId: string) => {
    if (!nextSelectedId) {
      clearSelection();
      return;
    }

    const nextCharacter = characterAssets.find((asset) => asset.id === nextSelectedId);
    if (!nextCharacter) {
      clearSelection();
      return;
    }

    const nextPayload = buildCharacterLibraryPayload(nextCharacter);
    const nextCharacterRef = nextCharacter.primaryImage;
    const nextOutfitRef = nextCharacter.outfitImage;

    commitNodeData({
      selectedCharacterId: nextSelectedId,
      characterRef: nextCharacterRef,
      outfitRef: nextOutfitRef,
      payload: nextPayload,
      imageUrl: nextCharacterRef,
      resultUrl: nextCharacterRef,
      params: {
        ...(nodeData.params || {}),
        selectedCharacterId: nextSelectedId,
      },
    });
  }, [characterAssets, clearSelection, commitNodeData, nodeData.params]);

  useEffect(() => {
    if (!selectedCharacterId) {
      if (
        !nodeData.selectedCharacterId &&
        !nodeData.params?.selectedCharacterId &&
        !nodeData.characterRef &&
        !nodeData.outfitRef &&
        !nodeData.payload
      ) {
        return;
      }

      clearSelection();
      return;
    }

    if (!selectedCharacter) {
      clearSelection();
      return;
    }

    const nextPayload = buildCharacterLibraryPayload(selectedCharacter);
    const nextCharacterRef = selectedCharacter.primaryImage;
    const nextOutfitRef = selectedCharacter.outfitImage;

    if (
      nodeData.selectedCharacterId === selectedCharacterId &&
      nodeData.params?.selectedCharacterId === selectedCharacterId &&
      nodeData.characterRef === nextCharacterRef &&
      nodeData.outfitRef === nextOutfitRef &&
      nodeData.payload === nextPayload
    ) {
      return;
    }

    commitSelectedCharacter(selectedCharacterId);
  }, [
    clearSelection,
    commitSelectedCharacter,
    nodeData.characterRef,
    nodeData.outfitRef,
    nodeData.params?.selectedCharacterId,
    nodeData.payload,
    nodeData.selectedCharacterId,
    selectedCharacter,
    selectedCharacterId,
  ]);

  const handleClearSelection = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const handleSyncDownstream = useCallback(() => {
    if (!selectedCharacter) return;
    syncDownstreamFromNode(id as string);
  }, [id, selectedCharacter]);

  const runCharacterDownstreamAction = useCallback(
    (actionId: string, replaceExisting = false) => {
      if (!selectedCharacter) return;

      if (actionId === 'character-consistency') {
        spawnControllerToolNode(id as string, 'characterConsistency', {
          controllerActionId: actionId,
          replaceExisting,
          label: '角色一致性',
          toastLabel: '角色一致性',
          sourceHandle: 'characterRef',
          targetHandle: 'characterImage',
          initialData: {
            characterImageUrl: nodeData.characterRef || selectedCharacter.primaryImage || '',
            characterName: selectedCharacter.name,
            characterPayload: nodeData.payload || buildCharacterLibraryPayload(selectedCharacter),
          },
        });
        return;
      }

      if (actionId === 'storyboard') {
        const payload = nodeData.payload || buildCharacterLibraryPayload(selectedCharacter);
        spawnControllerToolNode(id as string, 'gridDirector', {
          controllerActionId: actionId,
          replaceExisting,
          label: '角色分镜导演',
          toastLabel: '角色分镜导演',
          sourceHandle: 'payload',
          targetHandle: 'scriptInput',
          initialData: {
            prompt: payload,
            text: payload,
            characterPayload: payload,
            params: {
              prompt: payload,
              mode: 'storyboard',
              preset: 'storyboard_full',
              characterRef: nodeData.characterRef || selectedCharacter.primaryImage || '',
              outfitRef: nodeData.outfitRef || selectedCharacter.outfitImage || '',
            },
          },
        });
      }
    },
    [id, nodeData.characterRef, nodeData.outfitRef, nodeData.payload, selectedCharacter],
  );

  return (
    <div className="group relative" data-testid="character-library-node">
      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType="characterLibrary"
        hideInput
        outputId="characterRef"
        extraOutputs={['outfitRef', 'payload']}
        outputTip="角色/服装/数据输出"
      />

      <div
        className={cn(
          selected ? aicgGlass.videoComposeFrameSelected : aicgGlass.videoComposeFrame,
        )}
      >
        <div className={aicgGlass.videoComposeInnerRing} />
        <div className="drag-handle flex cursor-grab items-center justify-between gap-2 rounded-t-[20px] border-b border-white/[0.06] bg-[#101012] px-3 py-2 active:cursor-grabbing">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <BookUser className="h-3.5 w-3.5 text-white/55" />
            <div className="min-w-0">
              <div className="truncate text-[11px] font-medium text-white/85">角色库</div>
              <div className="truncate text-[9px] text-white/35">人物 · 服装资产</div>
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
            data-testid="character-library-delete"
          >
            <CloseIcon className="h-3 w-3" />
          </button>
        </div>
        <div className="p-3">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#101012] p-2">
            <button type="button" onClick={handleSyncDownstream} disabled={!selectedCharacter} className={cn(aicgGlass.actionBtnPrimary, 'h-8 px-3 text-[10px]', !selectedCharacter && 'cursor-not-allowed opacity-45')}>
              <RefreshCcw className="h-3.5 w-3.5" />
              同步下游
            </button>
            <button type="button" onClick={() => runCharacterDownstreamAction('character-consistency')} disabled={!selectedCharacter} className={cn(aicgGlass.actionBtn, 'h-8 px-3 text-[10px]', !selectedCharacter && 'cursor-not-allowed opacity-45')}>
              一致性
            </button>
            <button type="button" onClick={() => runCharacterDownstreamAction('storyboard')} disabled={!selectedCharacter} className={cn(aicgGlass.actionBtn, 'h-8 px-3 text-[10px]', !selectedCharacter && 'cursor-not-allowed opacity-45')}>
              分镜引用
            </button>
            <span className="ml-auto text-[10px] text-white/45">{characterAssets.length} 个角色</span>
          </div>
          <div className={aicgGlass.section}>
            <label className="mb-1 block text-xs text-white/60">选择角色资产</label>
            <div className="flex items-center gap-2">
              <select
                value={selectedCharacterId}
                onChange={(event) => commitSelectedCharacter(event.target.value)}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                className={cn(aicgGlass.select, 'nodrag nowheel')}
                data-testid="character-library-select"
              >
                <option value="">请选择角色</option>
                {characterAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleClearSelection}
                disabled={!selectedCharacterId}
                className="nodrag nowheel flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                title="清空角色"
                data-testid="character-library-clear"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleSyncDownstream}
                disabled={!selectedCharacter}
                className="nodrag nowheel flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/16 bg-white/[0.06] text-white/70 transition-colors hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                title="同步下游"
                data-testid="character-library-sync"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {selectedCharacter ? (
            <div className="space-y-3">
              <div className={cn(aicgGlass.section, 'overflow-hidden p-0')}>
                {selectedCharacter.primaryImage ? (
                  <img
                    src={selectedCharacter.primaryImage}
                    alt={selectedCharacter.name}
                    className="h-40 w-full object-cover"
                    data-testid="character-library-preview-image"
                  />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-[#101012]">
                    <User className="h-10 w-10 text-gray-600" />
                  </div>
                )}
              </div>

              <div className={aicgGlass.section}>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] text-white/72">
                    <BookUser className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-white" data-testid="character-library-name">{selectedCharacter.name}</h3>
                    <p className="mt-1 text-xs text-white/55">
                      {selectedCharacter.summary || '未填写角色简介'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(selectedCharacter.tags?.length ?? 0) > 0 ? (
                    selectedCharacter.tags.map((tag) => (
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
                  <div data-testid="character-library-character-status">主参考图: {selectedCharacter.primaryImage ? '已就绪' : '缺失'}</div>
                  <div data-testid="character-library-outfit-status">服装参考图: {selectedCharacter.outfitImage ? '已就绪' : '未提供'}</div>
                  <div data-testid="character-library-payload-status">Payload: {nodeData.payload ? '已生成' : '未生成'}</div>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={cn(aicgGlass.section, 'border-dashed px-4 py-8 text-center text-sm text-white/45')}
              data-testid="character-library-empty"
            >
              先在资产中心创建角色，再在这里选择输出。
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
});

CharacterLibraryNode.displayName = 'CharacterLibraryNode';

export default CharacterLibraryNode;
