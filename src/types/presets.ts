export type PresetType = 'color' | 'transition' | 'effect' | 'text' | 'export';

// Preset数据类型 - 根据类型不同可以是不同的结构
export interface PresetData {
  type?: PresetType;
  // 对于不同类型的preset，data字段包含不同的配置
  settings?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  type: PresetType;
  category: string;
  thumbnail?: string;
  data: PresetData;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface PresetCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
}

export const BUILT_IN_PRESETS: Preset[] = [];

export function createCustomPreset(
  name: string,
  description: string,
  type: PresetType,
  category: string,
  data: PresetData,
  tags: string[] = []
): Preset {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    type,
    category,
    tags,
    data,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function updatePreset(preset: Preset, updates: Partial<Preset>): Preset {
  return {
    ...preset,
    ...updates,
    updatedAt: Date.now(),
  };
}

export function filterPresets(
  presets: Preset[],
  filters: {
    type?: PresetType;
    category?: string;
    search?: string;
    tags?: string[];
  }
): Preset[] {
  return presets.filter(preset => {
    if (filters.type && preset.type !== filters.type) return false;
    if (filters.category && preset.category !== filters.category) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const matchName = preset.name.toLowerCase().includes(search);
      const matchDesc = preset.description.toLowerCase().includes(search);
      const matchTags = preset.tags.some(tag => tag.toLowerCase().includes(search));
      if (!matchName && !matchDesc && !matchTags) return false;
    }
    if (filters.tags && filters.tags.length > 0) {
      const hasAllTags = filters.tags.every(tag => 
        preset.tags.some(pt => pt.toLowerCase().includes(tag.toLowerCase()))
      );
      if (!hasAllTags) return false;
    }
    return true;
  });
}

export function getPresetCategories(presets: Preset[], type?: PresetType): PresetCategory[] {
  const filtered = type ? presets.filter(p => p.type === type) : presets;
  const categories = new Map<string, number>();
  
  filtered.forEach(preset => {
    const count = categories.get(preset.category) || 0;
    categories.set(preset.category, count + 1);
  });
  
  return Array.from(categories.entries()).map(([id, count]) => ({
    id,
    name: getCategoryName(id),
    icon: getCategoryIcon(id),
    count,
  }));
}

function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    color: '调色',
    transition: '转场',
    effect: '特效',
    text: '文字',
    export: '导出',
  };
  return names[category] || category;
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    color: '🎨',
    transition: '🎬',
    effect: '✨',
    text: '📝',
    export: '📤',
  };
  return icons[category] || '📦';
}
