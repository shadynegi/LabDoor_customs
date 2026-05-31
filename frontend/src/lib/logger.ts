import { captureException } from './sentry';

const isDev = import.meta.env.DEV;

/** Log errors in development only; report to Sentry in production when configured. */
export function logError(message: string, error?: unknown): void {
  if (isDev) {
    console.error(message, error);
    return;
  }

  if (error instanceof Error) {
    captureException(error, { message });
  } else if (error !== undefined) {
    captureException(new Error(message), { detail: String(error) });
  }
}

/** Log warnings in development only. */
export function logWarn(message: string, ...args: unknown[]): void {
  if (isDev) {
    console.warn(message, ...args);
  }
}

/** Log debug info in development only. */
export function logDebug(message: string, ...args: unknown[]): void {
  if (isDev) {
    console.debug(message, ...args);
  }
}
