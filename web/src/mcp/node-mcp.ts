/**
 * Node Management MCP Server
 * 节点管理 MCP 服务器
 * 提供 React Flow 节点开发、管理、工作流编排等能力
 */

import { LLMToolDefinition } from '@/services/llm-adapters/base-llm-adapter';
import type {
  FlowNodeType,
  NodeDevConfig,
  NodePortConfig,
  NodeParameterConfig,
  FlowNode,
  FlowNodeData,
} from '@/types/agent';

export interface NodeMCPServerConfig {
  enabled: boolean;
  nodeTypes: FlowNodeType[];
  customCategories: string[];
  defaultStyles: {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
  };
}

/** 节点生成结果 */
export interface NodeGenerationResult {
  nodeId: string;
  config: NodeDevConfig;
  code?: string;
  component?: string;
}

/** 节点处理工具 */
export interface NodeTool {
  name: string;
  description: string;
  definition: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
  handler: (args: Record<string, unknown>) => Promise<NodeToolResult>;
}

export interface NodeToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
  metadata?: {
    executionTime?: number;
    nodeType?: FlowNodeType;
  };
}

/**
 * 创建节点配置工具
 */
async function createNodeConfig(args: Record<string, unknown>): Promise<NodeToolResult> {
  const config = args as any as NodeDevConfig;

  if (!config.nodeType || !config.label) {
    return {
      success: false,
      error: 'Missing required parameters: nodeType, label',
    };
  }

  const startTime = Date.now();

  const defaultConfig: NodeDevConfig = {
    nodeType: config.nodeType,
    label: config.label,
    category: config.category || 'custom',
    icon: config.icon || 'default',
    color: config.color || '#6366f1',
    inputs: config.inputs || [],
    outputs: config.outputs || [],
    parameters: config.parameters || [],
    styles: config.styles || {
      backgroundColor: '#1e1e2e',
      borderColor: '#6366f1',
      textColor: '#e2e8f0',
    },
  };

  return {
    success: true,
    result: {
      nodeId: `node_${Date.now()}`,
      config: defaultConfig,
      createdAt: new Date().toISOString(),
    },
    metadata: {
      executionTime: Date.now() - startTime,
      nodeType: config.nodeType,
    },
  };
}

/**
 * 生成节点代码工具
 */
async function generateNodeCode(args: Record<string, unknown>): Promise<NodeToolResult> {
  const { nodeType, label, inputs, outputs, parameters } = args as {
    nodeType: FlowNodeType;
    label: string;
    inputs?: NodePortConfig[];
    outputs?: NodePortConfig[];
    parameters?: NodeParameterConfig[];
  };

  const startTime = Date.now();

  const code = generateNodeCodeTemplate(nodeType, label, inputs, outputs, parameters);

  return {
    success: true,
    result: {
      nodeId: `node_${Date.now()}`,
      code,
      language: 'typescript',
      framework: 'react',
      library: 'reactflow',
    },
    metadata: {
      executionTime: Date.now() - startTime,
      nodeType,
    },
  };
}

