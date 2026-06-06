import type { Logger } from 'pino';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      requestStartMs?: number;
      log?: Logger;
    }
  }
}

export {};
