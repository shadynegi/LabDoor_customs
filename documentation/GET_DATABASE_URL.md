# Get Database URL

Find your Supabase PostgreSQL connection string.

**Full reference:** [`info.md`](info.md)

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 14 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; `policy_accepted` required; **Place Order** → `POST /api/checkout/place-order` → WhatsApp redirect (`Order ID` in message = `orders.id` UUID); checkout email synced to activity on change/blur. |
| **Orders** | Email links pre-fill `?orderId=` on `/orders`; lookup via order ID + checkout email (`POST /api/orders/lookup`); tracked orders in sessionStorage; legacy access-exchange returns **410**; lookup failure message **Order not found**. |
| **Admin** | Dashboard search includes order id UUID, order number, email, name; **Mark paid** with external `payment_id` + admin note; **Settings** tab (no contact inbox). |
| **Activity** | Consent-gated batch; `contact_submit` on contact success; IPs anonymized with `IP_SALT`. |
| **Reviews** | `POST /api/reviews/check` on email blur; pending-moderation copy; vote error toasts. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Steps

1. Open [supabase.com](https://supabase.com) → your project.
2. Go to **Settings → Database**.
3. Copy the connection string.

---

## For the app (recommended)

Use the **Connection pooling** URI with port **6543**:

```
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

Set as `DATABASE_URL` in backend environment.

---

## For migrations

Use the **Direct connection** URI with port **5432** for running SQL scripts.

---

## GitHub keep-alive

Set the pooler URL as `DATABASE_URL` secret for the keep-alive workflow.

---

## Troubleshooting connection logs

| Log / symptom | Wrong URL? | What to do |
|---------------|------------|------------|
| `Bootstrap: database reachable` at startup, then hours later `Maintenance: skipped (database unreachable)` with `CONNECT_TIMEOUT` or `ENOTFOUND` | **No** — transient network/DNS (sleep, Wi‑Fi) | Wait for next maintenance interval or wake network; no URL change needed |
| `Database ping timed out` during bootstrap; API never serves data | **Often yes** — host, password, paused project, or wrong port | Copy fresh URI from Supabase; use pooler **6543** with `?pgbouncer=true`; unpause project |
| `[DB] PgBouncer pooler mode enabled` then steady operation | URL format is correct for the app | — |

Use **pooler (6543)** for `DATABASE_URL` in the running app. Use **direct (5432)** only in the Supabase SQL editor or one-off migrations.

**Reference:** [`info.md` — Maintenance warnings vs wrong DATABASE_URL](info.md#maintenance-warnings-vs-wrong-database_url)
