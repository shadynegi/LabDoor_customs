# Shopping Cart

How the cart works in Lab Door Customs.

**Full reference:** [`info.md`](info.md)


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 14 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; `policy_accepted` required; **Place Order** → `POST /api/checkout/place-order` → WhatsApp redirect (`Order ID` in message = `orders.id` UUID); checkout email synced to activity on change/blur. |
| **Orders** | Email links `GET /api/orders/access-exchange/:code`; legacy `?orderNumber=&token=` stripped; partial refresh keeps stale data + warning. |
| **Admin** | Dashboard search includes order id UUID, order number, email, name; **Mark paid** with external `payment_id` + admin note; **Settings** tab (no contact inbox). |
| **Activity** | Consent-gated batch; `contact_submit` on contact success; IPs anonymized with `IP_SALT`. |
| **Reviews** | `POST /api/reviews/check` on email blur; pending-moderation copy; vote error toasts. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Storage

- Cart persisted in browser `localStorage` under app-specific key
- Survives page refresh; cleared after successful place-order

## Behavior

- Add/remove/update quantities on product pages and cart page
- Stock validated server-side via `POST /api/products/validate-cart` on each change and again at place-order
- Server rejects checkout if items out of stock or quantities exceed inventory

## Clear cart manually

Open browser DevTools → Application → Local Storage → delete cart key, or use cart page remove-all if available.
