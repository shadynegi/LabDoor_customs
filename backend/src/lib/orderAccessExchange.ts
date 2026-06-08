import crypto from 'crypto';
import sql from './db';
import {
  logBootstrapDdlSkipped,
  publicTableExists,
  shouldSkipBootstrapDdl,
} from './bootstrapSchema';
import { logger } from './logger';
import { hashOrderAccessToken } from './orderTokens';
import { encryptOrderAccessToken, decryptOrderAccessToken } from './orderTokenEncryption';

const TTL_DAYS = 30;

export function hashOrderAccessExchangeCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export async function ensureOrderAccessExchangeTable(): Promise<void> {
  if (shouldSkipBootstrapDdl() || (await publicTableExists('order_access_exchanges'))) {
    logBootstrapDdlSkipped('order_access_exchanges');
    return;
  }
  await sql`
    CREATE TABLE IF NOT EXISTS order_access_exchanges (
      code_hash VARCHAR(64) PRIMARY KEY,
      order_id UUID NOT NULL,
      access_token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_order_access_exchanges_expires
    ON order_access_exchanges (expires_at)
  `;
}

/** One-time code for order tracking links (email — avoids long-lived token in URL). */
export async function createOrderAccessExchangeCode(
  orderId: string,
  accessToken: string
): Promise<string> {
  const encryptedToken = encryptOrderAccessToken(accessToken);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = crypto.randomBytes(24).toString('base64url');
    const codeHash = hashOrderAccessExchangeCode(code);

    const inserted = await sql`
      INSERT INTO order_access_exchanges (code_hash, order_id, access_token, expires_at)
      VALUES (
        ${codeHash},
        ${orderId},
        ${encryptedToken},
        NOW() + ${TTL_DAYS} * interval '1 day'
      )
      ON CONFLICT (code_hash) DO NOTHING
      RETURNING code_hash
    `;

    if (inserted.length > 0) return code;
  }

  throw new Error('Failed to generate unique order access exchange code');
}

/** Mint a tracking link from stored checkout exchange token (webhook/admin capture paths). */
export async function issueOrderTrackingExchangeFromOrder(
  orderId: string
): Promise<string | null> {
  const rows = await sql`
    SELECT access_token FROM order_checkout_exchanges
    WHERE order_id = ${orderId}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (!rows.length) return null;

  const accessToken = decryptOrderAccessToken(rows[0].access_token as string);
  if (!accessToken) {
    logger.warn('Could not decrypt checkout exchange token for tracking link', { orderId });
    return null;
  }

  return createOrderAccessExchangeCode(orderId, accessToken);
}

export type OrderAccessExchangeResult = {
  accessToken: string;
  serverOrderId: string;
  orderNumber: string;
};

export async function redeemOrderAccessExchangeCode(
  code: string
): Promise<OrderAccessExchangeResult | null> {
  const trimmed = code?.trim();
  if (!trimmed || trimmed.length < 8) return null;

  const codeHash = hashOrderAccessExchangeCode(trimmed);

  const claimed = await sql`
    UPDATE order_access_exchanges
    SET used_at = NOW()
    WHERE code_hash = ${codeHash}
      AND expires_at > NOW()
      AND used_at IS NULL
    RETURNING order_id, access_token
  `;

  if (!claimed.length) return null;

  const row = claimed[0];
  const accessToken = decryptOrderAccessToken(row.access_token as string);
  if (!accessToken) {
    logger.error('Failed to decrypt order access exchange token');
    return null;
  }

  const tokenHash = hashOrderAccessToken(accessToken);
  const order = await sql`
    SELECT id, order_number, access_token_hash
    FROM orders
    WHERE id = ${row.order_id}
    LIMIT 1
  `;

  if (!order.length || order[0].access_token_hash !== tokenHash) {
    logger.warn('Order access exchange token hash mismatch');
    return null;
  }

  return {
    accessToken,
    serverOrderId: order[0].id as string,
    orderNumber: order[0].order_number as string,
  };
}

/** Remove expired order access exchange rows (email tracking codes). */
export async function cleanupExpiredOrderAccessExchanges(): Promise<number> {
  const result = await sql`
    DELETE FROM order_access_exchanges
    WHERE expires_at < NOW()
    RETURNING code_hash
  `;
  return result.length;
}
