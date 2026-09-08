import { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from '@/lib/logger';

export type PlaybackMode = 'normal' | 'repeat-one' | 'repeat-all' | 'shuffle';

interface UseMusicPlayerOptions {
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

export const useMusicPlayer = (options: UseMusicPlayerOptions = {}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('normal');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const initializeAudio = useCallback((src: string) => {
    logger.debug('[useMusicPlayer] Initializing audio with src:', src);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    setIsLoading(true);
    
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;
    
    audio.addEventListener('loadedmetadata', () => {
      logger.debug('[useMusicPlayer] Metadata loaded, duration:', audio.duration);
      setDuration(audio.duration);
      setIsLoading(false);
    });
    
    audio.addEventListener('canplay', () => {
      logger.debug('[useMusicPlayer] Can play');
      setIsLoading(false);
    });
    
    audio.addEventListener('canplaythrough', () => {
      logger.debug('[useMusicPlayer] Can play through');
      setIsLoading(false);
    });
    
    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
      optionsRef.current.onTimeUpdate?.(audio.currentTime, audio.duration);
    });
    
    audio.addEventListener('play', () => {
    logger.debug('[useMusicPlayer] Play event');
      setIsPlaying(true);
    });
    
    audio.addEventListener('pause', () => {
    logger.debug('[useMusicPlayer] Pause event');
      setIsPlaying(false);
    });
    
    audio.addEventListener('ended', () => {
    logger.debug('[useMusicPlayer] Ended event');
      setIsPlaying(false);
      optionsRef.current.onEnded?.();
    });
    
    audio.addEventListener('error', (e) => {
      console.error('[useMusicPlayer] Audio error:', e);
      console.error('[useMusicPlayer] Error code:', audio.error?.code);
      console.error('[useMusicPlayer] Error message:', audio.error?.message);
      setIsLoading(false);
      setIsPlaying(false);
    });
    
    audio.volume = volume;
    audio.src = src;
    audio.load();
  }, [volume]); // Empty deps - no external dependencies

  const play = useCallback(async () => {
    logger.debug('[useMusicPlayer] Play called');
    if (audioRef.current) {
      try {
        await audioRef.current.play();
        logger.info('[useMusicPlayer] Play started successfully');
      } catch (error) {
        console.error('[useMusicPlayer] Play failed:', error);
      }
    } else {
      console.warn('[useMusicPlayer] No audio element to play');
    }
  }, []);

  const pause = useCallback(() => {
    logger.debug('[useMusicPlayer] Pause called');
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const skipForward = useCallback((seconds = 10) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(audioRef.current.currentTime + seconds, duration);
    }
  }, [duration]);

  const skipBackward = useCallback((seconds = 10) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(audioRef.current.currentTime - seconds, 0);
    }
  }, []);

  const setAudioVolume = useCallback((vol: number) => {
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
    if (vol > 0) {
      setIsMuted(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const cyclePlaybackMode = useCallback(() => {
    const modes: PlaybackMode[] = ['normal', 'repeat-one', 'repeat-all', 'shuffle'];
    const currentIndex = modes.indexOf(playbackMode);
    setPlaybackMode(modes[(currentIndex + 1) % modes.length]);
  }, [playbackMode]);

  const cyclePlaybackSpeed = useCallback(() => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const newSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  }, [playbackSpeed]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return {
    audioRef,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackMode,
    playbackSpeed,
    isLoading,
    initializeAudio,
    play,
    pause,
    togglePlay,
    seek,
    skipForward,
    skipBackward,
    setVolume: setAudioVolume,
    toggleMute,
    cyclePlaybackMode,
    cyclePlaybackSpeed,
    formatTime,
  };
};

export default useMusicPlayer;
