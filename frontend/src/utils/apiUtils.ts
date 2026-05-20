// utils/apiUtils.ts
// API utilities for request deduplication, caching, and graceful degradation

import { getFriendlyError, isRetryableError, isNetworkError } from './errorMessages';

// ============================================
// REQUEST DEDUPLICATION
// ============================================

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

const pendingRequests = new Map<string, PendingRequest<any>>();
const REQUEST_DEDUPE_WINDOW = 100; // ms

/**
 * Deduplicate identical requests that occur within a short time window
 * Prevents multiple components from firing the same request simultaneously
 */
export async function deduplicatedFetch<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const existing = pendingRequests.get(key);
  const now = Date.now();

  // If there's an existing request within the dedupe window, return it
  if (existing && now - existing.timestamp < REQUEST_DEDUPE_WINDOW) {
    return existing.promise;
  }

  // Create new request
  const promise = fetcher();
  pendingRequests.set(key, { promise, timestamp: now });

  try {
    const result = await promise;
    return result;
  } finally {
    // Clean up after completion
    setTimeout(() => {
      pendingRequests.delete(key);
    }, REQUEST_DEDUPE_WINDOW);
  }
}

// ============================================
// RETRY LOGIC
// ============================================

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  shouldRetry: isRetryableError,
};

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if error is not retryable or we've exhausted retries
      if (!opts.shouldRetry(error) || attempt === opts.maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        opts.baseDelay * Math.pow(2, attempt) + Math.random() * 100,
        opts.maxDelay
      );

      console.log(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ============================================
// GRACEFUL DEGRADATION
// ============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

const cache = new Map<string, CacheEntry<any>>();

/**
 * Fetch with fallback to cached data on failure
 */
export async function fetchWithFallback<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    cacheDuration?: number; // ms
    staleWhileRevalidate?: boolean;
    fallback?: T;
  } = {}
): Promise<T> {
  const { 
    cacheDuration = 5 * 60 * 1000, // 5 minutes default
    staleWhileRevalidate = true,
    fallback,
  } = options;

  const cached = cache.get(key);
  const now = Date.now();

  // If we have valid cache, return it
  if (cached && now < cached.timestamp + cached.expiry) {
    // If staleWhileRevalidate is enabled, trigger background refresh
    if (staleWhileRevalidate && now > cached.timestamp + cached.expiry / 2) {
      // Background refresh (don't await)
      fetcher()
        .then(data => {
          cache.set(key, { data, timestamp: Date.now(), expiry: cacheDuration });
        })
        .catch(() => {
          // Ignore background refresh errors
        });
    }
    return cached.data;
  }

  try {
    const data = await fetcher();
    cache.set(key, { data, timestamp: now, expiry: cacheDuration });
    return data;
  } catch (error) {
    // On failure, try to return stale cache
    if (cached) {
      console.warn(`Returning stale cache for ${key} due to error:`, error);
      return cached.data;
    }

    // Try fallback
    if (fallback !== undefined) {
      console.warn(`Using fallback for ${key} due to error:`, error);
      return fallback;
    }

    throw error;
  }
}

/**
 * Clear cache for a specific key or all keys
 */
export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

// ============================================
// OFFLINE DETECTION
// ============================================

let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
const offlineCallbacks: Set<(online: boolean) => void> = new Set();

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    offlineCallbacks.forEach(cb => cb(true));
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    offlineCallbacks.forEach(cb => cb(false));
  });
}

export function getOnlineStatus(): boolean {
  return isOnline;
}

export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  offlineCallbacks.add(callback);
  return () => offlineCallbacks.delete(callback);
}

// ============================================
// COMBINED API FETCH UTILITY
// ============================================

interface RobustFetchOptions<T> extends RetryOptions {
  cacheKey?: string;
  cacheDuration?: number;
  dedupe?: boolean;
  fallback?: T;
  onError?: (error: unknown) => void;
}

/**
 * Robust fetch with deduplication, retry, caching, and fallback
 */
export async function robustFetch<T>(
  url: string,
  fetchOptions: RequestInit = {},
  options: RobustFetchOptions<T> = {}
): Promise<T> {
  const {
    cacheKey = url,
    cacheDuration = 60000,
    dedupe = true,
    fallback,
    maxRetries = 2,
    onError,
    ...retryOptions
  } = options;

  // Check if offline
  if (!getOnlineStatus()) {
    const cached = cache.get(cacheKey);
    if (cached) return cached.data;
    if (fallback !== undefined) return fallback;
    throw new Error('No internet connection');
  }

  const fetcher = async () => {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json() as Promise<T>;
  };

  try {
    // Wrap with deduplication
    const fetchFn = dedupe
      ? () => deduplicatedFetch(cacheKey, fetcher)
      : fetcher;

    // Wrap with retry
    const retryFn = () => withRetry(fetchFn, { maxRetries, ...retryOptions });

    // Wrap with caching/fallback
    return await fetchWithFallback(cacheKey, retryFn, {
      cacheDuration,
      fallback,
    });
  } catch (error) {
    onError?.(error);
    throw error;
  }
}
