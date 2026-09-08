export { httpClient } from './http-client';
export type { HttpRequestConfig, ApiResponse } from './http-client';

export { heartbeatService } from './heartbeat-service';
export type { HeartbeatConfig, HeartbeatStatus, HeartbeatResult } from './heartbeat-service';

export { webSocketService } from './websocket-service';
export type { WebSocketConfig, WebSocketStatus, WebSocketMessage } from './websocket-service';

export { communicationManager } from './communication-manager';
export type { CommunicationConfig, CommunicationState, ConnectionStatus } from './communication-manager';

export * from './errors';
export * from './logger';
