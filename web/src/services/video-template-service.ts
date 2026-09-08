import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type TemplateCategory =
  | 'vlog'
  | 'tiktok'
  | 'youtube'
  | 'instagram'
  | 'business'
  | 'education'
  | 'entertainment'
  | 'music'
  | 'travel'
  | 'food'
  | 'fitness'
  | 'gaming';

export type TemplateAspect = '16:9' | '9:16' | '1:1' | '4:3' | '21:9';

export interface TemplateClip {
  id: string;
  slotIndex: number;
  type: 'video' | 'image' | 'text';
  placeholder: string;
  duration: number;
  position: { x: number; y: number };
  scale: number;
  rotation: number;
  opacity: number;
  effects: string[];
  transitions: {
    in?: string;
    out?: string;
  };
}

export interface TemplateText {
  id: string;
  content: string;
  placeholder: string;
  font: string;
  fontSize: number;
  color: string;
  position: { x: number; y: number };
  animation: string;
  duration: number;
  startTime: number;
}

export interface TemplateAudio {
  id: string;
  type: 'music' | 'sfx';
  url?: string;
  name: string;
  volume: number;
  startTime: number;
  duration: number;
  fadeIn: number;
  fadeOut: number;
}

export interface VideoTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  aspectRatio: TemplateAspect;
  duration: number;
  thumbnail: string;
  preview?: string;
  clips: TemplateClip[];
  texts: TemplateText[];
  audio: TemplateAudio[];
  tags: string[];
  isPremium: boolean;
  useCount: number;
  createdAt: Date;
  author?: string;
}

export interface UserTemplate extends VideoTemplate {
  userId: string;
  isCustom: boolean;
  originalTemplateId?: string;
}

export interface TemplateState {
  templates: VideoTemplate[];
  userTemplates: UserTemplate[];
  favorites: string[];
  recentUsed: string[];
  selectedCategory: TemplateCategory | 'all';
  selectedAspect: TemplateAspect | 'all';
  searchQuery: string;
  isLoading: boolean;
}

interface TemplateStore extends TemplateState {
  loadTemplates: () => void;
  loadUserTemplates: () => void;

  applyTemplate: (templateId: string, mediaFiles: File[]) => Promise<void>;
  duplicateTemplate: (templateId: string) => UserTemplate;
  createUserTemplate: (template: Omit<UserTemplate, 'id' | 'userId' | 'isCustom'>) => void;
  deleteUserTemplate: (templateId: string) => void;

  addToFavorites: (templateId: string) => void;
  removeFromFavorites: (templateId: string) => void;
  toggleFavorite: (templateId: string) => void;

  addToRecent: (templateId: string) => void;

  setSelectedCategory: (category: TemplateCategory | 'all') => void;
  setSelectedAspect: (aspect: TemplateAspect | 'all') => void;
  setSearchQuery: (query: string) => void;

  getTemplatesByCategory: (category: TemplateCategory) => VideoTemplate[];
  getFavoriteTemplates: () => VideoTemplate[];
  getRecentTemplates: () => VideoTemplate[];
  searchTemplates: (query: string) => VideoTemplate[];
}

const CATEGORY_NAMES: Record<TemplateCategory, string> = {
  vlog: 'Vlog',
  tiktok: '抖音风格',
  youtube: 'YouTube',
  instagram: 'Instagram',
  business: '商业',
  education: '教育',
  entertainment: '娱乐',
  music: '音乐',
  travel: '旅行',
  food: '美食',
  fitness: '健身',
  gaming: '游戏',
};

const ASPECT_NAMES: Record<TemplateAspect, string> = {
  '16:9': '横屏 16:9',
  '9:16': '竖屏 9:16',
  '1:1': '方形 1:1',
  '4:3': '传统 4:3',
  '21:9': '超宽 21:9',
};

const BUILTIN_TEMPLATES: VideoTemplate[] = [];

