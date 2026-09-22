/**
 * Node Development Agent
 * 节点开发专家 Agent
 *
 * 职责：设计和开发 React Flow 节点组件
 * 能力：创建节点、定义接口、管理状态、数据流编排
 * 技术栈：React, TypeScript, React Flow, Tailwind CSS
 */

import { BaseAgent, AgentExecutor, AgentConfig as FrameworkAgentConfig } from '@/services/agents/agent-framework';
import { LLMToolCall } from '@/services/llm-adapters/base-llm-adapter';
import { nodeMCPServer } from '@/mcp/node-mcp';
import type {
  NodeDevAgentConfig,
  NodeDevTask,
  NodeDevResult,
  NodeTemplate,
} from './types';
import { NODE_DEV_SYSTEM_PROMPT, NODE_TEMPLATES } from './prompts';
import type { NodeDevConfig, FlowNodeType, AgentTool } from '@/types/agent';

/** 默认节点开发 Agent 配置 */
export const DEFAULT_NODE_DEV_CONFIG: NodeDevAgentConfig = {
  id: 'node-dev-agent',
  name: 'Node Dev Agent',
  role: 'node-dev',
  description: '设计和开发 React Flow 节点组件',
  capabilities: [
    {
      id: 'create-node',
      name: '创建节点',
      description: '创建新的 React Flow 节点组件',
      category: 'node-creation',
    },
    {
      id: 'configure-node',
      name: '配置节点',
      description: '配置节点的输入输出端口和参数',
      category: 'node-creation',
    },
    {
      id: 'generate-code',
      name: '生成代码',
      description: '生成节点组件代码',
      category: 'code-generation',
    },
    {
      id: 'validate-node',
      name: '验证节点',
      description: '验证节点配置和代码',
      category: 'validation',
    },
    {
      id: 'manage-ports',
      name: '管理端口',
      description: '管理节点的输入输出端口',
      category: 'management',
    },
  ],
  tools: [],
  model: 'ark-code-latest',
  temperature: 0.2,
  maxTokens: 8192,
  maxIterations: 10,
  systemPrompt: NODE_DEV_SYSTEM_PROMPT,
  enabled: true,
  templates: Object.entries(NODE_TEMPLATES).map(([key, template]) => ({
    id: key,
    ...template,
    nodeType: key as FlowNodeType,
    defaultConfig: createDefaultNodeConfig(key as FlowNodeType, template.name),
  })),
  customCategories: ['generation', 'input', 'output', 'processing', 'custom'],
};

/**
 * 创建默认节点配置
 */
