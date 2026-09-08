/**
 * XTAICG 软件完整知识库
 * 包含所有目录结构、节点类型、服务功能和方法
 */

export interface KnowledgeEntry {
  id: string;
  category: 'node' | 'service' | 'store' | 'hook' | 'config' | 'component';
  name: string;
  path: string;
  description: string;
  methods?: string[];
  props?: string[];
  features?: string[];
}

export const SOFTWARE_KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // ========== 节点类型 ==========
  {
    id: 'node-ai-assistant',
    category: 'node',
    name: 'AI助手节点',
    path: 'src/components/canvas/nodes/AIAssistantNode.tsx',
    description: '基于MiniMax大模型的AI助手，支持提示词优化、工作流推荐、智能问答、节点控制',
    methods: ['sendMessage', 'handleSendMessage', 'handleKeyPress', 'handleInputChange', 'selectCommand'],
    props: ['modelId', 'temperature', 'systemPrompt', 'messages', 'isProcessing'],
    features: [
      '自然语言对话',
      '快捷命令系统(/优化, /工作流, /添加, /删除等)',
      '工作流自动生成',
      '参数智能推荐',
      '节点操作控制'
    ]
  },
  {
    id: 'node-video-gen',
    category: 'node',
    name: '视频生成节点',
    path: 'src/components/canvas/nodes/VideoGenNode.tsx',
    description: 'AI视频生成节点，支持多个主流视频大模型',
    methods: ['handleGenerate', 'handlePresetSelect', 'handleModelChange'],
    props: ['model', 'prompt', 'duration', 'resolution', 'fps', 'aspectRatio', 'seed'],
    features: [
      '多模型支持：豆包、即梦、智谱AI、Kling、海螺等',
      '生成模式：文生视频、图生视频、视频续写',
      '参数配置：分辨率、时长、帧率、运动强度',
      '首帧/尾帧控制',
      '参考图模式'
    ]
  },
  {
    id: 'node-image-gen',
    category: 'node',
    name: '图片生成节点',
    path: 'src/components/canvas/nodes/ImageGenNode.tsx',
    description: 'AI图片生成节点，支持多种图片模型',
    methods: ['handleGenerate', 'handleModelChange', 'handleStyleSelect'],
    props: ['model', 'prompt', 'negativePrompt', 'resolution', 'quality', 'style', 'seed'],
    features: [
      '生成模式：文生图、图生图、参考图模式',
      '分辨率选项：1:1、16:9、9:16',
      '质量设置：HD、Standard',
      '风格预设：照片写实、动漫、插画等',
      '高级参数：CFG Scale、步数、种子值'
    ]
  },
  {
    id: 'node-audio-gen',
    category: 'node',
    name: '音频生成节点',
    path: 'src/components/canvas/nodes/AudioGenNode.tsx',
    description: 'MiniMax TTS 全功能音频生成，支持语音合成/音色复刻/音色设计',
    methods: ['handleGenerate', 'handlePreviewVoice', 'handleCloneVoice', 'handleDesignVoice'],
    props: ['text', 'voiceSetting', 'audioSetting', 'voiceModify', 'cloneSetting', 'designSetting'],
    features: [
      '语音合成(TTS v2)',
      '音色复刻(上传音频)',
      '音色设计(文字描述)',
      '多模型选择(2.8/2.6/02)',
      '情感/音效/发音词典',
      '语言增强',
      '字幕生成',
    ]
  },

  {
    id: 'node-prompt',
    category: 'node',
    name: '提示词节点',
    path: 'src/components/canvas/nodes/PromptNode.tsx',
    description: '文本输入和提示词管理',
    methods: ['handleTextChange', 'handleTemplateSelect'],
    props: ['text', 'template'],
    features: [
      '多行文本输入',
      '模板选择',
      '提示词库'
    ]
  },
  {
    id: 'node-text-input',
    category: 'node',
    name: '文本输入节点',
    path: 'src/components/canvas/nodes/AIGenTextNode.tsx',
    description: '基础文本输入节点',
    methods: ['handleChange'],
    props: ['text'],
    features: ['简单文本输入']
  },
  {
    id: 'node-ai-gen-text',
    category: 'node',
    name: '生成文本节点',
    path: 'src/components/canvas/nodes/AIGenTextNode.tsx',
    description: 'AI文本生成节点，支持多种大语言模型',
    methods: ['handleGenerate', 'handleStopGeneration', 'handleRegenerate', 'handleModelChange'],
    props: ['prompt', 'outputText', 'model', 'systemPrompt', 'enableThinking', 'variableName'],
    features: ['AI文本生成', '模型选择', '系统提示词', '停止生成', '重新生成', '复制结果']
  },
  {
    id: 'node-video-input',
    category: 'node',
    name: '视频输入节点',
    path: 'src/components/canvas/nodes/VideoInputNode.tsx',
    description: '上传本地视频文件',
    methods: ['handleVideoChange', 'handleDropVideo'],
    props: ['file', 'url'],
    features: ['拖拽上传', '文件选择', '预览播放']
  },
  {
    id: 'node-image-input',
    category: 'node',
    name: '图片输入节点',
    path: 'src/components/canvas/nodes/ImageInputNode.tsx',
    description: '上传本地图片文件',
    methods: ['handleFileSelect', 'handleFileDrop'],
    props: ['file', 'url'],
    features: ['拖拽上传', '文件选择', '预览显示']
  },
  {
    id: 'node-video-editor',
    category: 'node',
    name: 'AI剪辑节点',
    path: 'src/components/canvas/nodes/VideoEditorNode.tsx',
    description: '多轨道视频编辑器',
    methods: ['handleImport', 'handleCut', 'handleAddTransition', 'handleExport'],
    props: ['clips', 'transitions', 'effects', 'subtitles'],
    features: [
      '多轨道时间线',
      '裁剪拼接',
      '转场特效',
      '字幕添加',
      '关键帧动画',
      '颜色调整'
    ]
  },
  {
    id: 'node-output',
    category: 'node',
    name: '输出节点',
    path: 'src/components/canvas/nodes/OutputNode.tsx',
    description: '展示和导出生成结果',
    methods: ['handleDownload', 'handleShare'],
    props: ['content', 'format', 'quality'],
    features: ['结果预览', '文件下载', '分享功能']
  },
  {
    id: 'node-seedream',
    category: 'node',
    name: 'Seedream节点',
    path: 'src/components/canvas/nodes/SeedreamNode.tsx',
    description: '即梦图片生成',
    methods: ['handleGenerate'],
    props: ['prompt', 'model', 'aspectRatio'],
    features: ['即梦模型', '图片生成']
  },
  // ========== 核心服务 ==========
  {
    id: 'service-canvas',
    category: 'service',
    name: 'Canvas状态管理',
    path: 'src/store/useCanvasStore.ts',
    description: '管理画布上的节点和边，以及撤销/重做历史',
    methods: [
      'addNode', 'updateNodeData', 'deleteNode', 'setNodes',
      'addEdge', 'setEdges',
      'setSelectedNodeId', 'setSelectedNodeIds',
      'selectAllNodes', 'clearSelection',
      'deleteSelectedNodes', 'duplicateSelectedNodes', 'moveSelectedNodes',
      'saveToHistory', 'undo', 'redo', 'resetCanvas'
    ],
    features: ['节点增删改查', '边管理', '选中状态', '历史记录']
  },
  {
    id: 'service-ai-assistant',
    category: 'service',
    name: 'AI助手服务',
    path: 'src/services/ai-assistant-service.ts',
    description: '与MiniMax大模型交互，处理对话和工作流生成',
    methods: ['sendMessage', 'streamRequest', 'normalRequest', 'selectOptimalModel', 'setConfig', 'hasValidConfig'],
    features: ['对话生成', '流式响应', '智能模型选择', '工作流解析']
  },
  {
    id: 'service-workflow-generator',
    category: 'service',
    name: '工作流生成器',
    path: 'src/services/workflow-generator.ts',
    description: 'AI自动生成工作流配置',
    methods: ['parseAIResponse', 'generateWorkflow', 'validateWorkflow'],
    features: ['工作流解析', '自动生成', '验证']
  },
  {
    id: 'service-workflow-executor',
    category: 'service',
    name: '工作流自动执行器',
    path: 'src/services/workflow-auto-executor.ts',
    description: '自动执行生成的工作流',
    methods: ['execute', 'pause', 'resume', 'stop', 'getStatus'],
    features: ['自动执行', '暂停恢复', '状态跟踪']
  },
  {
    id: 'service-node-controller',
    category: 'service',
    name: '节点控制器',
    path: 'src/services/ai-node-controller.ts',
    description: 'AI控制画布节点操作',
    methods: ['parseCommand', 'extractParams', 'inferNodeType', 'createNode', 'validateOperation', 'executeOperation'],
    features: ['命令解析', '参数提取', '节点创建', '操作验证']
  },
  {
    id: 'service-parameter-recommendation',
    category: 'service',
    name: '参数推荐服务',
    path: 'src/services/parameter-recommendation.ts',
    description: '根据用户需求推荐最优参数',
    methods: ['getRecommendation', 'analyzeRequirements'],
    features: ['智能推荐', '参数优化']
  },
  {
    id: 'service-commands',
    category: 'service',
    name: 'AI助手命令系统',
    path: 'src/services/ai-assistant-commands.ts',
    description: '快捷命令管理和解析',
    methods: ['getCommandSuggestions', 'executeCommand', 'registerCommand'],
    features: ['命令提示', '命令执行', '命令注册']
  },
  {
    id: 'service-beat-detection',
    category: 'service',
    name: '节拍检测服务',
    path: 'src/services/beat-detection-service.ts',
    description: '音频节拍检测，用于音乐视频剪辑',
    methods: ['detectBeats', 'analyzeRhythm'],
    features: ['节拍检测', '节奏分析']
  },
  {
    id: 'service-scene-detection',
    category: 'service',
    name: '场景检测服务',
    path: 'src/services/scene-detection-service.ts',
    description: '视频场景自动检测',
    methods: ['detectScenes', 'splitVideo'],
    features: ['场景检测', '智能分割']
  },
  {
    id: 'service-color-grading',
    category: 'service',
    name: '色彩调整服务',
    path: 'src/services/color-grading-service.ts',
    description: '视频色彩调整和调色',
    methods: ['adjustColor', 'applyLUT', 'autoColorCorrect'],
    features: ['色彩调整', 'LUT应用', '自动校正']
  },

  {
    id: 'service-timeline',
    category: 'service',
    name: '时间线服务',
    path: 'src/services/timeline-service.ts',
    description: '管理视频时间线和播放',
    methods: ['seek', 'play', 'pause', 'setPlaybackRate'],
    features: ['播放控制', '时间导航']
  },
  {
    id: 'service-playback',
    category: 'service',
    name: '播放服务',
    path: 'src/services/playback-service.ts',
    description: '视频预览播放控制',
    methods: ['play', 'pause', 'stop', 'seek'],
    features: ['播放控制']
  },

  // ========== 适配器服务 ==========
  {
    id: 'adapter-factory',
    category: 'service',
    name: '适配器工厂',
    path: 'src/services/adapter-factory.ts',
    description: '统一管理各AI服务适配器',
    methods: ['getAdapter', 'registerAdapter', 'listAdapters'],
    features: ['适配器管理', '动态加载']
  },
  {
    id: 'adapter-doubao',
    category: 'service',
    name: '豆包适配器',
    path: 'src/services/adapters/doubao.ts',
    description: '豆包AI服务适配器',
    methods: ['generate', 'generateImage'],
    features: ['豆包模型', '图片生成']
  },
  {
    id: 'adapter-doubao-video',
    category: 'service',
    name: '豆包视频适配器',
    path: 'src/services/adapters/doubao-video.ts',
    description: '豆包视频生成适配器',
    methods: ['generateVideo', 'generateImage'],
    features: ['豆包视频', '视频生成']
  },
  {
    id: 'adapter-minimax-video',
    category: 'service',
    name: 'MiniMax视频适配器',
    path: 'src/services/adapters/minimax-video.ts',
    description: 'MiniMax视频生成适配器',
    methods: ['generateVideo'],
    features: ['MiniMax视频', '视频生成']
  },
  {
    id: 'adapter-minimax-tts',
    category: 'service',
    name: 'MiniMax TTS适配器',
    path: 'src/services/adapters/minimax-tts.ts',
    description: 'MiniMax语音合成适配器',
    methods: ['synthesize', 'cloneVoice'],
    features: ['语音合成', '语音克隆']
  },
  {
    id: 'adapter-hailuo',
    category: 'service',
    name: '海螺适配器',
    path: 'src/services/adapters/hailuo.ts',
    description: '海螺视频生成适配器',
    methods: ['generateVideo'],
    features: ['海螺视频', '视频生成']
  },
  {
    id: 'adapter-jimeng',
    category: 'service',
    name: '即梦适配器',
    path: 'src/services/adapters/jimeng.ts',
    description: '即梦图片生成适配器',
    methods: ['generateImage'],
    features: ['即梦图片', '图片生成']
  },
  {
    id: 'adapter-seedream',
    category: 'service',
    name: 'Seedream适配器',
    path: 'src/services/adapters/seedream.ts',
    description: '即梦Seedream模型适配器',
    methods: ['generateImage'],
    features: ['Seedream', '图片生成']
  },
  {
    id: 'adapter-huawei',
    category: 'service',
    name: '华为云适配器',
    path: 'src/services/adapters/huawei-video.ts',
    description: '华为云视频生成适配器',
    methods: ['generateVideo'],
    features: ['华为视频', '视频生成']
  },
  {
    id: 'adapter-stability',
    category: 'service',
    name: 'Stability AI适配器',
    path: 'src/services/adapters/stability-ai.ts',
    description: 'Stability图片生成适配器',
    methods: ['generateImage'],
    features: ['Stability图片', '图片生成']
  },
  {
    id: 'adapter-leonardo',
    category: 'service',
    name: 'Leonardo AI适配器',
    path: 'src/services/adapters/leonardo-ai.ts',
    description: 'Leonardo图片生成适配器',
    methods: ['generateImage'],
    features: ['Leonardo', '图片生成']
  },

  // ========== 系统服务 ==========
  {
    id: 'service-llm-manager',
    category: 'service',
    name: 'LLM服务管理器',
    path: 'src/services/llm-service-manager.ts',
    description: '统一管理多个LLM服务',
    methods: ['getService', 'registerService', 'listServices'],
    features: ['服务管理', '负载均衡']
  },
  {
    id: 'service-api-client',
    category: 'service',
    name: 'API客户端',
    path: 'src/services/api-client.ts',
    description: '统一的API请求处理',
    methods: ['request', 'upload', 'download'],
    features: ['请求管理', '上传下载']
  },
  {
    id: 'service-cache-manager',
    category: 'service',
    name: '缓存管理器',
    path: 'src/services/cache-manager.ts',
    description: '管理生成结果的缓存',
    methods: ['get', 'set', 'clear', 'getSize'],
    features: ['缓存读写', '清理']
  },
  {
    id: 'service-file-storage',
    category: 'service',
    name: '文件存储服务',
    path: 'src/services/file-storage.ts',
    description: '本地文件存储和管理',
    methods: ['save', 'load', 'delete', 'list'],
    features: ['文件操作']
  },
  {
    id: 'service-keyboard',
    category: 'service',
    name: '快捷键服务',
    path: 'src/services/keyboard-shortcuts.ts',
    description: '全局快捷键管理',
    methods: ['register', 'unregister', 'getShortcut'],
    features: ['快捷键注册', '事件分发']
  },
  {
    id: 'service-error-handler',
    category: 'service',
    name: '错误处理服务',
    path: 'src/services/error-handler.ts',
    description: '统一错误处理和报告',
    methods: ['handle', 'report', 'getErrorLog'],
    features: ['错误捕获', '日志记录']
  },
  {
    id: 'service-monitoring',
    category: 'service',
    name: '系统监控服务',
    path: 'src/services/monitoring.ts',
    description: '性能监控和统计',
    methods: ['track', 'measure', 'getMetrics'],
    features: ['性能追踪', '指标收集']
  },

  // ========== 配置文件 ==========
  {
    id: 'config-models',
    category: 'config',
    name: '模型配置',
    path: 'src/config/doubao-models.ts',
    description: '豆包模型配置',
    features: ['模型列表', '参数配置']
  },
  {
    id: 'config-minimax',
    category: 'config',
    name: 'MiniMax模型配置',
    path: 'src/config/minimax-models.ts',
    description: 'MiniMax模型配置',
    features: ['模型列表', 'API配置']
  },
  {
    id: 'config-workflow',
    category: 'config',
    name: '工作流配置',
    path: 'src/config/workflow-config.ts',
    description: '工作流相关配置',
    features: ['模板配置', '默认参数']
  },
  {
    id: 'config-prompts',
    category: 'config',
    name: '提示词模板',
    path: 'src/config/prompt-templates.ts',
    description: '常用提示词模板',
    features: ['模板库', '分类管理']
  },

  // ========== React Hooks ==========
  {
    id: 'hook-keyboard',
    category: 'hook',
    name: '键盘快捷键Hook',
    path: 'src/hooks/useKeyboardShortcuts.ts',
    description: '监听和处理键盘快捷键',
    methods: ['registerShortcut', 'handleKeyDown'],
    features: ['快捷键绑定', '事件处理']
  },
  {
    id: 'hook-history',
    category: 'hook',
    name: '历史记录Hook',
    path: 'src/hooks/useHistory.ts',
    description: '撤销/重做功能',
    methods: ['undo', 'redo', 'canUndo', 'canRedo'],
    features: ['历史管理']
  },
  {
    id: 'hook-storage',
    category: 'hook',
    name: '存储Hook',
    path: 'src/hooks/useStorage.ts',
    description: '本地存储操作',
    methods: ['getItem', 'setItem', 'removeItem'],
    features: ['数据持久化']
  },
  {
    id: 'hook-performance',
    category: 'hook',
    name: '性能监控Hook',
    path: 'src/hooks/usePerformance.ts',
    description: '性能指标监控',
    methods: ['measure', 'getMetrics'],
    features: ['性能分析']
  },
  {
    id: 'hook-presets',
    category: 'hook',
    name: '预设管理Hook',
    path: 'src/hooks/usePresets.ts',
    description: '预设模板管理',
    methods: ['loadPreset', 'savePreset', 'deletePreset'],
    features: ['模板管理']
  },
  {
    id: 'hook-theme',
    category: 'hook',
    name: '主题Hook',
    path: 'src/hooks/useTheme.ts',
    description: '主题切换管理',
    methods: ['setTheme', 'getTheme'],
    features: ['主题切换']
  },

  // ========== 核心组件 ==========
  {
    id: 'component-flow-editor',
    category: 'component',
    name: '流程编辑器',
    path: 'src/components/canvas/FlowEditor.tsx',
    description: '主画布和节点编辑器',
    features: ['节点编辑', '边连接', '缩放平移']
  },
  {
    id: 'component-node-palette',
    category: 'component',
    name: '节点面板',
    path: 'src/components/canvas/EnhancedNodePalette.tsx',
    description: '节点选择和拖拽',
    features: ['节点列表', '拖拽添加']
  },
  {
    id: 'component-toolbar',
    category: 'component',
    name: '工具栏',
    path: 'src/components/canvas/CanvasToolbar.tsx',
    description: '画布操作工具栏',
    features: ['操作按钮', '视图控制']
  },
  {
    id: 'component-timeline',
    category: 'component',
    name: '时间线',
    path: 'src/components/canvas/nodes/timeline/Timeline.tsx',
    description: '视频时间线编辑',
    features: ['多轨道', '剪辑操作']
  },
  {
    id: 'component-preview',
    category: 'component',
    name: '预览播放器',
    path: 'src/components/canvas/nodes/timeline/PreviewPlayer.tsx',
    description: '视频预览播放',
    features: ['播放控制', '进度条']
  }
];

