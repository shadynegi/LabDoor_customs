# Step-by-Step SQL

Run database schema and migrations for Lab Door Customs.

**Full reference:** [`info.md`](info.md) | **Setup:** [DATABASE_SETUP.md](./DATABASE_SETUP.md)


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 10 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; `policy_accepted` required; **Place Order** → `POST /api/checkout/place-order` → WhatsApp redirect (`Order ID` in message = `orders.id` UUID); checkout email synced to activity on change/blur. |
| **Orders** | Email links pre-fill `?orderId=` on `/orders`; lookup via order ID + checkout email (`POST /api/orders/lookup`); tracked orders in sessionStorage; legacy access-exchange returns **410**; lookup failure message **Order not found**. |
| **Admin** | Dashboard search includes order id UUID, order number, email, name; **Mark paid** with external `payment_id` + admin note; **Settings** tab. |
| **Activity** | Consent-gated batch; `contact_submit` on contact success; IPs anonymized with `IP_SALT`. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Prerequisites

- Supabase project created
- Direct connection URI (port 5432) from [GET_DATABASE_URL.md](./GET_DATABASE_URL.md)

## Steps

1. Connect to Supabase SQL Editor.
2. Run `backend/src/database/schema.sql`, then incremental files in `backend/src/database/migration-*.sql`. On **production**, use the **Migration audit** section in [`SUPABASE_SQL_TO_RUN.md`](./SUPABASE_SQL_TO_RUN.md) to verify what is already applied before re-running scripts.
3. Confirm core tables exist: `products`, `orders`, `order_items`, `customers`, `coupons`, `contact_messages` (legacy — contact form is client-side WhatsApp only), plus runtime tables (`payment_idempotency`, `order_access_exchanges`, `activity_logs`, `admin_sessions`, etc.). On **new** databases only: run `migration-drop-reviews.sql` if `reviews` / `review_votes` remain; run `migration-drop-paypal.sql` if legacy payment tables/columns remain. **Production Supabase:** both reviews and variant-field migrations are already applied (July 2026).
4. Set `DATABASE_URL` to pooler URI (6543) on backend.
5. Start backend — runtime schema patches apply automatically for incremental DDL.

## Verify

```bash
curl http://localhost:5000/api/health
```

Should report database connected.
