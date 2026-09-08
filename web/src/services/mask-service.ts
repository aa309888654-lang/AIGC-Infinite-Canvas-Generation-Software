/**
 * 蒙版服务
 * 提供各种蒙版类型（线性、圆形、文字、钢笔）的创建、编辑和应用
 */
import { generateId } from '@/lib/utils';

export type MaskType = 'linear' | 'radial' | 'circle' | 'rectangle' | 'polygon' | 'text' | 'brush' | 'luminosity';
export type MaskFeather = 'none' | 'soft' | 'hard';
export type MaskBlend = 'normal' | 'multiply' | 'screen' | 'overlay' | 'add' | 'subtract';

export interface MaskPoint {
  x: number;
  y: number;
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
}

export interface Mask {
  id: string;
  name: string;
  type: MaskType;
  points: MaskPoint[];
  bounds: { x: number; y: number; width: number; height: number };
  feather: number;
  featherDistribution: 'uniform' | 'edge' | 'center';
  invert: boolean;
  opacity: number;
  blendMode: MaskBlend;
  visible: boolean;
  animated: boolean;
  keyframes?: MaskKeyframe[];
}

export interface MaskKeyframe {
  id?: string;
  time: number;
  property: 'position' | 'scale' | 'rotation' | 'feather' | 'opacity';
  value: unknown;
  easing: 'linear' | 'ease_in' | 'ease_out' | 'ease_in_out';
}

export interface MaskLayer {
  id: string;
  name: string;
  masks: Mask[];
  enabled: boolean;
}

export interface MaskPreset {
  id: string;
  name: string;
  description: string;
  category: 'vignette' | 'spotlight' | 'gradient' | 'shape' | 'custom';
  mask: Omit<Mask, 'id' | 'name'>;
}

class MaskService {
  private presets: MaskPreset[] = [
    {
      id: 'preset-vignette',
      name: '暗角',
      description: '经典电影暗角效果',
      category: 'vignette',
      mask: {
        type: 'radial',
        points: [],
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        feather: 50,
        featherDistribution: 'edge',
        invert: false,
        opacity: 100,
        blendMode: 'multiply',
        visible: true,
        animated: false
      }
    },
    {
      id: 'preset-spotlight',
      name: '聚光灯',
      description: '中央亮周围暗的效果',
      category: 'spotlight',
      mask: {
        type: 'radial',
        points: [],
        bounds: { x: 30, y: 30, width: 40, height: 40 },
        feather: 30,
        featherDistribution: 'uniform',
        invert: true,
        opacity: 80,
        blendMode: 'multiply',
        visible: true,
        animated: false
      }
    },
    {
      id: 'preset-gradient-linear',
      name: '线性渐变',
      description: '从一侧到另一侧的渐变',
      category: 'gradient',
      mask: {
        type: 'linear',
        points: [
          { x: 0, y: 50 },
          { x: 100, y: 50 }
        ],
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        feather: 20,
        featherDistribution: 'uniform',
        invert: false,
        opacity: 60,
        blendMode: 'normal',
        visible: true,
        animated: false
      }
    },
    {
      id: 'preset-gradient-radial',
      name: '径向渐变',
      description: '从中心向外扩散的渐变',
      category: 'gradient',
      mask: {
        type: 'radial',
        points: [],
        bounds: { x: 25, y: 25, width: 50, height: 50 },
        feather: 40,
        featherDistribution: 'uniform',
        invert: false,
        opacity: 70,
        blendMode: 'normal',
        visible: true,
        animated: false
      }
    },
    {
      id: 'preset-circle',
      name: '圆形遮罩',
      description: '简单圆形区域',
      category: 'shape',
      mask: {
        type: 'circle',
        points: [],
        bounds: { x: 25, y: 25, width: 50, height: 50 },
        feather: 5,
        featherDistribution: 'edge',
        invert: false,
        opacity: 100,
        blendMode: 'normal',
        visible: true,
        animated: false
      }
    },
    {
      id: 'preset-rectangle',
      name: '矩形遮罩',
      description: '矩形区域',
      category: 'shape',
      mask: {
        type: 'rectangle',
        points: [],
        bounds: { x: 20, y: 20, width: 60, height: 60 },
        feather: 0,
        featherDistribution: 'edge',
        invert: false,
        opacity: 100,
        blendMode: 'normal',
        visible: true,
        animated: false
      }
    }
  ];

