import { LLMToolDefinition } from '../../llm-adapters/base-llm-adapter';

export interface MCPTool {
  definition: LLMToolDefinition;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
  description: string;
  category: ToolCategory;
  parameters?: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
  metadata?: {
    executionTime?: number;
    tokens?: number;
  };
}

export type ToolCategory = 
  | 'code-analysis'
  | 'code-generation'
  | 'testing'
  | 'documentation'
  | 'refactoring'
  | 'search'
  | 'file-operation'
  | 'git-operation'
  | 'debugging'
  | 'general';

export interface ToolExecutionContext {
  userId?: string;
  sessionId?: string;
  projectPath?: string;
  fileSystem?: FileSystemAccess;
  gitAccess?: GitAccess;
}

export interface FileSystemAccess {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  readDir: (path: string) => Promise<string[]>;
  exists: (path: string) => Promise<boolean>;
}

export interface GitAccess {
  getCurrentBranch: () => Promise<string>;
  getDiff: (path?: string) => Promise<string>;
  getStatus: () => Promise<string>;
  getLog: (count?: number) => Promise<string>;
}

class MCPToolsRegistry {
  private static instance: MCPToolsRegistry;
  private tools: Map<string, MCPTool> = new Map();
  private context: ToolExecutionContext = {};

  private constructor() {
    this.registerBuiltInTools();
  }

  public static getInstance(): MCPToolsRegistry {
    if (!MCPToolsRegistry.instance) {
      MCPToolsRegistry.instance = new MCPToolsRegistry();
    }
    return MCPToolsRegistry.instance;
  }

  public setContext(ctx: ToolExecutionContext): void {
    this.context = { ...this.context, ...ctx };
  }

  public getContext(): ToolExecutionContext {
    return this.context;
  }

  public register(tool: MCPTool): void {
    const toolName = tool.definition.function.name;
    if (this.tools.has(toolName)) {
      console.warn(`[MCPTools] Tool "${toolName}" is already registered. Overwriting.`);
    }
    this.tools.set(toolName, tool);
    // console.log(`[MCPTools] Registered tool: ${toolName} (${tool.category})`);
  }

  public unregister(toolName: string): boolean {
    return this.tools.delete(toolName);
  }

  public getTool(toolName: string): MCPTool | undefined {
    return this.tools.get(toolName);
  }

  public getAllTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  public getToolsByCategory(category: ToolCategory): MCPTool[] {
    return this.getAllTools().filter(tool => tool.category === category);
  }

  public getToolDefinitions(): LLMToolDefinition[] {
    return this.getAllTools().map(tool => tool.definition);
  }