function generateNodeCodeTemplate(
  nodeType: FlowNodeType,
  label: string,
  inputs?: NodePortConfig[],
  outputs?: NodePortConfig[],
  parameters?: NodeParameterConfig[]
): string {
  const pascalName = label.replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));

  let paramInterface = '';
  let paramProps = '';

  if (parameters && parameters.length > 0) {
    paramInterface = `
interface ${pascalName}Params {
${parameters.map((p) => `  ${p.id}: ${mapTypeToTS(p.type)};`).join('\n')}
}`;

    paramProps = parameters
      .map((p) => {
        if (p.type === 'select') {
          return `      <Select
        label="${p.label}"
        value={params.${p.id}}
        onChange={(v) => updateParam('${p.id}', v)}
        options={${JSON.stringify(p.options || [])}}
      />`;
        }
        if (p.type === 'slider') {
          return `      <Slider
        label="${p.label}"
        value={params.${p.id}}
        onChange={(v) => updateParam('${p.id}', v)}
        min={${p.min || 0}}
        max={${p.max || 100}}
        step={${p.step || 1}}
      />`;
        }
        return `      <Input
        label="${p.label}"
        value={params.${p.id}}
        onChange={(v) => updateParam('${p.id}', v)}
      />`;
      })
      .join('\n');
  }

  return `import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';${paramInterface}

/**
 * ${label} Node Component
 * Type: ${nodeType}
 */
const ${pascalName}Node: React.FC<NodeProps> = ({ id, data, selected }) => {
  const params = (data.params || {}) as Partial<${pascalName}Params>;

  const updateParam = (key: string, value: unknown) => {
    // Update node data logic
  };

  return (
    <div
      style={{
        background: '#1e1e2e',
        border: '2px solid #6366f1',
        borderRadius: 8,
        padding: 12,
        minWidth: 200,
        opacity: selected ? 1 : 0.9,
      }}
    >
      <div style={{ color: '#e2e8f0', fontWeight: 'bold', marginBottom: 8 }}>
        ${label}
      </div>

${
  inputs && inputs.length > 0
    ? inputs
        .map(
          (input) => `      <Handle
        type="target"
        position={Position.Left}
        id="${input.id}"
        style={{ background: '#6366f1' }}
      />`
        )
        .join('\n')
    : ''
}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
${paramProps || '      // Add parameters here'}
      </div>

${
  outputs && outputs.length > 0
    ? outputs
        .map(
          (output) => `      <Handle
        type="source"
        position={Position.Right}
        id="${output.id}"
        style={{ background: '#6366f1' }}
      />`
        )
        .join('\n')
    : ''
}
    </div>
  );
};

export default memo(${pascalName}Node);
`;
}

function mapTypeToTS(type: string): string {
  const typeMap: Record<string, string> = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    select: 'string',
    slider: 'number',
    color: 'string',
    file: 'string',
  };
  return typeMap[type] || 'string';
}

/**
 * 创建输入节点工具
 */
async function createInputNode(args: Record<string, unknown>): Promise<NodeToolResult> {
  const { label, inputType, required } = args as {
    label: string;
    inputType: 'image' | 'video' | 'audio' | 'string';
    required?: boolean;
  };

  const inputConfig: NodePortConfig = {
    id: `input_${Date.now()}`,
    name: 'input',
    type: inputType,
    required: required ?? true,
  };

  return {
    success: true,
    result: {
      nodeId: `input_${Date.now()}`,
      nodeType: `${inputType}Input` as FlowNodeType,
      label,
      category: 'input',
      inputs: [],
      outputs: [inputConfig],
      config: {
        inputType,
        required,
      },
    },
  };
}

/**
 * 创建输出节点工具
 */
async function createOutputNode(args: Record<string, unknown>): Promise<NodeToolResult> {
  const { label, outputType } = args as {
    label: string;
    outputType: 'image' | 'video' | 'audio' | 'any';
  };

  const outputConfig: NodePortConfig = {
    id: `output_${Date.now()}`,
    name: 'output',
    type: outputType,
    required: true,
  };

  return {
    success: true,
    result: {
      nodeId: `output_${Date.now()}`,
      nodeType: 'output' as FlowNodeType,
      label,
      category: 'output',
      inputs: [outputConfig],
      outputs: [],
      config: {
        outputType,
      },
    },
  };
}

/**
 * 创建生成节点工具
 */
