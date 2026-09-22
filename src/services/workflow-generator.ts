export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  params?: Record<string, unknown>;
}

export interface WorkflowConnection {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface GeneratedWorkflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  estimatedDuration?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const WORKFLOW_TEMPLATES: Record<string, GeneratedWorkflow> = {
  birthday: {
    id: 'birthday-video',
    name: '生日祝福视频',
    description: '生成温馨的生日祝福视频',
    difficulty: 'easy',
    nodes: [
      { id: 'text-1', type: 'text', label: '文本输入', position: { x: 100, y: 100 } },
      { id: 'prompt-1', type: 'prompt', label: '提示词优化', position: { x: 350, y: 100 }, params: { style: '温暖,柔和' } },
      { id: 'image-1', type: 'image', label: '图片生成', position: { x: 600, y: 100 } },
      { id: 'video-1', type: 'video', label: '视频生成', position: { x: 850, y: 100 } },
      { id: 'output-1', type: 'output', label: '输出', position: { x: 1100, y: 100 } },
    ],
    connections: [
      { id: 'conn-1', source: 'text-1', target: 'prompt-1' },
      { id: 'conn-2', source: 'prompt-1', target: 'image-1' },
      { id: 'conn-3', source: 'image-1', target: 'video-1' },
      { id: 'conn-4', source: 'video-1', target: 'output-1' },
    ],
    estimatedDuration: '3-5分钟',
  },
  product: {
    id: 'product-showcase',
    name: '产品展示视频',
    description: '生成专业的电商产品展示',
    difficulty: 'medium',
    nodes: [
      { id: 'image-1', type: 'image', label: '产品图片输入', position: { x: 100, y: 100 } },
      { id: 'analyze-1', type: 'analyze', label: '产品分析', position: { x: 350, y: 100 } },
      { id: 'bg-1', type: 'background', label: '背景处理', position: { x: 600, y: 100 } },
      { id: 'video-1', type: 'video', label: '视频生成', position: { x: 850, y: 100 } },
      { id: 'music-1', type: 'music', label: '背景音乐', position: { x: 600, y: 250 } },
      { id: 'output-1', type: 'output', label: '导出', position: { x: 1100, y: 175 } },
    ],
    connections: [
      { id: 'conn-1', source: 'image-1', target: 'analyze-1' },
      { id: 'conn-2', source: 'analyze-1', target: 'bg-1' },
      { id: 'conn-3', source: 'bg-1', target: 'video-1' },
      { id: 'conn-4', source: 'music-1', target: 'video-1' },
      { id: 'conn-5', source: 'video-1', target: 'output-1' },
    ],
    estimatedDuration: '5-8分钟',
  },
  social: {
    id: 'social-media',
    name: '社交媒体内容',
    description: '快速生成社交媒体短视频',
    difficulty: 'easy',
    nodes: [
      { id: 'idea-1', type: 'text', label: '内容创意', position: { x: 100, y: 100 } },
      { id: 'script-1', type: 'script', label: '脚本生成', position: { x: 350, y: 100 } },
      { id: 'image-1', type: 'image', label: '配图生成', position: { x: 600, y: 50 } },
      { id: 'audio-1', type: 'tts', label: '配音', position: { x: 600, y: 150 } },
      { id: 'video-1', type: 'video', label: '视频合成', position: { x: 850, y: 100 } },
      { id: 'output-1', type: 'output', label: '发布', position: { x: 1100, y: 100 } },
    ],
    connections: [
      { id: 'conn-1', source: 'idea-1', target: 'script-1' },
      { id: 'conn-2', source: 'idea-1', target: 'image-1' },
      { id: 'conn-3', source: 'script-1', target: 'audio-1' },
      { id: 'conn-4', source: 'image-1', target: 'video-1' },
      { id: 'conn-5', source: 'audio-1', target: 'video-1' },
      { id: 'conn-6', source: 'video-1', target: 'output-1' },
    ],
    estimatedDuration: '2-4分钟',
  },
  education: {
    id: 'education-video',
    name: '教育视频',
    description: '制作知识讲解类视频',
    difficulty: 'medium',
    nodes: [
      { id: 'topic-1', type: 'text', label: '主题输入', position: { x: 100, y: 100 } },
      { id: 'outline-1', type: 'outline', label: '大纲生成', position: { x: 350, y: 100 } },
      { id: 'content-1', type: 'content', label: '内容填充', position: { x: 600, y: 100 } },
      { id: 'image-1', type: 'image', label: '插图生成', position: { x: 600, y: 250 } },
      { id: 'animation-1', type: 'animation', label: '动画效果', position: { x: 850, y: 100 } },
      { id: 'tts-1', type: 'tts', label: '语音配音', position: { x: 850, y: 250 } },
      { id: 'video-1', type: 'video', label: '视频合成', position: { x: 1100, y: 175 } },
      { id: 'output-1', type: 'output', label: '导出', position: { x: 1350, y: 175 } },
    ],
    connections: [
      { id: 'conn-1', source: 'topic-1', target: 'outline-1' },
      { id: 'conn-2', source: 'outline-1', target: 'content-1' },
      { id: 'conn-3', source: 'content-1', target: 'image-1' },
      { id: 'conn-4', source: 'content-1', target: 'animation-1' },
      { id: 'conn-5', source: 'content-1', target: 'tts-1' },
      { id: 'conn-6', source: 'animation-1', target: 'video-1' },
      { id: 'conn-7', source: 'tts-1', target: 'video-1' },
      { id: 'conn-8', source: 'video-1', target: 'output-1' },
    ],
    estimatedDuration: '8-15分钟',
  },
  ecommerce: {
    id: 'ecommerce-main',
    name: '电商主图制作',
    description: '生成吸引眼球的电商主图',
    difficulty: 'easy',
    nodes: [
      { id: 'product-1', type: 'image', label: '产品图', position: { x: 100, y: 100 } },
      { id: 'style-1', type: 'style', label: '风格选择', position: { x: 100, y: 250 } },
      { id: 'enhance-1', type: 'enhance', label: '图像增强', position: { x: 350, y: 175 } },
      { id: 'background-1', type: 'background', label: '背景生成', position: { x: 600, y: 175 } },
      { id: 'text-1', type: 'text', label: '文字添加', position: { x: 600, y: 325 } },
      { id: 'output-1', type: 'output', label: '导出优化', position: { x: 850, y: 250 } },
    ],
    connections: [
      { id: 'conn-1', source: 'product-1', target: 'enhance-1' },
      { id: 'conn-2', source: 'style-1', target: 'enhance-1' },
      { id: 'conn-3', source: 'enhance-1', target: 'background-1' },
      { id: 'conn-4', source: 'background-1', target: 'output-1' },
      { id: 'conn-5', source: 'text-1', target: 'output-1' },
    ],
    estimatedDuration: '2-3分钟',
  },
};

export class WorkflowGeneratorService {
  private static instance: WorkflowGeneratorService;

