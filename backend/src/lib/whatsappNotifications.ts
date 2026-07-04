import { buildOrderPortalUrl } from './orderPortalUrl';
import { logger } from './logger';

export interface PaymentConfirmationWhatsAppInput {
  orderId: string;
  orderNumber: string;
  customerName: string;
  total: number;
  trackUrl?: string;
}

export function normalizeCustomerPhoneForWhatsApp(
  raw: string | undefined | null,
  country?: string | null,
): string | null {
  if (!raw?.trim()) return null;

  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length >= 11) return digits;

  const countryKey = (country ?? '').trim().toLowerCase();
  if (countryKey === 'india' || countryKey === 'in') return `91${digits}`;
  if (countryKey === 'united states' || countryKey === 'us' || countryKey === 'usa') {
    return `1${digits}`;
  }

  // Default country code for the store's primary market (WHATSAPP_CONTACT_NUMBER).
  return `91${digits}`;
}

export function formatPaymentConfirmationWhatsAppMessage(
  input: PaymentConfirmationWhatsAppInput,
): string {
  const trackUrl =
    input.trackUrl ??
    buildOrderPortalUrl({ orderId: input.orderId });

  return [
    `Hi ${input.customerName || 'there'},`,
    '',
    `Your payment has been confirmed for order ${input.orderNumber}.`,
    `Order ID: ${input.orderId}`,
    `Total: $${input.total.toFixed(2)}`,
    '',
    `Track your order: ${trackUrl}`,
    '',
    'Thank you for shopping with Lab Door Customs!',
  ].join('\n');
}

export async function sendWhatsAppTextMessage(
  toPhoneE164: string,
  body: string,
): Promise<{ success: boolean; skipped?: boolean; error?: unknown }> {
  const token = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim();

  if (!token || !phoneNumberId) {
    logger.warn(
      'WhatsApp Cloud API not configured (WHATSAPP_CLOUD_ACCESS_TOKEN / WHATSAPP_CLOUD_PHONE_NUMBER_ID); skipping customer WhatsApp notification',
    );
    return { success: false, skipped: true };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toPhoneE164,
          type: 'text',
          text: { preview_url: true, body },
        }),
      },
    );

    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      logger.error('WhatsApp Cloud API send failed', {
        status: response.status,
        payload,
      });
      return { success: false, error: payload };
    }

    logger.info('WhatsApp payment confirmation sent', { to: toPhoneE164 });
    return { success: true };
  } catch (error) {
    logger.error('WhatsApp Cloud API error', error);
    return { success: false, error };
  }
}

export async function sendWhatsAppPaymentConfirmation(input: {
  orderId: string;
  orderNumber: string;
  customerName: string;
  total: number;
  shippingAddress: Record<string, unknown> | null;
}): Promise<{ success: boolean; skipped?: boolean; error?: unknown }> {
  const phoneRaw =
    (input.shippingAddress?.phone as string | undefined) ??
    (input.shippingAddress?.mobile as string | undefined);
  const country = input.shippingAddress?.country as string | undefined;
  const toPhone = normalizeCustomerPhoneForWhatsApp(phoneRaw, country);

  if (!toPhone) {
    logger.warn('No valid customer phone on order; skipping WhatsApp payment confirmation', {
      orderId: input.orderId,
    });
    return { success: false, skipped: true };
  }

  const message = formatPaymentConfirmationWhatsAppMessage({
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    customerName: input.customerName,
    total: input.total,
  });

  return sendWhatsAppTextMessage(toPhone, message);
}

export interface ShippingWhatsAppInput {
  orderId: string;
  orderNumber: string;
  customerName: string;
  trackingNumber: string;
  trackingUrl?: string;
  carrier?: string;
  estimatedDelivery?: string;
  shippingAddress: Record<string, unknown> | null;
}

export function formatShippingWhatsAppMessage(input: ShippingWhatsAppInput): string {
  const trackUrl = input.trackingUrl ?? buildOrderPortalUrl({ orderId: input.orderId });
  const lines = [
    `Hi ${input.customerName || 'there'},`,
    '',
    `Your order ${input.orderNumber} has shipped!`,
    `Tracking: ${input.trackingNumber}`,
  ];
  if (input.carrier?.trim()) lines.push(`Carrier: ${input.carrier.trim()}`);
  if (input.estimatedDelivery?.trim()) {
    lines.push(`Estimated delivery: ${input.estimatedDelivery.trim()}`);
  }
  lines.push('', `Track your order: ${trackUrl}`);
  return lines.join('\n');
}

export async function sendWhatsAppShippingNotification(
  input: ShippingWhatsAppInput,
): Promise<{ success: boolean; skipped?: boolean; error?: unknown }> {
  const phoneRaw =
    (input.shippingAddress?.phone as string | undefined) ??
    (input.shippingAddress?.mobile as string | undefined);
  const country = input.shippingAddress?.country as string | undefined;
  const toPhone = normalizeCustomerPhoneForWhatsApp(phoneRaw, country);

  if (!toPhone) {
    logger.warn('No valid customer phone on order; skipping WhatsApp shipping notification', {
      orderId: input.orderId,
    });
    return { success: false, skipped: true };
  }

  const message = formatShippingWhatsAppMessage(input);
  return sendWhatsAppTextMessage(toPhone, message);
}

function parseShippingAddress(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') return value as Record<string, unknown>;
  return null;
}

/** Fire-and-forget shipping WhatsApp when order status becomes shipped. */
export function queueShippingWhatsAppNotification(order: {
  id?: unknown;
  order_number?: string | null;
  customer_name: string;
  tracking_number?: string | null;
  tracking_url?: string | null;
  carrier?: string | null;
  estimated_delivery?: string | null;
  shipping_address: unknown;
}): void {
  if (!order.id || !order.tracking_number) return;

  sendWhatsAppShippingNotification({
    orderId: String(order.id),
    orderNumber: String(order.order_number ?? ''),
    customerName: order.customer_name,
    trackingNumber: order.tracking_number,
    trackingUrl: order.tracking_url ?? undefined,
    carrier: order.carrier ?? undefined,
    estimatedDelivery: order.estimated_delivery ?? undefined,
    shippingAddress: parseShippingAddress(order.shipping_address),
  })
    .then((result) => {
      if (result.success) {
        logger.info('WhatsApp shipping notification sent for order:', order.order_number);
      } else if (!result.skipped) {
        logger.error('Failed to send WhatsApp shipping notification:', result.error);
      }
    })
    .catch((err) => {
      logger.error('Error sending WhatsApp shipping notification:', err);
    });
}
