import { emailService } from './email';
import { logger } from './logger';

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

/** Send confirmation email after order payment is completed (idempotent-safe to call). */
export async function sendPostCaptureNotifications(
  order: OrderRow,
  options: { accessToken?: string } = {},
): Promise<void> {
  const items = parseJsonField<Array<Record<string, unknown>>>(order.items, []);
  const shippingAddress = parseJsonField<Record<string, unknown> | null>(
    order.shipping_address,
    null,
  );

  await emailService
    .sendOrderConfirmation({
      customerName: String(order.customer_name ?? ''),
      customerEmail: String(order.customer_email ?? ''),
      orderNumber: String(order.order_number ?? ''),
      items: items.map((item) => ({
        product_name: String(item.product_name ?? item.name ?? 'Item'),
        product_image: (item.product_image ?? item.image) as string | undefined,
        quantity: Number(item.quantity ?? 1),
        price: parseFloat(String(item.price ?? '0')),
        size_value: item.size_value as string | undefined,
        size_system: item.size_system as string | undefined,
      })),
      subtotal: parseFloat(String(order.subtotal ?? '0')),
      shipping_cost: parseFloat(String(order.shipping_cost ?? '0')),
      tax: parseFloat(String(order.tax ?? '0')),
      total: parseFloat(String(order.total ?? '0')),
      shippingAddress: shippingAddress as Parameters<
        typeof emailService.sendOrderConfirmation
      >[0]['shippingAddress'],
      orderDate: new Date().toISOString(),
      orderId: String(order.id ?? ''),
      accessToken: options.accessToken,
    })
    .catch((err) => logger.error('Confirmation email error after capture:', err));
}
