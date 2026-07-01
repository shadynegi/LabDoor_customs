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

  it('includes volume discount, coupon, size, and free shipping in message', () => {
    const message = formatWhatsAppOrderMessage({
      orderId: 'uuid-456',
      orderNumber: 'GSS-VOL-001',
      customer: {
        fullName: 'Alex Smith',
        email: 'alex@example.com',
      },
      lineItems: [
        {
          product_id: 2,
          product_name: 'Premium Drop',
          quantity: 1,
          price: 250,
          size_system: 'US',
          size_value: '10',
        },
      ],
      pricing: {
        subtotal: 250,
        shipping: 0,
        tax: 0,
        volumeDiscount: 25,
        volumeDiscountPercent: 10,
        couponDiscount: 22.5,
        discount: 47.5,
        total: 202.5,
      },
      couponCode: 'LDCOFF10',
    });

    expect(message).toContain('Size: US 10');
    expect(message).toContain('Volume discount (10%): -$25.00');
    expect(message).toContain('Coupon (LDCOFF10): -$22.50');
    expect(message).toContain('Shipping: Free');
    expect(message).toContain('Total: $202.50');
  });

  it('omits phone line when customer phone is blank', () => {
    const message = formatWhatsAppOrderMessage({
      orderId: 'uuid-789',
      orderNumber: 'GSS-NOPHONE',
      customer: {
        fullName: 'No Phone User',
        email: 'nophone@example.com',
        phone: '   ',
      },
      lineItems: [
        {
          product_id: 1,
          product_name: 'Basic Shoe',
          quantity: 1,
          price: 50,
        },
      ],
      pricing: {
        subtotal: 50,
        shipping: 25,
        tax: 0,
        volumeDiscount: 0,
        volumeDiscountPercent: 0,
        couponDiscount: 0,
        discount: 0,
        total: 75,
      },
    });

    expect(message).not.toMatch(/^Phone:/m);
    expect(message).toContain('No Phone User');
  });

  it('URL-encodes special characters in the message', () => {
    const message = 'Line 1\nLine 2 & total $99.00';
    const url = buildWhatsAppOrderUrl(message);

    expect(url).toContain(encodeURIComponent('\n'));
    expect(url).toContain(encodeURIComponent('&'));
    expect(decodeURIComponent(url.split('?text=')[1] ?? '')).toBe(message);
  });
});
