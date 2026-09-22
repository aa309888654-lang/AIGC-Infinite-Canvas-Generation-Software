import { LLMCompletionParams, LLMCompletionResponse } from '../llm-adapters/base-llm-adapter';
import { API_BASE_URL } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-check';
import {
  BaseAgent,
  AgentExecutor,
  AgentResult,
} from './agent-framework';
import {
  CodeReviewAgent,
  BugFixAgent,
  FeatureAgent,
  TestAgent,
  DocAgent,
  RefactorAgent,
  ArchitectureAgent,
} from './development-agents';
import { mcpToolsRegistry } from './mcp/mcp-tools-registry';

export type AgentType = 
  | 'code-review'
  | 'bug-fix'
  | 'feature'
  | 'test'
  | 'documentation'
  | 'refactor'
  | 'architecture';

export interface AgentInfo {
  type: AgentType;
  name: string;
  description: string;
  model: string;
  icon: string;
}

class BackendAgentExecutor implements AgentExecutor {
  async complete(params: LLMCompletionParams): Promise<LLMCompletionResponse> {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        messages: params.messages,
        model: params.model || '火山方舟-M2.7-highspeed',
        temperature: params.temperature ?? 0.3,
        maxTokens: params.maxTokens ?? 16384,
        stream: false,
        provider: 'deepseek-v4-flash',
        tools: params.tools,
        toolChoice: params.toolChoice,
        enablePromptCaching: params.enablePromptCaching,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || `后端 Agent 请求失败: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content || '';

    return {
      id: `backend-agent-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: data.model || params.model || 'backend-managed',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: 'stop',
        },
      ],
      usage: data.usage,
    };
  }

  async completeStream(params: LLMCompletionParams, onChunk: (chunk: unknown) => void): Promise<void> {
    const response = await this.complete(params);
    onChunk({
      id: response.id,
      object: 'chat.completion.chunk',
      created: response.created,
      model: response.model,
      choices: [
        {
          index: 0,
          delta: { role: 'assistant', content: response.choices[0]?.message?.content || '' },
          finish_reason: 'stop',
        },
      ],
    });
  }
}

class AgentManager {
  private static instance: AgentManager;
  private agents: Map<AgentType, BaseAgent> = new Map();
  private executor!: AgentExecutor;
  private initialized = false;

  private constructor() { /* noop */ }

  public static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager();
    }
    return AgentManager.instance;
  }

  public initialize(_apiKey: string, _baseUrl?: string): void {
    if (this.initialized) {
      // console.log('[AgentManager] Already initialized');
      return;
    }

    this.executor = new BackendAgentExecutor();
    this.createAgents();
    this.initialized = true;
    // console.log('[AgentManager] Initialized with 火山方舟-highspeed');
  }

  private createAgents(): void {
    this.agents.set('code-review', new CodeReviewAgent(this.executor));
    this.agents.set('bug-fix', new BugFixAgent(this.executor));
    this.agents.set('feature', new FeatureAgent(this.executor));
    this.agents.set('test', new TestAgent(this.executor));
    this.agents.set('documentation', new DocAgent(this.executor));
    this.agents.set('refactor', new RefactorAgent(this.executor));
    this.agents.set('architecture', new ArchitectureAgent(this.executor));
  }

  public getAgent(type: AgentType): BaseAgent | undefined {
    return this.agents.get(type);
  }

  public async runAgent(type: AgentType, input: string): Promise<AgentResult> {
    const agent = this.agents.get(type);
    if (!agent) {
      return {
        success: false,
        message: `Agent type "${type}" not found`,
        iterations: 0,
      };
    }

    try {
      return await agent.run(input);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        iterations: 0,
      };
    }
  }

  public getAvailableAgents(): AgentInfo[] {
    return [
      {
        type: 'code-review',
        name: '代码审查',
        description: '审查代码质量、发现潜在问题、提出优化建议',
        model: '火山方舟-M2.5-highspeed',
        icon: '🔍',
      },
      {
        type: 'bug-fix',
        name: 'Bug 修复',
        description: '分析错误原因、提供修复方案、自动修复 Bug',
        model: '火山方舟-M2.5-highspeed',
        icon: '🐛',
      },
      {
        type: 'feature',
        name: '功能开发',
        description: '根据需求实现完整的功能模块',
        model: 'ark-code-latest',
        icon: '⚡',
      },
      {
        type: 'test',
        name: '测试生成',
        description: '生成单元测试和集成测试',
        model: '火山方舟-M2.5-highspeed',
        icon: '🧪',
      },
      {
        type: 'documentation',
        name: '文档生成',
        description: '生成代码文档和 API 文档',
        model: 'ark-code-latest',
        icon: '📝',
      },
      {
        type: 'refactor',
        name: '代码重构',
        description: '优化代码结构、提高可维护性',
        model: '火山方舟-M2.5-highspeed',
        icon: '🔧',
      },
      {
        type: 'architecture',
        name: '架构设计',
        description: '设计系统架构、提出技术方案',
        model: 'ark-code-latest',
        icon: '🏗️',
      },
    ];
  }

  public getToolDefinitions() {
    return mcpToolsRegistry.getToolDefinitions();
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public reset(): void {
    this.agents.forEach(agent => agent.reset());
  }

  public resetAgent(type: AgentType): void {
    const agent = this.agents.get(type);
    if (agent) {
      agent.reset();
    }
  }
}

export const agentManager = AgentManager.getInstance();
export { AgentManager };
