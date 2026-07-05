# Lab Door Customs — Manual QA Test Cases

**Purpose:** Full-stack manual QA for release regression. Complements **520** automated tests (141 backend unit + 80 API + 13 frontend unit + 286 Playwright + viewport audit).

**Authoritative system reference:** [`info.md`](info.md)  
**Automated test runbook:** [`test_guidelines.md`](test_guidelines.md)  
**Behavior → test map:** [`COVERAGE_MATRIX.md`](COVERAGE_MATRIX.md)

**Recommended QA environment:** Staging or local with real `DATABASE_URL`, Redis, and `npm run seed:test-data` for dashboard/analytics rows (`GSS-TEST-SEED-*`, customers with `test` in email).

**CSV export (execution tracking):** [`manual-qa-test-cases.csv`](manual-qa-test-cases.csv) — same **107** Part 2 test cases with columns for Status, Bug, Priority, and Impact. Regenerate after markdown changes: `node documentation/scripts/generate-manual-qa-csv.mjs`.

---

## Part 1 — Automated Test Suite Review

### 1.1 Suite inventory

| Layer | Tool | Location | Count | Live DB? |
|-------|------|----------|-------|----------|
| Backend unit | Vitest | `Tests/unit/backend/` | 35 files, 141 tests | No (mocked) |
| API integration | Vitest + Supertest | `Tests/integration/api/` | 19 files, 80 tests | No (mocked) |
| Frontend unit | Vitest + RTL | `Tests/unit/frontend/` | 3 files, 13 tests | No |
| E2E / UI | Playwright | `Tests/e2e/specs/` | 24 files, 286 tests | No (mocked API + static preview) |
| Viewport audit | Script | `Tests/scripts/audit-viewport-overflow.mjs` | 12 widths × 16 routes | No |

**Run:** `npm test` from repo root (CI runs on push/PR to `main`/`master`).

### 1.2 What is well covered (automated)

| Domain | Automated coverage |
|--------|-------------------|
| **Checkout pricing** | Volume tiers (10%/20%), shipping ($25 / free over $200), coupon stacking, server total match |
| **Place order** | Validation, `policy_accepted`, idempotency, stock reserve, WhatsApp URL shape, rollback paths |
| **Cart validation** | Price/stock/OOS, size required, empty cart rejection |
| **Coupons (server)** | `applies_to` all/product scope, validate aligns with place-order pricing |
| **Order lookup** | UUID + email, uniform 404, case-insensitive email, shipped tracking fields |
| **Admin auth** | Credentials, session hashing, verify cache (10s TTL), logout invalidation, rate limits |
| **Admin API** | Mark paid, no-refund cancel 403, analytics periods + IST custom range + CSV, inventory movements, low-stock, customer PATCH, pending order edits |
| **Security** | CSRF double-submit, RLS table list + grant revoke, deprecated routes 410, public order enumeration blocked |
| **Storefront UI** | Home/products/cart/checkout/contact smoke, size gate, OOS state, policy gate, coupon in summary, orders lookup, cookie consent, document scroll |
| **Responsive** | 11 phone viewports × routes, cart sticky bar vs policy, admin login mobile, horizontal overflow audit |
| **Infrastructure** | DB concurrency semaphore, client IP, keep-alive, performance budgets, `createClientId` LAN fallback |

### 1.3 Coverage gaps (manual or future automation)

| Gap | Risk | Notes |
|-----|------|-------|
| **Admin dashboard UI workflows** | Low | E2E module suite under `Tests/e2e/specs/admin/` (59 desktop tests: CRUD, order modal, integration, resilience, storage mock). Manual QA still validates live backend + Railway storage |
| **Real WhatsApp redirect** | High | E2E mocks `whatsappUrl`; production `wa.me` message content and phone number need manual verify |
| **WhatsApp Cloud API notifications** | Medium | Integration tests mock outbound messages; real payment/shipping texts need staging credentials |
| **Live database + Redis** | Medium | All Vitest API/unit tests mock Postgres/Redis; migration drift and pool behavior need staging smoke |
| **Admin media upload (Multer)** | Medium | API test for auth + image store; no E2E for admin upload UI or 360° MP4 playback |
| **Payment cancel page** | Low | `/payment/cancel` not in Playwright matrix |
| **Legal/static pages** | Low | Terms (Punjab), privacy, returns — partial; only shipping rates and scroll tested |
| **Cross-browser** | Low | Playwright uses Chromium only |
| **Real mobile devices / LAN checkout** | Medium | Emulated viewports; HTTP LAN `createClientId` fallback needs physical device spot-check |
| **Activity export (NDJSON)** | Medium | Settings tab export has no automated test |
| **Customer soft delete / restore** | Medium | API partial; no admin UI E2E |
| **Concurrent stock / double place-order** | Medium | Idempotency unit tests; race under real load is manual/staging |
| **Sentry / production observability** | Low | Error reporting not asserted in tests |
| **Sitemap with live product URLs** | Low | Separate CI job; not in default `npm test` |

