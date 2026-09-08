import { useEffect } from 'react';
import { useTimelineStore } from '@/store/editmaster/useTimelineStore';

interface GlobalShortcutOptions {
  onOpenExport?: () => void;
}

export function useGlobalShortcuts({ onOpenExport }: GlobalShortcutOptions = {}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const state = useTimelineStore.getState();

      switch (e.key.toLowerCase()) {
        case 's':
          if (isCmdOrCtrl) {
            e.preventDefault();
          }
          break;
        case 'e':
          if (isCmdOrCtrl) {
            e.preventDefault();
            if (onOpenExport) {
              onOpenExport();
            } else {
              const appWindow = window as Window & { openExportModal?: () => void };
              appWindow.openExportModal?.();
            }
          }
          break;
        case 'b':
          if (isCmdOrCtrl) {
            e.preventDefault();
            state.splitSelectedClipsAtFrame(state.currentFrame);
          }
          break;
        case 'c':
          if (isCmdOrCtrl) {
            state.copySelectedClips();
          }
          break;
        case 'v':
          if (isCmdOrCtrl) {
            state.pasteClipsAtFrame(state.currentFrame);
          }
          break;
        case 'delete':
        case 'backspace':
          e.preventDefault();
          state.deleteSelectedClips();
          break;
        case ' ':
          e.preventDefault();
          state.setPlaying(!state.isPlaying);
          break;
        case 'm':
          state.addMarker(state.currentFrame);
          break;
        case 'z':
          if (isCmdOrCtrl && e.shiftKey) {
            e.preventDefault();
            state.redo();
          } else if (isCmdOrCtrl) {
            e.preventDefault();
            state.undo();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenExport]);
}
