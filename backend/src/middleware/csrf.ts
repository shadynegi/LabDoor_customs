// backend/src/middleware/csrf.ts - CSRF Protection Middleware
// Uses the double-submit cookie pattern for SPA compatibility

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../lib/logger';
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
  req.csrfToken = token;
  
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
    '/api/activity/batch', // sendBeacon cannot attach CSRF headers; rate-limited separately
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
    logger.warn(`CSRF validation failed: Missing token - Cookie: ${!!cookieToken}, Header: ${!!headerToken}`);
    return res.status(403).json({
      success: false,
      error: 'CSRF token missing',
      message: 'Please refresh the page and try again',
    });
  }

  if (cookieToken.length !== headerToken.length) {
    logger.warn('CSRF validation failed: Token length mismatch');
    return res.status(403).json({
      success: false,
      error: 'CSRF token invalid',
      message: 'Security validation failed. Please refresh the page and try again',
    });
  }

  if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    logger.warn('CSRF validation failed: Token mismatch');
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
  const token = req.csrfToken || req.cookies?.[CSRF_COOKIE_NAME];
  
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
