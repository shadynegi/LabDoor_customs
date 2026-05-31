# Security Controls Reference

Security implementation overview for Lab Door Customs.

**Full reference:** [`../info.md`](../info.md) — see Security and Logging sections

## Authentication

- Admin: bcrypt password hash, HTTP-only session cookie, 24h TTL
- Customer orders: access token (SHA-256 hash stored), required for lookup and capture

## Request protection

- CSRF double-submit on all mutating routes
- Helmet security headers, CSP for PayPal domains
- Rate limiting on login, contact, checkout (Redis-backed in production)
- HTTPS enforced in production via Cloudflare `x-forwarded-proto`

## Payment security

- Server-side pricing only — client totals validated against server calculation
- PayPal webhook signature verification on raw body
- Capture amount mismatch triggers auto-refund
- Idempotency keys prevent duplicate orders and refunds

## Data protection

- Secrets stripped from API responses (access tokens, password hashes)
- Parameterized SQL via postgres.js
- Admin routes require session middleware
