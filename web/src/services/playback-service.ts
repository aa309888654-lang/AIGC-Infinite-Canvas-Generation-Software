/**
 * playback-service — 播放服务（存根）
 *
 * AI剪辑板块已移除，此文件保留空实现以维持编译兼容。
 */

export class PlaybackService {
  async play(_timelineId?: string): Promise<void> {
    // no-op
  }

  async pause(): Promise<void> {
    // no-op
  }

  async seek(_time: number): Promise<void> {
    // no-op
  }
}

export const playbackService = new PlaybackService();