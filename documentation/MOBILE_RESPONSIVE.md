# Mobile Layout

Mobile-specific layout, breakpoints, and shared responsive utilities.

**Full reference:** [`../info.md`](../info.md) | **QA:** [RESPONSIVE_QA_CHECKLIST.md](./RESPONSIVE_QA_CHECKLIST.md)

## Breakpoints

| Name | Width | Usage |
|------|-------|--------|
| Small phone | &lt; 375px | Tighter grids, smaller hero image |
| Phone | &lt; 768px | Single-column layouts, sticky checkout CTAs |
| Tablet | 768px–1023px | Two-column forms where space allows |
| Desktop | ≥ 1024px | Full multi-column layouts |

The `useResponsive` hook (`frontend/src/hooks/useResponsive.ts`) exposes `isMobile`, `isTablet`, `isDesktop`, `isSmallMobile`, and live `width` / `height`.

Shared CSS utilities live in `frontend/src/styles/responsive.css` (imported from `index.css`).

## QA device widths

Layouts are verified at these common viewport widths:

| Device | Width |
|--------|-------|
| iPhone SE (1st gen) | 320px |
| Galaxy S21 / small Android | 360px |
| iPhone SE (3rd gen) / iPhone 12 mini | 375px |
| iPhone 14 / 15 | 390px |
| iPhone 15 Pro | 393px |
| Pixel 7 / Galaxy A54 | 412px |
| iPhone 14 Pro Max | 430px |
| Large phone | 480px |
| iPad / tablet portrait | 768px |
| iPad landscape / small laptop | 1024px |

## Mobile behavior

### Storefront

- **Home:** Hero product image scales with `hero-product-img` (no fixed 350px overflow on 320px screens). Carousel controls use 44px touch targets.
- **Products:** `responsive-product-grid` uses `minmax(160px, 1fr)` on phones; two columns on very narrow (≤359px) screens.
- **Product detail:** `Product360Viewer` uses CSS-based sizing (not Tailwind). Review stats and pros/cons stack on narrow screens.
- **Cart / checkout:** Sticky bottom bar (`MobileStickyCta`) shows total + primary action on phones. Checkout hides duplicate PayPal button in the summary when the sticky bar is visible.
- **Modals:** `LiquidModal` uses fluid padding and safe-area insets.

### Admin

- **Dashboard:** Order cards in a single column on mobile. Product, customer, and coupon tables scroll horizontally inside `responsive-table-wrap`. Order and customer modals use single-column grids on phones.
- **Login:** Safe-area padding and reduced card padding on small screens.

## Touch targets

Interactive controls target at least **44×44px** on mobile (`--touch-min` in `responsive.css`).
