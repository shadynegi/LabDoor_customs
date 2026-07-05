import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../../backend/src/server';
import { sqlMock } from '../../../setup';
import { createCsrfAgent, withCsrf } from '../../../shared/helpers/http';
import * as paymentReconciliation from '../../../../backend/src/lib/paymentReconciliation';
import * as postPaymentCapture from '../../../../backend/src/lib/postPaymentCapture';

vi.mock('../../../../backend/src/routes/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../backend/src/routes/admin')>();
  return {
    ...actual,
    verifyAdmin: (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
      (req as import('express').Request & { admin?: { username: string } }).admin = {
        username: 'admin',
      };
      next();
    },
  };
});

describe('WhatsApp payment confirmation integration', () => {
  const orderId = '00000000-0000-4000-8000-000000000077';

  beforeEach(() => {
    sqlMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends post-capture email and WhatsApp when admin marks pending order paid', async () => {
    const completedOrder = {
      id: orderId,
      order_number: 'GSS-WA-PAID-1',
      customer_name: 'Jane Buyer',
      customer_email: 'jane@example.com',
      payment_status: 'completed',
      status: 'processing',
      total: 125,
      payment_id: 'UPI-WA-001',
      shipping_address: JSON.stringify({ phone: '9876543210', country: 'India' }),
      items: JSON.stringify([{ product_name: 'Shoe', quantity: 1, price: 125 }]),
    };

    sqlMock.mockResolvedValueOnce([
      {
        payment_status: 'pending',
        order_number: 'GSS-WA-PAID-1',
        total: 125,
      },
    ]);

    vi.spyOn(paymentReconciliation, 'completeOrderPaymentCapture').mockResolvedValue({
      updated: true,
      order: completedOrder,
    } as Awaited<ReturnType<typeof paymentReconciliation.completeOrderPaymentCapture>>);

    const notifySpy = vi
      .spyOn(postPaymentCapture, 'sendPostCaptureNotifications')
      .mockResolvedValue();

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(
      agent.patch(`/api/orders/${orderId}/payment-status`),
      csrfToken,
    ).send({
      payment_status: 'completed',
      admin_note: 'Paid via WhatsApp UPI',
      payment_id: 'UPI-WA-001',
    });

    expect(res.status).toBe(200);
    expect(notifySpy).toHaveBeenCalledOnce();
    expect(notifySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: orderId,
        order_number: 'GSS-WA-PAID-1',
        customer_email: 'jane@example.com',
      }),
    );
  });

  it('does not re-send notifications when order is already marked paid', async () => {
    sqlMock.mockResolvedValueOnce([
      {
        payment_status: 'completed',
        order_number: 'GSS-ALREADY-PAID',
        total: 99,
      },
    ]);
    sqlMock.mockResolvedValueOnce([
      {
        id: orderId,
        order_number: 'GSS-ALREADY-PAID',
        payment_status: 'completed',
        status: 'processing',
        total: 99,
      },
    ]);

    const notifySpy = vi
      .spyOn(postPaymentCapture, 'sendPostCaptureNotifications')
      .mockResolvedValue();

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(
      agent.patch(`/api/orders/${orderId}/payment-status`),
      csrfToken,
    ).send({
      payment_status: 'completed',
      admin_note: 'Duplicate mark paid attempt',
      payment_id: 'UPI-DUP',
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/already marked paid/i);
    expect(notifySpy).not.toHaveBeenCalled();
  });
});
