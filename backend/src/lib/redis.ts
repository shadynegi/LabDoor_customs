import { createClient, type RedisClientType } from 'redis';
import { RedisStore } from 'rate-limit-redis';
import type { Store } from 'express-rate-limit';
import { logger } from './logger';

let client: RedisClientType | null = null;
let rateLimitStore: Store | undefined;

export function isRedisEnabled(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

export async function connectRedis(): Promise<void> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return;

  if (client?.isOpen) return;

  client = createClient({ url });

  client.on('error', (err) => {
    logger.error('[Redis] Client error:', err);
  });

  await client.connect();
  rateLimitStore = new RedisStore({
    sendCommand: (...args: string[]) => client!.sendCommand(args),
  });

  logger.info('[Redis] Connected — distributed cache and rate limits enabled');
}

export function getRedisClient(): RedisClientType | null {
  return client?.isOpen ? client : null;
}

export function getRedisRateLimitStore(): Store | undefined {
  return rateLimitStore;
}

export async function disconnectRedis(): Promise<void> {
  if (client?.isOpen) {
    await client.quit();
  }
  client = null;
  rateLimitStore = undefined;
}

const CACHE_PREFIX = 'labdoor:cache:';

export async function redisCacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const raw = await redis.get(CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function redisCacheSet(key: string, value: unknown, ttlMs: number): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
  await redis.setEx(CACHE_PREFIX + key, ttlSec, JSON.stringify(value));
}

export async function redisCacheDelete(key: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.del(CACHE_PREFIX + key);
}

export async function redisCacheDeleteByPrefix(prefix: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const match = CACHE_PREFIX + prefix + '*';
  let cursor = '0';

  do {
    const result = await redis.scan(cursor, { MATCH: match, COUNT: 100 });
    cursor = result.cursor;
    if (result.keys.length > 0) {
      await redis.del(result.keys);
    }
  } while (cursor !== '0');
}
