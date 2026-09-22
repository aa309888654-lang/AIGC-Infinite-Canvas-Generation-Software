import { memo } from 'react';
import { cn } from '@/lib/utils';
import {
  AICG_PRO_VIDEO_DEFAULTS,
  patchAicgProVideoParams,
} from '@/services/video-gen-node-service';

interface AicgProVideoSlidersProps {
  nodeId: string;
  proVideo?: {
    lightIntensity?: number;
    cameraPitch?: number;
    cameraYaw?: number;
    dollySpeed?: number;
  };
  className?: string;
}

function AicgProVideoSliders({ nodeId, proVideo = {}, className }: AicgProVideoSlidersProps) {
  const v = { ...AICG_PRO_VIDEO_DEFAULTS, ...proVideo };

  const row = (label: string, key: keyof typeof AICG_PRO_VIDEO_DEFAULTS, min: number, max: number) => (
    <label key={key} className="flex flex-col gap-1">
      <span className="flex justify-between text-[10px] text-white/50">
        <span>{label}</span>
        <span>{v[key]}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={v[key]}
        onChange={(e) => patchAicgProVideoParams(nodeId, { [key]: Number(e.target.value) })}
        className="nodrag h-1 w-full accent-white"
      />
    </label>
  );

  return (
    <div className={cn('grid grid-cols-2 gap-2 rounded-lg border border-white/[0.06] bg-black/20 p-2', className)}>
      {row('光源强度', 'lightIntensity', 0, 100)}
      {row('俯仰角', 'cameraPitch', -30, 30)}
      {row('水平角', 'cameraYaw', -30, 30)}
      {row('运镜速度', 'dollySpeed', 0, 100)}
    </div>
  );
}

export default memo(AicgProVideoSliders);
