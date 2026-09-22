import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, LoaderCircle, Play } from 'lucide-react';
import '@/styles/tutorial-video.css';

const REQUIRED_BUFFER_SECONDS = 20;

type PlayerPhase = 'idle' | 'buffering' | 'ready' | 'playing' | 'paused' | 'error';
type VideoQuality = '1080P' | '2K';

interface TutorialVideoPlayerProps {
  id: string;
  title: string;
  videoUrl: string;
  video2kUrl?: string;
  posterUrl?: string;
  eagerPoster?: boolean;
  notSupportedText: string;
  onPlaybackRequest: (id: string, video: HTMLVideoElement) => void;
  onPlaybackEnd: (id: string, video: HTMLVideoElement) => void;
  isPlaybackActive: (video: HTMLVideoElement) => boolean;
}

function getBufferedSeconds(video: HTMLVideoElement, fromTime = video.currentTime): number {
  for (let index = 0; index < video.buffered.length; index += 1) {
    const start = video.buffered.start(index);
    const end = video.buffered.end(index);
    if (fromTime >= start - 0.15 && fromTime <= end) {
      return Math.max(0, end - fromTime);
    }
  }
  return 0;
}

function getBufferGoal(video: HTMLVideoElement, fromTime = video.currentTime): number {
  if (!Number.isFinite(video.duration) || video.duration <= 0) return REQUIRED_BUFFER_SECONDS;
  return Math.min(REQUIRED_BUFFER_SECONDS, Math.max(0, video.duration - fromTime));
}

