/**
 * 智能转场推荐服务
 * 根据视频内容和场景推荐最佳转场效果
 */

export interface TransitionPreset {
  id: string;
  name: string;
  category: 'basic' | 'creative' | 'professional';
  duration: number;
  icon?: string;
  parameters?: Record<string, unknown>;
}

export interface TransitionRecommendation {
  transition: TransitionPreset;
  score: number;
  reason: string;
  suitableFor: string[];
}

class SmartTransitionService {
  private static instance: SmartTransitionService;

  private constructor() { /* noop */ }

  public static getInstance(): SmartTransitionService {
    if (!SmartTransitionService.instance) {
      SmartTransitionService.instance = new SmartTransitionService();
    }
    return SmartTransitionService.instance;
  }

  /**
   * 获取所有转场预设
   */
  getAllTransitions(): TransitionPreset[] {
    return [
      // 基础转场
      {
        id: 'cut',
        name: '直接切换',
        category: 'basic',
        duration: 0,
      },
      {
        id: 'dissolve',
        name: '淡入淡出',
        category: 'basic',
        duration: 1.0,
        parameters: { opacity: 1.0 },
      },
      {
        id: 'fade-to-black',
        name: '渐黑',
        category: 'basic',
        duration: 1.5,
        parameters: { color: '#000000' },
      },
      {
        id: 'fade-to-white',
        name: '渐白',
        category: 'basic',
        duration: 1.5,
        parameters: { color: '#FFFFFF' },
      },

      // 创意转场
      {
        id: 'wipe-left',
        name: '左擦除',
        category: 'creative',
        duration: 0.8,
        parameters: { direction: 'left' },
      },
      {
        id: 'wipe-right',
        name: '右擦除',
        category: 'creative',
        duration: 0.8,
        parameters: { direction: 'right' },
      },
      {
        id: 'wipe-up',
        name: '上擦除',
        category: 'creative',
        duration: 0.8,
        parameters: { direction: 'up' },
      },
      {
        id: 'wipe-down',
        name: '下擦除',
        category: 'creative',
        duration: 0.8,
        parameters: { direction: 'down' },
      },
      {
        id: 'zoom-in',
        name: '放大转场',
        category: 'creative',
        duration: 0.6,
        parameters: { scale: 2.0 },
      },
      {
        id: 'zoom-out',
        name: '缩小转场',
        category: 'creative',
        duration: 0.6,
        parameters: { scale: 0.5 },
      },
      {
        id: 'blur',
        name: '模糊转场',
        category: 'creative',
        duration: 0.8,
        parameters: { blur: 10 },
      },
      {
        id: 'pixelate',
        name: '像素化转场',
        category: 'creative',
        duration: 0.8,
        parameters: { pixelSize: 20 },
      },

      // 专业转场
      {
        id: 'cross-dissolve',
        name: '交叉溶解',
        category: 'professional',
        duration: 1.2,
      },
      {
        id: 'dip-to-white',
        name: '闪白',
        category: 'professional',
        duration: 0.5,
      },
      {
        id: 'dip-to-black',
        name: '闪黑',
        category: 'professional',
        duration: 0.5,
      },
      {
        id: 'push-left',
        name: '左推出',
        category: 'professional',
        duration: 0.8,
        parameters: { direction: 'left' },
      },
      {
        id: 'push-right',
        name: '右推出',
        category: 'professional',
        duration: 0.8,
        parameters: { direction: 'right' },
      },
    ];
  }

