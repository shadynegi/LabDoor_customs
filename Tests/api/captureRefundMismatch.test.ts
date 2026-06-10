import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import { sqlMock } from '../setup';
import { createCsrfAgent, withCsrf } from '../helpers/http';
import { hashOrderAccessToken } from '../../backend/src/lib/orderTokens';
import * as paymentReconciliation from '../../backend/src/lib/paymentReconciliation';
import * as paypalClient from '../../backend/src/lib/paypalClient';

describe('POST /api/paypal/capture-payment amount mismatch auto-refund', () => {
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
              captures: [{ id: 'CAP-MISMATCH-1', amount: { value: '50.00', currency_code: 'USD' } }],
            },
          },
        ],
      }),
    } as Response);

    vi.spyOn(paymentReconciliation, 'revertCaptureAmountMismatch').mockResolvedValue({
      refunded: true,
      rolledBack: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('auto-refunds and returns 400 when captured amount does not match order total', async () => {
    const accessToken = 'f'.repeat(64);
    const tokenHash = hashOrderAccessToken(accessToken);
    const serverOrderId = '00000000-0000-0000-0000-0000000000dd';

    sqlMock.mockResolvedValueOnce([
      {
        id: serverOrderId,
        order_number: 'GSS-MM-1',
        paypal_order_id: 'PAYPAL-MM-1',
        access_token_hash: tokenHash,
        payment_status: 'pending',
        total: 100,
      },
    ]);

    const revertSpy = vi.mocked(paymentReconciliation.revertCaptureAmountMismatch);

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(
      agent.post('/api/paypal/capture-payment/PAYPAL-MM-1'),
      csrfToken
    ).send({
      serverOrderId,
      accessToken,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Payment amount mismatch');
    expect(revertSpy).toHaveBeenCalledWith(serverOrderId, 'CAP-MISMATCH-1');
  });
});
