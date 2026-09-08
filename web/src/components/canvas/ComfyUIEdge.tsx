import { memo, useEffect, useMemo, useState } from 'react';
import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react';
import { getPortType, PortDirection } from '@/types/node-system';
import { AICG_PORT_COLORS, resolvePortColor } from './aicg-port-visuals';

const ComfyUIEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  animated,
  source,
  sourceHandleId,
  data,
}: EdgeProps) => {
  const edgeData = data as Record<string, unknown> | undefined;
  const signalPulse = edgeData?.signalPulse as number | undefined;
  const flowing = Boolean(edgeData?.flowing);

  const [pulseGeneration, setPulseGeneration] = useState(0);

  useEffect(() => {
    if (signalPulse) {
      setPulseGeneration((n) => n + 1);
    }
  }, [signalPulse]);

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const connectionColor = useMemo(() => {
    if (selected) return '#FFFFFF';

    const portType = edgeData?.portType as string | undefined;
    if (portType) {
      return resolvePortColor(portType);
    }

    if (source && sourceHandleId) {
      const sourceNodeType = edgeData?.sourceNodeType as string | undefined;
      if (sourceNodeType) {
        const type = getPortType(sourceNodeType, sourceHandleId, 'source' as PortDirection);
        if (type) return resolvePortColor(type);
      }
    }

    if (animated) return '#666666';
    return '#555555';
  }, [selected, animated, source, sourceHandleId, edgeData]);

  const showFlowLight = flowing || Boolean(animated);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: connectionColor,
          strokeWidth: 1.5,
          transition: 'stroke 0.2s ease',
          ...style,
        }}
        markerEnd={markerEnd}
      />

      {/* 原线条之上：流动光效 */}
      {showFlowLight ? (
        <path
          d={edgePath}
          fill="none"
          stroke={selected ? '#FFFFFF' : connectionColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="5 8"
          opacity={flowing ? 0.9 : 0.45}
          className="aicg-edge-signal-flow pointer-events-none"
        />
      ) : null}

      {pulseGeneration > 0 ? (
        <g key={`pulse-${id}-${pulseGeneration}`} className="pointer-events-none">
          <circle r={4} fill={connectionColor} opacity={0.35}>
            <animateMotion dur="1.1s" repeatCount="1" path={edgePath} calcMode="linear" />
          </circle>
          <circle r={2.5} fill="#ffffff" opacity={0.95}>
            <animateMotion dur="1.1s" repeatCount="1" path={edgePath} calcMode="linear" />
          </circle>
        </g>
      ) : null}
    </>
  );
});

ComfyUIEdge.displayName = 'ComfyUIEdge';

export default ComfyUIEdge;
export { AICG_PORT_COLORS };
