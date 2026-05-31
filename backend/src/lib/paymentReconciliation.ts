import sql from './db';
import { logger } from './logger';
import { cancelPendingOrderAndRestoreStock } from './orderLifecycle';
import { refundPayPalCapture } from './paypalRefund';
import { upsertCustomerFromOrder } from './customers';
import { amountsMatch } from './paypalCheckout';

type OrderRow = Record<string, unknown>;

/** Complete a pending order after successful PayPal capture (idempotent). */
export async function completeOrderPaymentCapture(
  serverOrderId: string,
  captureId: string | null
): Promise<{ updated: boolean; order: OrderRow | null }> {
  return sql.begin(async (tx) => {
    const locked = await tx`
      SELECT * FROM orders WHERE id = ${serverOrderId} FOR UPDATE
    `;
    if (!locked.length) {
      return { updated: false, order: null };
    }

    const current = locked[0];
    if (current.payment_status === 'completed') {
      return { updated: false, order: current };
    }

    if (current.payment_status !== 'pending') {
      return { updated: false, order: current };
    }

    if (captureId) {
      const duplicateCapture = await tx`
        SELECT id FROM orders
        WHERE paypal_capture_id = ${captureId} AND id != ${serverOrderId}
        LIMIT 1
      `;
      if (duplicateCapture.length) {
        logger.error(
          `Refusing capture: paypal_capture_id ${captureId} already bound to order ${duplicateCapture[0].id}`
        );
        return { updated: false, order: current };
      }
    }

    const updated = await tx`
      UPDATE orders SET
        payment_status = 'completed',
        paypal_capture_id = ${captureId},
        status = 'processing',
        updated_at = NOW()
      WHERE id = ${serverOrderId} AND payment_status = 'pending'
      RETURNING *
    `;

    if (!updated.length) {
      return { updated: false, order: current };
    }

    return { updated: true, order: updated[0] };
  }).then(async (result) => {
    if (result.updated && result.order) {
      try {
        await upsertCustomerFromOrder(
          result.order.customer_email as string,
          result.order.customer_name as string,
          parseFloat(String(result.order.total ?? '0'))
        );
      } catch (error) {
        logger.error('Customer sync error after payment capture:', error);
      }
    }
    return result;
  });
}

/** Auto-refund and roll back a pending order when capture amount mismatches. */
export async function revertCaptureAmountMismatch(
  serverOrderId: string,
  captureId: string
): Promise<{ refunded: boolean; rolledBack: boolean }> {
  const refund = await refundPayPalCapture(captureId);
  if (!refund.success) {
    logger.error('Auto-refund failed after capture amount mismatch:', refund.error);
  }

  const rolledBack = await cancelPendingOrderAndRestoreStock(serverOrderId);
  return { refunded: refund.success, rolledBack };
}

/** Idempotently fail a pending checkout by PayPal order id (webhook / denied). */
export async function failPendingOrderByPayPalId(paypalOrderId: string): Promise<boolean> {
  const rows = await sql`
    SELECT id, payment_status, status
    FROM orders
    WHERE paypal_order_id = ${paypalOrderId}
    LIMIT 1
  `;

  if (!rows.length) return false;

  const order = rows[0];
  if (order.payment_status !== 'pending' || order.status !== 'pending') {
    return false;
  }

  return cancelPendingOrderAndRestoreStock(order.id as string);
}

/** Webhook: mark payment completed with amount validation. */
export async function syncWebhookPaymentCompleted(
  paypalOrderId: string,
  captureId: string,
  capturedAmount?: number | null
): Promise<void> {
  const rows = await sql`
    SELECT id, total, payment_status FROM orders WHERE paypal_order_id = ${paypalOrderId} LIMIT 1
  `;
  if (!rows.length) {
    logger.warn(`Webhook: order not found for PayPal order ${paypalOrderId}`);
    return;
  }

  const serverOrderId = rows[0].id as string;
  const expectedTotal = parseFloat(String(rows[0].total ?? '0'));

  if (capturedAmount != null && !amountsMatch(expectedTotal, capturedAmount)) {
    logger.error('Webhook capture amount mismatch:', {
      expected: expectedTotal,
      captured: capturedAmount,
      serverOrderId,
      paypalOrderId,
      captureId,
    });
    await revertCaptureAmountMismatch(serverOrderId, captureId);
    return;
  }

  const { updated } = await completeOrderPaymentCapture(serverOrderId, captureId);
  if (updated) {
    logger.info(`Webhook: order ${serverOrderId} marked completed`);
  }
}
