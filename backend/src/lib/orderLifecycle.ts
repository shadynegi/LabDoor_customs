import sql from './db';
import { logger } from './logger';
import { InsufficientStockError } from './inventory';
import { generateOrderAccessToken } from './orderTokens';
import { releaseCouponForOrder } from './couponReservation';

export interface ValidatedLineItem {
  product_id: number;
  product_name: string;
  product_image?: string;
  quantity: number;
  price: number;
  size_system?: string;
  size_value?: string;
}

export interface PendingPayPalOrderInput {
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
export async function createPendingPayPalOrderAtomic(input: PendingPayPalOrderInput) {
  const orderNumber = `GSS-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  const { token: accessToken, hash: accessTokenHash } = generateOrderAccessToken();

  const shippingAddress = {
    full_name: input.customerInfo.fullName,
    email: input.customerInfo.email,
    phone: input.customerInfo.phone,
    address: input.customerInfo.address,
    city: input.customerInfo.city,
    state: input.customerInfo.state,
    zip_code: input.customerInfo.zipCode,
    country: input.customerInfo.country,
  };

  const order = await sql.begin(async (tx) => {
    const shortages: Array<{
      product_id: number;
      product_name: string;
      requested: number;
      available: number;
    }> = [];

    for (const item of input.lineItems) {
      const updated = await tx`
        UPDATE products
        SET
          stock = stock - ${item.quantity},
          is_out_of_stock = (stock - ${item.quantity}) <= 0,
          updated_at = NOW()
        WHERE id = ${item.product_id}
          AND stock >= ${item.quantity}
          AND is_out_of_stock = FALSE
        RETURNING id, name, stock
      `;

      if (updated.length === 0) {
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
        payment_status, payment_method, access_token_hash, status
      ) VALUES (
        ${orderNumber},
        ${input.customerInfo.email},
        ${input.customerInfo.fullName},
        ${JSON.stringify(shippingAddress)},
        ${JSON.stringify(input.lineItems)},
        ${input.pricing.subtotal},
        ${input.pricing.shipping},
        ${input.pricing.tax},
        ${input.pricing.total},
        'pending',
        'PayPal',
        ${accessTokenHash},
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

/** Cancel a pending order and restore reserved inventory (PayPal failure / rollback). */
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
      await tx`
        UPDATE products
        SET
          stock = stock + ${item.quantity},
          is_out_of_stock = FALSE,
          updated_at = NOW()
        WHERE id = ${item.product_id}
      `;
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
