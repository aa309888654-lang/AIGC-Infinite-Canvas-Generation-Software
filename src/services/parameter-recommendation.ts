/**
 * 参数智能推荐服务
 * 根据用户需求智能推荐最佳参数配置
 */

export interface ParameterRecommendation {
  nodeType: string;
  parameters: Record<string, unknown>;
  reason: string;
  confidence: number;
}

export interface StyleAnalysis {
  style: string;
  mood: string;
  colors: string[];
  elements: string[];
}

const STYLE_PRESETS: Record<string, Partial<ParameterRecommendation>> = {
  写真: {
    parameters: {
      quality: 'hd',
      style: 'photorealistic',
      cfgScale: 7.5,
      steps: 30,
    },
    reason: '写真风格推荐使用高清质量和写实风格',
  },
  动漫: {
    parameters: {
      quality: 'hd',
      style: 'anime',
      cfgScale: 7,
      steps: 25,
    },
    reason: '动漫风格推荐使用anime预设',
  },
  电影感: {
    parameters: {
      quality: 'hd',
      style: 'cinematic',
      cfgScale: 8,
      steps: 35,
      cameraControl: 'dolly',
      cameraIntensity: 60,
    },
    reason: '电影感推荐较高CFG和镜头运动',
  },
  赛博朋克: {
    parameters: {
      quality: 'hd',
      style: 'cyberpunk',
      cfgScale: 8.5,
      steps: 35,
      colorGrade: 'high-contrast',
    },
    reason: '赛博朋克风格推荐高对比度配色',
  },
  水彩: {
    parameters: {
      quality: 'standard',
      style: 'watercolor',
      cfgScale: 6.5,
      steps: 20,
    },
    reason: '水彩风格使用较柔和的参数',
  },
  油画: {
    parameters: {
      quality: 'hd',
      style: 'oil-painting',
      cfgScale: 7,
      steps: 30,
    },
    reason: '油画风格推荐较高步数以增强纹理',
  },
  唯美: {
    parameters: {
      quality: 'hd',
      style: 'ethereal',
      cfgScale: 7,
      steps: 25,
      colorGrade: 'soft',
    },
    reason: '唯美风格推荐柔和色调',
  },
  复古: {
    parameters: {
      quality: 'standard',
      style: 'vintage',
      cfgScale: 6.5,
      steps: 25,
      colorGrade: 'warm',
    },
    reason: '复古风格推荐暖色调',
  },
};

const _ASPECT_RATIOS: Record<string, { width: number; height: number; ratio: string }> = {
  横版: { width: 1920, height: 1080, ratio: '16:9' },
  竖版: { width: 1080, height: 1920, ratio: '9:16' },
  方形: { width: 1024, height: 1024, ratio: '1:1' },
  横屏: { width: 1920, height: 1080, ratio: '16:9' },
  竖屏: { width: 1080, height: 1920, ratio: '9:16' },
};

const _DURATION_PRESETS: Record<string, number> = {
  短: 3,
  中: 5,
  长: 10,
  短视频: 5,
  长视频: 10,
};

export class ParameterRecommendationService {
  private static instance: ParameterRecommendationService;

  private constructor() {
    /* noop */
  }

  public static getInstance(): ParameterRecommendationService {
    if (!ParameterRecommendationService.instance) {
      ParameterRecommendationService.instance = new ParameterRecommendationService();
    }
    return ParameterRecommendationService.instance;
  }

  public analyzeContent(content: string): StyleAnalysis {
    const lowerContent = content.toLowerCase();
    const style = this.detectStyle(lowerContent);
    const mood = this.detectMood(lowerContent);
    const colors = this.detectColors(lowerContent);
    const elements = this.detectElements(lowerContent);

    return { style, mood, colors, elements };
  }

  private detectStyle(content: string): string {
    const styleKeywords: Record<string, string[]> = {
      写真: ['写真', '照片', '写实', '真实', '人物', '肖像'],
      动漫: ['动漫', '二次元', '卡通', 'anime', '动画'],
      电影感: ['电影', ' cinematic', '大片', '好莱坞'],
      赛博朋克: ['赛博', 'cyber', '未来', '科技', '霓虹'],
      水彩: ['水彩', 'watercolor', '手绘'],
      油画: ['油画', 'oil painting', '艺术'],
      唯美: ['唯美', '梦幻', '仙气', 'beautiful'],
      复古: ['复古', 'vintage', '怀旧', '老电影'],
    };

    for (const [style, keywords] of Object.entries(styleKeywords)) {
      if (keywords.some((keyword) => content.includes(keyword))) {
        return style;
      }
    }
    return '通用';
  }

