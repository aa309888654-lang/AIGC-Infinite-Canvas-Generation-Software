import React, { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  useMaterialLibraryStore,
  materialLibraryService,
  type Sticker,
  type StickerCategory,
} from '@/services/material-library-service';
import { Smile, Heart, Star, ArrowRight, Circle, Music, Sparkles, ThumbsUp, Search, HeartOff, Clock, Upload, Grid, List, Package, X } from 'lucide-react';

interface MaterialPanelProps {
  onStickerSelect?: (sticker: Sticker) => void;
  className?: string;
}

const CATEGORY_ICONS: Record<StickerCategory, React.ReactNode> = {
  emoji: <Smile className="w-4 h-4" />,
  arrow: <ArrowRight className="w-4 h-4" />,
  shape: <Circle className="w-4 h-4" />,
  text: <span className="text-sm font-bold">T</span>,
  social: <ThumbsUp className="w-4 h-4" />,
  nature: <Star className="w-4 h-4" />,
  animal: <span className="text-lg">🐾</span>,
  food: <span className="text-lg">🍔</span>,
  sport: <span className="text-lg">⚽</span>,
  music: <Music className="w-4 h-4" />,
  holiday: <span className="text-lg">🎄</span>,
  decorative: <Sparkles className="w-4 h-4" />,
};

