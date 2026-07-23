# Critical Path Coverage Matrix

**Purpose:** Living map of documented behavior → implementation → tests. Update this file in the **same PR** as any change to payment, orders, webhooks, RLS, admin mark-paid, or related storefront flows (see [`.cursor/rules/documentation-sync.mdc`](../.cursor/rules/documentation-sync.mdc)).

**Authoritative behavior:** [`info.md`](info.md)  
**Full audit:** [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md) (2026-06-08 initial + follow-up)

**Test count marker (CI should match):** `<!-- tests: 528 -->` (138 unit + 86 API + 13 frontend unit + 286 Playwright + 5 viewport)

**Test layout:** Domain folders under `Tests/unit/backend/`, `Tests/integration/api/`, `Tests/e2e/specs/`. Inventory: [`Tests/README.md`](../Tests/README.md), [`test_guidelines.md`](test_guidelines.md).

---

## How to use (avoid repeat full reviews)

1. Before merging a feature fix, find the row by **Behavior ID** and update **Status** + **Test(s)**.
2. New documented behavior → add a row; do not re-run a whole-project audit.
3. Release checklist: run **MANUAL-ONLY** rows in [`PRE_LAUNCH_CHECKLIST.md`](PRE_LAUNCH_CHECKLIST.md) / WhatsApp checkout section, and the release regression section in [`manual-qa-test-cases.md`](manual-qa-test-cases.md).
4. Quarterly: run `npm test`, skim this matrix for `MISSING` payment rows only — not a full repo audit.

**Status values:** `COVERED` | `PARTIAL` | `MISSING` | `MANUAL-ONLY` | `N/A`

---

## Payments & checkout

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| PAY-PLACE | Atomic place-order + stock reserve + WhatsApp URL | `checkout.ts`, `orderLifecycle.ts`, `whatsappCheckout.ts` | `place-order.validation.test.ts`, `place-order.whatsapp.test.ts`, `checkoutPricing.test.ts`, `whatsappCheckout.test.ts`, `clientId.test.ts` | COVERED |
| PAY-WA-MSG | WhatsApp message includes order id (UUID), items, totals | `whatsappCheckout.ts` | `whatsappCheckout.test.ts`, `place-order.whatsapp.test.ts` | COVERED |
| PAY-VOLUME | Volume discount 10%/20% in pricing | `checkoutPricing.ts` | `checkoutPricing.test.ts`, `couponValidateVolume.test.ts` | COVERED |
| PAY-SHIPPING | Free shipping threshold $200 | `checkoutPricing.ts`, `pricing.ts` | `checkoutPricing.test.ts` | COVERED |
| PAY-FE-TOTAL | Client compares server total before place-order | `Checkout.tsx`, `checkout.ts` | `place-order.validation.test.ts` | COVERED |
| PAY-POLICY | `policy_accepted: true` required on place-order | `checkout.ts`, `returnPolicy.ts`, `Checkout.tsx` | `place-order.validation.test.ts`, `deep-flows-ui.spec.ts` | COVERED |
| PAY-VALIDATE | Cart price/stock/size validation before checkout (whole-number sizes) | `products.ts`, `cartLineSize.ts`, `CartContext.tsx` | `validate-cart.test.ts`, `cartLineSize.test.ts` | COVERED |
| POL-ADMIN | Admin refund route removed + paid-order cancel 403 | `orders.ts`, `returnPolicy.ts` | `order-policy-admin.test.ts`, `security.test.ts` | COVERED |

---

## Orders & access

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| ORD-LOOKUP | `POST /orders/lookup` with orderId + email | `orders.ts` | `orders/lookup.test.ts` | COVERED |
| ORD-ENUM | Uniform 404 for bad id vs bad email | `orders.ts` | `orders/lookup.test.ts` | COVERED |
| ORD-TRACK-SHIP | Shipped order tracking fields in lookup | `orders.ts` | `orders/lookup.test.ts` | COVERED |
| ORD-ACCESS-DEP | Deprecated access-exchange links return 410 | `orders.ts` | `orders/lookup.test.ts`, `security.test.ts` | COVERED |
| ORD-PORTAL-LINK | Order tracking URL with orderId | `orderPortalUrl.ts` `buildOrderPortalUrl` | `orderPortalUrl.test.ts` | COVERED |
| ORD-MARK-PAID | Admin mark paid + WhatsApp notifications + activity log | `orders.ts`, `paymentReconciliation.ts`, `postPaymentCapture.ts` | `mark-paid.test.ts`, `postPaymentCapture.test.ts`, `whatsapp-payment-confirmation.test.ts` | COVERED |
| WA-PAY-CONFIRM | WhatsApp Cloud API payment confirmation text | `whatsappNotifications.ts`, `postPaymentCapture.ts` | `whatsappNotifications.test.ts`, `whatsapp-payment-confirmation.test.ts` | COVERED |

