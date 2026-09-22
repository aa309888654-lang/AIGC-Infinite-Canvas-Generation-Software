import type { Language } from '@/lib/i18n';

interface UserSettings {
  viewMode: 'grid' | 'list' | 'compact';
  sortBy: 'name' | 'size' | 'modified' | 'type';
  sortOrder: 'asc' | 'desc';
  filterType: 'all' | 'image' | 'video' | 'document' | 'folder';
  theme: 'dark' | 'light' | 'system';
  accentColor: string;
  language: Language;
  autoSave: boolean;
  autoSaveInterval: number;
  showNotifications: boolean;
  notificationSound: boolean;
}

interface ComfyUISettings {
  serverUrl: string;
  serverPort: number;
  autoConnect: boolean;
  autoRefreshModels: boolean;
  maxQueueSize: number;
  defaultSampler: string;
  defaultScheduler: string;
  defaultSteps: number;
  defaultCfg: number;
  defaultDenoiseStrength: number;
  defaultWidth: number;
  defaultHeight: number;
  defaultBatchSize: number;
  enablePreview: boolean;
  previewInterval: number;
  keepIntermediates: boolean;
  cacheModels: boolean;
  modelCacheSize: number;
}

interface AIGenerationSettings {
  defaultModel: string;
  defaultVae: string;
  defaultNegativePrompt: string;
  defaultSeed: number;
  randomizeSeed: boolean;
  defaultAspectRatio: string;
  defaultImageFormat: 'png' | 'jpg' | 'webp';
  outputFormat: 'png' | 'jpg' | 'webp';
  imageQuality: number;
  enableUpscale: boolean;
  defaultUpscaleModel: string;
  defaultUpscaleStrength: number;
  enableFaceRestore: boolean;
  defaultFaceRestoreModel: string;
  enableInpaint: boolean;
  inpaintMaskBlur: number;
  enableControlNet: boolean;
  controlNetDefaultWeight: number;
  maxConcurrentGenerations: number;
  generationTimeout: number;
  autoSaveGenerations: boolean;
  autoSave: boolean;
  autoSaveLocation: string;
  fileNameTemplate: string;
  includeMetadata: boolean;
  embedWorkflow: boolean;
  defaultWidth: number;
  defaultHeight: number;
  defaultSteps: number;
  defaultCfg: number;
  maxQueueSize: number;
}

interface InterfaceSettings {
  sidebarWidth: number;
  rightPanelWidth: number;
  bottomPanelHeight: number;
  showSidebar: boolean;
  showRightPanel: boolean;
  showBottomPanel: boolean;
  showToolbar: boolean;
  showStatusBar: boolean;
  compactMode: boolean;
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
  showNodeLabels: boolean;
  showPortLabels: boolean;
  nodeAnimation: boolean;
  zoomSpeed: number;
  panSpeed: number;
  minZoom: number;
  maxZoom: number;
  doubleClickToCreate: boolean;
  rightClickToDelete: boolean;
  enableDragSelect: boolean;
  enableMarqueeSelect: boolean;
  enableAutoLayout: boolean;
  autoLayoutDirection: 'TB' | 'LR';
  autoLayoutSpacing: number;
}

interface PerformanceSettings {
  enableHardwareAcceleration: boolean;
  enableWebGL: boolean;
  renderQuality: 'low' | 'medium' | 'high';
  maxUndoHistory: number;
  enableVirtualScrolling: boolean;
  virtualScrollThreshold: number;
  enableLazyLoading: boolean;
  lazyLoadThreshold: number;
  enableNodeCaching: boolean;
  nodeCacheSize: number;
  enableThrottling: boolean;
  throttleInterval: number;
  enableDebouncing: boolean;
  debounceInterval: number;
  memoryLimit: number;
  enableGC: boolean;
  gcInterval: number;
}

