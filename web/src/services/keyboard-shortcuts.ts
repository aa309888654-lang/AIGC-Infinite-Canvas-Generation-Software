/**
 * 键盘快捷键自定义系统
 */

// 快捷键类别
export type ShortcutCategory = 'general' | 'edit' | 'view' | 'node' | 'workflow';

// 快捷键定义
export interface KeyboardShortcut {
  id: string;
  name: string;
  description: string;
  category: ShortcutCategory;
  keys: string; // 格式化后的按键字符串
  keyCodes: string[]; // 原始按键码
  action: string; // 对应的动作
  enabled: boolean;
  isCustom: boolean; // 是否自定义
}

// 快捷键配置
export interface ShortcutConfig {
  shortcuts: KeyboardShortcut[];
  enableConflictCheck: boolean;
}

// 默认快捷键
export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  // 通用
  { id: 'save', name: '保存', description: '保存工作流', category: 'general', keys: 'Ctrl+S', keyCodes: ['ctrl', 's'], action: 'saveWorkflow', enabled: true, isCustom: false },
  { id: 'load', name: '加载', description: '加载工作流', category: 'general', keys: 'Ctrl+O', keyCodes: ['ctrl', 'o'], action: 'loadWorkflow', enabled: true, isCustom: false },
  { id: 'new', name: '新建', description: '新建工作流', category: 'general', keys: 'Ctrl+N', keyCodes: ['ctrl', 'n'], action: 'newWorkflow', enabled: true, isCustom: false },
  
  // 编辑
  { id: 'undo', name: '撤销', description: '撤销上一步操作', category: 'edit', keys: 'Ctrl+Z', keyCodes: ['ctrl', 'z'], action: 'undo', enabled: true, isCustom: false },
  { id: 'redo', name: '重做', description: '重做上一步操作', category: 'edit', keys: 'Ctrl+Y', keyCodes: ['ctrl', 'y'], action: 'redo', enabled: true, isCustom: false },
  { id: 'copy', name: '复制', description: '复制选中节点', category: 'edit', keys: 'Ctrl+C', keyCodes: ['ctrl', 'c'], action: 'copyNodes', enabled: true, isCustom: false },
  { id: 'paste', name: '粘贴', description: '粘贴节点', category: 'edit', keys: 'Ctrl+V', keyCodes: ['ctrl', 'v'], action: 'pasteNodes', enabled: true, isCustom: false },
  { id: 'delete', name: '删除', description: '删除选中节点', category: 'edit', keys: 'Delete', keyCodes: ['delete'], action: 'deleteNodes', enabled: true, isCustom: false },
  { id: 'selectAll', name: '全选', description: '选中所有节点', category: 'edit', keys: 'Ctrl+A', keyCodes: ['ctrl', 'a'], action: 'selectAll', enabled: true, isCustom: false },
  { id: 'cut', name: '剪切', description: '剪切选中节点', category: 'edit', keys: 'Ctrl+X', keyCodes: ['ctrl', 'x'], action: 'cutNodes', enabled: true, isCustom: false },
  
  // 视图
  { id: 'zoomIn', name: '放大', description: '放大画布', category: 'view', keys: 'Ctrl++', keyCodes: ['ctrl', '='], action: 'zoomIn', enabled: true, isCustom: false },
  { id: 'zoomOut', name: '缩小', description: '缩小画布', category: 'view', keys: 'Ctrl+-', keyCodes: ['ctrl', '-'], action: 'zoomOut', enabled: true, isCustom: false },
  { id: 'fitView', name: '适应视图', description: '适应画布到视图', category: 'view', keys: 'Ctrl+0', keyCodes: ['ctrl', '0'], action: 'fitView', enabled: true, isCustom: false },
  { id: 'toggleFullscreen', name: '全屏', description: '切换全屏模式', category: 'view', keys: 'F11', keyCodes: ['f11'], action: 'toggleFullscreen', enabled: true, isCustom: false },
  { id: 'toggleSidebar', name: '切换侧边栏', description: '显示/隐藏侧边栏', category: 'view', keys: 'Ctrl+B', keyCodes: ['ctrl', 'b'], action: 'toggleSidebar', enabled: true, isCustom: false },
  
  // 节点
  { id: 'stopNode', name: '停止节点', description: '停止运行节点', category: 'node', keys: 'Escape', keyCodes: ['escape'], action: 'stopNode', enabled: true, isCustom: false },
  
  // 工作流
  { id: 'runWorkflow', name: '运行工作流', description: '运行整个工作流', category: 'workflow', keys: 'Ctrl+Enter', keyCodes: ['ctrl', 'enter'], action: 'executeWorkflow', enabled: true, isCustom: false },
  { id: 'stopWorkflow', name: '停止工作流', description: '停止工作流执行', category: 'workflow', keys: 'Ctrl+Shift+S', keyCodes: ['ctrl', 'shift', 's'], action: 'stopWorkflow', enabled: true, isCustom: false },
  
  // AI剪辑工作室专用
  { id: 'playPause', name: '播放/暂停', description: '播放或暂停时间轴', category: 'edit', keys: 'Space', keyCodes: ['space'], action: 'playPause', enabled: true, isCustom: false },
  { id: 'goToStart', name: '跳到开始', description: '跳转到时间轴开始', category: 'edit', keys: 'Home', keyCodes: ['home'], action: 'goToStart', enabled: true, isCustom: false },
  { id: 'goToEnd', name: '跳到结尾', description: '跳转到时间轴结尾', category: 'edit', keys: 'End', keyCodes: ['end'], action: 'goToEnd', enabled: true, isCustom: false },
  { id: 'skipBackward', name: '后退5秒', description: '时间轴后退5秒', category: 'edit', keys: '←', keyCodes: ['arrowleft'], action: 'skipBackward', enabled: true, isCustom: false },
  { id: 'skipForward', name: '前进5秒', description: '时间轴前进5秒', category: 'edit', keys: '→', keyCodes: ['arrowright'], action: 'skipForward', enabled: true, isCustom: false },
  { id: 'splitClip', name: '分割片段', description: '在当前位置分割片段', category: 'edit', keys: 'Ctrl+K', keyCodes: ['ctrl', 'k'], action: 'splitClip', enabled: true, isCustom: false },
  { id: 'addTransition', name: '添加转场', description: '在选中位置添加转场', category: 'edit', keys: 'Ctrl+T', keyCodes: ['ctrl', 't'], action: 'addTransition', enabled: true, isCustom: false },
  { id: 'zoomTimelineIn', name: '时间轴放大', description: '放大时间轴视图', category: 'view', keys: '=', keyCodes: ['='], action: 'zoomTimelineIn', enabled: true, isCustom: false },
  { id: 'zoomTimelineOut', name: '时间轴缩小', description: '缩小时间轴视图', category: 'view', keys: '-', keyCodes: ['-'], action: 'zoomTimelineOut', enabled: true, isCustom: false },
  { id: 'markIn', name: '标记入点', description: '标记剪辑入点', category: 'edit', keys: 'I', keyCodes: ['i'], action: 'markIn', enabled: true, isCustom: false },
  { id: 'markOut', name: '标记出点', description: '标记剪辑出点', category: 'edit', keys: 'O', keyCodes: ['o'], action: 'markOut', enabled: true, isCustom: false },
  { id: 'goToIn', name: '跳转入点', description: '跳转到入点位置', category: 'edit', keys: 'Shift+I', keyCodes: ['shift', 'i'], action: 'goToIn', enabled: true, isCustom: false },
  { id: 'goToOut', name: '跳转出点', description: '跳转到出点位置', category: 'edit', keys: 'Shift+O', keyCodes: ['shift', 'o'], action: 'goToOut', enabled: true, isCustom: false },
  { id: 'addMarker', name: '添加标记', description: '在当前位置添加标记', category: 'edit', keys: 'M', keyCodes: ['m'], action: 'addMarker', enabled: true, isCustom: false },
  { id: 'nextMarker', name: '下一个标记', description: '跳转到下一个标记', category: 'edit', keys: 'Shift+M', keyCodes: ['shift', 'm'], action: 'nextMarker', enabled: true, isCustom: false },
  { id: 'prevMarker', name: '上一个标记', description: '跳转到上一个标记', category: 'edit', keys: 'Ctrl+Shift+M', keyCodes: ['ctrl', 'shift', 'm'], action: 'prevMarker', enabled: true, isCustom: false },
  { id: 'exportVideo', name: '导出视频', description: '导出当前项目为视频', category: 'general', keys: 'Ctrl+E', keyCodes: ['ctrl', 'e'], action: 'exportVideo', enabled: true, isCustom: false },
  { id: 'importMedia', name: '导入媒体', description: '导入媒体文件', category: 'general', keys: 'Ctrl+I', keyCodes: ['ctrl', 'i'], action: 'importMedia', enabled: true, isCustom: false },
  { id: 'toggleAIAssistant', name: 'AI助手', description: '显示/隐藏AI助手面板', category: 'view', keys: 'Ctrl+/', keyCodes: ['ctrl', '/'], action: 'toggleAIAssistant', enabled: true, isCustom: false },
  { id: 'autoEdit', name: '自动剪辑', description: '触发自动剪辑功能', category: 'edit', keys: 'Ctrl+Shift+A', keyCodes: ['ctrl', 'shift', 'a'], action: 'autoEdit', enabled: true, isCustom: false },
  { id: 'aiUndo', name: 'AI撤销', description: '撤销AI助手的操作', category: 'edit', keys: 'Ctrl+Alt+Z', keyCodes: ['ctrl', 'alt', 'z'], action: 'aiUndo', enabled: true, isCustom: false },
  { id: 'aiRedo', name: 'AI重做', description: '重做AI助手的操作', category: 'edit', keys: 'Ctrl+Alt+Y', keyCodes: ['ctrl', 'alt', 'y'], action: 'aiRedo', enabled: true, isCustom: false },
];

