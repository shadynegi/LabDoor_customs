import crypto from 'crypto';

/** Signed admin session token matching `backend/src/routes/admin.ts` generateToken(). */
export function createTestAdminToken(username = 'admin'): string {
  const payload = {
    username,
    exp: Date.now() + 24 * 60 * 60 * 1000,
    iat: Date.now(),
    jti: crypto.randomUUID(),
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const secret = process.env.JWT_SECRET!;
  const signature = crypto.createHmac('sha256', secret).update(payloadBase64).digest('hex');
  return `${payloadBase64}.${signature}`;
}

export function adminSessionCookie(token: string): string {
  return `admin_session=${encodeURIComponent(token)}`;
}
