# Production Readiness Checklist

Verify Lab Door Customs is ready for production.

**Full reference:** [`../info.md`](../info.md) | **Deploy:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

## Backend

- [ ] `DATABASE_URL`, `FRONTEND_URL`, `ADMIN_PASSWORD_HASH` set
- [ ] `PAYPAL_WEBHOOK_ID`, `PAYPAL_MODE=live`, live credentials
- [ ] `REDIS_URL`, `SENTRY_DSN`, `TRUST_CLOUDFLARE=true`
- [ ] `GET /api/health` returns all components healthy

## Frontend

- [ ] `VITE_API_BASE_URL`, `VITE_SITE_URL`, `VITE_SENTRY_DSN` set at build
- [ ] Sitemap builds with product URLs
- [ ] PayPal sandbox/live mode matches backend

## Infrastructure

- [ ] Cloudflare DNS + SSL (Full strict) — [SSL_DNS_CHECKLIST.md](./SSL_DNS_CHECKLIST.md)
- [ ] PayPal webhook registered — [PAYPAL_SETUP_GUIDE.md](./PAYPAL_SETUP_GUIDE.md)
- [ ] Resend email configured
- [ ] Search Console verified — [SEARCH_CONSOLE_SETUP.md](./SEARCH_CONSOLE_SETUP.md)

## Functional smoke test

- [ ] Browse products, add to cart, complete PayPal checkout
- [ ] Order confirmation email received
- [ ] Admin login, view order, update status
- [ ] Customer order lookup with token
