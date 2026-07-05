# Lab Door Customs — Test Suite

Organized test layout for the monorepo. **515 automated tests** (138 backend unit + 78 API + 13 frontend unit + 286 Playwright) plus a **viewport overflow audit** gate — run from repo root with `npm test`.

## Directory layout

```
Tests/
├── setup.ts                 # Global Vitest mocks (DB, Redis, idempotency)
├── shared/                  # Cross-suite fixtures and helpers
│   ├── fixtures/products.ts # Catalog rows + sqlMock installers
│   └── helpers/
│       ├── http.ts          # CSRF agent helpers (API tests)
│       ├── adminAuth.ts     # Signed admin session tokens
│       └── api/
│           ├── checkout.ts  # placeOrderPayload() factory
│           └── orders.ts    # mockOrderRow() factory
├── unit/
│   ├── backend/            # Pure backend logic (Vitest, mocked DB)
│   └── frontend/           # React components + client libs (Vitest + RTL, jsdom)
│   ├── auth/
│   ├── checkout/
│   ├── contact/
│   ├── coupons/
│   ├── orders/
│   ├── products/
│   ├── analytics/
│   └── infrastructure/
├── integration/api/         # HTTP API tests (Vitest + supertest, mocked DB)
│   ├── checkout/
│   ├── orders/
│   ├── admin/
│   ├── products/
│   ├── activity/
│   ├── security/
│   └── health.test.ts
├── e2e/                     # Playwright UI tests (mocked API + static preview)
│   ├── fixtures/            # storefront + admin test fixtures
│   ├── helpers/             # checkout, responsive, mock-api utilities
│   └── specs/
│       ├── storefront/
│       ├── checkout/
│       ├── orders/
│       ├── contact/
│       ├── admin/
│       ├── responsive/
│       └── regression/
├── scripts/
│   ├── run-with-report.mjs  # Unified runner + markdown reports
│   ├── run-viewport-audit.mjs
│   └── audit-viewport-overflow.mjs
└── playwright.config.ts
```

## How to run

| Command | Scope |
|---------|--------|
| `npm test` | All suites (unit + API + frontend unit + E2E + viewport audit) |
| `npm run audit:codebase` | Optimization baseline → `documentation/OPTIMIZATION_BASELINE.md` |
| `npm run test:backend` | `Tests/unit/backend/` only |
| `npm run test:api` | `Tests/integration/api/` only |
| `npm run test:frontend-unit` | `Tests/unit/frontend/` (Vitest + React Testing Library) |
| `npm run test:frontend` | `Tests/e2e/specs/` (Playwright) + viewport overflow audit |

Reports: `documentation/test-results/` — see [`documentation/test_guidelines.md`](../documentation/test_guidelines.md).

## Conventions

### Naming

| Layer | Pattern | Example |
|-------|---------|---------|
| Unit | `{module}.test.ts` | `checkoutPricing.test.ts` |
| API | `{route}.{aspect}.test.ts` | `place-order.validation.test.ts` |
| E2E | `{area}-ui.spec.ts` or `{area}.spec.ts` | `contact-ui.spec.ts` |

### Grouping

- Use top-level `describe` for the module or route (`POST /api/orders/lookup`).
- Nest `describe` blocks for sub-behaviors (validation, happy path, auth).
- Prefer `it('does X when Y')` over vague names.

### Mocks

- **DB:** `sqlMock` from `Tests/setup.ts` — never hit a real database in unit/API tests.
- **Products:** `installProductCatalogMock(sqlMock)` from `shared/fixtures/products.ts`.
- **CSRF:** `createCsrfAgent()` + `withCsrf()` from `shared/helpers/http.ts`.
- **Admin API:** `createTestAdminToken()` from `shared/helpers/adminAuth.ts`, or mock `verifyAdmin` in route tests.
- **E2E:** `installStorefrontApiMocks()` in `e2e/fixtures/storefront.ts` — static preview on port 4173.

### Adding tests

1. Place the file in the matching domain folder (see layout above).
2. Reuse shared factories (`placeOrderPayload`, `mockOrderRow`, `cartLine`, `TEST_PRODUCTS`).
3. Update [`documentation/test_guidelines.md`](../documentation/test_guidelines.md) if you add a new file or change counts.
4. Run `npm test` before opening a PR.

## Playwright projects

| Project | Files | Tests | Purpose |
|---------|-------|-------|---------|
| `chromium` | 21 specs | 93 | Desktop smoke and flows (incl. **59** admin module tests in `e2e/specs/admin/`) |
| `mobile-chrome` | 3 specs | 193 | 11 viewports × routes matrix (`responsive-pages-ui`, `responsive-ui`, `mobile-ui`) |

## Related docs

- [`documentation/test_guidelines.md`](../documentation/test_guidelines.md) — full inventory and QA checklists
- [`documentation/COVERAGE_MATRIX.md`](../documentation/COVERAGE_MATRIX.md) — behavior → test mapping
