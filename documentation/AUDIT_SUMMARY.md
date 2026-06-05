# Security Controls Reference

Security implementation overview for Lab Door Customs.

**Full reference:** [`../info.md`](../info.md) — see Security and Logging sections

## Authentication

- Admin: bcrypt password hash, HTTP-only session cookie, SHA-256 session hash in `admin_sessions`, 24h TTL
- Customer orders: access token (SHA-256 hash stored); checkout exchange codes for PayPal redirect URLs

## Request protection

- CSRF double-submit on all mutating routes
- Helmet security headers, CSP for PayPal domains
- Rate limiting on login, contact, checkout (Redis-backed in production)
- HTTPS enforced in production via Cloudflare `x-forwarded-proto`

## Payment security

- Server-side pricing only — client totals validated against server calculation
- PayPal webhook signature verification on raw body
- Webhook capture amount resolved from PayPal API when missing from payload
- Capture amount mismatch triggers auto-refund
- Idempotency keys prevent duplicate orders and refunds (separate keys for create vs capture)

## Data protection

- Secrets stripped from API responses (access tokens, password hashes)
- Parameterized SQL via postgres.js
- Admin routes require session middleware
- Product image uploads capped at 512KB for data URLs
- Supabase RLS: service role for writes; applied at backend startup

## Production gates

- `backend/scripts/validate-env.mjs` + startup validation + CI step
- Redis required for healthy status and startup in production
- `POST /api/admin/generate-hash` disabled in production
