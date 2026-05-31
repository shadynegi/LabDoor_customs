# Forms QA Checklist

Manual QA for forms, validation, and CSRF behavior.

**Full reference:** [`../info.md`](../info.md)

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
