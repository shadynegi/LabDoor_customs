import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';

const redeemMock = vi.fn();

vi.mock('../../backend/src/lib/orderCheckoutExchange', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../backend/src/lib/orderCheckoutExchange')>();
  return {
    ...actual,
    redeemCheckoutExchangeCode: (...args: unknown[]) => redeemMock(...args),
  };
});

describe('GET /api/paypal/checkout-exchange/:code', () => {
  beforeEach(() => {
    redeemMock.mockReset();
  });

  it('returns 404 for invalid or expired code', async () => {
    redeemMock.mockResolvedValue(null);

    const res = await request(app).get('/api/paypal/checkout-exchange/invalid-code');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns access context for valid code', async () => {
    redeemMock.mockResolvedValue({
      accessToken: 'a'.repeat(64),
      serverOrderId: '00000000-0000-0000-0000-000000000099',
      orderNumber: 'GSS-TEST',
      paypalOrderId: 'PAYPAL-1',
      total: 120,
    });

    const res = await request(app).get('/api/paypal/checkout-exchange/VALIDCODE12');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.accessToken).toBe('a'.repeat(64));
    expect(res.body.serverOrderId).toBe('00000000-0000-0000-0000-000000000099');
  });
});
