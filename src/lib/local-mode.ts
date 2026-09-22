import { getViteEnvValue } from './vite-env';

/**
 * 开源本地模式检测。
 * 本地模式下无需注册/登录，所有功能以本地用户身份解锁；
 * 与后端 LOCAL_ONLY_MODE 配套生效。
 */
export function isLocalMode(): boolean {
  return getViteEnvValue('VITE_LOCAL_MODE') === 'true';
}

/** 本地模式下使用的固定会话标识，后端在本地模式下接受任意/缺失令牌 */
export const LOCAL_SESSION_TOKEN = 'local-session';
