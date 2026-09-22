import { ApiLogger } from './logger';

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface WebSocketMessage {
  type: string;
  payload?: unknown;
  data?: unknown;
  timestamp?: number;
}

export interface WebSocketConfig {
  url: string;
  protocols?: string | string[];
  reconnectInterval: number;
  reconnectMaxAttempts: number;
  heartbeatInterval: number;
  heartbeatTimeout: number;
  onStatusChange?: (status: WebSocketStatus) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
}

const DEFAULT_CONFIG: Partial<WebSocketConfig> = {
  reconnectInterval: 3000,
  reconnectMaxAttempts: 5,
  heartbeatInterval: 30000,
  heartbeatTimeout: 10000,
};

export class WebSocketService {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig | null = null;
  private status: WebSocketStatus = 'disconnected';
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatTimeoutTimer: NodeJS.Timeout | null = null;
  private lastHeartbeat: number = 0;
  private messageQueue: WebSocketMessage[] = [];
  private listeners: Map<string, Set<(message: WebSocketMessage) => void>> = new Map();
  private globalListeners: Set<(message: WebSocketMessage) => void> = new Set();
  private onlineHandler: (() => void) | null = null;
  private authToken: string | null = null;
  private connectionPromise: Promise<void> | null = null;

  public configure(config: WebSocketConfig): void {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    ApiLogger.info('[WebSocket] Service configured', { url: this.config.url });
  }

  public setAuthToken(token: string | null): void {
    this.authToken = token;
    if (token && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendAuthToken(token);
    }
  }

