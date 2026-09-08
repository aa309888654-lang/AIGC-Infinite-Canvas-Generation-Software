import type { Node } from '@xyflow/react';

export const CANVAS_NODE_BASE_WIDTH = 548;
export const CANVAS_NODE_DEFAULT_HEIGHT = 360;
export const CANVAS_NODE_HORIZONTAL_GAP = 96;
export const CANVAS_NODE_VERTICAL_GAP = 96;
export const CANVAS_NODE_PLACEMENT_PADDING = 24;

const CANVAS_NODE_PLACEMENT_MAX_ATTEMPTS = 120;
const CANVAS_NODE_PLACEMENT_GRID_COLUMNS = 6;

type NodeDimension = {
  width: number;
  height: number;
};

export type CanvasNodeOverlapPair = {
  a: Node;
  b: Node;
};

const DEFAULT_NODE_DIMENSION: NodeDimension = {
  width: CANVAS_NODE_BASE_WIDTH,
  height: CANVAS_NODE_DEFAULT_HEIGHT,
};

const NODE_DIMENSIONS: Record<string, NodeDimension> = {
  prompt: { width: 620, height: 520 },
  textInput: { width: CANVAS_NODE_BASE_WIDTH, height: 600 },
  aiGenText: { width: CANVAS_NODE_BASE_WIDTH, height: 600 },
  imageInput: { width: CANVAS_NODE_BASE_WIDTH, height: 360 },
  videoInput: { width: CANVAS_NODE_BASE_WIDTH, height: 360 },
  frameExtractor: { width: CANVAS_NODE_BASE_WIDTH, height: 620 },
  audioInput: { width: CANVAS_NODE_BASE_WIDTH, height: 600 },
  audioGen: { width: CANVAS_NODE_BASE_WIDTH, height: 600 },
  aiImage: { width: CANVAS_NODE_BASE_WIDTH, height: 640 },
  aiVideo: { width: CANVAS_NODE_BASE_WIDTH, height: 640 },
  videoGen: { width: CANVAS_NODE_BASE_WIDTH, height: 640 },
  aicgVideoGen: { width: CANVAS_NODE_BASE_WIDTH, height: 640 },
  script: { width: CANVAS_NODE_BASE_WIDTH, height: 620 },
  storyboardMaker: { width: CANVAS_NODE_BASE_WIDTH, height: 620 },
  cameraPath: { width: CANVAS_NODE_BASE_WIDTH, height: 520 },
  gridDirector: { width: CANVAS_NODE_BASE_WIDTH, height: 620 },
  scriptStoryboard: { width: CANVAS_NODE_BASE_WIDTH, height: 620 },
  director3D: { width: CANVAS_NODE_BASE_WIDTH, height: 620 },
  panorama360: { width: CANVAS_NODE_BASE_WIDTH, height: 620 },
  localMatting: { width: CANVAS_NODE_BASE_WIDTH, height: 620 },
  videoUpscale: { width: CANVAS_NODE_BASE_WIDTH, height: 420 },
  characterLibrary: { width: CANVAS_NODE_BASE_WIDTH, height: 620 },
  characterConsistency: { width: CANVAS_NODE_BASE_WIDTH, height: 620 },
  output: { width: CANVAS_NODE_BASE_WIDTH, height: 300 },
  adCopyText: { width: 360, height: 420 },
  brandCopyText: { width: 360, height: 420 },
  storyboardEdit: { width: 360, height: 420 },
  vr360Preview: { width: 360, height: 420 },
  batchProcess: { width: CANVAS_NODE_BASE_WIDTH, height: 520 },
  multiAngle: { width: CANVAS_NODE_BASE_WIDTH, height: 490 },
  imageCollage: { width: CANVAS_NODE_BASE_WIDTH, height: 520 },
  gridSplitter: { width: CANVAS_NODE_BASE_WIDTH, height: 520 },
};

export function getCanvasNodeDimensions(nodeType?: string): NodeDimension {
  if (!nodeType) return DEFAULT_NODE_DIMENSION;
  return NODE_DIMENSIONS[nodeType] || DEFAULT_NODE_DIMENSION;
}

export function getCanvasNodeDimensionsFromNode(node: Node): NodeDimension {
  const dataType = typeof node.data?.type === 'string' ? node.data.type : undefined;
  const type = dataType || node.type;
  const fallback = getCanvasNodeDimensions(type);
  const measuredWidth = node.measured?.width;
  const measuredHeight = node.measured?.height;
  const nodeWidth = typeof node.width === 'number' ? node.width : undefined;
  const nodeHeight = typeof node.height === 'number' ? node.height : undefined;
  const dataWidth =
    typeof node.data?.canvasNodeWidth === 'number' ? node.data.canvasNodeWidth : undefined;
  const dataHeight =
    typeof node.data?.canvasNodeHeight === 'number' ? node.data.canvasNodeHeight : undefined;

  return {
    width: measuredWidth || nodeWidth || dataWidth || fallback.width,
    height: measuredHeight || nodeHeight || dataHeight || fallback.height,
  };
}

