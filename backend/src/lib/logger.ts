import pino, { type Logger } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

function buildBaseLogger(): Logger {
  const level = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

  if (!isProduction && !isTest) {
    return pino({
      level,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino({ level });
}

const baseLogger = buildBaseLogger();

function logWith(
  logFn: pino.LogFn,
  first: unknown,
  second?: unknown,
  ...rest: unknown[]
) {
  if (typeof first === 'string') {
    const extras = second !== undefined ? [second, ...rest] : rest;
    if (extras.length === 0) {
      logFn(first);
      return;
    }
    if (extras.length === 1 && typeof extras[0] === 'object' && extras[0] !== null) {
      logFn(extras[0] as Record<string, unknown>, first);
      return;
    }
    logFn({ args: extras }, first);
    return;
  }

  if (typeof second === 'string') {
    logFn(first as Record<string, unknown>, second);
    return;
  }

  logFn(first as Record<string, unknown>);
}

export const logger = {
  info: (first: unknown, second?: unknown, ...rest: unknown[]) =>
    logWith(baseLogger.info.bind(baseLogger), first, second, ...rest),
  warn: (first: unknown, second?: unknown, ...rest: unknown[]) =>
    logWith(baseLogger.warn.bind(baseLogger), first, second, ...rest),
  error: (first: unknown, second?: unknown, ...rest: unknown[]) =>
    logWith(baseLogger.error.bind(baseLogger), first, second, ...rest),
  debug: (first: unknown, second?: unknown, ...rest: unknown[]) =>
    logWith(baseLogger.debug.bind(baseLogger), first, second, ...rest),
  child: (bindings: pino.Bindings) => baseLogger.child(bindings),
};

export function createRequestLogger(requestId: string): Logger {
  return baseLogger.child({ requestId });
}

export type { Logger };
