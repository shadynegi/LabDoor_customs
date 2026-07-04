> **Historical snapshot (2026-06-08).** Current system uses WhatsApp checkout and **401** automated tests — see [`info.md`](info.md) and [`COVERAGE_MATRIX.md`](COVERAGE_MATRIX.md).

# Lab Door Customs — Project Audit (2026-06-08)

**One-time comprehensive review** of codebase vs [`info.md`](info.md).  
**Do not repeat this audit wholesale** — maintain [`COVERAGE_MATRIX.md`](COVERAGE_MATRIX.md) and fix rows as work ships.

**Review method:** Read `info.md` + operational guides; parallel audit of `backend/src`, `frontend/src`, `Tests/`, CI, env templates; spot-verify critical findings in source.

**Automated tests at audit time:** 99 passing (61 unit + 16 API + 22 Playwright). **After remediation (`3dbdef9`):** 105. **After follow-up (`c6de967`):** 111. **After test sprint (`8303997`):** 127. **After core-gap sprint:** 141. **After audit test gaps:** 149. **After no-refund policy sprint:** 150. **After WhatsApp checkout migration:** **207** (103 unit + 61 API + 43 Playwright).

---

## Executive summary

The platform is **production-viable** for core storefront checkout (WhatsApp place-order), admin fulfillment, and manual payment confirmation. Admin **Mark paid** is the payment confirmation path after WhatsApp checkout.

**Remediation (2026-06-08):** Critical and high audit items **C1–C4, C6, H1–H8** in `3dbdef9`; follow-up **F-01–F-07, DB-01, FE-01–FE-06** in `c6de967`; maintenance resilience + docs in `5e3be15`; payment/UI test sprint in `8303997`+ (checkout-context, refund mismatch, webhook COMPLETED, mark-paid success, coupon scope, orders `?code=`, checkout total mismatch). See [`COVERAGE_MATRIX.md`](COVERAGE_MATRIX.md).

**Original top risks (snapshot at audit time — most now closed):**

1. ~~**Pricing drift**~~ — fixed: free shipping at **$200** in code and docs.
2. ~~**Activity events silently dropped**~~ — fixed: aligned `contact_submit` and wired `purchase_complete`, `size_select`, `quantity_change`.
3. ~~**Bootstrap security gap**~~ — fixed: grant revoke runs when RLS DDL is skipped.
4. ~~**Broken tracking links**~~ — fixed: email portal links minted from checkout exchange token.
5. **Test holes** on payment-critical paths (409, exchanges, webhooks, mark-paid, RLS) — partial; see C5.
6. ~~**Order enumeration**~~ — fixed: uniform **404** for bad/missing credentials.

---

## Review plan (executed)

| Phase | Scope | Outcome |
|-------|--------|---------|
| 1 | Read `info.md`, `PROJECT_STATUS.md`, index + key guides | Baseline expectations |
| 2 | Backend routes, libs, bootstrap, email, payments | 28 findings |
| 3 | Frontend routes, admin, checkout, activity | 18 findings (8 recently fixed) |
| 4 | Tests, CI, env templates, doc sync | 20 findings |
| 5 | Cross-verify critical items in source | Confirmed shipping, activity, email, RLS skip |
| 6 | Publish `COVERAGE_MATRIX.md` + this audit | Ongoing maintenance |

---

## Critical changes (fix before next production release)

### C1 — Free shipping threshold ($200 vs $300)

| | |
|---|---|
| **Severity** | Critical (customer-facing pricing) |
| **Files** | `backend/src/lib/checkoutPricing.ts`; `frontend/src/utils/pricing.ts`; `info.md` pricing section |
| **Issue** | Code charges $25 shipping below **$300**; docs promise free shipping over **$200**. |
| **Fix** | Pick one threshold (recommend **$200** to match marketing/docs). Update `FREE_SHIPPING_THRESHOLD` in backend + frontend; update `Tests/backend/checkoutPricing.test.ts`; grep UI copy (“$300” strings); verify checkout pricing on a $250 cart. |

### C2 — Activity action type mismatch (silent data loss)

| | |
|---|---|
| **Severity** | Critical (analytics blind spot) |
| **Files** | `backend/src/routes/activity.ts` L16-25; `frontend/src/utils/activityTracker.ts` L32, L177 |
| **Issue** | Frontend emits `contact_submit`; backend whitelist has `contact_submit` only → events skipped in `/batch`. |
| **Fix** | Add `contact_submit` to `ALLOWED_ACTION_TYPES` (and align `purchase_complete`, `size_select`, `quantity_change` if/when wired). Add API test: batch with contact event persists. Optionally return 400 on unknown types in dev. |