export function canvasNodesOverlap(
  a: Node,
  b: Node,
  padding = CANVAS_NODE_PLACEMENT_PADDING
): boolean {
  const aSize = getCanvasNodeDimensionsFromNode(a);
  const bSize = getCanvasNodeDimensionsFromNode(b);
  const aX = a.position?.x ?? 0;
  const aY = a.position?.y ?? 0;
  const bX = b.position?.x ?? 0;
  const bY = b.position?.y ?? 0;
  const inset = padding / 2;

  return (
    aX - inset < bX + bSize.width + inset &&
    aX + aSize.width + inset > bX - inset &&
    aY - inset < bY + bSize.height + inset &&
    aY + aSize.height + inset > bY - inset
  );
}

export function getCanvasNodeOverlapPairs(
  nodes: Node[],
  padding = CANVAS_NODE_PLACEMENT_PADDING
): CanvasNodeOverlapPair[] {
  const pairs: CanvasNodeOverlapPair[] = [];

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      if (canvasNodesOverlap(nodes[i], nodes[j], padding)) {
        pairs.push({ a: nodes[i], b: nodes[j] });
      }
    }
  }

  return pairs;
}

export function layoutCanvasNodesInRows<T extends Node>(
  nodes: T[],
  options: {
    columns?: number;
    origin?: { x: number; y: number };
    horizontalGap?: number;
    verticalGap?: number;
  } = {}
): T[] {
  const columns = Math.max(1, options.columns || CANVAS_NODE_PLACEMENT_GRID_COLUMNS);
  const origin = options.origin || { x: 0, y: 0 };
  const horizontalGap = options.horizontalGap ?? CANVAS_NODE_HORIZONTAL_GAP;
  const verticalGap = options.verticalGap ?? CANVAS_NODE_VERTICAL_GAP;

  let cursorX = origin.x;
  let cursorY = origin.y;
  let rowHeight = 0;

  return nodes.map((node, index) => {
    if (index > 0 && index % columns === 0) {
      cursorX = origin.x;
      cursorY += rowHeight + verticalGap;
      rowHeight = 0;
    }

    const dimensions = getCanvasNodeDimensionsFromNode(node);
    const positionedNode = {
      ...node,
      position: {
        x: Math.round(cursorX),
        y: Math.round(cursorY),
      },
    } as T;

    cursorX += dimensions.width + horizontalGap;
    rowHeight = Math.max(rowHeight, dimensions.height);

    return positionedNode;
  });
}

export function normalizeCanvasNodeGridPositions<T extends Node>(
  nodes: T[],
  options: {
    origin?: { x: number; y: number };
    horizontalGap?: number;
    verticalGap?: number;
  } = {}
): T[] {
  const origin = options.origin || { x: 0, y: 0 };
  const horizontalGap = options.horizontalGap ?? CANVAS_NODE_HORIZONTAL_GAP;
  const verticalGap = options.verticalGap ?? CANVAS_NODE_VERTICAL_GAP;
  const columns = Array.from(new Set(nodes.map((node) => node.position?.x ?? 0))).sort(
    (a, b) => a - b
  );
  const rows = Array.from(new Set(nodes.map((node) => node.position?.y ?? 0))).sort(
    (a, b) => a - b
  );

  const columnWidths = new Map(
    columns.map((column) => [
      column,
      Math.max(
        ...nodes
          .filter((node) => (node.position?.x ?? 0) === column)
          .map((node) => getCanvasNodeDimensionsFromNode(node).width)
      ),
    ])
  );

  const rowHeights = new Map(
    rows.map((row) => [
      row,
      Math.max(
        ...nodes
          .filter((node) => (node.position?.y ?? 0) === row)
          .map((node) => getCanvasNodeDimensionsFromNode(node).height)
      ),
    ])
  );

  const columnPositions = new Map<number, number>();
  let nextX = origin.x;
  for (const column of columns) {
    columnPositions.set(column, nextX);
    nextX += (columnWidths.get(column) || 0) + horizontalGap;
  }

  const rowPositions = new Map<number, number>();
  let nextY = origin.y;
  for (const row of rows) {
    rowPositions.set(row, nextY);
    nextY += (rowHeights.get(row) || 0) + verticalGap;
  }

  return nodes.map((node) => ({
    ...node,
    position: {
      x: Math.round(columnPositions.get(node.position?.x ?? 0) ?? node.position?.x ?? origin.x),
      y: Math.round(rowPositions.get(node.position?.y ?? 0) ?? node.position?.y ?? origin.y),
    },
  })) as T[];
}

