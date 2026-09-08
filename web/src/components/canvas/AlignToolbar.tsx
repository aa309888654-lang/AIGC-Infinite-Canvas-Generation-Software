import React from 'react';
import { Panel } from '@xyflow/react';
import { AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical } from 'lucide-react';

interface AlignToolbarProps {
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onAlignTop: () => void;
  onAlignMiddle: () => void;
  onAlignBottom: () => void;
}

const AlignToolbar: React.FC<AlignToolbarProps> = ({
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onAlignTop,
  onAlignMiddle,
  onAlignBottom,
}) => {
  return (
    <Panel position="top-right" className="top-4">
      <div className="flex items-center gap-1 p-1 bg-[#1F1F1F] border border-white/10 rounded-lg shadow-2xl">
        <button
          onClick={onAlignLeft}
          className="flex items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
          title="左对齐"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onAlignCenter}
          className="flex items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
          title="水平居中对齐"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={onAlignRight}
          className="flex items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
          title="右对齐"
        >
          <AlignRight className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <button
          onClick={onAlignTop}
          className="flex items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
          title="顶对齐"
        >
          <AlignStartVertical className="w-4 h-4" />
        </button>
        <button
          onClick={onAlignMiddle}
          className="flex items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
          title="垂直居中对齐"
        >
          <AlignCenterVertical className="w-4 h-4" />
        </button>
        <button
          onClick={onAlignBottom}
          className="flex items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
          title="底对齐"
        >
          <AlignEndVertical className="w-4 h-4" />
        </button>
      </div>
    </Panel>
  );
};

export default AlignToolbar;
