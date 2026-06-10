# Critical Path Coverage Matrix

**Purpose:** Living map of documented behavior → implementation → tests. Update this file in the **same PR** as any change to payment, orders, webhooks, RLS, admin mark-paid, or related storefront flows (see [`.cursor/rules/documentation-sync.mdc`](../.cursor/rules/documentation-sync.mdc)).

**Authoritative behavior:** [`info.md`](info.md)  
**Full audit:** [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md) (2026-06-08 initial + follow-up)

**Test count marker (CI should match):** `<!-- tests: 150 -->` (81 unit + 41 API + 28 Playwright)

---

## How to use (avoid repeat full reviews)

1. Before merging a feature fix, find the row by **Behavior ID** and update **Status** + **Test(s)**.
2. New documented behavior → add a row; do not re-run a whole-project audit.
3. Release checklist: run **MANUAL-ONLY** rows in [`PRE_LAUNCH_CHECKLIST.md`](PRE_LAUNCH_CHECKLIST.md) / PayPal sandbox section.
4. Quarterly: run `npm test`, skim this matrix for `MISSING` payment rows only — not a full repo audit.

**Status values:** `COVERED` | `PARTIAL` | `MISSING` | `MANUAL-ONLY` | `N/A`

---

## Payments & checkout

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| PAY-CREATE | Atomic create-payment + stock reserve + exchange code | `server.ts`, `orderLifecycle.ts`, `orderCheckoutExchange.ts` | `checkout.test.ts`, `checkoutPricing.test.ts`, `createPaymentHappy.test.ts` | COVERED |
| PAY-CAPTURE | Capture with token + amount validation | `server.ts` L925+ | `checkout.test.ts`, `captureRefundMismatch.test.ts` | PARTIAL |
| PAY-409 | Capture 409 when PayPal OK but DB not completed; UI polls context | `server.ts`, `PaymentSuccess.tsx` | `captureReconciliation.test.ts`, `payment-success-ui.spec.ts` | COVERED |
| PAY-EXCHANGE | Checkout exchange single-use redeem | `orderCheckoutExchange.ts` | `checkoutExchange.test.ts`, `orderCheckoutExchange.test.ts` | COVERED |
| PAY-CONTEXT | Checkout-context recovery (`X-Order-Access-Token`) | `server.ts` L1280+ | `checkoutContext.test.ts` | COVERED |
| PAY-WEBHOOK | `PAYMENT.CAPTURE.COMPLETED` reconciliation + 500 retry | `paypalWebhookHandler.ts`, `paymentReconciliation.ts` | `paypalWebhook.test.ts`, `paypalWebhookUtils.test.ts` | COVERED |
| PAY-WEBHOOK-DENIED | DENIED without order binding → 500 retry | `paypalWebhookHandler.ts` | `paypalWebhook.test.ts` | COVERED |
| PAY-REFUND-MISMATCH | Auto-refund on capture amount mismatch | `server.ts`, `paymentReconciliation.ts` | `captureRefundMismatch.test.ts` | COVERED |
| PAY-VOLUME | Volume discount 10%/20% in pricing | `paypalCheckout.ts` L23-35 | `checkoutPricing.test.ts`, `couponValidateVolume.test.ts` | COVERED |
| PAY-SHIPPING | Free shipping threshold $200 | `paypalCheckout.ts`, `pricing.ts` | `checkoutPricing.test.ts` | COVERED |
| PAY-FE-TOTAL | Client compares server total before PayPal redirect | `Checkout.tsx` | `checkout-total-mismatch-ui.spec.ts` | COVERED |

---

## Orders & access

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| ORD-LOOKUP | `POST /orders/lookup` body token | `orders.ts` L252+ | `orderLookup.test.ts` | COVERED |
| ORD-ENUM | Uniform 404 for bad number vs bad token | `orders.ts` `orderAccessDenied` | `security.test.ts` | COVERED |
| ORD-ACCESS-EX | Email `?code=` → access exchange | `orderAccessExchange.ts`, `MyOrders.tsx` | `orderAccessExchange.test.ts`, `orders-ui.spec.ts` | COVERED |
| ORD-EMAIL-LINK | Confirmation email one-time tracking link | `email.ts` `buildOrderPortalUrl` | `emailPortalUrl.test.ts` | COVERED |
| ORD-EMAIL-WEBHOOK | Webhook/admin capture emails include exchange link | `orderAccessExchange.ts` `getOrderAccessTokenForEmail` | `orderAccessExchange.test.ts` | PARTIAL |
| ORD-MARK-PAID | Admin mark paid + PayPal verify + activity log | `orders.ts`, `paypalCaptureVerify.ts` | `adminMarkPaid.test.ts` | COVERED |
| ORD-TOKEN-STORE | Durable access token for post-capture email minting | `orders.access_token_encrypted` | `orderAccessExchange.test.ts` | COVERED |

