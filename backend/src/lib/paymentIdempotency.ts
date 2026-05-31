import crypto from 'crypto';
import sql from './db';
import { logger } from './logger';

export type IdempotencyStatus = 'processing' | 'completed' | 'failed';

export interface IdempotencyRow {
  id: string;
  idempotency_key: string;
  operation: string;
  status: IdempotencyStatus;
  server_order_id: string | null;
  paypal_order_id: string | null;
  response_json: Record<string, unknown> | null;
  created_at: Date;
  expires_at: Date;
}

export type ClaimResult =
  | { type: 'claimed' }
  | { type: 'in_progress' }
  | { type: 'completed'; response: Record<string, unknown> }
  | { type: 'failed'; error: string };

export function buildCreatePaymentKey(
  headerKey: string | undefined,
  email: string,
  items: Array<{ product_id: number; quantity: number }>,
  couponCode?: string
): string {
  if (headerKey) {
    const trimmed = headerKey.trim();
    if (trimmed.length >= 8 && trimmed.length <= 128) {
      return trimmed;
    }
  }

  const fingerprint = JSON.stringify({
    email: email.toLowerCase().trim(),
    items: [...items]
      .sort((a, b) => a.product_id - b.product_id)
      .map((item) => ({ p: item.product_id, q: item.quantity })),
    coupon: (couponCode || '').toUpperCase(),
  });

  return crypto.createHash('sha256').update(fingerprint).digest('hex');
}

export async function ensureIdempotencyTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS payment_idempotency (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      idempotency_key VARCHAR(128) UNIQUE NOT NULL,
      operation VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'processing',
      server_order_id UUID,
      paypal_order_id VARCHAR(128),
      response_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_payment_idempotency_expires ON payment_idempotency (expires_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_payment_idempotency_operation ON payment_idempotency (operation)`;
}

export async function claimIdempotencyKey(
  key: string,
  operation: string,
  ttlMinutes = 30
): Promise<ClaimResult> {
  const inserted = await sql<IdempotencyRow[]>`
    INSERT INTO payment_idempotency (idempotency_key, operation, status, expires_at)
    VALUES (
      ${key},
      ${operation},
      'processing',
      NOW() + ${ttlMinutes} * interval '1 minute'
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING *
  `;

  if (inserted.length > 0) {
    return { type: 'claimed' };
  }

  const existing = await sql<IdempotencyRow[]>`
    SELECT * FROM payment_idempotency WHERE idempotency_key = ${key} LIMIT 1
  `;
  const row = existing[0];

  if (!row) {
    return claimIdempotencyKey(key, operation, ttlMinutes);
  }

  if (row.status === 'completed' && row.response_json) {
    return { type: 'completed', response: row.response_json as Record<string, unknown> };
  }

  if (row.status === 'processing') {
    return { type: 'in_progress' };
  }

  return {
    type: 'failed',
    error: 'Previous payment attempt failed. Retry is allowed while the order is still pending.',
  };
}

/** Reset a failed idempotency row so capture can be retried (order still pending). */
export async function reclaimFailedIdempotencyKey(
  key: string,
  ttlMinutes = 15
): Promise<boolean> {
  const updated = await sql`
    UPDATE payment_idempotency
    SET
      status = 'processing',
      expires_at = NOW() + ${ttlMinutes} * interval '1 minute'
    WHERE idempotency_key = ${key} AND status = 'failed'
    RETURNING id
  `;
  return updated.length > 0;
}

export async function completeIdempotencyKey(
  key: string,
  response: Record<string, unknown>,
  opts?: { serverOrderId?: string; paypalOrderId?: string }
): Promise<void> {
  await sql`
    UPDATE payment_idempotency SET
      status = 'completed',
      response_json = ${sql.json(JSON.parse(JSON.stringify(response)))},
      server_order_id = COALESCE(${opts?.serverOrderId ?? null}, server_order_id),
      paypal_order_id = COALESCE(${opts?.paypalOrderId ?? null}, paypal_order_id)
    WHERE idempotency_key = ${key}
  `;
}

export async function failIdempotencyKey(key: string): Promise<void> {
  await sql`
    UPDATE payment_idempotency
    SET status = 'failed'
    WHERE idempotency_key = ${key} AND status = 'processing'
  `;
}

export async function reapStuckIdempotencyKeys(
  staleMinutes = parseInt(process.env.IDEMPOTENCY_STALE_MINUTES || '5', 10)
): Promise<number> {
  try {
    const updated = await sql`
      UPDATE payment_idempotency
      SET status = 'failed'
      WHERE status = 'processing'
        AND created_at < NOW() - ${staleMinutes} * interval '1 minute'
      RETURNING id
    `;
    if (updated.length > 0) {
      logger.info(`Reaped ${updated.length} stuck payment idempotency record(s)`);
    }
    return updated.length;
  } catch (error) {
    logger.warn('Stuck idempotency reaper failed (non-fatal):', error);
    return 0;
  }
}

export async function cleanupExpiredIdempotencyKeys(): Promise<void> {
  try {
    const deleted = await sql`
      DELETE FROM payment_idempotency
      WHERE expires_at < NOW() AND status != 'processing'
      RETURNING id
    `;
    if (deleted.length > 0) {
      logger.info(`Cleaned up ${deleted.length} expired payment idempotency records`);
    }
  } catch (error) {
    logger.warn('Idempotency cleanup failed (non-fatal):', error);
  }
}
