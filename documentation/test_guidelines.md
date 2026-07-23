# Lab Door Customs — Test Guidelines

How to test Lab Door Customs locally, in CI, and manually. This is the single reference for automated tests, manual QA flows, and verification commands.

**Project reference:** [info.md](info.md)

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 10 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; `policy_accepted` required; **Place Order** → `POST /api/checkout/place-order` → WhatsApp redirect (`Order ID` in message = `orders.id` UUID); `X-Idempotency-Key` from `createClientId()` (LAN HTTP safe); incomplete-field toast before submit; checkout email synced to activity on change/blur. |
| **Orders** | `/orders?orderId=` pre-fill from email; `POST /api/orders/lookup` with order ID + email; order details clear on full page reload; in-session refresh while page stays open; lookup failure **Order not found**; legacy access-exchange **410**. |
| **Admin** | Products paginated (load more); **out-of-stock toggle** (`ToggleSwitch`, optimistic `PUT /api/products/:id`); inventory (movements, low-stock at 5 units, bulk stock delta); analytics periods + CSV export (sales by product); customer search/notes; order customer-details + pending-item edits; **Settings** tab (activity export, sessions, customer recompute); coupon scope (`all` / product IDs); estimated delivery; session verify **10s** in-memory cache; error/retry states. |
| **Activity** | Consent-gated batch; `contact_submit` on contact success; IPs anonymized with `IP_SALT`. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA + policy spacer; whole-number shoe sizes; LAN checkout via `createClientId`; non-home nav **Orders** + **Cart** only; Playwright **responsive-pages-ui** (11 phone viewports incl. 320px) + **viewport overflow audit** in `npm test`; OOS hides product sticky bar; admin product cards on phones; `100dvh` + safe-area insets. |

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
| Backend unit | Vitest | `Tests/unit/backend/` | 35 files, 141 tests | No (mocked) |
| API integration | Vitest + Supertest | `Tests/integration/api/` | 21 files, 86 tests | No (mocked) |
| Frontend unit | Vitest + RTL | `Tests/unit/frontend/` | 3 files, 13 tests | No |
| Frontend E2E / UI | Playwright | `Tests/e2e/specs/` | 24 files, 286 tests (93 desktop + 193 mobile project) | No (mocked `/api` + static preview) |
| Viewport overflow audit | Playwright script | `Tests/scripts/audit-viewport-overflow.mjs` | 12 widths × 16 routes | No (static preview) |
| Link checker | Custom script | repo root | — | No |
| Codebase audit | `scripts/audit-codebase.mjs` | `documentation/OPTIMIZATION_BASELINE.md` | — | No |

**Total:** 528 automated tests — 138 backend unit + 86 API + 13 frontend unit + 286 Playwright UI (93 desktop chromium + 193 mobile-chrome) + 5 viewport. **`npm test`** also runs the viewport overflow audit (mandatory in CI).

**Layout reference:** [`Tests/README.md`](../Tests/README.md)

Backend unit tests include: payment idempotency, order tokens, order token encryption, **admin credentials** (`adminCredentials.test.ts` — primary + `ADMIN_ADDITIONAL_USERS`), **cart line size validation** (`cartLineSize.test.ts` — whole-number UK/US/EU sizes), **product public_id** URL helpers, product image validation, admin session hashing, checkout pricing, **WhatsApp message formatting** (`whatsappCheckout.test.ts` — totals, volume/coupon lines, size, free shipping, URL encoding), **WhatsApp payment confirmation** (`whatsappNotifications.test.ts`, `postPaymentCapture.test.ts`), **contact form WhatsApp helpers** (`contactWhatsAppMessage.test.ts`), **DB query concurrency** (`dbConcurrency.test.ts` — global semaphore + `runWithConcurrency`), **sql tag deferred execution** (`infrastructure/dbSqlWrapper.test.ts` — nested fragments, `.cursor()`), coupon scope (`applies_to` all/product), `computeCheckoutPricingForCart`, RLS table list + bootstrap contract, RLS grant revoke under `BOOTSTRAP_SKIP_DDL`, order portal URL (`buildOrderPortalUrl` in `orderPortalUrl.ts`), client IP, keep-alive, **production env validation** (`infrastructure/validateEnv.test.ts` — spawns `validate-env.mjs`, pooler port 6543, Redis/Sentry/auth secrets), **checkout client id** (`clientId.test.ts` — UUID fallback when `crypto.randomUUID` unavailable), **admin analytics IST date helpers** (`adminAnalyticsDates.test.ts`), **sales analytics date coercion** (`analytics/salesAnalytics.test.ts` — invalid DB timestamps), **build performance budgets** (`performanceBudgets.test.ts`), **sales analytics** invalid custom-date fallback.