### C3 — `BOOTSTRAP_SKIP_DDL` skips grant revoke

| | |
|---|---|
| **Severity** | Critical (security if grants remain) |
| **Files** | `backend/src/lib/rlsMigration.ts` L211-214; `migration-revoke-graphql-client-roles.sql` |
| **Issue** | When skip DDL or policies exist, `revokeClientRoleGrants()` never runs — `anon`/`authenticated` may retain table grants. |
| **Fix** | Split bootstrap: (a) DDL skip for CREATE TABLE; (b) **always** run grant-revoke check when `authenticatedHasTableGrants()` true. Run revoke migration once in Supabase. Add startup warning/fail if grants detected in production. Document in `DATABASE_SETUP.md`. |

### C4 — Confirmation emails without one-time tracking links (webhook / admin paths)

| | |
|---|---|
| **Severity** | Critical (customer order access) |
| **Files** | `backend/src/lib/postPaymentCapture.ts`; `backend/src/lib/paymentReconciliation.ts` L173; `backend/src/routes/orders.ts` L781; `backend/src/lib/email.ts` L82-93 |
| **Issue** | `sendPostCaptureNotifications(order)` called without `accessToken` → email falls back to `/orders?orderNumber=` (deprecated, no auto-login). |
| **Fix** | At order creation, persist encrypted token or pre-create `order_access_exchanges` row for email use. On any capture completion path, mint one-time exchange code via `createOrderAccessExchangeCode(orderId, plaintextToken)` — requires storing recoverable token or re-issuing access credential server-side. Update webhook + admin mark-paid to pass token/code into `sendPostCaptureNotifications`. Test email HTML contains `?code=`. |

### C5 — Payment-critical paths untested

| | |
|---|---|
| **Severity** | Critical (regression risk) |
| **Files** | `Tests/api/checkout.test.ts`, `Tests/frontend/` |
| **Issue** | 409 capture, checkout/access exchange redeem, webhook `PAYMENT.CAPTURE.COMPLETED`, admin mark-paid, RLS — **no automated tests**. |
| **Fix** | See [`COVERAGE_MATRIX.md`](COVERAGE_MATRIX.md) rows PAY-409, PAY-EXCHANGE, ORD-ACCESS-EX, PAY-WEBHOOK, ORD-MARK-PAID, SEC-RLS. Prioritize API tests with `sqlMock` sequences, then Playwright mocks for `PaymentSuccess` / `MyOrders`. |

### C6 — CI JWT secret may fail `validate-env`

| | |
|---|---|
| **Severity** | Critical (CI reliability) |
| **Files** | `.github/workflows/ci.yml` L29; `backend/scripts/validate-env.mjs` |
| **Issue** | `ci-jwt-secret-at-least-32-characters-long` lacks uppercase/special chars required by production JWT rules. |
| **Fix** | Use compliant placeholder (match `backend/vitest.config.ts`) or document `CI_VALIDATE_PRODUCTION` escape hatch explicitly tested in CI. |

---

## High priority (half-baked / security / reconciliation)

### H1 — Volume discount undocumented; coupon validate mismatch

| **Files** | `checkoutPricing helpers` L23-35; `coupons.ts` validate; `info.md` pricing section |
| **Issue** | 10%/20% volume discount applied at create-payment; not in docs; `/coupons/validate` uses raw subtotal → client/server total drift. |
| **Fix** | Document volume rules in `info.md`. In validate endpoint, accept item count/items, run `calculateVolumeDiscount`, apply coupon to post-volume subtotal. Return breakdown in validate response. Frontend: compare server totals before place-order. |

### H2 — Order number enumeration

| **Files** | `orders.ts` L283-288, L318-327 |
| **Issue** | Unknown order → **404**; wrong token → **401** → enumerable order numbers. |
| **Fix** | Return identical **404** + generic message for both cases on `POST /lookup` and `GET /number/:orderNumber`. Add rate limiting audit. Test both paths. |

### H3 — Server `?aid=` not implemented (doc says it is)

| **Files** | `orderTokens.ts` L13-20; `info.md` L221; `PaymentSuccess.tsx` (client maps `aid` to header) |
| **Issue** | Docs: header **or** `?aid=` query; server reads header only. |
| **Fix** | Either add `req.query.aid` to `getOrderAccessTokenFromRequest()` with validation, **or** update docs to “SPA maps `aid` → `X-Order-Access-Token` header only”. |

### H4 — Coupon validate vs create-payment pricing base

