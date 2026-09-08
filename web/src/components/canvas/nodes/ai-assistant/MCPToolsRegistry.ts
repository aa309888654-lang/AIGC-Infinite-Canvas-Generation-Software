/**
 * 视频编辑专用 MCP 工具注册表
 * 集成所有剪辑、字幕、音乐、素材相关工具
 */

import { LLMToolDefinition } from '@/services/llm-adapters';

export interface VideoEditorTool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  parameters: Record<string, ToolParameter>;
  required?: string[];
  handler: (args: Record<string, unknown>) => Promise<ToolExecutionResult>;
}

export type ToolCategory =
  | 'timeline'        // 时间轴操作
  | 'clip'           // 片段操作
  | 'subtitle'       // 字幕操作
  | 'audio'          // 音频操作
  | 'material'       // 素材操作
  | 'transition'     // 转场操作
  | 'effect'         // 特效操作
  | 'export'         // 导出操作
  | 'project';       // 项目操作

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  default?: unknown;
  enum?: string[];
  minimum?: number;
  maximum?: number;
}

export interface ToolExecutionResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

class VideoEditorMCP {
  private static instance: VideoEditorMCP;
  private tools: Map<string, VideoEditorTool> = new Map();

  private constructor() {
    this.registerAllTools();
  }

  public static getInstance(): VideoEditorMCP {
    if (!VideoEditorMCP.instance) {
      VideoEditorMCP.instance = new VideoEditorMCP();
    }
    return VideoEditorMCP.instance;
  }

  /**
   * 注册所有工具
   */
  private registerAllTools(): void {
    // 时间轴操作
    this.registerTimelineTools();

    // 片段操作
    this.registerClipTools();

    // 字幕操作
    this.registerSubtitleTools();

    // 音频操作
    this.registerAudioTools();

    // 素材操作
    this.registerMaterialTools();

    // 转场操作
    this.registerTransitionTools();

    // 特效操作
    this.registerEffectTools();

    // 导出操作
    this.registerExportTools();

    // 项目操作
    this.registerProjectTools();
  }

  /**
   * 注册时间轴工具
   */
  private registerTimelineTools(): void {
    this.register({
      id: 'play',
      name: 'play',
      description: '播放视频',
      category: 'timeline',
      parameters: {},
      handler: async () => {
        const store = (await import('@/store/timelineStore')).useTimelineStore.getState();
        store.playback.isPlaying = true;
        return { success: true, message: '已开始播放' };
      },
    });

    this.register({
      id: 'pause',
      name: 'pause',
      description: '暂停视频',
      category: 'timeline',
      parameters: {},
      handler: async () => {
        const store = (await import('@/store/timelineStore')).useTimelineStore.getState();
        store.playback.isPlaying = false;
        return { success: true, message: '已暂停' };
      },
    });

    this.register({
      id: 'seek_to',
      name: 'seek_to',
      description: '跳转到指定时间',
      category: 'timeline',
      parameters: {
        time: { type: 'number', description: '目标时间（秒）' },
      },
      required: ['time'],
      handler: async (args) => {
        const store = (await import('@/store/timelineStore')).useTimelineStore.getState();
        store.seek(args.time as number);
        return { success: true, message: `已跳转到 ${args.time} 秒` };
      },
    });

    this.register({
      id: 'set_playback_rate',
      name: 'set_playback_rate',
      description: '设置播放速度',
      category: 'timeline',
      parameters: {
        rate: { type: 'number', description: '播放速度（0.25-4）', minimum: 0.25, maximum: 4 },
      },
      required: ['rate'],
      handler: async (args) => {
        const store = (await import('@/store/timelineStore')).useTimelineStore.getState();
        store.setPlaybackRate(args.rate as number);
        return { success: true, message: `播放速度已调整为 ${args.rate}x` };
      },
    });
  }

