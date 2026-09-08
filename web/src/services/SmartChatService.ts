/**
 * 智能聊天服务 v3.0
 * 支持：图片生成，音乐生成（多轮对话），配音生成、提示词优化、软件问答，普通聊天
 */

import { API_BASE_URL } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-check';

// ==================== 类型定义 ====================

export type ChatIntent =
  | 'image_generation'   // 图片生成
  | 'music_generation'   // 音乐生成（多轮）
  | 'voice_generation'   // 配音/TTS生成
  | 'prompt_optimize'    // 提示词优化
  | 'software_question'   // 软件问题解答
  | 'general_chat'       // 普通聊天
  | 'video_generation'   // 视频生成
  | 'poster_generation';  // 海报生成

export interface IntentResult {
  intent: ChatIntent;
  confidence: number;
  params?: Record<string, unknown>;
  response?: string;
}

export interface SmartChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'action';
  content: string;
  timestamp: Date;
  intent?: ChatIntent;
  actionType?: 'generate_image' | 'generate_music' | 'generate_voice' | 'generate_video' | 'generate_poster' | 'music_wizard' | 'voice_wizard' | 'video_wizard' | 'poster_wizard' | 'optimize_prompt';
  isLoading?: boolean;
}

export interface SmartChatOptions {
  enableImageGeneration?: boolean;
  enableMusicGeneration?: boolean;
  enableVoiceGeneration?: boolean;
  enableVideoGeneration?: boolean;
  enablePromptOptimize?: boolean;
  enableSoftwareQA?: boolean;
}

// ==================== 视频生成多轮向导 ====================

export interface VideoWizardState {
  step: 'idle' | 'style' | 'duration' | 'ratio' | 'confirm' | 'generating';
  style?: string;
  duration?: '5s' | '10s' | '30s' | '60s';
  ratio?: '16:9' | '9:16' | '1:1';
  prompt?: string;
}

export const VIDEO_STYLES = [
  { id: 'realistic', name: '写实', emoji: '📸', desc: '逼真的电影质感' },
  { id: 'anime', name: '动漫', emoji: '🎨', desc: '二次元动漫风格' },
  { id: '3d', name: '3D渲染', emoji: '🧊', desc: '精美的3D动画' },
  { id: 'cyberpunk', name: '赛博朋克', emoji: '🌆', desc: '未来主义霓虹风格' },
  { id: 'oil_painting', name: '油画', emoji: '🖼️', desc: '艺术油画质感' },
];

export const VIDEO_DURATIONS = [
  { id: '5s', name: '5秒', desc: '短视频素材' },
  { id: '10s', name: '10秒', desc: '标准片段' },
  { id: '30s', name: '30秒', desc: '中等长度' },
  { id: '60s', name: '60秒', desc: '完整展示' },
];

export const VIDEO_RATIOS = [
  { id: '16:9', name: '横屏 (16:9)', emoji: '📺' },
  { id: '9:16', name: '竖屏 (9:16)', emoji: '📱' },
  { id: '1:1', name: '正方形 (1:1)', emoji: '⬛' },
];

// ==================== 配音生成多轮向导 ====================

export interface VoiceWizardState {
  step: 'idle' | 'gender' | 'style' | 'language' | 'speed' | 'confirm' | 'generating';
  gender?: 'male' | 'female';
  style?: string;
  language?: string;
  speed?: 'slow' | 'normal' | 'fast';
  text?: string;
}

export const VOICE_GENDERS = [
  { id: 'male', name: '男生', emoji: '👨', desc: '低沉磁性' },
  { id: 'female', name: '女生', emoji: '👩', desc: '温柔甜美' },
];

export const VOICE_STYLES = [
  { id: 'natural', name: '自然', emoji: '🌿', desc: '自然流畅' },
  { id: 'energetic', name: '活力', emoji: '⚡', desc: '充满活力' },
  { id: 'calm', name: '舒缓', emoji: '☕', desc: '柔和缓慢' },
  { id: 'serious', name: '正式', emoji: '💼', desc: '严肃专业' },
  { id: 'friendly', name: '友好', emoji: '😊', desc: '亲切温暖' },
  { id: 'news', name: '播音', emoji: '📺', desc: '新闻播报' },
];

export const VOICE_LANGUAGES = [
  { id: '中文', name: '中文', emoji: '🇨🇳' },
  { id: '英文', name: '英文', emoji: '🇺🇸' },
  { id: '日文', name: '日文', emoji: '🇯🇵' },
  { id: '韩文', name: '韩文', emoji: '🇰🇷' },
];

export const VOICE_SPEEDS = [
  { id: 'slow', name: '慢速', emoji: '🐢', desc: '0.8倍' },
  { id: 'normal', name: '常速', emoji: '🚶', desc: '1.0倍' },
  { id: 'fast', name: '快速', emoji: '🏃', desc: '1.2倍' },
];

// ==================== 音乐生成多轮向导 ====================

export interface MusicWizardState {
  step: 'idle' | 'genre' | 'mood' | 'duration' | 'tempo' | 'instruments' | 'vocals' | 'lyrics' | 'confirm' | 'generating';
  genre?: string;
  mood?: string;
  duration?: number;
  tempo?: number;
  instruments?: string[];
  vocals?: boolean;
  customPrompt?: string;
  lyrics?: string;
}

const MUSIC_GENRES = [
  { id: 'electronic', name: '电子', emoji: '🎧', desc: '现代电子节拍' },
  { id: 'ambient', name: '氛围', emoji: '🌊', desc: '放松氛围音乐' },
  { id: 'cinematic', name: '影视', emoji: '🎬', desc: '电影级配乐' },
  { id: 'pop', name: '流行', emoji: '🎤', desc: '流行音乐' },
  { id: 'rock', name: '摇滚', emoji: '🎸', desc: '摇滚风格' },
  { id: 'classical', name: '古典', emoji: '🎻', desc: '古典音乐' },
  { id: 'jazz', name: '爵士', emoji: '🎷', desc: '爵士蓝调' },
  { id: 'hiphop', name: '嘻哈', emoji: '🎧', desc: '节奏嘻哈' },
  { id: 'lofi', name: 'LoFi', emoji: '☕', desc: 'LoFi休闲' },
  { id: 'folk', name: '民谣', emoji: '🪕', desc: '原声民谣' },
];

const MUSIC_MOODS = [
  { id: 'happy', name: '欢快', emoji: '😊', desc: '愉快轻松' },
  { id: 'sad', name: '忧伤', emoji: '😢', desc: '悲伤忧郁' },
  { id: 'energetic', name: '活力', emoji: '⚡', desc: '充满能量' },
  { id: 'calm', name: '平静', emoji: '🧘', desc: '宁静放松' },
  { id: 'dramatic', name: '戏剧', emoji: '🎭', desc: '戏剧张力' },
  { id: 'romantic', name: '浪漫', emoji: '💕', desc: '温馨浪漫' },
  { id: 'mysterious', name: '神秘', emoji: '🌙', desc: '神秘悬疑' },
  { id: 'epic', name: '史诗', emoji: '🏰', desc: '宏大壮观' },
];

const MUSIC_DURATIONS = [
  { value: 15, label: '15秒', desc: '短视频配乐' },
  { value: 30, label: '30秒', desc: '短内容' },
  { value: 60, label: '1分钟', desc: '标准长度' },
  { value: 90, label: '1分半', desc: '中等长度' },
  { value: 120, label: '2分钟', desc: '完整曲目' },
  { value: 180, label: '3分钟', desc: '完整歌曲' },
];

