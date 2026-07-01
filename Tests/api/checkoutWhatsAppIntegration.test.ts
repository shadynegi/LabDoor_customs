import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import { sqlMock } from '../setup';
import { createCsrfAgent, withCsrf } from '../helpers/http';
import * as checkoutPricing from '../../backend/src/lib/checkoutPricing';
import * as paymentIdempotency from '../../backend/src/lib/paymentIdempotency';
import {
  TEST_PRODUCTS,
  cartLine,
  installProductCatalogMock,
} from '../fixtures/products';

const SERVER_ORDER_ID = '00000000-0000-0000-0000-00000000dd01';
const ORDER_NUMBER = 'GSS-WA-INT-1';
const checkoutProduct = TEST_PRODUCTS.checkoutShoe;

function placeOrderPayload(overrides: Record<string, unknown> = {}) {
  return {
    amount: '125.00',
    policy_accepted: true,
    customerInfo: {
      fullName: 'Jane Buyer',
      email: 'jane@example.com',
      phone: '+919876543210',
      address: '456 Oak Ave',
      city: 'Mumbai',
      state: 'MH',
      zipCode: '400001',
      country: 'India',
    },
    items: [cartLine(checkoutProduct)],
    ...overrides,
  };
}

describe('POST /api/checkout/place-order WhatsApp integration', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    installProductCatalogMock(sqlMock);

    vi.spyOn(checkoutPricing, 'createPendingOrderAtomic').mockResolvedValue({
      order: { id: SERVER_ORDER_ID },
      orderNumber: ORDER_NUMBER,
      accessToken: 'b'.repeat(64),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns whatsappUrl and pending order details on success', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/checkout/place-order'), csrfToken).send(
      placeOrderPayload()
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.orderNumber).toBe(ORDER_NUMBER);
    expect(res.body.serverOrderId).toBe(SERVER_ORDER_ID);
    expect(res.body.paymentStatus).toBe('pending');
    expect(res.body.orderStatus).toBe('pending');
    expect(res.body.total).toBe(125);
    expect(res.body.whatsappUrl).toMatch(/^https:\/\/wa\.me\/919888514572\?text=/);
  });

  it('embeds order and customer details in whatsappUrl message', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/checkout/place-order'), csrfToken).send(
      placeOrderPayload()
    );

    expect(res.status).toBe(200);

    const url = new URL(res.body.whatsappUrl as string);
    const message = decodeURIComponent(url.searchParams.get('text') ?? '');

    expect(message).toContain(`Order ID: ${ORDER_NUMBER}`);
    expect(message).toContain(`Reference: ${SERVER_ORDER_ID}`);
    expect(message).toContain('Jane Buyer');
    expect(message).toContain('jane@example.com');
    expect(message).toContain(checkoutProduct.name);
    expect(message).toContain('Total: $125.00');
  });

  it('returns cached place-order payload for duplicate idempotency key', async () => {
    vi.spyOn(paymentIdempotency, 'claimIdempotencyKey').mockResolvedValue({
      type: 'completed',
      response: {
        success: true,
        orderNumber: 'GSS-CACHED',
        whatsappUrl: 'https://wa.me/919888514572?text=cached-order',
        paymentStatus: 'pending',
        orderStatus: 'pending',
      },
    });

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/checkout/place-order'), csrfToken)
      .set('X-Idempotency-Key', 'duplicate-key-123')
      .send(placeOrderPayload());

    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(true);
    expect(res.body.orderNumber).toBe('GSS-CACHED');
    expect(res.body.whatsappUrl).toBe('https://wa.me/919888514572?text=cached-order');
    expect(checkoutPricing.createPendingOrderAtomic).not.toHaveBeenCalled();
  });
});
