import crypto from 'crypto';

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_PRODUCT_PER_WINDOW = 3;

const buckets = new Map<string, { count: number; resetAt: number }>();

function pruneExpired(now: number): void {
  if (buckets.size < 5000) return;
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}

export function canBumpProductMetric(ip: string, productId: number): boolean {
  const now = Date.now();
  pruneExpired(now);

  const salt = process.env.IP_SALT || 'default-salt';
  const ipHash = crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 16);
  const key = `${ipHash}:${productId}`;

  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_PER_PRODUCT_PER_WINDOW) {
    return false;
  }

  entry.count += 1;
  return true;
}
