# RLS Summary

Row-level security policy overview for Supabase.

**Full reference:** [`info.md`](info.md) | **Details:** [RLS_OPTIMIZATION.md](./RLS_OPTIMIZATION.md)


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 10 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; `policy_accepted` required; **Place Order** → `POST /api/checkout/place-order` → WhatsApp redirect (`Order ID` in message = `orders.id` UUID). |
| **Orders** | Email links pre-fill `?orderId=` on `/orders`; lookup via order ID + checkout email (`POST /api/orders/lookup`); legacy access-exchange returns **410**. |
| **Admin** | Dashboard search includes order id UUID, order number, email, name; **Mark paid** with external `payment_id` + admin note; **Settings** tab. |
| **Activity** | Consent-gated batch; `contact_submit` on contact success; IPs anonymized with `IP_SALT`. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Current approach

- Primary data path: Express API → postgres.js (bypasses RLS with server credentials)
- RLS enabled on sensitive tables as defense-in-depth for direct Supabase client usage
- Public storefront never uses service role key in browser

## Tables with RLS

All **10** `CLIENT_REVOKED_TABLES` in `backend/src/lib/rlsMigration.ts`: `products`, `orders`, `contact_messages`, `coupons`, `coupon_usage`, `payment_idempotency`, `order_access_exchanges`, `customers`, `activity_logs`, `admin_sessions`. No public PostgREST read on `products`; catalog is served only via Express (`GET /api/products`, `POST /api/products/search`).