export class KeyboardShortcutManager {
  private static instance: KeyboardShortcutManager;
  private shortcuts: KeyboardShortcut[] = [...DEFAULT_SHORTCUTS];
  private listeners: Set<() => void> = new Set();
  private keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  
  private constructor() {
    this.loadFromStorage();
    this.setupGlobalHandler();
  }
  
  static getInstance(): KeyboardShortcutManager {
    if (!KeyboardShortcutManager.instance) {
      KeyboardShortcutManager.instance = new KeyboardShortcutManager();
    }
    return KeyboardShortcutManager.instance;
  }
  
  // 获取所有快捷键
  getShortcuts(): KeyboardShortcut[] {
    return [...this.shortcuts];
  }
  
  // 获取分类快捷键
  getShortcutsByCategory(category: ShortcutCategory): KeyboardShortcut[] {
    return this.shortcuts.filter(s => s.category === category);
  }
  
  // 更新快捷键
  updateShortcut(id: string, updates: Partial<KeyboardShortcut>): boolean {
    const index = this.shortcuts.findIndex(s => s.id === id);
    if (index === -1) return false;
    
    // 检查冲突
    if (updates.keyCodes) {
      const conflict = this.checkConflict(updates.keyCodes, id);
      if (conflict) {
        console.warn(`快捷键冲突: ${id} 与 ${conflict}`);
        return false;
      }
    }
    
    this.shortcuts[index] = {
      ...this.shortcuts[index],
      ...updates,
      isCustom: true
    };
    
    this.saveToStorage();
    this.notifyListeners();
    return true;
  }
  