| **Files** | `coupons.ts`, `checkoutPricing helpers` |
| **Fix** | Same as H1 — unified pricing pipeline shared by validate + create-payment. |

### H5 — `POST /reviews/check` doesn't verify product exists

| **Files** | `reviews.ts` L628+ |
| **Fix** | `SELECT 1 FROM products WHERE id = $1`; return generic ineligible message if missing (same as duplicate review). |

### H6 — Admin product image 2 MB client vs 512 KB server

| **Files** | `AdminProductFormModal.tsx`; `info.md` |
| **Fix** | Set client `MAX_IMAGE_BYTES = 512 * 1024`; update helper text. |

### H7 — Shipping notification emails lack order portal link

| **Files** | `email.ts`, `orders.ts` notify-shipped |
| **Fix** | Include `resolveTrackingUrl` with access exchange on shipped emails (same as C4 token strategy). |

### H8 — `processed_refund_events` table skipped under `BOOTSTRAP_SKIP_DDL`

| **Files** | `orderSchemaMigrations.ts`, `refundIdempotency.ts` |
| **Fix** | When skipping DDL, still ensure `processed_refund_events` exists if missing. |

---

## Medium priority (half-baked features & UX)

**Status as of 2026-06-09** (code review vs original audit snapshot):

| ID | Status | Notes |
|----|--------|-------|
| M1 | **Closed** | Coupon edit includes `applies_to` + IDs; scope column in table (`AdminCouponsTab.tsx`) |
| M2 | **Closed** | Presets force `applies_to: 'all'` |
| M3 | **Closed** | `POST /products/search` with debounce (`AdminDashboard.tsx`) |
| M4 | **Closed** | `AdminProductSearchPicker` uses `POST /products/search` in coupons + reviews tabs |
| M5 | **Closed** | Status filter preserves `orderSearch` |
| M6 | **Closed** | Self-loading tabs call `setLoading(false)` |
| M7 | **Closed** | `size_select`, `quantity_change` wired |
| M8 | **Closed** | `purchase_complete` on 409 poll success |
| M9 | **Closed** | Catalog cache TTL 15 min (matches `info.md`) |
| M10 | **Closed** | Checkout blocks redirect on server/client total mismatch |
| M11 | **Closed** | Exchange code hash collision retry (`ON CONFLICT`) |
| M12 | **Closed** | Webhook DENIED → `processingFailed` when unbound |
| M13 | **Closed** | `/activity/log` → 500 on DB failure; batch returns 500 when all valid events fail to persist |
| M14 | **Closed** | Shared `GENERIC_REVIEW_ELIGIBILITY_MESSAGE` on check + submit |

---

## Low priority & info

| Item | Status / notes |
|------|----------------|
| API-only admin UI | Documented, intentional |
| `PROMO_COUPON_CODE` | **Closed (by design)** — storefront hint for `LDCOFF10`; customer must apply code; seed via `migration-ldcoff10-coupon.sql` |
| RLS table count in boilerplate guides | **Closed** — intros updated to 12 tables (`CLIENT_REVOKED_TABLES`; reviews removed July 2026) |
| `test_guidelines.md` inventory | **Synced** — 127 tests (73+30+24) |
| `info.md` auth legend `?token=` | **Closed** — documents `?aid=` + header; legacy `?token=` strip noted for `/orders` only |
| ReviewList “not helpful” button | **Closed** — disabled styling after vote |
| PaymentSuccess missing `token` | **Closed** — error UI with `/orders` link |
| Dead code | `apiUtils.ts`, `tokens.ts` removed |

---

## What is fully implemented (verified OK)

- WhatsApp place-order atomic order + stock + exchange code + `access_token_encrypted`
- Capture idempotency, `ORDER_ALREADY_CAPTURED` handling, amount mismatch auto-refund (capture path)
- **409** when capture succeeds but DB not completed (+ frontend processing UI + poll timeout UX)
- Checkout/access exchange encryption; durable email link minting via encrypted order token
- Coupon validate + create-payment share `computeCheckoutPricingForCart` (DB prices, volume discount)
- Coupon scope enforcement at checkout (`all` / `product`); admin coupon edit scope
- Admin bulk limits (500), status transition validation, mark-paid with payment reference, server product search
- CSRF, rate limits (Redis fail-closed), Cloudflare enforcement, production grant-revoke gate
- Review PII stripping (`toPublicReview`), admin moderation UI, check endpoint anti-enumeration (product missing)
- Storefront routes, cart validation + retry, client/server total compare, legacy order URL deprecation
- Maintenance jobs with ping-first scheduling and transient-error handling (`dbErrors.ts`)
- **409** automated tests (120 unit + 74 API + 215 Playwright) — see [`test_guidelines.md`](test_guidelines.md)

