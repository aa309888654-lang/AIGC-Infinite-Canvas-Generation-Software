/**
 * 节点布局辅助工具
 * 提供对齐辅助线和自动布局功能
 */

import type { Node, Edge } from '@xyflow/react';
import {
  CANVAS_NODE_BASE_WIDTH,
  CANVAS_NODE_DEFAULT_HEIGHT,
  CANVAS_NODE_HORIZONTAL_GAP,
  CANVAS_NODE_VERTICAL_GAP,
  getCanvasNodeDimensionsFromNode,
} from '@/lib/canvas-node-dimensions';

// 对齐辅助线类型
export interface AlignmentGuide {
  id: string;
  axis: 'horizontal' | 'vertical';
  position: number;
  nodes: string[]; // 对齐的节点ID
}

// 布局配置
export interface LayoutConfig {
  type: 'force-directed' | 'hierarchical' | 'grid';
  spacing: {
    horizontal: number;
    vertical: number;
  };
  animate: boolean;
  duration: number;
}

// 节点位置信息
export interface NodePosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ==================== 对齐辅助线 ====================

/**
 * 计算拖拽时的对齐辅助线
 */
export function calculateAlignmentGuides(
  draggingNode: Node,
  otherNodes: Node[],
  snapThreshold: number = 10
): AlignmentGuide[] {
  const guides: AlignmentGuide[] = [];
  
  const dragX = draggingNode.position.x;
  const dragY = draggingNode.position.y;
  const nodeWidth = draggingNode.style?.width as number || 200;
  const nodeHeight = draggingNode.style?.height as number || 100;
  
  // 中心点
  const dragCenterX = dragX + nodeWidth / 2;
  const dragCenterY = dragY + nodeHeight / 2;
  
  // 检查水平对齐（与左边缘、中心、右边缘对齐）
  const alignments = [
    { axis: 'vertical' as const, position: dragX, points: ['left'] },
    { axis: 'vertical' as const, position: dragCenterX, points: ['center'] },
    { axis: 'vertical' as const, position: dragX + nodeWidth, points: ['right'] },
    { axis: 'horizontal' as const, position: dragY, points: ['top'] },
    { axis: 'horizontal' as const, position: dragCenterY, points: ['middle'] },
    { axis: 'horizontal' as const, position: dragY + nodeHeight, points: ['bottom'] },
  ];
  
  for (const alignment of alignments) {
    const alignedNodes: string[] = [];
    let targetPosition = alignment.position;
    
    for (const node of otherNodes) {
      if (node.id === draggingNode.id) continue;
      
      const nodeX = node.position.x;
      const nodeY = node.position.y;
      const width = node.style?.width as number || 200;
      const height = node.style?.height as number || 100;
      const centerX = nodeX + width / 2;
      const centerY = nodeY + height / 2;
      
      let nodePosition: number;
      
      if (alignment.axis === 'vertical') {
        // 垂直对齐（检查x坐标）
        if (alignment.points.includes('left')) {
          nodePosition = nodeX;
        } else if (alignment.points.includes('center')) {
          nodePosition = centerX;
        } else {
          nodePosition = nodeX + width;
        }
      } else {
        // 水平对齐（检查y坐标）
        if (alignment.points.includes('top')) {
          nodePosition = nodeY;
        } else if (alignment.points.includes('middle')) {
          nodePosition = centerY;
        } else {
          nodePosition = nodeY + height;
        }
      }
      
      // 检查是否在阈值范围内
      if (Math.abs(nodePosition - targetPosition) <= snapThreshold) {
        alignedNodes.push(node.id);
        
        // 更新目标位置为对齐位置
        if (alignment.axis === 'vertical') {
          if (alignment.points.includes('left')) {
            targetPosition = nodeX;
          } else if (alignment.points.includes('center')) {
            targetPosition = centerX;
          } else {
            targetPosition = nodeX + width;
          }
        } else {
          if (alignment.points.includes('top')) {
            targetPosition = nodeY;
          } else if (alignment.points.includes('middle')) {
            targetPosition = centerY;
          } else {
            targetPosition = nodeY + height;
          }
        }
      }
    }
    
    // 如果有节点对齐，创建辅助线
    if (alignedNodes.length > 0) {
      guides.push({
        id: `${alignment.axis}-${targetPosition}`,
        axis: alignment.axis,
        position: targetPosition,
        nodes: alignedNodes
      });
    }
  }
  
  return guides;
}

