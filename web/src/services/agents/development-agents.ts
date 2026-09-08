import { 
  BaseAgent, 
  AgentConfig, 
  AgentResult,
  AgentExecutor,
} from './agent-framework';
import { LLMToolCall} from '../llm-adapters/base-llm-adapter';
import { mcpToolsRegistry } from './mcp/mcp-tools-registry';

export class CodeReviewAgent extends BaseAgent {
  constructor(executor: AgentExecutor) {
    const config: AgentConfig = {
      name: '代码审查助手',
      description: '专业的代码审查专家，擅长发现代码问题、提出改进建议和代码优化方案',
      model: 'MiniMax-M2.5-highspeed',
      temperature: 0.1,
      maxTokens: 4096,
      systemPrompt: `你是一个专业的代码审查专家。`,
      tools: mcpToolsRegistry.getToolsByCategory('code-analysis').map(t => t.definition),
      maxIterations: 5,
      enablePromptCaching: true,
    };
    super(config, executor);
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

  public async reviewCode(code: string, language?: string): Promise<AgentResult> {
    return this.run(`请审查以下代码：\n\`\`\`${language || ''}\n${code}\n\`\`\``);
  }
}

export class BugFixAgent extends BaseAgent {
  constructor(executor: AgentExecutor) {
    const allTools = [
      ...mcpToolsRegistry.getToolsByCategory('debugging'),
      ...mcpToolsRegistry.getToolsByCategory('code-analysis'),
      ...mcpToolsRegistry.getToolsByCategory('file-operation'),
    ];
    
    const config: AgentConfig = {
      name: 'Bug 修复助手',
      description: '专业的 Bug 修复专家，能够分析错误原因并提供修复方案',
      model: 'MiniMax-M2.5-highspeed',
      temperature: 0.1,
      maxTokens: 4096,
      systemPrompt: `你是一个专业的 Bug 修复专家。`,
      tools: allTools.map(t => t.definition),
      maxIterations: 8,
      enablePromptCaching: true,
    };
    super(config, executor);
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

  public async fixBug(error: string, stack?: string, context?: string): Promise<AgentResult> {
    let prompt = `请帮我修复以下错误：\n错误信息: ${error}`;
    if (stack) prompt += `\n堆栈信息:\n${stack}`;
    if (context) prompt += `\n相关代码:\n${context}`;
    return this.run(prompt);
  }
}

export class FeatureAgent extends BaseAgent {
  constructor(executor: AgentExecutor) {
    const allTools = [
      ...mcpToolsRegistry.getToolsByCategory('code-generation'),
      ...mcpToolsRegistry.getToolsByCategory('file-operation'),
      ...mcpToolsRegistry.getToolsByCategory('search'),
    ];
    
    const config: AgentConfig = {
      name: '功能开发助手',
      description: '专业的功能开发工程师，能够根据需求实现完整的功能模块',
      model: 'ark-code-latest',
      temperature: 0.2,
      maxTokens: 8192,
      systemPrompt: `你是一个专业的功能开发工程师。`,
      tools: allTools.length > 0 ? allTools.map(t => t.definition) : [],
      maxIterations: 15,
      enablePromptCaching: true,
    };
    super(config, executor);
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

  public async implementFeature(requirement: string): Promise<AgentResult> {
    return this.run(`请帮我实现以下功能：\n${requirement}`);
  }
}

export class TestAgent extends BaseAgent {
  constructor(executor: AgentExecutor) {
    const allTools = [
      ...mcpToolsRegistry.getToolsByCategory('testing'),
      ...mcpToolsRegistry.getToolsByCategory('code-analysis'),
      ...mcpToolsRegistry.getToolsByCategory('file-operation'),
    ];
    
    const config: AgentConfig = {
      name: '测试生成助手',
      description: '专业的测试工程师，能够为代码生成全面的单元测试和集成测试',
      model: 'MiniMax-M2.5-highspeed',
      temperature: 0.1,
      maxTokens: 8192,
      systemPrompt: `你是一个专业的测试工程师。`,
      tools: allTools.length > 0 ? allTools.map(t => t.definition) : [],
      maxIterations: 10,
      enablePromptCaching: true,
    };
    super(config, executor);
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

  public async generateTests(code: string, framework?: string): Promise<AgentResult> {
    let prompt = `请为以下代码生成测试：\n\`\`\`\n${code}\n\`\`\``;
    if (framework) prompt += `\n测试框架: ${framework}`;
    return this.run(prompt);
  }
}

export class DocAgent extends BaseAgent {
  constructor(executor: AgentExecutor) {
    const allTools = [
      ...mcpToolsRegistry.getToolsByCategory('documentation'),
      ...mcpToolsRegistry.getToolsByCategory('code-analysis'),
      ...mcpToolsRegistry.getToolsByCategory('file-operation'),
    ];
    
    const config: AgentConfig = {
      name: '文档生成助手',
      description: '专业的技术文档工程师，能够生成清晰、全面的代码文档',
      model: 'ark-code-latest',
      temperature: 0.2,
      maxTokens: 8192,
      systemPrompt: `你是一个专业的技术文档工程师。`,
      tools: allTools.length > 0 ? allTools.map(t => t.definition) : [],
      maxIterations: 8,
      enablePromptCaching: true,
    };
    super(config, executor);
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

  public async generateDocs(code: string, format?: string): Promise<AgentResult> {
    let prompt = `请为以下代码生成文档：\n\`\`\`\n${code}\n\`\`\``;
    if (format) prompt += `\n文档格式: ${format}`;
    return this.run(prompt);
  }
}

export class RefactorAgent extends BaseAgent {
  constructor(executor: AgentExecutor) {
    const allTools = [
      ...mcpToolsRegistry.getToolsByCategory('refactoring'),
      ...mcpToolsRegistry.getToolsByCategory('code-analysis'),
      ...mcpToolsRegistry.getToolsByCategory('file-operation'),
    ];
    
    const config: AgentConfig = {
      name: '重构优化助手',
      description: '专业的代码重构专家，能够优化代码结构、提高可维护性和性能',
      model: 'MiniMax-M2.5-highspeed',
      temperature: 0.1,
      maxTokens: 8192,
      systemPrompt: `你是一个专业的代码重构专家。`,
      tools: allTools.length > 0 ? allTools.map(t => t.definition) : [],
      maxIterations: 10,
      enablePromptCaching: true,
    };
    super(config, executor);
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

  public async refactorCode(code: string, goal?: string): Promise<AgentResult> {
    let prompt = `请重构以下代码`;
    if (goal) prompt += `，目标: ${goal}`;
    prompt += `:\n\`\`\`\n${code}\n\`\`\``;
    return this.run(prompt);
  }
}

export class ArchitectureAgent extends BaseAgent {
  constructor(executor: AgentExecutor) {
    const allTools = [
      ...mcpToolsRegistry.getToolsByCategory('code-analysis'),
      ...mcpToolsRegistry.getToolsByCategory('search'),
      ...mcpToolsRegistry.getToolsByCategory('file-operation'),
    ];
    
    const config: AgentConfig = {
      name: '架构设计助手',
      description: '专业的架构师，能够设计系统架构、提出技术方案和架构优化建议',
      model: 'ark-code-latest',
      temperature: 0.3,
      maxTokens: 8192,
      systemPrompt: `你是一个专业的系统架构师。`,
      tools: allTools.length > 0 ? allTools.map(t => t.definition) : [],
      maxIterations: 12,
      enablePromptCaching: true,
    };
    super(config, executor);
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

  public async designArchitecture(requirement: string): Promise<AgentResult> {
    return this.run(`请设计系统架构：\n${requirement}`);
  }
}
