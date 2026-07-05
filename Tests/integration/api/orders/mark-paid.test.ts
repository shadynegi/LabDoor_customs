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

describe('PATCH /api/orders/:id/payment-status', () => {
  const orderId = '00000000-0000-0000-0000-000000000077';

  beforeEach(() => {
    sqlMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks pending order paid with payment reference', async () => {
    const completedOrder = {
      id: orderId,
      order_number: 'GSS-PAID-1',
      payment_status: 'completed',
      status: 'processing',
      total: 99,
      payment_id: 'UPI-12345',
    };

    sqlMock.mockResolvedValueOnce([
      {
        payment_status: 'pending',
        order_number: 'GSS-PAID-1',
        total: 99,
      },
    ]);

    vi.spyOn(paymentReconciliation, 'completeOrderPaymentCapture').mockResolvedValue({
      updated: true,
      order: completedOrder,
    } as Awaited<ReturnType<typeof paymentReconciliation.completeOrderPaymentCapture>>);
    vi.spyOn(postPaymentCapture, 'sendPostCaptureNotifications').mockResolvedValue();

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(
      agent.patch(`/api/orders/${orderId}/payment-status`),
      csrfToken
    ).send({
      payment_status: 'completed',
      admin_note: 'Paid via WhatsApp',
      payment_id: 'UPI-12345',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.payment_status).toBe('completed');
    expect(res.body.message).toMatch(/updated successfully/i);
    expect(postPaymentCapture.sendPostCaptureNotifications).toHaveBeenCalledOnce();
  });

  it('requires admin_note and payment_id when marking pending order paid', async () => {
    sqlMock.mockResolvedValueOnce([
      {
        payment_status: 'pending',
        order_number: 'GSS-1',
        total: 99,
      },
    ]);

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(
      agent.patch(`/api/orders/${orderId}/payment-status`),
      csrfToken
    ).send({ payment_status: 'completed' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/admin_note/i);
  });
});
