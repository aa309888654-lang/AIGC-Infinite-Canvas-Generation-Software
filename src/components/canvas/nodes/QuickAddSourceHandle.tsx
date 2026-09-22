import { memo } from 'react';
import { Position } from '@xyflow/react';
import HandleWithTip from './HandleWithTip';
import HandleQuickAddMenu from './HandleQuickAddMenu';
import { useNodeHandleQuickAdd } from '@/hooks/useNodeHandleQuickAdd';
import { cn } from '@/lib/utils';

interface QuickAddSourceHandleProps {
  nodeId: string;
  nodeType: string;
  handleId: string;
  tip?: string;
  className?: string;
  style?: React.CSSProperties;
  menuTop?: string | number;
  /** 无关联项时仍显示句柄，但不弹菜单 */
  silent?: boolean;
}

function QuickAddSourceHandle({
  nodeId,
  nodeType,
  handleId,
  tip,
  className,
  style,
  menuTop = '50%',
  silent = false,
}: QuickAddSourceHandleProps) {
  const { options, menuOpen, createConnectedNode, handleContextMenu } = useNodeHandleQuickAdd(
    nodeId,
    nodeType,
    handleId,
    'downstream',
  );

  const showMenu = menuOpen && options.length > 0;
  const hasQuickAdd = options.length > 0 && !silent;

  return (
    <>
      <HandleWithTip
        type="source"
        position={Position.Right}
        id={handleId}
        nodeType={nodeType}
        className={cn(className, hasQuickAdd && 'cursor-context-menu')}
        style={style}
        tip={hasQuickAdd ? `${tip || '输出'} · 右键快速新建` : tip}
        onContextMenu={hasQuickAdd ? handleContextMenu : undefined}
      />

      {showMenu && (
        <HandleQuickAddMenu
          options={options}
          menuTop={menuTop}
          align="right"
          onSelect={createConnectedNode}
        />
      )}
    </>
  );
}

export default memo(QuickAddSourceHandle);
