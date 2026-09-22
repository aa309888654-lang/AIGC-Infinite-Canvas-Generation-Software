export type CollageLayoutPresetId =
  | 'horizontal-2'
  | 'vertical-2'
  | 'grid-2x2'
  | 'grid-2x3'
  | 'grid-3x2'
  | 'grid-3x3'
  | 'puzzle-2-rows'
  | 'puzzle-2-cols'
  | 'puzzle-3-rows'
  | 'puzzle-3-cols'
  | 'one-big-right'
  | 'one-big-bottom'
  | 'one-big-left'
  | 'one-big-top';

export type CollageAspectRatio = '1:1' | '3:4' | '4:3' | '16:9' | '9:16' | '4:5' | '2:1' | '1:2';

export type CollageBackground = string;

export type CollageExportResolution = '1K' | '2K' | '4K';

export type CollageFitMode = 'cover' | 'contain' | 'fill';

export type CollageLayoutMode = 'grid' | 'free';

export interface CollageFilters {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  grayscale?: number;
  sepia?: number;
}

export interface CollageItem {
  id: string;
  imageUrl: string;
  imageAssetId?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  fitMode?: CollageFitMode;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  filters?: CollageFilters;
}

export interface CollageTextOverlay {
  id: string;
  text: string;
  fontSize?: number;
  fontColor?: string;
  fontWeight?: string;
  x: number;
  y: number;
  align?: CanvasTextAlign;
  slotIndex?: number;
}

export interface CollageSlot {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  itemId?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface CollageLayoutParams {
  presetId: CollageLayoutPresetId;
  aspectRatio: CollageAspectRatio;
  gap: number;
  gapX?: number;
  gapY?: number;
  padding: number;
  background: CollageBackground;
  borderRadius: number;
  slotBorderRadius?: number[];
  borderWidth?: number;
  borderColor?: string;
  shadowBlur?: number;
  shadowColor?: string;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  exportResolution: CollageExportResolution;
  items: CollageItem[];
  textOverlays?: CollageTextOverlay[];
  layoutMode?: CollageLayoutMode;
  animate?: boolean;
}

export interface CollageTemplate {
  id: string;
  name: string;
  createdAt: number;
  params: CollageLayoutParams;
}

export const COLLAGE_DEFAULT_PARAMS: CollageLayoutParams = {
  presetId: 'grid-2x2',
  aspectRatio: '1:1',
  gap: 8,
  padding: 12,
  background: '#1a1a2e',
  borderRadius: 8,
  exportResolution: '2K',
  items: [],
  textOverlays: [],
  layoutMode: 'grid',
  animate: false,
};

export const COLLAGE_LAYOUT_PRESETS: Array<{
  id: CollageLayoutPresetId;
  label: string;
  icon: string;
  slots: CollageSlot[];
  minImages: number;
  maxImages: number;
}> = [
  {
    id: 'horizontal-2',
    label: '横排2图',
    icon: '⬜⬜',
    minImages: 2,
    maxImages: 2,
    slots: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
    ],
  },
  {
    id: 'vertical-2',
    label: '竖排2图',
    icon: '⬜\n⬜',
    minImages: 2,
    maxImages: 2,
    slots: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
    ],
  },
  {
    id: 'grid-2x2',
    label: '2×2网格',
    icon: '⊞',
    minImages: 4,
    maxImages: 4,
    slots: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
    ],
  },
  {
    id: 'grid-2x3',
    label: '2×3网格',
    icon: '⊞',
    minImages: 6,
    maxImages: 6,
    slots: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
    ],
  },
  {
    id: 'grid-3x2',
    label: '3×2网格',
    icon: '⊞',
    minImages: 6,
    maxImages: 6,
    slots: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
    ],
  },
  {
    id: 'grid-3x3',
    label: '3×3网格',
    icon: '⊞',
    minImages: 9,
    maxImages: 9,
    slots: Array.from({ length: 9 }, (_, i) => ({
      row: Math.floor(i / 3),
      col: i % 3,
      rowSpan: 1,
      colSpan: 1,
    })),
  },
  {
    id: 'puzzle-2-rows',
    label: '拼图2行',
    icon: '🧩',
    minImages: 3,
    maxImages: 3,
    slots: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
    ],
  },
  {
    id: 'puzzle-2-cols',
    label: '拼图2列',
    icon: '🧩',
    minImages: 3,
    maxImages: 3,
    slots: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
    ],
  },
  {
    id: 'puzzle-3-rows',
    label: '拼图3行',
    icon: '🧩',
    minImages: 4,
    maxImages: 4,
    slots: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 3 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
    ],
  },
  {
    id: 'puzzle-3-cols',
    label: '拼图3列',
    icon: '🧩',
    minImages: 4,
    maxImages: 4,
    slots: [
      { row: 0, col: 0, rowSpan: 3, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
    ],
  },
  {
    id: 'one-big-right',
    label: '左小右大',
    icon: '◧',
    minImages: 2,
    maxImages: 2,
    slots: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 2 },
    ],
  },
  {
    id: 'one-big-bottom',
    label: '上小下大',
    icon: '◨',
    minImages: 2,
    maxImages: 2,
    slots: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 2, colSpan: 1 },
    ],
  },
  {
    id: 'one-big-left',
    label: '左大右小',
    icon: '◧',
    minImages: 2,
    maxImages: 2,
    slots: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
    ],
  },
  {
    id: 'one-big-top',
    label: '上大下小',
    icon: '◨',
    minImages: 2,
    maxImages: 2,
    slots: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
    ],
  },
];

