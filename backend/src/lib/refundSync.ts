import sql from './db';
import { logger } from './logger';
import { releaseCouponForOrder } from './couponReservation';
import {
  reverseCustomerOrderCredit,
  adjustCustomerPartialRefund,
} from './customers';
import {
  claimRefundEvent,
  type RefundEventSource,
} from './refundIdempotency';

export interface RefundSyncOptions {
  /** When false, record refund in logs only — no inventory restore or order cancellation. */
  fullRefund?: boolean;
  /** Refund amount from PayPal (this event). Used for cumulative partial tracking. */
  refundAmount?: string;
  /** Unique key for idempotent application (webhook transmission, PayPal refund ID). */
  dedupeKey?: string;
  source?: RefundEventSource;
}

export interface RefundSyncResult {
  orderId: string;
  orderNumber: string;
  inventoryRestored: boolean;
  fullRefund: boolean;
  cumulativeRefunded: number;
  duplicated?: boolean;
}

export interface AdminRefundValidation {
  orderId: string;
  orderTotal: number;
  priorRefunded: number;
  remaining: number;
  refundAmount: string;
  currency: string;
}

const REFUND_TOLERANCE = 0.01;

/** Lock order and validate admin refund amount against remaining balance. */
export async function validateAdminRefundAmount(
  captureId: string,
  requestedAmount?: string,
  currency = 'USD'
): Promise<
  | { ok: true; data: AdminRefundValidation }
  | { ok: false; status: number; error: string; message?: string }
> {
  return sql.begin(async (tx) => {
    const orders = await tx`
      SELECT id, total, refunded_amount, payment_status
      FROM orders
      WHERE paypal_capture_id = ${captureId}
      FOR UPDATE
    `;

    if (!orders.length) {
      return {
        ok: false as const,
        status: 404,
        error: 'Order not found for capture ID',
      };
    }

    const order = orders[0];
    if (order.payment_status !== 'completed' && order.payment_status !== 'refunded') {
      return {
        ok: false as const,
        status: 409,
        error: 'Order is not in a refundable state',
        message: `Current payment status: ${order.payment_status}`,
      };
    }

    const orderTotal = parseFloat(String(order.total ?? '0'));
    const priorRefunded = parseFloat(String(order.refunded_amount ?? '0'));
    const remaining = Math.max(0, orderTotal - priorRefunded);

    if (remaining <= REFUND_TOLERANCE) {
      return {
        ok: false as const,
        status: 409,
        error: 'Order is already fully refunded',
      };
    }

    let refundAmount: string;
    if (requestedAmount != null && requestedAmount !== '') {
      const parsed = parseFloat(requestedAmount);
      if (Number.isNaN(parsed) || parsed <= 0) {
        return {
          ok: false as const,
          status: 400,
          error: 'Invalid refund amount',
        };
      }
      if (parsed > remaining + REFUND_TOLERANCE) {
        return {
          ok: false as const,
          status: 400,
          error: 'Refund amount exceeds remaining balance',
          message: `Maximum refundable amount is ${remaining.toFixed(2)}`,
        };
      }
      refundAmount = parsed.toFixed(2);
    } else {
      refundAmount = remaining.toFixed(2);
    }

    return {
      ok: true as const,
      data: {
        orderId: order.id as string,
        orderTotal,
        priorRefunded,
        remaining,
        refundAmount,
        currency,
      },
    };
  });
}