export class SoftwareKnowledgeBase {
  private static instance: SoftwareKnowledgeBase;
  private knowledgeBase: Map<string, KnowledgeEntry>;

  private constructor() {
    this.knowledgeBase = new Map();
    SOFTWARE_KNOWLEDGE_BASE.forEach(entry => {
      this.knowledgeBase.set(entry.id, entry);
    });
  }

  public static getInstance(): SoftwareKnowledgeBase {
    if (!SoftwareKnowledgeBase.instance) {
      SoftwareKnowledgeBase.instance = new SoftwareKnowledgeBase();
    }
    return SoftwareKnowledgeBase.instance;
  }

  public search(query: string): KnowledgeEntry[] {
    const lowerQuery = query.toLowerCase();
    return SOFTWARE_KNOWLEDGE_BASE.filter(entry =>
      entry.name.toLowerCase().includes(lowerQuery) ||
      entry.description.toLowerCase().includes(lowerQuery) ||
      entry.features?.some(f => f.toLowerCase().includes(lowerQuery)) ||
      entry.methods?.some(m => m.toLowerCase().includes(lowerQuery))
    );
  }

  public getByCategory(category: KnowledgeEntry['category']): KnowledgeEntry[] {
    return SOFTWARE_KNOWLEDGE_BASE.filter(entry => entry.category === category);
  }

