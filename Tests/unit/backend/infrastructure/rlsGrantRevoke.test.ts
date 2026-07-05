import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ensureClientGrantsRevoked integration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('issues REVOKE when anon/authenticated still have table grants', async () => {
    vi.doMock('../../../../backend/src/lib/bootstrapSchema', () => ({
      authenticatedHasTableGrants: vi.fn(async () => true),
      isRlsMigrationApplied: vi.fn(async () => false),
      shouldSkipBootstrapDdl: vi.fn(() => false),
      logBootstrapStepSkipped: vi.fn(),
      serviceRolePolicyExists: vi.fn(async () => true),
      tableHasServiceRolePolicy: vi.fn(async () => true),
    }));

    const { sqlMock } = await import('../../../setup');
    const unsafeMock = vi.fn(async () => []);
    Object.assign(sqlMock, { unsafe: unsafeMock });

    const rlsMigration = await import('../../../../backend/src/lib/rlsMigration');
    sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
      const query = strings.join('');
      if (query.includes('pg_tables')) {
        return rlsMigration.CLIENT_REVOKED_TABLES.map((tablename) => ({ tablename }));
      }
      return [];
    });

    await rlsMigration.ensureClientGrantsRevoked();

    const revokeCalls = unsafeMock.mock.calls.filter((call) =>
      String(call[0]).includes('REVOKE ALL ON TABLE')
    );
    expect(revokeCalls.length).toBe(rlsMigration.CLIENT_REVOKED_TABLES.length);
  });
});
