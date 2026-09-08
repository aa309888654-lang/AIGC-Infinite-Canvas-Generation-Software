import React from 'react';
import { Bookmark, BookmarkPlus, X, RotateCcw, Trash2 } from 'lucide-react';
import { CanvasBookmark } from '@/services/bookmark-manager';

interface BookmarksPanelProps {
  bookmarks: CanvasBookmark[];
  onAddBookmark: () => void;
  onGoToBookmark: (bookmark: CanvasBookmark) => void;
  onDeleteBookmark: (bookmarkId: string) => void;
  onClose: () => void;
}

const BookmarksPanel: React.FC<BookmarksPanelProps> = ({
  bookmarks,
  onAddBookmark,
  onGoToBookmark,
  onDeleteBookmark,
  onClose,
}) => {
  return (
    <div className="absolute top-16 right-16 z-50 w-72 bg-[#1a1a1a] backdrop-blur border border-[#2D2D2D] rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-white text-sm font-medium">
          <Bookmark className="w-4 h-4" />
          画布书签
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onAddBookmark}
            className="p-1.5 rounded hover:bg-white/10 text-[#10B981] transition-colors"
            title="添加书签"
          >
            <BookmarkPlus className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {bookmarks.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-xs">
            暂无书签，按 <kbd className="px-1.5 py-0.5 bg-[#2D2D2D] rounded text-[10px]">Ctrl+B</kbd> 添加
          </div>
        ) : (
          bookmarks.map(bm => (
            <div key={bm.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/5 border-b border-white/5 last:border-b-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{bm.name}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  缩放: {(bm.zoom * 100).toFixed(0)}%
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                <button
                  onClick={() => onGoToBookmark(bm)}
                  className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-[#10B981] transition-colors"
                  title="跳转至此书签"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDeleteBookmark(bm.id)}
                  className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors"
                  title="删除书签"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BookmarksPanel;
