/**
 * 高级调色工具服务
 * 提供专业级色彩校正、风格预设、曲线调整等功能
 */
import { generateId } from '@/lib/utils';

export interface ColorCorrection {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  temperature: number;
  tint: number;
  saturation?: number;
  vibrance?: number;
  sharpen?: number | { amount: number; radius: number };
}

export interface HSLAdjustment {
  hue: number;
  saturation: number;
  lightness: number;
}

export interface CurvePoint {
  x: number;
  y: number;
}

export interface ColorCurve {
  master: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

export interface ColorPreset {
  id: string;
  name: string;
  nameEn?: string;
  description: string;
  category: 'cinematic' | 'vintage' | 'modern' | 'artistic' | 'professional' | 'vibrant' | 'moody' | 'creative';
  correction: Partial<ColorCorrection>;
  adjustments?: Partial<ColorCorrection>;
  hsl?: Partial<HSLAdjustment>;
  curve?: Partial<ColorCurve>;
  grain?: { amount: number; size: number };
  sharpen?: number | { amount: number; radius: number };
  applicableScenes?: string;
}

export interface ColorGradingRecommendation {
  preset: ColorPreset;
  reason: string;
  keywords: string[];
}

export interface ColorGradeLayer {
  id: string;
  name: string;
  enabled: boolean;
  opacity: number;
  blendMode: BlendMode;
  correction: ColorCorrection;
  hsl: HSLAdjustment;
  curve: ColorCurve;
  beforeAfter: 'before' | 'after';
}

export type BlendMode = 
  | 'normal' 
  | 'multiply' 
  | 'screen' 
  | 'overlay' 
  | 'softLight' 
  | 'hardLight'
  | 'colorDodge'
  | 'colorBurn'
  | 'luminosity';

export interface VignetteSettings {
  intensity: number;
  radius: number;
  feather: number;
  shape: 'circular' | 'elliptical';
  color: string;
}

export interface ColorGradeSettings {
  correction: ColorCorrection;
  hsl: HSLAdjustment;
  curve: ColorCurve;
  vignette?: VignetteSettings;
  grain?: { amount: number; size: number };
  sharpen?: { amount: number; radius: number };
  secondaryCorrection?: SecondaryCorrection;
  colorSpace?: ColorSpaceSettings;
}

/** Secondary color correction (HSL Secondary) - target specific hue/sat/lum ranges */
export interface SecondaryCorrection {
  enabled: boolean;
  // Target range
  hueCenter: number;        // 0-360
  hueRange: number;         // 0-180
  satMin: number;           // 0-100
  satMax: number;           // 0-100
  lumMin: number;           // 0-100
  lumMax: number;           // 0-100
  // Corrections applied to selected range
  hueShift: number;         // -180 to 180
  satShift: number;         // -100 to 100
  lumShift: number;         // -100 to 100
  softness: number;         // 0-100, edge feather
}

/** Color space management */
export interface ColorSpaceSettings {
  inputSpace: 'rec709' | 'rec2020' | 'srgb' | 'log-c' | 's-log3' | 'd-log';
  outputSpace: 'rec709' | 'rec2020' | 'srgb';
  gamma: number;            // 0.5-3.0, default 2.2
  linearize: boolean;       // Apply linearization before processing
}

/** Bezier curve point for enhanced curve editor */
export interface BezierCurvePoint {
  x: number;
  y: number;
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
}

class ColorGradingService {
  private defaultCorrection: ColorCorrection = {
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    temperature: 0,
    tint: 0
  };

  private defaultHSL: HSLAdjustment = {
    hue: 0,
    saturation: 0,
    lightness: 0
  };

  private defaultCurve: ColorCurve = {
    master: [
      { x: 0, y: 0 },
      { x: 0.25, y: 0.25 },
      { x: 0.5, y: 0.5 },
      { x: 0.75, y: 0.75 },
      { x: 1, y: 1 }
    ],
    red: [
      { x: 0, y: 0 },
      { x: 1, y: 1 }
    ],
    green: [
      { x: 0, y: 0 },
      { x: 1, y: 1 }
    ],
    blue: [
      { x: 0, y: 0 },
      { x: 1, y: 1 }
    ]
  };

