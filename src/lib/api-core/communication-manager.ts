import { httpClient } from './http-client';
import type { HttpClient } from './http-client';
import { heartbeatService } from './heartbeat-service';
import type { HeartbeatService, HeartbeatStatus } from './heartbeat-service';
import { webSocketService } from './websocket-service';
import type { WebSocketService, WebSocketStatus, WebSocketMessage } from './websocket-service';
import { ApiLogger } from './logger';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface CommunicationConfig {
  apiBaseURL?: string;
  wsUrl?: string;
  authToken?: string;
  heartbeatURL?: string;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  heartbeatMaxRetries?: number;
  wsReconnectInterval?: number;
  wsReconnectMaxAttempts?: number;
  wsHeartbeatInterval?: number;
  wsHeartbeatTimeout?: number;
  autoConnect?: boolean;
}

export interface CommunicationState {
  status: ConnectionStatus;
  httpStatus: 'idle' | 'ready';
  heartbeatStatus: HeartbeatStatus;
  webSocketStatus: WebSocketStatus;
  lastHeartbeat: number | null;
  lastWebSocketMessage: WebSocketMessage | null;
}

const DEFAULT_CONFIG: Partial<CommunicationConfig> = {
  heartbeatInterval: 30000,
  heartbeatTimeout: 5000,
  heartbeatMaxRetries: 3,
  wsReconnectInterval: 3000,
  wsReconnectMaxAttempts: 5,
  wsHeartbeatInterval: 30000,
  wsHeartbeatTimeout: 10000,
  autoConnect: false,
};

class CommunicationManager {
  private static instance: CommunicationManager;
  private config: CommunicationConfig = {};
  private state: CommunicationState = {
    status: 'disconnected',
    httpStatus: 'idle',
    heartbeatStatus: 'idle',
    webSocketStatus: 'disconnected',
    lastHeartbeat: null,
    lastWebSocketMessage: null,
  };
  private listeners: Set<(state: CommunicationState) => void> = new Set();

  private constructor() { /* noop */ }

  public static getInstance(): CommunicationManager {
    if (!CommunicationManager.instance) {
      CommunicationManager.instance = new CommunicationManager();
    }
    return CommunicationManager.instance;
  }

  public configure(config: CommunicationConfig): void {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.apiBaseURL) {
      httpClient.configure({ baseURL: this.config.apiBaseURL });
    }
    
    if (this.config.authToken) {
      httpClient.setAuthToken(this.config.authToken);
    }

    if (this.config.heartbeatURL) {
      heartbeatService.configure({
        url: this.config.heartbeatURL,
        interval: this.config.heartbeatInterval || 30000,
        timeout: this.config.heartbeatTimeout || 5000,
        maxRetries: this.config.heartbeatMaxRetries || 3,
        onStatusChange: (status) => this.handleHeartbeatStatusChange(status),
        onSuccess: (latency) => this.handleHeartbeatSuccess(latency),
        onError: (error, retries) => this.handleHeartbeatError(error, retries),
        onMaxRetriesReached: () => this.handleHeartbeatMaxRetries(),
      });
    }

    if (this.config.wsUrl) {
      webSocketService.configure({
        url: this.config.wsUrl,
        reconnectInterval: this.config.wsReconnectInterval || 3000,
        reconnectMaxAttempts: this.config.wsReconnectMaxAttempts || 5,
        heartbeatInterval: this.config.wsHeartbeatInterval || 30000,
        heartbeatTimeout: this.config.wsHeartbeatTimeout || 10000,
        onStatusChange: (status) => this.handleWebSocketStatusChange(status),
        onMessage: (message) => this.handleWebSocketMessage(message),
        onError: (error) => this.handleWebSocketError(error),
        onOpen: () => this.handleWebSocketOpen(),
        onClose: (event) => this.handleWebSocketClose(event),
      });
    }

