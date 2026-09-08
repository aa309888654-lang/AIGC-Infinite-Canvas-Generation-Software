// 主题选择器组件
import React, { useEffect } from 'react';
import { Moon, Sun, Monitor, Check, Palette, Sparkles, Sunset, Star, Trees, Waves, Eye } from 'lucide-react';
import { useThemeStore, Theme, themePresets, initializeTheme } from '@/store/themeStore';
import { cn } from '@/lib/utils';

// 图标映射
const getThemeIcon = (themeId: Theme) => {
  const iconMap = {
    dark: Moon,
    light: Sun,
    auto: Monitor,
    cyberpunk: Sparkles,
    elegant: Sparkles,
    midnight: Star,
    sunrise: Sun,
    sunset: Sunset,
    starry: Star,
    forest: Trees,
    ocean: Waves,
    eyeCare: Eye,
  };
  return iconMap[themeId] || Sparkles;
};

export const ThemeSelector = () => {
  const { theme, setTheme } = useThemeStore();

  useEffect(() => {
    initializeTheme();
  }, []);

  const themes = [
    { id: 'dark' as Theme, icon: Moon, label: '深色' },
    { id: 'light' as Theme, icon: Sun, label: '浅色' },
    { id: 'auto' as Theme, icon: Monitor, label: '自动' },
  ];

  return (
    <div className="flex gap-2">
      {themes.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => setTheme(id)}
          className={cn(
            'px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5 transition-all',
            'bg-white/5 hover:bg-white/10',
            theme === id && 'bg-[#007AFF] text-white hover:bg-[#007AFF]/90'
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          <span>{label}</span>
          {theme === id && <Check className="w-3 h-3" />}
        </button>
      ))}
    </div>
  );
};

export const ThemePanel = () => {
  const { theme, setTheme, themeMode } = useThemeStore();

  return (
    <div className="bg-[#1F1F1F] rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2 text-white">
        <Palette className="w-4 h-4" />
        <span className="text-sm font-medium">主题设置</span>
      </div>

      <div className="space-y-3">
        <div className="text-xs text-white/60">选择主题</div>
        <div className="grid grid-cols-3 gap-2">
          {Object.values(themePresets).map((preset) => {
            const Icon = getThemeIcon(preset.id);
            
            return (
              <button
                key={preset.id}
                onClick={() => setTheme(preset.id)}
                className={cn(
                  'p-3 rounded-lg border transition-all',
                  'hover:bg-white/5',
                  theme === preset.id
                    ? 'border-[#007AFF] bg-[#007AFF]/10'
                    : 'border-white/10'
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center relative overflow-hidden"
                    style={{ 
                      backgroundColor: preset.colors.surface,
                      background: preset.colors.accentGradient || preset.colors.surface 
                    }}
                  >
                    {preset.colors.accentGradient ? (
                      <div 
                        className="absolute inset-0 opacity-30"
                        style={{ background: preset.colors.accentGradient }}
                      />
                    ) : null}
                    <Icon
                      className="w-5 h-5 relative z-10"
                      style={{ color: preset.colors.primary }}
                    />
                  </div>
                  <span className="text-xs text-white">{preset.name}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-3 border-t border-white/10">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/60">当前模式</span>
          <span className="text-white font-medium">
            {themeMode === 'dark' ? '深色模式' : '浅色模式'}
          </span>
        </div>
      </div>
    </div>
  );
};

export const ThemePreview = ({ themeId }: { themeId: Theme }) => {
  const preset = themePresets[themeId];
  const Icon = getThemeIcon(themeId);

  return (
    <div className="relative group">
      <div
        className="w-16 h-16 rounded-lg border border-white/20 overflow-hidden cursor-pointer transition-transform hover:scale-105 relative"
        style={{ backgroundColor: preset.colors.background }}
      >
        <div className="h-1/2" style={{ backgroundColor: preset.colors.surface }} />
        <div className="h-1/2" style={{ backgroundColor: preset.colors.surfaceElevated }} />
        <div
          className="absolute top-1 left-1 w-3 h-3 rounded-full"
          style={{ 
            background: preset.colors.accentGradient || preset.colors.primary 
          }}
        />
      </div>
      
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
        <Icon className="w-6 h-6 text-white" />
      </div>

      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/60 whitespace-nowrap">
        {preset.name}
      </div>
    </div>
  );
};