function createDefaultNodeConfig(nodeType: FlowNodeType, label: string): NodeDevConfig {
  const baseConfig: NodeDevConfig = {
    nodeType,
    label,
    category: getCategoryForNodeType(nodeType),
    icon: NODE_TEMPLATES[nodeType as keyof typeof NODE_TEMPLATES]?.icon || '📦',
    color: NODE_TEMPLATES[nodeType as keyof typeof NODE_TEMPLATES]?.color || '#6366f1',
    inputs: [],
    outputs: [],
    parameters: [],
  };

  // 根据节点类型添加默认端口和参数
  switch (nodeType) {
    case 'videoGen':
      baseConfig.inputs = [
        { id: 'prompt', name: 'prompt', type: 'string', required: true },
        { id: 'reference', name: 'reference', type: 'image', required: false },
      ];
      baseConfig.outputs = [{ id: 'result', name: 'result', type: 'video', required: true }];
      baseConfig.parameters = [
        { id: 'duration', name: 'duration', type: 'slider', label: 'Duration', defaultValue: 5, min: 1, max: 30, step: 1 },
        { id: 'resolution', name: 'resolution', type: 'select', label: 'Resolution', defaultValue: '1080p', options: [
          { label: '720p', value: '720p' },
          { label: '1080p', value: '1080p' },
          { label: '4K', value: '4k' },
        ]},
        { id: 'aspectRatio', name: 'aspectRatio', type: 'select', label: 'Aspect Ratio', defaultValue: '16:9', options: [
          { label: '16:9', value: '16:9' },
          { label: '9:16', value: '9:16' },
          { label: '1:1', value: '1:1' },
        ]},
      ];
      break;
    case 'imageGen':
    case 'unifiedImageStudio':
      baseConfig.inputs = [
        { id: 'prompt', name: 'prompt', type: 'string', required: true },
      ];
      baseConfig.outputs = [{ id: 'result', name: 'result', type: 'image', required: true }];
      baseConfig.parameters = [
        { id: 'aspectRatio', name: 'aspectRatio', type: 'select', label: 'Aspect Ratio', defaultValue: '1:1', options: [
          { label: '1:1', value: '1:1' },
          { label: '16:9', value: '16:9' },
          { label: '9:16', value: '9:16' },
        ]},
        { id: 'style', name: 'style', type: 'select', label: 'Style', defaultValue: 'realistic', options: [
          { label: 'Realistic', value: 'realistic' },
          { label: 'Anime', value: 'anime' },
          { label: 'Artistic', value: 'artistic' },
        ]},
      ];
      break;
    case 'audioGen':
      baseConfig.inputs = [
        { id: 'prompt', name: 'prompt', type: 'string', required: false },
      ];
      baseConfig.outputs = [{ id: 'result', name: 'result', type: 'audio', required: true }];
      baseConfig.parameters = [
        { id: 'duration', name: 'duration', type: 'slider', label: 'Duration', defaultValue: 30, min: 5, max: 180, step: 5 },
        { id: 'style', name: 'style', type: 'select', label: 'Style', defaultValue: 'peaceful', options: [
          { label: 'Epic', value: 'epic' },
          { label: 'Peaceful', value: 'peaceful' },
          { label: 'Dramatic', value: 'dramatic' },
        ]},
      ];
      break;
    case 'mangaGen':
      baseConfig.inputs = [
        { id: 'script', name: 'script', type: 'string', required: true },
        { id: 'characters', name: 'characters', type: 'any', required: false },
      ];
      baseConfig.outputs = [
        { id: 'storyboard', name: 'storyboard', type: 'any', required: true },
        { id: 'video', name: 'video', type: 'video', required: false },
      ];
      baseConfig.parameters = [
        { id: 'frames', name: 'frames', type: 'slider', label: 'Frame Count', defaultValue: 8, min: 4, max: 16, step: 1 },
        { id: 'quality', name: 'quality', type: 'select', label: 'Quality', defaultValue: 'high', options: [
          { label: 'Low', value: 'low' },
          { label: 'Medium', value: 'medium' },
          { label: 'High', value: 'high' },
        ]},
      ];
      break;
    case 'textInput':
      baseConfig.outputs = [{ id: 'text', name: 'text', type: 'string', required: true }];
      baseConfig.parameters = [
        { id: 'placeholder', name: 'placeholder', type: 'string', label: 'Placeholder', defaultValue: 'Enter text...' },
      ];
      break;
    case 'aiGenText':
      baseConfig.inputs = [{ id: 'promptInput', name: 'prompt', type: 'string', required: false }];
      baseConfig.outputs = [{ id: 'textOutput', name: 'text', type: 'string', required: true }];
      baseConfig.parameters = [
        { id: 'prompt', name: 'prompt', type: 'string', label: 'Prompt', defaultValue: '' },
        { id: 'model', name: 'model', type: 'string', label: 'Model', defaultValue: 'auto' },
        { id: 'systemPrompt', name: 'systemPrompt', type: 'string', label: 'System Prompt', defaultValue: '' },
      ];
      break;
    case 'videoInput':
    case 'imageInput':
      baseConfig.outputs = [{ id: 'output', name: 'output', type: nodeType.replace('Input', '') as 'video' | 'image', required: true }];
      baseConfig.parameters = [
        { id: 'label', name: 'label', type: 'string', label: 'Label', defaultValue: 'Input' },
      ];
      break;
    case 'frameExtractor':
      baseConfig.inputs = [{ id: 'input', name: 'video', type: 'video', required: false }];
      baseConfig.outputs = [{ id: 'output', name: 'frames', type: 'image', required: true }];
      baseConfig.parameters = [
        { id: 'frameCount', name: 'frameCount', type: 'slider', label: 'Frame Count', defaultValue: 10, min: 1, max: 50, step: 1 },
        { id: 'intervalSeconds', name: 'intervalSeconds', type: 'slider', label: 'Interval Seconds', defaultValue: 1, min: 0.1, max: 10, step: 0.1 },
        { id: 'extractionMode', name: 'extractionMode', type: 'select', label: 'Mode', defaultValue: 'even', options: [
          { label: 'Even', value: 'even' },
          { label: 'Interval', value: 'interval' },
        ]},
      ];
      break;
    case 'output':
      baseConfig.inputs = [{ id: 'input', name: 'input', type: 'any', required: true }];
      baseConfig.parameters = [
        { id: 'format', name: 'format', type: 'select', label: 'Output Format', defaultValue: 'mp4', options: [
          { label: 'MP4', value: 'mp4' },
          { label: 'GIF', value: 'gif' },
          { label: 'WebM', value: 'webm' },
        ]},
      ];
      break;
    default:
      break;
  }

  return baseConfig;
}

