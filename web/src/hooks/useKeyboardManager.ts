import { useEffect, useMemo } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  handler: (e: KeyboardEvent) => void;
  description: string;
  priority?: number;
  preventDefault?: boolean;
  allowInInput?: boolean;
}

const isInputField = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable;
};

const matchShortcut = (shortcut: KeyboardShortcut, e: KeyboardEvent): boolean => {
  if (shortcut.key !== e.key) return false;
  if (shortcut.ctrlKey !== undefined && shortcut.ctrlKey !== (e.ctrlKey || e.metaKey)) return false;
  if (shortcut.shiftKey !== undefined && shortcut.shiftKey !== e.shiftKey) return false;
  if (shortcut.altKey !== undefined && shortcut.altKey !== e.altKey) return false;
  if (shortcut.metaKey !== undefined && shortcut.metaKey !== e.metaKey) return false;

  if (shortcut.ctrlKey === undefined && shortcut.metaKey === undefined) {
    if (e.ctrlKey || e.metaKey) return false;
  }
  if (shortcut.shiftKey === undefined && e.shiftKey) return false;
  if (shortcut.altKey === undefined && e.altKey) return false;

  return true;
};

export const useKeyboardManager = (shortcuts: KeyboardShortcut[]) => {
  const sortedShortcuts = useMemo(() => {
    return [...shortcuts].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }, [shortcuts]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const inInput = isInputField(e.target);

      const matched = sortedShortcuts.find(shortcut => {
        if (inInput && !shortcut.allowInInput) return false;
        return matchShortcut(shortcut, e);
      });

      if (matched) {
        if (matched.preventDefault !== false) {
          e.preventDefault();
        }
        matched.handler(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sortedShortcuts]);
};
