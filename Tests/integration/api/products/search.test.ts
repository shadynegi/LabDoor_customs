import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../../backend/src/server';
import { sqlMock } from '../../../setup';
import { createCsrfAgent, withCsrf } from '../../../shared/helpers/http';

describe('POST /api/products/search', () => {
  beforeEach(() => {
    sqlMock.mockReset();
  });

  it('returns products matching a text query', async () => {
    sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
      const q = strings.join(' ');
      if (q.includes('FROM products')) {
        return [
          {
            id: 1,
            name: 'Blue Nike Custom',
            price: '199.00',
            description: 'Hand-painted design',
            stock: 5,
          },
        ];
      }
      return [];
    });

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/products/search'), csrfToken).send({
      query: 'nike',
      page: 1,
      limit: 20,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toMatch(/nike/i);
    expect(res.body.filters.query).toBe('nike');
    expect(res.body.pagination.page).toBe(1);
  });

  it('completes search within smoke latency budget (mocked DB)', async () => {
    sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
      if (strings.join(' ').includes('FROM products')) {
        return [];
      }
      return [];
    });

    const { agent, csrfToken } = await createCsrfAgent();
    const started = Date.now();
    const res = await withCsrf(agent.post('/api/products/search'), csrfToken).send({
      query: 'custom shoe',
      sortBy: 'price_asc',
    });
    const elapsedMs = Date.now() - started;

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(elapsedMs).toBeLessThan(3000);
  });

  it('rejects invalid limit', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/products/search'), csrfToken).send({
      query: 'nike',
      limit: 0,
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid limit/i);
  });

  it('rejects limit above server maximum', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/products/search'), csrfToken).send({
      query: 'nike',
      limit: 9999,
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/must not exceed 100/i);
  });

  it('allows blank query as unfiltered catalog browse', async () => {
    sqlMock.mockResolvedValueOnce([]);

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/products/search'), csrfToken).send({
      query: '   ',
      page: 1,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
