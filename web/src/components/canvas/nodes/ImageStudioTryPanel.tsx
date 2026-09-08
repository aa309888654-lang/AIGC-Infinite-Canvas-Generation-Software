import { memo } from 'react';
import { ArrowUpFromLine, Sparkles } from 'lucide-react';
import { applyImageTryMode } from '@/services/image-gen-node-service';
import { aicgGlass } from './aicg-node-glass';

interface ImageStudioTryPanelProps {
  nodeId: string;
  className?: string;
}

function ImageStudioTryPanel({ nodeId, className }: ImageStudioTryPanelProps) {
  return (
    <div className={className}>
      <div className="mb-1.5 text-[10px] font-medium text-white/50">尝试</div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            applyImageTryMode(nodeId, 'image_to_image');
          }}
          className={aicgGlass.tryItem}
        >
          <ArrowUpFromLine className="h-3.5 w-3.5 shrink-0 text-white/55" strokeWidth={1.75} />
          <span className="truncate">图生图</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            applyImageTryMode(nodeId, 'upscale');
          }}
          className={aicgGlass.tryItem}
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-white/55" strokeWidth={1.75} />
          <span className="truncate">图片高清</span>
        </button>
      </div>
    </div>
  );
}

export default memo(ImageStudioTryPanel);