/**
 * 获取对齐后的节点位置
 */
export function getSnappedPosition(
  position: { x: number; y: number },
  guides: AlignmentGuide[],
  nodeWidth: number = 200,
  nodeHeight: number = 100
): { x: number; y: number } {
  let newX = position.x;
  let newY = position.y;
  
  for (const guide of guides) {
    if (guide.axis === 'vertical') {
      // 计算新位置（基于节点的哪个边缘对齐）
      if (Math.abs(newX - guide.position) < 20) {
        newX = guide.position;
      } else if (Math.abs(newX + nodeWidth / 2 - guide.position) < 20) {
        newX = guide.position - nodeWidth / 2;
      } else if (Math.abs(newX + nodeWidth - guide.position) < 20) {
        newX = guide.position - nodeWidth;
      }
    } else {
      // 水平方向
      if (Math.abs(newY - guide.position) < 20) {
        newY = guide.position;
      } else if (Math.abs(newY + nodeHeight / 2 - guide.position) < 20) {
        newY = guide.position - nodeHeight / 2;
      } else if (Math.abs(newY + nodeHeight - guide.position) < 20) {
        newY = guide.position - nodeHeight;
      }
    }
  }
  
  return { x: newX, y: newY };
}

// ==================== 自动布局算法 ====================

const DEFAULT_NODE_WIDTH = CANVAS_NODE_BASE_WIDTH;
const DEFAULT_NODE_HEIGHT = CANVAS_NODE_DEFAULT_HEIGHT;
const MIN_GAP = Math.max(CANVAS_NODE_HORIZONTAL_GAP, CANVAS_NODE_VERTICAL_GAP);

function getNodeWidth(node: Node): number {
  return getCanvasNodeDimensionsFromNode(node).width || DEFAULT_NODE_WIDTH;
}

function getNodeHeight(node: Node): number {
  return getCanvasNodeDimensionsFromNode(node).height || DEFAULT_NODE_HEIGHT;
}

function resolveOverlaps(
  positions: Map<string, { x: number; y: number }>,
  nodes: Node[],
  maxIterations: number = 50
): void {
  const nodeRects = nodes.map(n => ({
    id: n.id,
    w: getNodeWidth(n),
    h: getNodeHeight(n),
  }));

  for (let iter = 0; iter < maxIterations; iter++) {
    let hasOverlap = false;

    for (let i = 0; i < nodes.length; i++) {
      const posA = positions.get(nodes[i].id)!;
      const rectA = nodeRects[i];

      for (let j = i + 1; j < nodes.length; j++) {
        const posB = positions.get(nodes[j].id)!;
        const rectB = nodeRects[j];

        const overlapX = (posA.x + rectA.w + MIN_GAP) - posB.x;
        const overlapY = (posA.y + rectA.h + MIN_GAP) - posB.y;
        const overlapX2 = (posB.x + rectB.w + MIN_GAP) - posA.x;
        const overlapY2 = (posB.y + rectB.h + MIN_GAP) - posA.y;

        if (overlapX > 0 && overlapY > 0 && overlapX2 > 0 && overlapY2 > 0) {
          hasOverlap = true;
          const minOverlapX = Math.min(overlapX, overlapX2);
          const minOverlapY = Math.min(overlapY, overlapY2);

          if (minOverlapX < minOverlapY) {
            const shift = minOverlapX / 2;
            if (posA.x < posB.x) {
              posA.x -= shift;
              posB.x += shift;
            } else {
              posA.x += shift;
              posB.x -= shift;
            }
          } else {
            const shift = minOverlapY / 2;
            if (posA.y < posB.y) {
              posA.y -= shift;
              posB.y += shift;
            } else {
              posA.y += shift;
              posB.y -= shift;
            }
          }
        }
      }
    }

    if (!hasOverlap) break;
  }
}

