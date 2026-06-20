// frontend/src/utils/csrf.ts - CSRF Token Management for Frontend
// Handles CSRF token retrieval and inclusion in API requests

import { logError } from '../lib/logger';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

/** In-memory token for cross-origin API setups (cookie lives on API host). */
let memoryCsrfToken: string | null = null;

export const setCsrfToken = (token: string | null): void => {
  memoryCsrfToken = token;
};

export const resetCsrfSession = (): void => {
  memoryCsrfToken = null;
};

// Get CSRF token from memory or same-origin cookie
export const getCsrfToken = (): string | null => {
  if (memoryCsrfToken) {
    return memoryCsrfToken;
  }

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_COOKIE_NAME) {
      return value;
    }
  }
  return null;
};

// Fetch CSRF token from server if not in cookie
export const fetchCsrfToken = async (apiBaseUrl: string): Promise<string | null> => {
  try {
    const response = await fetch(`${apiBaseUrl}/csrf-token`, {
      method: 'GET',
      credentials: 'include', // Include cookies
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.csrfToken;
    }
  } catch (error) {
    logError('Failed to fetch CSRF token:', error);
  }
  return null;
};

// Initialize CSRF token (call on app load)
export const initCsrfToken = async (apiBaseUrl: string): Promise<string | null> => {
  let token = getCsrfToken();
  
  if (!token) {
    token = await fetchCsrfToken(apiBaseUrl);
    if (token) {
      setCsrfToken(token);
    }
  }
  
  return token;
};

// Get headers with CSRF token included
export const getCsrfHeaders = (): Record<string, string> => {
  const token = getCsrfToken();
  if (token) {
    return { [CSRF_HEADER_NAME]: token };
  }
  return {};
};

// Enhanced fetch wrapper that includes CSRF token
export const csrfFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const csrfToken = getCsrfToken();
  
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };
  
  // Add CSRF token for non-GET requests
  if (options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase())) {
    if (csrfToken) {
      headers[CSRF_HEADER_NAME] = csrfToken;
    }
  }
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Always include cookies
  });
};

export default {
  getCsrfToken,
  setCsrfToken,
  fetchCsrfToken,
  initCsrfToken,
  getCsrfHeaders,
  csrfFetch,
};
