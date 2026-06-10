import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import { sqlMock } from '../setup';
import { createCsrfAgent, withCsrf } from '../helpers/http';
import * as paypalClient from '../../backend/src/lib/paypalClient';

const createPendingMock = vi.fn();
const createCheckoutExchangeMock = vi.fn();

vi.mock('../../backend/src/lib/paypalCheckout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../backend/src/lib/paypalCheckout')>();
  return {
    ...actual,
    createPendingPayPalOrder: (...args: unknown[]) => createPendingMock(...args),
  };
});

vi.mock('../../backend/src/lib/orderCheckoutExchange', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../backend/src/lib/orderCheckoutExchange')>();
  return {
    ...actual,
    createCheckoutExchangeCode: (...args: unknown[]) => createCheckoutExchangeMock(...args),
  };
});

describe('POST /api/paypal/create-payment happy path', () => {
  const serverOrderId = '00000000-0000-0000-0000-00000000aa01';

  beforeEach(() => {
    sqlMock.mockReset();
    createPendingMock.mockReset();
    createCheckoutExchangeMock.mockReset();

    createPendingMock.mockResolvedValue({
      order: { id: serverOrderId },
      orderNumber: 'GSS-HAPPY-1',
      accessToken: 'a'.repeat(64),
    });
    createCheckoutExchangeMock.mockResolvedValue('CHECKOUT-EXCHANGE-CODE');

    vi.spyOn(paypalClient, 'getPayPalAccessToken').mockResolvedValue('paypal-test-token');
    vi.spyOn(paypalClient, 'paypalFetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: 'PAYPAL-HAPPY-1',
        status: 'CREATED',
        links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-HAPPY-1' }],
      }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates bound PayPal order, checkout exchange code, and returns approval link', async () => {
    sqlMock
      .mockResolvedValueOnce([
        {
          id: 1,
          name: 'Test Shoe',
          price: 100,
          image: '/assets/test.png',
          stock: 10,
          is_out_of_stock: false,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/paypal/create-payment'), csrfToken).send({
      currency: 'USD',
      customerInfo: {
        fullName: 'Test Buyer',
        email: 'buyer@example.com',
        phone: '5551234567',
        address: '123 Test Street Suite 100',
        city: 'Testville',
        state: 'CA',
        zipCode: '12345',
        country: 'United States',
      },
      policy_accepted: true,
      items: [{ product_id: 1, quantity: 1 }],
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.orderId).toBe('PAYPAL-HAPPY-1');
    expect(res.body.serverOrderId).toBe(serverOrderId);
    expect(res.body.orderNumber).toBe('GSS-HAPPY-1');
    expect(res.body.links?.[0]?.href).toContain('paypal.com');
    expect(createPendingMock).toHaveBeenCalledTimes(1);
    expect(createCheckoutExchangeMock).toHaveBeenCalledWith(serverOrderId, 'a'.repeat(64));
  });
});
