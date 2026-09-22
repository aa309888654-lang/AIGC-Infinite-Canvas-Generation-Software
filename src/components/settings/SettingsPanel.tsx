// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { PUBLIC_URLS } from '@/config/resources';
import { API_BASE_URL } from '@/lib/api-config';
import { navigateTo } from '@/routes';
import { toast } from 'sonner';
import {
  Settings,
  X,
  Palette,
  Zap,
  Keyboard,
  Folder,
  Bell,
  User,
  Info,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Monitor,
  Sun,
  Moon,
  Maximize2,
  Cpu,
  Image as ImageIcon,
  Lock,
  Server,
  Key,
  Loader2,
  MessageSquare,
  HardDrive,
  Heart,
  Copy
} from 'lucide-react';
import { LLMSettingsPanel } from './LLMSettingsPanel';
import MCPHubSettingsPanel from './MCPHubSettingsPanel';
import EnhancedAPIConfigPanel from './EnhancedAPIConfigPanel';
import StorageManagerPanel from '@/components/ui/StorageManagerPanel';
import { cn, safeOpen } from '@/lib/utils';
import { open } from '@tauri-apps/plugin-dialog';
import { userSettingsManager, type AllSettings as UserSettings, DEFAULT_SETTINGS } from '@/services/user-settings';
import { useThemeStore } from '@/store/themeStore';
import { frontendDataSyncService, type SyncProgress } from '@/services/frontend-sync-service';
import {
  useMembershipStore,
  getMembershipLevelName,
  canAccessProStudioFeature,
  dispatchProFeatureDenied,
} from '@/store/useMembershipStore';
import { APP_DISPLAY_VERSION, formatDisplayVersion } from '@/config/app-version';
import type { SettingsTarget } from '@/store/useAppPanelStore';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
  settingsTarget?: SettingsTarget;
}

type SettingsTab = 
  | 'interface' 
  | 'performance' 
  | 'api-config'
  | 'llm-config'
  | 'mcp-hub'
  | 'shortcuts' 
  | 'paths' 
  | 'storage'
  | 'notifications' 
  | 'account' 
  | 'about';

const TabItem = ({
  id,
  icon: Icon,
  label,
  isActive,
  onClick,
  isLocked = false,
}: {
  id: SettingsTab;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  onClick: (id: SettingsTab) => void;
  isLocked?: boolean;
}) => (
  <button
    onClick={() => onClick(id)}
    title={isLocked ? '需要专业版会员' : undefined}
    className={cn(
      'flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all w-full text-left',
      isActive 
        ? 'bg-gradient-to-r from-[#4B21FF]/20 to-[#AF52DE]/20 border border-[#4B21FF]/30 text-white'
        : 'hover:bg-white/5 text-white/60 hover:text-white/90',
      isLocked && !isActive && 'opacity-75'
    )}
  >
    <Icon className="w-4 h-4" />
    <span className="text-sm font-medium flex-1">{label}</span>
    {isLocked && <Lock className="w-3.5 h-3.5 text-yellow-300/80" />}
  </button>
);