interface WorkflowSettings {
  autoSaveWorkflow: boolean;
  autoSaveWorkflowInterval: number;
  maxWorkflowVersions: number;
  enableVersionHistory: boolean;
  autoBackup: boolean;
  backupInterval: number;
  maxBackups: number;
  backupLocation: string;
  enableWorkflowValidation: boolean;
  autoValidate: boolean;
  enableWorkflowOptimization: boolean;
  autoOptimize: boolean;
  enableWorkflowTemplates: boolean;
  templateLocation: string;
}

interface AdvancedSettings {
  enableDebugMode: boolean;
  enableLogging: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  logLocation: string;
  enableTelemetry: boolean;
  enableCrashReporting: boolean;
  enableExperimentalFeatures: boolean;
  enableBetaFeatures: boolean;
  customCSS: string;
  customUserAgent: string;
  proxyEnabled: boolean;
  proxyUrl: string;
  proxyPort: number;
  proxyUsername: string;
  proxyPassword: string;
  enableSSLVerification: boolean;
  customCACert: string;
  enableAPICache: boolean;
  apiCacheTTL: number;
  enableRequestRetry: boolean;
  maxRetries: number;
  retryDelay: number;
}

interface ShortcutsSettings {
  [key: string]: string;
}

/** Emitted in the current window whenever a setting changes. */
export const USER_SETTINGS_UPDATED_EVENT = 'aicgxt:user-settings-updated';

interface PathsSettings {
  modelsPath: string;
  outputPath: string;
  cachePath: string;
  workflowsPath: string;
}

interface NotificationsSettings {
  enabled: boolean;
  onGenerationComplete: boolean;
  onError: boolean;
  onProgress: boolean;
  playSound: boolean;
}

interface AccountSettings {
  [key: string]: unknown;
}

interface AllSettings {
  user: UserSettings;
  comfyUI: ComfyUISettings;
  comfyui: ComfyUISettings;
  aiGeneration: AIGenerationSettings;
  interface: InterfaceSettings & {
    theme?: 'dark' | 'light' | 'auto';
    uiScale?: number;
    canvasBackground?: string;
  };
  performance: PerformanceSettings & {
    nodePreviewQuality?: 'low' | 'medium' | 'high';
    maxCacheSize?: number;
    autoCleanCache?: boolean;
  };
  workflow: WorkflowSettings;
  advanced: AdvancedSettings;
  shortcuts: ShortcutsSettings;
  paths: PathsSettings;
  notifications: NotificationsSettings;
  account: AccountSettings;
}

interface FileTagsStore {
  [filePath: string]: string[];
}

const SETTINGS_KEY = 'user_settings';
const FILE_TAGS_KEY = 'file_tags';
const SAVE_DEBOUNCE_MS = 500;

const DEFAULT_USER_SETTINGS: UserSettings = {
  viewMode: 'grid',
  sortBy: 'name',
  sortOrder: 'asc',
  filterType: 'all',
  theme: 'dark',
  accentColor: '#4B21FF',
  language: 'zh-CN',
  autoSave: true,
  autoSaveInterval: 60,
  showNotifications: true,
  notificationSound: false,
};

const DEFAULT_COMFYUI_SETTINGS: ComfyUISettings = {
  serverUrl: '127.0.0.1',
  serverPort: 8188,
  autoConnect: true,
  autoRefreshModels: true,
  maxQueueSize: 10,
  defaultSampler: 'euler',
  defaultScheduler: 'normal',
  defaultSteps: 30,
  defaultCfg: 7.0,
  defaultDenoiseStrength: 1.0,
  defaultWidth: 1024,
  defaultHeight: 1024,
  defaultBatchSize: 1,
  enablePreview: true,
  previewInterval: 500,
  keepIntermediates: false,
  cacheModels: true,
  modelCacheSize: 4,
};

