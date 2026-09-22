import { memo, useMemo } from 'react';
import { Image, Star, Video } from 'lucide-react';
import ResultRenderer from '@/components/canvas/nodes/ResultRenderer';
import { cn } from '@/lib/utils';
import { useGenerationVersionStore } from '@/store/useGenerationVersionStore';
import type { GenerationMediaType, GenerationVersion } from '@/types/generation-version';
import type { Shot } from '@/types/shot-system';

interface ShotVersionStripProps {
  shot: Shot;
  onSelectVersion: (mediaType: Extract<GenerationMediaType, 'image' | 'video'>, versionId: string) => void;
}

function sortVersions(a: GenerationVersion, b: GenerationVersion) {
  if (a.selected !== b.selected) return a.selected ? -1 : 1;
  if (!!a.favorite !== !!b.favorite) return a.favorite ? -1 : 1;
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

function mediaLabel(mediaType: GenerationMediaType) {
  if (mediaType === 'video') return '视频';
  if (mediaType === 'image') return '图片';
  if (mediaType === 'audio') return '音频';
  return '文本';
}

function Preview({ version }: { version: GenerationVersion }) {
  if (version.mediaType === 'image') {
    return (
      <img
        src={version.url}
        alt="镜头生成图"
        className="h-full w-full object-cover"
        draggable={false}
      />
    );
  }

  if (version.mediaType === 'video') {
    return (
      <video
        src={version.url}
        className="h-full w-full object-cover"
        muted
        playsInline
        preload="metadata"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-white/[0.05] text-[9px] text-white/45">
      {mediaLabel(version.mediaType)}
    </div>
  );
}

function ShotVersionStrip({ shot, onSelectVersion }: ShotVersionStripProps) {
  const allVersions = useGenerationVersionStore((state) => state.versions);
  const selectVersion = useGenerationVersionStore((state) => state.selectVersion);
  const toggleFavorite = useGenerationVersionStore((state) => state.toggleFavorite);

  const versions = useMemo(
    () => allVersions.filter((version) => version.shotId === shot.id),
    [allVersions, shot.id]
  );

  const visibleVersions = useMemo(
    () => versions.filter((version) => version.mediaType === 'image' || version.mediaType === 'video').sort(sortVersions),
    [versions]
  );

  const selectedImage = versions.find((version) => version.id === shot.selectedImageVersionId) || versions.find((version) => version.mediaType === 'image' && version.selected);
  const selectedVideo = versions.find((version) => version.id === shot.selectedVideoVersionId) || versions.find((version) => version.mediaType === 'video' && version.selected);
  const heroVersion = selectedVideo || selectedImage;

  if (visibleVersions.length === 0) return null;

  return (
    <div className="space-y-2">
      {heroVersion && (
        <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-black/35">
          <ResultRenderer
            mediaType={heroVersion.mediaType}
            imageUrl={heroVersion.mediaType === 'image' ? heroVersion.url : undefined}
            videoUrl={heroVersion.mediaType === 'video' ? heroVersion.url : undefined}
            className="h-28"
            videoControls={false}
            videoLoop={false}
            imageObjectFit="cover"
          />
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        {visibleVersions.map((version) => {
          const isSelected =
            version.id === shot.selectedImageVersionId ||
            version.id === shot.selectedVideoVersionId ||
            version.selected;

          return (
            <div
              key={version.id}
              className={cn(
                'group relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border bg-black/35',
                isSelected ? 'border-emerald-300/65' : 'border-white/[0.08] hover:border-white/25'
              )}
            >
              <button
                type="button"
                onClick={() => {
                  selectVersion(version.id);
                  if (version.mediaType === 'image' || version.mediaType === 'video') {
                    onSelectVersion(version.mediaType, version.id);
                  }
                }}
                className="h-full w-full"
                title={`选择${mediaLabel(version.mediaType)}版本`}
              >
                <Preview version={version} />
              </button>
              <div className="pointer-events-none absolute left-1 top-1 rounded bg-black/65 p-0.5 text-white/75">
                {version.mediaType === 'video' ? <Video className="h-3 w-3" /> : <Image className="h-3 w-3" />}
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFavorite(version.id);
                }}
                className={cn(
                  'absolute right-1 top-1 rounded bg-black/65 p-0.5 text-white/55 opacity-0 transition-opacity group-hover:opacity-100',
                  version.favorite && 'text-amber-200 opacity-100'
                )}
                aria-label={version.favorite ? '取消收藏版本' : '收藏版本'}
              >
                <Star className={cn('h-3 w-3', version.favorite && 'fill-current')} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(ShotVersionStrip);