  // 重置快捷键
  resetShortcut(id: string): boolean {
    const defaultShortcut = DEFAULT_SHORTCUTS.find(s => s.id === id);
    if (!defaultShortcut) return false;
    
    return this.updateShortcut(id, {
      keys: defaultShortcut.keys,
      keyCodes: defaultShortcut.keyCodes,
      isCustom: false
    });
  }
  
  // 重置所有快捷键
  resetAllShortcuts(): void {
    this.shortcuts = [...DEFAULT_SHORTCUTS];
    this.saveToStorage();
    this.notifyListeners();
  }
  
  // 检查快捷键冲突
  checkConflict(keyCodes: string[], excludeId?: string): string | null {
    const currentKeys = keyCodes.sort().join('+');
    
    for (const shortcut of this.shortcuts) {
      if (shortcut.id === excludeId) continue;
      if (!shortcut.enabled) continue;
      
      const shortcutKeys = shortcut.keyCodes.sort().join('+');
      if (currentKeys === shortcutKeys) {
        return shortcut.name;
      }
    }
    
    return null;
  }
  
  // 解析按键字符串
  parseKeyString(keyString: string): string[] {
    return keyString.split('+').map(k => k.trim().toLowerCase());
  }
  
  // 格式化按键为字符串
  formatKeys(keyCodes: string[]): string {
    return keyCodes.map(k => {
      const keyMap: Record<string, string> = {
        ctrl: 'Ctrl',
        shift: 'Shift',
        alt: 'Alt',
        meta: 'Cmd',
        enter: 'Enter',
        escape: 'Esc',
        delete: 'Delete',
        backspace: 'Backspace',
        arrowup: '↑',
        arrowdown: '↓',
        arrowleft: '←',
        arrowright: '→',
        space: 'Space',
        '=': '+',
        '-': '-',
      };
      return keyMap[k.toLowerCase()] || k.toUpperCase();
    }).join('+');
  }
  
