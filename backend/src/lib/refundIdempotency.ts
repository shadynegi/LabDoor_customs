import type { Sql, TransactionSql } from 'postgres';
import sql from './db';
import { logger } from './logger';

export type RefundEventSource =
  | 'webhook'
  | 'admin_api'
  | 'admin_cancel'
  | 'unknown';

/** Ensure deduplication table for refund webhooks and admin refunds exists. */
export async function ensureProcessedRefundEventsTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS processed_refund_events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      dedupe_key VARCHAR(256) UNIQUE NOT NULL,
      capture_id VARCHAR(255) NOT NULL,
      refund_amount DECIMAL(10, 2),
      source VARCHAR(64) NOT NULL DEFAULT 'unknown',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_processed_refund_events_capture
    ON processed_refund_events (capture_id)
  `;
}

export interface ClaimRefundEventResult {
  claimed: boolean;
}

/**
 * Insert dedupe key; returns claimed=false when this refund event was already processed.
 */
export async function claimRefundEvent(
  tx: Sql | TransactionSql,
  dedupeKey: string,
  captureId: string,
  source: RefundEventSource,
  refundAmount?: string | null
): Promise<ClaimRefundEventResult> {
  const inserted = await tx`
    INSERT INTO processed_refund_events (dedupe_key, capture_id, refund_amount, source)
    VALUES (
      ${dedupeKey},
      ${captureId},
      ${refundAmount != null && refundAmount !== '' ? refundAmount : null},
      ${source}
    )
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING id
  `;

  if (inserted.length === 0) {
    logger.info(`Skipping duplicate refund event: ${dedupeKey}`);
    return { claimed: false };
  }

  return { claimed: true };
}

/** Build a stable webhook dedupe key from PayPal transmission metadata. */
export function buildWebhookRefundDedupeKey(
  transmissionId: string | undefined,
  eventType: string | undefined,
  resourceId: string | undefined
): string {
  if (transmissionId?.trim()) {
    return `webhook:${transmissionId.trim()}`;
  }
  return `webhook:${eventType || 'unknown'}:${resourceId || 'unknown'}`;
}

/** Build dedupe key from PayPal refund resource ID. */
export function buildPayPalRefundDedupeKey(refundId: string): string {
  return `paypal-refund:${refundId}`;
}
