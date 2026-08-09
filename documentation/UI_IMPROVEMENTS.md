# UI Features

Storefront and admin UI capabilities.

**Full reference:** [`info.md`](info.md)


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 10 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; `policy_accepted` required; **Place Order** → `POST /api/checkout/place-order` → WhatsApp redirect (`Order ID` in message = `orders.id` UUID); checkout email synced to activity on change/blur. |
| **Orders** | Email links pre-fill `?orderId=` on `/orders`; lookup via order ID + checkout email (`POST /api/orders/lookup`); tracked orders in sessionStorage; legacy access-exchange returns **410**; lookup failure message **Order not found**. |
| **Admin** | Dashboard search includes order id UUID, order number, email, name; **Mark paid** with external `payment_id` + admin note; **Settings** tab. |
| **Activity** | Consent-gated batch; `contact_submit` on contact success; IPs anonymized with `IP_SALT`. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |
| **Dark mode** | Independent storefront and admin Sun/Moon toggles (44×44); storefront sets `data-theme` on `<html>` (`ldc_storefront_theme`), admin sets `data-admin-theme` on `.admin-root` (`ldc_admin_theme`); CSS custom-property tokens in `tokens.css`, synchronous init from localStorage/`prefers-color-scheme` (no theme flash). All text uses theme-aware tokens (secondary text tuned for ~7:1/~8:1 contrast); `color-scheme` pinned per scope so native controls (date pickers, dropdowns, scrollbars) follow the app toggle, not the OS. **Page backgrounds are theme-aware** via `--color-page-gradient` — a lighter cream→tan brown gradient in light mode and a darker espresso→deep-brown gradient in dark mode of the same hue, applied across all storefront pages (incl. cart), the admin login, and the admin dashboard body; `--color-header-gradient` keeps white-text banners dark in both themes. Modals/popovers adapt via the shared `LiquidModal` panel + tokenized dialogs; the Photo/Spin viewer toggle uses a dark translucent fill so both buttons stay visible over any product background. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Storefront

- Liquid-web glass morphism components
- Framer Motion animations
- Responsive layout (mobile-first)
- Sonner toast notifications
- Product carousel, filters, 360° viewer
- Accessible navigation and forms
- Dark-mode toggle (own scope + persistence, isolated from admin)

## Admin

- Tabbed dashboard
- Data tables with search/filter
- Modal forms for CRUD operations
- Status badges for orders and payments
- Dark-mode toggle scoped to login + dashboard (isolated from storefront)