  private detectMood(content: string): string {
    const moodKeywords: Record<string, string[]> = {
      欢快: ['欢快', '快乐', '开心', '活泼', '轻松'],
      浪漫: ['浪漫', '温馨', '爱情', '亲密'],
      神秘: ['神秘', '诡异', '悬疑', '黑暗'],
      震撼: ['震撼', '壮观', '宏大', '史诗'],
      平静: ['平静', '宁静', '安详', '放松'],
    };

    for (const [mood, keywords] of Object.entries(moodKeywords)) {
      if (keywords.some((keyword) => content.includes(keyword))) {
        return mood;
      }
    }
    return '中性';
  }

  private detectColors(content: string): string[] {
    const colorKeywords: Record<string, string[]> = {
      暖色: ['暖', '橙', '黄', '夕阳', '金色'],
      冷色: ['冷', '蓝', '青', '冰', '冬'],
      高饱和: ['鲜艳', '明亮', '饱和', '强烈'],
      低饱和: ['柔和', '淡雅', '灰调', '莫兰迪'],
      黑白: ['黑白', '单色', '灰度'],
    };

    const detected: string[] = [];
    for (const [color, keywords] of Object.entries(colorKeywords)) {
      if (keywords.some((keyword) => content.includes(keyword))) {
        detected.push(color);
      }
    }
    return detected;
  }

  private detectElements(content: string): string[] {
    const elementKeywords: Record<string, string[]> = {
      人物: ['人', '人物', '女孩', '男孩', '男人', '女人', '模特'],
      风景: ['风景', '自然', '山', '海', '森林', '天空'],
      建筑: ['建筑', '城市', '街道', '房屋', '高楼'],
      食物: ['食物', '美食', '蛋糕', '饮料'],
      动物: ['动物', '猫', '狗', '鸟', '动物'],
    };

    const detected: string[] = [];
    for (const [element, keywords] of Object.entries(elementKeywords)) {
      if (keywords.some((keyword) => content.includes(keyword))) {
        detected.push(element);
      }
    }
    return detected;
  }

  public getRecommendation(
    content: string,
    nodeType: 'image' | 'video' | 'audio' = 'image'
  ): ParameterRecommendation {
    const analysis = this.analyzeContent(content);
    const stylePreset = STYLE_PRESETS[analysis.style] || {};

    const baseParams =
      nodeType === 'video'
        ? {
            modelProvider: 'doubao',
            generationMode: 'text_to_video',
            fps: 30,
            motionStrength: 50,
            cfgScale: 7,
            steps: 30,
          }
        : nodeType === 'audio'
          ? {
              mode: 'tts',
              model: 'speech-2.8-hd',
              voiceSetting: {
                voiceId: 'female-tianmei',
                speed: 1.0,
                vol: 1.0,
                pitch: 0,
                emotion: '',
              },
            }
          : {
              modelProvider: 'doubao-image',
              generationMode: 'text_to_image',
              cfgScale: 7.5,
              steps: 30,
              seed: -1,
            };

    const recommendedParams = {
      ...baseParams,
      ...stylePreset.parameters,
      stylePreset: analysis.style,
      mood: analysis.mood,
      colorHints: analysis.colors,
    };

    const confidence = this.calculateConfidence(analysis);

    return {
      nodeType: nodeType === 'video' ? 'videoGen' : nodeType === 'audio' ? 'audioGen' : 'aiImage',
      parameters: recommendedParams,
      reason: this.generateReason(analysis, stylePreset.reason),
      confidence,
    };
  }

  private calculateConfidence(analysis: StyleAnalysis): number {
    let score = 0.5;
    if (analysis.style !== '通用') score += 0.2;
    if (analysis.mood !== '中性') score += 0.1;
    if (analysis.colors.length > 0) score += 0.1;
    if (analysis.elements.length > 0) score += 0.1;
    return Math.min(score, 1);
  }

  private generateReason(analysis: StyleAnalysis, presetReason: string): string {
    const parts = [presetReason];
    if (analysis.mood !== '中性') {
      parts.push(`${analysis.mood}氛围增强`);
    }
    if (analysis.colors.length > 0) {
      parts.push(`建议色调: ${analysis.colors.join(', ')}`);
    }
    return parts.join('，');
  }

  public getQuickRecommendations(): { label: string; command: string; description: string }[] {
    return [
      {
        label: '🎬 电影感',
        command: '/推荐 电影感视频',
        description: '推荐电影级参数',
      },
      {
        label: '🎨 动漫风格',
        command: '/推荐 动漫图片',
        description: '推荐动漫参数',
      },
      {
        label: '📸 写真照片',
        command: '/推荐 写真',
        description: '推荐写真参数',
      },
      {
        label: '🌟 唯美梦幻',
        command: '/推荐 唯美',
        description: '推荐唯美参数',
      },
      {
        label: '🔧 自定义',
        command: '/参数 详细描述你的需求',
        description: 'AI智能分析',
      },
    ];
  }
}

export const parameterRecommendation = ParameterRecommendationService.getInstance();
