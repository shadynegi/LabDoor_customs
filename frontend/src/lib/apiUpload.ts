import {
  config,
  ensureCsrfToken,
  type ApiFetchOptions,
} from '../config';
import { getCsrfToken, fetchCsrfToken, setCsrfToken, resetCsrfSession } from '../utils/csrf';

const DEFAULT_RETRY_STATUSES = [502, 503, 504];

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

async function isCsrfForbidden(response: Response): Promise<boolean> {
  if (response.status !== 403) return false;
  try {
    const data = await response.clone().json();
    const errorText = String(data.error || data.message || '').toLowerCase();
    return errorText.includes('csrf');
  } catch {
    return false;
  }
}

async function refreshCsrfToken(): Promise<void> {
  resetCsrfSession();
  const token = await fetchCsrfToken(config.apiBaseUrl);
  if (token) {
    setCsrfToken(token);
  }
}

function isRetryableStatus(status: number, retryOn: number[]): boolean {
  return retryOn.includes(status);
}

/** Multipart upload helper — do not set Content-Type; the browser adds the boundary. */
export async function apiUpload(
  endpoint: string,
  formData: FormData,
  options: ApiFetchOptions = {}
): Promise<Response> {
  await ensureCsrfToken();

  const { timeoutMs = config.extendedApiTimeoutMs, retry, ...fetchOptions } = options;
  const url = endpoint.startsWith('http') ? endpoint : `${config.apiBaseUrl}${endpoint}`;
  const csrfToken = getCsrfToken();

  const buildInit = (): RequestInit => ({
    method: 'POST',
    ...fetchOptions,
    body: formData,
    credentials: 'include',
    headers: {
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(fetchOptions.headers as Record<string, string>),
    },
  });

  const retryCount = retry?.count ?? 0;
  const retryOn = retry?.on ?? DEFAULT_RETRY_STATUSES;
  let lastError: Error | undefined;
  let csrfRetried = false;

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const response = await fetchWithTimeout(url, buildInit(), timeoutMs);

      if (!csrfRetried && (await isCsrfForbidden(response))) {
        csrfRetried = true;
        await refreshCsrfToken();
        return fetchWithTimeout(url, buildInit(), timeoutMs);
      }

      if (retry && attempt < retryCount && isRetryableStatus(response.status, retryOn)) {
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

  throw lastError ?? new Error('Upload failed');
}
