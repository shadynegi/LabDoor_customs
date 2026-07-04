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

describe('no-refund store policy (admin)', () => {
  beforeEach(() => {
    sqlMock.mockReset();
  });

  it('POST /api/orders/:id/cancel returns 403 for paid orders', async () => {
    const orderId = '00000000-0000-0000-0000-00000000aa01';

    sqlMock.mockResolvedValueOnce([
      {
        id: orderId,
        status: 'processing',
        payment_status: 'completed',
        items: JSON.stringify([{ product_id: 1, quantity: 1 }]),
        shipping_address: JSON.stringify({}),
      },
    ]);

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post(`/api/orders/${orderId}/cancel`), csrfToken).send({
      reason: 'Customer changed mind',
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Refunds not available');
    expect(res.body.message).toMatch(/cannot be cancelled or refunded/i);
  });
});