  private constructor() { /* noop */ }

  public static getInstance(): WorkflowGeneratorService {
    if (!WorkflowGeneratorService.instance) {
      WorkflowGeneratorService.instance = new WorkflowGeneratorService();
    }
    return WorkflowGeneratorService.instance;
  }

  public getAllTemplates(): GeneratedWorkflow[] {
    return Object.values(WORKFLOW_TEMPLATES);
  }

  public getTemplateById(id: string): GeneratedWorkflow | undefined {
    return WORKFLOW_TEMPLATES[id];
  }

  public matchTemplate(requirement: string): GeneratedWorkflow[] {
    const lowerReq = requirement.toLowerCase();
    const matchedTemplates: GeneratedWorkflow[] = [];

    const keywords: Record<string, string[]> = {
      birthday: ['生日', '祝福', 'birthday', 'celebration'],
      product: ['产品', '商品', '展示', 'product', 'showcase', '电商'],
      social: ['社交', '短视频', '抖音', '快手', 'social', 'tiktok'],
      education: ['教育', '教程', '讲解', 'education', 'tutorial', '知识'],
      ecommerce: ['主图', '电商', '淘宝', '天猫', 'main image', 'ecommerce'],
    };

    for (const [templateId, words] of Object.entries(keywords)) {
      if (words.some(word => lowerReq.includes(word))) {
        const template = WORKFLOW_TEMPLATES[templateId];
        if (template) {
          matchedTemplates.push(template);
        }
      }
    }

    return matchedTemplates;
  }

