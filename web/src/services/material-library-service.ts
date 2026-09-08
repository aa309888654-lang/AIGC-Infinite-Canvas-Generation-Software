import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type StickerCategory = 
  | 'emoji'
  | 'arrow'
  | 'shape'
  | 'text'
  | 'social'
  | 'nature'
  | 'animal'
  | 'food'
  | 'sport'
  | 'music'
  | 'holiday'
  | 'decorative';

export type MaterialType = 
  | 'sticker'
  | 'emoji'
  | 'gif'
  | 'overlay'
  | 'background'
  | 'transition'
  | 'effect'
  | 'sound'
  | 'music'
  | 'font';

export interface Sticker {
  id: string;
  name: string;
  category: StickerCategory;
  type: MaterialType;
  url: string;
  thumbnail?: string;
  width: number;
  height: number;
  tags: string[];
  isAnimated: boolean;
  isPremium: boolean;
  downloadCount: number;
  createdAt: Date;
}

export interface MaterialPack {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  materials: Sticker[];
  isPremium: boolean;
  category: string;
  downloadUrl?: string;
}

export interface MaterialLibraryState {
  stickers: Sticker[];
  materialPacks: MaterialPack[];
  favorites: string[];
  recentUsed: string[];
  searchQuery: string;
  selectedCategory: StickerCategory | 'all';
  isLoading: boolean;
}

interface MaterialLibraryStore extends MaterialLibraryState {
  loadStickers: () => void;
  loadMaterialPacks: () => void;
  
  addSticker: (sticker: Sticker) => void;
  removeSticker: (stickerId: string) => void;
  
  addToFavorites: (stickerId: string) => void;
  removeFromFavorites: (stickerId: string) => void;
  toggleFavorite: (stickerId: string) => void;
  
  addToRecent: (stickerId: string) => void;
  clearRecent: () => void;
  
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: StickerCategory | 'all') => void;
  
  getStickersByCategory: (category: StickerCategory) => Sticker[];
  getFavoriteStickers: () => Sticker[];
  getRecentStickers: () => Sticker[];
  searchStickers: (query: string) => Sticker[];
}

const CATEGORY_NAMES: Record<StickerCategory, string> = {
  emoji: '表情',
  arrow: '箭头',
  shape: '形状',
  text: '文字',
  social: '社交',
  nature: '自然',
  animal: '动物',
  food: '食物',
  sport: '运动',
  music: '音乐',
  holiday: '节日',
  decorative: '装饰',
};

