// utils/errorMessages.ts
// Maps technical error messages to user-friendly messages

interface ErrorMapping {
  pattern: RegExp | string;
  message: string;
  description?: string;
}

const ERROR_MAPPINGS: ErrorMapping[] = [
  // Network errors
  {
    pattern: /Failed to fetch|NetworkError|net::ERR/i,
    message: 'Connection error',
    description: 'Unable to connect to the server. Please check your internet connection and try again.',
  },
  {
    pattern: /timeout|ETIMEDOUT|ECONNRESET/i,
    message: 'Request timed out',
    description: 'The server took too long to respond. Please try again in a moment.',
  },
  {
    pattern: /ECONNREFUSED/i,
    message: 'Server unavailable',
    description: 'Our servers are temporarily unavailable. Please try again later.',
  },

  // Authentication errors
  {
    pattern: /401|unauthorized|invalid.*token|session.*expired/i,
    message: 'Session expired',
    description: 'Please log in again to continue.',
  },
  {
    pattern: /403|forbidden|access.*denied/i,
    message: 'Access denied',
    description: "You don't have permission to perform this action.",
  },

  // Validation errors
  {
    pattern: /invalid.*email/i,
    message: 'Invalid email',
    description: 'Please enter a valid email address.',
  },
  {
    pattern: /required|missing|cannot be empty/i,
    message: 'Missing information',
    description: 'Please fill in all required fields.',
  },
  {
    pattern: /invalid.*phone/i,
    message: 'Invalid phone number',
    description: 'Please enter a valid phone number.',
  },

  // Payment errors
  {
    pattern: /payment.*failed|payment.*declined/i,
    message: 'Payment failed',
    description: 'Your payment could not be processed. Please try again or use a different payment method.',
  },
  {
    pattern: /insufficient.*funds/i,
    message: 'Payment declined',
    description: 'Your payment was declined due to insufficient funds.',
  },
  {
    pattern: /card.*expired/i,
    message: 'Card expired',
    description: 'Your card has expired. Please use a different payment method.',
  },
  {
    pattern: /place.*order.*failed|checkout.*failed/i,
    message: 'Order could not be placed',
    description: 'We could not save your order. Please check your details and try again.',
  },

  // Order errors
  {
    pattern: /out.*of.*stock|insufficient.*stock/i,
    message: 'Item unavailable',
    description: 'One or more items in your cart are no longer available.',
  },
  {
    pattern: /order.*not.*found/i,
    message: 'Order not found',
    description: "We couldn't find the order you're looking for. Please check the order number and try again.",
  },

  // Rate limiting
  {
    pattern: /429|too.*many.*requests|rate.*limit/i,
    message: 'Too many requests',
    description: 'Please wait a moment before trying again.',
  },

  // Server errors
  {
    pattern: /500|internal.*server.*error/i,
    message: 'Server error',
    description: 'Something went wrong on our end. Please try again later.',
  },
  {
    pattern: /502|503|504|bad.*gateway|service.*unavailable/i,
    message: 'Service temporarily unavailable',
    description: 'Our servers are experiencing high traffic. Please try again in a few minutes.',
  },
];

export interface FriendlyError {
  message: string;
  description: string;
  technical?: string;
}

/**
 * Convert a technical error to a user-friendly message
 */
export function getFriendlyError(error: Error | string | unknown): FriendlyError {
  const errorString = typeof error === 'string' 
    ? error 
    : error instanceof Error 
      ? error.message 
      : String(error);

  // Find matching error pattern
  for (const mapping of ERROR_MAPPINGS) {
    const pattern = typeof mapping.pattern === 'string' 
      ? new RegExp(mapping.pattern, 'i') 
      : mapping.pattern;

    if (pattern.test(errorString)) {
      return {
        message: mapping.message,
        description: mapping.description || 'Please try again.',
        technical: errorString,
      };
    }
  }

  // Default error message
  return {
    message: 'Something went wrong',
    description: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
    technical: errorString,
  };
}

/**
 * Get error message from API response
 */
export async function getApiError(response: Response): Promise<FriendlyError> {
  try {
    const data = await response.json();
    const technicalMessage = data.message || data.error || `HTTP ${response.status}`;
    
    // Check for specific API error messages
    if (data.error || data.message) {
      return getFriendlyError(technicalMessage);
    }
    
    return getFriendlyError(technicalMessage);
  } catch {
    return getFriendlyError(`HTTP Error ${response.status}`);
  }
}

/**
 * Format validation errors from API
 */
export function formatValidationErrors(errors: Record<string, string>): string {
  const messages = Object.values(errors).filter(Boolean);
  if (messages.length === 0) return 'Please check your input';
  if (messages.length === 1) return messages[0];
  return messages.slice(0, 3).join('. ') + (messages.length > 3 ? '...' : '');
}

/**
 * Check if error is a network/connection error
 */
export function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Failed to fetch|NetworkError|net::ERR|ETIMEDOUT|ECONNRESET|ECONNREFUSED/i.test(message);
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|429|502|503|504|ETIMEDOUT|ECONNRESET|ECONNREFUSED/i.test(message);
}