---

## Security & bootstrap

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| SEC-RLS | 10 client-revoked tables + service_role-only RLS + grant revoke | `rlsMigration.ts` | `rlsMigration.test.ts`, `rlsGrantRevoke.test.ts` | COVERED |
| SEC-BOOTSTRAP | `BOOTSTRAP_SKIP_DDL` must not skip grant revoke | `rlsMigration.ts` | `rlsMigration.test.ts`, `rlsGrantRevoke.test.ts` | COVERED |
| SEC-CSRF | Double-submit + activity batch exempt | `csrf.ts`, `activity.ts` | `security.test.ts` (incl. logout CSRF) | COVERED |
| SEC-ADMIN-USERS | Primary + optional additional admin logins | `adminCredentials.ts`, `admin.ts` | `adminCredentials.test.ts` | COVERED |
| SEC-RATE | Redis fail-closed rate limits | `rateLimits.ts`, `rateLimitStore.ts` | `security.test.ts` | COVERED |

---

## Coupons, activity

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| CPN-SCOPE | Coupon `applies_to` (`all` / `product`) at checkout | `checkoutPricing.ts`, `coupons.ts` | `couponScope.test.ts` | COVERED |
| CPN-VALIDATE | Validate matches place-order pricing | `coupons.ts`, `checkoutPricing.ts` | `couponValidateVolume.test.ts`, `computeCheckoutPricingForCart.test.ts` | COVERED |
| ACT-BATCH | Activity batch allowed action types | `activity.ts` | `activity/batch.test.ts` | COVERED |
| ACT-CONTACT | Contact form submit tracked | `activityTracker.ts`, `ContactUs.tsx` | `activity/batch.test.ts`, `contact-ui.spec.ts` | COVERED |
| ACT-LOG | Single activity log errors surface | `activity.ts` `/log` | `activity/log.test.ts` | COVERED |

---

## Storefront UI (Playwright)

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| UI-SMOKE | Home, products, cart, checkout shell, contact | `Tests/e2e/specs/**/*.spec.ts` | 93 desktop + 193 mobile tests | COVERED |
| UI-ORDER-CONFIRM | Payment success / order received confirmation | `PaymentSuccess.tsx` | `deep-flows-ui.spec.ts` | COVERED |
| UI-ORDERS | Orders page orderId + email lookup | `MyOrders.tsx` | `orders-ui.spec.ts` | COVERED |
| UI-ORDERS-SHIP | Shipped order tracking link on orders page | `MyOrders.tsx` | `orders-ui.spec.ts` | COVERED |
| UI-ADMIN | Admin `/admin` redirect, login, dashboard analytics smoke | `AdminLogin.tsx`, `AdminDashboard.tsx`, `App.tsx` | `admin-ui.spec.ts` | COVERED |
| UI-ADMIN-ANALYTICS | Custom IST range Apply-before-export + CSV enablement | `AdminDashboard.tsx`, `adminAnalyticsDates.ts` | `admin-analytics-ui.spec.ts` | COVERED |
| UI-ADMIN-CRUD | Admin Products/Coupons/Orders/Customers/Settings CRUD + order modal + integration/resilience/env/storage | `AdminDashboard.tsx`, `AdminCouponsTab.tsx`, `Tests/e2e/specs/admin/*.spec.ts` | 59 tests in 11 module specs (+ auth/analytics) | COVERED |
| UI-CHECKOUT-COUNTRY | Checkout country pre-selected (`country-list` US value) | `Checkout.tsx`, `constants/checkoutForm.ts` | `checkout-ui.spec.ts` | COVERED |
| UI-CHECKOUT-PAY | Place Order after policy + form fill | `Checkout.tsx`, `helpers/checkout.ts` | `checkout-place-order-ui.spec.ts`, `deep-flows-ui.spec.ts` | COVERED |
| UI-PRODUCT-POLICY | Product detail trust badges match no-refund policy | `ProductDetailPage.tsx`, `constants/returnPolicy.ts` | `deep-flows-ui.spec.ts` | COVERED |
| UI-DEEP-FLOWS | Search, policy gate, coupon, cart qty, order confirmation | `deep-flows-ui.spec.ts`, `mock-api.ts` | `deep-flows-ui.spec.ts` | COVERED |
| UI-RESPONSIVE | Mobile checkout/cart sticky CTA, overflow, admin login | `CartPage.tsx`, `MobileStickyCta.tsx`, `responsive.css` | `responsive-ui.spec.ts`, `mobile-ui.spec.ts` | COVERED |
| UI-RESPONSIVE-PAGES | All storefront routes × 11 phone viewports (incl. 320px); cart policy above sticky bar | `responsive-pages-ui.spec.ts`, `helpers/viewports.ts` | 193 tests (`mobile-chrome`) | COVERED |

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
| CI-ENV | Production env validation in CI | `validate-env.mjs`, `server.ts`, `databaseUrl.ts`, `ci.yml` | `infrastructure/validateEnv.test.ts`, CI job | COVERED |
| OPS-UPLOAD-VOL | Admin uploads persist on Railway volume (`UPLOAD_DIR`) | `productUpload.ts`, `POST /api/admin/uploads/product-media` | `products/upload-persistence.test.ts`, `products/upload.test.ts`, `e2e/specs/admin/storage-persistence.spec.ts` (mocked UI) | COVERED |
| SEC-ORDER-SECRETS | `access_token_hash` + `access_token_encrypted` stripped from order JSON | `orderTokens.ts` `stripOrderSecrets` | `orderTokens.test.ts` | COVERED |
| DOC-TESTS | Test count in `info.md` | `info.md` | `npm test` (528) | COVERED |
| OPS-AUDIT | Codebase optimization baseline | `scripts/audit-codebase.mjs` | `npm run audit:codebase` | COVERED |
| UI-SCROLL | Document scroll on tall storefront pages | `frontend/src/index.css`, `App.tsx`, `Home.tsx` | `storefront.spec.ts` | COVERED |
| UI-POLICY-CONTENT | Shipping policy matches checkout pricing; contact opens WhatsApp with prefilled message | `ShippingPolicy.tsx`, `ContactUs.tsx`, `pricing.ts`, `whatsappContact.ts` | `storefront.spec.ts`, `contact-ui.spec.ts`, `unit/frontend/lib/whatsappContact.test.ts` | COVERED |
| UI-OOS-TOGGLE | Admin out-of-stock switch + storefront stock badges | `ToggleSwitch.tsx`, `AdminDashboard.tsx`, `ProductsPage.tsx` | `unit/frontend/components/ToggleSwitch.test.tsx`, `products-ui.spec.ts` | COVERED |
| UI-VIEWPORT-AUDIT | No horizontal overflow across breakpoints | `Tests/scripts/audit-viewport-overflow.mjs` | `npm test` viewport audit gate | COVERED |
| PERF-BUDGET | Frontend JS bundle budget contract | `frontend/scripts/build-budget.mjs` | `performanceBudgets.test.ts` | COVERED |
| STAB-SMOKE | Parallel health + CSRF latency smoke | `server.ts`, `csrf.ts` | `security/stability-concurrency.test.ts` | COVERED |

