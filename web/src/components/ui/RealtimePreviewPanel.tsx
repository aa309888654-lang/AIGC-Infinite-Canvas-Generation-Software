import { useState, useMemo } from 'react';
import { 
  Eye, X, Minimize2, Settings, Play, RefreshCw, Monitor, Smartphone,
  Tablet, Image, Video, Wand2, Loader2, Sparkles
} from 'lucide-react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { transformLocalhostUrl } from '@/lib/api-config';

interface RealtimePreviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PreviewSettings {
  showGrid: boolean;
  showAspectRatio: boolean;
  quality: 'low' | 'medium' | 'high';
  devicePreview: 'desktop' | 'tablet' | 'mobile';
}

const ASPECT_RATIOS = {
  '1:1': { width: 512, height: 512, icon: '⬜' },
  '16:9': { width: 640, height: 360, icon: '🖥️' },
  '9:16': { width: 360, height: 640, icon: '📱' },
  '4:3': { width: 512, height: 384, icon: '📐' },
  '3:2': { width: 540, height: 360, icon: '🖼️' },
  '21:9': { width: 672, height: 288, icon: '🎬' },
  '4:5': { width: 480, height: 600, icon: '📸' },
};

const STYLE_CONFIGS: Record<string, { bg: string; accent: string; label: string }> = {
  none: { bg: 'from-gray-700 to-gray-900', accent: '#10B981', label: '基础' },
  realistic: { bg: 'from-amber-700 to-orange-900', accent: '#00E5FF', label: '写实风格' },
  anime: { bg: 'from-pink-600 to-purple-900', accent: '#EC4899', label: '动漫风格' },
  'digital-art': { bg: 'from-cyan-600 to-gray-900', accent: '#06B6D4', label: '数字艺术' },
  'oil-painting': { bg: 'from-yellow-700 to-amber-900', accent: '#D97706', label: '油画风格' },
  watercolor: { bg: 'from-gray-300 to-purple-400', accent: '#818CF8', label: '水彩风格' },
  '3d-render': { bg: 'from-slate-600 to-zinc-800', accent: '#94A3B8', label: '3D渲染' },
  'concept-art': { bg: 'from-emerald-700 to-teal-900', accent: '#10B981', label: '概念艺术' },
  cinematic: { bg: 'from-indigo-900 to-violet-950', accent: '#00E5FF', label: '电影感' },
  cyberpunk: { bg: 'from-cyan-600 to-pink-800', accent: '#22D3EE', label: '赛博朋克' },
  fantasy: { bg: 'from-purple-700 to-fuchsia-900', accent: '#A855F7', label: '奇幻风格' },
  abstract: { bg: 'from-rose-600 to-orange-800', accent: '#F97316', label: '抽象艺术' },
};

