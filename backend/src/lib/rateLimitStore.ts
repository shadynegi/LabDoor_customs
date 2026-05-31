import type { Store, ClientRateLimitInfo, Options } from 'express-rate-limit';
import { MemoryStore } from 'express-rate-limit';
import { connectRedis, getRedisRateLimitStore } from './redis';
import { logger } from './logger';

/**
 * Per-limiter store: Redis when REDIS_URL is set, otherwise in-memory (one instance per limiter).
 */
export class HybridRateLimitStore implements Store {
  readonly prefix: string;
  private memory = new MemoryStore();
  private redis?: Store;
  private redisReady = false;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  async init(options: Options): Promise<void> {
    const prefixed = { ...options, prefix: this.prefix };
    await this.memory.init(prefixed);

    if (!process.env.REDIS_URL?.trim()) return;

    try {
      await connectRedis();
      this.redis = getRedisRateLimitStore();
      if (this.redis?.init) {
        await this.redis.init(prefixed);
        this.redisReady = true;
      }
    } catch (error) {
      logger.warn(`[RateLimit:${this.prefix}] Redis unavailable, using memory:`, error);
    }
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    if (this.redisReady && this.redis) {
      try {
        return await this.redis.increment(key);
      } catch (error) {
        logger.warn(`[RateLimit:${this.prefix}] Redis increment failed:`, error);
      }
    }
    return this.memory.increment(key);
  }

  async decrement(key: string): Promise<void> {
    if (this.redisReady && this.redis) {
      try {
        await this.redis.decrement(key);
        return;
      } catch {
        /* fall through */
      }
    }
    await this.memory.decrement(key);
  }

  async resetKey(key: string): Promise<void> {
    if (this.redisReady && this.redis) {
      try {
        await this.redis.resetKey(key);
        return;
      } catch {
        /* fall through */
      }
    }
    await this.memory.resetKey(key);
  }
}

export function createHybridRateLimitStore(prefix: string): HybridRateLimitStore {
  return new HybridRateLimitStore(prefix);
}
