import {
  redisCacheDelete,
  redisCacheDeleteByPrefix,
  redisCacheGet,
  redisCacheSet,
} from './redis';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memoryStore = new Map<string, CacheEntry<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const redisHit = await redisCacheGet<T>(key);
  if (redisHit !== null) {
    return redisHit;
  }

  const now = Date.now();
  const hit = memoryStore.get(key);

  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }

  const value = await loader();
  memoryStore.set(key, { value, expiresAt: now + ttlMs });
  await redisCacheSet(key, value, ttlMs);
  return value;
}

export function invalidateCache(key: string): void {
  memoryStore.delete(key);
  redisCacheDelete(key).catch(() => {});
}

export function invalidateCachePrefix(prefix: string): void {
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      memoryStore.delete(key);
    }
  }
  redisCacheDeleteByPrefix(prefix).catch(() => {});
}

/** Test helper — clears in-memory cache between runs. */
export function clearCache(): void {
  memoryStore.clear();
}
