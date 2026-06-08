# Critical Path Coverage Matrix

**Purpose:** Living map of documented behavior → implementation → tests. Update this file in the **same PR** as any change to payment, orders, webhooks, RLS, admin mark-paid, or related storefront flows (see [`.cursor/rules/documentation-sync.mdc`](../.cursor/rules/documentation-sync.mdc)).

**Authoritative behavior:** [`info.md`](info.md)  
**Full audit (2026-06-08):** [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md)

**Test count marker (CI should match):** `<!-- tests: 105 -->` (67 unit + 16 API + 22 Playwright)

---

## How to use (avoid repeat full reviews)

1. Before merging a feature fix, find the row by **Behavior ID** and update **Status** + **Test(s)**.
2. New documented behavior → add a row; do not re-run a whole-project audit.
3. Release checklist: run **MANUAL-ONLY** rows in [`PRE_LAUNCH_CHECKLIST.md`](PRE_LAUNCH_CHECKLIST.md) / PayPal sandbox section.

**Status values:** `COVERED` | `PARTIAL` | `MISSING` | `MANUAL-ONLY` | `N/A`

---

## Payments & checkout

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| PAY-CREATE | Atomic create-payment + stock reserve + exchange code | `server.ts`, `orderLifecycle.ts`, `orderCheckoutExchange.ts` | `checkout.test.ts`, `checkoutPricing.test.ts` | PARTIAL |
| PAY-CAPTURE | Capture with token + amount validation | `server.ts` L925+ | `checkout.test.ts` (binding only) | PARTIAL |
| PAY-409 | Capture 409 when PayPal OK but DB not completed; UI polls context | `server.ts` L1162+, `PaymentSuccess.tsx` | — | **MISSING** |
| PAY-EXCHANGE | Checkout exchange single-use redeem | `orderCheckoutExchange.ts` | `orderCheckoutExchange.test.ts` (hash only) | PARTIAL |
| PAY-CONTEXT | Checkout-context recovery (`X-Order-Access-Token`) | `server.ts` L1280+ | — | **MISSING** |
| PAY-WEBHOOK | `PAYMENT.CAPTURE.COMPLETED` reconciliation + 500 retry | `paypalWebhookHandler.ts`, `paymentReconciliation.ts` | `paypalWebhookUtils.test.ts` (utils only) | PARTIAL |
| PAY-REFUND-MISMATCH | Auto-refund on capture amount mismatch | `server.ts`, `paymentReconciliation.ts` | — | **MISSING** |
| PAY-VOLUME | Volume discount 10%/20% in pricing | `paypalCheckout.ts` L23-35 | `checkoutPricing.test.ts` | COVERED |
| PAY-SHIPPING | Free shipping threshold $200 | `paypalCheckout.ts`, `pricing.ts` | `checkoutPricing.test.ts` | COVERED |

---

## Orders & access

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| ORD-LOOKUP | `POST /orders/lookup` body token | `orders.ts` L262+ | — | **MISSING** |
| ORD-ENUM | Uniform 404 for bad number vs bad token | `orders.ts` `orderAccessDenied` | `security.test.ts` | COVERED |
| ORD-ACCESS-EX | Email `?code=` → access exchange | `orderAccessExchange.ts`, `MyOrders.tsx` | — | **MISSING** |
| ORD-EMAIL-LINK | Confirmation email one-time tracking link | `email.ts` `resolveOrderPortalUrl` | — | PARTIAL |
| ORD-EMAIL-WEBHOOK | Webhook/admin capture emails include exchange link | `email.ts` `issueOrderTrackingExchangeFromOrder` | — | PARTIAL |
| ORD-MARK-PAID | Admin mark paid + PayPal verify + activity log | `orders.ts` L661+, `paypalCaptureVerify.ts` | — | **MISSING** |

---

## Security & bootstrap

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| SEC-RLS | 14 tables service_role-only + grant revoke | `rlsMigration.ts` | — | **MISSING** |
| SEC-BOOTSTRAP | `BOOTSTRAP_SKIP_DDL` must not skip grant revoke | `rlsMigration.ts` L211-214 | — | **MISSING** |
| SEC-CSRF | Double-submit + activity batch exempt | `csrf.ts`, `activity.ts` | `security.test.ts` | PARTIAL |
| SEC-RATE | Redis fail-closed rate limits | `rateLimits.ts`, `rateLimitStore.ts` | `security.test.ts` | COVERED |

---

## Reviews, coupons, activity

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| REV-CHECK | `POST /reviews/check` no enumeration | `reviews.ts` L628+ | — | **MISSING** |
| REV-PUBLIC | `toPublicReview()` strips PII | `reviewHelpers.ts` | `reviewHelpers.test.ts` | COVERED |
| CPN-SCOPE | Coupon `applies_to` at checkout | `paypalCheckout.ts`, `coupons.ts` | — | PARTIAL |
| CPN-VALIDATE | Validate matches create-payment pricing | `coupons.ts` vs `paypalCheckout.ts` | — | **DRIFT** |
| ACT-BATCH | Activity batch allowed action types | `activity.ts` `ALLOWED_ACTION_TYPES` | — | COVERED |
| ACT-CONTACT | Contact form submit tracked | `activityTracker.ts`, `ContactUs.tsx` | — | **MISSING** (silent drop) |

---

## Storefront UI (Playwright)

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| UI-SMOKE | Home, products, cart, checkout shell, contact | `Tests/frontend/*.spec.ts` | 22 tests | COVERED |
| UI-PAY-409 | Payment success 409 processing UI | `PaymentSuccess.tsx` | — | **MISSING** |
| UI-ORDERS | Orders `?code=` redeem + legacy strip | `MyOrders.tsx` | — | **MISSING** |
| UI-ADMIN | Admin tabs smoke | — | — | MANUAL-ONLY |

---

## CI & docs

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| CI-ENV | Production env validation in CI | `validate-env.mjs`, `ci.yml` | CI job | **DRIFT** (JWT placeholder may fail rules) |
| DOC-TESTS | Test count in `info.md` | `info.md` L997 | `npm test` | COVERED |
| DOC-RLS-COUNT | 14 RLS tables in all guides | various | — | **DRIFT** (some say 13) |

---

## Maintenance rule

When closing an audit item:

1. Change **Status** to `COVERED` or `PARTIAL` with test file path.
2. Update [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md) **Remediation log** (append dated line).
3. Sync [`info.md`](info.md) if behavior changed.

Do **not** schedule another full-repo audit unless a major architecture change occurs (new payment provider, DB migration platform, etc.).
