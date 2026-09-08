import { BaseAgent, type AgentConfig, type AgentExecutor } from '@/services/agents/agent-framework';
import { canvasAgentRegistry, type CanvasAgentRole } from './canvas-agent-registry';
import type { Edge, Node } from '@xyflow/react';
import { API_BASE_URL } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-check';

export interface NodeExecutionContext {
  node: Node;
  nodes: Node[];
  edges: Edge[];
  params: Record<string, unknown>;
  prompt: string;
  inputImages: string[];
  startImage?: string;
  endImage?: string;
  referenceImage?: string;
  updateNodeData: (id: string, data: Record<string, unknown>) => void;
}

export interface NodeExecutorResult {
  success: boolean;
  resultUrl?: string;
  resultUrls?: string[];
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentStep {
  iteration: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
  timestamp: number;
}

export interface AgentRunResult {
  success: boolean;
  verdict?: 'pass' | 'fail';
  score?: number;
  issues?: string[];
  suggestions?: string[];
  retryPrompt?: string;
  parsedOutput?: Record<string, unknown>;
  steps: AgentStep[];
  iterations: number;
  error?: string;
}

class CanvasAgentExecutor implements AgentExecutor {
  async complete(params: Parameters<AgentExecutor['complete']>[0]) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        ...params,
        stream: false,
        provider: 'minimax',
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || `后端 Agent 请求失败: ${response.status}`);
    }
    return {
      id: `backend-agent-${Date.now()}`,
      object: 'chat.completion' as const,
      created: Math.floor(Date.now() / 1000),
      model: data.model || params.model || 'backend-managed',
      choices: [{
        index: 0,
        message: { role: 'assistant' as const, content: data.content || '', tool_calls: data.toolCalls },
        finish_reason: data.toolCalls?.length ? 'tool_calls' as const : 'stop' as const,
      }],
      usage: data.usage,
    };
  }

  async completeStream(params: Parameters<AgentExecutor['completeStream']>[0], onChunk: Parameters<AgentExecutor['completeStream']>[1]) {
    const result = await this.complete(params);
    onChunk({
      id: result.id,
      object: 'chat.completion.chunk',
      created: result.created,
      model: result.model,
      choices: [{
        index: 0,
        delta: { role: 'assistant', content: result.choices[0]?.message?.content || '' },
        finish_reason: 'stop',
      }],
    });
  }
}

class CanvasAgent extends BaseAgent {
  constructor(config: AgentConfig, executor: AgentExecutor) {
    super(config, executor);
  }

  protected async step(): Promise<{
    toolCalls?: import('@/services/llm-adapters/base-llm-adapter').LLMToolCall[];
    finalResult?: string;
    metadata?: Record<string, unknown>;
  }> {
    const params = this.buildLLMParams();
    const response = await this.executor.complete(params);

    const content = response.choices[0]?.message?.content || '';
    this.addMessage('assistant', content);

    const toolCalls = this.extractToolCalls(response);
    const finalResult = this.extractFinalResult(content);

    return { toolCalls: toolCalls.length > 0 ? toolCalls : undefined, finalResult: finalResult || undefined };
  }
}

class AgentAdapter {
  private executor: CanvasAgentExecutor | null = null;
  private agentCache = new Map<CanvasAgentRole, CanvasAgent>();

  initialize(apiKey: string, baseUrl?: string): void {
    void apiKey;
    void baseUrl;
    this.executor = new CanvasAgentExecutor();
  }

  private ensureExecutor(): CanvasAgentExecutor {
    if (!this.executor) {
      throw new Error('AgentAdapter 未初始化，请先调用 initialize()');
    }
    return this.executor;
  }

  getAgent(role: CanvasAgentRole): CanvasAgent {
    const cached = this.agentCache.get(role);
    if (cached) {
      cached.reset();
      return cached;
    }

    const config = canvasAgentRegistry.toAgentConfig(role);
    if (!config) throw new Error(`未找到 Agent manifest: ${role}`);

    const executor = this.ensureExecutor();
    const agent = new CanvasAgent(config, executor);
    this.agentCache.set(role, agent);
    return agent;
  }

