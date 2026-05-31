import { vi } from 'vitest';

export const sqlMock = vi.fn(async () => [] as unknown[]);

vi.mock('../src/lib/db', () => ({
  default: sqlMock,
  withRetry: async <T>(fn: () => Promise<T>) => fn(),
  runInChunks: async <T>(
    items: T[],
    fn: (item: T) => Promise<void>,
    _chunkSize?: number
  ) => {
    for (const item of items) {
      await fn(item);
    }
  },
  getPoolStats: () => ({
    activeConnections: 0,
    totalQueries: 0,
    maxConnections: 10,
    isProduction: false,
    poolerMode: false,
    prepareEnabled: true,
  }),
}));

vi.mock('../src/lib/paymentIdempotency', () => ({
  buildCreatePaymentKey: () => 'test-idempotency-key',
  claimIdempotencyKey: async () => ({ type: 'claimed' as const }),
  completeIdempotencyKey: async () => {},
  failIdempotencyKey: async () => {},
  ensureIdempotencyTable: async () => {},
  cleanupExpiredIdempotencyKeys: async () => {},
  reapStuckIdempotencyKeys: async () => 0,
  reclaimFailedIdempotencyKey: async () => false,
}));

vi.mock('../src/lib/redis', () => ({
  connectRedis: async () => {},
  disconnectRedis: async () => {},
  isRedisEnabled: () => false,
  getRedisClient: () => null,
  getRedisRateLimitStore: () => undefined,
  redisCacheGet: async () => null,
  redisCacheSet: async () => {},
  redisCacheDelete: async () => {},
  redisCacheDeleteByPrefix: async () => {},
}));
