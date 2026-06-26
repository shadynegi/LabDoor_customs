import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import { sqlMock } from '../setup';

describe('API stability and concurrency smoke', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    sqlMock.mockResolvedValue([{ '?column?': 1 }]);
  });

  it('handles parallel health checks without errors', async () => {
    const requests = Array.from({ length: 12 }, () => request(app).get('/api/health'));
    const responses = await Promise.all(requests);

    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('OK');
      expect(res.headers['x-request-id']).toBeDefined();
    }
  });

  it('handles parallel CSRF token fetches', async () => {
    const requests = Array.from({ length: 8 }, () => request(app).get('/api/csrf-token'));
    const responses = await Promise.all(requests);

    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.csrfToken).toBe('string');
      expect(res.body.csrfToken.length).toBeGreaterThan(10);
    }
  });

  it('completes health check within smoke latency budget', async () => {
    const started = Date.now();
    const res = await request(app).get('/api/health');
    const elapsedMs = Date.now() - started;

    expect(res.status).toBe(200);
    expect(elapsedMs).toBeLessThan(3000);
  });
});
