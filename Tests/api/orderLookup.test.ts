import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import { sqlMock } from '../setup';
import { createCsrfAgent, withCsrf } from '../helpers/http';
import { hashOrderAccessToken } from '../../backend/src/lib/orderTokens';

describe('POST /api/orders/lookup', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    sqlMock.mockResolvedValue([]);
  });

  it('returns uniform 404 for unknown order', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/orders/lookup'), csrfToken).send({
      orderNumber: 'GSS-MISSING',
      accessToken: 'a'.repeat(64),
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Order not found or invalid credentials');
  });

  it('returns uniform 404 for wrong token on known order', async () => {
    const token = 'b'.repeat(64);
    const hash = hashOrderAccessToken(token);
    sqlMock.mockResolvedValueOnce([
      {
        id: '00000000-0000-0000-0000-000000000099',
        order_number: 'GSS-TEST-1',
        access_token_hash: hash,
      },
    ]);

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/orders/lookup'), csrfToken).send({
      orderNumber: 'GSS-TEST-1',
      accessToken: 'c'.repeat(64),
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Order not found or invalid credentials');
  });
});
