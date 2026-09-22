import { useState, useEffect, memo } from 'react';
import { PUBLIC_URLS } from '@/config/resources';
import {
  Settings,
  FolderOpen,
  Trash2,
  GitMerge,
  Music,
  Mic2,
} from 'lucide-react';
import UserProfileDropdown from '@/components/ui/UserProfileDropdown';
import { cn } from '@/lib/utils';
import { useMembershipStore } from '@/store/useMembershipStore';
import { useTranslation } from '@/hooks/useTranslation';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';

interface TopToolbarProps {
  onOpenFileManager?: () => void;
  onOpenCacheClearPanel?: () => void;
  onOpenSettings?: (tab?: string) => void;
  onOpenVersionControl?: () => void;
  onOpenMiniMaxConfig?: () => void;
  onOpenWorkflowDebugger?: () => void;
  onOpenContinuousVideo?: () => void;
  onOpenAPIMonitor?: () => void;
  onOpenApiKeyManagement?: () => void;
  onViewModeChange?: (mode: 'workflow') => void;
  onOpenMembership?: () => void;
  onSave?: () => void;
  onOpenPerformanceMonitor?: () => void;
  onGoBack?: () => void;
  onOpenMusicGeneration?: () => void;
  onCloseMusicGeneration?: () => void;
  onOpenAIDubbing?: () => void;
  onCloseAIDubbing?: () => void;
  currentView?: 'workflow';
  isMusicGenerationOpen?: boolean;
  isAIDubbingOpen?: boolean;
}

function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    api.windowIsMaximized?.().then((maximized: boolean) => setIsMaximized(maximized));
    api.onWindowMaximizeChange?.((maximized: boolean) => setIsMaximized(maximized));
  }, []);

  const api = window.electronAPI;
  if (!api) return null;

  return (
    <div
      className="flex items-center ml-1"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <button
        onClick={() => api.windowMinimize?.()}
        className="flex items-center justify-center w-11 h-8 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        title={t('toolbar.minimize_window')}
      >
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button
        onClick={() => api.windowMaximize?.()}
        className="flex items-center justify-center w-11 h-8 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        title={isMaximized ? t('toolbar.restore_window') : t('toolbar.maximize_window')}
      >
        {isMaximized ? (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          >
            <rect x="2" y="0" width="8" height="8" rx="0" />
            <rect x="0" y="2" width="8" height="8" rx="0" fill="#121214" />
            <rect x="0" y="2" width="8" height="8" rx="0" />
          </svg>
        ) : (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          >
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        )}
      </button>
      <button
        onClick={() => api.windowClose?.()}
        className="flex items-center justify-center w-11 h-8 text-white/80 hover:text-white hover:bg-red-500 transition-colors"
        title={t('toolbar.close_window')}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2">
          <line x1="0" y1="0" x2="10" y2="10" />
          <line x1="10" y1="0" x2="0" y2="10" />
        </svg>
      </button>
    </div>
  );
}

