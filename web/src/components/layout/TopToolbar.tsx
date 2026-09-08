import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { PUBLIC_URLS } from '@/config/resources';
import {
  Image,
  Settings,
  Save,
  FolderOpen,
  Trash2,
  History,
  Globe,
  GitMerge,
  ShoppingBag,
  Bug,
  Box,
  Activity,
  Puzzle,
  ChevronDown,
  Music,
  Mic2,
  Heart,
  X,
} from 'lucide-react';
import UserProfileDropdown from '@/components/ui/UserProfileDropdown';
import { cn } from '@/lib/utils';
import { useMembershipStore } from '@/store/useMembershipStore';
import { KeyboardShortcutManager, type KeyboardShortcut } from '@/services/keyboard-shortcuts';

interface TopToolbarProps {
  onOpenFileManager?: () => void;
  onOpenCacheClearPanel?: () => void;
  onOpenSettings?: (tab?: string) => void;
  onOpenVersionControl?: () => void;
  onOpenMiniMaxConfig?: () => void;
  onOpenWorkflowMarketplace?: () => void;
  onOpenWorkflowDebugger?: () => void;
  onOpenContinuousVideo?: () => void;
  onOpenModelMarketplace?: () => void;
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

interface DropdownItem {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  shortcut?: string;
  onClick: () => void;
  divider?: boolean;
}

interface DropdownGroup {
  id: string;
  label: string;
  items: DropdownItem[];
}

function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

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
        title="最小化"
      >
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button
        onClick={() => api.windowMaximize?.()}
        className="flex items-center justify-center w-11 h-8 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        title={isMaximized ? '还原' : '最大化'}
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
        title="关闭"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2">
          <line x1="0" y1="0" x2="10" y2="10" />
          <line x1="10" y1="0" x2="0" y2="10" />
        </svg>
      </button>
    </div>
  );
}

const shortcutManager = KeyboardShortcutManager.getInstance();

