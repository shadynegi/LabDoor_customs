import crypto from 'crypto';
import sql from './db';
import {
  logBootstrapDdlSkipped,
  publicTableExists,
  shouldSkipBootstrapDdl,
} from './bootstrapSchema';
import { logger } from './logger';
import { hashOrderAccessToken } from './orderTokens';
import {
  encryptOrderAccessToken,
  decryptOrderAccessToken,
} from './orderTokenEncryption';

const TTL_MINUTES = 30;

export function hashCheckoutExchangeCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export async function ensureCheckoutExchangeTable(): Promise<void> {
  if (shouldSkipBootstrapDdl() || (await publicTableExists('order_checkout_exchanges'))) {
    logBootstrapDdlSkipped('order_checkout_exchanges');
    return;
  }
  await sql`
    CREATE TABLE IF NOT EXISTS order_checkout_exchanges (
      code_hash VARCHAR(64) PRIMARY KEY,
      order_id UUID NOT NULL,
      access_token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_order_checkout_exchanges_expires
    ON order_checkout_exchanges (expires_at)
  `;
}

/** Create a one-time checkout exchange code (returned in PayPal redirect URL). */
export async function createCheckoutExchangeCode(
  orderId: string,
  accessToken: string
): Promise<string> {
  const encryptedToken = encryptOrderAccessToken(accessToken);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = crypto.randomBytes(24).toString('base64url');
    const codeHash = hashCheckoutExchangeCode(code);

    const inserted = await sql`
      INSERT INTO order_checkout_exchanges (code_hash, order_id, access_token, expires_at)
      VALUES (
        ${codeHash},
        ${orderId},
        ${encryptedToken},
        NOW() + ${TTL_MINUTES} * interval '1 minute'
      )
      ON CONFLICT (code_hash) DO NOTHING
      RETURNING code_hash
    `;

    if (inserted.length > 0) return code;
  }

  throw new Error('Failed to generate unique checkout exchange code');
}

export type CheckoutExchangeResult = {
  accessToken: string;
  serverOrderId: string;
  orderNumber?: string;
  paypalOrderId?: string;
  total?: number;
  couponId?: string;
  discount_amount?: number;
};

/** Exchange a one-time code for the order access token (single use, atomic). */
export async function redeemCheckoutExchangeCode(
  code: string
): Promise<CheckoutExchangeResult | null> {
  const trimmed = code?.trim();
  if (!trimmed || trimmed.length < 8) return null;

  const codeHash = hashCheckoutExchangeCode(trimmed);

  const claimed = await sql`
    UPDATE order_checkout_exchanges
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
    logger.warn('Checkout exchange: could not decrypt access token');
    return null;
  }

  const orders = await sql`
    SELECT id, order_number, paypal_order_id, total
    FROM orders WHERE id = ${row.order_id}
    LIMIT 1
  `;

  if (!orders.length) {
    logger.warn('Checkout exchange: order missing', { orderId: row.order_id });
    return null;
  }

  const order = orders[0];
  const tokenHash = hashOrderAccessToken(accessToken);
  const orderRow = await sql`
    SELECT access_token_hash FROM orders WHERE id = ${row.order_id} LIMIT 1
  `;
  if (
    orderRow[0]?.access_token_hash &&
    orderRow[0].access_token_hash !== tokenHash
  ) {
    logger.warn('Checkout exchange: token hash mismatch');
    return null;
  }

  return {
    accessToken,
    serverOrderId: order.id as string,
    orderNumber: order.order_number as string,
    paypalOrderId: order.paypal_order_id as string | undefined,
    total: parseFloat(String(order.total ?? '0')),
  };
}

export async function cleanupExpiredCheckoutExchanges(): Promise<void> {
  await sql`
    DELETE FROM order_checkout_exchanges
    WHERE expires_at < NOW() OR used_at IS NOT NULL
  `;
}