const INSTRUMENTS = [
  { id: 'piano', name: '钢琴', emoji: '🎹' },
  { id: 'guitar', name: '吉他', emoji: '🎸' },
  { id: 'drums', name: '鼓点', emoji: '🥁' },
  { id: 'violin', name: '弦乐', emoji: '🎻' },
  { id: 'synth', name: '合成器', emoji: '🎛️' },
  { id: 'bass', name: '贝斯', emoji: '🎚️' },
  { id: 'orchestra', name: '管弦乐', emoji: '🎼' },
  { id: 'electronic', name: '电子合成', emoji: '💿' },
];

// ==================== 意图识别 ====================

const INTENT_PATTERNS = {
  image_generation: [
    /生成图片|画一张|创建图片|生成一幅|画个图|作图|绘图/i,
    /帮我画|给我画|想要一张|生成一幅?画/i,
    /image|picture|画|图/i,
  ],
  music_generation: [
    /生成音乐|创作音乐|写首歌|制作音乐|生成音频/i,
    /帮我作曲|给我作曲|想要一首?歌|音乐生成/i,
    /music|song|歌曲|作曲|音乐/i,
  ],
  voice_generation: [
    /配音|TTS|语音合成|文字转语音|文本转语音/i,
    /帮我配音|生成配音|想要配音|读出来/i,
    /voice|speech|speak|读|说/i,
  ],
  video_generation: [
    /生成视频|创作视频|制作视频|视频生成/i,
    /帮我生成视频|生成一段视频|视频创作/i,
    /video|影片|短片/i,
  ],
  poster_generation: [
    /生成海报|制作海报|设计海报|海报生成|海报设计/i,
    /帮我做海报|帮我设计海报|创建海报|生成宣传图/i,
    /poster|海报|宣传图/i,
  ],
  prompt_optimize: [
    /优化提示词|优化提示|优化描述词/i,
    /帮我优化|优化一下|润色提示词/i,
    /optimize|improve|enhance/i,
  ],
  software_question: [
    /怎么用|如何使用|如何操作|功能介绍|帮助/i,
    /请问|问一下|想问一下|是什么|在哪里/i,
    /how to|what is|where|help/i,
  ],
};

// ==================== 知识库数据 ====================

const SOFTWARE_FUNCTIONS = [
  {
    name: 'AI图片生成',
    keywords: ['图片', '生成图片', 'image', '画图', '文生图', '图生图'],
    description: '支持多种AI图片生成模型，可以根据文字描述生成图片，或上传参考图进行图生图。',
    usage: '在输入框描述你想要生成的图片内容，点击生成按钮即可。',
  },
  {
    name: 'AI视频生成',
    keywords: ['视频', '生成视频', 'video', '影片'],
    description: '支持多种AI视频生成模型，可以生成5-60秒的AI视频。',
    usage: '描述视频场景，选择时长和风格，点击生成。',
  },
  {
    name: 'AI音乐生成',
    keywords: ['音乐', '生成音乐', 'music', '歌曲', '作曲'],
    description: '根据描述自动生成背景音乐，支持多种音乐风格和时长。可通过多轮对话定制。',
    usage: '点击音乐生成按钮，按提示选择风格、情绪、时长等参数。',
  },
  {
    name: 'AI配音',
    keywords: ['配音', 'TTS', '语音', 'text to speech'],
    description: '将文字转换为自然语音，支持多种音色和情感风格。',
    usage: '输入要朗读的文字，选择音色和风格，即可生成配音。',
  },
  {
    name: 'AI海报设计',
    keywords: ['海报', '生成海报', 'poster', '宣传图', '海报设计'],
    description: '根据描述自动生成精美海报，支持多种海报类型和风格。',
    usage: '描述你想要的海报内容和风格，AI将为你生成专属海报。',
  },
];

// ==================== 智能聊天服务类 ====================

class SmartChatService {
  private static instance: SmartChatService;
  private conversationHistory: SmartChatMessage[] = [];
  private musicWizard: MusicWizardState = { step: 'idle' };
  private voiceWizard: VoiceWizardState = { step: 'idle' };
  private videoWizard: VideoWizardState = { step: 'idle' };

  private constructor() {}

  public static getInstance(): SmartChatService {
    if (!SmartChatService.instance) {
      SmartChatService.instance = new SmartChatService();
    }
    return SmartChatService.instance;
  }

