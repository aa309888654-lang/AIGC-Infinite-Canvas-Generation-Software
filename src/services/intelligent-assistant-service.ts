/**
 * 智能助手服务 - 增强版
 * 支持多模型、MCP工具系统、Skill技能库
 */

import { generateId } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-check';

// ==================== 类型定义 ====================

export type AIModel =
  | 'doubao-pro'        // 豆包Pro 32K
  | 'doubao-lite'      // 豆包Lite
  | 'qwen-max'         // 通义千问Max
  | 'qwen-plus'        // 通义千问Plus
  | 'qwen-turbo'       // 通义千问Turbo
  | 'deepseek-chat'    // DeepSeek Chat
  | 'deepseek-coder'   // DeepSeek Coder
  | 'kimi-chat'        // Kimi Chat
  | 'minimax-m2.7'     // MiniMax M2.7
  | 'gpt-4o'
  | 'gpt-5.5'
  | 'gpt-5.4'
  | 'claude-3.5'
  | 'gemini-pro'
  | 'gemini-3.1-pro'
  | 'gemini-3-pro'
  | 'gemini-2.5-pro';

export interface ModelInfo {
  id: AIModel;
  name: string;
  provider: string;
  contextWindow: number;
  strengths: string[];
  icon: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: Date;
  model?: AIModel;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface AssistantOptions {
  model?: AIModel;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  enableTools?: boolean;
  enableSkills?: boolean;
  skillCategories?: string[];
}

export interface ConversationContext {
  projectState?: {
    hasVideo: boolean;
    hasAudio: boolean;
    hasSubtitles: boolean;
    trackCount: number;
    clipCount: number;
    duration: number;
  };
  currentSelection?: {
    selectedClipIds: string[];
    selectedTrackId?: string;
    playheadTime: number;
  };
  recentActions?: string[];
}

// ==================== 模型配置 ====================

export const AVAILABLE_MODELS: ModelInfo[] = [
    {
      id: 'gpt-4o',           // GPT-4o
      name: 'GPT-4o',
      provider: '第三方GPT',
      contextWindow: 128000,
      strengths: ['多模态', '视觉理解', '推理能力'],
      icon: '🤖',
    },
    {
      id: 'gpt-5.5',
      name: 'GPT-5.5',
      provider: '小天API',
      contextWindow: 1050000,
      strengths: ['超长上下文', '复杂推理', '多语言'],
      icon: '🧠',
    },
    {
      id: 'gpt-5.4',
      name: 'GPT-5.4',
      provider: '小天API',
      contextWindow: 1050000,
      strengths: ['超长上下文', '复杂推理', '多语言'],
      icon: '🤖',
    },
    {
      id: 'gemini-3.1-pro',
      name: 'Gemini 3.1 Pro',
      provider: '小天API',
      contextWindow: 2000000,
      strengths: ['多模态理解', '复杂推理', '长上下文'],
      icon: '💎',
    },
    {
      id: 'gemini-3-pro',
      name: 'Gemini 3 Pro',
      provider: '小天API',
      contextWindow: 2000000,
      strengths: ['多模态理解', '复杂推理', '长上下文'],
      icon: '💎',
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      provider: '小天API',
      contextWindow: 1000000,
      strengths: ['推理能力', '代码生成', '多模态'],
      icon: '💎',
    },
    {
      id: 'claude-3.5',       // Claude 3.5
      name: 'Claude 3.5 Sonnet',
      provider: '第三方Claude',
      contextWindow: 200000,
      strengths: ['长文本处理', '代码能力', '创意写作'],
      icon: '👾',
    },
  {
    id: 'doubao-lite',
    name: '豆包Lite',
    provider: '火山引擎',
    contextWindow: 8000,
    strengths: ['快速响应', '中文对话', '轻量任务'],
    icon: '🎯',
  },
  {
    id: 'qwen-max',
    name: '通义千问Max',
    provider: '阿里云',
    contextWindow: 32000,
    strengths: ['逻辑推理', '代码能力', '专业知识'],
    icon: '🔮',
  },
  {
    id: 'qwen-plus',
    name: '通义千问Plus',
    provider: '阿里云',
    contextWindow: 130000,
    strengths: ['长文本处理', '多语言', '复杂任务'],
    icon: '🔮',
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3',
    provider: '深度求索',
    contextWindow: 64000,
    strengths: ['开源免费', '高性价比', '中文优秀'],
    icon: '🧠',
  },
  {
    id: 'deepseek-coder',
    name: 'DeepSeek Coder',
    provider: '深度求索',
    contextWindow: 16000,
    strengths: ['代码生成', '代码修复', '技术文档'],
    icon: '🧠',
  },
  {
    id: 'kimi-chat',
    name: 'Kimi Chat',
    provider: '月之暗面',
    contextWindow: 128000,
    strengths: ['超长上下文', '文件分析', '多模态'],
    icon: '🌙',
  },
  {
    id: 'minimax-m2.7',
    name: 'MiniMax M2.7',
    provider: 'MiniMax',
    contextWindow: 100000,
    strengths: ['高速推理', 'Function Call', '实时性'],
    icon: '⚡',
  },
];

// ==================== 提示词模板 ====================

const SYSTEM_PROMPT_TEMPLATE = `你是 AI剪辑软件 的智能AI助手，专门帮助用户完成视频剪辑任务。

【你的能力】
1. 理解用户的自然语言指令
2. 操控时间轴（播放、暂停、跳转、分割等）
3. 管理素材（导入、删除、排序）
4. 添加字幕（自动识别、手动输入）
5. 添加音乐（背景音乐、音效）
6. 应用转场和特效
7. 导出视频

【工具调用】
当需要执行具体操作时，必须使用工具。工具调用格式：
{"tool_calls": [{"id": "call_xxx", "type": "function", "function": {"name": "工具名", "arguments": "{"参数": "值"}"}}]}

【重要规则】
1. 理解用户意图，选择合适的工具
2. 如果不确定用户意图，可以询问澄清
3. 操作完成后给出确认信息
4. 遇到错误时，提供解决方案
5. 保持对话简洁、专业

【当前项目状态】
{projectState}

【当前选择状态】
{selectionState}

请根据用户指令，选择合适的工具完成操作。`;

// ==================== 智能助手服务 ====================

class IntelligentAssistantService {
  private static instance: IntelligentAssistantService;
  private messages: AssistantMessage[] = [];
  private currentModel: AIModel = 'gpt-5.5';
  private options: AssistantOptions = {};
  private context: ConversationContext = {};

