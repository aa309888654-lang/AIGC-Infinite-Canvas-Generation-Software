import type { Node } from '@xyflow/react';
import { resolveNodeDefinition } from '@/core/node-registry';
import type { NodeCategory } from '@/types/node-system';

export const DEFAULT_NODE_COLOR = '#64748B';

const NODE_TYPE_ALIASES: Record<string, string> = {
  imageGen: 'aiImage',
  videoGen: 'advancedVideoGen',
  textInput: 'aiGenText',
  photoGrid: 'gridDirector',
  magicStoryboard: 'gridDirector',
  imageGridSplitter: 'gridSplitter',
  imageAnalysis: 'aiImage',
  inpainting: 'aiImage',
  outpainting: 'aiImage',
};

const CATEGORY_COLORS: Record<NodeCategory, string> = {
  input: '#6610F2',
  output: '#00E5FF',
  processing: '#6366F1',
  effect: '#06B6D4',
  text: '#F97316',
  audio: '#EC4899',
  image: '#8B5CF6',
  video: '#FF6B00',
  utility: '#64748B',
};

type NodeColorData = {
  type?: unknown;
  nodeType?: unknown;
  category?: unknown;
  params?: {
    type?: unknown;
    nodeType?: unknown;
    category?: unknown;
  };
};

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getNodeTypeCandidates(node: Node): string[] {
  const data = (node.data || {}) as NodeColorData;
  const candidates = [
    asNonEmptyString(data.type),
    asNonEmptyString(data.nodeType),
    asNonEmptyString(data.params?.type),
    asNonEmptyString(data.params?.nodeType),
    asNonEmptyString(node.type),
  ].filter((value): value is string => Boolean(value));

  return [
    ...new Set(
      candidates.flatMap((type) => [type, NODE_TYPE_ALIASES[type]].filter(Boolean) as string[])
    ),
  ];
}

function getNodeCategoryCandidates(node: Node): string[] {
  const data = (node.data || {}) as NodeColorData;
  return [asNonEmptyString(data.category), asNonEmptyString(data.params?.category)].filter(
    (value): value is string => Boolean(value)
  );
}

export function getCanvasNodeColor(node: Node): string {
  for (const type of getNodeTypeCandidates(node)) {
    const definition = resolveNodeDefinition(type);
    if (definition?.color) return definition.color;
  }

  for (const category of getNodeCategoryCandidates(node)) {
    if (category in CATEGORY_COLORS) {
      return CATEGORY_COLORS[category as NodeCategory];
    }
  }

  return DEFAULT_NODE_COLOR;
}
