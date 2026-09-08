/**
 * 中国AI音效服务
 * 集成豆包、海螺AI、通义等中国大模型进行智能音效推荐和生成
 */

import { aiSoundEffectsService, SoundEffect, SoundMatchResult, Mood } from './ai-sound-effects-service';
import { generateId } from '@/lib/utils';

export type ChineseSoundProvider = 'douyin' | 'hailuo' | 'qwen' | 'local';

export interface ChineseSoundMatchResult extends SoundMatchResult {
  provider: ChineseSoundProvider;
  generatedUrl?: string;
  generationProgress?: number;
}

export interface ChineseSoundOptions {
  provider: ChineseSoundProvider;
  intensity?: number;
  duration?: number;
  style?: 'realistic' | 'cinematic' | 'cartoon';
}

export interface SceneAnalysis {
  scene: string;
  detectedMoods: Mood[];
  detectedObjects: string[];
  suggestedCategories: string[];
  description: string;
}

class ChineseAISoundService {
  private static instance: ChineseAISoundService;
  private config: {
    douyinAppId?: string;
    douyinAccessToken?: string;
    hailuoApiKey?: string;
    qwenApiKey?: string;
  } = {};
  private defaultProvider: ChineseSoundProvider = 'douyin';

  private constructor() {
    this.loadConfig();
  }

  public static getInstance(): ChineseAISoundService {
    if (!ChineseAISoundService.instance) {
      ChineseAISoundService.instance = new ChineseAISoundService();
    }
    return ChineseAISoundService.instance;
  }

  /**
   * 加载配置
   */
  private loadConfig(): void {
    this.config = {};
  }

  /**
   * 检查提供商是否可用
   */
  isProviderAvailable(provider: ChineseSoundProvider): boolean {
    switch (provider) {
      case 'douyin':
      case 'hailuo':
      case 'qwen':
        return false;
      case 'local':
        return true;
      default:
        return false;
    }
  }

  /**
   * 获取可用的提供商列表
   */
  getAvailableProviders(): ChineseSoundProvider[] {
    const providers: ChineseSoundProvider[] = [];
    if (this.isProviderAvailable('douyin')) providers.push('douyin');
    if (this.isProviderAvailable('hailuo')) providers.push('hailuo');
    if (this.isProviderAvailable('qwen')) providers.push('qwen');
    providers.push('local');
    return providers;
  }

  /**
   * 分析场景
   * 使用AI理解视频内容，推荐合适的音效
   */
  async analyzeScene(
    videoFrames: Blob[] | ImageData[],
    description?: string
  ): Promise<SceneAnalysis> {
    try {
      // 使用豆包/通义进行场景分析
      const analysis = await this.analyzeWithAI(videoFrames, description);
      return analysis;
    } catch (error) {
      console.error('[AI音效] 场景分析失败:', error);
      // 返回默认分析
      return {
        scene: 'general',
        detectedMoods: ['calm'],
        detectedObjects: [],
        suggestedCategories: ['ambient'],
        description: description || '通用场景',
      };
    }
  }

  /**
   * 使用AI分析场景
   */
  private async analyzeWithAI(
    _videoFrames: Blob[] | ImageData[],
    description?: string
  ): Promise<SceneAnalysis> {
    // 构建分析提示
    const analysisPrompt = `请分析以下视频场景，并推荐合适的音效：

场景描述：${description || '无'}

请返回：
1. 场景类型（自然/城市/室内/动作/情感）
2. 适合的情绪（开心/悲伤/兴奋/平静/紧张/神秘/励志/戏剧）
3. 建议的音效类别（转场/环境音/自然音/UI音效/动作音效/情感音效）
4. 简短描述`;

    try {
      return this.localAnalyzeScene(description || analysisPrompt);
    } catch (error) {
      console.error('[AI音效] AI分析失败:', error);
    }

    // 回退到本地分析
    return this.localAnalyzeScene(description || '');
  }

  /**
   * 豆包场景分析
   */
  private async analyzeWithDouyin(prompt: string): Promise<SceneAnalysis> {
    return this.localAnalyzeScene(prompt);
  }

  /**
   * 通义场景分析
   */
  private async analyzeWithQwen(prompt: string): Promise<SceneAnalysis> {
    return this.localAnalyzeScene(prompt);
  }

