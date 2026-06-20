import sql, { query as dbQuery } from './db';
import { cached } from './cache';
import { CACHE, TTL } from './cacheKeys';
import { logger } from './logger';
import { paginationMeta } from './pagination';

async function warmProductPage(page: number, limit: number): Promise<void> {
  await cached(CACHE.productsList(page, limit), TTL.productsList, async () => {
    const countResult = await dbQuery(
      () => sql`SELECT COUNT(*) as total FROM products`,
      'cacheWarm:count'
    );
    const total = parseInt(countResult[0]?.total || '0', 10);
    const products = await dbQuery(
      () => sql`
      SELECT * FROM products
      ORDER BY id ASC
      LIMIT ${limit}
      OFFSET ${(page - 1) * limit}
    `,
      'cacheWarm:products'
    );
    return {
      data: products || [],
      pagination: paginationMeta(total, { page, limit, offset: (page - 1) * limit }),
    };
  });
}

/** Pre-load hot product list caches on server startup. */
export async function warmCaches(): Promise<void> {
  const start = Date.now();

  try {
    await warmProductPage(1, 10);
    await warmProductPage(1, 20);
    logger.info(`Cache warmed in ${Date.now() - start}ms`);
  } catch (error) {
    logger.warn('Cache warming failed (non-fatal):', error);
  }
}