---

## Security & bootstrap

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| SEC-RLS | 14 tables service_role-only + grant revoke | `rlsMigration.ts` | `rlsMigration.test.ts`, `rlsGrantRevoke.test.ts` | COVERED |
| SEC-BOOTSTRAP | `BOOTSTRAP_SKIP_DDL` must not skip grant revoke | `rlsMigration.ts` | `rlsMigration.test.ts`, `rlsGrantRevoke.test.ts` | COVERED |
| SEC-CSRF | Double-submit + activity batch exempt | `csrf.ts`, `activity.ts` | `security.test.ts` | PARTIAL |
| SEC-RATE | Redis fail-closed rate limits | `rateLimits.ts`, `rateLimitStore.ts` | `security.test.ts` | COVERED |

---

## Reviews, coupons, activity

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| REV-CHECK | `POST /reviews/check` no enumeration | `reviews.ts` `checkReviewEligibility` | `reviewsCheck.test.ts` | COVERED |
| REV-PUBLIC | `toPublicReview()` strips PII | `reviewHelpers.ts` | `reviewHelpers.test.ts` | COVERED |
| CPN-SCOPE | Coupon `applies_to` at checkout | `paypalCheckout.ts`, `coupons.ts` | `couponScope.test.ts` | COVERED |
| CPN-VALIDATE | Validate matches create-payment pricing | `coupons.ts`, `paypalCheckout.ts` | `couponValidateVolume.test.ts`, `computeCheckoutPricingForCart.test.ts` | COVERED |
| ACT-BATCH | Activity batch allowed action types | `activity.ts` | `activityBatch.test.ts` | COVERED |
| ACT-CONTACT | Contact form submit tracked | `activityTracker.ts`, `ContactUs.tsx` | `activityBatch.test.ts` | COVERED |
| ACT-LOG | Single activity log errors surface | `activity.ts` `/log` | `activityLog.test.ts` | COVERED |

---

## Storefront UI (Playwright)

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| UI-SMOKE | Home, products, cart, checkout shell, contact | `Tests/frontend/*.spec.ts` | 28 tests | COVERED |
| UI-PAY-409 | Payment success missing token error UX | `PaymentSuccess.tsx` | `payment-success-ui.spec.ts` | COVERED |
| UI-PAY-TOKEN | Missing PayPal `token` error UX | `PaymentSuccess.tsx` | `payment-success-ui.spec.ts` | COVERED |
| UI-ORDERS | Orders legacy `?token=` strip + `?code=` email redeem | `MyOrders.tsx` | `orders-ui.spec.ts` | COVERED |
| UI-ADMIN | Admin login redirect + dashboard analytics smoke | `AdminLogin.tsx`, `AdminDashboard.tsx` | `admin-ui.spec.ts` | COVERED |

---

## Database & schema

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| DB-CHECKOUT-EX | `order_checkout_exchanges` in SQL migrations | `schema.sql`, `migration-order-checkout-exchange.sql` | — | COVERED |
| DB-RLS-14 | All 14 RLS tables in operator runbook | `schema.sql` + migrations | `rlsMigration.test.ts` | PARTIAL |
| DOC-RLS-COUNT | 14 RLS tables in functional guides | various | `rlsMigration.test.ts` | COVERED |

---

## CI & docs

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| CI-ENV | Production env validation in CI | `validate-env.mjs`, `ci.yml` | CI job | COVERED |
| DOC-TESTS | Test count in `info.md` | `info.md` | `npm test` (150) | COVERED |

---

## Maintenance rule

When closing an audit item:

1. Change **Status** to `COVERED` or `PARTIAL` with test file path.
2. Update [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md) **Remediation log** (append dated line).
3. Sync [`info.md`](info.md) if behavior changed.

Do **not** schedule another full-repo audit unless a major architecture change occurs (new payment provider, DB migration platform, etc.).
