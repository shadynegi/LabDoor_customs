# Database Setup Reference

Database schema and configuration.

**Full reference:** [`info.md`](info.md) | **Guide:** [DATABASE_SETUP.md](./DATABASE_SETUP.md)

PostgreSQL on Supabase with tables for products, orders, customers, coupons, `contact_messages` (legacy schema), idempotency keys, and activity logs. Connection via pooler (6543) at runtime, direct (5432) for migrations. **Production Supabase:** all required migrations applied (July 2026) — see [`SUPABASE_SQL_TO_RUN.md`](./SUPABASE_SQL_TO_RUN.md). Storefront contact form opens WhatsApp client-side — no rows written to `contact_messages`.

## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 10 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart in localStorage; WhatsApp place-order checkout; order tracking via order ID + checkout email (`POST /api/orders/lookup`). |
| **Admin** | Bulk updates max **500** IDs; manual mark paid requires payment reference + admin note; paid orders cannot cancel (no refunds); product cards on mobile. |
| **Activity** | `POST /api/activity/batch` is CSRF-exempt and rate-limited; frontend sends only with analytics cookie consent; IPs anonymized with `IP_SALT`. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

