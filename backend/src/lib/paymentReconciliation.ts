import sql from './db';
import { logger } from './logger';
import { cancelPendingOrderAndRestoreStock } from './orderLifecycle';
import { refundPayPalCapture } from './paypalRefund';
import { upsertCustomerFromOrder } from './customers';
import { syncOrderLineItemsForOrder } from './orderLineItems';
import { amountsMatch } from './paypalCheckout';
import { fetchPayPalCapturedAmount } from './paypalCaptureAmount';
import { PAYPAL_API, getPayPalAccessToken, parseJson, paypalFetch } from './paypalClient';
import { parseCaptureFromPayPalOrder } from './paypalWebhookUtils';
import { WebhookProcessingError } from './webhookErrors';
import { sendPostCaptureNotifications } from './postPaymentCapture';

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

    if (!captureId || !String(captureId).trim()) {
      logger.error(
        `Refusing capture completion: missing paypal_capture_id for order ${serverOrderId}`
      );
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
        await syncOrderLineItemsForOrder(result.order.id as string);
      } catch (error) {
        logger.error('order_line_items sync error after payment capture:', error);
      }
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

/** Webhook: mark payment completed with amount validation. Throws on retryable failure. */
export async function syncWebhookPaymentCompleted(
  paypalOrderId: string,
  captureId: string,
  capturedAmount?: number | null
): Promise<void> {
  const rows = await sql`
    SELECT id, total, payment_status FROM orders WHERE paypal_order_id = ${paypalOrderId} LIMIT 1
  `;
  if (!rows.length) {
    throw new WebhookProcessingError(`Webhook: order not found for PayPal order ${paypalOrderId}`);
  }

  const serverOrderId = rows[0].id as string;
  const expectedTotal = parseFloat(String(rows[0].total ?? '0'));

  if (rows[0].payment_status === 'completed') {
    logger.info(`Webhook: order ${serverOrderId} already completed`);
    return;
  }

  let resolvedAmount = capturedAmount ?? null;
  if (resolvedAmount == null) {
    const { fetchPayPalCapturedAmount } = await import('./paypalCaptureAmount');
    resolvedAmount = await fetchPayPalCapturedAmount(paypalOrderId, captureId);
  }

  if (resolvedAmount == null) {
    throw new WebhookProcessingError(
      `Webhook: capture amount missing for PayPal order ${paypalOrderId}`
    );
  }

  if (!amountsMatch(expectedTotal, resolvedAmount)) {
    logger.error('Webhook capture amount mismatch:', {
      expected: expectedTotal,
      captured: resolvedAmount,
      serverOrderId,
      paypalOrderId,
      captureId,
    });
    await revertCaptureAmountMismatch(serverOrderId, captureId);
    throw new WebhookProcessingError(
      `Webhook: capture amount mismatch for order ${serverOrderId}`
    );
  }

  const { updated, order } = await completeOrderPaymentCapture(serverOrderId, captureId);
  if (!updated) {
    if (order?.payment_status === 'completed') {
      logger.info(`Webhook: order ${serverOrderId} already completed (race)`);
      return;
    }
    throw new WebhookProcessingError(
      `Webhook: failed to complete order ${serverOrderId} after capture`
    );
  }

  logger.info(`Webhook: order ${serverOrderId} marked completed`);

  if (order) {
    await sendPostCaptureNotifications(order);
  }
}

export type VerifiedCaptureResult =
  | { ok: true; captureId: string; amount: number }
  | { ok: false; error: 'amount_missing' | 'amount_mismatch'; revertCaptureId: string | null };

/** Fail closed: resolve amount from PayPal when missing and require a capture ID before completing. */
export async function resolveVerifiedCaptureDetails(
  paypalOrderId: string,
  captureId: string | null,
  expectedTotal: number,
  capturedAmountFromResponse: number | null
): Promise<VerifiedCaptureResult> {
  const resolvedCaptureId =
    captureId && String(captureId).trim() ? String(captureId).trim() : null;

  let resolvedAmount = capturedAmountFromResponse;
  if (resolvedAmount == null) {
    resolvedAmount = await fetchPayPalCapturedAmount(
      paypalOrderId,
      resolvedCaptureId ?? undefined
    );
  }

  if (resolvedAmount == null) {
    return { ok: false, error: 'amount_missing', revertCaptureId: resolvedCaptureId };
  }

  if (!amountsMatch(expectedTotal, resolvedAmount)) {
    return { ok: false, error: 'amount_mismatch', revertCaptureId: resolvedCaptureId };
  }

  let finalCaptureId = resolvedCaptureId;
  if (!finalCaptureId) {
    try {
      const accessToken = await getPayPalAccessToken();
      const orderRes = await paypalFetch(`${PAYPAL_API}/v2/checkout/orders/${paypalOrderId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (orderRes.ok) {
        const orderData = await parseJson<Record<string, unknown>>(orderRes);
        finalCaptureId = parseCaptureFromPayPalOrder(orderData).captureId;
      }
    } catch (error) {
      logger.warn('Failed to resolve PayPal capture ID from order:', error);
    }
  }

  if (!finalCaptureId) {
    return { ok: false, error: 'amount_missing', revertCaptureId: null };
  }

  return { ok: true, captureId: finalCaptureId, amount: resolvedAmount };
}

