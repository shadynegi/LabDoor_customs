# Lab Door Customs — Documentation

This folder contains setup guides, operational references, and QA checklists for the Lab Door Customs e-commerce platform.

**Start here:** [`info.md`](info.md) for the complete system reference (architecture, payments, security, logging, API summary, environment variables).

**Index:** [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)

**Keeping docs current:** When changing code, update [`info.md`](info.md) and the relevant guides in this folder. See [`.cursor/rules/documentation-sync.mdc`](../.cursor/rules/documentation-sync.mdc).

---

## What this project is

Lab Door Customs is a monorepo e-commerce platform for custom footwear:

- **Storefront:** React 19 + Vite (`frontend/`)
- **Server:** Express API + static SPA hosting (`backend/`)
- PayPal checkout (server-bound orders, checkout exchange codes, capture with access tokens, webhooks); **no-refund store policy** with manufacturing-defect replacements only
- Admin dashboard (products, orders, coupons, customers, messages, analytics; bulk limits 500 IDs)
- Product reviews (server-derived voter IDs, `can_review` eligibility), coupons, contact form
- Activity tracking (consent-gated batch endpoint, IP anonymization)
- Cart price validation on every change (`POST /api/products/validate-cart`)
- Redis caching, rate limits, CSRF protection (activity batch exempt), Sentry monitoring
- Supabase RLS: service_role-only; no public PostgREST catalog access

---

## Quick links

| Task | Document |
|------|----------|
| Run locally | [QUICK_START.md](./QUICK_START.md) |
| Deploy to production | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| Configure PayPal | [PAYPAL_SETUP_GUIDE.md](./PAYPAL_SETUP_GUIDE.md) |
| API reference | [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) |
| Admin usage | [ADMIN_DASHBOARD_GUIDE.md](./ADMIN_DASHBOARD_GUIDE.md) |
