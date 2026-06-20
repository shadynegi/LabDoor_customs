import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { createRequestLogger } from '../lib/logger';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers['x-request-id'];
  const requestId =
    typeof incoming === 'string' && incoming.trim().length > 0
      ? incoming.trim()
      : crypto.randomUUID();

  req.requestId = requestId;
  req.requestStartMs = Date.now();
  req.log = createRequestLogger(requestId);
  res.setHeader('X-Request-Id', requestId);
  next();
}
