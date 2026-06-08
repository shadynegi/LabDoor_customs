import crypto from 'crypto';
import type { Request } from 'express';

export function generateOrderAccessToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashOrderAccessToken(token) };
}

export function hashOrderAccessToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Read order access token from header or legacy `?aid=` query (prefer header). */
export function getOrderAccessTokenFromRequest(req: Request): string | null {
  const headerToken = req.headers['x-order-access-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }

  const queryAid = req.query.aid;
  if (typeof queryAid === 'string' && queryAid.trim()) {
    return queryAid.trim();
  }

  return null;
}

export function orderAccessMatches(
  storedHash: string | null | undefined,
  token: string
): boolean {
  if (!storedHash || !token) return false;

  const tokenHash = hashOrderAccessToken(token);
  if (storedHash.length !== tokenHash.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(storedHash),
    Buffer.from(tokenHash)
  );
}

export function stripOrderSecrets<T extends Record<string, unknown>>(order: T): Omit<T, 'access_token_hash'> {
  const { access_token_hash: _removed, ...safe } = order;
  return safe;
}
