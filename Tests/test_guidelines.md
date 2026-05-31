# Lab Door Customs — Test Guidelines

How to test Lab Door Customs locally, in CI, and manually. This is the single reference for automated tests, manual QA flows, and verification commands.

**Project reference:** [info.md](../info.md)

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
| Backend unit | Vitest | `Tests/backend/` | 6 files | No (mocked) |
| API integration | Vitest + Supertest | `Tests/api/` | 4 files | No (mocked) |
| Frontend E2E smoke | Playwright | `Tests/frontend/` | 1 file, 4 tests | No (static preview) |
| Link checker | Custom script | repo root | — | No |

**Total:** 54 Vitest tests + 4 Playwright smoke tests.

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
├── frontend/            # Storefront E2E smoke tests (Playwright)
├── test-results/        # Timestamped reports (generated; gitignored)
├── scripts/
│   └── run-with-report.mjs  # Runs tests and writes reports
├── playwright.config.ts # Playwright config (preview server on port 4173)
└── package.json         # Playwright dependency + frontend test scripts
```

Legacy paths **`backend/tests/`** and **`frontend/e2e/`** were removed; all automated tests live under **`Tests/`**.

---

## Prerequisites

### Backend / API (Vitest)

```bash
cd backend
npm install
```

No running server or database required. `Tests/setup.ts` mocks Postgres, Redis, and idempotency storage.

### Frontend E2E (Playwright)

```bash
cd frontend
npm install
npm run build          # required — Playwright serves frontend/dist via Vite preview

cd ../Tests
npm install
npm run test:frontend:install   # first time only — downloads Chromium
```

Playwright starts `vite preview` on `http://127.0.0.1:4173` automatically (see `playwright.config.ts`). The backend does **not** need to be running for smoke tests.

---

## Test reports (`Tests/test-results/`)

Each report-enabled test run writes a **fresh report** when the run **completes**. Files use the completion timestamp:

| File | Example |
|------|---------|
| Markdown report | `report-2026-05-30_23-45-12.md` |
| JSON summary | `report-2026-05-30_23-45-12.json` |

Reports include:

- Overall pass/fail and exit code
- Per-suite summary (Vitest, Playwright)
- Every test case with pass/fail status, file, and duration
- **Failure logs** — full error messages and stack traces for failed cases
- Command stderr/stdout snippets when useful for debugging
- Git branch/commit and Node environment

Generated reports are **gitignored**; only `Tests/test-results/README.md` is tracked.

`npm test`, `test:unit`, `test:api`, `test:frontend`, and `test:all` all generate reports. Use `test:watch` (Vitest) or `test:raw` / `test:frontend:raw` to run **without** writing a report.

---

## How to run automated tests

Run these **only when you or the user explicitly want verification**.

### From repo root

```bash
npm run test              # Backend unit + API (54 tests)
npm run test:backend      # Backend unit only
npm run test:api          # API tests only
npm run test:frontend     # Playwright smoke (frontend must be built first)
npm run test:all          # Vitest + Playwright
```

### Backend (Vitest)

```bash
cd backend
npm test                  # All Vitest tests (backend + api)
npm run test:watch        # Watch mode
npm run test:unit         # Tests/backend only
npm run test:api          # Tests/api only
```

**Locations:** `Tests/backend/` and `Tests/api/`

| Suite | Coverage |
|-------|----------|
| `backend/` | PayPal webhook utils, refund idempotency, checkout pricing, order tokens, client IP |
| `api/` | Health, checkout validation, orders, security |

API tests mock the database layer for fast isolated runs.

### Frontend (Playwright)

```bash
cd frontend
npm run build
npm run test:e2e:install  # first time only
npm run test:e2e          # Delegates to Tests/
```

Or directly from `Tests/`:

```bash
cd Tests
npm run test:frontend
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
| [RESPONSIVE_QA_CHECKLIST.md](../documentation/RESPONSIVE_QA_CHECKLIST.md) | Mobile/tablet/desktop layouts |
| [FORMS_QA_CHECKLIST.md](../documentation/FORMS_QA_CHECKLIST.md) | Forms, CSRF, validation |

---

## Manual test flows

### Storefront

1. Browse products, search, filter
2. Add to cart, adjust quantities
3. Proceed to checkout, fill shipping form
4. Apply valid/invalid coupon codes
5. Complete PayPal sandbox payment
6. Verify confirmation email and order lookup

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

See [PAYPAL_TESTING_GUIDE.md](../documentation/PAYPAL_TESTING_GUIDE.md).

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
| [info.md](../info.md) | Full project reference |
| [documentation/PAYPAL_TESTING_GUIDE.md](../documentation/PAYPAL_TESTING_GUIDE.md) | PayPal sandbox and webhooks |
| [documentation/RESPONSIVE_QA_CHECKLIST.md](../documentation/RESPONSIVE_QA_CHECKLIST.md) | Manual responsive QA |
| [documentation/FORMS_QA_CHECKLIST.md](../documentation/FORMS_QA_CHECKLIST.md) | Manual forms QA |
| [documentation/DOCUMENTATION_INDEX.md](../documentation/DOCUMENTATION_INDEX.md) | Full docs index |
