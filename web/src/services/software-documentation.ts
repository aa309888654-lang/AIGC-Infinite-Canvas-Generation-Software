/**
 * XTAICG 软件操作说明文档
 * 软件版本：v2.7.9
 */

import { softwareKnowledgeBase } from './software-knowledge-base';

export interface DocumentationSection {
  id: string;
  title: string;
  icon: string;
  content: string;
  category: 'getting-started' | 'nodes' | 'workflow' | 'tips';
}

export const SOFTWARE_DOCUMENTATION: DocumentationSection[] = [
  {
    id: 'overview',
    title: '软件概述',
    icon: '📖',
    category: 'getting-started',
    content: `XTAICG 是一款基于节点的可视化AI视频创作平台。

核心特性：
• 拖拽式节点工作流设计
• 支持10+主流AI视频生成模型
• 支持图片生成、音频生成
• 多轨道视频编辑器
• MiniMax大模型AI助手

适用场景：
• AI视频创作与编辑
• 多模态内容生成
• 短视频制作
• 自动化视频工作流`
  },
  {
    id: 'quick-start',
    title: '快速开始',
    icon: '🚀',
    category: 'getting-started',
    content: `快速开始使用步骤：

1. 创建工作流
   • 点击工具栏上的"新建工作流"按钮
   • 或使用快捷键 Ctrl+N

2. 添加节点
   • 从左侧节点面板拖拽节点到画布
   • 或双击画布空白处打开节点搜索

3. 连接节点
   • 从输出端口拖拽到输入端口
   • 确保数据类型匹配（图片、视频、音频等）

4. 配置节点参数
   • 点击节点打开配置面板
   • 设置模型、分辨率、质量等参数

5. 执行工作流
   • 点击工具栏的"执行"按钮
   • 观察节点状态变化

6. 导出结果
   • 点击"输出"节点查看结果
   • 使用导出功能保存文件`
  },
  {
    id: 'node-types',
    title: '节点类型说明',
    icon: '🔧',
    category: 'nodes',
    content: `可用节点类型：

📝 输入类节点
• 提示词节点 - 输入文本提示词
• 图片输入节点 - 上传参考图片
• 视频输入节点 - 上传视频文件

🎨 AI生成类节点
• 图片生成节点 - AI图片生成
  支持：文生图、图生图、参考图模式
  支持模型：豆包图片模型
  
• 视频生成节点 - AI视频生成
  支持：10+主流视频大模型
  支持模式：文生视频、图生视频、视频续写
  可配置：分辨率、时长、帧率、运动强度
  
• 连续视频生成节点 - 多片段串联
• 音频生成节点 - MiniMax TTS HD
  支持：语音克隆、音色选择、语速调节

✂️ AI剪辑类节点
• AI剪辑节点 - 多轨道视频编辑器
  功能：裁剪、拼接、特效、字幕、关键帧动画

🤖 AI助手节点
• AI助手 - MiniMax大模型驱动
  功能：提示词优化、工作流推荐、智能问答`
  },
  {
    id: 'image-gen-details',
    title: '图片生成节点详解',
    icon: '🖼️',
    category: 'nodes',
    content: `图片生成节点配置说明：

生成模式：
• 文生图 - 使用文字描述生成图片
• 图生图 - 基于参考图生成新图
• 参考图模式 - 保持结构生成变体

分辨率选项：
• 1:1 (1024x1024) - 方形图
• 16:9 (1024x576) - 横版图
• 9:16 (576x1024) - 竖版图

质量设置：
• HD - 高清质量，细节更丰富
• Standard - 标准质量，速度更快

风格预设：
• 照片写实、动漫风格、插画风格
• 赛博朋克、水彩画、油画等

高级参数：
• CFG Scale (1-15): 遵循提示词程度
• 生成步数 (1-50): 计算迭代次数
• 种子值 (-1=随机): 控制生成一致性`
  },
  {
    id: 'video-gen-details',
    title: '视频生成节点详解',
    icon: '🎬',
    category: 'nodes',
    content: `视频生成节点配置说明：

基础配置：
• 模型选择 - 支持豆包、即梦、智谱等多个模型
• 生成模式 - 文生视频/图生视频/视频续写

视频参数：
• 分辨率 - 16:9 (1080p)、9:16 (竖版)、1:1 (方形)
• 时长 - 3秒、5秒、10秒可选
• 帧率 - 24fps、30fps、60fps

运动控制：
• 运动强度 - 控制画面动态程度
• 镜头控制 - 固定、推近、拉远、环绕
• 镜头强度 - 控制镜头运动幅度

首帧/尾帧控制：
• 首帧图片 - 指定视频起始画面
• 尾帧图片 - 指定视频结束画面
• 参考图 - 保持角色/场景一致性

提示词技巧：
• 主体描述 - 描述画面主体
• 场景环境 - 描述背景环境
• 运动描述 - 描述预期运动
• 风格指定 - 添加艺术风格`
  },
  {
    id: 'workflow-design',
    title: '工作流设计指南',
    icon: '🔄',
    category: 'workflow',
    content: `工作流设计原则：

1. 从左到右的数据流
   • 输入节点放左侧
   • 处理节点放中间
   • 输出节点放右侧

2. 数据类型匹配
   • 端口颜色标识数据类型
   • 绿色-图片 蓝色-视频 橙色-音频 紫色-文本

3. 常见工作流模板：

   【图片生成工作流】
   提示词节点 → 图片生成节点 → 输出节点

   【视频生成工作流】
   提示词节点 → 图片生成节点 → 视频生成节点 → 输出节点

   【带剪辑的工作流】
   视频输入 → AI剪辑节点 → 输出节点

   【AI辅助工作流】
   AI助手节点 → 提示词节点 → 视频生成节点 → 输出节点

4. 节点组合技巧
   • 多个提示词可以合并输入
   • 多个生成结果可以串联
   • 使用AI助手优化提示词再生成`
  },
  {
    id: 'tips-tricks',
    title: '使用技巧与建议',
    icon: '💡',
    category: 'tips',
    content: `高效使用技巧：

🎯 提示词优化
• 使用AI助手的 /优化 命令优化提示词
• 添加详细的场景描述
• 指定艺术风格和光线条件
• 使用负面提示词排除不要的元素

⏱️ 性能优化
• 批量生成时使用相同种子值
• 合理选择分辨率（不追求过高）
• 预览用低分辨率，正式输出用高分辨率

🔄 工作流复用
• 保存常用工作流为模板
• 使用工作流市场导入他人工作流
• AI助手可自动生成工作流

🎨 质量提升
• 参考图模式保持风格一致
• 首尾帧控制确保视频连贯性
• AI剪辑添加转场和特效提升观感

🆘 遇到问题
• 查看节点状态提示
• 检查端口连接是否正确
• 查看控制台错误日志
• 使用AI助手询问解决方案`
  },
  {
    id: 'keyboard-shortcuts',
    title: '快捷键说明',
    icon: '⌨️',
    category: 'tips',
    content: `全局快捷键：

画布操作：
• Ctrl + N - 新建工作流
• Ctrl + S - 保存工作流
• Ctrl + Z - 撤销
• Ctrl + Y - 重做
• Delete - 删除选中节点
• Ctrl + A - 全选
• Ctrl + D - 复制选中
• Ctrl + V - 粘贴

视图控制：
• 鼠标滚轮 - 缩放画布
• 空格 + 拖拽 - 平移画布
• Ctrl + 0 - 适应全部
• Ctrl + 1 - 原始大小

AI助手命令（输入/开头）：
• /优化 - 优化提示词
• /增强 - 增强提示词
• /工作流 - 生成工作流
• /推荐节点 - 推荐合适节点
• /翻译 - 翻译提示词为英文
• /代码 - 生成代码
• /帮助 - 查看所有命令
• /文档 - 查看软件文档
• /教程 - 查看使用教程`
  },
  {
    id: 'troubleshooting',
    title: '常见问题解答',
    icon: '🔧',
    category: 'tips',
    content: `常见问题与解决方案：

Q: 节点连接不上怎么办？
A: 检查两端端口类型是否匹配，确保输入输出方向正确。

Q: 生成失败怎么解决？
A: 1. 检查API配置是否正确
   2. 查看错误提示信息
   3. 尝试降低分辨率或步数
   4. 检查网络连接

Q: 如何提升生成质量？
A: 1. 使用更详细的提示词
   2. 提高生成步数
   3. 使用参考图保持一致性
   4. 适当调高CFG值

Q: 工作流保存失败？
A: 检查存储空间是否充足，尝试保存到其他位置。

Q: AI助手无法使用？
A: 1. 检查MiniMax API配置
   2. 确认API额度充足
   3. 查看网络连接状态

Q: 如何导入他人工作流？
A: 点击"导入"按钮，选择.flow或.json文件即可。`
  },
  {
    id: 'ai-assistant-usage',
    title: 'AI助手使用指南',
    icon: '🤖',
    category: 'tips',
    content: `AI助手功能详解：

🎯 核心功能
• 智能问答 - 解答软件使用问题
• 提示词优化 - 将简单描述转为专业提示词
• 工作流生成 - 根据需求自动设计工作流
• 节点推荐 - 推荐适合的节点组合

💬 使用方式
• 直接输入问题
• 使用 / 命令快速操作
• 输入需求描述让AI帮你设计

📝 快捷命令
• /优化 [描述] - 优化提示词
• /工作流 [需求] - 生成工作流
• /推荐节点 [场景] - 推荐节点
• /文档 [主题] - 查看文档
• /帮助 - 显示所有命令

💡 使用技巧
• 描述越详细，AI理解越准确
• 可以让AI解释某个节点的功能
• 可以让AI帮你调试工作流问题
• 询问AI获取创意灵感

🔧 配置说明
• 模型选择：推荐使用ABAB 6.5S
• 温度设置：创意任务用高值，精确任务用低值
• API密钥：在设置中配置MiniMax密钥`
  },
];

