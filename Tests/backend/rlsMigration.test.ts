import { describe, it, expect } from 'vitest';

import { CLIENT_REVOKED_TABLES } from '../../backend/src/lib/rlsMigration';



describe('rlsMigration', () => {

  it('tracks 10 client-revoked tables', () => {

    expect(CLIENT_REVOKED_TABLES).toHaveLength(10);

    expect(CLIENT_REVOKED_TABLES).toContain('order_access_exchanges');

    expect(CLIENT_REVOKED_TABLES).not.toContain('order_checkout_exchanges');

    expect(CLIENT_REVOKED_TABLES).not.toContain('processed_refund_events');

  });



  it('runs grant revoke when RLS DDL is skipped (source contract)', async () => {

    const { readFileSync } = await import('node:fs');

    const { fileURLToPath } = await import('node:url');

    const { dirname, join } = await import('node:path');

    const here = dirname(fileURLToPath(import.meta.url));

    const src = readFileSync(join(here, '../../backend/src/lib/rlsMigration.ts'), 'utf8');

    expect(src).toContain('await ensureClientGrantsRevoked();');

    expect(src).toMatch(/shouldSkipBootstrapDdl\(\)[\s\S]*ensureClientGrantsRevoked\(\)/);

  });

});

