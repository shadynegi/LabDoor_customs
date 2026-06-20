# Pre-Launch Checklist

Tick every item before pointing production traffic at Lab Door Customs.

**References:** [`info.md`](info.md) · [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) · [SUPABASE_SQL_TO_RUN.md](./SUPABASE_SQL_TO_RUN.md) · [PAYPAL_SETUP_GUIDE.md](./PAYPAL_SETUP_GUIDE.md) · [SSL_DNS_CHECKLIST.md](./SSL_DNS_CHECKLIST.md)

---

## Phase 1 — Database (Supabase)

Run in the **Supabase SQL Editor** (or psql on port 5432). Scripts live in `backend/src/database/`. **Production:** see [SUPABASE_SQL_TO_RUN.md](./SUPABASE_SQL_TO_RUN.md) → *Migration audit* — verify before re-running; performance + search migrations are already applied.

- [ ] Base schema applied (`schema.sql` on fresh DB, or already present from prior setup)
- [ ] `migration-reviews.sql` (if reviews not yet enabled)
- [ ] `migration-activity-logs.sql`
- [ ] `migration-rls-tighten.sql`
- [ ] `migration-rls-sensitive-tables.sql`
- [ ] `migration-rls-drop-authenticated-policies.sql` (if applicable)
- [ ] `migration-revoke-graphql-client-roles.sql`
- [ ] `migration-order-access-exchange.sql` — order email tracking links
- [x] `migration-performance-linter-fixes.sql` (applied on production Supabase)
- [x] `migration-products-search-trgm.sql` (applied on production Supabase)
- [ ] Payment/checkout tables present **or** confirmed created on first backend boot (`order_checkout_exchanges`, `order_access_exchanges`, `payment_idempotency`, etc.)

**After SQL:**

- [ ] `DATABASE_URL` uses **PgBouncer pooler** (port **6543**) on Railway, not direct 5432
- [ ] Backend deployed/restarted once — check deploy logs for `Bootstrap: skipping rls_policies` or successful RLS apply (not `BOOTSTRAP_FORCE_RLS` on routine restarts)
- [ ] No startup error about RLS (set `ALLOW_INSECURE_RLS=true` only for local non-Supabase dev)

---

## Phase 2 — Railway runtime environment

Set on the **Railway service** (repository root). The server **exits on boot** if any required prod var is missing.

### Required

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` — Supabase pooler connection string
- [ ] `FRONTEND_URL` — public storefront URL, e.g. `https://www.labdoorcustoms.com` (no trailing slash)
- [ ] `TRUST_CLOUDFLARE=true`
- [ ] `REDIS_URL` — Redis instance URL (required; health returns 503 if down)
- [ ] `JWT_SECRET` — 32+ characters with uppercase, lowercase, number, and special character
- [ ] `ADMIN_USERNAME` — admin login username
- [ ] `ADMIN_PASSWORD_HASH` — bcrypt hash from `node backend/scripts/generate-admin-hash.mjs "YourSecurePassword"` (**not** plain text)
- [ ] `ORDER_TOKEN_ENCRYPTION_KEY` — 32+ chars (`openssl rand -base64 32`)
- [ ] `IP_SALT` — random salt for activity anonymization and review voter IDs
- [ ] `PAYPAL_CLIENT_ID` — **Live** app credentials
- [ ] `PAYPAL_SECRET` — **Live** app secret
- [ ] `PAYPAL_MODE=live`
- [ ] `PAYPAL_WEBHOOK_ID` — from PayPal Developer Dashboard → Webhooks
- [ ] `RESEND_API_KEY` — transactional email
- [ ] `SENTRY_DSN` — backend error tracking

### Recommended

- [ ] `SENDER_EMAIL` — verified sender in Resend (e.g. `orders@yourdomain.com`)
- [ ] `COMPANY_NAME`, `COMPANY_SUPPORT_EMAIL`
- [ ] `SUPABASE_URL` + `SUPABASE_KEY` (service_role) if used by tooling
- [ ] `DB_SSL_CA_PATH` if your host requires explicit CA bundle
- [ ] `LOG_LEVEL=info`

### Validate locally before deploy

```bash
# From repo root — mirrors production gates
CI_VALIDATE_PRODUCTION=true NODE_ENV=production node backend/scripts/validate-env.mjs
```

(Set all required vars in the shell or `.env` for this command.)

- [ ] `validate-env` prints `OK`

---

## Phase 3 — Railway build-time (frontend)

Set on the **same Railway service** so `npm run build` succeeds.

- [ ] `VITE_API_BASE_URL=/api`
- [ ] `VITE_SITE_URL` — same public URL as `FRONTEND_URL`
- [ ] `VITE_SENTRY_DSN` — frontend Sentry (required in CI/production builds)

### Optional (SEO / analytics)

- [ ] `VITE_GA4_MEASUREMENT_ID` — loads only after analytics cookie consent
- [ ] `VITE_GSC_VERIFICATION` — Search Console meta tag
- [ ] `SITEMAP_API_BASE_URL` — live API URL for sitemap generation in CI/build

---

