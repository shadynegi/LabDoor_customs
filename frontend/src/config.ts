import { getCsrfToken, initCsrfToken } from './utils/csrf';

// Environment configuration
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000',
} as const;

// Initialize CSRF token on app load
let csrfInitialized = false;
export const ensureCsrfToken = async (): Promise<void> => {
  if (!csrfInitialized) {
    await initCsrfToken(config.apiBaseUrl);
    csrfInitialized = true;
  }
};

// Helper to get headers with CSRF token for API requests
export const getApiHeaders = (additionalHeaders: Record<string, string> = {}): Record<string, string> => {
  const csrfToken = getCsrfToken();
  return {
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    ...additionalHeaders,
  };
};

// Enhanced fetch for API calls with CSRF protection
export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  await ensureCsrfToken();
  
  const url = endpoint.startsWith('http') ? endpoint : `${config.apiBaseUrl}${endpoint}`;
  
  return fetch(url, {
    ...options,
    headers: getApiHeaders(options.headers as Record<string, string>),
    credentials: 'include',
  });
};

