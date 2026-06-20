import sql from './db';
import { publicTableExists } from './bootstrapSchema';
import { logger } from './logger';

/** Idempotent products.video_360 column (see migration-products-video-360.sql). */
export async function ensureProductVideo360Column(): Promise<void> {
  if (!(await publicTableExists('products'))) {
    return;
  }
  await sql`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS video_360 TEXT
  `;
  logger.info('products.video_360 column ready');
}
