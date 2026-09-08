import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { BoxSelect, MapPin, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SeedreamAnnotation = {
  id: string;
  imageUrl: string;
  kind: 'point' | 'bbox';
  coordinates: number[];
};

type EditorImage = {
  url: string;
  name: string;
};

type SeedreamInteractiveEditorProps = {
  images: EditorImage[];
  annotations: SeedreamAnnotation[];
  onChange: (annotations: SeedreamAnnotation[]) => void;
};

type DraftBox = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

function clampCoordinate(value: number): number {
  return Math.max(0, Math.min(999, Math.round(value)));
}

function toNormalizedCoordinate(event: ReactPointerEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: clampCoordinate(((event.clientX - rect.left) / rect.width) * 1000),
    y: clampCoordinate(((event.clientY - rect.top) / rect.height) * 1000),
  };
}

function SeedreamInteractiveEditor({
  images,
  annotations,
  onChange,
}: SeedreamInteractiveEditorProps) {
  const [activeImageUrl, setActiveImageUrl] = useState(images[0]?.url || '');
  const [mode, setMode] = useState<'point' | 'bbox'>('point');
  const [draftBox, setDraftBox] = useState<DraftBox | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!images.some((image) => image.url === activeImageUrl)) {
      setActiveImageUrl(images[0]?.url || '');
    }
  }, [activeImageUrl, images]);

  const activeImage = images.find((image) => image.url === activeImageUrl) || images[0];
  const activeAnnotations = useMemo(
    () => annotations.filter((annotation) => annotation.imageUrl === activeImage?.url),
    [activeImage?.url, annotations]
  );

  if (!activeImage) {
    return (
      <div className="mt-2 rounded-md border border-white/12 bg-black/25 px-3 py-3 text-[10px] text-white/48">
        未选择编辑原图
      </div>
    );
  }

  const addPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = toNormalizedCoordinate(event);
    onChange([
      ...annotations,
      {
        id: `seedream-point-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        imageUrl: activeImage.url,
        kind: 'point',
        coordinates: [point.x, point.y],
      },
    ]);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (mode === 'point') {
      addPoint(event);
      return;
    }
    const point = toNormalizedCoordinate(event);
    setDraftBox({ startX: point.x, startY: point.y, endX: point.x, endY: point.y });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draftBox || mode !== 'bbox') return;
    const point = toNormalizedCoordinate(event);
    setDraftBox((current) => (current ? { ...current, endX: point.x, endY: point.y } : current));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draftBox || mode !== 'bbox') return;
    event.preventDefault();
    event.stopPropagation();
    const point = toNormalizedCoordinate(event);
    const x1 = Math.min(draftBox.startX, point.x);
    const y1 = Math.min(draftBox.startY, point.y);
    const x2 = Math.max(draftBox.startX, point.x);
    const y2 = Math.max(draftBox.startY, point.y);
    setDraftBox(null);
    if (x2 - x1 < 8 || y2 - y1 < 8) return;
    onChange([
      ...annotations,
      {
        id: `seedream-bbox-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        imageUrl: activeImage.url,
        kind: 'bbox',
        coordinates: [x1, y1, x2, y2],
      },
    ]);
  };

  const renderBox = (coordinates: number[], className?: string) => {
    const [x1, y1, x2, y2] = coordinates;
    return (
      <span
        className={cn(
          'pointer-events-none absolute border border-amber-300 bg-amber-300/10',
          className
        )}
        style={{
          left: `${x1 / 10}%`,
          top: `${y1 / 10}%`,
          width: `${(x2 - x1) / 10}%`,
          height: `${(y2 - y1) / 10}%`,
        }}
      />
    );
  };

  return (
    <div
      className="nodrag nowheel mt-2 rounded-md border border-white/12 bg-[#0d0e11] p-2"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-white/78">精准交互编辑</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={cn(
              'flex h-6 items-center gap-1 rounded px-2 text-[9px] transition-colors',
              mode === 'point' ? 'bg-white/14 text-white' : 'bg-white/[0.05] text-white/55'
            )}
            onClick={() => setMode('point')}
            title="在图片上点选位置"
          >
            <MapPin className="h-3 w-3" />
            点选
          </button>
          <button
            type="button"
            className={cn(
              'flex h-6 items-center gap-1 rounded px-2 text-[9px] transition-colors',
              mode === 'bbox' ? 'bg-white/14 text-white' : 'bg-white/[0.05] text-white/55'
            )}
            onClick={() => setMode('bbox')}
            title="拖动框选编辑区域"
          >
            <BoxSelect className="h-3 w-3" />
            框选
          </button>
        </div>
      </div>

      {images.length > 1 ? (
        <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setActiveImageUrl(image.url)}
              className={cn(
                'relative h-10 w-10 shrink-0 overflow-hidden rounded border',
                image.url === activeImage.url ? 'border-white/70' : 'border-white/12'
              )}
              title={`图 ${index + 1} · ${image.name}`}
            >
              <img
                src={image.url}
                alt=""
                draggable={false}
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-0 right-0 bg-black/70 px-1 text-[8px] text-white/80">
                {index + 1}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex justify-center overflow-hidden rounded bg-black/50">
        <div className="relative inline-block max-w-full">
          <img
            src={activeImage.url}
            alt={activeImage.name}
            draggable={false}
            className="block max-h-[260px] max-w-full select-none object-contain"
          />
          <div
            ref={overlayRef}
            className={cn(
              'absolute inset-0 touch-none',
              mode === 'point' ? 'cursor-crosshair' : 'cursor-cell'
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => setDraftBox(null)}
          >
            {activeAnnotations.map((annotation, index) =>
              annotation.kind === 'point' ? (
                <span
                  key={annotation.id}
                  className="pointer-events-none absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white bg-amber-400 text-[8px] font-bold text-black shadow"
                  style={{
                    left: `${annotation.coordinates[0] / 10}%`,
                    top: `${annotation.coordinates[1] / 10}%`,
                  }}
                >
                  {index + 1}
                </span>
              ) : (
                <span key={annotation.id}>{renderBox(annotation.coordinates)}</span>
              )
            )}
            {draftBox
              ? renderBox(
                  [
                    Math.min(draftBox.startX, draftBox.endX),
                    Math.min(draftBox.startY, draftBox.endY),
                    Math.max(draftBox.startX, draftBox.endX),
                    Math.max(draftBox.startY, draftBox.endY),
                  ],
                  'border-dashed border-white/90 bg-white/10'
                )
              : null}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-white/45">
        <span>
          {activeAnnotations.length > 0
            ? `图中已有 ${activeAnnotations.length} 个定位`
            : '未添加定位'}
        </span>
        {activeAnnotations.length > 0 ? (
          <button
            type="button"
            onClick={() =>
              onChange(annotations.filter((item) => item.imageUrl !== activeImage.url))
            }
            className="flex h-6 items-center gap-1 rounded px-2 text-red-300/80 hover:bg-red-500/10 hover:text-red-200"
            title="清除当前图片的全部定位"
          >
            <Trash2 className="h-3 w-3" />
            清除
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default memo(SeedreamInteractiveEditor);