export const COLLAGE_ASPECT_RATIO_OPTIONS: Array<{ value: CollageAspectRatio; label: string }> = [
  { value: '1:1', label: '1:1 正方形' },
  { value: '3:4', label: '3:4 竖版' },
  { value: '4:3', label: '4:3 横版' },
  { value: '16:9', label: '16:9 宽屏' },
  { value: '9:16', label: '9:16 竖屏' },
  { value: '4:5', label: '4:5 社交' },
  { value: '2:1', label: '2:1 超宽' },
  { value: '1:2', label: '1:2 超高' },
];

export const COLLAGE_BACKGROUND_OPTIONS: Array<{ value: string; label: string; preview: string }> = [
  { value: 'transparent', label: '透明', preview: 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 12px 12px' },
  { value: '#000000', label: '纯黑', preview: '#000000' },
  { value: '#1a1a2e', label: '深蓝黑', preview: '#1a1a2e' },
  { value: '#ffffff', label: '纯白', preview: '#ffffff' },
  { value: '#f5f5f5', label: '浅灰', preview: '#f5f5f5' },
];

export const COLLAGE_EXPORT_RESOLUTION_OPTIONS: Array<{ value: CollageExportResolution; label: string; longSide: number }> = [
  { value: '1K', label: '1K', longSide: 1024 },
  { value: '2K', label: '2K', longSide: 2048 },
  { value: '4K', label: '4K', longSide: 4096 },
];

export const COLLAGE_FIT_MODE_OPTIONS: Array<{ value: CollageFitMode; label: string }> = [
  { value: 'cover', label: '覆盖 (Cover)' },
  { value: 'contain', label: '包含 (Contain)' },
  { value: 'fill', label: '填充 (Fill)' },
];

export const COLLAGE_TEMPLATE_STORAGE_KEY = 'collage_templates_v1';

export function parseAspectRatio(ratio: CollageAspectRatio = '1:1'): number {
  const safeRatio = typeof ratio === 'string' && ratio.includes(':') ? ratio : '1:1';
  const [w, h] = safeRatio.split(':').map(Number);
  return h ? w / h : 1;
}

export function resolveCollageExportSize(
  aspectRatio: CollageAspectRatio,
  resolution: CollageExportResolution,
): { width: number; height: number } {
  const ratio = parseAspectRatio(aspectRatio);
  const longSide = COLLAGE_EXPORT_RESOLUTION_OPTIONS.find((r) => r.value === resolution)?.longSide ?? 2048;
  if (ratio >= 1) {
    return { width: longSide, height: Math.round(longSide / ratio) };
  }
  return { width: Math.round(longSide * ratio), height: longSide };
}

export function getLayoutPreset(id: CollageLayoutPresetId) {
  return COLLAGE_LAYOUT_PRESETS.find((p) => p.id === id) ?? COLLAGE_LAYOUT_PRESETS[2];
}

export function getLayoutGridDimensions(preset: CollageLayoutPresetId): { rows: number; cols: number } {
  const p = getLayoutPreset(preset);
  let maxRow = 0;
  let maxCol = 0;
  for (const slot of p.slots) {
    maxRow = Math.max(maxRow, slot.row + slot.rowSpan);
    maxCol = Math.max(maxCol, slot.col + slot.colSpan);
  }
  return { rows: maxRow, cols: maxCol };
}

export function generateCollageItemId(): string {
  return `collage_item_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function generateCollageTextOverlayId(): string {
  return `collage_text_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function generateCollageTemplateId(): string {
  return `collage_tpl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function applyFilters(ctx: CanvasRenderingContext2D, filters?: CollageFilters) {
  if (!filters) return;
  const parts: string[] = [];
  if (filters.brightness !== undefined) parts.push(`brightness(${filters.brightness}%)`);
  if (filters.contrast !== undefined) parts.push(`contrast(${filters.contrast}%)`);
  if (filters.saturation !== undefined) parts.push(`saturate(${filters.saturation}%)`);
  if (filters.blur !== undefined) parts.push(`blur(${filters.blur}px)`);
  if (filters.grayscale !== undefined) parts.push(`grayscale(${filters.grayscale}%)`);
  if (filters.sepia !== undefined) parts.push(`sepia(${filters.sepia}%)`);
  if (parts.length > 0) {
    ctx.filter = parts.join(' ');
  }
}

function drawImageWithFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  slotX: number,
  slotY: number,
  slotW: number,
  slotH: number,
  fitMode: CollageFitMode = 'cover',
  scale: number = 1,
  offsetX: number = 0,
  offsetY: number = 0,
) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const slotRatio = slotW / slotH;
  let drawW: number, drawH: number, drawX: number, drawY: number;

  if (fitMode === 'fill') {
    drawW = slotW * scale;
    drawH = slotH * scale;
    drawX = slotX + (slotW - drawW) / 2 + offsetX;
    drawY = slotY + (slotH - drawH) / 2 + offsetY;
  } else if (fitMode === 'contain') {
    if (imgRatio > slotRatio) {
      drawW = slotW * scale;
      drawH = (slotW / imgRatio) * scale;
      drawX = slotX + (slotW - drawW) / 2 + offsetX;
      drawY = slotY + (slotH - drawH) / 2 + offsetY;
    } else {
      drawH = slotH * scale;
      drawW = (slotH * imgRatio) * scale;
      drawX = slotX + (slotW - drawW) / 2 + offsetX;
      drawY = slotY + (slotH - drawH) / 2 + offsetY;
    }
  } else {
    if (imgRatio > slotRatio) {
      drawH = slotH * scale;
      drawW = (slotH * imgRatio) * scale;
      drawX = slotX + (slotW - drawW) / 2 + offsetX;
      drawY = slotY + offsetY;
    } else {
      drawW = slotW * scale;
      drawH = (slotW / imgRatio) * scale;
      drawX = slotX + offsetX;
      drawY = slotY + (slotH - drawH) / 2 + offsetY;
    }
  }

  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

function drawSlotBorder(
  ctx: CanvasRenderingContext2D,
  slotX: number,
  slotY: number,
  slotW: number,
  slotH: number,
  borderWidth: number = 0,
  borderColor: string = '#ffffff',
  borderRadius: number = 0,
) {
  if (borderWidth <= 0) return;
  ctx.save();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;
  if (borderRadius > 0) {
    roundRect(ctx, slotX, slotY, slotW, slotH, borderRadius);
    ctx.stroke();
  } else {
    ctx.strokeRect(slotX, slotY, slotW, slotH);
  }
  ctx.restore();
}

function drawTextOverlays(
  ctx: CanvasRenderingContext2D,
  overlays: CollageTextOverlay[],
  slots: Array<{ x: number; y: number; width: number; height: number }>,
  scaleFactor: number = 1,
) {
  for (const overlay of overlays) {
    if (!overlay.text) continue;
    ctx.save();
    ctx.fillStyle = overlay.fontColor || '#ffffff';
    ctx.font = `${overlay.fontWeight || 'normal'} ${(overlay.fontSize || 24) * scaleFactor}px sans-serif`;
    ctx.textAlign = overlay.align || 'left';
    ctx.textBaseline = 'middle';

    let x = overlay.x * scaleFactor;
    let y = overlay.y * scaleFactor;

    if (overlay.slotIndex !== undefined && overlay.slotIndex >= 0 && overlay.slotIndex < slots.length) {
      const slot = slots[overlay.slotIndex];
      x += slot.x;
      y += slot.y;
    }

    ctx.fillText(overlay.text, x, y);
    ctx.restore();
  }
}

export async function renderCollageToCanvas(
  params: CollageLayoutParams,
  canvas?: HTMLCanvasElement,
): Promise<HTMLCanvasElement> {
  const preset = getLayoutPreset(params.presetId);
  const { rows, cols } = getLayoutGridDimensions(params.presetId);
  const exportSize = resolveCollageExportSize(params.aspectRatio, params.exportResolution);

  const totalWidth = exportSize.width;
  const totalHeight = exportSize.height;

  const padding = params.padding;
  const gapX = params.gapX ?? params.gap;
  const gapY = params.gapY ?? params.gap;
  const innerWidth = totalWidth - padding * 2;
  const innerHeight = totalHeight - padding * 2;
  const cellWidth = (innerWidth - gapX * (cols - 1)) / cols;
  const cellHeight = (innerHeight - gapY * (rows - 1)) / rows;

  const targetCanvas = canvas ?? document.createElement('canvas');
  targetCanvas.width = totalWidth;
  targetCanvas.height = totalHeight;
  const ctx = targetCanvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  if (params.background !== 'transparent') {
    ctx.fillStyle = params.background;
    ctx.fillRect(0, 0, totalWidth, totalHeight);
  } else {
    ctx.clearRect(0, 0, totalWidth, totalHeight);
  }

  const loadedImages = new Map<string, HTMLImageElement>();
  const urlsToLoad = params.items.filter((item) => item.imageUrl).map((item) => item.imageUrl);
  for (const url of urlsToLoad) {
    if (loadedImages.has(url)) continue;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    });
    loadedImages.set(url, img);
  }

  const slotPositions: Array<{ x: number; y: number; width: number; height: number }> = [];

  for (let i = 0; i < preset.slots.length; i++) {
    const slot = preset.slots[i];
    const item = params.items[i];

    const slotX = padding + slot.col * (cellWidth + gapX);
    const slotY = padding + slot.row * (cellHeight + gapY);
    const slotW = slot.colSpan * cellWidth + (slot.colSpan - 1) * gapX;
    const slotH = slot.rowSpan * cellHeight + (slot.rowSpan - 1) * gapY;

    slotPositions.push({ x: slotX, y: slotY, width: slotW, height: slotH });

    ctx.save();

    const slotRadius = params.slotBorderRadius?.[i] ?? params.borderRadius;

    if (slotRadius > 0) {
      roundRect(ctx, slotX, slotY, slotW, slotH, slotRadius);
      ctx.clip();
    }

    if (params.shadowBlur && params.shadowBlur > 0) {
      ctx.shadowColor = params.shadowColor || 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = params.shadowBlur;
      ctx.shadowOffsetX = params.shadowOffsetX || 0;
      ctx.shadowOffsetY = params.shadowOffsetY || 0;
    }

    if (item?.imageUrl) {
      const img = loadedImages.get(item.imageUrl);
      if (img && img.naturalWidth > 0) {
        applyFilters(ctx, item.filters);
        drawImageWithFit(
          ctx,
          img,
          slotX,
          slotY,
          slotW,
          slotH,
          item.fitMode || 'cover',
          item.scale ?? 1,
          item.offsetX ?? 0,
          item.offsetY ?? 0,
        );
        ctx.filter = 'none';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(slotX, slotY, slotW, slotH);
      }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(slotX, slotY, slotW, slotH);
    }

    ctx.restore();

    drawSlotBorder(
      ctx,
      slotX,
      slotY,
      slotW,
      slotH,
      params.borderWidth,
      params.borderColor,
      slotRadius,
    );
  }

  if (params.textOverlays && params.textOverlays.length > 0) {
    drawTextOverlays(ctx, params.textOverlays, slotPositions, 1);
  }

  return targetCanvas;
}

export async function renderCollageToBlob(
  params: CollageLayoutParams,
  type: string = 'image/png',
  quality: number = 0.92,
): Promise<string> {
  const canvas = await renderCollageToCanvas(params);
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(URL.createObjectURL(blob));
        } else {
          resolve(canvas.toDataURL(type, quality));
        }
      },
      type,
      quality,
    );
  });
}

export function resolveCollagePreviewLayout(
  params: CollageLayoutParams,
  containerWidth: number,
): {
  containerHeight: number;
  slots: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    itemIndex: number;
  }>;
} {
  const preset = getLayoutPreset(params.presetId);
  const { rows, cols } = getLayoutGridDimensions(params.presetId);
  const ratio = parseAspectRatio(params.aspectRatio);
  const containerHeight = containerWidth / ratio;

  const exportSize = resolveCollageExportSize(params.aspectRatio, params.exportResolution);
  const scaleFactor = containerWidth / exportSize.width;

  const padding = params.padding * scaleFactor;
  const gapX = (params.gapX ?? params.gap) * scaleFactor;
  const gapY = (params.gapY ?? params.gap) * scaleFactor;
  const innerWidth = containerWidth - padding * 2;
  const innerHeight = containerHeight - padding * 2;
  const cellWidth = (innerWidth - gapX * (cols - 1)) / cols;
  const cellHeight = (innerHeight - gapY * (rows - 1)) / rows;

  const slots = preset.slots.map((slot, i) => ({
    x: padding + slot.col * (cellWidth + gapX),
    y: padding + slot.row * (cellHeight + gapY),
    width: slot.colSpan * cellWidth + (slot.colSpan - 1) * gapX,
    height: slot.rowSpan * cellHeight + (slot.rowSpan - 1) * gapY,
    itemIndex: i,
  }));

  return { containerHeight, slots };
}

export function saveTemplate(name: string, params: CollageLayoutParams): CollageTemplate {
  const template: CollageTemplate = {
    id: generateCollageTemplateId(),
    name,
    createdAt: Date.now(),
    params: JSON.parse(JSON.stringify(params)),
  };

  const existing = loadTemplates();
  existing.push(template);
  localStorage.setItem(COLLAGE_TEMPLATE_STORAGE_KEY, JSON.stringify(existing));

  return template;
}

export function loadTemplates(): CollageTemplate[] {
  try {
    const raw = localStorage.getItem(COLLAGE_TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CollageTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadTemplateById(id: string): CollageTemplate | undefined {
  return loadTemplates().find((t) => t.id === id);
}

export function deleteTemplate(id: string): boolean {
  const existing = loadTemplates();
  const filtered = existing.filter((t) => t.id !== id);
  if (filtered.length === existing.length) return false;
  localStorage.setItem(COLLAGE_TEMPLATE_STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

export function updateTemplate(id: string, updates: Partial<Omit<CollageTemplate, 'id' | 'createdAt'>>): CollageTemplate | undefined {
  const existing = loadTemplates();
  const idx = existing.findIndex((t) => t.id === id);
  if (idx === -1) return undefined;

  existing[idx] = {
    ...existing[idx],
    ...updates,
    params: updates.params ? { ...existing[idx].params, ...updates.params } : existing[idx].params,
  };
  localStorage.setItem(COLLAGE_TEMPLATE_STORAGE_KEY, JSON.stringify(existing));
  return existing[idx];
}
