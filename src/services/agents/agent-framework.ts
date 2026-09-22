import { 
  LLMMessage, 
  LLMCompletionParams, 
  LLMToolCall,
  LLMToolDefinition,
} from '../llm-adapters/base-llm-adapter';
import { mcpToolsRegistry, ToolResult } from './mcp/mcp-tools-registry';

export interface AgentConfig {
  name: string;
  description: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: any[];
  maxIterations?: number;
  enablePromptCaching?: boolean;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string;
  toolName?: string;
  timestamp: Date;
}

export interface AgentResult {
  success: boolean;
  message: string;
  toolCalls?: LLMToolCall[];
  finalResult?: any;
  iterations: number;
  metadata?: Record<string, any>;
}

export interface AgentExecutor {
  complete(params: LLMCompletionParams): Promise<import('../llm-adapters/base-llm-adapter').LLMCompletionResponse>;
  completeStream(params: LLMCompletionParams, onChunk: (chunk: any) => void): Promise<void>;
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected messages: AgentMessage[] = [];
  protected executor: AgentExecutor;
  protected iteration = 0;
  protected maxIterations: number;
  protected tools: LLMToolDefinition[] = [];

  constructor(config: AgentConfig, executor: AgentExecutor) {
    this.config = config;
    this.executor = executor;
    this.maxIterations = config.maxIterations || 10;
    this.tools = (config.tools as LLMToolDefinition[]) || mcpToolsRegistry.getToolDefinitions();
    
    this.addSystemMessage(this.buildSystemPrompt());
  }

  protected buildSystemPrompt(): string {
    let prompt = this.config.systemPrompt || '';
    
    prompt += `

【角色】${this.config.description}
【名称】${this.config.name}

【可用工具】
你可以使用以下工具来完成复杂任务。每个工具都有特定的功能和参数。
`;

    this.tools.forEach((tool) => {
      const { name, description, parameters } = tool.function;
      prompt += `
- ${name}: ${description || '无描述'}
  参数: ${this.formatParameters(parameters as Record<string, any>)}`;
    });

    prompt += `

【使用工具的格式】
当你需要使用工具时，回复必须包含 tool_calls:
{"tool_calls": [{"id": "call_xxx", "type": "function", "function": {"name": "工具名", "arguments": "{"参数1": "值1"}"}}]}

【重要规则】
1. 如果需要执行复杂任务，优先考虑使用工具
2. 每次使用工具后，我会返回结果，然后你可以继续使用更多工具或给出最终答案
3. 最终答案使用 <final> 标签包裹: <final>你的最终答案</final>
4. 保持回复简洁，专注于任务本身`;

    return prompt;
  }

  private formatParameters(params?: Record<string, any>): string {
    if (!params) return '无参数';

    const obj = params as {
      properties?: Record<string, { type?: string; description?: string }>;
      required?: string[];
    };
    const properties = obj.properties || {};
    const required = obj.required || [];

    return Object.entries(properties)
      .map(([key, value]) => {
        const req = required.includes(key) ? '(必需)' : '(可选)';
        return `${key}: ${value.type || 'any'} - ${value.description || ''} ${req}`;
      })
      .join(', ') || '无参数';
  }

  public addMessage(role: AgentMessage['role'], content: string): void {
    this.messages.push({
      id: this.generateId(),
      role,
      content,
      timestamp: new Date(),
    });
  }

  public addToolResult(toolCallId: string, toolName: string, result: ToolResult): void {
    this.messages.push({
      id: this.generateId(),
      role: 'tool',
      content: JSON.stringify(result),
      toolCallId,
      toolName,
      timestamp: new Date(),
    });
  }

  protected addSystemMessage(content: string): void {
    const hasSystem = this.messages.some(m => m.role === 'system');
    if (hasSystem) {
      this.messages = this.messages.map(m => 
        m.role === 'system' ? { ...m, content } : m
      );
    } else {
      this.messages.unshift({
        id: this.generateId(),
        role: 'system',
        content,
        timestamp: new Date(),
      });
    }
  }

  public async run(initialMessage: string): Promise<AgentResult> {
    this.addMessage('user', initialMessage);
    
    while (this.iteration < this.maxIterations) {
      this.iteration++;
      
      const response = await this.step();
      
      if (response.finalResult) {
        return {
          success: true,
          message: response.finalResult as string,
          iterations: this.iteration,
          metadata: response.metadata,
        };
      }
      
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          const result = await this.executeTool(toolCall);
          this.addToolResult(toolCall.id, toolCall.function.name, result);
        }
      } else {
        break;
      }
    }

    const lastAssistantMessage = this.messages.filter(m => m.role === 'assistant').pop();
    return {
      success: false,
      message: lastAssistantMessage?.content || 'Agent execution stopped without result',
      iterations: this.iteration,
    };
  }

  protected abstract step(): Promise<{
    toolCalls?: LLMToolCall[];
    finalResult?: string;
    metadata?: Record<string, any>;
  }>;

  protected async executeTool(toolCall: LLMToolCall): Promise<ToolResult> {
    try {
      const args = JSON.parse(toolCall.function.arguments || '{}');
      return await mcpToolsRegistry.execute(toolCall.function.name, args);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  protected buildLLMParams(): LLMCompletionParams {
    return {
      messages: this.messages.map(m => ({
        role: m.role === 'tool' ? 'assistant' as const : m.role,
        content: m.content,
        ...(m.role === 'assistant' && m.toolCallId ? {} : {}),
      })),
      model: this.config.model || 'ark-code-latest',
      temperature: this.config.temperature ?? 0.2,
      maxTokens: this.config.maxTokens ?? 8192,
      tools: this.tools.length > 0 ? this.tools : undefined,
      toolChoice: 'auto',
      enablePromptCaching: this.config.enablePromptCaching ?? true,
    };
  }

  protected extractToolCalls(response: import('../llm-adapters/base-llm-adapter').LLMCompletionResponse): LLMToolCall[] {
    const toolCalls = response.choices[0]?.message?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      return toolCalls;
    }

    const content = response.choices[0]?.message?.content || '';
    const toolCallMatch = content.match(/\{[\s\S]*"tool_calls"[\s\S]*\}/);
    
    if (toolCallMatch) {
      try {
        const parsed = JSON.parse(toolCallMatch[0]);
        if (parsed.tool_calls) {
          return parsed.tool_calls.map((tc: any, idx: number) => ({
            id: tc.id || `call_${Date.now()}_${idx}`,
            type: 'function',
            function: {
              name: tc.function?.name || tc.name || '',
              arguments: typeof tc.function?.arguments === 'string' 
                ? tc.function.arguments 
                : JSON.stringify(tc.function?.arguments || tc.arguments || {}),
            },
          }));
        }
      } catch {
        // Ignore parse errors
      }
    }

    return [];
  }

  protected extractFinalResult(content: string): string | null {
    const match = content.match(/<final>([\s\S]*?)<\/final>/);
    return match ? match[1].trim() : null;
  }

  protected toLLMMessage(msg: AgentMessage): LLMMessage {
    return {
      role: msg.role === 'tool' ? 'assistant' : msg.role,
      content: msg.content,
    };
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  public reset(): void {
    this.messages = this.messages.filter(m => m.role === 'system');
    this.iteration = 0;
  }

  public getMessages(): AgentMessage[] {
    return [...this.messages];
  }
}