export function forceDirectedLayout(
  nodes: Node[],
  edges: Edge[],
  config: {
    iterations: number;
    springLength: number;
    springStrength: number;
    repulsion: number;
    damping: number;
  }
): Node[] {
  if (nodes.length === 0) return nodes;

  const positionedNodes = nodes.map((node) => ({
    ...node,
    position: node.position || {
      x: Math.random() * 800,
      y: Math.random() * 600
    }
  }));

  const { iterations, springLength, springStrength, repulsion, damping } = config;

  const positions = new Map<string, { x: number; y: number; vx: number; vy: number }>();

  for (const node of positionedNodes) {
    positions.set(node.id, {
      x: node.position.x,
      y: node.position.y,
      vx: 0,
      vy: 0
    });
  }

  const edgeMap = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!edgeMap.has(edge.source)) {
      edgeMap.set(edge.source, new Set());
    }
    edgeMap.get(edge.source)!.add(edge.target);

    if (!edgeMap.has(edge.target)) {
      edgeMap.set(edge.target, new Set());
    }
    edgeMap.get(edge.target)!.add(edge.source);
  }

  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<string, { fx: number; fy: number }>();

    for (const node of positionedNodes) {
      forces.set(node.id, { fx: 0, fy: 0 });
    }

    for (let i = 0; i < positionedNodes.length; i++) {
      for (let j = i + 1; j < positionedNodes.length; j++) {
        const nodeA = positionedNodes[i];
        const nodeB = positionedNodes[j];

        const posA = positions.get(nodeA.id)!;
        const posB = positions.get(nodeB.id)!;

        const wA = getNodeWidth(nodeA);
        const hA = getNodeHeight(nodeA);
        const wB = getNodeWidth(nodeB);
        const hB = getNodeHeight(nodeB);

        const centerAx = posA.x + wA / 2;
        const centerAy = posA.y + hA / 2;
        const centerBx = posB.x + wB / 2;
        const centerBy = posB.y + hB / 2;

        const dx = centerBx - centerAx;
        const dy = centerBy - centerAy;
        const centerDist = Math.sqrt(dx * dx + dy * dy) || 1;

        const halfGapX = (wA + wB) / 2 + MIN_GAP;
        const halfGapY = (hA + hB) / 2 + MIN_GAP;

        let effectiveDist: number;
        if (Math.abs(dx) / halfGapX > Math.abs(dy) / halfGapY) {
          effectiveDist = centerDist * (halfGapX / Math.abs(dx || 1));
        } else {
          effectiveDist = centerDist * (halfGapY / Math.abs(dy || 1));
        }
        effectiveDist = Math.max(effectiveDist, 1);

        const force = repulsion / (effectiveDist * effectiveDist);
        const fx = (dx / centerDist) * force;
        const fy = (dy / centerDist) * force;

        const forceA = forces.get(nodeA.id)!;
        const forceB = forces.get(nodeB.id)!;

        forceA.fx -= fx;
        forceA.fy -= fy;
        forceB.fx += fx;
        forceB.fy += fy;
      }
    }

    for (const edge of edges) {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);

      if (!source || !target) continue;

      const sourceNode = positionedNodes.find(n => n.id === edge.source);
      const targetNode = positionedNodes.find(n => n.id === edge.target);
      if (!sourceNode || !targetNode) continue;

      const sCx = source.x + getNodeWidth(sourceNode) / 2;
      const sCy = source.y + getNodeHeight(sourceNode) / 2;
      const tCx = target.x + getNodeWidth(targetNode) / 2;
      const tCy = target.y + getNodeHeight(targetNode) / 2;

      const dx = tCx - sCx;
      const dy = tCy - sCy;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;

      const displacement = distance - springLength;
      const force = springStrength * displacement;

      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      const forceSource = forces.get(edge.source)!;
      const forceTarget = forces.get(edge.target)!;

      forceSource.fx += fx;
      forceSource.fy += fy;
      forceTarget.fx -= fx;
      forceTarget.fy -= fy;
    }

    for (const node of positionedNodes) {
      const pos = positions.get(node.id)!;
      const force = forces.get(node.id)!;

      const maxForce = 100;
      force.fx = Math.max(-maxForce, Math.min(maxForce, force.fx));
      force.fy = Math.max(-maxForce, Math.min(maxForce, force.fy));

      pos.vx = (pos.vx + force.fx) * damping;
      pos.vy = (pos.vy + force.fy) * damping;

      pos.x += pos.vx;
      pos.y += pos.vy;

      pos.x = Math.max(0, pos.x);
      pos.y = Math.max(0, pos.y);
    }
  }

  const finalPositions = new Map<string, { x: number; y: number }>();
  for (const [id, pos] of positions) {
    finalPositions.set(id, { x: pos.x, y: pos.y });
  }
  resolveOverlaps(finalPositions, positionedNodes);

  return positionedNodes.map(node => ({
    ...node,
    position: finalPositions.get(node.id)!
  }));
}

