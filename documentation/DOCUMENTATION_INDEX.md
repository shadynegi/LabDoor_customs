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
| Checkout | Server-side place-order; `policy_accepted` required; `createClientId()` idempotency key (HTTP LAN safe); WhatsApp redirect (`Order ID` = `orders.id` UUID in message); email synced to activity on change/blur |
| Cart | `POST /api/products/validate-cart` on item changes with retry; catalog search via `POST /api/products/search` (no categories; no full-catalog client cache) |
| Orders | Email `?orderId=` pre-fill on `/orders`; lookup via order ID + checkout email |
| RLS | **10** tables with revoked `anon`/`authenticated` grants + service_role-only policies; no public PostgREST product read |
| Form a11y | `id`/`name` on all controls; `htmlFor` or `aria-label`; `audit-form-labels.mjs` + Chrome DevTools Issues QA |
| Activity | Consent-gated batch; `contact_submit`, `purchase_complete`, `size_select`, `quantity_change`; CSRF-exempt `/activity/batch`; IP anonymized |
| Admin | Server product search; order search by **id UUID**, order number, email, name; products paginated (no category field); **Settings** tab (activity export, sessions, customer recompute); coupon scope (`all` / product IDs); estimated delivery; **no customer refunds** (cancel unpaid pending only) |
| Store policy | All sales final; manufacturing-defect replacements within 30 days; `/returns-policy` + `/replacement-policy` |
| Mobile | Sticky CTAs, visualViewport keyboard offset, **document scroll** (`html` scrollport; `#root` block layout; Home `overflow-x` only), home carousel `object-fit: contain`, cart policy spacer, LAN checkout idempotency (`createClientId`), **responsive-pages-ui** Playwright matrix (423 tests total; 193 mobile-chrome) |

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
| [AUDIT_SUMMARY.md](AUDIT_SUMMARY.md) | Security controls reference + open gaps (synced with audit) |
| [PROJECT_AUDIT.md](PROJECT_AUDIT.md) | Full audit snapshot (2026-06-08) + remediation log — **do not re-audit wholesale** |
| [COVERAGE_MATRIX.md](COVERAGE_MATRIX.md) | Doc → code → test map — **update per PR** (avoids repeat audits) |
| [PERFORMANCE_BASELINE.md](./PERFORMANCE_BASELINE.md) | Frontend bundle budgets, WebP asset pipeline, optimization metrics |
| [MEDIA_ASSET_GUIDE.md](./MEDIA_ASSET_GUIDE.md) | Static and product image conventions |

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
| [WHATSAPP_CHECKOUT_GUIDE.md](./WHATSAPP_CHECKOUT_GUIDE.md) | WhatsApp checkout flow and admin payment confirmation |
| [ORDER_MANAGEMENT_GUIDE.md](./ORDER_MANAGEMENT_GUIDE.md) | Admin order operations |
| [ORDER_TRACKING_QUICKSTART.md](./ORDER_TRACKING_QUICKSTART.md) | Customer order lookup |

---

## Deployment and operations

| Document | Purpose |
|----------|---------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Railway production deploy |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Extended deployment notes |
| [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) | **Go-live checklist** (env, SQL, smoke tests) |
| [LAUNCH_COST_STRATEGY.md](./LAUNCH_COST_STRATEGY.md) | **Launch budget** — setup accounts, infra tiers, Instagram ads plan |
| [CLOUDFLARE_RAILWAY.md](./CLOUDFLARE_RAILWAY.md) | Cloudflare + Railway setup |
| [SSL_DNS_CHECKLIST.md](./SSL_DNS_CHECKLIST.md) | HTTPS and DNS |
| [SEARCH_CONSOLE_SETUP.md](./SEARCH_CONSOLE_SETUP.md) | Google Search Console |
| [RESTART_BACKEND.md](./RESTART_BACKEND.md) | Backend restart |
| [GET_DATABASE_URL.md](./GET_DATABASE_URL.md) | Supabase connection string |
| [SUPABASE_KEEP_ALIVE.md](./SUPABASE_KEEP_ALIVE.md) | Daily read-only DB ping (GitHub Actions) |

---

## Database

| Document | Purpose |
|----------|---------|
| [SUPABASE_SETUP_INSTRUCTIONS.md](./SUPABASE_SETUP_INSTRUCTIONS.md) | Supabase project setup |
| [SUPABASE_SQL_TO_RUN.md](./SUPABASE_SQL_TO_RUN.md) | SQL scripts |
| [SUPABASE_KEEP_ALIVE.md](./SUPABASE_KEEP_ALIVE.md) | Daily read-only DB ping (GitHub Actions) |
| [STEP_BY_STEP_SQL.md](./STEP_BY_STEP_SQL.md) | Step-by-step SQL |
| [RLS_OPTIMIZATION.md](./RLS_OPTIMIZATION.md) | Row-level security |

---

## QA checklists

| Document | Purpose |
|----------|---------|
| [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) | Production go-live (env, DB, WhatsApp checkout, smoke tests) |
| [RESPONSIVE_QA_CHECKLIST.md](./RESPONSIVE_QA_CHECKLIST.md) | Responsive layout QA (includes form Issues cross-check) |
| [MOBILE_RESPONSIVE.md](./MOBILE_RESPONSIVE.md) | Mobile breakpoints, safe areas, sticky CTAs, Playwright matrix |
| [FORMS_QA_CHECKLIST.md](./FORMS_QA_CHECKLIST.md) | Forms, CSRF, validation, form accessibility (`audit-form-labels.mjs`, Chrome DevTools) |

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
| [DEBUG_FETCH_ERROR.md](./DEBUG_FETCH_ERROR.md) | API fetch / CORS issues |
