import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Database, FileImage, Film, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { taskService, type GeneratedCleanupPreview, type GeneratedCleanupResult } from '@/services/admin/task-service';

type MediaType = 'image' | 'video';

const timeOptions = [
  { label: '全部', value: 0 },
  { label: '7 天前', value: 7 },
  { label: '30 天前', value: 30 },
  { label: '90 天前', value: 90 },
];

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes || 0} B`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value || 0);
}

export default function GeneratedCleanupPanel() {
  const [mediaTypes, setMediaTypes] = useState<MediaType[]>(['image', 'video']);
  const [includeTasks, setIncludeTasks] = useState(false);
  const [olderThanDays, setOlderThanDays] = useState(30);
  const [confirmText, setConfirmText] = useState('');
  const [preview, setPreview] = useState<GeneratedCleanupPreview | null>(null);
  const [result, setResult] = useState<GeneratedCleanupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canExecute = useMemo(() => {
    if (!preview) return false;
    if (confirmText !== 'CLEAN') return false;
    return preview.totalFiles > 0 || preview.tasks > 0;
  }, [confirmText, preview]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await taskService.previewGeneratedCleanup({ mediaTypes, includeTasks, olderThanDays });
      setPreview(response.data);
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载清理预览失败');
    } finally {
      setLoading(false);
    }
  }, [includeTasks, mediaTypes, olderThanDays]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const toggleMediaType = (type: MediaType) => {
    setMediaTypes((prev) => {
      if (prev.includes(type)) {
        const next = prev.filter((item) => item !== type);
        return next.length ? next : prev;
      }
      return [...prev, type];
    });
  };

  const executeCleanup = async () => {
    if (!canExecute) return;
    setExecuting(true);
    setError(null);
    try {
      const response = await taskService.executeGeneratedCleanup({ mediaTypes, includeTasks, olderThanDays, confirmText });
      setResult(response.data);
      setConfirmText('');
      await loadPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : '执行清理失败');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100 flex gap-3">
        <AlertTriangle className="w-5 h-5 mt-0.5 text-amber-300" />
        <div>
          <div className="font-medium text-amber-200">高风险清理操作</div>
          <div className="text-amber-100/80 mt-1">该面板会软删除生成文件记录，并异步删除本地 uploads 下对应图片/视频实体文件；文件删除失败时会自动恢复记录。任务记录仅标记为已删除，运行中任务不会被清理，执行前必须输入 CLEAN。</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-5">
          <div>
            <h3 className="text-lg font-semibold text-white">清理条件</h3>
            <p className="text-sm text-slate-400 mt-1">默认清理 30 天前生成图片和视频，任务记录需手动勾选。</p>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium text-slate-200">清理内容</div>
            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3 cursor-pointer">
              <span className="flex items-center gap-2 text-slate-200"><FileImage className="w-4 h-4 text-cyan-300" />生成图片</span>
              <input type="checkbox" checked={mediaTypes.includes('image')} onChange={() => toggleMediaType('image')} />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3 cursor-pointer">
              <span className="flex items-center gap-2 text-slate-200"><Film className="w-4 h-4 text-purple-300" />生成视频</span>
              <input type="checkbox" checked={mediaTypes.includes('video')} onChange={() => toggleMediaType('video')} />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3 cursor-pointer">
              <span className="flex items-center gap-2 text-slate-200"><Database className="w-4 h-4 text-amber-300" />任务记录</span>
              <input type="checkbox" checked={includeTasks} onChange={(event) => setIncludeTasks(event.target.checked)} />
            </label>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium text-slate-200">时间范围</div>
            <div className="grid grid-cols-2 gap-2">
              {timeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setOlderThanDays(option.value)}
                  className={`rounded-lg px-3 py-2 text-sm border transition ${olderThanDays === option.value ? 'border-blue-400 bg-blue-500/20 text-blue-100' : 'border-white/10 bg-black/20 text-slate-300 hover:bg-white/10'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={loadPreview}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-60 text-white px-4 py-3 transition"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            刷新预览
          </button>
        </div>

        <div className="xl:col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">清理预览</h3>
              <p className="text-sm text-slate-400 mt-1">请确认统计结果后再执行清理。</p>
            </div>
            {loading && <Loader2 className="w-5 h-5 text-blue-300 animate-spin" />}
          </div>

          {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs text-slate-400">图片</div>
              <div className="text-2xl font-bold text-cyan-200 mt-1">{formatNumber(preview?.images || 0)}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs text-slate-400">视频</div>
              <div className="text-2xl font-bold text-purple-200 mt-1">{formatNumber(preview?.videos || 0)}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs text-slate-400">任务</div>
              <div className="text-2xl font-bold text-amber-200 mt-1">{formatNumber(preview?.tasks || 0)}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs text-slate-400">预计释放</div>
              <div className="text-2xl font-bold text-emerald-200 mt-1">{formatBytes(preview?.estimatedBytes || 0)}</div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.04] text-slate-400">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">来源</th>
                  <th className="text-right px-4 py-3 font-medium">图片</th>
                  <th className="text-right px-4 py-3 font-medium">视频</th>
                  <th className="text-right px-4 py-3 font-medium">大小</th>
                </tr>
              </thead>
              <tbody>
                {(preview?.bySource || []).length ? (preview?.bySource || []).map((item) => (
                  <tr key={item.source} className="border-t border-white/10 text-slate-200">
                    <td className="px-4 py-3">{item.source}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(item.images)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(item.videos)}</td>
                    <td className="px-4 py-3 text-right">{formatBytes(item.bytes)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">暂无可清理生成内容</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 space-y-3">
            <div className="text-sm text-red-100">输入 CLEAN 后才允许执行清理。</div>
            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="输入 CLEAN"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-slate-500 outline-none focus:border-red-300"
            />
            <button
              type="button"
              onClick={executeCleanup}
              disabled={!canExecute || executing}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:hover:bg-red-600 text-white px-4 py-3 transition"
            >
              {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              执行清理
            </button>
          </div>

          {result && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100 flex gap-3">
              <CheckCircle className="w-5 h-5 mt-0.5 text-emerald-300" />
              <div>
                <div className="font-medium">{result.failedCount > 0 ? '清理完成（部分失败）' : '清理完成'}</div>
                <div className="mt-1 text-emerald-100/80">
                  删除图片 {formatNumber(result.deletedImages)} 个，视频 {formatNumber(result.deletedVideos)} 个，任务 {formatNumber(result.deletedTasks)} 个，释放 {formatBytes(result.releasedBytes)}，失败 {formatNumber(result.failedCount)} 个。
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
