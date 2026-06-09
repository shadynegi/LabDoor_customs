import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/src/server';
import { sqlMock } from '../setup';
import { createCsrfAgent, withCsrf } from '../helpers/http';
import { GENERIC_REVIEW_ELIGIBILITY_MESSAGE } from '../../backend/src/lib/reviewHelpers';

describe('POST /api/reviews/check', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    sqlMock.mockResolvedValue([]);
  });

  it('returns generic ineligible message for missing product', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/reviews/check'), csrfToken).send({
      product_id: 99999,
      email: 'buyer@example.com',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.can_review).toBe(false);
    expect(res.body.data.message).toBe(GENERIC_REVIEW_ELIGIBILITY_MESSAGE);
  });
});
