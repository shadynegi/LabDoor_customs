# Test results

Timestamped reports are written to **`documentation/test-results/`** when you run tests through the report-enabled npm scripts (see [test_guidelines.md](test_guidelines.md)).

Each suite writes its own report files, grouped by a shared **run ID** timestamp:

| File pattern | Suite |
|--------------|-------|
| `backend-unit-YYYY-MM-DD_HH-mm-ss.md` | Backend unit tests (`Tests/backend/`) |
| `api-YYYY-MM-DD_HH-mm-ss.md` | API integration tests (`Tests/api/`) |
| `frontend-ui-YYYY-MM-DD_HH-mm-ss.md` | Playwright UI tests (`Tests/frontend/`) |
| `summary-YYYY-MM-DD_HH-mm-ss.md` | Combined summary (only when running `npm test` / `test:all`) |
| `latest-summary.json` | Pointer to the most recent full run |

Matching `.json` files are written alongside each `.md` report.

The `test-results/` subfolder is gitignored except for `.gitkeep`.

## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 14 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart in localStorage; PayPal checkout exchange `?code=`; order tracking links use `GET /api/orders/access-exchange/:code` (no token in email URL); capture requires `serverOrderId` + `accessToken`. |
| **Admin** | Bulk updates max **500** IDs; manual mark paid verifies PayPal capture via API; paid orders cannot cancel or refund (no-refund policy); product cards on mobile. |
| **Activity** | `POST /api/activity/batch` is CSRF-exempt and rate-limited; frontend sends only with analytics cookie consent; IPs anonymized with `IP_SALT`. |
| **Reviews** | Public responses strip PII (`toPublicReview()`); admin shows email. Eligibility via `POST /api/reviews/check` (email in body). Votes on approved reviews only. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

