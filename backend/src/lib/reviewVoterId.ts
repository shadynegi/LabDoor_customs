import crypto from 'crypto';
import type { Request } from 'express';
import { getClientIp } from './clientIp';

/** Stable anonymous voter id per IP per day (review helpful votes). */
export function deriveReviewVoterId(req: Request): string {
  const ip = getClientIp(req);
  const daily = new Date().toISOString().split('T')[0];
  const salt = process.env.IP_SALT || 'default-salt';
  return crypto
    .createHash('sha256')
    .update(`${salt}:review-vote:${ip}:${daily}`)
    .digest('hex')
    .slice(0, 32);
}
