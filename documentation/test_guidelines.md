# Lab Door Customs — Test Guidelines

How to test Lab Door Customs locally, in CI, and manually. This is the single reference for automated tests, manual QA flows, and verification commands.

**Project reference:** [info.md](info.md)

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 14 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; DB-backed coupon validate; server/client total compare; PayPal `?code=` exchange; capture **409** → processing UI + poll timeout; `checkout_complete` before redirect. |
| **Orders** | Email links `GET /api/orders/access-exchange/:code`; legacy `?orderNumber=&token=` stripped; partial refresh keeps stale data + warning. |
| **Admin** | Products paginated (load more); inventory (SKU, reorder, movements, low-stock, bulk stock delta); analytics periods + CSV export; customer search/notes; order customer-details + pending-item edits; messages mark read on open; coupons scope UI; reviews admin response; estimated delivery; error/retry states. |
| **Activity** | Consent-gated batch; `contact_submit` on contact success. |
| **Reviews** | `POST /api/reviews/check` on email blur; pending-moderation copy; vote error toasts. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## When to run tests

**Do not run tests automatically** during normal development, refactors, or documentation work unless explicitly requested.

| Who | Rule |
|-----|------|
| **Cursor / AI agents** | Run tests **only when the user explicitly asks** (e.g. “run the tests”, “verify with test cases”, “run the test suite”). Do not run tests proactively after code changes unless the user says to. |
| **Developers** | Run tests when you are validating a change, before a release, or when debugging a failing area. CI still runs tests on push/PR to `main`/`master`. |

If the user did not mention testing, **skip** `npm test`, `npm run test:all`, Playwright, and Vitest commands.

---

## Overview

| Suite | Tool | Location | Count | Needs live DB? |
|-------|------|----------|-------|----------------|
| Backend unit | Vitest | `Tests/backend/` | 26 files, 93 tests | No (mocked) |
| API integration | Vitest + Supertest | `Tests/api/` | 19 files, 53 tests | No (mocked) |
| Frontend E2E / UI | Playwright | `Tests/frontend/` | 13 files, 37 tests | No (mocked `/api` + static preview) |
| Link checker | Custom script | repo root | — | No |

**Total:** 183 automated tests — 93 backend unit + 53 API + 37 Playwright UI (desktop + mobile projects).

Backend unit tests include: payment idempotency, order tokens, checkout exchange hashing, order token encryption, webhook errors, product image validation, admin session hashing, PayPal webhook utils, refund idempotency, checkout pricing, coupon scope (`applies_to`), `computeCheckoutPricingForCart`, RLS table list + bootstrap contract, RLS grant revoke under `BOOTSTRAP_SKIP_DDL`, email portal URL (`buildOrderPortalUrl`), client IP, keep-alive.

API tests include: checkout (incl. client amount mismatch + policy acceptance), create-payment happy path (mocked PayPal + exchange), capture 409 reconciliation, capture refund mismatch, checkout-context recovery, checkout exchange, PayPal webhook COMPLETED/DENIED, admin mark-paid (validation + success), **admin enhancements** (low-stock, inventory movements, customer PATCH, bulk stock delta, order customer-details, analytics period), **products search**, no-refund policy (admin refund/cancel 403), health, orders, security, activity batch/log, order lookup, reviews check.

Backend unit tests also cover: **sales analytics** period parsing + CSV export, **admin analytics cache** keys/TTL, inventory movement helpers (via integration paths), payment idempotency, order tokens, RLS, email portal URL, and related payment/order utilities.

Playwright includes: payment-success missing-token UX, orders legacy URL deprecation + `?code=` email redeem, checkout server/client total mismatch block, checkout country pre-select (native `<select>`), admin login redirect + dashboard analytics smoke, **deep flows** (`deep-flows-ui.spec.ts`: catalog `?q=` server search, product trust badges + reviews, checkout policy gate + coupon + create-payment, cart quantity, payment-success 409 processing UI). Checkout PayPal tests use `clickPayPalAndWaitForCreatePayment()` in `Tests/frontend/helpers/checkout.ts` (registers response listener before click). Mismatch tests set `createPaymentTotal` via the storefront fixture (`Tests/frontend/fixtures/storefront.ts`).

---

## Folder structure

