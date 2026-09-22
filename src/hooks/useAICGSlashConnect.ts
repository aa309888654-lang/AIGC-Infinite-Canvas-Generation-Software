import { useCallback, useMemo, useState } from 'react';
import {
  filterSlashCommands,
  slashCommandToQuickAdd,
  type AICGSlashCommand,
} from '@/services/aicg-slash-commands';
import { buildDefaultNodeData, getDefaultTargetHandle } from '@/services/node-handle-adjacency';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { useVirtualRenderStore } from '@/store/useVirtualRenderStore';
import { generateId } from '@/lib/utils';
import { toast } from 'sonner';

const SPAWN_GAP_X = 480;

/** AICG / 指令：在文本框中输入 / 触发，创建并连接下游节点 */
export function useAICGSlashConnect(
  nodeId: string,
  nodeType: string,
  handleId = 'textOutput',
) {
  const [slashQuery, setSlashQuery] = useState('');
  const [slashOpen, setSlashOpen] = useState(false);

  const slashCommands = useMemo(
    () => (slashOpen ? filterSlashCommands(slashQuery, nodeType, handleId) : []),
    [slashOpen, slashQuery, nodeType, handleId],
  );

  const onTextChange = useCallback((value: string, cursorAtEnd = true) => {
    if (!cursorAtEnd) {
      setSlashOpen(false);
      return;
    }
    const lastLine = value.split('\n').pop() || '';
    const slashIdx = lastLine.lastIndexOf('/');
    if (slashIdx >= 0 && !lastLine.slice(slashIdx).includes(' ')) {
      setSlashQuery(lastLine.slice(slashIdx));
      setSlashOpen(true);
    } else {
      setSlashOpen(false);
      setSlashQuery('');
    }
  }, []);

  const applySlashCommand = useCallback(
    (cmd: AICGSlashCommand, clearSlashFromText: (base: string) => string) => {
      const option = slashCommandToQuickAdd(cmd);
      const newNodeId = generateId();
      const nodes = canvasStoreApi.getNodes();
      const current = nodes.find((n) => n.id === nodeId);
      if (!current) return '';

      canvasStoreApi.addNode({
        id: newNodeId,
        type: option.nodeType,
        position: {
          x: current.position.x + SPAWN_GAP_X,
          y: current.position.y,
        },
        data: buildDefaultNodeData(option.nodeType, option.initialData),
      } as never);

      canvasStoreApi.setSelectedNodeId(newNodeId);
      canvasStoreApi.setSelectedNodeIds([newNodeId]);
      try {
        useVirtualRenderStore.getState().addRecentlyAddedNode(newNodeId);
      } catch {
        /* ignore */
      }

      canvasStoreApi.addEdge({
        id: `edge-${nodeId}-${newNodeId}-${Date.now()}`,
        source: nodeId,
        sourceHandle: option.sourceHandle || handleId,
        target: newNodeId,
        targetHandle: option.targetHandle || getDefaultTargetHandle(option.nodeType, nodeType),
        animated: true,
        type: 'comfyui',
      });

      setSlashOpen(false);
      setSlashQuery('');
      toast.success(`已创建「${cmd.label}」并连接`);
      return clearSlashFromText(slashQuery);
    },
    [handleId, nodeId, nodeType, slashQuery],
  );

  const closeSlash = useCallback(() => {
    setSlashOpen(false);
    setSlashQuery('');
  }, []);

  return {
    slashOpen,
    slashCommands,
    slashQuery,
    onTextChange,
    applySlashCommand,
    closeSlash,
  };
}
