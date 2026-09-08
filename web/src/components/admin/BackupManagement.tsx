import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Trash2,
  RefreshCw,
  Plus,
  AlertCircle,
  Check,
  X,
  Loader2,
  Clock,
  HardDrive,
  Archive,
  Upload,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { backupService, Backup, BackupStats } from '@/services/admin';

const BackupManagement: React.FC = () => {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await backupService.getList();
      if (response.success) {
        setBackups(response.backups || []);
        setStats(response.stats);
      }
    } catch (err: unknown) {
      setError((err as Error).message || '加载备份列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await backupService.createBackup();
      if (response.success) {
        setSuccess('备份创建成功');
        loadBackups();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.message || '备份创建失败');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err: unknown) {
      setError((err as Error).message || '备份创建失败');
      setTimeout(() => setError(null), 3000);
    } finally {
      setCreating(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return;

    setRestoring(selectedBackup.filename);
    setError(null);
    setSuccess(null);
    setConfirmRestore(false);
    try {
      const response = await backupService.restoreBackup(selectedBackup.filename);
      if (response.success) {
        setSuccess('备份恢复成功');
        setSelectedBackup(null);
        loadBackups();
      } else {
        setError(response.message || '备份恢复失败');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err: unknown) {
      setError((err as Error).message || '备份恢复失败');
      setTimeout(() => setError(null), 3000);
    } finally {
      setRestoring(null);
    }
  };

  const handleDeleteBackup = async () => {
    if (!selectedBackup) return;

    setDeleting(selectedBackup.filename);
    setError(null);
    setSuccess(null);
    setConfirmDelete(false);
    try {
      const response = await backupService.deleteBackup(selectedBackup.filename);
      if (response.success) {
        setSuccess('备份删除成功');
        setSelectedBackup(null);
        loadBackups();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('备份删除失败');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err: unknown) {
      setError((err as Error).message || '备份删除失败');
      setTimeout(() => setError(null), 3000);
    } finally {
      setDeleting(null);
    }
  };

  const handleDownloadBackup = async (filename: string) => {
    setDownloading(filename);
    try {
      const blob = await backupService.downloadBackup(filename);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setSuccess('备份下载开始');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError((err as Error).message || '备份下载失败');
      setTimeout(() => setError(null), 3000);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-400" />
          <span className="text-green-400">{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gray-500/20 rounded-lg">
              <Archive className="w-5 h-5 text-gray-400" />
            </div>
            <span className="text-gray-400 text-sm">备份总数</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.totalBackups || 0}</p>
        </div>

        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <HardDrive className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-gray-400 text-sm">总大小</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.totalSizeFormatted || '0 B'}</p>
        </div>

        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-gray-400 text-sm">最新备份</span>
          </div>
          <p className="text-lg font-bold text-white truncate">
            {stats?.newestBackup ? new Date(stats.newestBackup).toLocaleDateString('zh-CN') : '-'}
          </p>
        </div>

        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <History className="w-5 h-5 text-yellow-400" />
            </div>
            <span className="text-gray-400 text-sm">最早备份</span>
          </div>
          <p className="text-lg font-bold text-white truncate">
            {stats?.oldestBackup ? new Date(stats.oldestBackup).toLocaleDateString('zh-CN') : '-'}
          </p>
        </div>
      </div>

      <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Database className="w-5 h-5" />
            备份列表
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={loadBackups}
              disabled={loading}
              className="p-2 bg-[#0d0d0d] border border-white/10 text-gray-400 hover:text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
            <button
              onClick={handleCreateBackup}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creating ? '创建中...' : '创建备份'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#1A1A1E] rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">文件名</th>
              <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">大小</th>
              <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">创建时间</th>
              <th className="px-4 py-3 text-right text-gray-400 text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <Loader2 className="w-8 h-8 text-gray-500 animate-spin mx-auto" />
                </td>
              </tr>
            ) : backups.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                  暂无备份记录
                </td>
              </tr>
            ) : (
              backups.map((backup) => (
                <tr key={backup.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Archive className="w-5 h-5 text-gray-400" />
                      <span className="text-white text-sm font-mono">{backup.filename}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{backup.sizeFormatted}</td>
                  <td className="px-4 py-3 text-gray-500 text-sm">{backup.createdAtFormatted}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleDownloadBackup(backup.filename)}
                        disabled={downloading === backup.filename}
                        className="p-2 bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 rounded-lg transition-colors disabled:opacity-50"
                        title="下载"
                      >
                        {downloading === backup.filename ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedBackup(backup);
                          setConfirmRestore(true);
                        }}
                        disabled={restoring !== null}
                        className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors disabled:opacity-50"
                        title="恢复"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedBackup(backup);
                          setConfirmDelete(true);
                        }}
                        disabled={deleting !== null}
                        className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors disabled:opacity-50"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
          <div className="text-yellow-400 text-sm">
            <p className="font-medium mb-1">注意事项</p>
            <ul className="list-disc list-inside space-y-1 text-yellow-300">
              <li>恢复备份将覆盖当前数据库，请谨慎操作</li>
              <li>建议在恢复前创建新的备份</li>
              <li>大型数据库备份恢复可能需要较长时间</li>
              <li>请确保服务器有足够的存储空间</li>
            </ul>
          </div>
        </div>
      </div>

      {confirmRestore && selectedBackup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1A1A1E] rounded-xl border border-white/10 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">确认恢复备份</h3>
              <button
                onClick={() => { setConfirmRestore(false); setSelectedBackup(null); }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
              <p className="text-yellow-400 text-sm">
                即将恢复备份文件：<span className="font-mono font-medium">{selectedBackup.filename}</span>
              </p>
              <p className="text-yellow-300 text-sm mt-2">
                此操作将覆盖当前数据库，当前数据将丢失。请确认是否继续。
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmRestore(false); setSelectedBackup(null); }}
                className="flex-1 py-3 bg-[#0d0d0d] border border-white/10 rounded-lg text-gray-400 hover:text-white font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleRestoreBackup}
                disabled={restoring !== null}
                className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-600 rounded-lg text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
                {restoring ? '恢复中...' : '确认恢复'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && selectedBackup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1A1A1E] rounded-xl border border-white/10 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">确认删除备份</h3>
              <button
                onClick={() => { setConfirmDelete(false); setSelectedBackup(null); }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
              <p className="text-red-400 text-sm">
                即将删除备份文件：<span className="font-mono font-medium">{selectedBackup.filename}</span>
              </p>
              <p className="text-red-300 text-sm mt-2">
                此操作不可恢复，请确认是否继续。
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmDelete(false); setSelectedBackup(null); }}
                className="flex-1 py-3 bg-[#0d0d0d] border border-white/10 rounded-lg text-gray-400 hover:text-white font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeleteBackup}
                disabled={deleting !== null}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 rounded-lg text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupManagement;
