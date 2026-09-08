export interface KeyboardShortcut {
  id: string;
  action: string;
  category: string;
  keys: string;
  defaultKeys: string;
  description: string;
}

export interface PerformanceSettings {
  memoryLimitMB: number;
  threadCount: number;
  gpuAcceleration: boolean;
  gpuDevice: string;
  backgroundRendering: boolean;
  renderPriority: 'low' | 'normal' | 'high';
  proxyQuality: 'off' | 'low' | 'medium' | 'high';
}

export interface RenderSettings {
  defaultFormat: 'mp4' | 'mov' | 'avi' | 'mkv' | 'webm';
  quality: 'draft' | 'good' | 'high' | 'ultra';
  codec: 'h264' | 'h265' | 'vp9' | 'av1';
  bitrate: number;
  audioCodec: 'aac' | 'opus' | 'pcm';
  audioBitrate: number;
  audioSampleRate: number;
  maxResolution: '720p' | '1080p' | '2k' | '4k';
}

export interface ExportPreset {
  id: string;
  name: string;
  format: RenderSettings['defaultFormat'];
  quality: RenderSettings['quality'];
  codec: RenderSettings['codec'];
  bitrate: number;
  resolution: string;
}

export interface InterfaceSettings {
  theme: 'dark' | 'light' | 'system';
  language: 'zh-CN' | 'en-US';
  fontSize: 'small' | 'medium' | 'large';
  showStatusBar: boolean;
  showToolbar: boolean;
  compactMode: boolean;
  panelLayout: 'default' | 'editing' | 'color' | 'audio' | 'custom';
  autoHidePanels: boolean;
  timelineHeight: number;
  defaultPanelWidth: number;
}

export interface AIModelSettings {
  defaultModel: string;
  apiEndpoint: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  enableStreaming: boolean;
  timeout: number;
  retryCount: number;
}

export interface AppSettings {
  shortcuts: KeyboardShortcut[];
  performance: PerformanceSettings;
  render: RenderSettings;
  interface: InterfaceSettings;
  aiModel: AIModelSettings;
  autoSaveInterval: number;
  cacheDir: string;
  outputDir: string;
  exportPresets: ExportPreset[];
}

const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  { id: 'play-pause', action: '播放/暂停', category: '播放', keys: 'Space', defaultKeys: 'Space', description: '切换播放和暂停' },
  { id: 'stop', action: '停止', category: '播放', keys: 'Shift+Space', defaultKeys: 'Shift+Space', description: '停止播放并回到起点' },
  { id: 'skip-back', action: '后退5秒', category: '播放', keys: 'ArrowLeft', defaultKeys: 'ArrowLeft', description: '后退5秒' },
  { id: 'skip-forward', action: '前进5秒', category: '播放', keys: 'ArrowRight', defaultKeys: 'ArrowRight', description: '前进5秒' },
  { id: 'frame-back', action: '后退一帧', category: '播放', keys: 'ArrowLeft', defaultKeys: 'ArrowLeft', description: '后退一帧' },
  { id: 'frame-forward', action: '前进一帧', category: '播放', keys: 'ArrowRight', defaultKeys: 'ArrowRight', description: '前进一帧' },
  { id: 'select-tool', action: '选择工具', category: '工具', keys: 'V', defaultKeys: 'V', description: '切换到选择工具' },
  { id: 'razor-tool', action: '剃刀工具', category: '工具', keys: 'C', defaultKeys: 'C', description: '切换到剃刀工具' },
  { id: 'hand-tool', action: '手形工具', category: '工具', keys: 'H', defaultKeys: 'H', description: '切换到手形工具' },
  { id: 'split-clip', action: '分割片段', category: '编辑', keys: 'B', defaultKeys: 'B', description: '在播放头位置分割选中片段' },
  { id: 'delete', action: '删除', category: '编辑', keys: 'Delete', defaultKeys: 'Delete', description: '删除选中片段' },
  { id: 'copy', action: '复制', category: '编辑', keys: 'Ctrl+C', defaultKeys: 'Ctrl+C', description: '复制选中片段' },
  { id: 'paste', action: '粘贴', category: '编辑', keys: 'Ctrl+V', defaultKeys: 'Ctrl+V', description: '粘贴片段' },
  { id: 'undo', action: '撤销', category: '编辑', keys: 'Ctrl+Z', defaultKeys: 'Ctrl+Z', description: '撤销上一步操作' },
  { id: 'redo', action: '重做', category: '编辑', keys: 'Ctrl+Shift+Z', defaultKeys: 'Ctrl+Shift+Z', description: '重做上一步操作' },
  { id: 'save', action: '保存', category: '文件', keys: 'Ctrl+S', defaultKeys: 'Ctrl+S', description: '保存项目' },
  { id: 'save-as', action: '另存为', category: '文件', keys: 'Ctrl+Shift+S', defaultKeys: 'Ctrl+Shift+S', description: '另存项目' },
  { id: 'new-project', action: '新建项目', category: '文件', keys: 'Ctrl+N', defaultKeys: 'Ctrl+N', description: '创建新项目' },
  { id: 'open-project', action: '打开项目', category: '文件', keys: 'Ctrl+O', defaultKeys: 'Ctrl+O', description: '打开已有项目' },
  { id: 'zoom-in', action: '放大时间轴', category: '视图', keys: 'Ctrl+=', defaultKeys: 'Ctrl+=', description: '放大时间轴' },
  { id: 'zoom-out', action: '缩小时间轴', category: '视图', keys: 'Ctrl+-', defaultKeys: 'Ctrl+-', description: '缩小时间轴' },
  { id: 'snap-toggle', action: '吸附开关', category: '视图', keys: 'N', defaultKeys: 'N', description: '切换吸附到网格' },
];