function getCategoryForNodeType(nodeType: FlowNodeType): string {
  const categoryMap: Record<string, string> = {
    videoGen: 'generation',
    imageGen: 'generation',
    unifiedImageStudio: 'generation',
    audioGen: 'generation',
    mangaGen: 'generation',
    textInput: 'input',
    aiGenText: 'text',
    videoInput: 'input',
    frameExtractor: 'processing',
    imageInput: 'input',
    output: 'output',
    custom: 'custom',
  };
  return categoryMap[nodeType] || 'custom';
}

/**
 * Node Development Agent
 */
export class NodeDevAgent extends BaseAgent {
  private templates: NodeTemplate[];
  private customCategories: string[];
  private currentTask?: NodeDevTask;

  constructor(executor: AgentExecutor, config?: Partial<NodeDevAgentConfig>) {
    const mergedConfig: NodeDevAgentConfig = {
      ...DEFAULT_NODE_DEV_CONFIG,
      ...config,
      tools: nodeMCPServer.getToolDefinitions() as any as AgentTool[],
    };

    const baseConfig: FrameworkAgentConfig = {
      name: mergedConfig.name,
      description: mergedConfig.description,
      model: mergedConfig.model,
      temperature: mergedConfig.temperature,
      maxTokens: mergedConfig.maxTokens,
      maxIterations: mergedConfig.maxIterations,
      systemPrompt: mergedConfig.systemPrompt,
      tools: mergedConfig.tools as FrameworkAgentConfig['tools'],
    };

    super(baseConfig, executor);

    this.templates = mergedConfig.templates || DEFAULT_NODE_DEV_CONFIG.templates;
    this.customCategories = mergedConfig.customCategories || DEFAULT_NODE_DEV_CONFIG.customCategories;
  }

  protected async step(): Promise<{
    toolCalls?: LLMToolCall[];
    finalResult?: string;
    metadata?: Record<string, unknown>;
  }> {
    const params = this.buildLLMParams();
    const response = await this.executor.complete(params);

    const content = response.choices[0]?.message?.content || '';
    const toolCalls = this.extractToolCalls(response);

    if (toolCalls.length > 0) {
      return { toolCalls };
    }

    const finalResult = this.extractFinalResult(content);
    if (finalResult) {
      return { finalResult };
    }

    this.addMessage('assistant', content);
    return { finalResult: content };
  }