const RealtimePreviewPanel = ({ isOpen, onClose }: RealtimePreviewPanelProps) => {
  const { nodes, selectedNodeIds } = useCanvasStore();
  const [isMinimized, setIsMinimized] = useState(false);
  const [settings, setSettings] = useState<PreviewSettings>({
    showGrid: true,
    showAspectRatio: true,
    quality: 'medium',
    devicePreview: 'desktop',
  });
  const [showSettings, setShowSettings] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  const selectedNode = useMemo(() => {
    if (selectedNodeIds.length === 1) {
      return nodes.find(n => n.id === selectedNodeIds[0]);
    }
    return null;
  }, [nodes, selectedNodeIds]);
  
  const nodeParams = useMemo(() => {
    if (!selectedNode) return null;
    const data = selectedNode.data as any;
    const type = data.type as string;
    
    if (type === 'imageGen' || type === 'unifiedImageStudio') {
      return {
        type: 'image' as const,
        prompt: data.params?.prompt || '',
        negativePrompt: data.params?.negativePrompt || '',
        aspectRatio: data.params?.aspectRatio || '1:1',
        style: data.params?.style || 'none',
        model: data.params?.modelProvider || 'doubao',
        quality: data.params?.quality || 'standard',
        resultUrl: data.resultUrl as string || (Array.isArray(data.resultUrls) ? data.resultUrls[0] as string : undefined),
        resultUrls: data.resultUrls as string[] || [],
      };
    }
    
    if (type === 'videoGen') {
      return {
        type: 'video' as const,
        prompt: data.params?.prompt || '',
        resolution: data.params?.resolution || '16:9',
        duration: data.params?.duration || 5,
        model: data.params?.modelProvider || 'doubao',
        resultUrl: (data.task as Record<string, unknown>)?.resultUrl as string || data.resultUrl as string || '',
      };
    }
    
    return null;
  }, [selectedNode]);
  
  const previewConfig = useMemo(() => {
    if (!nodeParams || nodeParams.type !== 'image') return STYLE_CONFIGS['none'];
    return STYLE_CONFIGS[nodeParams.style] || STYLE_CONFIGS['none'];
  }, [nodeParams]);
  
  const aspectConfig = useMemo(() => {
    if (!nodeParams) return ASPECT_RATIOS['1:1'];
    const ratio = nodeParams.aspectRatio || nodeParams.resolution || '1:1';
    return ASPECT_RATIOS[ratio as keyof typeof ASPECT_RATIOS] || ASPECT_RATIOS['1:1'];
  }, [nodeParams]);

  const resolvedResultUrl = useMemo(() => {
    return nodeParams?.resultUrl ? transformLocalhostUrl(nodeParams.resultUrl) : '';
  }, [nodeParams]);
  
  if (!isOpen) return null;
  
  return (
    <div className={`fixed right-4 top-20 z-40 bg-[#1F1F1F]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl transition-all duration-300 ${isMinimized ? 'w-12 h-12' : 'w-96 max-h-[calc(100vh-120px)]'}`}>
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        {!isMinimized ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Eye className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">实时预览</h3>
                <p className="text-xs text-white/50">预览生成效果</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowSettings(!showSettings)} className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-purple-500/20 text-purple-400' : 'hover:bg-white/10 text-white/60'}`} title="设置">
                <Settings className="w-4 h-4" />
              </button>
              <button onClick={() => setIsMinimized(true)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 transition-colors" title="最小化">
                <Minimize2 className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="p-1.5 hover:bg-red-500/20 rounded-lg text-white/60 hover:text-red-400 transition-colors" title="关闭">
                <X className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <button onClick={() => setIsMinimized(false)} className="w-full h-full flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors">
            <Eye className="w-5 h-5 text-purple-400" />
          </button>
        )}
      </div>
      
      {!isMinimized && (
        <>
          {showSettings && (
            <div className="p-3 border-b border-white/10 bg-white/5 space-y-3">
              <div>
                <label className="text-xs text-white/60 mb-1.5 block">设备预览</label>
                <div className="flex gap-1">
                  {[{ id: 'desktop', icon: Monitor, label: '桌面' }, { id: 'tablet', icon: Tablet, label: '平板' }, { id: 'mobile', icon: Smartphone, label: '手机' }].map(device => (
                    <button key={device.id} onClick={() => setSettings(s => ({ ...s, devicePreview: device.id as any }))} className={`flex-1 py-1.5 px-2 rounded-lg text-xs flex items-center justify-center gap-1 transition-colors ${settings.devicePreview === device.id ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
                      <device.icon className="w-3 h-3" />
                      {device.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
                  <input type="checkbox" checked={settings.showGrid} onChange={(e) => setSettings(s => ({ ...s, showGrid: e.target.checked }))} className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-purple-500" />
                  显示网格
                </label>
                <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
                  <input type="checkbox" checked={settings.showAspectRatio} onChange={(e) => setSettings(s => ({ ...s, showAspectRatio: e.target.checked }))} className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-purple-500" />
                  显示比例
                </label>
              </div>
            </div>
          )}
          
          <div className="p-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
            {selectedNode && nodeParams ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${nodeParams.type === 'image' ? 'bg-gradient-to-br from-gray-500 to-cyan-500' : 'bg-gradient-to-br from-purple-500 to-pink-500'}`}>
                    {nodeParams.type === 'image' ? <Image className="w-4 h-4 text-white" /> : <Video className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white/50">当前节点</div>
                    <div className="text-sm text-white font-medium truncate">
                      {(selectedNode.data.type === 'imageGen' || selectedNode.data.type === 'unifiedImageStudio') ? '图片生成' : selectedNode.data.type === 'videoGen' ? '视频生成' : '未知节点'}
                    </div>
                  </div>
                  <div className="text-xs text-white/40 px-2 py-1 bg-white/5 rounded">
                    {aspectConfig.icon} {nodeParams.aspectRatio || nodeParams.resolution}
                  </div>
                </div>
                
                <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10">
                  <div className={`relative bg-gradient-to-br ${previewConfig.bg}`} style={{ aspectRatio: aspectConfig.icon.includes('🖥️') ? '16/9' : aspectConfig.icon.includes('📱') ? '9/16' : aspectConfig.icon.includes('📐') ? '4/3' : '1/1' }}>
                    {settings.showGrid && (
                      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)', backgroundSize: '20% 20%' }} />
                    )}
                    
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      {previewLoading ? (
                        <Loader2 className="w-12 h-12 text-white/50 animate-spin" />
                      ) : resolvedResultUrl ? (
                        <>
                          {nodeParams.type === 'video' ? (
                            <video
                              src={resolvedResultUrl}
                              className="w-full h-full object-cover"
                              controls
                              playsInline
                              preload="metadata"
                            />
                          ) : (
                            <img 
                              src={resolvedResultUrl} 
                              alt="生成结果" 
                              className="w-full h-full object-cover"
                            />
                          )}
                          {nodeParams.type === 'image' && nodeParams.resultUrls.length > 1 && (
                            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white backdrop-blur-sm">
                              1/{nodeParams.resultUrls.length}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: `${previewConfig.accent}20` }}>
                            {nodeParams.type === 'image' ? <Wand2 className="w-8 h-8" style={{ color: previewConfig.accent }} /> : <Play className="w-8 h-8" style={{ color: previewConfig.accent }} />}
                          </div>
                          <div className="text-center px-4">
                            <div className="text-white font-medium mb-1">{previewConfig.label}</div>
                            <div className="text-xs text-white/60">
                              {nodeParams.prompt ? <span className="line-clamp-2">{nodeParams.prompt}</span> : '输入提示词以查看预览'}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    
                    {settings.showAspectRatio && !resolvedResultUrl && (
                      <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 rounded text-xs text-white/80 backdrop-blur-sm">
                        {aspectConfig.width} × {aspectConfig.height}
                      </div>
                    )}
                  </div>
                </div>
                
                {nodeParams.prompt && (
                  <div className="p-3 bg-white/5 rounded-lg">
                    <div className="text-xs text-white/50 mb-1.5">提示词预览</div>
                    <div className="text-sm text-white/90">{nodeParams.prompt}</div>
                  </div>
                )}
                
                {nodeParams.style && nodeParams.style !== 'none' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50">风格:</span>
                    <span className="px-2 py-1 rounded-full text-xs" style={{ backgroundColor: `${previewConfig.accent}20`, color: previewConfig.accent }}>
                      {previewConfig.label}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center gap-3 text-xs text-white/40">
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>{nodeParams.model || 'doubao'}</span>
                  </div>
                  {nodeParams.type === 'video' && <div>{nodeParams.duration || 5}秒</div>}
                  {nodeParams.type === 'image' && <div>{nodeParams.quality || '标准'}</div>}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                  <Eye className="w-8 h-8 text-white/30" />
                </div>
                <div className="text-white/70 mb-1">未选择节点</div>
                <div className="text-xs text-white/40">选择一个生成节点以查看实时预览</div>
              </div>
            )}
          </div>
          
          <div className="p-3 border-t border-white/10 flex items-center gap-2">
            <button onClick={() => setPreviewLoading(true)} disabled={!selectedNode} className="flex-1 py-2 px-3 bg-purple-500 hover:bg-purple-600 disabled:bg-white/5 disabled:text-white/30 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4" />
              刷新预览
            </button>
            <button disabled={!selectedNode || !nodeParams?.prompt} className="flex-1 py-2 px-3 bg-green-500 hover:bg-green-600 disabled:bg-white/5 disabled:text-white/30 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <Play className="w-4 h-4" />
              开始生成
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default RealtimePreviewPanel;
