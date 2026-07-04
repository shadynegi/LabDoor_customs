# Forms QA Checklist

Manual QA for forms, validation, and CSRF behavior.

**Full reference:** [`info.md`](info.md)

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 10 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; `policy_accepted` required; **Place Order** → `POST /api/checkout/place-order` → WhatsApp redirect (`Order ID` in message = `orders.id` UUID); checkout email synced to activity on change/blur. |
| **Orders** | Email links pre-fill `?orderId=` on `/orders`; lookup via order ID + checkout email (`POST /api/orders/lookup`); order details clear on full page reload; legacy access-exchange returns **410**; lookup failure message **Order not found**. |
| **Admin** | Dashboard search includes order id UUID, order number, email, name; **Mark paid** with external `payment_id` + admin note; **Settings** tab (activity export, sessions, customer recompute); coupons scope UI; estimated delivery; error/retry states. |
| **Activity** | Consent-gated batch; `contact_submit` on contact success; IPs anonymized with `IP_SALT`. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA + policy spacer; `100dvh` + safe-area insets; Playwright **responsive-pages-ui** (11 viewports incl. 320px); OOS hides product sticky bar; admin product cards on phones. |
| **Form a11y** | Every visible control has `id` + `name`; labels use `htmlFor` or `aria-label`; audit script `audit-form-labels.mjs` expects zero issues. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Form accessibility (Chrome DevTools)

Run before release on **desktop Chrome** with DevTools → **Issues** open while exercising each page.

**Automated baseline** (from repository root):

```bash
node frontend/scripts/audit-form-labels.mjs
```

Expect output ending with `count 0`.

### Storefront

- [ ] `/checkout` — no “A form field element should have an id or name attribute” issues
- [ ] `/checkout` — no “No label associated with a form field” issues (including policy checkbox and coupon field)
- [ ] `/contact` — all fields labeled; submit works
- [ ] `/orders` — order ID + email lookup fields labeled
- [ ] `/products` — sort/filter/search controls have `aria-label` or visible/`sr-only` labels

### Admin

- [ ] `/admin/login` — username and password labeled
- [ ] Dashboard tabs — product form modal, coupon create/edit, order search, mark-paid dialog, action confirmations — no form Issues

---

## CSRF behavior

All mutating API requests use double-submit CSRF:

1. Frontend calls `GET /api/csrf-token` on first API request.
2. Token stored in memory (and cookie on same-origin).
3. Sent as `X-CSRF-Token` header on POST/PUT/PATCH/DELETE.

On CSRF 403, `apiFetch` refreshes the token and retries once.

### Test

- [ ] Contact form submits successfully
- [ ] Checkout place-order succeeds
- [ ] Admin login works
- [ ] Admin product create/update works

---

## Contact form (`/contact`)

- [ ] Required fields validated (name, email, subject, message)
- [ ] Invalid email rejected
- [ ] Page displays WhatsApp contact from `VITE_WHATSAPP_CONTACT_NUMBER` (`contact-support-whatsapp` link)
- [ ] Success toast shown on submit
- [ ] `contact_submit` activity event sent when analytics consent granted
- [ ] Optional WhatsApp follow-up opens after successful submit when `whatsappUrl` returned
- [ ] Message stored in `contact_messages` (verify in Supabase if needed)

---

## Checkout form (`/checkout`)

- [ ] Country pre-selected (United States) on checkout load — no empty country dropdown
- [ ] Required customer fields validated
- [ ] Email format validated
- [ ] Empty cart redirects or shows error
- [ ] Coupon validation shows correct discount/error
- [ ] No-refund / replacement-only policy checkbox required; **Place Order** disabled until accepted
- [ ] Required-field validation shows toast before place-order (first missing field highlighted)
- [ ] **Place Order** on phone over LAN HTTP (`http://192.168.x.x`) succeeds (idempotency key fallback)
- [ ] WhatsApp redirect occurs on valid submission (or mocked redirect in E2E)
- [ ] Checkout email updates activity batch identity on change/blur (with consent)
- [ ] Product detail **Add to Cart** disabled until whole-number size selected (UK/US/EU — no half sizes)
- [ ] Cart validation failure shows **Retry validation** on cart and checkout pages (desktop + mobile sticky hint)
- [ ] Server rejects tampered totals (amount mismatch)
- [ ] Optional `/payment/success` shows order confirmation when returning from WhatsApp
- [ ] `/payment/cancel` shows **Checkout Cancelled**

---

## Shipping policy (`/shipping-policy`)

- [ ] Shows **$25** flat shipping and **free over $200** (matches cart/checkout)
- [ ] Order tracking copy references **order ID + checkout email** on `/orders`
- [ ] Page scrolls on mobile and desktop when content exceeds viewport

---

## Admin login (`/admin/login`)

- [ ] Empty fields rejected
- [ ] Wrong password shows error
- [ ] Successful login redirects to dashboard
- [ ] Session persists across page refresh
- [ ] Logout clears session

---

## Admin forms (dashboard)

- [ ] Product create/edit validates required fields
- [ ] Order status update succeeds
- [ ] Cancel **unpaid pending** order shows confirmation (no refund option for paid orders)
- [ ] Custom coupon create supports applies_to scope (all / product)

---

## Rate limiting

- [ ] Rapid contact submissions eventually rate-limited
- [ ] Rapid admin login failures locked after 5 attempts / 15 min
