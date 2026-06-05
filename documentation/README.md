# Lab Door Customs — Documentation

This folder contains setup guides, operational references, and QA checklists for the Lab Door Customs e-commerce platform.

**Start here:** [`../info.md`](../info.md) for the complete system reference (architecture, payments, security, logging, API summary, environment variables).

**Index:** [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)

**Keeping docs current:** When changing code, update [`../info.md`](../info.md) and the relevant guides in this folder. See [`.cursor/rules/documentation-sync.mdc`](../.cursor/rules/documentation-sync.mdc).

---

## What this project is

Lab Door Customs is a monorepo e-commerce platform for custom footwear:

- **Storefront:** React 19 + Vite (`frontend/`)
- **Server:** Express API + static SPA hosting (`backend/`)
- PayPal checkout (server-bound orders, atomic inventory, webhooks)
- Admin dashboard (products, orders, coupons, customers, messages, analytics)
- Product reviews, coupons, contact form, activity tracking
- Redis caching, rate limits, CSRF protection, Sentry monitoring

---

## Quick links

| Task | Document |
|------|----------|
| Run locally | [QUICK_START.md](./QUICK_START.md) |
| Deploy to production | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| Configure PayPal | [PAYPAL_SETUP_GUIDE.md](./PAYPAL_SETUP_GUIDE.md) |
| API reference | [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) |
| Admin usage | [ADMIN_DASHBOARD_GUIDE.md](./ADMIN_DASHBOARD_GUIDE.md) |