  private sendAuthToken(token: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify({ type: 'auth', token }));
    } catch (error) {
      ApiLogger.error('[WebSocket] Failed to send auth token', error);
    }
  }

  public connect(): Promise<void> {
    if (!this.config) {
      return Promise.reject(new Error('WebSocket service not configured'));
    }

    if (this.status === 'connected') {
      return Promise.resolve();
    }

    // Concurrent callers share the in-flight handshake rather than initiating
    // duplicate connections or emitting an "Already connecting" warning.
    if (this.status === 'connecting' && this.connectionPromise) {
      return this.connectionPromise;
    }

    let resolveConnection!: () => void;
    let rejectConnection!: (reason?: unknown) => void;
    const connection = new Promise<void>((resolve, reject) => {
      resolveConnection = resolve;
      rejectConnection = reject;
    });
    this.connectionPromise = connection;
    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(this.config.url, this.config.protocols);
      this.setupEventHandlers(
        () => {
          this.connectionPromise = null;
          resolveConnection();
        },
        (reason) => {
          this.connectionPromise = null;
          rejectConnection(reason);
        },
      );
    } catch (error) {
      this.setStatus('error');
      this.connectionPromise = null;
      rejectConnection(error);
    }

    return connection;
  }

  private setupEventHandlers(resolve: () => void, reject: (reason?: unknown) => void): void {
    if (!this.ws || !this.config) return;

    this.ws.onopen = () => {
      ApiLogger.info('[WebSocket] Connection opened');
      this.setStatus('connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      if (this.authToken) {
        this.sendAuthToken(this.authToken);
      }
      this.flushMessageQueue();
      
      if (!this.onlineHandler) {
        this.onlineHandler = () => {
          if (this.status === 'disconnected' || this.status === 'error') {
            ApiLogger.info('[WebSocket] Network online, attempting reconnect...');
            this.reconnectAttempts = 0;
            this.connect().catch(() => { /* noop */ });
          }
        };
        window.addEventListener('online', this.onlineHandler);
      }
      
      if (this.config.onOpen) {
        this.config.onOpen();
      }
      
      resolve();
    };

    this.ws.onclose = (event: CloseEvent) => {
      ApiLogger.info('[WebSocket] Connection closed', { code: event.code, reason: event.reason });
      this.stopHeartbeat();
      
      if (this.config.onClose) {
        this.config.onClose(event);
      }

      if (event.code !== 1000 && this.reconnectAttempts < this.config.reconnectMaxAttempts) {
        this.scheduleReconnect();
      } else if (event.code !== 1000) {
        this.setStatus('disconnected');
        setTimeout(() => {
          this.reconnectAttempts = 0;
          this.scheduleReconnect();
        }, 30000);
      } else {
        this.setStatus('disconnected');
      }
    };

    this.ws.onerror = (error: Event) => {
      ApiLogger.error('[WebSocket] Connection error', error);
      this.setStatus('error');
      
      if (this.config.onError) {
        this.config.onError(error);
      }
      
      reject(error);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = typeof event.data === 'string' 
          ? JSON.parse(event.data) 
          : event.data;
        
        if (message.type === 'pong') {
          this.handleHeartbeatResponse();
          return;
        }

        this.notifyListeners(message);
        
        if (this.config.onMessage) {
          this.config.onMessage(message);
        }
      } catch (error) {
        ApiLogger.error('[WebSocket] Failed to parse message', error);
      }
    };
  }

  private scheduleReconnect(): void {
    if (!this.config) return;

    this.setStatus('reconnecting');
    this.reconnectAttempts++;

    ApiLogger.info(`[WebSocket] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.config.reconnectMaxAttempts}`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        ApiLogger.error('[WebSocket] Reconnect failed', error);
      });
    }, this.config.reconnectInterval);
  }

  private startHeartbeat(): void {
    if (!this.config) return;

    this.lastHeartbeat = Date.now();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.heartbeatTimeoutTimer) {
        clearTimeout(this.heartbeatTimeoutTimer);
      }
      this.send({ type: 'ping', timestamp: Date.now() });
      
      this.heartbeatTimeoutTimer = setTimeout(() => {
        if (Date.now() - this.lastHeartbeat > this.config!.heartbeatTimeout) {
          ApiLogger.warn('[WebSocket] Heartbeat timeout, reconnecting...');
          this.ws?.close();
        }
      }, this.config.heartbeatTimeout);
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  private handleHeartbeatResponse(): void {
    this.lastHeartbeat = Date.now();
  }

  public send(message: WebSocketMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(message);
      ApiLogger.warn('[WebSocket] Cannot send, queuing message', { type: message.type });
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      ApiLogger.debug('[WebSocket] Message sent', { type: message.type });
      return true;
    } catch (error) {
      ApiLogger.error('[WebSocket] Failed to send message', error);
      return false;
    }
  }

  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    ApiLogger.info(`[WebSocket] Flushing ${this.messageQueue.length} queued messages`);
    
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    
    messages.forEach(message => {
      this.send(message);
    });
  }

  public subscribe(type: string, callback: (message: WebSocketMessage) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    
    this.listeners.get(type)!.add(callback);
    
    return () => {
      const listeners = this.listeners.get(type);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(type);
        }
      }
    };
  }

  public subscribeAll(callback: (message: WebSocketMessage) => void): () => void {
    this.globalListeners.add(callback);
    
    return () => {
      this.globalListeners.delete(callback);
    };
  }

  private notifyListeners(message: WebSocketMessage): void {
    const typeListeners = this.listeners.get(message.type);
    if (typeListeners) {
      typeListeners.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          ApiLogger.error(`[WebSocket] Listener error for type ${message.type}`, error);
        }
      });
    }

    this.globalListeners.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        ApiLogger.error('[WebSocket] Global listener error', error);
      }
    });
  }

  public disconnect(code: number = 1000, reason: string = 'Normal closure'): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }
    
    if (this.ws) {
      this.ws.close(code, reason);
      this.ws = null;
    }
    
    this.setStatus('disconnected');
    this.reconnectAttempts = 0;
    ApiLogger.info('[WebSocket] Disconnected');
  }

  public getStatus(): WebSocketStatus {
    return this.status;
  }

  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  public isConnected(): boolean {
    return this.status === 'connected';
  }

  private setStatus(status: WebSocketStatus): void {
    if (this.status !== status) {
      this.status = status;
      if (this.config?.onStatusChange) {
        this.config.onStatusChange(status);
      }
      ApiLogger.info(`[WebSocket] Status changed to ${status}`);
    }
  }

  public destroy(): void {
    this.disconnect();
    this.messageQueue = [];
    this.listeners.clear();
    this.globalListeners.clear();
    this.config = null;
    ApiLogger.info('[WebSocket] Service destroyed');
  }
}

export const webSocketService = new WebSocketService();
export default webSocketService;
