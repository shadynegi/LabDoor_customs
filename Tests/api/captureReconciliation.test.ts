import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import { sqlMock } from '../setup';
import { createCsrfAgent, withCsrf } from '../helpers/http';
import { hashOrderAccessToken } from '../../backend/src/lib/orderTokens';
import * as paymentReconciliation from '../../backend/src/lib/paymentReconciliation';
import * as paypalClient from '../../backend/src/lib/paypalClient';

describe('POST /api/paypal/capture-payment 409 reconciliation', () => {
  beforeEach(() => {
    sqlMock.mockReset();

    vi.spyOn(paypalClient, 'getPayPalAccessToken').mockResolvedValue('paypal-test-token');
    vi.spyOn(paypalClient, 'paypalFetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        purchase_units: [
          {
            payments: {
              captures: [{ id: 'CAP-TEST-1', amount: { value: '100.00', currency_code: 'USD' } }],
            },
          },
        ],
      }),
    } as Response);

    vi.spyOn(paymentReconciliation, 'completeOrderPaymentCapture').mockResolvedValue({
      updated: false,
      order: {
        payment_status: 'pending',
        order_number: 'GSS-409',
        paypal_capture_id: null,
        total: 100,
      },
    } as Awaited<ReturnType<typeof paymentReconciliation.completeOrderPaymentCapture>>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 409 when PayPal capture succeeds but order stays pending', async () => {
    const accessToken = 'b'.repeat(64);
    const tokenHash = hashOrderAccessToken(accessToken);

    sqlMock.mockResolvedValueOnce([
      {
        id: '00000000-0000-0000-0000-000000000088',
        order_number: 'GSS-409',
        paypal_order_id: 'PAYPAL-409',
        access_token_hash: tokenHash,
        payment_status: 'pending',
        total: 100,
      },
    ]);

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(
      agent.post('/api/paypal/capture-payment/PAYPAL-409'),
      csrfToken
    ).send({
      serverOrderId: '00000000-0000-0000-0000-000000000088',
      accessToken,
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/not updated after payment capture/i);
    expect(res.body.payment_status).toBe('pending');
  });
});