const DEFAULT_AI_GENERATION_SETTINGS: AIGenerationSettings = {
  defaultModel: '',
  defaultVae: '',
  defaultNegativePrompt: 'low quality, blurry, distorted, bad anatomy',
  defaultSeed: -1,
  randomizeSeed: true,
  defaultAspectRatio: '1:1',
  defaultImageFormat: 'png',
  outputFormat: 'png',
  imageQuality: 95,
  enableUpscale: false,
  defaultUpscaleModel: '',
  defaultUpscaleStrength: 0.5,
  enableFaceRestore: false,
  defaultFaceRestoreModel: '',
  enableInpaint: true,
  inpaintMaskBlur: 4,
  enableControlNet: true,
  controlNetDefaultWeight: 0.7,
  maxConcurrentGenerations: 2,
  generationTimeout: 600,
  autoSaveGenerations: true,
  autoSave: true,
  autoSaveLocation: '',
  fileNameTemplate: 'AI_Generation_{timestamp}',
  includeMetadata: true,
  embedWorkflow: true,
  defaultWidth: 1024,
  defaultHeight: 1024,
  defaultSteps: 30,
  defaultCfg: 7.0,
  maxQueueSize: 10,
};

const DEFAULT_INTERFACE_SETTINGS: InterfaceSettings = {
  sidebarWidth: 280,
  rightPanelWidth: 320,
  bottomPanelHeight: 200,
  showSidebar: true,
  showRightPanel: true,
  showBottomPanel: true,
  showToolbar: true,
  showStatusBar: true,
  compactMode: false,
  showGrid: true,
  gridSize: 20,
  snapToGrid: true,
  showNodeLabels: true,
  showPortLabels: true,
  nodeAnimation: true,
  zoomSpeed: 0.1,
  panSpeed: 1,
  minZoom: 0.1,
  maxZoom: 2,
  doubleClickToCreate: false,
  rightClickToDelete: false,
  enableDragSelect: true,
  enableMarqueeSelect: true,
  enableAutoLayout: false,
  autoLayoutDirection: 'TB',
  autoLayoutSpacing: 80,
};

const DEFAULT_PERFORMANCE_SETTINGS: PerformanceSettings = {
  enableHardwareAcceleration: true,
  enableWebGL: true,
  renderQuality: 'medium',
  maxUndoHistory: 100,
  enableVirtualScrolling: true,
  virtualScrollThreshold: 100,
  enableLazyLoading: true,
  lazyLoadThreshold: 200,
  enableNodeCaching: true,
  nodeCacheSize: 500,
  enableThrottling: true,
  throttleInterval: 16,
  enableDebouncing: true,
  debounceInterval: 300,
  memoryLimit: 2048,
  enableGC: true,
  gcInterval: 60000,
};

const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettings = {
  autoSaveWorkflow: true,
  autoSaveWorkflowInterval: 30,
  maxWorkflowVersions: 50,
  enableVersionHistory: true,
  autoBackup: true,
  backupInterval: 3600,
  maxBackups: 10,
  backupLocation: '',
  enableWorkflowValidation: true,
  autoValidate: true,
  enableWorkflowOptimization: true,
  autoOptimize: false,
  enableWorkflowTemplates: true,
  templateLocation: '',
};

const DEFAULT_ADVANCED_SETTINGS: AdvancedSettings = {
  enableDebugMode: false,
  enableLogging: true,
  logLevel: 'info',
  logLocation: '',
  enableTelemetry: false,
  enableCrashReporting: true,
  enableExperimentalFeatures: false,
  enableBetaFeatures: false,
  customCSS: '',
  customUserAgent: '',
  proxyEnabled: false,
  proxyUrl: '',
  proxyPort: 8080,
  proxyUsername: '',
  proxyPassword: '',
  enableSSLVerification: true,
  customCACert: '',
  enableAPICache: true,
  apiCacheTTL: 300,
  enableRequestRetry: true,
  maxRetries: 3,
  retryDelay: 1000,
};