---

## Admin inventory & analytics

| ID | Behavior | Implementation | Test(s) | Status |
|----|----------|----------------|---------|--------|
| ADM-INV-MOVE | Stock changes logged to `inventory_movements` | `inventoryMovements.ts`, `inventory.ts` | `admin/enhancements.test.ts` | COVERED |
| ADM-LOW-STOCK | Low-stock list (fixed 5-unit threshold) | `inventoryMovements.ts`, `admin.ts` | `admin/enhancements.test.ts` | COVERED |
| ADM-CUST-NOTES | Customer admin notes + PATCH | `admin.ts` | `admin/enhancements.test.ts` | COVERED |
| ADM-ORD-EDIT | Pending order customer-details + line items | `adminOrderEdits.ts`, `orders.ts` | `admin/enhancements.test.ts` | COVERED |
| ADM-ANALYTICS | Period sales analytics + CSV export | `salesAnalytics.ts`, `adminAnalytics.ts` | `salesAnalytics.test.ts`, `admin/enhancements.test.ts`, `admin/analytics.test.ts` | COVERED |
| ADM-ANALYTICS-IST | IST calendar boundaries + invalid custom dates | `analyticsIst.ts`, `adminAnalyticsDates.ts`, `salesAnalytics.ts` | `analyticsIst.test.ts`, `adminAnalyticsDates.test.ts`, `salesAnalytics.test.ts`, `admin/analytics.test.ts` | COVERED |
| ADM-OOS-TOGGLE | Per-product `is_out_of_stock` via admin UI | `AdminDashboard.tsx`, `PUT /api/products/:id` | `unit/frontend/components/ToggleSwitch.test.tsx` | COVERED |
| ADM-SESSION-CACHE | 10s in-memory session verify cache + logout invalidation | `admin.ts` `validateAdminSession` | `admin/session-verify-cache.test.ts` | COVERED |

---

## Maintenance rule

When closing an audit item:

1. Change **Status** to `COVERED` or `PARTIAL` with test file path.
2. Update [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md) **Remediation log** (append dated line).
3. Sync [`info.md`](info.md) if behavior changed.

Do **not** schedule another full-repo audit unless a major architecture change occurs (new payment provider, DB migration platform, etc.).
