import { describe, it, expect, vi, afterEach } from 'vitest';
import * as email from '../../backend/src/lib/email';
import * as whatsappNotifications from '../../backend/src/lib/whatsappNotifications';
import { sendPostCaptureNotifications } from '../../backend/src/lib/postPaymentCapture';

describe('sendPostCaptureNotifications', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends confirmation email and WhatsApp notification', async () => {
    const sendOrderConfirmation = vi
      .spyOn(email.emailService, 'sendOrderConfirmation')
      .mockResolvedValue({ success: true });
    const sendWhatsApp = vi
      .spyOn(whatsappNotifications, 'sendWhatsAppPaymentConfirmation')
      .mockResolvedValue({ success: true });

    await sendPostCaptureNotifications({
      id: '00000000-0000-4000-8000-000000000003',
      order_number: 'GSS-CAP-1',
      customer_name: 'Alex Buyer',
      customer_email: 'alex@example.com',
      subtotal: 90,
      shipping_cost: 10,
      tax: 0,
      total: 100,
      items: JSON.stringify([
        { product_name: 'Test Shoe', quantity: 1, price: 90 },
      ]),
      shipping_address: JSON.stringify({
        phone: '9876543210',
        country: 'India',
        address: '123 Main',
        city: 'Mumbai',
        state: 'MH',
        zip_code: '400001',
      }),
    });

    expect(sendOrderConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        customerEmail: 'alex@example.com',
        orderNumber: 'GSS-CAP-1',
        orderId: '00000000-0000-4000-8000-000000000003',
      }),
    );
    expect(sendWhatsApp).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: '00000000-0000-4000-8000-000000000003',
        orderNumber: 'GSS-CAP-1',
        customerName: 'Alex Buyer',
        total: 100,
      }),
    );
  });
});
