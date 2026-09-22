import React, { useCallback } from 'react';
import { Upload, Film, Music, Settings, Play, Loader2, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { useOneClickVideoStore } from '@/store/useOneClickVideoStore';
import { ONE_CLICK_TEMPLATES, BGM_LIBRARY } from '@/data/one-click-templates';
import { cn } from '@/lib/utils';

const OneClickVideoPanel: React.FC = () => {
  const {
    sourceImage, selectedTemplateId, segments, selectedBgm,
    isGenerating, isComposing, composeProgress, composeResultUrl,
    setSourceImage, setSelectedTemplateId, setEditedPrompt,
    setSegments, updateSegment, setSelectedBgm,
    setComposeSettings, setIsGenerating, setIsComposing,
    setComposeProgress, setComposeResultUrl, reset,
  } = useOneClickVideoStore();

  const selectedTemplate = ONE_CLICK_TEMPLATES.find((t) => t.id === selectedTemplateId);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSourceImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, [setSourceImage]);

  const handleTemplateSelect = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = ONE_CLICK_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      const newSegments = template.segments.map((seg) => ({
        index: seg.index,
        duration: seg.duration,
        prompt: seg.promptTemplate.replace('{userPrompt}', ''),
        status: 'idle' as const,
      }));
      setSegments(newSegments);
    }
  }, [setSelectedTemplateId, setSegments]);

  const handlePromptChange = useCallback((index: number, userPrompt: string) => {
    setEditedPrompt(index, userPrompt);
    const template = ONE_CLICK_TEMPLATES.find((t) => t.id === selectedTemplateId);
    if (template) {
      const seg = template.segments[index];
      const fullPrompt = seg.promptTemplate.replace('{userPrompt}', userPrompt);
      updateSegment(index, { prompt: fullPrompt });
    }
  }, [selectedTemplateId, setEditedPrompt, updateSegment]);

  const handleGenerate = useCallback(async () => {
    if (!sourceImage || !selectedTemplateId) return;
    setIsGenerating(true);
    const template = ONE_CLICK_TEMPLATES.find((t) => t.id === selectedTemplateId);
    if (!template) return;

    for (let i = 0; i < segments.length; i++) {
      updateSegment(i, { status: 'generating' });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      updateSegment(i, { status: 'done', videoUrl: `/placeholder-video-${i}.mp4` });
    }
    setIsGenerating(false);
  }, [sourceImage, selectedTemplateId, segments, setIsGenerating, updateSegment]);

  const handleCompose = useCallback(async () => {
    setIsComposing(true);
    setComposeProgress(0);
    for (let i = 0; i <= 100; i += 5) {
      setComposeProgress(i);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    setComposeResultUrl('/placeholder-composed.mp4');
    setIsComposing(false);
  }, [setIsComposing, setComposeProgress, setComposeResultUrl]);

  const allSegmentsDone = segments.length > 0 && segments.every((s) => s.status === 'done');
  const canGenerate = sourceImage && selectedTemplateId && !isGenerating;
  const canCompose = allSegmentsDone && selectedBgm && !isComposing;

  return (
    <div className="flex h-full gap-4 p-4">
      {/* 左栏 - 输入区 */}
      <div className="w-72 shrink-0 space-y-4 overflow-y-auto">
        {/* 图片上传 */}
        <div className="rounded-xl border border-gray-800 bg-gray-950/80 p-4">
          <h3 className="text-sm font-medium text-gray-100 mb-3 flex items-center gap-2">
            <Upload className="w-4 h-4" /> 上传图片
          </h3>
          {sourceImage ? (
            <div className="relative group">
              <img src={sourceImage} alt="source" className="w-full rounded-lg object-cover aspect-video" />
              <button
                onClick={() => setSourceImage(null)}
                className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-blue-500/50 transition-colors">
              <Upload className="w-8 h-8 text-gray-500 mb-2" />
              <span className="text-xs text-gray-500">点击或拖拽上传图片</span>
              <span className="text-[10px] text-gray-600 mt-1">JPG / PNG / WebP</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          )}
        </div>

        {/* 模板选择 */}
        <div className="rounded-xl border border-gray-800 bg-gray-950/80 p-4">
          <h3 className="text-sm font-medium text-gray-100 mb-3 flex items-center gap-2">
            <Film className="w-4 h-4" /> 选择模板
          </h3>
          <div className="space-y-2">
            {ONE_CLICK_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template.id)}
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg text-left transition-all border',
                  selectedTemplateId === template.id
                    ? 'bg-blue-500/15 border-blue-500/40 text-gray-100'
                    : 'bg-gray-900 border-gray-800 text-gray-300 hover:border-blue-500/30'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{template.icon}</span>
                  <div>
                    <div className="text-xs font-medium">{template.name}</div>
                    <div className="text-[10px] text-gray-500">{template.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 提示词编辑 */}
        {selectedTemplate && (
          <div className="rounded-xl border border-gray-800 bg-gray-950/80 p-4">
            <h3 className="text-sm font-medium text-gray-100 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> 编辑提示词
            </h3>
            <div className="space-y-3">
              {selectedTemplate.segments.map((seg, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">
                      片段 {idx + 1} · {seg.cameraMovement} · {seg.duration}s
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="描述画面内容..."
                    value={useOneClickVideoStore.getState().editedPrompts[idx] || ''}
                    onChange={(e) => handlePromptChange(idx, e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 生成按钮 */}
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={cn(
            'w-full py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2',
            canGenerate
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> 生成中...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> 生成视频
            </>
          )}
        </button>
      </div>

      {/* 中栏 - 预览区 */}
      <div className="flex-1 space-y-4 overflow-y-auto">
        {/* 视频片段列表 */}
        <div className="rounded-xl border border-gray-800 bg-gray-950/80 p-4">
          <h3 className="text-sm font-medium text-gray-100 mb-3">视频片段</h3>
          {segments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Film className="w-10 h-10 mb-2 opacity-30" />
              <span className="text-xs">选择模板后显示视频片段</span>
            </div>
          ) : (
            <div className="space-y-2">
              {segments.map((seg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-all',
                    seg.status === 'done' ? 'border-green-500/30 bg-green-500/5' :
                    seg.status === 'generating' ? 'border-blue-500/30 bg-blue-500/5' :
                    seg.status === 'failed' ? 'border-red-500/30 bg-red-500/5' :
                    'border-gray-800 bg-gray-900/50'
                  )}
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-200 truncate">
                      片段 {idx + 1} · {seg.duration}s
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">{seg.prompt}</div>
                  </div>
                  <div className="shrink-0">
                    {seg.status === 'idle' && <span className="text-[10px] text-gray-500">等待</span>}
                    {seg.status === 'generating' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                    {seg.status === 'done' && <CheckCircle className="w-4 h-4 text-green-400" />}
                    {seg.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 时间线预览 */}
        {segments.length > 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-950/80 p-4">
            <h3 className="text-sm font-medium text-gray-100 mb-3">时间线</h3>
            <div className="flex gap-0.5 h-10">
              {segments.map((seg, idx) => {
                const widthPercent = (seg.duration / 30) * 100;
                return (
                  <div
                    key={idx}
                    className={cn(
                      'rounded flex items-center justify-center text-[10px] font-medium transition-all',
                      seg.status === 'done' ? 'bg-green-500/30 text-green-300' :
                      seg.status === 'generating' ? 'bg-blue-500/30 text-blue-300 animate-pulse' :
                      'bg-gray-800 text-gray-500'
                    )}
                    style={{ width: `${widthPercent}%` }}
                  >
                    {seg.duration}s
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-600">0s</span>
              <span className="text-[10px] text-gray-600">30s</span>
            </div>
          </div>
        )}

        {/* 合成结果 */}
        {composeResultUrl && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
            <h3 className="text-sm font-medium text-green-300 mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> 合成完成
            </h3>
            <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
              <Play className="w-12 h-12 text-white/50" />
            </div>
          </div>
        )}
      </div>

      {/* 右栏 - 音乐与合成 */}
      <div className="w-72 shrink-0 space-y-4 overflow-y-auto">
        {/* 音乐选择 */}
        <div className="rounded-xl border border-gray-800 bg-gray-950/80 p-4">
          <h3 className="text-sm font-medium text-gray-100 mb-3 flex items-center gap-2">
            <Music className="w-4 h-4" /> 背景音乐
          </h3>

          {/* 预设音乐库 */}
          <div className="space-y-1.5">
            <div className="text-[10px] text-gray-500 mb-1">预设音乐库</div>
            {BGM_LIBRARY.map((track) => (
              <button
                key={track.id}
                onClick={() => setSelectedBgm(track)}
                className={cn(
                  'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all border',
                  selectedBgm?.id === track.id
                    ? 'bg-blue-500/15 border-blue-500/40'
                    : 'bg-gray-900 border-gray-800 hover:border-blue-500/30'
                )}
              >
                <Music className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-gray-200 truncate">{track.name}</div>
                  <div className="text-[9px] text-gray-600">{track.style} · {track.duration}s</div>
                </div>
              </button>
            ))}
          </div>

          {/* AI生成音乐 */}
          <div className="mt-3 pt-3 border-t border-gray-800">
            <div className="text-[10px] text-gray-500 mb-1.5">AI 生成音乐</div>
            <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-dashed border-gray-700 text-gray-400 hover:border-blue-500/50 hover:text-blue-400 transition-all">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-[11px]">AI 生成背景音乐</span>
            </button>
          </div>
        </div>

        {/* 合成设置 */}
        <div className="rounded-xl border border-gray-800 bg-gray-950/80 p-4">
          <h3 className="text-sm font-medium text-gray-100 mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4" /> 合成设置
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-gray-400">分辨率</label>
              <div className="flex gap-1.5 mt-1">
                {(['720p', '1080p'] as const).map((res) => (
                  <button
                    key={res}
                    onClick={() => setComposeSettings({ resolution: res })}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all border',
                      useOneClickVideoStore.getState().composeSettings.resolution === res
                        ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                        : 'bg-gray-900 border-gray-800 text-gray-400'
                    )}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-400">帧率</label>
              <div className="flex gap-1.5 mt-1">
                {([24, 30] as const).map((fps) => (
                  <button
                    key={fps}
                    onClick={() => setComposeSettings({ fps })}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all border',
                      useOneClickVideoStore.getState().composeSettings.fps === fps
                        ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                        : 'bg-gray-900 border-gray-800 text-gray-400'
                    )}
                  >
                    {fps}fps
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-400">BGM音量</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                defaultValue={0.7}
                onChange={(e) => setComposeSettings({ bgmVolume: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 mt-1"
              />
            </div>
          </div>
        </div>

        {/* 合成按钮 */}
        <button
          onClick={handleCompose}
          disabled={!canCompose}
          className={cn(
            'w-full py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2',
            canCompose
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          )}
        >
          {isComposing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> 合成中 {composeProgress}%
            </>
          ) : (
            <>
              <Play className="w-4 h-4" /> 合成视频
            </>
          )}
        </button>

        {/* 重置 */}
        <button
          onClick={reset}
          className="w-full py-2 rounded-xl text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          重置
        </button>
      </div>
    </div>
  );
};

export default OneClickVideoPanel;
