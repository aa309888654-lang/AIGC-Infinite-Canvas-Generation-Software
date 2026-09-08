// 主题管理系统
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 
  | 'dark' 
  | 'light' 
  | 'auto' 
  | 'cyberpunk' 
  | 'elegant' 
  | 'midnight'
  | 'sunrise'      // 日出渐变
  | 'sunset'      // 日落渐变
  | 'starry'       // 星夜主题
  | 'forest'       // 森林主题
  | 'ocean'        // 海洋主题
  | 'eyeCare';     // 护眼主题

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderSubtle: string;
  accentGradient?: string;
}

export interface ThemePreset {
  id: Theme;
  name: string;
  description: string;
  colors: ThemeColors;
  preview?: string;
}

export const themePresets: Record<Theme, ThemePreset> = {
  dark: {
    id: 'dark',
    name: '深色',
    description: '深色主题，适合夜间使用',
    colors: {
      primary: '#007AFF',
      secondary: '#5856D6',
      success: '#34C759',
      warning: '#FF9500',
      error: '#FF3B30',
      background: '#000000',
      surface: '#1C1C1E',
      surfaceElevated: '#2C2C2E',
      textPrimary: '#FFFFFF',
      textSecondary: '#E5E5E5',
      textTertiary: '#B3B3B3',
      border: '#38383A',
      borderSubtle: '#2C2C2E',
    },
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: '赛博朋克',
    description: '霓虹灯光效果，充满未来感',
    colors: {
      primary: '#00E5FF',
      secondary: '#8B5CF6',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      background: '#09090B',
      surface: '#121214',
      surfaceElevated: '#1A1A1D',
      textPrimary: '#F0F0F0',
      textSecondary: '#A0A0A0',
      textTertiary: '#707070',
      border: 'rgba(255, 255, 255, 0.12)',
      borderSubtle: 'rgba(255, 255, 255, 0.06)',
      accentGradient: 'linear-gradient(135deg, #00E5FF 0%, #8B5CF6 100%)',
    },
    preview: 'linear-gradient(135deg, #00E5FF 0%, #8B5CF6 100%)',
  },
  elegant: {
    id: 'elegant',
    name: '优雅深色',
    description: '精致的暗色调，专业的视觉体验',
    colors: {
      primary: '#6366F1',
      secondary: '#8B5CF6',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      background: '#0d0d0d',
      surface: '#18181B',
      surfaceElevated: '#27272A',
      textPrimary: '#FAFAFA',
      textSecondary: '#A1A1AA',
      textTertiary: '#71717A',
      border: 'rgba(255, 255, 255, 0.08)',
      borderSubtle: 'rgba(255, 255, 255, 0.04)',
      accentGradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    },
    preview: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
  },
  midnight: {
    id: 'midnight',
    name: '午夜蓝',
    description: '深邃的蓝色调，沉稳而现代',
    colors: {
      primary: '#9CA3AF',
      secondary: '#6366F1',
      success: '#22C55E',
      warning: '#EAB308',
      error: '#DC2626',
      background: '#0C0F1A',
      surface: '#151929',
      surfaceElevated: '#1E2436',
      textPrimary: '#E2E8F0',
      textSecondary: '#94A3B8',
      textTertiary: '#64748B',
      border: 'rgba(255, 255, 255, 0.1)',
      borderSubtle: 'rgba(255, 255, 255, 0.05)',
      accentGradient: 'linear-gradient(135deg, #9CA3AF 0%, #6366F1 100%)',
    },
    preview: 'linear-gradient(135deg, #9CA3AF 0%, #6366F1 100%)',
  },
  light: {
    id: 'light',
    name: '浅色',
    description: '浅色主题，适合白天使用',
    colors: {
      primary: '#007AFF',
      secondary: '#5856D6',
      success: '#34C759',
      warning: '#FF9500',
      error: '#FF3B30',
      background: '#F2F2F7',
      surface: '#FFFFFF',
      surfaceElevated: '#FFFFFF',
      textPrimary: '#000000',
      textSecondary: '#3C3C43',
      textTertiary: '#8E8E93',
      border: '#C6C6C8',
      borderSubtle: '#E5E5EA',
    },
  },
  auto: {
    id: 'auto',
    name: '自动',
    description: '跟随系统设置',
    colors: {
      primary: '#007AFF',
      secondary: '#5856D6',
      success: '#34C759',
      warning: '#FF9500',
      error: '#FF3B30',
      background: 'system',
      surface: 'system',
      surfaceElevated: 'system',
      textPrimary: 'system',
      textSecondary: 'system',
      textTertiary: 'system',
      border: 'system',
      borderSubtle: 'system',
    },
  },
  sunrise: {
    id: 'sunrise',
    name: '日出',
    description: '温暖的橙黄渐变，如晨曦般温柔',
    colors: {
      primary: '#FF8C42',
      secondary: '#FFB347',
      success: '#98D8AA',
      warning: '#FFD700',
      error: '#FF6B6B',
      background: '#1A1520',
      surface: '#2D2339',
      surfaceElevated: '#3D3049',
      textPrimary: '#FFF8E7',
      textSecondary: '#E8DCC4',
      textTertiary: '#C4B8A5',
      border: 'rgba(255, 140, 66, 0.2)',
      borderSubtle: 'rgba(255, 140, 66, 0.1)',
      accentGradient: 'linear-gradient(135deg, #FF8C42 0%, #FFD700 50%, #FFB347 100%)',
    },
    preview: 'linear-gradient(135deg, #FF8C42 0%, #FFD700 100%)',
  },
  sunset: {
    id: 'sunset',
    name: '日落',
    description: '浪漫的紫红渐变，如黄昏般绚烂',
    colors: {
      primary: '#FF6B6B',
      secondary: '#9B59B6',
      success: '#27AE60',
      warning: '#F39C12',
      error: '#E74C3C',
      background: '#1A1020',
      surface: '#2D1F30',
      surfaceElevated: '#3D2A40',
      textPrimary: '#FFF0F5',
      textSecondary: '#E8D4E8',
      textTertiary: '#C4A4C4',
      border: 'rgba(255, 107, 107, 0.2)',
      borderSubtle: 'rgba(255, 107, 107, 0.1)',
      accentGradient: 'linear-gradient(135deg, #FF6B6B 0%, #9B59B6 50%, #FF8C42 100%)',
    },
    preview: 'linear-gradient(135deg, #FF6B6B 0%, #9B59B6 100%)',
  },
  starry: {
    id: 'starry',
    name: '星夜',
    description: '深邃的星空蓝，神秘而宁静',
    colors: {
      primary: '#A78BFA',
      secondary: '#9CA3AF',
      success: '#34D399',
      warning: '#FBBF24',
      error: '#F87171',
      background: '#0A0E1A',
      surface: '#141828',
      surfaceElevated: '#1E2436',
      textPrimary: '#E2E8F0',
      textSecondary: '#94A3B8',
      textTertiary: '#64748B',
      border: 'rgba(167, 139, 250, 0.15)',
      borderSubtle: 'rgba(167, 139, 250, 0.08)',
      accentGradient: 'linear-gradient(135deg, #A78BFA 0%, #9CA3AF 50%, #818CF8 100%)',
    },
    preview: 'linear-gradient(135deg, #A78BFA 0%, #9CA3AF 100%)',
  },
  forest: {
    id: 'forest',
    name: '森林',
    description: '清新的绿色调，仿佛置身自然',
    colors: {
      primary: '#10B981',
      secondary: '#059669',
      success: '#34D399',
      warning: '#F59E0B',
      error: '#EF4444',
      background: '#0D1F17',
      surface: '#162D22',
      surfaceElevated: '#1F3A2D',
      textPrimary: '#ECFDF5',
      textSecondary: '#A7F3D0',
      textTertiary: '#6EE7B7',
      border: 'rgba(16, 185, 129, 0.2)',
      borderSubtle: 'rgba(16, 185, 129, 0.1)',
      accentGradient: 'linear-gradient(135deg, #10B981 0%, #059669 50%, #047857 100%)',
    },
    preview: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
  },
  ocean: {
    id: 'ocean',
    name: '海洋',
    description: '深邃的蓝色，如海洋般广阔',
    colors: {
      primary: '#0EA5E9',
      secondary: '#0284C7',
      success: '#22C55E',
      warning: '#EAB308',
      error: '#DC2626',
      background: '#0C1520',
      surface: '#152030',
      surfaceElevated: '#1E2A40',
      textPrimary: '#E0F2FE',
      textSecondary: '#7DD3FC',
      textTertiary: '#38BDF8',
      border: 'rgba(14, 165, 233, 0.2)',
      borderSubtle: 'rgba(14, 165, 233, 0.1)',
      accentGradient: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 50%, #0369A1 100%)',
    },
    preview: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
  },
  eyeCare: {
    id: 'eyeCare',
    name: '护眼',
    description: '柔和的暖色调，长时间使用更舒适',
    colors: {
      primary: '#D97706',
      secondary: '#B45309',
      success: '#059669',
      warning: '#D97706',
      error: '#DC2626',
      background: '#1A1814',
      surface: '#252019',
      surfaceElevated: '#302819',
      textPrimary: '#FEF3C7',
      textSecondary: '#FDE68A',
      textTertiary: '#FCD34D',
      border: 'rgba(217, 119, 6, 0.2)',
      borderSubtle: 'rgba(217, 119, 6, 0.1)',
      accentGradient: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
    },
    preview: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
  },
};

