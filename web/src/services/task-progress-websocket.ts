import { getViteEnvValue } from '@/lib/vite-env';
import { webSocketService } from '@/lib/api-core/websocket-service';

type BrowserLocation = Pick<Location, 'protocol' | 'host' | 'port'>;

interface TaskProgressWebSocketOptions {
  location?: BrowserLocation;
  backendPort?: string;
  token?: string;
}

export async function initializeTaskProgressWebSocket(
  options: TaskProgressWebSocketOptions = {},
): Promise<void> {
  const location = options.location ?? window.location;
  const backendPort = options.backendPort ?? getViteEnvValue('VITE_BACKEND_PORT', '3200');
  const isLocalDev = /^5\d{3}$/.test(location.port || '');
  const url = isLocalDev
    ? `ws://127.0.0.1:${backendPort}/ws`
    : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;

  webSocketService.configure({
    url,
    reconnectInterval: 3000,
    reconnectMaxAttempts: 10,
    heartbeatInterval: 30000,
    heartbeatTimeout: 10000,
  });

  const token = options.token ?? localStorage.getItem('token') ?? localStorage.getItem('authToken') ?? '';
  if (!token) return;

  webSocketService.setAuthToken(token);
  try {
    const connection = webSocketService.connect();
    void connection.catch((error) => {
      console.warn('[TaskProgressWebSocket] 后台连接失败，将按重连策略继续尝试:', error);
    });
  } catch (error) {
    console.warn('[TaskProgressWebSocket] 启动后台连接失败:', error);
  }
}
