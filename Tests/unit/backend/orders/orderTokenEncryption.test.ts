import { describe, expect, it } from 'vitest';
import {
  decryptOrderAccessToken,
  encryptOrderAccessToken,
} from '../../../../backend/src/lib/orderTokenEncryption';

describe('orderTokenEncryption', () => {
  it('round-trips tokens through encrypt/decrypt', () => {
    const token = 'ldc-access-token-abc123';
    const stored = encryptOrderAccessToken(token);
    expect(stored.startsWith('enc:')).toBe(true);
    expect(decryptOrderAccessToken(stored)).toBe(token);
  });

  it('returns null for tampered ciphertext', () => {
    const stored = encryptOrderAccessToken('valid-token');
    const raw = Buffer.from(stored.slice(4), 'base64url');
    raw[raw.length - 1] ^= 0xff;
    const tampered = `enc:${raw.toString('base64url')}`;
    expect(decryptOrderAccessToken(tampered)).toBeNull();
  });

  it('passes through legacy plaintext values', () => {
    expect(decryptOrderAccessToken('plain-legacy-token')).toBe('plain-legacy-token');
  });
});