export class SoftwareDocumentationService {
  private static instance: SoftwareDocumentationService;

  private constructor() { /* noop */ }

  public static getInstance(): SoftwareDocumentationService {
    if (!SoftwareDocumentationService.instance) {
      SoftwareDocumentationService.instance = new SoftwareDocumentationService();
    }
    return SoftwareDocumentationService.instance;
  }

  public getAllDocumentation(): DocumentationSection[] {
    return SOFTWARE_DOCUMENTATION;
  }

  public getDocumentationByCategory(category: DocumentationSection['category']): DocumentationSection[] {
    return SOFTWARE_DOCUMENTATION.filter(doc => doc.category === category);
  }

  public getDocumentationById(id: string): DocumentationSection | undefined {
    return SOFTWARE_DOCUMENTATION.find(doc => doc.id === id);
  }

  public searchDocumentation(query: string): DocumentationSection[] {
    const lowerQuery = query.toLowerCase();
    return SOFTWARE_DOCUMENTATION.filter(doc =>
      doc.title.toLowerCase().includes(lowerQuery) ||
      doc.content.toLowerCase().includes(lowerQuery)
    );
  }

  public getFullDocumentationText(): string {
    return SOFTWARE_DOCUMENTATION.map(doc =>
      `【${doc.title}】\n\n${doc.content}\n`
    ).join('\n---\n\n');
  }