## Phase 4 — Cloudflare, DNS, and SSL

See [SSL_DNS_CHECKLIST.md](./SSL_DNS_CHECKLIST.md) and [CLOUDFLARE_RAILWAY.md](./CLOUDFLARE_RAILWAY.md).

- [ ] Domain DNS → Cloudflare → Railway (orange-cloud **proxied**)
- [ ] Cloudflare SSL mode: **Full (strict)**
- [ ] `www` and apex redirect policy decided (canonical URL matches `FRONTEND_URL` / `VITE_SITE_URL`)
- [ ] Direct Railway `.up.railway.app` URL **not** used by customers (Cloudflare is the public entry)
- [ ] Railway healthcheck path: `/api/health`

---

## Phase 5 — PayPal Live

See [PAYPAL_SETUP_GUIDE.md](./PAYPAL_SETUP_GUIDE.md).

- [ ] PayPal **Live** REST app created; Client ID + Secret in Railway
- [ ] Webhook subscribed to production URL: `https://www.yourdomain.com/api/paypal/webhook`
- [ ] Webhook events include at least: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, refund/reversal events your flow uses
- [ ] `PAYPAL_WEBHOOK_ID` matches the live webhook in the dashboard
- [ ] Return URL domain matches `FRONTEND_URL` (PayPal redirects to your site after approval)

---

## Phase 6 — Email (Resend)

- [ ] Resend domain verified (SPF/DKIM)
- [ ] `SENDER_EMAIL` uses verified domain
- [ ] Test order confirmation delivers (not spam) after first real order

---

## Phase 7 — Redis and monitoring

- [ ] Redis provisioned and `REDIS_URL` reachable from Railway
- [ ] Sentry project receives backend + frontend events
- [ ] `/api/health` returns **200** with `database: connected` and `redis: connected`

```bash
curl -s https://www.yourdomain.com/api/health | jq .
```

Expected: `"status": "OK"`, PayPal `mode: live`.

---

## Phase 8 — Deploy

From repository root on Railway:

- [ ] Build: `npm install && npm run build` (see `railway.json`)
- [ ] Start: `npm start`
- [ ] Deploy logs show no missing-env exit
- [ ] Deploy logs show RLS migration applied
- [ ] CI on `main` is green (tests, build, E2E smoke)

---

## Phase 9 — Manual smoke tests (required)

CI does **not** run a live PayPal payment. Complete these on **desktop and a real phone**.

### Storefront

- [ ] Home, products, product detail load over HTTPS
- [ ] Add to cart → cart page → checkout
- [ ] Cookie banner does not block PayPal / Checkout on mobile (banner at top on purchase routes)
- [ ] PayPal Live checkout completes → payment success page
- [ ] Cart cleared after successful payment
- [ ] Out-of-stock product shows badge and disabled add-to-cart

### Order email and tracking

- [ ] Order confirmation email received
- [ ] **View Order Status** link uses `?code=` (not `?token=`)
- [ ] Link opens `/orders` and shows the order without re-entering token
- [ ] Manual lookup still works: order number + access token at `/orders`

### Admin (`/adminshivamdashboard`)

- [ ] Login with `ADMIN_USERNAME` + password (hash verified server-side)
- [ ] Orders tab shows new order; payment status `completed`
- [ ] Update order status (e.g. processing → shipped) if applicable
- [ ] Products tab: stock/OOS toggle works; catalog refreshes on storefront

### Reviews and contact (optional but recommended)

- [ ] Submit contact form; message appears in admin Messages tab
- [ ] Submit product review (pending); approve in Reviews tab; visible on storefront **without** customer email

### PayPal webhook

- [ ] PayPal Developer Dashboard → Webhook → recent delivery **success** after a test payment
- [ ] Or: payment still completes via capture endpoint if webhook delayed (capture path is primary)

---

## Phase 10 — Post-launch (first 24–48 hours)

- [ ] Monitor Sentry for new errors
- [ ] Watch `/api/health` (Railway or external uptime)
- [ ] Confirm Redis memory stable (rate-limit keys)
- [ ] Spot-check admin cancel of unpaid pending orders; confirm paid orders cannot cancel/refund (no-refund policy)
- [ ] Google Search Console / sitemap submitted if using SEO vars

---

## Quick “not ready” signals

Do **not** go live if any of these are true:

| Signal | Action |
|--------|--------|
| `validate-env` fails | Fix missing/invalid env vars |
| `/api/health` returns 503 | Fix DB or Redis |
| Boot log: RLS migration failed | Run SQL migrations; check Supabase URL |
| PayPal still in `sandbox` | Set `PAYPAL_MODE=live` and live credentials |
| `TRUST_CLOUDFLARE` not `true` | Set before production traffic |
| Admin password is plain text in env | Use `ADMIN_PASSWORD_HASH` only |
| No webhook ID | Set `PAYPAL_WEBHOOK_ID`; reconciliation may lag |

---

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Technical | | | Migrations + env + health OK |
| Payments | | | Live PayPal + webhook verified |
| QA | | | Phase 9 smoke tests passed |

When all phases are checked, the codebase and operations are aligned for production traffic.