```
Tests/
├── test_guidelines.md   # This file
├── setup.ts             # Shared Vitest mocks (DB, Redis, idempotency)
├── helpers/
│   └── http.ts          # CSRF cookie/header helpers for API tests
├── backend/             # Backend unit tests (Vitest)
├── api/                 # HTTP API tests (Vitest + Supertest)
├── frontend/            # Storefront E2E + UI tests (Playwright)
│   ├── fixtures/        # Mock API data + extended test fixture
│   └── helpers/         # API mocks, cookie/cart helpers
├── test-results/        # Timestamped reports (generated; gitignored)
├── scripts/
│   └── run-with-report.mjs  # Runs tests and writes reports
├── playwright.config.ts # Playwright config (preview server on port 4173)
└── package.json         # Playwright dependency + frontend test scripts
```

All automated tests live under **`Tests/`** (`backend/`, `api/`, `frontend/`).

---

## Prerequisites

### Backend / API (Vitest)

```bash
npm install            # from repository root (workspaces)
npm test
```

No running server or database required. `Tests/setup.ts` mocks Postgres, Redis, and idempotency storage.

### Frontend E2E (Playwright)

```bash
npm install            # from repository root
npm run build -w frontend   # Playwright serves frontend/dist via Vite preview

cd Tests
npm install
npm run test:frontend:install   # first time only — downloads Chromium
npm run test:frontend
```

Playwright starts `vite preview` on `http://127.0.0.1:4173` automatically (see `playwright.config.ts`). Preview sets `PLAYWRIGHT=true` so Vite **does not proxy** `/api` to a live backend — all API traffic is mocked in-browser via `page.route()`. The backend does **not** need to be running.

**UI coverage:** products list/detail, cart, checkout shell, contact form, navigation, cookie consent, mobile viewport (`mobile-ui.spec.ts` runs in the `mobile-chrome` project). Playwright uses `workers: 1` and `retries: 1` for stable checkout flows.

---

## Test reports (`documentation/test-results/`)

The unified runner (`Tests/scripts/run-with-report.mjs`) writes **one report per suite** plus a combined summary when you run the full suite.

| Command | Reports written |
|---------|-----------------|
| `npm test` / `npm run test:all` | `backend-unit-{runId}.md`, `api-{runId}.md`, `frontend-ui-{runId}.md`, `summary-{runId}.md`, `latest-summary.json` |
| `npm run test:backend` | `backend-unit-{runId}.md` + `.json` |
| `npm run test:api` | `api-{runId}.md` + `.json` |
| `npm run test:frontend` / `test:ui` | `frontend-ui-{runId}.md` + `.json` |

`{runId}` is a shared timestamp like `2026-06-06_13-01-59` so all reports from one full run group together.

Each report includes:

- Overall pass/fail and exit code
- Every test case with pass/fail status, file, and duration
- **Failure logs** — full error messages and stack traces for failed cases
- Command stderr/stdout snippets when useful for debugging
- Git branch/commit and Node environment

Generated reports are **gitignored**; only `documentation/TEST_RESULTS.md` is tracked.

`npm test` always rebuilds the frontend with test `VITE_*` defaults before Playwright (preview build clears `CI` so localhost `VITE_SITE_URL` passes validate-env), defaults `CI=true` for Playwright only so the preview server is not reused stale, then installs Playwright in `Tests/` on first UI run. Use `test:watch` (Vitest) or `test:raw` / `test:frontend:raw` to run **without** writing a report.

---

## How to run automated tests

Run these **only when you or the user explicitly want verification**.

### From repo root (one command runs everything)

```bash
npm test                  # All suites: backend unit + API + frontend UI (3 reports + summary)
npm run test:all          # Same as npm test
npm run test:backend      # Backend unit only → backend-unit-{runId}.md
npm run test:api          # API tests only → api-{runId}.md
npm run test:frontend     # Playwright UI → frontend-ui-{runId}.md
npm run test:ui           # Alias for test:frontend
```

Reports land in `documentation/test-results/`. The most recent full run is also summarized in `latest-summary.json`.

### Backend (Vitest)

```bash
npm test                  # from repository root
npm run test:watch -w backend
npm run test:unit
npm run test:api
```

**Locations:** `Tests/backend/` and `Tests/api/`

| Suite | Coverage |
|-------|----------|
| `backend/` | PayPal webhook utils, refund idempotency, checkout pricing, order tokens, client IP |
| `api/` | Health, checkout validation, orders, security |

API tests mock the database layer for fast isolated runs.

### Frontend (Playwright)