async function createGenerationNode(args: Record<string, unknown>): Promise<NodeToolResult> {
  const { label, genType, provider, defaultParams } = args as {
    label: string;
    genType: 'image' | 'video' | 'audio' | 'manga';
    provider: string;
    defaultParams?: Record<string, unknown>;
  };

  const inputConfig: NodePortConfig = {
    id: 'prompt_input',
    name: 'prompt',
    type: 'string',
    required: true,
  };

  const outputConfig: NodePortConfig = {
    id: 'result_output',
    name: 'result',
    type: genType === 'image' ? 'image' : genType === 'video' ? 'video' : 'any',
    required: true,
  };

  const paramConfigs: NodeParameterConfig[] = [];

  if (genType === 'video') {
    paramConfigs.push(
      {
        id: 'duration',
        name: 'duration',
        type: 'slider',
        label: 'Duration',
        defaultValue: 5,
        min: 1,
        max: 30,
        step: 1,
      },
      {
        id: 'resolution',
        name: 'resolution',
        type: 'select',
        label: 'Resolution',
        defaultValue: '1080p',
        options: [
          { label: '720p', value: '720p' },
          { label: '1080p', value: '1080p' },
          { label: '4K', value: '4k' },
        ],
      },
      {
        id: 'aspectRatio',
        name: 'aspectRatio',
        type: 'select',
        label: 'Aspect Ratio',
        defaultValue: '16:9',
        options: [
          { label: '16:9', value: '16:9' },
          { label: '9:16', value: '9:16' },
          { label: '1:1', value: '1:1' },
        ],
      }
    );
  }

  return {
    success: true,
    result: {
      nodeId: `gen_${Date.now()}`,
      nodeType: `${genType}Gen` as FlowNodeType,
      label,
      category: 'generation',
      inputs: [inputConfig],
      outputs: [outputConfig],
      parameters: paramConfigs,
      config: {
        genType,
        provider,
        defaultParams: defaultParams || {},
      },
    },
  };
}

/**
 * 节点连接验证工具
 */
async function validateConnection(args: Record<string, unknown>): Promise<NodeToolResult> {
  const { sourceNode, targetNode, sourceHandle, targetHandle } = args as {
    sourceNode: FlowNode;
    targetNode: FlowNode;
    sourceHandle?: string;
    targetHandle?: string;
  };

  const sourceData = sourceNode.data as FlowNodeData;
  const targetData = targetNode.data as FlowNodeData;

  const sourceType = sourceData.nodeConfig?.outputs?.find((o) => o.id === sourceHandle)?.type;
  const targetType = targetData.nodeConfig?.inputs?.find((i) => i.id === targetHandle)?.type;

  const isValid = sourceType && targetType ? isTypeCompatible(sourceType, targetType) : true;

  return {
    success: true,
    result: {
      isValid,
      sourceType,
      targetType,
      reason: isValid ? 'Types are compatible' : 'Type mismatch',
    },
  };
}

function isTypeCompatible(source: string, target: string): boolean {
  if (source === 'any' || target === 'any') return true;
  return source === target;
}

/**
 * 工作流验证工具
 */
