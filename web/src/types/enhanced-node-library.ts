import { NodeTypeDefinition, NodeCategory } from '@/types/node-system';

export interface NodeFavorite {
  nodeId: string;
  addedAt: number;
  usageCount: number;
  lastUsedAt: number;
}

export interface NodeHistoryItem {
  nodeId: string;
  usedAt: number;
  workflowId?: string;
}

export interface NodeUsageStats {
  nodeId: string;
  totalUsage: number;
  lastUsed: number | null;
  averageExecutionTime?: number;
  successRate: number;
}

export interface EnhancedNodeTemplate {
  id: string;
  name: string;
  description: string;
  category: NodeCategory;
  thumbnail?: string;
  nodes: Array<{
    type: string;
    position: { x: number; y: number };
    params?: Record<string, unknown>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>;
  tags: string[];
  isPreset: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface NodeTag {
  id: string;
  name: string;
  color: string;
  nodeIds: string[];
}

export interface EnhancedNodeTypeDefinition extends NodeTypeDefinition {
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  relatedNodes: string[];
  isExperimental?: boolean;
  isDeprecated?: boolean;
}

export interface NodeLibraryConfig {
  showFavoritesFirst: boolean;
  showRecentHistory: boolean;
  showUsageStats: boolean;
  showNodePreview: boolean;
  autoSaveTemplates: boolean;
  maxHistorySize: number;
}

export const DEFAULT_NODE_LIBRARY_CONFIG: NodeLibraryConfig = {
  showFavoritesFirst: true,
  showRecentHistory: true,
  showUsageStats: true,
  showNodePreview: true,
  autoSaveTemplates: true,
  maxHistorySize: 50,
};

export const DIFFICULTY_LEVELS = {
  beginner: { label: '入门', color: '#10B981' },
  intermediate: { label: '进阶', color: '#00E5FF' },
  advanced: { label: '高级', color: '#EF4444' },
};

export const PRESET_TEMPLATES: EnhancedNodeTemplate[] = [
  {
    id: 'doubao-seedance-2-express',
    name: 'Seedance 2.0 极速图生视频',
    description: '极速5秒内生成高质量图生视频',
    category: 'video',
    tags: ['2.0 Fast', '图生视频', '极速'],
    isPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    nodes: [
      { type: 'imageInput', position: { x: 0, y: 0 } },
      { type: 'prompt', position: { x: 0, y: 456 } },
      { 
        type: 'aiVideo',
        position: { x: 644, y: 0 },
        params: { 
          provider: 'doubao',
          modelProvider: 'doubao',
          modelId: 'doubao-seedance-2-0-fast',
          generationMode: 'image_to_video',
          duration: 5,
          aspectRatio: '16:9'
        }
      },
      { type: 'output', position: { x: 1288, y: 0 } }
    ],
    edges: [
      { source: 'imageInput', target: 'aiVideo', sourceHandle: 'imageOutput', targetHandle: 'firstFrame' },
      { source: 'prompt', target: 'aiVideo', sourceHandle: 'promptOutput', targetHandle: 'prompt' },
      { source: 'aiVideo', target: 'output', sourceHandle: 'video', targetHandle: 'video' }
    ]
  },
  {
    id: 'workflow-text-image-video',
    name: '文本 → 图片 → 视频',
    description: '先生成静态图再转动态视频的完整流程',
    category: 'video',
    tags: ['基础流', '自动化', '完整流程'],
    isPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    nodes: [
      { type: 'prompt', position: { x: 0, y: 0 } },
      { 
        type: 'aiImage', 
        position: { x: 644, y: 0 },
        params: { 
          mode: 'generate', 
          modelProvider: 'doubao', 
          modelId: 'doubao-seedream-5.0-lite',
          aspectRatio: '16:9'
        }
      },
      {
        type: 'aiVideo',
        position: { x: 1288, y: 0 },
        params: {
          provider: 'doubao',
          modelProvider: 'doubao',
          modelId: 'google_omni',
          generationMode: 'image_to_video',
          duration: 10
        }
      },
      { type: 'output', position: { x: 1932, y: 0 } }
    ],
    edges: [
      { source: 'prompt', target: 'aiImage', sourceHandle: 'promptOutput', targetHandle: 'prompt' },
      { source: 'aiImage', target: 'aiVideo', sourceHandle: 'output', targetHandle: 'firstFrame' },
      { source: 'aiVideo', target: 'output', sourceHandle: 'video', targetHandle: 'video' }
    ]
  },
  {
    id: 'minimax-character-consistent',
    name: 'MiniMax 角色一致',
    description: '保持人脸与特征高度一致的图像生成',
    category: 'image',
    tags: ['角色一致', '图生图', '专业'],
    isPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    nodes: [
      { type: 'imageInput', position: { x: 0, y: 0 } },
      { type: 'prompt', position: { x: 0, y: 456 } },
      {
        type: 'aiImage',
        position: { x: 644, y: 0 },
        params: {
          mode: 'generate',
          modelProvider: 'doubao',
          modelId: 'doubao-seedream-5-0-pro',
          aspectRatio: '3:4'
        }
      },
      { type: 'output', position: { x: 1288, y: 0 } }
    ],
    edges: [
      { source: 'imageInput', target: 'aiImage', sourceHandle: 'imageOutput', targetHandle: 'image' },
      { source: 'prompt', target: 'aiImage', sourceHandle: 'promptOutput', targetHandle: 'prompt' },
      { source: 'aiImage', target: 'output', sourceHandle: 'output', targetHandle: 'image' }
    ]
  }
];

export const NODE_TAGS: NodeTag[] = [
  { id: 'essential', name: '基础', color: '#10B981', nodeIds: ['prompt', 'imageInput', 'output'] },
  { id: 'creative', name: '创意', color: '#00E5FF', nodeIds: ['aiImage', 'aiVideo'] },
  { id: 'professional', name: '专业', color: '#00E5FF', nodeIds: ['aiImage', 'aiVideo'] },
];