const DEFAULT_EXPORT_PRESETS: ExportPreset[] = [
  { id: 'youtube-1080', name: 'YouTube 1080p', format: 'mp4', quality: 'high', codec: 'h264', bitrate: 12000, resolution: '1920x1080' },
  { id: 'youtube-4k', name: 'YouTube 4K', format: 'mp4', quality: 'ultra', codec: 'h264', bitrate: 40000, resolution: '3840x2160' },
  { id: 'tiktok', name: 'TikTok', format: 'mp4', quality: 'high', codec: 'h264', bitrate: 8000, resolution: '1080x1920' },
  { id: 'wechat', name: '微信', format: 'mp4', quality: 'good', codec: 'h264', bitrate: 4000, resolution: '1280x720' },
  { id: 'prores', name: 'ProRes 高质量', format: 'mov', quality: 'ultra', codec: 'h264', bitrate: 100000, resolution: '1920x1080' },
  { id: 'web-webm', name: 'Web WebM', format: 'webm', quality: 'high', codec: 'vp9', bitrate: 8000, resolution: '1920x1080' },
];

export const DEFAULT_SETTINGS: AppSettings = {
  shortcuts: [...DEFAULT_SHORTCUTS],
  performance: {
    memoryLimitMB: 4096,
    threadCount: navigator?.hardwareConcurrency || 4,
    gpuAcceleration: true,
    gpuDevice: 'auto',
    backgroundRendering: false,
    renderPriority: 'normal',
    proxyQuality: 'medium',
  },
  render: {
    defaultFormat: 'mp4',
    quality: 'high',
    codec: 'h264',
    bitrate: 12000,
    audioCodec: 'aac',
    audioBitrate: 320,
    audioSampleRate: 48000,
    maxResolution: '1080p',
  },
  interface: {
    theme: 'dark',
    language: 'zh-CN',
    fontSize: 'medium',
    showStatusBar: true,
    showToolbar: true,
    compactMode: false,
    panelLayout: 'default',
    autoHidePanels: false,
    timelineHeight: 260,
    defaultPanelWidth: 280,
  },
  aiModel: {
    defaultModel: 'gpt-4',
    apiEndpoint: '',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 4096,
    topP: 0.9,
    enableStreaming: true,
    timeout: 60000,
    retryCount: 3,
  },
  autoSaveInterval: 5,
  cacheDir: '',
  outputDir: '',
  exportPresets: [...DEFAULT_EXPORT_PRESETS],
};

const SETTINGS_KEY = 'ai-clip-app-settings';

export class SettingsService {
  private settings: AppSettings = { ...DEFAULT_SETTINGS };
  private loaded = false;

  load(): AppSettings {
    if (this.loaded) return this.settings;
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = this.mergeSettings(DEFAULT_SETTINGS, parsed);
      }
    } catch { /* ignored */ }
    this.loaded = true;
    return this.settings;
  }

  get(): AppSettings {
    if (!this.loaded) this.load();
    return { ...this.settings };
  }

  update<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settings[key] = value;
    this.save();
  }

  updatePartial(partial: Partial<AppSettings>): void {
    Object.assign(this.settings, partial);
    this.save();
  }

  updateShortcut(shortcutId: string, newKeys: string): { success: boolean; conflict?: KeyboardShortcut } {
    const conflict = this.settings.shortcuts.find(
      s => s.id !== shortcutId && s.keys === newKeys
    );
    if (conflict) {
      return { success: false, conflict };
    }
    const shortcut = this.settings.shortcuts.find(s => s.id === shortcutId);
    if (shortcut) {
      shortcut.keys = newKeys;
      this.save();
    }
    return { success: true };
  }

  resetShortcut(shortcutId: string): void {
    const shortcut = this.settings.shortcuts.find(s => s.id === shortcutId);
    if (shortcut) {
      shortcut.keys = shortcut.defaultKeys;
      this.save();
    }
  }

  resetAllShortcuts(): void {
    this.settings.shortcuts = DEFAULT_SHORTCUTS.map(s => ({ ...s }));
    this.save();
  }

  resetToDefaults(): void {
    this.settings = { ...DEFAULT_SETTINGS, shortcuts: DEFAULT_SHORTCUTS.map(s => ({ ...s })), exportPresets: DEFAULT_EXPORT_PRESETS.map(p => ({ ...p })) };
    this.save();
  }

  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  importSettings(json: string): { success: boolean; error?: string } {
    try {
      const parsed = JSON.parse(json);
      this.settings = this.mergeSettings(DEFAULT_SETTINGS, parsed);
      this.save();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '导入设置失败' };
    }
  }

  private save(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch { /* ignored */ }
  }

  private mergeSettings(defaults: AppSettings, overrides: Partial<AppSettings>): AppSettings {
    return {
      ...defaults,
      ...overrides,
      performance: { ...defaults.performance, ...overrides.performance },
      render: { ...defaults.render, ...overrides.render },
      interface: { ...defaults.interface, ...overrides.interface },
      aiModel: { ...defaults.aiModel, ...overrides.aiModel },
      shortcuts: overrides.shortcuts || defaults.shortcuts,
      exportPresets: overrides.exportPresets || defaults.exportPresets,
    };
  }
}

export const settingsService = new SettingsService();
