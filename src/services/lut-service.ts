/**
 * LUT (Look-Up Table) 服务
 * 提供 LUT 文件加载、应用、转换和管理功能
 */
import { generateId } from '@/lib/utils';

export type LUTFormat = 'cube' | '3dl' | 'look' | 'mga';
export type LUTColorSpace = 'sRGB' | 'Rec.709' | 'DCI-P3' | 'ACES' | 'Log';

export interface LUTMetadata {
  title: string;
  manufacturer: string;
  description: string;
  version: string;
  colorSpace: LUTColorSpace;
  inputColorSpace?: LUTColorSpace;
  outputColorSpace?: LUTColorSpace;
}

export interface LUT {
  id: string;
  name: string;
  metadata: LUTMetadata;
  size: number;
  format: LUTFormat;
  data: Float32Array;
  url?: string;
}

export interface LUTPreset {
  id: string;
  name: string;
  description: string;
  category: 'cinematic' | 'commercial' | 'creative' | 'broadcast';
  intensity: number;
  lut: LUT;
}

export interface LUTApplicationSettings {
  lut: LUT;
  intensity: number;
  beforeAfter: 'before' | 'after';
  colorSpaceConversion?: {
    input: LUTColorSpace;
    output: LUTColorSpace;
  };
}

class LUTService {
  private builtInLUTs: Map<string, LUT> = new Map();
  private customLUTs: Map<string, LUT> = new Map();
  private lutCache: Map<string, Float32Array> = new Map();

  private readonly DEFAULT_LUT_SIZE = 33;

  constructor() {
    this.initializeBuiltInLUTs();
  }

  private initializeBuiltInLUTs(): void {
    const identityLUT = this.createIdentityLUT();
    this.builtInLUTs.set('identity', identityLUT);

    const warmLUT = this.createWarmLUT();
    this.builtInLUTs.set('warm', warmLUT);

    const coolLUT = this.createCoolLUT();
    this.builtInLUTs.set('cool', coolLUT);

    const highContrastLUT = this.createHighContrastLUT();
    this.builtInLUTs.set('high-contrast', highContrastLUT);

    const vintageLUT = this.createVintageLUT();
    this.builtInLUTs.set('vintage', vintageLUT);

    const blackAndWhiteLUT = this.createBlackAndWhiteLUT();
    this.builtInLUTs.set('bw', blackAndWhiteLUT);
  }

