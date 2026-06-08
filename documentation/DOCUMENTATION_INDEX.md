# Documentation Index — Lab Door Customs

**Authoritative reference:** [`info.md`](info.md) — full system description, security, payments, API summary, and environment variables.

**Maintenance:** Code changes should update `documentation/info.md` and the affected guides below. Agents follow [`.cursor/rules/documentation-sync.mdc`](../.cursor/rules/documentation-sync.mdc).

**Layout:** All `.md` documentation files live in this `documentation/` folder (including `info.md`, `test_guidelines.md`, and generated test reports under `test-results/`).

---

## System at a glance

| Area | Behavior |
|------|----------|
| Monorepo | `frontend/` (React/Vite), `backend/` (Express), `Tests/` (Vitest + Playwright) |
| Production | One Express process: `/api/*` + built SPA; Supabase PostgreSQL via service_role |
| Checkout | Server-bound PayPal orders; `?code=` exchange; capture **409** processing UI; email synced to activity on change/blur |
| Cart | `POST /api/products/validate-cart` on item changes with retry; Fuse search catalog cache (15 min TTL) |
| Orders | Email `?code=` access exchange; legacy URL tokens deprecated; partial refresh keeps stale data |
| RLS | 14 tables service_role-only; no public PostgREST product read |
| Activity | Consent-gated batch; `contact_submit`, `purchase_complete`, `size_select`, `quantity_change`; CSRF-exempt `/activity/batch`; IP anonymized |
| Admin | Products paginated; messages read-on-open; coupon scope; review admin response; estimated delivery |
| Reviews | `POST /api/reviews/check` on email blur; pending-moderation copy; vote error toasts |
| Mobile | Sticky CTAs, visualViewport keyboard offset, body scroll containment |

---

## Getting started

| Document | Purpose |
|----------|---------|
| [info.md](info.md) | Complete project reference |
| [QUICK_START.md](./QUICK_START.md) | Local setup in ~10 minutes |
| [guide.md](./guide.md) | Sequential commands: setup → dev → test |
| [SETUP_GUIDE.md](./SETUP_GUIDE.md) | Detailed local configuration |
| [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) | High-level architecture |

---

## Quality & audit (living)

| Document | Purpose |
|----------|---------|
| [PROJECT_AUDIT.md](PROJECT_AUDIT.md) | One-time full audit snapshot (2026-06-08) — remediation backlog |
| [COVERAGE_MATRIX.md](COVERAGE_MATRIX.md) | Doc → code → test map — **update per PR** (avoids repeat audits) |

---

## Development and API

| Document | Purpose |
|----------|---------|
| [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | REST API endpoints |
| [test_guidelines.md](test_guidelines.md) | Manual and automated testing (primary) |
| [TEST_RESULTS.md](TEST_RESULTS.md) | Generated test reports (`test-results/`) |
| [TESTING_INSTRUCTIONS.md](./TESTING_INSTRUCTIONS.md) | Redirect → `test_guidelines.md` |
| [DATABASE_SETUP.md](./DATABASE_SETUP.md) | Schema, migrations, Supabase |
| [ADMIN_DASHBOARD_GUIDE.md](./ADMIN_DASHBOARD_GUIDE.md) | Admin UI workflows |

---

## Payments and orders

| Document | Purpose |
|----------|---------|
| [PAYPAL_SETUP_GUIDE.md](./PAYPAL_SETUP_GUIDE.md) | PayPal app, credentials, webhooks |
| [PAYPAL_TESTING_GUIDE.md](./PAYPAL_TESTING_GUIDE.md) | Sandbox checkout testing |
| [ORDER_MANAGEMENT_GUIDE.md](./ORDER_MANAGEMENT_GUIDE.md) | Admin order operations |
| [ORDER_TRACKING_QUICKSTART.md](./ORDER_TRACKING_QUICKSTART.md) | Customer order lookup |

---

## Deployment and operations

| Document | Purpose |
|----------|---------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Railway production deploy |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Extended deployment notes |
| [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) | **Go-live checklist** (env, SQL, smoke tests) |
| [CLOUDFLARE_RAILWAY.md](./CLOUDFLARE_RAILWAY.md) | Cloudflare + Railway setup |
| [SSL_DNS_CHECKLIST.md](./SSL_DNS_CHECKLIST.md) | HTTPS and DNS |
| [SEARCH_CONSOLE_SETUP.md](./SEARCH_CONSOLE_SETUP.md) | Google Search Console |
| [RESTART_BACKEND.md](./RESTART_BACKEND.md) | Backend restart |
| [GET_DATABASE_URL.md](./GET_DATABASE_URL.md) | Supabase connection string |

---

## Database

| Document | Purpose |
|----------|---------|
| [SUPABASE_SETUP_INSTRUCTIONS.md](./SUPABASE_SETUP_INSTRUCTIONS.md) | Supabase project setup |
| [SUPABASE_SQL_TO_RUN.md](./SUPABASE_SQL_TO_RUN.md) | SQL scripts |
| [STEP_BY_STEP_SQL.md](./STEP_BY_STEP_SQL.md) | Step-by-step SQL |
| [RLS_OPTIMIZATION.md](./RLS_OPTIMIZATION.md) | Row-level security |

---

## QA checklists

| Document | Purpose |
|----------|---------|
| [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) | Production go-live (env, DB, PayPal, smoke tests) |
| [RESPONSIVE_QA_CHECKLIST.md](./RESPONSIVE_QA_CHECKLIST.md) | Responsive layout QA |
| [FORMS_QA_CHECKLIST.md](./FORMS_QA_CHECKLIST.md) | Forms and CSRF QA |

---

## Reference

| Document | Purpose |
|----------|---------|
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | Current system capabilities |
| [README.md](./README.md) | Documentation folder overview |
| [SETUP_ORDER_TRACKING.md](./SETUP_ORDER_TRACKING.md) | Customer order lookup configuration |

---

## Troubleshooting

| Document | Purpose |
|----------|---------|
| [diagnose-paypal-issue.md](./diagnose-paypal-issue.md) | PayPal troubleshooting |
| [DEBUG_FETCH_ERROR.md](./DEBUG_FETCH_ERROR.md) | API fetch / CORS issues |
