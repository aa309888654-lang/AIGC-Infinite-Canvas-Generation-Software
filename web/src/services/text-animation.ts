/**
 * 文字动画系统 - 基于 GSAP 的文字动画效果
 * 提供多种文字动画预设
 */

import gsap from 'gsap';

export interface TextAnimationPreset {
  id: string;
  name: string;
  category: 'entrance' | 'emphasis' | 'exit' | 'continuous';
  description?: string;
  duration: number;
  easing: string;
}

export interface TextAnimationOptions {
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  onLog?: (message: string) => void;
  stagger?: number; // 字符间隔时间
  loop?: boolean;
}

class TextAnimationEngine {
  private isInitialized = false;
  private activeAnimations: Map<string, gsap.core.Timeline> = new Map();

  /**
   * 初始化文字动画引擎
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // console.log('[TextAnimation] 初始化文字动画引擎...');
      this.isInitialized = true;
      // console.log('[TextAnimation] 文字动画引擎初始化完成');
    } catch (error) {
      console.error('[TextAnimation] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 应用文字动画
   */
  async applyAnimation(
    element: HTMLElement,
    preset: TextAnimationPreset,
    options?: TextAnimationOptions
  ): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      try {
        options?.onLog?.(`应用文字动画: ${preset.name}...`);

        // 分割文字为字符
        const text = element.textContent || '';
        element.innerHTML = '';
        
        const chars = text.split('').map((char) => {
          const span = document.createElement('span');
          span.textContent = char === ' ' ? '\u00A0' : char;
          span.style.display = 'inline-block';
          element.appendChild(span);
          return span;
        });

        // 创建动画时间轴
        const timeline = gsap.timeline({
          repeat: options?.loop ? -1 : 0,
          onUpdate: () => {
            const progress = (timeline.progress() * 100);
            options?.onProgress?.(progress);
          },
          onComplete: () => {
            options?.onComplete?.();
            options?.onLog?.('文字动画完成');
            resolve();
          },
        });

        // 应用动画
        this.createTextAnimation(timeline, chars, preset, options);

        // 保存动画引用
        const animId = `anim-${Date.now()}`;
        this.activeAnimations.set(animId, timeline);

      } catch (error) {
        options?.onLog?.(`文字动画失败: ${error}`);
        reject(error);
      }
    });
  }

  /**
   * 创建文字动画
   */
  private createTextAnimation(
    timeline: gsap.core.Timeline,
    chars: HTMLElement[],
    preset: TextAnimationPreset,
    options?: TextAnimationOptions
  ): void {
    const duration = preset.duration;
    const ease = preset.easing;
    const stagger = options?.stagger || 0.05;

    switch (preset.id) {
      // 入场动画
      case 'fade-in':
        timeline.from(chars, {
          opacity: 0,
          duration,
          ease,
          stagger,
        });
        break;

      case 'slide-in-left':
        timeline.from(chars, {
          x: -50,
          opacity: 0,
          duration,
          ease,
          stagger,
        });
        break;

      case 'slide-in-right':
        timeline.from(chars, {
          x: 50,
          opacity: 0,
          duration,
          ease,
          stagger,
        });
        break;

      case 'slide-in-up':
        timeline.from(chars, {
          y: 50,
          opacity: 0,
          duration,
          ease,
          stagger,
        });
        break;

      case 'slide-in-down':
        timeline.from(chars, {
          y: -50,
          opacity: 0,
          duration,
          ease,
          stagger,
        });
        break;

      case 'bounce-in':
        timeline.from(chars, {
          scale: 0,
          opacity: 0,
          duration,
          ease: 'bounce.out',
          stagger,
        });
        break;

      case 'rotate-in':
        timeline.from(chars, {
          rotation: 180,
          opacity: 0,
          duration,
          ease,
          stagger,
        });
        break;

      case 'typewriter':
        timeline.from(chars, {
          opacity: 0,
          duration: 0.1,
          ease: 'none',
          stagger: 0.1,
        });
        break;

      // 强调动画
      case 'pulse':
        timeline.to(chars, {
          scale: 1.2,
          duration: duration / 2,
          ease: 'power2.out',
          stagger,
        }).to(chars, {
          scale: 1,
          duration: duration / 2,
          ease: 'power2.in',
          stagger,
        });
        break;

      case 'shake':
        timeline.to(chars, {
          x: -5,
          duration: 0.1,
          repeat: 5,
          yoyo: true,
          ease: 'power1.inOut',
          stagger,
        });
        break;

      case 'bounce':
        timeline.to(chars, {
          y: -20,
          duration: duration / 2,
          ease: 'power2.out',
          stagger,
        }).to(chars, {
          y: 0,
          duration: duration / 2,
          ease: 'bounce.out',
          stagger,
        });
        break;

      case 'wave':
        timeline.to(chars, {
          y: -15,
          duration: 0.3,
          ease: 'power1.inOut',
          stagger: 0.05,
          repeat: 1,
          yoyo: true,
        });
        break;

      case 'glitch':
        timeline
          .to(chars, {
            x: () => Math.random() * 10 - 5,
            y: () => Math.random() * 10 - 5,
            duration: 0.05,
            repeat: 10,
            ease: 'none',
            stagger: 0.02,
          })
          .to(chars, {
            x: 0,
            y: 0,
            duration: 0.1,
          });
        break;

      // 退出动画
      case 'fade-out':
        timeline.to(chars, {
          opacity: 0,
          duration,
          ease,
          stagger,
        });
        break;

      case 'slide-out-left':
        timeline.to(chars, {
          x: -50,
          opacity: 0,
          duration,
          ease,
          stagger,
        });
        break;

      case 'slide-out-right':
        timeline.to(chars, {
          x: 50,
          opacity: 0,
          duration,
          ease,
          stagger,
        });
        break;

      case 'zoom-out':
        timeline.to(chars, {
          scale: 0,
          opacity: 0,
          duration,
          ease,
          stagger,
        });
        break;

      // 持续动画
      case 'neon':
        timeline.to(chars, {
          textShadow: '0 0 10px #fff, 0 0 20px #fff, 0 0 30px #10B981, 0 0 40px #10B981',
          duration: 0.5,
          ease: 'power1.inOut',
          repeat: -1,
          yoyo: true,
          stagger: 0.1,
        });
        break;

      case 'rainbow':
        timeline.to(chars, {
          color: 'hsl(+=360, 70%, 60%)',
          duration: 2,
          ease: 'none',
          repeat: -1,
          stagger: 0.1,
        });
        break;

      case 'float':
        timeline.to(chars, {
          y: -10,
          duration: 1,
          ease: 'power1.inOut',
          repeat: -1,
          yoyo: true,
          stagger: 0.1,
        });
        break;

      default:
        timeline.from(chars, {
          opacity: 0,
          duration,
          ease,
          stagger,
        });
    }
  }

  /**
   * 获取所有文字动画预设
   */
  getPresets(): TextAnimationPreset[] {
    return [
      // 入场动画
      {
        id: 'fade-in',
        name: '淡入',
        category: 'entrance',
        description: '逐字淡入',
        duration: 1.0,
        easing: 'power2.out',
      },
      {
        id: 'slide-in-left',
        name: '从左滑入',
        category: 'entrance',
        description: '从左侧滑入',
        duration: 0.8,
        easing: 'power2.out',
      },
      {
        id: 'slide-in-right',
        name: '从右滑入',
        category: 'entrance',
        description: '从右侧滑入',
        duration: 0.8,
        easing: 'power2.out',
      },
      {
        id: 'slide-in-up',
        name: '从下滑入',
        category: 'entrance',
        description: '从下方滑入',
        duration: 0.8,
        easing: 'power2.out',
      },
      {
        id: 'slide-in-down',
        name: '从上滑入',
        category: 'entrance',
        description: '从上方滑入',
        duration: 0.8,
        easing: 'power2.out',
      },
      {
        id: 'bounce-in',
        name: '弹跳进入',
        category: 'entrance',
        description: '弹跳效果进入',
        duration: 1.0,
        easing: 'bounce.out',
      },
      {
        id: 'rotate-in',
        name: '旋转进入',
        category: 'entrance',
        description: '旋转淡入',
        duration: 1.0,
        easing: 'power2.out',
      },
      {
        id: 'typewriter',
        name: '打字机',
        category: 'entrance',
        description: '打字机效果',
        duration: 2.0,
        easing: 'none',
      },

      // 强调动画
      {
        id: 'pulse',
        name: '脉冲',
        category: 'emphasis',
        description: '脉冲放大效果',
        duration: 0.6,
        easing: 'power2.inOut',
      },
      {
        id: 'shake',
        name: '抖动',
        category: 'emphasis',
        description: '左右抖动',
        duration: 0.5,
        easing: 'power1.inOut',
      },
      {
        id: 'bounce',
        name: '弹跳',
        category: 'emphasis',
        description: '上下弹跳',
        duration: 0.8,
        easing: 'power2.out',
      },
      {
        id: 'wave',
        name: '波浪',
        category: 'emphasis',
        description: '波浪起伏',
        duration: 1.0,
        easing: 'power1.inOut',
      },
      {
        id: 'glitch',
        name: '故障',
        category: 'emphasis',
        description: '故障效果',
        duration: 0.5,
        easing: 'none',
      },

      // 退出动画
      {
        id: 'fade-out',
        name: '淡出',
        category: 'exit',
        description: '逐字淡出',
        duration: 1.0,
        easing: 'power2.in',
      },
      {
        id: 'slide-out-left',
        name: '向左滑出',
        category: 'exit',
        description: '向左侧滑出',
        duration: 0.8,
        easing: 'power2.in',
      },
      {
        id: 'slide-out-right',
        name: '向右滑出',
        category: 'exit',
        description: '向右侧滑出',
        duration: 0.8,
        easing: 'power2.in',
      },
      {
        id: 'zoom-out',
        name: '缩小退出',
        category: 'exit',
        description: '缩小消失',
        duration: 0.8,
        easing: 'power2.in',
      },

      // 持续动画
      {
        id: 'neon',
        name: '霓虹灯',
        category: 'continuous',
        description: '霓虹灯闪烁',
        duration: 1.0,
        easing: 'power1.inOut',
      },
      {
        id: 'rainbow',
        name: '彩虹',
        category: 'continuous',
        description: '彩虹色彩变化',
        duration: 2.0,
        easing: 'none',
      },
      {
        id: 'float',
        name: '漂浮',
        category: 'continuous',
        description: '上下漂浮',
        duration: 2.0,
        easing: 'power1.inOut',
      },
    ];
  }

  /**
   * 按类别获取动画
   */
  getPresetsByCategory(category: TextAnimationPreset['category']): TextAnimationPreset[] {
    return this.getPresets().filter((preset) => preset.category === category);
  }

  /**
   * 搜索动画
   */
  searchPresets(query: string): TextAnimationPreset[] {
    const lowerQuery = query.toLowerCase();
    return this.getPresets().filter(
      (preset) =>
        preset.name.toLowerCase().includes(lowerQuery) ||
        preset.description?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 停止所有动画
   */
  stopAllAnimations(): void {
    this.activeAnimations.forEach((timeline) => {
      timeline.kill();
    });
    this.activeAnimations.clear();
  }

  /**
   * 停止特定动画
   */
  stopAnimation(animId: string): void {
    const timeline = this.activeAnimations.get(animId);
    if (timeline) {
      timeline.kill();
      this.activeAnimations.delete(animId);
    }
  }

  /**
   * 创建自定义文字动画
   */
  createCustomAnimation(
    name: string,
    duration: number,
    easing: string = 'power2.inOut'
  ): TextAnimationPreset {
    return {
      id: `custom-${Date.now()}`,
      name,
      category: 'entrance',
      description: '自定义动画',
      duration,
      easing,
    };
  }
}

// 导出单例
export const textAnimationEngine = new TextAnimationEngine();