    this.updateStatus();
    ApiLogger.info('[CommunicationManager] Configuration complete', this.config);
  }

  public async connect(): Promise<void> {
    if (this.state.status === 'connected') {
      ApiLogger.warn('[CommunicationManager] Already connected');
      return;
    }

    this.updateState({ status: 'connecting' });

    try {
      if (heartbeatService) {
        heartbeatService.start();
      }

      if (webSocketService) {
        await webSocketService.connect();
      }

      this.updateState({ 
        status: 'connected',
        httpStatus: 'ready',
      });
      
      ApiLogger.info('[CommunicationManager] All services connected');
    } catch (error) {
      this.updateState({ status: 'error' });
      ApiLogger.error('[CommunicationManager] Connection failed', error);
      throw error;
    }
  }

  public disconnect(): void {
    heartbeatService.stop();
    webSocketService.disconnect();
    
    this.updateState({
      status: 'disconnected',
      httpStatus: 'idle',
    });
    
    ApiLogger.info('[CommunicationManager] All services disconnected');
  }

  public reconnect(): void {
    this.disconnect();
    setTimeout(() => {
      this.connect();
    }, 100);
  }

  public getHttpClient(): HttpClient {
    return httpClient;
  }

  public getHeartbeatService(): HeartbeatService {
    return heartbeatService;
  }

  public getWebSocketService(): WebSocketService {
    return webSocketService;
  }

  public getState(): CommunicationState {
    return { ...this.state };
  }

  public subscribe(callback: (state: CommunicationState) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private updateState(partial: Partial<CommunicationState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
    this.updateStatus();
  }

  private updateStatus(): void {
    if (this.state.status === 'connected') {
      this.notifyListeners();
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback(this.state);
      } catch (error) {
        ApiLogger.error('[CommunicationManager] Listener error', error);
      }
    });
  }

  private handleHeartbeatStatusChange(status: HeartbeatStatus): void {
    this.updateState({ heartbeatStatus: status });
    
    if (status === 'error') {
      ApiLogger.warn('[CommunicationManager] Heartbeat service error');
    }
  }

  private handleHeartbeatSuccess(latency: number): void {
    this.updateState({ lastHeartbeat: Date.now() });
    ApiLogger.debug(`[CommunicationManager] Heartbeat success, latency: ${latency}ms`);
  }

  private handleHeartbeatError(error: Error, retries: number): void {
    ApiLogger.warn(`[CommunicationManager] Heartbeat error, retries: ${retries}`, error.message);
  }

  private handleHeartbeatMaxRetries(): void {
    ApiLogger.error('[CommunicationManager] Heartbeat max retries reached');
    this.updateState({ status: 'error' });
  }

  private handleWebSocketStatusChange(status: WebSocketStatus): void {
    this.updateState({ webSocketStatus: status });
  }

  private handleWebSocketMessage(message: WebSocketMessage): void {
    this.updateState({ lastWebSocketMessage: message });
  }

  private handleWebSocketError(error: Event): void {
    ApiLogger.error('[CommunicationManager] WebSocket error', error);
  }

  private handleWebSocketOpen(): void {
    ApiLogger.info('[CommunicationManager] WebSocket connection opened');
  }

  private handleWebSocketClose(event: CloseEvent): void {
    ApiLogger.info('[CommunicationManager] WebSocket connection closed', { code: event.code });
  }

  public setAuthToken(token: string): void {
    httpClient.setAuthToken(token);
    this.config.authToken = token;
    ApiLogger.info('[CommunicationManager] Auth token updated');
  }

  public clearAuthToken(): void {
    httpClient.setAuthToken(null);
    this.config.authToken = undefined;
    ApiLogger.info('[CommunicationManager] Auth token cleared');
  }

  /**
   * 设置401未授权处理器
   */
  public setUnauthorizedHandler(handler: () => void): void {
    httpClient.setUnauthorizedHandler(handler);
    ApiLogger.info('[CommunicationManager] Unauthorized handler set');
  }

  public isConnected(): boolean {
    return this.state.status === 'connected';
  }

  public destroy(): void {
    this.disconnect();
    heartbeatService.destroy();
    webSocketService.destroy();
    this.listeners.clear();
    this.config = {};
    ApiLogger.info('[CommunicationManager] Manager destroyed');
  }
}

export const communicationManager = CommunicationManager.getInstance();
export default communicationManager;