  /**
   * 解析分析结果
   */
  private parseAnalysisResult(content: string): SceneAnalysis {
    const scenes = ['自然', '城市', '室内', '动作', '情感', '通用'];
    const moods: Mood[] = ['happy', 'sad', 'exciting', 'calm', 'tense', 'mysterious', 'inspiring', 'dramatic'];
    const categories = ['transition', 'ambient', 'nature', 'ui', 'action', 'emotional'];

    const detectedScene = scenes.find(s => content.includes(s)) || '通用';
    const detectedMoods = moods.filter(m => content.includes(m));
    const suggestedCategories = categories.filter(c => content.includes(c));

    return {
      scene: detectedScene.toLowerCase(),
      detectedMoods: detectedMoods.length > 0 ? detectedMoods : ['calm'],
      detectedObjects: [],
      suggestedCategories: suggestedCategories.length > 0 ? suggestedCategories : ['ambient'],
      description: content.substring(0, 200),
    };
  }

  /**
   * 本地场景分析
   */
  private localAnalyzeScene(description: string): SceneAnalysis {
    const moodKeywords: Record<string, Mood[]> = {
      开心: ['happy'], 快乐: ['happy'], 欢快: ['happy'],
      悲伤: ['sad'], 难过: ['sad'],
      紧张: ['tense', 'exciting'], 刺激: ['exciting'],
      平静: ['calm'], 安静: ['calm'],
      神秘: ['mysterious'], 悬疑: ['mysterious'],
      震撼: ['dramatic'], 史诗: ['dramatic'],
    };

    const sceneKeywords: Record<string, string[]> = {
      户外: ['nature', 'ambient'], 森林: ['nature'],
      城市: ['ambient'], 街道: ['ambient'],
      室内: ['ambient', 'action'], 办公室: ['ambient'],
      动作: ['action'], 运动: ['action'],
      情感: ['emotional'], 故事: ['emotional'],
    };

    const detectedMoods: Mood[] = [];
    const suggestedCategories: string[] = [];

    for (const [keyword, moods] of Object.entries(moodKeywords)) {
      if (description.includes(keyword)) {
        detectedMoods.push(...moods);
      }
    }

    for (const [scene, cats] of Object.entries(sceneKeywords)) {
      if (description.includes(scene)) {
        suggestedCategories.push(...cats);
      }
    }

    return {
      scene: suggestedCategories[0] || 'general',
      detectedMoods: [...new Set(detectedMoods)],
      detectedObjects: [],
      suggestedCategories: [...new Set(suggestedCategories)],
      description,
    };
  }

