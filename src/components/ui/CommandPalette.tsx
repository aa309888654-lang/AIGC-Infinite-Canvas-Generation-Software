import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Image, Video, Music, FileText, Save, FolderOpen, Trash2, LayoutGrid, Settings, Bot, Sparkles, ArrowRight, Clock, Zap} from 'lucide-react';
import { navigateTo } from '@/services/navigation-service';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  category: 'node' | 'action' | 'navigation' | 'workflow' | 'settings';
  icon?: React.ReactNode;
  shortcut?: string;
  onClick: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

const CATEGORY_LABELS: Record<CommandItem['category'], string> = {
  node: '节点',
  action: '操作',
  navigation: '导航',
  workflow: '工作流',
  settings: '设置',
};

const CATEGORY_ICONS: Record<CommandItem['category'], React.ReactNode> = {
  node: <Image className="w-3.5 h-3.5" />,
  action: <Zap className="w-3.5 h-3.5" />,
  navigation: <ArrowRight className="w-3.5 h-3.5" />,
  workflow: <LayoutGrid className="w-3.5 h-3.5" />,
  settings: <Settings className="w-3.5 h-3.5" />,
};

const CATEGORY_COLORS: Record<CommandItem['category'], string> = {
  node: '#6610F2',
  action: '#10B981',
  navigation: '#007AFF',
  workflow: '#F97316',
  settings: '#6B7280',
};

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands.slice(0, 10);
    const q = query.toLowerCase();
    return commands.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [query, commands]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filteredCommands[selectedIndex];
      if (cmd) {
        cmd.onClick();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  const grouped = filteredCommands.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[100000] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="w-full max-w-xl bg-black rounded-2xl border border-white/10 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <Search className="w-5 h-5 text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入命令、节点或操作..."
            className="flex-1 bg-transparent text-white placeholder:text-gray-500 focus:outline-none text-sm"
          />
          <kbd className="px-1.5 py-0.5 bg-[#2A2A2A] text-[10px] text-gray-500 rounded border border-white/10">Esc</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {Object.entries(grouped).length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">没有找到匹配的命令</div>
          ) : (
            Object.entries(grouped).map(([category, cmds]) => {
              const catIndex = filteredCommands.findIndex(c => c.id === cmds[0].id);
              return (
                <div key={category}>
                  <div className="px-4 py-2 text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-2 bg-[#121214] sticky top-0">
                    <span style={{ color: CATEGORY_COLORS[category as CommandItem['category']] }}>
                      {CATEGORY_ICONS[category as CommandItem['category']]}
                    </span>
                    {CATEGORY_LABELS[category as CommandItem['category']]}
                  </div>
                  {cmds.map((cmd, i) => {
                    const globalIndex = catIndex + i;
                    const isSelected = globalIndex === selectedIndex;
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => { cmd.onClick(); onClose(); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isSelected ? 'bg-[#007AFF]/15' : 'hover:bg-white/5'}`}
                      >
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${CATEGORY_COLORS[cmd.category]}20`, color: CATEGORY_COLORS[cmd.category] }}>
                          {cmd.icon || CATEGORY_ICONS[cmd.category]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white truncate">{cmd.label}</div>
                          {cmd.description && (
                            <div className="text-[10px] text-gray-500 truncate">{cmd.description}</div>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <kbd className="px-1.5 py-0.5 bg-[#2A2A2A] text-[10px] text-gray-400 rounded border border-white/10 shrink-0">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-white/5 flex items-center gap-4 text-[10px] text-gray-500">
          <span>↑↓ 导航</span>
          <span>Enter 执行</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;

export function useCommandPaletteCommands(
  onAddNode: (nodeType: unknown) => void,
  onOpenSave: () => void,
  onOpenLoad: () => void,
  onClearCanvas: () => void,
  onAutoLayout: () => void,
  onSnapshot: () => void
): CommandItem[] {
  return useMemo(() => [
    { id: 'node-aiImage', label: 'AI图片节点', category: 'node', icon: <Image className="w-3.5 h-3.5" />, onClick: () => onAddNode({ id: 'aiImage', name: 'AI图片', category: 'image' }) },
    { id: 'node-videoGen', label: 'AI视频节点', category: 'node', icon: <Video className="w-3.5 h-3.5" />, onClick: () => onAddNode({ id: 'aiVideo', name: 'AI视频', category: 'video' }) },
    { id: 'node-prompt', label: '提示词节点', category: 'node', icon: <FileText className="w-3.5 h-3.5" />, onClick: () => onAddNode({ id: 'prompt', name: '提示词', category: 'input' }) },
    { id: 'action-save', label: '保存工作流', category: 'action', shortcut: 'Ctrl+S', icon: <Save className="w-3.5 h-3.5" />, onClick: onOpenSave },
    { id: 'action-load', label: '加载工作流', category: 'action', shortcut: 'Ctrl+O', icon: <FolderOpen className="w-3.5 h-3.5" />, onClick: onOpenLoad },
    { id: 'action-autolayout', label: '自动布局', category: 'action', shortcut: 'Ctrl+L', icon: <LayoutGrid className="w-3.5 h-3.5" />, onClick: onAutoLayout },
    { id: 'action-snapshot', label: '创建快照', category: 'action', shortcut: 'Ctrl+Shift+S', icon: <Clock className="w-3.5 h-3.5" />, onClick: onSnapshot },
    { id: 'action-clear', label: '清空画布', category: 'action', icon: <Trash2 className="w-3.5 h-3.5" />, onClick: onClearCanvas },
    { id: 'nav-aiview', label: 'AI创作工坊', category: 'navigation', icon: <Sparkles className="w-3.5 h-3.5" />, onClick: () => { window.location.href = '/ai-view'; } },
    { id: 'nav-music', label: 'AI音乐', category: 'navigation', icon: <Music className="w-3.5 h-3.5" />, onClick: () => navigateTo('/1?panel=music') },
    { id: 'settings-prefs', label: '打开设置', category: 'settings', icon: <Settings className="w-3.5 h-3.5" />, onClick: () => { /* Settings handled separately */ } },
  ], [onAddNode, onOpenSave, onOpenLoad, onClearCanvas, onAutoLayout, onSnapshot]);
}
