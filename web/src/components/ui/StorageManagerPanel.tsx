import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Database, Download, Upload, Trash2, RefreshCw, Shield, Search, Plus, X, HardDrive, Lock, Unlock, FileJson } from 'lucide-react';
import LocalStorageManager, { StorageItem } from '@/services/local-storage-manager';

interface StorageManagerPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
  embedded?: boolean;
}

export default function StorageManagerPanel({ isOpen = true, onClose, embedded = false }: StorageManagerPanelProps) {
  const [items, setItems] = useState<StorageItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<StorageItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [encryptNewItem, setEncryptNewItem] = useState(false);
  const [stats, setStats] = useState({
    totalItems: 0,
    totalSize: 0,
    encryptedItems: 0,
  });
  const [loading, setLoading] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    try {
      const allItems = LocalStorageManager.getAllItems();
      setItems(allItems);
      setStats(LocalStorageManager.getStorageStats());
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen]);

  const filteredItems = items.filter(item =>
    item.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleAddItem = async () => {
    if (!newKey.trim()) return;
    
    try {
      let value: unknown;
      try {
        value = JSON.parse(newValue);
      } catch {
        value = newValue;
      }
      
      await LocalStorageManager.setItem(newKey, value, { encrypt: encryptNewItem });
      setShowAddModal(false);
      setNewKey('');
      setNewValue('');
      setEncryptNewItem(false);
      await loadItems();
    } catch (error) {
      console.error('Failed to add item:', error);
      toast.error('添加项目失败');
    }
  };

  const handleDeleteItem = async (key: string) => {
    if (!confirm(`确定要删除 "${key}" 吗？`)) return;
    
    try {
      await LocalStorageManager.removeItem(key);
      await loadItems();
      if (selectedItem?.key === key) {
        setSelectedItem(null);
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error('删除项目失败');
    }
  };

  const handleCreateBackup = async () => {
    try {
      await LocalStorageManager.createBackup();
      toast.success('备份创建成功！');
    } catch (error) {
      if (error instanceof Error && error.message !== 'Backup cancelled') {
        console.error('Failed to create backup:', error);
        toast.error('备份创建失败');
      }
    }
  };

  const handleRestoreBackup = async () => {
    if (!confirm('恢复备份将覆盖当前所有数据，确定要继续吗？')) return;
    
    try {
      await LocalStorageManager.restoreFromBackup();
      await loadItems();
      toast.success('备份恢复成功！');
    } catch (error) {
      if (error instanceof Error && error.message !== 'No backup file selected') {
        console.error('Failed to restore backup:', error);
        toast.error('备份恢复失败');
      }
    }
  };

  const handleExportItem = async (key: string) => {
    try {
      await LocalStorageManager.exportItem(key);
    } catch (error) {
      console.error('Failed to export item:', error);
    }
  };

  if (!isOpen) return null;

  const containerClass = embedded 
    ? "flex flex-col bg-transparent h-full" 
    : "fixed inset-0 z-50 flex flex-col bg-[#0F0F0F]";

  return (
    <div className={containerClass}>
      {!embedded && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#1A1A1A]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10B981] to-[#0D9668] flex items-center justify-center shadow-lg shadow-[#10B981]/20">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">存储管理</h2>
              <p className="text-xs text-white/50">管理本地存储数据</p>
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
      )}
      
      {/* 工具栏 */}
      <div className={embedded ? "flex items-center justify-between py-3 border-b border-white/5" : "flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#151515]"}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="搜索存储项目..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-[#0F0F0F] border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#10B981] w-64"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-[#10B981] to-[#0D9668] hover:from-[#0D9668] hover:to-[#0A7A55] rounded-lg text-white font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            添加项目
          </button>
          <button
            onClick={handleCreateBackup}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-[#0F0F0F] hover:bg-white/5 border border-white/10 rounded-lg text-white/80 transition-all"
          >
            <Download className="w-4 h-4" />
            创建备份
          </button>
          <button
            onClick={handleRestoreBackup}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-[#0F0F0F] hover:bg-white/5 border border-white/10 rounded-lg text-white/80 transition-all"
          >
            <Upload className="w-4 h-4" />
            恢复备份
          </button>
          <button
            onClick={loadItems}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-[#0F0F0F] hover:bg-white/5 border border-white/10 rounded-lg text-white/80 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>
      
      {/* 统计信息 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 py-4">
        <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#007AFF]/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-[#007AFF]" />
            </div>
            <div>
              <p className="text-sm text-white/60">总项目数</p>
              <p className="text-xl font-semibold text-white">{stats.totalItems}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#10B981]/20 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-[#10B981]" />
            </div>
            <div>
              <p className="text-sm text-white/60">总大小</p>
              <p className="text-xl font-semibold text-white">{formatSize(stats.totalSize)}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FFA500]/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#FFA500]" />
            </div>
            <div>
              <p className="text-sm text-white/60">加密项目</p>
              <p className="text-xl font-semibold text-white">{stats.encryptedItems}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* 内容区域 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 项目列表 */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <RefreshCw className="w-12 h-12 text-[#10B981] animate-spin" />
              <p className="text-white/50 text-sm">加载中...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <div className="w-24 h-24 rounded-3xl bg-[#1A1A1A] flex items-center justify-center border border-white/5">
                <Database className="w-12 h-12 text-white/20" />
              </div>
              <div>
                <p className="text-white/50 text-base mb-2">暂无存储项目</p>
                <p className="text-white/30 text-sm">点击&quot;添加项目&quot;开始</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <div
                  key={item.key}
                  onClick={() => setSelectedItem(item)}
                  className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border ${
                    selectedItem?.key === item.key
                      ? 'bg-[#10B981]/10 border-[#10B981]/50'
                      : 'bg-[#1A1A1A] border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      item.isEncrypted ? 'bg-[#FFA500]/20' : 'bg-[#007AFF]/20'
                    }`}>
                      {item.isEncrypted ? (
                        <Lock className="w-5 h-5 text-[#FFA500]" />
                      ) : (
                        <FileJson className="w-5 h-5 text-[#007AFF]" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-medium">{item.key}</h3>
                        {item.isEncrypted && (
                          <span className="px-1.5 py-0.5 text-xs bg-[#FFA500]/20 text-[#FFA500] rounded">已加密</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/50 mt-1">
                        <span>{formatSize(item.size)}</span>
                        <span>·</span>
                        <span>更新于 {new Date(item.updatedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportItem(item.key);
                      }}
                      className="p-2 hover:bg-white/10 rounded-lg"
                      title="导出"
                    >
                      <Download className="w-4 h-4 text-white/60" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteItem(item.key);
                      }}
                      className="p-2 hover:bg-red-500/20 rounded-lg"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* 详情面板 */}
        {selectedItem && (
          <div className="w-96 border-l border-white/10 bg-[#151515] p-6 overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">项目详情</h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 hover:bg-white/10 rounded"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/60 uppercase tracking-wider">键</label>
                <p className="mt-1 text-white font-mono text-sm bg-[#0F0F0F] p-3 rounded-lg border border-white/10">
                  {selectedItem.key}
                </p>
              </div>
              
              <div>
                <label className="text-xs text-white/60 uppercase tracking-wider">加密状态</label>
                <div className="mt-1 flex items-center gap-2">
                  {selectedItem.isEncrypted ? (
                    <>
                      <Lock className="w-4 h-4 text-[#FFA500]" />
                      <span className="text-[#FFA500]">已加密</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4 text-white/60" />
                      <span className="text-white/60">未加密</span>
                    </>
                  )}
                </div>
              </div>
              
              <div>
                <label className="text-xs text-white/60 uppercase tracking-wider">大小</label>
                <p className="mt-1 text-white">{formatSize(selectedItem.size)}</p>
              </div>
              
              <div>
                <label className="text-xs text-white/60 uppercase tracking-wider">创建时间</label>
                <p className="mt-1 text-white">{new Date(selectedItem.createdAt).toLocaleString()}</p>
              </div>
              
              <div>
                <label className="text-xs text-white/60 uppercase tracking-wider">更新时间</label>
                <p className="mt-1 text-white">{new Date(selectedItem.updatedAt).toLocaleString()}</p>
              </div>
              
              {!selectedItem.isEncrypted && selectedItem.value !== null && (
                <div>
                  <label className="text-xs text-white/60 uppercase tracking-wider">值</label>
                  <pre className="mt-1 text-white/80 text-xs bg-[#0F0F0F] p-3 rounded-lg border border-white/10 overflow-auto max-h-64">
                    {typeof selectedItem.value === 'string' 
                      ? selectedItem.value 
                      : JSON.stringify(selectedItem.value, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* 添加项目模态框 */}
      {showAddModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80">
          <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">添加存储项目</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-white/10 rounded"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-white/80">键</label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="输入键名"
                  className="mt-2 w-full px-4 py-2.5 bg-[#0F0F0F] border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#10B981]"
                />
              </div>
              <div>
                <label className="text-sm text-white/80">值</label>
                <textarea
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="输入值（可以是 JSON）"
                  rows={6}
                  className="mt-2 w-full px-4 py-2.5 bg-[#0F0F0F] border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#10B981] font-mono text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="encrypt"
                  checked={encryptNewItem}
                  onChange={(e) => setEncryptNewItem(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="encrypt" className="text-sm text-white/80">加密存储</label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all"
              >
                取消
              </button>
              <button
                onClick={handleAddItem}
                className="px-4 py-2 text-sm bg-gradient-to-r from-[#10B981] to-[#0D9668] hover:from-[#0D9668] hover:to-[#0A7A55] rounded-lg text-white font-medium transition-all"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
