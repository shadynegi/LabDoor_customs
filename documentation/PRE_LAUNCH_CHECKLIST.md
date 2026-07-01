# Pre-Launch Checklist

Tick every item before pointing production traffic at Lab Door Customs.

**References:** [`info.md`](info.md) · [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) · [LAUNCH_COST_STRATEGY.md](./LAUNCH_COST_STRATEGY.md) · [SUPABASE_SQL_TO_RUN.md](./SUPABASE_SQL_TO_RUN.md) · [WHATSAPP_CHECKOUT_GUIDE.md](./WHATSAPP_CHECKOUT_GUIDE.md) · [SSL_DNS_CHECKLIST.md](./SSL_DNS_CHECKLIST.md)

---

## Phase 1 — Database (Supabase)

Run in the **Supabase SQL Editor** (or psql on port 5432). Scripts live in `backend/src/database/`. **Production:** all required migrations are applied — see [SUPABASE_SQL_TO_RUN.md](./SUPABASE_SQL_TO_RUN.md).

- [x] Base schema applied (`schema.sql` on fresh DB, or already present from prior setup)
- [x] `migration-reviews.sql` (if reviews not yet enabled)
- [x] `migration-activity-logs.sql`
- [x] `migration-rls-tighten.sql` (reference; policies active via boot + performance migration)
- [x] `migration-rls-sensitive-tables.sql`
- [x] `migration-rls-drop-authenticated-policies.sql` (if applicable)
- [x] `migration-revoke-graphql-client-roles.sql`
- [x] `migration-order-access-exchange.sql` — order email tracking links
- [x] `migration-performance-linter-fixes.sql` (applied on production Supabase)
- [x] `migration-products-search-trgm.sql` (applied on production Supabase)
- [x] `migration-products-video-360.sql` — `products.video_360`
- [x] `migration-admin-enhancements.sql` — inventory, SKU, order line items, admin notes
- [x] Payment/checkout tables present (`order_checkout_exchanges`, `order_access_exchanges`, `payment_idempotency`, etc.)

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
- [ ] `WHATSAPP_ORDER_PHONE` — optional; digits only (default `919888514572`)
- [ ] `RESEND_API_KEY` — transactional email
- [ ] `SENTRY_DSN` — backend error tracking

### Recommended

- [ ] `SENDER_EMAIL` — verified sender in Resend (e.g. `orders@yourdomain.com`)
- [ ] `COMPANY_NAME`, `COMPANY_SUPPORT_EMAIL`
- [ ] `SUPABASE_URL` + `SUPABASE_KEY` (service_role) if used by tooling
- [ ] `DB_SSL_CA_PATH` if your host requires explicit CA bundle
- [ ] `LOG_LEVEL=info`
- [ ] **`UPLOAD_DIR`** — mount a **Railway persistent volume** for admin product uploads (default `./uploads` is ephemeral; Multer files are lost on redeploy without a volume)

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

## Phase 5 — WhatsApp checkout

See [WHATSAPP_CHECKOUT_GUIDE.md](./WHATSAPP_CHECKOUT_GUIDE.md).

- [ ] `WHATSAPP_ORDER_PHONE` set to the correct business number (or default verified)
- [ ] Test **Place Order** on staging/production → WhatsApp opens with pre-filled message
- [ ] Admin can find order by order number from the message
- [ ] **Mark paid** moves order to `processing` and sends confirmation email (if Resend configured)

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

Expected: `"status": "OK"`, database and Redis connected.

---

## Phase 8 — Deploy

From repository root on Railway:

- [ ] Build: `npm install && npm run build` (see `railway.json`)
- [ ] Start: `npm start`
- [ ] Deploy logs show no missing-env exit
- [ ] Deploy logs show RLS migration applied
- [ ] CI on `main` is green (**207** automated tests + build + E2E smoke — see [`test_guidelines.md`](test_guidelines.md))

---

## Phase 9 — Manual smoke tests (required)

CI does **not** open a live WhatsApp session. Complete these on **desktop and a real phone**.

### Storefront

- [ ] Home, products, product detail load over HTTPS
- [ ] Add to cart → cart page → checkout
- [ ] Cookie banner does not block checkout on mobile (banner at top on purchase routes)
- [ ] **Place Order** completes → WhatsApp opens with order details
- [ ] Cart cleared after successful place-order
- [ ] Out-of-stock product shows badge and disabled add-to-cart

### Order email and tracking

- [ ] Order confirmation email received
- [ ] **View Order Status** link uses `?code=` (not `?token=`)
- [ ] Link opens `/orders` and shows the order without re-entering token
- [ ] Manual lookup still works: order number + access token at `/orders`

### Admin (`/admin` or `/adminshivamdashboard`)

- [ ] `/admin` redirects to login when logged out, dashboard when logged in
- [ ] Login with `ADMIN_USERNAME` + password (hash verified server-side)
- [ ] Orders tab shows new order; **Mark paid** after WhatsApp confirmation
- [ ] Update order status (e.g. processing → shipped) if applicable
- [ ] Products tab: stock/OOS toggle works; catalog refreshes on storefront

### Reviews and contact (optional but recommended)

- [ ] Submit contact form; confirm submission succeeds (stored in `contact_messages`; no admin inbox tab — check Supabase or email notifications if configured)
- [ ] Submit product review (pending); approve in Reviews tab; visible on storefront **without** customer email

### WhatsApp confirmation

- [ ] Customer sends WhatsApp message; admin receives order number in message
- [ ] Admin **Mark paid** with payment reference updates order to `completed` / `processing`

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
| PayPal env vars still set | Remove `PAYPAL_*` — no longer used |
| `TRUST_CLOUDFLARE` not `true` | Set before production traffic |
| Admin password is plain text in env | Use `ADMIN_PASSWORD_HASH` only |
| No WhatsApp number | Set `WHATSAPP_ORDER_PHONE` or verify default |

---

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Technical | | | Migrations + env + health OK |
| Payments | | | WhatsApp checkout + admin mark paid verified |
| QA | | | Phase 9 smoke tests passed |

When all phases are checked, the codebase and operations are aligned for production traffic.
