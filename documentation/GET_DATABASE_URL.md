# Get Database URL

Find your Supabase PostgreSQL connection string.

**Full reference:** [`info.md`](info.md)

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 13 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; PayPal `?code=` exchange; capture **409** -> processing UI; checkout email synced to activity on change/blur. |
| **Orders** | Email links `GET /api/orders/access-exchange/:code`; legacy `?orderNumber=&token=` stripped; partial refresh keeps stale data + warning. |
| **Admin** | Products paginated (load more); messages mark read on open; coupons scope UI; reviews admin response; estimated delivery; error/retry states. |
| **Activity** | Consent-gated batch; `contact_submit` on contact success. |
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
