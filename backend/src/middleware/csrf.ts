// backend/src/middleware/csrf.ts - CSRF Protection Middleware
// Uses the double-submit cookie pattern for SPA compatibility

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { csrfCookieOptions } from '../lib/cookies';

// Configuration
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

// Generate a cryptographically secure CSRF token
export const generateCsrfToken = (): string => {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
};

// Middleware to set CSRF token cookie
export const csrfTokenSetter = (req: Request, res: Response, next: NextFunction) => {
  // Check if token already exists in cookies
  let token = req.cookies?.[CSRF_COOKIE_NAME];
  
  if (!token) {
    // Generate new token
    token = generateCsrfToken();
    
    // Set cookie with security options
    res.cookie(CSRF_COOKIE_NAME, token, csrfCookieOptions);
  }
  
  // Attach token to request for use in templates/responses
  (req as any).csrfToken = token;
  
  next();
};

// Middleware to verify CSRF token on state-changing requests
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF check for safe methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Skip CSRF for certain paths (webhooks, public APIs)
  const skipPaths = [
    '/api/paypal/webhook',      // PayPal webhooks have their own verification
    '/api/activity/log',        // Activity logging from frontend
    '/api/activity/batch',      // Batch activity logging
  ];
  
  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Get token from cookie
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  
  // Get token from header
  const headerToken = req.headers[CSRF_HEADER_NAME] as string;

  // Verify both tokens exist and match
  if (!cookieToken || !headerToken) {
    console.warn(`CSRF validation failed: Missing token - Cookie: ${!!cookieToken}, Header: ${!!headerToken}`);
    return res.status(403).json({
      success: false,
      error: 'CSRF token missing',
      message: 'Please refresh the page and try again',
    });
  }

  // Constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    console.warn('CSRF validation failed: Token mismatch');
    return res.status(403).json({
      success: false,
      error: 'CSRF token invalid',
      message: 'Security validation failed. Please refresh the page and try again',
    });
  }

  next();
};

// Endpoint to get CSRF token (for SPA initialization)
export const getCsrfTokenHandler = (req: Request, res: Response) => {
  const token = (req as any).csrfToken || req.cookies?.[CSRF_COOKIE_NAME];
  
  if (!token) {
    // Generate and set new token
    const newToken = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, newToken, csrfCookieOptions);
    
    return res.json({
      success: true,
      csrfToken: newToken,
    });
  }
  
  res.json({
    success: true,
    csrfToken: token,
  });
};

export default {
  csrfTokenSetter,
  csrfProtection,
  getCsrfTokenHandler,
  generateCsrfToken,
};