  /**
   * 识别用户意图
   */
  public recognizeIntent(userInput: string): IntentResult {
    const input = userInput.trim().toLowerCase();

    let bestIntent: ChatIntent = 'general_chat';
    let bestConfidence = 0;

    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          const confidence = this.calculateConfidence(input, pattern);
          if (confidence > bestConfidence) {
            bestConfidence = confidence;
            bestIntent = intent as ChatIntent;
          }
        }
      }
    }

    return {
      intent: bestIntent,
      confidence: bestConfidence,
      params: this.extractParams(userInput, bestIntent),
    };
  }

  /**
   * 计算匹配置信度
   */
  private calculateConfidence(input: string, pattern: RegExp): number {
    const match = input.match(pattern);
    if (!match) return 0;
    const matchLength = match[0].length;
    const inputLength = input.length;
    return Math.min(matchLength / inputLength + 0.3, 1);
  }

  /**
   * 提取参数
   */
  private extractParams(input: string, intent: ChatIntent): Record<string, unknown> {
    const params: Record<string, unknown> = { originalInput: input };

    switch (intent) {
      case 'image_generation':
      case 'video_generation':
        params.prompt = input;
        break;
      case 'music_generation':
        params.prompt = input;
        params.duration = this.extractDuration(input);
        break;
      case 'voice_generation':
        params.text = input;
        break;
    }

    return params;
  }

  /**
   * 提取时长
   */
  private extractDuration(input: string): number {
    const durationMatch = input.match(/(\d+)\s*秒|(\d+)\s*分钟/);
    if (durationMatch) {
      if (durationMatch[1]) return parseInt(durationMatch[1]);
      if (durationMatch[2]) return parseInt(durationMatch[2]) * 60;
    }
    return 30;
  }

  /**
   * 重置音乐向导
   */
  public resetMusicWizard(): void {
    this.musicWizard = { step: 'idle' };
  }

  /**
   * 重置配音向导
   */
  public resetVoiceWizard(): void {
    this.voiceWizard = { step: 'idle' };
  }

  /**
   * 重置视频向导
   */
  public resetVideoWizard(): void {
    this.videoWizard = { step: 'idle' };
  }

  /**
   * 获取音乐向导状态
   */
  public getMusicWizardState(): MusicWizardState {
    return { ...this.musicWizard };
  }

  /**
   * 获取配音向导状态
   */
  public getVoiceWizardState(): VoiceWizardState {
    return { ...this.voiceWizard };
  }

  /**
   * 获取视频向导状态
   */
  public getVideoWizardState(): VideoWizardState {
    return { ...this.videoWizard };
  }

  /**
   * 处理视频向导消息
   */
  public processVideoWizard(userInput: string): { response: string; isComplete: boolean; state: VideoWizardState } {
    const input = userInput.trim().toLowerCase();

    switch (this.videoWizard.step) {
      case 'idle':
        this.videoWizard.step = 'style';
        return {
          response: this.buildVideoStyleQuestion(),
          isComplete: false,
          state: { ...this.videoWizard },
        };

      case 'style': {
        const style = this.matchVideoStyle(input);
        if (style) {
          this.videoWizard.style = style.id;
          this.videoWizard.step = 'duration';
          return {
            response: this.buildVideoDurationQuestion(),
            isComplete: false,
            state: { ...this.videoWizard },
          };
        } else {
          return {
            response: '抱歉，我没有理解。请选择视频风格：\n\n' + VIDEO_STYLES.map(s => `${s.emoji} ${s.name} - ${s.desc}`).join('\n'),
            isComplete: false,
            state: { ...this.videoWizard },
          };
        }
      }

      case 'duration': {
        const duration = this.matchVideoDuration(input);
        if (duration) {
          this.videoWizard.duration = duration.id as VideoWizardState['duration'];
          this.videoWizard.step = 'ratio';
          return {
            response: this.buildVideoRatioQuestion(),
            isComplete: false,
            state: { ...this.videoWizard },
          };
        } else {
          return {
            response: '抱歉，我没有理解。请选择视频时长：\n\n' + VIDEO_DURATIONS.map(d => `${d.name} - ${d.desc}`).join('\n'),
            isComplete: false,
            state: { ...this.videoWizard },
          };
        }
      }

      case 'ratio': {
        const ratio = this.matchVideoRatio(input);
        if (ratio) {
          this.videoWizard.ratio = ratio.id as VideoWizardState['ratio'];
          this.videoWizard.step = 'confirm';
          return {
            response: this.buildVideoConfirmQuestion(),
            isComplete: false,
            state: { ...this.videoWizard },
          };
        } else {
          return {
            response: '抱歉，我没有理解。请选择视频比例：\n\n' + VIDEO_RATIOS.map(r => `${r.emoji} ${r.name}`).join('\n'),
            isComplete: false,
            state: { ...this.videoWizard },
          };
        }
      }

      case 'confirm':
        if (this.isConfirm(input)) {
          this.videoWizard.step = 'generating';
          return {
            response: this.buildVideoGeneratingMessage(),
            isComplete: true,
            state: { ...this.videoWizard },
          };
        } else if (this.isCancel(input)) {
          this.resetVideoWizard();
          return {
            response: '好的，视频生成已取消。有什么其他我可以帮你的吗？',
            isComplete: false,
            state: { step: 'idle' },
          };
        } else {
          return {
            response: '请回复"是"继续输入视频描述，或"取消"重新设置。',
            isComplete: false,
            state: { ...this.videoWizard },
          };
        }

      case 'generating': {
        if (userInput.trim()) {
          this.videoWizard.prompt = userInput.trim();
          return {
            response: `🎬 收到视频描述："${userInput.trim()}"\n\n🚀 正在为您生成视频，请稍候...`,
            isComplete: true,
            state: { ...this.videoWizard },
          };
        } else {
          return {
            response: '请输入要生成的视频描述，例如：海边日落，浪花拍打着沙滩',
            isComplete: false,
            state: { ...this.videoWizard },
          };
        }
      }

      default:
        return {
          response: '发生了错误，请重新开始视频生成。',
          isComplete: false,
          state: { step: 'idle' },
        };
    }
  }

  // ========== 视频向导匹配方法 ==========

  private matchVideoStyle(input: string) {
    for (const style of VIDEO_STYLES) {
      if (input.includes(style.id) || input.includes(style.name)) {
        return style;
      }
    }
    if (input.includes('都可以') || input.includes('随便') || input.includes('无所谓')) {
      return VIDEO_STYLES[0];
    }
    return null;
  }

  private matchVideoDuration(input: string) {
    for (const d of VIDEO_DURATIONS) {
      if (input.includes(d.id) || input.includes(d.name)) {
        return d;
      }
    }
    if (input.includes('都可以') || input.includes('随便') || input.includes('无所谓')) {
      return VIDEO_DURATIONS[0];
    }
    return null;
  }

  private matchVideoRatio(input: string) {
    for (const r of VIDEO_RATIOS) {
      if (input.includes(r.id) || input.includes(r.name)) {
        return r;
      }
    }
    if (input.includes('都可以') || input.includes('随便') || input.includes('无所谓')) {
      return VIDEO_RATIOS[0];
    }
    return null;
  }

  // ========== 构建视频问题消息 ==========

  private buildVideoStyleQuestion(): string {
    return `🎬 **AI视频生成向导**

太好了！让我来帮你创作一段精彩的视频。

**第1步：选择视频风格**

你希望视频是什么风格的？

${VIDEO_STYLES.map(s => `${s.emoji} ${s.name} - ${s.desc}`).join('\n')}

请回复风格名称（如：写实、动漫、赛博朋克）`;
  }

  private buildVideoDurationQuestion(): string {
    return `✅ 风格设置为【${this.getVideoStyleName()}】。

**第2步：选择视频时长**

视频需要多长？

${VIDEO_DURATIONS.map(d => `${d.name} - ${d.desc}`).join('\n')}

请回复时长（如：5秒、10秒）`;
  }

  private buildVideoRatioQuestion(): string {
    return `✅ 时长设置为【${this.getVideoDurationName()}】。

**第3步：选择视频比例**

视频的画面比例是？

${VIDEO_RATIOS.map(r => `${r.emoji} ${r.name}`).join('\n')}

请回复比例名称（如：横屏、竖屏）`;
  }

  private buildVideoConfirmQuestion(): string {
    return `🎬 **视频参数确认**

请确认以下设置：

| 参数 | 选择 |
|------|------|
| 🎨 风格 | ${this.getVideoStyleName()} |
| ⏱️ 时长 | ${this.getVideoDurationName()} |
| 📺 比例 | ${this.getVideoRatioName()} |

回复"是"继续输入视频描述，或"取消"重新设置。`;
  }

  private buildVideoGeneratingMessage(): string {
    return `🎬 好的！请输入你要生成的视频描述内容...

可以直接输入文字，如："一只可爱的猫咪在草地上玩耍"`;
  }

  private getVideoStyleName(): string {
    const style = VIDEO_STYLES.find(s => s.id === this.videoWizard.style);
    return style ? `${style.emoji} ${style.name}` : '未知';
  }

  private getVideoDurationName(): string {
    const d = VIDEO_DURATIONS.find(v => v.id === this.videoWizard.duration);
    return d ? d.name : '未知';
  }

  private getVideoRatioName(): string {
    const r = VIDEO_RATIOS.find(v => v.id === this.videoWizard.ratio);
    return r ? `${r.emoji} ${r.name}` : '未知';
  }

  /**
   * 处理音乐向导消息
   */
  public processMusicWizard(userInput: string): { response: string; isComplete: boolean; state: MusicWizardState } {
    const input = userInput.trim().toLowerCase();

    switch (this.musicWizard.step) {
      case 'idle':
        // 开始音乐向导
        this.musicWizard.step = 'genre';
        return {
          response: this.buildGenreQuestion(),
          isComplete: false,
          state: { ...this.musicWizard },
        };

      case 'genre': {
        // 处理风格选择
        const genre = this.matchGenre(input);
        if (genre) {
          this.musicWizard.genre = genre.id;
          this.musicWizard.step = 'mood';
          return {
            response: this.buildMoodQuestion(),
            isComplete: false,
            state: { ...this.musicWizard },
          };
        } else {
          return {
            response: '抱歉，我没有理解你想要的风格。请从以下选项中选择：\n\n' + MUSIC_GENRES.map(g => `${g.emoji} ${g.name} - ${g.desc}`).join('\n'),
            isComplete: false,
            state: { ...this.musicWizard },
          };
        }
      }

      case 'mood': {
        // 处理情绪选择
        const mood = this.matchMood(input);
        if (mood) {
          this.musicWizard.mood = mood.id;
          this.musicWizard.step = 'duration';
          return {
            response: this.buildDurationQuestion(),
            isComplete: false,
            state: { ...this.musicWizard },
          };
        } else {
          return {
            response: '抱歉，我没有理解你想要的情绪。请从以下选项中选择：\n\n' + MUSIC_MOODS.map(m => `${m.emoji} ${m.name} - ${m.desc}`).join('\n'),
            isComplete: false,
            state: { ...this.musicWizard },
          };
        }
      }

      case 'duration': {
        // 处理时长选择
        const duration = this.matchDuration(input);
        if (duration) {
          this.musicWizard.duration = duration.value;
          this.musicWizard.step = 'tempo';
          return {
            response: this.buildTempoQuestion(),
            isComplete: false,
            state: { ...this.musicWizard },
          };
        } else {
          return {
            response: '抱歉，我没有理解你想要的时长。请从以下选项中选择：\n\n' + MUSIC_DURATIONS.map(d => `${d.label} - ${d.desc}`).join('\n'),
            isComplete: false,
            state: { ...this.musicWizard },
          };
        }
      }

      case 'tempo': {
        // 处理节奏选择
        const tempo = this.matchTempo(input);
        if (tempo) {
          this.musicWizard.tempo = tempo;
          this.musicWizard.step = 'instruments';
          return {
            response: this.buildInstrumentsQuestion(),
            isComplete: false,
            state: { ...this.musicWizard },
          };
        } else {
          return {
            response: '请告诉我你想要的节奏：慢节奏（60-80 BPM）、中节奏（80-100 BPM）、快节奏（100-120 BPM）或指定BPM值。',
            isComplete: false,
            state: { ...this.musicWizard },
          };
        }
      }

      case 'instruments': {
        // 处理乐器选择
        const instruments = this.matchInstruments(input);
        if (instruments && instruments.length > 0) {
          this.musicWizard.instruments = instruments;
          this.musicWizard.step = 'vocals';
          return {
            response: this.buildVocalsQuestion(),
            isComplete: false,
            state: { ...this.musicWizard },
          };
        } else {
          return {
            response: '抱歉，我没有理解你想要的乐器。请选择：\n\n' + INSTRUMENTS.map(i => `${i.emoji} ${i.name}`).join('\n') + '\n\n或者直接说"不需要乐器"跳过此步骤。',
            isComplete: false,
            state: { ...this.musicWizard },
          };
        }
      }

      case 'vocals': {
        // 处理人声选择
        const vocals = this.matchVocals(input);
        this.musicWizard.vocals = vocals;
        if (vocals) {
          this.musicWizard.step = 'lyrics';
          return {
            response: this.buildLyricsQuestion(),
            isComplete: false,
            state: { ...this.musicWizard },
          };
        } else {
          this.musicWizard.step = 'confirm';
          return {
            response: this.buildConfirmQuestion(),
            isComplete: false,
            state: { ...this.musicWizard },
          };
        }
      }

      case 'lyrics': {
        // 处理歌词输入
        const inputText = userInput.trim();
        if (inputText && inputText !== '不需要歌词' && inputText !== '跳过') {
          this.musicWizard.lyrics = inputText;
        } else {
          this.musicWizard.lyrics = undefined;
        }
        this.musicWizard.step = 'confirm';
        return {
          response: this.buildConfirmQuestion(),
          isComplete: false,
          state: { ...this.musicWizard },
        };
      }

      case 'confirm':
        // 确认生成
        if (this.isConfirm(input)) {
          this.musicWizard.step = 'generating';
          return {
            response: this.buildGeneratingMessage(),
            isComplete: true,
            state: { ...this.musicWizard },
          };
        } else if (this.isCancel(input)) {
          this.resetMusicWizard();
          return {
            response: '好的，音乐生成已取消。有什么其他我可以帮你的吗？',
            isComplete: false,
            state: { step: 'idle' },
          };
        } else {
          return {
            response: '请回复"是"确认生成，或"取消"重新开始。',
            isComplete: false,
            state: { ...this.musicWizard },
          };
        }

      default:
        return {
          response: '发生了错误，请重新开始音乐生成。',
          isComplete: false,
          state: { step: 'idle' },
        };
    }
  }

  /**
   * 处理配音向导消息
   */
  public processVoiceWizard(userInput: string): { response: string; isComplete: boolean; state: VoiceWizardState } {
    const input = userInput.trim().toLowerCase();

    switch (this.voiceWizard.step) {
      case 'idle':
        this.voiceWizard.step = 'gender';
        return {
          response: this.buildGenderQuestion(),
          isComplete: false,
          state: { ...this.voiceWizard },
        };

      case 'gender': {
        const gender = this.matchGender(input);
        if (gender) {
          this.voiceWizard.gender = gender.id as 'male' | 'female';
          this.voiceWizard.step = 'style';
          return {
            response: this.buildStyleQuestion(),
            isComplete: false,
            state: { ...this.voiceWizard },
          };
        } else {
          return {
            response: '抱歉，我没有理解。请选择音色：\n\n' + VOICE_GENDERS.map(g => `${g.emoji} ${g.name} - ${g.desc}`).join('\n'),
            isComplete: false,
            state: { ...this.voiceWizard },
          };
        }
      }

      case 'style': {
        const style = this.matchStyle(input);
        if (style) {
          this.voiceWizard.style = style.id;
          this.voiceWizard.step = 'language';
          return {
            response: this.buildLanguageQuestion(),
            isComplete: false,
            state: { ...this.voiceWizard },
          };
        } else {
          return {
            response: '抱歉，我没有理解你想要的声音风格。请从以下选项中选择：\n\n' + VOICE_STYLES.map(s => `${s.emoji} ${s.name} - ${s.desc}`).join('\n'),
            isComplete: false,
            state: { ...this.voiceWizard },
          };
        }
      }

      case 'language': {
        const language = this.matchLanguage(input);
        if (language) {
          this.voiceWizard.language = language.id;
          this.voiceWizard.step = 'speed';
          return {
            response: this.buildSpeedQuestion(),
            isComplete: false,
            state: { ...this.voiceWizard },
          };
        } else {
          return {
            response: '抱歉，我没有理解你想要配音的语言。请从以下选项中选择：\n\n' + VOICE_LANGUAGES.map(l => `${l.emoji} ${l.name}`).join('\n'),
            isComplete: false,
            state: { ...this.voiceWizard },
          };
        }
      }

      case 'speed': {
        const speed = this.matchSpeed(input);
        if (speed) {
          this.voiceWizard.speed = speed.id as 'slow' | 'normal' | 'fast';
          this.voiceWizard.step = 'confirm';
          return {
            response: this.buildVoiceConfirmQuestion(),
            isComplete: false,
            state: { ...this.voiceWizard },
          };
        } else {
          return {
            response: '抱歉，我没有理解你想要的语速。请从以下选项中选择：\n\n' + VOICE_SPEEDS.map(s => `${s.emoji} ${s.name} - ${s.desc}`).join('\n'),
            isComplete: false,
            state: { ...this.voiceWizard },
          };
        }
      }

      case 'confirm':
        if (this.isConfirm(input)) {
          this.voiceWizard.step = 'generating';
          return {
            response: this.buildVoiceGeneratingMessage(),
            isComplete: true,
            state: { ...this.voiceWizard },
          };
        } else if (this.isCancel(input)) {
          this.resetVoiceWizard();
          return {
            response: '好的，配音生成已取消。有什么其他我可以帮你的吗？',
            isComplete: false,
            state: { step: 'idle' },
          };
        } else {
          return {
            response: '请回复"是"确认进入配音文本输入，或"取消"重新设置。',
            isComplete: false,
            state: { ...this.voiceWizard },
          };
        }

      case 'generating': {
        // 在generating阶段，用户的输入即为配音文本
        if (userInput.trim()) {
          this.voiceWizard.text = userInput.trim();
          return {
            response: `📝 收到配音文本："${userInput.trim()}"\n\n🎙️ 正在生成配音，请稍候...`,
            isComplete: true,
            state: { ...this.voiceWizard },
          };
        } else {
          return {
            response: '请输入要配音的文本内容，例如：今天天气真好，阳光明媚',
            isComplete: false,
            state: { ...this.voiceWizard },
          };
        }
      }

      default:
        return {
          response: '发生了错误，请重新开始配音生成。',
          isComplete: false,
          state: { step: 'idle' },
        };
    }
  }

  // ========== 配音向导匹配方法 ==========

  private matchGender(input: string) {
    for (const gender of VOICE_GENDERS) {
      if (input.includes(gender.id) || input.includes(gender.name)) {
        return gender;
      }
    }
    if (input.includes('都可以') || input.includes('随便') || input.includes('无所谓')) {
      return VOICE_GENDERS[0];
    }
    return null;
  }

  private matchStyle(input: string) {
    for (const style of VOICE_STYLES) {
      if (input.includes(style.id) || input.includes(style.name)) {
        return style;
      }
    }
    if (input.includes('都可以') || input.includes('随便') || input.includes('无所谓')) {
      return VOICE_STYLES[0];
    }
    return null;
  }

  private matchLanguage(input: string) {
    for (const language of VOICE_LANGUAGES) {
      if (input.includes(language.id) || input.includes(language.name)) {
        return language;
      }
    }
    if (input.includes('都可以') || input.includes('随便') || input.includes('无所谓')) {
      return VOICE_LANGUAGES[0];
    }
    return null;
  }

  private matchSpeed(input: string) {
    for (const speed of VOICE_SPEEDS) {
      if (input.includes(speed.id) || input.includes(speed.name)) {
        return speed;
      }
    }
    if (input.includes('都可以') || input.includes('随便') || input.includes('无所谓') || input.includes('正常') || input.includes('标准')) {
      return VOICE_SPEEDS[1];
    }
    return null;
  }

  // ========== 构建配音问题消息 ==========

  private buildGenderQuestion(): string {
    return `🎙️ **AI配音生成向导**

太好了！让我来帮你完成配音。

**第1步：选择音色**

你希望是什么性别的声音？

${VOICE_GENDERS.map(g => `${g.emoji} ${g.name} - ${g.desc}`).join('\n')}

请回复"男声"或"女声"`;
  }

  private buildStyleQuestion(): string {
    return `✅ 你选择了【${this.getGenderName()}】。

**第2步：选择声音风格**

希望声音听起来是什么样的？

${VOICE_STYLES.map(s => `${s.emoji} ${s.name} - ${s.desc}`).join('\n')}

请回复风格名称（如：自然、活力、播音）`;
  }

  private buildLanguageQuestion(): string {
    return `✅ 声音风格设置为【${this.getStyleName()}】。

**第3步：选择配音语言**

需要配音的语言是？

${VOICE_LANGUAGES.map(l => `${l.emoji} ${l.name}`).join('\n')}

请回复语言名称（如：中文、英文）`;
  }

  private buildSpeedQuestion(): string {
    return `✅ 语言设置为【${this.voiceWizard.language}】。

**第4步：选择语速**

配音的语速怎么设置？

${VOICE_SPEEDS.map(s => `${s.emoji} ${s.name} - ${s.desc}`).join('\n')}

请回复语速（如：慢速、常速、快速）`;
  }

  private buildVoiceConfirmQuestion(): string {
    return `🎙️ **配音参数确认**

请确认以下设置：

| 参数 | 选择 |
|------|------|
| 🔊 音色 | ${this.getGenderName()} |
| 🎨 风格 | ${this.getStyleName()} |
| 🌍 语言 | ${this.voiceWizard.language} |
| ⏱️ 语速 | ${this.getSpeedName()} |

回复"是"继续输入配音文本，或"取消"重新设置。`;
  }

  private buildVoiceGeneratingMessage(): string {
    return `🎙️ 好的！请输入你要配音的文本内容...

可以直接输入文字，如："今天天气真好，阳光明媚"`;
  }

  private getGenderName(): string {
    const gender = VOICE_GENDERS.find(g => g.id === this.voiceWizard.gender);
    return gender ? `${gender.emoji} ${gender.name}` : '未知';
  }

  private getStyleName(): string {
    const style = VOICE_STYLES.find(s => s.id === this.voiceWizard.style);
    return style ? `${style.emoji} ${style.name}` : '未知';
  }

  private getSpeedName(): string {
    const speed = VOICE_SPEEDS.find(s => s.id === this.voiceWizard.speed);
    return speed ? `${speed.emoji} ${speed.name}` : '未知';
  }

  // ========== 匹配方法 ==========

  private matchGenre(input: string) {
    // 检查是否包含某个风格的关键词
    for (const genre of MUSIC_GENRES) {
      if (input.includes(genre.id) || input.includes(genre.name)) {
        return genre;
      }
    }
    // 如果用户说"都可以"或"随便"，默认选择电子
    if (input.includes('都可以') || input.includes('随便') || input.includes('无所谓')) {
      return MUSIC_GENRES[0]; // 默认电子
    }
    return null;
  }

  private matchMood(input: string) {
    for (const mood of MUSIC_MOODS) {
      if (input.includes(mood.id) || input.includes(mood.name)) {
        return mood;
      }
    }
    if (input.includes('都可以') || input.includes('随便') || input.includes('无所谓')) {
      return MUSIC_MOODS[3]; // 默认平静
    }
    return null;
  }

  private matchDuration(input: string) {
    for (const duration of MUSIC_DURATIONS) {
      if (input.includes(String(duration.value)) ||
          input.includes(duration.label) ||
          input.includes(duration.desc)) {
        return duration;
      }
    }
    // 默认30秒
    if (input.includes('都可以') || input.includes('随便') || input.includes('无所谓') || input.includes('标准')) {
      return MUSIC_DURATIONS[1];
    }
    return null;
  }

  private matchTempo(input: string) {
    // 慢节奏
    if (input.includes('慢') || input.includes('60') || input.includes('70') || input.includes('80')) {
      return 70;
    }
    // 快节奏
    if (input.includes('快') || input.includes('100') || input.includes('110') || input.includes('120')) {
      return 110;
    }
    // 中节奏
    if (input.includes('中') || input.includes('80') || input.includes('90')) {
      return 85;
    }
    // 提取具体BPM值
    const bpmMatch = input.match(/(\d+)\s*bpm/i);
    if (bpmMatch) {
      return parseInt(bpmMatch[1]);
    }
    // 默认中等节奏
    if (input.includes('都可以') || input.includes('随便') || input.includes('无所谓')) {
      return 90;
    }
    return null;
  }

  private matchInstruments(input: string) {
    const selected: string[] = [];
    for (const instrument of INSTRUMENTS) {
      if (input.includes(instrument.id) || input.includes(instrument.name)) {
        selected.push(instrument.id);
      }
    }
    // 如果用户说不需要乐器
    if (input.includes('不需要') || input.includes('不要') || input.includes('跳过')) {
      return [];
    }
    // 如果选择了"都可以"或"随便"
    if (input.includes('都可以') || input.includes('随便') || input.includes('无所谓')) {
      return ['piano', 'guitar']; // 默认钢琴吉他
    }
    return selected.length > 0 ? selected : null;
  }

  private matchVocals(input: string) {
    return input.includes('是') || input.includes('需要') || input.includes('有') ||
           input.includes('要') || input.includes('对的');
  }

  private isConfirm(input: string) {
    return input.includes('是') || input.includes('确认') || input.includes('生成') ||
           input.includes('好') || input.includes('开始') || input.includes('对');
  }

  private isCancel(input: string) {
    return input.includes('取消') || input.includes('重新') || input.includes('不') ||
           input.includes('算了') || input.includes('不要');
  }

  // ========== 构建问题消息 ==========

  private buildGenreQuestion(): string {
    return `🎵 **音乐生成向导**

太好了！让我们一起来创作一首专属音乐。

**第1步：选择音乐风格**

你希望是什么风格的音乐？

${MUSIC_GENRES.map(g => `${g.emoji} ${g.name} - ${g.desc}`).join('\n')}

请回复数字或风格名称（如：电子、流行、古典）`;
  }

  private buildMoodQuestion(): string {
    return `✅ 你选择了【${this.getGenreName()}】风格。

**第2步：选择音乐情绪**

这首歌想要传达什么样的情感？

${MUSIC_MOODS.map(m => `${m.emoji} ${m.name} - ${m.desc}`).join('\n')}

请回复情绪名称（如：欢快、平静、史诗）`;
  }

  private buildDurationQuestion(): string {
    return `✅ 情绪设置为【${this.getMoodName()}】。

**第3步：选择音乐时长**

需要多长的音乐？

${MUSIC_DURATIONS.map(d => `${d.label} - ${d.desc}`).join('\n')}

请回复时长（如：30秒、1分钟）`;
  }

  private buildTempoQuestion(): string {
    return `✅ 时长设置为【${this.musicWizard.duration}秒】。

**第4步：选择节奏速度**

音乐的节奏快慢是怎样的？

- 🐢 慢节奏（60-80 BPM）- 舒缓放松
- 🚶 中节奏（80-100 BPM）- 适中舒适
- 🏃 快节奏（100-120 BPM）- 活力四射

或者直接告诉我 BPM 值（如：90 BPM）`;
  }

  private buildInstrumentsQuestion(): string {
    return `✅ 节奏设置为【${this.musicWizard.tempo} BPM】。

**第5步：选择主奏乐器**

希望用什么乐器来演奏？

${INSTRUMENTS.map(i => `${i.emoji} ${i.name}`).join('\n')}

可以选多个（如：钢琴、吉他），或者说"不需要乐器"`;
  }

  private buildVocalsQuestion(): string {
    const instrumentsStr = this.musicWizard.instruments?.length
      ? this.musicWizard.instruments.map(i => this.getInstrumentName(i)).join('、')
      : '无';
    return `✅ 主奏乐器：【${instrumentsStr}】。

**第6步：是否需要人声**

需要加入演唱/歌词吗？

- 🎤 是 - 需要人声和歌词
- 🚫 否 - 纯器乐版本`;
  }

  private buildLyricsQuestion(): string {
    return `✅ 你选择了需要人声！

**第7步：输入歌词**

请输入你想要的歌词内容。
可以是一段歌词、几句诗，或者描述你想唱什么主题。
如果不确定，可以直接说"不需要歌词"，我会帮你生成合适的歌词。`;
  }

  private buildConfirmQuestion(): string {
    const instrumentsStr = this.musicWizard.instruments?.length
      ? this.musicWizard.instruments.map(i => this.getInstrumentName(i)).join('、')
      : '无';
    const vocalsStr = this.musicWizard.vocals ? '需要人声' : '纯器乐';
    const lyricsStr = this.musicWizard.lyrics
      ? `有歌词（${this.musicWizard.lyrics.substring(0, 20)}...）`
      : this.musicWizard.vocals ? 'AI生成歌词' : '无';

    return `🎶 **音乐参数确认**

请确认以下设置：

| 参数 | 选择 |
|------|------|
| 🎵 风格 | ${this.getGenreName()} |
| 💫 情绪 | ${this.getMoodName()} |
| ⏱️ 时长 | ${this.musicWizard.duration}秒 |
| 🎯 BPM | ${this.musicWizard.tempo} |
| 🎸 乐器 | ${instrumentsStr} |
| 🎤 人声 | ${vocalsStr} |
| 📝 歌词 | ${lyricsStr} |

回复"是"确认生成，或"取消"重新设置。`;
  }

  private buildGeneratingMessage(): string {
    return `🎵 好的！正在根据你的设置生成音乐...

请稍等片刻，AI正在创作中...`;
  }

  // ========== 辅助方法 ==========

  private getGenreName(): string {
    const genre = MUSIC_GENRES.find(g => g.id === this.musicWizard.genre);
    return genre ? `${genre.emoji} ${genre.name}` : '未知';
  }

  private getMoodName(): string {
    const mood = MUSIC_MOODS.find(m => m.id === this.musicWizard.mood);
    return mood ? `${mood.emoji} ${mood.name}` : '未知';
  }

  private getInstrumentName(id: string): string {
    const instrument = INSTRUMENTS.find(i => i.id === id);
    return instrument ? `${instrument.emoji} ${instrument.name}` : id;
  }

  /**
   * 处理用户消息并生成响应
   */
  public async processMessage(
    userInput: string,
    options: SmartChatOptions = {}
  ): Promise<SmartChatMessage> {
    // 记录用户消息到历史记录
    const userMessage: SmartChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userInput,
      timestamp: new Date(),
    };
    this.conversationHistory.push(userMessage);

    // 如果历史记录过长，只保留最近的 20 条
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }

    // 如果配音向导在进行中，优先处理
    if (this.voiceWizard.step !== 'idle' && this.voiceWizard.step !== 'generating') {
      const result = this.processVoiceWizard(userInput);

      // 如果是确认步骤完成，提示用户输入文本
      if (result.state.step === 'generating') {
        return {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: result.response,
          timestamp: new Date(),
          intent: 'voice_generation',
          actionType: 'voice_wizard',
        };
      }

      return {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
        intent: 'voice_generation',
        actionType: 'voice_wizard',
      };
    }

    // 如果视频向导在进行中，优先处理
    if (this.videoWizard.step !== 'idle' && this.videoWizard.step !== 'generating') {
      const result = this.processVideoWizard(userInput);
      return {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
        intent: 'video_generation',
        actionType: 'video_wizard',
      };
    }

    // 如果音乐向导在进行中，优先处理
    if (this.musicWizard.step !== 'idle' && this.musicWizard.step !== 'generating') {
      const result = this.processMusicWizard(userInput);
      return {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
        intent: 'music_generation',
        actionType: 'music_wizard',
      };
    }

    const intentResult = this.recognizeIntent(userInput);
    const { intent, params } = intentResult;

    let response: string;
    let actionType: SmartChatMessage['actionType'];

    switch (intent) {
      case 'image_generation':
        actionType = 'generate_image';
        response = this.generateImageResponse(params?.prompt as string);
        break;

      case 'music_generation': {
        // 开始音乐生成向导
        this.resetMusicWizard();
        this.resetVoiceWizard();
        this.resetVideoWizard(); // 确保重置视频向导
        const musicResult = this.processMusicWizard(userInput);
        return {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: musicResult.response,
          timestamp: new Date(),
          intent: 'music_generation',
          actionType: 'music_wizard',
        };
      }

      case 'voice_generation': {
        // 开始配音生成向导
        this.resetVoiceWizard();
        this.resetMusicWizard();
        this.resetVideoWizard(); // 确保重置视频向导
        const voiceResult = this.processVoiceWizard(userInput);
        return {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: voiceResult.response,
          timestamp: new Date(),
          intent: 'voice_generation',
          actionType: 'voice_wizard',
        };
      }

      case 'video_generation': {
        // 开始视频生成向导
        this.resetVideoWizard();
        this.resetMusicWizard();
        this.resetVoiceWizard();
        const videoResult = this.processVideoWizard(userInput);
        return {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: videoResult.response,
          timestamp: new Date(),
          intent: 'video_generation',
          actionType: 'video_wizard',
        };
      }

      case 'prompt_optimize':
        actionType = 'optimize_prompt';
        response = await this.optimizePrompt(userInput);
        break;

      case 'software_question':
        response = this.answerSoftwareQuestion(userInput);
        break;

      case 'general_chat':
      default:
        response = await this.generateGeneralResponse(userInput);
        break;
    }

    const assistantMessage: SmartChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      intent,
      actionType,
    };
    this.conversationHistory.push(assistantMessage);

    return assistantMessage;
  }

  /**
   * 生成图片响应
   */
  private generateImageResponse(prompt?: string): string {
    if (!prompt) {
      return '好的，请告诉我你想生成什么样的图片？例如："帮我画一只可爱的猫咪"';
    }
    return `🎨 好的！我将根据你的描述生成图片：

**描述内容**：${prompt}

请稍等，图片生成中...`;
  }

  /**
   * 生成音乐响应
   */
  private generateMusicResponse(prompt?: string, duration?: number): string {
    if (!prompt) {
      return '好的，请告诉我你想生成什么样的音乐？例如："帮我创作一首欢快的电子音乐"';
    }
    return `🎵 好的！我将根据你的描述生成音乐：

**音乐描述**：${prompt}
**时长**：${duration || 30}秒

请稍等，音乐生成中...`;
  }

  /**
   * 生成配音响应
   */
  private generateVoiceResponse(text?: string): string {
    if (!text) {
      return '好的，请告诉我你想让AI读什么内容？例如："帮我配音：今天天气真好"';
    }
    return `🎙️ 好的！我将为你生成配音：

**文本内容**：${text}

请稍等，配音生成中...`;
  }

  /**
   * 生成视频响应
   */
  private generateVideoResponse(prompt?: string): string {
    if (!prompt) {
      return '好的，请告诉我你想生成什么样的视频？例如："帮我生成一段海边日落的视频"';
    }
    return `🎬 好的！我将根据你的描述生成视频：

**视频描述**：${prompt}

请稍等，视频生成中...`;
  }

  /**
   * 优化提示词
   */
  private async optimizePrompt(input: string): Promise<string> {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/ai/optimize-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt: input }),
      });

      if (response.ok) {
        const data = await response.json();
        return `✨ **提示词优化完成**：

**优化后**：${data.optimized || data.result || input}

你可以直接使用优化后的提示词进行生成。`;
      }
    } catch (error) {
      console.error('[SmartChat] Prompt optimization failed:', error);
    }

    return `💡 **提示词优化建议**：

将"${input}"优化为更详细的描述，例如：
- 添加具体场景和细节
- 说明光线和氛围
- 描述画面构图和风格

你可以进一步完善你的描述，我会帮你优化！`;
  }

  /**
   * 回答软件问题
   */
  private answerSoftwareQuestion(input: string): string {
    const inputLower = input.toLowerCase();

    for (const func of SOFTWARE_FUNCTIONS) {
      for (const keyword of func.keywords) {
        if (inputLower.includes(keyword.toLowerCase())) {
          return `📖 **${func.name}**

${func.description}

**使用方法**：${func.usage}`;
        }
      }
    }

    return `🤖 我是AI创作助手小智，我可以帮助你：

🎨 **图片生成** - 描述你想要的内容，我来帮你生成
🎬 **视频生成** - 描述场景，我来帮你制作视频
🎵 **音乐生成** - 描述音乐风格，生成原创音乐（支持多轮对话定制）
🎙️ **配音合成** - 输入文字，生成自然语音
✨ **提示词优化** - 优化你的创作描述
📖 **功能咨询** - 解答软件使用问题

请告诉我你想做什么？`;
  }

  /**
   * 生成通用回复
   */
  private async generateGeneralResponse(input: string): Promise<string> {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('你好') || lowerInput.includes('hi') || lowerInput.includes('hello')) {
      return '你好！我是AI创作助手小智 👋\n\n我可以帮你完成各种创作：\n- 🎨 生成图片\n- 🎬 制作视频\n- 🎵 创作音乐（支持多轮对话定制）\n- 🎙️ 合成配音\n\n有什么我可以帮你的吗？';
    }

    if (lowerInput.includes('谢谢') || lowerInput.includes('thank')) {
      return '不客气！很高兴能帮到你 😊\n\n如果还有其他需要，随时告诉我！';
    }

    if (lowerInput.includes('再见') || lowerInput.includes('bye')) {
      return '再见！祝你创作愉快 👋\n\n有需要随时召唤我！';
    }

    // 调用AI助手服务
    try {
      const token = await getAuthToken();
      
      // 添加系统指令，告知 AI 它的能力
      const systemInstruction = {
        role: 'system' as const,
        content: `你是一个全能的 AI 创作助手，名字叫"小智"。
你拥有以下特殊能力，如果用户请求这些功能，请引导他们使用正确的关键词或直接告诉他们你可以做到：
1. **生成图片**：用户可以直接描述内容，例如"画一只猫"。
2. **生成音乐**：你拥有专门的音乐生成向导。如果用户想创作音乐，请告诉他们输入"生成音乐"或"创作音乐"来启动向导。
3. **生成视频**：你拥有视频生成向导。引导用户输入"生成视频"来启动流程。
4. **配音/语音合成**：引导用户输入"配音"或直接输入要读的文字。

如果用户问你"你能生成音乐吗"或类似问题，请回答："是的，我可以为您创作音乐！请告诉我您想要的风格，或者直接输入'生成音乐'来启动我的创作向导。"
请不要说你只是一个文本模型无法生成音频或图片。`
      };

      // 转换历史记录格式以符合后端要求
      const historyMessages = this.conversationHistory
        .filter(msg => ['user', 'assistant', 'system'].includes(msg.role))
        .map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
        }))
        .slice(-10); // 只保留最近10轮对话

      const messages = [systemInstruction, ...historyMessages];

      const response = await fetch(`${API_BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages,
          provider: 'minimax',
          stream: false
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // 后端已经将结果整理在 content 字段中
        if (data.success && data.content) {
          return data.content;
        }
        // 回退到其他可能的字段
        return data.reply || data.response || data.message;
      }

      // 处理错误响应
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || errorData.message || `请求失败 (${response.status})`;
      
      // 针对不同错误码提供友好的错误消息
      if (response.status === 502 || response.status === 503) {
        console.error('[SmartChat] AI service temporarily unavailable:', errorMessage);
        return `😔 AI服务暂时不可用，请稍后再试。

如果您持续遇到此问题，请检查：
1. 网络连接是否正常
2. AI服务是否在维护中

其他功能仍然可用：
- 🎨 **生成图片** → 直接描述图片内容
- 🎵 **生成音乐** → 说"生成音乐"
- 🎙️ **生成配音** → 输入要朗读的文本`;
      }

      if (response.status === 401 || response.status === 403) {
        return `⚠️ 认证失败，请重新登录后重试。`;
      }

      if (response.status === 429) {
        return `⏰ 请求过于频繁，请稍后再试。`;
      }

      console.error('[SmartChat] API error:', errorMessage);
      return `处理您的请求时出现问题：${errorMessage}\n\n请稍后重试，或尝试使用其他功能。`;

    } catch (error) {
      console.error('[SmartChat] General chat failed:', error);
      
      // 检查是否是网络错误
      const isNetworkError = error instanceof TypeError && error.message.includes('fetch');
      if (isNetworkError) {
        return `🌐 网络连接失败，请检查网络后重试。

暂时您可以使用：
- 🎨 **生成图片** → 直接描述图片内容
- 🎵 **生成音乐** → 说"生成音乐"
- 🎙️ **生成配音** → 输入要朗读的文本`;
      }
    }

    return `我理解你的意思了！😊 

如果你想：
- 🎨 **生成图片** → 直接描述图片内容
- 🎵 **生成音乐** → 说"生成音乐"，我将通过多轮对话帮你定制
- 🎙️ **生成配音** → 输入要朗读的文本
- ✨ **优化提示词** → 说"帮我优化提示词：..."

请告诉我你想做什么？`;
  }

  /**
   * 执行图片生成
   */
  public async generateImage(prompt: string): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/image/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();
      if (data.success && data.url) {
        return { success: true, imageUrl: data.url };
      }
      return { success: false, error: data.error || '生成失败' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '网络错误' };
    }
  }

  /**
   * 执行音乐生成（使用向导参数）
   */
  public async generateMusicWithWizard(): Promise<{ success: boolean; audioUrl?: string; error?: string }> {
    const state = this.musicWizard;
    if (state.step !== 'generating') {
      return { success: false, error: '音乐参数未完成' };
    }

    try {
      const token = await getAuthToken();

      // 构建音乐生成提示词
      const prompt = this.buildMusicPrompt();

      const response = await fetch(`${API_BASE_URL}/audio/music-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt,
          lyrics: state.lyrics || '',
          instrumental: state.vocals !== undefined ? !state.vocals : true,
        }),
      });

      const data = await response.json();

      // 立即返回音频 URL 的情况
      if (data.success && data.audioUrl) {
        this.resetMusicWizard();
        return { success: true, audioUrl: data.audioUrl };
      }

      // 异步任务：需要轮询
      if (data.success && data.data?.taskId) {
        const taskId = data.data.taskId;
        const maxPolls = 60;
        for (let i = 0; i < maxPolls; i++) {
          await new Promise(r => setTimeout(r, 3000));
          try {
            const pollResp = await fetch(`${API_BASE_URL}/audio/music-query?task_id=${taskId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const pollData = await pollResp.json();
            if (pollData.success && pollData.data?.audioUrl) {
              this.resetMusicWizard();
              return { success: true, audioUrl: pollData.data.audioUrl };
            }
            if (pollData.data?.status === 'failed') {
              return { success: false, error: pollData.error || '音乐生成失败' };
            }
          } catch {
            // 继续轮询
          }
        }
        return { success: false, error: '音乐生成超时，请稍后重试' };
      }

      return { success: false, error: data.error || '生成失败' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '网络错误' };
    }
  }

  /**
   * 构建音乐提示词
   */
  private buildMusicPrompt(): string {
    const parts: string[] = [];

    if (this.musicWizard.genre) {
      const genre = MUSIC_GENRES.find(g => g.id === this.musicWizard.genre);
      parts.push(genre?.name || '');
    }
    if (this.musicWizard.mood) {
      const mood = MUSIC_MOODS.find(m => m.id === this.musicWizard.mood);
      parts.push(mood?.name || '');
    }
    if (this.musicWizard.instruments && this.musicWizard.instruments.length > 0) {
      const instrumentNames = this.musicWizard.instruments.map(i => {
        const inst = INSTRUMENTS.find(ins => ins.id === i);
        return inst?.name || i;
      });
      parts.push(`使用${instrumentNames.join('、')}演奏`);
    }
    if (this.musicWizard.vocals) {
      parts.push('包含人声和歌词');
    }

    return parts.join('，');
  }

  /**
   * 执行音乐生成（旧接口，保持兼容）
   */
  public async generateMusic(prompt: string, duration: number = 30): Promise<{ success: boolean; audioUrl?: string; error?: string }> {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/audio/music-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt, lyrics: '', instrumental: true }),
      });

      const data = await response.json();

      if (data.success && data.audioUrl) {
        return { success: true, audioUrl: data.audioUrl };
      }

      if (data.success && data.data?.taskId) {
        const taskId = data.data.taskId;
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 3000));
          try {
            const pollResp = await fetch(`${API_BASE_URL}/audio/music-query?task_id=${taskId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const pollData = await pollResp.json();
            if (pollData.success && pollData.data?.audioUrl) {
              return { success: true, audioUrl: pollData.data.audioUrl };
            }
            if (pollData.data?.status === 'failed') {
              return { success: false, error: pollData.error || '音乐生成失败' };
            }
          } catch {
            // continue polling
          }
        }
        return { success: false, error: '音乐生成超时，请稍后重试' };
      }

      return { success: false, error: data.error || '生成失败' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '网络错误' };
    }
  }

  /**
   * 执行配音生成
   */
  public async generateVoice(text: string, voiceId?: string): Promise<{ success: boolean; audioUrl?: string; error?: string }> {
    try {
      const token = await getAuthToken();

      // 将向导参数中的字符串 speed 映射为数字
      const speedMap: Record<string, number> = { slow: 0.8, normal: 1.0, fast: 1.2 };
      const speed = this.voiceWizard.speed ? (speedMap[this.voiceWizard.speed] ?? 1.0) : undefined;

      const response = await fetch(`${API_BASE_URL}/audio/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text,
          voiceId,
          model: 'speech-2.8-hd',
          // 添加向导参数
          gender: this.voiceWizard.gender,
          style: this.voiceWizard.style,
          language: this.voiceWizard.language,
          speed,
        }),
      });

      const data = await response.json();
      if (data.success && (data.audioUrl || data.url || data.data?.audioUrl)) {
        // 重置向导
        this.resetVoiceWizard();
        return { success: true, audioUrl: data.audioUrl || data.url || data.data?.audioUrl };
      }
      return { success: false, error: data.error || '生成失败' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '网络错误' };
    }
  }

  /**
   * 执行配音生成（使用向导参数）
   */
  public async generateVoiceWithWizard(text: string): Promise<{ success: boolean; audioUrl?: string; error?: string }> {
    const state = this.voiceWizard;

    try {
      const token = await getAuthToken();

      // 将向导参数中的字符串 speed 映射为数字
      const speedMap: Record<string, number> = { slow: 0.8, normal: 1.0, fast: 1.2 };
      const speed = state.speed ? (speedMap[state.speed] ?? 1.0) : 1.0;

      const response = await fetch(`${API_BASE_URL}/audio/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text,
          model: 'speech-2.8-hd',
          gender: state.gender,
          style: state.style,
          language: state.language,
          speed,
        }),
      });

      const data = await response.json();
      if (data.success && (data.audioUrl || data.url || data.data?.audioUrl)) {
        // 重置向导
        this.resetVoiceWizard();
        return { success: true, audioUrl: data.audioUrl || data.url || data.data?.audioUrl };
      }
      return { success: false, error: data.error || '生成失败' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '网络错误' };
    }
  }

  /**
   * 执行视频生成
   */
  public async generateVideo(prompt: string): Promise<{ success: boolean; videoUrl?: string; taskId?: string; error?: string }> {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/video/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt,
          duration: 8,
          aspectRatio: '16:9',
        }),
      });

      const data = await response.json();
      if (data.success) {
        return {
          success: true,
          videoUrl: data.url || data.data?.resultUrl,
          taskId: data.taskId || data.data?.taskId,
        };
      }
      return { success: false, error: data.error || '生成失败' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '网络错误' };
    }
  }

  /**
   * 执行视频生成（使用向导参数）
   */
  public async generateVideoWithWizard(): Promise<{ success: boolean; videoUrl?: string; taskId?: string; error?: string }> {
    const state = this.videoWizard;
    if (state.step !== 'generating' || !state.prompt) {
      return { success: false, error: '视频参数不完整' };
    }

    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/video/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt: state.prompt,
          style: state.style,
          duration: state.duration ? parseInt(state.duration) : 10,
          aspectRatio: state.ratio || '16:9',
        }),
      });

      const data = await response.json();
      if (data.success) {
        this.resetVideoWizard();
        return {
          success: true,
          videoUrl: data.url || data.data?.resultUrl,
          taskId: data.taskId || data.data?.taskId,
        };
      }
      return { success: false, error: data.error || '生成失败' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '网络错误' };
    }
  }

  /**
   * 清空对话历史
   */
  public clearHistory(): void {
    this.conversationHistory = [];
    this.resetMusicWizard();
    this.resetVoiceWizard();
    this.resetVideoWizard();
  }

  /**
   * 获取对话历史
   */
  public getHistory(): SmartChatMessage[] {
    return [...this.conversationHistory];
  }
}

export const smartChatService = SmartChatService.getInstance();
export default smartChatService;
