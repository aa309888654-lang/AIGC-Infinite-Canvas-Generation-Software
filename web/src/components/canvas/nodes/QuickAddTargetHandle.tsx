import { memo } from 'react';
import { Position } from '@xyflow/react';
import HandleWithTip from './HandleWithTip';
import HandleQuickAddMenu from './HandleQuickAddMenu';
import { useNodeHandleQuickAdd } from '@/hooks/useNodeHandleQuickAdd';
import { cn } from '@/lib/utils';

interface QuickAddTargetHandleProps {
  nodeId: string;
  nodeType: string;
  handleId: string;
  tip?: string;
  className?: string;
  style?: React.CSSProperties;
  menuTop?: string | number;
  silent?: boolean;
}

/** 输入句柄：右键快速新建上游节点并连接 */
function QuickAddTargetHandle({
  nodeId,
  nodeType,
  handleId,
  tip,
  className,
  style,
  menuTop = '50%',
  silent = false,
}: QuickAddTargetHandleProps) {
  const { options, menuOpen, createConnectedNode, handleContextMenu } = useNodeHandleQuickAdd(
    nodeId,
    nodeType,
    handleId,
    'upstream',
  );

  const showMenu = menuOpen && options.length > 0;
  const hasQuickAdd = options.length > 0 && !silent;

  return (
    <>
      <HandleWithTip
        type="target"
        position={Position.Left}
        id={handleId}
        nodeType={nodeType}
        className={cn(className, hasQuickAdd && 'cursor-context-menu')}
        style={style}
        tip={hasQuickAdd ? `${tip || '输入'} · 右键快速新建` : tip}
        onContextMenu={hasQuickAdd ? handleContextMenu : undefined}
      />

      {showMenu && (
        <HandleQuickAddMenu
          options={options}
          menuTop={menuTop}
          align="left"
          title="快速新建上游节点"
          onSelect={createConnectedNode}
        />
      )}
    </>
  );
}

export default memo(QuickAddTargetHandle);
