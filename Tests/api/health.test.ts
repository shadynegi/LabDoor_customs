import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import { sqlMock } from '../setup';

describe('GET /api/health', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    sqlMock.mockResolvedValue([{ '?column?': 1 }]);
  });

  it('returns OK when database responds', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.responseTime_ms).toBeDefined();
    expect(res.body.services).toBeUndefined();
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('accepts incoming X-Request-Id header', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('X-Request-Id', 'test-request-id-123');

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe('test-request-id-123');
  });
});
