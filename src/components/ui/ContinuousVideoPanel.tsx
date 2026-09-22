import { useState, useCallback, useEffect, useMemo } from 'react';
import { X, Check, ChevronDown, Trash2, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { continuousVideoService, type ContinuousVideoSession, type ContinuousVideoSegment } from '@/services/continuous-video-service';
import { VIDEO_TEMPLATES, type TemplateItem } from '@/config/prompt-templates';
import { cn } from '@/lib/utils';

interface ContinuousVideoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialStartImage?: string;
  apiKey?: string;
  modelId?: string;
  onComplete?: (session: ContinuousVideoSession) => void;
  sourceImageUrl?: string;
  onSourceImageFromNode?: (imageUrl: string) => void;
}

interface SegmentData {
  prompt: string;
  startImage: string;
  templateName?: string;
}

export const ContinuousVideoPanel = ({
  isOpen,
  onClose,
  initialStartImage,
  apiKey,
  modelId,
  onComplete,
  sourceImageUrl,
  onSourceImageFromNode,
}: ContinuousVideoPanelProps) => {
  const [segments, setSegments] = useState<SegmentData[]>([
    { prompt: '', startImage: initialStartImage || '' },
    { prompt: '', startImage: '' },
  ]);
  const [session, setSession] = useState<ContinuousVideoSession | null>(null);
  const [config, setConfig] = useState({
    duration: 5,
    resolution: '720p',
    generateAudio: false,
    seamless: true,
  });
  const [errors, setErrors] = useState<string[]>([]);
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateVariants, setTemplateVariants] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState<{ [key: number]: boolean }>({});
  const [previews, setPreviews] = useState<{ [key: number]: string }>({});
  
  // 过滤后的模板（搜索功能）
  const filteredCategories = useMemo(() => {
    if (!templateSearch.trim()) {
      return VIDEO_TEMPLATES;
    }
    const searchLower = templateSearch.toLowerCase();
    return VIDEO_TEMPLATES
      .map(category => ({
        ...category,
        templates: category.templates.filter(template =>
          template.name.toLowerCase().includes(searchLower) ||
          template.prompt.toLowerCase().includes(searchLower) ||
          template.tags?.some(tag => tag.toLowerCase().includes(searchLower))
        )
      }))
      .filter(category => category.templates.length > 0);
  }, [templateSearch]);

  useEffect(() => {
    if (initialStartImage && segments[0]) {
      setSegments(prev => [{ ...prev[0], startImage: initialStartImage }, ...prev.slice(1)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStartImage]);

  // 监听来自图片节点的图片URL
  useEffect(() => {
    if (sourceImageUrl && segments[0] && !segments[0].startImage) {
      setSegments(prev => [{ ...prev[0], startImage: sourceImageUrl }, ...prev.slice(1)]);
      // 通知外部图片来源于节点连接
      onSourceImageFromNode?.(sourceImageUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceImageUrl]);

  useEffect(() => {
    if (selectedTemplate) {
      generateTemplateVariants(selectedTemplate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments.length, selectedTemplate, config.duration]);

  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      const updatedSession = continuousVideoService.getSession(session.id);
      if (updatedSession) {
        setSession(updatedSession);
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  const addSegment = useCallback(() => {
    setSegments(prev => [...prev, { prompt: '', startImage: '' }]);
  }, []);

  const clearAllSegments = useCallback(() => {
    setSegments([
      { prompt: '', startImage: sourceImageUrl || '' },
      { prompt: '', startImage: '' },
    ]);
    setSelectedTemplate(null);
    setTemplateVariants([]);
    setPreviews({}); // 清空所有预览
  }, [sourceImageUrl]);

  // 时长估算函数
  const estimateDuration = useCallback((prompt: string, baseDuration: number): number => {
    if (!prompt.trim()) return baseDuration;
    
    // 提示词复杂度分析
    const wordCount = prompt.length;
    const sentenceCount = (prompt.match(/[。！？；\n]/g) || []).length;
    
    // 复杂度评分 (0-1)
    let complexity = 0.5;
    
    // 场景词权重
    const sceneKeywords = ['日出', '日落', '延时', '特写', '远景', '近景', '航拍', '慢动作', '快节奏', '转场'];
    const motionKeywords = ['飞行', '旋转', '移动', '跟随', '环绕', '平移', '推进'];
    const emotionKeywords = ['紧张', '温馨', '浪漫', '悲伤', '欢快', '神秘', '壮观'];
    
    const hasScene = sceneKeywords.some(k => prompt.includes(k));
    const hasMotion = motionKeywords.some(k => prompt.includes(k));
    const hasEmotion = emotionKeywords.some(k => prompt.includes(k));
    
    if (hasScene) complexity += 0.1;
    if (hasMotion) complexity += 0.1;
    if (hasEmotion) complexity += 0.05;
    
    // 句子越多越复杂
    if (sentenceCount > 3) complexity += 0.1;
    if (sentenceCount > 6) complexity += 0.1;
    
    // 字数过多可能需要更长时间展示
    if (wordCount > 100) complexity += 0.1;
    if (wordCount > 200) complexity += 0.1;
    
    complexity = Math.min(complexity, 1);
    
    // 根据复杂度调整时长
    // 简单场景可以稍短，复杂场景建议更长
    let estimatedDuration = baseDuration;
    
    if (complexity > 0.8) {
      estimatedDuration = Math.round(baseDuration * 1.2); // 复杂场景建议更长
    } else if (complexity > 0.6) {
      estimatedDuration = baseDuration;
    } else {
      estimatedDuration = Math.round(baseDuration * 0.9); // 简单场景可以稍短
    }
    
    return Math.max(3, Math.min(estimatedDuration, 15)); // 限制在3-15秒
  }, []);

  // AI预览生成函数
  const generatePreview = useCallback(async (index: number, prompt: string, _startImage?: string) => {
    if (!prompt.trim()) return;
    
    setPreviewLoading(prev => ({ ...prev, [index]: true }));
    
    try {
      // 这里应该调用AI图像生成API
      // 暂时使用模拟的预览生成
      // 实际项目中需要接入 MiniMax 或其他图像生成服务
      
      // 模拟API调用延迟
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 构造预览提示词 - 将视频提示词转换为静态图像提示
      const _imagePrompt = `${prompt}，电影风格，高质量，4K`;
      
      // 模拟生成一个预览URL（实际项目中这里应该是API返回的图片URL）
      // 使用 picsum.photos 作为占位图，实际项目中替换为真实AI生成的图片
      const mockPreviewUrl = `https://picsum.photos/seed/${Date.now()}/320/180`;
      
      setPreviews(prev => ({ ...prev, [index]: mockPreviewUrl }));
      
      // console.log('预览生成成功:', { index, prompt: imagePrompt });
    } catch (error) {
      console.error('预览生成失败:', error);
    } finally {
      setPreviewLoading(prev => ({ ...prev, [index]: false }));
    }
  }, []);

  const removeSegment = useCallback((index: number) => {
    if (segments.length <= 1) return;
    setSegments(prev => prev.filter((_, i) => i !== index));
  }, [segments.length]);

  const updateSegment = useCallback((index: number, field: 'prompt' | 'startImage', value: string) => {
    setSegments(prev => prev.map((seg, i) => i === index ? { ...seg, [field]: value } : seg));
    // 当提示词改变时，清除对应片段的预览
    if (field === 'prompt') {
      setPreviews(prev => {
        const newPreviews = { ...prev };
        delete newPreviews[index];
        return newPreviews;
      });
    }
  }, []);

  const generateTemplateVariants = useCallback((template: TemplateItem) => {
    const variants: string[] = [];
    const segmentCount = segments.length;

    for (let i = 0; i < segmentCount; i++) {
      const motionDescriptions = [
        '开场，缓缓推进镜头',
        '承接前段，镜头平稳移动',
        '过渡场景，镜头缓慢摇移',
        '收尾，镜头逐渐拉远'
      ];
      
      const sceneDescriptions = [
        '故事的开端',
        '情节的展开',
        '高潮部分',
        '故事的尾声'
      ];

      const isFirst = i === 0;
      const isLast = i === segmentCount - 1;
      const motion = motionDescriptions[Math.min(i, motionDescriptions.length - 1)];
      const scene = sceneDescriptions[Math.min(i, sceneDescriptions.length - 1)];

      let variant = template.prompt
        .replace('{subject}', isFirst ? '故事开场，场景展现' : isLast ? '故事高潮，精彩瞬间' : '情节推进，场景延续')
        .replace('{motion}', motion)
        .replace('{duration}', String(config.duration || 5))
        .replace('{style}', '连贯流畅')
        .replace('{lighting}', '自然过渡');

      if (segmentCount > 1) {
        variant = `[片段${i + 1}/${segmentCount}] ${scene}，${variant}`;
      }

      variants.push(variant);
    }

    setTemplateVariants(variants);
  }, [segments.length, config.duration]);

  const applyTemplate = useCallback((template: TemplateItem) => {
    setSelectedTemplate(template);
    
    const variants: string[] = [];
    const segmentCount = segments.length;

    for (let i = 0; i < segmentCount; i++) {
      const motionDescriptions = [
        '开场，缓缓推进镜头',
        '承接前段，镜头平稳移动',
        '过渡场景，镜头缓慢摇移',
        '收尾，镜头逐渐拉远'
      ];
      
      const sceneDescriptions = [
        '故事的开端',
        '情节的展开',
        '高潮部分',
        '故事的尾声'
      ];

      const isFirst = i === 0;
      const isLast = i === segmentCount - 1;
      const motion = motionDescriptions[Math.min(i, motionDescriptions.length - 1)];
      const scene = sceneDescriptions[Math.min(i, sceneDescriptions.length - 1)];

      let variant = template.prompt
        .replace('{subject}', isFirst ? '故事开场，场景展现' : isLast ? '故事高潮，精彩瞬间' : '情节推进，场景延续')
        .replace('{motion}', motion)
        .replace('{duration}', String(config.duration || 5))
        .replace('{style}', '连贯流畅')
        .replace('{lighting}', '自然过渡');

      if (segmentCount > 1) {
        variant = `[片段${i + 1}/${segmentCount}] ${scene}，${variant}`;
      }

      variants.push(variant);
    }

    setTemplateVariants(variants);
    setShowTemplatePanel(false);
  }, [segments.length, config.duration]);

  const confirmApplyTemplate = useCallback(() => {
    if (templateVariants.length > 0) {
      setSegments(prev => prev.map((seg, i) => ({
        ...seg,
        prompt: templateVariants[i] || seg.prompt,
        templateName: selectedTemplate?.name
      })));
    }
  }, [templateVariants, selectedTemplate]);

  const clearTemplate = useCallback(() => {
    setSelectedTemplate(null);
    setTemplateVariants([]);
    setSelectedCategory(null);
    setSegments(prev => prev.map(seg => ({
      ...seg,
      templateName: undefined
    })));
  }, []);

  const currentCategoryTemplates = useMemo(() => {
    if (!selectedCategory) return [];
    const category = VIDEO_TEMPLATES.find(cat => cat.id === selectedCategory);
    return category?.templates || [];
  }, [selectedCategory]);

  const validate = useCallback((): boolean => {
    const newErrors: string[] = [];

    if (!apiKey) {
      newErrors.push('请先在设置中配置 API Key');
    }

    if (segments.some(s => !s.prompt.trim())) {
      newErrors.push('请为每个片段输入提示词');
    }

    if (segments[0] && !segments[0].startImage) {
      newErrors.push('请为第一个片段提供首帧图片');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  }, [segments, apiKey]);

  const startGeneration = useCallback(async () => {
    if (!validate()) return;
    if (!apiKey) return;

    try {
      continuousVideoService.setAdapterWithConfig(apiKey, modelId);

      const newSession = continuousVideoService.createSession({
        totalSegments: segments.length,
        duration: config.duration,
        resolution: config.resolution,
        generateAudio: config.generateAudio,
        seamless: config.seamless,
      });

      setSession(newSession);

      await continuousVideoService.startGeneration(
        newSession.id,
        segments.map(s => s.prompt),
        segments.map(s => s.startImage),
        {
          onSegmentComplete: (segment, updatedSession) => {
            setSession(updatedSession);
            if (segment.segmentIndex === 0 && segment.videoUrl) {
              setSegments(prev => prev.map((s, i) => i === 1 ? { ...s, startImage: segment.videoUrl! } : s));
            }
          },
          onSessionComplete: (completedSession) => {
            setSession(completedSession);
            onComplete?.(completedSession);
          },
          onError: (error, errorSession) => {
            setSession(errorSession);
            setErrors(prev => [...prev, `生成失败: ${error.message}`]);
          },
        }
      );
    } catch (error) {
      setErrors(prev => [...prev, error instanceof Error ? error.message : '未知错误']);
    }
  }, [segments, config, apiKey, modelId, validate, onComplete]);

  const cancelGeneration = useCallback(() => {
    if (session) {
      continuousVideoService.cancelSession(session.id);
      setSession(null);
    }
  }, [session]);

  const getSegmentStatusIcon = (segment: ContinuousVideoSegment) => {
    switch (segment.status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-white/30" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1F1F1F] rounded-2xl border border-white/10 w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div>
            <h2 className="text-base font-medium text-white">视频合成</h2>
            <p className="text-xs text-white/50 mt-0.5">首尾帧自动连接</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-1">
              {errors.map((error, i) => (
                <div key={i} className="text-red-400 text-xs flex items-start gap-2">
                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              ))}
            </div>
          )}

          {!session && (
            <div className="bg-[#2A2A2A] rounded-lg p-3 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div>
                    <h3 className="text-white font-medium text-xs">智能模板</h3>
                    <p className="text-[10px] text-white/50">自动生成 {segments.length} 个片段</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedTemplate && (
                    <button
                      onClick={clearTemplate}
                      className="px-2 py-0.5 text-[10px] text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors"
                    >
                      清除
                    </button>
                  )}
                  <button
                    onClick={() => setShowTemplatePanel(!showTemplatePanel)}
                    className="px-2 py-0.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded text-purple-300 text-[10px] transition-colors"
                  >
                    选择模板
                    <ChevronDown className={cn("w-2.5 h-2.5 ml-0.5 inline transition-transform", showTemplatePanel && "rotate-180")} />
                  </button>
                </div>
              </div>

              {showTemplatePanel && (
                <div className="bg-[#1F1F1F] rounded-lg p-2 border border-white/10">
                  {/* 搜索框 */}
                  <div className="mb-2">
                    <input
                      type="text"
                      value={templateSearch}
                      onChange={(e) => {
                        setTemplateSearch(e.target.value);
                        if (e.target.value) {
                          setSelectedCategory(null);
                        }
                      }}
                      placeholder="搜索模板..."
                      className="w-full px-2 py-1 bg-[#2A2A2A] border border-white/10 rounded text-white text-[10px] placeholder-white/40 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  
                  {/* 分类网格 */}
                  {!templateSearch && (
                    <div className="grid grid-cols-3 gap-1.5 mb-2">
                      {VIDEO_TEMPLATES.map(category => (
                        <button
                          key={category.id}
                          onClick={() => setSelectedCategory(category.id)}
                          className={cn(
                            "p-1.5 rounded border transition-all text-left",
                            selectedCategory === category.id
                              ? "bg-purple-500/20 border-purple-500/50"
                              : "bg-white/5 border-white/10 hover:bg-white/10"
                          )}
                        >
                          <div className="text-[11px] text-white/80 font-medium">{category.category}</div>
                          <div className="text-[10px] text-white/50">{category.templates.length} 个</div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 搜索结果或分类模板 */}
                  {selectedCategory || templateSearch ? (
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-white/60 flex items-center justify-between">
                        <span>
                          {templateSearch ? '搜索结果' : '选择'}: <span className="text-purple-400 font-medium">
                            {templateSearch ? `"${templateSearch}"` : VIDEO_TEMPLATES.find(c => c.id === selectedCategory)?.category}
                          </span>
                        </span>
                        {filteredCategories.length === 0 && templateSearch && (
                          <span className="text-white/40">无结果</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                        {(templateSearch ? filteredCategories.flatMap(c => c.templates) : currentCategoryTemplates).map(template => (
                          <button
                            key={template.id}
                            onClick={() => applyTemplate(template)}
                            className={cn(
                              "p-1.5 rounded border transition-all text-left",
                              selectedTemplate?.id === template.id
                                ? "bg-purple-500/20 border-purple-500/50"
                                : "bg-white/5 border-white/10 hover:bg-purple-500/20 hover:border-purple-500/30"
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <span className="text-[10px] text-white font-medium">{template.name}</span>
                              {selectedTemplate?.id === template.id && (
                                <Check className="w-2.5 h-2.5 text-purple-400 flex-shrink-0" />
                              )}
                            </div>
                            {template.description && (
                              <p className="text-[9px] text-white/40 line-clamp-1 mt-0.5">{template.description}</p>
                            )}
                            {templateSearch && (
                              <p className="text-[8px] text-purple-400/60 mt-0.5">{VIDEO_TEMPLATES.find(c => c.templates.some(t => t.id === template.id))?.category}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {selectedTemplate && templateVariants.length > 0 && !showTemplatePanel && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[10px] text-white/60">
                      已选择: <span className="text-purple-400">{selectedTemplate.name}</span>
                    </div>
                    <button
                      onClick={confirmApplyTemplate}
                      className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 rounded text-white text-[10px] font-medium transition-opacity"
                    >
                      应用到片段
                    </button>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {templateVariants.map((variant, i) => (
                      <div
                        key={i}
                        className="bg-white/5 rounded p-1.5 border border-white/10"
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <div className="w-4 h-4 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] text-purple-400 font-medium">
                            {i + 1}
                          </div>
                          <span className="text-[10px] text-purple-300">片段 {i + 1}</span>
                        </div>
                        <p className="text-[10px] text-white/70 leading-relaxed">{variant}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-[#2A2A2A] rounded-lg p-3 border border-white/10">
            <h3 className="text-white font-medium mb-2 text-sm">生成配置</h3>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">时长</label>
                <select
                  value={config.duration}
                  onChange={(e) => setConfig(c => ({ ...c, duration: Number(e.target.value) }))}
                  disabled={session?.status === 'running'}
                  className="w-full px-2 py-1.5 bg-[#1F1F1F] border border-white/10 rounded text-white text-xs disabled:opacity-50"
                >
                  <option value={2}>2秒</option>
                  <option value={5}>5秒</option>
                  <option value={10}>10秒</option>
                  <option value={12}>12秒</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">分辨率</label>
                <select
                  value={config.resolution}
                  onChange={(e) => setConfig(c => ({ ...c, resolution: e.target.value }))}
                  disabled={session?.status === 'running'}
                  className="w-full px-2 py-1.5 bg-[#1F1F1F] border border-white/10 rounded text-white text-xs disabled:opacity-50"
                >
                  <option value="480p">480p</option>
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">音频</label>
                <select
                  value={config.generateAudio ? 'true' : 'false'}
                  onChange={(e) => setConfig(c => ({ ...c, generateAudio: e.target.value === 'true' }))}
                  disabled={session?.status === 'running'}
                  className="w-full px-2 py-1.5 bg-[#1F1F1F] border border-white/10 rounded text-white text-xs disabled:opacity-50"
                >
                  <option value="false">不生成</option>
                  <option value="true">生成音频</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">自动连接</label>
                <select
                  value={config.seamless ? 'true' : 'false'}
                  onChange={(e) => setConfig(c => ({ ...c, seamless: e.target.value === 'true' }))}
                  disabled={session?.status === 'running'}
                  className="w-full px-2 py-1.5 bg-[#1F1F1F] border border-white/10 rounded text-white text-xs disabled:opacity-50"
                >
                  <option value="true">启用</option>
                  <option value="false">禁用</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-medium text-sm">视频片段</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearAllSegments}
                  disabled={session?.status === 'running'}
                  className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white/60 disabled:opacity-50 transition-colors"
                  title="清空所有片段"
                >
                  清空
                </button>
                <button
                  onClick={addSegment}
                  disabled={session?.status === 'running'}
                  className="px-2 py-1 text-xs bg-[#4B21FF]/20 hover:bg-[#4B21FF]/30 border border-[#4B21FF]/30 rounded text-[#A78BFA] disabled:opacity-50 transition-colors"
                >
                  + 添加片段
                </button>
              </div>
            </div>

            {segments.map((segment, index) => (
              <div key={index} className="bg-[#2A2A2A] rounded-lg p-3 border border-white/10 relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                      session?.segments[index]?.status === 'completed' && 'bg-green-500/20 text-green-400',
                      session?.segments[index]?.status === 'processing' && 'bg-gray-500/20 text-gray-400',
                      session?.segments[index]?.status === 'pending' && 'bg-white/10 text-white/60',
                      session?.segments[index]?.status === 'failed' && 'bg-red-500/20 text-red-400',
                      !session?.segments[index] && 'bg-white/10 text-white/60'
                    )}>
                      {session?.segments[index] ? (
                        getSegmentStatusIcon(session.segments[index])
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm">片段 {index + 1}</span>
                      <span className="text-[10px] text-purple-400/70">
                        (~{estimateDuration(segment.prompt, config.duration)}s)
                      </span>
                      {segment.templateName && (
                        <span className="text-xs text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                          {segment.templateName}
                        </span>
                      )}
                      {session?.segments[index] && (
                        <span className={cn(
                          'text-xs',
                          session.segments[index].status === 'completed' && 'text-green-400',
                          session.segments[index].status === 'processing' && 'text-gray-400',
                          session.segments[index].status === 'pending' && 'text-white/40',
                          session.segments[index].status === 'failed' && 'text-red-400',
                        )}>
                          {session.segments[index].status === 'completed' && '✓'}
                          {session.segments[index].status === 'processing' && '⏳'}
                          {session.segments[index].status === 'pending' && '○'}
                          {session.segments[index].status === 'failed' && '✗'}
                        </span>
                      )}
                    </div>
                  </div>
                  {segments.length > 1 && !session && (
                    <button
                      onClick={() => removeSegment(index)}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  )}
                </div>

                {index > 0 && config.seamless && (
                  <div className="mb-2 flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded">
                    <span>自动连接首尾帧</span>
                  </div>
                )}

                {index === 0 && (
                  <div className="mb-2">
                    <label className="text-[10px] text-white/50 mb-1 block flex items-center justify-between">
                      <span>
                        首帧图片 {segment.startImage && <span className="text-purple-400">(已连接节点)</span>}
                      </span>
                      {sourceImageUrl && (
                        <button
                          onClick={() => {
                            setSegments(prev => [{ ...prev[0], startImage: sourceImageUrl }, ...prev.slice(1)]);
                          }}
                          className="text-[9px] text-purple-400 hover:text-purple-300 ml-2"
                          title="刷新图片"
                        >
                          刷新
                        </button>
                      )}
                    </label>
                    <input
                      type="text"
                      value={segment.startImage}
                      onChange={(e) => updateSegment(index, 'startImage', e.target.value)}
                      placeholder="输入图片URL或连接图片节点..."
                      disabled={session?.status === 'running'}
                      className="w-full px-2 py-1 bg-[#1F1F1F] border border-white/10 rounded text-white text-[10px] placeholder-white/40 focus:outline-none focus:border-[#4B21FF] disabled:opacity-50"
                    />
                    {!segment.startImage && (
                      <p className="text-[9px] text-white/40 mt-0.5">
                        连接图片节点可自动获取首帧图片
                      </p>
                    )}
                  </div>
                )}

                {segment.startImage && index === 0 && (
                  <div className="mb-2 flex items-center gap-2">
                    <img
                      src={segment.startImage}
                      alt="首帧预览"
                      className="w-14 h-14 object-cover rounded border border-white/10"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="text-[10px] text-white/50">
                      <p>首帧预览</p>
                      <p className="mt-0.5">建议: 16:9 或 9:16</p>
                    </div>
                  </div>
                )}

                {index > 0 && segment.startImage && (
                  <div className="mb-2 flex items-center gap-2 bg-purple-500/10 px-1.5 py-1 rounded">
                    <img
                      src={segment.startImage}
                      alt="自动首帧"
                      className="w-10 h-10 object-cover rounded border border-purple-500/30"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="text-[10px] text-purple-400">
                      <p>自动继承尾帧</p>
                      {session?.segments[index - 1]?.videoUrl && (
                        <p className="text-white/50 mt-0.5">来源: 片段 {index}</p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs text-white/50 mb-1 flex items-center justify-between">
                    <span>提示词</span>
                    <span className="text-[10px] text-white/40">
                      {segment.prompt.length}/500
                    </span>
                  </label>
                  <textarea
                    value={segment.prompt}
                    onChange={(e) => updateSegment(index, 'prompt', e.target.value)}
                    placeholder={`描述片段 ${index + 1}...`}
                    disabled={session?.status === 'running'}
                    maxLength={500}
                    className="w-full h-16 px-2 py-1.5 bg-[#1F1F1F] border border-white/10 rounded text-white text-xs placeholder-white/40 focus:outline-none focus:border-[#4B21FF] resize-none disabled:opacity-50"
                  />
                </div>

                {/* 时长估算和预览 */}
                <div className="mt-2 space-y-2">
                  {/* 时长估算 */}
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="text-white/50">预估时长:</span>
                      <span className="text-purple-400 font-medium">
                        ~{estimateDuration(segment.prompt, config.duration)}秒
                      </span>
                      {segment.prompt.length > 0 && segment.prompt.length < 20 && (
                        <span className="text-yellow-400/60 text-[9px]">
                          (建议完善提示词)
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => generatePreview(index, segment.prompt, segment.startImage)}
                      disabled={!segment.prompt.trim() || previewLoading[index] || session?.status === 'running'}
                      className="px-2 py-0.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded text-purple-300 text-[10px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    >
                      {previewLoading[index] ? (
                        <>
                          <div className="w-2 h-2 border border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                          生成中
                        </>
                      ) : (
                        <>
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          AI预览
                        </>
                      )}
                    </button>
                  </div>

                  {/* 预览图片 */}
                  {previews[index] && (
                    <div className="relative group">
                      <img
                        src={previews[index]}
                        alt={`片段 ${index + 1} 预览`}
                        className="w-full h-20 object-cover rounded border border-purple-500/30"
                      />
                      <button
                        onClick={() => setPreviews(prev => {
                          const newPreviews = { ...prev };
                          delete newPreviews[index];
                          return newPreviews;
                        })}
                        className="absolute top-1 right-1 w-4 h-4 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="清除预览"
                      >
                        <span className="text-white text-[8px]">×</span>
                      </button>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                        <span className="text-white text-[10px]">预览效果</span>
                      </div>
                    </div>
                  )}
                </div>

                {session?.segments[index]?.videoUrl && (
                  <div className="mt-2 flex items-center gap-2 bg-green-500/10 px-2 py-1.5 rounded">
                    <a
                      href={session.segments[index].videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-400 text-xs hover:underline"
                    >
                      查看视频
                    </a>
                  </div>
                )}

                {session?.segments[index]?.error && (
                  <div className="mt-2 bg-red-500/10 px-2 py-1.5 rounded">
                    <p className="text-red-400 text-xs">{session.segments[index].error}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {session?.status === 'completed' && session.finalVideoUrls.length > 0 && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <h3 className="text-green-400 font-medium mb-2 text-sm">生成完成！</h3>
              <div className="grid grid-cols-2 gap-2">
                {session.finalVideoUrls.map((url, i) => (
                  <div key={i} className="bg-[#1F1F1F] rounded p-2">
                    <span className="text-xs text-white/50 mb-0.5 block">片段 {i + 1}</span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 text-xs hover:underline"
                    >
                      打开视频
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between bg-white/5">
          <div className="text-xs text-white/50">
            共 {segments.length} 个片段 · 总计约 ~{segments.reduce((sum, seg) => sum + estimateDuration(seg.prompt, config.duration), 0)}秒
            {session?.status === 'running' && (
              <span className="ml-1 text-gray-400">
                · 正在生成 {session.currentSegmentIndex + 1}
              </span>
            )}
            {session?.status === 'completed' && (
              <span className="ml-1 text-green-400">
                · 已完成 {session.segments.filter(s => s.status === 'completed').length} 个
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {session?.status === 'running' ? (
              <>
                <button
                  onClick={cancelGeneration}
                  className="px-3 py-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors text-sm"
                >
                  取消
                </button>
                <button
                  disabled
                  className="px-4 py-1.5 bg-[#4B21FF]/50 rounded text-white/50 text-sm"
                >
                  生成中...
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors text-sm"
                >
                  取消
                </button>
                <button
                  onClick={startGeneration}
                  disabled={!apiKey}
                  className="px-4 py-1.5 bg-gradient-to-r from-[#4B21FF] to-[#AF52DE] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white font-medium transition-opacity text-sm"
                >
                  开始生成
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContinuousVideoPanel;