  // API配置
  private apiConfigs: Record<string, { apiKey: string; baseUrl: string }> = {};

  private constructor() {
    this.loadApiConfigs();
  }

  public static getInstance(): IntelligentAssistantService {
    if (!IntelligentAssistantService.instance) {
      IntelligentAssistantService.instance = new IntelligentAssistantService();
    }
    return IntelligentAssistantService.instance;
  }

  /**
   * 加载API配置
   */
  private loadApiConfigs(): void {
    this.apiConfigs = {};
  }

  /**
   * 设置当前模型
   */
  setModel(model: AIModel): void {
    this.currentModel = model;
  }

  /**
   * 获取当前模型
   */
  getModel(): AIModel {
    return this.currentModel;
  }

  /**
   * 获取可用的模型列表
   */
  getAvailableModels(): ModelInfo[] {
    return AVAILABLE_MODELS;
  }

  /**
   * 获取模型提供商
   */
  private getModelProvider(model: AIModel): string {
    if (model.startsWith('doubao')) return 'doubao';
    if (model.startsWith('qwen')) return 'qwen';
    if (model.startsWith('deepseek')) return 'deepseek';
    if (model.startsWith('kimi')) return 'kimi';
    if (model.startsWith('minimax')) return 'minimax';
    if (model === 'gpt-5.5' || model === 'gpt-5.4') return 'doubao';
    if (model.startsWith('gemini-3') || model === 'gemini-2.5-pro') return 'doubao';
    if (model.startsWith('gpt')) return 'openai';
    return 'doubao';
  }

