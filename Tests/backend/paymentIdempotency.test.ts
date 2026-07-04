import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sqlMock } from '../setup';

vi.unmock('../../backend/src/lib/paymentIdempotency');

const {
  buildPlaceOrderKey,
  resolveIdempotencyStorageKey,
  claimIdempotencyKey,
  completeIdempotencyKey,
  failIdempotencyKey,
  reclaimFailedIdempotencyKey,
} = await import('../../backend/src/lib/paymentIdempotency');

describe('paymentIdempotency helpers', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    sqlMock.mockResolvedValue([]);
  });

  it('uses client header for place-order when length is valid', () => {
    expect(buildPlaceOrderKey('client-key-12345678', 'a@b.com', [], '')).toBe(
      'client-key-12345678'
    );
  });

  it('falls back to fingerprint when place-order header is missing', () => {
    const key = buildPlaceOrderKey(undefined, 'User@Mail.com', [{ product_id: 2, quantity: 1 }], 'SAVE10');
    const again = buildPlaceOrderKey(undefined, 'user@mail.com', [{ product_id: 2, quantity: 1 }], 'save10');
    expect(key).toHaveLength(64);
    expect(key).toBe(again);
  });

  it('scopes storage keys by operation', () => {
    const clientKey = 'shared-client-key-12345678';
    const placeKey = resolveIdempotencyStorageKey('place_order', clientKey);
    const otherKey = resolveIdempotencyStorageKey('other_op', clientKey);
    expect(placeKey).not.toBe(otherKey);
  });
});

describe('claimIdempotencyKey', () => {
  beforeEach(() => {
    sqlMock.mockReset();
  });

  it('returns claimed when insert succeeds', async () => {
    sqlMock.mockResolvedValueOnce([{ id: 'row-1' }]);
    const result = await claimIdempotencyKey('client-key-12345678', 'place_order');
    expect(result).toEqual({ type: 'claimed' });
  });

  it('returns completed response for same operation replay', async () => {
    const storageKey = resolveIdempotencyStorageKey('place_order', 'order-key-1');
    sqlMock.mockResolvedValueOnce([]);
    sqlMock.mockResolvedValueOnce([
      {
        id: 'row-1',
        idempotency_key: storageKey,
        operation: 'place_order',
        status: 'completed',
        response_json: { success: true, orderNumber: 'GSS-1' },
      },
    ]);

    const result = await claimIdempotencyKey('order-key-1', 'place_order');
    expect(result).toEqual({
      type: 'completed',
      response: { success: true, orderNumber: 'GSS-1' },
    });
  });

  it('returns in_progress when another place-order is processing', async () => {
    const storageKey = resolveIdempotencyStorageKey('place_order', 'order-key-2');
    sqlMock.mockResolvedValueOnce([]);
    sqlMock.mockResolvedValueOnce([
      {
        id: 'row-1',
        idempotency_key: storageKey,
        operation: 'place_order',
        status: 'processing',
        response_json: null,
      },
    ]);

    const result = await claimIdempotencyKey('order-key-2', 'place_order');
    expect(result).toEqual({ type: 'in_progress' });
  });
});

describe('idempotency mutations', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    sqlMock.mockResolvedValue([]);
    Object.assign(sqlMock, {
      json: (value: unknown) => value,
    });
  });

  it('completes with operation-scoped storage key', async () => {
    await completeIdempotencyKey('order-key-3', 'place_order', { success: true });
    expect(sqlMock).toHaveBeenCalled();
  });

  it('fails with operation-scoped storage key', async () => {
    await failIdempotencyKey('order-key-3', 'place_order');
    expect(sqlMock).toHaveBeenCalled();
  });

  it('reclaims failed place-order keys', async () => {
    sqlMock.mockResolvedValueOnce([{ id: 'row-1' }]);
    const reclaimed = await reclaimFailedIdempotencyKey('order-key-4', 'place_order', 15);
    expect(reclaimed).toBe(true);
  });
});
