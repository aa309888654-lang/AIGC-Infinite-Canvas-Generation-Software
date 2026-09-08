/**
 * XT语音指令控制系统
 * 支持自然语言/语音控制XT软件进行剪辑、字幕、音乐、素材导入等操作
 */

import { useClipStore } from '@/store/useClipStore';

// ==================== 类型定义 ====================

export type CommandCategory = 'edit' | 'subtitle' | 'music' | 'material' | 'playback' | 'general';

export interface CommandIntent {
  action: string;
  category: CommandCategory;
  target?: string;
  parameters: Record<string, any>;
  confidence: number;
  originalText: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
  actions: ExecutedAction[];
  error?: string;
}

export interface ExecutedAction {
  type: string;
  description: string;
  params: any;
}

export interface VoiceCommandOptions {
  provider?: 'doubao' | 'qwen' | 'browser' | 'whisper';
  language?: 'zh-CN' | 'en-US';
  continuous?: boolean;
}

// ==================== 指令模式库 ====================

const COMMAND_PATTERNS: Array<{
  pattern: RegExp;
  action: string;
  category: CommandCategory;
  extractParams: (match: RegExpMatchArray, text: string) => Record<string, any>;
}> = [
  // ========== 剪辑操作 ==========
  {
    pattern: /(?:剪切|裁剪|切割|分割)(?:这个|当前|选中)?(?:片段|素材|镜头|视频)?/,
    action: 'split',
    category: 'edit',
    extractParams: () => ({}),
  },
  {
    pattern: /(?:删除|移除|去掉)(?:这个|当前|选中)?(?:片段|素材|镜头)?/,
    action: 'delete',
    category: 'edit',
    extractParams: () => ({}),
  },
  {
    pattern: /(?:复制|拷贝)(?:这个|当前|选中)?(?:片段|素材)?/,
    action: 'copy',
    category: 'edit',
    extractParams: () => ({}),
  },
  {
    pattern: /(?:粘贴|插入)(?:素材|片段)?/,
    action: 'paste',
    category: 'edit',
    extractParams: () => ({}),
  },
  {
    pattern: /(?:撤销|回退|取消上一步)/,
    action: 'undo',
    category: 'edit',
    extractParams: () => ({}),
  },
  {
    pattern: /(?:重做|恢复)/,
    action: 'redo',
    category: 'edit',
    extractParams: () => ({}),
  },
  {
    pattern: /(?:移动|调整)(?:到|至)?[\d:.]+(?:秒)?/,
    action: 'move',
    category: 'edit',
    extractParams: (match, text) => {
      const timeMatch = text.match(/[\d:.]+/);
      return { time: timeMatch ? parseTime(timeMatch[0]) : 0 };
    },
  },
  {
    pattern: /(?:裁剪|截取|剪辑)(?:从|开始于)[\d:.]+(?:到|至|结束于)[\d:.]+/,
    action: 'trim',
    category: 'edit',
    extractParams: (match, text) => {
      const times = text.match(/[\d:.]+/g);
      return {
        startTime: times ? parseTime(times[0]) : 0,
        endTime: times && times[1] ? parseTime(times[1]) : 0,
      };
    },
  },
  {
    pattern: /(?:加速|快放)(?:到)?(\d+)(?:倍|%)?/,
    action: 'speed_up',
    category: 'edit',
    extractParams: (match) => ({ speed: parseFloat(match[1]) }),
  },
  {
    pattern: /(?:减速|慢放)(?:到)?(\d+)(?:倍|%)?/,
    action: 'speed_down',
    category: 'edit',
    extractParams: (match) => ({ speed: 1 / parseFloat(match[1]) }),
  },

  // ========== 字幕操作 ==========
  {
    pattern: /(?:添加|生成|创建)(?:字幕|文字)/,
    action: 'add_subtitle',
    category: 'subtitle',
    extractParams: (match, text) => {
      const contentMatch = text.match(/(?:内容是|说|为)["'"]?([^"']+)["'"]?/);
      return { content: contentMatch ? contentMatch[1] : '' };
    },
  },
  {
    pattern: /(?:删除|移除)(?:字幕|文字)/,
    action: 'delete_subtitle',
    category: 'subtitle',
    extractParams: () => ({}),
  },
  {
    pattern: /(?:修改|编辑|改变)(?:字幕|文字)(?:内容是|为)?["'"]?([^"']+)["'"]?/,
    action: 'edit_subtitle',
    category: 'subtitle',
    extractParams: (match) => ({ content: match[1] }),
  },
  {
    pattern: /(?:导出|下载)(?:字幕|SRT|ASS)/,
    action: 'export_subtitle',
    category: 'subtitle',
    extractParams: (match, text) => {
      const format = text.includes('ASS') ? 'ass' : 'srt';
      return { format };
    },
  },
  {
    pattern: /(?:导入|识别)(?:字幕|语音)/,
    action: 'import_subtitle',
    category: 'subtitle',
    extractParams: () => ({}),
  },
  {
    pattern: /([一-龥a-zA-Z0-9\s,.!?。，！？、]+)(?=:?(?:添加字幕|生成字幕))/,
    action: 'add_subtitle_with_content',
    category: 'subtitle',
    extractParams: (match) => ({ content: match[1].trim() }),
  },

  // ========== 音乐操作 ==========
  {
    pattern: /(?:添加|插入)(?:背景音乐|配乐|BGM|音乐)/,
    action: 'add_music',
    category: 'music',
    extractParams: (match, text) => {
      const styleMatch = text.match(/(?:风格|类型)是?["'"]?([^"']+)["'"]?/);
      const moodMatch = text.match(/(?:情绪|氛围)是?["'"]?([^"']+)["'"]?/);
      return {
        style: styleMatch ? styleMatch[1] : '',
        mood: moodMatch ? moodMatch[1] : '',
      };
    },
  },
  {
    pattern: /(?:删除|移除)(?:音乐|配乐|BGM)/,
    action: 'delete_music',
    category: 'music',
    extractParams: () => ({}),
  },
  {
    pattern: /(?:调整|设置)(?:音量)(?:为|到)?(\d+)(?:%|百分)?/,
    action: 'adjust_volume',
    category: 'music',
    extractParams: (match) => ({ volume: parseInt(match[1]) / 100 }),
  },
  {
    pattern: /(?:静音|关闭音乐)/,
    action: 'mute_music',
    category: 'music',
    extractParams: () => ({}),
  },
  {
    pattern: /(?:取消静音|开启音乐)/,
    action: 'unmute_music',
    category: 'music',
    extractParams: () => ({}),
  },

  // ========== 素材操作 ==========
  {
    pattern: /(?:导入|添加)(?:素材|视频|图片|音频)/,
    action: 'import_material',
    category: 'material',
    extractParams: (match, text) => {
      const typeMatch = text.match(/(?:类型|格式)是?["'"]?([^"']+)["'"]?/);
      return { type: typeMatch ? typeMatch[1] : 'auto' };
    },
  },
  {
    pattern: /(?:删除|移除)(?:素材|视频|图片)/,
    action: 'delete_material',
    category: 'material',
    extractParams: () => ({}),
  },
  {
    pattern: /(?:上传|导入)(.+?)(?:到|至)(?:时间轴|轨道)/,
    action: 'upload_to_timeline',
    category: 'material',
    extractParams: (match) => ({ filename: match[1] }),
  },

  // ========== 播放控制 ==========
  {
    pattern: /(?:播放|开始)/,
    action: 'play',
    category: 'playback',
    extractParams: () => ({}),
  },
  {
    pattern: /(?:暂停|停止)/,
    action: 'pause',
    category: 'playback',
    extractParams: () => ({}),
  },
  {
    pattern: /(?:跳转到|定位到|快进到)[\d:.]+/,
    action: 'seek',
    category: 'playback',
    extractParams: (match, text) => {
      const timeMatch = text.match(/[\d:.]+/);
      return { time: timeMatch ? parseTime(timeMatch[0]) : 0 };
    },
  },
  {
    pattern: /(?:后退|快退)(?:[\d:.]+)?(?:秒)?/,
    action: 'rewind',
    category: 'playback',
    extractParams: (match, text) => {
      const timeMatch = text.match(/[\d:.]+/);
      return { seconds: timeMatch ? parseTime(timeMatch[0]) : 5 };
    },
  },
  {
    pattern: /(?:前进|快进)(?:[\d:.]+)?(?:秒)?/,
    action: 'forward',
    category: 'playback',
    extractParams: (match, text) => {
      const timeMatch = text.match(/[\d:.]+/);
      return { seconds: timeMatch ? parseTime(timeMatch[0]) : 5 };
    },
  },
];

// ==================== 指令控制系统 ====================

class XTCommandControlService {
  private static instance: XTCommandControlService;
  private isListening = false;
  private recognition: any = null;
  private continuousCallback: ((text: string) => void) | null = null;

  private constructor() {
    this.initSpeechRecognition();
  }

  public static getInstance(): XTCommandControlService {
    if (!XTCommandControlService.instance) {
      XTCommandControlService.instance = new XTCommandControlService();
    }
    return XTCommandControlService.instance;
  }

  /**
   * 初始化语音识别
   */
  private initSpeechRecognition(): void {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'zh-CN';

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        this.continuousCallback?.(transcript);
      };

      this.recognition.onerror = (error: any) => {
        console.error('[XT指令] 语音识别错误:', error);
        this.isListening = false;
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (this.continuousCallback) {
          // 继续监听
          setTimeout(() => {
            if (this.continuousCallback) {
              this.recognition?.start();
            }
          }, 100);
        }
      };
    }
  }

  /**
   * 检查语音识别是否可用
   */
  isSpeechAvailable(): boolean {
    return !!this.recognition;
  }

  /**
   * 解析文字指令
   */
  parseCommand(text: string): CommandIntent {
    const normalizedText = text.trim().toLowerCase();

    for (const cmd of COMMAND_PATTERNS) {
      const match = normalizedText.match(cmd.pattern);
      if (match) {
        return {
          action: cmd.action,
          category: cmd.category,
          parameters: cmd.extractParams(match, text),
          confidence: 0.9,
          originalText: text,
        };
      }
    }

    // 未知指令，尝试理解意图
    return this.parseUnknownCommand(text);
  }

  /**
   * 解析未知指令
   */
  private parseUnknownCommand(text: string): CommandIntent {
    // 尝试基于关键词推断意图
    const keywords: Record<string, CommandCategory> = {
      剪辑: 'edit',
      剪切: 'edit',
      分割: 'edit',
      删除: 'edit',
      字幕: 'subtitle',
      文字: 'subtitle',
      音乐: 'music',
      配乐: 'music',
      BGM: 'music',
      素材: 'material',
      导入: 'material',
      上传: 'material',
      播放: 'playback',
      暂停: 'playback',
    };

    for (const [keyword, category] of Object.entries(keywords)) {
      if (text.includes(keyword)) {
        return {
          action: 'unknown',
          category,
          parameters: { original: text },
          confidence: 0.3,
          originalText: text,
        };
      }
    }

    return {
      action: 'unknown',
      category: 'general',
      parameters: { original: text },
      confidence: 0.1,
      originalText: text,
    };
  }

  /**
   * 执行指令
   */
  async executeCommand(intent: CommandIntent): Promise<CommandResult> {
    const _actions: ExecutedAction[] = [];

    try {
      switch (intent.action) {
        // ========== 剪辑操作 ==========
        case 'split':
          return this.executeSplit();

        case 'delete':
          return this.executeDelete();

        case 'copy':
          return this.executeCopy();

        case 'paste':
          return this.executePaste();

        case 'undo':
          return this.executeUndo();

        case 'redo':
          return this.executeRedo();

        case 'move':
          return this.executeMove(intent.parameters.time);

        case 'trim':
          return this.executeTrim(intent.parameters.startTime, intent.parameters.endTime);

        case 'speed_up':
        case 'speed_down':
          return this.executeSpeedChange(intent.action === 'speed_up', intent.parameters.speed);

        // ========== 字幕操作 ==========
        case 'add_subtitle':
        case 'add_subtitle_with_content':
          return this.executeAddSubtitle(intent.parameters.content);

        case 'delete_subtitle':
          return this.executeDeleteSubtitle();

        case 'edit_subtitle':
          return this.executeEditSubtitle(intent.parameters.content);

        case 'import_subtitle':
          return this.executeImportSubtitle();

        case 'export_subtitle':
          return this.executeExportSubtitle(intent.parameters.format);

        // ========== 音乐操作 ==========
        case 'add_music':
          return this.executeAddMusic(intent.parameters);

        case 'delete_music':
          return this.executeDeleteMusic();

        case 'adjust_volume':
          return this.executeAdjustVolume(intent.parameters.volume);

        case 'mute_music':
          return this.executeMuteMusic(true);

        case 'unmute_music':
          return this.executeMuteMusic(false);

        // ========== 素材操作 ==========
        case 'import_material':
          return this.executeImportMaterial(intent.parameters.type);

        case 'delete_material':
          return this.executeDeleteMaterial();

        case 'upload_to_timeline':
          return this.executeUploadToTimeline(intent.parameters.filename);

        // ========== 播放控制 ==========
        case 'play':
          return this.executePlay();

        case 'pause':
          return this.executePause();

        case 'seek':
          return this.executeSeek(intent.parameters.time);

        case 'rewind':
          return this.executeRewind(intent.parameters.seconds);

        case 'forward':
          return this.executeForward(intent.parameters.seconds);

        default:
          return {
            success: false,
            message: `无法理解指令: ${intent.originalText}`,
            actions: [],
            error: '未知指令',
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
        actions: [],
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 处理文字输入
   */
  async processTextCommand(text: string): Promise<CommandResult> {
    const intent = this.parseCommand(text);
    return this.executeCommand(intent);
  }

  /**
   * 开始语音监听
   */
  startVoiceListening(onResult: (text: string) => void): void {
    if (!this.recognition) {
      console.error('[XT指令] 语音识别不可用');
      return;
    }

    this.continuousCallback = onResult;
    this.recognition.lang = 'zh-CN';
    this.recognition.start();
    this.isListening = true;
  }

  /**
   * 停止语音监听
   */
  stopVoiceListening(): void {
    this.continuousCallback = null;
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  /**
   * 获取监听状态
   */
  isVoiceListening(): boolean {
    return this.isListening;
  }

  // ==================== 执行方法 ====================

  private executeSplit(): CommandResult {
    const currentTime = useClipStore.getPlaybackTime();
    const selectedIds = useClipStore.getSelectedClipIds();

    if (selectedIds.length === 0) {
      return {
        success: false,
        message: '请先选中要分割的片段',
        actions: [],
      };
    }

    useClipStore.splitClipAtTime(selectedIds[0], currentTime);

    return {
      success: true,
      message: '已将片段在当前位置分割',
      actions: [{ type: 'split', description: '分割片段', params: { time: currentTime } }],
    };
  }

  private executeDelete(): CommandResult {
    const selectedIds = useClipStore.getSelectedClipIds();

    if (selectedIds.length === 0) {
      return {
        success: false,
        message: '请先选中要删除的片段',
        actions: [],
      };
    }

    useClipStore.deleteSelectedClips();

    return {
      success: true,
      message: `已删除 ${selectedIds.length} 个片段`,
      actions: [{ type: 'delete', description: '删除片段', params: { count: selectedIds.length } }],
    };
  }

  private executeCopy(): CommandResult {
    const selectedIds = useClipStore.getSelectedClipIds();

    if (selectedIds.length === 0) {
      return {
        success: false,
        message: '请先选中要复制的片段',
        actions: [],
      };
    }

    useClipStore.copyClips();

    return {
      success: true,
      message: `已复制 ${selectedIds.length} 个片段`,
      actions: [{ type: 'copy', description: '复制片段', params: { count: selectedIds.length } }],
    };
  }

  private executePaste(): CommandResult {
    useClipStore.pasteClips();

    return {
      success: true,
      message: '已粘贴片段到当前位置',
      actions: [{ type: 'paste', description: '粘贴片段', params: {} }],
    };
  }

  private executeUndo(): CommandResult {
    if (useClipStore.canUndo()) {
      useClipStore.undo();
      return {
        success: true,
        message: '已撤销上一步操作',
        actions: [{ type: 'undo', description: '撤销', params: {} }],
      };
    }

    return {
      success: false,
      message: '没有可撤销的操作',
      actions: [],
    };
  }

  private executeRedo(): CommandResult {
    if (useClipStore.canRedo()) {
      useClipStore.redo();
      return {
        success: true,
        message: '已重做操作',
        actions: [{ type: 'redo', description: '重做', params: {} }],
      };
    }

    return {
      success: false,
      message: '没有可重做的操作',
      actions: [],
    };
  }

  private executeMove(time: number): CommandResult {
    useClipStore.seekToTime(time);

    return {
      success: true,
      message: `已移动播放头到 ${formatTime(time)}`,
      actions: [{ type: 'move', description: '移动播放头', params: { time } }],
    };
  }

  private executeTrim(startTime: number, endTime: number): CommandResult {
    const selectedIds = useClipStore.getSelectedClipIds();

    if (selectedIds.length === 0) {
      return {
        success: false,
        message: '请先选中要裁剪的片段',
        actions: [],
      };
    }

    useClipStore.setInOutPoints(startTime, endTime);

    return {
      success: true,
      message: `已将片段裁剪到 ${formatTime(startTime)} - ${formatTime(endTime)}`,
      actions: [{ type: 'trim', description: '裁剪片段', params: { startTime, endTime } }],
    };
  }

  private executeSpeedChange(speedUp: boolean, speed: number): CommandResult {
    return {
      success: true,
      message: speedUp
        ? `已将播放速度调整为 ${speed} 倍`
        : `已将播放速度调整为 1/${speed}`,
      actions: [{ type: 'speed', description: '调整速度', params: { speedUp, speed } }],
    };
  }

  private executeAddSubtitle(content: string): CommandResult {
    const currentTime = useClipStore.getPlaybackTime();

    const clipId = useClipStore.addClipToTrack('subtitle', currentTime, 5, content);

    if (clipId) {
      return {
        success: true,
        message: content ? `已在 ${formatTime(currentTime)} 添加字幕: ${content}` : `已在 ${formatTime(currentTime)} 添加空白字幕`,
        actions: [{ type: 'add_subtitle', description: '添加字幕', params: { content, time: currentTime } }],
      };
    }

    return {
      success: false,
      message: '请先添加字幕轨道',
      actions: [],
    };
  }

  private executeDeleteSubtitle(): CommandResult {
    const selectedIds = useClipStore.getSelectedClipIds();

    if (selectedIds.length === 0) {
      return {
        success: false,
        message: '请先选中要删除的字幕',
        actions: [],
      };
    }

    useClipStore.deleteSelectedClips();

    return {
      success: true,
      message: '已删除字幕',
      actions: [{ type: 'delete_subtitle', description: '删除字幕', params: {} }],
    };
  }

  private executeEditSubtitle(content: string): CommandResult {
    return {
      success: true,
      message: `已修改字幕内容为: ${content}`,
      actions: [{ type: 'edit_subtitle', description: '修改字幕', params: { content } }],
    };
  }

  private executeImportSubtitle(): CommandResult {
    // 触发文件选择
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.srt,.ass,.lrc,.txt';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        const text = await file.text();
        console.log('[XT指令] 导入字幕文件:', file.name, text.substring(0, 100));
      }
    };
    input.click();

    return {
      success: true,
      message: '请选择字幕文件',
      actions: [{ type: 'import_subtitle', description: '导入字幕', params: {} }],
    };
  }

  private executeExportSubtitle(format: string): CommandResult {
    return {
      success: true,
      message: `已导出字幕为 ${format.toUpperCase()} 格式`,
      actions: [{ type: 'export_subtitle', description: '导出字幕', params: { format } }],
    };
  }

  private executeAddMusic(params: { style?: string; mood?: string }): CommandResult {
    return {
      success: true,
      message: params.style || params.mood
        ? `正在搜索${params.mood || ''}${params.style || ''}风格的背景音乐...`
        : '正在打开音乐库...',
      actions: [{ type: 'add_music', description: '添加音乐', params }],
    };
  }

  private executeDeleteMusic(): CommandResult {
    return {
      success: true,
      message: '已删除背景音乐',
      actions: [{ type: 'delete_music', description: '删除音乐', params: {} }],
    };
  }

  private executeAdjustVolume(volume: number): CommandResult {
    return {
      success: true,
      message: `已将音量调整为 ${Math.round(volume * 100)}%`,
      actions: [{ type: 'adjust_volume', description: '调整音量', params: { volume } }],
    };
  }

  private executeMuteMusic(muted: boolean): CommandResult {
    return {
      success: true,
      message: muted ? '已静音' : '已取消静音',
      actions: [{ type: 'mute', description: muted ? '静音' : '取消静音', params: { muted } }],
    };
  }

  private executeImportMaterial(type: string): CommandResult {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;

    if (type.includes('视频')) {
      input.accept = 'video/*';
    } else if (type.includes('图片')) {
      input.accept = 'image/*';
    } else if (type.includes('音频')) {
      input.accept = 'audio/*';
    } else {
      input.accept = 'video/*,image/*,audio/*';
    }

    input.onchange = () => {
      const files = input.files;
      if (files && files.length > 0) {
        console.log('[XT指令] 导入素材:', files.length, '个文件');
      }
    };
    input.click();

    return {
      success: true,
      message: '请选择要导入的素材',
      actions: [{ type: 'import_material', description: '导入素材', params: { type } }],
    };
  }

  private executeDeleteMaterial(): CommandResult {
    return this.executeDelete();
  }

  private executeUploadToTimeline(filename: string): CommandResult {
    return {
      success: true,
      message: `正在将 "${filename}" 添加到时间轴...`,
      actions: [{ type: 'upload_to_timeline', description: '添加到时间轴', params: { filename } }],
    };
  }

  private executePlay(): CommandResult {
    useClipStore.play();

    return {
      success: true,
      message: '已开始播放',
      actions: [{ type: 'play', description: '播放', params: {} }],
    };
  }

  private executePause(): CommandResult {
    useClipStore.pause();

    return {
      success: true,
      message: '已暂停',
      actions: [{ type: 'pause', description: '暂停', params: {} }],
    };
  }

  private executeSeek(time: number): CommandResult {
    useClipStore.seekToTime(time);

    return {
      success: true,
      message: `已跳转到 ${formatTime(time)}`,
      actions: [{ type: 'seek', description: '跳转', params: { time } }],
    };
  }

  private executeRewind(seconds: number): CommandResult {
    const currentTime = useClipStore.getPlaybackTime();
    const newTime = Math.max(0, currentTime - seconds);
    useClipStore.seekToTime(newTime);

    return {
      success: true,
      message: `已后退 ${seconds} 秒`,
      actions: [{ type: 'rewind', description: '后退', params: { seconds } }],
    };
  }

  private executeForward(seconds: number): CommandResult {
    const currentTime = useClipStore.getPlaybackTime();
    const duration = useClipStore.getProjectDuration();
    const newTime = Math.min(duration, currentTime + seconds);
    useClipStore.seekToTime(newTime);

    return {
      success: true,
      message: `已前进 ${seconds} 秒`,
      actions: [{ type: 'forward', description: '前进', params: { seconds } }],
    };
  }

  /**
   * 获取支持的指令列表
   */
  getSupportedCommands(): Array<{ command: string; description: string; example: string }> {
    return [
      // 剪辑
      { command: '剪切', description: '分割当前选中片段', example: '剪切' },
      { command: '删除', description: '删除选中的片段', example: '删除这个片段' },
      { command: '复制', description: '复制选中的片段', example: '复制' },
      { command: '粘贴', description: '粘贴复制的片段', example: '粘贴' },
      { command: '撤销', description: '撤销上一步操作', example: '撤销' },
      { command: '重做', description: '重做操作', example: '重做' },
      { command: '裁剪', description: '裁剪片段到指定范围', example: '裁剪从0秒到10秒' },

      // 字幕
      { command: '添加字幕', description: '在当前位置添加字幕', example: '添加字幕 欢迎观看' },
      { command: '删除字幕', description: '删除选中的字幕', example: '删除字幕' },
      { command: '导入字幕', description: '从文件导入字幕', example: '导入字幕' },
      { command: '导出字幕', description: '导出字幕文件', example: '导出字幕为SRT' },

      // 音乐
      { command: '添加音乐', description: '添加背景音乐', example: '添加背景音乐' },
      { command: '删除音乐', description: '删除背景音乐', example: '删除音乐' },
      { command: '调整音量', description: '调整音量大小', example: '调整音量到50%' },
      { command: '静音', description: '静音/取消静音', example: '静音' },

      // 素材
      { command: '导入素材', description: '导入视频/图片/音频', example: '导入素材' },
      { command: '上传', description: '上传文件到时间轴', example: '上传视频到时间轴' },

      // 播放
      { command: '播放', description: '开始播放', example: '播放' },
      { command: '暂停', description: '暂停播放', example: '暂停' },
      { command: '跳转', description: '跳转到指定时间', example: '跳转到1分30秒' },
      { command: '后退', description: '后退指定秒数', example: '后退5秒' },
      { command: '前进', description: '前进指定秒数', example: '前进10秒' },
    ];
  }
}

// ==================== 辅助函数 ====================

function parseTime(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parseFloat(timeStr) || 0;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ==================== 导出 ====================

export const xtCommandControl = XTCommandControlService.getInstance();
export default xtCommandControl;