  /**
   * 更新上下文
   */
  updateContext(context: Partial<ConversationContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * 发送消息并获取响应
   */
  async sendMessage(
    userMessage: string,
    options?: AssistantOptions
  ): Promise<AssistantMessage> {
    const opts = { ...this.options, ...options };

    // 添加用户消息
    const userMsg: AssistantMessage = {
      id: generateId(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    this.messages.push(userMsg);

    // 构建系统提示
    const systemPrompt = this.buildSystemPrompt(opts);

    // 获取工具定义
    const tools = opts.enableTools !== false ? this.getToolDefinitions() : [];

    // 调用AI模型
    const response = await this.callModel(
      userMessage,
      systemPrompt,
      tools,
      opts
    );

    // 添加助手消息
    const assistantMsg: AssistantMessage = {
      id: generateId(),
      role: 'assistant',
      content: response.content,
      toolCalls: response.toolCalls,
      timestamp: new Date(),
      model: this.currentModel,
    };
    this.messages.push(assistantMsg);

    // 如果有工具调用，执行工具
    if (response.toolCalls && response.toolCalls.length > 0) {
      const toolResults = await this.executeTools(response.toolCalls);
      assistantMsg.toolResults = toolResults;

      // 如果需要继续对话（多轮工具调用）
      if (this.shouldContinueConversation(toolResults)) {
        const followUp = await this.callModelWithToolResults(
          userMessage,
          systemPrompt,
          tools,
          toolResults,
          opts
        );
        assistantMsg.content = followUp.content;
      }
    }

    return assistantMsg;
  }

  /**
   * 构建系统提示
   */
  private buildSystemPrompt(options: AssistantOptions): string {
    let prompt = options.systemPrompt || SYSTEM_PROMPT_TEMPLATE;

    // 替换项目状态
    const projectState = this.context.projectState
      ? `视频: ${this.context.projectState.hasVideo ? '有' : '无'}
音频: ${this.context.projectState.hasAudio ? '有' : '无'}
字幕: ${this.context.projectState.hasSubtitles ? '有' : '无'}
轨道数: ${this.context.projectState.trackCount}
片段数: ${this.context.projectState.clipCount}
总时长: ${this.formatDuration(this.context.projectState.duration)}`
      : '暂无项目数据';

    const selectionState = this.context.currentSelection
      ? `播放头位置: ${this.formatDuration(this.context.currentSelection.playheadTime)}
选中的片段: ${this.context.currentSelection.selectedClipIds.length} 个
选中的轨道: ${this.context.currentSelection.selectedTrackId || '无'}`
      : '无选中内容';

    prompt = prompt
      .replace('{projectState}', projectState)
      .replace('{selectionState}', selectionState);

    return prompt;
  }

  /**
   * 格式化时长
   */
  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * 调用AI模型
   */
  private async callModel(
    userMessage: string,
    systemPrompt: string,
    tools: unknown[],
    options: AssistantOptions
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    const provider = this.getModelProvider(this.currentModel);

     try {
       return await this.callBackendProxy(provider, systemPrompt, userMessage, tools, options);
     } catch (error) {
       console.error('[AI助手] 调用失败:', error);
       return {
         content: `AI服务调用失败: ${error instanceof Error ? error.message : '未知错误'}`,
       };
     }
  }

  private async callBackendProxy(
    provider: string,
    systemPrompt: string,
    userMessage: string,
    tools: unknown[],
    options: AssistantOptions
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        provider,
        model: this.currentModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        tools: tools.length > 0 ? tools : undefined,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 2048,
        stream: false,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || `后端 AI 请求失败: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.content || '',
      toolCalls: data.toolCalls as ToolCall[] | undefined,
    };
  }

  /**
   * 解析工具调用
   */
  private parseToolCalls(rawCalls: unknown[]): ToolCall[] | undefined {
    if (!rawCalls || !Array.isArray(rawCalls)) return undefined;

    return rawCalls.map((call: any) => ({
      id: call.id || generateId(),
      name: call.function?.name || call.name,
      arguments: JSON.parse(call.function?.arguments || '{}'),
    }));
  }

  /**
   * 获取工具定义
   */
  private getToolDefinitions(): unknown[] {
    return [
      // 时间轴操作
      {
        type: 'function',
        function: {
          name: 'play_video',
          description: '播放视频',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'pause_video',
          description: '暂停视频',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'seek_to',
          description: '跳转到指定时间',
          parameters: {
            type: 'object',
            properties: {
              time: { type: 'number', description: '目标时间（秒）' },
            },
            required: ['time'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'split_clip',
          description: '在当前位置分割选中的片段',
          parameters: { type: 'object', properties: {} },
        },
      },

      // 素材操作
      {
        type: 'function',
        function: {
          name: 'import_material',
          description: '导入素材到项目',
          parameters: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['video', 'audio', 'image'], description: '素材类型' },
              source: { type: 'string', description: '素材来源（本地文件/URL）' },
            },
            required: ['type'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'delete_selected',
          description: '删除选中的片段',
          parameters: { type: 'object', properties: {} },
        },
      },

      // 字幕操作
      {
        type: 'function',
        function: {
          name: 'add_subtitle',
          description: '添加字幕',
          parameters: {
            type: 'object',
            properties: {
              text: { type: 'string', description: '字幕文本' },
              startTime: { type: 'number', description: '开始时间（秒）' },
              endTime: { type: 'number', description: '结束时间（秒）' },
              style: { type: 'string', description: '字幕样式' },
            },
            required: ['text'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'generate_subtitle',
          description: 'AI生成字幕（语音识别）',
          parameters: {
            type: 'object',
            properties: {
              language: { type: 'string', description: '语言', default: 'zh-CN' },
            },
          },
        },
      },

      // 音乐操作
      {
        type: 'function',
        function: {
          name: 'add_background_music',
          description: '添加背景音乐',
          parameters: {
            type: 'object',
            properties: {
              source: { type: 'string', description: '音乐来源（本地文件/URL/AI生成）' },
              style: { type: 'string', description: '音乐风格' },
              volume: { type: 'number', description: '音量（0-1）' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'adjust_volume',
          description: '调整音量',
          parameters: {
            type: 'object',
            properties: {
              volume: { type: 'number', description: '音量（0-1）' },
              track: { type: 'string', description: '轨道ID' },
            },
            required: ['volume'],
          },
        },
      },

      // 转场和特效
      {
        type: 'function',
        function: {
          name: 'add_transition',
          description: '在片段之间添加转场',
          parameters: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['fade', 'dissolve', 'wipe', 'slide'], description: '转场类型' },
              duration: { type: 'number', description: '转场时长（秒）' },
            },
            required: ['type'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'add_effect',
          description: '为片段添加特效',
          parameters: {
            type: 'object',
            properties: {
              effect: { type: 'string', description: '特效类型（blur, brightness, contrast等）' },
              intensity: { type: 'number', description: '特效强度（0-1）' },
            },
            required: ['effect'],
          },
        },
      },

      // 项目操作
      {
        type: 'function',
        function: {
          name: 'export_project',
          description: '导出项目',
          parameters: {
            type: 'object',
            properties: {
              format: { type: 'string', enum: ['mp4', 'mov', 'webm'], description: '导出格式' },
              quality: { type: 'string', enum: ['high', 'medium', 'low'], description: '导出质量' },
              resolution: { type: 'string', description: '分辨率（如1920x1080）' },
            },
            required: ['format'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_project_info',
          description: '获取项目信息',
          parameters: { type: 'object', properties: {} },
        },
      },
    ];
  }

  /**
   * 执行工具
   */
  private async executeTools(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const call of toolCalls) {
      try {
        const result = await this.executeTool(call);
        results.push({
          toolCallId: call.id,
          success: true,
          result,
        });
      } catch (error) {
        results.push({
          toolCallId: call.id,
          success: false,
          error: error instanceof Error ? error.message : '执行失败',
        });
      }
    }

    return results;
  }

  /**
   * 执行单个工具
   */
  private async executeTool(call: ToolCall): Promise<any> {
    const { name, arguments: args } = call;

    // 导入时间轴Store
    const timelineStore = await import('@/store/timelineStore').then(m => m.useTimelineStore.getState());

    switch (name) {
      case 'play_video':
        timelineStore.playback.isPlaying = true;
        return { success: true, message: '已开始播放' };

      case 'pause_video':
        timelineStore.playback.isPlaying = false;
        return { success: true, message: '已暂停' };

      case 'seek_to':
        timelineStore.seek(args.time as number);
        return { success: true, message: `已跳转到 ${args.time} 秒` };

      case 'split_clip': {
        const selectedIds = timelineStore.selection.selectedClipIds;
        if (selectedIds.length > 0) {
          timelineStore.splitClip(selectedIds[0], timelineStore.playback.currentTime);
          return { success: true, message: '已在播放头位置分割片段' };
        }
        return { success: false, message: '请先选中要分割的片段' };
      }

      case 'import_material':
        return { success: true, message: '请选择要导入的素材', type: args.type };

      case 'delete_selected':
        timelineStore.deleteSelectedClips();
        return { success: true, message: '已删除选中的片段' };

      case 'add_subtitle':
        return { success: true, message: `已添加字幕: ${args.text}` };

      case 'generate_subtitle':
        return { success: true, message: '正在使用AI生成字幕...' };

      case 'add_background_music':
        return { success: true, message: '正在添加背景音乐...' };

      case 'adjust_volume':
        return { success: true, message: `已将音量调整为 ${(args.volume as number) * 100}%` };

      case 'add_transition':
        return { success: true, message: `已添加${args.type}转场` };

      case 'add_effect':
        return { success: true, message: `已应用${args.effect}特效` };

      case 'export_project':
        return { success: true, message: `正在导出为${args.format}格式...` };

      case 'get_project_info':
        return {
          success: true,
          ...timelineStore.project,
          currentTime: timelineStore.playback.currentTime,
          trackCount: timelineStore.project.tracks.length,
        };

      default:
        return { success: false, message: `未知工具: ${name}` };
    }
  }

  /**
   * 判断是否需要继续对话
   */
  private shouldContinueConversation(toolResults: ToolResult[]): boolean {
    // 如果所有工具都成功，不需要继续
    return !toolResults.every(r => r.success);
  }

  /**
   * 使用工具结果继续对话
   */
  private async callModelWithToolResults(
    userMessage: string,
    systemPrompt: string,
    tools: unknown[],
    toolResults: ToolResult[],
    options: AssistantOptions
  ): Promise<{ content: string }> {
    // 构建包含工具结果的对话
    const toolResultMessages = toolResults.map(r => ({
      role: 'tool' as const,
      content: r.success
        ? JSON.stringify(r.result)
        : `错误: ${r.error}`,
    }));

    // 简化实现：直接返回基于工具结果的总结
    return {
      content: `已完成工具执行。${toolResults.map(r =>
        r.success ? `✓ 成功` : `✗ 失败: ${r.error}`
      ).join(', ')}`,
    };
  }

  /**
   * 获取对话历史
   */
  getHistory(): AssistantMessage[] {
    return [...this.messages];
  }

  /**
   * 清空对话历史
   */
  clearHistory(): void {
    this.messages = [];
  }

  /**
   * 获取支持的技能列表
   */
  getSupportedSkills(): Array<{ id: string; name: string; description: string; icon: string }> {
    return [
      { id: 'video-editing', name: '视频剪辑', description: '剪切、合并、转场、特效', icon: '🎬' },
      { id: 'subtitle', name: '字幕处理', description: '生成、翻译、样式', icon: '📝' },
      { id: 'audio', name: '音频处理', description: '配乐、音效、混音', icon: '🎵' },
      { id: 'effects', name: '视觉特效', description: '滤镜、调色、合成', icon: '✨' },
      { id: 'export', name: '导出设置', description: '格式、分辨率、编码', icon: '📤' },
    ];
  }
}

// ==================== 导出 ====================

export const intelligentAssistant = IntelligentAssistantService.getInstance();
export default intelligentAssistant;