const ToggleSwitch = ({ 
  checked, 
  onChange, 
  label 
}: { 
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) => (
  <div className="flex items-center gap-3">
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-11 h-6 rounded-full transition-colors duration-200',
        checked ? 'bg-[#4B21FF]' : 'bg-white/20'
      )}
    >
      <div
        className={cn(
          'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
    {label && <span className="text-sm text-white/70">{label}</span>}
  </div>
);

// API 配置用于用户自带模型 Key，所有已登录会员（含体验版）均可使用。
// 具体的云端凭据配额和请求鉴权仍由后端执行。
const PRO_CONFIG_TABS = new Set<SettingsTab>();
const PRO_CONFIG_TAB_LABELS: Partial<Record<SettingsTab, string>> = {
  'api-config': 'API配置',
};

const SHORTCUT_LABELS: Record<string, string> = {
  saveWorkflow: '保存工作流', openWorkflow: '打开工作流', newWorkflow: '新建工作流', exportWorkflow: '导出工作流', runWorkflow: '运行工作流',
  undo: '撤销', redo: '重做', delete: '删除所选', copy: '复制', paste: '粘贴', duplicate: '复制所选节点', selectAll: '全选节点', cancel: '取消 / 关闭',
  nodeSearch: '打开节点搜索', commandPalette: '打开命令面板', groupNodes: '节点打组', ungroupNodes: '取消打组', autoLayout: '自动水平布局',
  zoomIn: '放大画布', zoomOut: '缩小画布', fitView: '适应全部视图', resetZoom: '重置缩放', moveNodeUp: '所选节点上移', moveNodeDown: '所选节点下移', moveNodeLeft: '所选节点左移', moveNodeRight: '所选节点右移',
  panCanvas: '空格拖拽平移画布', panWithMiddleMouse: '中键拖拽平移', boxSelect: '框选节点', multiSelect: '多选节点', zoomWithWheel: '滚轮缩放', zoomWithPinch: '触控板捏合缩放',
};

const SHORTCUT_CATEGORIES: Array<{ title: string; description: string; ids: string[] }> = [
  { title: '工作流', description: '文件与执行操作', ids: ['saveWorkflow', 'openWorkflow', 'newWorkflow', 'exportWorkflow', 'runWorkflow'] },
  { title: '编辑', description: '选择、撤销与节点编辑', ids: ['undo', 'redo', 'delete', 'copy', 'paste', 'duplicate', 'selectAll', 'cancel'] },
  { title: '节点与面板', description: '创建、组织和管理节点', ids: ['nodeSearch', 'commandPalette', 'groupNodes', 'ungroupNodes', 'autoLayout'] },
  { title: '视图', description: '缩放、适应和微调位置', ids: ['zoomIn', 'zoomOut', 'fitView', 'resetZoom', 'moveNodeUp', 'moveNodeDown', 'moveNodeLeft', 'moveNodeRight'] },
  { title: '画布鼠标控制', description: '可录制空格、鼠标按键和滚轮', ids: ['panCanvas', 'panWithMiddleMouse', 'boxSelect', 'multiSelect', 'zoomWithWheel', 'zoomWithPinch'] },
];

const SettingsPanel = ({ isOpen, onClose, initialTab, settingsTarget }: SettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('interface');
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const { membership, refreshMembership } = useMembershipStore();
  const isLoggedIn = membership?.isLoggedIn === true;
  const canAccessProConfig = canAccessProStudioFeature(membership);

  const handleSettingsTabChange = useCallback((tab: SettingsTab) => {
    if (PRO_CONFIG_TABS.has(tab) && !canAccessProConfig) {
      const featureName = PRO_CONFIG_TAB_LABELS[tab] || '配置功能';
      dispatchProFeatureDenied(featureName);
      toast.warning(`${featureName}需要专业版会员`);
      return;
    }
    setActiveTab(tab);
  }, [canAccessProConfig]);

  useEffect(() => {
    if (isOpen && activeTab === 'account') {
      refreshMembership().catch(() => { /* noop */ });
    }
  }, [isOpen, activeTab, refreshMembership]);

  // 当打开面板时，如果提供了initialTab，使用它
  useEffect(() => {
    if (isOpen && initialTab) {
      handleSettingsTabChange(initialTab);
    }
  }, [isOpen, initialTab, handleSettingsTabChange]);

  useEffect(() => {
    if (isOpen && PRO_CONFIG_TABS.has(activeTab) && !canAccessProConfig) {
      setActiveTab('interface');
    }
  }, [isOpen, activeTab, canAccessProConfig]);
  const [settings, setSettings] = useState<UserSettings>(() => userSettingsManager.getAllSettings());
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const { theme, setTheme } = useThemeStore();
  
  const FEEDBACK_EMAIL = 'aa309888654@gmail.com';

  const copyFeedbackEmail = async () => {
    try {
      await navigator.clipboard.writeText(FEEDBACK_EMAIL);
      toast.success('邮箱地址已复制');
    } catch {
      toast.error(`复制失败，请手动复制：${FEEDBACK_EMAIL}`);
    }
  };

  // 检查更新函数
  const checkForUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateStatus('正在检查更新...');
    setUpdateAvailable(false);
    
    try {
      const response = await fetch(`${API_BASE_URL}/software/check?current=${encodeURIComponent(currentVersion)}&platform=win`);
      const data = await response.json();
      
      if (data.success && data.data) {
        const { hasUpdate, latestVersion: latest } = data.data;
        
        if (hasUpdate && latest) {
          setLatestVersion(latest);
          setUpdateAvailable(true);
          setUpdateStatus(`发现新版本 ${formatDisplayVersion(latest.version)}`);
        } else if (latest) {
          setLatestVersion(latest);
          setUpdateStatus('当前已是最新版本');
        } else {
          setUpdateStatus('暂无可用更新');
        }
      } else {
        setUpdateStatus('暂无可用更新');
      }
    } catch {
      setUpdateStatus('检查更新失败，请检查网络连接');
    } finally {
      setIsCheckingUpdate(false);
    }
  };
  
  // 下载更新函数
  const downloadUpdate = async () => {
    if (!latestVersion) return;

    setUpdateStatus('正在准备下载...');

    try {
      const downloadUrl = `${API_BASE_URL}/software/download/${latestVersion.version}`;

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = latestVersion.fileName || `update-${latestVersion.version}.exe`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setUpdateStatus('下载已开始，请完成安装后重启应用');
    } catch {
      setUpdateStatus('启动下载失败，请重试');
    }
  };
  
  // 快捷键编辑状态
  const [recordingShortcut, setRecordingShortcut] = useState<string | null>(null);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);

  // 软件更新相关状态
  interface VersionInfo {
    id: string;
    version: string;
    name: string;
    description?: string;
    releaseNotes?: string;
    platform?: string;
    fileName?: string;
    fileSize?: number;
    checksum?: string;
    createdAt?: string;
  }
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<VersionInfo | null>(null);
  const [currentVersion] = useState(APP_DISPLAY_VERSION);
  
  // 快捷键录制函数
  const startRecording = (shortcutId: string) => {
    setRecordingShortcut(shortcutId);
    setRecordedKeys([]);
  };
  
  const recordModifiers = (event: Pick<KeyboardEvent | MouseEvent | WheelEvent, 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>) => {
    const keys: string[] = [];
    if (event.ctrlKey || event.metaKey) keys.push('Ctrl');
    if (event.shiftKey) keys.push('Shift');
    if (event.altKey) keys.push('Alt');
    return keys;
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!recordingShortcut) return;
    e.preventDefault();
    e.stopPropagation();
    const keys = recordModifiers(e);
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      keys.push(e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key);
    }
    if (keys.length > 0) setRecordedKeys(keys);
  }, [recordingShortcut]);

  const handleMouseShortcut = useCallback((e: MouseEvent) => {
    if (!recordingShortcut) return;
    e.preventDefault();
    e.stopPropagation();
    const mouseKey = ['Left Mouse', 'Middle Mouse', 'Right Mouse', 'Mouse Button 4', 'Mouse Button 5'][e.button] || `Mouse Button ${e.button + 1}`;
    const heldSpace = recordedKeys.includes('Space') ? ['Space'] : [];
    setRecordedKeys([...recordModifiers(e), ...heldSpace, mouseKey]);
  }, [recordingShortcut, recordedKeys]);

  const handleWheelShortcut = useCallback((e: WheelEvent) => {
    if (!recordingShortcut) return;
    e.preventDefault();
    e.stopPropagation();
    const heldSpace = recordedKeys.includes('Space') ? ['Space'] : [];
    setRecordedKeys([...recordModifiers(e), ...heldSpace, 'Mouse Wheel']);
  }, [recordingShortcut, recordedKeys]);
  
  const confirmShortcut = () => {
    if (recordingShortcut && recordedKeys.length > 0) {
      const newShortcuts = { ...settings.shortcuts };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newShortcuts as any)[recordingShortcut] = recordedKeys.join(' + ');
      saveSettings({ shortcuts: newShortcuts });
      showSuccessToast('快捷键已更新');
    }
    setRecordingShortcut(null);
    setRecordedKeys([]);
  };
  
  const cancelRecording = () => {
    setRecordingShortcut(null);
    setRecordedKeys([]);
  };

  // 选择文件夹
  const selectFolder = async (pathType: 'modelsPath' | 'outputPath' | 'cachePath' | 'workflowsPath') => {
    const handleSelect = (selectedPath: string) => {
      if (selectedPath && selectedPath.trim() !== '') {
        const newPaths = { ...settings.paths, [pathType]: selectedPath };
        saveSettings({ paths: newPaths });
        showSuccessToast('路径已更新');
      }
    };

    try {
      // 尝试使用 Tauri 对话框
      try {
        const selected = await open({
          directory: true,
          multiple: false,
          title: '选择文件夹',
        });

        if (selected) {
          const selectedPath = Array.isArray(selected) ? selected[0] : selected;
          handleSelect(selectedPath);
          return;
        }
        return;
      } catch {
        // Tauri 对话框不可用，使用备选方案
      }

      // 备选方案：使用原生 input
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.style.display = 'none';

      input.onchange = (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          const file = files[0];
          const path = file.webkitRelativePath ? file.webkitRelativePath.split('/')[0] : null;
          if (path) {
            handleSelect(path);
          }
        }
        document.body.removeChild(input);
      };

      input.oncancel = () => {
        document.body.removeChild(input);
      };

      document.body.appendChild(input);
      input.click();

    } catch {
      toast.info('无法打开文件夹选择器，请手动输入路径。\n\n提示：在浏览器环境中可能不支持文件夹选择，请使用 Tauri 应用版本。');
    }
  };
  
  // 添加/移除键盘事件监听
  useEffect(() => {
    if (!recordingShortcut) return;
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('mousedown', handleMouseShortcut, true);
    window.addEventListener('wheel', handleWheelShortcut, { capture: true, passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('mousedown', handleMouseShortcut, true);
      window.removeEventListener('wheel', handleWheelShortcut, true);
    };
  }, [recordingShortcut, handleKeyDown, handleMouseShortcut, handleWheelShortcut]);

  const saveSettings = (newSettings: Partial<UserSettings>) => {
    if (!settings) return;
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    userSettingsManager.updateAllSettings(newSettings);
  };

  const showSuccessToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleExport = async () => {
    try {
      const data = userSettingsManager.exportSettings();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aicg-settings-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccessToast('设置已导出');
    } catch {
      showSuccessToast('导出失败');
    }
  };

  const handleImport = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const data = event.target?.result as string;
              userSettingsManager.importSettings(data);
              setSettings(userSettingsManager.getAllSettings());
              showSuccessToast('设置已导入');
            } catch {
              showSuccessToast('导入解析失败');
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
    } catch {
      showSuccessToast('导入失败');
    }
  };

  const handleReset = () => {
    if (confirm('确定要恢复所有默认设置吗？此操作不可撤销。')) {
      userSettingsManager.resetToDefaults();
      setSettings(userSettingsManager.getAllSettings());
      showSuccessToast('已恢复默认设置');
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'interface' as SettingsTab, icon: Palette, label: '界面设置' },
    { id: 'performance' as SettingsTab, icon: Zap, label: '性能设置' },
    { id: 'api-config' as SettingsTab, icon: Key, label: 'API配置' },
    { id: 'llm-config' as SettingsTab, icon: MessageSquare, label: 'LLM配置' },
    { id: 'mcp-hub' as SettingsTab, icon: Server, label: 'MCP Hub' },
    { id: 'shortcuts' as SettingsTab, icon: Keyboard, label: '快捷键设置' },
    { id: 'paths' as SettingsTab, icon: Folder, label: '路径设置' },
    { id: 'storage' as SettingsTab, icon: HardDrive, label: '存储管理' },
    { id: 'notifications' as SettingsTab, icon: Bell, label: '通知设置' },
    { id: 'account' as SettingsTab, icon: User, label: '账户与授权' },
    { id: 'about' as SettingsTab, icon: Info, label: '关于与更新' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 p-3 overflow-y-auto flex items-center justify-center">
      <div
        className="rounded-xl border-2 flex flex-col"
        style={{
          width: '940px',
          maxWidth: '92vw',
          minHeight: '560px',
          maxHeight: 'calc(100vh - 48px)',
          backgroundColor: '#1A1A1D',
          borderColor: 'rgba(255,255,255,0.08)',
          boxShadow: 'var(--shadow-glow)',
        }}
      >
        <div className="flex-1 flex flex-row overflow-hidden">
          <div className="w-56 border-r p-3 space-y-1.5 flex flex-col shrink-0 overflow-y-auto" style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#1E1E22' }}>
            <div className="flex items-center gap-3 px-3 py-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-[#4B21FF] to-[#AF52DE] flex items-center justify-center">
                <Settings className="w-[18px] h-[18px] text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">系统设置</div>
                <div className="text-xs text-white/50">配置与管理</div>
              </div>
            </div>

            <div className="space-y-1">
              {tabs.map((tab) => (
                <TabItem
                  key={tab.id}
                  id={tab.id}
                  icon={tab.icon}
                  label={tab.label}
                  isActive={activeTab === tab.id}
                  onClick={handleSettingsTabChange}
                  isLocked={PRO_CONFIG_TABS.has(tab.id) && !canAccessProConfig}
                />
              ))}
            </div>

            <div className="mt-auto pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="space-y-2">
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg w-full transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>导出设置</span>
                </button>
                <button
                  onClick={handleImport}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg w-full transition-all"
                >
                  <Upload className="w-4 h-4" />
                  <span>导入设置</span>
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg w-full transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>恢复默认</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <h2 className="text-lg font-semibold text-white">
                {tabs.find(t => t.id === activeTab)?.label}
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === 'interface' && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-white/90 flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      主题设置
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'dark', icon: Moon, label: '深色' },
                        { id: 'light', icon: Sun, label: '浅色' },
                        { id: 'auto', icon: Monitor, label: '自动' },
                      ].map(({ id, icon: Icon, label }) => (
                        <button
                          key={id}
                          onClick={() => {
                            const themeValue = id as 'dark' | 'light' | 'auto';
                            setTheme(themeValue);
                            saveSettings({ interface: { ...settings.interface, theme: themeValue } });
                          }}
                          className={cn(
                            'p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2',
                            theme === id
                              ? 'border-[#4B21FF] bg-[#4B21FF]/10'
                              : 'border-white/10 hover:border-white/20 bg-white/5'
                          )}
                        >
                          <Icon className="w-6 h-6 text-white" />
                          <span className="text-sm text-white/80">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <h3 className="text-sm font-medium text-white/90 flex items-center gap-2">
                      <Maximize2 className="w-4 h-4" />
                      UI缩放
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white/70">缩放比例</span>
                        <select
                          value={settings.interface.uiScale}
                          onChange={(e) => saveSettings({ interface: { ...settings.interface, uiScale: Number(e.target.value) } })}
                          style={{ backgroundColor: '#1E1E22', borderColor: 'rgba(255,255,255,0.08)' }}
                          className="px-3 py-1.5 rounded-lg border text-white text-sm"
                        >
                          <option value={0.8}>80%</option>
                          <option value={0.9}>90%</option>
                          <option value={1}>100%</option>
                          <option value={1.1}>110%</option>
                          <option value={1.2}>120%</option>
                          <option value={1.25}>125%</option>
                          <option value={1.5}>150%</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <h3 className="text-sm font-medium text-white/90 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      画布背景
                    </h3>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { id: 'transparent', label: '透明', color: 'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)' },
                        { id: 'dark', label: '深色', color: '#0F0F0F' },
                        { id: 'gray', label: '灰色', color: '#1F1F1F' },
                        { id: 'grid', label: '网格', color: 'linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)' },
                      ].map((bg) => (
                        <button
                          key={bg.id}
                          onClick={() => saveSettings({ interface: { ...settings.interface, canvasBackground: bg.id } })}
                          className={cn(
                            'p-3 rounded-xl border-2 transition-all',
                            settings.interface.canvasBackground === bg.id
                              ? 'border-[#4B21FF]'
                              : 'border-white/10 hover:border-white/20'
                          )}
                        >
                          <div
                            className="w-full h-12 rounded-lg mb-2"
                            style={{ background: bg.color, backgroundColor: bg.color.startsWith('linear') ? '#1a1a1a' : bg.color }}
                          />
                          <span className="text-xs text-white/70 block text-center">{bg.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'performance' && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-white/90 flex items-center gap-2">
                      <Cpu className="w-4 h-4" />
                      渲染性能
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-white/80">渲染精度</div>
                          <div className="text-xs text-white/50">控制画布渲染质量</div>
                        </div>
                        <select
                          value={settings.performance.renderQuality}
                          onChange={(e) => saveSettings({ performance: { ...settings.performance, renderQuality: e.target.value as 'low' | 'medium' | 'high' } })}
                          style={{ backgroundColor: '#1E1E22', borderColor: 'rgba(255,255,255,0.08)' }}
                          className="px-3 py-1.5 rounded-lg border text-white text-sm"
                        >
                          <option value="low">低性能模式</option>
                          <option value="medium">平衡</option>
                          <option value="high">高质量</option>
                          <option value="ultra">超高</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-white/80">启用硬件加速</div>
                          <div className="text-xs text-white/50">使用GPU加速渲染</div>
                        </div>
                        <ToggleSwitch
                          checked={settings.performance.enableHardwareAcceleration}
                          onChange={(v) => saveSettings({ performance: { ...settings.performance, enableHardwareAcceleration: v } })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-white/80">节点预览质量</div>
                          <div className="text-xs text-white/50">节点缩略图渲染质量</div>
                        </div>
                        <select
                          value={settings.performance.nodePreviewQuality}
                          onChange={(e) => saveSettings({ performance: { ...settings.performance, nodePreviewQuality: e.target.value as 'low' | 'medium' | 'high' } })}
                          style={{ backgroundColor: '#1E1E22', borderColor: 'rgba(255,255,255,0.08)' }}
                          className="px-3 py-1.5 rounded-lg border text-white text-sm"
                        >
                          <option value="low">低</option>
                          <option value="medium">中</option>
                          <option value="high">高</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <h3 className="text-sm font-medium text-white/90 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      缓存管理
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-white/80">最大缓存大小</div>
                          <div className="text-xs text-white/50">图片和节点缓存限制</div>
                        </div>
                        <select
                          value={settings.performance.maxCacheSize}
                          onChange={(e) => saveSettings({ performance: { ...settings.performance, maxCacheSize: Number(e.target.value) } })}
                          style={{ backgroundColor: '#1E1E22', borderColor: 'rgba(255,255,255,0.08)' }}
                          className="px-3 py-1.5 rounded-lg border text-white text-sm"
                        >
                          <option value={512}>512 MB</option>
                          <option value={1024}>1 GB</option>
                          <option value={2048}>2 GB</option>
                          <option value={4096}>4 GB</option>
                          <option value={8192}>8 GB</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-white/80">自动清理缓存</div>
                          <div className="text-xs text-white/50">定期清理过期缓存</div>
                        </div>
                        <ToggleSwitch
                          checked={settings.performance.autoCleanCache}
                          onChange={(v) => saveSettings({ performance: { ...settings.performance, autoCleanCache: v } })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'api-config' && (
                <EnhancedAPIConfigPanel
                  targetProvider={settingsTarget?.provider}
                  targetModel={settingsTarget?.model}
                />
              )}

              {activeTab === 'llm-config' && (
                <div className="h-full">
                  <LLMSettingsPanel />
                </div>
              )}

              {activeTab === 'mcp-hub' && (
                <div className="h-full">
                  <MCPHubSettingsPanel />
                </div>
              )}

              {activeTab === 'shortcuts' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-white/90 flex items-center gap-2">
                      <Keyboard className="w-4 h-4" />
                      快捷键配置
                    </h3>
                    <button
                      onClick={() => {
                        saveSettings({ shortcuts: DEFAULT_SETTINGS.shortcuts });
                        showSuccessToast('快捷键已重置');
                      }}
                      className="text-xs text-[#4B21FF] hover:text-[#AF52DE] flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      重置默认
                    </button>
                  </div>

                  <div className="space-y-3">
                    {SHORTCUT_CATEGORIES.map((category) => (
                      <section key={category.title} className="rounded-xl border border-white/10 bg-white/[0.025] overflow-hidden">
                        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-3 py-2.5 bg-white/[0.02]">
                          <div>
                            <h4 className="text-xs font-semibold text-white/90">{category.title}</h4>
                            <p className="mt-0.5 text-[11px] text-white/40">{category.description}</p>
                          </div>
                          <span className="text-[10px] text-white/35">{category.ids.length} 项</span>
                        </div>
                        <div className="divide-y divide-white/[0.06]">
                          {category.ids.map((key) => {
                            const value = settings.shortcuts[key] ?? (DEFAULT_SETTINGS.shortcuts as Record<string, string>)[key] ?? '';
                            const isConflict = recordingShortcut === key && recordedKeys.length > 0 && Object.entries(settings.shortcuts)
                              .some(([otherKey, otherValue]) => otherKey !== key && String(otherValue).replace(/\s/g, '').toLowerCase() === recordedKeys.join('+').replace(/\s/g, '').toLowerCase());
                            return (
                              <div key={key} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
                                <span className="min-w-0 text-xs text-white/70">{SHORTCUT_LABELS[key] || key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                <div className="shrink-0 flex items-center gap-2">
                                  {recordingShortcut === key ? (
                                    <div className="flex items-center gap-1.5">
                                      <kbd className={cn('max-w-[170px] truncate px-2 py-1 rounded border text-[11px] text-white font-mono min-w-[92px] text-center', isConflict ? 'bg-red-500/15 border-red-400/50' : 'bg-[#4B21FF]/30 border-[#4B21FF]')}>
                                        {recordedKeys.length > 0 ? recordedKeys.join(' + ') : '按下按键或鼠标...'}
                                      </kbd>
                                      <button onClick={confirmShortcut} disabled={recordedKeys.length === 0 || isConflict} className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-[11px] hover:bg-green-500/30 disabled:opacity-40">确认</button>
                                      <button onClick={cancelRecording} className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-[11px] hover:bg-red-500/30">取消</button>
                                    </div>
                                  ) : (
                                    <button onClick={() => startRecording(key)} className="max-w-[185px] truncate px-2 py-1 rounded bg-white/10 border border-white/20 text-[11px] text-white font-mono hover:bg-white/20 transition-colors" title="点击后按下键盘、鼠标按键或滚轮">
                                      {String(value)}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                  
                  {recordingShortcut && (
                    <div className="mt-4 p-3 rounded-lg bg-[#4B21FF]/10 border border-[#4B21FF]/30">
                      <p className="text-xs text-white/70">
                        按下新的快捷键组合，然后点击&quot;确认&quot;保存，或点击&quot;取消&quot;放弃。
                        <br />
                        <span className="text-[#4B21FF]">提示：可录制 Ctrl/Shift/Alt、空格、左右/中键鼠标和滚轮；重复组合会标红，无法保存</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'paths' && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-white/90 flex items-center gap-2">
                      <Folder className="w-4 h-4" />
                      路径配置
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm text-white/70">模型路径</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={settings.paths.modelsPath}
                            onChange={(e) => saveSettings({ paths: { ...settings.paths, modelsPath: e.target.value } })}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono"
                          />
                          <button 
                            onClick={() => selectFolder('modelsPath')}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-sm transition-all"
                          >
                            浏览
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm text-white/70">输出路径</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={settings.paths.outputPath}
                            onChange={(e) => saveSettings({ paths: { ...settings.paths, outputPath: e.target.value } })}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono"
                          />
                          <button 
                            onClick={() => selectFolder('outputPath')}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-sm transition-all"
                          >
                            浏览
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm text-white/70">缓存路径</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={settings.paths.cachePath}
                            onChange={(e) => saveSettings({ paths: { ...settings.paths, cachePath: e.target.value } })}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono"
                          />
                          <button 
                            onClick={() => selectFolder('cachePath')}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-sm transition-all"
                          >
                            浏览
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm text-white/70">工作流保存路径</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={settings.paths.workflowsPath}
                            onChange={(e) => saveSettings({ paths: { ...settings.paths, workflowsPath: e.target.value } })}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono"
                          />
                          <button 
                            onClick={() => selectFolder('workflowsPath')}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-sm transition-all"
                          >
                            浏览
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-white/90 flex items-center gap-2">
                      <Bell className="w-4 h-4" />
                      通知设置
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <div className="text-sm text-white/80">启用系统通知</div>
                          <div className="text-xs text-white/50">显示桌面通知</div>
                        </div>
                        <ToggleSwitch
                          checked={settings.notifications.enabled}
                          onChange={(v) => saveSettings({ notifications: { ...settings.notifications, enabled: v } })}
                        />
                      </div>

                      <div className="flex items-center justify-between py-2">
                        <div>
                          <div className="text-sm text-white/80">生成完成通知</div>
                          <div className="text-xs text-white/50">AI图片生成完成时提示</div>
                        </div>
                        <ToggleSwitch
                          checked={settings.notifications.onGenerationComplete}
                          onChange={(v) => saveSettings({ notifications: { ...settings.notifications, onGenerationComplete: v } })}
                        />
                      </div>

                      <div className="flex items-center justify-between py-2">
                        <div>
                          <div className="text-sm text-white/80">错误警告</div>
                          <div className="text-xs text-white/50">显示错误和警告提示</div>
                        </div>
                        <ToggleSwitch
                          checked={settings.notifications.onError}
                          onChange={(v) => saveSettings({ notifications: { ...settings.notifications, onError: v } })}
                        />
                      </div>

                      <div className="flex items-center justify-between py-2">
                        <div>
                          <div className="text-sm text-white/80">进度通知</div>
                          <div className="text-xs text-white/50">显示任务进度更新</div>
                        </div>
                        <ToggleSwitch
                          checked={settings.notifications.onProgress}
                          onChange={(v) => saveSettings({ notifications: { ...settings.notifications, onProgress: v } })}
                        />
                      </div>

                      <div className="flex items-center justify-between py-2">
                        <div>
                          <div className="text-sm text-white/80">播放提示音</div>
                          <div className="text-xs text-white/50">生成完成时播放声音</div>
                        </div>
                        <ToggleSwitch
                          checked={settings.notifications.playSound}
                          onChange={(v) => saveSettings({ notifications: { ...settings.notifications, playSound: v } })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'account' && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-white/90 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      账户信息
                    </h3>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                          <User className="w-8 h-8 text-white/70" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-white font-medium">本地模式</div>
                          <div className="text-sm text-white/50">无需登录，模型密钥与创作数据均在本机运行</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)', display: 'none' }}>
                    <h3 className="text-sm font-medium text-white/90 flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      授权信息
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-white/70">许可证状态</span>
                        <span className="text-sm text-yellow-400 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {isLoggedIn ? getMembershipLevelName(membership?.membershipLevel, membership?.membershipDisplayName) : '免费版'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-white/70">到期日期</span>
                        <span className="text-sm text-white/50">
                          {membership?.membershipExpiry ? new Date(membership.membershipExpiry).toLocaleDateString() : '永久'}
                        </span>
                      </div>
                    </div>
                    {!isLoggedIn || membership?.membershipLevel === 'free' ? (
                      <button 
                        className="w-full py-2 rounded-lg border border-white/20 text-white/70 text-sm hover:bg-white/5 transition-all"
                        onClick={() => navigateTo('/')}
                      >
                        升级到专业版
                      </button>
                    ) : null}
                  </div>

                  <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <h3 className="text-sm font-medium text-white/90 flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      数据云端同步
                    </h3>
                    <DataSyncSection />
                  </div>

                  <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <h3 className="text-sm font-medium text-white/90 flex items-center gap-2">
                      <Server className="w-4 h-4" />
                      AICG链接
                    </h3>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-sm text-white/70">服务器地址</label>
                        <input
                          type="text"
                          value={settings.comfyui.serverUrl}
                          onChange={(e) => saveSettings({ comfyui: { ...settings.comfyui, serverUrl: e.target.value } })}
                          className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono"
                        />
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-white/70">自动连接</span>
                        <ToggleSwitch
                          checked={settings.comfyui.autoConnect}
                          onChange={(v) => saveSettings({ comfyui: { ...settings.comfyui, autoConnect: v } })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'storage' && (
                <div className="space-y-6 h-full">
                  <div className="h-full">
                    <StorageManagerPanel isOpen={true} embedded={true} />
                  </div>
                </div>
              )}

              {activeTab === 'about' && (
                <div className="space-y-6">
                  <div className="text-center py-8">
                    <div className="w-20 h-20 mx-auto rounded-2xl overflow-hidden bg-gradient-to-r from-[#4B21FF] to-[#AF52DE] flex items-center justify-center mb-4">
                      <img
                        src={PUBLIC_URLS.logo}
                        alt="AICG Icon"
                        className="w-full h-full object-cover"
                      />
                    </div>
                      <h2 className="text-xl font-bold text-white">小天画布</h2>
                    <p className="text-white/60 mt-1">版本 {APP_DISPLAY_VERSION}</p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-white/90 flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      关于
                    </h3>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-sm text-white/70 leading-relaxed mb-3">
                        独立制作人开发的AI生成画布软件，欢迎大家赞助，让创意自由流动。
                        不定时更新。
                      </p>
                      <button
                        onClick={() => {
                          setShowSponsorModal(true);
                        }}
                        className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-sm font-medium transition-all"
                      >
                        ❤️ 赞助支持
                      </button>
                      <button
                        onClick={() => {
                          if (typeof window !== 'undefined' && window.electronAPI) {
                            window.open('https://aicgxt.com/', '_blank', 'noopener,noreferrer');
                          } else {
                            window.location.href = 'https://aicgxt.com/';
                          }
                        }}
                        className="w-full px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium transition-all flex items-center justify-center gap-2"
                      >
                        🌐 访问官网 aicgxt.com
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <h3 className="text-sm font-medium text-white/90 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      联系与反馈
                    </h3>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm text-white/80">意见与建议邮箱</div>
                        <div className="text-xs text-white/50">欢迎来信反馈问题与想法，点击右侧即可复制</div>
                      </div>
                      <button
                        onClick={copyFeedbackEmail}
                        className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm transition-all flex items-center gap-2 shrink-0"
                        title="点击复制邮箱地址"
                      >
                        <Copy className="w-3.5 h-3.5 text-white/60" />
                        {FEEDBACK_EMAIL}
                      </button>
                    </div>
                    {updateAvailable && latestVersion && (
                      <div className="p-4 rounded-xl bg-[#4B21FF]/10 border border-[#4B21FF]/30 mt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Download className="w-4 h-4 text-[#4B21FF]" />
                          <span className="text-sm text-white font-medium">发现新版本：{formatDisplayVersion(latestVersion.version)}</span>
                        </div>
                        {latestVersion.name && (
                          <div className="text-sm text-white/70 mb-1">{latestVersion.name}</div>
                        )}
                        {(latestVersion.releaseNotes || latestVersion.description) && (
                          <div className="text-xs text-white/50 mb-3 whitespace-pre-line">
                            {latestVersion.releaseNotes || latestVersion.description}
                          </div>
                        )}
                        {latestVersion.fileSize && (
                          <div className="text-xs text-white/40 mb-3">
                            文件大小：{(latestVersion.fileSize / 1024 / 1024).toFixed(1)} MB
                            {latestVersion.fileName && ` · ${latestVersion.fileName}`}
                          </div>
                        )}
                        <button 
                          onClick={downloadUpdate}
                          className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#4B21FF] to-[#AF52DE] hover:opacity-90 text-white text-sm transition-all flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          下载并安装
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 text-center text-xs text-white/40">
                    <p>© 2026.07 AICG. All rights reserved.</p>
                    <p className="mt-1">MIT License</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#1E1E22' }}>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all"
              >
                关闭
              </button>
              <button
                onClick={() => {
                  showSuccessToast('设置已保存');
                  onClose();
                }}
                className="px-6 py-2 text-sm font-medium rounded-lg text-white"
                style={{ background: 'linear-gradient(135deg, #4B21FF, #AF52DE)' }}
              >
                保存并关闭
              </button>
            </div>
          </div>
        </div>
      </div>

      {showToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60]">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#22c55e] text-white shadow-lg">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* 赞助模态框 */}
      {showSponsorModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center"
          onClick={() => setShowSponsorModal(false)}
        >
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
          <div
            className="relative max-h-[90vh] w-full max-w-md mx-4 overflow-y-auto rounded-2xl border border-white/10 bg-[#1A1A1D] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowSponsorModal(false)}
              className="absolute top-4 right-4 rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              title="关闭"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/15">
                <Heart className="h-5 w-5 text-pink-300" fill="currentColor" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">感谢您的支持</h3>
                <p className="text-xs text-white/50">谢谢你喜欢小天画布 ♥</p>
              </div>
            </div>

            <div className="flex flex-col items-center rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-white/70 text-center">每一份甜，都是小天持续创作的动力 ✨</p>
              <div className="mt-3 rounded-xl bg-white p-2.5">
                <img
                  src={PUBLIC_URLS.sponsorQrcode}
                  alt="赞助二维码"
                  className="block h-52 w-52"
                />
              </div>
              <p className="mt-3 text-center text-xs text-white/50">
                微信「扫一扫」，<span className="font-medium text-pink-300">把这份甜送来</span> 🍬
              </p>
            </div>

            <p className="mt-4 text-center text-[11px] text-white/35">
              扫码时备注你的邮箱，将为你开通专属权限
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

function DataSyncSection() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
    storageQuota?: { usedPercent: number; used: number; limit: number; remaining: number }
  } | null>(null);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [dataSummary, setDataSummary] = useState<ReturnType<typeof frontendDataSyncService.getDataSummary> | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{
    quota?: { fileCount: number; fileLimit: number; usedPercent: number; used: number; limit: number; remaining: number };
    files?: { id: string; originalName: string; size: number; url?: string; mimeType?: string }[];
  } | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [syncingFileId, setSyncingFileId] = useState<string | null>(null);

  useEffect(() => {
    setDataSummary(frontendDataSyncService.getDataSummary());
    loadStorageInfo();
  }, []);

  const loadStorageInfo = async () => {
    try {
      const result = await frontendDataSyncService.getStorageInfo();
      if (result.success && result.data) {
        setStorageInfo(result.data);
      }
    } catch { /* ignored */ }
  };

  const handleDeleteFile = async (fileId: string) => {
    setDeletingFileId(fileId);
    try {
      const token = safeGetAuthToken();
      const requestHeaders: Record<string, string> = {};
      if (token) requestHeaders.Authorization = `Bearer ${token}`;
      const response = await fetch(`/api/v1/files/${fileId}`, {
        method: 'DELETE',
        headers: requestHeaders,
      });
      const data = await response.json();
      if (data.success) {
        toast.success('文件已删除');
        loadStorageInfo();
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch {
      toast.error('删除文件失败');
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleDownloadFile = async (fileId: string, fileName: string) => {
    setDownloadingFileId(fileId);
    try {
      const token = safeGetAuthToken();
      const response = await fetch(`/api/v1/files/${fileId}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('下载失败');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('下载完成');
    } catch {
      try {
        const file = storageInfo?.files?.find(f => f.id === fileId);
        if (file?.url) {
          // SEC M-3 修复：使用 safeOpen 替代 window.open
          safeOpen(file.url);
          toast.success('已在新窗口打开下载');
        } else {
          toast.error('下载失败');
        }
      } catch {
        toast.error('下载文件失败');
      }
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleSyncToLocal = async (fileId: string, fileName: string) => {
    setSyncingFileId(fileId);
    try {
      const token = safeGetAuthToken();
      const response = await fetch(`/api/v1/files/${fileId}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('获取文件失败');
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
      const { addFile } = await import('@/store/useFileStore');
      const fileStore = (await import('@/store/useFileStore')).useFileStore.getState();
      const localUrl = URL.createObjectURL(blob);
      const fileType = blob.type.startsWith('image/') ? 'image' : blob.type.startsWith('video/') ? 'video' : blob.type.startsWith('audio/') ? 'audio' : 'other';
      fileStore.addFile({
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: fileName,
        type: fileType,
        url: localUrl,
        size: blob.size,
        source: 'cloud-sync',
        createdAt: new Date().toISOString(),
        metadata: { syncedFromCloud: true, cloudFileId: fileId },
      });
      toast.success('已同步到本地文件管理');
    } catch {
      try {
        const file = storageInfo?.files?.find(f => f.id === fileId);
        if (file?.url) {
          const { useFileStore: getFileStore } = await import('@/store/useFileStore');
          const fileStore = getFileStore.getState();
          const fileType = (file.mimeType || '').startsWith('image/') ? 'image' : (file.mimeType || '').startsWith('video/') ? 'video' : (file.mimeType || '').startsWith('audio/') ? 'audio' : 'other';
          fileStore.addFile({
            id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: file.originalName,
            type: fileType,
            url: file.url,
            size: file.size,
            source: 'cloud-sync',
            createdAt: new Date().toISOString(),
            metadata: { syncedFromCloud: true, cloudFileId: fileId },
          });
          toast.success('已同步到本地文件管理');
        } else {
          toast.error('同步失败');
        }
      } catch {
        toast.error('同步到本地失败');
      }
    } finally {
      setSyncingFileId(null);
    }
  };

  const safeGetAuthToken = (): string | null => {
    try { return localStorage.getItem('authToken') || localStorage.getItem('token'); } catch { return null; }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    setProgress(null);

    try {
      const result = await frontendDataSyncService.syncToBackend({
        onProgress: (p) => setProgress(p),
        includeSensitive,
      });

      if (result.success && result.result) {
        const summary = result.result.summary;
        const errorInfo = summary.errors.length > 0
          ? `\n(${summary.errors.length} 个警告: ${summary.errors.slice(0, 3).join('; ')})`
          : '';
        setSyncResult({
          success: true,
          message: `同步成功！用户${summary.userCreatedOrUpdated ? '已创建/更新' : '无变化'}，积分 ${summary.pointsSynced} 条，任务 ${summary.tasksSynced} 条，日志 ${summary.usageLogsSynced} 条，API配置 ${summary.apiConfigsSynced} 个，工作流 ${summary.workflowsSynced} 个，节点文件 ${summary.nodeFilesSynced} 个${errorInfo}`,
          details: JSON.stringify(summary, null, 2),
          storageQuota: result.result.storageQuota,
        });
        setDataSummary(frontendDataSyncService.getDataSummary());
        loadStorageInfo();
      } else {
        setSyncResult({
          success: false,
          message: result.error || '同步失败，请检查网络连接和登录状态',
        });
      }
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: (err as Error).message || '同步过程中发生错误',
      });
    } finally {
      setIsSyncing(false);
      setProgress(null);
    }
  };

  const lastSyncTime = frontendDataSyncService.getLastSyncTime();
  const syncCount = frontendDataSyncService.getSyncCount();

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">数据概览</span>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-gray-400 hover:text-gray-300"
          >
            {showDetails ? '收起详情' : '查看详情'}
          </button>
        </div>

        {dataSummary && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex justify-between py-1 px-2 rounded bg-white/5">
              <span className="text-white/50">用户资料</span>
              <span className={dataSummary.hasUserProfile ? 'text-green-400' : 'text-white/30'}>
                {dataSummary.hasUserProfile ? '✓ 有数据' : '✗ 无'}
              </span>
            </div>
            <div className="flex justify-between py-1 px-2 rounded bg-white/5">
              <span className="text-white/50">生成记录</span>
              <span className="text-white/80">{dataSummary.generationRecordsCount}</span>
            </div>
            <div className="flex justify-between py-1 px-2 rounded bg-white/5">
              <span className="text-white/50">API配置</span>
              <span className="text-white/80">{dataSummary.apiConfigsCount}</span>
            </div>
            <div className="flex justify-between py-1 px-2 rounded bg-white/5">
              <span className="text-white/50">任务记录</span>
              <span className="text-white/80">{dataSummary.tasksCount}</span>
            </div>
            <div className="flex justify-between py-1 px-2 rounded bg-white/5">
              <span className="text-white/50">工作流</span>
              <span className="text-white/80">{dataSummary.workflowsCount}</span>
            </div>
            <div className="flex justify-between py-1 px-2 rounded bg-white/5">
              <span className="text-white/50">节点文件</span>
              <span className="text-white/80">{dataSummary.nodeFilesCount}</span>
            </div>
            <div className="col-span-2 flex justify-between py-1 px-2 rounded bg-white/5">
              <span className="text-white/50">预估大小</span>
              <span className="text-gray-300 font-medium">{dataSummary.estimatedSize}</span>
            </div>
          </div>
        )}

        {showDetails && dataSummary && (
          <pre className="text-xs text-white/40 bg-black/20 p-2 rounded-lg overflow-auto max-h-32">
            {JSON.stringify(dataSummary, null, 2)}
          </pre>
        )}
      </div>

      {(storageInfo?.quota) && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-gray-500/10 border border-purple-500/20 space-y-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-white/70 font-medium">云端存储空间</span>
            <span className="ml-auto text-xs text-white/40">
              {storageInfo.quota.fileCount}/{storageInfo.quota.fileLimit} 文件
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="h-2 bg-black/30 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  storageInfo.quota.usedPercent > 90
                    ? 'bg-red-500'
                    : storageInfo.quota.usedPercent > 70
                    ? 'bg-yellow-500'
                    : 'bg-gradient-to-r from-purple-500 to-gray-500'
                }`}
                style={{ width: `${Math.min(storageInfo.quota.usedPercent, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/50">
                已用 {formatBytes(storageInfo.quota.used)} / {formatBytes(storageInfo.quota.limit)}
              </span>
              <span className={
                storageInfo.quota.usedPercent > 90
                  ? 'text-red-400'
                  : storageInfo.quota.usedPercent > 70
                  ? 'text-yellow-400'
                  : 'text-green-400'
              }>
                剩余 {formatBytes(storageInfo.quota.remaining)} ({(100 - storageInfo.quota.usedPercent).toFixed(1)}%)
              </span>
            </div>
          </div>

          {storageInfo.files && storageInfo.files.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1 mt-2">
              {storageInfo.files.slice(0, 8).map((f) => (
                <div key={f.id} className="flex items-center gap-1 text-xs py-1.5 px-2 rounded bg-black/20 group">
                  <span className="text-white/60 truncate flex-1 mr-1 min-w-0">{f.originalName}</span>
                  <span className="text-white/40 shrink-0">{formatBytes(f.size)}</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                    <button
                      onClick={() => handleDownloadFile(f.id, f.originalName)}
                      disabled={downloadingFileId === f.id}
                      className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-blue-400 transition-colors disabled:opacity-30"
                      title="下载文件"
                    >
                      {downloadingFileId === f.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      onClick={() => handleSyncToLocal(f.id, f.originalName)}
                      disabled={syncingFileId === f.id}
                      className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-green-400 transition-colors disabled:opacity-30"
                      title="同步到本地文件管理"
                    >
                      {syncingFileId === f.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteFile(f.id)}
                      disabled={deletingFileId === f.id}
                      className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-red-400 transition-colors disabled:opacity-30"
                      title="删除文件"
                    >
                      {deletingFileId === f.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <X className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
              {storageInfo.files.length > 8 && (
                <div className="text-xs text-white/30 text-center py-1">
                  还有 {storageInfo.files.length - 8} 个文件...
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(lastSyncTime || syncCount > 0) && (
        <div className="flex items-center gap-2 text-xs text-white/40 px-1">
          <CheckCircle2 className="w-3 h-3" />
          上次同步: {lastSyncTime ? new Date(lastSyncTime).toLocaleString('zh-CN') : '从未'} · 已同步 {syncCount} 次
        </div>
      )}

      <div className="flex items-center gap-2 px-1">
        <input
          type="checkbox"
          id="includeSensitive"
          checked={includeSensitive}
          onChange={(e) => setIncludeSensitive(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="includeSensitive" className="text-xs text-white/50 cursor-pointer">
          包含敏感信息（API密钥等）
        </label>
      </div>

      <button
        onClick={handleSync}
        disabled={isSyncing || frontendDataSyncService.getIsSyncing()}
        className="w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        style={{
          background: isSyncing
            ? 'linear-gradient(135deg, #666, #888)'
            : 'linear-gradient(135deg, #4B21FF, #AF52DE)',
        }}
      >
        {isSyncing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {progress?.message || '正在同步...'}
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            开始全量同步到云端
          </>
        )}
      </button>

      {progress && isSyncing && (
        <div className="space-y-1">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300 rounded-full"
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
                background: 'linear-gradient(90deg, #4B21FF, #AF52DE)',
              }}
            />
          </div>
          <div className="text-xs text-white/40 text-right">
            {progress.current}/{progress.total} - {progress.stage}
          </div>
        </div>
      )}

      {syncResult && (
        <div
          className={`p-3 rounded-lg ${
            syncResult.success
              ? 'bg-green-500/10 border border-green-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}
        >
          <div className={`flex items-start gap-2 text-sm ${syncResult.success ? 'text-green-300' : 'text-red-300'}`}>
            {syncResult.success ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <div>
              <p>{syncResult.message}</p>
              {syncResult.storageQuota && (
                <p className="text-xs opacity-70 mt-1">
                  存储空间: {syncResult.storageQuota.usedPercent}% ({formatBytes(syncResult.storageQuota.used)} / {formatBytes(syncResult.storageQuota.limit)})
                </p>
              )}
              {syncResult.details && (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(syncResult.details!);
                  }}
                  className="text-xs opacity-60 hover:opacity-100 mt-1 underline"
                >
                  复制详细结果
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default SettingsPanel;

