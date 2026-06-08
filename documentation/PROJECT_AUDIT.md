# Lab Door Customs — Project Audit (2026-06-08)

**One-time comprehensive review** of codebase vs [`info.md`](info.md).  
**Do not repeat this audit wholesale** — maintain [`COVERAGE_MATRIX.md`](COVERAGE_MATRIX.md) and fix rows as work ships.

**Review method:** Read `info.md` + operational guides; parallel audit of `backend/src`, `frontend/src`, `Tests/`, CI, env templates; spot-verify critical findings in source.

**Automated tests at audit time:** 99 passing (61 unit + 16 API + 22 Playwright). **After remediation (`3dbdef9`):** 105 passing. **After follow-up fixes:** 111 passing (68 unit + 21 API + 22 Playwright).

---

## Executive summary

The platform is **production-viable** for core storefront checkout, admin fulfillment, and PayPal capture/webhooks. Recent frontend work closed major gaps (409 payment UI, checkout exchange errors, admin messages, review eligibility, cart retry).

**Remediation (2026-06-08):** Critical and high audit items **C1–C4, C6, H1–H8** were implemented in `3dbdef9`. **Follow-up (same day):** **F-01, F-02, F-04, F-06, F-07, DB-01, FE-01–FE-06** closed in code; partial **C5** coverage via activity batch, order lookup, and `computeCheckoutPricingForCart` tests. Remaining gaps: webhook/capture/mark-paid API tests, Playwright payment-edge specs — track via [`COVERAGE_MATRIX.md`](COVERAGE_MATRIX.md).

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
| **Files** | `backend/src/lib/paypalCheckout.ts` L4; `frontend/src/utils/pricing.ts` L15; `info.md` L318-322 |
| **Issue** | Code charges $25 shipping below **$300**; docs promise free shipping over **$200**. |
| **Fix** | Pick one threshold (recommend **$200** to match marketing/docs). Update `FREE_SHIPPING_THRESHOLD` in backend + frontend; update `Tests/backend/checkoutPricing.test.ts`; grep UI copy (“$300” strings); run PayPal sandbox on $250 cart. |

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

| **Files** | `paypalCheckout.ts` L23-35; `coupons.ts` validate; `info.md` pricing section |
| **Issue** | 10%/20% volume discount applied at create-payment; not in docs; `/coupons/validate` uses raw subtotal → client/server total drift. |
| **Fix** | Document volume rules in `info.md`. In validate endpoint, accept item count/items, run `calculateVolumeDiscount`, apply coupon to post-volume subtotal. Return breakdown in validate response. Frontend: compare server totals before PayPal redirect. |

### H2 — Order number enumeration

| **Files** | `orders.ts` L283-288, L318-327 |
| **Issue** | Unknown order → **404**; wrong token → **401** → enumerable order numbers. |
| **Fix** | Return identical **404** + generic message for both cases on `POST /lookup` and `GET /number/:orderNumber`. Add rate limiting audit. Test both paths. |

### H3 — Server `?aid=` not implemented (doc says it is)

| **Files** | `orderTokens.ts` L13-20; `info.md` L221; `PaymentSuccess.tsx` (client maps `aid` to header) |
| **Issue** | Docs: header **or** `?aid=` query; server reads header only. |
| **Fix** | Either add `req.query.aid` to `getOrderAccessTokenFromRequest()` with validation, **or** update docs to “SPA maps `aid` → `X-Order-Access-Token` header only”. |

### H4 — Coupon validate vs create-payment pricing base

| **Files** | `coupons.ts`, `paypalCheckout.ts` |
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

| ID | Area | Files | Issue | Detailed fix |
|----|------|-------|-------|--------------|
| M1 | Admin coupons | `AdminCouponsTab.tsx` | Edit modal lacks `applies_to` / IDs | Extend edit form + PUT body; show scope in table |
| M2 | Admin coupons | `AdminCouponsTab.tsx` | Presets inherit custom scope | Force `applies_to: 'all'` on preset creates |
| M3 | Admin products | `AdminDashboard.tsx` | Search only over loaded pages | Server search or paginate-until-found |
| M4 | Admin products | `AdminCouponsTab`, `AdminReviewsTab` | Product pickers cap at 100 | Async searchable product combobox |
| M5 | Admin orders | `AdminDashboard.tsx` | Status filter drops active search | `fetchOrders(1, orderSearch)` on status change |
| M6 | Admin UI | `AdminDashboard.tsx` | Coupons/reviews tab skeleton flash | `setLoading(false)` on self-loading tabs |
| M7 | Activity | `activityTracker.ts` | `size_select`, `quantity_change` not wired | Call from ProductDetail size pick + CartContext qty changes |
| M8 | Activity | `PaymentSuccess.tsx` | `purchase_complete` missing on 409 poll success | Call `trackPurchaseComplete` when poll completes |
| M9 | Catalog | `productCatalogCache.ts` | TTL 3 min vs docs 15 min | Align code or docs |
| M10 | Checkout | `Checkout.tsx` | No client/server total compare before redirect | Compare create-payment response to displayed total |
| M11 | Payments | `orderCheckoutExchange.ts` | Hash collision → unredeemable code | Regenerate on `ON CONFLICT` |
| M12 | Webhooks | `paypalWebhookHandler.ts` | DENIED without order binding logs 200 | Resolve order ID; return 500 if unresolved |
| M13 | Activity API | `activity.ts` | DB errors return `success: true` | Return 500 or partial failure counts |
| M14 | Reviews | `reviews.ts` | Submit vs check message inconsistency | Unify generic copy |

