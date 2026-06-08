# Responsive QA Checklist

Manual QA for responsive layouts across the Lab Door Customs storefront and admin dashboard.

**Full reference:** [`info.md`](info.md) | **Breakpoints:** [MOBILE_RESPONSIVE.md](./MOBILE_RESPONSIVE.md)

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 13 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; PayPal `?code=` exchange; capture **409** -> processing UI; checkout email synced to activity on change/blur. |
| **Orders** | Email links `GET /api/orders/access-exchange/:code`; legacy `?orderNumber=&token=` stripped; partial refresh keeps stale data + warning. |
| **Admin** | Products paginated (load more); messages mark read on open; coupons scope UI; reviews admin response; estimated delivery; error/retry states. |
| **Activity** | Consent-gated batch; `contact_submit` on contact success. |
| **Reviews** | `POST /api/reviews/check` on email blur; pending-moderation copy; vote error toasts. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Device widths to test

| Device | Width | Priority pages |
|--------|-------|----------------|
| iPhone SE (1st gen) | 320px | Home, cart, checkout |
| Galaxy S21 | 360px | Home, products, product detail |
| iPhone SE (3rd gen) | 375px | All storefront pages |
| iPhone 14 / 15 | 390px | Home, checkout |
| iPhone 15 Pro | 393px | Product detail, reviews |
| Pixel 7 | 412px | Products grid, cart |
| iPhone 14 Pro Max | 430px | Home hero, modals |
| Large phone | 480px | Review stats, admin modals |
| iPad portrait | 768px | Products filters, admin dashboard |
| iPad landscape | 1024px | Admin tables, desktop layouts |

Use browser DevTools device mode or resize the window to each width.

---

## Storefront checks

### Home (`/`)

- [ ] Hero image fits without horizontal scroll at 320px
- [ ] Hero carousel renders and swipes on touch
- [ ] Product search bar usable on small screens
- [ ] Navigation menu accessible

### Products (`/products`)

- [ ] Filter panel usable on mobile (collapse/expand)
- [ ] Product grid reflows (2 col on very narrow, auto-fill on wider phones)
- [ ] Search results display correctly

### Product detail (`/product/:id`)

- [ ] 360° viewer sized correctly and draggable on touch
- [ ] Add to cart button visible without excessive scroll
- [ ] Review stats stack on phones; pros/cons single column

### Cart and checkout

- [ ] Cart items stack vertically on mobile
- [ ] Sticky bottom bar shows total + Checkout (cart) or PayPal (checkout)
- [ ] Checkout form fields full-width on mobile
- [ ] No duplicate PayPal buttons on mobile

### Policies and contact

- [ ] Text readable without horizontal scroll
- [ ] Contact form submits successfully

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