/**
 * 层次布局（从左到右）
 */
export function hierarchicalLayout(
  nodes: Node[],
  edges: Edge[],
  config: {
    direction: 'LR' | 'RL' | 'TB' | 'BT';
    nodeSpacing: number;
    rankSpacing: number;
  }
): Node[] {
  if (nodes.length === 0) return nodes;

  const nodeSizeMap = new Map<string, { w: number; h: number }>();
  for (const node of nodes) {
    nodeSizeMap.set(node.id, { w: getNodeWidth(node), h: getNodeHeight(node) });
  }

  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();

  for (const node of nodes) {
    outgoing.set(node.id, new Set());
    incoming.set(node.id, new Set());
  }

  for (const edge of edges) {
    outgoing.get(edge.source)?.add(edge.target);
    incoming.get(edge.target)?.add(edge.source);
  }

  const ranks = new Map<string, number>();
  const visited = new Set<string>();

  function getRank(nodeId: string): number {
    if (ranks.has(nodeId)) return ranks.get(nodeId)!;

    visited.add(nodeId);

    const incomingNodes = incoming.get(nodeId) || new Set();
    let maxRank = 0;

    for (const sourceId of incomingNodes) {
      if (!visited.has(sourceId)) {
        maxRank = Math.max(maxRank, getRank(sourceId) + 1);
      }
    }

    ranks.set(nodeId, maxRank);
    return maxRank;
  }

  for (const node of nodes) {
    if (!ranks.has(node.id)) {
      getRank(node.id);
    }
  }

  const rankGroups = new Map<number, string[]>();
  for (const [nodeId, rank] of ranks) {
    if (!rankGroups.has(rank)) {
      rankGroups.set(rank, []);
    }
    rankGroups.get(rank)!.push(nodeId);
  }

  const positions = new Map<string, { x: number; y: number }>();
  const { direction, nodeSpacing, rankSpacing } = config;

  const isHorizontal = direction === 'LR' || direction === 'RL';

  const sortedRanks = [...rankGroups.entries()].sort((a, b) => a[0] - b[0]);
  const rankOffsets = new Map<number, number>();
  const rankSpans = new Map<number, number>();
  let rankCursor = 0;
  for (const [rank, nodeIds] of sortedRanks) {
    rankOffsets.set(rank, rankCursor);
    const rankSpan = Math.max(
      ...nodeIds.map((nodeId) => {
        const size = nodeSizeMap.get(nodeId)!;
        return isHorizontal ? size.w : size.h;
      }),
    );
    rankSpans.set(rank, rankSpan);
    rankCursor += rankSpan + rankSpacing;
  }
  const totalRankSpan = rankCursor - rankSpacing;

  for (const [rank, nodeIds] of sortedRanks) {
    const sortedIds = [...nodeIds].sort((a, b) => a.localeCompare(b));

    let cumPos = 0;
    const nodePositions: { id: string; offset: number }[] = [];

    for (const nodeId of sortedIds) {
      const size = nodeSizeMap.get(nodeId)!;
      nodePositions.push({ id: nodeId, offset: cumPos });
      cumPos += (isHorizontal ? size.h : size.w) + nodeSpacing;
    }

    const totalSpan = cumPos - nodeSpacing;
    const centeringOffset = -totalSpan / 2;

    const rankPosition = direction === 'RL' || direction === 'BT'
      ? totalRankSpan - (rankOffsets.get(rank) || 0) - (rankSpans.get(rank) || 0)
      : rankOffsets.get(rank) || 0;

    for (const { id: nodeId, offset } of nodePositions) {
      const size = nodeSizeMap.get(nodeId)!;
      let x: number, y: number;

      if (isHorizontal) {
        x = rankPosition;
        y = centeringOffset + offset;
      } else {
        x = centeringOffset + offset;
        y = rankPosition;
      }

      positions.set(nodeId, { x, y });
    }
  }

  const allPos = [...positions.values()];
  const minX = Math.min(...allPos.map(p => p.x));
  const minY = Math.min(...allPos.map(p => p.y));

  for (const [id, pos] of positions) {
    pos.x = pos.x - minX + 50;
    pos.y = pos.y - minY + 50;
  }

  resolveOverlaps(positions, nodes);

  return nodes.map(node => ({
    ...node,
    position: positions.get(node.id) || node.position
  }));
}

