# Media Asset Guide

Guidelines for product and site media assets in Lab Door Customs.

**Full reference:** [`info.md`](info.md)


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 13 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart in localStorage; PayPal checkout exchange `?code=`; order tracking links use `GET /api/orders/access-exchange/:code` (no token in email URL); capture requires `serverOrderId` + `accessToken`. |
| **Admin** | Bulk updates max **500** IDs; manual mark paid verifies PayPal capture via API; paid orders cannot cancel without refund; product cards on mobile. |
| **Activity** | `POST /api/activity/batch` is CSRF-exempt and rate-limited; frontend sends only with analytics cookie consent; IPs anonymized with `IP_SALT`. |
| **Reviews** | Public responses strip PII (`toPublicReview()`); admin shows email. Eligibility via `POST /api/reviews/check` (email in body). Votes on approved reviews only. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md) (or [`info.md`](info.md) from subfolders). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

---

## Product images

- Store URLs in product `images` array (database)
- Primary image: first URL in array
- 360° sequences: separate field on product record
- Recommended: WebP or optimized JPEG, consistent aspect ratio

## Static assets

Located in `frontend/src/assets/` and `frontend/public/`:

- Logo, favicon, hero images
- Referenced in components via import or public path

## Admin upload

Product images added via admin dashboard as URLs (hosted externally or on CDN).

## Performance

- Lazy load on product grids
- Appropriate sizing for mobile and desktop breakpoints