async function validateWorkflow(args: Record<string, unknown>): Promise<NodeToolResult> {
  const { nodes, edges } = args as {
    nodes: FlowNode[];
    edges: Array<{ id: string; source: string; target: string }>;
  };

  const issues: string[] = [];

  // Check for orphan nodes (no connections)
  const connectedNodeIds = new Set<string>();
  edges.forEach((edge) => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  nodes.forEach((node) => {
    if (!connectedNodeIds.has(node.id)) {
      issues.push(`Node "${node.id}" has no connections`);
    }
  });

  // Check for cycles (simple detection)
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const hasCycle = (nodeId: string): boolean => {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const outgoingEdges = edges.filter((e) => e.source === nodeId);
    for (const edge of outgoingEdges) {
      if (!visited.has(edge.target)) {
        if (hasCycle(edge.target)) return true;
      } else if (recursionStack.has(edge.target)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  };

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (hasCycle(node.id)) {
        issues.push('Workflow contains a cycle');
        break;
      }
    }
  }

  return {
    success: true,
    result: {
      isValid: issues.length === 0,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      issues,
    },
  };
}

/**
 * 节点状态管理工具
 */
async function manageNodeState(args: Record<string, unknown>): Promise<NodeToolResult> {
  const { nodeId, action, state } = args as {
    nodeId: string;
    action: 'get' | 'set' | 'reset' | 'clear';
    state?: Record<string, unknown>;
  };

  // Placeholder for state management
  return {
    success: true,
    result: {
      nodeId,
      action,
      state: action === 'get' ? {} : state || {},
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * 批量节点操作工具
 */
async function batchNodeOperation(args: Record<string, unknown>): Promise<NodeToolResult> {
  const { operation, nodeIds } = args as {
    operation: 'create' | 'delete' | 'update' | 'duplicate';
    nodeIds: string[];
    params?: Record<string, unknown>;
  };

  const results = nodeIds.map((id) => ({
    nodeId: id,
    status: 'success' as const,
    operation,
  }));

  return {
    success: true,
    result: {
      processed: results.length,
      results,
      operation,
    },
  };
}

/** 节点 MCP 工具定义 */
export const nodeMCPTools: NodeTool[] = [
  {
    name: 'create_node_config',
    description: 'Create a new React Flow node configuration',
    definition: {
      name: 'create_node_config',
      description: 'Create node configuration',
      parameters: {
        type: 'object',
        properties: {
          nodeType: {
            type: 'string',
            enum: [
              'aiVideo',
              'aiImage',
              'videoGen',
              'imageGen',
              'audioGen',
              'mangaGen',
              'textInput',
              'aiGenText',
              'videoInput',
              'frameExtractor',
              'imageInput',
              'output',
              'custom',
            ],
            description: 'Node type',
          },
          label: { type: 'string', description: 'Node label' },
          category: { type: 'string', description: 'Node category' },
          icon: { type: 'string', description: 'Node icon' },
          color: { type: 'string', description: 'Node color' },
          inputs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                type: { type: 'string' },
                required: { type: 'boolean' },
              },
            },
            description: 'Input ports',
          },
          outputs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                type: { type: 'string' },
                required: { type: 'boolean' },
              },
            },
            description: 'Output ports',
          },
          parameters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                type: { type: 'string' },
                label: { type: 'string' },
                required: { type: 'boolean' },
                defaultValue: {},
                options: { type: 'array' },
                min: { type: 'number' },
                max: { type: 'number' },
              },
            },
            description: 'Node parameters',
          },
        },
        required: ['nodeType', 'label'],
      },
    },
    handler: createNodeConfig,
  },
  {
    name: 'generate_node_code',
    description: 'Generate React Flow node component code',
    definition: {
      name: 'generate_node_code',
      description: 'Generate node code',
      parameters: {
        type: 'object',
        properties: {
          nodeType: { type: 'string', description: 'Node type' },
          label: { type: 'string', description: 'Node label' },
          inputs: { type: 'array', description: 'Input ports' },
          outputs: { type: 'array', description: 'Output ports' },
          parameters: { type: 'array', description: 'Node parameters' },
        },
        required: ['nodeType', 'label'],
      },
    },
    handler: generateNodeCode,
  },
  {
    name: 'create_input_node',
    description: 'Create an input node for workflow',
    definition: {
      name: 'create_input_node',
      description: 'Create input node',
      parameters: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Node label' },
          inputType: {
            type: 'string',
            enum: ['image', 'video', 'audio', 'text'],
            description: 'Input type',
          },
          required: { type: 'boolean', description: 'Is required' },
        },
        required: ['label', 'inputType'],
      },
    },
    handler: createInputNode,
  },
  {
    name: 'create_output_node',
    description: 'Create an output node for workflow',
    definition: {
      name: 'create_output_node',
      description: 'Create output node',
      parameters: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Node label' },
          outputType: {
            type: 'string',
            enum: ['image', 'video', 'audio', 'file'],
            description: 'Output type',
          },
        },
        required: ['label', 'outputType'],
      },
    },
    handler: createOutputNode,
  },
  {
    name: 'create_generation_node',
    description: 'Create a generation node (image/video/audio)',
    definition: {
      name: 'create_generation_node',
      description: 'Create generation node',
      parameters: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Node label' },
          genType: {
            type: 'string',
            enum: ['image', 'video', 'audio', 'manga'],
            description: 'Generation type',
          },
          provider: { type: 'string', description: 'AI provider' },
          defaultParams: { type: 'object', description: 'Default parameters' },
        },
        required: ['label', 'genType', 'provider'],
      },
    },
    handler: createGenerationNode,
  },
  {
    name: 'validate_connection',
    description: 'Validate node connection compatibility',
    definition: {
      name: 'validate_connection',
      description: 'Validate connection',
      parameters: {
        type: 'object',
        properties: {
          sourceNode: { type: 'object', description: 'Source node' },
          targetNode: { type: 'object', description: 'Target node' },
          sourceHandle: { type: 'string', description: 'Source handle ID' },
          targetHandle: { type: 'string', description: 'Target handle ID' },
        },
        required: ['sourceNode', 'targetNode'],
      },
    },
    handler: validateConnection,
  },
  {
    name: 'validate_workflow',
    description: 'Validate entire workflow structure',
    definition: {
      name: 'validate_workflow',
      description: 'Validate workflow',
      parameters: {
        type: 'object',
        properties: {
          nodes: { type: 'array', description: 'Workflow nodes' },
          edges: { type: 'array', description: 'Workflow edges' },
        },
        required: ['nodes', 'edges'],
      },
    },
    handler: validateWorkflow,
  },
  {
    name: 'manage_node_state',
    description: 'Manage node state (get/set/reset)',
    definition: {
      name: 'manage_node_state',
      description: 'Manage node state',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Node ID' },
          action: { type: 'string', enum: ['get', 'set', 'reset', 'clear'], description: 'Action' },
          state: { type: 'object', description: 'State to set' },
        },
        required: ['nodeId', 'action'],
      },
    },
    handler: manageNodeState,
  },
  {
    name: 'batch_node_operation',
    description: 'Perform batch operations on nodes',
    definition: {
      name: 'batch_node_operation',
      description: 'Batch operation',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['create', 'delete', 'update', 'duplicate'],
            description: 'Operation',
          },
          nodeIds: { type: 'array', items: { type: 'string' }, description: 'Node IDs' },
          params: { type: 'object', description: 'Operation parameters' },
        },
        required: ['operation', 'nodeIds'],
      },
    },
    handler: batchNodeOperation,
  },
];

