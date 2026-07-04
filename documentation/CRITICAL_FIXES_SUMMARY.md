# Payment and Order Reliability

Reliability features for checkout, refunds, and order sync.

**Full reference:** [`info.md`](info.md) — Checkout and payments section


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 10 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart in localStorage; WhatsApp place-order checkout; order tracking via signed access token. |
| **Admin** | Bulk updates max **500** IDs; manual mark paid requires payment reference + admin note; paid orders cannot cancel (no refunds); product cards on mobile. |
| **Activity** | `POST /api/activity/batch` is CSRF-exempt and rate-limited; frontend sends only with analytics cookie consent; IPs anonymized with `IP_SALT`. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Atomic checkout

- Stock decremented in same transaction as pending order creation
- Coupon reservations tied to order lifecycle
- Pending orders expire via maintenance job; stock restored on expiry/cancel

## WhatsApp checkout

- Place-order creates pending order + stock reservation in one transaction
- Customer completes payment off-site; admin marks paid with payment reference
- No automated refunds — paid orders cannot be cancelled

## Idempotency

- Client-supplied idempotency keys on place-order
- Reclaim logic for stale pending keys
- Redis + database backing
