// @ts-nocheck
import { backendProxyAdapter } from '@/services/adapters/backend-proxy-adapter';
import { generationHistoryManager } from '@/services/generation-history';

export type VideoModelType = 'doubao';

export interface VideoModelConfig {
  type: VideoModelType;
  apiKey?: string;
  accessKey?: string;
  secretKey?: string;
  modelId?: string;
}

export interface ContinuousVideoSegment {
  id: string;
  taskId: string;
  startImage: string;
  endImage: string;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  lastFrameUrl?: string;
  segmentIndex: number;
  error?: string;
}

export interface ContinuousVideoConfig {
  totalSegments: number;
  duration: number;
  resolution: string;
  fps?: number;
  seamless: boolean;
  seed?: number;
  generateAudio?: boolean;
}

export interface ContinuousVideoSession {
  id: string;
  config: ContinuousVideoConfig;
  segments: ContinuousVideoSegment[];
  currentSegmentIndex: number;
  status: 'preparing' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  finalVideoUrls: string[];
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export type SegmentCallback = (
  segment: ContinuousVideoSegment,
  session: ContinuousVideoSession
) => void;

export type SessionCallback = (session: ContinuousVideoSession) => void;

export type ErrorCallback = (error: Error, session: ContinuousVideoSession) => void;

class ContinuousVideoService {
  private static instance: ContinuousVideoService;
  private currentModelType: VideoModelType = 'doubao';
  private historyManager = generationHistoryManager;
  private sessions: Map<string, ContinuousVideoSession> = new Map();
  private pollIntervals: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private callbacks: Map<string, {
    onSegmentComplete?: SegmentCallback;
    onSessionComplete?: SessionCallback;
    onError?: ErrorCallback;
    onProgress?: SegmentCallback;
  }> = new Map();

  static getInstance(): ContinuousVideoService {
    if (!ContinuousVideoService.instance) {
      ContinuousVideoService.instance = new ContinuousVideoService();
    }
    return ContinuousVideoService.instance;
  }

  setAdapter(_adapter: unknown) {
    this.currentModelType = 'doubao';
  }

  setAdapterWithConfig(_apiKey: string, _modelId?: string) {
    this.currentModelType = 'doubao';
  }

  getCurrentModelType(): VideoModelType {
    return this.currentModelType;
  }

