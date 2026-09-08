import React, { useState, useEffect, useCallback, useRef } from 'react';
import { navigateTo } from '@/routes';
import { PUBLIC_URLS } from '@/config/resources';
import UserProfileDropdown from '@/components/ui/UserProfileDropdown';
import MusicCard from '@/components/music/MusicCard';
import ShareModal from '@/components/music/ShareModal';
import { musicService, SavedSong } from '@/services/music-service';
import { useToast } from '@/components/ui/Toast';
import { BACKEND_URL } from '@/lib/api-config';
import { useMusicPlayer } from '@/hooks/useMusicPlayer';
import '@/styles/music-forest.css';
import MusicForestBackdrop from '@/components/music/MusicForestBackdrop';
import { ArrowLeft, Search, List, Loader2, Disc3, AudioWaveform, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMembershipStore } from '@/store/useMembershipStore';

type ViewMode = 'grid' | 'list';
type SortBy = 'newest' | 'oldest' | 'title';

const MyMusicPage: React.FC = () => {
  const { addToast } = useToast();
  const isLoggedIn = useMembershipStore((state) => state.membership?.isLoggedIn === true);
  const [songs, setSongs] = useState<SavedSong[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [selectedSong, setSelectedSong] = useState<SavedSong | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);

  const player = useMusicPlayer({
    onEnded: () => setPlayingSongId(null),
  });

  const loadSongs = useCallback(async () => {
    if (!isLoggedIn) {
      setSongs([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await musicService.getSongHistory();
      setSongs(data);
    } catch (error) {
      console.error('[MyMusicPage] Failed to load songs:', error);
      addToast('error', '加载歌曲失败');
    } finally {
      setIsLoading(false);
    }
  }, [addToast, isLoggedIn]);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  useEffect(() => {
    return () => {
      player.pause();
      setPlayingSongId(null);
      currentAudioUrlRef.current = null;
    };
  }, [player]);

  const resolveAudioUrl = useCallback((audioUrl: string): string => {
    if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
      return audioUrl;
    }
    return `${BACKEND_URL}${audioUrl.startsWith('/') ? '' : '/'}${audioUrl}`;
  }, []);

  const handlePlay = useCallback((song: SavedSong) => {
    if (playingSongId === song.id) {
      player.pause();
      setPlayingSongId(null);
    } else {
      const audioUrl = resolveAudioUrl(song.audioUrl);
      if (currentAudioUrlRef.current !== audioUrl) {
        player.initializeAudio(audioUrl);
        currentAudioUrlRef.current = audioUrl;
      }
      player.play();
      setPlayingSongId(song.id);
    }
  }, [playingSongId, player, resolveAudioUrl]);

  const handleDownload = (song: SavedSong) => {
    musicService.downloadAudio(song.audioUrl, `${song.title || song.songInfo?.title || 'song'}.mp3`);
    addToast('success', '开始下载');
  };

  const handleShare = (song: SavedSong) => {
    setSelectedSong(song);
    setShowShareModal(true);
  };

  const handleDelete = async (song: SavedSong) => {
    if (confirm('确定要删除这首歌曲吗？')) {
      try {
        await musicService.deleteSong(song.id);
        if (playingSongId === song.id) {
          player.pause();
          setPlayingSongId(null);
          currentAudioUrlRef.current = null;
        }
        setSongs(songs.filter(s => s.id !== song.id));
        addToast('success', '删除成功');
      } catch (error) {
        console.error('[MyMusicPage] Failed to delete song:', error);
        addToast('error', '删除失败');
      }
    }
  };

  const filteredSongs = songs
    .filter(song => 
      song.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.songInfo?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.songInfo?.artist?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'title':
          return (a.title || a.songInfo?.title || '').localeCompare(b.title || b.songInfo?.title || '');
        default:
          return 0;
      }
    });

  return (
    <div className="mf-canvas text-white relative min-h-screen">
      <MusicForestBackdrop noteCount={6} />

      <header className="mf-page-header relative z-20">
        <div className="mf-page-header__inner">
          <div className="flex items-center gap-8">
            <button
              onClick={() => navigateTo('/')}
              className="flex items-center gap-3 px-6 py-2.5 rounded-full text-[13px] font-bold transition-all duration-500 border border-white/10 bg-white/5 text-white/40 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-400 group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              <span>返回主页</span>
            </button>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute -inset-2 bg-emerald-500/20 blur-xl rounded-2xl" />
                <img src={PUBLIC_URLS.logo} alt="AICG-创意工作台" className="w-10 h-10 rounded-xl relative z-10" />
              </div>
              <div>
                <h1 className="mf-page-header__title">我的曲库</h1>
                <p className="mf-page-header__tagline">{songs.length} 首作品 · Forest Archive</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigateTo('/1?panel=music')}
              className="px-8 py-2.5 rounded-full text-[13px] font-black transition-all duration-700 bg-emerald-500 text-white shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 border-none cursor-pointer uppercase tracking-widest"
            >
              Start New Project
            </button>
            <div className="h-8 w-px bg-white/10" />
            <UserProfileDropdown />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mf-library relative z-10">
        <div className="space-y-12">
          {/* Dashboard Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-4">
              <div className="mf-chip">
                <Disc3 size={14} className="animate-spin-slow" />
                <span>My Creative Lab</span>
              </div>
              <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">音乐创作中心</h2>
            </div>

            {/* Controls Row */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="mf-search">
                <Search className="mf-search__icon w-4 h-4" />
                <input
                  type="text"
                  name="music-search"
                  aria-label="搜索歌曲或创作者"
                  autoComplete="off"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索歌曲或创作者…"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>

              <div className="mf-segment">
                <button
                  type="button"
                  aria-label="网格视图"
                  onClick={() => setViewMode('grid')}
                  className={cn('mf-segment__btn', viewMode === 'grid' && 'mf-segment__btn--active')}
                >
                  <LayoutGrid size={18} />
                </button>
                <button
                  type="button"
                  aria-label="列表视图"
                  onClick={() => setViewMode('list')}
                  className={cn('mf-segment__btn', viewMode === 'list' && 'mf-segment__btn--active')}
                >
                  <List size={18} />
                </button>
              </div>

              <select
                aria-label="歌曲排序方式"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                style={{
                  padding: '12px 18px',
                  background: 'rgba(8, 24, 16, 0.75)',
                  border: '1px solid rgba(134, 239, 172, 0.12)',
                  borderRadius: '14px',
                  color: 'rgba(236, 253, 245, 0.65)',
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none',
                  minWidth: '160px',
                  textAlign: 'center',
                }}
              >
                <option value="newest">NEWEST FIRST</option>
                <option value="oldest">OLDEST FIRST</option>
                <option value="title">BY TITLE</option>
              </select>
            </div>
          </div>

          {/* Content Area */}
          {isLoading ? (
            <div className="mf-empty gap-6">
              <div className="mf-empty__orb">
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" strokeWidth={1.5} />
              </div>
              <p className="mf-chip">Synchronizing Archives...</p>
            </div>
          ) : filteredSongs.length === 0 ? (
            <div className="mf-empty gap-8">
              <div className="relative">
                <div className="mf-empty__orb">
                  <AudioWaveform size={42} strokeWidth={1.2} />
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-black text-white tracking-tight uppercase">
                  {!isLoggedIn ? '登录后查看我的音乐' : searchQuery ? '没有匹配结果' : '还没有音乐作品'}
                </h3>
                <p className="text-emerald-200/45 font-bold tracking-widest text-xs">
                  {!isLoggedIn ? '登录后可同步、播放和管理已生成的音乐作品' : searchQuery ? '请尝试其他关键词' : '开始第一次创作，我们会在这里记录每一个灵感瞬间'}
                </p>
              </div>
              {!isLoggedIn ? (
                <button type="button" onClick={() => navigateTo('/')} className="mf-btn mt-2">
                  返回首页登录
                </button>
              ) : !searchQuery && (
                <button
                  type="button"
                  onClick={() => navigateTo('/1?panel=music')}
                  className="mf-btn mt-2"
                >
                  Create New Track
                </button>
              )}
            </div>
          ) : (
            <div className={cn(
              "relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-1000",
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8'
                : 'space-y-6'
            )}>
              {filteredSongs.map((song) => (
                <MusicCard
                  key={song.id}
                  song={song}
                  onPlay={handlePlay}
                  onDownload={handleDownload}
                  onShare={handleShare}
                  onDelete={handleDelete}
                  isPlaying={playingSongId === song.id}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Share Modal */}
      {selectedSong && (
        <ShareModal
          songId={selectedSong.id}
          songTitle={selectedSong.title || selectedSong.songInfo?.title || '未命名歌曲'}
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setSelectedSong(null);
          }}
        />
      )}

      {/* Global Style Injector */}
      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default MyMusicPage;