export const useTemplateStore = create<TemplateStore>()(
  immer((set, get) => ({
    templates: BUILTIN_TEMPLATES,
    userTemplates: [],
    favorites: [],
    recentUsed: [],
    selectedCategory: 'all',
    selectedAspect: 'all',
    searchQuery: '',
    isLoading: false,

    loadTemplates: () => {
      set((state) => {
        state.isLoading = true;
      });

      setTimeout(() => {
        set((state) => {
          state.templates = BUILTIN_TEMPLATES;
          state.isLoading = false;
        });
      }, 500);
    },

    loadUserTemplates: () => {
      set((state) => {
        state.userTemplates = [];
      });
    },

    applyTemplate: async (templateId, _mediaFiles) => {
      const state = get();
      const template =
        state.templates.find((t) => t.id === templateId) ||
        state.userTemplates.find((t) => t.id === templateId);

      if (!template) return;

      set((s) => {
        s.recentUsed = s.recentUsed.filter((id) => id !== templateId);
        s.recentUsed.unshift(templateId);
      });

      // console.log('Applying template:', template, 'with files:', mediaFiles);
    },

    duplicateTemplate: (templateId) => {
      const state = get();
      const template = state.templates.find((t) => t.id === templateId);

      if (!template) {
        throw new Error('Template not found');
      }

      const userTemplate: UserTemplate = {
        ...template,
        id: `user-template-${Date.now()}`,
        userId: 'current-user',
        isCustom: true,
        originalTemplateId: templateId,
      };

      set((s) => {
        s.userTemplates.push(userTemplate);
      });

      return userTemplate;
    },

    createUserTemplate: (templateData) => {
      const userTemplate: UserTemplate = {
        ...templateData,
        id: `user-template-${Date.now()}`,
        userId: 'current-user',
        isCustom: true,
      };

      set((s) => {
        s.userTemplates.push(userTemplate);
      });
    },

    deleteUserTemplate: (templateId) => {
      set((s) => {
        s.userTemplates = s.userTemplates.filter((t) => t.id !== templateId);
      });
    },

    addToFavorites: (templateId) => {
      set((s) => {
        if (!s.favorites.includes(templateId)) {
          s.favorites.push(templateId);
        }
      });
    },

    removeFromFavorites: (templateId) => {
      set((s) => {
        s.favorites = s.favorites.filter((id) => id !== templateId);
      });
    },

    toggleFavorite: (templateId) => {
      set((s) => {
        const index = s.favorites.indexOf(templateId);
        if (index === -1) {
          s.favorites.push(templateId);
        } else {
          s.favorites.splice(index, 1);
        }
      });
    },

    addToRecent: (templateId) => {
      set((s) => {
        s.recentUsed = s.recentUsed.filter((id) => id !== templateId);
        s.recentUsed.unshift(templateId);
        if (s.recentUsed.length > 10) {
          s.recentUsed = s.recentUsed.slice(0, 10);
        }
      });
    },

    setSelectedCategory: (category) => {
      set((s) => {
        s.selectedCategory = category;
      });
    },

    setSelectedAspect: (aspect) => {
      set((s) => {
        s.selectedAspect = aspect;
      });
    },

    setSearchQuery: (query) => {
      set((s) => {
        s.searchQuery = query;
      });
    },

    getTemplatesByCategory: (category) => {
      const state = get();
      return state.templates.filter((t) => t.category === category);
    },

    getFavoriteTemplates: () => {
      const state = get();
      return state.templates.filter((t) => state.favorites.includes(t.id));
    },

    getRecentTemplates: () => {
      const state = get();
      return state.recentUsed
        .map((id) => state.templates.find((t) => t.id === id))
        .filter(Boolean) as VideoTemplate[];
    },

    searchTemplates: (query) => {
      const state = get();
      const lowerQuery = query.toLowerCase();
      return state.templates.filter(
        (t) =>
          t.name.toLowerCase().includes(lowerQuery) ||
          t.description.toLowerCase().includes(lowerQuery) ||
          t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
      );
    },
  }))
);

export class TemplateService {
  private static instance: TemplateService;

  static getInstance(): TemplateService {
    if (!TemplateService.instance) {
      TemplateService.instance = new TemplateService();
    }
    return TemplateService.instance;
  }

  getCategoryName(category: TemplateCategory): string {
    return CATEGORY_NAMES[category];
  }

  getAspectName(aspect: TemplateAspect): string {
    return ASPECT_NAMES[aspect];
  }

  getAllCategories(): { id: TemplateCategory | 'all'; name: string }[] {
    return [
      { id: 'all', name: '全部' },
      ...Object.entries(CATEGORY_NAMES).map(([id, name]) => ({
        id: id as TemplateCategory,
        name,
      })),
    ];
  }

  getAllAspects(): { id: TemplateAspect | 'all'; name: string }[] {
    return [
      { id: 'all', name: '全部' },
      ...Object.entries(ASPECT_NAMES).map(([id, name]) => ({
        id: id as TemplateAspect,
        name,
      })),
    ];
  }

  getAspectDimensions(aspect: TemplateAspect): { width: number; height: number } {
    const dimensions: Record<TemplateAspect, { width: number; height: number }> = {
      '16:9': { width: 1920, height: 1080 },
      '9:16': { width: 1080, height: 1920 },
      '1:1': { width: 1080, height: 1080 },
      '4:3': { width: 1440, height: 1080 },
      '21:9': { width: 2560, height: 1080 },
    };
    return dimensions[aspect];
  }

  async exportTemplate(template: VideoTemplate): Promise<Blob> {
    const templateJson = JSON.stringify(template, null, 2);
    return new Blob([templateJson], { type: 'application/json' });
  }

  async importTemplate(file: File): Promise<VideoTemplate> {
    const content = await file.text();
    const template = JSON.parse(content) as VideoTemplate;
    template.id = `imported-${Date.now()}`;
    return template;
  }
}

export const templateService = TemplateService.getInstance();
