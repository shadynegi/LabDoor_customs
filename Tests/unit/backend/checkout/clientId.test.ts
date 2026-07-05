import { describe, expect, it, vi } from 'vitest';
import { createClientId } from '../../../../frontend/src/lib/clientId';

describe('createClientId', () => {
  it('returns a UUID-shaped string when crypto.randomUUID is unavailable', () => {
    const original = globalThis.crypto?.randomUUID;
    vi.stubGlobal('crypto', {
      randomUUID: () => {
        throw new DOMException('not available', 'NotSupportedError');
      },
    });

    const id = createClientId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    if (original) {
      vi.stubGlobal('crypto', { ...globalThis.crypto, randomUUID: original });
    }
  });
});
