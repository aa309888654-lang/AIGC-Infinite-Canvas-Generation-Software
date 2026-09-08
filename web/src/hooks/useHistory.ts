/**
 * 历史记录Hook
 * 支持操作历史的记录、撤销和重做
 */

import { useState, useCallback } from 'react';

export type HistoryActionType =
  | 'analyze'
  | 'edit'
  | 'batch_edit'
  | 'clip_select'
  | 'clip_deselect'
  | 'select_all'
  | 'deselect_all'
  | 'remove_clips'
  | 'add_to_timeline';

export interface HistoryEntry {
  id: string;
  type: HistoryActionType;
  timestamp: number;
  description: string;
  data: Record<string, unknown>;
  undoable: boolean;
}

export interface HistoryState {
  entries: HistoryEntry[];
  currentIndex: number;
  maxEntries: number;
}

export function useHistory(maxEntries: number = 50) {
  const [state, setState] = useState<HistoryState>({
    entries: [],
    currentIndex: -1,
    maxEntries,
  });

  const push = useCallback((entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => {
    const newEntry: HistoryEntry = {
      ...entry,
      id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    setState(prev => {
      const newEntries = prev.entries.slice(0, prev.currentIndex + 1);
      newEntries.push(newEntry);

      if (newEntries.length > prev.maxEntries) {
        newEntries.shift();
      }

      return {
        ...prev,
        entries: newEntries,
        currentIndex: newEntries.length - 1,
      };
    });

    return newEntry.id;
  }, []);

  const undo = useCallback(() => {
    if (state.currentIndex < 0) return null;

    const entry = state.entries[state.currentIndex];
    if (!entry.undoable) return null;

    setState(prev => ({
      ...prev,
      currentIndex: prev.currentIndex - 1,
    }));

    return entry;
  }, [state.currentIndex, state.entries]);

  const redo = useCallback(() => {
    if (state.currentIndex >= state.entries.length - 1) return null;

    const newIndex = state.currentIndex + 1;
    const entry = state.entries[newIndex];

    setState(prev => ({
      ...prev,
      currentIndex: newIndex,
    }));

    return entry;
  }, [state.currentIndex, state.entries]);

  const clear = useCallback(() => {
    setState(prev => ({
      ...prev,
      entries: [],
      currentIndex: -1,
    }));
  }, []);

  const canUndo = state.currentIndex >= 0 && state.entries[state.currentIndex]?.undoable;
  const canRedo = state.currentIndex < state.entries.length - 1;

  const getHistory = useCallback((limit?: number) => {
    const entries = state.entries.slice(0, state.currentIndex + 1);
    return limit ? entries.slice(-limit) : entries;
  }, [state.entries, state.currentIndex]);

  return {
    history: state,
    push,
    undo,
    redo,
    clear,
    canUndo,
    canRedo,
    getHistory,
  };
}
