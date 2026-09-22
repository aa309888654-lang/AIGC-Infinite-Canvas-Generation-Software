import React, { useState, useCallback, useMemo } from 'react';
import { 
  Image, 
  Video, 
  Search, 
  Grid, 
  List, 
  X, 
  Maximize2, 
  Download, 
  Trash2, 
  Star, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  FolderOpen,
  MoreVertical,
  Pin
} from 'lucide-react';
import { useFileStore } from '@/store/useFileStore';
import OptimizedImage from './OptimizedImage';

interface MediaItem {
  id: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  size: number;
  createdAt: Date;
  isFavorite?: boolean;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    format?: string;
  };
}

interface MediaGalleryProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialType?: 'all' | 'images' | 'videos';
}

type ViewMode = 'grid' | 'list';
type SortBy = 'name' | 'date' | 'size' | 'type';
type SortOrder = 'asc' | 'desc';

export default function MediaGallery({ isOpen = true, onClose, initialType = 'all' }: MediaGalleryProps) {
  const { storagePaths } = useFileStore();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [activeType, setActiveType] = useState<'all' | 'images' | 'videos'>(initialType);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // 模拟媒体数据
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([
    {
      id: '1',
      name: 'sample-image-1.jpg',
      type: 'image',
      url: 'https://picsum.photos/seed/1/800/600',
      thumbnailUrl: 'https://picsum.photos/seed/1/200/150',
      size: 1024000,
      createdAt: new Date(Date.now() - 86400000),
      metadata: { width: 800, height: 600, format: 'jpg' },
    },
    {
      id: '2',
      name: 'sample-video-1.mp4',
      type: 'video',
      url: 'https://www.w3schools.com/html/mov_bbb.mp4',
      thumbnailUrl: 'https://picsum.photos/seed/2/200/150',
      size: 5120000,
      createdAt: new Date(Date.now() - 172800000),
      metadata: { width: 1280, height: 720, duration: 10, format: 'mp4' },
    },
    {
      id: '3',
      name: 'sample-image-2.jpg',
      type: 'image',
      url: 'https://picsum.photos/seed/3/800/600',
      thumbnailUrl: 'https://picsum.photos/seed/3/200/150',
      size: 1536000,
      createdAt: new Date(Date.now() - 259200000),
      metadata: { width: 800, height: 600, format: 'jpg' },
    },
  ]);

  // 过滤和排序后的媒体项目
  const filteredItems = useMemo(() => {
    let result = [...mediaItems];
    
    // 按类型过滤
    if (activeType === 'images') {
      result = result.filter(item => item.type === 'image');
    } else if (activeType === 'videos') {
      result = result.filter(item => item.type === 'video');
    }
    
    // 按搜索查询过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(query)
      );
    }
    
    // 排序
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [mediaItems, activeType, searchQuery, sortBy, sortOrder]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(id)) {
        newFavorites.delete(id);
      } else {
        newFavorites.add(id);
      }
      return newFavorites;
    });
  }, []);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  if (!isOpen) return null;

  if (selectedItem) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
        <div className="relative w-full h-full flex flex-col">
          {/* 顶部工具栏 */}
          <div className="flex items-center justify-between p-4 bg-black/50">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedItem(null)}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X className="w-6 h-6 text-white" />
              </button>
              <div className="text-white">
                <h3 className="font-medium">{selectedItem.name}</h3>
                <p className="text-sm text-white/60">{formatSize(selectedItem.size)} · {formatDate(selectedItem.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleFavorite(selectedItem.id)}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <Star className={`w-5 h-5 ${favorites.has(selectedItem.id) ? 'text-yellow-500 fill-yellow-500' : 'text-white'}`} />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <ZoomOut className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <RotateCw className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={handleZoomIn}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <ZoomIn className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <Maximize2 className="w-5 h-5 text-white" />
              </button>
              <button
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <Download className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
          
          {/* 媒体内容 */}
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            {selectedItem.type === 'image' ? (
              <img
                src={selectedItem.url}
                alt={selectedItem.name}
                style={{ transform: `scale(${zoomLevel})`, maxWidth: '90%', maxHeight: '90%' }}
                className="object-contain"
              />
            ) : (
              <video
                src={selectedItem.url}
                controls
                style={{ transform: `scale(${zoomLevel})`, maxWidth: '90%', maxHeight: '90%' }}
                className="object-contain"
              />
            )}
          </div>
          
          {/* 底部信息栏 */}
          {selectedItem.metadata && (
            <div className="flex items-center justify-center gap-6 p-4 bg-black/50 text-white/60 text-sm">
              {selectedItem.metadata.width && selectedItem.metadata.height && (
                <span>{selectedItem.metadata.width} × {selectedItem.metadata.height}</span>
              )}
              {selectedItem.metadata.duration && (
                <span>{selectedItem.metadata.duration}s</span>
              )}
              {selectedItem.metadata.format && (
                <span>.{selectedItem.metadata.format}</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0F0F0F]">
      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#1A1A1A]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#007AFF] to-[#0056CC] flex items-center justify-center shadow-lg shadow-[#007AFF]/20">
            <Image className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">媒体画廊</h2>
            <p className="text-xs text-white/50">浏览和管理您的媒体资源</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-red-500/20 rounded-lg"
          >
            <X className="w-5 h-5 text-white/60 hover:text-red-400" />
          </button>
        )}
      </div>
      
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#151515]">
        <div className="flex items-center gap-3">
          {/* 类型筛选 */}
          <div className="flex items-center gap-1 bg-[#0F0F0F] rounded-lg p-1">
            {[
              { id: 'all', label: '全部', icon: FolderOpen },
              { id: 'images', label: '图片', icon: Image },
              { id: 'videos', label: '视频', icon: Video },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveType(tab.id as any)}
                  className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition-all ${
                    activeType === tab.id
                      ? 'bg-[#007AFF] text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="搜索媒体文件..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-[#0F0F0F] border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#007AFF] w-64"
            />
          </div>
          
          {/* 排序 */}
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [by, order] = e.target.value.split('-');
              setSortBy(by as SortBy);
              setSortOrder(order as SortOrder);
            }}
            className="bg-[#0F0F0F] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70"
          >
            <option value="date-desc">最新修改</option>
            <option value="date-asc">最早修改</option>
            <option value="name-asc">名称 A-Z</option>
            <option value="name-desc">名称 Z-A</option>
            <option value="size-asc">大小 小-大</option>
            <option value="size-desc">大小 大-小</option>
          </select>
          
          {/* 视图切换 */}
          <div className="flex items-center gap-1 bg-[#0F0F0F] rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* 内容区域 */}
      <div className="flex-1 overflow-auto p-6">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="w-24 h-24 rounded-3xl bg-[#1A1A1A] flex items-center justify-center border border-white/5">
              <FolderOpen className="w-12 h-12 text-white/20" />
            </div>
            <div>
              <p className="text-white/50 text-base mb-2">暂无媒体文件</p>
              <p className="text-white/30 text-sm">您还没有添加任何媒体文件</p>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer bg-[#1A1A1A] border border-white/5 hover:border-white/10 transition-all"
              >
                {/* 缩略图 */}
                <div className="absolute inset-0">
                  {item.type === 'image' ? (
                    <OptimizedImage
                      src={item.thumbnailUrl || item.url}
                      alt={item.name}
                      thumbnail
                      thumbnailSize={300}
                      format="webp"
                      quality={75}
                      lazy
                      className="w-full h-full"
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="relative w-full h-full">
                      <OptimizedImage
                        src={item.thumbnailUrl || ''}
                        alt={item.name}
                        thumbnail
                        thumbnailSize={300}
                        format="webp"
                        quality={75}
                        lazy
                        className="w-full h-full"
                        style={{ objectFit: 'cover' }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                          <Video className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* 悬停效果 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item.id);
                      }}
                      className="p-1.5 bg-black/50 rounded-lg hover:bg-black/70"
                    >
                      <Star className={`w-4 h-4 ${favorites.has(item.id) ? 'text-yellow-500 fill-yellow-500' : 'text-white'}`} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="p-1.5 bg-black/50 rounded-lg hover:bg-black/70"
                    >
                      <MoreVertical className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-sm font-medium truncate">{item.name}</p>
                    <div className="flex items-center gap-2 text-xs text-white/70 mt-1">
                      <span>{formatSize(item.size)}</span>
                      <span>·</span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="flex items-center gap-4 p-4 rounded-xl bg-[#1A1A1A] border border-white/5 hover:border-white/10 cursor-pointer transition-all"
              >
                {/* 缩略图 */}
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  {item.type === 'image' ? (
                    <OptimizedImage
                      src={item.thumbnailUrl || item.url}
                      alt={item.name}
                      thumbnail
                      thumbnailSize={128}
                      format="webp"
                      quality={70}
                      lazy
                      className="w-full h-full"
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="relative w-full h-full bg-[#2A2A2E] flex items-center justify-center">
                      <OptimizedImage
                        src={item.thumbnailUrl || ''}
                        alt={item.name}
                        thumbnail
                        thumbnailSize={128}
                        format="webp"
                        quality={70}
                        lazy
                        className="w-full h-full"
                        style={{ objectFit: 'cover' }}
                      />
                      <Video className="absolute w-6 h-6 text-white" />
                    </div>
                  )}
                </div>
                
                {/* 信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium truncate">{item.name}</h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item.id);
                      }}
                    >
                      <Star className={`w-4 h-4 ${favorites.has(item.id) ? 'text-yellow-500 fill-yellow-500' : 'text-white/30'}`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-white/50 mt-1">
                    <span>{item.type === 'image' ? '图片' : '视频'}</span>
                    <span>·</span>
                    <span>{formatSize(item.size)}</span>
                    <span>·</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                </div>
              
              {/* 操作按钮 */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                <button className="p-2 hover:bg-white/10 rounded-lg">
                  <Download className="w-4 h-4 text-white/60" />
                </button>
                <button className="p-2 hover:bg-white/10 rounded-lg">
                  <Trash2 className="w-4 h-4 text-white/60" />
                </button>
              </div>
            </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 底部状态栏 */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-white/5 bg-[#151515]">
        <div className="text-sm text-white/50">
          共 {filteredItems.length} 个项目
        </div>
        <div className="text-sm text-white/50">
          存储路径: {storagePaths.base}
        </div>
      </div>
    </div>
  );
}
