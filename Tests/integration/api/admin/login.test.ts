import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCsrfAgent, withCsrf } from '../../../shared/helpers/http';
import { sqlMock } from '../../../setup';
import * as adminCredentials from '../../../../backend/src/lib/adminCredentials';

describe('POST /api/admin/login', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    // Mock admin_sessions insert to succeed
    sqlMock.mockImplementation(async () => []);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 when credentials are missing', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/admin/login').send({}), csrfToken);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 401 when credentials are wrong', async () => {
    vi.spyOn(adminCredentials, 'authenticateAdminUser').mockResolvedValueOnce(null);

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(
      agent.post('/api/admin/login').send({ username: 'admin', password: 'wrongpass' }),
      csrfToken
    );

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('sets admin_session cookie on successful login', async () => {
    vi.spyOn(adminCredentials, 'authenticateAdminUser').mockResolvedValueOnce({ username: 'admin' });
    // INSERT INTO admin_sessions returns new session row
    sqlMock.mockImplementation(async () => [{ id: 'session-abc', username: 'admin' }]);

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(
      agent.post('/api/admin/login').send({ username: 'admin', password: 'correctpass' }),
      csrfToken
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const cookies: string[] = res.headers['set-cookie'] ?? [];
    const sessionCookie = (Array.isArray(cookies) ? cookies : [cookies]).find((c: string) =>
      c.startsWith('admin_session=')
    );
    expect(sessionCookie).toBeTruthy();
  });

  it('returns 429 after 5 consecutive failed logins', async () => {
    vi.spyOn(adminCredentials, 'authenticateAdminUser').mockResolvedValue(null);

    const { agent, csrfToken } = await createCsrfAgent();
    const attempts = Array.from({ length: 5 }, () =>
      withCsrf(agent.post('/api/admin/login').send({ username: 'admin', password: 'bad' }), csrfToken)
    );
    await Promise.all(attempts);

    const sixthRes = await withCsrf(
      agent.post('/api/admin/login').send({ username: 'admin', password: 'bad' }),
      csrfToken
    );
    expect(sixthRes.status).toBe(429);
  });
});
