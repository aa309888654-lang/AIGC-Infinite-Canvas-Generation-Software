/**
 * Programming Agent
 * 节点编程 Agent
 *
 * 职责：编写节点逻辑和交互代码
 * 能力：状态管理、事件处理、数据流、API 集成
 * 技术栈：Zustand, React Hooks, TypeScript
 */

import { BaseAgent, AgentExecutor, AgentConfig as FrameworkAgentConfig } from '@/services/agents/agent-framework';
import { LLMToolCall } from '@/services/llm-adapters/base-llm-adapter';
import type { ProgrammingAgentConfig, ProgrammingResult} from './types';
import { PROGRAMMING_SYSTEM_PROMPT, formatImplementPrompt } from './prompts';

/** 默认配置 */
const DEFAULT_CONFIG: ProgrammingAgentConfig = {
  id: 'programming-agent',
  name: 'Programming Agent',
  role: 'programming',
  description: '编写节点逻辑和交互代码',
  capabilities: [
    { id: 'state-management', name: '状态管理', description: '使用 Zustand 管理节点状态', category: 'core' },
    { id: 'event-handling', name: '事件处理', description: '处理节点交互事件', category: 'core' },
    { id: 'data-flow', name: '数据流', description: '实现节点间数据传递', category: 'core' },
    { id: 'api-integration', name: 'API集成', description: '调用后端 API', category: 'integration' },
    { id: 'error-handling', name: '错误处理', description: '完善的错误处理', category: 'core' },
  ],
  tools: [],
  model: 'ark-code-latest',
  temperature: 0.2,
  maxTokens: 8192,
  maxIterations: 10,
  systemPrompt: PROGRAMMING_SYSTEM_PROMPT,
  enabled: true,
  language: 'typescript',
  framework: 'react',
  stateManagement: 'zustand',
  lintingRules: ['no-unused-vars', 'no-explicit-any', 'prefer-const'],
  formattingRules: ['single-quote', 'semi', 'tab-width-2'],
};

/**
 * Programming Agent
 */
export class ProgrammingAgent extends BaseAgent {
  private language: string;
  private framework: string;
  private stateManagement: string;

  constructor(executor: AgentExecutor, config?: Partial<ProgrammingAgentConfig>) {
    const mergedConfig: ProgrammingAgentConfig = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    const baseConfig: FrameworkAgentConfig = {
      name: mergedConfig.name,
      description: mergedConfig.description,
      model: mergedConfig.model,
      temperature: mergedConfig.temperature,
      maxTokens: mergedConfig.maxTokens,
      maxIterations: mergedConfig.maxIterations,
      systemPrompt: mergedConfig.systemPrompt,
    };

    super(baseConfig, executor);

    this.language = mergedConfig.language;
    this.framework = mergedConfig.framework;
    this.stateManagement = mergedConfig.stateManagement;
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
   * 实现节点逻辑
   */
  public async implementNodeLogic(
    nodeType: string,
    nodeId: string,
    description: string,
    inputs?: string[],
    outputs?: string[],
    parameters?: Array<{ name: string; type: string; label: string }>
  ): Promise<ProgrammingResult> {
    const prompt = formatImplementPrompt({
      nodeType,
      nodeId,
      description,
      inputs: inputs?.join(', '),
      outputs: outputs?.join(', '),
      parameters: parameters?.map((p) => `${p.label} (${p.type})`).join(', '),
    });

    const result = await this.run(prompt);

    return {
      code: result.message,
      language: this.language,
      framework: this.framework,
    };
  }

  /**
   * 生成 Zustand Store
   */
  public generateZustandStore(nodeId: string, state: Record<string, unknown>): string {
    const pascalName = nodeId.replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));

    return `import { create } from 'zustand';

interface ${pascalName}State {
${Object.entries(state)
  .map(([key, value]) => `  ${key}: ${typeof value};`)
  .join('\n')}
}

interface ${pascalName}Actions {
  set${pascalName}State: (state: Partial<${pascalName}State>) => void;
  reset: () => void;
}

export const use${pascalName}Store = create<${pascalName}State & ${pascalName}Actions>((set) => ({
${Object.entries(state)
  .map(([key, value]) => `  ${key}: ${JSON.stringify(value)},`)
  .join('\n')}

  set${pascalName}State: (newState) => set((state) => ({ ...state, ...newState })),
  reset: () => set({
${Object.entries(state)
  .map(([key, value]) => `    ${key}: ${JSON.stringify(value)},`)
  .join('\n')}
  }),
}));
`;
  }

  /**
   * 生成事件处理器
   */
  public generateEventHandler(eventName: string, handlerType: string): string {
    return `const handle${this.capitalize(eventName)} = useCallback((${handlerType === 'drag' ? 'event: DragEvent' : ''}) => {
  // Handle ${eventName} event
  console.log('${eventName} event triggered');
}, []);`;
  }

  /**
   * 生成数据处理函数
   */
  public generateDataProcessor(inputType: string, outputType: string, transform: string): string {
    return `const processData = useCallback((input: ${inputType}): ${outputType} => {
  // ${transform}
  try {
    const result = transformData(input);
    return result;
  } catch (error) {
    console.error('Data processing error:', error);
    throw error;
  }
}, []);`;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * 创建 ProgrammingAgent 实例
 */
export function createProgrammingAgent(
  executor: AgentExecutor,
  config?: Partial<ProgrammingAgentConfig>
): ProgrammingAgent {
  return new ProgrammingAgent(executor, config);
}
