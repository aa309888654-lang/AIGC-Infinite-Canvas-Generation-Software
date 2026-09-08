import { createHash } from 'crypto';
import { redisService } from '../redis-service';

const CACHE_PREFIX = 'prompt:cache:';
const DEFAULT_TTL = 3600;

function hashKey(text: string): string {
  return createHash('sha256').update(text).digest('hex').substring(0, 24);
}

export async function getCachedResult(
  prompt: string,
  scenario?: string,
  category?: string,
): Promise<string | null> {
  const key = CACHE_PREFIX + hashKey(`${prompt}|${scenario || ''}|${category || ''}`);
  try {
    const cached = await redisService.getCache(key);
    return cached || null;
  } catch {
    return null;
  }
}

export async function setCachedResult(
  prompt: string,
  result: string,
  scenario?: string,
  category?: string,
  ttl: number = DEFAULT_TTL,
): Promise<void> {
  const key = CACHE_PREFIX + hashKey(`${prompt}|${scenario || ''}|${category || ''}`);
  try {
    await redisService.setCache(key, result, ttl);
  } catch {
    // Cache failures must not block prompt optimization.
  }
}
