import type { AgentConfig } from '@/services/agents/agent-framework';

export type CanvasAgentRole = 'designer' | 'copywriter' | 'reviewer';

export interface CanvasAgentManifest {
  id: CanvasAgentRole;
  name: string;
  description: string;
  icon: string;
  color: string;
  llm: {
    modelId: string;
    provider: string;
    temperature?: number;
    maxTokens?: number;
  };
  systemPrompt: string;
  maxIterations?: number;
  tools?: string[];
  nodeTypes?: string[];
}

const CANVAS_AGENT_MANIFESTS: CanvasAgentManifest[] = [
  {
    id: 'designer',
    name: '设计师 Agent',
    description: '根据文案需求生成图片提示词，选择最佳模型和风格参数',
    icon: '🎨',
    color: '#8B5CF6',
    llm: {
      modelId: 'ark-code-latest',
      provider: 'deepseek-v4-flash',
      temperature: 0.7,
      maxTokens: 4096,
    },
    systemPrompt: `你是一个专业的 AI 视觉设计师。你的职责是：
1. 分析用户的创意需求
2. 生成高质量的图片提示词（英文）
3. 选择最合适的生图模型和参数（宽高比、风格等）
4. 如果首次生成不满意，根据反馈调整提示词重新生成

输出格式：
<final>
{
  "prompt": "英文提示词",
  "negativePrompt": "负面提示词",
  "modelId": "推荐模型ID",
  "aspectRatio": "推荐宽高比",
  "style": "推荐风格"
}
</final>`,
    maxIterations: 5,
    tools: ['generate-image', 'get-available-models'],
    nodeTypes: [
      'aicgImageGen',
      'aiImage',
      'imageGen',
      'unifiedImageStudio',
      'imageAnalysis',
      'inpainting',
      'outpainting',
      'localMatting',
      'characterConsistency',
      'imageCollage',
      'gridSplitter',
      'multiAngle',
      'panorama360',
    ],
  },
  {
    id: 'copywriter',
    name: '文案 Agent',
    description: '根据主题生成创意文案、剧本、分镜描述',
    icon: '✍️',
    color: '#3B82F6',
    llm: {
      modelId: 'ark-code-latest',
      provider: 'deepseek-v4-flash',
      temperature: 0.8,
      maxTokens: 8192,
    },
    systemPrompt: `你是一个专业的创意文案师。你的职责是：
1. 根据用户给定的主题或场景，生成创意文案
2. 支持多种文案类型：广告文案、视频脚本、分镜描述、角色设定
3. 文案应简洁有力，适合 AI 生成视觉内容
4. 如果需要，可以调用工具获取参考信息

输出格式：
<final>
{
  "title": "文案标题",
  "content": "文案正文",
  "type": "文案类型(ad/script/storyboard/character)",
  "scenes": [{"description": "场景描述", "visualPrompt": "视觉提示词"}]
}
</final>`,
    maxIterations: 5,
    tools: ['web-search', 'generate-text'],
    nodeTypes: [
      'aiGenText',
      'textInput',
      'prompt',
      'script',
      'adCopyText',
      'brandCopyText',
      'storyboardMaker',
      'storyboardEdit',
      'gridDirector',
      'scriptStoryboard',
      'batchProcess',
    ],
  },
  {
    id: 'reviewer',
    name: '审查 Agent',
    description: '审查生成结果的质量，判断是否需要重试或调整',
    icon: '🔍',
    color: '#EF4444',
    llm: {
      modelId: 'ark-code-latest',
      provider: 'deepseek-v4-flash',
      temperature: 0.1,
      maxTokens: 2048,
    },
    systemPrompt: `你是一个严格的质量审查员。你的职责是：
1. 审查 AI 生成的内容（图片/视频/文本）
2. 评估质量、合规性、与需求匹配度
3. 给出 pass 或 fail 判定
4. 如果 fail，给出具体的改进建议

审查维度：
- 质量：清晰度、完整性、无明显缺陷
- 合规：不包含违规内容
- 匹配：与原始需求一致

输出格式：
<final>
{
  "verdict": "pass" 或 "fail",
  "score": 0-100,
  "issues": ["问题列表"],
  "suggestions": ["改进建议"],
  "retryPrompt": "如果fail，给出调整后的提示词"
}
</final>`,
    maxIterations: 3,
    tools: ['analyze-image'],
    nodeTypes: [
      'aicgImageGen',
      'aiImage',
      'imageGen',
      'unifiedImageStudio',
      'aicgVideoGen',
      'aiVideo',
      'videoGen',
      'advancedVideoGen',
      'aiGenText',
      'textInput',
      'script',
      'storyboardMaker',
      'gridDirector',
      'scriptStoryboard',
    ],
  },
];

class CanvasAgentRegistry {
  private manifests = new Map<CanvasAgentRole, CanvasAgentManifest>();

  init(): void {
    for (const m of CANVAS_AGENT_MANIFESTS) {
      this.manifests.set(m.id, m);
    }
  }

  get(id: CanvasAgentRole): CanvasAgentManifest | undefined {
    if (this.manifests.size === 0) this.init();
    return this.manifests.get(id);
  }

  getAll(): CanvasAgentManifest[] {
    if (this.manifests.size === 0) this.init();
    return Array.from(this.manifests.values());
  }

  getByNodeType(nodeType: string): CanvasAgentManifest[] {
    return this.getAll().filter((m) => m.nodeTypes?.includes(nodeType));
  }

  toAgentConfig(id: CanvasAgentRole): AgentConfig | null {
    const m = this.get(id);
    if (!m) return null;
    return {
      name: m.name,
      description: m.description,
      model: m.llm.modelId,
      temperature: m.llm.temperature,
      maxTokens: m.llm.maxTokens,
      systemPrompt: m.systemPrompt,
      maxIterations: m.maxIterations,
    };
  }
}

export const canvasAgentRegistry = new CanvasAgentRegistry();
