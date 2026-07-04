import { logger } from './logger';
import { sendWhatsAppPaymentConfirmation } from './whatsappNotifications';

type OrderRow = Record<string, unknown>;

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

/** Send confirmation WhatsApp after order payment is completed (idempotent-safe to call). */
export async function sendPostCaptureNotifications(order: OrderRow): Promise<void> {
  const shippingAddress = parseJsonField<Record<string, unknown> | null>(
    order.shipping_address,
    null,
  );

  await sendWhatsAppPaymentConfirmation({
    orderId: String(order.id ?? ''),
    orderNumber: String(order.order_number ?? ''),
    customerName: String(order.customer_name ?? ''),
    total: parseFloat(String(order.total ?? '0')),
    shippingAddress,
  }).catch((err) => logger.error('WhatsApp confirmation error after capture:', err));
}