  public parseAIResponse(response: string): GeneratedWorkflow | null {
    try {
      if (response.includes('工作流名称') && response.includes('节点')) {
        return this.extractWorkflowFromText(response);
      }
      return null;
    } catch (error) {
      console.error('[WorkflowGenerator] 解析AI响应失败:', error);
      return null;
    }
  }

  private extractWorkflowFromText(text: string): GeneratedWorkflow {
    let name = 'AI生成工作流';
    const nodes: WorkflowNode[] = [];
    let nodeIdCounter = 1;

    const workflowSection = text.match(/工作流名称[：:]\s*(.+)/i);
    if (workflowSection) {
      name = workflowSection[1].trim();
    }

    const nodeMatches = text.match(/(\d+)[.、]\s*([^\n]+?)(?=\s*[-→→]\s*|$)/g);
    if (nodeMatches) {
      nodeMatches.forEach((match, index) => {
        const cleanMatch = match.replace(/^\d+[.、]\s*/, '').trim();
        const nodeType = this.inferNodeType(cleanMatch);
        
        nodes.push({
          id: `ai-node-${nodeIdCounter++}`,
          type: nodeType,
          label: cleanMatch,
          position: { x: 100 + index * 250, y: 150 },
        });
      });
    }

    const connections: WorkflowConnection[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      connections.push({
        id: `ai-conn-${i + 1}`,
        source: nodes[i].id,
        target: nodes[i + 1].id,
      });
    }

    return {
      id: `ai-generated-${Date.now()}`,
      name,
      description: '由AI自动生成',
      nodes,
      connections,
      difficulty: nodes.length > 5 ? 'hard' : nodes.length > 3 ? 'medium' : 'easy',
    };
  }

  private inferNodeType(label: string): string {
    const lowerLabel = label.toLowerCase();
    
    if (lowerLabel.includes('文本') || lowerLabel.includes('输入')) return 'text';
    if (lowerLabel.includes('图片') || lowerLabel.includes('图像')) return 'image';
    if (lowerLabel.includes('视频')) return 'video';
    if (lowerLabel.includes('提示词')) return 'prompt';
    if (lowerLabel.includes('优化') || lowerLabel.includes('增强')) return 'enhance';
    if (lowerLabel.includes('输出') || lowerLabel.includes('导出')) return 'output';
    if (lowerLabel.includes('音乐') || lowerLabel.includes('音频')) return 'music';
    if (lowerLabel.includes('语音') || lowerLabel.includes('配音')) return 'tts';
    
    return 'default';
  }

  public generateWorkflowFromRequirement(requirement: string): GeneratedWorkflow {
    const matchedTemplates = this.matchTemplate(requirement);
    
    if (matchedTemplates.length > 0) {
      return matchedTemplates[0];
    }

    return this.createCustomWorkflow(requirement);
  }

  private createCustomWorkflow(requirement: string): GeneratedWorkflow {
    return {
      id: `custom-${Date.now()}`,
      name: '自定义工作流',
      description: requirement,
      difficulty: 'medium',
      nodes: [
        {
          id: 'input-1',
          type: 'text',
          label: '需求输入',
          position: { x: 100, y: 150 },
        },
        {
          id: 'analyze-1',
          type: 'analyze',
          label: '需求分析',
          position: { x: 350, y: 150 },
        },
        {
          id: 'process-1',
          type: 'process',
          label: '处理节点',
          position: { x: 600, y: 150 },
        },
        {
          id: 'output-1',
          type: 'output',
          label: '输出结果',
          position: { x: 850, y: 150 },
        },
      ],
      connections: [
        { id: 'conn-1', source: 'input-1', target: 'analyze-1' },
        { id: 'conn-2', source: 'analyze-1', target: 'process-1' },
        { id: 'conn-3', source: 'process-1', target: 'output-1' },
      ],
    };
  }
}

export const workflowGenerator = WorkflowGeneratorService.getInstance();
