import { softwareDocumentation } from './software-documentation';

export interface Command {
  id: string;
  command: string;
  name: string;
  description: string;
  icon: string;
  example: string;
  category: 'creation' | 'optimization' | 'translation' | 'workflow' | 'documentation' | 'utility' | 'node-control';
  action: (params: string) => string;
}

export const QUICK_COMMANDS: Command[] = [
  {
    id: 'optimize-prompt',
    command: '/优化',
    name: '提示词优化',
    description: '将简短的提示词优化为详细的描述',
    icon: '✨',
    example: '/优化 一只猫',
    category: 'optimization',
    action: (params: string) => `请优化以下提示词，增加细节和描述词，使其更适合AI生成高质量内容：\n\n"${params}"`,
  },
  {
    id: 'enhance-prompt',
    command: '/增强',
    name: '提示词增强',
    description: '为提示词添加风格、质量等修饰词',
    icon: '🚀',
    example: '/增强 风景画',
    category: 'optimization',
    action: (params: string) => `请为以下提示词添加详细的风格、质量、构图等修饰词：\n\n"${params}"`,
  },
  {
    id: 'generate-workflow',
    command: '/工作流',
    name: '生成工作流',
    description: '根据需求生成完整的工作流',
    icon: '🔄',
    example: '/工作流 生日祝福视频',
    category: 'workflow',
    action: (params: string) => `请为以下需求设计一个完整的工作流，包括所需的节点和连接方式：\n\n"${params}"\n\n请用以下格式回答：\n1. 工作流名称\n2. 所需节点列表\n3. 节点连接顺序\n4. 每个节点的建议参数`,
  },
  {
    id: 'suggest-nodes',
    command: '/推荐节点',
    name: '推荐节点',
    description: '根据需求推荐合适的节点',
    icon: '💡',
    example: '/推荐节点 视频制作',
    category: 'workflow',
    action: (params: string) => `请为以下需求推荐最合适的节点组合：\n\n"${params}"\n\n请列出推荐的节点类型和连接顺序。`,
  },
  {
    id: 'translate',
    command: '/翻译',
    name: '提示词翻译',
    description: '将提示词翻译成英文',
    icon: '🌐',
    example: '/翻译 一只可爱的猫咪',
    category: 'translation',
    action: (params: string) => `请将以下中文提示词翻译成英文，保持AI绘画/视频生成的专业术语：\n\n"${params}"`,
  },
  {
    id: 'code',
    command: '/代码',
    name: '代码生成',
    description: '生成相关代码',
    icon: '💻',
    example: '/代码 Python排序算法',
    category: 'utility',
    action: (params: string) => `请为以下需求生成代码：\n\n"${params}"`,
  },
  {
    id: 'help',
    command: '/帮助',
    name: '查看帮助',
    description: '显示所有可用命令',
    icon: '❓',
    example: '/帮助',
    category: 'utility',
    action: () => `以下是所有可用的快捷命令：\n\n\`\`\`\n${QUICK_COMMANDS.map(cmd => 
  `${cmd.command} - ${cmd.description}\n示例: ${cmd.example}`
).join('\n\n')}\n\`\`\`\n\n使用方法：在输入框输入命令即可。`,
  },
  {
    id: 'show-docs',
    command: '/文档',
    name: '查看文档',
    description: '查看软件操作文档',
    icon: '📖',
    example: '/文档 节点说明',
    category: 'documentation',
    action: (params: string) => {
      if (params.trim()) {
        const docs = softwareDocumentation.searchDocumentation(params);
        if (docs.length > 0) {
          return docs.map(doc => 
            `【${doc.icon} ${doc.title}】\n\n${doc.content}`
          ).join('\n\n---\n\n');
        } else {
          return `未找到关于"${params}"的文档。\n\n试试以下常用主题：\n• 快速开始\n• 节点说明\n• 工作流设计\n• 使用技巧`;
        }
      } else {
        return softwareDocumentation.getFullDocumentationText();
      }
    },
  },
  {
    id: 'quick-ref',
    command: '/教程',
    name: '快速教程',
    description: '查看软件快速入门教程',
    icon: '🎓',
    example: '/教程',
    category: 'documentation',
    action: () => softwareDocumentation.getQuickReferenceText(),
  },
  {
    id: 'node-guide',
    command: '/节点',
    name: '节点指南',
    description: '查看所有节点的使用说明',
    icon: '🔧',
    example: '/节点 图片生成',
    category: 'documentation',
    action: (params: string) => {
      if (params.includes('图片')) {
        return `【🖼️ 图片生成节点】\n\n${softwareDocumentation.getDocumentationById('image-gen-details')?.content || ''}`;
      } else if (params.includes('视频')) {
        return `【🎬 视频生成节点】\n\n${softwareDocumentation.getDocumentationById('video-gen-details')?.content || ''}`;
      } else {
        return `【🔧 节点类型说明】\n\n${softwareDocumentation.getDocumentationById('node-types')?.content || ''}`;
      }
    },
  },
  {
    id: 'troubleshooting',
    command: '/常见问题',
    name: '常见问题',
    description: '查看常见问题解答',
    icon: '🔧',
    example: '/常见问题',
    category: 'documentation',
    action: () => `【🔧 常见问题解答】\n\n${softwareDocumentation.getDocumentationById('troubleshooting')?.content || ''}`,
  },
  {
    id: 'shortcuts',
    command: '/快捷键',
    name: '快捷键',
    description: '查看软件快捷键',
    icon: '⌨️',
    example: '/快捷键',
    category: 'documentation',
    action: () => `【⌨️ 快捷键说明】\n\n${softwareDocumentation.getDocumentationById('keyboard-shortcuts')?.content || ''}`,
  },
  {
    id: 'recommend-params',
    command: '/推荐',
    name: '参数推荐',
    description: '根据需求推荐最佳参数配置',
    icon: '🎯',
    example: '/推荐 电影感视频',
    category: 'optimization',
    action: (params: string) => `请分析以下需求，生成最佳参数配置推荐：\n\n"${params}"\n\n请按以下格式输出：\n1. 风格分析\n2. 推荐参数（包含分辨率、质量、步数、CFG等）\n3. 推荐理由\n4. 置信度评分（0-100%）`,
  },
  {
    id: 'execute-workflow',
    command: '/执行',
    name: '执行工作流',
    description: '一键执行AI生成的工作流',
    icon: '▶️',
    example: '/执行 工作流ID',
    category: 'workflow',
    action: (params: string) => `执行工作流：${params}\n\n请确保之前已生成工作流，现在我将帮您执行。\n\n执行流程：\n1. 解析工作流定义\n2. 按拓扑顺序执行各节点\n3. 显示实时进度\n4. 输出最终结果`,
  },
  {
    id: 'param-guide',
    command: '/参数指南',
    name: '参数指南',
    description: '查看各节点参数详细说明',
    icon: '📋',
    example: '/参数指南',
    category: 'documentation',
    action: () => `【📋 参数配置指南】

🖼️ 图片生成参数
• 分辨率：1:1(方形)、16:9(横版)、9:16(竖版)
• 质量：HD(高清)、Standard(标准)
• CFG Scale：1-15，值越大越遵循提示词
• 步数：1-50，值越大细节越好
• 种子值：-1为随机，其他值为固定

🎬 视频生成参数
• 分辨率：16:9、9:16、1:1
• 时长：3秒、5秒、10秒
• 帧率：24fps、30fps、60fps
• 运动强度：1-100，影响动态程度
• 镜头控制：固定、推近、拉远、环绕

🔊 音频生成参数
• 语速：0.5-2.0，1.0为正常
• 音调：0.5-2.0，1.0为正常
• 音量：0-100

💡 小技巧
• 写实风格：CFG 7-8，步数 30+
• 创意风格：CFG 5-6，步数 20-25
• 快速预览：降低步数，节省时间`,
  },
  {
    id: 'style-presets',
    command: '/风格',
    name: '风格预设',
    description: '查看可用风格预设',
    icon: '🎨',
    example: '/风格',
    category: 'documentation',
    action: () => `【🎨 风格预设说明】

📸 写真风格
• 推荐CFG：7.5
• 推荐步数：30
• 特点：高清细腻，真实感强

🎌 动漫风格
• 推荐CFG：7
• 推荐步数：25
• 特点：线条清晰，色彩鲜艳

🎬 电影感风格
• 推荐CFG：8
• 推荐步数：35
• 特点：光影氛围强，构图讲究

🌃 赛博朋克
• 推荐CFG：8.5
• 推荐步数：35
• 特点：高对比，霓虹光效

🖌️ 水彩风格
• 推荐CFG：6.5
• 推荐步数：20
• 特点：柔和通透，笔触质感

🖼️ 油画风格
• 推荐CFG：7
• 推荐步数：30
• 特点：肌理丰富，色彩厚重

✨ 唯美梦幻
• 推荐CFG：7
• 推荐步数：25
• 特点：柔焦光效，色调淡雅

📺 复古风格
• 推荐CFG：6.5
• 推荐步数：25
• 特点：暖色旧时光感

使用方法：告诉AI助手你想要"电影感的风景视频"，系统会自动应用相应参数`,
  },
  {
    id: 'add-node',
    command: '/添加',
    name: '添加节点',
    description: '添加新节点到画布',
    icon: '➕',
    example: '/添加 图片生成节点',
    category: 'node-control',
    action: (params: string) => `请添加节点：${params}\n\n我将帮您在画布上创建一个新的节点。请告诉我：\n1. 节点类型（图片生成/视频生成/提示词等）\n2. 位置偏好（如果有）\n3. 初始参数（可选）`,
  },
  {
    id: 'delete-node',
    command: '/删除',
    name: '删除节点',
    description: '删除画布上的节点',
    icon: '🗑️',
    example: '/删除 节点ID',
    category: 'node-control',
    action: (params: string) => `请删除节点：${params}\n\n我将帮您删除指定的节点。请确认节点ID或名称。`,
  },
  {
    id: 'update-node',
    command: '/修改',
    name: '修改节点',
    description: '修改节点参数',
    icon: '✏️',
    example: '/修改 节点ID 分辨率=16:9',
    category: 'node-control',
    action: (params: string) => `请修改节点参数：${params}\n\n我将帮您更新节点配置。请告诉我：\n1. 节点ID或名称\n2. 要修改的参数\n3. 新参数值`,
  },
  {
    id: 'list-nodes',
    command: '/列表',
    name: '节点列表',
    description: '查看画布上所有节点',
    icon: '📋',
    example: '/列表',
    category: 'node-control',
    action: () => `查看画布上的所有节点\n\n我将列出当前画布上的所有节点及其基本信息。`,
  },
  {
    id: 'node-info',
    command: '/节点信息',
    name: '节点详情',
    description: '查看特定节点的详细信息',
    icon: '🔍',
    example: '/节点信息 节点ID',
    category: 'node-control',
    action: (params: string) => `查看节点详情：${params}\n\n我将显示指定节点的完整信息，包括类型、参数、连接等。`,
  },
  {
    id: 'connect-nodes',
    command: '/连接',
    name: '连接节点',
    description: '连接两个节点',
    icon: '🔗',
    example: '/连接 节点A 到 节点B',
    category: 'node-control',
    action: (params: string) => `连接节点：${params}\n\n我将帮您建立两个节点之间的数据连接。`,
  },
  {
    id: 'duplicate-node',
    command: '/复制节点',
    name: '复制节点',
    description: '复制一个节点',
    icon: '📑',
    example: '/复制节点 节点ID',
    category: 'node-control',
    action: (params: string) => `复制节点：${params}\n\n我将创建一个完全相同的节点副本。`,
  },
];

