# Optional Future Enhancements

Items not yet implemented that may be considered for future work.

**Full reference:** [`info.md`](info.md)


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 14 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart in localStorage; place-order → WhatsApp redirect; order tracking links use `GET /api/orders/access-exchange/:code` (no token in email URL). |
| **Admin** | Bulk updates max **500** IDs; manual mark paid with payment reference; paid orders cannot cancel or refund (no-refund policy); product cards on mobile. |
| **Activity** | `POST /api/activity/batch` is CSRF-exempt and rate-limited; frontend sends only with analytics cookie consent; IPs anonymized with `IP_SALT`. |
| **Reviews** | Public responses strip PII (`toPublicReview()`); admin shows email. Eligibility via `POST /api/reviews/check` (email in body). Votes on approved reviews only. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Known gaps

- Admin **Mark paid** requires `admin_note` and `payment_id` (external reference); logged to activity (see `adminMarkPaid.test.ts`)
- **No-refund / manufacturing-defect replacement policy** is implemented (storefront, checkout acceptance, admin refund block, emails) — see `info.md` and `/returns-policy`
- Sentry release/source maps not wired in CI
- Frontend security headers depend on static host configuration
- E2E coverage includes smoke + deep mocked flows (`deep-flows-ui.spec.ts`); live WhatsApp checkout still manual
- OpenAPI specification not generated

## Deferred by design

- Category slug routes (`/category/:slug`)

For current capabilities, see [`info.md`](info.md).