  private presets: ColorPreset[] = [
    {
      id: 'preset-cinematic-teal-orange',
      name: '青橙电影感',
      description: '经典的青橙色调，增强视觉冲击力',
      category: 'cinematic',
      correction: {
        exposure: 0.1,
        contrast: 15,
        highlights: -20,
        shadows: 10,
        temperature: 10,
        tint: -5
      }
    },
    {
      id: 'preset-cinematic-bleach-bypass',
      name: '漂白旁路',
      description: '降低饱和度，提高对比度，电影感强',
      category: 'cinematic',
      correction: {
        exposure: -0.2,
        contrast: 30,
        highlights: -30,
        shadows: -10,
        saturation: -40,
        temperature: 0,
        tint: 0
      }
    },
    {
      id: 'preset-vintage-sepia',
      name: '复古棕褐',
      description: '怀旧风格，温暖色调',
      category: 'vintage',
      correction: {
        exposure: 0,
        contrast: 10,
        temperature: 20,
        tint: 10
      },
      hsl: {
        hue: 30,
        saturation: 30,
        lightness: 0
      }
    },
    {
      id: 'preset-vintage-faded',
      name: '褪色复古',
      description: '柔和的褪色效果',
      category: 'vintage',
      correction: {
        exposure: 0.2,
        contrast: -10,
        highlights: 20,
        shadows: -20,
        saturation: -30,
        temperature: 5
      }
    },
    {
      id: 'preset-modern-high-contrast',
      name: '高对比现代',
      description: '清晰锐利，现代感强',
      category: 'modern',
      correction: {
        exposure: 0.1,
        contrast: 25,
        highlights: -10,
        shadows: 5,
        temperature: 0,
        tint: 0
      },
      sharpen: {
        amount: 0.5,
        radius: 1
      }
    },
    {
      id: 'preset-modern-clean',
      name: '干净清透',
      description: '清新明亮，适合人像',
      category: 'modern',
      correction: {
        exposure: 0.15,
        contrast: 5,
        highlights: 10,
        shadows: 5,
        temperature: -5,
        tint: 5
      }
    },
    {
      id: 'preset-artistic-muted',
      name: '低饱和艺术',
      description: '低饱和度，艺术感强',
      category: 'artistic',
      correction: {
        saturation: -50,
        contrast: 15,
        temperature: 0
      },
      hsl: {
        hue: 0,
        saturation: -50,
        lightness: 0
      }
    },
    {
      id: 'preset-artistic-cross-process',
      name: '交叉冲洗',
      description: '非传统的色彩偏移，艺术效果',
      category: 'artistic',
      correction: {
        exposure: 0,
        contrast: 20,
        highlights: -15,
        shadows: 15,
        temperature: 10,
        tint: -10
      },
      hsl: {
        hue: 10,
        saturation: 20,
        lightness: 0
      }
    },
    {
      id: 'preset-professional-rec709',
      name: 'Rec.709 标准',
      description: '广播级标准色彩',
      category: 'professional',
      correction: {
        exposure: 0,
        contrast: 10,
        highlights: 0,
        shadows: 0,
        temperature: 0,
        tint: 0
      }
    },
    {
      id: 'preset-professional-log-to-rec709',
      name: 'Log转Rec.709',
      description: 'Log素材转换标准',
      category: 'professional',
      correction: {
        exposure: 0.5,
        contrast: 15,
        highlights: -10,
        shadows: 10,
        temperature: 0,
        tint: 0
      }
    }
  ];

  getDefaultCorrection(): ColorCorrection {
    return { ...this.defaultCorrection };
  }

  getDefaultHSL(): HSLAdjustment {
    return { ...this.defaultHSL };
  }

  getDefaultCurve(): ColorCurve {
    return JSON.parse(JSON.stringify(this.defaultCurve));
  }

  getPresets(): ColorPreset[] {
    return [...this.presets];
  }

  getAllPresets(): ColorPreset[] {
    return [...this.presets];
  }

  getPresetsByCategory(category: ColorPreset['category']): ColorPreset[] {
    return this.presets.filter(p => p.category === category);
  }

