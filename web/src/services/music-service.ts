import { getAuthToken } from '@/lib/auth-check';
import { apiClient } from '@/lib/api-client';
import { BACKEND_URL } from '@/lib/api-config';

function getMusicDownloadUrl(rawUrl: string): string {
  const targetUrl = new URL(rawUrl, window.location.origin);
  const backendOrigin = new URL(BACKEND_URL, window.location.origin).origin;
  if (targetUrl.origin === window.location.origin || targetUrl.origin === backendOrigin) {
    return targetUrl.toString();
  }
  return `${BACKEND_URL}/api/v1/audio/proxy-download?url=${encodeURIComponent(targetUrl.toString())}`;
}

export interface LyricsGenerationParams {
  prompt: string;
  title?: string;
  genre?: string;
  style?: string;
  mode?: 'write_full_song' | 'edit';
  existingLyrics?: string;
  model?: string;
  language?: string;
}

export interface LyricsGenerationResult {
  taskId?: string;
  task_id?: string;
  lyrics: string;
  songTitle?: string;
  song_title?: string;
  styleTags?: string[];
  style_tags?: string[];
  status: 'completed' | 'processing';
}

export interface MusicGenerationParams {
  model: string;
  lyrics_id?: string;
  custom_lyrics?: string;
  prompt?: string;
  instrumental?: boolean;
  duration?: number;
  audioSetting?: {
    format?: 'mp3' | 'wav' | 'flac';
    sampleRate?: number;
    bitrate?: number;
  };
}

export type AudioFormat = 'mp3' | 'wav' | 'flac';

export interface FavoriteParams {
  songId: string;
  action: 'add' | 'remove';
}

export interface ShareParams {
  songId: string;
  platform?: 'copy' | 'wechat' | 'weibo' | 'twitter';
}

export interface ShareResult {
  shareUrl: string;
  qrCode?: string;
}

export interface AudioAnalysisResult {
  bpm: number;
  key: string;
  sections: AudioSection[];
  waveform: number[];
}

export interface AudioSection {
  startTime: number;
  endTime: number;
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro';
  energy: number;
}

export interface MixProject {
  id: string;
  name: string;
  tracks: MixTrack[];
  createdAt: string;
}

export interface MixTrack {
  id: string;
  audioUrl: string;
  name: string;
  volume: number;
  startTime: number;
  duration: number;
  muted: boolean;
}

export interface MusicGenerationResult {
  taskId?: string;
  task_id?: string;
  minimaxTaskId?: string;
  status: 'completed' | 'processing' | 'success';
  audioUrl?: string;
  audio_url?: string;
  extraAudioUrl?: string;
  lrc?: string;
  output?: { lrc?: string };
  imageUrl?: string;
  image_url?: string;
  lrc_url?: string;
}

export interface MusicCoverParams {
  model: string;
  audio_url?: string;
  audio_file?: File;
  prompt?: string;
  musicTitle?: string;
  lyrics?: string;
  mode?: string;
}

export interface MusicCoverResult {
  taskId?: string;
  task_id?: string;
  status: 'completed' | 'processing' | 'success';
  audioUrl?: string;
  audio_url?: string;
  extraAudioUrl?: string;
}

export interface CoverImageParams {
  prompt: string;
  musicTitle?: string;
}

export interface CoverImageResult {
  taskId?: string;
  task_id?: string;
  status: 'completed' | 'processing' | 'success';
  imageUrl?: string;
  image_url?: string;
}

export interface TaskStatusResult {
  taskId?: string;
  task_id?: string;
  status: 'pending' | 'processing' | 'success' | 'fail' | 'Success' | 'Fail';
  task_status?: string;
  audioUrl?: string;
  audio_url?: string;
  lrc?: string;
  lrcUrl?: string;
  lrc_url?: string;
  imageUrl?: string;
  image_url?: string;
  fail_reason?: string;
  output?: {
    audioUrl?: string;
    audio_url?: string;
    lrc?: string;
    lrcUrl?: string;
    lrc_url?: string;
    imageUrl?: string;
    image_url?: string;
  };
}

export interface SongInfo {
  title: string;
  artist: string;
  composer: string;
  lyricist: string;
  arranger: string;
  producer: string;
  album: string;
  genre: string;
  year: string;
  comment: string;
}

export interface SavedSong {
  id: string;
  title: string;
  lyrics: string;
  lrc?: string;
  audioUrl: string;
  coverImageUrl?: string;
  songInfo: SongInfo;
  createdAt: string;
}

class MusicService {
  private pollInterval: number = 3000;
  private maxPollAttempts: number = 200;

  async generateLyrics(params: LyricsGenerationParams): Promise<LyricsGenerationResult> {
    try {
      const payload = {
        ...params,
        model: params.model || 'lyrics_generation',
      };
      const response = await apiClient.post<{ success: boolean; data: LyricsGenerationResult } | LyricsGenerationResult>(
        '/audio/lyrics-generate',
        payload
      );
      return (response as any).data || response;
    } catch (error) {
      console.error('[MusicService] Failed to generate lyrics:', error);
      throw error;
    }
  }