### 1.4 Flaky, outdated, or redundant tests

| Observation | Detail |
|-------------|--------|
| **Playwright stability** | `workers: 1`, `retries: 1` — checkout/deep-flow specs can flake on slow CI; investigate retries before blaming product bugs |
| **Responsive overlap** | `responsive-pages-ui` (193 tests) overlaps `responsive-ui` + `mobile-ui` for core routes — intentional matrix, not duplicate bugs |
| **Policy / place-order overlap** | `deep-flows-ui` and `checkout-place-order-ui` both exercise policy acceptance — acceptable regression guard |
| **Mocked E2E catalog** | Product IDs come from `Tests/e2e/fixtures/mock-data.ts`, not production DB — manual QA must use real catalog |
| **No Quick Presets UI tests** | Coupon preset buttons removed; automated coupon coverage is server + checkout apply only |

### 1.5 Manual QA priority map

Use **High** cases below for every release; **Medium** for feature-touching releases; **Low** for time-boxed smoke.

---

## Part 2 — Detailed Manual Test Cases

### Authentication & authorization

| ID | Feature/Module | Title | Preconditions | Steps | Expected result | Priority |
|----|----------------|-------|---------------|-------|-----------------|----------|
| AUTH-001 | Admin login | Valid admin login | Known `ADMIN_USERNAME` / password; `/admin/login` | 1. Open `/admin/login` 2. Enter valid credentials 3. Submit | Redirect to `/adminshivamdashboard`; analytics tab visible; `admin_session` cookie set (HttpOnly) | High |
| AUTH-002 | Admin login | Invalid credentials rejected | Wrong password | 1. Submit login with wrong password | Error message; no dashboard access; after 5 failures in 15 min, rate limit message | High |
| AUTH-003 | Admin session | Unauthenticated redirect | Logged out / incognito | 1. Visit `/admin` 2. Visit `/adminshivamdashboard` | Both redirect to `/admin/login` | High |
| AUTH-004 | Admin session | Authenticated `/admin` redirect | Logged in | 1. Visit `/admin` | Redirect to dashboard | Medium |
| AUTH-005 | Admin session | Logout invalidates session | Logged in | 1. Logout from dashboard 2. Refresh dashboard 3. Call protected admin API | Redirect to login; subsequent admin API returns 401 | High |
| AUTH-006 | Admin API | CSRF on mutating routes | Logged in; DevTools open | 1. Attempt admin POST/PUT/DELETE without `X-CSRF-Token` | 403 CSRF error; with token from `GET /api/csrf-token`, request succeeds | High |
| AUTH-007 | Storefront | No admin data on public routes | None | 1. Browse `/products`, `/orders` without admin cookie | No admin-only data exposed; `GET /api/admin/*` returns 401 | High |
| AUTH-008 | Orders API | Public cannot list orders by email | None | 1. Call deprecated/public enumeration endpoints (if any documented) | Blocked or 404/401 per [`security.test.ts`](../Tests/integration/api/security/security.test.ts) | Medium |

### Storefront — catalog & navigation

