import React from 'react';
import { Play, Pause, Share2, Download, Trash2, Music, Mic2 } from 'lucide-react';
import { SavedSong } from '@/services/music-service';
import { cn } from '@/lib/utils';
import FavoriteButton from './FavoriteButton';

interface MusicCardProps {
  song: SavedSong;
  onPlay?: (song: SavedSong) => void;
  onDownload?: (song: SavedSong) => void;
  onDelete?: (song: SavedSong) => void;
  onShare?: (song: SavedSong) => void;
  isPlaying?: boolean;
}

const MusicCard: React.FC<MusicCardProps> = ({
  song,
  onPlay,
  onDownload,
  onDelete,
  onShare,
  isPlaying = false,
}) => {
  const title = song.title || song.songInfo?.title || '未命名作品';
  const artist = song.songInfo?.artist || song.songInfo?.composer || 'AI Neural Vocalist';
  const badge = song.songInfo?.genre || 'Studio Master';

  return (
    <article className={cn('mf-card group', isPlaying && 'ring-1 ring-emerald-400/40 shadow-[0_0_40px_rgba(16,185,129,0.15)]')}>
      <div className="mf-card__cover">
        {isPlaying && (
          <div className="absolute inset-x-0 bottom-0 z-[2] flex h-10 items-end justify-center gap-[3px] px-4 pb-3 opacity-80 pointer-events-none">
            {Array.from({ length: 16 }).map((_, i) => (
              <span
                key={i}
                className="mf-backdrop__bar"
                style={{ animationDelay: `${(i % 8) * 0.07}s`, height: `${30 + ((i * 11) % 55)}%` }}
              />
            ))}
          </div>
        )}
        {song.coverImageUrl ? (
          <img
            src={song.coverImageUrl}
            alt={title}
            className={cn('transition-transform duration-[1800ms] ease-out', isPlaying ? 'scale-105 animate-spin-slow' : 'group-hover:scale-110')}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.15)]">
              <Music className="h-14 w-14 text-emerald-200/60" strokeWidth={1.2} />
            </div>
          </div>
        )}

        <div className="mf-card__overlay">
          <button
            onClick={() => onPlay?.(song)}
            className="mf-card__play"
            aria-label={isPlaying ? '暂停播放' : '播放歌曲'}
            type="button"
          >
            {isPlaying ? <Pause className="h-6 w-6" fill="currentColor" /> : <Play className="ml-0.5 h-6 w-6" fill="currentColor" />}
          </button>
        </div>

        <div className="mf-card__favorite">
          <FavoriteButton songId={song.id} isFavorite={false} size="sm" />
        </div>

        <div className="mf-card__badge">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(134,239,172,0.8)]" />
            {badge}
          </span>
        </div>
      </div>

      <div className="mf-card__body">
        <div className="space-y-2">
          <h3 className="mf-card__title" title={title}>
            {title}
          </h3>
          <div className="mf-card__meta">
            <Mic2 className="h-3.5 w-3.5 text-emerald-300/70" />
            <span className="truncate">{artist}</span>
          </div>
        </div>

        <div className="mf-card__actions">
          <button type="button" onClick={() => onDownload?.(song)} className="mf-card__action">
            <Download className="h-4 w-4" />
            导出
          </button>
          <button type="button" onClick={() => onShare?.(song)} className="mf-card__action mf-card__action--icon" aria-label="分享">
            <Share2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onDelete?.(song)} className="mf-card__action mf-card__action--icon" aria-label="删除">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
};

export default MusicCard;
