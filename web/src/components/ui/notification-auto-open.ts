export const NOTIFICATION_AUTO_OPEN_STORAGE_KEY = 'xiaotian:notification-auto-opened-at';

const NOTIFICATION_AUTO_OPEN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldAutoOpenNotifications(lastOpenedAt: string | null, now = Date.now()): boolean {
  if (!lastOpenedAt) return true;
  const timestamp = Number(lastOpenedAt);
  return Number.isFinite(timestamp) && now - timestamp >= NOTIFICATION_AUTO_OPEN_INTERVAL_MS;
}
