import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  enhancedFileSystem,
  FileEntry,
  FileSystemEvent,
  CacheStats,
} from '@/services/enhanced-file-system';
import { Folder, File, Search, Eye, Trash2, Activity, FolderTree } from 'lucide-react';

export const EnhancedFileSystemDemo = () => {
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [searchResults, setSearchResults] = useState<FileEntry[]>([]);
  const [watchEvents, setWatchEvents] = useState<FileSystemEvent[]>([]);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'browse' | 'search' | 'watch' | 'cache'>('browse');

  // 加载缓存统计
  useEffect(() => {
    loadCacheStats();
    const interval = setInterval(loadCacheStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadCacheStats = async () => {
    try {
      const stats = await enhancedFileSystem.getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('加载缓存统计失败:', error);
    }
  };

  // 递归浏览目录
  const handleBrowseRecursive = async () => {
    if (!selectedPath) return;
    
    setLoading(true);
    try {
      const result = await enhancedFileSystem.readDirectoryRecursive(
        selectedPath,
        3, // 最大深度3层
        false
      );
      setEntries(result);
    } catch (error) {
      console.error('浏览目录失败:', error);
      toast.error(`浏览失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // 搜索文件
  const handleSearch = async (pattern: string) => {
    if (!selectedPath || !pattern) return;
    
    setLoading(true);
    try {
      const results = await enhancedFileSystem.searchFiles(
        selectedPath,
        pattern,
        10
      );
      setSearchResults(results);
    } catch (error) {
      console.error('搜索失败:', error);
      toast.error(`搜索失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // 开始监视目录
  const handleStartWatch = async () => {
    if (!selectedPath) return;
    
    try {
      await enhancedFileSystem.watchDirectory(
        selectedPath,
        true,
        (event) => {
          setWatchEvents(prev => [event, ...prev].slice(0, 50)); // 保留最近50条
        }
      );
      toast.success('已开始监视目录');
    } catch (error) {
      console.error('启动监视失败:', error);
      toast.error(`启动监视失败: ${error}`);
    }
  };

  // 停止监视目录
  const handleStopWatch = async () => {
    if (!selectedPath) return;
    
    try {
      await enhancedFileSystem.unwatchDirectory(selectedPath);
      toast.success('已停止监视目录');
    } catch (error) {
      console.error('停止监视失败:', error);
      toast.error(`停止监视失败: ${error}`);
    }
  };

  // 清除缓存
  const handleClearCache = async () => {
    try {
      const count = await enhancedFileSystem.clearThumbnailCache();
      toast.success(`已清除 ${count} 个缓存项`);
      loadCacheStats();
    } catch (error) {
      console.error('清除缓存失败:', error);
      toast.error(`清除缓存失败: ${error}`);
    }
  };

  // 生成缩略图
  const handleGenerateThumbnail = async (filePath: string) => {
    try {
      const thumbnail = await enhancedFileSystem.generateThumbnail(filePath, 200, 200);
      // SEC M-4 修复：使用 DOM API 替代 document.write，防止缩略图 URL 中的特殊字符注入脚本。
      // 安全最佳实践：document.write 会原样写入字符串，若 thumbnail 包含 " 或 ><script>
      // 可在弹窗中执行任意脚本。DOM API 由浏览器自动转义属性值。
      const win = window.open('', '_blank');
      if (win) {
        const img = win.document.createElement('img');
        img.src = thumbnail;
        img.alt = 'Thumbnail';
        win.document.body.appendChild(img);
      }
    } catch (error) {
      console.error('生成缩略图失败:', error);
      toast.error(`生成缩略图失败: ${error}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0F0F11] text-white p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <FolderTree className="w-6 h-6" />
          增强文件系统功能演示
        </h1>

        {/* 路径输入 */}
        <div className="mb-6">
          <label className="block text-sm text-white/60 mb-2">目录路径</label>
          <input
            type="text"
            value={selectedPath}
            onChange={(e) => setSelectedPath(e.target.value)}
            placeholder="输入目录路径，例如: C:\Users\YourName\Documents"
            className="w-full px-4 py-2 bg-[#1A1A1D] border border-[#3A3A42] rounded-lg text-white"
          />
        </div>

        {/* 标签页 */}
        <div className="flex gap-2 mb-6 border-b border-[#3A3A42]">
          {[
            { id: 'browse', label: '递归浏览', icon: Folder },
            { id: 'search', label: '文件搜索', icon: Search },
            { id: 'watch', label: '目录监视', icon: Activity },
            { id: 'cache', label: '缓存管理', icon: Eye },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-gray-500 text-gray-400'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* 递归浏览 */}
        {activeTab === 'browse' && (
          <div>
            <button
              onClick={handleBrowseRecursive}
              disabled={loading || !selectedPath}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600 rounded-lg mb-4"
            >
              {loading ? '加载中...' : '递归浏览目录'}
            </button>

            <div className="bg-[#1A1A1D] border border-[#3A3A42] rounded-lg p-4 max-h-96 overflow-auto">
              {entries.length === 0 ? (
                <p className="text-white/40 text-center py-8">暂无数据</p>
              ) : (
                <div className="space-y-1">
                  {entries.map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-white/5 rounded"
                      style={{ paddingLeft: `${(entry.depth || 0) * 20 + 8}px` }}
                    >
                      {entry.type === 'directory' ? (
                        <Folder className="w-4 h-4 text-gray-400" />
                      ) : (
                        <File className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="flex-1 text-sm">{entry.name}</span>
                      <span className="text-xs text-white/40">
                        {entry.size ? `${(entry.size / 1024).toFixed(1)} KB` : ''}
                      </span>
                      {entry.type === 'file' && entry.url && (
                        <button
                          onClick={() => handleGenerateThumbnail(entry.path)}
                          className="p-1 hover:bg-white/10 rounded"
                          title="生成缩略图"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 文件搜索 */}
        {activeTab === 'search' && (
          <div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="搜索模式，例如: *.jpg 或 test*"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch(e.currentTarget.value);
                  }
                }}
                className="flex-1 px-4 py-2 bg-[#1A1A1D] border border-[#3A3A42] rounded-lg"
              />
              <button
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                  handleSearch(input.value);
                }}
                disabled={loading || !selectedPath}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600 rounded-lg"
              >
                搜索
              </button>
            </div>

            <div className="bg-[#1A1A1D] border border-[#3A3A42] rounded-lg p-4 max-h-96 overflow-auto">
              {searchResults.length === 0 ? (
                <p className="text-white/40 text-center py-8">暂无搜索结果</p>
              ) : (
                <div className="space-y-1">
                  {searchResults.map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-white/5 rounded"
                    >
                      <File className="w-4 h-4 text-gray-400" />
                      <span className="flex-1 text-sm">{entry.path}</span>
                      <span className="text-xs text-white/40">
                        {entry.size ? `${(entry.size / 1024).toFixed(1)} KB` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 目录监视 */}
        {activeTab === 'watch' && (
          <div>
            <div className="flex gap-2 mb-4">
              <button
                onClick={handleStartWatch}
                disabled={!selectedPath}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg"
              >
                开始监视
              </button>
              <button
                onClick={handleStopWatch}
                disabled={!selectedPath}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg"
              >
                停止监视
              </button>
              <button
                onClick={() => setWatchEvents([])}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg"
              >
                清除事件
              </button>
            </div>

            <div className="bg-[#1A1A1D] border border-[#3A3A42] rounded-lg p-4 max-h-96 overflow-auto">
              {watchEvents.length === 0 ? (
                <p className="text-white/40 text-center py-8">暂无监视事件</p>
              ) : (
                <div className="space-y-2">
                  {watchEvents.map((event, index) => (
                    <div
                      key={index}
                      className="px-3 py-2 bg-white/5 rounded border-l-2 border-gray-500"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium ${
                          event.type === 'created' ? 'text-green-400' :
                          event.type === 'modified' ? 'text-yellow-400' :
                          event.type === 'removed' ? 'text-red-400' :
                          'text-gray-400'
                        }`}>
                          {event.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-white/40">
                          {new Date(event.timestamp * 1000).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-xs text-white/60">
                        {event.paths.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 缓存管理 */}
        {activeTab === 'cache' && (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-[#1A1A1D] border border-[#3A3A42] rounded-lg p-4">
                <div className="text-sm text-white/60 mb-1">缓存数量</div>
                <div className="text-2xl font-bold">{cacheStats?.size || 0}</div>
              </div>
              <div className="bg-[#1A1A1D] border border-[#3A3A42] rounded-lg p-4">
                <div className="text-sm text-white/60 mb-1">缓存容量</div>
                <div className="text-2xl font-bold">{cacheStats?.capacity || 0}</div>
              </div>
              <div className="bg-[#1A1A1D] border border-[#3A3A42] rounded-lg p-4">
                <div className="text-sm text-white/60 mb-1">命中率</div>
                <div className="text-2xl font-bold">
                  {((cacheStats?.hitRate || 0) * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            <button
              onClick={handleClearCache}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              清除所有缓存
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