export function resolveNonOverlappingCanvasNode<T extends Node>(node: T, existingNodes: Node[]): T {
  const base = node.position ?? { x: 0, y: 0 };
  const size = getCanvasNodeDimensionsFromNode(node);
  const stepX = size.width + CANVAS_NODE_HORIZONTAL_GAP;
  const stepY = size.height + CANVAS_NODE_VERTICAL_GAP;

  for (let attempt = 0; attempt < CANVAS_NODE_PLACEMENT_MAX_ATTEMPTS; attempt += 1) {
    const col = attempt % CANVAS_NODE_PLACEMENT_GRID_COLUMNS;
    const row = Math.floor(attempt / CANVAS_NODE_PLACEMENT_GRID_COLUMNS);
    const candidate = {
      ...node,
      position: {
        x: Math.round(base.x + col * stepX),
        y: Math.round(base.y + row * stepY),
      },
    } as T;

    const hasCollision = existingNodes.some(
      (existing) => existing.id !== candidate.id && canvasNodesOverlap(candidate, existing)
    );
    if (!hasCollision) return candidate;
  }

  const fallbackRows = Math.ceil(
    CANVAS_NODE_PLACEMENT_MAX_ATTEMPTS / CANVAS_NODE_PLACEMENT_GRID_COLUMNS
  );
  return {
    ...node,
    position: {
      x: Math.round(base.x + CANVAS_NODE_PLACEMENT_GRID_COLUMNS * stepX),
      y: Math.round(base.y + fallbackRows * stepY),
    },
  } as T;
}

export type CanvasViewportBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function hasCanvasNodeCollision(candidate: Node, existingNodes: Node[]): boolean {
  return existingNodes.some(
    (existing) => existing.id !== candidate.id && canvasNodesOverlap(candidate, existing)
  );
}

function buildViewportGridPositions(
  viewport: CanvasViewportBounds,
  stepX: number,
  stepY: number,
  nodeWidth: number,
  nodeHeight: number
): Array<{ x: number; y: number }> {
  const minX = viewport.x;
  const minY = viewport.y;
  const maxX = Math.max(minX, viewport.x + viewport.width - nodeWidth);
  const maxY = Math.max(minY, viewport.y + viewport.height - nodeHeight);
  const centerX = viewport.x + viewport.width / 2;
  const centerY = viewport.y + viewport.height / 2;
  const positions: Array<{ x: number; y: number; distance: number }> = [];

  for (let y = minY; y <= maxY; y += stepY) {
    for (let x = minX; x <= maxX; x += stepX) {
      positions.push({
        x: Math.round(x),
        y: Math.round(y),
        distance: Math.hypot(x + nodeWidth / 2 - centerX, y + nodeHeight / 2 - centerY),
      });
    }
  }

  if (!positions.some((position) => position.x === Math.round(maxX))) {
    for (let y = minY; y <= maxY; y += stepY) {
      positions.push({
        x: Math.round(maxX),
        y: Math.round(y),
        distance: Math.hypot(maxX + nodeWidth / 2 - centerX, y + nodeHeight / 2 - centerY),
      });
    }
  }

  if (!positions.some((position) => position.y === Math.round(maxY))) {
    for (let x = minX; x <= maxX; x += stepX) {
      positions.push({
        x: Math.round(x),
        y: Math.round(maxY),
        distance: Math.hypot(x + nodeWidth / 2 - centerX, maxY + nodeHeight / 2 - centerY),
      });
    }
  }

  return positions.sort((a, b) => a.distance - b.distance).map(({ x, y }) => ({ x, y }));
}

export function resolveNonOverlappingCanvasNodeInViewport<T extends Node>(
  node: T,
  existingNodes: Node[],
  viewport: CanvasViewportBounds
): T {
  const size = getCanvasNodeDimensionsFromNode(node);
  const stepX = size.width + CANVAS_NODE_HORIZONTAL_GAP;
  const stepY = size.height + CANVAS_NODE_VERTICAL_GAP;
  const positions = buildViewportGridPositions(viewport, stepX, stepY, size.width, size.height);

  for (const position of positions) {
    const candidate = { ...node, position } as T;
    if (!hasCanvasNodeCollision(candidate, existingNodes)) return candidate;
  }

  return resolveNonOverlappingCanvasNode(
    {
      ...node,
      position: {
        x: Math.round(viewport.x + viewport.width + CANVAS_NODE_HORIZONTAL_GAP),
        y: Math.round(viewport.y),
      },
    } as T,
    existingNodes
  );
}

export function resolveNonOverlappingCanvasNodes<T extends Node>(
  nodesToPlace: T[],
  existingNodes: Node[]
): T[] {
  const placedNodes = [...existingNodes];

  return nodesToPlace.map((node) => {
    const positionedNode = resolveNonOverlappingCanvasNode(node, placedNodes);
    placedNodes.push(positionedNode);
    return positionedNode;
  });
}

export function withCanvasNodeDefaultSize<T extends Record<string, unknown>>(
  nodeType: string,
  data: T
): T {
  const dimensions = getCanvasNodeDimensions(nodeType);
  return {
    canvasNodeWidth: dimensions.width,
    canvasNodeHeight: dimensions.height,
    ...data,
  };
}
