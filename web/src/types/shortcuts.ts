export interface KeyboardShortcut {
  id: string;
  name: string;
  category: 'playback' | 'editing' | 'navigation' | 'tools' | 'selection' | 'view';
  defaultKeys: string[];
  currentKeys: string[];
  description: string;
  action: string;
}

export interface ShortcutCategory {
  id: string;
  name: string;
  icon: string;
  shortcuts: KeyboardShortcut[];
}

export const DEFAULT_SHORTCUTS: ShortcutCategory[] = [
  {
    id: 'playback',
    name: '播放控制',
    icon: '▶️',
    shortcuts: [
      {
        id: 'play-pause',
        name: '播放/暂停',
        category: 'playback',
        defaultKeys: ['Space'],
        currentKeys: ['Space'],
        description: '切换播放和暂停',
        action: 'toggle-playback',
      },
      {
        id: 'stop',
        name: '停止',
        category: 'playback',
        defaultKeys: ['K'],
        currentKeys: ['K'],
        description: '停止播放并回到开始',
        action: 'stop',
      },
      {
        id: 'go-to-start',
        name: '跳到开始',
        category: 'playback',
        defaultKeys: ['Home'],
        currentKeys: ['Home'],
        description: '跳到时间线开始',
        action: 'go-to-start',
      },
      {
        id: 'go-to-end',
        name: '跳到结束',
        category: 'playback',
        defaultKeys: ['End'],
        currentKeys: ['End'],
        description: '跳到时间线结束',
        action: 'go-to-end',
      },
      {
        id: 'frame-forward',
        name: '前进一帧',
        category: 'playback',
        defaultKeys: ['.'],
        currentKeys: ['.'],
        description: '播放头前进一帧',
        action: 'frame-forward',
      },
      {
        id: 'frame-backward',
        name: '后退一帧',
        category: 'playback',
        defaultKeys: [','],
        currentKeys: [','],
        description: '播放头后退一帧',
        action: 'frame-backward',
      },
    ],
  },
  {
    id: 'editing',
    name: '编辑操作',
    icon: '✂️',
    shortcuts: [
      {
        id: 'cut',
        name: '剪切',
        category: 'editing',
        defaultKeys: ['Ctrl+X'],
        currentKeys: ['Ctrl+X'],
        description: '剪切选中的剪辑',
        action: 'cut',
      },
      {
        id: 'copy',
        name: '复制',
        category: 'editing',
        defaultKeys: ['Ctrl+C'],
        currentKeys: ['Ctrl+C'],
        description: '复制选中的剪辑',
        action: 'copy',
      },
      {
        id: 'paste',
        name: '粘贴',
        category: 'editing',
        defaultKeys: ['Ctrl+V'],
        currentKeys: ['Ctrl+V'],
        description: '粘贴剪辑到当前位置',
        action: 'paste',
      },
      {
        id: 'delete',
        name: '删除',
        category: 'editing',
        defaultKeys: ['Delete'],
        currentKeys: ['Delete'],
        description: '删除选中的剪辑',
        action: 'delete',
      },
      {
        id: 'ripple-delete',
        name: '波纹删除',
        category: 'editing',
        defaultKeys: ['Shift+Delete'],
        currentKeys: ['Shift+Delete'],
        description: '删除剪辑并自动调整后续',
        action: 'ripple-delete',
      },
      {
        id: 'undo',
        name: '撤销',
        category: 'editing',
        defaultKeys: ['Ctrl+Z'],
        currentKeys: ['Ctrl+Z'],
        description: '撤销上一个操作',
        action: 'undo',
      },
      {
        id: 'redo',
        name: '重做',
        category: 'editing',
        defaultKeys: ['Ctrl+Shift+Z'],
        currentKeys: ['Ctrl+Shift+Z'],
        description: '重做上一个操作',
        action: 'redo',
      },
      {
        id: 'select-all',
        name: '全选',
        category: 'editing',
        defaultKeys: ['Ctrl+A'],
        currentKeys: ['Ctrl+A'],
        description: '选中所有剪辑',
        action: 'select-all',
      },
      {
        id: 'deselect-all',
        name: '取消选择',
        category: 'editing',
        defaultKeys: ['Escape'],
        currentKeys: ['Escape'],
        description: '取消所有选择',
        action: 'deselect-all',
      },
      {
        id: 'ai-undo',
        name: 'AI撤销',
        category: 'editing',
        defaultKeys: ['Ctrl+Alt+Z'],
        currentKeys: ['Ctrl+Alt+Z'],
        description: '撤销AI助手的操作',
        action: 'aiUndo',
      },
      {
        id: 'ai-redo',
        name: 'AI重做',
        category: 'editing',
        defaultKeys: ['Ctrl+Alt+Y'],
        currentKeys: ['Ctrl+Alt+Y'],
        description: '重做AI助手的操作',
        action: 'aiRedo',
      },
    ],
  },
  {
    id: 'navigation',
    name: '导航和时间',
    icon: '🧭',
    shortcuts: [
      {
        id: 'mark-in',
        name: '标记入点',
        category: 'navigation',
        defaultKeys: ['I'],
        currentKeys: ['I'],
        description: '设置入点',
        action: 'mark-in',
      },
      {
        id: 'mark-out',
        name: '标记出点',
        category: 'navigation',
        defaultKeys: ['O'],
        currentKeys: ['O'],
        description: '设置出点',
        action: 'mark-out',
      },
      {
        id: 'go-to-marker',
        name: '跳到标记',
        category: 'navigation',
        defaultKeys: ['M'],
        currentKeys: ['M'],
        description: '在当前位置添加标记',
        action: 'add-marker',
      },
      {
        id: 'next-marker',
        name: '下一个标记',
        category: 'navigation',
        defaultKeys: ['Shift+M'],
        currentKeys: ['Shift+M'],
        description: '跳到下一个标记',
        action: 'next-marker',
      },
      {
        id: 'prev-marker',
        name: '上一个标记',
        category: 'navigation',
        defaultKeys: ['Ctrl+Shift+M'],
        currentKeys: ['Ctrl+Shift+M'],
        description: '跳到上一个标记',
        action: 'prev-marker',
      },
    ],
  },
  {
    id: 'tools',
    name: '工具',
    icon: '🔧',
    shortcuts: [
      {
        id: 'razor-tool',
        name: '剃刀工具',
        category: 'tools',
        defaultKeys: ['C'],
        currentKeys: ['C'],
        description: '切割剪辑',
        action: 'razor-tool',
      },
      {
        id: 'selection-tool',
        name: '选择工具',
        category: 'tools',
        defaultKeys: ['V'],
        currentKeys: ['V'],
        description: '选择和移动剪辑',
        action: 'selection-tool',
      },
      {
        id: 'zoom-tool',
        name: '缩放工具',
        category: 'tools',
        defaultKeys: ['Z'],
        currentKeys: ['Z'],
        description: '缩放时间线',
        action: 'zoom-tool',
      },
      {
        id: 'hand-tool',
        name: '抓手工具',
        category: 'tools',
        defaultKeys: ['H'],
        currentKeys: ['H'],
        description: '平移时间线',
        action: 'hand-tool',
      },
    ],
  },
  {
    id: 'selection',
    name: '选择',
    icon: '🎯',
    shortcuts: [
      {
        id: 'select-next',
        name: '选择下一个',
        category: 'selection',
        defaultKeys: ['Tab'],
        currentKeys: ['Tab'],
        description: '选择下一个剪辑',
        action: 'select-next',
      },
      {
        id: 'select-prev',
        name: '选择上一个',
        category: 'selection',
        defaultKeys: ['Shift+Tab'],
        currentKeys: ['Shift+Tab'],
        description: '选择上一个剪辑',
        action: 'select-prev',
      },
      {
        id: 'group-select',
        name: '组选择',
        category: 'selection',
        defaultKeys: ['Ctrl+Click'],
        currentKeys: ['Ctrl+Click'],
        description: '多选剪辑',
        action: 'group-select',
      },
    ],
  },
  {
    id: 'view',
    name: '视图',
    icon: '👁️',
    shortcuts: [
      {
        id: 'zoom-in',
        name: '放大',
        category: 'view',
        defaultKeys: ['='],
        currentKeys: ['='],
        description: '放大时间线',
        action: 'zoom-in',
      },
      {
        id: 'zoom-out',
        name: '缩小',
        category: 'view',
        defaultKeys: ['-'],
        currentKeys: ['-'],
        description: '缩小时间线',
        action: 'zoom-out',
      },
      {
        id: 'fit-to-window',
        name: '适应窗口',
        category: 'view',
        defaultKeys: ['Shift+Z'],
        currentKeys: ['Shift+Z'],
        description: '适应整个项目到窗口',
        action: 'fit-to-window',
      },
      {
        id: 'show-history',
        name: '显示历史',
        category: 'view',
        defaultKeys: ['Ctrl+Shift+H'],
        currentKeys: ['Ctrl+Shift+H'],
        description: '显示撤销历史面板',
        action: 'show-history',
      },
      {
        id: 'show-shortcuts',
        name: '显示快捷键',
        category: 'view',
        defaultKeys: ['?'],
        currentKeys: ['?'],
        description: '显示快捷键帮助',
        action: 'show-shortcuts',
      },
    ],
  },
];