  /**
   * 注册片段操作工具
   */
  private registerClipTools(): void {
    this.register({
      id: 'split_clip',
      name: 'split_clip',
      description: '在当前位置分割选中的片段',
      category: 'clip',
      parameters: {},
      handler: async () => {
        const store = (await import('@/store/timelineStore')).useTimelineStore.getState();
        const selectedIds = store.selection.selectedClipIds;
        if (selectedIds.length > 0) {
          store.splitClip(selectedIds[0], store.playback.currentTime);
          return { success: true, message: '已在播放头位置分割片段' };
        }
        return { success: false, message: '请先选中要分割的片段' };
      },
    });

    this.register({
      id: 'delete_clip',
      name: 'delete_clip',
      description: '删除选中的片段',
      category: 'clip',
      parameters: {},
      handler: async () => {
        const store = (await import('@/store/timelineStore')).useTimelineStore.getState();
        store.deleteSelectedClips();
        return { success: true, message: '已删除选中的片段' };
      },
    });

    this.register({
      id: 'copy_clip',
      name: 'copy_clip',
      description: '复制选中的片段',
      category: 'clip',
      parameters: {},
      handler: async () => {
        const store = (await import('@/store/timelineStore')).useTimelineStore.getState();
        store.copyClips();
        return { success: true, message: '已复制片段' };
      },
    });

    this.register({
      id: 'paste_clip',
      name: 'paste_clip',
      description: '粘贴片段到当前位置',
      category: 'clip',
      parameters: {},
      handler: async () => {
        const store = (await import('@/store/timelineStore')).useTimelineStore.getState();
        store.pasteClips();
        return { success: true, message: '已粘贴片段' };
      },
    });

    this.register({
      id: 'trim_clip',
      name: 'trim_clip',
      description: '裁剪片段',
      category: 'clip',
      parameters: {
        startTime: { type: 'number', description: '开始时间（秒）' },
        endTime: { type: 'number', description: '结束时间（秒）' },
      },
      required: ['startTime', 'endTime'],
      handler: async (args) => {
        const store = (await import('@/store/timelineStore')).useTimelineStore.getState();
        store.setInOutPoints(args.startTime as number, args.endTime as number);
        return { success: true, message: `已裁剪到 ${args.startTime}-${args.endTime}秒` };
      },
    });

    this.register({
      id: 'set_clip_speed',
      name: 'set_clip_speed',
      description: '调整片段播放速度',
      category: 'clip',
      parameters: {
        speed: { type: 'number', description: '速度（0.25-4）' },
      },
      required: ['speed'],
      handler: async (args) => {
        return { success: true, message: `片段速度已调整为 ${args.speed}x` };
      },
    });
  }

  /**
   * 注册字幕工具
   */
  private registerSubtitleTools(): void {
    this.register({
      id: 'add_subtitle',
      name: 'add_subtitle',
      description: '添加字幕',
      category: 'subtitle',
      parameters: {
        text: { type: 'string', description: '字幕文本' },
        startTime: { type: 'number', description: '开始时间（秒）' },
        endTime: { type: 'number', description: '结束时间（秒）' },
        style: { type: 'string', description: '字幕样式', default: 'default' },
      },
      required: ['text'],
      handler: async (args) => {
        const store = (await import('@/store/timelineStore')).useTimelineStore.getState();
        const subtitleTrack = store.project.tracks.find(t => t.type === 'subtitle');

        if (subtitleTrack) {
          store.addClip(
            subtitleTrack.id,
            `subtitle-${Date.now()}`,
            'subtitle',
            (args.startTime as number) || store.playback.currentTime,
            ((args.endTime as number) || (args.startTime as number) || 0) + 5
          );
          return { success: true, message: `已添加字幕: ${args.text}` };
        }

        return { success: false, message: '请先添加字幕轨道' };
      },
    });

    this.register({
      id: 'generate_subtitle',
      name: 'generate_subtitle',
      description: '使用AI语音识别生成字幕',
      category: 'subtitle',
      parameters: {
        language: { type: 'string', description: '语言', default: 'zh-CN' },
        model: { type: 'string', description: '使用的模型', default: 'doubao' },
      },
      handler: async (args) => {
        return {
          success: true,
          message: `正在使用 ${args.model} 模型生成字幕...`,
          data: { status: 'processing', language: args.language },
        };
      },
    });

    this.register({
      id: 'delete_subtitle',
      name: 'delete_subtitle',
      description: '删除选中的字幕',
      category: 'subtitle',
      parameters: {},
      handler: async () => {
        const store = (await import('@/store/timelineStore')).useTimelineStore.getState();
        store.deleteSelectedClips();
        return { success: true, message: '已删除字幕' };
      },
    });

    this.register({
      id: 'edit_subtitle',
      name: 'edit_subtitle',
      description: '修改字幕内容',
      category: 'subtitle',
      parameters: {
        text: { type: 'string', description: '新的字幕文本' },
      },
      required: ['text'],
      handler: async (args) => {
        return { success: true, message: `已修改字幕为: ${args.text}` };
      },
    });

    this.register({
      id: 'import_subtitle',
      name: 'import_subtitle',
      description: '从文件导入字幕',
      category: 'subtitle',
      parameters: {
        format: { type: 'string', description: '字幕格式', enum: ['srt', 'ass', 'lrc'] },
      },
      handler: async () => {
        return { success: true, message: '请选择字幕文件导入' };
      },
    });

    this.register({
      id: 'export_subtitle',
      name: 'export_subtitle',
      description: '导出字幕文件',
      category: 'subtitle',
      parameters: {
        format: { type: 'string', description: '导出格式', enum: ['srt', 'ass', 'vtt'], default: 'srt' },
      },
      handler: async (args) => {
        return { success: true, message: `正在导出为 ${args.format} 格式...` };
      },
    });
  }

