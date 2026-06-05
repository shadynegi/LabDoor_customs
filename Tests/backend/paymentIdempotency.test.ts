import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sqlMock } from '../setup';

vi.unmock('../../backend/src/lib/paymentIdempotency');

const {
  buildCreatePaymentKey,
  buildCapturePaymentKey,
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

  it('uses client header for create when length is valid', () => {
    expect(buildCreatePaymentKey('client-key-12345678', 'a@b.com', [], '')).toBe(
      'client-key-12345678'
    );
  });

  it('falls back to fingerprint when create header is missing', () => {
    const key = buildCreatePaymentKey(undefined, 'User@Mail.com', [{ product_id: 2, quantity: 1 }], 'SAVE10');
    const again = buildCreatePaymentKey(undefined, 'user@mail.com', [{ product_id: 2, quantity: 1 }], 'save10');
    expect(key).toHaveLength(64);
    expect(key).toBe(again);
  });

  it('uses PayPal order id for capture when header is absent', () => {
    expect(buildCapturePaymentKey(undefined, 'PAYPAL-ORDER-ABC')).toBe('PAYPAL-ORDER-ABC');
  });

  it('scopes storage keys by operation', () => {
    const clientKey = 'shared-client-key-12345678';
    const createKey = resolveIdempotencyStorageKey('create_payment', clientKey);
    const captureKey = resolveIdempotencyStorageKey('capture_payment', clientKey);
    expect(createKey).not.toBe(captureKey);
  });
});

describe('claimIdempotencyKey', () => {
  beforeEach(() => {
    sqlMock.mockReset();
  });

  it('returns claimed when insert succeeds', async () => {
    sqlMock.mockResolvedValueOnce([{ id: 'row-1' }]);
    const result = await claimIdempotencyKey('client-key-12345678', 'create_payment');
    expect(result).toEqual({ type: 'claimed' });
  });

  it('returns completed response for same operation replay', async () => {
    const storageKey = resolveIdempotencyStorageKey('capture_payment', 'PAYPAL-1');
    sqlMock.mockResolvedValueOnce([]);
    sqlMock.mockResolvedValueOnce([
      {
        id: 'row-1',
        idempotency_key: storageKey,
        operation: 'capture_payment',
        status: 'completed',
        response_json: { success: true, captureId: 'CAP-1' },
      },
    ]);

    const result = await claimIdempotencyKey('PAYPAL-1', 'capture_payment');
    expect(result).toEqual({
      type: 'completed',
      response: { success: true, captureId: 'CAP-1' },
    });
  });

  it('allows capture claim after create used the same client key', async () => {
    const clientKey = 'shared-client-key-12345678';

    sqlMock.mockResolvedValueOnce([{ id: 'row-create' }]);
    const createClaim = await claimIdempotencyKey(clientKey, 'create_payment');
    expect(createClaim).toEqual({ type: 'claimed' });

    sqlMock.mockResolvedValueOnce([{ id: 'row-capture' }]);
    const captureClaim = await claimIdempotencyKey(clientKey, 'capture_payment');
    expect(captureClaim).toEqual({ type: 'claimed' });
  });

  it('returns in_progress when another capture is processing', async () => {
    const storageKey = resolveIdempotencyStorageKey('capture_payment', 'PAYPAL-2');
    sqlMock.mockResolvedValueOnce([]);
    sqlMock.mockResolvedValueOnce([
      {
        id: 'row-1',
        idempotency_key: storageKey,
        operation: 'capture_payment',
        status: 'processing',
        response_json: null,
      },
    ]);

    const result = await claimIdempotencyKey('PAYPAL-2', 'capture_payment');
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
    await completeIdempotencyKey('PAYPAL-3', 'capture_payment', { success: true });
    expect(sqlMock).toHaveBeenCalled();
  });

  it('fails with operation-scoped storage key', async () => {
    await failIdempotencyKey('PAYPAL-3', 'capture_payment');
    expect(sqlMock).toHaveBeenCalled();
  });

  it('reclaims failed capture keys', async () => {
    sqlMock.mockResolvedValueOnce([{ id: 'row-1' }]);
    const reclaimed = await reclaimFailedIdempotencyKey('PAYPAL-4', 'capture_payment', 15);
    expect(reclaimed).toBe(true);
  });
});
