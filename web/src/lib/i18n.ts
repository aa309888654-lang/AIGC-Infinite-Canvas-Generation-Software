/**
 * 国际化支持
 * 支持多语言界面（中文与英文）
 */

export type Language = 'zh-CN' | 'en-US';

export interface Translation {
  [key: string]: string | Translation;
}

export interface I18nConfig {
  language: Language;
  fallbackLanguage: Language;
  translations: Record<Language, Translation>;
}

class I18nManager {
  private static instance: I18nManager;
  private currentLanguage: Language = 'zh-CN';
  private fallbackLanguage: Language = 'zh-CN';
  private translations: Record<Language, Translation> = {
    'zh-CN': {},
    'en-US': {},
  };
  private listeners: Set<(language: Language) => void> = new Set();

  static getInstance(): I18nManager {
    if (!I18nManager.instance) {
      I18nManager.instance = new I18nManager();
    }
    return I18nManager.instance;
  }

  // 设置语言
  setLanguage(language: Language): void {
    if (this.translations[language]) {
      this.currentLanguage = language;
      this.notifyListeners();
    }
  }

  // 获取当前语言
  getCurrentLanguage(): Language {
    return this.currentLanguage;
  }

  // 添加翻译
  addTranslations(language: Language, translations: Translation): void {
    this.translations[language] = {
      ...this.translations[language],
      ...translations,
    };
  }

  // 翻译函数
  t(key: string, params?: Record<string, string | number>): string {
    const translation = this.getTranslation(key);
    
    if (!translation) {
      return key;
    }
    
    // 参数替换
    if (params) {
      let result = translation;
      for (const [paramKey, paramValue] of Object.entries(params)) {
        result = result.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(paramValue));
      }
      return result;
    }
    
    return translation;
  }

  // 获取翻译
  private getTranslation(key: string): string | undefined {
    // 首先尝试当前语言
    const currentTranslation = this.getNestedTranslation(this.translations[this.currentLanguage], key);
    if (currentTranslation) {
      return currentTranslation;
    }
    
    // 然后尝试回退语言
    const fallbackTranslation = this.getNestedTranslation(this.translations[this.fallbackLanguage], key);
    if (fallbackTranslation) {
      return fallbackTranslation;
    }
    
    return undefined;
  }

  // 获取嵌套翻译
  private getNestedTranslation(translation: Translation, key: string): string | undefined {
    const keys = key.split('.');
    let current: Translation | string = translation;
    
    for (const k of keys) {
      if (typeof current === 'object' && current !== null && k in current) {
        current = current[k];
      } else {
        return undefined;
      }
    }
    
    return typeof current === 'string' ? current : undefined;
  }

  // 添加语言变更监听器
  onLanguageChange(callback: (language: Language) => void): () => void {
    this.listeners.add(callback);
    
    // 返回取消监听的函数
    return () => {
      this.listeners.delete(callback);
    };
  }

  // 通知监听器
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentLanguage));
  }

  // 获取支持的语言
  getSupportedLanguages(): Language[] {
    return Object.keys(this.translations) as Language[];
  }

  // 检测浏览器语言
  detectBrowserLanguage(): Language {
    const browserLang = navigator.language || navigator.languages[0];
    
    if (browserLang.startsWith('zh')) {
      return 'zh-CN';
    } else if (browserLang.startsWith('en')) {
      return 'en-US';
    }
    
    return this.fallbackLanguage;
  }
}

// 创建全局国际化管理器实例
export const i18n = I18nManager.getInstance();