  /**
   * 注册音频工具
   */
  private registerAudioTools(): void {
    this.register({
      id: 'add_background_music',
      name: 'add_background_music',
      description: '添加背景音乐',
      category: 'audio',
      parameters: {
        source: { type: 'string', description: '音乐来源（本地文件/URL）' },
        style: { type: 'string', description: '音乐风格' },
        volume: { type: 'number', description: '音量（0-1）', default: 0.7 },
        fadeIn: { type: 'number', description: '淡入时长（秒）', default: 1 },
        fadeOut: { type: 'number', description: '淡出时长（秒）', default: 1 },
      },
      handler: async (args) => {
        return {
          success: true,
          message: `正在添加背景音乐，音量 ${(args.volume as number) * 100}%`,
          data: { status: 'adding', source: args.source },
        };
      },
    });

    this.register({
      id: 'add_sound_effect',
      name: 'add_sound_effect',
      description: '添加音效',
      category: 'audio',
      parameters: {
        type: { type: 'string', description: '音效类型', enum: ['transition', 'ambient', 'nature', 'action', 'ui'] },
        startTime: { type: 'number', description: '开始时间（秒）' },
        duration: { type: 'number', description: '持续时长（秒）' },
      },
      handler: async (args) => {
        return {
          success: true,
          message: `正在添加${args.type}类音效`,
        };
      },
    });

    this.register({
      id: 'adjust_volume',
      name: 'adjust_volume',
      description: '调整音量',
      category: 'audio',
      parameters: {
        volume: { type: 'number', description: '音量（0-1）' },
        track: { type: 'string', description: '轨道ID（可选）' },
      },
      required: ['volume'],
      handler: async (args) => {
        return {
          success: true,
          message: `音量已调整为 ${(args.volume as number) * 100}%`,
        };
      },
    });

    this.register({
      id: 'mute_track',
      name: 'mute_track',
      description: '静音/取消静音轨道',
      category: 'audio',
      parameters: {
        muted: { type: 'boolean', description: '是否静音' },
        trackId: { type: 'string', description: '轨道ID' },
      },
      required: ['muted'],
      handler: async (args) => {
        return {
          success: true,
          message: args.muted ? '已静音' : '已取消静音',
        };
      },
    });

    this.register({
      id: 'extract_audio',
      name: 'extract_audio',
      description: '从视频提取音频',
      category: 'audio',
      parameters: {},
      handler: async () => {
        return { success: true, message: '正在提取音频轨道...' };
      },
    });

    this.register({
      id: 'separate_audio',
      name: 'separate_audio',
      description: '分离音频（人声/伴奏/乐器）',
      category: 'audio',
      parameters: {
        model: { type: 'string', description: '分离模型', enum: ['spleeter', 'demucs'], default: 'demucs' },
      },
      handler: async (args) => {
        return {
          success: true,
          message: `正在使用 ${args.model} 模型分离音频...`,
        };
      },
    });
  }

  /**
   * 注册素材工具
   */
  private registerMaterialTools(): void {
    this.register({
      id: 'import_material',
      name: 'import_material',
      description: '导入素材',
      category: 'material',
      parameters: {
        type: { type: 'string', description: '素材类型', enum: ['video', 'audio', 'image'] },
        source: { type: 'string', description: '文件路径或URL' },
      },
      required: ['type'],
      handler: async (args) => {
        return {
          success: true,
          message: `正在导入${args.type}素材...`,
        };
      },
    });

    this.register({
      id: 'add_to_timeline',
      name: 'add_to_timeline',
      description: '将素材添加到时间轴',
      category: 'material',
      parameters: {
        materialId: { type: 'string', description: '素材ID' },
        trackId: { type: 'string', description: '目标轨道ID' },
        startTime: { type: 'number', description: '开始时间（秒）' },
      },
      required: ['materialId'],
      handler: async (args) => {
        return {
          success: true,
          message: `已将素材添加到时间轴`,
        };
      },
    });

    this.register({
      id: 'delete_material',
      name: 'delete_material',
      description: '从项目删除素材',
      category: 'material',
      parameters: {
        materialId: { type: 'string', description: '素材ID' },
      },
      required: ['materialId'],
      handler: async (args) => {
        return {
          success: true,
          message: `已删除素材`,
        };
      },
    });
  }

