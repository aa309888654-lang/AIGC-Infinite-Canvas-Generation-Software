/**
 * 国际化支持
 * 支持多语言界面与集中式语言资源
 */

export type Language =
  | 'zh-CN' | 'en-US' | 'fr-FR' | 'it-IT' | 'de-DE' | 'es-ES' | 'ja-JP'
  | 'ko-KR' | 'pt-BR' | 'ru-RU' | 'id-ID' | 'th-TH' | 'vi-VN' | 'tr-TR' | 'ar-SA';

export const SUPPORTED_LANGUAGES: readonly Language[] = [
  'zh-CN', 'en-US', 'fr-FR', 'it-IT', 'de-DE', 'es-ES', 'ja-JP', 'ko-KR',
  'pt-BR', 'ru-RU', 'id-ID', 'th-TH', 'vi-VN', 'tr-TR', 'ar-SA',
];

export const LANGUAGE_DISPLAY_NAMES: Record<Language, string> = {
  'zh-CN': '简体中文', 'en-US': 'English', 'fr-FR': 'Français', 'it-IT': 'Italiano', 'de-DE': 'Deutsch', 'es-ES': 'Español', 'ja-JP': '日本語', 'ko-KR': '한국어', 'pt-BR': 'Português (Brasil)', 'ru-RU': 'Русский', 'id-ID': 'Bahasa Indonesia', 'th-TH': 'ไทย', 'vi-VN': 'Tiếng Việt', 'tr-TR': 'Türkçe', 'ar-SA': 'العربية',
};

export interface Translation {
  [key: string]: string | Translation;
}

export interface I18nConfig {
  language: Language;
  fallbackLanguage: Language;
  translations: Record<Language, Translation>;
}

function isTranslationObject(value: Translation[string] | undefined): value is Translation {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeTranslations(base: Translation, incoming: Translation): Translation {
  const merged: Translation = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    const existing = merged[key];
    merged[key] = isTranslationObject(existing) && isTranslationObject(value)
      ? mergeTranslations(existing, value)
      : value;
  }
  return merged;
}

class I18nManager {
  private static instance: I18nManager;
  private currentLanguage: Language = 'zh-CN';
  private fallbackLanguage: Language = 'en-US';
  private translations: Record<Language, Translation> = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((language) => [language, {}]),
  ) as Record<Language, Translation>;
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
    this.translations[language] = mergeTranslations(this.translations[language], translations);
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
    const browserLang = (navigator.language || navigator.languages[0] || '').toLowerCase();
    const languageByPrefix: Array<[string, Language]> = [
      ['zh', 'zh-CN'], ['en', 'en-US'], ['fr', 'fr-FR'], ['it', 'it-IT'], ['de', 'de-DE'],
      ['es', 'es-ES'], ['ja', 'ja-JP'], ['ko', 'ko-KR'], ['pt', 'pt-BR'], ['ru', 'ru-RU'],
      ['id', 'id-ID'], ['th', 'th-TH'], ['vi', 'vi-VN'], ['tr', 'tr-TR'], ['ar', 'ar-SA'],
    ];
    return languageByPrefix.find(([prefix]) => browserLang.startsWith(prefix))?.[1] || this.fallbackLanguage;
  }
}

// 创建全局国际化管理器实例
export const i18n = I18nManager.getInstance();