  public getById(id: string): KnowledgeEntry | undefined {
    return this.knowledgeBase.get(id);
  }

  public getQuickReference(): string {
    const sections: string[] = [];

    sections.push('【XTAICG 软件完整功能索引】\n');

    const categories = [
      { key: 'node', title: '节点类型' },
      { key: 'service', title: '核心服务' },
      { key: 'component', title: 'UI组件' },
      { key: 'hook', title: 'React Hooks' },
      { key: 'config', title: '配置文件' }
    ];

    categories.forEach(({ key, title }) => {
      const items = this.getByCategory(key as KnowledgeEntry['category']);
      if (items.length > 0) {
        sections.push(`\n## ${title} (${items.length}个)\n`);
        items.forEach(item => {
          sections.push(`\n### ${item.name}`);
          sections.push(`路径: ${item.path}`);
          sections.push(`说明: ${item.description}`);
          if (item.features && item.features.length > 0) {
            sections.push(`功能: ${item.features.join('、')}`);
          }
          if (item.methods && item.methods.length > 0) {
            sections.push(`方法: ${item.methods.join('、')}`);
          }
        });
      }
    });

    return sections.join('\n');
  }

  public getDetailedEntry(nameOrPath: string): string | null {
    const entry = SOFTWARE_KNOWLEDGE_BASE.find(e =>
      e.name.includes(nameOrPath) || e.path.includes(nameOrPath)
    );

    if (!entry) return null;

    let details = `\n【${entry.name}】\n\n`;
    details += `路径: ${entry.path}\n`;
    details += `类型: ${entry.category}\n`;
    details += `说明: ${entry.description}\n\n`;

    if (entry.features && entry.features.length > 0) {
      details += `功能特性:\n`;
      entry.features.forEach((f, i) => {
        details += `${i + 1}. ${f}\n`;
      });
      details += '\n';
    }

    if (entry.methods && entry.methods.length > 0) {
      details += `主要方法:\n`;
      entry.methods.forEach((m, i) => {
        details += `${i + 1}. ${m}()\n`;
      });
      details += '\n';
    }

    if (entry.props && entry.props.length > 0) {
      details += `属性/参数:\n`;
      entry.props.forEach((p, i) => {
        details += `${i + 1}. ${p}\n`;
      });
    }

    return details;
  }
}

export const softwareKnowledgeBase = SoftwareKnowledgeBase.getInstance();