const DEFAULT_SHORTCUTS_SETTINGS: ShortcutsSettings = {
  // 工作流
  saveWorkflow: 'Ctrl+S', openWorkflow: 'Ctrl+O', newWorkflow: 'Ctrl+N', exportWorkflow: 'Ctrl+E', runWorkflow: 'Ctrl+Enter',
  // 编辑
  undo: 'Ctrl+Z', redo: 'Ctrl+Y', delete: 'Delete', copy: 'Ctrl+C', paste: 'Ctrl+V', duplicate: 'Ctrl+D', selectAll: 'Ctrl+A', cancel: 'Escape',
  // 节点与面板
  nodeSearch: 'Ctrl+Space', commandPalette: 'Ctrl+K', groupNodes: 'Ctrl+G', ungroupNodes: 'Ctrl+Shift+G', autoLayout: 'Ctrl+L',
  // 视图
  zoomIn: '+', zoomOut: '-', fitView: 'Shift+F', resetZoom: '0', moveNodeUp: 'ArrowUp', moveNodeDown: 'ArrowDown', moveNodeLeft: 'ArrowLeft', moveNodeRight: 'ArrowRight',
  // 鼠标与画布控制
  panCanvas: 'Space + Left Mouse', panWithMiddleMouse: 'Middle Mouse', boxSelect: 'Ctrl + Left Mouse', multiSelect: 'Shift + Left Mouse', zoomWithWheel: 'Mouse Wheel', zoomWithPinch: 'Pinch',
};

const WINDOWS_USER_HOME = 'C:\\Users\\jickchen';

const DEFAULT_PATHS_SETTINGS: PathsSettings = {
  modelsPath: `${WINDOWS_USER_HOME}\\Documents`,
  outputPath: `${WINDOWS_USER_HOME}\\Pictures`,
  cachePath: `${WINDOWS_USER_HOME}\\Music`,
  workflowsPath: `${WINDOWS_USER_HOME}\\Videos`,
};

const DEFAULT_NOTIFICATIONS_SETTINGS: NotificationsSettings = {
  enabled: true,
  onGenerationComplete: true,
  onError: true,
  onProgress: false,
  playSound: false,
};

const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = {};

const DEFAULT_SETTINGS: AllSettings = {
  user: DEFAULT_USER_SETTINGS,
  comfyUI: DEFAULT_COMFYUI_SETTINGS,
  comfyui: DEFAULT_COMFYUI_SETTINGS,
  aiGeneration: DEFAULT_AI_GENERATION_SETTINGS,
  interface: {
    ...DEFAULT_INTERFACE_SETTINGS,
    theme: 'dark',
    uiScale: 100,
    canvasBackground: 'dark',
  },
  performance: {
    ...DEFAULT_PERFORMANCE_SETTINGS,
    nodePreviewQuality: 'medium',
    maxCacheSize: 1024,
    autoCleanCache: true,
  },
  workflow: DEFAULT_WORKFLOW_SETTINGS,
  advanced: DEFAULT_ADVANCED_SETTINGS,
  shortcuts: DEFAULT_SHORTCUTS_SETTINGS,
  paths: DEFAULT_PATHS_SETTINGS,
  notifications: DEFAULT_NOTIFICATIONS_SETTINGS,
  account: DEFAULT_ACCOUNT_SETTINGS,
};

export class UserSettingsManager {
  private settings: AllSettings;
  private fileTags: FileTagsStore;
  private settingsSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private tagsSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private settingsDirty = false;
  private tagsDirty = false;

  constructor() {
    this.settings = this.loadSettings();
    this.fileTags = this.loadFileTags();
  }

