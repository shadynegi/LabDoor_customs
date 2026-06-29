import type { ValidatedLineItem } from './orderLifecycle';
import type { PricingBreakdown } from './checkoutPricing';

const DEFAULT_WHATSAPP_PHONE = '919888514572';

export function getWhatsAppOrderPhone(): string {
  const raw = process.env.WHATSAPP_ORDER_PHONE?.trim() || DEFAULT_WHATSAPP_PHONE;
  return raw.replace(/\D/g, '');
}

export interface WhatsAppOrderMessageInput {
  orderId: string;
  orderNumber: string;
  customer: {
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
  pricing: PricingBreakdown;
  couponCode?: string;
}

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatWhatsAppOrderMessage(input: WhatsAppOrderMessageInput): string {
  const { orderId, orderNumber, customer, lineItems, pricing, couponCode } = input;
  const lines: string[] = ['New Order', '', `Order ID: ${orderNumber}`, `Reference: ${orderId}`, ''];

  lines.push('Customer:');
  lines.push(`Name: ${customer.fullName}`);
  if (customer.phone?.trim()) lines.push(`Phone: ${customer.phone.trim()}`);
  lines.push(`Email: ${customer.email}`);
  lines.push('');

  lines.push('Shipping Address:');
  if (customer.address?.trim()) lines.push(customer.address.trim());
  const cityLine = [customer.city, customer.state, customer.zipCode].filter(Boolean).join(', ');
  if (cityLine) lines.push(cityLine);
  if (customer.country?.trim()) lines.push(customer.country.trim());
  lines.push('');

  lines.push('Items:');
  lineItems.forEach((item, index) => {
    lines.push(`${index + 1}.`);
    lines.push(item.product_name);
    if (item.size_system && item.size_value) {
      lines.push(`Size: ${item.size_system} ${item.size_value}`);
    }
    lines.push(`Qty: ${item.quantity}`);
    lines.push(`Price: ${formatMoney(item.price * item.quantity)}`);
    lines.push('');
  });

  lines.push(`Subtotal: ${formatMoney(pricing.subtotal)}`);
  if (pricing.volumeDiscount > 0) {
    lines.push(`Volume discount (${pricing.volumeDiscountPercent}%): -${formatMoney(pricing.volumeDiscount)}`);
  }
  if (pricing.couponDiscount > 0) {
    const label = couponCode ? `Coupon (${couponCode})` : 'Coupon discount';
    lines.push(`${label}: -${formatMoney(pricing.couponDiscount)}`);
  }
  lines.push(`Shipping: ${pricing.shipping === 0 ? 'Free' : formatMoney(pricing.shipping)}`);
  lines.push(`Total: ${formatMoney(pricing.total)}`);

  return lines.join('\n');
}

export function buildWhatsAppOrderUrl(message: string): string {
  const phone = getWhatsAppOrderPhone();
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