  // 注册监听器
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
  
  // 保存到存储
  private saveToStorage(): void {
    try {
      localStorage.setItem('keyboard-shortcuts', JSON.stringify(this.shortcuts));
    } catch (e) {
      console.error('保存快捷键失败:', e);
    }
  }
  
  // 从存储加载
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('keyboard-shortcuts');
      if (stored) {
        const parsed = JSON.parse(stored);
        // 合并默认快捷键和新添加的
        const merged = DEFAULT_SHORTCUTS.map(defaultS => {
          const custom = parsed.find((s: KeyboardShortcut) => s.id === defaultS.id);
          return custom || defaultS;
        });
        this.shortcuts = merged;
      }
    } catch (e) {
      console.error('加载快捷键失败:', e);
    }
  }
  
  // 设置全局键盘事件处理
  private setupGlobalHandler(): void {
    this.keyDownHandler = (e: KeyboardEvent) => {
      // 忽略在输入框中的快捷键
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement) {
        return;
      }
      
      const keyCodes: string[] = [];
      if (e.ctrlKey) keyCodes.push('ctrl');
      if (e.shiftKey) keyCodes.push('shift');
      if (e.altKey) keyCodes.push('alt');
      if (e.metaKey) keyCodes.push('meta');
      
      const key = e.key.toLowerCase();
      if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
        keyCodes.push(key);
      }
      
      // 查找匹配的快捷键
      const matchedShortcut = this.shortcuts.find(s => {
        if (!s.enabled) return false;
        if (s.keyCodes.length !== keyCodes.length) return false;
        
        const sortedCodes = [...s.keyCodes].sort();
        const sortedInput = [...keyCodes].sort();
        return sortedCodes.join(',') === sortedInput.join(',');
      });
      
      if (matchedShortcut) {
        e.preventDefault();
        // 触发对应的动作
        this.triggerAction(matchedShortcut.action);
      }
    };
    
    document.addEventListener('keydown', this.keyDownHandler);
  }
  
  // 触发动作
  private triggerAction(action: string): void {
    // 通过事件触发
    window.dispatchEvent(new CustomEvent('shortcut-action', { detail: { action } }));
  }
  
  // 销毁
  destroy(): void {
    if (this.keyDownHandler) {
      document.removeEventListener('keydown', this.keyDownHandler);
    }
    this.listeners.clear();
  }
}

export const keyboardShortcutManager = KeyboardShortcutManager.getInstance();