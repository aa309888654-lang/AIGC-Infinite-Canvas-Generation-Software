import type { Edge, Node } from '@xyflow/react';
import { generateId } from '@/lib/utils';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { buildDefaultNodeData } from '@/services/node-handle-adjacency';
import {
  CANVAS_NODE_HORIZONTAL_GAP,
  CANVAS_NODE_VERTICAL_GAP,
  getCanvasNodeDimensions,
  getCanvasNodeDimensionsFromNode,
} from '@/lib/canvas-node-dimensions';
import { toast } from 'sonner';
import type { ScriptScene } from '@/types/node-data';

const SCRIPT_WORKFLOW_ACTION_ID = 'script-workflow-chain';
const CHAIN_COLUMNS = 6;

export interface SpawnScriptWorkflowChainOptions {
  script?: string;
  scenes?: ScriptScene[];
  scriptType?: string;
  tone?: string;
  replaceExisting?: boolean;
}

type ChainStage =
  | 'role-analysis'
  | 'scene-analysis'
  | 'shot-director'
  | 'image-storyboard'
  | 'video-storyboard'
  | 'video-compose'
  | 'clip-output';

interface ChainNodeSpec {
  stage: ChainStage;
  nodeType: string;
  label: string;
  column: number;
  row: number;
  initialData: Record<string, unknown>;
}

interface ChainEdgeSpec {
  sourceStage?: ChainStage;
  targetStage: ChainStage;
  sourceHandle: string;
  targetHandle: string;
}

function focusNodes(nodeIds: string[]) {
  canvasStoreApi.setSelectedNodeIds(nodeIds);
  canvasStoreApi.setSelectedNodeId(nodeIds[0] || null);
}

function getExistingChainNodeIds(sourceNodeId: string): string[] {
  return canvasStoreApi
    .getNodes()
    .filter((node) => {
      const data = (node.data || {}) as Record<string, unknown>;
      return (
        data._scriptWorkflowSourceId === sourceNodeId &&
        data._controllerActionId === SCRIPT_WORKFLOW_ACTION_ID
      );
    })
    .map((node) => node.id as string);
}

function removeExistingChain(sourceNodeId: string) {
  const existingIds = new Set(getExistingChainNodeIds(sourceNodeId));
  if (existingIds.size === 0) return;

  canvasStoreApi.setEdges(
    canvasStoreApi
      .getEdges()
      .filter((edge) => !existingIds.has(edge.source) && !existingIds.has(edge.target))
  );
  canvasStoreApi.setNodes(
    canvasStoreApi.getNodes().filter((node) => !existingIds.has(node.id as string))
  );
}

function summarizeScenes(scenes: ScriptScene[] = []): string {
  if (scenes.length === 0) return '';
  return scenes
    .slice(0, 6)
    .map((scene, index) => {
      const duration = typeof scene.duration === 'number' ? `${scene.duration}s` : '默认时长';
      return `${index + 1}. ${scene.description}（${duration} / ${scene.shotType || '镜头'}）`;
    })
    .join('\n');
}

function getPrimaryScenePrompt(script: string, scenes: ScriptScene[] = []): string {
  const firstScene = scenes.find((scene) => scene.professionalPrompt || scene.description);
  return (
    firstScene?.professionalPrompt ||
    firstScene?.description ||
    script ||
    '根据剧本生成第一组关键分镜画面，保持角色、场景、色调一致。'
  );
}

function buildRolePrompt(
  script: string,
  scenes: ScriptScene[],
  scriptType?: string,
  tone?: string
): string {
  return [
    '请从以下剧本/分镜中提取角色设定，输出可供后续生图、生视频复用的角色卡。',
    '重点包含：角色姓名或身份、年龄气质、外貌、服装、关系、动机、表演状态、角色一致性关键词。',
    `剧本类型：${scriptType || 'cinematic'}；语气：${tone || 'casual'}`,
    '',
    script || summarizeScenes(scenes) || '等待剧本文本。',
  ].join('\n');
}

function buildScenePrompt(
  script: string,
  scenes: ScriptScene[],
  scriptType?: string,
  tone?: string
): string {
  return [
    '请从以下剧本/分镜中提取场景资产表，输出可供分镜导演和生成节点使用的场景卡。',
    '重点包含：地点、时间、环境氛围、光线、色彩、道具、空间关系、镜头节奏、连续性注意事项。',
    `剧本类型：${scriptType || 'cinematic'}；语气：${tone || 'casual'}`,
    '',
    summarizeScenes(scenes) || script || '等待剧本文本。',
  ].join('\n');
}

