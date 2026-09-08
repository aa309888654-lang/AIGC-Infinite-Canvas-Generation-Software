import { useCallback, useEffect, useMemo, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { generateId } from '@/lib/utils';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { useVirtualRenderStore } from '@/store/useVirtualRenderStore';
import { toast } from 'sonner';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import {
  buildDefaultNodeData,
  getDefaultTargetHandle,
  getNodeTypeLabel,
  getQuickAddOptions,
  getUpstreamQuickAddOptions,
  resolveQuickAddNodeType,
  type HandleQuickAddOption,
} from '@/services/node-handle-adjacency';

const SPAWN_GAP_X = 480;
const SPAWN_GAP_Y = 40;

export type HandleQuickAddMode = 'downstream' | 'upstream';

export function useNodeHandleQuickAdd(
  nodeId: string,
  nodeType: string,
  handleId: string,
  mode: HandleQuickAddMode = 'downstream',
) {
  const reactFlow = useReactFlow();
  const [menuOpen, setMenuOpen] = useState(false);

  const options = useMemo(
    () =>
      mode === 'upstream'
        ? getUpstreamQuickAddOptions(nodeType, handleId)
        : getQuickAddOptions(nodeType, handleId),
    [mode, nodeType, handleId],
  );

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const openMenu = useCallback(() => {
    if (options.length === 0) return;
    setMenuOpen(true);
  }, [options.length]);

  const createConnectedNode = useCallback(
    (option: HandleQuickAddOption, index = 0) => {
      const currentNode = reactFlow.getNode(nodeId);
      if (!currentNode) return;

      const newNodeId = generateId();
      const defaultOffsetX = mode === 'upstream' ? -SPAWN_GAP_X : SPAWN_GAP_X;
      const offsetX = option.offsetX ?? defaultOffsetX + (index % 2) * 30;
      const offsetY = option.offsetY ?? index * SPAWN_GAP_Y;
      const position = {
        x: currentNode.position.x + offsetX,
        y: currentNode.position.y + offsetY,
      };

      const currentData = (currentNode.data || {}) as Record<string, unknown>;
      const optionParams =
        option.initialData?.params && typeof option.initialData.params === 'object'
          ? (option.initialData.params as Record<string, unknown>)
          : {};
      const inheritedModelId =
        nodeType === 'cameraPath' && typeof currentData.preferredModelId === 'string'
          ? currentData.preferredModelId
          : undefined;
      const inheritedProvider =
        nodeType === 'cameraPath' && typeof currentData.preferredModelProvider === 'string'
          ? currentData.preferredModelProvider
          : undefined;
      const initialData =
        inheritedModelId && inheritedProvider
          ? {
              ...option.initialData,
              modelId: inheritedModelId,
              modelProvider: inheritedProvider,
              provider: inheritedProvider,
              params: {
                ...optionParams,
                modelId: inheritedModelId,
                modelProvider: inheritedProvider,
                provider: inheritedProvider,
                generationMode: 'image_to_video',
              },
            }
          : option.initialData;

      canvasStoreApi.addNode({
        id: newNodeId,
        type: resolveQuickAddNodeType(option.nodeType),
        position,
        data: buildDefaultNodeData(option.nodeType, initialData),
      } as never);

      canvasStoreApi.setSelectedNodeId(newNodeId);
      canvasStoreApi.setSelectedNodeIds([newNodeId]);
      try {
        useVirtualRenderStore.getState().addRecentlyAddedNode(newNodeId);
      } catch {
        /* ignore */
      }

      if (mode === 'upstream') {
        const sourceHandle = option.sourceHandle || 'output';
        const targetHandle = option.targetHandle || handleId;
        canvasStoreApi.addEdge({
          id: `edge-${newNodeId}-${nodeId}-${Date.now()}`,
          source: newNodeId,
          sourceHandle,
          target: nodeId,
          targetHandle,
          animated: true,
          type: 'comfyui',
        });
      } else {
        const sourceHandle = option.sourceHandle || handleId;
        const targetHandle = option.targetHandle || getDefaultTargetHandle(option.nodeType, nodeType);
        canvasStoreApi.addEdge({
          id: `edge-${nodeId}-${newNodeId}-${Date.now()}`,
          source: nodeId,
          sourceHandle,
          target: newNodeId,
          targetHandle,
          animated: true,
          type: 'comfyui',
        });
        // 快捷连接发生在上游节点已有结果之后，立即补推一次，避免只创建空连线。
        syncDownstreamFromNode(nodeId);
        window.setTimeout(() => syncDownstreamFromNode(nodeId), 0);
      }

      closeMenu();
      toast.success(`已创建「${option.label || getNodeTypeLabel(option.nodeType)}」并连接`);
    },
    [closeMenu, handleId, mode, nodeId, nodeType, reactFlow],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (options.length === 0) return;
      openMenu();
    },
    [openMenu, options.length],
  );

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      if (target?.closest('[data-node-handle-quick-menu]')) return;
      closeMenu();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [closeMenu, menuOpen]);

  return {
    options,
    menuOpen,
    openMenu,
    closeMenu,
    createConnectedNode,
    handleContextMenu,
  };
}
