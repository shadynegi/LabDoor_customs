import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../../backend/src/server';
import { sqlMock } from '../../../setup';
import * as whatsappNotifications from '../../../../backend/src/lib/whatsappNotifications';

vi.mock('../../../../backend/src/routes/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../backend/src/routes/admin')>();
  return {
    ...actual,
    verifyAdmin: (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
      (req as import('express').Request & { admin?: { username: string } }).admin = { username: 'admin' };
      next();
    },
  };
});

describe('POST /api/orders/:id/notify-shipped', () => {
  const orderId = '00000000-0000-0000-0000-000000000099';

  beforeEach(() => {
    sqlMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 404 when order is not found', async () => {
    sqlMock.mockResolvedValueOnce([]);

    const res = await request(app)
      .post(`/api/orders/${orderId}/notify-shipped`)
      .set('x-csrf-token', 'test')
      .set('Cookie', 'csrf_token=test');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Order not found');
  });

  it('returns 400 when order has no tracking number', async () => {
    sqlMock.mockResolvedValueOnce([{
      id: orderId,
      order_number: 'GSS-NOTIFY-1',
      customer_name: 'Test User',
      tracking_number: null,
      shipping_address: { line1: '123 Main St', city: 'Mumbai', country: 'IN' },
    }]);

    const res = await request(app)
      .post(`/api/orders/${orderId}/notify-shipped`)
      .set('x-csrf-token', 'test')
      .set('Cookie', 'csrf_token=test');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tracking number/i);
  });

  it('calls sendWhatsAppShippingNotification and returns 200 on success', async () => {
    sqlMock.mockResolvedValueOnce([{
      id: orderId,
      order_number: 'GSS-NOTIFY-2',
      customer_name: 'Test User',
      tracking_number: 'TRK123456',
      tracking_url: 'https://track.example.com/TRK123456',
      carrier: 'DHL',
      estimated_delivery: '2026-08-01',
      shipping_address: { line1: '123 Main St', city: 'Mumbai', country: 'IN' },
    }]);

    const spy = vi.spyOn(whatsappNotifications, 'sendWhatsAppShippingNotification').mockResolvedValueOnce({ success: true });

    const res = await request(app)
      .post(`/api/orders/${orderId}/notify-shipped`)
      .set('x-csrf-token', 'test')
      .set('Cookie', 'csrf_token=test');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      orderId,
      trackingNumber: 'TRK123456',
      carrier: 'DHL',
    }));
  });

  it('returns 503 when WhatsApp is not configured', async () => {
    sqlMock.mockResolvedValueOnce([{
      id: orderId,
      order_number: 'GSS-NOTIFY-3',
      customer_name: 'Test User',
      tracking_number: 'TRK999',
      tracking_url: null,
      carrier: null,
      estimated_delivery: null,
      shipping_address: { city: 'Delhi' },
    }]);

    vi.spyOn(whatsappNotifications, 'sendWhatsAppShippingNotification').mockResolvedValueOnce({ success: false, skipped: true });

    const res = await request(app)
      .post(`/api/orders/${orderId}/notify-shipped`)
      .set('x-csrf-token', 'test')
      .set('Cookie', 'csrf_token=test');

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/WhatsApp not configured/i);
  });
});
