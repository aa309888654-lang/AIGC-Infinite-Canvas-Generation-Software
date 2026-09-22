import { useCallback } from 'react';
import { Node } from '@xyflow/react';
import { alignNodes, AlignmentType } from '@/utils/node-alignment';

export const useNodeAlignment = (
  nodes: Node[],
  selectedNodeIds: string[],
  setNodes: (nodes: Node[]) => void,
  saveToHistory: () => void
) => {
  const handleAlignNodes = useCallback((alignmentType: AlignmentType) => {
    if (selectedNodeIds.length < 2) return;
    const { alignedNodes } = alignNodes(nodes, selectedNodeIds, alignmentType);
    setNodes(alignedNodes);
    saveToHistory();
  }, [nodes, selectedNodeIds, setNodes, saveToHistory]);

  const alignLeft = useCallback(() => handleAlignNodes('left'), [handleAlignNodes]);
  const alignCenter = useCallback(() => handleAlignNodes('center'), [handleAlignNodes]);
  const alignRight = useCallback(() => handleAlignNodes('right'), [handleAlignNodes]);
  const alignTop = useCallback(() => handleAlignNodes('top'), [handleAlignNodes]);
  const alignMiddle = useCallback(() => handleAlignNodes('middle'), [handleAlignNodes]);
  const alignBottom = useCallback(() => handleAlignNodes('bottom'), [handleAlignNodes]);

  return {
    alignLeft,
    alignCenter,
    alignRight,
    alignTop,
    alignMiddle,
    alignBottom,
  };
};
