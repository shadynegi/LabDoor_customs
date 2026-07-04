import sql from './db';
import {
  logBootstrapDdlSkipped,
  publicColumnExists,
  shouldSkipBootstrapDdl,
} from './bootstrapSchema';
import { logger } from './logger';

/** Apply idempotent order schema patches at startup (WhatsApp checkout — no PayPal). */
export async function ensureOrderPaymentSchema(): Promise<void> {
  const hasTokenEncrypted = await publicColumnExists('orders', 'access_token_encrypted');

  if (shouldSkipBootstrapDdl() && hasTokenEncrypted) {
    logBootstrapDdlSkipped('order_payment_schema');
    return;
  }

  if (!shouldSkipBootstrapDdl()) {
    await sql`
      ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE
    `;
    await sql`
      ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_customers_is_deleted ON customers(is_deleted)
    `;
  }

  if (!hasTokenEncrypted) {
    await sql`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT
    `;
  }

  logger.info('Order payment schema patches applied');
}
