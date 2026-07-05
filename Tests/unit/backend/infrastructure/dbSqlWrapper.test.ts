import { describe, it, expect, vi } from 'vitest';

vi.unmock('../../../../backend/src/lib/db');

describe('db sql wrapper', () => {
  it('returns a postgres Query with cursor() before execution', async () => {
    const { default: sql } = await import('../../../../backend/src/lib/db');
    const query = sql`SELECT 1`;
    expect(typeof query.cursor).toBe('function');
    expect((query as { tagged?: boolean }).tagged).toBe(true);
  });

  it('composes nested fragments without executing them at tag time', async () => {
    const { default: sql } = await import('../../../../backend/src/lib/db');
    const includeFilter = false;
    const searchPattern: string | null = null;

    const query = sql`
      SELECT id FROM customers
      WHERE 1=1
      ${includeFilter ? sql`AND is_deleted = FALSE` : sql``}
      ${searchPattern ? sql`AND email ILIKE ${searchPattern}` : sql``}
      LIMIT ${10}
    `;

    expect((query as { tagged?: boolean }).tagged).toBe(true);
    expect(typeof query.cursor).toBe('function');
  });
});
