# Media Asset Guide

Guidelines for product and site media assets in Lab Door Customs.

**Full reference:** [`info.md`](info.md)


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 14 tables.

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

Source PNGs live in `frontend/src/assets/` (5 shoe designs + 5 backgrounds + logos). Build runs `npm run optimize-assets` to generate WebP variants in `frontend/src/assets/optimized/` and `frontend/src/lib/generatedImageAssets.ts`.

| Asset set | Source | Optimized widths |
|-----------|--------|------------------|
| Shoe products | `Shoe_Design/*.png` | 320, 640, 1200 px WebP |
| Backgrounds | `Backgrounds/*.png` | 1280, 1920 px WebP |
| Logos | `Logo/*.png` | 200–400 px WebP |

Mapping: `frontend/src/lib/productImageMaps.ts` (DB paths like `/assets/blue-nike.png` → bundled WebP). Display: `frontend/src/lib/responsiveImage.ts` (`srcSet` / `sizes`).

## Performance

- `npm run build:budget` enforces dist size limits (see [`PERFORMANCE_BASELINE.md`](PERFORMANCE_BASELINE.md))
- Lazy load on product grids; LCP preload on Home hero
- Supabase Storage URLs use `optimizeImageUrl()` transforms
- Appropriate `srcset` / `sizes` on catalog and checkout thumbnails