const BUILTIN_STICKERS: Sticker[] = [
  {
    id: 'sticker-emoji-1',
    name: '笑脸',
    category: 'emoji',
    type: 'sticker',
    url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0NSIgZmlsbD0iI0ZGRDUwMCIvPjxjaXJjbGUgY3g9IjM1IiBjeT0iNDAiIHI9IjUiIGZpbGw9IiMzMzMiLz48Y2lyY2xlIGN4PSI2NSIgY3k9IjQwIiByPSI1IiBmaWxsPSIjMzMzIi8+PHBhdGggZD0iTTMwIDYwIFE1MCA4MCA3MCA2MCIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjMiIGZpbGw9Im5vbmUiLz48L3N2Zz4=',
    width: 100,
    height: 100,
    tags: ['开心', '快乐', '微笑'],
    isAnimated: false,
    isPremium: false,
    downloadCount: 1000,
    createdAt: new Date(),
  },
  {
    id: 'sticker-emoji-2',
    name: '爱心',
    category: 'emoji',
    type: 'sticker',
    url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBkPSJNNTAgODUgTDEwIDQ1IEMxIDI1IDI1IDEgNTAgMjAgQzc1IDEgOTkgMjUgOTAgNDUgWiIgZmlsbD0iI0VENDZEMCIvPjwvc3ZnPg==',
    width: 100,
    height: 100,
    tags: ['爱', '喜欢', '心'],
    isAnimated: false,
    isPremium: false,
    downloadCount: 2000,
    createdAt: new Date(),
  },
  {
    id: 'sticker-emoji-3',
    name: '火焰',
    category: 'emoji',
    type: 'sticker',
    url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBkPSJNNTAgMTAgQzMwIDQwIDQwIDYwIDUwIDgwIEM2MCA2MCA3MCA0MCA1MCAxMCBaIiBmaWxsPSIjRkY2NjAwIi8+PHBhdGggZD0iTTUwIDMwIEM0MCA1MCA0NSA2NSA1MCA3MCBDNTUgNjUgNjAgNTAgNTAgMzAgWiIgZmlsbD0iI0ZGQUMwMCIvPjwvc3ZnPg==',
    width: 100,
    height: 100,
    tags: ['火', '热门', '燃烧'],
    isAnimated: false,
    isPremium: false,
    downloadCount: 1500,
    createdAt: new Date(),
  },
  {
    id: 'sticker-arrow-1',
    name: '右箭头',
    category: 'arrow',
    type: 'sticker',
    url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBkPSJNMjAgNTAgTDgwIDUwIE02MCAzMCBMODAgNTAgTDYwIDcwIiBzdHJva2U9IiMzQjgyRjYiIHN0cm9rZS13aWR0aD0iOCIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==',
    width: 100,
    height: 100,
    tags: ['箭头', '方向', '指向'],
    isAnimated: false,
    isPremium: false,
    downloadCount: 800,
    createdAt: new Date(),
  },
  {
    id: 'sticker-shape-1',
    name: '圆形',
    category: 'shape',
    type: 'sticker',
    url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMTBCOTgxIiBzdHJva2Utd2lkdGg9IjQiLz48L3N2Zz4=',
    width: 100,
    height: 100,
    tags: ['圆形', '形状', '边框'],
    isAnimated: false,
    isPremium: false,
    downloadCount: 600,
    createdAt: new Date(),
  },
  {
    id: 'sticker-social-1',
    name: '点赞',
    category: 'social',
    type: 'sticker',
    url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBkPSJNMzAgODUgTDMwIDQ1IEw0NSA0NSBMNDUgMjAgTDYwIDQ1IEw4MCA0NSBMNjAgODUgWiIgZmlsbD0iIzNCODJGNiIvPjwvc3ZnPg==',
    width: 100,
    height: 100,
    tags: ['点赞', '喜欢', '社交媒体'],
    isAnimated: false,
    isPremium: false,
    downloadCount: 3000,
    createdAt: new Date(),
  },
  {
    id: 'sticker-nature-1',
    name: '星星',
    category: 'nature',
    type: 'sticker',
    url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBkPSJNNTAgMTAgTDYwIDQwIEw5MCA0MCBMNjUgNjAgTDc1IDkwIEw1MCA3MCBMMjUgOTAgTDM1IDYwIEwxMCA0MCBMNDAgNDAgWiIgZmlsbD0iI0ZGQUMwMCIvPjwvc3ZnPg==',
    width: 100,
    height: 100,
    tags: ['星星', '闪亮', '夜晚'],
    isAnimated: false,
    isPremium: false,
    downloadCount: 2500,
    createdAt: new Date(),
  },
  {
    id: 'sticker-music-1',
    name: '音符',
    category: 'music',
    type: 'sticker',
    url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48ZWxsaXBzZSBjeD0iMzAiIGN5PSI3MCIgcng9IjE1IiByeT0iMTAiIGZpbGw9IiNFQzQ4OTkiLz48cmVjdCB4PSI0NSIgeT0iMTUiIHdpZHRoPSI1IiBoZWlnaHQ9IjU1IiBmaWxsPSIjRUM0ODk5Ii8+PHBhdGggZD0iTTUwIDE1IFE4MCAyNSA4MCA0MCBMODAgNTAgUTgwIDQwIDUwIDUwIFoiIGZpbGw9IiNFQzQ4OTkiLz48L3N2Zz4=',
    width: 100,
    height: 100,
    tags: ['音乐', '音符', '旋律'],
    isAnimated: false,
    isPremium: false,
    downloadCount: 1800,
    createdAt: new Date(),
  },
  {
    id: 'sticker-decorative-1',
    name: '闪光',
    category: 'decorative',
    type: 'sticker',
    url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBkPSJNNTAgMCBMNTMgNDcgTDEwMCA1MCBMNTMgNTMgTTUwIDEwMCBMNDcgNTMgTDAgNTAgTDQ3IDQ3IFoiIGZpbGw9IiNGRkZGRkYiLz48L3N2Zz4=',
    width: 100,
    height: 100,
    tags: ['闪光', '闪烁', '特效'],
    isAnimated: false,
    isPremium: false,
    downloadCount: 2200,
    createdAt: new Date(),
  },
];

const BUILTIN_MATERIAL_PACKS: MaterialPack[] = [
  {
    id: 'pack-social-media',
    name: '社交媒体包',
    description: '适合短视频和社交媒体的贴纸集合',
    thumbnail: '',
    materials: BUILTIN_STICKERS.filter((s) => s.category === 'social'),
    isPremium: false,
    category: 'social',
  },
  {
    id: 'pack-emoji-basic',
    name: '基础表情包',
    description: '常用表情符号集合',
    thumbnail: '',
    materials: BUILTIN_STICKERS.filter((s) => s.category === 'emoji'),
    isPremium: false,
    category: 'emoji',
  },
  {
    id: 'pack-decorative',
    name: '装饰特效包',
    description: '闪光、星星等装饰元素',
    thumbnail: '',
    materials: BUILTIN_STICKERS.filter((s) => s.category === 'decorative' || s.category === 'nature'),
    isPremium: false,
    category: 'decorative',
  },
];

