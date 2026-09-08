import { memo, useMemo } from 'react';
import { ViewportPortal } from '@xyflow/react';
import { aicgGroupService, type AICGNodeGroup } from '@/services/aicg-group-service';
import { useCanvasStore } from '@/store/useCanvasStore';

const PADDING = 24;

function computeGroupBounds(
  group: AICGNodeGroup,
  nodeById: Map<string, { id: string; position: { x: number; y: number }; width?: number; height?: number }>,
) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let memberCount = 0;

  for (const nodeId of group.nodeIds) {
    const n = nodeById.get(nodeId);
    if (!n) continue;
    const w = n.width ?? 420;
    const h = n.height ?? 280;
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
    memberCount += 1;
  }

  if (memberCount === 0) return null;

  return {
    x: minX - PADDING,
    y: minY - PADDING,
    width: maxX - minX + PADDING * 2,
    height: maxY - minY + PADDING * 2,
  };
}

interface AICGGroupOverlayProps {
  refreshKey?: number;
}

interface AICGGroupOverlayInnerProps {
  groups: AICGNodeGroup[];
}

function AICGGroupOverlayInner({ groups }: AICGGroupOverlayInnerProps) {
  const storeNodes = useCanvasStore((s) => s.nodes);
  const nodeById = useMemo(() => new Map(storeNodes.map((node) => [node.id, node])), [storeNodes]);

  return (
    <ViewportPortal>
      <div className="pointer-events-none absolute inset-0 overflow-visible">
        {groups.map((group) => {
          const bounds = computeGroupBounds(group, nodeById);
          if (!bounds) return null;
          return (
            <div
              key={group.id}
              className="absolute rounded-[18px] border"
              style={{
                left: bounds.x,
                top: bounds.y,
                width: bounds.width,
                height: bounds.height,
                borderColor: 'rgba(255,255,255,0.28)',
                background: `${group.color}14`,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
              }}
            >
              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-md border border-white/20 bg-black/18 px-2.5 py-1 text-[10px] font-semibold text-white/76 backdrop-blur-sm">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: group.color }}
                />
                <span>{group.name}</span>
                <span className="font-mono text-white/38">{group.nodeIds.length}</span>
              </div>
            </div>
          );
        })}
      </div>
    </ViewportPortal>
  );
}

/** 画布上 AICG 编组边框与标签 */
function AICGGroupOverlay({ refreshKey = 0 }: AICGGroupOverlayProps) {
  const groups = useMemo(() => {
    void refreshKey;
    return aicgGroupService.getAll();
  }, [refreshKey]);

  if (groups.length === 0) return null;

  return <AICGGroupOverlayInner groups={groups} />;
}

export default memo(AICGGroupOverlay);
