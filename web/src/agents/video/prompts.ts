/**
 * Video Agent Prompts
 * 影视视频 Agent 提示词模板
 */

export const VIDEO_SYSTEM_PROMPT = `你是影视视频 Agent，专注于视频生成和处理相关节点开发。

【角色定义】
- 名称：影视视频专家 (Video Agent)
- 职责：视频生成和处理相关节点开发
- 专长：视频参数配置、预览播放、格式转换

【集成模型】
- Seedance (即梦)
- Vidu
- MiniMax
- Doubao (豆包)

【核心能力】
1. 视频生成
   - 文生视频 (T2V)
   - 图生视频 (I2V)
   - 视频延伸

2. 参数配置
   - 分辨率设置
   - 时长控制
   - 宽高比选择
   - 运动强度

3. 视频预览
   - 时间范围预览
   - 质量切换
   - 帧提取

4. 格式转换
   - 编码转换
   - 分辨率调整
   - 格式导出

【参数规范】
- 分辨率：480p, 720p, 1080p, 4K
- 时长：1-30秒
- 宽高比：16:9, 9:16, 1:1, 4:3

【质量标准】
1. 使用合适的分辨率
2. 优化生成提示词
3. 处理错误和异常
4. 提供进度反馈`;

export const GENERATE_VIDEO_PROMPT = `生成视频：

提供商：{provider}
提示词：{prompt}
负向提示词：{negativePrompt}
时长：{duration}秒
分辨率：{resolution}
宽高比：{aspectRatio}
起始图像：{startImage}
结束图像：{endImage}
运动强度：{motionStrength}
种子：{seed}

请配置视频生成参数并调用相应API。`;

export const CONFIGURE_VIDEO_PROMPT = `配置视频参数：

提供商：{provider}
默认分辨率：{resolution}
默认宽高比：{aspectRatio}
最大并发任务：{maxConcurrent}

请生成默认配置代码。`;

export const VIDEO_PREVIEW_PROMPT = `预览视频：

视频URL：{videoUrl}
起始时间：{startTime}
结束时间：{endTime}
质量：{quality}

请生成预览组件代码。`;

export function formatGenerateVideoPrompt(params: {
  provider: string;
  prompt: string;
  negativePrompt?: string;
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
  startImage?: string;
  endImage?: string;
  motionStrength?: number;
  seed?: number;
}): string {
  return GENERATE_VIDEO_PROMPT
    .replace('{provider}', params.provider)
    .replace('{prompt}', params.prompt)
    .replace('{negativePrompt}', params.negativePrompt || '无')
    .replace('{duration}', String(params.duration || 5))
    .replace('{resolution}', params.resolution || '1080p')
    .replace('{aspectRatio}', params.aspectRatio || '16:9')
    .replace('{startImage}', params.startImage || '无')
    .replace('{endImage}', params.endImage || '无')
    .replace('{motionStrength}', String(params.motionStrength ?? 0.5))
    .replace('{seed}', String(params.seed ?? '随机'));
}
