# PayPal Troubleshooting

Diagnose PayPal checkout and webhook issues.

**Full reference:** [`info.md`](info.md) | **Setup:** [PAYPAL_SETUP_GUIDE.md](./PAYPAL_SETUP_GUIDE.md)

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 14 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | `?code=` exchange on success page; **409** → processing UI (polls checkout-context); expired code → explicit error; alternate `?aid=` recovery. |
| **Admin** | Bulk updates max **500** IDs; manual mark paid verifies PayPal capture via API; paid orders cannot cancel or refund (no-refund policy); product cards on mobile. |
| **Activity** | `POST /api/activity/batch` is CSRF-exempt and rate-limited; frontend sends only with analytics cookie consent; IPs anonymized with `IP_SALT`. |
| **Reviews** | Public responses strip PII (`toPublicReview()`); admin shows email. Eligibility via `POST /api/reviews/check` (email in body). Votes on approved reviews only. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Common issues

### PayPal button does not appear

- Check browser console for CSP errors (PayPal domains must be allowed).
- Verify `PAYPAL_CLIENT_ID` and `PAYPAL_SECRET` in backend `.env`.
- Confirm `PAYPAL_MODE` matches credential type (sandbox vs live).

### Create payment fails (500)

- Check backend logs for PayPal auth errors.
- Verify cart items exist and have sufficient stock.
- Check idempotency: previous failed attempt may need reclaim (retry after pending order cancelled).

### Capture fails after PayPal approval

- Verify `serverOrderId` and `accessToken` sent from frontend.
- After PayPal redirect, URL should have `?code=...&token=...` (PayPal order ID in `token`, not the order access token). Frontend calls `GET /api/paypal/checkout-exchange/:code` to obtain the access token. Alternate recovery uses `?aid=` with `GET /api/paypal/checkout-context/:paypalOrderId`.
- **Expired or used `code`:** success page shows an explicit error — customer should use `/orders` lookup or contact support; do not expect capture without a valid exchange or recovery token.
- **409 after capture:** PayPal may have charged the customer but DB order is not `payment_status=completed` — success page shows “payment received — processing”, polls checkout-context, and does **not** clear the cart until confirmed.
- Amount mismatch: server auto-refunds and cancels if PayPal captured wrong amount.

### Webhook not processing

- Verify `PAYPAL_WEBHOOK_ID` is set in production.
- Webhook URL must be HTTPS through Cloudflare proxy.
- Check backend logs for signature verification failures.
- Webhook uses raw body parser — must not go through JSON parser first.

### Refund fails

- Admin refund validates against remaining balance (`total - refunded_amount`).
- PayPal capture must exist (`paypal_capture_id` on order).
- Check PayPal dashboard for capture status.

---

## Diagnostic commands

```bash
# Health check
curl https://www.yourdomain.com/api/health

# PayPal connectivity (admin auth required)
curl -b admin_session=... https://www.yourdomain.com/api/paypal/test

# Check backend logs for request ID
# Filter Pino logs by paypal or webhook keywords
```

---

## Sandbox tips

- Use PayPal sandbox buyer accounts from Developer Dashboard.
- Sandbox webhooks may delay — check PayPal webhook event log.
- Use ngrok for local webhook testing.

---

## Related

- [PAYPAL_TESTING_GUIDE.md](./PAYPAL_TESTING_GUIDE.md)
- [DEBUG_FETCH_ERROR.md](./DEBUG_FETCH_ERROR.md)
