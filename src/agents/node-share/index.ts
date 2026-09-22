import type { Agent} from '@/agents/types';

/**
 * 节点分享 Agent
 * 负责节点的导入导出、社区分享、模板管理等
 */

export interface NodeShareConfig {
  shareType: 'local' | 'community' | 'template';
  visibility: 'private' | 'public' | 'unlisted';
  category: string;
  tags: string[];
}

export interface SharedNode {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  nodeType: string;
  config: Record<string, unknown>;
  thumbnail?: string;
  downloads: number;
  likes: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
  category: string;
  tags: string[];
  isVerified: boolean;
  license: string;
}

export interface NodeTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  nodes: SharedNode[];
  edges: Array<{ source: string; target: string; sourceHandle?: string; targetHandle?: string }>;
  variables: Record<string, unknown>;
  thumbnail?: string;
  usageCount: number;
  rating: number;
  isOfficial: boolean;
}

export interface ShareResult {
  success: boolean;
  shareId?: string;
  shareUrl?: string;
  error?: string;
}

export const NODE_CATEGORIES = [
  { id: 'video-generation', name: '视频生成', icon: '🎬', description: 'AI视频生成节点' },
  { id: 'image-generation', name: '图片生成', icon: '🖼️', description: 'AI图片生成节点' },
  { id: 'audio', name: '音频处理', icon: '🎵', description: '音频合成和处理节点' },
  { id: 'editing', name: '视频剪辑', icon: '✂️', description: '视频编辑和剪辑节点' },
  { id: 'effects', name: '特效处理', icon: '✨', description: '视觉特效节点' },
  { id: 'template', name: '模板流程', icon: '📋', description: '完整工作流模板' },
  { id: 'utility', name: '工具节点', icon: '🔧', description: '辅助工具节点' },
  { id: 'experimental', name: '实验性', icon: '🔬', description: '实验性功能节点' },
] as const;

export const NODE_LICENSES = [
  { id: 'mit', name: 'MIT License', description: '允许自由使用和修改' },
  { id: 'apache-2.0', name: 'Apache 2.0', description: '允许商业使用' },
  { id: 'gpl-3.0', name: 'GPL 3.0', description: '要求开源衍生作品' },
  { id: 'cc-by-4.0', name: 'CC BY 4.0', description: '需署名使用' },
  { id: 'cc-by-sa-4.0', name: 'CC BY-SA 4.0', description: '需署名且相同方式分享' },
  { id: 'proprietary', name: '专有许可', description: '不可自由使用' },
] as const;

export const createNodeShareAgent = (): Agent => ({
  id: 'node-share',
  name: '节点分享 Agent',
  description: '专业的节点分享和社区交流专家，支持节点导入导出、模板管理、社区分享、节点搜索等功能',
  version: '1.0.0',
  capabilities: [
    {
      type: 'export',
      description: '导出节点为可分享格式',
      features: ['json', 'base64', 'file'],
    },
    {
      type: 'import',
      description: '导入和解析外部节点',
      features: ['json', 'file', 'url', 'clipboard'],
    },
    {
      type: 'share',
      description: '分享节点到社区',
      features: ['publish', 'draft', 'update'],
    },
    {
      type: 'browse',
      description: '浏览和搜索社区节点',
      features: ['search', 'filter', 'sort', 'preview'],
    },
    {
      type: 'template',
      description: '创建和使用工作流模板',
      features: ['create', 'import', 'fork', 'customize'],
    },
    {
      type: 'collaboration',
      description: '节点协作和版本管理',
      features: ['version', 'fork', 'merge'],
    },
  ],
  tools: [
    'export-node',
    'import-node',
    'share-node',
    'browse-community',
    'search-nodes',
    'rate-node',
    'fork-template',
    'create-template',
    'version-control',
  ],
  nodeTypes: [],
  execute: async (input, _context) => {
    const { type, params } = input;

    switch (type) {
      case 'export':
        return exportNode(params);
      case 'import':
        return importNode(params);
      case 'share':
        return shareToCommunity(params);
      case 'browse':
        return browseCommunity(params);
      case 'search':
        return searchNodes(params);
      case 'rate':
        return rateNode(params);
      case 'fork':
        return forkTemplate(params);
      case 'create-template':
        return createTemplate(params);
      case 'version':
        return getVersionHistory(params);
      default:
        throw new Error(`Unknown node share operation: ${type}`);
    }
  },
});

