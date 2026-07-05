# Platform Features

Implemented capabilities in Lab Door Customs.

**Full reference:** [`info.md`](info.md)


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 10 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart in localStorage; WhatsApp place-order checkout; order tracking via order ID + checkout email (`POST /api/orders/lookup`). |
| **Admin** | Bulk updates max **500** IDs; manual mark paid requires payment reference + admin note; paid orders cannot cancel (no refunds); product cards on mobile. |
| **Activity** | `POST /api/activity/batch` is CSRF-exempt and rate-limited; frontend sends only with analytics cookie consent; IPs anonymized with `IP_SALT`. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA + policy spacer; `100dvh` + safe-area insets; Playwright **responsive-pages-ui** (11 viewports incl. 320px); OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Storefront

Product catalog with search/filters, 360° product viewer, cart, WhatsApp checkout, order tracking, contact form (opens WhatsApp with prefilled message — no API), policy pages, SEO sitemap.

## Admin

Dashboard for products, orders, customers, coupons, analytics/GSC status, and Settings (activity export, sessions).

## Backend

REST API with CSRF, rate limiting, Redis cache, WhatsApp notifications, maintenance jobs, structured logging, Sentry.