| ID | Feature/Module | Title | Preconditions | Steps | Expected result | Priority |
|----|----------------|-------|---------------|-------|-----------------|----------|
| SF-001 | Home | Home page loads | None | 1. Open `/` | Hero/carousel visible; **View All Products** navigates to `/products` | High |
| SF-002 | Navigation | Global nav (non-home) | On `/products` | 1. Check header | Logo, **Orders**, **Cart** visible; no standalone Products nav icon | Medium |
| SF-003 | Products | Catalog list & pagination | Products in DB | 1. Open `/products` 2. Scroll/load more if applicable | Products with prices; OOS badge when `is_out_of_stock` or `stock === 0` | High |
| SF-004 | Products | Search & filters | Multiple products | 1. Use search/sort/price filters 2. Open `/products?q=keyword` | Results match query; URL deep link applies search | High |
| SF-005 | Product detail | Size required before add to cart | In-stock product | 1. Open `/product/{public_id}` 2. Click Add to Cart without size | Button disabled or error; after size selected, add succeeds | High |
| SF-006 | Product detail | Out of stock product | OOS or zero stock | 1. Open OOS product | OOS messaging; add disabled; sticky CTA hidden on mobile | High |
| SF-007 | Product detail | 360° video (if configured) | Product with `video_360` | 1. Open product 2. Interact with viewer | MP4 plays/drags; placeholder copy if no video | Low |
| SF-008 | Static content | Shipping policy rates | None | 1. Open `/shipping-policy` | Shows **$25** flat and **free over $200** (matches checkout) | Medium |
| SF-009 | Static content | Terms governing law | None | 1. Open `/terms-of-service` | Governing law: **Punjab, India** | Medium |
| SF-010 | SEO | Sitemap & robots | Production build | 1. Fetch `/sitemap.xml` and `/robots.txt` | Valid XML; product URLs present when API reachable | Low |

### Cart

| ID | Feature/Module | Title | Preconditions | Steps | Expected result | Priority |
|----|----------------|-------|---------------|-------|-----------------|----------|
| CART-001 | Cart | Empty cart state | Empty cart | 1. Open `/cart` | Empty message; link to continue shopping | Medium |
| CART-002 | Cart | Add/update/remove lines | In-stock product with size | 1. Add item from PDP 2. Change quantity 3. Remove line | Totals update; badge count in nav matches | High |
| CART-003 | Cart | Validate-cart on change | Item in cart | 1. Change qty 2. Observe network | `POST /api/products/validate-cart` runs; prices refresh from server | High |
| CART-004 | Cart | Validation failure retry | Simulate offline or block API | 1. Break network 2. Change cart 3. Click **Retry validation** | Error shown; retry recovers when online | Medium |
| CART-005 | Cart | Cross-tab sync | Two tabs same origin | 1. Add item in tab A | Tab B cart updates via `BroadcastChannel` | Low |
| CART-006 | Cart | OOS product blocked | Product goes OOS after add | 1. Admin marks OOS 2. Refresh cart validation | Line shows error; checkout blocked | High |

### Checkout & WhatsApp place order

| ID | Feature/Module | Title | Preconditions | Steps | Expected result | Priority |
|----|----------------|-------|---------------|-------|-----------------|----------|
| CHK-001 | Checkout | Empty checkout guard | Empty cart | 1. Open `/checkout` | Redirect or empty-cart messaging | Medium |
| CHK-002 | Checkout | Form validation | Items in cart | 1. Leave required fields blank 2. Click Place Order | Toast: complete required fields + first field hint | High |
| CHK-003 | Checkout | Policy gate | Filled form | 1. Submit without policy checkbox 2. Check box and submit | Blocked until accepted; succeeds after | High |
| CHK-004 | Checkout | Country default | Items in cart | 1. Open checkout form | Country pre-selected (United States) | Low |
| CHK-005 | Checkout | Coupon valid | Active coupon `all` scope | 1. Enter code 2. Apply | Discount in summary; server `pricing` matches display | High |
| CHK-006 | Checkout | Coupon invalid | Bad code | 1. Apply `INVALID` | Error message; no discount | High |
| CHK-007 | Checkout | Product-scoped coupon | Coupon limited to product IDs | 1. Cart with eligible + ineligible items 2. Apply coupon | Discount only on eligible lines (server totals) | Medium |
| CHK-008 | Checkout | Volume discount | 2+ or 5+ items | 1. Build cart with quantities 2. Review totals | 10% at 2+ items; 20% at 5+ (before coupon) | Medium |
| CHK-009 | Checkout | Free shipping threshold | Subtotal ≥ $200 merchandise | 1. Large cart before discounts | Shipping $0 in summary | Medium |
| CHK-010 | Checkout | Total mismatch block | Tamper client total (DevTools) | 1. Alter displayed total 2. Place order | Server rejects mismatch (> $0.01) | Medium |
| CHK-011 | Checkout | Place order → WhatsApp | Valid form + policy | 1. Place Order 2. Observe redirect | Opens `wa.me` with order UUID, items, totals; cart clears on next navigation per sessionStorage flag | High |
| CHK-012 | Checkout | Payment success page | After place order | 1. Complete flow 2. Land on `/payment/success` if used | Order received confirmation | Medium |
| CHK-013 | Checkout | Payment cancel page | Abandon mid-flow | 1. Open `/payment/cancel` | Checkout cancelled copy; cart preserved | Low |
| CHK-014 | Checkout | Idempotency | Double-click Place Order | 1. Rapid double submit | Single order created; duplicate key returns same payload | High |
| CHK-015 | Checkout | LAN mobile HTTP | Phone on `http://192.168.x.x:5173` | 1. Complete checkout on LAN | Place order succeeds (`createClientId` fallback) | Medium |