const TutorialVideoPlayer: React.FC<TutorialVideoPlayerProps> = ({
  id,
  title,
  videoUrl,
  video2kUrl,
  posterUrl,
  eagerPoster = false,
  notSupportedText,
  onPlaybackRequest,
  onPlaybackEnd,
  isPlaybackActive,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const phaseRef = useRef<PlayerPhase>('idle');
  const unlockingPlaybackRef = useRef(false);
  const bufferStartTimeRef = useRef(0);
  const wasMutedRef = useRef(false);
  const switchingSourceRef = useRef(false);
  const pendingSourceChangeRef = useRef<{ currentTime: number; resume: boolean } | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const [quality, setQuality] = useState<VideoQuality>('1080P');
  const [sourceMounted, setSourceMounted] = useState(false);
  const [phase, setPhase] = useState<PlayerPhase>('idle');
  const [bufferedSeconds, setBufferedSeconds] = useState(0);
  const [bufferGoal, setBufferGoal] = useState(REQUIRED_BUFFER_SECONDS);
  const selectedVideoUrl = quality === '2K' && video2kUrl ? video2kUrl : videoUrl;

  const changePhase = useCallback((nextPhase: PlayerPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const finishBuffering = useCallback(() => {
    const video = videoRef.current;
    if (!video || phaseRef.current !== 'buffering') return;

    stopPolling();
    onPlaybackRequest(id, video);
    video.currentTime = bufferStartTimeRef.current;
    video.muted = wasMutedRef.current;
    changePhase('playing');
  }, [changePhase, id, onPlaybackRequest, stopPolling]);

  const updateBufferProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || phaseRef.current !== 'buffering') return;
    if (!isPlaybackActive(video)) {
      stopPolling();
      video.pause();
      video.muted = wasMutedRef.current;
      changePhase('paused');
      return;
    }

    const nextGoal = getBufferGoal(video, bufferStartTimeRef.current);
    const nextBufferedSeconds = getBufferedSeconds(video, bufferStartTimeRef.current);
    setBufferGoal(nextGoal);
    setBufferedSeconds(Math.min(nextBufferedSeconds, nextGoal));

    if (nextGoal <= 0.25 || nextBufferedSeconds + 0.25 >= nextGoal) {
      finishBuffering();
    }
  }, [changePhase, finishBuffering, isPlaybackActive, stopPolling]);

  const beginBuffering = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    onPlaybackRequest(id, video);
    bufferStartTimeRef.current = video.currentTime;
    wasMutedRef.current = video.muted;
    video.muted = true;
    video.preload = 'auto';
    changePhase('buffering');
    updateBufferProgress();

    if (pollTimerRef.current === null) {
      pollTimerRef.current = window.setInterval(updateBufferProgress, 250);
    }

    // Playing silently under the loading overlay makes Chromium continue fetching
    // beyond its paused-video preload cap. The original position is restored later.
    unlockingPlaybackRef.current = true;
    void video.play()
      .catch(() => {
        stopPolling();
        video.muted = wasMutedRef.current;
        changePhase('ready');
      })
      .finally(() => {
        unlockingPlaybackRef.current = false;
      });
  }, [changePhase, id, onPlaybackRequest, stopPolling, updateBufferProgress]);

  useEffect(() => {
    if (!sourceMounted) return;
    const video = videoRef.current;
    if (!video) return;

    video.load();
    const prepareSelectedSource = () => {
      const pendingChange = pendingSourceChangeRef.current;
      pendingSourceChangeRef.current = null;

      if (pendingChange) {
        video.currentTime = Math.min(pendingChange.currentTime, Math.max(0, video.duration - 0.1));
        switchingSourceRef.current = false;
        if (pendingChange.resume) {
          beginBuffering();
        } else {
          changePhase('paused');
        }
        return;
      }

      switchingSourceRef.current = false;
      beginBuffering();
    };

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      prepareSelectedSource();
      return;
    }

    video.addEventListener('loadedmetadata', prepareSelectedSource, { once: true });
    return () => video.removeEventListener('loadedmetadata', prepareSelectedSource);
  }, [beginBuffering, changePhase, selectedVideoUrl, sourceMounted]);

  useEffect(() => () => {
    stopPolling();
    const video = videoRef.current;
    if (video) video.pause();
  }, [stopPolling]);

  const handleInitialPlay = () => {
    if (!selectedVideoUrl) {
      changePhase('error');
      return;
    }
    setSourceMounted(true);
    changePhase('buffering');
  };

  const handleNativePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    onPlaybackRequest(id, video);
    if (unlockingPlaybackRef.current) return;

    const goal = getBufferGoal(video);
    if (getBufferedSeconds(video) + 0.25 < goal) {
      beginBuffering();
      return;
    }
    changePhase('playing');
  };

  const handlePause = () => {
    if (switchingSourceRef.current) return;
    if (phaseRef.current === 'playing') changePhase('paused');
    if (phaseRef.current === 'buffering') {
      stopPolling();
      videoRef.current && (videoRef.current.muted = wasMutedRef.current);
      changePhase('paused');
    }
  };

  const handleEnded = () => {
    const video = videoRef.current;
    if (!video) return;
    changePhase('paused');
    onPlaybackEnd(id, video);
  };

  const handleError = () => {
    switchingSourceRef.current = false;
    stopPolling();
    changePhase('error');
  };

  const handleQualityChange = (nextQuality: VideoQuality) => {
    if (nextQuality === quality || (nextQuality === '2K' && !video2kUrl)) return;

    const video = videoRef.current;
    if (sourceMounted && video) {
      pendingSourceChangeRef.current = {
        currentTime: video.currentTime,
        resume: phaseRef.current === 'playing' || phaseRef.current === 'buffering',
      };
      switchingSourceRef.current = true;
      stopPolling();
      video.pause();
      video.muted = wasMutedRef.current;
      changePhase(pendingSourceChangeRef.current.resume ? 'buffering' : 'paused');
    }

    setQuality(nextQuality);
  };

  const progress = bufferGoal > 0
    ? Math.min(100, Math.round((bufferedSeconds / bufferGoal) * 100))
    : 100;
  const qualityLabel = quality === '1080P' ? '1K' : '2K';

  return (
    <div className="tutorial-video-player" data-video-id={id} data-player-phase={phase} data-video-quality={quality}>
      {!sourceMounted && posterUrl && (
        <img
          className="tutorial-video-poster"
          src={posterUrl}
          alt=""
          loading={eagerPoster ? 'eager' : 'lazy'}
          fetchPriority={eagerPoster ? 'high' : 'low'}
          decoding="async"
        />
      )}

      <video
        ref={videoRef}
        className="tutorial-video-element"
        controls={sourceMounted && phase !== 'buffering'}
        preload="none"
        playsInline
        poster={sourceMounted ? posterUrl : undefined}
        src={sourceMounted ? selectedVideoUrl : undefined}
        aria-label={title}
        onLoadedMetadata={updateBufferProgress}
        onProgress={updateBufferProgress}
        onCanPlayThrough={updateBufferProgress}
        onPlay={handleNativePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleError}
      >
        {notSupportedText}
      </video>

      {video2kUrl && (
        <div className={`tutorial-video-quality${sourceMounted ? ' with-controls' : ''}`} role="group" aria-label="视频清晰度">
          {(['1080P', '2K'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={quality === option ? 'active' : ''}
              aria-pressed={quality === option}
              onClick={() => handleQualityChange(option)}
            >
              {option === '1080P' ? '1K' : '2K'}
            </button>
          ))}
        </div>
      )}

      {phase === 'idle' && (
        <button
          className="tutorial-video-action"
          type="button"
          onClick={handleInitialPlay}
          aria-label={`播放 ${title}`}
        >
          <span className="tutorial-video-play-icon" aria-hidden="true"><Play size={26} fill="currentColor" /></span>
          <span>点击播放</span>
        </button>
      )}

      {phase === 'buffering' && (
        <div className="tutorial-video-buffering" role="status" aria-live="polite">
          <LoaderCircle className="tutorial-video-spinner" size={28} aria-hidden="true" />
          <strong>正在预缓冲 {qualityLabel} · 20 秒内容</strong>
          <span>已缓冲 {Math.floor(bufferedSeconds)} / {Math.ceil(bufferGoal)} 秒</span>
          <div className="tutorial-video-progress" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {phase === 'ready' && (
        <button className="tutorial-video-action" type="button" onClick={beginBuffering}>
          <span className="tutorial-video-play-icon" aria-hidden="true"><Play size={26} fill="currentColor" /></span>
          <span>点击继续缓冲</span>
        </button>
      )}

      {phase === 'error' && (
        <button className="tutorial-video-error" type="button" onClick={() => window.location.reload()}>
          <AlertCircle size={22} aria-hidden="true" />
          <span>视频加载失败，点击重试</span>
        </button>
      )}
    </div>
  );
};

export default TutorialVideoPlayer;
