import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Type, Image as ImageIcon, Mic, Upload, X, Check, AlertCircle, Sparkles, Camera, Volume2, Palette, Link2, RotateCcw, ZoomIn, Grid3X3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MultimodalContent {
  type: 'text' | 'image' | 'voice' | 'reference' | 'sketch';
  data: string;
  metadata?: Record<string, unknown>;
}

interface MultimodalInputProps {
  value: string;
  onChange: (value: string) => void;
  onMultimodalChange?: (contents: MultimodalContent[]) => void;
  placeholder?: string;
  disabled?: boolean;
  maxImages?: number;
  showTerminology?: boolean;
  onOpenTerminology?: () => void;
}

interface UploadedImage {
  id: string;
  url: string;
  file?: File;
  name: string;
  type: 'upload' | 'reference' | 'sketch';
  description?: string;
}

export default function MultimodalInput({
  value,
  onChange,
  onMultimodalChange,
  placeholder = '描述你的创意，或上传图片/语音...',
  disabled = false,
  maxImages = 4,
  showTerminology = true,
  onOpenTerminology
}: MultimodalInputProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [activeMode, setActiveMode] = useState<'text' | 'image' | 'voice'>('text');
  const [dragOver, setDragOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const handleFileUpload = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    fileArray.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      if (images.length >= maxImages) return;

      const url = URL.createObjectURL(file);
      const newImage: UploadedImage = {
        id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url,
        file,
        name: file.name,
        type: 'upload'
      };

      setImages(prev => [...prev, newImage]);
      
      const newContent: MultimodalContent = {
        type: 'image',
        data: url,
        metadata: { fileName: file.name, fileType: file.type }
      };
      onMultimodalChange?.([...images.map(img => ({
        type: img.type as MultimodalContent['type'],
        data: img.url
      })), newContent]);
    });
  }, [images.length, maxImages, onMultimodalChange, images]);

  const removeImage = useCallback((id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img?.url.startsWith('blob:')) URL.revokeObjectURL(img.url);
      return prev.filter(i => i.id !== id);
    });
  }, []);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        
        const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognitionAPI();
        recognition.lang = 'zh-CN';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
          const text = event.results[0][0].transcript;
          setTranscript(text);
          onChange(value ? `${value}，${text}` : text);
        };

        recognition.onerror = () => {
          // console.log('Speech recognition failed');
        };

        recognition.start();
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Microphone access denied:', error);
    }
  }, [isRecording, value, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  useEffect(() => {
    return () => {
      images.forEach(img => {
        if (img.url.startsWith('blob:')) URL.revokeObjectURL(img.url);
      });
    };
  }, [images]);

  return (
    <div className="bg-[#1A1A1D] rounded-xl border border-white/5 overflow-hidden">
      {/* Mode Tabs */}
      <div className="flex items-center border-b border-white/5 px-2 pt-2">
        <button
          onClick={() => setActiveMode('text')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-t-lg transition-all',
            activeMode === 'text'
              ? 'bg-[#252528] text-white border-b-2 border-gray-500 -mb-[1px]'
              : 'text-gray-500 hover:text-gray-300'
          )}
        >
          <Type className="w-3.5 h-3.5" />
          文字
        </button>
        <button
          onClick={() => setActiveMode('image')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-t-lg transition-all relative',
            activeMode === 'image'
              ? 'bg-[#252528] text-white border-b-2 border-purple-500 -mb-[1px]'
              : 'text-gray-500 hover:text-gray-300'
          )}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          图片
          {images.length > 0 && (
            <span className={cn(
              'absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] flex items-center justify-center',
              activeMode === 'image' ? 'bg-purple-500 text-white' : 'bg-gray-600 text-gray-300'
            )}>
              {images.length}
            </span>
          )}
        </button>
        <button
          onClick={() => toggleRecording()}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-t-lg transition-all',
            activeMode === 'voice' || isRecording
              ? 'bg-[#252528] text-white border-b-2 border-red-500 -mb-[1px]'
              : 'text-gray-500 hover:text-gray-300'
          )}
        >
          <Mic className={cn('w-3.5 h-3.5', isRecording && 'animate-pulse text-red-400')} />
          语音
          {isRecording && (
            <span className="flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-ping" />
              录制中
            </span>
          )}
        </button>

        <div className="flex-1" />

        {showTerminology && (
          <button
            onClick={onOpenTerminology}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-amber-400 transition-colors mr-2"
          >
            <Palette className="w-3.5 h-3.5" />
            术语库
          </button>
        )}
      </div>

      {/* Content Area */}
      <div
        className="relative"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Text Mode */}
        {(activeMode === 'text' || activeMode === 'voice') && (
          <div className="p-4">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              rows={6}
              className={cn(
                'w-full px-4 py-3 bg-[#252528] text-white text-sm rounded-lg resize-none',
                'border border-white/15 focus:border-gray-500/50 focus:outline-none focus:ring-1 focus:ring-gray-500/30 placeholder-gray-500',
                'leading-relaxed',
                dragOver && 'border-dashed border-gray-500 bg-gray-500/5'
              )}
            />

            {/* Voice Transcript Preview */}
            {transcript && (
              <div className="mt-2 p-2 bg-green-500/10 rounded-lg flex items-start gap-2">
                <Volume2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-green-400 mb-0.5">语音识别结果</div>
                  <p className="text-xs text-gray-300 line-clamp-2">{transcript}</p>
                </div>
                <button
                  onClick={() => setTranscript('')}
                  className="p-0.5 hover:bg-white/10 rounded"
                >
                  <X className="w-3 h-3 text-gray-500" />
                </button>
              </div>
            )}

            {/* Drag Overlay */}
            {dragOver && (
              <div className="absolute inset-0 m-4 border-2 border-dashed border-gray-500 rounded-lg bg-gray-500/10 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">释放以上传图片</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Image Mode */}
        {activeMode === 'image' && (
          <div className="p-4">
            {/* Upload Area */}
            {images.length < maxImages ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors mb-4',
                  dragOver
                    ? 'border-gray-500 bg-gray-500/10'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                />
                <Upload className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400 mb-1">点击或拖拽图片到此处</p>
                <p className="text-xs text-gray-600">支持 JPG、PNG、WebP，最多 {maxImages} 张</p>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-yellow-500/10 rounded-lg flex items-center gap-2 text-xs text-yellow-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                已达到最大图片数量限制 ({maxImages}张)
              </div>
            )}

            {/* Image Grid */}
            {images.length > 0 && (
              <div className={cn(
                'grid gap-3',
                images.length === 1 ? 'grid-cols-1' :
                images.length === 2 ? 'grid-cols-2' :
                'grid-cols-2'
              )}>
                {images.map((img) => (
                  <div key={img.id} className="group relative bg-[#15151A] rounded-lg overflow-hidden border border-white/5">
                    <div className="aspect-video relative overflow-hidden">
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Overlay Controls */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button className="p-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm">
                          <ZoomIn className="w-4 h-4 text-white" />
                        </button>
                        <button
                          onClick={() => {
                            const updated = images.map(i =>
                              i.id === img.id ? { ...i, type: i.type === 'reference' ? 'upload' : 'reference' } : i
                            );
                            setImages(updated as any);
                          }}
                          className={cn(
                            'p-2 rounded-lg backdrop-blur-sm',
                            img.type === 'reference' ? 'bg-amber-500/30' : 'bg-white/20 hover:bg-white/30'
                          )}
                          title={img.type === 'reference' ? '设为参考图' : '设为参考图'}
                        >
                          <Grid3X3 className="w-4 h-4 text-white" />
                        </button>
                      </div>

                      {/* Type Badge */}
                      <div className={cn(
                        'absolute top-2 left-2 px-2 py-0.5 text-[10px] rounded-full',
                        img.type === 'reference' 
                          ? 'bg-amber-500/80 text-white' 
                          : 'bg-black/60 text-white'
                      )}>
                        {img.type === 'reference' ? '参考图' : '源图片'}
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeImage(img.id)}
                        className="absolute top-2 right-2 p-1 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>

                    {/* Image Info */}
                    <div className="p-2">
                      <p className="text-xs text-gray-400 truncate">{img.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Actions */}
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length >= maxImages}
                className="px-3 py-1.5 text-xs bg-[#2d2d35] hover:bg-[#3d3d45] rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Camera className="w-3.5 h-3.5" />
                上传图片
              </button>
              <button className="px-3 py-1.5 text-xs bg-[#2d2d35] hover:bg-[#3d3d45] rounded-lg flex items-center gap-1.5 transition-colors">
                <Link2 className="w-3.5 h-3.5" />
                粘贴链接
              </button>
              <button className="px-3 py-1.5 text-xs bg-[#2d2d35] hover:bg-[#3d3d45] rounded-lg flex items-center gap-1.5 transition-colors">
                <Sparkles className="w-3.5 h-3.5" />
                AI 描述图片
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="px-4 py-2 bg-[#15151A] border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {value.length > 0 && (
            <span>{value.length} 字符</span>
          )}
          {images.length > 0 && (
            <span>{images.length} 张图片</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {value || images.length > 0 ? (
            <>
              <button
                onClick={() => {
                  onChange('');
                  setImages([]);
                  setTranscript('');
                }}
                className="px-3 py-1.5 text-xs bg-[#2d2d35] hover:bg-[#3d3d45] rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                清空
              </button>
              <button className="px-4 py-1.5 text-xs bg-gradient-to-r from-gray-600 to-cyan-600 hover:from-gray-500 hover:to-cyan-500 text-white rounded-lg flex items-center gap-1.5 transition-all">
                <Check className="w-3.5 h-3.5" />
                确认输入
              </button>
            </>
          ) : (
            <span className="text-xs text-gray-600">请输入内容或上传素材</span>
          )}
        </div>
      </div>
    </div>
  );
}
