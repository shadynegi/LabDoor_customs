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
- WhatsApp checkout (`POST /api/checkout/place-order`); pending orders confirmed manually by admin; **no-refund store policy** with manufacturing-defect replacements only
- Admin dashboard (products, orders, coupons, customers, analytics, settings; bulk limits 500 IDs)
- Coupons, contact form (client-side WhatsApp — no backend API), activity tracking
- Activity tracking (consent-gated batch endpoint, IP anonymization)
- Cart price validation on every change (`POST /api/products/validate-cart`)
- Redis caching, rate limits, CSRF protection (activity batch exempt), Sentry monitoring
- Supabase RLS: service_role-only; no public PostgREST catalog access

**Testing:** **520** automated tests (Vitest + Playwright) + **107** manual QA cases — see [`test_guidelines.md`](test_guidelines.md) and [`Tests/README.md`](../Tests/README.md).

**Optimization:** [`OPTIMIZATION.md`](OPTIMIZATION.md) · baseline: `npm run audit:codebase`

---

## Quick links

| Task | Document |
|------|----------|
| Run locally | [QUICK_START.md](./QUICK_START.md) |
| Deploy to production | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| Configure WhatsApp checkout | [WHATSAPP_CHECKOUT_GUIDE.md](./WHATSAPP_CHECKOUT_GUIDE.md) |
| API reference | [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) |
| Admin usage | [ADMIN_DASHBOARD_GUIDE.md](./ADMIN_DASHBOARD_GUIDE.md) |
