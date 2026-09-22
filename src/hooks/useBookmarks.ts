import { useState, useEffect, useCallback } from 'react';
import { bookmarkManager, CanvasBookmark } from '@/services/bookmark-manager';

export const useBookmarks = (
  setViewport: (viewport: { x: number; y: number; zoom: number }, options?: { duration?: number }) => void
) => {
  const [bookmarks, setBookmarks] = useState<CanvasBookmark[]>([]);

  useEffect(() => {
    setBookmarks(bookmarkManager.getBookmarks());
    const unsubscribe = bookmarkManager.subscribe(() => {
      setBookmarks(bookmarkManager.getBookmarks());
    });
    return unsubscribe;
  }, []);

  const addBookmark = useCallback((viewport: { x: number; y: number; zoom: number }, name?: string) => {
    return bookmarkManager.addBookmark(viewport, name);
  }, []);

  const goToBookmark = useCallback((bookmarkId: string) => {
    const bookmark = bookmarkManager.getBookmark(bookmarkId);
    if (bookmark) {
      setViewport({ x: bookmark.x, y: bookmark.y, zoom: bookmark.zoom }, { duration: 300 });
    }
  }, [setViewport]);

  const deleteBookmark = useCallback((bookmarkId: string) => {
    return bookmarkManager.deleteBookmark(bookmarkId);
  }, []);

  return {
    bookmarks,
    addBookmark,
    goToBookmark,
    deleteBookmark,
  };
};