// 预定义的翻译
export const DEFAULT_TRANSLATIONS: Record<Language, Translation> = {
  'zh-CN': {
    common: {
      confirm: '确认',
      cancel: '取消',
      save: '保存',
      delete: '删除',
      edit: '编辑',
      create: '创建',
      loading: '加载中...',
      error: '错误',
      success: '成功',
      warning: '警告',
      info: '信息',
    },
    nodes: {
      videoGen: '视频生成',
      imageGen: '图片生成',
      imageInput: '图片输入',
      videoInput: '视频输入',
      frameExtractor: '视频抽帧',
      doubaoVideoGen: '豆包视频',
      seedream: '即梦生图',
      textInput: '文本输入',
      videoEdit: '视频编辑',
      imageToVideo: '图片转视频',
    },
    workflow: {
      title: '工作流',
      save: '保存工作流',
      load: '加载工作流',
      export: '导出工作流',
      import: '导入工作流',
      clear: '清空画布',
      undo: '撤销',
      redo: '重做',
    },
    settings: {
      title: '设置',
      general: '通用设置',
      performance: '性能设置',
      security: '安全设置',
      language: '语言',
      theme: '主题',
      autoSave: '自动保存',
    },
    errors: {
      network: '网络连接失败',
      api: 'API调用失败',
      validation: '数据验证失败',
      timeout: '请求超时',
      unknown: '未知错误',
    },
  },
  'en-US': {
    common: {
      confirm: 'Confirm',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      create: 'Create',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      warning: 'Warning',
      info: 'Info',
    },
    nodes: {
      videoGen: 'Video Generation',
      imageGen: 'Image Generation',
      imageInput: 'Image Input',
      videoInput: 'Video Input',
      frameExtractor: 'Frame Extractor',
      doubaoVideoGen: 'Doubao Video',
      seedream: 'Seedream',
      textInput: 'Text Input',
      videoEdit: 'Video Edit',
      imageToVideo: 'Image to Video',
    },
    workflow: {
      title: 'Workflow',
      save: 'Save Workflow',
      load: 'Load Workflow',
      export: 'Export Workflow',
      import: 'Import Workflow',
      clear: 'Clear Canvas',
      undo: 'Undo',
      redo: 'Redo',
    },
    settings: {
      title: 'Settings',
      general: 'General Settings',
      performance: 'Performance Settings',
      security: 'Security Settings',
      language: 'Language',
      theme: 'Theme',
      autoSave: 'Auto Save',
    },
    errors: {
      network: 'Network connection failed',
      api: 'API call failed',
      validation: 'Data validation failed',
      timeout: 'Request timeout',
      unknown: 'Unknown error',
    },
  },
};

// 初始化默认翻译
i18n.addTranslations('zh-CN', DEFAULT_TRANSLATIONS['zh-CN']);
i18n.addTranslations('en-US', DEFAULT_TRANSLATIONS['en-US']);

// 翻译函数别名
export const t = (key: string, params?: Record<string, string | number>): string => {
  return i18n.t(key, params);
};

// 语言切换函数
export const setLanguage = (language: Language): void => {
  i18n.setLanguage(language);
  // 同时保存到本地存储
  localStorage.setItem('appLanguage', language);
  // 触发配置变更事件（如果配置系统已加载）
  import('../services/config-hot-reload').then(({ setConfig }) => {
    setConfig('system.language', language);
  }).catch(() => {
    // 配置系统可能未加载
  });
};

// 获取当前语言
export const getCurrentLanguage = (): Language => {
  return i18n.getCurrentLanguage();
};

// 初始化语言设置 — 默认中文，仅恢复用户明确保存的偏好
export const initLanguage = (): void => {
  const savedLanguage = localStorage.getItem('appLanguage');
  if (savedLanguage === 'zh-CN' || savedLanguage === 'en-US') {
    i18n.setLanguage(savedLanguage);
  } else {
    // 无明确偏好时默认中文
    i18n.setLanguage('zh-CN');
  }
};

// 扩展语言类型
export type ExtendedLanguage = Language | 'ja-JP' | 'ko-KR' | 'zh-TW';

// 获取语言显示名称
export const getLanguageDisplayName = (language: Language): string => {
  const names: Record<Language, string> = {
    'zh-CN': '简体中文',
    'en-US': 'English'
  };
  return names[language] || language;
};

// 格式化日期
export const formatDate = (date: Date | string | number, format?: string): string => {
  const d = new Date(date);
  const lang = i18n.getCurrentLanguage();
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  if (format === 'short') {
    options.month = 'short';
  }
  
  return d.toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', options);
};

// 格式化数字
export const formatNumber = (num: number, decimals?: number): string => {
  const lang = i18n.getCurrentLanguage();
  return lang === 'zh-CN' 
    ? num.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

// 格式化百分比
export const formatPercent = (num: number): string => {
  const lang = i18n.getCurrentLanguage();
  return lang === 'zh-CN'
    ? `${(num * 100).toFixed(1)}%`
    : `${(num * 100).toFixed(1)}%`;
};

// 获取复数形式
export const pluralize = (count: number, singular: string, plural?: string): string => {
  if (count === 1) return singular;
  return plural || `${singular}s`;
};
