import { describe, it, expect } from 'vitest';
import { CLIENT_REVOKED_TABLES } from '../../backend/src/lib/rlsMigration';

describe('rlsMigration', () => {
  it('tracks 14 client-revoked tables', () => {
    expect(CLIENT_REVOKED_TABLES).toHaveLength(14);
    expect(CLIENT_REVOKED_TABLES).toContain('order_access_exchanges');
    expect(CLIENT_REVOKED_TABLES).toContain('order_checkout_exchanges');
  });
});