// 内部实现函数
async function exportNode(params: Record<string, unknown>) {
  const { nodeId, format, includeMetadata } = params;

  const nodeData = await fetchNodeData(nodeId as string);
  if (!nodeData) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  let exportData: string;

  switch (format) {
    case 'json':
      exportData = JSON.stringify(nodeData, null, 2);
      break;
    case 'base64': {
      const jsonStr = JSON.stringify(nodeData);
      exportData = btoa(unescape(encodeURIComponent(jsonStr)));
      break;
    }
    case 'file':
      exportData = JSON.stringify(nodeData, null, 2);
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  return {
    success: true,
    data: exportData,
    format,
    nodeId,
    nodeName: nodeData.name || nodeData.label || 'Untitled',
    metadata: includeMetadata ? {
      exportedAt: new Date().toISOString(),
      version: nodeData.version || '1.0.0',
      author: nodeData.author || 'Unknown',
    } : undefined,
  };
}

async function importNode(params: Record<string, unknown>) {
  const { data, source, validate, mergeStrategy } = params;

  let nodeData: Record<string, unknown>;

  // 解析输入数据
  if (source === 'clipboard') {
    try {
      nodeData = JSON.parse(data as string);
    } catch {
      // 尝试 base64 解码
      try {
        const decoded = decodeURIComponent(escape(atob(data as string)));
        nodeData = JSON.parse(decoded);
      } catch {
        throw new Error('Invalid clipboard data format');
      }
    }
  } else if (source === 'url') {
    const response = await fetch(data as string);
    if (!response.ok) {
      throw new Error(`Failed to fetch node data: ${response.status}`);
    }
    nodeData = await response.json();
  } else {
    try {
      nodeData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch {
      throw new Error('Invalid JSON data');
    }
  }

  // 验证节点数据
  if (validate) {
    const validation = validateNodeData(nodeData);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
        validationErrors: validation.errors,
      };
    }
  }

  // 合并策略处理
  if (mergeStrategy === 'replace') {
    // 直接替换
  } else if (mergeStrategy === 'merge') {
    // 合并配置
    nodeData = mergeNodeData(nodeData, params.existingData as Record<string, unknown> | undefined);
  } else if (mergeStrategy === 'skip') {
    // 跳过已存在
    if (await nodeExists(String(nodeData.id || nodeData.nodeId))) {
      return {
        success: false,
        error: 'Node already exists',
        existing: true,
      };
    }
  }

  return {
    success: true,
    nodeData,
    nodeName: nodeData.name || nodeData.label || 'Imported Node',
    warnings: validate ? validateNodeData(nodeData).warnings : [],
  };
}

async function shareToCommunity(params: Record<string, unknown>) {
  const { nodeId, name, description, category, tags, visibility, license } = params;

  const nodeData = await fetchNodeData(nodeId as string);
  if (!nodeData) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const shareData = {
    name: name || nodeData.name || nodeData.label,
    description: description || '',
    category: category || 'utility',
    tags: tags || [],
    visibility: visibility || 'public',
    license: license || 'mit',
    data: nodeData,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    author: params.author || 'Anonymous',
  };

  const response = await fetch('/api/nodes/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(shareData),
  });

  if (!response.ok) {
    throw new Error(`Share failed: ${response.status}`);
  }

  const result = await response.json();

  return {
    success: true,
    shareId: result.id,
    shareUrl: `/nodes/share/${result.id}`,
    nodeName: shareData.name,
  };
}