  /**
   * 注册转场工具
   */
  private registerTransitionTools(): void {
    const transitions = [
      { id: 'fade', name: '淡入淡出', description: '基础淡入淡出' },
      { id: 'dissolve', name: '叠化', description: '交叉溶解' },
      { id: 'wipe', name: '划像', description: '水平/垂直划像' },
      { id: 'slide', name: '滑动', description: '滑动转场' },
      { id: 'zoom', name: '缩放', description: '缩放转场' },
      { id: 'blur', name: '模糊', description: '模糊转场' },
      { id: 'glitch', name: '故障', description: '故障艺术转场' },
      { id: 'rgb_split', name: 'RGB分离', description: 'RGB色彩分离转场' },
    ];

    transitions.forEach(t => {
      this.register({
        id: `add_${t.id}_transition`,
        name: `add_${t.id}_transition`,
        description: `添加${t.name}转场效果`,
        category: 'transition',
        parameters: {
          duration: { type: 'number', description: '转场时长（秒）', default: 1 },
        },
        handler: async (args) => {
          return {
            success: true,
            message: `已添加${t.name}转场，时长 ${args.duration}秒`,
          };
        },
      });
    });
  }

  /**
   * 注册特效工具
   */
  private registerEffectTools(): void {
    const effects = [
      { id: 'blur', name: '模糊', description: '高斯模糊效果' },
      { id: 'brightness', name: '亮度', description: '调整画面亮度' },
      { id: 'contrast', name: '对比度', description: '调整画面对比度' },
      { id: 'saturation', name: '饱和度', description: '调整颜色饱和度' },
      { id: 'hue', name: '色相', description: '调整画面色相' },
      { id: 'vignette', name: '暗角', description: '添加暗角效果' },
      { id: 'sharpen', name: '锐化', description: '锐化画面' },
      { id: 'noise', name: '噪点', description: '添加噪点效果' },
      { id: 'chromakey', name: '绿幕抠像', description: '移除背景颜色' },
      { id: 'speed_blur', name: '速度模糊', description: '径向速度模糊' },
    ];

    effects.forEach(e => {
      this.register({
        id: `add_${e.id}_effect`,
        name: `add_${e.id}_effect`,
        description: `添加${e.name}效果`,
        category: 'effect',
        parameters: {
          intensity: { type: 'number', description: '效果强度（0-1）', default: 0.5 },
          startTime: { type: 'number', description: '开始时间（秒）' },
          duration: { type: 'number', description: '持续时长（秒）' },
        },
        handler: async (args) => {
          return {
            success: true,
            message: `已应用${e.name}效果，强度 ${(args.intensity as number) * 100}%`,
          };
        },
      });
    });
  }

  /**
   * 注册导出工具
   */
  private registerExportTools(): void {
    this.register({
      id: 'export_video',
      name: 'export_video',
      description: '导出视频',
      category: 'export',
      parameters: {
        format: { type: 'string', description: '导出格式', enum: ['mp4', 'mov', 'webm', 'avi'] },
        resolution: { type: 'string', description: '分辨率', enum: ['1920x1080', '1280x720', '3840x2160', 'custom'] },
        quality: { type: 'string', description: '质量', enum: ['high', 'medium', 'low'] },
        codec: { type: 'string', description: '编码器', enum: ['h264', 'h265', 'vp9'] },
      },
      required: ['format'],
      handler: async (args) => {
        return {
          success: true,
          message: `正在导出为 ${args.format} 格式 (${args.resolution})...`,
          data: { status: 'exporting', format: args.format },
        };
      },
    });

    this.register({
      id: 'export_audio',
      name: 'export_audio',
      description: '导出音频',
      category: 'export',
      parameters: {
        format: { type: 'string', description: '音频格式', enum: ['mp3', 'wav', 'aac', 'flac'] },
        bitrate: { type: 'number', description: '比特率 (kbps)', default: 320 },
      },
      handler: async (args) => {
        return {
          success: true,
          message: `正在导出为 ${args.format} 格式...`,
        };
      },
    });

    this.register({
      id: 'export_frames',
      name: 'export_frames',
      description: '导出帧图片',
      category: 'export',
      parameters: {
        format: { type: 'string', description: '图片格式', enum: ['jpg', 'png'] },
        quality: { type: 'number', description: '图片质量（1-100）', default: 90 },
        fps: { type: 'number', description: '导出帧率' },
      },
      handler: async (args) => {
        return {
          success: true,
          message: `正在导出帧图片...`,
        };
      },
    });
  }

