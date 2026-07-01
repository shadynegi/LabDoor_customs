# Critical Path Coverage Matrix

**Purpose:** Living map of documented behavior → implementation → tests. Update this file in the **same PR** as any change to payment, orders, webhooks, RLS, admin mark-paid, or related storefront flows (see [`.cursor/rules/documentation-sync.mdc`](../.cursor/rules/documentation-sync.mdc)).

**Authoritative behavior:** [`info.md`](info.md)  
**Full audit:** [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md) (2026-06-08 initial + follow-up)

**Test count marker (CI should match):** `<!-- tests: 207 -->` (103 unit + 61 API + 43 Playwright)

---

## How to use (avoid repeat full reviews)

1. Before merging a feature fix, find the row by **Behavior ID** and update **Status** + **Test(s)**.
2. New documented behavior → add a row; do not re-run a whole-project audit.
3. Release checklist: run **MANUAL-ONLY** rows in [`PRE_LAUNCH_CHECKLIST.md`](PRE_LAUNCH_CHECKLIST.md) / WhatsApp checkout section.
4. Quarterly: run `npm test`, skim this matrix for `MISSING` payment rows only — not a full repo audit.

**Status values:** `COVERED` | `PARTIAL` | `MISSING` | `MANUAL-ONLY` | `N/A`

---

## Payments & checkout

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| PAY-PLACE | Atomic place-order + stock reserve + WhatsApp URL | `checkout.ts`, `orderLifecycle.ts`, `whatsappCheckout.ts` | `checkout.test.ts`, `checkoutWhatsAppIntegration.test.ts`, `checkoutPricing.test.ts`, `whatsappCheckout.test.ts` | COVERED |
| PAY-WA-MSG | WhatsApp message includes order id (UUID), items, totals | `whatsappCheckout.ts` | `whatsappCheckout.test.ts`, `checkoutWhatsAppIntegration.test.ts` | COVERED |
| PAY-VOLUME | Volume discount 10%/20% in pricing | `checkoutPricing.ts` | `checkoutPricing.test.ts`, `couponValidateVolume.test.ts` | COVERED |
| PAY-SHIPPING | Free shipping threshold $200 | `checkoutPricing.ts`, `pricing.ts` | `checkoutPricing.test.ts` | COVERED |
| PAY-FE-TOTAL | Client compares server total before place-order | `Checkout.tsx`, `checkout.ts` | `checkout.test.ts` | COVERED |
| PAY-POLICY | `policy_accepted: true` required on place-order | `checkout.ts`, `returnPolicy.ts`, `Checkout.tsx` | `checkout.test.ts`, `deep-flows-ui.spec.ts` | COVERED |
| PAY-VALIDATE | Cart price/stock validation before checkout | `products.ts`, `CartContext.tsx` | `validateCart.test.ts` | COVERED |
| POL-ADMIN | Admin refund route removed + paid-order cancel 403 | `orders.ts`, `returnPolicy.ts` | `orderPolicyAdmin.test.ts`, `security.test.ts` | COVERED |

---

## Orders & access

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| ORD-LOOKUP | `POST /orders/lookup` body token | `orders.ts` L252+ | `orderLookup.test.ts` | COVERED |
| ORD-ENUM | Uniform 404 for bad number vs bad token | `orders.ts` `orderAccessDenied` | `security.test.ts` | COVERED |
| ORD-ACCESS-EX | Email `?code=` → access exchange | `orderAccessExchange.ts`, `MyOrders.tsx` | `orderAccessExchange.test.ts`, `orders-ui.spec.ts` | COVERED |
| ORD-EMAIL-LINK | Confirmation email one-time tracking link | `email.ts` `buildOrderPortalUrl` | `emailPortalUrl.test.ts` | COVERED |
| ORD-EMAIL-CONFIRM | Mark-paid confirmation emails include exchange link | `orderAccessExchange.ts` `getOrderAccessTokenForEmail` | `orderAccessExchange.test.ts`, `emailPortalUrl.test.ts` | COVERED |
| ORD-MARK-PAID | Admin mark paid + activity log | `orders.ts`, `paymentReconciliation.ts` | `adminMarkPaid.test.ts` | COVERED |
| ORD-TOKEN-STORE | Durable access token for post–mark-paid email minting | `orders.access_token_encrypted` | `orderAccessExchange.test.ts` | COVERED |

---

## Security & bootstrap

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| SEC-RLS | 14 tables service_role-only + grant revoke | `rlsMigration.ts` | `rlsMigration.test.ts`, `rlsGrantRevoke.test.ts` | COVERED |
| SEC-BOOTSTRAP | `BOOTSTRAP_SKIP_DDL` must not skip grant revoke | `rlsMigration.ts` | `rlsMigration.test.ts`, `rlsGrantRevoke.test.ts` | COVERED |
| SEC-CSRF | Double-submit + activity batch exempt | `csrf.ts`, `activity.ts` | `security.test.ts` (incl. logout CSRF) | COVERED |
| SEC-RATE | Redis fail-closed rate limits | `rateLimits.ts`, `rateLimitStore.ts` | `security.test.ts` | COVERED |

---

## Reviews, coupons, activity

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| REV-CHECK | `POST /reviews/check` no enumeration | `reviews.ts` `checkReviewEligibility` | `reviewsCheck.test.ts` | COVERED |
| REV-PUBLIC | `toPublicReview()` strips PII | `reviewHelpers.ts` | `reviewHelpers.test.ts` | COVERED |
| CPN-SCOPE | Coupon `applies_to` at checkout | `checkoutPricing.ts`, `coupons.ts` | `couponScope.test.ts` | COVERED |
| CPN-VALIDATE | Validate matches place-order pricing | `coupons.ts`, `checkoutPricing.ts` | `couponValidateVolume.test.ts`, `computeCheckoutPricingForCart.test.ts` | COVERED |
| ACT-BATCH | Activity batch allowed action types | `activity.ts` | `activityBatch.test.ts` | COVERED |
| ACT-CONTACT | Contact form submit tracked | `activityTracker.ts`, `ContactUs.tsx` | `activityBatch.test.ts` | COVERED |
| ACT-LOG | Single activity log errors surface | `activity.ts` `/log` | `activityLog.test.ts` | COVERED |

