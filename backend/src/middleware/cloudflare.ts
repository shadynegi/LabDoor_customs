import type { Request, Response, NextFunction } from 'express';
import { getPeerIp, isCloudflareIp, isTrustCloudflareEnabled } from '../lib/clientIp';
import { logger } from '../lib/logger';

const BYPASS_PATHS = new Set(['/api/health']);

/**
 * When TRUST_CLOUDFLARE=true in production, reject direct traffic that bypasses Cloudflare.
 * Railway health checks hit /api/health directly and are allowed.
 */
export function requireCloudflareProxy(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  if (!isTrustCloudflareEnabled()) {
    return next();
  }

  if (BYPASS_PATHS.has(req.path)) {
    return next();
  }

  const peerIp = getPeerIp(req);
  if (isCloudflareIp(peerIp)) {
    return next();
  }

  logger.warn(`Blocked non-Cloudflare request from ${peerIp} to ${req.method} ${req.path}`);

  return res.status(403).json({
    success: false,
    error: 'Direct access is not permitted. Use the Cloudflare-proxied domain.',
  });
}