/**
 * Node MCP Server 类
 */
export class NodeMCPServer {
  private static instance: NodeMCPServer;
  private config: NodeMCPServerConfig;
  private tools: Map<string, NodeTool> = new Map();

  private constructor() {
    this.config = {
      enabled: true,
      nodeTypes: [
        'aiVideo',
        'aiImage',
        'videoGen',
        'imageGen',
        'audioGen',
        'mangaGen',
        'textInput',
        'aiGenText',
        'videoInput',
        'frameExtractor',
        'imageInput',
        'output',
        'custom',
      ],
      customCategories: ['generation', 'input', 'output', 'processing', 'custom'],
      defaultStyles: {
        backgroundColor: '#1e1e2e',
        borderColor: '#6366f1',
        textColor: '#e2e8f0',
      },
    };

    this.registerTools();
  }

  public static getInstance(): NodeMCPServer {
    if (!NodeMCPServer.instance) {
      NodeMCPServer.instance = new NodeMCPServer();
    }
    return NodeMCPServer.instance;
  }

  private registerTools(): void {
    nodeMCPTools.forEach((tool) => {
      this.tools.set(tool.name, tool);
    });
  }

  public getTools(): NodeTool[] {
    return Array.from(this.tools.values());
  }

  public getTool(name: string): NodeTool | undefined {
    return this.tools.get(name);
  }

  public async executeTool(name: string, args: Record<string, unknown>): Promise<NodeToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool "${name}" not found`,
      };
    }

    return tool.handler(args);
  }

  public getToolDefinitions(): LLMToolDefinition[] {
    return this.getTools().map((t): LLMToolDefinition => {
      const def = t.definition;
      return {
        type: 'function',
        function: {
          name: def.name || t.name,
          description: def.description || t.description,
          parameters: def.parameters,
        },
      };
    });
  }

  public updateConfig(config: Partial<NodeMCPServerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): NodeMCPServerConfig {
    return { ...this.config };
  }

  public getNodeTypes(): FlowNodeType[] {
    return [...this.config.nodeTypes];
  }

  public getCategories(): string[] {
    return [...this.config.customCategories];
  }
}

export const nodeMCPServer = NodeMCPServer.getInstance();
