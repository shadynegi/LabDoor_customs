import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerProcessErrorHandlers,
  resetProcessErrorHandlersForTests,
} from '../../backend/src/lib/processErrorHandlers';

describe('processErrorHandlers', () => {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  beforeEach(() => {
    resetProcessErrorHandlersForTests();
    listeners.clear();
    vi.spyOn(process, 'on').mockImplementation((event, listener) => {
      const key = String(event);
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)!.add(listener as (...args: unknown[]) => void);
      return process;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetProcessErrorHandlersForTests();
  });

  it('registers unhandledRejection and uncaughtException once', () => {
    registerProcessErrorHandlers();
    registerProcessErrorHandlers();

    expect(process.on).toHaveBeenCalledTimes(2);
    expect(listeners.has('unhandledRejection')).toBe(true);
    expect(listeners.has('uncaughtException')).toBe(true);
  });

  it('logs unhandled rejections without throwing', () => {
    registerProcessErrorHandlers();
    const handler = [...listeners.get('unhandledRejection')!][0];

    expect(() =>
      handler(new Error('write CONNECT_TIMEOUT pooler.supabase.com:6543'))
    ).not.toThrow();
  });
});
