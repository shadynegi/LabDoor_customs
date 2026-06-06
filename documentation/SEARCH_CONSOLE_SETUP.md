# Google Search Console Setup

Configure Search Console for Lab Door Customs.

**Full reference:** [`info.md`](info.md)

---


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

## Verification

Set in frontend environment:

```
VITE_GSC_VERIFICATION=your_verification_token
```

The app injects the verification meta tag at startup via `searchConsole.ts`.

---

## Sitemap

Build generates `public/sitemap.xml` with:

- Static pages (home, products, policies, etc.)
- Live product URLs from `GET /api/products/sitemap-urls`

Submit in Search Console: `https://www.yourdomain.com/sitemap.xml`

Production builds require product URLs unless `SITEMAP_REQUIRE_PRODUCTS=false`.

---

## robots.txt

Generated alongside sitemap. Disallows admin, checkout, cart, and payment paths.

---

## Admin status

Admin analytics tab shows GSC configuration status and link to Search Console dashboard.