  public getQuickReferenceText(): string {
    return `【XTAICG 快速参考】

📝 基础操作
• 拖拽添加节点
• 连接端口创建数据流
• 点击节点配置参数
• 执行按钮运行工作流

🔗 节点类型
• 输入：提示词、图片、视频
• 生成：图片、视频、音频
• 剪辑：AI剪辑编辑器
• 助手：AI智能问答

💡 快捷命令
• /优化 - 优化提示词
• /工作流 - 生成工作流
• /文档 - 查看完整文档
• /帮助 - 显示帮助

🎯 提示词技巧
• 具体描述主体和场景
• 添加风格和质量描述
• 使用负面提示词排除干扰
• 让AI助手帮你优化

更多帮助请输入：/文档 [主题]`;
  }
}

export const softwareDocumentation = SoftwareDocumentationService.getInstance();

export function getSystemPromptWithDocumentation(basePrompt?: string): string {
  const docs = softwareDocumentation.getQuickReferenceText();
  const knowledgeBase = softwareKnowledgeBase.getQuickReference();
  
  return `${basePrompt || '你是一个专业的AI视频创作助手，基于AICG模型。'}

【重要】关于自己的身份：
- 如果有人问"你是什么模型"或"你是什么大模型"，请回答"我是AICG模型"
- 如果有人问"你是谁"或"你是基于什么模型"，请回答你是基于AICG模型的智能助手
- 不要提及MiniMax、abab或其他第三方模型名称

【软件背景知识】
以下是 XTAICG 的操作说明文档，请结合这些知识回答用户问题：

${docs}

【完整功能索引】
以下是软件所有功能的完整索引，供深入查询使用：

${knowledgeBase}

【回答原则】
1. 结合软件功能给出具体指导
2. 建议使用软件的快捷命令（如 /优化、/工作流）
3. 对于操作问题，引用相关文档内容
4. 保持回答简洁实用
5. 如需了解特定功能的详细信息，可使用知识库中的路径和方法说明`;
}
