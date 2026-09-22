/**
 * AI节点控制器服务
 * 负责解析自然语言命令并执行节点操作
 */

import { Node, Edge } from '@xyflow/react';
import { generateId } from '@/lib/utils';
import { aiAssistantService } from './ai-assistant-service';

export interface NodeOperation {
  type:
    | 'add'
    | 'delete'
    | 'update'
    | 'connect'
    | 'disconnect'
    | 'execute'
    | 'duplicate'
    | 'processImage';
  nodeId?: string;
  nodeType?: string;
  params?: Record<string, unknown>;
  sourceNodeId?: string;
  targetNodeId?: string;
  targetPort?: string;
  sourcePort?: string;
  processingMode?: 'none' | 'remove-background' | 'remove-person' | 'extract-subject' | 'inpaint';
  customBackground?: string;
  edgeFeathering?: number;
  edgeSmoothing?: number;
  /** Inpainting: mask 图片 URL */
  maskImageUrl?: string;
  /** Inpainting: 重绘提示词 */
  inpaintPrompt?: string;
  /** Inpainting: AI 服务商 */
  inpaintProvider?: string;
}

export interface OperationResult {
  success: boolean;
  message: string;
  nodeId?: string;
  affectedNodes?: string[];
}

class AINodeController {
  private static instance: AINodeController;

  // 操作历史栈（Command Pattern）
  private undoStack: Array<{
    operation: NodeOperation;
    inverse: () => void;
  }> = [];
  private redoStack: Array<{
    operation: NodeOperation;
    inverse: () => void;
  }> = [];
  private maxHistorySize = 50;

  private nodeTypes = [
    'prompt',
    'script',
    'imageInput',
    'videoInput',
    'frameExtractor',
    'aiImage',
    'aiVideo',
    'imageGen',
    'videoGen',
    'advancedVideoGen',
    'audioGen',
    'output',
    'textInput',
    'aiGenText',
    'imageAnalysis',
    'inpainting',
    'outpainting',
    'unifiedImageStudio',
    'aicgImageGen',
    'advancedFunction',
  ];

  private constructor() {
    /* noop */
  }

  static readonly POSTER_IMAGE_CAPABILITY_MAP = {
    'text-to-image': {
      nodeType: 'aiImage',
      mode: 'generate' as const,
      label: '专业海报 文生图',
      defaultParams: {
        modelId: 'doubao-seedream-5-0-lite',
        modelProvider: 'doubao',
        mode: 'generate',
        generationMode: 'text_to_image',
        gptImageQuality: 'medium',
        gptImageStyle: 'vivid',
        gptOutputFormat: 'png',
        gptBackground: 'opaque',
      },
    },
    'image-variation': {
      nodeType: 'aiImage',
      mode: 'variation' as const,
      label: '专业海报 图像变体',
      defaultParams: {
        modelId: 'doubao-seedream-5-0-lite',
        modelProvider: 'doubao',
        mode: 'variation',
        variationCount: 4,
        variationDegree: 'medium',
        variationPreserve: ['composition', 'subject'],
      },
    },
    'batch-generate': {
      nodeType: 'aiImage',
      mode: 'generate' as const,
      label: '专业海报 批量生成',
      defaultParams: {
        modelId: 'doubao-seedream-5-0-lite',
        modelProvider: 'doubao',
        mode: 'generate',
        generationMode: 'text_to_image',
        gptImageQuality: 'medium',
        gptImageStyle: 'vivid',
        imageCount: 4,
      },
    },
    'style-transfer': {
      nodeType: 'aiImage',
      mode: 'styleTransfer' as const,
      label: '专业海报 风格迁移',
      defaultParams: {
        modelId: 'doubao-seedream-5-0-lite',
        modelProvider: 'doubao',
        mode: 'styleTransfer',
        gptImageStyle: 'vivid',
        stylePreset: 'cinematic',
        styleTransferStrength: 0.7,
        styleContentPreserve: 0.6,
      },
    },
    'image-edit': {
      nodeType: 'aiImage',
      mode: 'inpaint' as const,
      label: '专业海报 图像编辑',
      defaultParams: {
        modelId: 'doubao-seedream-5-0-lite',
        modelProvider: 'doubao',
        mode: 'inpaint',
        maskMode: 'upload',
        inpaintStrength: 0.75,
        featherEdge: 3,
      },
    },
    'multi-image-input': {
      nodeType: 'aiImage',
      mode: 'generate' as const,
      label: '专业海报 多图组合',
      defaultParams: {
        modelId: 'doubao-seedream-5-0-lite',
        modelProvider: 'doubao',
        mode: 'generate',
        generationMode: 'reference',
        gptImageQuality: 'medium',
        gptImageStyle: 'vivid',
      },
    },
  } as const;

