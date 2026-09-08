import React, { useEffect, useState, useRef } from 'react';
import {
  Plus,
  Save,
  Trash2,
  Video,
  RefreshCw,
  Loader2,
  ArrowUp,
  ArrowDown,
  ImageIcon,
  Film,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BACKEND_URL } from '@/lib/api-config';
import { tutorialVideoService, type TutorialVideoItem } from '@/services/admin/tutorial-video-service';
import { useToast } from './shared/AdminToast';

function toAssetUrl(url?: string) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${BACKEND_URL}${url}`;
}

function captureVideoFirstFrame(file: File): Promise<File | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    const cleanup = () => URL.revokeObjectURL(objectUrl);

    video.onerror = () => {
      cleanup();
      resolve(null);
    };

    video.onloadeddata = () => {
      video.currentTime = 0;
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context || !canvas.width || !canvas.height) {
        cleanup();
        resolve(null);
        return;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        cleanup();
        resolve(blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-cover.jpg`, { type: 'image/jpeg' }) : null);
      }, 'image/jpeg', 0.9);
    };
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const MAX_TUTORIAL_VIDEO_BYTES = 200 * 1024 * 1024;

const TutorialVideoManagement: React.FC = () => {
  const { showToast } = useToast();
  const [videos, setVideos] = useState<TutorialVideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);

  // 新增表单
  const [newTitle, setNewTitle] = useState('');
  const [newVideo, setNewVideo] = useState<File | null>(null);
  const [newCover, setNewCover] = useState<File | null>(null);
  const [newVideoPreview, setNewVideoPreview] = useState<string>('');
  const [newCoverPreview, setNewCoverPreview] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);

  // 编辑状态
  const [editTitles, setEditTitles] = useState<Record<string, string>>({});
  const [editVideos, setEditVideos] = useState<Record<string, File | null>>({});
  const [editCovers, setEditCovers] = useState<Record<string, File | null>>({});
  const [editCoverPreviews, setEditCoverPreviews] = useState<Record<string, string>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const res = await tutorialVideoService.list();
      if (res.success) {
        setVideos(res.data || []);
        setEditTitles(Object.fromEntries((res.data || []).map((item) => [item.id, item.title])));
        setDirtyIds(new Set());
      }
    } catch {
      showToast('加载教程视频失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  // 新增视频预览
  useEffect(() => {
    if (newVideo) {
      const url = URL.createObjectURL(newVideo);
      setNewVideoPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setNewVideoPreview('');
  }, [newVideo]);

  // 新增封面预览
  useEffect(() => {
    if (newCover) {
      const url = URL.createObjectURL(newCover);
      setNewCoverPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setNewCoverPreview('');
  }, [newCover]);

  // 编辑封面预览
  const setEditCover = (id: string, file: File | null) => {
    setEditCovers((prev) => ({ ...prev, [id]: file }));
    setDirtyIds((prev) => new Set(prev).add(id));
    if (file) {
      const url = URL.createObjectURL(file);
      setEditCoverPreviews((prev) => {
        const old = prev[id];
        if (old) URL.revokeObjectURL(old);
        return { ...prev, [id]: url };
      });
    } else {
      setEditCoverPreviews((prev) => {
        const old = prev[id];
        if (old) URL.revokeObjectURL(old);
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const setEditVideo = (id: string, file: File | null) => {
    if (file && file.size > MAX_TUTORIAL_VIDEO_BYTES) {
      showToast('教程视频最大支持 200MB，请压缩后再上传', 'error');
      return;
    }
    setEditVideos((prev) => ({ ...prev, [id]: file }));
    setDirtyIds((prev) => new Set(prev).add(id));
  };

  const setNewTutorialVideo = (file: File | null) => {
    if (file && file.size > MAX_TUTORIAL_VIDEO_BYTES) {
      showToast('教程视频最大支持 200MB，请压缩后再上传', 'error');
      return;
    }
    setNewVideo(file);
  };

  const setEditTitle = (id: string, title: string) => {
    setEditTitles((prev) => ({ ...prev, [id]: title }));
    setDirtyIds((prev) => new Set(prev).add(id));
  };

  const resetAddForm = () => {
    setNewTitle('');
    setNewVideo(null);
    setNewCover(null);
    setNewVideoPreview('');
    setNewCoverPreview('');
    setShowAddForm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return showToast('请输入视频标题', 'error');
    if (!newVideo) return showToast('请选择视频文件', 'error');
    if (newVideo.size > MAX_TUTORIAL_VIDEO_BYTES) return showToast('教程视频最大支持 200MB，请压缩后再上传', 'error');

    try {
      setSaving(true);
      const autoCover = newCover || await captureVideoFirstFrame(newVideo);
      const res = await tutorialVideoService.create({ title: newTitle.trim(), video: newVideo, cover: autoCover });
      if (res.success) {
        resetAddForm();
        await loadVideos();
        showToast('新增视频成功', 'success');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '新增视频失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (item: TutorialVideoItem) => {
    const title = (editTitles[item.id] || '').trim();
    if (!title) return showToast('请输入视频标题', 'error');

    try {
      setSaving(true);
      const selectedVideo = editVideos[item.id];
      const autoCover = editCovers[item.id] || (selectedVideo ? await captureVideoFirstFrame(selectedVideo) : null);
      const res = await tutorialVideoService.update(item.id, {
        title,
        video: selectedVideo,
        cover: autoCover,
      });
      if (res.success) {
        setEditVideos((prev) => ({ ...prev, [item.id]: null }));
        setEditCovers((prev) => ({ ...prev, [item.id]: null }));
        setEditCoverPreviews((prev) => {
          const old = prev[item.id];
          if (old) URL.revokeObjectURL(old);
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        setDirtyIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        await loadVideos();
        showToast('保存成功', 'success');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: TutorialVideoItem) => {
    if (!window.confirm(`确定删除「${item.title}」吗？此操作不可撤销。`)) return;
    try {
      const res = await tutorialVideoService.remove(item.id);
      if (res.success) {
        await loadVideos();
        showToast('删除成功', 'success');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '删除失败', 'error');
    }
  };

  // 排序：上移/下移
  const moveVideo = async (index: number, direction: 'up' | 'down') => {
    if (reordering) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= videos.length) return;

    const newOrder = [...videos];
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setVideos(newOrder);

    try {
      setReordering(true);
      const res = await tutorialVideoService.reorder(newOrder.map((v) => v.id));
      if (!res.success) {
        showToast('排序保存失败，已回滚', 'error');
        await loadVideos();
      }
    } catch {
      showToast('排序保存失败，已回滚', 'error');
      await loadVideos();
    } finally {
      setReordering(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 bg-[#111114] rounded-2xl border border-white/[0.06]">
        <div className="flex h-64 items-center justify-center text-gray-400 gap-3">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-base">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-[#111114] rounded-2xl border border-white/[0.06]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/15 flex items-center justify-center shrink-0">
            <Film className="w-7 h-7 text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">教程视频管理</h2>
            <p className="mt-1 text-base text-gray-400">
              管理前端 /tutorial 页面的教程视频。支持上传视频、设置封面、自定义标题和排序。
              不上传封面时会自动截取视频第一帧作为封面。
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-3">
          <button
            onClick={() => void loadVideos()}
            className="flex items-center gap-2.5 px-4 py-2.5 bg-[#151518] border border-white/[0.06] rounded-xl text-base text-gray-300 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
            disabled={loading || saving}
          >
            <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} /> 刷新
          </button>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-white rounded-xl border border-amber-500/30 transition-all duration-200 shadow-lg shadow-amber-500/10"
          >
            <Plus className="w-5 h-5" /> 新增视频
          </button>
        </div>
      </div>

      {/* 新增视频表单 */}
      {showAddForm && (
        <div className="mb-6 bg-[#151518] rounded-2xl border border-amber-500/20 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-white font-semibold text-lg">
              <Plus className="w-5 h-5 text-amber-400" />
              新增教程视频
            </div>
            <button
              onClick={resetAddForm}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 标题 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">视频标题 <span className="text-red-400">*</span></label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="例如：AICG使用教程 第一集"
              className="w-full px-4 py-3 bg-[#0d0d0d] border border-white/[0.06] rounded-xl text-base text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>

          {/* 视频文件 + 封面 */}
          <div className="grid gap-5 md:grid-cols-2">
            {/* 视频选择 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">视频文件 <span className="text-red-400">*</span></label>
              <label className="flex flex-col items-center justify-center gap-3 px-4 py-8 bg-[#0d0d0d] border border-white/[0.06] rounded-xl cursor-pointer hover:border-amber-500/40 transition-all duration-200">
                {newVideoPreview ? (
                  <div className="w-full">
                    <video src={newVideoPreview} className="w-full max-h-40 rounded-lg object-contain bg-black" muted />
                    <div className="mt-2 flex items-center justify-center gap-2 text-sm text-gray-400">
                      <Video className="w-4 h-4" />
                      <span className="truncate max-w-[180px]">{newVideo?.name}</span>
                      {newVideo && <span className="text-gray-500">({formatBytes(newVideo.size)})</span>}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <Video className="w-6 h-6 text-amber-400" />
                    </div>
                    <span className="text-sm text-gray-400">点击选择视频文件</span>
                    <span className="text-xs text-gray-500">支持 MP4 / WebM 等格式，最大 200MB</span>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => setNewTutorialVideo(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            {/* 封面选择 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">封面图片（可选）</label>
              <label className="flex flex-col items-center justify-center gap-3 px-4 py-8 bg-[#0d0d0d] border border-white/[0.06] rounded-xl cursor-pointer hover:border-amber-500/40 transition-all duration-200">
                {newCoverPreview ? (
                  <div className="w-full">
                    <img src={newCoverPreview} alt="封面预览" className="w-full max-h-40 rounded-lg object-cover bg-black" />
                    <div className="mt-2 flex items-center justify-center gap-2 text-sm text-gray-400">
                      <ImageIcon className="w-4 h-4" />
                      <span className="truncate max-w-[180px]">{newCover?.name}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-blue-400" />
                    </div>
                    <span className="text-sm text-gray-400">点击选择封面图片</span>
                    <span className="text-xs text-gray-500">不上传时自动截取视频第一帧</span>
                  </>
                )}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setNewCover(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !newTitle.trim() || !newVideo}
              className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-white rounded-xl border border-amber-500/30 transition-all duration-200 shadow-lg shadow-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {saving ? '上传中...' : '确认新增'}
            </button>
            <button
              type="button"
              onClick={resetAddForm}
              className="flex items-center gap-2.5 px-5 py-2.5 bg-[#0d0d0d] border border-white/[0.06] rounded-xl text-base text-gray-300 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
            >
              <X className="w-5 h-5" /> 取消
            </button>
          </div>
        </div>
      )}

      {/* 视频列表 */}
      <div className="space-y-4">
        {videos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.1] p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
              <Video className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-base text-gray-400 mb-1">暂无教程视频</p>
            <p className="text-sm text-gray-500">点击右上角「新增视频」按钮上传第一个教程视频</p>
          </div>
        ) : (
          videos.map((item, index) => {
            const isDirty = dirtyIds.has(item.id);
            const coverPreview = editCoverPreviews[item.id];
            const currentCoverUrl = coverPreview || toAssetUrl(item.coverUrl);
            return (
              <div
                key={item.id}
                className={cn(
                  'grid gap-5 rounded-2xl border bg-[#151518] p-5 transition-all duration-200 lg:grid-cols-[300px_1fr]',
                  isDirty ? 'border-amber-500/30 shadow-lg shadow-amber-500/5' : 'border-white/[0.06]'
                )}
              >
                {/* 左侧：视频预览 */}
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-xl bg-black aspect-video relative">
                    <video
                      controls
                      preload="none"
                      poster={currentCoverUrl || undefined}
                      className="aspect-video w-full object-contain"
                    >
                      <source src={toAssetUrl(item.videoUrl)} type="video/mp4" />
                      您的浏览器不支持视频播放
                    </video>
                    {/* 排序序号 */}
                    <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-sm text-sm font-semibold text-amber-400 border border-amber-500/20">
                      #{index + 1}
                    </div>
                  </div>
                  {/* 排序按钮 */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => moveVideo(index, 'up')}
                      disabled={reordering || index === 0}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0d0d0d] border border-white/[0.06] rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/[0.06] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="w-4 h-4" /> 上移
                    </button>
                    <button
                      type="button"
                      onClick={() => moveVideo(index, 'down')}
                      disabled={reordering || index === videos.length - 1}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0d0d0d] border border-white/[0.06] rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/[0.06] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowDown className="w-4 h-4" /> 下移
                    </button>
                  </div>
                </div>

                {/* 右侧：编辑区 */}
                <div className="space-y-4">
                  {/* 时间信息 */}
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Video className="w-4 h-4 text-amber-400" />
                    <span>创建于 {new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                    {isDirty && (
                      <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
                        <AlertCircle className="w-3 h-3" /> 未保存
                      </span>
                    )}
                  </div>

                  {/* 标题编辑 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">视频标题</label>
                    <input
                      value={editTitles[item.id] || ''}
                      onChange={(e) => setEditTitle(item.id, e.target.value)}
                      placeholder="请输入视频标题"
                      className="w-full px-4 py-3 bg-[#0d0d0d] border border-white/[0.06] rounded-xl text-base text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>

                  {/* 更换封面 + 视频 */}
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-gray-300 block">更换封面</span>
                      <div className="flex items-center gap-3">
                        {currentCoverUrl ? (
                          <img src={currentCoverUrl} alt="封面" className="w-20 h-14 rounded-lg object-cover border border-white/[0.06]" />
                        ) : (
                          <div className="w-20 h-14 rounded-lg bg-[#0d0d0d] border border-white/[0.06] flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-gray-500" />
                          </div>
                        )}
                        <label className="cursor-pointer px-3 py-2 bg-[#0d0d0d] border border-white/[0.06] rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/[0.06] transition-all duration-200">
                          选择图片
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => setEditCover(item.id, e.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-gray-300 block">更换视频</span>
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-14 rounded-lg bg-[#0d0d0d] border border-white/[0.06] flex items-center justify-center">
                          <Video className="w-5 h-5 text-gray-500" />
                        </div>
                        <label className="cursor-pointer px-3 py-2 bg-[#0d0d0d] border border-white/[0.06] rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/[0.06] transition-all duration-200">
                          {editVideos[item.id] ? (
                            <span className="flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5 text-green-400" />
                              <span className="truncate max-w-[100px]">{editVideos[item.id]?.name}</span>
                            </span>
                          ) : (
                            '选择视频'
                          )}
                          <input
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => setEditVideo(item.id, e.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                    </label>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleUpdate(item)}
                      disabled={saving || !isDirty}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-white rounded-xl border border-amber-500/30 transition-all duration-200 shadow-lg shadow-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed text-base"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 transition-all duration-200 text-base"
                    >
                      <Trash2 className="w-4 h-4" /> 删除
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 底部提示 */}
      {videos.length > 0 && (
        <div className="mt-6 p-4 bg-[#0d0d0d] rounded-xl border border-white/[0.06]">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-gray-400 space-y-1">
              <p>• 视频顺序即为前端 /tutorial 页面展示顺序，使用「上移/下移」按钮调整。</p>
              <p>• 排序即时保存，修改标题/封面/视频后需点击「保存」按钮。</p>
              <p>• 不上传封面时会自动截取视频第一帧作为封面图。</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorialVideoManagement;