export class CommandService {
  private static instance: CommandService;

  private constructor() { /* noop */ }

  public static getInstance(): CommandService {
    if (!CommandService.instance) {
      CommandService.instance = new CommandService();
    }
    return CommandService.instance;
  }

  public parseCommand(input: string): { command: Command | null; params: string } {
    const trimmedInput = input.trim();
    
    for (const cmd of QUICK_COMMANDS) {
      if (trimmedInput.startsWith(cmd.command)) {
        const params = trimmedInput.slice(cmd.command.length).trim();
        return { command: cmd, params };
      }
    }

    return { command: null, params: trimmedInput };
  }

  public getCommandsByCategory(category: Command['category']): Command[] {
    return QUICK_COMMANDS.filter(cmd => cmd.category === category);
  }

  public getAllCommands(): Command[] {
    return QUICK_COMMANDS;
  }

  public searchCommands(query: string): Command[] {
    const lowerQuery = query.toLowerCase();
    return QUICK_COMMANDS.filter(cmd =>
      cmd.command.toLowerCase().includes(lowerQuery) ||
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery)
    );
  }

  public getCommandSuggestions(partial: string): Command[] {
    if (!partial.startsWith('/')) {
      return [];
    }

    const searchTerm = partial.slice(1).toLowerCase();
    return QUICK_COMMANDS.filter(cmd =>
      cmd.command.toLowerCase().includes(searchTerm) ||
      cmd.name.toLowerCase().includes(searchTerm)
    ).slice(0, 5);
  }
}

export const commandService = CommandService.getInstance();