/**
 * 网格布局
 */
export function gridLayout(
  nodes: Node[],
  config: {
    columns: number;
    spacing: number;
  }
): Node[] {
  if (nodes.length === 0) return nodes;

  const { columns, spacing } = config;

  const maxW = Math.max(...nodes.map(n => getNodeWidth(n)));
  const maxH = Math.max(...nodes.map(n => getNodeHeight(n)));

  const positions = new Map<string, { x: number; y: number }>();
  const totalWidth = columns * maxW + (columns - 1) * spacing;
  const rows = Math.ceil(nodes.length / columns);
  const totalHeight = rows * maxH + (rows - 1) * spacing;
  const startX = -totalWidth / 2;
  const startY = -totalHeight / 2;

  nodes.forEach((node, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const w = getNodeWidth(node);
    const h = getNodeHeight(node);
    const cellX = startX + col * (maxW + spacing);
    const cellY = startY + row * (maxH + spacing);
    positions.set(node.id, {
      x: cellX + (maxW - w) / 2,
      y: cellY + (maxH - h) / 2,
    });
  });

  return nodes.map(node => ({
    ...node,
    position: positions.get(node.id)!,
  }));
}

export function equalSpacingLayout(
  nodes: Node[],
  config: {
    direction: 'horizontal' | 'vertical';
    spacing: number;
  }
): Node[] {
  if (nodes.length === 0) return nodes;

  const { direction, spacing } = config;

  const sorted = [...nodes].sort((a, b) =>
    direction === 'horizontal' ? a.position.x - b.position.x : a.position.y - b.position.y
  );

  const positions = new Map<string, { x: number; y: number }>();

  if (direction === 'horizontal') {
    const startX = Math.min(...sorted.map(n => n.position.x));
    const y = Math.min(...sorted.map(n => n.position.y));
    let x = startX;
    for (const node of sorted) {
      const w = getNodeWidth(node);
      positions.set(node.id, { x: Math.round(x), y: Math.round(y) });
      x += w + spacing;
    }
  } else {
    const x = Math.min(...sorted.map(n => n.position.x));
    const startY = Math.min(...sorted.map(n => n.position.y));
    let y = startY;
    for (const node of sorted) {
      const h = getNodeHeight(node);
      positions.set(node.id, { x: Math.round(x), y: Math.round(y) });
      y += h + spacing;
    }
  }

  return nodes.map(node => ({
    ...node,
    position: positions.get(node.id) || node.position,
  }));
}

