# Payment and Order Reliability

Reliability features for checkout, refunds, and order sync.

**Full reference:** [`info.md`](info.md) — Checkout and payments section


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 13 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart in localStorage; PayPal checkout exchange `?code=`; order tracking links use `GET /api/orders/access-exchange/:code` (no token in email URL); capture requires `serverOrderId` + `accessToken`. |
| **Admin** | Bulk updates max **500** IDs; manual mark paid verifies PayPal capture via API; paid orders cannot cancel without refund; product cards on mobile. |
| **Activity** | `POST /api/activity/batch` is CSRF-exempt and rate-limited; frontend sends only with analytics cookie consent; IPs anonymized with `IP_SALT`. |
| **Reviews** | Public responses strip PII (`toPublicReview()`); admin shows email. Eligibility via `POST /api/reviews/check` (email in body). Votes on approved reviews only. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Atomic checkout

- Stock decremented in same transaction as pending order creation
- Coupon reservations tied to order lifecycle
- Pending orders expire via maintenance job; stock restored on expiry/cancel

## PayPal integration

- Create-payment → capture → webhook three-path reconciliation
- Webhook amount validation against order total
- Refund idempotency via `refund_events` table and PayPal-Request-Id
- Admin cancel with refund syncs DB only after PayPal confirms

## Idempotency

- Client-supplied idempotency keys on create-payment and refunds
- Reclaim logic for stale pending keys
- Redis + database backing
