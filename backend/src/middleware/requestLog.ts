import type { Request, Response, NextFunction } from 'express';
import { getPoolStats } from '../lib/db';
import { getRequestPath, getRequestTimeoutMs } from '../lib/requestTiming';

const QUIET_PATHS = new Set(['/api/health', '/health', '/favicon.ico']);

const REQUEST_LOG_SLOW_MS = parseInt(process.env.REQUEST_LOG_SLOW_MS || '3000', 10);

function clientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

export function requestLogMiddleware(req: Request, res: Response, next: NextFunction) {
  const path = getRequestPath(req);
  const query = req.originalUrl.includes('?') ? req.originalUrl.split('?')[1] : undefined;
  const timeoutMs = getRequestTimeoutMs(req);
  const quiet = QUIET_PATHS.has(path);

  const startMeta = {
    method: req.method,
    path,
    ...(query ? { query } : {}),
    ip: clientIp(req),
    timeoutMs,
    slowRoute: timeoutMs > parseInt(process.env.REQUEST_TIMEOUT_MS || '60000', 10),
    userAgent: (req.get('user-agent') || 'unknown').slice(0, 120),
  };

  if (quiet) {
    req.log?.debug(startMeta, 'Request started');
  } else {
    req.log?.info(startMeta, 'Request started');
  }

  res.on('finish', () => {
    const durationMs = Date.now() - (req.requestStartMs ?? Date.now());
    const finishMeta = {
      method: req.method,
      path,
      statusCode: res.statusCode,
      durationMs,
      ...(durationMs >= REQUEST_LOG_SLOW_MS ? { slow: true } : {}),
      ...(res.statusCode >= 400 ? { pool: getPoolStats() } : {}),
    };

    if (res.statusCode >= 500) {
      req.log?.error(finishMeta, 'Request failed');
    } else if (res.statusCode >= 400 || durationMs >= REQUEST_LOG_SLOW_MS) {
      req.log?.warn(finishMeta, 'Request finished');
    } else if (quiet) {
      req.log?.debug(finishMeta, 'Request finished');
    } else {
      req.log?.info(finishMeta, 'Request finished');
    }
  });

  next();
}