  private createIdentityLUT(): LUT {
    const size = this.DEFAULT_LUT_SIZE;
    const data = new Float32Array(size * size * size * 3);

    let index = 0;
    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          data[index++] = r / (size - 1);
          data[index++] = g / (size - 1);
          data[index++] = b / (size - 1);
        }
      }
    }

    return {
      id: 'identity',
      name: '恒等变换',
      metadata: {
        title: 'Identity',
        manufacturer: 'System',
        description: '不做任何修改的恒等LUT',
        version: '1.0',
        colorSpace: 'sRGB'
      },
      size,
      format: 'cube',
      data
    };
  }

  private createWarmLUT(): LUT {
    const size = this.DEFAULT_LUT_SIZE;
    const data = new Float32Array(size * size * size * 3);

    let index = 0;
    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          let rVal = r / (size - 1);
          let gVal = g / (size - 1);
          let bVal = b / (size - 1);

          rVal = Math.min(1, rVal * 1.1);
          gVal = gVal * 1.02;
          bVal = bVal * 0.9;

          data[index++] = rVal;
          data[index++] = gVal;
          data[index++] = bVal;
        }
      }
    }

    return {
      id: 'warm',
      name: '暖色调',
      metadata: {
        title: 'Warm Tone',
        manufacturer: 'System',
        description: '增加画面暖色调',
        version: '1.0',
        colorSpace: 'sRGB'
      },
      size,
      format: 'cube',
      data
    };
  }

  private createCoolLUT(): LUT {
    const size = this.DEFAULT_LUT_SIZE;
    const data = new Float32Array(size * size * size * 3);

    let index = 0;
    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          let rVal = r / (size - 1);
          let gVal = g / (size - 1);
          let bVal = b / (size - 1);

          rVal = rVal * 0.9;
          gVal = gVal * 0.98;
          bVal = Math.min(1, bVal * 1.1);

          data[index++] = rVal;
          data[index++] = gVal;
          data[index++] = bVal;
        }
      }
    }

    return {
      id: 'cool',
      name: '冷色调',
      metadata: {
        title: 'Cool Tone',
        manufacturer: 'System',
        description: '增加画面冷色调',
        version: '1.0',
        colorSpace: 'sRGB'
      },
      size,
      format: 'cube',
      data
    };
  }

  private createHighContrastLUT(): LUT {
    const size = this.DEFAULT_LUT_SIZE;
    const data = new Float32Array(size * size * size * 3);

    const contrastCurve = (x: number): number => {
      const midpoint = 0.5;
      const factor = 1.2;
      return midpoint + (x - midpoint) * factor;
    };

    let index = 0;
    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          data[index++] = Math.max(0, Math.min(1, contrastCurve(r / (size - 1))));
          data[index++] = Math.max(0, Math.min(1, contrastCurve(g / (size - 1))));
          data[index++] = Math.max(0, Math.min(1, contrastCurve(b / (size - 1))));
        }
      }
    }

    return {
      id: 'high-contrast',
      name: '高对比度',
      metadata: {
        title: 'High Contrast',
        manufacturer: 'System',
        description: '增强画面对比度',
        version: '1.0',
        colorSpace: 'sRGB'
      },
      size,
      format: 'cube',
      data
    };
  }

  private createVintageLUT(): LUT {
    const size = this.DEFAULT_LUT_SIZE;
    const data = new Float32Array(size * size * size * 3);

    let index = 0;
    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          let rVal = r / (size - 1);
          let gVal = g / (size - 1);
          let bVal = b / (size - 1);

          const avg = (rVal + gVal + bVal) / 3;
          rVal = rVal * 0.9 + avg * 0.1;
          gVal = gVal * 0.85 + avg * 0.15;
          bVal = bVal * 0.75 + avg * 0.25;

          rVal = Math.pow(rVal, 1.05);
          gVal = Math.pow(gVal, 1.05);
          bVal = Math.pow(bVal, 1.1);

          data[index++] = Math.max(0, Math.min(1, rVal));
          data[index++] = Math.max(0, Math.min(1, gVal));
          data[index++] = Math.max(0, Math.min(1, bVal));
        }
      }
    }

    return {
      id: 'vintage',
      name: '复古风格',
      metadata: {
        title: 'Vintage',
        manufacturer: 'System',
        description: '复古胶片风格',
        version: '1.0',
        colorSpace: 'sRGB'
      },
      size,
      format: 'cube',
      data
    };
  }

  private createBlackAndWhiteLUT(): LUT {
    const size = this.DEFAULT_LUT_SIZE;
    const data = new Float32Array(size * size * size * 3);

    let index = 0;
    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          const rVal = r / (size - 1);
          const gVal = g / (size - 1);
          const bVal = b / (size - 1);

          const gray = 0.2989 * rVal + 0.5870 * gVal + 0.1140 * bVal;

          data[index++] = gray;
          data[index++] = gray;
          data[index++] = gray;
        }
      }
    }

    return {
      id: 'bw',
      name: '黑白',
      metadata: {
        title: 'Black & White',
        manufacturer: 'System',
        description: '转换为黑白图像',
        version: '1.0',
        colorSpace: 'sRGB'
      },
      size,
      format: 'cube',
      data
    };
  }

  getBuiltInLUTs(): LUT[] {
    return Array.from(this.builtInLUTs.values());
  }

  getCustomLUTs(): LUT[] {
    return Array.from(this.customLUTs.values());
  }

  getAllLUTs(): LUT[] {
    return [...this.getBuiltInLUTs(), ...this.getCustomLUTs()];
  }

  getLUT(id: string): LUT | undefined {
    return this.builtInLUTs.get(id) || this.customLUTs.get(id);
  }

  async parseCubeFile(content: string): Promise<LUT> {
    const lines = content.split('\n');
    let size = 0;
    let title = '';
    const metadata: Partial<LUTMetadata> = {};
    const dataLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('TITLE')) {
        title = trimmed.substring(5).trim().replace(/"/g, '');
      } else if (trimmed.startsWith('LUT_3D_SIZE')) {
        size = parseInt(trimmed.substring(12).trim(), 10);
      } else if (trimmed.startsWith('DOMAIN_MIN')) {
        // Optional domain specification
      } else if (trimmed.startsWith('DOMAIN_MAX')) {
        // Optional domain specification
      } else if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 3) {
          const r = parseFloat(parts[0]);
          const g = parseFloat(parts[1]);
          const b = parseFloat(parts[2]);

          if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
            dataLines.push(trimmed);
          }
        }
      }
    }

    if (size === 0) {
      size = Math.round(Math.pow(dataLines.length, 1/3));
    }

    const data = new Float32Array(size * size * size * 3);
    let index = 0;

    for (const line of dataLines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3 && index < data.length) {
        data[index++] = parseFloat(parts[0]);
        data[index++] = parseFloat(parts[1]);
        data[index++] = parseFloat(parts[2]);
      }
    }

    return {
      id: generateId(),
      name: title || '自定义LUT',
      metadata: {
        title: title || 'Custom LUT',
        manufacturer: metadata.manufacturer || 'Unknown',
        description: metadata.description || '',
        version: metadata.version || '1.0',
        colorSpace: metadata.colorSpace || 'sRGB'
      },
      size,
      format: 'cube',
      data
    };
  }

  async loadLUTFile(file: File): Promise<LUT> {
    const content = await file.text();
    const extension = file.name.split('.').pop()?.toLowerCase();

    let lut: LUT;

    switch (extension) {
      case 'cube':
        lut = await this.parseCubeFile(content);
        break;
      case '3dl':
        lut = await this.parse3DLFile(content);
        break;
      default:
        throw new Error(`不支持的LUT格式: ${extension}`);
    }

    lut.name = file.name.replace(/\.[^/.]+$/, '');
    this.customLUTs.set(lut.id, lut);

    return lut;
  }

  private async parse3DLFile(content: string): Promise<LUT> {
    const lines = content.split('\n');
    let size = 0;
    const dataLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 3) {
          const first = parseInt(parts[0], 10);
          if (!isNaN(first) && first >= 0 && first <= 4095) {
            if (size === 0) {
              size = 17;
            }
            dataLines.push(trimmed);
          }
        }
      }
    }

    if (size === 0) {
      size = 17;
    }

    const data = new Float32Array(size * size * size * 3);
    let index = 0;

    for (const line of dataLines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3 && index < data.length) {
        const r = parseInt(parts[0], 10) / 4095;
        const g = parseInt(parts[1], 10) / 4095;
        const b = parseInt(parts[2], 10) / 4095;

        data[index++] = r;
        data[index++] = g;
        data[index++] = b;
      }
    }

    return {
      id: generateId(),
      name: '3DL LUT',
      metadata: {
        title: '3DL LUT',
        manufacturer: 'Unknown',
        description: '从3DL文件导入',
        version: '1.0',
        colorSpace: 'sRGB'
      },
      size,
      format: '3dl',
      data
    };
  }

  applyLUTToColor(r: number, g: number, b: number, lut: LUT): { r: number; g: number; b: number } {
    const { size, data } = lut;

    const rIndex = Math.max(0, Math.min(size - 1, Math.floor(r * (size - 1))));
    const gIndex = Math.max(0, Math.min(size - 1, Math.floor(g * (size - 1))));
    const bIndex = Math.max(0, Math.min(size - 1, Math.floor(b * (size - 1))));

    const index = (bIndex * size * size + gIndex * size + rIndex) * 3;

    return {
      r: Math.max(0, Math.min(1, data[index])),
      g: Math.max(0, Math.min(1, data[index + 1])),
      b: Math.max(0, Math.min(1, data[index + 2]))
    };
  }

  applyLUTToImageData(imageData: ImageData, lut: LUT, intensity: number = 1): ImageData {
    const data = imageData.data;
    const result = new ImageData(new Uint8ClampedArray(data), imageData.width, imageData.height);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;

      const lutColor = this.applyLUTToColor(r, g, b, lut);

      const finalR = r + (lutColor.r - r) * intensity;
      const finalG = g + (lutColor.g - g) * intensity;
      const finalB = b + (lutColor.b - b) * intensity;

      result.data[i] = Math.round(finalR * 255);
      result.data[i + 1] = Math.round(finalG * 255);
      result.data[i + 2] = Math.round(finalB * 255);
      result.data[i + 3] = data[i + 3];
    }

    return result;
  }

  blendLUTs(lut1: LUT, lut2: LUT, ratio: number): LUT {
    const size = Math.max(lut1.size, lut2.size);
    const data = new Float32Array(size * size * size * 3);

    for (let i = 0; i < size * size * size; i++) {
      const index = i * 3;
      const r1 = i < lut1.data.length / 3 ? lut1.data[index] : index / (size - 1);
      const g1 = i < lut1.data.length / 3 ? lut1.data[index + 1] : index / (size - 1);
      const b1 = i < lut1.data.length / 3 ? lut1.data[index + 2] : index / (size - 1);

      const r2 = i < lut2.data.length / 3 ? lut2.data[index] : index / (size - 1);
      const g2 = i < lut2.data.length / 3 ? lut2.data[index + 1] : index / (size - 1);
      const b2 = i < lut2.data.length / 3 ? lut2.data[index + 2] : index / (size - 1);

      data[index] = r1 + (r2 - r1) * ratio;
      data[index + 1] = g1 + (g2 - g1) * ratio;
      data[index + 2] = b1 + (b2 - b1) * ratio;
    }

    return {
      id: generateId(),
      name: `混合 LUT (${Math.round(ratio * 100)}%)`,
      metadata: {
        title: 'Blended LUT',
        manufacturer: 'System',
        description: `混合了两个LUT，比例为${Math.round(ratio * 100)}:%${Math.round((1 - ratio) * 100)}`,
        version: '1.0',
        colorSpace: lut1.metadata.colorSpace
      },
      size,
      format: 'cube',
      data
    };
  }

  exportToCube(lut: LUT): string {
    const { size, data, name } = lut;

    let output = `TITLE "${name}"\n`;
    output += `LUT_3D_SIZE ${size}\n`;
    output += `DOMAIN_MIN 0.0 0.0 0.0\n`;
    output += `DOMAIN_MAX 1.0 1.0 1.0\n`;

    let index = 0;
    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          output += `${data[index].toFixed(6)} ${data[index + 1].toFixed(6)} ${data[index + 2].toFixed(6)}\n`;
          index += 3;
        }
      }
    }

    return output;
  }

  deleteCustomLUT(id: string): boolean {
    return this.customLUTs.delete(id);
  }

  createPreset(lut: LUT, name: string, category: LUTPreset['category'], intensity: number = 1): LUTPreset {
    return {
      id: generateId(),
      name,
      description: lut.metadata.description,
      category,
      intensity,
      lut
    };
  }

  getLUTPresets(): LUTPreset[] {
    return this.getBuiltInLUTs().map(lut => ({
      id: lut.id,
      name: lut.name,
      description: lut.metadata.description,
      category: 'creative' as LUTPreset['category'],
      intensity: 1,
      lut
    }));
  }

  interpolateLUT(lut: LUT, targetLUT: LUT, progress: number): LUT {
    const { size, data } = lut;
    const targetData = targetLUT.data;
    const resultData = new Float32Array(size * size * size * 3);

    for (let i = 0; i < data.length; i++) {
      const targetIndex = i < targetData.length ? i : 0;
      resultData[i] = data[i] + (targetData[targetIndex] - data[i]) * progress;
    }

    return {
      id: generateId(),
      name: `插值 LUT (${Math.round(progress * 100)}%)`,
      metadata: {
        ...lut.metadata,
        title: `Interpolated LUT ${Math.round(progress * 100)}%`
      },
      size,
      format: lut.format,
      data: resultData
    };
  }

  async applyLUTToCanvas(
    canvas: HTMLCanvasElement,
    lut: LUT,
    intensity: number = 1
  ): Promise<void> {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const processed = this.applyLUTToImageData(imageData, lut, intensity);
    ctx.putImageData(processed, 0, 0);
  }

  resizeLUT(lut: LUT, newSize: number): LUT {
    const oldSize = lut.size;
    const oldData = lut.data;
    const newData = new Float32Array(newSize * newSize * newSize * 3);

    for (let b = 0; b < newSize; b++) {
      for (let g = 0; g < newSize; g++) {
        for (let r = 0; r < newSize; r++) {
          const oldR = (r / (newSize - 1)) * (oldSize - 1);
          const oldG = (g / (newSize - 1)) * (oldSize - 1);
          const oldB = (b / (newSize - 1)) * (oldSize - 1);

          const r0 = Math.floor(oldR);
          const g0 = Math.floor(oldG);
          const b0 = Math.floor(oldB);
          const r1 = Math.min(r0 + 1, oldSize - 1);
          const g1 = Math.min(g0 + 1, oldSize - 1);
          const b1 = Math.min(b0 + 1, oldSize - 1);

          const rFrac = oldR - r0;
          const gFrac = oldG - g0;
          const bFrac = oldB - b0;

          const index000 = (b0 * oldSize * oldSize + g0 * oldSize + r0) * 3;
          const index001 = (b0 * oldSize * oldSize + g0 * oldSize + r1) * 3;
          const index010 = (b0 * oldSize * oldSize + g1 * oldSize + r0) * 3;
          const index011 = (b0 * oldSize * oldSize + g1 * oldSize + r1) * 3;
          const index100 = (b1 * oldSize * oldSize + g0 * oldSize + r0) * 3;
          const index101 = (b1 * oldSize * oldSize + g0 * oldSize + r1) * 3;
          const index110 = (b1 * oldSize * oldSize + g1 * oldSize + r0) * 3;
          const index111 = (b1 * oldSize * oldSize + g1 * oldSize + r1) * 3;

          const newIndex = (b * newSize * newSize + g * newSize + r) * 3;

          for (let c = 0; c < 3; c++) {
            const c000 = oldData[index000 + c];
            const c001 = oldData[index001 + c];
            const c010 = oldData[index010 + c];
            const c011 = oldData[index011 + c];
            const c100 = oldData[index100 + c];
            const c101 = oldData[index101 + c];
            const c110 = oldData[index110 + c];
            const c111 = oldData[index111 + c];

            const c00 = c000 + (c001 - c000) * rFrac;
            const c01 = c010 + (c011 - c010) * rFrac;
            const c10 = c100 + (c101 - c100) * rFrac;
            const c11 = c110 + (c111 - c110) * rFrac;

            const c0 = c00 + (c01 - c00) * gFrac;
            const c1 = c10 + (c11 - c10) * gFrac;

            newData[newIndex + c] = c0 + (c1 - c0) * bFrac;
          }
        }
      }
    }

    return {
      ...lut,
      id: generateId(),
      name: `${lut.name} (${newSize}x${newSize}x${newSize})`,
      size: newSize,
      data: newData
    };
  }
}

export const lutService = new LUTService();