---

## Remediation priority (recommended sprint order)

```
Sprint 1 — Trust & money
  C1 shipping threshold
  C2 activity action types
  H1 volume discount + coupon validate unify
  H2 order enumeration
  C4 email tracking links

Sprint 2 — Security & bootstrap
  C3 grant revoke split from DDL skip
  H8 refund events table guard
  SEC-RLS tests + manual revoke verification

Sprint 3 — Tests & CI
  C5 + C6 coverage matrix rows
  Playwright payment/orders specs

Sprint 4 — Admin/storefront polish
  M1–M10 from matrix
```

---

## Follow-up audit (2026-06-08, post `3dbdef9`)

**Method:** Re-read `info.md`, `COVERAGE_MATRIX.md`, `PROJECT_STATUS.md`; parallel code audit of backend, frontend, Tests, schema; spot-verify remediation claims.

**Verdict:** Core storefront checkout is **production-viable**. Remediation closed most original C/H items in code. **Remaining work** clusters into: (1) durable order access for emails, (2) coupon validate price parity, (3) automated tests for payment paths, (4) frontend payment-edge UX, (5) DB migration completeness.

### Closed in follow-up remediation (2026-06-08)

| ID | Status | Summary |
|----|--------|---------|
| **F-01** | Closed | `orders.access_token_encrypted` at create-payment; `getOrderAccessTokenForEmail()` reads durable store with checkout-exchange fallback |
| **F-02** | Closed | `/coupons/validate` uses `computeCheckoutPricingForCart` (DB prices + volume + shipping) |
| **FE-01** | Closed | Checkout blocks place-order when server `total` ≠ client total (> $0.01) |
| **FE-02** | Closed | `legacy payment-return error UI |
| **FE-03** | Closed | 409 poll timeout shows terminal error + retry |
| **FE-04** | Closed | Coupon cleared when cart signature changes |
| **FE-05** | Closed | Admin product search via `POST /products/search` |
| **FE-06** | Closed | Coupons/reviews tabs `setLoading(false)`; orders tab error + Retry |
| **F-06** | Closed | `/reviews/check` returns 200 + generic message for missing product |
| **F-07** | Closed | Webhook DENIED sets `processingFailed` when order binding fails |
| **F-04** | Closed | `assertNoClientGrantsRemaining()` fails production startup if grants remain |
| **DB-01** | Closed | `migration-order-checkout-exchange.sql` + `schema.sql`; `migration-order-access-token-encrypted.sql` |
| **F-03** | Closed | `API_DOCUMENTATION.md` validate request/response synced |

### Still open (next sprint)

| ID | Severity | Issue | Next step |
|----|----------|-------|-----------|
| **Future** | Low | OpenAPI, Sentry release maps | See `CRITICAL_FIXES_TODO.md` |

### Test sprint order (closes C5 without re-auditing)

1. `Tests/api/captureReconciliation.test.ts` — PAY-409, PAY-CONTEXT  
3. `Tests/api/checkoutExchange.test.ts` + `orderAccessExchange.test.ts` — PAY-EXCHANGE, ORD-ACCESS-EX  
4. `Tests/api/adminMarkPaid.test.ts` — ORD-MARK-PAID  
5. `Tests/api/activityBatch.test.ts` — ACT-BATCH, ACT-CONTACT  
6. `Tests/backend/rlsMigration.test.ts` — SEC-RLS, SEC-BOOTSTRAP  
7. `Tests/frontend/payment-success-ui.spec.ts` + `orders-ui.spec.ts` — UI-PAY-409, UI-ORDERS  

---

## Preventing repeat full reviews

| Artifact | Role |
|----------|------|
| [`info.md`](info.md) | Single source of truth for behavior |
| [`COVERAGE_MATRIX.md`](COVERAGE_MATRIX.md) | Doc → code → test map; update per PR |
| This file | Snapshot audit + remediation log |
| [`FORMS_QA_CHECKLIST.md`](FORMS_QA_CHECKLIST.md) | Manual flows matrix can't automate |
| CI (future) | Route manifest + test-count marker + env parity script |

### Remediation log

| Date | ID | Change |
|------|-----|--------|
| 2026-06-08 | — | Initial audit published; frontend audit fixes shipped in `8e4e162`; docs synced in `e1a2464` |
| 2026-06-08 | C1 | Free shipping threshold aligned to $200 (backend + frontend + tests) |
| 2026-06-08 | C2 | Activity types aligned (`contact_submit`, `purchase_complete`, `size_select`, `quantity_change`) |
| 2026-06-08 | C3 | `ensureClientGrantsRevoked()` runs even when RLS DDL skipped |
| 2026-06-08 | C4 | Email portal links via `issueOrderTrackingExchangeFromOrder` + shipping portal CTA |
| 2026-06-08 | C6 | CI `JWT_SECRET` meets production complexity rules |
| 2026-06-08 | H1/H4 | Coupon validate applies volume discount before coupon subtotal |
| 2026-06-08 | H2 | Order lookup returns uniform 404 (`security.test.ts`) |
| 2026-06-08 | H3 | `getOrderAccessTokenFromRequest` supports `?aid=` query |
| 2026-06-08 | H5 | `/reviews/check` verifies product exists |
| 2026-06-08 | H6 | Admin image upload limit 512 KB (matches server) |
| 2026-06-08 | H7 | Shipping emails include order portal link |
| 2026-06-08 | H8 | `processed_refund_events` created even under `BOOTSTRAP_SKIP_DDL` |
| 2026-06-08 | — | Follow-up audit post `3dbdef9`; `COVERAGE_MATRIX.md` refreshed; `info.md` volume discount + activity wiring |
| 2026-06-08 | F-01 | `orders.access_token_encrypted` + `getOrderAccessTokenForEmail()` durable email minting |
| 2026-06-08 | F-02 | Coupon validate uses `computeCheckoutPricingForCart`; returns `pricing` breakdown |
| 2026-06-08 | FE-01 | Checkout compares server vs client total before place-order |
| 2026-06-08 | FE-02/FE-03 | PaymentSuccess missing-token and 409-timeout error UX |
| 2026-06-08 | FE-04 | Coupon cleared on cart signature change |
| 2026-06-08 | FE-05/FE-06 | Admin server product search; coupons/reviews/orders loading fixes |
| 2026-06-08 | F-06 | Reviews check — no product enumeration (200 generic) |
| 2026-06-08 | F-07 | Webhook DENIED → 500 when order binding fails |
| 2026-06-08 | F-04 | Production startup fails if client grants remain |
| 2026-06-08 | DB-01 | Checkout exchange + access_token_encrypted migration SQL files |
| 2026-06-08 | C5 | Partial — `activityBatch.test.ts`, `orderLookup.test.ts`, `computeCheckoutPricingForCart.test.ts` |
| 2026-06-09 | — | Maintenance ping-first + transient DB handling (`5e3be15`); `dbErrors.ts` + `transientDbError.test.ts` |
| 2026-06-09 | — | Docs: DATABASE_URL vs maintenance warnings; AUDIT_SUMMARY + audit reconciliation |
| 2026-06-09 | M4/M13/M14 | Admin product search picker; activity log/batch errors; review message unification |
| 2026-06-09 | C5 | Expanded — capture 409, webhook DENIED, checkout exchange API, mark-paid validation, reviews check, activity log, Playwright payment/orders UI (127 tests) |
| 2026-06-09 | C5 | Closed core gaps — checkout-context, capture refund mismatch, webhook COMPLETED, mark-paid success, coupon scope, orders `?code=`, checkout total mismatch UI (141 tests) |
| 2026-06-10 | PAY-CREATE | `createPaymentHappy.test.ts` — WhatsApp place-order happy path |
| 2026-06-10 | ORD-EMAIL-LINK | `emailPortalUrl.test.ts` — `buildOrderPortalUrl` unit coverage |
| 2026-06-10 | SEC-BOOTSTRAP | `rlsGrantRevoke.test.ts` — grant revoke runs when `BOOTSTRAP_SKIP_DDL` |
| 2026-06-10 | UI-ADMIN | `admin-ui.spec.ts` — login redirect + dashboard analytics smoke (149 tests) |
| 2026-06-10 | PAY-POLICY / POL-ADMIN | No-refund store policy — `policy_accepted`, admin refund/cancel 403, storefront policy pages (`1406729`; 150 tests) |
| 2026-06-26 | TEST-EXPANSION | +35 tests — validate-cart API, admin analytics IST/UI, responsive mobile UI, performance budgets, stability smoke, checkout serial Playwright project (233 tests) |

*Append a line when closing each Critical/High item.*

---

## Related documents

- [`DOCUMENTATION_INDEX.md`](DOCUMENTATION_INDEX.md)
- [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md)
- [`ADMIN_DASHBOARD_GUIDE.md`](ADMIN_DASHBOARD_GUIDE.md)
- - [`test_guidelines.md`](test_guidelines.md)
