import { Handle, HandleProps, useNodeId, useStore } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { PortType } from '@/types/node-system';
import {
  AICG_PORT_LABELS,
  buildHandleVisualStyle,
  resolveHandlePortType,
} from '../aicg-port-visuals';
import { AICG_HANDLE_SIZE } from './aicg-node-handles';

interface HandleWithTipProps extends HandleProps {
  tip?: string;
  onMouseDown?: (event: React.MouseEvent) => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  portType?: PortType | string | null;
  nodeType?: string;
}

export default function HandleWithTip({
  tip,
  className,
  style,
  onMouseDown,
  onContextMenu,
  portType: portTypeProp,
  nodeType: nodeTypeProp,
  id: handleId,
  type: handleDirection,
  ...props
}: HandleWithTipProps) {
  const nodeId = useNodeId();

  const nodeType = useStore((state) => {
    if (nodeTypeProp) return nodeTypeProp;
    if (!nodeId) return undefined;
    const node = state.nodes.find((n) => n.id === nodeId);
    return (node?.type || node?.data?.type) as string | undefined;
  });

  const direction = handleDirection === 'source' ? 'source' : 'target';

  const portType =
    portTypeProp !== undefined
      ? portTypeProp
      : resolveHandlePortType(nodeType, handleId as string | undefined, direction);

  const { connected, flowing } = useStore((state) => {
    if (!nodeId || !handleId) {
      return { connected: false, flowing: false };
    }
    let isConnected = false;
    let isFlowing = false;
    for (const edge of state.edges) {
      const data = edge.data as Record<string, unknown> | undefined;
      if (handleDirection === 'source') {
        if (edge.source === nodeId && edge.sourceHandle === handleId) {
          isConnected = true;
          if (data?.flowing) isFlowing = true;
        }
      } else if (edge.target === nodeId && edge.targetHandle === handleId) {
        isConnected = true;
        if (data?.flowing) isFlowing = true;
      }
    }
    return { connected: isConnected, flowing: isFlowing };
  });

  const isHitOnly = String(className || '').includes('aicg-handle-hit-only');
  const visualStyle = buildHandleVisualStyle({
    portType,
    connected,
    flowing,
    direction: handleDirection === 'source' ? 'source' : 'target',
    ioRole: isHitOnly ? undefined : handleDirection === 'source' ? 'output' : 'input',
  });

  const portLabel = portType ? AICG_PORT_LABELS[portType] : undefined;
  const title =
    tip ||
    (portLabel
      ? `${portLabel}${connected ? ' · 已连接' : ''}${flowing ? ' · 传输中' : ''}`
      : undefined);

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onContextMenu?.(event);
  };

  return (
    <Handle
      {...props}
      id={handleId}
      type={handleDirection}
      data-aicg-handle={handleId}
      className={cn(
        'aicg-port-handle !z-[100] !rounded-full !border-2 !transition-all !duration-300',
        connected && 'aicg-handle-connected',
        flowing && 'aicg-handle-flowing',
        handleDirection === 'source' ? 'aicg-handle-out' : 'aicg-handle-in',
        className,
      )}
      style={{
        width: AICG_HANDLE_SIZE,
        height: AICG_HANDLE_SIZE,
        ...visualStyle,
        ...style,
      }}
      title={title}
      onMouseDown={onMouseDown}
      onContextMenu={handleContextMenu}
    />
  );
}