interface ThemeState {
  theme: Theme;
  themeMode: ThemeMode;
  isSystemDark: boolean;
  setTheme: (theme: Theme) => void;
  setSystemDark: (isDark: boolean) => void;
  getCurrentColors: () => ThemeColors;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      themeMode: 'dark',
      isSystemDark: true,

      setTheme: (theme) => {
        const isDark = theme === 'dark' || (theme === 'auto' && get().isSystemDark);
        set({ 
          theme, 
          themeMode: isDark ? 'dark' : 'light' 
        });
        applyTheme(theme, get().isSystemDark);
      },

      setSystemDark: (isSystemDark) => {
        const { theme } = get();
        if (theme === 'auto') {
          const isDark = isSystemDark;
          set({ 
            isSystemDark,
            themeMode: isDark ? 'dark' : 'light'
          });
          applyTheme(theme, isSystemDark);
        } else {
          set({ isSystemDark });
        }
      },

      getCurrentColors: () => {
        const { theme, isSystemDark } = get();
        const preset = themePresets[theme];
        
        if (theme === 'auto') {
          return isSystemDark ? themePresets.dark.colors : themePresets.light.colors;
        }
        
        return preset.colors;
      },
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);

// 应用主题到CSS变量
const applyTheme = (theme: Theme, isSystemDark: boolean) => {
  const colors = theme === 'auto'
    ? (isSystemDark ? themePresets.dark.colors : themePresets.light.colors)
    : themePresets[theme].colors;

  const root = document.documentElement;
  
  // 应用颜色变量
  Object.entries(colors).forEach(([key, value]) => {
    if (value !== 'system') {
      const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVar, value);
    }
  });

  // 应用渐变色变量（如果有）
  if (colors.accentGradient) {
    root.style.setProperty('--accent-gradient', colors.accentGradient);
  }

  // 添加主题类名
  root.classList.remove(
    'theme-dark', 'theme-light', 'theme-cyberpunk', 'theme-elegant', 'theme-midnight',
    'theme-sunrise', 'theme-sunset', 'theme-starry', 'theme-forest', 'theme-ocean', 'theme-eyeCare'
  );
  root.classList.add(`theme-${theme === 'auto' ? (isSystemDark ? 'dark' : 'light') : theme}`);

  // 应用背景渐变（可选）
  const effectiveTheme = theme === 'auto' ? (isSystemDark ? 'dark' : 'light') : theme;
  if (themePresets[effectiveTheme]?.preview) {
    root.style.setProperty('--theme-preview-gradient', themePresets[effectiveTheme].preview!);
  }
};