```bash
npm run build -w frontend   # optimize-assets → sitemap → vite build → build:budget
npm run measure:dist -w frontend   # optional size report
cd Tests && npm run test:frontend:install   # first time only
npm run test:frontend                       # from repository root
```

**Location:** `Tests/frontend/storefront.spec.ts`

Playwright serves the built `dist/` via Vite preview (no backend required for smoke tests).

### Link checker

```bash
npm run links:check   # from repo root
```

Validates internal links in documentation markdown files.

### Frontend performance (build)

Production frontend builds run `optimize-assets` (WebP from source PNGs) and `build:budget` (fails if `dist/assets` exceeds limits). See [`PERFORMANCE_BASELINE.md`](PERFORMANCE_BASELINE.md).

---

## Test inventory

### Backend unit tests (`Tests/backend/`)

| File | What it covers |
|------|----------------|
| `checkoutPricing.test.ts` | Volume discounts, shipping rules, PayPal checkout pricing |
| `clientIp.test.ts` | Client IP extraction, anonymization, Cloudflare headers |
| `orderTokens.test.ts` | Order access token generation and validation |
| `paypalWebhookUtils.test.ts` | PayPal webhook payload parsing helpers |
| `refundIdempotency.test.ts` | Refund request deduplication |
| `adminAnalyticsCache.test.ts` | Admin analytics cache keys and TTL |
| `salesAnalytics.test.ts` | Analytics period parsing and CSV export helpers |
| `keepAlive.test.ts` | Supabase pooler keep-alive connection options |

### API tests (`Tests/api/`)

| File | What it covers |
|------|----------------|
| `health.test.ts` | `GET /api/health` — status and dependencies |
| `security.test.ts` | CSRF protection, CORS, rate limiting |
| `checkout.test.ts` | `POST /api/paypal/create-payment` validation and edge cases |
| `orders.test.ts` | Order lookup routes, deprecated endpoints |
| `adminEnhancements.test.ts` | Low-stock, inventory movements, customer PATCH, bulk stock, order edits, analytics period |
| `adminAnalytics.test.ts` | Admin analytics API |
| `productsSearch.test.ts` | Product search API |

API tests use `Tests/helpers/http.ts` for CSRF token flow with Supertest.

### Frontend E2E smoke (`Tests/frontend/`)

| File | What it covers |
|------|----------------|
| `storefront.spec.ts` | Home page, products page, checkout route, contact page render |

Individual smoke cases:

1. **Home** — `#root` visible, title matches `/Lab Door/i`
2. **Products** — `/products` loads
3. **Checkout** — `/checkout` loads; checkout/cart/empty text visible
4. **Contact** — `/contact` loads

---

## Configuration reference

| Concern | Config file | Notes |
|---------|-------------|--------|
| Vitest include paths | `backend/vitest.config.ts` | `Tests/backend/**/*.test.ts`, `Tests/api/**/*.test.ts` |
| Vitest setup / mocks | `Tests/setup.ts` | Mocks `../backend/src/lib/db`, Redis, idempotency |
| Test env vars | `backend/vitest.config.ts` | Fake JWT, PayPal sandbox keys, admin credentials for tests |
| Playwright | `Tests/playwright.config.ts` | `testDir: ./frontend`, preview on port **4173**, `PLAYWRIGHT=true` on webServer, `workers: 1`, `retries: 1` |
| Frontend npm scripts | `frontend/package.json` | `test:e2e` → `npm run test:frontend --prefix ../Tests` |
| Root npm scripts | `package.json` | `test`, `test:backend`, `test:api`, `test:frontend`, `test:all` |

Import paths in test files use `../../backend/src/...` (tests live outside `backend/` but import backend source).

---

## CI pipeline

GitHub Actions (`.github/workflows/ci.yml`) on push/PR to `main`/`master`:

| Job | Steps |
|-----|-------|
| backend | `npm ci`, build, Vitest (`npm test`) |
| frontend | env validation, build with production secrets, `Tests/` npm ci, Playwright install, E2E smoke |
| sitemap | live API sitemap with product requirement |
| links | documentation link check |

**Required GitHub secrets:** `PRODUCTION_API_BASE_URL`, `VITE_SENTRY_DSN`, `DATABASE_URL` (keep-alive workflow).

CI is the exception to the “only run when asked” rule — it always validates on merge paths.

---

## Build verification

```bash
cd backend && npm run build
cd frontend && npm run build   # strict env only in CI/production
```