  async runAgent(
    role: CanvasAgentRole,
    message: string,
    onStep?: (step: AgentStep) => void,
  ): Promise<AgentRunResult> {
    const agent = this.getAgent(role);
    const steps: AgentStep[] = [];

    try {
      const result = await agent.run(message);

      for (const msg of agent.getMessages()) {
        const step: AgentStep = {
          iteration: steps.length,
          role: msg.role as AgentStep['role'],
          content: msg.content,
          toolName: msg.toolName,
          timestamp: msg.timestamp?.getTime() ?? Date.now(),
        };
        steps.push(step);
        onStep?.(step);
      }

      const parsedOutput = this.parseFinalResult(result.message);
      const reviewerVerdict = role === 'reviewer' ? this.extractVerdict(parsedOutput) : undefined;

      return {
        success: result.success,
        verdict: reviewerVerdict?.verdict,
        score: reviewerVerdict?.score,
        issues: reviewerVerdict?.issues,
        suggestions: reviewerVerdict?.suggestions,
        retryPrompt: reviewerVerdict?.retryPrompt,
        parsedOutput,
        steps,
        iterations: result.iterations,
      };
    } catch (error) {
      return {
        success: false,
        steps,
        iterations: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async executeAsNode(
    role: CanvasAgentRole,
    ctx: NodeExecutionContext,
  ): Promise<NodeExecutorResult> {
    const manifest = canvasAgentRegistry.get(role);
    if (!manifest) {
      return { success: false, error: `未找到 Agent: ${role}` };
    }

    const prompt = ctx.prompt || (ctx.params.prompt as string) || '';
    if (!prompt) {
      return { success: false, error: 'Agent 需要输入提示词' };
    }

    const result = await this.runAgent(role, prompt);

    if (result.parsedOutput) {
      const updates: Record<string, unknown> = {};
      if (typeof result.parsedOutput.prompt === 'string') updates.prompt = result.parsedOutput.prompt;
      if (typeof result.parsedOutput.negativePrompt === 'string') updates.negativePrompt = result.parsedOutput.negativePrompt;
      if (typeof result.parsedOutput.modelId === 'string') updates.modelId = result.parsedOutput.modelId;
      if (typeof result.parsedOutput.aspectRatio === 'string') updates.aspectRatio = result.parsedOutput.aspectRatio;
      if (typeof result.parsedOutput.content === 'string') updates.agentOutput = result.parsedOutput.content;

      if (Object.keys(updates).length > 0) {
        ctx.updateNodeData(ctx.node.id, { params: { ...ctx.params, ...updates } });
      }
    }

    return {
      success: result.success,
      metadata: {
        agentRole: role,
        iterations: result.iterations,
        verdict: result.verdict,
        score: result.score,
        steps: result.steps.length,
      },
      error: result.error,
    };
  }

  private parseFinalResult(message: string): Record<string, unknown> | undefined {
    try {
      const jsonMatch = message.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? parsed as Record<string, unknown>
          : undefined;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  private extractVerdict(parsed?: Record<string, unknown>): {
    verdict: 'pass' | 'fail';
    score?: number;
    issues?: string[];
    suggestions?: string[];
    retryPrompt?: string;
  } | undefined {
    if (!parsed) return undefined;
    if (parsed.verdict !== 'pass' && parsed.verdict !== 'fail') return undefined;
    return {
      verdict: parsed.verdict as 'pass' | 'fail',
      score: typeof parsed.score === 'number' ? parsed.score : undefined,
      issues: Array.isArray(parsed.issues) ? parsed.issues : undefined,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : undefined,
      retryPrompt: typeof parsed.retryPrompt === 'string' ? parsed.retryPrompt : undefined,
    };
  }
}

export const agentAdapter = new AgentAdapter();