  recommendByScene(sceneType: string): ColorGradingRecommendation[] {
    // TODO: 当前为本地规则匹配模式，待接入AI大模型后替换为智能推荐
    const sceneMap: Record<string, string[]> = {
      sunset: ['cinematic', 'vintage', 'moody'],
      night: ['cinematic', 'moody', 'professional'],
      indoor: ['professional', 'modern'],
      outdoor: ['vibrant', 'cinematic', 'artistic'],
      portrait: ['professional', 'vintage', 'cinematic'],
      landscape: ['vibrant', 'cinematic', 'artistic'],
      food: ['vibrant', 'modern', 'professional'],
      travel: ['vibrant', 'cinematic', 'vintage'],
      wedding: ['vintage', 'professional', 'romantic'],
      sports: ['vibrant', 'modern', 'creative'],
    };
    const categories = sceneMap[sceneType] || ['cinematic', 'professional'];
    const results: ColorGradingRecommendation[] = [];
    for (const cat of categories) {
      const presets = this.getPresetsByCategory(cat as ColorPreset['category']);
      for (const preset of presets.slice(0, 2)) {
        results.push({
          preset,
          reason: `适合${sceneType}场景`,
          keywords: [sceneType, cat, preset.name],
        });
      }
    }
    return results;
  }

  getPreset(id: string): ColorPreset | undefined {
    return this.presets.find(p => p.id === id);
  }

  applyCorrection(correction: Partial<ColorCorrection>): ColorCorrection {
    return {
      ...this.defaultCorrection,
      ...correction
    };
  }

  applyHSLAdjustment(hsl: Partial<HSLAdjustment>): HSLAdjustment {
    return {
      ...this.defaultHSL,
      ...hsl
    };
  }

  createLayer(
    name: string,
    correction?: Partial<ColorCorrection>,
    options?: {
      opacity?: number;
      blendMode?: BlendMode;
    }
  ): ColorGradeLayer {
    return {
      id: generateId(),
      name,
      enabled: true,
      opacity: options?.opacity ?? 100,
      blendMode: options?.blendMode ?? 'normal',
      correction: this.applyCorrection(correction || {}),
      hsl: this.getDefaultHSL(),
      curve: this.getDefaultCurve(),
      beforeAfter: 'after'
    };
  }

  adjustExposure(correction: ColorCorrection, delta: number): ColorCorrection {
    return {
      ...correction,
      exposure: Math.max(-5, Math.min(5, correction.exposure + delta))
    };
  }

  adjustContrast(correction: ColorCorrection, delta: number): ColorCorrection {
    return {
      ...correction,
      contrast: Math.max(-100, Math.min(100, correction.contrast + delta))
    };
  }

  adjustTemperature(correction: ColorCorrection, delta: number): ColorCorrection {
    return {
      ...correction,
      temperature: Math.max(-100, Math.min(100, correction.temperature + delta))
    };
  }

  adjustTint(correction: ColorCorrection, delta: number): ColorCorrection {
    return {
      ...correction,
      tint: Math.max(-100, Math.min(100, correction.tint + delta))
    };
  }

  autoWhiteBalance(imageData: ImageData): { temperature: number; tint: number } {
    const data = imageData.data;
    let rSum = 0, gSum = 0, bSum = 0;
    let pixelCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luminance = (r + g + b) / 3;

      if (luminance > 20 && luminance < 235) {
        rSum += r;
        gSum += g;
        bSum += b;
        pixelCount++;
      }
    }

    if (pixelCount === 0) {
      return { temperature: 0, tint: 0 };
    }

    const avgR = rSum / pixelCount;
    const avgG = gSum / pixelCount;
    const avgB = bSum / pixelCount;

    const temperature = ((avgR - avgG) / 128) * 50;
    const tint = ((avgG - avgB) / 128) * 50;

    return {
      temperature: Math.max(-100, Math.min(100, temperature)),
      tint: Math.max(-100, Math.min(100, tint))
    };
  }

  autoLevels(settings: ColorGradeSettings): ColorGradeSettings {
    return {
      ...settings,
      correction: {
        ...settings.correction,
        blacks: -10,
        whites: 10
      }
    };
  }

  autoContrast(settings: ColorGradeSettings): ColorGradeSettings {
    return {
      ...settings,
      correction: {
        ...settings.correction,
        contrast: settings.correction.contrast + 15,
        highlights: settings.correction.highlights - 10,
        shadows: settings.correction.shadows + 10
      }
    };
  }