  createMask(type: MaskType, options?: Partial<Mask>): Mask {
    const defaultMasks: Record<MaskType, Partial<Mask>> = {
      linear: {
        points: [
          { x: 0, y: 50 },
          { x: 100, y: 50 }
        ],
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        feather: 10
      },
      radial: {
        points: [],
        bounds: { x: 25, y: 25, width: 50, height: 50 },
        feather: 30
      },
      circle: {
        points: [],
        bounds: { x: 25, y: 25, width: 50, height: 50 },
        feather: 5
      },
      rectangle: {
        points: [],
        bounds: { x: 20, y: 20, width: 60, height: 60 },
        feather: 0
      },
      polygon: {
        points: [
          { x: 50, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ],
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        feather: 5
      },
      text: {
        points: [],
        bounds: { x: 20, y: 40, width: 60, height: 20 },
        feather: 2
      },
      brush: {
        points: [],
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        feather: 10
      },
      luminosity: {
        points: [],
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        feather: 0
      }
    };

    return {
      id: generateId(),
      name: `蒙版 ${Date.now()}`,
      type,
      points: defaultMasks[type]?.points || [],
      bounds: defaultMasks[type]?.bounds || { x: 0, y: 0, width: 100, height: 100 },
      feather: defaultMasks[type]?.feather || 5,
      featherDistribution: 'uniform',
      invert: false,
      opacity: 100,
      blendMode: 'normal',
      visible: true,
      animated: false,
      ...options
    };
  }

  createCircleMask(center: { x: number; y: number }, radius: number): Mask {
    return this.createMask('circle', {
      name: '圆形蒙版',
      bounds: {
        x: center.x - radius,
        y: center.y - radius,
        width: radius * 2,
        height: radius * 2
      }
    });
  }

  createRectangleMask(x: number, y: number, width: number, height: number): Mask {
    return this.createMask('rectangle', {
      name: '矩形蒙版',
      bounds: { x, y, width, height }
    });
  }

  createLinearGradientMask(
    start: { x: number; y: number },
    end: { x: number; y: number },
    feather: number = 10
  ): Mask {
    return this.createMask('linear', {
      name: '线性渐变蒙版',
      points: [
        { x: start.x, y: start.y },
        { x: end.x, y: end.y }
      ],
      feather
    });
  }

  createRadialGradientMask(
    center: { x: number; y: number },
    innerRadius: number,
    outerRadius: number,
    feather: number = 30
  ): Mask {
    return this.createMask('radial', {
      name: '径向渐变蒙版',
      bounds: {
        x: center.x - outerRadius,
        y: center.y - outerRadius,
        width: outerRadius * 2,
        height: outerRadius * 2
      },
      feather
    });
  }

  createPolygonMask(points: { x: number; y: number }[]): Mask {
    if (points.length < 3) {
      throw new Error('多边形至少需要3个点');
    }

    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return this.createMask('polygon', {
      name: '多边形蒙版',
      points: points.map(p => ({ x: p.x, y: p.y })),
      bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    });
  }

  addKeyframe(mask: Mask, keyframe: Omit<MaskKeyframe, 'id'>): Mask {
    const newKeyframe: MaskKeyframe = {
      ...keyframe,
      id: generateId()
    };

    const keyframes = [...(mask.keyframes || []), newKeyframe].sort(
      (a, b) => a.time - b.time
    );

    return {
      ...mask,
      animated: true,
      keyframes
    };
  }

  removeKeyframe(mask: Mask, keyframeId: string): Mask {
    const keyframes = (mask.keyframes || []).filter(k => k.id !== keyframeId);

    return {
      ...mask,
      animated: keyframes.length > 0,
      keyframes
    };
  }

  getInterpolatedValue(mask: Mask, time: number, property: MaskKeyframe['property']): unknown {
    const keyframes = (mask.keyframes || [])
      .filter(k => k.property === property)
      .sort((a, b) => a.time - b.time);

    if (keyframes.length === 0) {
      return this.getDefaultValue(mask, property);
    }

    if (keyframes.length === 1 || time <= keyframes[0].time) {
      return keyframes[0].value;
    }

    if (time >= keyframes[keyframes.length - 1].time) {
      return keyframes[keyframes.length - 1].value;
    }

    let prevKeyframe = keyframes[0];
    let nextKeyframe = keyframes[1];

    for (let i = 0; i < keyframes.length - 1; i++) {
      if (time >= keyframes[i].time && time < keyframes[i + 1].time) {
        prevKeyframe = keyframes[i];
        nextKeyframe = keyframes[i + 1];
        break;
      }
    }

    const progress = (time - prevKeyframe.time) / (nextKeyframe.time - prevKeyframe.time);
    const easedProgress = this.applyEasing(progress, nextKeyframe.easing);

    return this.interpolateValue(prevKeyframe.value, nextKeyframe.value, easedProgress);
  }

  private getDefaultValue(mask: Mask, property: MaskKeyframe['property']): unknown {
    switch (property) {
      case 'position':
        return { x: mask.bounds.x, y: mask.bounds.y };
      case 'scale':
        return { x: 100, y: 100 };
      case 'rotation':
        return 0;
      case 'feather':
        return mask.feather;
      case 'opacity':
        return mask.opacity;
      default:
        return null;
    }
  }

  private applyEasing(t: number, easing: MaskKeyframe['easing']): number {
    switch (easing) {
      case 'linear':
        return t;
      case 'ease_in':
        return t * t;
      case 'ease_out':
        return t * (2 - t);
      case 'ease_in_out':
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      default:
        return t;
    }
  }

  private interpolateValue(from: unknown, to: unknown, progress: number): unknown {
    if (typeof from === 'number' && typeof to === 'number') {
      return from + (to - from) * progress;
    }

    if (typeof from === 'object' && typeof to === 'object') {
      const result: Record<string, any> = {};
      for (const key of Object.keys(from)) {
        if (typeof from[key] === 'number' && typeof to[key] === 'number') {
          result[key] = from[key] + (to[key] - from[key]) * progress;
        } else {
          result[key] = to[key];
        }
      }
      return result;
    }

    return progress < 0.5 ? from : to;
  }

  applyMaskToCanvas(
    canvas: HTMLCanvasElement,
    mask: Mask,
    overlayColor: string = 'rgba(0, 0, 0, 0.5)'
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();

    this.createClipPath(ctx, mask);

    ctx.fillStyle = overlayColor;
    ctx.globalAlpha = mask.opacity / 100;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (mask.invert) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.restore();
  }

  private createClipPath(ctx: CanvasRenderingContext2D, mask: Mask): void {
    ctx.beginPath();

    const { bounds, feather, type, points } = mask;
    const { x, y, width, height } = bounds;

    switch (type) {
      case 'circle': {
        const radiusX = width / 2;
        const radiusY = height / 2;
        ctx.ellipse(
          x + radiusX,
          y + radiusY,
          radiusX,
          radiusY,
          0,
          0,
          Math.PI * 2
        );
        break;
      }

      case 'rectangle':
        this.roundRect(ctx, x, y, width, height, 0);
        break;

      case 'linear':
        if (points.length >= 2) {
          const gradient = ctx.createLinearGradient(
            points[0].x,
            points[0].y,
            points[1].x,
            points[1].y
          );
          gradient.addColorStop(0, 'transparent');
          gradient.addColorStop(0.5 + feather / 200, 'white');
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
        }
        ctx.rect(0, 0, 100, 100);
        break;

      case 'radial': {
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const gradient = ctx.createRadialGradient(
          centerX,
          centerY,
          0,
          centerX,
          centerY,
          Math.max(width, height) / 2
        );
        gradient.addColorStop(0, 'white');
        gradient.addColorStop(1 - feather / 100, 'white');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.ellipse(centerX, centerY, width / 2, height / 2, 0, 0, Math.PI * 2);
        break;
      }

      case 'polygon':
        if (points.length >= 3) {
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.closePath();
        }
        break;

      default:
        ctx.rect(x, y, width, height);
    }
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }

  getPresets(): MaskPreset[] {
    return [...this.presets];
  }

  getPreset(id: string): MaskPreset | undefined {
    return this.presets.find(p => p.id === id);
  }

  createFromPreset(presetId: string): Mask | null {
    const preset = this.getPreset(presetId);
    if (!preset) return null;

    return this.createMask(preset.mask.type, {
      ...preset.mask,
      name: preset.name
    });
  }

  exportMask(mask: Mask): string {
    return JSON.stringify(mask, null, 2);
  }

  importMask(jsonString: string): Mask | null {
    try {
      const mask = JSON.parse(jsonString) as Mask;
      if (!mask.id || !mask.type) {
        throw new Error('Invalid mask format');
      }
      return {
        ...mask,
        id: generateId()
      };
    } catch (error) {
      console.error('[Mask] 导入失败:', error);
      return null;
    }
  }

  getMaskSVG(mask: Mask, width: number, height: number): string {
    const { bounds, type, feather, points } = mask;
    const { x, y, w, h } = {
      x: (bounds.x / 100) * width,
      y: (bounds.y / 100) * height,
      w: (bounds.width / 100) * width,
      h: (bounds.height / 100) * height
    };

    let svg = '';

    switch (type) {
      case 'circle':
        svg = `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" />`;
        break;

      case 'rectangle':
        svg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" />`;
        break;

      case 'linear':
        if (points.length >= 2) {
          svg = `<defs>
            <linearGradient id="maskGrad" x1="${points[0].x}%" y1="${points[0].y}%" x2="${points[1].x}%" y2="${points[1].y}%">
              <stop offset="0%" stop-color="transparent" />
              <stop offset="${50 - feather / 2}%" stop-color="white" />
              <stop offset="${50 + feather / 2}%" stop-color="white" />
              <stop offset="100%" stop-color="transparent" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="url(#maskGrad)" />`;
        }
        break;

      case 'radial':
        svg = `<defs>
          <radialGradient id="maskGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="white" />
            <stop offset="${100 - feather}%" stop-color="white" />
            <stop offset="100%" stop-color="transparent" />
          </radialGradient>
        </defs>
        <ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="url(#maskGrad)" />`;
        break;

      case 'polygon':
        if (points.length >= 3) {
          const pathData = points.map((p, i) => {
            const px = (p.x / 100) * width;
            const py = (p.y / 100) * height;
            return i === 0 ? `M ${px} ${py}` : `L ${px} ${py}`;
          }).join(' ') + ' Z';
          svg = `<path d="${pathData}" />`;
        }
        break;

      default:
        svg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" />`;
    }

    return svg;
  }
}

export const maskService = new MaskService();
