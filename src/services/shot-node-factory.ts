import type { Edge, Node } from '@xyflow/react';
import { generateId } from '@/lib/utils';
import { buildNodeDataFromDefinition, NODE_TYPES } from '@/types/node-system';
import type { Shot, ShotNodeFactoryOptions, ShotNodeLinks } from '@/types/shot-system';

const DEFAULT_HORIZONTAL_GAP = 480;
const DEFAULT_VERTICAL_GAP = 380;

function getDef(nodeType: string) {
  return NODE_TYPES.find((def) => def.id === nodeType);
}

function createShotNode(
  shot: Shot,
  nodeType: string,
  position: { x: number; y: number },
  data: Record<string, unknown>
): Node<Record<string, unknown>> | null {
  const def = getDef(nodeType);
  if (!def) return null;

  return {
    id: generateId(),
    type: nodeType,
    position,
    data: {
      ...buildNodeDataFromDefinition(def),
      shotId: shot.id,
      shotIndex: shot.index,
      shotTitle: shot.title,
      ...data,
    },
  };
}

function edge(source: Node, target: Node, sourceHandle: string, targetHandle: string): Edge {
  return {
    id: `shot-${source.id}-${target.id}`,
    source: source.id,
    target: target.id,
    sourceHandle,
    targetHandle,
    animated: true,
    type: 'comfyui',
  };
}

export function createShotNodeGroup(
  shot: Shot,
  options: ShotNodeFactoryOptions
): { nodes: Node<Record<string, unknown>>[]; edges: Edge[]; nodeLinks: ShotNodeLinks } {
  const horizontalGap = options.horizontalGap ?? DEFAULT_HORIZONTAL_GAP;
  const y = options.origin.y + (shot.index - 1) * (options.verticalGap ?? DEFAULT_VERTICAL_GAP);
  const x = options.origin.x;

  const textNode = createShotNode(
    shot,
    'aiGenText',
    { x, y },
    {
      label: `${shot.title} · 文本`,
      prompt: shot.scriptText,
      outputText: shot.visualPrompt,
      textWorkspace: 'generate',
      shotRole: 'script',
    }
  );
  const imageNode = createShotNode(
    shot,
    'aiImage',
    { x: x + horizontalGap, y },
    {
      label: `${shot.title} · 生图`,
      prompt: shot.visualPrompt,
      aspectRatio: shot.aspectRatio,
      generationMode: 'text_to_image',
      shotRole: 'image',
    }
  );
  const videoNode = createShotNode(
    shot,
    'aiVideo',
    { x: x + horizontalGap * 2, y },
    {
      label: `${shot.title} · 生视频`,
      prompt: shot.visualPrompt,
      aspectRatio: shot.aspectRatio,
      duration: shot.duration,
      generationMode: 'image_to_video',
      cameraMovement: shot.camera,
      shotRole: 'video',
    }
  );
  const outputNode = createShotNode(
    shot,
    'output',
    { x: x + horizontalGap * 3, y },
    {
      label: `${shot.title} · 输出`,
      shotRole: 'output',
    }
  );

  const nodes = [textNode, imageNode, videoNode, outputNode].filter(Boolean) as Node<
    Record<string, unknown>
  >[];
  const edges: Edge[] = [];

  if (textNode && imageNode) edges.push(edge(textNode, imageNode, 'textOutput', 'input'));
  if (imageNode && videoNode) edges.push(edge(imageNode, videoNode, 'output', 'input'));
  if (videoNode && outputNode) edges.push(edge(videoNode, outputNode, 'output', 'video'));

  return {
    nodes,
    edges,
    nodeLinks: {
      textNodeId: textNode?.id,
      imageNodeId: imageNode?.id,
      videoNodeId: videoNode?.id,
      outputNodeId: outputNode?.id,
    },
  };
}