  private loadSettings(): AllSettings {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        return this.normalizeDefaultPaths(this.deepMerge(DEFAULT_SETTINGS, JSON.parse(stored)));
      }
    } catch (error) {
      console.error('加载用户设置失败:', error);
    }
    return this.normalizeDefaultPaths(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
  }

  private isWindowsAbsolutePath(value: string): boolean {
    return /^[a-zA-Z]:[\\/]/.test(value.trim());
  }

  private normalizeDefaultPaths(settings: AllSettings): AllSettings {
    const paths = { ...settings.paths };
    (Object.keys(DEFAULT_PATHS_SETTINGS) as Array<keyof PathsSettings>).forEach((key) => {
      const currentValue = String(paths[key] || '').trim();
      if (!currentValue || !this.isWindowsAbsolutePath(currentValue)) {
        paths[key] = DEFAULT_PATHS_SETTINGS[key];
      }
    });
    return { ...settings, paths };
  }

  private isPlainRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private deepMerge<T extends object>(target: T, source: unknown): T {
    if (!this.isPlainRecord(source)) {
      return { ...target };
    }

    const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };
    for (const key of Object.keys(source)) {
      const targetValue = result[key];
      const sourceValue = source[key];
      if (this.isPlainRecord(targetValue) && this.isPlainRecord(sourceValue)) {
        result[key] = this.deepMerge(targetValue, sourceValue);
      } else {
        result[key] = sourceValue;
      }
    }
    return result as T;
  }

  private scheduleSettingsSave() {
    this.settingsDirty = true;
    
    if (this.settingsSaveTimer) {
      clearTimeout(this.settingsSaveTimer);
    }
    
    this.settingsSaveTimer = setTimeout(() => {
      this.saveSettings();
    }, SAVE_DEBOUNCE_MS);
  }

  private saveSettings() {
    if (!this.settingsDirty) return;
    
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
      this.settingsDirty = false;
    } catch (error) {
      console.error('保存用户设置失败:', error);
    }
  }

  private loadFileTags(): FileTagsStore {
    try {
      const stored = localStorage.getItem(FILE_TAGS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('加载文件标签失败:', error);
    }
    return {};
  }

  private scheduleTagsSave() {
    this.tagsDirty = true;
    
    if (this.tagsSaveTimer) {
      clearTimeout(this.tagsSaveTimer);
    }
    
    this.tagsSaveTimer = setTimeout(() => {
      this.saveFileTags();
    }, SAVE_DEBOUNCE_MS);
  }

  private saveFileTags() {
    if (!this.tagsDirty) return;
    
    try {
      localStorage.setItem(FILE_TAGS_KEY, JSON.stringify(this.fileTags));
      this.tagsDirty = false;
    } catch (error) {
      console.error('保存文件标签失败:', error);
    }
  }

  getAllSettings(): AllSettings {
    return JSON.parse(JSON.stringify(this.settings));
  }

  updateAllSettings(partialSettings: Partial<AllSettings>) {
    this.settings = this.deepMerge(this.settings, partialSettings);
    this.scheduleSettingsSave();
    window.dispatchEvent(new CustomEvent(USER_SETTINGS_UPDATED_EVENT));
  }

  getUserSettings(): UserSettings {
    return { ...this.settings.user };
  }

  updateUserSettings(partialSettings: Partial<UserSettings>) {
    this.settings.user = { ...this.settings.user, ...partialSettings };
    this.scheduleSettingsSave();
  }

  getComfyUISettings(): ComfyUISettings {
    return { ...this.settings.comfyUI };
  }

  updateComfyUISettings(partialSettings: Partial<ComfyUISettings>) {
    this.settings.comfyUI = { ...this.settings.comfyUI, ...partialSettings };
    this.scheduleSettingsSave();
  }

  getAIGenerationSettings(): AIGenerationSettings {
    return { ...this.settings.aiGeneration };
  }

  updateAIGenerationSettings(partialSettings: Partial<AIGenerationSettings>) {
    this.settings.aiGeneration = { ...this.settings.aiGeneration, ...partialSettings };
    this.scheduleSettingsSave();
  }

  getInterfaceSettings(): InterfaceSettings {
    return { ...this.settings.interface };
  }

  updateInterfaceSettings(partialSettings: Partial<InterfaceSettings>) {
    this.settings.interface = { ...this.settings.interface, ...partialSettings };
    this.scheduleSettingsSave();
  }

  getPerformanceSettings(): PerformanceSettings {
    return { ...this.settings.performance };
  }

  updatePerformanceSettings(partialSettings: Partial<PerformanceSettings>) {
    this.settings.performance = { ...this.settings.performance, ...partialSettings };
    this.scheduleSettingsSave();
  }

  getWorkflowSettings(): WorkflowSettings {
    return { ...this.settings.workflow };
  }

  updateWorkflowSettings(partialSettings: Partial<WorkflowSettings>) {
    this.settings.workflow = { ...this.settings.workflow, ...partialSettings };
    this.scheduleSettingsSave();
  }

  getAdvancedSettings(): AdvancedSettings {
    return { ...this.settings.advanced };
  }

  updateAdvancedSettings(partialSettings: Partial<AdvancedSettings>) {
    this.settings.advanced = { ...this.settings.advanced, ...partialSettings };
    this.scheduleSettingsSave();
  }

  resetToDefaults() {
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.scheduleSettingsSave();
    window.dispatchEvent(new CustomEvent(USER_SETTINGS_UPDATED_EVENT));
  }

  resetCategoryToDefaults(category: keyof AllSettings) {
    this.settings[category] = JSON.parse(JSON.stringify(DEFAULT_SETTINGS[category]));
    this.scheduleSettingsSave();
    window.dispatchEvent(new CustomEvent(USER_SETTINGS_UPDATED_EVENT));
  }

  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  importSettings(jsonString: string): boolean {
    try {
      const imported = JSON.parse(jsonString);
      this.settings = this.deepMerge(DEFAULT_SETTINGS, imported);
      this.scheduleSettingsSave();
      window.dispatchEvent(new CustomEvent(USER_SETTINGS_UPDATED_EVENT));
      return true;
    } catch (error) {
      console.error('导入设置失败:', error);
      return false;
    }
  }

  getFileTags(filePath: string): string[] {
    return this.fileTags[filePath] || [];
  }

  setFileTags(filePath: string, tags: string[]) {
    if (tags.length === 0) {
      delete this.fileTags[filePath];
    } else {
      this.fileTags[filePath] = tags;
    }
    this.scheduleTagsSave();
  }

  toggleFileTag(filePath: string, tagId: string) {
    const currentTags = this.getFileTags(filePath);
    let newTags: string[];
    if (currentTags.includes(tagId)) {
      newTags = currentTags.filter(t => t !== tagId);
    } else {
      newTags = [...currentTags, tagId];
    }
    this.setFileTags(filePath, newTags);
    return newTags;
  }

  clearAllTags() {
    this.fileTags = {};
    this.tagsDirty = true;
    
    if (this.tagsSaveTimer) {
      clearTimeout(this.tagsSaveTimer);
      this.tagsSaveTimer = null;
    }
    
    try {
      localStorage.removeItem(FILE_TAGS_KEY);
    } catch (error) {
      console.error('清除文件标签失败:', error);
    }
  }

  flush() {
    if (this.settingsSaveTimer) {
      clearTimeout(this.settingsSaveTimer);
      this.settingsSaveTimer = null;
    }
    this.saveSettings();
    
    if (this.tagsSaveTimer) {
      clearTimeout(this.tagsSaveTimer);
      this.tagsSaveTimer = null;
    }
    this.saveFileTags();
  }
}

export const userSettingsManager = new UserSettingsManager();
export { DEFAULT_SETTINGS };

export type {
  AllSettings,
  UserSettings,
  ComfyUISettings,
  AIGenerationSettings,
  InterfaceSettings,
  PerformanceSettings,
  WorkflowSettings,
  AdvancedSettings,
  ShortcutsSettings,
  PathsSettings,
  NotificationsSettings,
  AccountSettings,
};
