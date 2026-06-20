import type { Store, ClientRateLimitInfo, Options } from 'express-rate-limit';
import { MemoryStore } from 'express-rate-limit';
import { connectRedis, getRedisRateLimitStore } from './redis';
import { logger } from './logger';

const isProduction = process.env.NODE_ENV === 'production';
const redisRequired = Boolean(process.env.REDIS_URL?.trim());

/**
 * Per-limiter store: Redis when REDIS_URL is set, otherwise in-memory (one instance per limiter).
 * In production with REDIS_URL, fails closed (no silent memory fallback).
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

    if (!redisRequired) return;

    try {
      await connectRedis();
      this.redis = getRedisRateLimitStore();
      if (this.redis?.init) {
        await this.redis.init(prefixed);
        this.redisReady = true;
      }
    } catch (error) {
      logger.error(`[RateLimit:${this.prefix}] Redis unavailable:`, error);
      if (isProduction) {
        throw error;
      }
    }

    if (isProduction && redisRequired && !this.redisReady) {
      throw new Error(`[RateLimit:${this.prefix}] Redis required but not ready`);
    }
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    if (redisRequired && this.redisReady && this.redis) {
      try {
        return await this.redis.increment(key);
      } catch (error) {
        logger.error(`[RateLimit:${this.prefix}] Redis increment failed:`, error);
        if (isProduction) {
          throw error;
        }
      }
    }

    if (isProduction && redisRequired) {
      throw new Error(`[RateLimit:${this.prefix}] Redis store unavailable`);
    }

    return this.memory.increment(key);
  }

  async decrement(key: string): Promise<void> {
    if (redisRequired && this.redisReady && this.redis) {
      try {
        await this.redis.decrement(key);
        return;
      } catch (error) {
        if (isProduction) throw error;
      }
    }
    await this.memory.decrement(key);
  }

  async resetKey(key: string): Promise<void> {
    if (redisRequired && this.redisReady && this.redis) {
      try {
        await this.redis.resetKey(key);
        return;
      } catch (error) {
        if (isProduction) throw error;
      }
    }
    await this.memory.resetKey(key);
  }
}

export function createHybridRateLimitStore(prefix: string): HybridRateLimitStore {
  return new HybridRateLimitStore(prefix);
}
