import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import { sqlMock } from '../setup';
import { createCsrfAgent, withCsrf } from '../helpers/http';

describe('POST /api/activity/log', () => {
  beforeEach(() => {
    sqlMock.mockReset();
  });

  it('returns 500 when database insert fails', async () => {
    sqlMock.mockRejectedValueOnce(new Error('db down'));

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/activity/log'), csrfToken).send({
      actionType: 'page_view',
      sessionId: 'session-1',
      pageUrl: '/',
    });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