  static readonly POSTER_IMAGE_CAPABILITIES = [
    {
      type: 'text-to-image',
      description: '文字描述生成高质量图像',
      features: ['hd-quality', 'style-control', 'aspect-ratio'],
    },
    {
      type: 'image-variation',
      description: '基于原图生成风格一致的变体图像',
      features: ['consistent-style', 'multiple-variations'],
    },
    {
      type: 'batch-generate',
      description: '多提示词并行生成',
      features: ['parallel-generation', 'fault-tolerant'],
    },
    {
      type: 'style-transfer',
      description: '风格迁移和艺术化',
      features: ['artistic-styles', 'custom-styles'],
    },
    {
      type: 'image-edit',
      description: '基于mask遮罩的局部编辑',
      features: ['generative-fill', 'mask-editing'],
    },
    {
      type: 'multi-image-input',
      description: '多张图片作为输入进行组合生成',
      features: ['multi-reference', 'compositional'],
    },
  ];

   public static getInstance(): AINodeController {
    if (!AINodeController.instance) {
      AINodeController.instance = new AINodeController();
    }
    return AINodeController.instance;
  }

  /**
   * 解析自然语言命令
   * 优先使用 LLM 意图识别，回退到关键词匹配
   */
  public parseCommand(command: string): NodeOperation | null {
    const lowerCommand = command.toLowerCase();

    if (
      lowerCommand.includes('添加') ||
      lowerCommand.includes('新建') ||
      lowerCommand.includes('创建')
    ) {
      return this.parseAddCommand(command);
    }

    if (lowerCommand.includes('删除') || lowerCommand.includes('移除')) {
      return this.parseDeleteCommand(command);
    }

    if (
      lowerCommand.includes('修改') ||
      lowerCommand.includes('更新') ||
      lowerCommand.includes('调整')
    ) {
      return this.parseUpdateCommand(command);
    }

    if (lowerCommand.includes('连接') || lowerCommand.includes('连线')) {
      return this.parseConnectCommand(command);
    }

    if (lowerCommand.includes('执行') || lowerCommand.includes('运行')) {
      return this.parseExecuteCommand(command);
    }

    if (lowerCommand.includes('复制') || lowerCommand.includes('克隆')) {
      return this.parseDuplicateCommand(command);
    }

    if (
      lowerCommand.includes('抠图') ||
      lowerCommand.includes('去背景') ||
      lowerCommand.includes('去人物') ||
      lowerCommand.includes('处理图片') ||
      lowerCommand.includes('图像处理') ||
      lowerCommand.includes('局部重绘') ||
      lowerCommand.includes('重画') ||
      lowerCommand.includes('修补') ||
      lowerCommand.includes('inpaint')
    ) {
      return this.parseImageProcessCommand(command);
    }

    return null;
  }

