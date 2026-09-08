import { memo } from 'react';
import { Upload, Image, Film } from 'lucide-react';

interface DragDropOverlayProps {
  isDragging: boolean;
  onDragEnter: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
}

const DragDropOverlay = memo(({ isDragging, onDragEnter, onDragLeave, onDrop }: DragDropOverlayProps) => {
  if (!isDragging) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={onDrop}
    >
      <div className="flex flex-col items-center justify-center p-8 bg-[#1A1A1D] border-2 border-dashed border-white/30 rounded-xl max-w-md mx-auto">
        <div className="flex gap-6 mb-4">
          <div className="flex flex-col items-center">
            <div className="p-4 bg-green-600/20 rounded-full mb-2">
              <Image className="w-8 h-8 text-green-400" />
            </div>
            <span className="text-sm text-green-400">图片文件</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="p-4 bg-gray-600/20 rounded-full mb-2">
              <Film className="w-8 h-8 text-gray-400" />
            </div>
            <span className="text-sm text-gray-400">视频文件</span>
          </div>
        </div>
        <Upload className="w-12 h-12 text-white/70 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">拖放文件到画布</h3>
        <p className="text-sm text-white/80 text-center">
          支持 JPG、PNG、GIF、WEBP 等图片格式<br />
          支持 MP4、MOV、AVI、WEBM 等视频格式
        </p>
        <p className="text-xs text-white/60 mt-4 text-center">
          松开鼠标以创建对应的输入节点
        </p>
      </div>
    </div>
  );
});

DragDropOverlay.displayName = 'DragDropOverlay';

export default DragDropOverlay;