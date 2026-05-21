const isProduction = process.env.NODE_ENV === 'production';

/** Default options for sensitive server-set cookies in production. */
export const secureCookieDefaults = {
  secure: isProduction,
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
};

/**
 * CSRF double-submit cookie — must remain readable by the SPA (httpOnly: false).
 * Still uses secure + sameSite in production per Phase 3 transport rules.
 */
export const csrfCookieOptions = {
  httpOnly: false,
  secure: isProduction,
  sameSite: 'lax' as const,
  maxAge: 24 * 60 * 60 * 1000,
  path: '/',
};
