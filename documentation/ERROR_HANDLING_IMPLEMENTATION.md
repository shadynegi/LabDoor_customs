# Error Handling

Frontend and backend error handling.

**Full reference:** [`../info.md`](../info.md)

## Backend

- Structured JSON error responses with appropriate HTTP status codes
- Pino logging with request IDs (`X-Request-Id`)
- Sentry capture for unhandled errors in production
- PayPal errors mapped to client-safe messages

## Frontend

- `apiFetch` wrapper with timeout, CSRF retry, credential handling
- Sonner toasts for user-facing errors
- Sentry browser SDK in production
- Graceful fallbacks for network failures
