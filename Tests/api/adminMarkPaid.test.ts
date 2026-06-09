import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import { sqlMock } from '../setup';
import { createCsrfAgent, withCsrf } from '../helpers/http';

vi.mock('../../backend/src/routes/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../backend/src/routes/admin')>();
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

vi.mock('../../backend/src/lib/paypalCaptureVerify', () => ({
  verifyPayPalCaptureForOrder: vi.fn(async () => ({ ok: true, captureId: 'CAP-ADMIN-1' })),
}));

describe('PATCH /api/orders/:id/payment-status', () => {
  beforeEach(() => {
    sqlMock.mockReset();
  });

  it('requires admin_note and payment_id when marking pending order paid', async () => {
    sqlMock.mockResolvedValueOnce([
      {
        payment_status: 'pending',
        order_number: 'GSS-1',
        total: 99,
        paypal_order_id: 'PP-1',
        paypal_capture_id: null,
      },
    ]);

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(
      agent.patch('/api/orders/00000000-0000-0000-0000-000000000077/payment-status'),
      csrfToken
    ).send({ payment_status: 'completed' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/admin_note/i);
  });
});