API tests include: **place-order** checkout (validation — `place-order.validation.test.ts`; **WhatsApp integration** — `place-order.whatsapp.test.ts`), **order lookup/tracking** (`orders/lookup.test.ts` — validation, UUID, case-insensitive email, shipped tracking, deprecated access-exchange 410, admin-only GET by id), admin mark-paid (`orders/mark-paid.test.ts`), **WhatsApp payment confirmation** (`orders/whatsapp-payment-confirmation.test.ts`), **admin analytics**, **admin enhancements**, **admin session verify cache** (`admin/session-verify-cache.test.ts` — 10s TTL, logout invalidation, concurrent verifyAdmin), **products search**, **product upload persistence** (`products/upload-persistence.test.ts` — `UPLOAD_DIR` volume survives simulated redeploy), **validate-cart**, **stability/concurrency smoke**, no-refund policy (`orders/order-policy-admin.test.ts`), health, orders routes, security, activity batch/log.

Frontend unit tests (`Tests/unit/frontend/`, Vitest + React Testing Library, jsdom): **ToggleSwitch** (accessibility, keyboard, loading), **whatsappContact** (validation, `wa.me` URLs), **productCatalogCache** (normalize, catalog-cleared event). Config: `frontend/vitest.config.ts` (`NODE_ENV=test` for React 19 `act`). Run: `npm run test:frontend-unit`.

Backend unit tests also cover: **sales analytics** period parsing + CSV export, **admin analytics cache** keys/TTL, inventory movement helpers (via integration paths), payment idempotency, order tokens, RLS, email portal URL, and related order utilities.

Playwright specs live under `Tests/e2e/specs/` by domain (storefront, checkout, orders, contact, admin, responsive, regression). Shared helpers: `Tests/e2e/helpers/` (`viewports.ts`, `responsive.ts`, `checkout.ts`, `mock-api.ts`). Product IDs: `Tests/shared/fixtures/products.ts` via `Tests/e2e/fixtures/mock-data.ts`. The storefront fixture warms `/api/csrf-token` on load.

---

## Folder structure

```
Tests/
├── README.md              # Suite layout and conventions
├── setup.ts               # Shared Vitest mocks (DB, Redis, idempotency)
├── shared/
│   ├── fixtures/products.ts
│   └── helpers/           # http.ts, adminAuth.ts, api/checkout.ts, api/orders.ts
├── unit/
│   ├── backend/          # Backend unit tests by domain (auth, checkout, orders, …)
│   └── frontend/         # React component + client lib tests (Vitest + RTL)
├── integration/api/       # HTTP API tests by domain (checkout, orders, admin, …)
├── e2e/
│   ├── fixtures/          # Playwright storefront + admin fixtures
│   ├── helpers/           # mock-api, checkout, responsive, viewports
│   └── specs/             # Playwright specs by domain
├── scripts/
│   ├── run-with-report.mjs
│   ├── run-viewport-audit.mjs
│   └── audit-viewport-overflow.mjs
└── playwright.config.ts
```

All automated tests live under **`Tests/`** (`unit/`, `integration/`, `e2e/`). See [`Tests/README.md`](../Tests/README.md).

---

## Prerequisites

### Backend / API (Vitest)