  async checkLyricsStatus(lyricsId: string): Promise<TaskStatusResult> {
    try {
      const response = await apiClient.get<{ success: boolean; data: TaskStatusResult } | TaskStatusResult>(
        `/audio/lyrics-query?lyrics_id=${lyricsId}`
      );
      return (response as any).data || response;
    } catch (error) {
      console.error('[MusicService] Failed to check lyrics status:', error);
      throw error;
    }
  }

  async generateMusic(params: MusicGenerationParams): Promise<MusicGenerationResult> {
    try {
      const payload: Record<string, any> = {
        model: params.model,
        prompt: params.prompt,
        lyrics: params.custom_lyrics || '',
      };
      if (params.instrumental !== undefined) payload.instrumental = params.instrumental;
      if (params.audioSetting) payload.audioSetting = params.audioSetting;
      const response = await apiClient.post<{ success: boolean; data: MusicGenerationResult } | MusicGenerationResult>('/audio/music-generate', payload);
      return (response as any).data || response;
    } catch (error) {
      console.error('[MusicService] Failed to generate music:', error);
      throw error;
    }
  }

  async checkMusicStatus(taskId: string): Promise<TaskStatusResult> {
    try {
      const response = await apiClient.get<{ success: boolean; data: TaskStatusResult } | TaskStatusResult>(
        `/audio/music-query?task_id=${taskId}`
      );
      return (response as any).data || response;
    } catch (error) {
      console.error('[MusicService] Failed to check music status:', error);
      throw error;
    }
  }

  async generateCoverImage(params: CoverImageParams): Promise<CoverImageResult> {
    try {
      const response = await apiClient.post<{ success: boolean; data: CoverImageResult } | CoverImageResult>('/audio/music-cover-image', params);
      return (response as any).data || response;
    } catch (error) {
      console.error('[MusicService] Failed to generate cover image:', error);
      throw error;
    }
  }

  async checkCoverImageStatus(taskId: string): Promise<TaskStatusResult> {
    try {
      const response = await apiClient.get<{ success: boolean; data: TaskStatusResult } | TaskStatusResult>(
        `/audio/image-query?task_id=${taskId}`
      );
      return (response as any).data || response;
    } catch (error) {
      console.error('[MusicService] Failed to check cover image status:', error);
      throw error;
    }
  }