---

## Low priority & info

| Item | Notes |
|------|--------|
| API-only admin UI | Activity export, PayPal refund/test, health detail — documented, intentional |
| `PROMO_COUPON_CODE` | Constant unused server-side — remove or implement |
| RLS table count | Standardize **14** in all guides (some say 13) |
| `test_guidelines.md` inventory | Stale file counts — regenerate from `Tests/` or link to reports |
| `info.md` auth legend `?token=` | Contradicts deprecated URL tokens — update legend |
| ReviewList “not helpful” button | Missing disabled styling after vote |
| PaymentSuccess missing `token` | Redirects to `/` silently — show error + `/orders` link |
| Dead code | `apiUtils.ts`, `tokens.ts` already removed |

---

## What is fully implemented (verified OK)

- PayPal create-payment atomic order + stock + exchange code
- Capture idempotency, `ORDER_ALREADY_CAPTURED` handling, amount mismatch auto-refund (capture path)
- **409** when capture succeeds but DB not completed (+ frontend processing UI)
- Checkout exchange encryption at rest; access-exchange for email links
- Coupon scope enforcement at checkout (`all` / `product` / `category`)
- Admin bulk limits (500), status transition validation, mark-paid PayPal verify
- CSRF, rate limits (Redis fail-closed), Cloudflare enforcement
- Review PII stripping (`toPublicReview`), admin moderation UI
- Storefront routes, cart validation + retry, legacy order URL deprecation
- Maintenance jobs (idempotency reaper, stale orders, exchange cleanup)
- 99 automated tests for helpers, partial API, UI smoke

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
| **FE-01** | Closed | Checkout blocks PayPal redirect when server `total` ≠ client total (> $0.01) |
| **FE-02** | Closed | `PaymentSuccess` error UI when PayPal `token` missing |
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
| **C5** | Critical | Payment paths mostly untested (409, webhook, mark-paid, exchange redeem API) | `captureReconciliation.test.ts`, `paypalWebhook.test.ts`, Playwright payment specs |
| **UI-PAY-409** | High | No Playwright for 409 poll / missing token | `payment-success-ui.spec.ts` |
| **ORD-MARK-PAID** | High | Admin mark-paid untested | `adminMarkPaid.test.ts` |
| **SEC-RLS** | Medium | No automated RLS/grant tests | `rlsMigration.test.ts` |

### Test sprint order (closes C5 without re-auditing)

1. `Tests/api/captureReconciliation.test.ts` — PAY-409, PAY-CONTEXT  
2. `Tests/api/paypalWebhook.test.ts` — PAY-WEBHOOK, PAY-WEBHOOK-DENIED  
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
| 2026-06-08 | FE-01 | Checkout compares server vs client total before PayPal redirect |
| 2026-06-08 | FE-02/FE-03 | PaymentSuccess missing-token and 409-timeout error UX |
| 2026-06-08 | FE-04 | Coupon cleared on cart signature change |
| 2026-06-08 | FE-05/FE-06 | Admin server product search; coupons/reviews/orders loading fixes |
| 2026-06-08 | F-06 | Reviews check — no product enumeration (200 generic) |
| 2026-06-08 | F-07 | Webhook DENIED → 500 when order binding fails |
| 2026-06-08 | F-04 | Production startup fails if client grants remain |
| 2026-06-08 | DB-01 | Checkout exchange + access_token_encrypted migration SQL files |
| 2026-06-08 | C5 | Partial — `activityBatch.test.ts`, `orderLookup.test.ts`, `computeCheckoutPricingForCart.test.ts` (111 tests total) |

*Append a line when closing each Critical/High item.*

---

## Related documents

- [`DOCUMENTATION_INDEX.md`](DOCUMENTATION_INDEX.md)
- [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md)
- [`ADMIN_DASHBOARD_GUIDE.md`](ADMIN_DASHBOARD_GUIDE.md)
- [`PAYPAL_TESTING_GUIDE.md`](PAYPAL_TESTING_GUIDE.md)
- [`test_guidelines.md`](test_guidelines.md)