export function getShortcutDisplayName(keys: string[]): string {
  return keys.map(key => {
    const keyMap: Record<string, string> = {
      Ctrl: '⌘',
      Shift: '⇧',
      Alt: '⌥',
      Meta: '⌘',
      ArrowUp: '↑',
      ArrowDown: '↓',
      ArrowLeft: '←',
      ArrowRight: '→',
      ' ': 'Space'
    };
    return keyMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
  }).join(' + ');
}

export function parseKeyString(keyString: string): string[] {
  return keyString.split('+').map(k => k.trim());
}

export function isShortcutMatch(event: KeyboardEvent, keys: string[]): boolean {
  const pressedKeys: string[] = [];
  
  // 处理Ctrl和Meta键的兼容性
  const hasCtrlOrMeta = event.ctrlKey || event.metaKey;
  if (hasCtrlOrMeta) {
    // 对于Mac系统，使用Meta键代替Ctrl键
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    if (isMac) {
      pressedKeys.push('Meta');
    } else {
      pressedKeys.push('Ctrl');
    }
  }
  
  if (event.shiftKey) pressedKeys.push('Shift');
  if (event.altKey) pressedKeys.push('Alt');
  
  const key = event.key;
  if (key !== 'Control' && key !== 'Shift' && key !== 'Alt' && key !== 'Meta') {
    // 标准化键名，处理不同浏览器的差异
    const normalizedKey = normalizeKey(key);
    pressedKeys.push(normalizedKey);
  }
  
  // 检查按键数量是否匹配
  if (pressedKeys.length !== keys.length) return false;
  
  // 检查所有按键是否匹配
  return keys.every(k => {
    // 处理Ctrl和Meta键的等价性
    if (k === 'Ctrl' && pressedKeys.includes('Meta')) return true;
    if (k === 'Meta' && pressedKeys.includes('Ctrl')) return true;
    return pressedKeys.includes(k);
  });
}

function normalizeKey(key: string): string {
  // 标准化不同浏览器的键名差异
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft',
    ArrowRight: 'ArrowRight',
    Enter: 'Enter',
    Escape: 'Escape',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown'
  };
  
  if (keyMap[key]) {
    return keyMap[key];
  }
  
  // 对于单个字符，转换为大写
  if (key.length === 1) {
    return key.toUpperCase();
  }
  
  return key;
}