### Orders (customer)

| ID | Feature/Module | Title | Preconditions | Steps | Expected result | Priority |
|----|----------------|-------|---------------|-------|-----------------|----------|
| ORD-001 | Order lookup | Email link prefill | Email with `?orderId=` link | 1. Open `/orders?orderId={uuid}` | Order ID field prefilled | High |
| ORD-002 | Order lookup | Successful lookup | Placed order + checkout email | 1. Enter UUID + email 2. Submit | Order status and line items shown | High |
| ORD-003 | Order lookup | Wrong email | Valid UUID, wrong email | 1. Submit lookup | **Order not found** (uniform message) | High |
| ORD-004 | Order lookup | Invalid UUID | Malformed id | 1. Submit | Validation error or not found | Medium |
| ORD-005 | Order lookup | Full page reload clears state | After successful lookup | 1. Reload page | Form empty; details cleared | Medium |
| ORD-006 | Order tracking | Shipped order | Admin marked shipped with tracking URL | 1. Lookup order | Tracking link visible and opens carrier URL | High |
| ORD-007 | Deprecated | Legacy access-exchange link | Old email link format | 1. Follow legacy URL if exists | 410 or safe error page | Low |

### Contact & cookie consent

| ID | Feature/Module | Title | Preconditions | Steps | Expected result | Priority |
|----|----------------|-------|---------------|-------|-----------------|----------|
| CON-001 | Contact | Form validation | `/contact` | 1. Submit empty 2. Submit invalid email | Field errors | High |
| CON-002 | Contact | WhatsApp handoff | Valid form | 1. Fill and submit | `wa.me` opens with prefilled name/email/subject/message | High |
| CON-003 | Contact | Display phone | None | 1. View contact page | Number matches `VITE_WHATSAPP_CONTACT_NUMBER` | Medium |
| CON-004 | Activity | Contact submit event | Analytics consent granted | 1. Submit contact 2. Check activity/admin export | `contact_submit` logged; IP anonymized | Low |
| COOKIE-001 | Consent | Accept all | Fresh session | 1. Accept cookies | Banner hides; non-essential scripts allowed per policy | Medium |
| COOKIE-002 | Consent | Reject non-essential | Fresh session | 1. Reject non-essential | Essential-only storage | Medium |

### Admin — Analytics

| ID | Feature/Module | Title | Preconditions | Steps | Expected result | Priority |
|----|----------------|-------|---------------|-------|-----------------|----------|
| ADM-A01 | Analytics | Period presets | Seeded orders (`seed:test-data`) | 1. Switch day/week/month/year/all | Stats and charts update | High |
| ADM-A02 | Analytics | Custom IST range | Logged in | 1. Set From/To 2. Click **Apply range** | Dashboard reflects range (IST boundaries) | High |
| ADM-A03 | Analytics | CSV export gating | Custom period | 1. Change dates without Apply 2. Apply then export | Export disabled until Apply; CSV downloads with expected columns | High |
| ADM-A04 | Analytics | Error retry | Simulate API failure | 1. Break network on analytics tab 2. Retry | Error state with retry succeeds when restored | Medium |

