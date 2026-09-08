/**
 * Node Development Agent Prompts
 * 节点开发专家 Agent 提示词模板
 */

/** 系统提示词 */
export const NODE_DEV_SYSTEM_PROMPT = `你是节点开发专家 Agent，专注于设计和开发 React Flow 节点组件。

【角色定义】
- 名称：节点开发专家 (Node Dev Agent)
- 职责：设计和开发 React Flow 可视化节点组件
- 专长：创建节点、定义接口、管理状态、数据流编排

【技术栈】
- React 18+
- TypeScript 4.9+
- React Flow (xyflow)
- Tailwind CSS
- Zustand (状态管理)

【核心能力】
1. 节点组件开发
   - 创建标准输入/输出节点
   - 开发生成类节点（图像、视频、音频）
   - 实现自定义处理节点

2. 接口定义
   - 设计节点输入/输出端口
   - 定义数据类型和验证规则
   - 处理端口连接兼容性

3. 状态管理
   - 管理节点内部状态
   - 处理节点间数据流
   - 实现撤销/重做支持

4. UI/UX 设计
   - 设计节点外观和样式
   - 实现参数配置面板
   - 添加交互反馈

【节点类型】
- videoGen: 视频生成节点
- imageGen: 图像生成节点
- audioGen: 音频生成节点
- mangaGen: 漫剧生成节点
- textInput: 文本输入节点
- videoInput: 视频输入节点
- imageInput: 图像输入节点
- output: 输出节点
- custom: 自定义节点

【代码规范】
1. 使用 React.memo 优化渲染性能
2. 使用 TypeScript 严格类型
3. 遵循 React Flow 组件规范
4. 使用 Tailwind CSS 样式
5. 实现错误边界和加载状态

【工作流程】
1. 分析需求 → 确定节点类型和功能
2. 设计接口 → 定义输入输出端口
3. 编写代码 → 生成完整组件代码
4. 验证测试 → 确保功能正常

请使用 tools 完成节点开发任务。`;

/** 创建节点提示词模板 */
export const CREATE_NODE_PROMPT = `创建一个新的 React Flow 节点：

节点类型：{nodeType}
节点名称：{label}
分类：{category}
描述：{description}

输入端口：
{inputs}

输出端口：
{outputs}

参数配置：
{parameters}

请生成完整的节点组件代码，包括：
1. React Flow 组件实现
2. Handle（连接点）配置
3. 参数配置面板
4. 样式和交互
5. 类型定义`;

/** 更新节点提示词模板 */
export const UPDATE_NODE_PROMPT = `更新现有节点：

节点ID：{nodeId}
更新内容：
{updates}

请生成更新后的节点组件代码。`;

/** 验证节点提示词 */
export const VALIDATE_NODE_PROMPT = `验证节点配置：

节点配置：
{config}

请检查：
1. 输入/输出端口类型是否匹配
2. 参数配置是否完整
3. 代码是否符合规范
4. 是否有潜在问题

返回验证结果和建议。`;

/** 节点模板列表 */
export const NODE_TEMPLATES = {
  videoGen: {
    name: '视频生成节点',
    description: '使用 AI 模型生成视频',
    category: 'generation',
    icon: '🎬',
    color: '#6366f1',
  },
  imageGen: {
    name: '图像生成节点',
    description: '使用 AI 模型生成图像',
    category: 'generation',
    icon: '🎨',
    color: '#8b5cf6',
  },
  audioGen: {
    name: '音频生成节点',
    description: '生成背景音乐或音效',
    category: 'generation',
    icon: '🎵',
    color: '#ec4899',
  },
  mangaGen: {
    name: '漫剧生成节点',
    description: '生成漫剧内容',
    category: 'generation',
    icon: '📚',
    color: '#f59e0b',
  },
  textInput: {
    name: '文本输入节点',
    description: '输入文本内容',
    category: 'input',
    icon: '📝',
    color: '#10b981',
  },
  videoInput: {
    name: '视频输入节点',
    description: '输入视频文件',
    category: 'input',
    icon: '🎥',
    color: '#9CA3AF',
  },
  frameExtractor: {
    name: '视频抽帧节点',
    description: '从视频中提取关键帧并输出图片帧',
    category: 'processing',
    icon: '🎞️',
    color: '#f59e0b',
  },
  imageInput: {
    name: '图像输入节点',
    description: '输入图像文件',
    category: 'input',
    icon: '🖼️',
    color: '#ef4444',
  },
  output: {
    name: '输出节点',
    description: '输出结果',
    category: 'output',
    icon: '📤',
    color: '#64748b',
  },
};

/**
 * 格式化节点创建提示词
 */
export function formatCreateNodePrompt(config: {
  nodeType: string;
  label: string;
  category: string;
  description?: string;
  inputs?: Array<{ name: string; type: string; required?: boolean }>;
  outputs?: Array<{ name: string; type: string; required?: boolean }>;
  parameters?: Array<{ name: string; type: string; label: string; defaultValue?: unknown }>;
}): string {
  const template = CREATE_NODE_PROMPT;

  return template
    .replace('{nodeType}', config.nodeType)
    .replace('{label}', config.label)
    .replace('{category}', config.category)
    .replace('{description}', config.description || '无')
    .replace(
      '{inputs}',
      config.inputs?.map((i) => `- ${i.name} (${i.type}${i.required ? ', 必需' : ', 可选'})`).join('\n') ||
        '无'
    )
    .replace(
      '{outputs}',
      config.outputs?.map((o) => `- ${o.name} (${o.type}${o.required ? ', 必需' : ', 可选'})`).join('\n') ||
        '无'
    )
    .replace(
      '{parameters}',
      config.parameters
        ?.map((p) => `- ${p.label} (${p.type}, 默认值: ${p.defaultValue ?? '无'})`)
        .join('\n') || '无'
    );
}

/**
 * 格式化验证提示词
 */
export function formatValidatePrompt(config: Record<string, unknown>): string {
  return VALIDATE_NODE_PROMPT.replace('{config}', JSON.stringify(config, null, 2));
}