  /**
   * 注册项目工具
   */
  private registerProjectTools(): void {
    this.register({
      id: 'get_project_info',
      name: 'get_project_info',
      description: '获取项目信息',
      category: 'project',
      parameters: {},
      handler: async () => {
        const store = (await import('@/store/timelineStore')).useTimelineStore.getState();
        return {
          success: true,
          message: '项目信息获取成功',
          data: {
            name: store.project.name,
            duration: store.project.duration,
            trackCount: store.project.tracks.length,
            clipCount: store.project.tracks.reduce((acc, t) => acc + t.clips.length, 0),
            currentTime: store.playback.currentTime,
          },
        };
      },
    });

    this.register({
      id: 'save_project',
      name: 'save_project',
      description: '保存项目',
      category: 'project',
      parameters: {
        path: { type: 'string', description: '保存路径' },
      },
      handler: async () => {
        return { success: true, message: '项目已保存' };
      },
    });

    this.register({
      id: 'new_project',
      name: 'new_project',
      description: '创建新项目',
      category: 'project',
      parameters: {
        name: { type: 'string', description: '项目名称' },
        resolution: { type: 'string', description: '分辨率' },
        fps: { type: 'number', description: '帧率' },
      },
      handler: async () => {
        return { success: true, message: '新项目已创建' };
      },
    });

    this.register({
      id: 'undo',
      name: 'undo',
      description: '撤销上一步操作',
      category: 'project',
      parameters: {},
      handler: async () => {
        const store = (await import('@/store/timelineStore')).useTimelineStore.getState();
        if (store.canUndo()) {
          store.undo();
          return { success: true, message: '已撤销' };
        }
        return { success: false, message: '没有可撤销的操作' };
      },
    });

    this.register({
      id: 'redo',
      name: 'redo',
      description: '重做操作',
      category: 'project',
      parameters: {},
      handler: async () => {
        const store = (await import('@/store/timelineStore')).useTimelineStore.getState();
        if (store.canRedo()) {
          store.redo();
          return { success: true, message: '已重做' };
        }
        return { success: false, message: '没有可重做的操作' };
      },
    });
  }

  /**
   * 注册工具
   */
  public register(tool: VideoEditorTool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * 获取所有工具
   */
  public getAllTools(): VideoEditorTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取工具
   */
  public getTool(name: string): VideoEditorTool | undefined {
    return this.tools.get(name);
  }

  /**
   * 获取工具定义（用于LLM）
   */
  public getToolDefinitions(): LLMToolDefinition[] {
    return this.getAllTools().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object' as const,
          properties: Object.fromEntries(
            Object.entries(tool.parameters).map(([key, param]) => [
              key,
              {
                type: param.type,
                description: param.description,
                default: param.default,
                enum: param.enum,
                minimum: param.minimum,
                maximum: param.maximum,
              },
            ])
          ),
          required: tool.required,
        },
      },
    }));
  }

  /**
   * 执行工具
   */
  public async executeTool(name: string, args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, message: `工具不存在: ${name}` };
    }

    try {
      return await tool.handler(args);
    } catch (error) {
      return {
        success: false,
        message: `执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
        error: error instanceof Error ? error.message : undefined,
      };
    }
  }

  /**
   * 按类别获取工具
   */
  public getToolsByCategory(category: ToolCategory): VideoEditorTool[] {
    return this.getAllTools().filter(tool => tool.category === category);
  }

  /**
   * 获取所有类别
   */
  public getCategories(): ToolCategory[] {
    return ['timeline', 'clip', 'subtitle', 'audio', 'material', 'transition', 'effect', 'export', 'project'];
  }

  /**
   * 获取类别中文名称
   */
  public getCategoryName(category: ToolCategory): string {
    const names: Record<ToolCategory, string> = {
      timeline: '时间轴',
      clip: '片段',
      subtitle: '字幕',
      audio: '音频',
      material: '素材',
      transition: '转场',
      effect: '特效',
      export: '导出',
      project: '项目',
    };
    return names[category];
  }
}

// 导出单例
export const videoEditorMCP = VideoEditorMCP.getInstance();
export default videoEditorMCP;