---

## Storefront UI (Playwright)

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| UI-SMOKE | Home, products, cart, checkout shell, contact | `Tests/frontend/*.spec.ts` | 43 tests | COVERED |
| UI-ORDER-CONFIRM | Payment success / order received confirmation | `PaymentSuccess.tsx` | `deep-flows-ui.spec.ts` | COVERED |
| UI-ORDERS | Orders legacy `?token=` strip + `?code=` email redeem | `MyOrders.tsx` | `orders-ui.spec.ts` | COVERED |
| UI-ADMIN | Admin `/admin` redirect, login, dashboard analytics smoke | `AdminLogin.tsx`, `AdminDashboard.tsx`, `App.tsx` | `admin-ui.spec.ts` | COVERED |
| UI-ADMIN-ANALYTICS | Custom IST range Apply-before-export + CSV enablement | `AdminDashboard.tsx`, `adminAnalyticsDates.ts` | `admin-analytics-ui.spec.ts` | COVERED |
| UI-CHECKOUT-COUNTRY | Checkout country pre-selected (`country-list` US value) | `Checkout.tsx`, `constants/checkoutForm.ts` | `checkout-ui.spec.ts` | COVERED |
| UI-CHECKOUT-PAY | Place Order after policy + form fill | `Checkout.tsx`, `helpers/checkout.ts` | `checkout-place-order-ui.spec.ts`, `deep-flows-ui.spec.ts` | COVERED |
| UI-PRODUCT-POLICY | Product detail trust badges match no-refund policy | `ProductDetailPage.tsx`, `constants/returnPolicy.ts` | `deep-flows-ui.spec.ts` | COVERED |
| UI-DEEP-FLOWS | Search, policy gate, coupon, cart qty, order confirmation | `deep-flows-ui.spec.ts`, `mock-api.ts` | `deep-flows-ui.spec.ts` | COVERED |
| UI-RESPONSIVE | Mobile checkout/cart sticky CTA, overflow, admin login | `CartPage.tsx`, `MobileStickyCta.tsx`, `responsive.css` | `responsive-ui.spec.ts`, `mobile-ui.spec.ts` | COVERED |

---

## Database & schema

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| DB-CHECKOUT-EX | Legacy `order_checkout_exchanges` in SQL migrations (maintenance cleanup only) | `schema.sql`, `migration-order-checkout-exchange.sql` | — | N/A |
| DB-RLS-14 | All 14 RLS tables in operator runbook + audit SQL | `rlsMigration.ts`, `SUPABASE_SQL_TO_RUN.md` | `rlsMigration.test.ts` | COVERED |
| DOC-RLS-COUNT | 14 RLS tables in functional guides | various | `rlsMigration.test.ts` | COVERED |

---

## CI & docs

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| CI-ENV | Production env validation in CI | `validate-env.mjs`, `ci.yml` | CI job | COVERED |
| SEC-ORDER-SECRETS | `access_token_hash` + `access_token_encrypted` stripped from order JSON | `orderTokens.ts` `stripOrderSecrets` | `orderTokens.test.ts` | COVERED |
| DOC-TESTS | Test count in `info.md` | `info.md` | `npm test` (207) | COVERED |
| PERF-BUDGET | Frontend JS bundle budget contract | `frontend/scripts/build-budget.mjs` | `performanceBudgets.test.ts` | COVERED |
| STAB-SMOKE | Parallel health + CSRF latency smoke | `server.ts`, `csrf.ts` | `stabilityConcurrency.test.ts` | COVERED |

---

## Admin inventory & analytics

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| ADM-INV-MOVE | Stock changes logged to `inventory_movements` | `inventoryMovements.ts`, `inventory.ts` | `adminEnhancements.test.ts` | COVERED |
| ADM-LOW-STOCK | Low-stock list + reorder point | `inventoryMovements.ts`, `admin.ts` | `adminEnhancements.test.ts` | COVERED |
| ADM-CUST-NOTES | Customer admin notes + PATCH | `admin.ts` | `adminEnhancements.test.ts` | COVERED |
| ADM-ORD-EDIT | Pending order customer-details + line items | `adminOrderEdits.ts`, `orders.ts` | `adminEnhancements.test.ts` | COVERED |
| ADM-ANALYTICS | Period sales analytics + CSV export | `salesAnalytics.ts`, `adminAnalytics.ts` | `salesAnalytics.test.ts`, `adminEnhancements.test.ts`, `adminAnalytics.test.ts` | COVERED |
| ADM-ANALYTICS-IST | IST calendar boundaries + invalid custom dates | `analyticsIst.ts`, `adminAnalyticsDates.ts`, `salesAnalytics.ts` | `analyticsIst.test.ts`, `adminAnalyticsDates.test.ts`, `salesAnalytics.test.ts`, `adminAnalytics.test.ts` | COVERED |

---

## Maintenance rule

When closing an audit item:

1. Change **Status** to `COVERED` or `PARTIAL` with test file path.
2. Update [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md) **Remediation log** (append dated line).
3. Sync [`info.md`](info.md) if behavior changed.

Do **not** schedule another full-repo audit unless a major architecture change occurs (new payment provider, DB migration platform, etc.).
