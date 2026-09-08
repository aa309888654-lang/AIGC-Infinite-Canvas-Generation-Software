import type { Node, Edge } from '@xyflow/react';

/**
 * 节点绑定状态类型
 */
export interface BindingStatus {
  hasValidBinding: boolean;
  boundPromptNodeId: string | null;
  boundPromptContent: string;
  bindingErrors: BindingError[];
  hasImageBinding: boolean;
  imageCount: number;
}

/**
 * 绑定错误类型
 */
export interface BindingError {
  type: 'missing_prompt' | 'invalid_connection' | 'empty_prompt';
  message: string;
  suggestion: string;
}

/**
 * 验证节点绑定状态
 * @param nodeId 目标节点ID
 * @param nodes 所有节点
 * @param edges 所有边
 * @returns 绑定状态
 */
export function validateNodeBinding(
  nodeId: string,
  nodes: Node[],
  edges: Edge[]
): BindingStatus {
  const status: BindingStatus = {
    hasValidBinding: false,
    boundPromptNodeId: null,
    boundPromptContent: '',
    bindingErrors: [],
    hasImageBinding: false,
    imageCount: 0,
  };

  const safeEdges = edges || [];
  const safeNodes = nodes || [];
  const inputEdges = safeEdges.filter((e) => e.target === nodeId);

  if (inputEdges.length === 0) {
    status.bindingErrors.push({
      type: 'missing_prompt',
      message: '未连接提示词节点',
      suggestion: '请从提示词节点拖拽连接到本节点的左侧输入端口',
    });
    return status;
  }

  let foundPromptNode = false;

  for (const edge of inputEdges) {
    const sourceNode = safeNodes.find((n) => n.id === edge.source);
    if (!sourceNode) {
      continue;
    }

    // 节点类型存储在 sourceNode.type
    const sourceType = sourceNode.type;
    const sourceLabel = (sourceNode.data?.label as string || '').toLowerCase();
    const sourceData = sourceNode.data || {};
    const sourceDataType = (sourceData.type as string || '').toLowerCase();
    const isPromptHandle = edge.sourceHandle === 'prompt' || edge.targetHandle === 'prompt';

    // 检查是否是提示词节点（支持多种匹配方式）
    const isPromptNode = isPromptHandle ||
                         sourceType === 'prompt' || 
                         sourceDataType === 'prompt' ||
                         sourceLabel.includes('prompt') ||
                         sourceLabel.includes('提示词') ||
                         sourceLabel.includes('text') ||
                         sourceLabel.includes('输入');

    if (isPromptNode) {
      foundPromptNode = true;
      
      // 直接从 sourceNode.data 获取提示词，尝试多种属性
      // 获取提示词 - 确保是字符串类型
      const prompt = String(sourceData.prompt || sourceData.outputText || sourceData.cameraPrompt || sourceData.text || sourceData.content || sourceData.value || sourceData.localPrompt || sourceData.textContent || '');

      if (!prompt || prompt.trim() === '') {
        status.bindingErrors.push({
          type: 'empty_prompt',
          message: '提示词为空',
          suggestion: '请在提示词节点中输入有效的提示词内容',
        });
      } else {
        status.hasValidBinding = true;
        status.boundPromptNodeId = sourceNode.id;
        status.boundPromptContent = prompt;
      }
    }
  }

  // 图片/视频输入节点类型（含部分视频节点，因它们也可提供首帧/参考图）
  const imageNodeTypes = ['aiImage', 'imageGen', 'unifiedImageStudio', 'aicgImageGen', 'imageInput', 'doubaoSeedream', 'doubaoVideoGen', 'aiVideo', 'advancedVideoGen', 'aicgVideoGen', 'videoGen', 'imageToVideo', 'director3D'];
  
  const imageEdges = inputEdges.filter((edge) => {
    const sourceNode = safeNodes.find((n) => n.id === edge.source);
    if (!sourceNode) return false;
    const sourceType = sourceNode.type;
    const sourceDataType = (sourceNode.data?.type as string || '').toLowerCase();
    return imageNodeTypes.includes(sourceType as string) || imageNodeTypes.includes(sourceDataType);
  });
  
  if (imageEdges.length > 0) {
    const imageUrls: string[] = [];
    for (const edge of imageEdges) {
      const sourceNode = safeNodes.find((n) => n.id === edge.source);
      if (sourceNode) {
        const sourceData = sourceNode.data as Record<string, unknown>;
        const task = sourceData?.task as Record<string, unknown> | undefined;
        const url = (task?.resultUrl || sourceData?.outputImageUrl || sourceData?.imageUrl || sourceData?.resultUrl || sourceData?.gridImageUrl || sourceData?.coverImageUrl || sourceData?.panoramaImageUrl || sourceData?.url || sourceData?.output || '') as string;
        if (url && typeof url === 'string' && url.trim() !== '') {
          imageUrls.push(url);
        }
      }
    }
    status.imageCount = imageUrls.length;
    status.hasImageBinding = imageUrls.length > 0;
  }

  if (!foundPromptNode) {
    status.bindingErrors.push({
      type: 'invalid_connection',
      message: '未连接到提示词节点',
      suggestion: '请确保连接到的是提示词(Prompt)节点，而不是其他类型的节点',
    });
  }

  return status;
}