**Strict env validation** is skipped locally unless `CI=true` or `NODE_ENV=production`.

---

## Health verification

With the backend running locally:

```bash
curl http://localhost:5000/api/health
```

Expect `success: true` with database and Redis status.

---

## Manual QA checklists

| Checklist | Focus |
|-----------|-------|
| [RESPONSIVE_QA_CHECKLIST.md](RESPONSIVE_QA_CHECKLIST.md) | Mobile/tablet/desktop layouts |
| [FORMS_QA_CHECKLIST.md](FORMS_QA_CHECKLIST.md) | Forms, CSRF, validation |

---

## Manual test flows

### Storefront

1. Browse products, search, filter
2. Add to cart, adjust quantities
3. Proceed to checkout, fill shipping form; accept no-refund / replacement-only policy checkbox
4. Apply valid/invalid coupon codes
5. Complete PayPal sandbox payment; verify **409** processing UI if reconciliation lags; verify expired `code` error path
6. Verify confirmation email and order lookup (`?code=` link; legacy URL token deprecation)
7. Cart validation retry; review eligibility on email blur; contact form activity event (with consent)

### Admin

1. Login at `/admin/login`
2. View analytics tab — change period, export CSV, confirm sales/inventory panels
3. Create/edit a product (SKU, reorder point, cost price); view inventory movement history; use low-stock filter; bulk stock delta
4. View and update an order (status, tracking, customer details on pending orders)
5. Search customers, edit admin notes
6. Send shipping notification
7. Cancel an **unpaid pending** test order (paid orders return 403 — no refund)
8. Read and archive contact messages

### PayPal webhooks

Use ngrok to expose local backend, configure PayPal sandbox webhook, trigger capture/refund events.

See [PAYPAL_TESTING_GUIDE.md](PAYPAL_TESTING_GUIDE.md).

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Cannot find module '@playwright/test'` | Run `npm install` in `Tests/`; run Playwright via `Tests/` scripts, not mixed with frontend’s old duplicate install |
| Playwright browser download fails (SSL) | Run `npm run test:frontend:install` from `Tests/` on a network that can reach Playwright CDN; corporate proxies may need `NODE_TLS_REJECT_UNAUTHORIZED=0` for install only |
| E2E fails immediately | Ensure `cd frontend && npm run build` completed; preview serves `dist/` |
| Vitest import errors | Run tests from `backend/`; paths assume monorepo layout `LabDoor_customs/backend` + `LabDoor_customs/Tests` |
| Port 4173 in use | Stop other preview servers or set `reuseExistingServer: true` (default locally when `CI` is unset) |
| Corporate VPN / Zscaler blocks Supabase | `npm run dev` may show `ENOTFOUND` for `db.*.supabase.co`; health returns **503 DEGRADED**; DB routes fail until off VPN or allowlisted |
| `npm run build` fails env validation locally | Set `VITE_API_BASE_URL`, `VITE_SITE_URL`, `VITE_SENTRY_DSN` in `frontend/.env`, or use `NODE_ENV=development` for a non-strict local build |
| `build:budget` JS over limit | Admin dashboard bundle grew — see [`PERFORMANCE_BASELINE.md`](PERFORMANCE_BASELINE.md); budget is **1.4 MB** raw JS in `dist/assets` |

---

## Adding new tests

1. **Backend unit** — add `Tests/backend/yourFeature.test.ts`; import from `../../backend/src/...`
2. **API** — add `Tests/api/yourRoute.test.ts`; use `Tests/helpers/http.ts` for authenticated/CSRF requests
3. **Frontend E2E** — add `Tests/frontend/yourFlow.spec.ts`; follow patterns in `storefront.spec.ts`

Keep mocks in `Tests/setup.ts` when new tests need shared DB/Redis stubs. Run the relevant suite **only when explicitly validating** your change.

---

## Related documentation

| Document | Topic |
|----------|--------|
| [info.md](info.md) | Full project reference |
| [PAYPAL_TESTING_GUIDE.md](PAYPAL_TESTING_GUIDE.md) | PayPal sandbox and webhooks |
| [RESPONSIVE_QA_CHECKLIST.md](RESPONSIVE_QA_CHECKLIST.md) | Manual responsive QA |
| [FORMS_QA_CHECKLIST.md](FORMS_QA_CHECKLIST.md) | Manual forms QA |
| [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) | Full docs index |
