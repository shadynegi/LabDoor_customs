import sql from './db';
import {
  logBootstrapDdlSkipped,
  publicColumnExists,
  publicTableExists,
  shouldSkipBootstrapDdl,
} from './bootstrapSchema';
import { logger } from './logger';
import { ensureProcessedRefundEventsTable } from './refundIdempotency';

/** Apply idempotent order/payment schema patches at startup. */
export async function ensureOrderPaymentSchema(): Promise<void> {
  const hasRefundColumn = await publicColumnExists('orders', 'refunded_amount');
  const hasRefundEventsTable = await publicTableExists('processed_refund_events');
  const hasTokenEncrypted = await publicColumnExists('orders', 'access_token_encrypted');

  if (shouldSkipBootstrapDdl() && hasRefundColumn && hasRefundEventsTable && hasTokenEncrypted) {
    logBootstrapDdlSkipped('order_payment_schema');
    return;
  }

  if (!hasRefundColumn) {
    await sql`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS refunded_amount DECIMAL(10, 2) NOT NULL DEFAULT 0
    `;
  }

  if (!shouldSkipBootstrapDdl()) {
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_paypal_order_id_unique
      ON orders (paypal_order_id)
      WHERE paypal_order_id IS NOT NULL
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_paypal_capture_id_unique
      ON orders (paypal_capture_id)
      WHERE paypal_capture_id IS NOT NULL
    `;

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

  if (!hasRefundEventsTable) {
    await ensureProcessedRefundEventsTable();
  }

  if (!hasTokenEncrypted) {
    await sql`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT
    `;
  }

  logger.info('Order payment schema patches applied');
}
