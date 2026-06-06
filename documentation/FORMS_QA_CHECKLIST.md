# Forms QA Checklist

Manual QA for forms, validation, and CSRF behavior.

**Full reference:** [`info.md`](info.md)

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 13 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart in localStorage; PayPal checkout exchange `?code=`; order tracking links use `GET /api/orders/access-exchange/:code` (no token in email URL); capture requires `serverOrderId` + `accessToken`. |
| **Admin** | Bulk updates max **500** IDs; manual mark paid verifies PayPal capture via API; paid orders cannot cancel without refund; product cards on mobile. |
| **Activity** | `POST /api/activity/batch` is CSRF-exempt and rate-limited; frontend sends only with analytics cookie consent; IPs anonymized with `IP_SALT`. |
| **Reviews** | Public responses strip PII (`toPublicReview()`); admin shows email. Eligibility via `POST /api/reviews/check` (email in body). Votes on approved reviews only. |
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
- [ ] Auto-reply email received (if Resend configured)
- [ ] Message appears in admin inbox

---

## Checkout form (`/checkout`)

- [ ] Required customer fields validated
- [ ] Email format validated
- [ ] Empty cart redirects or shows error
- [ ] Coupon validation shows correct discount/error
- [ ] PayPal redirect occurs on valid submission
- [ ] Server rejects tampered totals (amount mismatch)

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
- [ ] Contact message status update works

---

## Rate limiting

- [ ] Rapid contact submissions eventually rate-limited
- [ ] Rapid admin login failures locked after 5 attempts / 15 min