export function gridEqualLayout(
  nodes: Node[],
  config: {
    columns?: number;
    spacing?: number;
    horizontalSpacing?: number;
    verticalSpacing?: number;
  }
): Node[] {
  if (nodes.length === 0) return nodes;

  const horizontalSpacing = config.horizontalSpacing ?? config.spacing ?? CANVAS_NODE_HORIZONTAL_GAP;
  const verticalSpacing = config.verticalSpacing ?? config.spacing ?? CANVAS_NODE_VERTICAL_GAP;
  const columns = config.columns || Math.ceil(Math.sqrt(nodes.length));
  const orderedNodes = [...nodes].sort((a, b) => {
    const rowDiff = a.position.y - b.position.y;
    return Math.abs(rowDiff) > 8 ? rowDiff : a.position.x - b.position.x;
  });
  const origin = {
    x: Math.min(...orderedNodes.map(n => n.position.x)),
    y: Math.min(...orderedNodes.map(n => n.position.y)),
  };

  const positions = new Map<string, { x: number; y: number }>();
  let cursorY = origin.y;

  for (let rowStart = 0; rowStart < orderedNodes.length; rowStart += columns) {
    const rowNodes = orderedNodes.slice(rowStart, rowStart + columns);
    let cursorX = origin.x;
    let rowHeight = 0;

    for (const node of rowNodes) {
      positions.set(node.id, {
        x: Math.round(cursorX),
        y: Math.round(cursorY),
      });
      cursorX += getNodeWidth(node) + horizontalSpacing;
      rowHeight = Math.max(rowHeight, getNodeHeight(node));
    }

    cursorY += rowHeight + verticalSpacing;
  }

  return nodes.map(node => ({
    ...node,
    position: positions.get(node.id) || node.position,
  }));
}

export function circularLayout(
  nodes: Node[],
  config: {
    radius?: number;
  }
): Node[] {
  if (nodes.length === 0) return nodes;
  if (nodes.length === 1) {
    return nodes.map(node => ({ ...node, position: { x: Math.round(node.position.x), y: Math.round(node.position.y) } }));
  }

  const nodeBounds = nodes.map((node) => ({
    node,
    width: getNodeWidth(node),
    height: getNodeHeight(node),
  }));
  const minX = Math.min(...nodeBounds.map(({ node }) => node.position.x));
  const minY = Math.min(...nodeBounds.map(({ node }) => node.position.y));
  const maxX = Math.max(...nodeBounds.map(({ node, width }) => node.position.x + width));
  const maxY = Math.max(...nodeBounds.map(({ node, height }) => node.position.y + height));
  const center = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };

  const maxDiagonal = Math.max(...nodeBounds.map(({ width, height }) => Math.hypot(width, height)));

  const angleStep = (2 * Math.PI) / nodes.length;
  const minChord = maxDiagonal + MIN_GAP;
  const minRadius = minChord / (2 * Math.sin(Math.PI / nodes.length));
  const radius = config.radius || Math.max(300, minRadius);

  const positions = new Map<string, { x: number; y: number }>();

  nodeBounds.forEach(({ node, width, height }, index) => {
    const angle = angleStep * index - Math.PI / 2;
    positions.set(node.id, {
      x: Math.round(center.x + radius * Math.cos(angle) - width / 2),
      y: Math.round(center.y + radius * Math.sin(angle) - height / 2),
    });
  });

  return nodes.map(node => ({
    ...node,
    position: positions.get(node.id) || node.position,
  }));
}

/**
 * 自动布局主函数
 */
export function autoLayout(
  nodes: Node[],
  edges: Edge[],
  config: LayoutConfig
): Node[] {
  switch (config.type) {
    case 'force-directed':
      return forceDirectedLayout(nodes, edges, {
        iterations: 100,
        springLength: 200,
        springStrength: 0.1,
        repulsion: 5000,
        damping: 0.9
      });
    
    case 'hierarchical':
      return hierarchicalLayout(nodes, edges, {
        direction: 'LR',
        nodeSpacing: 120,
        rankSpacing: 250
      });
    
    case 'grid':
      return gridLayout(nodes, {
        columns: Math.ceil(Math.sqrt(nodes.length)),
        spacing: 50
      });
    
    default:
      return nodes;
  }
}

// ==================== 节点对齐工具 ====================

/**
 * 对齐节点
 */