function createChainNodeSpecs(options: SpawnScriptWorkflowChainOptions): ChainNodeSpec[] {
  const script = options.script?.trim() || '';
  const scenes = options.scenes || [];
  const sceneSummary = summarizeScenes(scenes);
  const primaryPrompt = getPrimaryScenePrompt(script, scenes);
  const sharedMeta = {
    sourceScript: script,
    sourceScenes: scenes,
    scriptType: options.scriptType,
    tone: options.tone,
  };

  return [
    {
      stage: 'role-analysis',
      nodeType: 'aiGenText',
      label: '角色分析',
      column: 0,
      row: 0,
      initialData: {
        prompt: buildRolePrompt(script, scenes, options.scriptType, options.tone),
        textWorkspace: 'generate',
        systemPrompt: '你是影视角色设定分析师，输出结构化角色卡，方便后续节点复用。',
      },
    },
    {
      stage: 'scene-analysis',
      nodeType: 'aiGenText',
      label: '场景分析',
      column: 0,
      row: 1,
      initialData: {
        prompt: buildScenePrompt(script, scenes, options.scriptType, options.tone),
        textWorkspace: 'generate',
        systemPrompt: '你是影视美术和场景连续性分析师，输出结构化场景资产表。',
      },
    },
    {
      stage: 'shot-director',
      nodeType: 'gridDirector',
      label: '镜头拆解',
      column: 1,
      row: 0,
      initialData: {
        script,
        scenes,
        prompt: sceneSummary || script,
        params: {
          mode: 'storyboard',
          processingMode: 'sequence',
          script,
          scenes,
        },
        ...sharedMeta,
      },
    },
    {
      stage: 'image-storyboard',
      nodeType: 'aiImage',
      label: '图片分镜',
      column: 2,
      row: 0,
      initialData: {
        prompt: primaryPrompt,
        params: {
          workspace: 'studio',
          mode: 'generate',
          generationMode: 'text_to_image',
          aspectRatio: '16:9',
          prompt: primaryPrompt,
        },
        ...sharedMeta,
      },
    },
    {
      stage: 'video-storyboard',
      nodeType: 'aiVideo',
      label: '视频分镜',
      column: 3,
      row: 0,
      initialData: {
        prompt: primaryPrompt,
        params: {
          generationMode: 'image_to_video',
          aspectRatio: '16:9',
          duration: scenes[0]?.duration || 4,
          prompt: primaryPrompt,
        },
        ...sharedMeta,
      },
    },
    {
      stage: 'clip-output',
      nodeType: 'output',
      label: '成片交付',
      column: 4,
      row: 0,
      initialData: {
        mediaType: 'video',
        isExpanded: true,
        clipTarget: 'aiclipping',
        ...sharedMeta,
      },
    },
  ];
}

function nodesOverlap(a: Node, b: Node): boolean {
  const aSize = getCanvasNodeDimensionsFromNode(a);
  const bSize = getCanvasNodeDimensionsFromNode(b);
  const padding = 24;
  return (
    a.position.x < b.position.x + bSize.width + padding &&
    a.position.x + aSize.width + padding > b.position.x &&
    a.position.y < b.position.y + bSize.height + padding &&
    a.position.y + aSize.height + padding > b.position.y
  );
}

function chainOverlapsExisting(createdNodes: Node[], existingNodes: Node[]): boolean {
  return createdNodes.some((node) =>
    existingNodes.some((existing) => nodesOverlap(node, existing))
  );
}

function shiftChainToAvailableSpace(
  createdNodes: Node[],
  existingNodes: Node[],
  rowStep: number
): Node[] {
  let shiftedNodes = createdNodes;
  for (let attempt = 0; attempt < 18; attempt += 1) {
    if (!chainOverlapsExisting(shiftedNodes, existingNodes)) return shiftedNodes;
    shiftedNodes = createdNodes.map((node) => ({
      ...node,
      position: {
        x: node.position.x,
        y: node.position.y + (attempt + 1) * rowStep,
      },
    }));
  }
  return shiftedNodes;
}

