# Responsive QA Checklist

Manual QA for responsive layouts across the Lab Door Customs storefront and admin dashboard.

**Full reference:** [`info.md`](info.md) | **Breakpoints:** [MOBILE_RESPONSIVE.md](./MOBILE_RESPONSIVE.md)

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 10 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; `policy_accepted` required; **Place Order** → `POST /api/checkout/place-order` → WhatsApp redirect (`Order ID` in message = `orders.id` UUID); checkout email synced to activity on change/blur. |
| **Orders** | WhatsApp links pre-fill `?orderId=` on `/orders`; lookup via order ID + checkout email (`POST /api/orders/lookup`); full reload clears lookup form; legacy access-exchange returns **410**; lookup failure message **Order not found**. |
| **Admin** | Dashboard search includes order id UUID, order number, email, name; **Mark paid** with external `payment_id` + admin note; **Settings** tab. |
| **Activity** | Consent-gated batch; `contact_submit` on contact success; IPs anonymized with `IP_SALT`. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA + policy spacer; whole-number shoe sizes; **document scroll** on tall pages; `100dvh` + safe-area insets; Playwright **responsive-pages-ui** (11 viewports incl. 320px); OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

**Automated baseline (not a substitute for manual QA):** `Tests/frontend/responsive-pages-ui.spec.ts` (193 tests, 11 viewports including 320px), `responsive-ui.spec.ts`, and `mobile-ui.spec.ts` run in Playwright’s `mobile-chrome` project.

---

## Device widths to test

| Device | Width | Priority pages |
|--------|-------|----------------|
| iPhone SE (1st gen) | 320px | Home, cart, checkout |
| Galaxy S21 / S24 / S25 | 360px | Home, products, product detail |
| iPhone SE (3rd gen) | 375px | All storefront pages |
| iPhone 14 / 15 / 17 | 390–393px | Home, checkout |
| iPhone 17 Pro | 402px | Product detail, cart |
| iPhone 15 Pro / Pixel 7 / S25 Ultra | 393–412px | Products grid, cart |
| iPhone 14 Pro Max / 17 Pro Max | 430px | Home hero, modals |
| Galaxy A55 | 480px | Product filters, admin modals |
| iPad portrait | 768px | Products filters, admin dashboard |
| iPad landscape | 1024px | Admin tables, desktop layouts |

Use browser DevTools device mode or resize the window to each width.

---

## Storefront checks

### Home (`/`)

- [ ] Hero image fits without horizontal scroll at 320px
- [ ] Hero carousel and **View All Products** reachable by vertical scroll on mobile (not clipped)
- [ ] Navigation menu accessible

### Products (`/products`)

- [ ] Filter panel usable on mobile (collapse/expand)
- [ ] **Sort by** dropdown full width on phones; no horizontal overflow at 320–430px
- [ ] Product grid reflows (2 col on very narrow, auto-fill on wider phones)
- [ ] Filter results display correctly

### Product detail (`/product/:id`)

- [ ] 360° viewer sized correctly and draggable on touch
- [ ] Add to cart button visible without excessive scroll
- [ ] Size selector and add-to-cart controls usable on touch (no overlap with sticky bar)

### Cart and checkout

- [ ] Cart items stack vertically on mobile
- [ ] Sticky bottom bar shows total + Checkout (cart) or Place Order (checkout)
- [ ] **All sales final** policy text on cart clears the sticky bar when scrolled (`data-testid="cart-policy-notice"`)
- [ ] Checkout form fields full-width on mobile
- [ ] No duplicate Place Order buttons on mobile

### Policies and contact

- [ ] Text readable without horizontal scroll
- [ ] **Vertical scroll works** on `/contact`, `/shipping-policy`, `/help`, and other tall pages (wheel/touch)
- [ ] `/shipping-policy` shows **$25** shipping and **free over $200** (not legacy tier table)
- [ ] `/contact` shows WhatsApp contact link from `VITE_WHATSAPP_CONTACT_NUMBER` (`contact-support-whatsapp`)
- [ ] Contact form submits successfully
- [ ] `/payment/cancel` heading reads **Checkout Cancelled**

---

## Admin dashboard

- [ ] Login form centered with safe-area padding on notched phones
- [ ] Dashboard tabs scroll horizontally on mobile
- [ ] Product, customer, and coupon tables scroll horizontally
- [ ] Order detail modal: customer fields stack on mobile
- [ ] Customer history stats stack on phones
- [ ] Product form modal: fields single column on mobile

---

## Cross-cutting

- [ ] No horizontal overflow on any page at 320–430px
- [ ] Touch targets at least 44×44px
- [ ] Images scale without distortion
- [ ] Toast notifications (Sonner) visible above sticky CTAs
- [ ] Modals respect safe-area insets
- [ ] Chrome DevTools **Issues**: no form-field `id`/`name` or label-association warnings on checkout, contact, orders, products, admin login (see [`FORMS_QA_CHECKLIST.md`](FORMS_QA_CHECKLIST.md))
- [ ] `node frontend/scripts/audit-form-labels.mjs` reports `count 0`