  async preprocessCover(params: MusicCoverParams): Promise<MusicCoverResult> {
    try {
      const formData = new FormData();

      if (params.audio_url) {
        formData.append('audio_url', params.audio_url);
      }
      if (params.audio_file) {
        formData.append('audio_file', params.audio_file);
      }
      if (params.prompt) {
        formData.append('prompt', params.prompt);
      }
      if (params.lyrics) {
        formData.append('lyrics', params.lyrics);
      }
      if (params.mode) {
        formData.append('mode', params.mode);
      }
      formData.append('model', params.model || 'music-cover');

      const response = await fetch(`${apiClient['baseURL']}/audio/music-cover-image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAuthToken() || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: params.model || 'image-01',
          prompt: params.prompt,
          music_title: params.musicTitle,
          audio_url: params.audio_url,
          lyrics: params.lyrics,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return (result as any).data || result;
    } catch (error) {
      console.error('[MusicService] Failed to preprocess cover:', error);
      throw error;
    }
  }

  async pollTaskStatus(
    taskId: string,
    type: 'lyrics' | 'music' | 'image',
    onProgress?: (status: TaskStatusResult) => void
  ): Promise<TaskStatusResult> {
    const checkStatus = async (attempt: number): Promise<TaskStatusResult> => {
      if (attempt >= this.maxPollAttempts) {
        throw new Error('Task polling timeout');
      }

      let status: TaskStatusResult;
      if (type === 'lyrics') {
        status = await this.checkLyricsStatus(taskId);
      } else if (type === 'music') {
        status = await this.checkMusicStatus(taskId);
      } else {
        status = await this.checkCoverImageStatus(taskId);
      }

      if (onProgress) {
        onProgress(status);
      }

      if (status.status === 'success' || status.status === 'Success') {
        return status;
      }

      if (status.status === 'fail' || status.status === 'Fail') {
        throw new Error(status.fail_reason || 'Task failed');
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
      return checkStatus(attempt + 1);
    };

    return checkStatus(0);
  }

  async saveSong(songData: {
    title: string;
    lyrics: string;
    lrc?: string;
    audioUrl: string;
    coverImageUrl?: string;
    songInfo: SongInfo;
  }): Promise<{ id: string; success: boolean; audioFileId?: string; coverFileId?: string }> {
    try {
      const savedFiles: { audioFileId?: string; coverFileId?: string } = {};

      if (songData.audioUrl) {
        try {
          const audioResponse = await apiClient.post<{ success: boolean; fileId?: string; id?: string }>(
            '/files/upload-url',
            {
              url: songData.audioUrl,
              type: 'audio',
              name: `${songData.title || 'song'}.mp3`,
              folder: 'audio',
            }
          );
          if (audioResponse.success) {
            savedFiles.audioFileId = audioResponse.fileId || audioResponse.id;
          }
        } catch (audioError) {
          console.error('[MusicService] Failed to save audio file:', audioError);
        }
      }

      if (songData.coverImageUrl) {
        try {
          const coverResponse = await apiClient.post<{ success: boolean; fileId?: string; id?: string }>(
            '/files/upload-url',
            {
              url: songData.coverImageUrl,
              type: 'image',
              name: `${songData.title || 'song'}_cover.png`,
              folder: 'images',
            }
          );
          if (coverResponse.success) {
            savedFiles.coverFileId = coverResponse.fileId || coverResponse.id;
          }
        } catch (coverError) {
          console.error('[MusicService] Failed to save cover image:', coverError);
        }
      }

      const songRecord = await apiClient.post<{ id: string; success: boolean }>(
        '/audio/songs/save',
        {
          ...songData,
          audioFileId: savedFiles.audioFileId,
          coverFileId: savedFiles.coverFileId,
        }
      );

      return {
        ...songRecord,
        ...savedFiles,
      };
    } catch (error) {
      console.error('[MusicService] Failed to save song:', error);
      throw error;
    }
  }

  async deleteSong(songId: string): Promise<{ success: boolean }> {
    try {
      const response = await apiClient.delete<{ success: boolean }>(`/audio/songs/${songId}`);
      return response;
    } catch (error) {
      console.error('[MusicService] Failed to delete song:', error);
      throw error;
    }
  }

  async getSongHistory(): Promise<SavedSong[]> {
    try {
      const response = await apiClient.get<SavedSong[]>('/audio/songs/history');
      return response;
    } catch (error) {
      console.error('[MusicService] Failed to get song history:', error);
      throw error;
    }
  }

  async toggleFavorite(songId: string, action: 'add' | 'remove'): Promise<{ success: boolean }> {
    try {
      const response = await apiClient.post<{ success: boolean }>(
        '/audio/songs/favorite',
        { songId, action }
      );
      return response;
    } catch (error) {
      console.error('[MusicService] Failed to toggle favorite:', error);
      throw error;
    }
  }

  async generateShareLink(songId: string): Promise<ShareResult> {
    try {
      const response = await apiClient.post<ShareResult>(
        '/audio/songs/share',
        { songId }
      );
      return response;
    } catch (error) {
      console.error('[MusicService] Failed to generate share link:', error);
      throw error;
    }
  }

  async downloadAudio(audioUrl: string, filename: string, coverUrl?: string, songInfo?: any): Promise<void> {
    try {
      const token = getAuthToken();
      const response = await fetch(getMusicDownloadUrl(audioUrl), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error(`下载失败: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();

      let finalBuffer = arrayBuffer;

      // 如果有封面或歌曲信息，尝试写入 ID3 标签
      if (coverUrl || songInfo) {
        try {
          const browserId3WriterModule = await import('browser-id3-writer');
          const ID3Writer = browserId3WriterModule.default || browserId3WriterModule;
          const writer = new (ID3Writer as any)(arrayBuffer);

          if (songInfo) {
            if (songInfo.title) writer.setFrame('TIT2', songInfo.title);
            if (songInfo.artist) writer.setFrame('TPE1', [songInfo.artist]);
            if (songInfo.album) writer.setFrame('TALB', songInfo.album);
            if (songInfo.year) writer.setFrame('TYER', songInfo.year);
            if (songInfo.comment) writer.setFrame('COMM', { description: '', text: songInfo.comment });
          }

          if (coverUrl) {
            const coverResponse = await fetch(getMusicDownloadUrl(coverUrl), {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const coverBuffer = await coverResponse.arrayBuffer();
            writer.setFrame('APIC', {
              type: 3,
              data: coverBuffer,
              description: 'Cover',
            });
          }

          writer.addTag();
          finalBuffer = writer.arrayBuffer;
        } catch (id3Error) {
          console.error('[MusicService] Failed to write ID3 tags:', id3Error);
          // 如果写入失败，静默回退到原始音频
        }
      }

      const blob = new Blob([finalBuffer], { type: 'audio/mpeg' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename.endsWith('.mp3') ? filename : `${filename}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[MusicService] Failed to download audio:', error);
      throw error;
    }
  }

  async downloadCoverImage(imageUrl: string, filename: string): Promise<void> {
    try {
      const token = getAuthToken();
      const response = await fetch(getMusicDownloadUrl(imageUrl), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[MusicService] Failed to download cover image:', error);
      throw error;
    }
  }
}

export const musicService = new MusicService();
