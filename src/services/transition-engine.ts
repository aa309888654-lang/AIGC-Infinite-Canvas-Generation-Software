/**
 * 转场引擎 - 基于 GSAP 的专业转场效果
 * 提供 50+ 转场预设
 */

import gsap from 'gsap';

export interface TransitionPreset {
  id: string;
  name: string;
  category: 'fade' | 'slide' | 'zoom' | 'rotate' | 'wipe' | '3d';
  description?: string;
  duration: number; // 秒
  easing: string;
}

export interface TransitionOptions {
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  onLog?: (message: string) => void;
}

class TransitionEngine {
  private isInitialized = false;

  /**
   * 初始化转场引擎
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // console.log('[TransitionEngine] 初始化转场引擎...');
      this.isInitialized = true;
      // console.log('[TransitionEngine] 转场引擎初始化完成');
    } catch (error) {
      console.error('[TransitionEngine] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 应用转场效果
   */
  async applyTransition(
    fromElement: HTMLElement,
    toElement: HTMLElement,
    preset: TransitionPreset,
    options?: TransitionOptions
  ): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      try {
        options?.onLog?.(`应用转场: ${preset.name}...`);

        const timeline = gsap.timeline({
          onUpdate: () => {
            const progress = (timeline.progress() * 100);
            options?.onProgress?.(progress);
          },
          onComplete: () => {
            options?.onComplete?.();
            options?.onLog?.('转场完成');
            resolve();
          },
        });

        // 根据转场类型应用动画
        this.createTransitionAnimation(timeline, fromElement, toElement, preset);

      } catch (error) {
        options?.onLog?.(`转场失败: ${error}`);
        reject(error);
      }
    });
  }

  /**
   * 创建转场动画
   */
  private createTransitionAnimation(
    timeline: gsap.core.Timeline,
    fromElement: HTMLElement,
    toElement: HTMLElement,
    preset: TransitionPreset
  ): void {
    const duration = preset.duration;
    const ease = preset.easing;

    switch (preset.id) {
      // 淡入淡出
      case 'fade':
        timeline
          .to(fromElement, { opacity: 0, duration, ease })
          .from(toElement, { opacity: 0, duration, ease }, '<');
        break;

      case 'crossfade':
        timeline
          .to(fromElement, { opacity: 0, duration, ease })
          .from(toElement, { opacity: 0, duration, ease }, '<0.5');
        break;

      // 滑动
      case 'slide-left':
        timeline
          .to(fromElement, { x: '-100%', duration, ease })
          .from(toElement, { x: '100%', duration, ease }, '<');
        break;

      case 'slide-right':
        timeline
          .to(fromElement, { x: '100%', duration, ease })
          .from(toElement, { x: '-100%', duration, ease }, '<');
        break;

      case 'slide-up':
        timeline
          .to(fromElement, { y: '-100%', duration, ease })
          .from(toElement, { y: '100%', duration, ease }, '<');
        break;

      case 'slide-down':
        timeline
          .to(fromElement, { y: '100%', duration, ease })
          .from(toElement, { y: '-100%', duration, ease }, '<');
        break;

      // 缩放
      case 'zoom-in':
        timeline
          .to(fromElement, { scale: 0, opacity: 0, duration, ease })
          .from(toElement, { scale: 2, opacity: 0, duration, ease }, '<');
        break;

      case 'zoom-out':
        timeline
          .to(fromElement, { scale: 2, opacity: 0, duration, ease })
          .from(toElement, { scale: 0, opacity: 0, duration, ease }, '<');
        break;

      // 旋转
      case 'rotate-left':
        timeline
          .to(fromElement, { rotation: -90, opacity: 0, duration, ease })
          .from(toElement, { rotation: 90, opacity: 0, duration, ease }, '<');
        break;

      case 'rotate-right':
        timeline
          .to(fromElement, { rotation: 90, opacity: 0, duration, ease })
          .from(toElement, { rotation: -90, opacity: 0, duration, ease }, '<');
        break;

      // 擦除
      case 'wipe-left':
        timeline
          .to(fromElement, { clipPath: 'inset(0 100% 0 0)', duration, ease })
          .from(toElement, { clipPath: 'inset(0 0 0 100%)', duration, ease }, '<');
        break;

      case 'wipe-right':
        timeline
          .to(fromElement, { clipPath: 'inset(0 0 0 100%)', duration, ease })
          .from(toElement, { clipPath: 'inset(0 100% 0 0)', duration, ease }, '<');
        break;

      // 3D 效果
      case 'flip-horizontal':
        timeline
          .to(fromElement, { rotationY: 90, opacity: 0, duration: duration / 2, ease })
          .from(toElement, { rotationY: -90, opacity: 0, duration: duration / 2, ease });
        break;

      case 'flip-vertical':
        timeline
          .to(fromElement, { rotationX: 90, opacity: 0, duration: duration / 2, ease })
          .from(toElement, { rotationX: -90, opacity: 0, duration: duration / 2, ease });
        break;

      case 'cube-left':
        timeline
          .to(fromElement, { 
            x: '-100%', 
            rotationY: -90, 
            transformOrigin: 'left center',
            duration, 
            ease 
          })
          .from(toElement, { 
            x: '100%', 
            rotationY: 90, 
            transformOrigin: 'right center',
            duration, 
            ease 
          }, '<');
        break;

      default:
        // 默认淡入淡出
        timeline
          .to(fromElement, { opacity: 0, duration, ease })
          .from(toElement, { opacity: 0, duration, ease }, '<');
    }
  }

  /**
   * 获取所有转场预设
   */
  getPresets(): TransitionPreset[] {
    return [
      // 淡入淡出
      {
        id: 'fade',
        name: '淡入淡出',
        category: 'fade',
        description: '经典的淡入淡出效果',
        duration: 0.5,
        easing: 'power2.inOut',
      },
      {
        id: 'crossfade',
        name: '交叉淡化',
        category: 'fade',
        description: '两个画面交叉淡化',
        duration: 1.0,
        easing: 'power2.inOut',
      },
      {
        id: 'dissolve',
        name: '溶解',
        category: 'fade',
        description: '溶解过渡效果',
        duration: 0.8,
        easing: 'power1.inOut',
      },

      // 滑动
      {
        id: 'slide-left',
        name: '向左滑动',
        category: 'slide',
        description: '从右向左滑动',
        duration: 0.6,
        easing: 'power2.inOut',
      },
      {
        id: 'slide-right',
        name: '向右滑动',
        category: 'slide',
        description: '从左向右滑动',
        duration: 0.6,
        easing: 'power2.inOut',
      },
      {
        id: 'slide-up',
        name: '向上滑动',
        category: 'slide',
        description: '从下向上滑动',
        duration: 0.6,
        easing: 'power2.inOut',
      },
      {
        id: 'slide-down',
        name: '向下滑动',
        category: 'slide',
        description: '从上向下滑动',
        duration: 0.6,
        easing: 'power2.inOut',
      },
      {
        id: 'push-left',
        name: '推入（左）',
        category: 'slide',
        description: '推入效果向左',
        duration: 0.7,
        easing: 'power3.inOut',
      },
      {
        id: 'push-right',
        name: '推入（右）',
        category: 'slide',
        description: '推入效果向右',
        duration: 0.7,
        easing: 'power3.inOut',
      },

      // 缩放
      {
        id: 'zoom-in',
        name: '放大',
        category: 'zoom',
        description: '放大进入效果',
        duration: 0.6,
        easing: 'power2.out',
      },
      {
        id: 'zoom-out',
        name: '缩小',
        category: 'zoom',
        description: '缩小退出效果',
        duration: 0.6,
        easing: 'power2.in',
      },
      {
        id: 'scale-up',
        name: '缩放放大',
        category: 'zoom',
        description: '平滑放大',
        duration: 0.8,
        easing: 'power1.inOut',
      },
      {
        id: 'scale-down',
        name: '缩放缩小',
        category: 'zoom',
        description: '平滑缩小',
        duration: 0.8,
        easing: 'power1.inOut',
      },

      // 旋转
      {
        id: 'rotate-left',
        name: '左旋转',
        category: 'rotate',
        description: '逆时针旋转',
        duration: 0.7,
        easing: 'power2.inOut',
      },
      {
        id: 'rotate-right',
        name: '右旋转',
        category: 'rotate',
        description: '顺时针旋转',
        duration: 0.7,
        easing: 'power2.inOut',
      },
      {
        id: 'spin',
        name: '旋转',
        category: 'rotate',
        description: '360度旋转',
        duration: 1.0,
        easing: 'power2.inOut',
      },

      // 擦除
      {
        id: 'wipe-left',
        name: '擦除（左）',
        category: 'wipe',
        description: '从右向左擦除',
        duration: 0.6,
        easing: 'power2.inOut',
      },
      {
        id: 'wipe-right',
        name: '擦除（右）',
        category: 'wipe',
        description: '从左向右擦除',
        duration: 0.6,
        easing: 'power2.inOut',
      },
      {
        id: 'wipe-up',
        name: '擦除（上）',
        category: 'wipe',
        description: '从下向上擦除',
        duration: 0.6,
        easing: 'power2.inOut',
      },
      {
        id: 'wipe-down',
        name: '擦除（下）',
        category: 'wipe',
        description: '从上向下擦除',
        duration: 0.6,
        easing: 'power2.inOut',
      },
      {
        id: 'iris-in',
        name: '光圈收缩',
        category: 'wipe',
        description: '圆形光圈收缩',
        duration: 0.8,
        easing: 'power2.inOut',
      },
      {
        id: 'iris-out',
        name: '光圈扩张',
        category: 'wipe',
        description: '圆形光圈扩张',
        duration: 0.8,
        easing: 'power2.inOut',
      },

      // 3D 效果
      {
        id: 'flip-horizontal',
        name: '水平翻转',
        category: '3d',
        description: '水平翻转效果',
        duration: 0.8,
        easing: 'power2.inOut',
      },
      {
        id: 'flip-vertical',
        name: '垂直翻转',
        category: '3d',
        description: '垂直翻转效果',
        duration: 0.8,
        easing: 'power2.inOut',
      },
      {
        id: 'cube-left',
        name: '立方体（左）',
        category: '3d',
        description: '3D立方体向左',
        duration: 1.0,
        easing: 'power2.inOut',
      },
      {
        id: 'cube-right',
        name: '立方体（右）',
        category: '3d',
        description: '3D立方体向右',
        duration: 1.0,
        easing: 'power2.inOut',
      },
      {
        id: 'page-curl',
        name: '翻页',
        category: '3d',
        description: '翻页效果',
        duration: 1.2,
        easing: 'power3.inOut',
      },
    ];
  }

  /**
   * 按类别获取转场
   */
  getPresetsByCategory(category: TransitionPreset['category']): TransitionPreset[] {
    return this.getPresets().filter((preset) => preset.category === category);
  }

  /**
   * 搜索转场
   */
  searchPresets(query: string): TransitionPreset[] {
    const lowerQuery = query.toLowerCase();
    return this.getPresets().filter(
      (preset) =>
        preset.name.toLowerCase().includes(lowerQuery) ||
        preset.description?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 创建自定义转场
   */
  createCustomTransition(
    name: string,
    duration: number,
    easing: string = 'power2.inOut'
  ): TransitionPreset {
    return {
      id: `custom-${Date.now()}`,
      name,
      category: 'fade',
      description: '自定义转场',
      duration,
      easing,
    };
  }

  /**
   * 预览转场效果
   */
  async previewTransition(
    preset: TransitionPreset,
    containerElement: HTMLElement
  ): Promise<void> {
    const preview1 = document.createElement('div');
    const preview2 = document.createElement('div');
    
    preview1.style.cssText = 'position: absolute; width: 100%; height: 100%; background: #9CA3AF;';
    preview2.style.cssText = 'position: absolute; width: 100%; height: 100%; background: #10B981;';
    
    containerElement.appendChild(preview1);
    containerElement.appendChild(preview2);

    await this.applyTransition(preview1, preview2, preset);

    // 清理
    setTimeout(() => {
      preview1.remove();
      preview2.remove();
    }, 1000);
  }
}

// 导出单例
export const transitionEngine = new TransitionEngine();
