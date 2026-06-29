import sql from './db';
import { logger } from './logger';
import { InsufficientStockError } from './inventory';
import { applyStockDeltaInTx } from './inventoryMovements';
import { generateOrderAccessToken } from './orderTokens';
import { encryptOrderAccessToken } from './orderTokenEncryption';
import { releaseCouponForOrder } from './couponReservation';
import { sanitizeCustomerInfo } from '../utils/sanitizeCustomer';

export interface ValidatedLineItem {
  product_id: number;
  product_name: string;
  product_image?: string;
  quantity: number;
  price: number;
  size_system?: string;
  size_value?: string;
}

export interface PendingOrderInput {
  customerInfo: {
    fullName: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  lineItems: ValidatedLineItem[];
  pricing: {
    subtotal: number;
    shipping: number;
    tax: number;
    discount: number;
    total: number;
  };
  couponId?: string;
}

function parseOrderItems(items: unknown): ValidatedLineItem[] {
  if (typeof items === 'string') {
    return JSON.parse(items) as ValidatedLineItem[];
  }
  return (items as ValidatedLineItem[]) || [];
}

/**
 * Create pending order + decrement inventory in a single DB transaction.
 */
export async function createPendingOrderAtomic(input: PendingOrderInput) {
  const customerInfo = sanitizeCustomerInfo(input.customerInfo);
  const orderNumber = `GSS-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  const { token: accessToken, hash: accessTokenHash } = generateOrderAccessToken();
  const accessTokenEncrypted = encryptOrderAccessToken(accessToken);

  const shippingAddress = {
    full_name: customerInfo.fullName,
    email: customerInfo.email,
    phone: customerInfo.phone,
    address: customerInfo.address,
    city: customerInfo.city,
    state: customerInfo.state,
    zip_code: customerInfo.zipCode,
    country: customerInfo.country,
  };

  const order = await sql.begin(async (tx) => {
    const shortages: Array<{
      product_id: number;
      product_name: string;
      requested: number;
      available: number;
    }> = [];

    for (const item of input.lineItems) {
      const result = await applyStockDeltaInTx(tx, {
        productId: item.product_id,
        delta: -item.quantity,
        reason: 'sale',
        referenceType: 'order',
        enforceAvailable: true,
      });

      if (!result.ok) {
        const rows = await tx`
          SELECT id, name, stock, is_out_of_stock
          FROM products
          WHERE id = ${item.product_id}
        `;
        const product = rows[0];
        shortages.push({
          product_id: item.product_id,
          product_name: (product?.name as string) || item.product_name || 'Unknown Product',
          requested: item.quantity,
          available: product ? Number(product.stock) : 0,
        });
      }
    }

    if (shortages.length > 0) {
      throw new InsufficientStockError(shortages);
    }

    const inserted = await tx`
      INSERT INTO orders (
        order_number, customer_email, customer_name, shipping_address,
        items, subtotal, shipping_cost, tax, total,
        payment_status, payment_method, access_token_hash, access_token_encrypted, status
      ) VALUES (
        ${orderNumber},
        ${customerInfo.email},
        ${customerInfo.fullName},
        ${JSON.stringify(shippingAddress)},
        ${JSON.stringify(input.lineItems)},
        ${input.pricing.subtotal},
        ${input.pricing.shipping},
        ${input.pricing.tax},
        ${input.pricing.total},
        'pending',
        'WhatsApp',
        ${accessTokenHash},
        ${accessTokenEncrypted},
        'pending'
      )
      RETURNING *
    `;

    return inserted[0];
  });

  return {
    order,
    orderNumber,
    accessToken,
    couponId: input.couponId,
  };
}

/** Cancel a pending order and restore reserved inventory (checkout failure / rollback). */
export async function cancelPendingOrderAndRestoreStock(serverOrderId: string): Promise<boolean> {
  let cancelled = false;

  await sql.begin(async (tx) => {
    const rows = await tx`
      SELECT id, items, payment_status, status
      FROM orders
      WHERE id = ${serverOrderId}
      FOR UPDATE
    `;

    if (!rows.length) return;

    const order = rows[0];
    if (order.payment_status !== 'pending' || order.status !== 'pending') {
      return;
    }

    const items = parseOrderItems(order.items);
    for (const item of items) {
      await applyStockDeltaInTx(tx, {
        productId: item.product_id,
        delta: item.quantity,
        reason: 'cancel_restore',
        referenceType: 'order',
        referenceId: serverOrderId,
      });
    }

    await tx`
      UPDATE orders
      SET
        status = 'cancelled',
        payment_status = 'failed',
        updated_at = NOW()
      WHERE id = ${serverOrderId}
    `;

    cancelled = true;
  });

  if (cancelled) {
    await releaseCouponForOrder(serverOrderId).catch((err) =>
      logger.error(`Coupon release failed for order ${serverOrderId}:`, err)
    );
    logger.info(`Cancelled pending order ${serverOrderId} and restored inventory`);
  }

  return cancelled;
}

/** Expire abandoned checkouts (pending payment, no capture) and restore stock. */
export async function expireStalePendingOrders(
  maxAgeHours = parseInt(process.env.PENDING_ORDER_TTL_HOURS || '24', 10)
): Promise<number> {
  const stale = await sql`
    SELECT id
    FROM orders
    WHERE payment_status = 'pending'
      AND status = 'pending'
      AND created_at < NOW() - ${maxAgeHours} * interval '1 hour'
    ORDER BY created_at ASC
    LIMIT 100
  `;

  let count = 0;
  for (const row of stale) {
    const ok = await cancelPendingOrderAndRestoreStock(row.id as string);
    if (ok) count += 1;
  }

  if (count > 0) {
    logger.info(`Expired ${count} stale pending order(s) older than ${maxAgeHours}h`);
  }

  return count;
}
