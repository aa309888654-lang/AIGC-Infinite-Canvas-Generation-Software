import { httpClient } from './http-client';
import { ApiLogger } from './logger';

export type HeartbeatStatus = 'idle' | 'running' | 'stopped' | 'error';

export interface HeartbeatConfig {
  url: string;
  interval: number;
  timeout: number;
  maxRetries: number;
  onStatusChange?: (status: HeartbeatStatus) => void;
  onSuccess?: (latency: number) => void;
  onError?: (error: Error, retries: number) => void;
  onMaxRetriesReached?: () => void;
}

export interface HeartbeatResult {
  success: boolean;
  latency: number;
  timestamp: number;
  error?: string;
}

const DEFAULT_CONFIG: Partial<HeartbeatConfig> = {
  interval: 30000,
  timeout: 5000,
  maxRetries: 3,
};

export class HeartbeatService {
  private config: HeartbeatConfig | null = null;
  private status: HeartbeatStatus = 'idle';
  private intervalId: NodeJS.Timeout | null = null;
  private currentRetries: number = 0;
  private lastResult: HeartbeatResult | null = null;
  private listeners: Set<(result: HeartbeatResult) => void> = new Set();

  public configure(config: HeartbeatConfig): void {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    ApiLogger.info('[Heartbeat] Service configured', this.config);
  }

  public start(): void {
    if (!this.config) {
      ApiLogger.error('[Heartbeat] Service not configured');
      return;
    }

    if (this.status === 'running') {
      ApiLogger.warn('[Heartbeat] Service already running');
      return;
    }

    this.status = 'running';
    this.currentRetries = 0;
    this.notifyStatusChange();
    
    this.pulse();
    this.intervalId = setInterval(() => {
      this.pulse();
    }, this.config.interval);

    ApiLogger.info('[Heartbeat] Service started');
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.status = 'stopped';
    this.notifyStatusChange();
    ApiLogger.info('[Heartbeat] Service stopped');
  }

  public restart(): void {
    this.stop();
    setTimeout(() => {
      this.start();
    }, 100);
  }

  public async pulse(): Promise<HeartbeatResult> {
    if (!this.config || this.status !== 'running') {
      return { success: false, latency: 0, timestamp: Date.now(), error: 'Service not running' };
    }

    const startTime = Date.now();
    
    try {
      const response = await httpClient.get(this.config.url, undefined, {
        timeout: this.config.timeout,
      });

      const latency = Date.now() - startTime;
      this.lastResult = {
        success: response.success,
        latency,
        timestamp: Date.now(),
      };

      this.currentRetries = 0;

      if (response.success && this.config.onSuccess) {
        this.config.onSuccess(latency);
      }

      this.notifyListeners(this.lastResult);
      ApiLogger.debug(`[Heartbeat] Pulse successful, latency: ${latency}ms`);

      return this.lastResult;
    } catch (error) {
      return this.handlePulseError(error as Error, startTime);
    }
  }

  private async handlePulseError(error: Error, startTime: number): Promise<HeartbeatResult> {
    if (!this.config) {
      return { success: false, latency: 0, timestamp: Date.now(), error: 'Config not found' };
    }

    this.currentRetries++;
    const latency = Date.now() - startTime;

    if (this.config.onError) {
      this.config.onError(error, this.currentRetries);
    }

    if (this.currentRetries >= this.config.maxRetries) {
      this.lastResult = {
        success: false,
        latency,
        timestamp: Date.now(),
        error: error.message,
      };

      if (this.config.onMaxRetriesReached) {
        this.config.onMaxRetriesReached();
      }

      this.status = 'error';
      this.notifyStatusChange();
      ApiLogger.error(`[Heartbeat] Max retries reached, error: ${error.message}`);
    } else {
      ApiLogger.warn(`[Heartbeat] Pulse failed, retry ${this.currentRetries}/${this.config.maxRetries}: ${error.message}`);
      
      await new Promise(resolve => setTimeout(resolve, 1000 * this.currentRetries));
      return this.pulse();
    }

    this.notifyListeners(this.lastResult);
    return this.lastResult;
  }

  public getStatus(): HeartbeatStatus {
    return this.status;
  }

  public getLastResult(): HeartbeatResult | null {
    return this.lastResult;
  }

  public getRetries(): number {
    return this.currentRetries;
  }

  public subscribe(callback: (result: HeartbeatResult) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(result: HeartbeatResult): void {
    this.listeners.forEach(callback => {
      try {
        callback(result);
      } catch (error) {
        ApiLogger.error('[Heartbeat] Listener error:', error);
      }
    });
  }

  private notifyStatusChange(): void {
    if (this.config?.onStatusChange) {
      try {
        this.config.onStatusChange(this.status);
      } catch (error) {
        ApiLogger.error('[Heartbeat] Status change callback error:', error);
      }
    }
  }

  public destroy(): void {
    this.stop();
    this.listeners.clear();
    this.config = null;
    ApiLogger.info('[Heartbeat] Service destroyed');
  }
}

export const heartbeatService = new HeartbeatService();
export default heartbeatService;