  /**
   * 创建新节点
   */
  public async createNode(config: Partial<NodeDevConfig>): Promise<NodeDevResult> {
    const nodeId = `node_${Date.now()}`;

    // 使用 MCP 工具创建节点配置
    const result = await nodeMCPServer.executeTool('create_node_config', {
      nodeType: config.nodeType,
      label: config.label,
      category: config.category,
      icon: config.icon,
      color: config.color,
      inputs: config.inputs,
      outputs: config.outputs,
      parameters: config.parameters,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to create node config');
    }

    return {
      nodeId,
      config: (result.result as { config: NodeDevConfig }).config,
    };
  }

  /**
   * 生成节点代码
   */
  public async generateNodeCode(nodeType: FlowNodeType, label: string, config?: Partial<NodeDevConfig>): Promise<string> {
    const result = await nodeMCPServer.executeTool('generate_node_code', {
      nodeType,
      label,
      inputs: config?.inputs,
      outputs: config?.outputs,
      parameters: config?.parameters,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to generate node code');
    }

    const codeResult = result.result as { code?: string };
    return codeResult.code || '';
  }

  /**
   * 验证节点
   */
  public async validateNode(_config: NodeDevConfig): Promise<{ isValid: boolean; issues: string[] }> {
    const result = await nodeMCPServer.executeTool('validate_workflow', {
      nodes: [],
      edges: [],
    });

    return {
      isValid: result.success,
      issues: result.success ? [] : [result.error || 'Validation failed'],
    };
  }

  /**
   * 获取节点模板
   */
  public getTemplates(): NodeTemplate[] {
    return [...this.templates];
  }

  /**
   * 获取节点模板 by ID
   */
  public getTemplate(id: string): NodeTemplate | undefined {
    return this.templates.find((t) => t.id === id);
  }

  /**
   * 获取自定义分类
   */
  public getCategories(): string[] {
    return [...this.customCategories];
  }

  /**
   * 创建输入节点
   */
  public async createInputNode(
    label: string,
    inputType: 'image' | 'video' | 'audio' | 'text'
  ): Promise<NodeDevResult> {
    const result = await nodeMCPServer.executeTool('create_input_node', {
      label,
      inputType,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to create input node');
    }

    const res = result.result as { nodeId: string; config: NodeDevConfig };
    return {
      nodeId: res.nodeId,
      config: res.config,
    };
  }

  /**
   * 创建输出节点
   */
  public async createOutputNode(label: string, outputType: 'image' | 'video' | 'audio' | 'file'): Promise<NodeDevResult> {
    const result = await nodeMCPServer.executeTool('create_output_node', {
      label,
      outputType,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to create output node');
    }

    const res = result.result as { nodeId: string; config: NodeDevConfig };
    return {
      nodeId: res.nodeId,
      config: res.config,
    };
  }

  /**
   * 创建生成节点
   */
  public async createGenerationNode(
    label: string,
    genType: 'image' | 'video' | 'audio' | 'manga',
    provider: string
  ): Promise<NodeDevResult> {
    const result = await nodeMCPServer.executeTool('create_generation_node', {
      label,
      genType,
      provider,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to create generation node');
    }

    const res = result.result as { nodeId: string; config: NodeDevConfig };
    return {
      nodeId: res.nodeId,
      config: res.config,
    };
  }

  /**
   * 从模板创建节点
   */
  public async createFromTemplate(templateId: string): Promise<NodeDevResult> {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template "${templateId}" not found`);
    }

    return this.createNode(template.defaultConfig);
  }

  /**
   * 创建任务
   */
  public createTask(type: 'create' | 'update' | 'delete' | 'validate', nodeType: FlowNodeType, config?: Partial<NodeDevConfig>): NodeDevTask {
    const task: NodeDevTask = {
      id: `task_${Date.now()}`,
      type,
      nodeType,
      config,
      status: 'pending',
      createdAt: new Date(),
    };

    this.currentTask = task;
    return task;
  }

  /**
   * 获取当前任务
   */
  public getCurrentTask(): NodeDevTask | undefined {
    return this.currentTask;
  }
}

/**
 * 创建 NodeDevAgent 实例
 */
export function createNodeDevAgent(executor: AgentExecutor, config?: Partial<NodeDevAgentConfig>): NodeDevAgent {
  return new NodeDevAgent(executor, config);
}
