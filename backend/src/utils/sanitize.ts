// backend/src/utils/sanitize.ts - Input Sanitization Utilities
import { FilterXSS } from 'xss';

// XSS sanitization options
const xssOptions = {
  whiteList: {}, // No HTML tags allowed
  stripIgnoreTag: true, // Remove all tags not in whitelist
  stripIgnoreTagBody: ['script', 'style'], // Remove script and style tags completely
};

// Create sanitizer instance
const sanitizer = new FilterXSS(xssOptions);

/**
 * Sanitize a string to prevent XSS attacks
 */
export const sanitizeString = (input: string | null | undefined): string => {
  if (!input) return '';
  return sanitizer.process(input.trim());
};

/**
 * Sanitize an object's string properties recursively
 */
export const sanitizeObject = <T extends Record<string, any>>(obj: T): T => {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized: Record<string, any> = Array.isArray(obj) ? [] : {};

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeString(item) : 
        typeof item === 'object' ? sanitizeObject(item) : item
      );
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
};

/**
 * Sanitize order data
 */
export const sanitizeOrderData = (data: {
  customer_email?: string;
  customer_name?: string;
  shipping_address?: any;
  notes?: string;
}) => {
  return {
    customer_email: sanitizeString(data.customer_email)?.toLowerCase(),
    customer_name: sanitizeString(data.customer_name),
    shipping_address: data.shipping_address ? sanitizeObject(data.shipping_address) : undefined,
    notes: sanitizeString(data.notes),
  };
};

/**
 * Sanitize search query
 */
export const sanitizeSearchQuery = (query: string | null | undefined): string => {
  if (!query) return '';
  // Remove special SQL characters and sanitize for XSS
  return sanitizeString(query)
    .replace(/[%_\\]/g, '') // Remove SQL wildcards
    .slice(0, 100); // Limit length
};

export default {
  sanitizeString,
  sanitizeObject,
  sanitizeOrderData,
  sanitizeSearchQuery,
};