/** After PayPal refund/reversal, optionally restore inventory and update order. */
export async function syncOrderAfterRefund(
  captureId: string,
  opts: RefundSyncOptions = {}
): Promise<RefundSyncResult | null> {
  const source: RefundEventSource = opts.source ?? 'unknown';

  const result = await sql.begin(async (tx) => {
    const orders = await tx`
      SELECT id, order_number, items, status, payment_status, total, refunded_amount, customer_email
      FROM orders
      WHERE paypal_capture_id = ${captureId}
      FOR UPDATE
    `;

    if (!orders.length) {
      return null;
    }

    const order = orders[0];

    if (opts.dedupeKey) {
      const { claimed } = await claimRefundEvent(
        tx,
        opts.dedupeKey,
        captureId,
        source,
        opts.refundAmount ?? null
      );
      if (!claimed) {
        const orderTotal = parseFloat(String(order.total ?? '0'));
        const cumulativeRefunded = parseFloat(String(order.refunded_amount ?? '0'));
        return {
          orderId: order.id as string,
          orderNumber: order.order_number as string,
          inventoryRestored: false,
          fullRefund: order.payment_status === 'refunded',
          cumulativeRefunded,
          duplicated: true,
          customerEmail: order.customer_email as string,
          orderTotal,
          thisRefundAmount: 0,
        };
      }
    }

    const items =
      typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

    const orderTotal = parseFloat(String(order.total ?? '0'));
    const priorRefunded = parseFloat(String(order.refunded_amount ?? '0'));
    let cumulativeRefunded = priorRefunded;
    let thisRefundAmount = 0;

    if (opts.refundAmount) {
      const thisRefund = parseFloat(opts.refundAmount);
      if (!Number.isNaN(thisRefund)) {
        thisRefundAmount = thisRefund;
        cumulativeRefunded = Math.min(orderTotal, priorRefunded + thisRefund);
      }
    }

    const fullRefund =
      opts.fullRefund !== undefined
        ? opts.fullRefund
        : isFullRefundAmount(orderTotal, cumulativeRefunded.toFixed(2));

    let inventoryRestored = false;

    if (thisRefundAmount > 0) {
      await tx`
        UPDATE orders
        SET refunded_amount = ${cumulativeRefunded}, updated_at = NOW()
        WHERE id = ${order.id}
      `;
    }

    if (
      fullRefund &&
      order.status !== 'cancelled' &&
      order.payment_status !== 'refunded'
    ) {
      for (const item of items || []) {
        await tx`
          UPDATE products
          SET
            stock = stock + ${item.quantity},
            is_out_of_stock = FALSE,
            updated_at = NOW()
          WHERE id = ${item.product_id}
        `;
      }
      inventoryRestored = true;

      await tx`
        UPDATE orders
        SET
          payment_status = 'refunded',
          status = 'cancelled',
          refunded_amount = ${orderTotal},
          updated_at = NOW()
        WHERE id = ${order.id}
      `;

      cumulativeRefunded = orderTotal;
      logger.info(`Order ${order.order_number} marked refunded after capture ${captureId}`);
    } else if (!fullRefund) {
      logger.info(
        `Partial refund recorded for order ${order.order_number} (capture ${captureId}, cumulative ${cumulativeRefunded.toFixed(2)}); order remains active`
      );
    }

    return {
      orderId: order.id as string,
      orderNumber: order.order_number as string,
      inventoryRestored,
      fullRefund,
      cumulativeRefunded,
      duplicated: false,
      customerEmail: order.customer_email as string,
      orderTotal,
      thisRefundAmount,
    };
  });

  if (!result) return null;

  if (!result.duplicated) {
    if (result.fullRefund && result.inventoryRestored) {
      await releaseCouponForOrder(result.orderId).catch((err) =>
        logger.error(`Coupon release failed after refund for order ${result.orderId}:`, err)
      );
      await reverseCustomerOrderCredit(result.customerEmail, result.orderTotal).catch((err) =>
        logger.error(`Customer credit reversal failed for order ${result.orderId}:`, err)
      );
    } else if (!result.fullRefund && result.thisRefundAmount > 0) {
      await adjustCustomerPartialRefund(result.customerEmail, result.thisRefundAmount).catch(
        (err) =>
          logger.error(
            `Customer partial refund adjustment failed for order ${result.orderId}:`,
            err
          )
      );
    }
  }

  return {
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    inventoryRestored: result.inventoryRestored,
    fullRefund: result.fullRefund,
    cumulativeRefunded: result.cumulativeRefunded,
    duplicated: result.duplicated,
  };
}

/** Resolve whether a refund amount equals the order total (full refund). */
export function isFullRefundAmount(
  orderTotal: number,
  refundAmount?: string | number,
  tolerance = REFUND_TOLERANCE
): boolean {
  if (refundAmount == null || refundAmount === '') return false;
  const parsed =
    typeof refundAmount === 'number' ? refundAmount : parseFloat(refundAmount);
  if (Number.isNaN(parsed)) return false;
  return Math.abs(orderTotal - parsed) <= tolerance;
}

/** Whether order row reflects a completed refund sync (including idempotent skip). */
export async function isOrderFullyRefunded(orderId: string): Promise<boolean> {
  const rows = await sql`
    SELECT payment_status FROM orders WHERE id = ${orderId} LIMIT 1
  `;
  return rows.length > 0 && rows[0].payment_status === 'refunded';
}
