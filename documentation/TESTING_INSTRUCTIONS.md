# Testing Instructions

How to test Lab Door Customs locally and in CI.

**Full reference:** [`../info.md`](../info.md)

---

## Automated tests

### Backend (Vitest)

```bash
cd backend
npm test          # run once
npm run test:watch  # watch mode
```

**Location:** `backend/tests/`

| Suite | Coverage |
|-------|----------|
| `unit/` | PayPal webhook utils, refund idempotency, checkout pricing, order tokens, client IP |
| `api/` | Health, checkout validation, orders, security |

API tests mock the database layer for fast isolated runs.

### Frontend (Playwright)

```bash
cd frontend
npm run test:e2e:install   # first time only
npm run test:e2e
```

**Location:** `frontend/e2e/storefront.spec.ts`

Smoke tests:

- Home page renders
- Products page renders
- Checkout route loads
- Contact page renders

Playwright serves the built `dist/` via Vite preview (no backend required for smoke tests).

### Link checker

```bash
npm run links:check   # from repo root
```

Validates internal links in documentation markdown files.

---

## CI pipeline

GitHub Actions (`.github/workflows/ci.yml`) on push/PR to `main`/`master`:

| Job | Steps |
|-----|-------|
| backend | build + Vitest |
| frontend | env validation + build + Playwright |
| sitemap | live API sitemap with product requirement |
| links | documentation link check |

Requires GitHub secrets: `PRODUCTION_API_BASE_URL`, `VITE_SENTRY_DSN`, `DATABASE_URL` (keep-alive).

---

## Manual QA checklists

| Checklist | Focus |
|-----------|-------|
| [RESPONSIVE_QA_CHECKLIST.md](./RESPONSIVE_QA_CHECKLIST.md) | Mobile/tablet/desktop layouts |
| [FORMS_QA_CHECKLIST.md](./FORMS_QA_CHECKLIST.md) | Forms, CSRF, validation |

---

## Manual test flows

### Storefront

1. Browse products, search, filter
2. Add to cart, adjust quantities
3. Proceed to checkout, fill shipping form
4. Apply valid/invalid coupon codes
5. Complete PayPal sandbox payment
6. Verify confirmation email and order lookup

### Admin

1. Login at `/admin/login`
2. View analytics tab
3. Create/edit a product
4. View and update an order (status, tracking)
5. Send shipping notification
6. Cancel a test order with refund
7. Read and archive contact messages

### PayPal webhooks

Use ngrok to expose local backend, configure PayPal sandbox webhook, trigger capture/refund events.

See [PAYPAL_TESTING_GUIDE.md](./PAYPAL_TESTING_GUIDE.md).

---

## Health verification

```bash
curl http://localhost:5000/api/health
```

Expect `success: true` with database and Redis status.

---

## Build verification

```bash
cd backend && npm run build
cd frontend && npm run build   # strict env only in CI/production
```