const TopToolbar: React.FC<TopToolbarProps> = ({
  onOpenFileManager,
  onOpenCacheClearPanel,
  onOpenSettings,
  onOpenVersionControl: _onOpenVersionControl,
  onOpenMiniMaxConfig: _onOpenMiniMaxConfig,
  onOpenWorkflowDebugger: _onOpenWorkflowDebugger,
  onOpenAPIMonitor: _onOpenAPIMonitor,
  onOpenApiKeyManagement: _onOpenApiKeyManagement,
  onViewModeChange,
  onOpenMembership,
  onSave,
  onOpenPerformanceMonitor: _onOpenPerformanceMonitor,
  onGoBack: _onGoBack,
  onOpenMusicGeneration,
  onCloseMusicGeneration,
  onOpenAIDubbing,
  onCloseAIDubbing,
  currentView = 'workflow',
  isMusicGenerationOpen = false,
  isAIDubbingOpen = false,
}) => {
  const { membership } = useMembershipStore();
  const { t } = useTranslation();

  return (
    <div className="fixed top-0 left-0 right-0 h-14 bg-[#000000] border-b border-white/10 flex items-center gap-2 max-sm:gap-1 px-3 max-sm:px-1.5 z-[1000] shadow-[0_4px_30px_rgba(0,0,0,0.3)] overflow-visible max-sm:overflow-hidden">
      <div className="flex items-center gap-2 px-3 max-sm:px-1 border-r border-white/10 shrink-0">
        <button
          onClick={() => {
            // Electron：交给主进程在默认浏览器打开；网页端：当前标签直接进入官网
            if (typeof window !== 'undefined' && window.electronAPI) {
              window.open('https://aicgxt.com/', '_blank', 'noopener,noreferrer');
            } else {
              window.location.href = 'https://aicgxt.com/';
            }
          }}
          className="flex items-center gap-3 hover:opacity-80 transition-all active:scale-95 group"
          title={t('toolbar.visit_website')}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-white/20 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            <img
              src={PUBLIC_URLS.logo}
              alt={t('app.name')}
              className="relative z-10 w-7 h-7 rounded-xl shadow-lg border border-white/10"
            />
          </div>
          <div className="max-sm:hidden text-left">
            <h1 className="text-sm font-bold text-white tracking-wider">{t('app.name')}</h1>
            <p className="text-[10px] text-white/80 font-medium hidden sm:block tracking-tight">
              {membership?.isLoggedIn ? membership.username : t('toolbar.creative_assistant')}
              <span className="ml-1 text-[5px] text-white">2026.09.22</span>
            </p>
          </div>
        </button>
      </div>

      <div
        className="flex items-center gap-1.5 px-1.5 py-1 bg-white/5 rounded-2xl border border-white/10 min-w-0 max-lg:max-w-[430px] max-md:max-w-[260px] overflow-hidden shadow-inner max-sm:hidden"
        style={{ fontSize: '8px' }}
      >
        <button
          onClick={() => onViewModeChange?.('workflow')}
          className={cn(
            'relative flex items-center gap-2 px-4 py-1.5 rounded-xl transition-all duration-300 text-sm font-semibold whitespace-nowrap overflow-hidden group',
            currentView === 'workflow' &&
              !isMusicGenerationOpen &&
              !isAIDubbingOpen
              ? 'bg-white/15 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
              : 'text-white/80 hover:text-white hover:bg-white/5'
          )}
        >
          <GitMerge
            className={cn(
              'w-4 h-4 transition-transform group-hover:scale-110',
              currentView === 'workflow' && 'text-white'
            )}
          />
          <span className="hidden sm:inline">{t('toolbar.ai_nodes')}</span>
        </button>
        <button
          onClick={() => {
            if (isAIDubbingOpen) {
              onCloseAIDubbing?.();
            } else {
              onCloseMusicGeneration?.();
              onOpenAIDubbing?.();
            }
          }}
          className={cn(
            'relative flex items-center gap-2 px-4 py-1.5 rounded-xl transition-all duration-300 text-sm font-semibold whitespace-nowrap overflow-hidden group',
            isAIDubbingOpen
              ? 'bg-white/15 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
              : 'text-white/80 hover:text-white hover:bg-white/5'
          )}
        >
          <Mic2
            className={cn(
              'w-4 h-4 transition-transform group-hover:scale-110',
              isAIDubbingOpen && 'text-white'
            )}
          />
          <span className="hidden sm:inline">{t('toolbar.ai_dubbing')}</span>
        </button>
        <button
          onClick={() => {
            if (isMusicGenerationOpen) {
              onCloseMusicGeneration?.();
            } else {
              onCloseAIDubbing?.();
              onOpenMusicGeneration?.();
            }
          }}
          className={cn(
            'relative flex items-center gap-2 px-4 py-1.5 rounded-xl transition-all duration-300 text-sm font-semibold whitespace-nowrap overflow-hidden group',
            isMusicGenerationOpen
              ? 'bg-white/15 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          )}
        >
          <Music
            className={cn(
              'w-4 h-4 transition-transform group-hover:scale-110',
              isMusicGenerationOpen && 'text-white'
            )}
          />
          <span className="hidden sm:inline">{t('toolbar.ai_music')}</span>
        </button>
      </div>

      <div className="flex-1 min-w-0" />

      <div className="flex items-center gap-1 shrink-0 max-sm:hidden">
        <LanguageSwitcher menuPosition="bottom" />
        <button
          onClick={() => onOpenFileManager?.()}
          className="flex items-center justify-center w-9 h-9 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-90"
          title={`${t('toolbar.file_manager')} (Ctrl+I)`}
        >
          <FolderOpen className="w-4 h-4" />
        </button>
        <button
          onClick={() => onOpenCacheClearPanel?.()}
          className="max-sm:hidden flex items-center justify-center w-9 h-9 text-white/50 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all active:scale-90"
          title={t('toolbar.clear_cache')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onOpenSettings?.('general')}
          className="flex items-center justify-center w-9 h-9 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-90"
          title={t('toolbar.settings')}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div className="ml-2 max-sm:ml-0 shrink-0">
        <UserProfileDropdown />
      </div>

      {typeof window !== 'undefined' && window.electronAPI && <WindowControls />}

    </div>
  );
};

export default memo(TopToolbar);
