import sql from './db';
import { logger } from './logger';
import { upsertCustomerFromOrder } from './customers';
import { syncOrderLineItemsForOrder } from './orderLineItems';

type OrderRow = Record<string, unknown>;

/** Mark a pending order paid after admin confirms payment (WhatsApp / manual). */
export async function completeOrderPaymentCapture(
  serverOrderId: string,
  paymentReference: string | null
): Promise<{ updated: boolean; order: OrderRow | null }> {
  const reference = paymentReference?.trim() || null;

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

    if (!reference || reference.length < 3) {
      logger.error(
        `Refusing payment completion: missing payment reference for order ${serverOrderId}`
      );
      return { updated: false, order: current };
    }

    const updated = await tx`
      UPDATE orders SET
        payment_status = 'completed',
        payment_id = ${reference},
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