function createChainEdges(sourceNodeId: string, stageToId: Record<ChainStage, string>): Edge[] {
  const specs: ChainEdgeSpec[] = [
    { targetStage: 'role-analysis', sourceHandle: 'script', targetHandle: 'promptInput' },
    { targetStage: 'scene-analysis', sourceHandle: 'scenes', targetHandle: 'promptInput' },
    { targetStage: 'shot-director', sourceHandle: 'scenes', targetHandle: 'scriptInput' },
    {
      sourceStage: 'shot-director',
      targetStage: 'image-storyboard',
      sourceHandle: 'output',
      targetHandle: 'input',
    },
    {
      sourceStage: 'image-storyboard',
      targetStage: 'video-storyboard',
      sourceHandle: 'output',
      targetHandle: 'input',
    },
    {
      sourceStage: 'video-storyboard',
      targetStage: 'video-compose',
      sourceHandle: 'output',
      targetHandle: 'video',
    },
    {
      sourceStage: 'video-compose',
      targetStage: 'clip-output',
      sourceHandle: 'output',
      targetHandle: 'video',
    },
  ];

  return specs.map((spec, index) => {
    const source = spec.sourceStage ? stageToId[spec.sourceStage] : sourceNodeId;
    const target = stageToId[spec.targetStage];
    return {
      id: `edge-${source}-${target}-${Date.now()}-${index}`,
      source,
      sourceHandle: spec.sourceHandle,
      target,
      targetHandle: spec.targetHandle,
      animated: true,
      type: 'comfyui',
    };
  });
}

export function spawnScriptWorkflowChain(
  sourceNodeId: string,
  options: SpawnScriptWorkflowChainOptions = {}
): string[] | null {
  const source = canvasStoreApi.getNodes().find((node) => node.id === sourceNodeId);
  if (!source) return null;

  const existingNodeIds = getExistingChainNodeIds(sourceNodeId);
  if (existingNodeIds.length > 0 && !options.replaceExisting) {
    focusNodes(existingNodeIds);
    toast.info('已聚焦现有剧本组合链路');
    return existingNodeIds;
  }

  if (options.replaceExisting) removeExistingChain(sourceNodeId);

  const sourceDimensions = getCanvasNodeDimensionsFromNode(source);
  const baseX = source.position.x + sourceDimensions.width + CANVAS_NODE_HORIZONTAL_GAP;
  const baseY = source.position.y;
  const columnStep = getCanvasNodeDimensions('videoInput').width + CANVAS_NODE_HORIZONTAL_GAP;
  const rowStep = getCanvasNodeDimensions('aiGenText').height + CANVAS_NODE_VERTICAL_GAP;
  const chainId = `${sourceNodeId}-${SCRIPT_WORKFLOW_ACTION_ID}`;
  const stageToId = {} as Record<ChainStage, string>;

  const specs = createChainNodeSpecs(options);
  const draftNodes: Node<Record<string, unknown>>[] = specs.map((spec) => {
    const nodeId = generateId();
    stageToId[spec.stage] = nodeId;
    return {
      id: nodeId,
      type: spec.nodeType,
      position: {
        x: baseX + spec.column * columnStep,
        y: baseY + spec.row * rowStep,
      },
      data: buildDefaultNodeData(spec.nodeType, {
        spawnedFrom: sourceNodeId,
        spawnedFromType: source.type || 'script',
        _controllerActionId: SCRIPT_WORKFLOW_ACTION_ID,
        _scriptWorkflowChainId: chainId,
        _scriptWorkflowSourceId: sourceNodeId,
        _scriptWorkflowStage: spec.stage,
        label: spec.label,
        title: spec.label,
        toolLabel: spec.label,
        ...spec.initialData,
      }),
    };
  });
  const createdNodes = shiftChainToAvailableSpace(draftNodes, canvasStoreApi.getNodes(), rowStep);

  const createdEdges = createChainEdges(sourceNodeId, stageToId);
  createdNodes.forEach((node) => canvasStoreApi.addNode(node));
  createdEdges.forEach((edge) => canvasStoreApi.addEdge(edge));

  const selectedIds = createdNodes.map((node) => node.id as string);
  focusNodes(selectedIds.slice(0, Math.min(selectedIds.length, CHAIN_COLUMNS)));
  syncDownstreamFromNode(sourceNodeId);
  toast.success('已创建剧本组合子节点链路');
  return selectedIds;
}
