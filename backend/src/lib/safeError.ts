import type { Response } from 'express';

/** Return a client-safe error message (hide internals in production). */
export function clientErrorMessage(err: unknown, fallback = 'Internal server error'): string {
  if (process.env.NODE_ENV === 'development' && err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

export function respond500(res: Response, err: unknown, fallback: string): void {
  if (res.headersSent) return;
  res.status(500).json({
    success: false,
    error: clientErrorMessage(err, fallback),
  });
}