async function browseCommunity(params: Record<string, unknown>) {
  const { category = '', sortBy = 'popular', page = 1, pageSize = 20, filter } = params;

  const queryParams = new URLSearchParams({
    category: String(category),
    sort: String(sortBy),
    page: String(page),
    limit: String(pageSize),
    ...(filter ? { filter: JSON.stringify(filter) } : {}),
  });

  const response = await fetch(`/api/nodes/community?${queryParams}`);
  const data = await response.json();

  return {
    success: true,
    nodes: data.nodes as SharedNode[],
    total: data.total,
    page: Number(page),
    pageSize: Number(pageSize),
    hasMore: data.total > Number(page) * Number(pageSize),
  };
}

async function searchNodes(params: Record<string, unknown>) {
  const { query = '', categories, tags, minRating, sortBy = 'relevance' } = params as Record<string, string | number | string[]>;

  const searchParams = new URLSearchParams({
    q: String(query),
  });

  if (Array.isArray(categories) && categories.length) {
    searchParams.set('categories', (categories as string[]).join(','));
  }
  if (Array.isArray(tags) && tags.length) {
    searchParams.set('tags', (tags as string[]).join(','));
  }
  if (minRating) {
    searchParams.set('minRating', String(minRating));
  }
  searchParams.set('sort', String(sortBy));

  const response = await fetch(`/api/nodes/search?${searchParams}`);
  const data = await response.json();

  return {
    success: true,
    results: data.results as SharedNode[],
    total: data.total,
    query: String(query),
  };
}

async function rateNode(params: Record<string, unknown>) {
  const { nodeId, rating, comment } = params;

  const response = await fetch(`/api/nodes/${nodeId}/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, comment }),
  });

  const data = await response.json();

  return {
    success: true,
    nodeId,
    newRating: data.newRating,
    totalRatings: data.totalRatings,
  };
}

async function forkTemplate(params: Record<string, unknown>) {
  const { templateId, newName, modifications } = params;

  const response = await fetch(`/api/templates/${templateId}/fork`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newName, modifications }),
  });

  const data = await response.json();

  return {
    success: true,
    forkedTemplateId: data.id,
    forkedTemplateName: data.name || newName,
    changes: data.changes,
  };
}

async function createTemplate(params: Record<string, unknown>) {
  const { name, description, nodes, edges, variables, thumbnail, category, tags } = params;

  const templateData = {
    name: name || 'Untitled Template',
    description: description || '',
    nodes: nodes || [],
    edges: edges || [],
    variables: variables || {},
    thumbnail: thumbnail || null,
    category: category || 'template',
    tags: tags || [],
    createdAt: new Date().toISOString(),
  };

  const response = await fetch('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(templateData),
  });

  const data = await response.json();

  return {
    success: true,
    templateId: data.id,
    templateName: templateData.name,
    templateUrl: `/templates/${data.id}`,
  };
}

async function getVersionHistory(params: Record<string, unknown>) {
  const { nodeId } = params;

  const response = await fetch(`/api/nodes/${nodeId}/versions`);
  const data = await response.json();

  return {
    success: true,
    nodeId,
    versions: data.versions || [],
    currentVersion: data.currentVersion,
  };
}

// 辅助函数
async function fetchNodeData(nodeId: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`/api/nodes/${nodeId}`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}

function validateNodeData(data: Record<string, unknown>): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data.type && !data.nodeType) {
    errors.push('Missing node type');
  }

  if (!data.id && !data.nodeId) {
    warnings.push('Node ID will be generated');
  }

  if (!data.name && !data.label && !data.title) {
    warnings.push('Node name not specified');
  }

  const params = data.params || data.parameters;
  if (params && typeof params !== 'object') {
    errors.push('Invalid parameters format');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function mergeNodeData(newData: Record<string, unknown>, existingData?: Record<string, unknown>): Record<string, unknown> {
  if (!existingData) return newData;

  return {
    ...existingData,
    ...newData,
    params: {
      ...(existingData.params as Record<string, unknown> || {}),
      ...(newData.params as Record<string, unknown> || {}),
    },
  };
}

async function nodeExists(nodeId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/nodes/${nodeId}/exists`);
    const data = await response.json();
    return data.exists;
  } catch {
    return false;
  }
}

export default createNodeShareAgent;
