/**
 * 文件拖放区域组件
 * 提供可视化的拖放反馈和进度显示
 */
import { memo, useState, useCallback} from 'react';
import { Upload, Image, Video, Music, X, AlertCircle, Loader2} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  isSupportedFile, 
  validateFileSize, 
  processFile,
  getFileType,
  type ProcessedFile 
} from '@/services/enhanced-file-processor';

interface FileDropZoneProps {
  onFilesDropped: (files: ProcessedFile[]) => void;
  onError?: (error: string) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

interface DropState {
  isDragging: boolean;
  files: File[];
  processing: boolean;
  progress: number;
  errors: string[];
}

const FileDropZone = memo<FileDropZoneProps>(({
  onFilesDropped,
  onError,
  maxFiles = 10,
  disabled = false,
  className,
  children,
}) => {
  const [dropState, setDropState] = useState<DropState>({
    isDragging: false,
    files: [],
    processing: false,
    progress: 0,
    errors: [],
  });
  
  const [, setDragCounter] = useState(0);
  
  // 拖入事件
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items) {
      setDropState(prev => ({ ...prev, isDragging: true }));
    }
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setDropState(prev => ({ ...prev, isDragging: false }));
      }
      return newCount;
    });
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  
  // 放置事件
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(0);
    setDropState(prev => ({ ...prev, isDragging: false }));
    
    if (disabled) return;
    
    const files = Array.from(e.dataTransfer.files);
    
    if (files.length === 0) return;
    
    if (maxFiles && files.length > maxFiles) {
      onError?.(`最多只能添加 ${maxFiles} 个文件`);
      return;
    }
    
    // 验证文件
    const validFiles: File[] = [];
    const errors: string[] = [];
    
    for (const file of files) {
      if (!isSupportedFile(file)) {
        errors.push(`${file.name}: 不支持的文件类型`);
        continue;
      }
      
      const sizeValidation = validateFileSize(file);
      if (!sizeValidation.valid) {
        errors.push(`${file.name}: ${sizeValidation.error}`);
        continue;
      }
      
      validFiles.push(file);
    }
    
    if (errors.length > 0) {
      setDropState(prev => ({ ...prev, errors }));
      onError?.(errors.join('\n'));
    }
    
    if (validFiles.length === 0) return;
    
    // 处理文件
    setDropState(prev => ({ ...prev, files: validFiles, processing: true, progress: 0, errors: [] }));
    
    try {
      const processedFiles: ProcessedFile[] = [];
      
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const processed = await processFile(file, {
          createThumbnail: true,
          extractMetadata: true,
          onProgress: (p) => {
            const progress = Math.round(((i + p / 100) / validFiles.length) * 100);
            setDropState(prev => ({ ...prev, progress }));
          }
        });
        processedFiles.push(processed);
      }
      
      onFilesDropped(processedFiles);
      setDropState(prev => ({ ...prev, processing: false, progress: 100, files: [] }));
      
    } catch (error) {
      setDropState(prev => ({ 
        ...prev, 
        processing: false, 
        errors: [...prev.errors, String(error)] 
      }));
      onError?.(String(error));
    }
  }, [disabled, maxFiles, onFilesDropped, onError]);
  
  // 清除错误
  const clearErrors = useCallback(() => {
    setDropState(prev => ({ ...prev, errors: [] }));
  }, []);

  const getFileTypeIcon = useCallback((type: string) => {
    switch (type) {
      case 'image': return <Image className="w-5 h-5" />;
      case 'video': return <Video className="w-5 h-5" />;
      case 'audio': return <Music className="w-5 h-5" />;
      default: return <Upload className="w-5 h-5" />;
    }
  }, []);
  
  return (
    <div 
      className={cn('relative', className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
      
      {/* 拖放覆盖层 */}
      {dropState.isDragging && (
        <div className="absolute inset-0 bg-gray-500/20 border-2 border-dashed border-gray-500 rounded-lg flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="text-center p-6">
            <Upload className="w-12 h-12 mx-auto mb-3 text-gray-500 animate-bounce" />
            <p className="text-gray-500 font-medium">拖放文件到此处</p>
            <p className="text-gray-400 text-sm mt-1">支持图片、视频、音频文件</p>
          </div>
        </div>
      )}
      
      {/* 处理进度 */}
      {dropState.processing && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center z-50">
          <div className="text-center p-6">
            <Loader2 className="w-10 h-10 mx-auto mb-3 text-gray-500 animate-spin" />
            <p className="text-white font-medium">正在处理文件...</p>
            <div className="w-48 h-2 bg-gray-700 rounded-full mt-3 overflow-hidden">
              <div 
                className="h-full bg-gray-500 transition-all duration-300"
                style={{ width: `${dropState.progress}%` }}
              />
            </div>
            <p className="text-gray-400 text-sm mt-2">{dropState.progress}%</p>
          </div>
        </div>
      )}
      
      {/* 错误提示 */}
      {dropState.errors.length > 0 && (
        <div className="absolute top-2 left-2 right-2 bg-red-500/90 text-white text-sm p-2 rounded-lg flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs">{dropState.errors[0]}</span>
          </div>
          <button onClick={clearErrors} className="p-1 hover:bg-white/20 rounded">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
});

FileDropZone.displayName = 'FileDropZone';

export default FileDropZone;
export { FileDropZone };