### Admin — Products & inventory

| ID | Feature/Module | Title | Preconditions | Steps | Expected result | Priority |
|----|----------------|-------|---------------|-------|-----------------|----------|
| ADM-P01 | Products | Create product | Admin logged in | 1. Open product modal 2. Fill name, price, stock, image 3. Save | Product appears in list and storefront after cache refresh | High |
| ADM-P02 | Products | Edit product | Existing product | 1. Edit fields 2. Save | Changes persist on storefront | High |
| ADM-P03 | Products | Out-of-stock toggle | In-stock product | 1. Toggle OOS switch | Optimistic UI; `PUT /api/products/:id`; storefront shows OOS | High |
| ADM-P04 | Products | Low-stock filter | Product with stock ≤ 5 | 1. Enable low-stock filter | Product listed | Medium |
| ADM-P05 | Products | Inventory movements | Stock change | 1. Adjust stock 2. View movement history | Movement row with delta and timestamp | Medium |
| ADM-P06 | Products | Bulk stock delta | Multiple products selected | 1. Apply bulk delta | All selected products update | Medium |
| ADM-P07 | Products | Media upload | Image file ≤ 20 MB | 1. Upload via admin 2. Save product | Image URL serves correctly; broken upload rejected | Medium |
| ADM-P08 | Products | Pagination | >50 products | 1. Load more | Next page appends without duplicates | Low |

### Admin — Orders

| ID | Feature/Module | Title | Preconditions | Steps | Expected result | Priority |
|----|----------------|-------|---------------|-------|-----------------|----------|
| ADM-O01 | Orders | Search | Seeded orders | 1. Search by UUID, order number, email, name | Correct order found | High |
| ADM-O02 | Orders | Mark paid | Pending WhatsApp order | 1. Open order 2. Mark paid with `payment_id` + `admin_note` | `payment_status=completed`, `status=processing`; WhatsApp confirmation if Cloud API configured | High |
| ADM-O03 | Orders | Mark paid validation | Pending order | 1. Submit without note or payment_id | Validation error | High |
| ADM-O04 | Orders | Status transitions | Processing order | 1. Move to shipped with carrier/tracking/URL | Customer lookup shows tracking | High |
| ADM-O05 | Orders | Estimated delivery | Order modal | 1. Set estimated delivery date 2. Save | Field persists | Medium |
| ADM-O06 | Orders | Edit customer details | Unpaid pending order | 1. PATCH customer/shipping via modal | Updates saved; visible on reload | High |
| ADM-O07 | Orders | Edit pending line items | Unpaid pending | 1. Change qty/add/remove lines | Totals recalculated; inventory adjusted | High |
| ADM-O08 | Orders | Cancel unpaid pending | Pending payment | 1. Cancel order | Stock restored; coupon released | High |
| ADM-O09 | Orders | Cancel paid forbidden | Paid order | 1. Attempt cancel | 403 / UI blocks action | High |
| ADM-O10 | Orders | Delete unpaid | Pending order | 1. Delete order | Row removed; stock/coupon restored | Medium |
| ADM-O11 | Orders | Bulk status update | Multiple orders | 1. Select orders 2. Bulk status change | Valid transitions succeed; invalid rejected | Medium |

### Admin — Coupons

| ID | Feature/Module | Title | Preconditions | Steps | Expected result | Priority |
|----|----------------|-------|---------------|-------|-----------------|----------|
| ADM-C01 | Coupons | Create coupon (all scope) | Admin logged in | 1. Enter code, %, entire order 2. Create | Appears in list; works at checkout | High |
| ADM-C02 | Coupons | Create product-scoped | Products exist | 1. Scope = specific products 2. Pick via search 3. Create | Scope column shows product count; checkout applies only to those SKUs | High |
| ADM-C03 | Coupons | Edit coupon | Existing coupon | 1. Edit description, max uses, expiry, scope 2. Save | Updates persist | High |
| ADM-C04 | Coupons | Activate/deactivate | Active coupon | 1. Toggle off 2. Try at checkout | Inactive rejected at validate | High |
| ADM-C05 | Coupons | Delete coupon | Unused coupon | 1. Delete | Removed from list | Medium |
| ADM-C06 | Coupons | Pagination | >10 coupons | 1. Next/Previous | 10 per page | Low |

