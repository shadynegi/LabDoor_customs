import sql from './db';
import { logger } from './logger';

export interface OrderCouponInfo {
  coupon_id: string;
  discount_amount: number;
}

/** Atomically reserve coupon usage when a pending order is created. */
export async function reserveCouponForOrder(
  couponId: string,
  orderId: string,
  customerEmail: string,
  discountAmount: number
): Promise<void> {
  await sql.begin(async (tx) => {
    const existing = await tx`
      SELECT id FROM coupon_usage WHERE order_id = ${orderId} LIMIT 1
    `;
    if (existing.length > 0) return;

    const couponRows = await tx`
      SELECT max_uses_per_customer FROM coupons
      WHERE id = ${couponId} AND is_active = TRUE
      FOR UPDATE
    `;
    if (!couponRows.length) {
      throw new Error('Coupon is no longer available');
    }

    const maxPerCustomer = couponRows[0].max_uses_per_customer;
    if (maxPerCustomer != null) {
      const usage = await tx`
        SELECT COUNT(*) as count FROM coupon_usage
        WHERE coupon_id = ${couponId} AND customer_email = ${customerEmail}
      `;
      if (parseInt(String(usage[0].count), 10) >= Number(maxPerCustomer)) {
        throw new Error('You have already used this coupon the maximum number of times');
      }
    }

    const updated = await tx`
      UPDATE coupons
      SET used_count = used_count + 1, updated_at = NOW()
      WHERE id = ${couponId}
        AND is_active = TRUE
        AND (max_uses IS NULL OR used_count < max_uses)
      RETURNING id
    `;

    if (!updated.length) {
      throw new Error('Coupon has reached its usage limit');
    }

    await tx`
      INSERT INTO coupon_usage (coupon_id, order_id, customer_email, discount_amount)
      VALUES (${couponId}, ${orderId}, ${customerEmail}, ${discountAmount})
    `;
  });
}

/** Release a pending coupon reservation (cancelled / expired checkout). */
export async function releaseCouponForOrder(orderId: string): Promise<void> {
  await sql.begin(async (tx) => {
    const usages = await tx`
      SELECT coupon_id FROM coupon_usage WHERE order_id = ${orderId}
    `;
    if (!usages.length) return;

    for (const row of usages) {
      await tx`
        UPDATE coupons
        SET used_count = GREATEST(0, used_count - 1), updated_at = NOW()
        WHERE id = ${row.coupon_id}
      `;
    }

    await tx`DELETE FROM coupon_usage WHERE order_id = ${orderId}`;
  });

  logger.info(`Released coupon reservation for order ${orderId}`);
}

export async function getCouponForOrder(orderId: string): Promise<OrderCouponInfo | null> {
  const rows = await sql`
    SELECT coupon_id, discount_amount
    FROM coupon_usage
    WHERE order_id = ${orderId}
    LIMIT 1
  `;
  if (!rows.length) return null;
  return {
    coupon_id: rows[0].coupon_id as string,
    discount_amount: parseFloat(String(rows[0].discount_amount)),
  };
}