// 初始化主题
export const initializeTheme = () => {
  // 监听系统主题变化
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
    const isDark = e.matches;
    useThemeStore.getState().setSystemDark(isDark);
  };

  // 初始设置
  handleChange(mediaQuery);

  // 监听变化
  mediaQuery.addEventListener('change', handleChange);
  
  // 应用当前主题
  const { theme, isSystemDark } = useThemeStore.getState();
  applyTheme(theme, isSystemDark);
};

// 布局记忆接口
export interface LayoutConfig {
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  rightPanelWidth: number;
  rightPanelCollapsed: boolean;
  bottomPanelHeight: number;
  bottomPanelCollapsed: boolean;
  quickToolbarVisible: boolean;
  lastPosition?: { x: number; y: number };
  lastZoom?: number;
}

export interface LayoutState {
  config: LayoutConfig;
  updateConfig: (config: Partial<LayoutConfig>) => void;
  resetConfig: () => void;
}

const defaultLayoutConfig: LayoutConfig = {
  sidebarWidth: 260,
  sidebarCollapsed: false,
  rightPanelWidth: 280,
  rightPanelCollapsed: false,
  bottomPanelHeight: 200,
  bottomPanelCollapsed: false,
  quickToolbarVisible: true,
};

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, _get) => ({
      config: defaultLayoutConfig,

      updateConfig: (newConfig) => {
        set((state) => ({
          config: { ...state.config, ...newConfig },
        }));
      },

      resetConfig: () => {
        set({ config: defaultLayoutConfig });
      },
    }),
    {
      name: 'layout-storage',
    }
  )
);