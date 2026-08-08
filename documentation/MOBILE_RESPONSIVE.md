# Mobile Layout

Mobile-specific layout, breakpoints, and shared responsive utilities.

**Full reference:** [`info.md`](info.md) | **QA:** [RESPONSIVE_QA_CHECKLIST.md](./RESPONSIVE_QA_CHECKLIST.md)

## Breakpoints

| Name | Width | Usage |
|------|-------|--------|
| Small phone | &lt; 375px | Tighter grids, smaller hero image, 320px iPhone SE |
| Phone | &lt; 768px | Single-column layouts, sticky checkout CTAs |
| Tablet | 768px–1023px | Two-column forms where space allows |
| Desktop | ≥ 1024px | Full multi-column layouts |

The `useResponsive` hook (`frontend/src/hooks/useResponsive.ts`) exposes `isMobile`, `isTablet`, `isDesktop`, `isSmallMobile`, and live `width` / `height`.

Shared CSS utilities live in `frontend/src/styles/responsive.css` (imported from `index.css`).

**Automated baseline:** Playwright **`Tests/e2e/specs/responsive/responsive-pages-ui.spec.ts`** (mobile-chrome project) runs across **11 phone viewports** (iPhone SE 320px, iPhone SE 3rd gen, iPhone 15 Pro, iPhone 17 / 17 Pro / 17 Pro Max, Galaxy S24 / S25 / S25 Ultra / A55, Pixel 9 Pro) and **every storefront route** (home, products, product detail, cart, checkout, about, contact, help, policies, orders, payment success/cancel, admin login). Each viewport checks horizontal overflow, primary content visibility, cart **All sales final** above the sticky checkout bar, and checkout form fields. It also asserts the **checkout** and **product-detail** sticky bars do not cover final page content when their taller policy/size **hint** bands render (`has-sticky-hint`), and that the **home hero heading** stays within the viewport for long single-token product names. **`Tests/e2e/specs/storefront/storefront.spec.ts`** adds shipping-policy pricing, contact WhatsApp link, and document-scroll smoke. **`Tests/e2e/specs/contact/contact-ui.spec.ts`** asserts submit opens a `wa.me` popup with prefilled message. **`Tests/e2e/specs/responsive/responsive-ui.spec.ts`** adds focused mobile checkout/cart/sort/admin cases plus a two-decimal price-format check. The mobile-chrome project is **228 tests**. Full suite (**423 Playwright** + unit/API/viewport audit): see [`test_guidelines.md`](test_guidelines.md) and [`Tests/README.md`](../Tests/README.md).

**iOS viewport:** Page shells use `100dvh` / `90dvh` modals where inline min-heights apply; sticky header and home bottom nav respect `env(safe-area-inset-*)`.

**Overflow audit (CI):** `npm test` runs `Tests/scripts/run-viewport-audit.mjs` after Playwright — 12 widths (320–1024px) × 16 storefront routes. Manual: `node Tests/scripts/run-viewport-audit.mjs` with preview on port 4173.

**Form accessibility:** checkout, contact, orders, product filters, and admin forms use paired `id`/`name`, `htmlFor` labels (or `aria-label` for icon-only controls). Regression: `node frontend/scripts/audit-form-labels.mjs` (`count 0`); manual Chrome DevTools Issues checks in [`FORMS_QA_CHECKLIST.md`](FORMS_QA_CHECKLIST.md).

## QA device widths

Layouts are verified at these common viewport widths:

| Device | Width |
|--------|-------|
| iPhone SE (1st gen) | 320px |
| Galaxy S21 / small Android | 360px |
| iPhone SE (3rd gen) / iPhone 12 mini | 375px |
| iPhone 14 / 15 | 390px |
| iPhone 15 Pro | 393px |
| iPhone 17 / 17 Pro / 17 Pro Max | 393px / 402px / 430px |
| Pixel 7 / Galaxy A54 | 412px |
| Galaxy S24 / S25 / S25 Ultra | 360px / 360px / 412px |
| Pixel 9 Pro | 412px |
| Galaxy A55 | 480px |
| iPhone 14 Pro Max | 430px |
| Large phone | 480px |
| iPad / tablet portrait | 768px |
| iPad landscape / small laptop | 1024px |

## Mobile behavior

### Storefront

