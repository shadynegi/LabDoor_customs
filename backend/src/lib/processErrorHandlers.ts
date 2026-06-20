import { logger } from './logger';
import { captureException } from './sentry';
import { isTransientDbError } from './dbErrors';

let registered = false;

function normalizeError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason));
}

function logProcessError(
  kind: 'unhandledRejection' | 'uncaughtException',
  err: Error
): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const transient = isTransientDbError(err);
  const code = (err as Error & { code?: string }).code;
  const payload = {
    kind,
    transient,
    code,
    message: err.message,
    stack: err.stack,
  };

  if (isProduction) {
    logger.error(payload, `${kind} — process kept alive`);
    captureException(err, { kind, transient, code });
    return;
  }

  logger.warn(payload, `${kind} (dev — process kept alive)`);
}

/**
 * Log unhandled rejections and uncaught exceptions without exiting.
 * Transient pool/network errors from postgres should not take down local dev.
 */
export function registerProcessErrorHandlers(): void {
  if (registered) return;
  registered = true;

  process.on('unhandledRejection', (reason) => {
    logProcessError('unhandledRejection', normalizeError(reason));
  });

  process.on('uncaughtException', (err) => {
    logProcessError('uncaughtException', err);
  });
}

/** Test helper — reset registration guard between Vitest cases. */
export function resetProcessErrorHandlersForTests(): void {
  registered = false;
}
