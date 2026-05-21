interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);

  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }

  const value = await loader();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function invalidateCache(key: string): void {
  store.delete(key);
}

export function invalidateCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/** Test helper — clears in-memory cache between runs. */
export function clearCache(): void {
  store.clear();
}