### Admin — Customers

| ID | Feature/Module | Title | Preconditions | Steps | Expected result | Priority |
|----|----------------|-------|---------------|-------|-----------------|----------|
| ADM-U01 | Customers | Search & pagination | Seeded customers | 1. Search `test` 2. Paginate | Matching rows only | High |
| ADM-U02 | Customers | Admin notes | Customer row | 1. Add/edit note 2. Save | Note persists on reload | Medium |
| ADM-U03 | Customers | Order history modal | Customer with orders | 1. View History 2. Paginate (10/page) | Orders listed correctly | Medium |
| ADM-U04 | Customers | Soft delete / restore | Test customer | 1. Soft delete 2. Show deleted toggle 3. Restore | Hidden by default; restored visible | Medium |

### Admin — Settings

| ID | Feature/Module | Title | Preconditions | Steps | Expected result | Priority |
|----|----------------|-------|---------------|-------|-----------------|----------|
| ADM-S01 | Settings | Activity export | Activity logs exist | 1. Export NDJSON (optional date range) | Valid NDJSON download | Medium |
| ADM-S02 | Settings | Admin sessions list | Active sessions | 1. View sessions 2. Cleanup expired | Stale sessions removed | Low |
| ADM-S03 | Settings | Customer recompute | After bulk order changes | 1. Run recompute | Customer aggregates match orders | Low |

### API & error handling (manual API checks)

| ID | Feature/Module | Title | Preconditions | Steps | Expected result | Priority |
|----|----------------|-------|---------------|-------|-----------------|----------|
| API-001 | Health | Health endpoint | Backend running | 1. `GET /api/health` | `success: true`; DB and Redis status | High |
| API-002 | Deprecated | POST /api/orders | curl/Postman | 1. POST `/api/orders` | 410 Gone | Medium |
| API-003 | Deprecated | POST /api/coupons/use | curl | 1. POST `/api/coupons/use` | 410 Gone | Low |
| API-004 | Rate limits | Coupon validate | Script 21+ validates in 15 min | 1. Hammer `/api/coupons/validate` | 429 after limit | Low |
| API-005 | Rate limits | Admin login | 6+ failed logins | 1. Failed attempts | Rate limited | Medium |
| API-006 | CSRF | Storefront mutate | No CSRF token | 1. POST place-order without token | 403 | High |

### Cross-module & data consistency

| ID | Feature/Module | Title | Preconditions | Steps | Expected result | Priority |
|----|----------------|-------|---------------|-------|-----------------|----------|
| XMOD-001 | Place order → Admin | End-to-end order lifecycle | Staging | 1. Place order 2. Find in admin 3. Mark paid 4. Ship 5. Customer lookup | Statuses consistent; stock decremented then fulfilled | High |
| XMOD-002 | Coupon reservation | Cancel restores usage | Order with coupon | 1. Place with coupon 2. Cancel pending | `used_count` not incremented permanently | Medium |
| XMOD-003 | Catalog cache | Admin product change | Product edit | 1. Edit price in admin 2. Validate cart on storefront | Storefront shows new price after validation | High |
| XMOD-004 | No refund policy | Paid order | Completed payment | 1. Attempt refund/cancel paid | Blocked everywhere (API 403) | High |

### Forms, accessibility & responsive

| ID | Feature/Module | Title | Preconditions | Steps | Expected result | Priority |
|----|----------------|-------|---------------|-------|-----------------|----------|
| A11Y-001 | Forms | Label audit script | Repo checkout | 1. `node frontend/scripts/audit-form-labels.mjs` | `count 0` | High |
| A11Y-002 | Forms | Chrome DevTools Issues | Desktop Chrome | 1. Exercise `/checkout`, `/contact`, `/orders`, `/products`, admin modals | No missing id/name/label issues | High |
| RSP-001 | Mobile | Checkout sticky CTA | Phone viewport | 1. Open `/checkout` on 320px width | Form usable; policy not hidden under sticky bar | High |
| RSP-002 | Mobile | Admin dashboard | Phone | 1. Open orders/products tabs | Tables scroll horizontally; cards readable | Medium |

### Negative & security scenarios