const TopToolbar: React.FC<TopToolbarProps> = ({
  onOpenFileManager,
  onOpenCacheClearPanel,
  onOpenSettings,
  onOpenVersionControl: _onOpenVersionControl,
  onOpenMiniMaxConfig: _onOpenMiniMaxConfig,
  onOpenWorkflowMarketplace,
  onOpenWorkflowDebugger: _onOpenWorkflowDebugger,
  onOpenModelMarketplace,
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
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const dropdownGroups: DropdownGroup[] = [
    {
      id: 'advanced',
      label: '高级功能',
      items: [
        {
          id: 'workflow-market',
          label: '工作流市场',
          icon: ShoppingBag,
          color: '#22C55E',
          onClick: () => {
            onOpenWorkflowMarketplace?.();
            setActiveDropdown(null);
          },
        },
        {
          id: 'model-market',
          label: '模型市场',
          icon: Box,
          color: '#EC4899',
          onClick: () => {
            onOpenModelMarketplace?.();
            setActiveDropdown(null);
          },
        },
      ],
    },
  ];
  const _getShortcut = (action: string): KeyboardShortcut | undefined => {
    return shortcutManager.getShortcuts().find((s) => s.action === action);
  };

  const dropdownBtnRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const updateDropdownPos = useCallback(() => {
    if (dropdownBtnRef.current) {
      const rect = dropdownBtnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 8, left: rect.left });
    }
  }, []);

  const renderDropdown = (groupId: string) => {
    const group = dropdownGroups.find((g) => g.id === groupId);
    if (!group) return null;

    return (
      <div
        className="fixed w-64 bg-black backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[99999] overflow-hidden animate-scaleIn"
        style={{ top: dropdownPos.top, left: dropdownPos.left }}
      >
        <div className="h-10 flex items-center px-4 gap-2 border-b border-white/5 bg-white/5">
          <Puzzle className="w-4 h-4 text-white/80" />
          <span className="text-xs font-bold text-white tracking-wide">{group.label}</span>
        </div>
        <div className="p-2 space-y-1">
          {group.items.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className="w-full h-10 flex items-center gap-3 px-2 rounded-xl hover:bg-white/10 transition-all group active:scale-[0.98]"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"
                style={{ backgroundColor: item.color }}
              >
                <item.icon className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors flex-1 text-left">
                {item.label}
              </span>
              {item.shortcut && (
                <span className="text-[10px] text-white/50 bg-white/5 px-2 py-0.5 rounded-md font-mono border border-white/5">
                  {item.shortcut}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-14 bg-[#000000] border-b border-white/10 flex items-center gap-2 max-sm:gap-1 px-3 max-sm:px-1.5 z-[1000] shadow-[0_4px_30px_rgba(0,0,0,0.3)] overflow-visible max-sm:overflow-hidden">
      <div className="flex items-center gap-2 px-3 max-sm:px-1 border-r border-white/10 shrink-0">
        <button
          onClick={() => {
            window.history.pushState({}, '', '/');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          className="flex items-center gap-3 hover:opacity-80 transition-all active:scale-95 group"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-white/20 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            <img
              src={PUBLIC_URLS.logo}
              alt="小天AICG"
              className="relative z-10 w-7 h-7 rounded-xl shadow-lg border border-white/10"
            />
          </div>
          <div className="max-sm:hidden">
            <h1 className="text-sm font-bold text-white tracking-wider">小天AICG</h1>
            {membership?.isLoggedIn ? (
              <p className="text-[10px] text-white/80 font-medium hidden sm:block tracking-tight">
                {membership.username}
              </p>
            ) : (
              <p className="text-[10px] text-white/80 font-medium hidden sm:block tracking-tight">
                AI 创作助手
              </p>
            )}
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
          <span className="hidden sm:inline">AI节点</span>
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
          <span className="hidden sm:inline">AI配音</span>
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
          <span className="hidden sm:inline">AI音乐</span>
        </button>
        <button
          onClick={() => setShowSponsorModal(true)}
          className={cn(
            'relative flex items-center gap-2 px-4 py-1.5 rounded-xl transition-all duration-300 text-sm font-semibold whitespace-nowrap overflow-hidden group',
            'text-white/60 hover:text-white hover:bg-white/5'
          )}
        >
          <Heart className="w-4 h-4 transition-transform group-hover:scale-110 text-pink-400" />
          <span className="hidden sm:inline">赞助</span>
        </button>
      </div>

      <div className="flex-1 min-w-0" />

      <div className="flex items-center gap-1 shrink-0 max-sm:hidden">
        {dropdownGroups.map((group) => (
          <div key={group.id} ref={dropdownBtnRef} className="relative shrink-0">
            <button
              onClick={() => {
                if (activeDropdown !== group.id) updateDropdownPos();
                setActiveDropdown(activeDropdown === group.id ? null : group.id);
              }}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-xl transition-all duration-300 font-bold',
                activeDropdown === group.id
                  ? 'bg-white/15 text-white shadow-lg scale-105'
                  : 'text-white/50 hover:bg-white/5 hover:text-white'
              )}
            >
              <span className="text-sm whitespace-nowrap hidden sm:inline tracking-wide">
                {group.label}
              </span>
              <span className="text-sm whitespace-nowrap sm:hidden">高级</span>
              <ChevronDown
                className={cn(
                  'w-4 h-4 transition-transform duration-300',
                  activeDropdown === group.id && 'rotate-180'
                )}
              />
            </button>
            {activeDropdown === group.id && renderDropdown(group.id)}
          </div>
        ))}
      </div>

      <div className="h-6 w-px bg-white/10 hidden sm:block shrink-0 mx-2" />

      <div className="flex items-center gap-1 shrink-0 max-sm:hidden">
        <button
          onClick={() => onOpenFileManager?.()}
          className="flex items-center justify-center w-9 h-9 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-90"
          title="文件管理 (Ctrl+I)"
        >
          <FolderOpen className="w-4 h-4" />
        </button>
        <button
          onClick={() => onOpenCacheClearPanel?.()}
          className="max-sm:hidden flex items-center justify-center w-9 h-9 text-white/50 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all active:scale-90"
          title="清除缓存"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onOpenSettings?.('general')}
          className="flex items-center justify-center w-9 h-9 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-90"
          title="设置"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div className="ml-2 max-sm:ml-0 shrink-0">
        <UserProfileDropdown />
      </div>

      {typeof window !== 'undefined' && window.electronAPI && <WindowControls />}

      {showSponsorModal && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onClick={() => setShowSponsorModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1A1A1D] p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/15">
                  <Heart className="h-5 w-5 text-pink-300" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">赞助支持</h2>
                  <p className="text-xs text-white/50">感谢支持小天 AICG 持续开发</p>
                  <p className="mt-1 text-xs text-white/60">QQ交流群18737262</p>
                </div>
              </div>
              <button
                onClick={() => setShowSponsorModal(false)}
                className="rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                title="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl bg-white p-3">
              <img
                src={PUBLIC_URLS.sponsorQrcode}
                alt="赞助二维码"
                className="h-auto w-full rounded-lg"
                onError={(event) => {
                  if (event.currentTarget.src.endsWith('/sponsor/qrcode.webp')) return;
                  event.currentTarget.src = PUBLIC_URLS.sponsorQrcodePng;
                }}
              />
            </div>
            <p className="mt-3 text-center text-xs text-white/45">扫码上方二维码即可赞助支持</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(TopToolbar);