  /**
   * 使用 LLM 进行意图识别解析命令（异步）
   * 如果 AI 不可用或解析失败，回退到关键词匹配
   */
  public async parseCommandWithAI(command: string): Promise<NodeOperation | null> {
    // 先尝试关键词匹配
    const keywordResult = this.parseCommand(command);

    // 如果 AI 不可用，直接返回关键词匹配结果
    if (!aiAssistantService.hasValidConfig()) {
      return keywordResult;
    }

    try {
      const systemPrompt = `你是视频编辑工作流的命令解析器。将用户的自然语言指令解析为结构化操作。

支持的操作类型：
- add: 添加节点（提示词、图片输入、视频输入、图片生成、视频生成、音频生成、视频编辑、输出、文本、脚本节点）
- delete: 删除节点
- update: 修改节点参数
- connect: 连接两个节点
- disconnect: 断开连接
- execute: 执行节点
- duplicate: 复制节点
- processImage: 图像处理（抠图/去背景/去人物/局部重绘）

请严格按以下 JSON 格式输出，不要输出其他内容：
{
  "type": "add|delete|update|connect|disconnect|execute|duplicate|processImage",
  "nodeType": "节点类型(仅add时需要)",
  "nodeId": "节点ID(如指定)",
  "params": { "参数键值对" },
  "processingMode": "none|remove-background|remove-person|extract-subject|inpaint(仅processImage时)",
  "inpaintPrompt": "重绘提示词(仅inpaint模式)",
  "sourceNodeId": "源节点(仅connect时)",
  "targetNodeId": "目标节点(仅connect时)"
}

如果无法理解命令，输出：{"type": "unknown"}`;

      const messages = [
        {
          id: `intent-${Date.now()}`,
          role: 'user' as const,
          content: command,
          timestamp: new Date().toISOString(),
        },
      ];

      const response = await aiAssistantService.sendMessage(messages, {
        temperature: 0.1, // 低温度，更确定性的输出
        maxTokens: 500,
        systemPrompt,
      });

      // 解析 AI 返回的 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return keywordResult;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.type || parsed.type === 'unknown') {
        return keywordResult;
      }

      const operation: NodeOperation = {
        type: parsed.type,
        nodeId: parsed.nodeId,
        nodeType: parsed.nodeType,
        params: parsed.params,
        sourceNodeId: parsed.sourceNodeId,
        targetNodeId: parsed.targetNodeId,
        processingMode: parsed.processingMode,
        inpaintPrompt: parsed.inpaintPrompt,
      };

      return operation;
    } catch (e) {
      console.warn('[AI节点控制器] LLM 意图识别失败，使用关键词匹配:', e);
      return keywordResult;
    }
  }

  /**
   * 智能解析复杂命令
   */
  public parseSmartCommand(command: string): NodeOperation | null {
    const patterns = [
      { regex: /(?:添加|新建|创建)\s*(?:一个?\s*)?(.+?)(?:节点)?$/, type: 'add' },
      { regex: /(?:删除|移除)\s*(?:一个?\s*)?(.+?)(?:节点)?$/, type: 'delete' },
      { regex: /(?:修改|更新|调整)\s*(?:一个?\s*)?(.+?)(?:节点)?$/, type: 'update' },
      { regex: /(?:复制|克隆)\s*(?:一个?\s*)?(.+?)(?:节点)?$/, type: 'duplicate' },
    ];

    for (const pattern of patterns) {
      const match = command.match(pattern.regex);
      if (match) {
        const operation = this.parseCommand(command);
        if (operation) {
          return operation;
        }
      }
    }

    return null;
  }

  /**
   * 解析添加节点命令
   */
  private parseAddCommand(command: string): NodeOperation {
    const nodeType = this.inferNodeType(command);
    const params = this.extractParams(command);

    return {
      type: 'add',
      nodeType,
      params,
    };
  }

  /**
   * 解析删除节点命令
   */
  private parseDeleteCommand(command: string): NodeOperation {
    const nodeIdMatch = command.match(/节点[：:]?(\S+)/);
    const nodeId = nodeIdMatch ? nodeIdMatch[1] : undefined;

    return {
      type: 'delete',
      nodeId,
    };
  }

  /**
   * 解析更新节点命令
   */
  private parseUpdateCommand(command: string): NodeOperation {
    const nodeIdMatch = command.match(/节点[：:]?(\S+)/);
    const nodeId = nodeIdMatch ? nodeIdMatch[1] : undefined;
    const params = this.extractParams(command);

    return {
      type: 'update',
      nodeId,
      params,
    };
  }

  /**
   * 解析连接节点命令
   */
  private parseConnectCommand(command: string): NodeOperation {
    const sourceMatch = command.match(/从(\S+)到(\S+)/);
    const source = sourceMatch ? sourceMatch[1] : undefined;
    const target = sourceMatch ? sourceMatch[2] : undefined;

    return {
      type: 'connect',
      sourceNodeId: source,
      targetNodeId: target,
    };
  }

  /**
   * 解析执行节点命令
   */
  private parseExecuteCommand(command: string): NodeOperation {
    const nodeIdMatch = command.match(/节点[：:]?(\S+)/);
    const nodeId = nodeIdMatch ? nodeIdMatch[1] : undefined;

    return {
      type: 'execute',
      nodeId,
    };
  }

  /**
   * 解析复制节点命令
   */
  private parseDuplicateCommand(command: string): NodeOperation {
    const nodeIdMatch = command.match(/节点[：:]?(\S+)/);
    const nodeId = nodeIdMatch ? nodeIdMatch[1] : undefined;

    return {
      type: 'duplicate',
      nodeId,
    };
  }

  /**
   * 解析图像处理命令
   */
  private parseImageProcessCommand(command: string): NodeOperation {
    const lowerCommand = command.toLowerCase();

    let processingMode: NodeOperation['processingMode'] = 'extract-subject';
    let customBackground: string | undefined;
    let edgeFeathering: number | undefined;
    let edgeSmoothing: number | undefined;

    if (lowerCommand.includes('抠图')) {
      processingMode = 'extract-subject';
    } else if (lowerCommand.includes('去背景')) {
      processingMode = 'remove-background';
    } else if (lowerCommand.includes('去人物')) {
      processingMode = 'remove-person';
    } else if (
      lowerCommand.includes('局部重绘') ||
      lowerCommand.includes('重画') ||
      lowerCommand.includes('修补') ||
      lowerCommand.includes('inpaint')
    ) {
      processingMode = 'inpaint';
    } else if (lowerCommand.includes('原图') || lowerCommand.includes('不处理')) {
      processingMode = 'none';
    }

    const bgMatch = command.match(/背景[：:]?(白色|黑色|灰色|透明|白|黑|灰|#?\w+)/);
    if (bgMatch) {
      const bgValue = bgMatch[1];
      if (bgValue === '白色' || bgValue === '白') customBackground = '#FFFFFF';
      else if (bgValue === '黑色' || bgValue === '黑') customBackground = '#000000';
      else if (bgValue === '灰色' || bgValue === '灰') customBackground = '#808080';
      else if (bgValue === '透明') customBackground = 'transparent';
      else customBackground = bgValue.startsWith('#') ? bgValue : `#${bgValue}`;
    }

    const featherMatch = command.match(/羽化[：:]?(无|轻微|轻|中等|中|重|强烈|极重|\d+)/);
    if (featherMatch) {
      const featherValue = featherMatch[1];
      const featherMap: Record<string, number> = {
        无: 0,
        轻微: 2,
        轻: 2,
        中等: 3,
        中: 3,
        重: 4,
        强烈: 5,
        极重: 5,
      };
      edgeFeathering = featherMap[featherValue] ?? parseInt(featherValue);
    }

    const smoothMatch = command.match(/(?:边缘平滑|平滑)[：:]?(无|轻微|轻|中等|中|平滑|\d+)/);
    if (smoothMatch) {
      const smoothValue = smoothMatch[1];
      const smoothMap: Record<string, number> = {
        无: 0,
        轻微: 1,
        轻: 1,
        中等: 2,
        中: 2,
        平滑: 3,
      };
      edgeSmoothing = smoothMap[smoothValue] ?? parseInt(smoothValue);
    }

    const nodeIdMatch = command.match(/图片输入[节点]?[：:]?(\S+)/);
    const nodeId = nodeIdMatch ? nodeIdMatch[1] : undefined;

    // Inpainting 参数解析
    let maskImageUrl: string | undefined;
    let inpaintPrompt: string | undefined;
    let inpaintProvider: string | undefined;

    if (processingMode === 'inpaint') {
      const promptMatch = command.match(/(?:重绘|重画|修补|提示)[：:]?["'"]?([^"'"]+)["'"]?/);
      if (promptMatch) {
        inpaintPrompt = promptMatch[1].trim();
      }
      const providerMatch = command.match(/(?:服务商|模型|提供商)[：:]?(\S+)/);
      if (providerMatch) {
        inpaintProvider = providerMatch[1];
      }
      const maskMatch = command.match(/(?:mask|蒙版|遮罩)[：:]?(\S+)/);
      if (maskMatch) {
        maskImageUrl = maskMatch[1];
      }
    }

    return {
      type: 'processImage',
      nodeId,
      processingMode,
      customBackground,
      edgeFeathering,
      edgeSmoothing,
      maskImageUrl,
      inpaintPrompt,
      inpaintProvider,
    };
  }

  /**
   * 推断节点类型
   */
  private inferPosterImageNodeType(command: string): string {
    const lowerCommand = command.toLowerCase();

    if (
      lowerCommand.includes('变体') ||
      lowerCommand.includes('variation') ||
      lowerCommand.includes('生成变体')
    ) {
      return 'aiImage';
    }
    if (
      lowerCommand.includes('批量') ||
      lowerCommand.includes('batch') ||
      lowerCommand.includes('多提示词') ||
      lowerCommand.includes('批量生成')
    ) {
      return 'aiImage';
    }
    if (
      lowerCommand.includes('风格迁移') ||
      lowerCommand.includes('style-transfer') ||
      lowerCommand.includes('风格转换') ||
      lowerCommand.includes('艺术化')
    ) {
      return 'aiImage';
    }
    if (
      lowerCommand.includes('编辑') ||
      lowerCommand.includes('edit') ||
      lowerCommand.includes('局部重绘') ||
      lowerCommand.includes('蒙版') ||
      lowerCommand.includes('mask') ||
      lowerCommand.includes('修补') ||
      lowerCommand.includes('生成式填充')
    ) {
      return 'aiImage';
    }
    if (
      lowerCommand.includes('多图') ||
      lowerCommand.includes('composite') ||
      lowerCommand.includes('组合') ||
      lowerCommand.includes('多参考图') ||
      lowerCommand.includes('图片参考')
    ) {
      return 'aiImage';
    }

    return 'aiImage';
  }

  public resolvePosterImageCapability(capabilityType: string): {
    nodeType: string;
    mode: string;
    label: string;
    defaultParams: Record<string, unknown>;
  } | null {
    const map = AINodeController.POSTER_IMAGE_CAPABILITY_MAP as Record<
      string,
      {
        nodeType: string;
        mode: string;
        label: string;
        defaultParams: Record<string, unknown>;
      }
    >;
    return map[capabilityType] || null;
  }

  public createPosterImageNode(
    capabilityType: string,
    position: { x: number; y: number },
    overrides?: Record<string, unknown>
  ): Node | null {
    const resolved = this.resolvePosterImageCapability(capabilityType);
    if (!resolved) return null;

    const nodeId = generateId();
    return {
      id: nodeId,
      type: resolved.nodeType,
      position,
      data: {
        label: resolved.label,
        params: { ...resolved.defaultParams, ...overrides },
      },
    };
  }

  private inferNodeType(command: string): string {
    const lowerCommand = command.toLowerCase();

    if (
      lowerCommand.includes('专业海报') ||
      lowerCommand.includes('doubao-seedream') ||
      lowerCommand.includes('seedream') ||
      lowerCommand.includes('图像模型')
    ) {
      return this.inferPosterImageNodeType(command);
    }

    if (
      lowerCommand.includes('脚本') ||
      lowerCommand.includes('剧本') ||
      lowerCommand.includes('分镜')
    ) {
      return 'script';
    }
    if (lowerCommand.includes('高级分镜') || lowerCommand.includes('高级函数')) {
      return 'advancedFunction';
    }
    if (
      lowerCommand.includes('ai图片') ||
      lowerCommand.includes('图片生成') ||
      lowerCommand.includes('文生图') ||
      lowerCommand.includes('图生图')
    ) {
      return 'aiImage';
    }
    if (
      lowerCommand.includes('图像分析') ||
      lowerCommand.includes('图片分析') ||
      lowerCommand.includes('图片理解') ||
      lowerCommand.includes('图像识别')
    ) {
      return 'aiImage';
    }
    if (
      lowerCommand.includes('局部重绘') ||
      lowerCommand.includes('重绘') ||
      lowerCommand.includes('修复') ||
      lowerCommand.includes('inpaint')
    ) {
      return 'aiImage';
    }
    if (
      lowerCommand.includes('画布扩展') ||
      lowerCommand.includes('外延') ||
      lowerCommand.includes('扩展绘制') ||
      lowerCommand.includes('outpaint')
    ) {
      return 'aiImage';
    }
    if (
      lowerCommand.includes('图像工作室') ||
      lowerCommand.includes('统一图像') ||
      lowerCommand.includes('全能图像')
    ) {
      return 'aiImage';
    }
    if (
      lowerCommand.includes('高级视频') ||
      lowerCommand.includes('seedance') ||
      lowerCommand.includes('高级视频生成')
    ) {
      return 'aiVideo';
    }
    if (
      lowerCommand.includes('抽帧') ||
      lowerCommand.includes('提取帧') ||
      lowerCommand.includes('关键帧') ||
      lowerCommand.includes('视频帧')
    ) {
      return 'frameExtractor';
    }
    if (
      lowerCommand.includes('ai视频') ||
      lowerCommand.includes('视频生成') ||
      lowerCommand.includes('文生视频') ||
      lowerCommand.includes('图生视频')
    ) {
      return 'aiVideo';
    }
    if (
      lowerCommand.includes('音频') ||
      lowerCommand.includes('配音') ||
      lowerCommand.includes('语音')
    ) {
      return 'audioGen';
    }
    if (lowerCommand.includes('提示词') || lowerCommand.includes('文本')) {
      return 'prompt';
    }
    if (lowerCommand.includes('图片输入') || lowerCommand.includes('上传图片')) {
      return 'imageInput';
    }
    if (lowerCommand.includes('视频输入') || lowerCommand.includes('上传视频')) {
      return 'videoInput';
    }
    if (lowerCommand.includes('输出') || lowerCommand.includes('导出')) {
      return 'output';
    }

    return 'prompt';
  }

  /**
   * 提取参数
   */
  private extractParams(command: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    const resolutionMatch = command.match(/分辨率[：:]?(\d+:\d+)/);
    if (resolutionMatch) {
      params.resolution = resolutionMatch[1];
    } else if (command.includes('16:9') || command.includes('竖版') || command.includes('横版')) {
      params.resolution =
        command.includes('竖版') || command.includes('9:16')
          ? '9:16'
          : command.includes('横版') || command.includes('16:9')
            ? '16:9'
            : '1:1';
    }

    const durationMatch = command.match(/(?:时长|持续)[：:]?(\d+)秒/);
    if (durationMatch) {
      params.duration = parseInt(durationMatch[1]);
    }

    const qualityMatch = command.match(/质量[：:]?(高清|标准|hd|standard)/i);
    if (qualityMatch) {
      params.quality = qualityMatch[1].toLowerCase();
    }

    const styleMatch = command.match(/风格[：:]?(\S+)/);
    if (styleMatch) {
      params.style = styleMatch[1];
    }

    const promptMatch = command.match(/(?:提示词|prompt|文本)[：:]?["'"]?([^"'"]+)["'"]?/i);
    if (promptMatch) {
      params.prompt = promptMatch[1];
    }

    const cfgMatch = command.match(/cfg[：:]?(\d+\.?\d*)/i);
    if (cfgMatch) {
      params.cfgScale = parseFloat(cfgMatch[1]);
    }

    const stepsMatch = command.match(/步数[：:]?(\d+)/);
    if (stepsMatch) {
      params.steps = parseInt(stepsMatch[1]);
    }

    const seedMatch = command.match(/种子[：:]?(\d+|-1)/);
    if (seedMatch) {
      params.seed = parseInt(seedMatch[1]);
    }

    const modelMatch = command.match(/模型[：:]?(\S+)/);
    if (modelMatch) {
      params.modelProvider = modelMatch[1];
    }

    const fpsMatch = command.match(/帧率[：:]?(\d+)fps/i);
    if (fpsMatch) {
      params.fps = parseInt(fpsMatch[1]);
    }

    const motionMatch = command.match(/运动强度[：:]?(\d+)/);
    if (motionMatch) {
      params.motionStrength = parseInt(motionMatch[1]);
    }

    const gptQualityMatch = command.match(
      /(?:gpt)?质量[：:]?(自动|快速|标准|高清|auto|low|medium|high)/i
    );
    if (gptQualityMatch) {
      const qMap: Record<string, string> = {
        自动: 'auto',
        快速: 'low',
        标准: 'medium',
        高清: 'high',
        auto: 'auto',
        low: 'low',
        medium: 'medium',
        high: 'high',
      };
      params.gptImageQuality = qMap[gptQualityMatch[1].toLowerCase()] || 'medium';
    }

    const gptStyleMatch = command.match(/(?:gpt)?风格[：:]?(生动|自然|vivid|natural)/i);
    if (gptStyleMatch) {
      const sMap: Record<string, string> = {
        生动: 'vivid',
        自然: 'natural',
        vivid: 'vivid',
        natural: 'natural',
      };
      params.gptImageStyle = sMap[gptStyleMatch[1].toLowerCase()] || 'vivid';
    }

    const gptFormatMatch = command.match(/(?:输出)?格式[：:]?(png|jpeg|webp)/i);
    if (gptFormatMatch) {
      params.gptOutputFormat = gptFormatMatch[1].toLowerCase();
    }

    const gptBgMatch = command.match(/背景[：:]?(不透明|透明|自动|opaque|transparent|auto)/i);
    if (gptBgMatch) {
      const bMap: Record<string, string> = {
        不透明: 'opaque',
        透明: 'transparent',
        自动: 'auto',
        opaque: 'opaque',
        transparent: 'transparent',
        auto: 'auto',
      };
      params.gptBackground = bMap[gptBgMatch[1].toLowerCase()] || 'opaque';
    }

    const variationCountMatch = command.match(/变体数量[：:]?(\d+)/);
    if (variationCountMatch) {
      params.variationCount = parseInt(variationCountMatch[1]);
    }

    const variationDegreeMatch = command.match(/变化程度[：:]?(保守|适中|创意|low|medium|high)/i);
    if (variationDegreeMatch) {
      const dMap: Record<string, string> = {
        保守: 'low',
        适中: 'medium',
        创意: 'high',
        low: 'low',
        medium: 'medium',
        high: 'high',
      };
      params.variationDegree = dMap[variationDegreeMatch[1].toLowerCase()] || 'medium';
    }

    const stylePresetMatch = command.match(/(?:风格预设|目标风格)[：:]?(\S+)/);
    if (stylePresetMatch) {
      params.stylePreset = stylePresetMatch[1];
    }

    const maskModeMatch = command.match(/蒙版模式[：:]?(上传|自动主体|自动人脸|自动文字|画笔编辑)/);
    if (maskModeMatch) {
      const mMap: Record<string, string> = {
        上传: 'upload',
        自动主体: 'auto_subject',
        自动人脸: 'auto_face',
        自动文字: 'auto_text',
        画笔编辑: 'brush_editor',
      };
      params.maskMode = mMap[maskModeMatch[1]] || 'upload';
    }

    return params;
  }

  /**
   * 创建节点
   */
  public createNode(
    nodeType: string,
    position: { x: number; y: number },
    params?: Record<string, unknown>
  ): Node {
    const nodeId = generateId();

    return {
      id: nodeId,
      type: nodeType,
      position,
      data: {
        label: this.getNodeLabel(nodeType),
        ...params,
      },
    };
  }

  /**
   * 获取节点标签
   */
  private getNodeLabel(nodeType: string): string {
    const labels: Record<string, string> = {
      prompt: '提示词',
      script: '脚本节点',
      imageInput: '图片输入',
      videoInput: '视频输入',
      aiImage: 'AI图片',
      aiVideo: 'AI视频',
      imageGen: '图片生成',
      advancedImageGen: '高级图片生成',
      borderlessImageGen: '无边框图片生成',
      videoGen: '视频生成',
      frameExtractor: '视频抽帧',
      advancedVideoGen: '高级视频生成',
      audioGen: '音频生成',
      videoEditor: '视频编辑',
      output: '输出',
      text: '文本',
      textInput: '文本输入',
      aiGenText: '生成文本',
      imageAnalysis: '图像分析',
      inpainting: '局部重绘',
      outpainting: '画布扩展',
      unifiedImageStudio: '图像工作室',
      aicgImageGen: 'AICG 图片节点',
      seedream: 'Seedream 图片生成',
      aiAssistant: 'AI 助手',
      advancedFunction: '高级分镜',
      advancedStoryboardController: '高级分镜控制器',
    };
    return labels[nodeType] || '未知节点';
  }

  /**
   * 创建边
   */
  public createEdge(
    sourceId: string,
    targetId: string,
    sourceHandle?: string,
    targetHandle?: string
  ): Edge {
    return {
      id: `e${sourceId}-${targetId}-${Date.now()}`,
      source: sourceId,
      target: targetId,
      sourceHandle,
      targetHandle,
    };
  }

  /**
   * 批量创建节点和边
   */
  public createNodesFromWorkflow(
    workflow: Array<{
      type: string;
      label: string;
      params?: Record<string, unknown>;
      connections?: string[];
    }>
  ): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = [];
    const nodeIdMap = new Map<string, string>();

    workflow.forEach((item, index) => {
      const nodeId = generateId();
      nodeIdMap.set(item.label || `node-${index}`, nodeId);

      const node = this.createNode(item.type, { x: 100 + index * 250, y: 150 }, item.params);
      node.id = nodeId;
      nodes.push(node);
    });

    const edges: Edge[] = [];
    workflow.forEach((item, index) => {
      if (item.connections && item.connections.length > 0) {
        item.connections.forEach((targetLabel) => {
          const targetId = nodeIdMap.get(targetLabel);
          if (targetId) {
            edges.push(this.createEdge(nodes[index].id, targetId));
          }
        });
      }

      if (index < workflow.length - 1) {
        edges.push(this.createEdge(nodes[index].id, nodes[index + 1].id));
      }
    });

    return { nodes, edges };
  }

  /**
   * 生成节点操作建议
   */
  public suggestOperations(requirement: string, existingNodes: Node[]): string[] {
    const suggestions: string[] = [];
    const lowerReq = requirement.toLowerCase();

    if (
      (lowerReq.includes('剧本') || lowerReq.includes('脚本') || lowerReq.includes('分镜')) &&
      !existingNodes.some((n) => n.type === 'script')
    ) {
      suggestions.push('添加脚本节点来解析剧本并生成分镜');
    }

    if (
      lowerReq.includes('图片') &&
      !existingNodes.some(
        (n) => n.type === 'aiImage' || n.type === 'unifiedImageStudio' || n.type === 'imageGen'
      )
    ) {
      suggestions.push('添加 AI图片 节点来创建图片');
    }

    if (
      lowerReq.includes('视频') &&
      !existingNodes.some(
        (n) => n.type === 'aiVideo' || n.type === 'advancedVideoGen' || n.type === 'videoGen'
      )
    ) {
      suggestions.push('添加 AI视频 节点来创建视频');
    }

    if (lowerReq.includes('配音') && !existingNodes.some((n) => n.type === 'audioGen')) {
      suggestions.push('添加音频生成节点来创建配音');
    }

    if (existingNodes.length === 0 && (lowerReq.includes('生成') || lowerReq.includes('创建'))) {
      suggestions.push('建议先添加提示词节点或脚本节点作为输入');
    }

    return suggestions;
  }

  /**
   * 获取节点信息
   */
  public getNodeInfo(nodeId: string, nodes: Node[]): string {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) {
      return `未找到节点: ${nodeId}`;
    }

    const info = [
      `节点ID: ${node.id}`,
      `节点类型: ${node.type}`,
      `标签: ${node.data?.label || '无'}`,
      `位置: (${node.position.x.toFixed(0)}, ${node.position.y.toFixed(0)})`,
    ];

    if (node.data) {
      Object.entries(node.data).forEach(([key, value]) => {
        if (key !== 'label' && value !== undefined) {
          info.push(`${key}: ${JSON.stringify(value)}`);
        }
      });
    }

    return info.join('\n');
  }

  /**
   * 列出所有节点
   */
  public listNodes(nodes: Node[]): string {
    if (nodes.length === 0) {
      return '画布上没有节点';
    }

    const nodeList = nodes
      .map((node, index) => {
        return `${index + 1}. [${node.type}] ${node.data?.label || '未命名'} (ID: ${node.id})`;
      })
      .join('\n');

    return `画布上共有 ${nodes.length} 个节点：\n\n${nodeList}`;
  }

  /**
   * 验证节点操作
   */
  public validateOperation(operation: NodeOperation, nodes: Node[]): OperationResult {
    switch (operation.type) {
      case 'delete':
      case 'update':
      case 'execute':
      case 'duplicate': {
        if (!operation.nodeId) {
          return { success: false, message: '请指定节点ID或名称' };
        }
        const nodeExists = nodes.some(
          (n) => n.id === operation.nodeId || n.data?.label === operation.nodeId
        );
        if (!nodeExists) {
          return { success: false, message: `未找到节点: ${operation.nodeId}` };
        }
        return { success: true, message: '操作有效' };
      }

      case 'add':
        if (!operation.nodeType) {
          return { success: false, message: '请指定要添加的节点类型' };
        }
        if (!this.nodeTypes.includes(operation.nodeType)) {
          return {
            success: false,
            message: `不支持的节点类型: ${operation.nodeType}，支持的类型: ${this.nodeTypes.join('、')}`,
          };
        }
        return { success: true, message: '操作有效' };

      case 'connect':
        if (!operation.sourceNodeId || !operation.targetNodeId) {
          return { success: false, message: '请指定源节点和目标节点' };
        }
        return { success: true, message: '操作有效' };

      case 'processImage': {
        const hasImageUrl = nodes.some((n) => {
          if (operation.nodeId) {
            return (
              (n.id === operation.nodeId || n.data?.label === operation.nodeId) && n.data?.imageUrl
            );
          }
          return n.type === 'imageInput' && n.data?.imageUrl;
        });
        if (!hasImageUrl) {
          return { success: false, message: '未找到包含图片的节点或节点中没有图片' };
        }
        return { success: true, message: '操作有效' };
      }

      default:
        return { success: false, message: '未知操作类型' };
    }
  }

  /**
   * 记录操作到撤销栈
   * inverse: 撤销该操作的函数
   */
  public pushToUndoStack(operation: NodeOperation, inverse: () => void): void {
    this.undoStack.push({ operation, inverse });
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
    // 新操作清空重做栈
    this.redoStack = [];
  }

  /**
   * 撤销最近一次操作
   */
  public undo(): { success: boolean; message: string } {
    if (this.undoStack.length === 0) {
      return { success: false, message: '没有可撤销的操作' };
    }

    const entry = this.undoStack.pop()!;
    entry.inverse();
    // 将操作推入重做栈（简化：不存储 inverse，仅记录操作）
    this.redoStack.push(entry);

    const opName = this.getOperationName(entry.operation);
    return { success: true, message: `已撤销: ${opName}` };
  }

  /**
   * 重做最近撤销的操作
   */
  public redo(): { success: boolean; message: string } {
    if (this.redoStack.length === 0) {
      return { success: false, message: '没有可重做的操作' };
    }

    const entry = this.redoStack.pop()!;
    // 重做需要重新执行原始操作（简化实现，返回操作信息供调用者重新执行）
    this.undoStack.push(entry);

    const opName = this.getOperationName(entry.operation);
    return { success: true, message: `已重做: ${opName}` };
  }

  /**
   * 获取当前可撤销的操作数量
   */
  public getUndoCount(): number {
    return this.undoStack.length;
  }

  /**
   * 获取当前可重做的操作数量
   */
  public getRedoCount(): number {
    return this.redoStack.length;
  }

  /**
   * 清空操作历史
   */
  public clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * 获取操作名称（用于显示）
   */
  private getOperationName(operation: NodeOperation): string {
    const names: Record<string, string> = {
      add: `添加 ${operation.nodeType || '节点'}`,
      delete: `删除 ${operation.nodeId || '节点'}`,
      update: `修改 ${operation.nodeId || '节点'}`,
      connect: `连接 ${operation.sourceNodeId} → ${operation.targetNodeId}`,
      disconnect: `断开连接`,
      duplicate: `复制 ${operation.nodeId || '节点'}`,
      processImage: `图片处理 ${operation.processingMode || ''}`,
    };
    return names[operation.type] || operation.type;
  }
}

export const aiNodeController = AINodeController.getInstance();