export const MaterialPanel: React.FC<MaterialPanelProps> = ({
  onStickerSelect,
  className,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showUpload, setShowUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    stickers,
    favorites,
    searchQuery,
    selectedCategory,
    isLoading,
    toggleFavorite,
    addToRecent,
    setSearchQuery,
    setSelectedCategory,
    addSticker,
    getFavoriteStickers,
    getRecentStickers,
    searchStickers,
  } = useMaterialLibraryStore();

  const categories = materialLibraryService.getAllCategories();

  const getFilteredStickers = useCallback(() => {
    let result = stickers;

    if (selectedCategory !== 'all') {
      result = result.filter((s) => s.category === selectedCategory);
    }

    if (searchQuery) {
      result = searchStickers(searchQuery);
    }

    return result;
  }, [stickers, selectedCategory, searchQuery, searchStickers]);

  const handleStickerClick = (sticker: Sticker) => {
    addToRecent(sticker.id);
    onStickerSelect?.(sticker);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        try {
          const sticker = await materialLibraryService.loadCustomSticker(file);
          addSticker(sticker);
        } catch (error) {
          console.error('Failed to load sticker:', error);
        }
      }
    }

    setShowUpload(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const filteredStickers = getFilteredStickers();
  const favoriteStickers = getFavoriteStickers();
  const recentStickers = getRecentStickers();

  return (
    <div className={cn('flex flex-col bg-[#0D0D0D] rounded-lg overflow-hidden', className)}>
      <div className="flex items-center justify-between px-3 py-2 bg-[#1A1A1A] border-b border-[#2D2D2D]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-medium text-white">素材库</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-1.5 hover:bg-[#2D2D2D] rounded text-gray-400 hover:text-white transition-colors"
            title={viewMode === 'grid' ? '列表视图' : '网格视图'}
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="p-1.5 hover:bg-[#2D2D2D] rounded text-gray-400 hover:text-white transition-colors"
            title="上传素材"
          >
            <Upload className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-3 py-2 bg-[#1A1A1A] border-b border-[#2D2D2D]">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="搜索素材..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 bg-[#0D0D0D] border border-[#3A3A3A] rounded-lg text-sm text-white placeholder-gray-500 focus:border-[#10B981] focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 px-3 py-2 overflow-x-auto bg-[#1A1A1A] border-b border-[#2D2D2D]">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-xs rounded whitespace-nowrap transition-colors',
              selectedCategory === cat.id
                ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/50'
                : 'bg-[#1F1F1F] text-gray-400 hover:bg-[#2D2D2D]'
            )}
          >
            {cat.id !== 'all' && CATEGORY_ICONS[cat.id as StickerCategory]}
            {cat.name}
          </button>
        ))}
      </div>

      {showUpload && (
        <div className="px-3 py-3 bg-[#1A1A1A] border-b border-[#2D2D2D]">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-4 border-2 border-dashed border-[#3A3A3A] rounded-lg text-gray-400 hover:border-[#10B981] hover:text-[#10B981] transition-colors"
          >
            <Upload className="w-6 h-6 mx-auto mb-2" />
            <span className="text-sm">点击或拖拽上传图片</span>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {recentStickers.length > 0 && !searchQuery && selectedCategory === 'all' && (
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-3 h-3 text-gray-500" />
              <span className="text-xs text-gray-500">最近使用</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {recentStickers.slice(0, 10).map((sticker) => (
                <button
                  key={sticker.id}
                  onClick={() => handleStickerClick(sticker)}
                  className="flex-shrink-0 w-12 h-12 bg-[#1F1F1F] rounded-lg overflow-hidden hover:ring-2 hover:ring-[#10B981] transition-all"
                >
                  <img
                    src={sticker.url}
                    alt={sticker.name}
                    className="w-full h-full object-contain"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {favoriteStickers.length > 0 && !searchQuery && selectedCategory === 'all' && (
          <div className="px-3 py-2 border-t border-[#2D2D2D]">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-3 h-3 text-red-400" />
              <span className="text-xs text-gray-500">我的收藏</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {favoriteStickers.map((sticker) => (
                <button
                  key={sticker.id}
                  onClick={() => handleStickerClick(sticker)}
                  className="flex-shrink-0 w-12 h-12 bg-[#1F1F1F] rounded-lg overflow-hidden hover:ring-2 hover:ring-[#10B981] transition-all relative group"
                >
                  <img
                    src={sticker.url}
                    alt={sticker.name}
                    className="w-full h-full object-contain"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(sticker.id);
                    }}
                    className="absolute top-0 right-0 p-0.5 bg-red-500 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <HeartOff className="w-3 h-3 text-white" />
                  </button>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">
              {filteredStickers.length} 个素材
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full" />
            </div>
          ) : filteredStickers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <Package className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">暂无素材</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-4 gap-2">
              {filteredStickers.map((sticker) => (
                <div
                  key={sticker.id}
                  className="relative group"
                >
                  <button
                    onClick={() => handleStickerClick(sticker)}
                    className="w-full aspect-square bg-[#1F1F1F] rounded-lg overflow-hidden hover:ring-2 hover:ring-[#10B981] transition-all"
                  >
                    <img
                      src={sticker.url}
                      alt={sticker.name}
                      className="w-full h-full object-contain"
                    />
                  </button>
                  <button
                    onClick={() => toggleFavorite(sticker.id)}
                    className={cn(
                      'absolute top-1 right-1 p-1 rounded transition-all',
                      favorites.includes(sticker.id)
                        ? 'bg-red-500 text-white'
                        : 'bg-black/50 text-gray-400 opacity-0 group-hover:opacity-100'
                    )}
                  >
                    <Heart className="w-3 h-3" fill={favorites.includes(sticker.id) ? 'currentColor' : 'none'} />
                  </button>
                  {sticker.isPremium && (
                    <div className="absolute bottom-1 left-1 px-1 py-0.5 bg-yellow-500/80 text-[10px] text-black rounded">
                      VIP
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredStickers.map((sticker) => (
                <button
                  key={sticker.id}
                  onClick={() => handleStickerClick(sticker)}
                  className="flex items-center gap-3 w-full p-2 bg-[#1F1F1F] rounded-lg hover:bg-[#2D2D2D] transition-colors"
                >
                  <div className="w-10 h-10 bg-[#0D0D0D] rounded overflow-hidden">
                    <img
                      src={sticker.url}
                      alt={sticker.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm text-white">{sticker.name}</div>
                    <div className="text-xs text-gray-500">
                      {materialLibraryService.getCategoryName(sticker.category)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(sticker.id);
                    }}
                    className={cn(
                      'p-1 rounded transition-colors',
                      favorites.includes(sticker.id)
                        ? 'text-red-400'
                        : 'text-gray-500 hover:text-red-400'
                    )}
                  >
                    <Heart className="w-4 h-4" fill={favorites.includes(sticker.id) ? 'currentColor' : 'none'} />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MaterialPanel;
