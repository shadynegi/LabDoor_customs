import { describe, it, expect } from 'vitest';
import {
  buildWhatsAppOrderUrl,
  formatWhatsAppOrderMessage,
  getWhatsAppOrderPhone,
} from '../../backend/src/lib/whatsappCheckout';

describe('whatsappCheckout', () => {
  it('formats order message with totals and customer details', () => {
    const message = formatWhatsAppOrderMessage({
      orderId: 'uuid-123',
      orderNumber: 'GSS-TEST-001',
      customer: {
        fullName: 'John Doe',
        email: 'john@example.com',
        phone: '+919876543210',
        address: '123 Main St',
        city: 'Mumbai',
        state: 'MH',
        zipCode: '400001',
        country: 'India',
      },
      lineItems: [
        {
          product_id: 1,
          product_name: 'Test Shoe',
          quantity: 2,
          price: 50,
        },
      ],
      pricing: {
        subtotal: 100,
        shipping: 25,
        tax: 0,
        volumeDiscount: 0,
        volumeDiscountPercent: 0,
        couponDiscount: 0,
        discount: 0,
        total: 125,
      },
    });

    expect(message).toContain('New Order');
    expect(message).toContain('Order ID: GSS-TEST-001');
    expect(message).toContain('John Doe');
    expect(message).toContain('Test Shoe');
    expect(message).toContain('Total: $125.00');
  });

  it('builds wa.me URL with encoded message', () => {
    const url = buildWhatsAppOrderUrl('Hello World');
    expect(url).toMatch(/^https:\/\/wa\.me\/919888514572\?text=/);
    expect(url).toContain(encodeURIComponent('Hello World'));
  });

  it('uses WHATSAPP_ORDER_PHONE when set', () => {
    const prev = process.env.WHATSAPP_ORDER_PHONE;
    process.env.WHATSAPP_ORDER_PHONE = '+1 555 123 4567';
    expect(getWhatsAppOrderPhone()).toBe('15551234567');
    process.env.WHATSAPP_ORDER_PHONE = prev;
  });
});