  interpolateCurvePoint(
    from: CurvePoint,
    to: CurvePoint,
    progress: number
  ): CurvePoint {
    return {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress
    };
  }

  addCurvePoint(
    curve: ColorCurve,
    channel: keyof ColorCurve,
    point: CurvePoint
  ): ColorCurve {
    const newCurve = [...curve[channel], point].sort((a, b) => a.x - b.x);
    return {
      ...curve,
      [channel]: newCurve
    };
  }

  removeCurvePoint(
    curve: ColorCurve,
    channel: keyof ColorCurve,
    index: number
  ): ColorCurve {
    const newCurve = curve[channel].filter((_, i) => i !== index);
    return {
      ...curve,
      [channel]: newCurve
    };
  }

  resetCurve(channel: 'master' | 'red' | 'green' | 'blue'): ColorCurve {
    const defaultPoints: CurvePoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 }
    ];

    return {
      ...this.getDefaultCurve(),
      [channel]: defaultPoints
    };
  }

  applyCurveToValue(
    value: number,
    curve: CurvePoint[]
  ): number {
    if (curve.length < 2) return value;

    const sortedCurve = [...curve].sort((a, b) => a.x - b.x);
    
    if (value <= sortedCurve[0].x) {
      return sortedCurve[0].y;
    }
    
    if (value >= sortedCurve[sortedCurve.length - 1].x) {
      return sortedCurve[sortedCurve.length - 1].y;
    }

    for (let i = 0; i < sortedCurve.length - 1; i++) {
      if (value >= sortedCurve[i].x && value <= sortedCurve[i + 1].x) {
        const progress = (value - sortedCurve[i].x) / (sortedCurve[i + 1].x - sortedCurve[i].x);
        return this.interpolateCurvePoint(sortedCurve[i], sortedCurve[i + 1], progress).y;
      }
    }

    return value;
  }

  createVignette(
    intensity: number = 50,
    radius: number = 50,
    feather: number = 50
  ): VignetteSettings {
    return {
      intensity: Math.max(0, Math.min(100, intensity)),
      radius: Math.max(0, Math.min(100, radius)),
      feather: Math.max(0, Math.min(100, feather)),
      shape: 'circular',
      color: '#000000'
    };
  }

  applyVignetteToCanvas(
    canvas: HTMLCanvasElement,
    vignette: VignetteSettings
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);

    const radius = (vignette.radius / 100) * maxRadius;
    const featherWidth = (vignette.feather / 100) * maxRadius * 0.5;

    const gradient = ctx.createRadialGradient(
      centerX, centerY, radius - featherWidth,
      centerX, centerY, radius + featherWidth
    );

    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.5, `rgba(0, 0, 0, ${vignette.intensity / 100})`);
    gradient.addColorStop(1, `rgba(0, 0, 0, ${vignette.intensity / 100})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  applyColorGradeToImageData(
    imageData: ImageData,
    settings: ColorGradeSettings
  ): ImageData {
    const data = imageData.data;
    const { correction, hsl } = settings;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      r = this.applyExposure(r, correction.exposure);
      g = this.applyExposure(g, correction.exposure);
      b = this.applyExposure(b, correction.exposure);

      r = this.applyContrast(r, correction.contrast);
      g = this.applyContrast(g, correction.contrast);
      b = this.applyContrast(b, correction.contrast);

      [r, g, b] = this.applyTemperatureAndTint(r, g, b, correction.temperature, correction.tint);

      r = this.applyHighlightsAndShadows(r, correction.highlights, 'highlights');
      g = this.applyHighlightsAndShadows(g, correction.highlights, 'highlights');
      b = this.applyHighlightsAndShadows(b, correction.highlights, 'highlights');

      r = this.applyHighlightsAndShadows(r, correction.shadows, 'shadows');
      g = this.applyHighlightsAndShadows(g, correction.shadows, 'shadows');
      b = this.applyHighlightsAndShadows(b, correction.shadows, 'shadows');

      if (hsl.saturation !== 0) {
        [r, g, b] = this.applySaturation(r, g, b, hsl.saturation);
      }

      if (hsl.hue !== 0) {
        [r, g, b] = this.applyHueShift(r, g, b, hsl.hue);
      }

      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }

    return imageData;
  }

  private applyExposure(value: number, exposure: number): number {
    const factor = Math.pow(2, exposure);
    return value * factor;
  }

  private applyContrast(value: number, contrast: number): number {
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    return factor * (value - 128) + 128;
  }

  private applyTemperatureAndTint(
    r: number, g: number, b: number,
    temperature: number, tint: number
  ): [number, number, number] {
    r += temperature * 0.5;
    g += temperature * 0.1;
    b -= temperature * 0.5;

    g += tint * 0.5;
    r -= tint * 0.25;
    b += tint * 0.25;

    return [r, g, b];
  }

  private applyHighlightsAndShadows(
    value: number,
    adjustment: number,
    type: 'highlights' | 'shadows'
  ): number {
    const normalized = value / 255;
    let mask: number;

    if (type === 'highlights') {
      mask = normalized > 0.5 ? 1 - (normalized - 0.5) * 2 : 0;
    } else {
      mask = normalized < 0.5 ? normalized * 2 : 0;
    }

    const adjustmentFactor = adjustment / 100 * mask;
    return value * (1 + adjustmentFactor);
  }

  private applySaturation(
    r: number, g: number, b: number,
    saturation: number
  ): [number, number, number] {
    const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
    const factor = 1 + saturation / 100;

    return [
      gray + (r - gray) * factor,
      gray + (g - gray) * factor,
      gray + (b - gray) * factor
    ];
  }

  private applyHueShift(
    r: number, g: number, b: number,
    hueShift: number
  ): [number, number, number] {
    const hsl = this.rgbToHsl(r, g, b);
    hsl[0] = (hsl[0] + hueShift / 360) % 1;
    if (hsl[0] < 0) hsl[0] += 1;

    return this.hslToRgb(hsl[0], hsl[1], hsl[2]);
  }

  private rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return [h, s, l];
  }

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r: number, g: number, b: number;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return [r * 255, g * 255, b * 255];
  }

  blendColorGradeLayers(
    layers: ColorGradeLayer[],
    backgroundData: ImageData
  ): ImageData {
    let result = backgroundData;

    const enabledLayers = layers.filter(l => l.enabled);

    for (const layer of enabledLayers) {
      const settings: ColorGradeSettings = {
        correction: layer.correction,
        hsl: layer.hsl,
        curve: layer.curve
      };

      const layerData = this.applyColorGradeToImageData(
        new ImageData(
          new Uint8ClampedArray(result.data),
          result.width,
          result.height
        ),
        settings
      );

      result = this.blendLayers(result, layerData, layer.blendMode, layer.opacity / 100);
    }

    return result;
  }

  private blendLayers(
    base: ImageData,
    overlay: ImageData,
    blendMode: BlendMode,
    opacity: number
  ): ImageData {
    const result = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height);

    for (let i = 0; i < base.data.length; i += 4) {
      const baseR = base.data[i];
      const baseG = base.data[i + 1];
      const baseB = base.data[i + 2];

      const overlayR = overlay.data[i];
      const overlayG = overlay.data[i + 1];
      const overlayB = overlay.data[i + 2];

      const [blendedR, blendedG, blendedB] = this.applyBlendMode(
        baseR, baseG, baseB,
        overlayR, overlayG, overlayB,
        blendMode
      );

      result.data[i] = baseR + (blendedR - baseR) * opacity;
      result.data[i + 1] = baseG + (blendedG - baseG) * opacity;
      result.data[i + 2] = baseB + (blendedB - baseB) * opacity;
      result.data[i + 3] = base.data[i + 3];
    }

    return result;
  }

  private applyBlendMode(
    baseR: number, baseG: number, baseB: number,
    overlayR: number, overlayG: number, overlayB: number,
    blendMode: BlendMode
  ): [number, number, number] {
    const blendFunctions: Record<BlendMode, () => [number, number, number]> = {
      normal: () => [overlayR, overlayG, overlayB],
      multiply: () => [
        (baseR / 255) * (overlayR / 255) * 255,
        (baseG / 255) * (overlayG / 255) * 255,
        (baseB / 255) * (overlayB / 255) * 255
      ],
      screen: () => [
        255 - (1 - baseR / 255) * (1 - overlayR / 255) * 255,
        255 - (1 - baseG / 255) * (1 - overlayG / 255) * 255,
        255 - (1 - baseB / 255) * (1 - overlayB / 255) * 255
      ],
      overlay: () => [
        baseR < 128 ? 2 * baseR * overlayR / 255 : 255 - 2 * (1 - baseR / 255) * (1 - overlayR / 255) * 255,
        baseG < 128 ? 2 * baseG * overlayG / 255 : 255 - 2 * (1 - baseG / 255) * (1 - overlayG / 255) * 255,
        baseB < 128 ? 2 * baseB * overlayB / 255 : 255 - 2 * (1 - baseB / 255) * (1 - overlayB / 255) * 255
      ],
      softLight: () => [
        this.softLightBlend(baseR, overlayR),
        this.softLightBlend(baseG, overlayG),
        this.softLightBlend(baseB, overlayB)
      ],
      hardLight: () => [
        overlayR < 128 ? 2 * baseR * overlayR / 255 : 255 - 2 * (1 - baseR / 255) * (1 - overlayR / 255) * 255,
        overlayG < 128 ? 2 * baseG * overlayG / 255 : 255 - 2 * (1 - baseG / 255) * (1 - overlayG / 255) * 255,
        overlayB < 128 ? 2 * baseB * overlayB / 255 : 255 - 2 * (1 - baseB / 255) * (1 - overlayB / 255) * 255
      ],
      colorDodge: () => [
        baseR === 255 ? 255 : Math.min(255, (overlayR / 255) / (1 - baseR / 255) * 255),
        baseG === 255 ? 255 : Math.min(255, (overlayG / 255) / (1 - baseG / 255) * 255),
        baseB === 255 ? 255 : Math.min(255, (overlayB / 255) / (1 - baseB / 255) * 255)
      ],
      colorBurn: () => [
        baseR === 0 ? 0 : Math.max(0, 255 - (1 - overlayR / 255) / (baseR / 255) * 255),
        baseG === 0 ? 0 : Math.max(0, 255 - (1 - overlayG / 255) / (baseG / 255) * 255),
        baseB === 0 ? 0 : Math.max(0, 255 - (1 - overlayB / 255) / (baseB / 255) * 255)
      ],
      luminosity: () => {
        const baseLum = 0.2989 * baseR + 0.5870 * baseG + 0.1140 * baseB;
        const overlayLum = 0.2989 * overlayR + 0.5870 * overlayG + 0.1140 * overlayB;
        const diff = overlayLum - baseLum;
        return [
          Math.max(0, Math.min(255, baseR + diff)),
          Math.max(0, Math.min(255, baseG + diff)),
          Math.max(0, Math.min(255, baseB + diff))
        ];
      }
    };

    return blendFunctions[blendMode]();
  }

  private softLightBlend(base: number, overlay: number): number {
    const d = overlay / 255;
    const s = 1 - d;
    const f = base / 255;

    return d < 0.5
      ? 255 - 2 * s * (255 - f) * d
      : 2 * d * (f + 0.5) - 1;
  }

  exportSettings(settings: ColorGradeSettings): string {
    return JSON.stringify(settings, null, 2);
  }

  importSettings(jsonString: string): ColorGradeSettings | null {
    try {
      const settings = JSON.parse(jsonString);
      return {
        correction: { ...this.defaultCorrection, ...settings.correction },
        hsl: { ...this.defaultHSL, ...settings.hsl },
        curve: settings.curve || this.getDefaultCurve(),
        vignette: settings.vignette,
        grain: settings.grain,
        sharpen: settings.sharpen
      };
    } catch (error) {
      console.error('[调色] 设置导入失败:', error);
      return null;
    }
  }

  /** Get default secondary correction */
  getDefaultSecondaryCorrection(): SecondaryCorrection {
    return { enabled: false, hueCenter: 0, hueRange: 30, satMin: 20, satMax: 100, lumMin: 0, lumMax: 100, hueShift: 0, satShift: 0, lumShift: 0, softness: 50 };
  }

  /** Apply secondary correction to pixel data */
  applySecondaryCorrection(r: number, g: number, b: number, sec: SecondaryCorrection): { r: number; g: number; b: number } {
    if (!sec.enabled) return { r, g, b };
    // Convert to HSL
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
      else if (max === gn) h = ((bn - rn) / d + 2) / 6;
      else h = ((rn - gn) / d + 4) / 6;
    }
    const hueDeg = h * 360;
    const satPct = s * 100;
    const lumPct = l * 100;
    // Check if pixel is in target range
    let hueDist = Math.abs(hueDeg - sec.hueCenter);
    if (hueDist > 180) hueDist = 360 - hueDist;
    if (hueDist <= sec.hueRange && satPct >= sec.satMin && satPct <= sec.satMax && lumPct >= sec.lumMin && lumPct <= sec.lumMax) {
      const feather = sec.softness / 100;
      const edgeDist = Math.max(0, hueDist / sec.hueRange - (1 - feather)) / feather;
      const blend = 1 - Math.min(1, edgeDist);
      const newH = ((hueDeg + sec.hueShift) % 360) / 360;
      const newS = Math.max(0, Math.min(1, (satPct + sec.satShift) / 100));
      const newL = Math.max(0, Math.min(1, (lumPct + sec.lumShift) / 100));
      // HSL to RGB
      const hsl2rgb = (p: number, q: number, t: number) => { if (t < 0) t++; if (t > 1) t--; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; };
      const q2 = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
      const p2 = 2 * newL - q2;
      const nr = hsl2rgb(p2, q2, newH + 1/3);
      const ng = hsl2rgb(p2, q2, newH);
      const nb = hsl2rgb(p2, q2, newH - 1/3);
      return { r: Math.round(r * (1 - blend) + nr * 255 * blend), g: Math.round(g * (1 - blend) + ng * 255 * blend), b: Math.round(b * (1 - blend) + nb * 255 * blend) };
    }
    return { r, g, b };
  }

  /** Get default color space settings */
  getDefaultColorSpace(): ColorSpaceSettings {
    return { inputSpace: 'rec709', outputSpace: 'rec709', gamma: 2.2, linearize: false };
  }

  /** Apply color space transform gamma correction */
  applyColorSpaceGamma(value: number, settings: ColorSpaceSettings): number {
    if (settings.inputSpace === settings.outputSpace && !settings.linearize) return value;
    const v = value / 255;
    // Linearize
    let linear: number;
    if (settings.inputSpace === 'log-c') linear = Math.pow(10, (v - 0.383) / 0.57) / 13.18;
    else if (settings.inputSpace === 's-log3') linear = Math.pow(10, (v - 0.4) / 0.5) / 15.85;
    else linear = Math.pow(v, settings.gamma);
    // Apply output gamma
    const output = Math.pow(Math.max(0, linear), 1 / settings.gamma);
    return Math.max(0, Math.min(255, output * 255));
  }

  /** Apply warp stabilization (simplified: estimate motion vectors and smooth) */
  estimateStabilizationTransform(frame1Data: Uint8ClampedArray, frame2Data: Uint8ClampedArray, width: number, height: number): { dx: number; dy: number } {
    // Simplified block matching: compare center block
    const blockSize = 32;
    const searchRange = 16;
    const cx = Math.floor(width / 2) - blockSize / 2;
    const cy = Math.floor(height / 2) - blockSize / 2;
    let bestDx = 0, bestDy = 0, bestSad = Infinity;
    for (let dy = -searchRange; dy <= searchRange; dy += 2) {
      for (let dx = -searchRange; dx <= searchRange; dx += 2) {
        let sad = 0;
        for (let by = 0; by < blockSize; by += 4) {
          for (let bx = 0; bx < blockSize; bx += 4) {
            const i1 = ((cy + by) * width + (cx + bx)) * 4;
            const i2 = ((cy + by + dy) * width + (cx + bx + dx)) * 4;
            if (i2 >= 0 && i2 + 3 < frame2Data.length) {
              sad += Math.abs(frame1Data[i1] - frame2Data[i2]);
            }
          }
        }
        if (sad < bestSad) { bestSad = sad; bestDx = dx; bestDy = dy; }
      }
    }
    return { dx: bestDx, dy: bestDy };
  }
}

export const colorGradingService = new ColorGradingService();
