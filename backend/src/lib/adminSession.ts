import crypto from 'crypto';

/** Store SHA-256 hash of admin session token (never persist raw token). */
export function hashAdminSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
