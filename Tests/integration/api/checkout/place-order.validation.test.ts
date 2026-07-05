import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../../backend/src/server';
import { sqlMock } from '../../../setup';
import { createCsrfAgent, withCsrf } from '../../../shared/helpers/http';
import {
  TEST_PRODUCTS,
  cartLine,
  installProductCatalogMock,
} from '../../../shared/fixtures/products';

describe('POST /api/checkout/place-order', () => {
  const checkoutProduct = TEST_PRODUCTS.checkoutShoe;
  const soldOutProduct = TEST_PRODUCTS.soldOutShoe;

  beforeEach(() => {
    sqlMock.mockReset();
    installProductCatalogMock(sqlMock);
  });

  it('rejects place-order when client amount does not match server total', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/checkout/place-order'), csrfToken).send({
      amount: '50.00',
      policy_accepted: true,
      customerInfo: { fullName: 'Test User', email: 'test@example.com' },
      items: [cartLine(checkoutProduct)],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Amount mismatch');
  });

  it('rejects place-order without cart items', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/checkout/place-order'), csrfToken).send({
      customerInfo: { fullName: 'Test User', email: 'test@example.com' },
      items: [],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/items/i);
  });

  it('rejects place-order with invalid email', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/checkout/place-order'), csrfToken).send({
      policy_accepted: true,
      customerInfo: { fullName: 'Test User', email: 'not-an-email' },
      items: [cartLine(checkoutProduct)],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid email format');
  });

  it('rejects place-order without customer name and email', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/checkout/place-order'), csrfToken).send({
      policy_accepted: true,
      customerInfo: { email: 'test@example.com' },
      items: [cartLine(checkoutProduct)],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Customer name and email are required');
  });

  it('rejects place-order for out-of-stock product', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/checkout/place-order'), csrfToken).send({
      amount: '123.00',
      policy_accepted: true,
      customerInfo: { fullName: 'Test User', email: 'test@example.com' },
      items: [cartLine(soldOutProduct)],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(String(res.body.message || res.body.error)).toMatch(/out of stock|unavailable/i);
  });

  it('rejects place-order without policy acceptance', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/checkout/place-order'), csrfToken).send({
      customerInfo: { fullName: 'Test User', email: 'test@example.com' },
      items: [cartLine(checkoutProduct)],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Policy acceptance required');
  });

  it('rate limits repeated place-order attempts', async () => {
    const testIp = `203.0.116.${Math.floor(Math.random() * 200) + 1}`;
    const { agent, csrfToken } = await createCsrfAgent();

    for (let i = 0; i < 30; i++) {
      await withCsrf(
        agent.post('/api/checkout/place-order').set('X-Forwarded-For', testIp),
        csrfToken
      ).send({ items: [] });
    }

    const limited = await withCsrf(
      agent.post('/api/checkout/place-order').set('X-Forwarded-For', testIp),
      csrfToken
    ).send({ items: [] });

    expect(limited.status).toBe(429);
    expect(limited.body.retryAfter).toBeDefined();
  });
});
