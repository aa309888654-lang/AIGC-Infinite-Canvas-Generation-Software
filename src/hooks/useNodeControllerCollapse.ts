import { useCallback, useEffect, useState } from 'react';
import { canvasStoreApi } from '@/store/useCanvasStore';

/** 双击预览区收起/展开底部控制面板，状态写入节点 data */
export function useNodeControllerCollapse(
  nodeId: string,
  nodeData?: { isControllerCollapsed?: boolean },
  defaultCollapsed = false,
) {
  const [collapsed, setCollapsed] = useState(
    Boolean(nodeData?.isControllerCollapsed ?? defaultCollapsed),
  );

  useEffect(() => {
    if (nodeData?.isControllerCollapsed !== undefined) {
      setCollapsed(Boolean(nodeData.isControllerCollapsed));
    }
  }, [nodeData?.isControllerCollapsed]);

  const setCollapsedPersisted = useCallback(
    (next: boolean) => {
      setCollapsed(next);
      canvasStoreApi.updateNodeData(nodeId, { isControllerCollapsed: next });
    },
    [nodeId],
  );

  const toggleCollapse = useCallback(() => {
    setCollapsedPersisted(!collapsed);
  }, [collapsed, setCollapsedPersisted]);

  const onPreviewDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleCollapse();
    },
    [toggleCollapse],
  );

  return {
    controlsCollapsed: collapsed,
    toggleCollapse,
    collapseController: () => setCollapsedPersisted(true),
    expandController: () => setCollapsedPersisted(false),
    onPreviewDoubleClick,
  };
}
