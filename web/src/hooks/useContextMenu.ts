import { useCallback, useEffect } from 'react';
import type React from 'react';
import { contextMenuManager, ContextMenuItem, ContextMenuOptions } from '@/services/context-menu';

export function useContextMenu() {
  const showMenu = useCallback(
    (options: Omit<ContextMenuOptions, 'x' | 'y'> & { event?: React.MouseEvent }) => {
      const x = options.event?.clientX ?? window.innerWidth / 2;
      const y = options.event?.clientY ?? window.innerHeight / 2;

      contextMenuManager.show({
        ...options,
        x,
        y,
      });
    },
    []
  );

  const hideMenu = useCallback(() => {
    contextMenuManager.hide();
  }, []);

  useEffect(() => {
    return () => {
      contextMenuManager.hide();
    };
  }, []);

  return {
    showMenu,
    hideMenu,
  };
}

export function useNodeContextMenu(
  onDelete: () => void,
  onDuplicate: () => void,
  onCopy: () => void,
  onPaste: () => void,
  onSelectAll: () => void
) {
  const showNodeMenu = useCallback(
    (event: React.MouseEvent, _nodeId: string) => {
      event.preventDefault();
      event.stopPropagation();

      const items: ContextMenuItem[] = [
        { id: 'copy', label: '复制', shortcut: 'Ctrl+C' },
        { id: 'cut', label: '剪切', shortcut: 'Ctrl+X' },
        { id: 'duplicate', label: '复制节点', shortcut: 'Ctrl+D' },
        { id: 'separator1', label: '', type: 'separator' },
        { id: 'delete', label: '删除', shortcut: 'Delete' },
        { id: 'separator2', label: '', type: 'separator' },
        { id: 'selectAll', label: '全选', shortcut: 'Ctrl+A' },
      ];

      contextMenuManager.show({
        x: event.clientX,
        y: event.clientY,
        items,
        onSelect: (id) => {
          switch (id) {
            case 'copy':
              onCopy();
              break;
            case 'cut':
              onCopy();
              onDelete();
              break;
            case 'duplicate':
              onDuplicate();
              break;
            case 'delete':
              onDelete();
              break;
            case 'selectAll':
              onSelectAll();
              break;
          }
        },
      });
    },
    [onCopy, onDuplicate, onDelete, onSelectAll]
  );

  return { showNodeMenu };
}

export function useCanvasContextMenu(
  onPaste: () => void,
  onSelectAll: () => void,
  onAddNode: (type: string, data?: Record<string, unknown>) => void
) {
  const showCanvasMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();

      const items: ContextMenuItem[] = [
        { id: 'paste', label: '粘贴', shortcut: 'Ctrl+V' },
        { id: 'separator1', label: '', type: 'separator' },
        { id: 'selectAll', label: '全选', shortcut: 'Ctrl+A' },
        { id: 'separator2', label: '', type: 'separator' },
        { id: 'addImageGen', label: '添加AI图片节点' },
        { id: 'addVideoGen', label: '添加视频生成节点' },
        { id: 'addAIGenText', label: '添加生成文本' },
        { id: 'addOutput', label: '添加输出节点' },
      ];

      contextMenuManager.show({
        x: event.clientX,
        y: event.clientY,
        items,
        onSelect: (id) => {
          switch (id) {
            case 'paste':
              onPaste();
              break;
            case 'selectAll':
              onSelectAll();
              break;
            case 'addImageGen':
              onAddNode('aiImage');
              break;
            case 'addVideoGen':
              onAddNode('aiVideo');
              break;
            case 'addAIGenText':
              onAddNode('aiGenText');
              break;
            case 'addOutput':
              onAddNode('output');
              break;
          }
        },
      });
    },
    [onPaste, onSelectAll, onAddNode]
  );

  return { showCanvasMenu };
}

export default useContextMenu;
