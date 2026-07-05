import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatPaymentConfirmationWhatsAppMessage,
  normalizeCustomerPhoneForWhatsApp,
  sendWhatsAppPaymentConfirmation,
  sendWhatsAppTextMessage,
} from '../../../../backend/src/lib/whatsappNotifications';

describe('whatsappNotifications', () => {
  describe('normalizeCustomerPhoneForWhatsApp', () => {
    it('returns null for missing or too-short numbers', () => {
      expect(normalizeCustomerPhoneForWhatsApp(undefined)).toBeNull();
      expect(normalizeCustomerPhoneForWhatsApp('12345')).toBeNull();
    });

    it('prefixes India country code for 10-digit local numbers', () => {
      expect(normalizeCustomerPhoneForWhatsApp('9876543210', 'India')).toBe('919876543210');
    });

    it('prefixes US country code when country is United States', () => {
      expect(normalizeCustomerPhoneForWhatsApp('5551234567', 'United States')).toBe('15551234567');
    });

    it('keeps numbers that already include country code', () => {
      expect(normalizeCustomerPhoneForWhatsApp('+919876543210')).toBe('919876543210');
    });
  });

  describe('formatPaymentConfirmationWhatsAppMessage', () => {
    it('includes order id, total, and track link', () => {
      const message = formatPaymentConfirmationWhatsAppMessage({
        orderId: '00000000-0000-4000-8000-000000000001',
        orderNumber: 'GSS-TEST-1',
        customerName: 'Jane Doe',
        total: 125.5,
        trackUrl: 'https://example.com/orders?orderId=abc',
      });

      expect(message).toContain('Hi Jane Doe');
      expect(message).toContain('payment has been confirmed');
      expect(message).toContain('Order ID: 00000000-0000-4000-8000-000000000001');
      expect(message).toContain('GSS-TEST-1');
      expect(message).toContain('Total: $125.50');
      expect(message).toContain('https://example.com/orders?orderId=abc');
    });

    it('builds track URL from orderId when trackUrl omitted', () => {
      const prev = process.env.FRONTEND_URL;
      process.env.FRONTEND_URL = 'https://shop.labdoor.com';

      const message = formatPaymentConfirmationWhatsAppMessage({
        orderId: '00000000-0000-4000-8000-000000000004',
        orderNumber: 'GSS-TRACK-2',
        customerName: 'Sam',
        total: 99,
      });

      expect(message).toContain(
        'https://shop.labdoor.com/orders?orderId=00000000-0000-4000-8000-000000000004',
      );

      process.env.FRONTEND_URL = prev;
    });
  });

  describe('sendWhatsAppTextMessage', () => {
    const prevToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
    const prevPhoneId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;

    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = prevToken;
      process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = prevPhoneId;
      vi.unstubAllGlobals();
    });

    it('skips when Cloud API env vars are missing', async () => {
      delete process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
      delete process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;

      const result = await sendWhatsAppTextMessage('919876543210', 'Hello');

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('calls Graph API when configured', async () => {
      process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = 'test-token';
      process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = '123456789';

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.test' }] }),
      } as Response);

      const result = await sendWhatsAppTextMessage('919876543210', 'Payment confirmed');

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/123456789/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      );
    });

    it('returns error when Graph API responds with failure', async () => {
      process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = 'test-token';
      process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = '123456789';

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Invalid phone' } }),
      } as Response);

      const result = await sendWhatsAppTextMessage('919876543210', 'Payment confirmed');

      expect(result.success).toBe(false);
      expect(result.error).toEqual({ error: { message: 'Invalid phone' } });
    });
  });

  describe('sendWhatsAppPaymentConfirmation', () => {
    const prevToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
    const prevPhoneId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;

    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = prevToken;
      process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = prevPhoneId;
      vi.unstubAllGlobals();
    });

    it('skips when shipping address has no phone', async () => {
      const result = await sendWhatsAppPaymentConfirmation({
        orderId: '00000000-0000-4000-8000-000000000002',
        orderNumber: 'GSS-1',
        customerName: 'No Phone',
        total: 50,
        shippingAddress: { country: 'India' },
      });

      expect(result.skipped).toBe(true);
    });

    it('sends confirmation text to normalized customer phone', async () => {
      process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = 'test-token';
      process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = '123456789';

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.confirm' }] }),
      } as Response);

      const result = await sendWhatsAppPaymentConfirmation({
        orderId: '00000000-0000-4000-8000-000000000005',
        orderNumber: 'GSS-WA-NOTIFY',
        customerName: 'WhatsApp User',
        total: 200,
        shippingAddress: { phone: '9876543210', country: 'India' },
      });

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledOnce();

      const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(String(init.body)) as {
        to: string;
        text: { body: string };
      };
      expect(body.to).toBe('919876543210');
      expect(body.text.body).toContain('GSS-WA-NOTIFY');
      expect(body.text.body).toContain('00000000-0000-4000-8000-000000000005');
    });
  });
});
