import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const dedicated = process.env.ORDER_TOKEN_ENCRYPTION_KEY?.trim();
  if (dedicated) {
    return crypto.createHash('sha256').update(dedicated).digest();
  }

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    throw new Error('ORDER_TOKEN_ENCRYPTION_KEY must be set in production');
  }

  const jwtFallback = process.env.JWT_SECRET?.trim();
  if (!jwtFallback) {
    throw new Error('ORDER_TOKEN_ENCRYPTION_KEY or JWT_SECRET required for order token encryption');
  }

  return crypto.createHash('sha256').update(jwtFallback).digest();
}

/** Encrypt order access token for short-lived storage (checkout exchange table). */
export function encryptOrderAccessToken(token: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${Buffer.concat([iv, tag, encrypted]).toString('base64url')}`;
}

/** Decrypt token from exchange table; returns null on failure. */
export function decryptOrderAccessToken(stored: string): string | null {
  if (!stored?.startsWith('enc:')) {
    return stored || null;
  }

  try {
    const buf = Buffer.from(stored.slice(4), 'base64url');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
