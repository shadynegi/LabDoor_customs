// frontend/src/utils/csrf.ts - CSRF Token Management for Frontend
// Handles CSRF token retrieval and inclusion in API requests

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

// Get CSRF token from cookie
export const getCsrfToken = (): string | null => {
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
    console.error('Failed to fetch CSRF token:', error);
  }
  return null;
};

// Initialize CSRF token (call on app load)
export const initCsrfToken = async (apiBaseUrl: string): Promise<string | null> => {
  // Check if token exists in cookie first
  let token = getCsrfToken();
  
  if (!token) {
    // Fetch from server
    token = await fetchCsrfToken(apiBaseUrl);
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
  fetchCsrfToken,
  initCsrfToken,
  getCsrfHeaders,
  csrfFetch,
};
