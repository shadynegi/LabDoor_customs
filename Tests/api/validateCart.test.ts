import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import { sqlMock } from '../setup';
import { createCsrfAgent, withCsrf } from '../helpers/http';
import {
  TEST_PRODUCTS,
  cartLine,
  installProductCatalogMock,
} from '../fixtures/products';

describe('POST /api/products/validate-cart', () => {
  const inStockProduct = TEST_PRODUCTS.nikeBlue;
  const soldOutProduct = TEST_PRODUCTS.soldOutShoe;

  beforeEach(() => {
    sqlMock.mockReset();
    installProductCatalogMock(sqlMock);
  });

  it('rejects empty cart payload', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/products/validate-cart'), csrfToken).send({
      items: [],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects missing product id', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/products/validate-cart'), csrfToken).send({
      items: [{ quantity: 1 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects out-of-stock product', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/products/validate-cart'), csrfToken).send({
      items: [cartLine(soldOutProduct)],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(String(res.body.message || res.body.error)).toMatch(/out of stock|unavailable/i);
  });

  it('returns refreshed prices for valid cart', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/products/validate-cart'), csrfToken).send({
      items: [cartLine(inStockProduct, 2)],
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(inStockProduct.id);
    expect(res.body.items[0].price).toBe(inStockProduct.price);
    expect(res.body.subtotal).toBe(inStockProduct.price * 2);
  });
});