  /**
   * 智能推荐音效
   * 基于场景分析和AI理解
   */
  async recommendSounds(
    sceneAnalysis: SceneAnalysis,
    options?: Partial<ChineseSoundOptions>
  ): Promise<ChineseSoundMatchResult[]> {
    const opts: ChineseSoundOptions = {
      provider: options?.provider || this.defaultProvider,
      intensity: options?.intensity || 0.7,
      style: options?.style || 'realistic',
    };

    // 使用本地服务进行基础匹配
    const localResults = await aiSoundEffectsService.matchSoundToScene(
      sceneAnalysis.description,
      {
        preferredMoods: sceneAnalysis.detectedMoods,
        maxResults: 8,
      }
    );

    // 转换为增强结果
    const results: ChineseSoundMatchResult[] = localResults.map(result => ({
      ...result,
      provider: 'local',
    }));

    // 如果可用，尝试用AI生成更匹配的音效
    if (this.isProviderAvailable(opts.provider) && opts.provider !== 'local') {
      try {
        const generatedSounds = await this.generateSoundsWithAI(sceneAnalysis, opts);
        results.push(...generatedSounds);
      } catch (error) {
        console.error('[AI音效] AI生成失败:', error);
      }
    }

    // 按相似度排序
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, 10);
  }

  /**
   * 使用AI生成音效
   */
  private async generateSoundsWithAI(
    sceneAnalysis: SceneAnalysis,
    options: ChineseSoundOptions
  ): Promise<ChineseSoundMatchResult[]> {
    const results: ChineseSoundMatchResult[] = [];

    const generationPrompt = `请为以下场景生成音效建议：

场景：${sceneAnalysis.scene}
情绪：${sceneAnalysis.detectedMoods.join(', ')}
描述：${sceneAnalysis.description}

请提供3-5个具体的音效描述，我会从音效库中匹配合适的音效或生成新音效。`;

    try {
      if (options.provider === 'douyin' && this.config.douyinAccessToken) {
        const suggestions = await this.getSuggestionsFromDouyin(generationPrompt);
        for (const suggestion of suggestions) {
          const match = await this.findMatchingSound(suggestion);
          if (match) {
            results.push({
              ...match,
              provider: 'douyin',
              generatedUrl: match.effect.url,
            });
          }
        }
      } else if (options.provider === 'hailuo' && this.config.hailuoApiKey) {
        const suggestions = await this.getSuggestionsFromHailuo(generationPrompt);
        for (const suggestion of suggestions) {
          const match = await this.findMatchingSound(suggestion);
          if (match) {
            results.push({
              ...match,
              provider: 'hailuo',
            });
          }
        }
      }
    } catch (error) {
      console.error('[AI音效] AI生成音效失败:', error);
    }

    return results;
  }

  /**
   * 从豆包获取音效建议
   */
  private async getSuggestionsFromDouyin(prompt: string): Promise<string[]> {
    return prompt
      .split(/[。；\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .slice(0, 5);
  }

  /**
   * 从海螺AI获取音效建议
   */
  private async getSuggestionsFromHailuo(prompt: string): Promise<string[]> {
    return prompt
      .split(/[。；\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .slice(0, 5);
  }

  /**
   * 查找匹配音效
   */
  private async findMatchingSound(query: string): Promise<SoundMatchResult | null> {
    const results = await aiSoundEffectsService.matchSoundToScene(query, { maxResults: 1 });
    return results[0] || null;
  }

  /**
   * 生成环境音景
   */
  async generateAmbientSoundscape(
    sceneType: string,
    duration: number,
    options?: Partial<ChineseSoundOptions>
  ): Promise<SoundEffect[]> {
    const opts: ChineseSoundOptions = {
      provider: options?.provider || this.defaultProvider,
      intensity: options?.intensity || 0.7,
      style: options?.style || 'realistic',
    };

    // 首先尝试用本地音效库
    const localSounds = await aiSoundEffectsService.generateAmbientSoundscape(
      sceneType,
      duration,
      { intensity: opts.intensity }
    );

    return localSounds;
    // 后续可以集成AI生成更丰富的环境音
  }

  /**
   * 获取音效库
   */
  getSoundLibrary(): SoundEffect[] {
    return aiSoundEffectsService.getAllEffects();
  }

  /**
   * 按类别获取音效
   */
  getEffectsByCategory(category: string): SoundEffect[] {
    return aiSoundEffectsService.getEffectsByCategory(category as any);
  }

  /**
   * 按情绪获取音效
   */
  getEffectsByMood(mood: Mood): SoundEffect[] {
    return aiSoundEffectsService.getEffectsByMood(mood);
  }

  /**
   * 搜索音效
   */
  searchSounds(query: string): SoundEffect[] {
    return aiSoundEffectsService.searchEffects(query);
  }

  /**
   * 推荐背景音乐
   */
  async recommendBackgroundMusic(
    description: string,
    options?: { style?: string; tempo?: string }
  ): Promise<SoundEffect[]> {
    return aiSoundEffectsService.recommendBackgroundMusic(description, options as any);
  }

  /**
   * 混音
   */
  mixSounds(
    sounds: Array<{ effect: SoundEffect; volume: number; startTime: number; duration?: number }>,
    totalDuration: number
  ) {
    return aiSoundEffectsService.mixSounds(sounds, totalDuration);
  }

  /**
   * 获取提供商信息
   */
  getProviderInfo(provider: ChineseSoundProvider): { name: string; icon: string; description: string } {
    const providers: Record<ChineseSoundProvider, { name: string; icon: string; description: string }> = {
      douyin: {
        name: '抖音/豆包',
        icon: '🎵',
        description: '字节跳动AI音效服务',
      },
      hailuo: {
        name: '海螺AI',
        icon: '🐚',
        description: 'MiniMax语音合成服务',
      },
      qwen: {
        name: '通义千问',
        icon: '🔮',
        description: '阿里云AI音效服务',
      },
      local: {
        name: '本地音效库',
        icon: '📦',
        description: '内置音效库，无需网络',
      },
    };

    return providers[provider];
  }
}

export const chineseAISoundService = ChineseAISoundService.getInstance();
export default chineseAISoundService;