// 预定义的翻译
export const DEFAULT_TRANSLATIONS: Record<'zh-CN' | 'en-US', Translation> = {
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
    canvas: {
      left_toolbar: '画布左侧工具栏',
      add_node: '添加节点',
      upload_file: '上传文件',
      grid_layout: '网格布局',
      list_view: '列表视图',
      asset_library: '资源库',
    },
    toolbar: {
      ai_nodes: 'AI节点',
      ai_dubbing: 'AI配音',
      ai_music: 'AI音乐',
      sponsor: '赞助',
      file_manager: '文件管理',
      clear_cache: '清除缓存',
      settings: '设置',
      language: '语言',
      minimize_window: '最小化',
      maximize_window: '最大化',
      restore_window: '还原窗口',
      close_window: '关闭窗口',
      visit_website: '访问官网 aicgxt.com',
      creative_assistant: 'AI 创作助手',
      sponsor_thanks: '感谢支持小天画布 持续开发',
      sponsor_qrcode: '赞助二维码',
      sponsor_choose: '选择你要送出的甜',
      sponsor_amount_hint: '金额随心，任选一份甜',
      sponsor_preset_candy_memo: '薄礼相助',
      sponsor_preset_tea_memo: '请喝杯茶',
      sponsor_preset_coffee_memo: '续上灵感',
      sponsor_preset_reel_memo: '大力支持',
      sponsor_custom_label: '自定义金额（元）',
      sponsor_submit: '把它送给项目',
      sponsor_submit_loading: '正在酝酿二维码…',
      sponsor_pay_footnote: '微信「扫一扫」即可把甜送来',
      sponsor_scan_title: '扫一扫，把甜送来',
      sponsor_scan_placeholder_emoji: '先从左边挑一份甜 ♥',
      sponsor_scan_placeholder: '选好金额，这里会出现二维码',
      sponsor_scan_line: '请使用微信「扫一扫」支付',
      sponsor_scan_amount: '赞助金额',
      sponsor_order_no: '订单号',
      sponsor_success_title: '谢谢你的甜 ♥',
      sponsor_error_amount: '选一个喜欢的金额，或输入自定义数字哦～',
      sponsor_error_amount_range: '金额需在 1～500 元之间',
      sponsor_error_order: '下单失败，请稍后重试',
      sponsor_error_expired: '支付二维码已过期，如有需要请重新下单',
    },
    language: {
      simplified_chinese: '简体中文',
      english: 'English',
      preference_saved: '语言偏好会自动保存',
    },
    task_queue: {
      title: '生成队列',
      generating: '生成中',
      processing_count: '{{count}} 个任务生成中',
      task_count: '{{count}} 个任务',
      no_tasks: '暂无任务',
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
    canvas: {
      left_toolbar: 'Canvas toolbar',
      add_node: 'Add node',
      upload_file: 'Upload file',
      grid_layout: 'Grid layout',
      list_view: 'List view',
      asset_library: 'Asset library',
    },
    toolbar: {
      ai_nodes: 'AI Nodes',
      ai_dubbing: 'AI Dubbing',
      ai_music: 'AI Music',
      sponsor: 'Support',
      file_manager: 'File manager',
      clear_cache: 'Clear cache',
      settings: 'Settings',
      language: 'Language',
      minimize_window: 'Minimize window',
      maximize_window: 'Maximize window',
      restore_window: 'Restore window',
      close_window: 'Close window',
      visit_website: 'Visit aicgxt.com',
      creative_assistant: 'AI Creative Assistant',
      sponsor_thanks: 'Thank you for supporting XiaoTian AICG',
      sponsor_qrcode: 'Sponsor QR code',
      sponsor_choose: 'Choose your treat',
      sponsor_amount_hint: 'Pick any treat you like',
      sponsor_preset_candy_memo: 'A token of support',
      sponsor_preset_tea_memo: 'A cup of tea',
      sponsor_preset_coffee_memo: 'Refuel the muse',
      sponsor_preset_reel_memo: 'Big support',
      sponsor_custom_label: 'Custom amount (CNY)',
      sponsor_submit: 'Send it to the project',
      sponsor_submit_loading: 'Brewing the QR code…',
      sponsor_pay_footnote: 'Scan with WeChat to send the treat',
      sponsor_scan_title: 'Scan to send the treat',
      sponsor_scan_placeholder_emoji: 'Pick a treat on the left first ♥',
      sponsor_scan_placeholder: 'The QR code will appear here once you pick an amount',
      sponsor_scan_line: 'Please pay with WeChat Scan',
      sponsor_scan_amount: 'Amount',
      sponsor_order_no: 'Order No.',
      sponsor_success_title: 'Thank you for the treat ♥',
      sponsor_error_amount: 'Pick an amount or enter a custom one~',
      sponsor_error_amount_range: 'Amount must be between ¥1 and ¥500',
      sponsor_error_order: 'Order failed, please try again later',
      sponsor_error_expired: 'The QR code expired; please place a new order',
    },
    language: {
      simplified_chinese: 'Simplified Chinese',
      english: 'English',
      preference_saved: 'Your language preference is saved automatically',
    },
    task_queue: {
      title: 'Generation Queue',
      generating: 'Generating',
      processing_count: '{{count}} task(s) generating',
      task_count: '{{count}} task(s)',
      no_tasks: 'No tasks',
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

const LOCALE_CORE_TRANSLATIONS: Record<Exclude<Language, 'zh-CN' | 'en-US'>, Translation> = {
  'fr-FR': { app: { name: 'XiaoTian AICG', tagline: 'Plateforme de flux créatif IA' }, canvas: { left_toolbar: 'Barre d’outils du canevas', add_node: 'Ajouter un nœud', upload_file: 'Importer un fichier', grid_layout: 'Disposition en grille', list_view: 'Vue en liste', asset_library: 'Bibliothèque d’actifs' }, toolbar: { ai_nodes: 'Nœuds IA', ai_dubbing: 'Doublage IA', ai_music: 'Musique IA', sponsor: 'Soutenir', file_manager: 'Gestionnaire de fichiers', clear_cache: 'Vider le cache', settings: 'Paramètres', language: 'Langue', creative_assistant: 'Assistant créatif IA' }, language: { simplified_chinese: 'Chinois simplifié', english: 'Anglais', preference_saved: 'La préférence de langue est enregistrée automatiquement' }, task_queue: { title: 'File de génération', generating: 'Génération', processing_count: '{{count}} tâche(s) en génération', task_count: '{{count}} tâche(s)', no_tasks: 'Aucune tâche' } },
  'it-IT': { app: { name: 'XiaoTian AICG', tagline: 'Piattaforma di flussi creativi IA' }, canvas: { left_toolbar: 'Barra strumenti canvas', add_node: 'Aggiungi nodo', upload_file: 'Carica file', grid_layout: 'Layout a griglia', list_view: 'Vista elenco', asset_library: 'Libreria risorse' }, toolbar: { ai_nodes: 'Nodi IA', ai_dubbing: 'Doppiaggio IA', ai_music: 'Musica IA', sponsor: 'Supporta', file_manager: 'Gestione file', clear_cache: 'Svuota cache', settings: 'Impostazioni', language: 'Lingua', creative_assistant: 'Assistente creativo IA' }, language: { simplified_chinese: 'Cinese semplificato', english: 'Inglese', preference_saved: 'La preferenza della lingua viene salvata automaticamente' }, task_queue: { title: 'Coda generazione', generating: 'Generazione', processing_count: '{{count}} attività in generazione', task_count: '{{count}} attività', no_tasks: 'Nessuna attività' } },
  'de-DE': { app: { name: 'XiaoTian AICG', tagline: 'KI-Plattform für kreative Workflows' }, canvas: { left_toolbar: 'Canvas-Werkzeugleiste', add_node: 'Knoten hinzufügen', upload_file: 'Datei hochladen', grid_layout: 'Rasterlayout', list_view: 'Listenansicht', asset_library: 'Asset-Bibliothek' }, toolbar: { ai_nodes: 'KI-Knoten', ai_dubbing: 'KI-Synchronisation', ai_music: 'KI-Musik', sponsor: 'Unterstützen', file_manager: 'Dateimanager', clear_cache: 'Cache leeren', settings: 'Einstellungen', language: 'Sprache', creative_assistant: 'KI-Kreativassistent' }, language: { simplified_chinese: 'Vereinfachtes Chinesisch', english: 'Englisch', preference_saved: 'Ihre Spracheinstellung wird automatisch gespeichert' }, task_queue: { title: 'Generierungswarteschlange', generating: 'Wird generiert', processing_count: '{{count}} Aufgabe(n) werden generiert', task_count: '{{count}} Aufgabe(n)', no_tasks: 'Keine Aufgaben' } },
  'es-ES': { app: { name: 'XiaoTian AICG', tagline: 'Plataforma de flujos creativos con IA' }, canvas: { left_toolbar: 'Barra de herramientas del lienzo', add_node: 'Añadir nodo', upload_file: 'Subir archivo', grid_layout: 'Diseño en cuadrícula', list_view: 'Vista de lista', asset_library: 'Biblioteca de recursos' }, toolbar: { ai_nodes: 'Nodos IA', ai_dubbing: 'Doblaje IA', ai_music: 'Música IA', sponsor: 'Apoyar', file_manager: 'Gestor de archivos', clear_cache: 'Borrar caché', settings: 'Configuración', language: 'Idioma', creative_assistant: 'Asistente creativo IA' }, language: { simplified_chinese: 'Chino simplificado', english: 'Inglés', preference_saved: 'La preferencia de idioma se guarda automáticamente' }, task_queue: { title: 'Cola de generación', generating: 'Generando', processing_count: '{{count}} tarea(s) generando', task_count: '{{count}} tarea(s)', no_tasks: 'Sin tareas' } },
  'ja-JP': { app: { name: 'XiaoTian AICG', tagline: 'AIクリエイティブワークフロープラットフォーム' }, canvas: { left_toolbar: 'キャンバス左ツールバー', add_node: 'ノードを追加', upload_file: 'ファイルをアップロード', grid_layout: 'グリッドレイアウト', list_view: 'リスト表示', asset_library: 'アセットライブラリ' }, toolbar: { ai_nodes: 'AIノード', ai_dubbing: 'AI吹き替え', ai_music: 'AI音楽', sponsor: '支援', file_manager: 'ファイル管理', clear_cache: 'キャッシュを削除', settings: '設定', language: '言語', creative_assistant: 'AIクリエイティブアシスタント' }, language: { simplified_chinese: '簡体字中国語', english: '英語', preference_saved: '言語設定は自動的に保存されます' }, task_queue: { title: '生成キュー', generating: '生成中', processing_count: '{{count}}件を生成中', task_count: '{{count}}件', no_tasks: 'タスクはありません' } },
  'ko-KR': { app: { name: 'XiaoTian AICG', tagline: 'AI 크리에이티브 워크플로 플랫폼' }, canvas: { left_toolbar: '캔버스 왼쪽 도구 모음', add_node: '노드 추가', upload_file: '파일 업로드', grid_layout: '그리드 레이아웃', list_view: '목록 보기', asset_library: '에셋 라이브러리' }, toolbar: { ai_nodes: 'AI 노드', ai_dubbing: 'AI 더빙', ai_music: 'AI 음악', sponsor: '후원', file_manager: '파일 관리자', clear_cache: '캐시 지우기', settings: '설정', language: '언어', creative_assistant: 'AI 크리에이티브 어시스턴트' }, language: { simplified_chinese: '중국어 간체', english: '영어', preference_saved: '언어 설정이 자동으로 저장됩니다' }, task_queue: { title: '생성 대기열', generating: '생성 중', processing_count: '{{count}}개 생성 중', task_count: '{{count}}개 작업', no_tasks: '작업 없음' } },
  'pt-BR': { app: { name: 'XiaoTian AICG', tagline: 'Plataforma de fluxos criativos com IA' }, canvas: { left_toolbar: 'Barra de ferramentas do canvas', add_node: 'Adicionar nó', upload_file: 'Enviar arquivo', grid_layout: 'Layout em grade', list_view: 'Exibição em lista', asset_library: 'Biblioteca de ativos' }, toolbar: { ai_nodes: 'Nós de IA', ai_dubbing: 'Dublagem IA', ai_music: 'Música IA', sponsor: 'Apoiar', file_manager: 'Gerenciador de arquivos', clear_cache: 'Limpar cache', settings: 'Configurações', language: 'Idioma', creative_assistant: 'Assistente criativo IA' }, language: { simplified_chinese: 'Chinês simplificado', english: 'Inglês', preference_saved: 'A preferência de idioma é salva automaticamente' }, task_queue: { title: 'Fila de geração', generating: 'Gerando', processing_count: '{{count}} tarefa(s) em geração', task_count: '{{count}} tarefa(s)', no_tasks: 'Nenhuma tarefa' } },
  'ru-RU': { app: { name: 'XiaoTian AICG', tagline: 'Платформа творческих ИИ-процессов' }, canvas: { left_toolbar: 'Левая панель холста', add_node: 'Добавить узел', upload_file: 'Загрузить файл', grid_layout: 'Сетка', list_view: 'Список', asset_library: 'Библиотека ресурсов' }, toolbar: { ai_nodes: 'ИИ-узлы', ai_dubbing: 'ИИ-дубляж', ai_music: 'ИИ-музыка', sponsor: 'Поддержать', file_manager: 'Файловый менеджер', clear_cache: 'Очистить кэш', settings: 'Настройки', language: 'Язык', creative_assistant: 'Творческий ИИ-ассистент' }, language: { simplified_chinese: 'Упрощённый китайский', english: 'Английский', preference_saved: 'Языковые настройки сохраняются автоматически' }, task_queue: { title: 'Очередь генерации', generating: 'Генерация', processing_count: 'Генерируется задач: {{count}}', task_count: 'Задач: {{count}}', no_tasks: 'Нет задач' } },
  'id-ID': { app: { name: 'XiaoTian AICG', tagline: 'Platform alur kerja kreatif AI' }, canvas: { left_toolbar: 'Bilah alat kanvas', add_node: 'Tambah node', upload_file: 'Unggah file', grid_layout: 'Tata letak kisi', list_view: 'Tampilan daftar', asset_library: 'Pustaka aset' }, toolbar: { ai_nodes: 'Node AI', ai_dubbing: 'Sulih suara AI', ai_music: 'Musik AI', sponsor: 'Dukung', file_manager: 'Pengelola file', clear_cache: 'Hapus cache', settings: 'Pengaturan', language: 'Bahasa', creative_assistant: 'Asisten kreatif AI' }, language: { simplified_chinese: 'Tionghoa Sederhana', english: 'Inggris', preference_saved: 'Preferensi bahasa disimpan otomatis' }, task_queue: { title: 'Antrean generasi', generating: 'Menghasilkan', processing_count: '{{count}} tugas sedang dibuat', task_count: '{{count}} tugas', no_tasks: 'Tidak ada tugas' } },
  'th-TH': { app: { name: 'XiaoTian AICG', tagline: 'แพลตฟอร์มเวิร์กโฟลว์สร้างสรรค์ด้วย AI' }, canvas: { left_toolbar: 'แถบเครื่องมือแคนวาส', add_node: 'เพิ่มโหนด', upload_file: 'อัปโหลดไฟล์', grid_layout: 'เค้าโครงตาราง', list_view: 'มุมมองรายการ', asset_library: 'คลังแอสเซ็ต' }, toolbar: { ai_nodes: 'โหนด AI', ai_dubbing: 'พากย์เสียง AI', ai_music: 'เพลง AI', sponsor: 'สนับสนุน', file_manager: 'ตัวจัดการไฟล์', clear_cache: 'ล้างแคช', settings: 'การตั้งค่า', language: 'ภาษา', creative_assistant: 'ผู้ช่วยสร้างสรรค์ AI' }, language: { simplified_chinese: 'จีนตัวย่อ', english: 'อังกฤษ', preference_saved: 'ระบบบันทึกภาษาที่เลือกโดยอัตโนมัติ' }, task_queue: { title: 'คิวการสร้าง', generating: 'กำลังสร้าง', processing_count: 'กำลังสร้าง {{count}} งาน', task_count: '{{count}} งาน', no_tasks: 'ไม่มีงาน' } },
  'vi-VN': { app: { name: 'XiaoTian AICG', tagline: 'Nền tảng quy trình sáng tạo AI' }, canvas: { left_toolbar: 'Thanh công cụ canvas', add_node: 'Thêm nút', upload_file: 'Tải tệp lên', grid_layout: 'Bố cục lưới', list_view: 'Chế độ danh sách', asset_library: 'Thư viện tài sản' }, toolbar: { ai_nodes: 'Nút AI', ai_dubbing: 'Lồng tiếng AI', ai_music: 'Âm nhạc AI', sponsor: 'Ủng hộ', file_manager: 'Quản lý tệp', clear_cache: 'Xóa bộ nhớ đệm', settings: 'Cài đặt', language: 'Ngôn ngữ', creative_assistant: 'Trợ lý sáng tạo AI' }, language: { simplified_chinese: 'Tiếng Trung giản thể', english: 'Tiếng Anh', preference_saved: 'Tùy chọn ngôn ngữ được tự động lưu' }, task_queue: { title: 'Hàng đợi tạo', generating: 'Đang tạo', processing_count: 'Đang tạo {{count}} tác vụ', task_count: '{{count}} tác vụ', no_tasks: 'Chưa có tác vụ' } },
  'tr-TR': { app: { name: 'XiaoTian AICG', tagline: 'Yapay zekâ yaratıcı iş akışı platformu' }, canvas: { left_toolbar: 'Tuval sol araç çubuğu', add_node: 'Düğüm ekle', upload_file: 'Dosya yükle', grid_layout: 'Izgara düzeni', list_view: 'Liste görünümü', asset_library: 'Varlık kitaplığı' }, toolbar: { ai_nodes: 'YZ düğümleri', ai_dubbing: 'YZ dublaj', ai_music: 'YZ müzik', sponsor: 'Destekle', file_manager: 'Dosya yöneticisi', clear_cache: 'Önbelleği temizle', settings: 'Ayarlar', language: 'Dil', creative_assistant: 'YZ yaratıcı asistanı' }, language: { simplified_chinese: 'Basitleştirilmiş Çince', english: 'İngilizce', preference_saved: 'Dil tercihiniz otomatik olarak kaydedilir' }, task_queue: { title: 'Oluşturma kuyruğu', generating: 'Oluşturuluyor', processing_count: '{{count}} görev oluşturuluyor', task_count: '{{count}} görev', no_tasks: 'Görev yok' } },
  'ar-SA': { app: { name: 'XiaoTian AICG', tagline: 'منصة سير العمل الإبداعي بالذكاء الاصطناعي' }, canvas: { left_toolbar: 'شريط أدوات اللوحة الأيسر', add_node: 'إضافة عقدة', upload_file: 'رفع ملف', grid_layout: 'تخطيط شبكي', list_view: 'عرض القائمة', asset_library: 'مكتبة الأصول' }, toolbar: { ai_nodes: 'عقد الذكاء الاصطناعي', ai_dubbing: 'دبلجة بالذكاء الاصطناعي', ai_music: 'موسيقى بالذكاء الاصطناعي', sponsor: 'دعم', file_manager: 'مدير الملفات', clear_cache: 'مسح ذاكرة التخزين المؤقت', settings: 'الإعدادات', language: 'اللغة', creative_assistant: 'المساعد الإبداعي بالذكاء الاصطناعي' }, language: { simplified_chinese: 'الصينية المبسطة', english: 'الإنجليزية', preference_saved: 'يتم حفظ تفضيل اللغة تلقائياً' }, task_queue: { title: 'قائمة التوليد', generating: 'جارٍ التوليد', processing_count: 'جارٍ توليد {{count}} مهمة', task_count: '{{count}} مهمة', no_tasks: 'لا توجد مهام' } },
};

// 初始化默认翻译
i18n.addTranslations('zh-CN', DEFAULT_TRANSLATIONS['zh-CN']);
i18n.addTranslations('en-US', DEFAULT_TRANSLATIONS['en-US']);
for (const [language, translations] of Object.entries(LOCALE_CORE_TRANSLATIONS) as Array<[Language, Translation]>) {
  i18n.addTranslations(language, translations);
}

// 翻译函数别名
export const t = (key: string, params?: Record<string, string | number>): string => {
  return i18n.t(key, params);
};

// 语言切换函数
export const setLanguage = (language: Language): void => {
  i18n.setLanguage(language);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar-SA' ? 'rtl' : 'ltr';
  }
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
  if (SUPPORTED_LANGUAGES.includes(savedLanguage as Language)) {
    i18n.setLanguage(savedLanguage as Language);
  } else {
    // 无明确偏好时默认中文
    i18n.setLanguage('zh-CN');
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = i18n.getCurrentLanguage();
    document.documentElement.dir = i18n.getCurrentLanguage() === 'ar-SA' ? 'rtl' : 'ltr';
  }
};

// 扩展语言类型
export type ExtendedLanguage = Language | 'zh-TW';

// 获取语言显示名称
export const getLanguageDisplayName = (language: Language): string => {
  return LANGUAGE_DISPLAY_NAMES[language] || language;
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
  
  return d.toLocaleDateString(lang, options);
};

// 格式化数字
export const formatNumber = (num: number, decimals?: number): string => {
  const lang = i18n.getCurrentLanguage();
  return num.toLocaleString(lang, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
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