/**
 * 获取节点的输入绑定信息
 * @param nodeId 节点ID
 * @param edges 所有边
 * @returns 输入绑定信息
 */
export function getInputBindings(
  nodeId: string,
  edges: Edge[]
): Edge[] {
  const safeEdges = edges || [];
  return safeEdges.filter((e) => e.target === nodeId);
}

/**
 * 检查提示词节点是否有输出绑定
 * @param nodeId 提示词节点ID
 * @param edges 所有边
 * @returns 是否有输出绑定
 */
export function hasOutputBindings(
  nodeId: string,
  edges: Edge[]
): boolean {
  const safeEdges = edges || [];
  return safeEdges.some((e) => e.source === nodeId);
}

/**
 * 获取提示词节点绑定的所有目标节点
 * @param nodeId 提示词节点ID
 * @param nodes 所有节点
 * @param edges 所有边
 * @returns 目标节点列表
 */
export function getBoundTargetNodes(
  nodeId: string,
  nodes: Node[],
  edges: Edge[]
): Node[] {
  const safeEdges = edges || [];
  const safeNodes = nodes || [];
  const outputEdges = safeEdges.filter((e) => e.source === nodeId);
  return outputEdges
    .map((e) => safeNodes.find((n) => n.id === e.target))
    .filter((n): n is Node => n !== undefined);
}

/**
 * 格式化绑定状态显示文本
 * @param status 绑定状态
 * @returns 显示文本
 */
export function formatBindingStatusText(status: BindingStatus): string {
  if (status.hasValidBinding) {
    const preview = status.boundPromptContent.length > 30
      ? status.boundPromptContent.slice(0, 30) + '...'
      : status.boundPromptContent;
    return `已绑定: "${preview}"`;
  } else if (status.bindingErrors.length > 0) {
    return status.bindingErrors[0].message;
  }
  return '等待连接';
}

/**
 * 获取绑定状态颜色
 * @param status 绑定状态
 * @returns 颜色代码
 */
export function getBindingStatusColor(status: BindingStatus): string {
  if (status.hasValidBinding) {
    return '#28A745'; // 绿色
  } else if (status.bindingErrors.length > 0) {
    const errorType = status.bindingErrors[0].type;
    if (errorType === 'empty_prompt') {
      return '#FFC107'; // 黄色
    }
    return '#DC3545'; // 红色
  }
  return '#6C757D'; // 灰色
}

/**
 * 检查两个节点之间是否存在有效连接
 * @param sourceId 源节点ID
 * @param targetId 目标节点ID
 * @param edges 所有边
 * @returns 是否存在有效连接
 */
export function hasValidConnection(
  sourceId: string,
  targetId: string,
  edges: Edge[]
): boolean {
  const safeEdges = edges || [];
  return safeEdges.some(
    (e) => e.source === sourceId && e.target === targetId
  );
}