| ID | Feature/Module | Title | Preconditions | Steps | Expected result | Priority |
|----|----------------|-------|---------------|-------|-----------------|----------|
| NEG-001 | Auth | Admin API without cookie | curl | 1. `GET /api/admin/analytics` | 401 | High |
| NEG-002 | Checkout | Place order without items | API | 1. POST empty items | 400 validation error | Medium |
| NEG-003 | Checkout | Insufficient stock | Low stock SKU | 1. Place qty > stock | 409 Insufficient stock | High |
| NEG-004 | Orders | SQL injection in search | Admin order search | 1. Enter `'; DROP TABLE--` | Safe handling; no error leak | Low |
| NEG-005 | Upload | Oversized image | >20 MB file | 1. Admin upload | Rejected with clear error | Medium |

---

## Part 3 — Release Regression QA Checklist

Quick pass before production deploy. Check each box when verified.

### Environment & smoke

- [ ] `GET /api/health` OK (DB + Redis)
- [ ] `npm test` green on release branch (or latest CI run)
- [ ] `node frontend/scripts/audit-form-labels.mjs` → count 0

### Authentication

- [ ] Admin login / logout / session redirect (AUTH-001, AUTH-003, AUTH-005)
- [ ] CSRF on admin mutate (AUTH-006)

### Storefront

- [ ] Home → products → product detail → add to cart with size (SF-001, SF-005)
- [ ] OOS product blocked (SF-006)
- [ ] Cart validation & checkout empty guards (CART-003, CHK-001)

### Checkout & payments

- [ ] Policy gate + place order + WhatsApp message contains order UUID (CHK-003, CHK-011)
- [ ] Valid + invalid coupon (CHK-005, CHK-006)
- [ ] Admin mark paid on test order (ADM-O02)

### Customer orders

- [ ] Lookup success + wrong email uniform error (ORD-002, ORD-003)
- [ ] Shipped tracking link when applicable (ORD-006)

### Admin — core CRUD

- [ ] Product create/edit + OOS toggle (ADM-P01, ADM-P03)
- [ ] Order search + pending edits (ADM-O01, ADM-O06, ADM-O07)
- [ ] Coupon create + scope + deactivate (ADM-C01, ADM-C02, ADM-C04)
- [ ] Analytics period + custom IST Apply + CSV (ADM-A02, ADM-A03)

### Contact & compliance

- [ ] Contact WhatsApp handoff (CON-002)
- [ ] Terms: Punjab, India (SF-009)
- [ ] Shipping policy rates match checkout (SF-008)

### Mobile & responsive

- [ ] Checkout usable at 320px; cart policy above sticky bar (RSP-001)
- [ ] Viewport overflow audit passed in CI

### Policy & negative

- [ ] Cannot cancel/refund paid order (ADM-O09, XMOD-004)
- [ ] Unauthenticated admin API 401 (NEG-001)

### Optional (staging / major releases)

- [ ] WhatsApp Cloud API payment confirmation text (ADM-O02)
- [ ] LAN mobile checkout (CHK-015)
- [ ] Settings activity export (ADM-S01)
- [ ] Customer soft delete/restore (ADM-U04)
- [ ] Bulk order status (ADM-O11)

---

## Related documentation

| Document | Purpose |
|----------|---------|
| [test_guidelines.md](test_guidelines.md) | Automated tests, when to run, seed data |
| [FORMS_QA_CHECKLIST.md](FORMS_QA_CHECKLIST.md) | Form labels, CSRF spot checks |
| [RESPONSIVE_QA_CHECKLIST.md](RESPONSIVE_QA_CHECKLIST.md) | Viewport-specific manual checks |
| [PRE_LAUNCH_CHECKLIST.md](PRE_LAUNCH_CHECKLIST.md) | Infrastructure & deploy gates |
| [COVERAGE_MATRIX.md](COVERAGE_MATRIX.md) | Automated behavior coverage map |
| [ADMIN_DASHBOARD_GUIDE.md](ADMIN_DASHBOARD_GUIDE.md) | Admin tab workflows |
| [WHATSAPP_CHECKOUT_GUIDE.md](WHATSAPP_CHECKOUT_GUIDE.md) | WhatsApp checkout verification |

---

*Last aligned with automated suite: **520 tests**. Update this file when major features or admin workflows change.*
