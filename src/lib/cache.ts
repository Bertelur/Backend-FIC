import { getRedis } from '../config/redis.js';

const DEFAULT_TTL_SECONDS = parseInt(process.env.REDIS_CACHE_TTL_SECONDS ?? '300', 10) || 300;

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSec: number = DEFAULT_TTL_SECONDS): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const serialized = JSON.stringify(value);
    await redis.setEx(key, ttlSec, serialized);
  } catch (err) {
    console.warn('Cache set failed:', err);
  }
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (err) {
    console.warn('Cache del failed:', err);
  }
}

/**
 * Delete all keys matching pattern (e.g. "products:*").
 * Uses SCAN to avoid blocking.
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const keys: string[] = [];
    for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      if (key) {
        keys.push(key as unknown as string);
      }
    }
    if (keys.length > 0) {
      await redis.del(...keys as unknown as [string]);
    }
  } catch (err) {
    console.warn('Cache delPattern failed:', err);
  }
}

export { DEFAULT_TTL_SECONDS as cacheDefaultTtlSec };