```bash
npm install            # from repository root (workspaces)
npm test
```

No running server or database required. `Tests/setup.ts` mocks Postgres, Redis, and idempotency storage. Checkout and cart API tests use **`Tests/shared/fixtures/products.ts`** for DB-shaped product rows and `product_id` values (see [Product catalog fixtures](#product-catalog-fixtures) below).

### Frontend E2E (Playwright)

```bash
npm install            # from repository root
npm run build -w frontend   # Playwright serves frontend/dist via Vite preview

cd Tests
npm install
npm run test:frontend:install   # first time only — downloads Chromium
npm run test:frontend
```

Playwright starts `vite preview` on `http://127.0.0.1:4173` automatically (see `playwright.config.ts`). Preview sets `PLAYWRIGHT=true` so Vite **does not proxy** `/api` to a live backend — all API traffic is mocked in-browser via `page.route()`. The backend does **not** need to be running. Set `VITE_WHATSAPP_CONTACT_NUMBER` in `frontend/.env` to your store's WhatsApp number so local `npm run preview` and contact E2E match the test runner without extra setup.

**UI coverage:** products list/detail, cart, checkout shell, contact form, navigation, cookie consent, **admin analytics custom range**, **admin dashboard module E2E** (`Tests/e2e/specs/admin/*.spec.ts` — products, coupons, orders, customers, settings, integration, resilience, env-validation, storage-persistence), **responsive mobile layouts** (`mobile-ui.spec.ts`, `responsive-ui.spec.ts`, and **`responsive-pages-ui.spec.ts`** — all routes × 11 phone viewports in the `mobile-chrome` project), **WhatsApp place-order** (`checkout-place-order-ui.spec.ts`), checkout policy/coupon flows in **deep flows**. Playwright uses `workers: 1` and `retries: 1` for stable checkout flows.

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

**Locations:** `Tests/unit/backend/` and `Tests/integration/api/`

| Suite | Coverage |
|-------|----------|
| `backend/` | Payment idempotency, checkout pricing, WhatsApp checkout, order tokens, client IP |
| `api/` | Health, place-order checkout, orders, security |

API tests mock the database layer for fast isolated runs.

### Frontend (Playwright)

```bash
npm run build -w frontend   # optimize-assets → sitemap → vite build → build:budget
npm run measure:dist -w frontend   # optional size report
cd Tests && npm run test:frontend:install   # first time only
npm run test:frontend                       # from repository root
```

**Location:** `Tests/e2e/specs/storefront/storefront.spec.ts`

Playwright serves the built `dist/` via Vite preview (no backend required for smoke tests).

### Link checker

```bash
npm run links:check   # from repo root
npm run audit:codebase   # depcheck + legacy scan → documentation/OPTIMIZATION_BASELINE.md
```

Validates internal links in documentation markdown files.

### Form accessibility audit (frontend source)

Static check that every visible `<input>`, `<select>`, and `<textarea>` in `frontend/src` has an associated label (`htmlFor`, wrapping `<label>`, or `aria-label`):

```bash
node frontend/scripts/audit-form-labels.mjs   # from repository root
```

Expect `count 0`. Complements manual Chrome DevTools **Issues** checks in [`FORMS_QA_CHECKLIST.md`](FORMS_QA_CHECKLIST.md).

### Frontend performance (build)

Production frontend builds run `optimize-assets` (WebP from source PNGs) and `build:budget` (fails if `dist/assets` exceeds limits). See [`PERFORMANCE_BASELINE.md`](PERFORMANCE_BASELINE.md).

---

## Test inventory

### Backend unit tests (`Tests/unit/backend/`)

Organized by domain: `auth/`, `checkout/`, `contact/`, `coupons/`, `orders/`, `products/`, `analytics/`, `infrastructure/` (incl. `validateEnv.test.ts`, `keepAlive.test.ts`, `performanceBudgets.test.ts`). Key files: `checkout/checkoutPricing.test.ts`, `checkout/whatsappCheckout.test.ts`, `contact/contactWhatsAppMessage.test.ts`, `orders/orderPortalUrl.test.ts`, `infrastructure/dbConcurrency.test.ts`.

See `Tests/unit/backend/` for the full list (35 files, 141 tests).

### API tests (`Tests/integration/api/`)

Organized by domain: `checkout/` (`place-order.validation.test.ts`, `place-order.whatsapp.test.ts`, `validate-cart.test.ts`), `orders/` (`lookup.test.ts`, `mark-paid.test.ts`, `notify-shipped.test.ts`, `order-policy-admin.test.ts`, `whatsapp-payment-confirmation.test.ts`), `admin/` (`analytics.test.ts`, `enhancements.test.ts`, `login.test.ts`, `session-verify-cache.test.ts`), `products/` (`search.test.ts`, `upload.test.ts`, `upload-persistence.test.ts`), `activity/`, `security/`, plus `health.test.ts`.

See `Tests/integration/api/` for the full list (21 files, 86 tests).

API tests use `Tests/shared/helpers/http.ts` for CSRF token flow with Supertest.

### Frontend unit tests (`Tests/unit/frontend/`)

Vitest + React Testing Library (jsdom). Config: `frontend/vitest.config.ts`, setup: `Tests/unit/frontend/setup.ts`.

| File | Coverage |
|------|----------|
| `components/ToggleSwitch.test.tsx` | Admin out-of-stock switch — `role="switch"`, keyboard, loading |
| `lib/whatsappContact.test.ts` | Contact validation, `wa.me` URL building |
| `lib/productCatalogCache.test.ts` | `normalizeProduct`, `ldc:catalog-cleared` event |

Run: `npm run test:frontend-unit` (13 tests across 3 files).

### Frontend E2E / UI (`Tests/e2e/specs/`)

Organized by domain: `storefront/`, `checkout/`, `orders/`, `contact/`, `admin/`, `responsive/`, `regression/`. Key specs: `storefront/storefront.spec.ts`, `contact/contact-ui.spec.ts`, `responsive/responsive-pages-ui.spec.ts` (193 mobile-chrome tests).

See `Tests/e2e/specs/` for the full list (24 files, 286 tests across desktop + mobile Playwright projects).

Individual smoke cases (`storefront.spec.ts`):

1. **Home** — `#root` visible, title matches `/Lab Door/i`
2. **Products** — `/products` loads
3. **Checkout** — `/checkout` loads; checkout/cart/empty text visible
4. **Contact** — `/contact` loads
5. **Shipping policy** — `/shipping-policy` shows $25 / $200 rates (not legacy $100 tiers)
6. **Document scroll** — tall policy pages scroll (`window.scrollY > 0` after programmatic scroll)

---

## Configuration reference

| Concern | Config file | Notes |
|---------|-------------|--------|
| Vitest include paths | `backend/vitest.config.ts` | `Tests/unit/backend/**/*.test.ts`, `Tests/integration/api/**/*.test.ts` |
| Frontend Vitest | `frontend/vitest.config.ts` | `Tests/unit/frontend/**/*.{test,spec}.{ts,tsx}`, jsdom + RTL setup |
| Vitest setup / mocks | `Tests/setup.ts` | Mocks `../backend/src/lib/db`, Redis, idempotency |
| Test env vars | `backend/vitest.config.ts` | Fake JWT, WhatsApp phone, admin credentials for tests |
| Playwright | `Tests/playwright.config.ts` | `testDir: ./e2e/specs`, preview on port **4173**, `reuseExistingServer` when `PLAYWRIGHT_FORCE_NEW_SERVER` is unset; projects: `chromium`, `mobile-chrome`; `workers: 1`, `retries: 1` |
| Viewport audit | `Tests/scripts/run-viewport-audit.mjs` | Starts preview if needed; runs `audit-viewport-overflow.mjs` (included in `npm test`) |
| Frontend npm scripts | `frontend/package.json` | `test` (Vitest), `test:e2e` → Playwright via `Tests/` |
| Root npm scripts | `package.json` | `test`, `test:backend`, `test:api`, `test:frontend-unit`, `test:frontend`, `test:all` |

Import paths in test files use `../../backend/src/...` (tests live outside `backend/` but import backend source).

### Product catalog fixtures

Vitest API/backend tests mock Postgres via `sqlMock` in `Tests/setup.ts`. Do **not** hardcode `product_id: 1` for checkout or cart tests — use the shared catalog in **`Tests/shared/fixtures/products.ts`**, which mirrors real `products` table rows (SERIAL ids such as `10042`, `10104`).

| Export | Purpose |
|--------|---------|
| `TEST_PRODUCTS` | Named rows (`nikeBlue`, `checkoutShoe`, `soldOutShoe`, …) with `id`, `name`, `price`, `stock`, `is_out_of_stock` |
| `TEST_PRODUCT_IDS` | Stable id constants shared with Playwright mocks |
| `cartLine(product, qty?)` | `{ product_id: product.id, quantity }` for request bodies |
| `installProductCatalogMock(sqlMock)` | Routes `SELECT … FROM products WHERE id = ?` through the in-memory catalog |
| `mockProductDbLookup(sqlMock, product)` | One-shot mock for a single product lookup; returns the row’s `id` |

Playwright reuses the same ids via `Tests/e2e/fixtures/mock-data.ts` (`PRIMARY_MOCK_PRODUCT`, `MOCK_PRODUCTS`). Product detail URLs in UI tests use `` `/product/${TEST_PRODUCT_IDS.nikeBlue}` `` rather than `/product/1`.

---

## CI pipeline

GitHub Actions (`.github/workflows/ci.yml`) on push/PR to `main`/`master`:

| Job | Steps |
|-----|-------|
| monorepo | `npm ci`, build, **`npm test`** (backend unit + API + frontend unit + Playwright + viewport audit) |
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
| [manual-qa-test-cases.md](manual-qa-test-cases.md) | **Full-stack manual QA** — test suite review, detailed cases (AUTH/SF/CHK/ADM/*), release regression checklist |
| [manual-qa-test-cases.csv](manual-qa-test-cases.csv) | Same manual cases in CSV for Excel/Sheets execution tracking (Status, Bug, Priority, Impact) |
| [RESPONSIVE_QA_CHECKLIST.md](RESPONSIVE_QA_CHECKLIST.md) | Mobile/tablet/desktop layouts |
| [FORMS_QA_CHECKLIST.md](FORMS_QA_CHECKLIST.md) | Forms, CSRF, validation, **form accessibility** (id/name, labels, Chrome DevTools Issues) |

---

## Manual test flows

### Storefront

1. Browse products, search, filter
2. Add to cart, adjust quantities
3. Proceed to checkout, fill shipping form; accept no-refund / replacement-only policy checkbox
4. Spot-check `/terms-of-service` — **Governing Law** references **Punjab, India**
5. Apply valid/invalid coupon codes
6. Click **Place Order**; verify WhatsApp redirect (or mocked URL in E2E); admin **Mark paid** in dashboard
7. Verify WhatsApp confirmation (when Cloud API configured) and order lookup (`/orders?orderId=` pre-fill + email)
8. Cart validation retry; contact form opens WhatsApp with prefilled message + `contact_submit` activity (with consent)

### Admin

1. Login at `/admin/login` (or visit `/admin` — redirects based on session)
2. View analytics tab — change period, export CSV, confirm sales/inventory panels (use `npm run seed:test-data` for realistic date ranges)
3. Search customers/orders with `test` to isolate seeded QA rows (`GSS-TEST-SEED-*` order numbers)
3. Create/edit a product (one listing per shoe; cost price optional); view inventory movement history; use low-stock filter (≤5 units); bulk stock delta
4. View and update an order (status, tracking, customer details on pending orders)
5. Search customers, edit admin notes; open **View History** and paginate orders (10/page)
6. Send shipping notification
7. Cancel an **unpaid pending** test order (paid orders return 403 — no refund)

### WhatsApp checkout (manual)

Place a test order on staging/production; confirm WhatsApp message **Order ID** matches `orders.id` (UUID); mark paid in admin.

**Automated coverage:** `unit/backend/checkout/whatsappCheckout.test.ts`, `integration/api/checkout/place-order.whatsapp.test.ts`, `place-order.validation.test.ts`, `e2e/specs/checkout/checkout-place-order-ui.spec.ts` — see [Product catalog fixtures](#product-catalog-fixtures).

See [WHATSAPP_CHECKOUT_GUIDE.md](WHATSAPP_CHECKOUT_GUIDE.md).

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Cannot find module '@playwright/test'` | Run `npm install` in `Tests/`; run Playwright via `Tests/` scripts, not mixed with frontend’s old duplicate install |
| Playwright browser download fails (SSL) | Run `npm run test:frontend:install` from `Tests/` on a network that can reach Playwright CDN; corporate proxies may need `NODE_TLS_REJECT_UNAUTHORIZED=0` for install only |
| E2E fails immediately | Ensure `cd frontend && npm run build` completed; preview serves `dist/` |
| Vitest import errors | Run tests from `backend/`; paths assume monorepo layout `LabDoor_customs/backend` + `LabDoor_customs/Tests` |
| Port 4173 in use | Run Playwright directly (`npx playwright test` from `Tests/`) — reuses a healthy preview when `PLAYWRIGHT_FORCE_NEW_SERVER` is unset. After `npm run test:frontend`, the runner sets `PLAYWRIGHT_FORCE_NEW_SERVER=true` so a fresh build is served. Stop stale preview processes if reuse fails. |
| Corporate VPN / Zscaler blocks Supabase | `npm run dev` may show `ENOTFOUND` for `db.*.supabase.co`; health returns **503 DEGRADED**; DB routes fail until off VPN or allowlisted |
| `npm run build` fails env validation locally | Set `VITE_API_BASE_URL`, `VITE_SITE_URL`, `VITE_SENTRY_DSN` in `frontend/.env`, or use `NODE_ENV=development` for a non-strict local build |
| `build:budget` JS over limit | Admin dashboard bundle grew — see [`PERFORMANCE_BASELINE.md`](PERFORMANCE_BASELINE.md); budget is **1.4 MB** raw JS in `dist/assets`. Playwright test builds omit `VITE_SENTRY_DSN` (placeholder DSN adds ~130 KB); production CI must still set a real DSN. |

---

## Adding new tests

1. **Backend unit** — add `Tests/unit/backend/{domain}/yourFeature.test.ts`; import from `../../../../backend/src/...`
2. **API** — add `Tests/integration/api/{domain}/yourRoute.test.ts`; use `Tests/shared/helpers/http.ts` for CSRF; reuse `placeOrderPayload()` / `mockOrderRow()` from `Tests/shared/helpers/api/`
3. **Frontend E2E** — add `Tests/e2e/specs/{domain}/yourFlow.spec.ts`; extend `e2e/fixtures/storefront.ts`; seed carts with `PRIMARY_MOCK_PRODUCT.id` from `mock-data.ts`

Keep mocks in `Tests/setup.ts` when new tests need shared DB/Redis stubs. Run the relevant suite **only when explicitly validating** your change.

---

## Related documentation

| Document | Topic |
|----------|--------|
| [info.md](info.md) | Full project reference |
| [WHATSAPP_CHECKOUT_GUIDE.md](WHATSAPP_CHECKOUT_GUIDE.md) | WhatsApp checkout and admin payment confirmation |
| [manual-qa-test-cases.md](manual-qa-test-cases.md) | Full-stack manual QA test cases + release checklist |
| [RESPONSIVE_QA_CHECKLIST.md](RESPONSIVE_QA_CHECKLIST.md) | Manual responsive QA |
| [FORMS_QA_CHECKLIST.md](FORMS_QA_CHECKLIST.md) | Manual forms QA |
| [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) | Full docs index |
