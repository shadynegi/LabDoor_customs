# Quick Start

Get Lab Door Customs running locally in about 10 minutes.

**Full reference:** [`info.md`](info.md)

---

## Prerequisites

- Node.js 20+
- PostgreSQL database (Supabase free tier works)
- PayPal Developer sandbox account
- Resend API key (for emails — optional for basic testing)

---

## 1. Clone and install

```bash
cd LabDoor_customs
cp backend/env.template backend/.env
cp frontend/env.template frontend/.env
npm install
```

---

## 2. Configure backend (`.env`)

Minimum for local dev:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:6543/postgres?pgbouncer=true
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_SECRET=your_sandbox_secret
PAYPAL_MODE=sandbox
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2b$12$your_bcrypt_hash_here
JWT_SECRET=your_secure_jwt_secret_at_least_32_characters_long
ORDER_TOKEN_ENCRYPTION_KEY=your_32_char_encryption_key_for_checkout_tokens
IP_SALT=random_salt_for_ip_anonymization
RESEND_API_KEY=re_xxx
SENDER_EMAIL=noreply@yourdomain.com
```

`ORDER_TOKEN_ENCRYPTION_KEY` and `IP_SALT` are required in production (`validate-env.mjs`).

Generate `ADMIN_PASSWORD_HASH` locally (never use plaintext `ADMIN_PASSWORD`):

```bash
node backend/scripts/generate-admin-hash.mjs "your-secure-password"
```

In development you may also call `POST /api/admin/generate-hash` — that route returns **403 in production**.

**Recommended after running SQL in Supabase:**

```env
BOOTSTRAP_SKIP_DDL=true
LOG_LEVEL=debug
```

Apply the database schema:

```bash
# Run backend/src/database/schema.sql in Supabase SQL editor
# Then run any migration-*.sql files as needed
```

---

## 3. Configure frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=/api
```

Vite proxies `/api` to the backend during development.

---

## 4. Start development

```bash
npm run dev
```

Starts the API (port 5000) and Vite dev server (port 5173) together.

- Storefront: http://localhost:5173
- API health: http://localhost:5000/api/health (or http://localhost:5173/api/health via proxy)
- Admin login: http://localhost:5173/admin/login (or `/admin` — redirects based on session). If port 5173 is busy, Vite may use **5174**; LAN devices on the same Wi‑Fi can use your machine’s IP (dev CORS allows private LAN origins).

**Corporate VPN / Zscaler:** If Supabase DNS is blocked, the API still starts but bootstrap and DB routes fail with `ENOTFOUND db.*.supabase.co`. Health returns **503** with `"status":"DEGRADED"`. CSRF and frontend pages still work; use an off-VPN network or allowlist `*.supabase.co` for full local testing.

**Quick sanity (dev running):**

```powershell
# API up (503 DEGRADED is OK when DB unreachable)
curl.exe -s http://127.0.0.1:5000/api/health

# CSRF + frontend
curl.exe -s http://127.0.0.1:5000/api/csrf-token
curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:5173/
```

**Normal dev logs:** `API ready — bootstrap continues in background`, `Bootstrap: database reachable`, `Core bootstrap complete`, then `Maintenance jobs scheduled`. After ~2 minutes, `Maintenance: initial run complete`. If the laptop sleeps later, a single `Maintenance: skipped (database unreachable)` is expected — your `DATABASE_URL` is still fine; cleanup resumes on the next interval. See [`info.md` — Maintenance warnings vs wrong DATABASE_URL](info.md#maintenance-warnings-vs-wrong-database_url).

**Production-like single server** (optional):

```bash
npm run build
cd backend && SERVE_FRONTEND=true npm start
# → http://localhost:5000
```

---

## 5. Verify

```bash
npm test
```

For a **production-like build** locally, set `frontend/.env` with `VITE_API_BASE_URL`, `VITE_SITE_URL`, and `VITE_SENTRY_DSN` (or run with `NODE_ENV=development` to skip strict env checks). Then:

```bash
npm run build
```

**Production:** all required migrations are applied (June 2026). **Local/new Supabase:** run `schema.sql` and `migration-*.sql` files from `backend/src/database/`, or rely on boot-time schema helpers on first Railway deploy.

---

## Next steps

- [SETUP_GUIDE.md](./SETUP_GUIDE.md) — detailed configuration
- [PAYPAL_SETUP_GUIDE.md](./PAYPAL_SETUP_GUIDE.md) — PayPal sandbox and webhooks
- [DATABASE_SETUP.md](./DATABASE_SETUP.md) — schema and migrations
- [ADMIN_DASHBOARD_GUIDE.md](./ADMIN_DASHBOARD_GUIDE.md) — admin workflows