export const useMaterialLibraryStore = create<MaterialLibraryStore>()(
  immer((set, get) => ({
    stickers: BUILTIN_STICKERS,
    materialPacks: BUILTIN_MATERIAL_PACKS,
    favorites: [],
    recentUsed: [],
    searchQuery: '',
    selectedCategory: 'all',
    isLoading: false,

    loadStickers: () => {
      set((state) => {
        state.isLoading = true;
      });

      setTimeout(() => {
        set((state) => {
          state.stickers = BUILTIN_STICKERS;
          state.isLoading = false;
        });
      }, 500);
    },

    loadMaterialPacks: () => {
      set((state) => {
        state.materialPacks = BUILTIN_MATERIAL_PACKS;
      });
    },

    addSticker: (sticker) =>
      set((state) => {
        state.stickers.push(sticker);
      }),

    removeSticker: (stickerId) =>
      set((state) => {
        state.stickers = state.stickers.filter((s) => s.id !== stickerId);
        state.favorites = state.favorites.filter((id) => id !== stickerId);
        state.recentUsed = state.recentUsed.filter((id) => id !== stickerId);
      }),

    addToFavorites: (stickerId) =>
      set((state) => {
        if (!state.favorites.includes(stickerId)) {
          state.favorites.push(stickerId);
        }
      }),

    removeFromFavorites: (stickerId) =>
      set((state) => {
        state.favorites = state.favorites.filter((id) => id !== stickerId);
      }),

    toggleFavorite: (stickerId) =>
      set((state) => {
        const index = state.favorites.indexOf(stickerId);
        if (index === -1) {
          state.favorites.push(stickerId);
        } else {
          state.favorites.splice(index, 1);
        }
      }),

    addToRecent: (stickerId) =>
      set((state) => {
        state.recentUsed = state.recentUsed.filter((id) => id !== stickerId);
        state.recentUsed.unshift(stickerId);
        if (state.recentUsed.length > 20) {
          state.recentUsed = state.recentUsed.slice(0, 20);
        }
      }),

    clearRecent: () =>
      set((state) => {
        state.recentUsed = [];
      }),

    setSearchQuery: (query) =>
      set((state) => {
        state.searchQuery = query;
      }),

    setSelectedCategory: (category) =>
      set((state) => {
        state.selectedCategory = category;
      }),

    getStickersByCategory: (category) => {
      const state = get();
      return state.stickers.filter((s) => s.category === category);
    },

    getFavoriteStickers: () => {
      const state = get();
      return state.stickers.filter((s) => state.favorites.includes(s.id));
    },

    getRecentStickers: () => {
      const state = get();
      return state.recentUsed
        .map((id) => state.stickers.find((s) => s.id === id))
        .filter(Boolean) as Sticker[];
    },

    searchStickers: (query) => {
      const state = get();
      const lowerQuery = query.toLowerCase();
      return state.stickers.filter(
        (s) =>
          s.name.toLowerCase().includes(lowerQuery) ||
          s.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
      );
    },
  }))
);

export class MaterialLibraryService {
  private static instance: MaterialLibraryService;

  static getInstance(): MaterialLibraryService {
    if (!MaterialLibraryService.instance) {
      MaterialLibraryService.instance = new MaterialLibraryService();
    }
    return MaterialLibraryService.instance;
  }

  getCategoryName(category: StickerCategory): string {
    return CATEGORY_NAMES[category];
  }

  getAllCategories(): { id: StickerCategory | 'all'; name: string }[] {
    return [
      { id: 'all', name: '全部' },
      ...Object.entries(CATEGORY_NAMES).map(([id, name]) => ({
        id: id as StickerCategory,
        name,
      })),
    ];
  }

  async loadCustomSticker(file: File): Promise<Sticker> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const sticker: Sticker = {
            id: `custom-${Date.now()}`,
            name: file.name.replace(/\.[^/.]+$/, ''),
            category: 'decorative',
            type: 'sticker',
            url: e.target?.result as string,
            width: img.width,
            height: img.height,
            tags: ['自定义'],
            isAnimated: false,
            isPremium: false,
            downloadCount: 0,
            createdAt: new Date(),
          };
          resolve(sticker);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async downloadStickerAsPng(sticker: Sticker): Promise<void> {
    const response = await fetch(sticker.url);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${sticker.name}.png`;
    a.click();

    URL.revokeObjectURL(url);
  }
}

export const materialLibraryService = MaterialLibraryService.getInstance();
