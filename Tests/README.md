# Lab Door Customs — Test Suite

Organized test layout for the monorepo. **668 automated tests** (143 backend unit + 88 API + 13 frontend unit + 423 Playwright + 1 viewport) plus a **viewport overflow audit** gate — run from repo root with `npm test`.

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
| `chromium` | 23 specs | 195 | Desktop smoke and flows (incl. **59** admin module tests in `e2e/specs/admin/`) |
| `mobile-chrome` | 3 specs | 228 | 11 viewports × routes matrix (`responsive-pages-ui`, `responsive-ui`, `mobile-ui`) — incl. sticky-CTA hint overlap + long-name hero overflow guards |

## Playwright MCP (interactive exploration)

`.mcp.json` at the repo root registers the [Playwright MCP](https://github.com/microsoft/playwright-mcp) server so an agent can drive a **real Chromium browser** to explore scenarios the static specs don't yet cover — reproducing a mobile layout bug live, snapshotting the accessibility tree, or scripting a new flow before committing it as a spec.

```jsonc
// .mcp.json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--browser=chromium",
               "--device=Pixel 5", "--isolated", "--output-dir=Tests/test-results/mcp"]
    }
  }
}
```

- `--device=Pixel 5` mirrors the `mobile-chrome` project so exploration matches the automated matrix.
- `--isolated` keeps no browser profile on disk between runs.
- Screenshots / traces land in `Tests/test-results/mcp/`.

**Workflow:** start the preview server (`npm run build -w frontend && npm run preview -w frontend -- --port 4173 --host 127.0.0.1`), navigate the MCP browser to `http://127.0.0.1:4173`, reproduce the scenario, then codify anything worth keeping as a spec in `e2e/specs/` (reusing `seedCart`, `assertVisibleAboveStickyRegion`, and `POPULAR_MOBILE_VIEWPORTS`). MCP is for discovery; the committed Playwright specs remain the source of truth for CI.

> The server tools become available after the MCP server is approved in a new agent session; they are not part of the `npm test` gate.

## Related docs

- [`documentation/test_guidelines.md`](../documentation/test_guidelines.md) — full inventory and QA checklists
- [`documentation/COVERAGE_MATRIX.md`](../documentation/COVERAGE_MATRIX.md) — behavior → test mapping