export function alignNodes(
  nodes: Node[],
  nodeIds: string[],
  alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
): Node[] {
  if (nodeIds.length < 2) return nodes;
  
  const selectedNodes = nodes.filter(n => nodeIds.includes(n.id));
  // 过滤后可能为空（nodeIds 含不存在的 ID），避免 Math.min(...[]) 返回 Infinity
  if (selectedNodes.length < 2) return nodes;
  
  // 计算对齐基准
  let targetPosition: number;
  
  switch (alignment) {
    case 'left':
      targetPosition = Math.min(...selectedNodes.map(n => n.position.x));
      return nodes.map(node => {
        if (!nodeIds.includes(node.id)) return node;
        return {
          ...node,
          position: { ...node.position, x: targetPosition }
        };
      });
    
    case 'center': {
      const centers = selectedNodes.map(n => n.position.x + getNodeWidth(n) / 2);
      targetPosition = centers.reduce((a, b) => a + b, 0) / centers.length;
      return nodes.map(node => {
        if (!nodeIds.includes(node.id)) return node;
        const width = getNodeWidth(node);
        return {
          ...node,
          position: { ...node.position, x: targetPosition - width / 2 }
        };
      });
    }
    
    case 'right': {
      const rights = selectedNodes.map(n => n.position.x + getNodeWidth(n));
      targetPosition = Math.max(...rights);
      return nodes.map(node => {
        if (!nodeIds.includes(node.id)) return node;
        const width = getNodeWidth(node);
        return {
          ...node,
          position: { ...node.position, x: targetPosition - width }
        };
      });
    }
    
    case 'top':
      targetPosition = Math.min(...selectedNodes.map(n => n.position.y));
      return nodes.map(node => {
        if (!nodeIds.includes(node.id)) return node;
        return {
          ...node,
          position: { ...node.position, y: targetPosition }
        };
      });
    
    case 'middle': {
      const middles = selectedNodes.map(n => n.position.y + getNodeHeight(n) / 2);
      targetPosition = middles.reduce((a, b) => a + b, 0) / middles.length;
      return nodes.map(node => {
        if (!nodeIds.includes(node.id)) return node;
        const height = getNodeHeight(node);
        return {
          ...node,
          position: { ...node.position, y: targetPosition - height / 2 }
        };
      });
    }
    
    case 'bottom': {
      const bottoms = selectedNodes.map(n => n.position.y + getNodeHeight(n));
      targetPosition = Math.max(...bottoms);
      return nodes.map(node => {
        if (!nodeIds.includes(node.id)) return node;
        const height = getNodeHeight(node);
        return {
          ...node,
          position: { ...node.position, y: targetPosition - height }
        };
      });
    }
    
    default:
      return nodes;
  }
}

/**
 * 分布节点
 */
export function distributeNodes(
  nodes: Node[],
  nodeIds: string[],
  direction: 'horizontal' | 'vertical'
): Node[] {
  if (nodeIds.length < 3) return nodes;
  
  const selectedNodes = nodes.filter(n => nodeIds.includes(n.id));
  // 过滤后可能不足 3 个（nodeIds 含不存在的 ID），避免访问 undefined.position
  if (selectedNodes.length < 3) return nodes;
  
  // 按位置排序
  const sorted = [...selectedNodes].sort((a, b) => {
    if (direction === 'horizontal') {
      return a.position.x - b.position.x;
    } else {
      return a.position.y - b.position.y;
    }
  });
  
  // 计算总距离和平均间距
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  
  let totalDistance: number;
  if (direction === 'horizontal') {
    const firstCenter = first.position.x + (first.style?.width as number || 200) / 2;
    const lastCenter = last.position.x + (last.style?.width as number || 200) / 2;
    totalDistance = lastCenter - firstCenter;
  } else {
    const firstCenter = first.position.y + (first.style?.height as number || 100) / 2;
    const lastCenter = last.position.y + (last.style?.height as number || 100) / 2;
    totalDistance = lastCenter - firstCenter;
  }
  
  const avgSpacing = totalDistance / (sorted.length - 1);
  
  // 重新分布
  return nodes.map(node => {
    if (!nodeIds.includes(node.id)) return node;
    
    const index = sorted.findIndex(n => n.id === node.id);
    
    if (direction === 'horizontal') {
      const newX = first.position.x + index * avgSpacing;
      return {
        ...node,
        position: { x: newX, y: node.position.y }
      };
    } else {
      const newY = first.position.y + index * avgSpacing;
      return {
        ...node,
        position: { x: node.position.x, y: newY }
      };
    }
  });
}
