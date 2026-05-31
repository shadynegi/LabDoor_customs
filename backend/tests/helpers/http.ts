import request, { type Test } from 'supertest';
import { app } from '../../src/server';

export async function createCsrfAgent() {
  const agent = request.agent(app);
  const res = await agent.get('/api/csrf-token');
  const csrfToken = res.body.csrfToken as string;
  return { agent, csrfToken };
}

export function withCsrf(agent: Test, csrfToken: string) {
  return agent.set('x-csrf-token', csrfToken);
}
