import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PreviewItem {
  id: string;
  timestamp: number;
  prompt: string;
  negativePrompt?: string;
  model: string;
  params?: Record<string, unknown>;
  resultUrl?: string;
  resultUrls?: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface PreviewState {
  previewHistory: PreviewItem[];
  selectedForComparison: string[];
  maxHistoryItems: number;
  
  addPreviewItem: (item: Omit<PreviewItem, 'id' | 'timestamp'>) => PreviewItem;
  updatePreviewItem: (id: string, updates: Partial<PreviewItem>) => void;
  removePreviewItem: (id: string) => void;
  clearPreviewHistory: () => void;
  
  toggleComparisonSelection: (id: string) => void;
  clearComparisonSelection: () => void;
  setMaxHistoryItems: (max: number) => void;
}

export const usePreviewStore = create<PreviewState>()(
  persist(
    (set, _get) => ({
      previewHistory: [],
      selectedForComparison: [],
      maxHistoryItems: 20,

      addPreviewItem: (item) => {
        const newItem: PreviewItem = {
          ...item,
          id: `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
        };
        
        set((state) => {
          const newHistory = [newItem, ...state.previewHistory];
          const maxItems = state.maxHistoryItems;
          return {
            previewHistory: newHistory.slice(0, maxItems),
          };
        });
        
        return newItem;
      },

      updatePreviewItem: (id, updates) => {
        set((state) => ({
          previewHistory: state.previewHistory.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }));
      },

      removePreviewItem: (id) => {
        set((state) => ({
          previewHistory: state.previewHistory.filter((item) => item.id !== id),
          selectedForComparison: state.selectedForComparison.filter((itemId) => itemId !== id),
        }));
      },

      clearPreviewHistory: () => {
        set({ previewHistory: [], selectedForComparison: [] });
      },

      toggleComparisonSelection: (id) => {
        set((state) => {
          const isSelected = state.selectedForComparison.includes(id);
          return {
            selectedForComparison: isSelected
              ? state.selectedForComparison.filter((itemId) => itemId !== id)
              : [...state.selectedForComparison, id].slice(0, 4),
          };
        });
      },

      clearComparisonSelection: () => {
        set({ selectedForComparison: [] });
      },

      setMaxHistoryItems: (max) => {
        set((state) => ({
          maxHistoryItems: max,
          previewHistory: state.previewHistory.slice(0, max),
        }));
      },
    }),
    {
      name: 'infinite-flow-preview-store',
      version: 1,
      partialize: (state) => ({
        previewHistory: state.previewHistory,
        maxHistoryItems: state.maxHistoryItems,
      }),
    }
  )
);