  createSession(
    config: Partial<ContinuousVideoConfig> & { totalSegments: number }
  ): ContinuousVideoSession {
    const session: ContinuousVideoSession = {
      id: `continuous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      config: {
        totalSegments: config.totalSegments,
        duration: config.duration || 5,
        resolution: config.resolution || '720p',
        fps: config.fps || 24,
        seamless: config.seamless ?? true,
        seed: config.seed ?? -1,
        generateAudio: config.generateAudio ?? false,
      },
      segments: [],
      currentSegmentIndex: 0,
      status: 'preparing',
      finalVideoUrls: [],
      createdAt: new Date(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async startGeneration(
    sessionId: string,
    prompts: string[],
    startImages: string[],
    callbacks?: {
      onSegmentComplete?: SegmentCallback;
      onSessionComplete?: SessionCallback;
      onError?: ErrorCallback;
      onProgress?: SegmentCallback;
    }
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (prompts.length !== session.config.totalSegments) {
      throw new Error(`Prompts count (${prompts.length}) does not match session config (${session.config.totalSegments})`);
    }

    if (startImages.length !== session.config.totalSegments) {
      throw new Error(`Start images count (${startImages.length}) does not match session config (${session.config.totalSegments})`);
    }

    this.callbacks.set(sessionId, callbacks || {});
    session.status = 'running';

    for (let i = 0; i < session.config.totalSegments; i++) {
      const segment: ContinuousVideoSegment = {
        id: `segment_${i}_${Date.now()}`,
        taskId: '',
        startImage: startImages[i],
        endImage: '',
        prompt: prompts[i],
        status: 'pending',
        segmentIndex: i,
      };
      session.segments.push(segment);
    }

    await this.generateNextSegment(session);
  }

  private async generateNextSegment(session: ContinuousVideoSession): Promise<void> {
    if (session.status === 'cancelled') {
      return;
    }

    if (session.currentSegmentIndex >= session.config.totalSegments) {
      session.status = 'completed';
      session.completedAt = new Date();
      this.callbacks.get(session.id)?.onSessionComplete?.(session);
      return;
    }

    const currentSegment = session.segments[session.currentSegmentIndex];
    currentSegment.status = 'processing';

    try {
      let result: any;

      const generationMode = session.currentSegmentIndex === 0 ? 'image_to_video' : 'first_last_frame';

      result = await backendProxyAdapter.generateVideo({
        prompt: currentSegment.prompt,
        modelProvider: this.currentModelType,
        generationMode: generationMode as 'image_to_video' | 'first_last_frame',
        startImage: currentSegment.startImage,
        endImage: currentSegment.endImage || undefined,
        duration: session.config.duration,
        resolution: session.config.resolution,
        fps: session.config.fps,
        seed: session.config.seed,
        generateAudio: session.config.generateAudio,
      });

      if (result.taskId) {
        currentSegment.taskId = result.taskId;
        this.pollTaskStatus(session, currentSegment);
      } else {
        throw new Error('Failed to create generation task');
      }
    } catch (error) {
      console.error(`[ContinuousVideoService] 片段 ${session.currentSegmentIndex + 1} 生成失败:`, error);
      currentSegment.status = 'failed';
      currentSegment.error = error instanceof Error ? error.message : String(error);
      session.status = 'failed';
      session.error = currentSegment.error;
      this.callbacks.get(session.id)?.onError?.(
        error instanceof Error ? error : new Error(String(error)),
        session
      );
    }
  }

  private convertResolution(resolution: string): string {
    const sizeMap: Record<string, string> = {
      '480p': '540p',
      '720p': '720p',
      '1080p': '1080p',
      '4k': '1080p',
    };
    return sizeMap[resolution] || '720p';
  }

  private pollTaskStatus(session: ContinuousVideoSession, segment: ContinuousVideoSegment): void {
    const pollKey = `${session.id}_${segment.id}`;

    const poll = async () => {
      if (session.status === 'cancelled') {
        this.pollIntervals.delete(pollKey);
        return;
      }

      try {
        const status = await backendProxyAdapter.getTaskStatus({ taskId: segment.taskId });

        if (status.status === 'completed') {
          segment.status = 'completed';
          segment.videoUrl = status.output;

          this.historyManager.addRecord({
            nodeId: segment.id,
            type: 'video',
            prompt: segment.prompt,
            resultUrl: segment.videoUrl,
            status: 'completed',
            progress: 100,
            config: { modelProvider: 'doubao', model: 'default' },
          });

          this.callbacks.get(session.id)?.onSegmentComplete?.(segment, { ...session });

          if (session.config.seamless && session.currentSegmentIndex < session.config.totalSegments - 1) {
            const nextSegment = session.segments[session.currentSegmentIndex + 1];
            nextSegment.startImage = segment.videoUrl;
          }

          session.currentSegmentIndex++;
          this.sessions.set(session.id, { ...session });

          this.generateNextSegment(session);
        } else if (status.status === 'failed') {
          segment.status = 'failed';
          segment.error = status.message;
          session.status = 'failed';
          session.error = status.message;
          console.error(`[ContinuousVideoService] 片段 ${segment.segmentIndex + 1} 失败:`, status.message);
          this.callbacks.get(session.id)?.onError?.(new Error(status.message), session);
        } else {
          this.callbacks.get(session.id)?.onProgress?.(segment, { ...session });
          const intervalId = setTimeout(poll, 3000);
          this.pollIntervals.set(pollKey, intervalId);
        }
      } catch (error) {
        console.error(`[ContinuousVideoService] 轮询片段 ${segment.segmentIndex + 1} 状态失败:`, error);
        const intervalId = setTimeout(poll, 5000);
        this.pollIntervals.set(pollKey, intervalId);
      }
    };

    const intervalId = setTimeout(poll, 3000);
    this.pollIntervals.set(pollKey, intervalId);
  }

  cancelSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'cancelled';
    }

    const callbacks = this.callbacks.get(sessionId);
    if (callbacks) {
      this.callbacks.delete(sessionId);
    }

    const intervalsToDelete: string[] = [];
    this.pollIntervals.forEach((interval, key) => {
      if (key.startsWith(sessionId)) {
        clearTimeout(interval);
        intervalsToDelete.push(key);
      }
    });
    intervalsToDelete.forEach(key => this.pollIntervals.delete(key));
  }

  pauseSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.status === 'running') {
      const currentPollKey = `${sessionId}_${session.segments[session.currentSegmentIndex]?.id}`;
      const interval = this.pollIntervals.get(currentPollKey);
      if (interval) {
        clearTimeout(interval);
        this.pollIntervals.delete(currentPollKey);
      }
      session.status = 'paused';
    }
  }

  resumeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.status === 'paused') {
      session.status = 'running';
      this.generateNextSegment(session);
    }
  }

  getSession(sessionId: string): ContinuousVideoSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): ContinuousVideoSession[] {
    return Array.from(this.sessions.values());
  }

  deleteSession(sessionId: string): void {
    this.cancelSession(sessionId);
    this.sessions.delete(sessionId);
  }

  getActiveSession(): ContinuousVideoSession | undefined {
    const sessions = this.getAllSessions();
    return sessions.find(s => s.status === 'running' || s.status === 'preparing' || s.status === 'paused');
  }
}

export const continuousVideoService = ContinuousVideoService.getInstance();
