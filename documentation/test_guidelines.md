# Lab Door Customs — Test Guidelines

How to test Lab Door Customs locally, in CI, and manually. This is the single reference for automated tests, manual QA flows, and verification commands.

**Project reference:** [info.md](info.md)

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 13 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; PayPal `?code=` exchange; capture **409** → processing UI; checkout email synced to activity on change/blur. |
| **Orders** | Email links `GET /api/orders/access-exchange/:code`; legacy `?orderNumber=&token=` stripped; partial refresh keeps stale data + warning. |
| **Admin** | Products paginated (load more); messages mark read on open; coupons scope UI; reviews admin response; estimated delivery; error/retry states. |
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
| Backend unit | Vitest | `Tests/backend/` | 13 files, 61 tests | No (mocked) |
| API integration | Vitest + Supertest | `Tests/api/` | 4 files, 16 tests | No (mocked) |
| Frontend E2E / UI | Playwright | `Tests/frontend/` | 8 files, 22 tests | No (mocked `/api` + static preview) |
| Link checker | Custom script | repo root | — | No |

**Total:** 105 automated tests — 67 backend unit + 16 API + 22 Playwright UI (desktop + mobile projects).

Backend unit tests include: payment idempotency, order tokens, checkout exchange hashing, order token encryption, webhook errors, product image validation, admin session hashing, PayPal webhook utils, refund idempotency, checkout pricing, client IP, keep-alive.

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

Playwright starts `vite preview` on `http://127.0.0.1:4173` automatically (see `playwright.config.ts`). The backend does **not** need to be running — UI tests mock `/api/*` via `page.route()` in `Tests/frontend/helpers/mock-api.ts`.

**UI coverage:** products list/detail, cart, checkout shell, contact form, navigation, cookie consent, mobile viewport (`mobile-ui.spec.ts` runs in the `mobile-chrome` project).

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

`npm test` auto-builds the frontend (if needed) and installs Playwright in `Tests/` on first UI run. Use `test:watch` (Vitest) or `test:raw` / `test:frontend:raw` to run **without** writing a report.

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
npm run build -w frontend
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
| `keepAlive.test.ts` | Supabase pooler keep-alive connection options |

### API tests (`Tests/api/`)

| File | What it covers |
|------|----------------|
| `health.test.ts` | `GET /api/health` — status and dependencies |
| `security.test.ts` | CSRF protection, CORS, rate limiting |
| `checkout.test.ts` | `POST /api/paypal/create-payment` validation and edge cases |
| `orders.test.ts` | Order lookup routes, deprecated endpoints |

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
| Playwright | `Tests/playwright.config.ts` | `testDir: ./frontend`, preview on port **4173** |
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
3. Proceed to checkout, fill shipping form
4. Apply valid/invalid coupon codes
5. Complete PayPal sandbox payment; verify **409** processing UI if reconciliation lags; verify expired `code` error path
6. Verify confirmation email and order lookup (`?code=` link; legacy URL token deprecation)
7. Cart validation retry; review eligibility on email blur; contact form activity event (with consent)

### Admin

1. Login at `/admin/login`
2. View analytics tab
3. Create/edit a product
4. View and update an order (status, tracking)
5. Send shipping notification
6. Cancel a test order with refund
7. Read and archive contact messages

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
| Port 4173 in use | Stop other preview servers or set `reuseExistingServer: true` (default locally) |

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
