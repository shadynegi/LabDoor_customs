# Forms QA Checklist

Manual QA for forms, validation, and CSRF behavior.

**Full reference:** [`info.md`](info.md)

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 13 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; PayPal `?code=` exchange; capture **409** → processing UI; checkout email synced to activity on change/blur. |
| **Orders** | Email links `GET /api/orders/access-exchange/:code`; legacy `?orderNumber=&token=` stripped; partial refresh keeps stale data + warning. 
| **Admin** | Products paginated (load more); messages mark read on open; coupons scope UI; reviews admin response; estimated delivery; error/retry states. |
| **Activity** | Consent-gated batch; `contact_form_submit` on contact success. |
| **Reviews** | `POST /api/reviews/check` on email blur; pending-moderation copy; vote error toasts. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## CSRF behavior

All mutating API requests use double-submit CSRF:

1. Frontend calls `GET /api/csrf-token` on first API request.
2. Token stored in memory (and cookie on same-origin).
3. Sent as `X-CSRF-Token` header on POST/PUT/PATCH/DELETE.

On CSRF 403, `apiFetch` refreshes the token and retries once.

### Test

- [ ] Contact form submits successfully
- [ ] Checkout create-payment succeeds
- [ ] Admin login works
- [ ] Admin product create/update works

---

## Contact form (`/contact`)

- [ ] Required fields validated (name, email, subject, message)
- [ ] Invalid email rejected
- [ ] Success toast shown on submit
- [ ] `contact_form_submit` activity event sent when analytics consent granted
- [ ] Auto-reply email received (if Resend configured)
- [ ] Message appears in admin inbox; opening marks **new** messages as read

---

## Checkout form (`/checkout`)

- [ ] Required customer fields validated
- [ ] Email format validated
- [ ] Empty cart redirects or shows error
- [ ] Coupon validation shows correct discount/error
- [ ] PayPal redirect occurs on valid submission
- [ ] Checkout email updates activity batch identity on change/blur (with consent)
- [ ] Cart validation failure shows **Retry validation** on cart page
- [ ] Server rejects tampered totals (amount mismatch)
- [ ] Payment success **409** shows processing UI (cart not cleared)
- [ ] Expired checkout `code` shows explicit error on success page

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
- [ ] Cancel order with refund shows confirmation
- [ ] Opening a new contact message marks it read; Mark replied / Archive work in modal
- [ ] Custom coupon create supports applies_to scope (all / product / category)
- [ ] Review edit saves admin response visible on storefront
- [ ] Review form shows eligibility message after email blur; success copy mentions pending moderation

---

## Rate limiting

- [ ] Rapid contact submissions eventually rate-limited
- [ ] Rapid admin login failures locked after 5 attempts / 15 min
