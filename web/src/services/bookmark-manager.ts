export interface CanvasBookmark {
  id: string;
  name: string;
  x: number;
  y: number;
  zoom: number;
}

type BookmarkCallback = () => void;

class BookmarkManager {
  private static instance: BookmarkManager;
  private bookmarks: CanvasBookmark[] = [];
  private storageKey = 'canvas-bookmarks';
  private callbacks: BookmarkCallback[] = [];

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): BookmarkManager {
    if (!BookmarkManager.instance) {
      BookmarkManager.instance = new BookmarkManager();
    }
    return BookmarkManager.instance;
  }

  subscribe(callback: BookmarkCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  private notify(): void {
    this.callbacks.forEach(cb => cb());
  }

  addBookmark(viewport: { x: number; y: number; zoom: number }, name?: string): CanvasBookmark {
    const bookmark: CanvasBookmark = {
      id: `bookmark-${Date.now()}`,
      name: name || `书签 ${this.bookmarks.length + 1}`,
      x: viewport.x,
      y: viewport.y,
      zoom: viewport.zoom,
    };

    this.bookmarks.push(bookmark);
    this.saveToStorage();
    this.notify();
    return bookmark;
  }

  getBookmark(bookmarkId: string): CanvasBookmark | null {
    return this.bookmarks.find(b => b.id === bookmarkId) || null;
  }

  deleteBookmark(bookmarkId: string): boolean {
    const index = this.bookmarks.findIndex(b => b.id === bookmarkId);
    if (index === -1) return false;

    this.bookmarks.splice(index, 1);
    this.saveToStorage();
    this.notify();
    return true;
  }

  getBookmarks(): CanvasBookmark[] {
    return [...this.bookmarks];
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.bookmarks));
    } catch (error) {
      console.error('[BookmarkManager] 保存书签失败:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.bookmarks = JSON.parse(data);
      }
    } catch (error) {
      console.error('[BookmarkManager] 加载书签失败:', error);
      this.bookmarks = [];
    }
  }
}

export const bookmarkManager = BookmarkManager.getInstance();
