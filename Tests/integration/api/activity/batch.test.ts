import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../../backend/src/server';
import { sqlMock } from '../../../setup';

describe('POST /api/activity/batch', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    sqlMock.mockResolvedValue([{ id: 'log-1' }]);
  });

  it('accepts contact_submit without CSRF', async () => {
    const res = await request(app)
      .post('/api/activity/batch')
      .send({
        activities: [
          {
            actionType: 'contact_submit',
            sessionId: 'session_test',
            pageUrl: '/contact',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.inserted).toBe(1);
    expect(sqlMock).toHaveBeenCalled();
  });

  it('skips unknown action types', async () => {
    const res = await request(app)
      .post('/api/activity/batch')
      .send({
        activities: [{ actionType: 'not_a_real_event', sessionId: 's1' }],
      });

    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(1);
    expect(res.body.inserted).toBe(0);
  });

  it('returns 500 when all valid events fail to persist', async () => {
    sqlMock.mockRejectedValue(new Error('db unavailable'));

    const res = await request(app)
      .post('/api/activity/batch')
      .send({
        activities: [{ actionType: 'page_view', sessionId: 's1' }],
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.inserted).toBe(0);
  });

  it('rejects batches over 20 events', async () => {
    const activities = Array.from({ length: 21 }, (_, i) => ({
      actionType: 'page_view',
      sessionId: `s${i}`,
    }));

    const res = await request(app)
      .post('/api/activity/batch')
      .send({ activities });

    expect(res.status).toBe(413);
  });
});
