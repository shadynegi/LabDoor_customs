import { getCsrfToken, initCsrfToken } from './utils/csrf';

export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000',
  apiTimeoutMs: parseInt(import.meta.env.VITE_API_TIMEOUT_MS || '15000', 10),
} as const;

export interface ApiFetchRetryOptions {
  count: number;
  /** HTTP status codes to retry (default 502, 503, 504). */
  on?: number[];
}

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
  retry?: ApiFetchRetryOptions;
}

let csrfInitialized = false;
export const ensureCsrfToken = async (): Promise<void> => {
  if (!csrfInitialized) {
    await initCsrfToken(config.apiBaseUrl);
    csrfInitialized = true;
  }
};

export const getApiHeaders = (additionalHeaders: Record<string, string> = {}): Record<string, string> => {
  const csrfToken = getCsrfToken();
  return {
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    ...additionalHeaders,
  };
};

const DEFAULT_RETRY_STATUSES = [502, 503, 504];

function isRetryableStatus(status: number, retryOn: number[]): boolean {
  return retryOn.includes(status);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * API fetch with CSRF, 15s default timeout, and optional retry on gateway errors.
 */
export const apiFetch = async (
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<Response> => {
  await ensureCsrfToken();

  const { timeoutMs = config.apiTimeoutMs, retry, ...fetchOptions } = options;
  const url = endpoint.startsWith('http') ? endpoint : `${config.apiBaseUrl}${endpoint}`;
  const init: RequestInit = {
    ...fetchOptions,
    headers: getApiHeaders(fetchOptions.headers as Record<string, string>),
    credentials: 'include',
  };

  const retryCount = retry?.count ?? 0;
  const retryOn = retry?.on ?? DEFAULT_RETRY_STATUSES;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const response = await fetchWithTimeout(url, init, timeoutMs);

      if (
        retry &&
        attempt < retryCount &&
        isRetryableStatus(response.status, retryOn)
      ) {
        const delay = 200 * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt >= retryCount) break;
      const delay = 200 * Math.pow(2, attempt) + Math.random() * 100;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError ?? new Error('API request failed');
};