- **Home:** Hero product image scales with `hero-product-img` (no fixed 350px overflow on 320px screens). The hero **product-name `<h1>`** (uppercase + letter-spacing) uses `overflow-wrap: break-word` / `word-break: break-word` / `max-width: 100%` so a long single-token name wraps instead of forcing horizontal scroll. The hero **price** renders with `Number(price).toFixed(2)` (e.g. `$98.00`), matching the sticky-CTA format. The scrolling **product carousel** (`ProductCarousel`) uses `object-fit: contain` with centered padding so full shoes are visible (matches the catalog grid); product names sit in a footer bar below the image. Carousel controls use 44px touch targets.
- **Products:** `responsive-product-grid` uses `minmax(160px, 1fr)` on phones; two columns on very narrow (≤359px) screens. Product card titles use **2-line clamp** on mobile. Out-of-stock products show an **Out of Stock** badge on cards. **Sort by** uses `product-filters__sort` — full-width row on phones, label stacked above the select on ≤389px, 48px touch height, 16px font (avoids iOS zoom), shorter option labels on ≤389px widths.
- **Product detail:** `Product360Viewer` uses CSS-based sizing (not Tailwind). When out of stock, add-to-cart is disabled (inline button hidden on mobile when sticky CTA is shown; sticky CTA also disabled). The main **price** renders with `Number(price).toFixed(2)`. While no size is selected the sticky CTA shows a taller **"choose your size"** hint, so the container adds `has-sticky-hint` (reserving the extra hint-band height) to keep the "All Sales Final" block clear of the bar.
- **Cart / checkout / product detail:** Sticky bottom bar (`MobileStickyCta`) shows total + primary action on phones. Cart uses **stacked** layout with `.cart-mobile-sticky-spacer` plus `.has-mobile-sticky-cta--stacked` padding so **All sales final** policy text (`data-testid="cart-policy-notice"`) stays above the sticky bar when scrolled. **Continue Shopping** (desktop and mobile sticky) routes to `/products`. Product detail **omits** sticky bar when out of stock.
- **Checkout keyboard:** `keyboardOffset` lifts the sticky **Place Order** CTA above the virtual keyboard (`translateY`). When policy/validation hints show, the container gets `has-sticky-hint` **and** the inline `paddingBottom` adds the matching hint-band height (`+120px`) so the taller sticky bar never covers the SSL/summary content — the inline padding previously overrode the class and left the bar overlapping. Place-order idempotency key uses `createClientId()` so checkout works on phones over **HTTP LAN** (`http://192.168.x.x`) where `crypto.randomUUID` is unavailable.
- **Cookie consent:** On cart, checkout, and product routes, the banner renders at the **top** on mobile so it does not cover purchase CTAs (`has-cookie-banner-top` body padding).
- **Body scroll:** `html` is the single vertical scrollport (`overflow-y: auto`); `body` uses `height: auto` and `overflow-y: visible` (not fixed `height: 100%`). `#root` is block layout (not flex) so nested app shells do not trap scroll. Home uses `overflow-x: hidden` only so the carousel remains reachable.
- **Navigation (non-home):** Sticky header shows **Orders** and **Cart** links; **safe-area top/left/right** padding on notched devices. On phones, icons only (44×44px touch targets); labels visible from tablet/desktop. Logo scales to 36px height on very small phones (`isSmallMobile`), 40px on mobile, 50px on desktop. Catalog access from home uses the **View All Products** button on the product carousel (not a global nav icon).
- **Home header:** About Us and cart use client-side `Link` navigation (no full page reload). Cart link exposes an accessible name with item count when the cart is non-empty.
- **Modals:** `LiquidModal` uses fixed overlay, `modal-max-h` (`90dvh`), fluid padding, and safe-area insets.

### Admin

- **Dashboard:** Order cards in a single column on mobile. Product, customer, and coupon tables scroll horizontally inside `responsive-table-wrap` on desktop; **Products** and **Customers** use card layouts on phones. Order and customer modals use single-column grids on phones.
- **Login:** Safe-area padding and reduced card padding on small screens.

## Touch targets

Interactive controls target at least **44×44px** on mobile (`--touch-min` in `responsive.css`). The **dark-mode toggle** (`DarkModeToggle.tsx`) is a fixed 44×44 button with `flexShrink: 0` so it never squeezes the nav below the overflow threshold — verified by the `responsive-pages-ui` viewport matrix.