  public async execute(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool "${toolName}" not found`,
      };
    }

    const startTime = Date.now();
    try {
      const result = await tool.handler(args);
      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }
  }

  public async executeBatch(
    calls: Array<{ toolName: string; args: Record<string, unknown> }>
  ): Promise<ToolResult[]> {
    return Promise.all(
      calls.map(({ toolName, args }) => this.execute(toolName, args))
    );
  }

  private registerBuiltInTools(): void {
    this.registerCodeAnalysisTools();
    this.registerSearchTools();
    this.registerFileOperationTools();
    this.registerGitTools();
    this.registerDebuggingTools();
  }

  private registerCodeAnalysisTools(): void {
    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'analyze_code',
          description: '分析代码结构、复杂度和技术栈',
          parameters: {
            type: 'object',
            properties: {
              code: { type: 'string', description: '要分析的代码' },
              language: { type: 'string', description: '编程语言', enum: ['typescript', 'javascript', 'python', 'go', 'rust'] },
            },
            required: ['code'],
          },
        },
      },
      handler: async (args) => {
        const { code, language } = args as { code: string; language?: string };
        const lines = code.split('\n').length;
        const complexity = this.estimateComplexity(code);
        const patterns = this.detectPatterns(code);
        
        return {
          success: true,
          result: {
            lines,
            complexity,
            patterns,
            language: language || 'unknown',
            suggestions: this.generateSuggestions(code, complexity),
          },
        };
      },
      description: '分析代码结构和复杂度',
      category: 'code-analysis',
    });

    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'find_issues',
          description: '查找代码中的潜在问题、bug 和代码异味',
          parameters: {
            type: 'object',
            properties: {
              code: { type: 'string', description: '要检查的代码' },
              severity: { 
                type: 'string', 
                description: '问题严重程度',
                enum: ['error', 'warning', 'info'],
                default: 'warning'
              },
            },
            required: ['code'],
          },
        },
      },
      handler: async (args) => {
        const { code, severity = 'warning' } = args as { code: string; severity?: string };
        const issues: Array<{ line: number; severity: string; message: string; rule: string }> = [];
        
        const lines = code.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes('// TODO') || line.includes('// FIXME')) {
            issues.push({
              line: idx + 1,
              severity: 'info',
              message: line.trim(),
              rule: 'todo-comment',
            });
          }
          if (line.includes('any') && severity !== 'info') {
            issues.push({
              line: idx + 1,
              severity,
              message: 'Avoid using "any" type',
              rule: 'no-any',
            });
          }
          if (line.length > 120 && severity !== 'info') {
            issues.push({
              line: idx + 1,
              severity: 'info',
              message: 'Line exceeds 120 characters',
              rule: 'max-line-length',
            });
          }
        });

        return {
          success: true,
          result: {
            issues,
            summary: { total: issues.length, bySeverity: this.countBySeverity(issues) },
          },
        };
      },
      description: '查找代码问题',
      category: 'code-analysis',
    });

    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'explain_code',
          description: '解释代码的功能和工作原理',
          parameters: {
            type: 'object',
            properties: {
              code: { type: 'string', description: '要解释的代码' },
              level: { 
                type: 'string', 
                description: '解释详细程度',
                enum: ['brief', 'detailed', 'comprehensive'],
                default: 'detailed'
              },
            },
            required: ['code'],
          },
        },
      },
      handler: async (args) => {
        const { code, level = 'detailed' } = args as { code: string; level?: string };
        const firstLine = code.split('\n')[0].trim();
        const hasFunction = /^(function|const|let|var|class|interface|type|export|import)/.test(firstLine);
        
        let explanation: string;
        if (level === 'brief') {
          explanation = `此代码段${hasFunction ? '定义了' : '包含'}一段逻辑实现。`;
        } else if (level === 'detailed') {
          explanation = this.generateDetailedExplanation(code);
        } else {
          explanation = this.generateComprehensiveExplanation(code);
        }

        return {
          success: true,
          result: { explanation, level, codePreview: firstLine },
        };
      },
      description: '解释代码功能',
      category: 'code-analysis',
    });
  }

  private registerSearchTools(): void {
    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'search_code',
          description: '在代码库中搜索特定模式、函数或关键词',
          parameters: {
            type: 'object',
            properties: {
              pattern: { type: 'string', description: '搜索模式或正则表达式' },
              files: { type: 'array', items: { type: 'string' }, description: '要搜索的文件列表' },
              caseSensitive: { type: 'boolean', description: '是否区分大小写', default: false },
            },
            required: ['pattern'],
          },
        },
      },
      handler: async (args) => {
        const { pattern } = args as { pattern: string; caseSensitive?: boolean };
        
        return {
          success: true,
          result: {
            message: 'Code search requires file system access. Please use read_file tool to read specific files.',
            pattern,
            suggestion: 'Use grep or search in IDE for best results.',
          },
        };
      },
      description: '搜索代码',
      category: 'search',
    });

    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'find_related_files',
          description: '查找与给定文件相关的文件（如导入、引用等）',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: '文件路径' },
              type: { 
                type: 'string', 
                description: '查找类型',
                enum: ['imports', 'references', 'tests', 'exports'],
              },
            },
            required: ['filePath'],
          },
        },
      },
      handler: async (args) => {
        const { filePath, type = 'imports' } = args as { filePath: string; type?: string };
        
        return {
          success: true,
          result: {
            filePath,
            type,
            relatedFiles: [],
            message: `Found ${type} for ${filePath}`,
          },
        };
      },
      description: '查找相关文件',
      category: 'search',
    });
  }

  private registerFileOperationTools(): void {
    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'read_file',
          description: '读取文件内容',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: '文件路径' },
              maxLines: { type: 'number', description: '最大行数', default: 500 },
            },
            required: ['path'],
          },
        },
      },
      handler: async (args) => {
        const { path } = args as { path: string };
        
        if (!this.context.fileSystem) {
          return {
            success: false,
            error: 'File system access not configured. Set context.fileSystem to enable file operations.',
          };
        }

        try {
          const content = await this.context.fileSystem.readFile(path);
          return {
            success: true,
            result: { path, content, size: content.length },
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
      description: '读取文件',
      category: 'file-operation',
    });

    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'write_file',
          description: '写入文件内容（创建或覆盖）',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: '文件路径' },
              content: { type: 'string', description: '文件内容' },
              createDirs: { type: 'boolean', description: '是否自动创建目录', default: true },
            },
            required: ['path', 'content'],
          },
        },
      },
      handler: async (args) => {
        const { path, content } = args as { path: string; content: string; createDirs?: boolean };
        
        if (!this.context.fileSystem) {
          return {
            success: false,
            error: 'File system access not configured. Set context.fileSystem to enable file operations.',
          };
        }

        try {
          await this.context.fileSystem.writeFile(path, content);
          return {
            success: true,
            result: { path, bytesWritten: content.length },
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
      description: '写入文件',
      category: 'file-operation',
    });

    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'list_directory',
          description: '列出目录中的文件和子目录',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: '目录路径' },
              recursive: { type: 'boolean', description: '是否递归列出', default: false },
            },
            required: ['path'],
          },
        },
      },
      handler: async (args) => {
        const { path } = args as { path: string; recursive?: boolean };
        
        if (!this.context.fileSystem) {
          return {
            success: false,
            error: 'File system access not configured. Set context.fileSystem to enable file operations.',
          };
        }

        try {
          const entries = await this.context.fileSystem.readDir(path);
          return {
            success: true,
            result: { path, entries, count: entries.length },
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
      description: '列出目录',
      category: 'file-operation',
    });
  }

  private registerGitTools(): void {
    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'git_status',
          description: '获取 Git 仓库状态',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      handler: async () => {
        if (!this.context.gitAccess) {
          return {
            success: false,
            error: 'Git access not configured. Set context.gitAccess to enable git operations.',
          };
        }

        try {
          const status = await this.context.gitAccess.getStatus();
          return {
            success: true,
            result: { status },
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to get git status: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
      description: 'Git 状态',
      category: 'git-operation',
    });

    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'git_diff',
          description: '获取 Git diff',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: '文件路径（可选）' },
            },
          },
        },
      },
      handler: async (args) => {
        const { path } = args as { path?: string };
        
        if (!this.context.gitAccess) {
          return {
            success: false,
            error: 'Git access not configured. Set context.gitAccess to enable git operations.',
          };
        }

        try {
          const diff = await this.context.gitAccess.getDiff(path);
          return {
            success: true,
            result: { diff },
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to get git diff: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
      description: 'Git Diff',
      category: 'git-operation',
    });

    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'git_log',
          description: '获取 Git 提交历史',
          parameters: {
            type: 'object',
            properties: {
              count: { type: 'number', description: '获取的提交数量', default: 10 },
            },
          },
        },
      },
      handler: async (args) => {
        const { count = 10 } = args as { count?: number };
        
        if (!this.context.gitAccess) {
          return {
            success: false,
            error: 'Git access not configured. Set context.gitAccess to enable git operations.',
          };
        }

        try {
          const log = await this.context.gitAccess.getLog(count);
          return {
            success: true,
            result: { log, count },
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to get git log: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
      description: 'Git 日志',
      category: 'git-operation',
    });
  }

  private registerDebuggingTools(): void {
    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'debug_error',
          description: '分析错误信息并提供修复建议',
          parameters: {
            type: 'object',
            properties: {
              error: { type: 'string', description: '错误信息' },
              stack: { type: 'string', description: '错误堆栈' },
              context: { type: 'string', description: '相关代码上下文' },
            },
            required: ['error'],
          },
        },
      },
      handler: async (args) => {
        const { error, stack, context } = args as { error: string; stack?: string; context?: string };
        
        const analysis = this.analyzeError(error, stack);
        
        return {
          success: true,
          result: {
            error,
            analysis,
            suggestions: this.generateFixSuggestions(error, stack, context),
            possibleCauses: analysis.possibleCauses,
            severity: analysis.severity,
          },
        };
      },
      description: '调试错误',
      category: 'debugging',
    });

    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'trace_execution',
          description: '追踪代码执行流程',
          parameters: {
            type: 'object',
            properties: {
              code: { type: 'string', description: '要追踪的代码' },
              startLine: { type: 'number', description: '起始行' },
            },
            required: ['code'],
          },
        },
      },
      handler: async (args) => {
        const { code, startLine = 1 } = args as { code: string; startLine?: number };
        const lines = code.split('\n');
        const trace: Array<{ line: number; code: string; type: string }> = [];
        
        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          let type = 'code';
          
          if (/^(if|elif|else)$/.test(trimmed)) type = 'conditional';
          else if (/^(for|while|do)$/.test(trimmed)) type = 'loop';
          else if (/^(return|break|continue)$/.test(trimmed)) type = 'control-flow';
          else if (/^(function|const|let|var|class|interface)$/.test(trimmed)) type = 'declaration';
          else if (/^import|^export/.test(trimmed)) type = 'import-export';
          
          trace.push({ line: startLine + idx, code: trimmed || '(empty)', type });
        });

        return {
          success: true,
          result: { trace, totalLines: lines.length },
        };
      },
      description: '追踪执行',
      category: 'debugging',
    });
  }

  private estimateComplexity(code: string): string {
    const ifCount = (code.match(/\bif\b/g) || []).length;
    const loopCount = (code.match(/\b(for|while|do)\b/g) || []).length;
    const funcCount = (code.match(/\bfunction\b|=\s*\(/g) || []).length;
    
    const score = ifCount * 2 + loopCount * 3 + funcCount;
    
    if (score < 10) return 'low';
    if (score < 30) return 'medium';
    return 'high';
  }

  private detectPatterns(code: string): string[] {
    const patterns: string[] = [];
    
    if (/useState|useEffect|useCallback|useMemo/.test(code)) patterns.push('react-hooks');
    if (/class\s+\w+\s+extends/.test(code)) patterns.push('oop-inheritance');
    if (/async\s+function|await\s+/.test(code)) patterns.push('async-await');
    if (/=>\s*\{/.test(code)) patterns.push('arrow-functions');
    if (/try\s*\{[\s\S]*?catch/.test(code)) patterns.push('error-handling');
    if (/\?\s*.\s*:\s*./.test(code)) patterns.push('ternary-operator');
    
    return patterns;
  }

  private generateSuggestions(code: string, complexity: string): string[] {
    const suggestions: string[] = [];
    
    if (complexity === 'high') {
      suggestions.push('考虑将复杂函数拆分为更小的函数');
      suggestions.push('使用设计模式来降低复杂度');
    }
    if (/var\s+/.test(code)) {
      suggestions.push('建议使用 const 或 let 替代 var');
    }
    if (!/useCallback|useMemo/.test(code) && /useEffect/.test(code)) {
      suggestions.push('注意 useEffect 依赖项的正确使用');
    }
    
    return suggestions;
  }

  private countBySeverity(issues: Array<{ severity: string }>): Record<string, number> {
    return issues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private generateDetailedExplanation(code: string): string {
    const firstLine = code.split('\n')[0].trim();
    let explanation = '';
    
    if (/^function\s+(\w+)/.test(firstLine)) {
      const match = firstLine.match(/^function\s+(\w+)/);
      explanation = `定义了一个名为 "${match[1]}" 的函数。`;
    } else if (/^const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*)?=>/.test(firstLine)) {
      const match = firstLine.match(/^const\s+(\w+)/);
      explanation = `定义了一个${firstLine.includes('async') ? '异步 ' : ''}箭头函数 "${match[1]}"。`;
    } else if (/^class\s+(\w+)/.test(firstLine)) {
      const match = firstLine.match(/^class\s+(\w+)/);
      explanation = `定义了一个类 "${match[1]}"。`;
    } else if (/^import\s+/.test(firstLine)) {
      explanation = '导入了依赖模块。';
    } else if (/^export\s+/.test(firstLine)) {
      explanation = '导出了模块成员。';
    }
    
    return explanation;
  }

  private generateComprehensiveExplanation(code: string): string {
    return this.generateDetailedExplanation(code) + ' 代码详细分析完成。';
  }

  private analyzeError(error: string, _stack?: string): {
    possibleCauses: string[];
    severity: string;
    category: string;
  } {
    const causes: string[] = [];
    let severity = 'medium';
    const category = 'runtime';

    if (/undefined\s+is\s+not\s+a/.test(error)) {
      causes.push('尝试访问 undefined 或 null 的属性');
      causes.push('变量未正确初始化');
    }
    if (/cannot\s+read\s+property/.test(error)) {
      causes.push('对象可能为 undefined 或 null');
      causes.push('访问了不存在的属性');
    }
    if (/is\s+not\s+a\s+function/.test(error)) {
      causes.push('变量不是函数类型');
      causes.push('函数未正确定义或导入');
    }
    if (/unexpected\s+token/.test(error)) {
      causes.push('语法错误');
      causes.push('缺少分号或括号不匹配');
    }
    if (/timeout|timed\s+out/.test(error.toLowerCase())) {
      causes.push('操作超时');
      causes.push('网络请求过慢');
      severity = 'high';
    }

    return { possibleCauses: causes, severity, category };
  }

  private generateFixSuggestions(error: string, _stack?: string, _context?: string): string[] {
    const suggestions: string[] = [];
    
    if (/undefined\s+is\s+not\s+a/.test(error)) {
      suggestions.push('添加可选链操作符 (?.) 来安全访问属性');
      suggestions.push('使用空值合并运算符 (??) 提供默认值');
    }
    if (/cannot\s+read\s+property/.test(error)) {
      suggestions.push('在访问属性前检查对象是否存在');
      suggestions.push('使用 && 短路运算保护');
    }
    if (/is\s+not\s+a\s+function/.test(error)) {
      suggestions.push('检查函数是否正确定义');
      suggestions.push('确认模块导入正确');
    }
    if (/unexpected\s+token/.test(error)) {
      suggestions.push('检查语法是否正确');
      suggestions.push('确保括号和引号配对');
    }

    return suggestions;
  }
}

export const mcpToolsRegistry = MCPToolsRegistry.getInstance();
export { MCPToolsRegistry };
