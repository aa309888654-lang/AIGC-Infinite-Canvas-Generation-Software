/**
 * usePanelStore - 面板状态管理
 * 管理工作流面板、文件管理面板、API密钥管理面板等 UI 状态
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ========== 类型定义 ==========
export interface PanelState {
  // 工作流面板
  isWorkflowPanelOpen: boolean;
  setWorkflowPanelOpen: (open: boolean) => void;
  
  // 文件管理面板
  isFileManagerOpen: boolean;
  setFileManagerOpen: (open: boolean) => void;
  
  // API密钥管理面板
  isAPIKeyManagerOpen: boolean;
  setAPIKeyManagerOpen: (open: boolean) => void;
  
  // 快捷键配置
  keyboardShortcuts: Record<string, string>;
  setKeyboardShortcut: (action: string, keys: string) => void;
  resetKeyboardShortcuts: () => void;
}

// ========== 默认快捷键 ==========
const DEFAULT_SHORTCUTS: Record<string, string> = {
  undo: 'ctrl+z',
  redo: 'ctrl+y',
  saveWorkflow: 'ctrl+s',
  openFileManager: 'ctrl+f',
  executeWorkflow: 'space',
  delete: 'delete',
  copy: 'ctrl+c',
  paste: 'ctrl+v',
  selectAll: 'ctrl+a',
};

// ========== 创建 Store ==========
export const usePanelStore = create<PanelState>()(
  persist(
    (set) => ({
      isWorkflowPanelOpen: false,
      isFileManagerOpen: false,
      isAPIKeyManagerOpen: false,
      keyboardShortcuts: { ...DEFAULT_SHORTCUTS },
      
      setWorkflowPanelOpen: (open) => set({ isWorkflowPanelOpen: open }),
      setFileManagerOpen: (open) => set({ isFileManagerOpen: open }),
      setAPIKeyManagerOpen: (open) => set({ isAPIKeyManagerOpen: open }),
      
      setKeyboardShortcut: (action, keys) =>
        set((state) => ({
          keyboardShortcuts: { ...state.keyboardShortcuts, [action]: keys }
        })),
      
      resetKeyboardShortcuts: () =>
        set({ keyboardShortcuts: { ...DEFAULT_SHORTCUTS } }),
    }),
    {
      name: 'infinite-flow-panels',
      version: 1,
      partialize: (state) => ({
        keyboardShortcuts: state.keyboardShortcuts,
      }),
    }
  )
);