  /**
   * 根据内容类型推荐转场
   */
  recommendTransitions(
    contentType: 'narrative' | 'vlog' | 'tutorial' | 'music' | 'commercial' | 'documentary'
  ): TransitionRecommendation[] {
    const allTransitions = this.getAllTransitions();
    
    const recommendations: TransitionRecommendation[] = allTransitions.map(transition => {
      let score = 0.5;
      let reason = '';
      const suitableFor: string[] = [];

      switch (contentType) {
        case 'narrative':
          // 叙事类：适合平滑、专业的转场
          if (['cross-dissolve', 'dissolve', 'fade-to-black'].includes(transition.id)) {
            score = 0.95;
            reason = '平滑自然，适合叙事节奏';
            suitableFor.push('故事情节');
          } else if (['dip-to-white', 'dip-to-black'].includes(transition.id)) {
            score = 0.7;
            reason = '可用于强调高潮或转折';
            suitableFor.push('强调');
          }
          break;

        case 'vlog':
          // Vlog：适合快速、有趣的转场
          if (['cut', 'wipe-left', 'wipe-right', 'zoom-in', 'zoom-out'].includes(transition.id)) {
            score = 0.9;
            reason = '节奏明快，适合vlog风格';
            suitableFor.push('日常生活');
          } else if (['blur', 'dissolve'].includes(transition.id)) {
            score = 0.7;
            reason = '可用于回忆或情绪表达';
            suitableFor.push('情绪转换');
          }
          break;

        case 'tutorial':
          // 教程类：简单直接的转场
          if (['cut', 'wipe-left', 'wipe-right'].includes(transition.id)) {
            score = 0.95;
            reason = '清晰不干扰，便于理解';
            suitableFor.push('教学演示');
          } else if (['dissolve'].includes(transition.id)) {
            score = 0.6;
            reason = '可用于章节分隔';
            suitableFor.push('章节过渡');
          }
          break;

        case 'music':
          // 音乐类：与节奏同步的转场
          if (['cut', 'zoom-in', 'zoom-out', 'blur'].includes(transition.id)) {
            score = 0.9;
            reason = '节奏感强，适合音乐节拍';
            suitableFor.push('节奏配合');
          } else if (['dissolve', 'cross-dissolve'].includes(transition.id)) {
            score = 0.75;
            reason = '柔和过渡，用于副歌部分';
            suitableFor.push('情绪递进');
          }
          break;

        case 'commercial':
          // 商业类：专业、高质量的转场
          if (['cross-dissolve', 'push-left', 'push-right', 'dip-to-white'].includes(transition.id)) {
            score = 0.95;
            reason = '专业大气，适合品牌展示';
            suitableFor.push('品牌形象');
          } else if (['zoom-in', 'zoom-out'].includes(transition.id)) {
            score = 0.7;
            reason = '动感强，吸引注意力';
            suitableFor.push('产品特写');
          }
          break;

        case 'documentary':
          // 纪录片：庄重、叙事性强
          if (['cross-dissolve', 'fade-to-black', 'dissolve'].includes(transition.id)) {
            score = 0.95;
            reason = '庄重沉稳，适合纪实风格';
            suitableFor.push('叙事节奏');
          } else if (['fade-to-white'].includes(transition.id)) {
            score = 0.8;
            reason = '可用于时间跳跃';
            suitableFor.push('时间跳跃');
          }
          break;
      }

      return {
        transition,
        score,
        reason,
        suitableFor,
      };
    });

    // 按分数排序，返回前5个推荐
    return recommendations
      .filter(r => r.score > 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  /**
   * 根据场景特征推荐转场
   */
  recommendBySceneChange(
    previousScene: 'indoor' | 'outdoor' | 'person' | 'object' | 'text' | 'action' | 'static',
    nextScene: 'indoor' | 'outdoor' | 'person' | 'object' | 'text' | 'action' | 'static'
  ): TransitionRecommendation[] {
    const allTransitions = this.getAllTransitions();
    
    const recommendations: TransitionRecommendation[] = allTransitions.map(transition => {
      let score = 0.5;
      let reason = '';

      // 室内场景切换
      if ((previousScene === 'indoor' || nextScene === 'indoor') && 
          (previousScene !== nextScene)) {
        if (['dissolve', 'cross-dissolve', 'fade-to-black'].includes(transition.id)) {
          score = 0.85;
          reason = '平滑过渡室内场景';
        }
      }

      // 户外场景切换
      if ((previousScene === 'outdoor' || nextScene === 'outdoor') && 
          (previousScene !== nextScene)) {
        if (['dissolve', 'wipe-left', 'wipe-right'].includes(transition.id)) {
          score = 0.85;
          reason = '展示不同地点的自然过渡';
        }
      }

      // 人物切换
      if (previousScene === 'person' && nextScene === 'person') {
        if (['cut', 'dissolve'].includes(transition.id)) {
          score = 0.9;
          reason = '人物对话或反应的理想选择';
        } else if (['dip-to-black', 'dip-to-white'].includes(transition.id)) {
          score = 0.7;
          reason = '可用于对话中的思考或反应';
        }
      }

      // 动作场景切换
      if (previousScene === 'action' || nextScene === 'action') {
        if (['cut'].includes(transition.id)) {
          score = 0.95;
          reason = '保持动作连贯性';
        } else if (['zoom-in', 'zoom-out'].includes(transition.id)) {
          score = 0.6;
          reason = '可用于动作的节奏变化';
        }
      }

      // 文字切换
      if (previousScene === 'text' || nextScene === 'text') {
        if (['wipe-left', 'wipe-right', 'wipe-up', 'wipe-down'].includes(transition.id)) {
          score = 0.95;
          reason = '文字动画的理想选择';
        }
      }

      // 静止画面切换
      if (previousScene === 'static' && nextScene === 'static') {
        if (['dissolve', 'cross-dissolve'].includes(transition.id)) {
          score = 0.9;
          reason = '优雅展示静态内容';
        } else if (['zoom-in', 'zoom-out'].includes(transition.id)) {
          score = 0.75;
          reason = '增加静态画面的动感';
        }
      }

      return {
        transition,
        score,
        reason,
        suitableFor: [],
      };
    });

    return recommendations
      .filter(r => r.score > 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  /**
   * 获取转场类别的中文名称
   */
  getCategoryName(category: string): string {
    const names: Record<string, string> = {
      basic: '基础转场',
      creative: '创意转场',
      professional: '专业转场',
    };
    return names[category] || category;
  }

  /**
   * 获取转场的CSS动画
   */
  getTransitionCSS(transitionId: string): string {
    const animations: Record<string, string> = {
      dissolve: 'opacity 0→1 1s ease-in-out',
      'fade-to-black': 'opacity 1→0 black 1.5s ease-in-out',
      'fade-to-white': 'opacity 1→0 white 1.5s ease-in-out',
      'wipe-left': 'transform translateX(100%→0) 0.8s ease-out',
      'wipe-right': 'transform translateX(-100%→0) 0.8s ease-out',
      'zoom-in': 'transform scale(1→2) 0.6s ease-out',
      'zoom-out': 'transform scale(1→0.5) 0.6s ease-out',
      blur: 'filter blur(0→10px→0) 0.8s ease-in-out',
    };
    return animations[transitionId] || 'opacity 0→1 1s ease-in-out';
  }
}

export const smartTransitionService = SmartTransitionService.getInstance();
export default smartTransitionService;
