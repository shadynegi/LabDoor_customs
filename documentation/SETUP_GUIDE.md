# Setup Guide

Detailed local and staging configuration for Lab Door Customs.

**Quick start:** [QUICK_START.md](./QUICK_START.md) | **Full reference:** [`info.md`](info.md)

---

## Repository structure

```
LabDoor_customs/
├── package.json      Root workspace — dev, build, start, test
├── railway.json      Production deploy config
├── backend/          Express API + static SPA hosting
│   ├── src/
│   │   ├── server.ts
│   │   ├── routes/
│   │   ├── lib/
│   │   ├── middleware/
│   │   └── database/
├── frontend/         React SPA (Vite)
│   ├── src/
│   └── scripts/
├── Tests/            Vitest + Playwright
│   ├── backend/
│   ├── api/
│   └── frontend/
└── documentation/
```

---

## Installation

```bash
cp backend/env.template backend/.env
cp frontend/env.template frontend/.env
npm install
```

---

## Backend configuration

Copy `backend/env.template` to `backend/.env`.

### Database

Use Supabase PostgreSQL. For app servers, use the **connection pooler** (port 6543):

```
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:6543/postgres?pgbouncer=true
```

Run `backend/src/database/schema.sql` in the Supabase SQL editor, then apply migration files as needed. The server also runs runtime patches for payment tables at startup.

### PayPal (sandbox)

1. Create an app at [developer.paypal.com](https://developer.paypal.com).
2. Set `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_MODE=sandbox`.
3. For webhook testing locally, use ngrok and set `PAYPAL_WEBHOOK_ID`.

See [PAYPAL_SETUP_GUIDE.md](./PAYPAL_SETUP_GUIDE.md).

### Admin password

Generate a bcrypt hash:

```bash
node backend/scripts/generate-admin-hash.mjs "your-secure-password"
```

For local development only, you may also use:

```bash
curl -X POST http://localhost:5000/api/admin/generate-hash \
  -H "Content-Type: application/json" \
  -d '{"password":"your_secure_password"}'
```

Set `ADMIN_PASSWORD_HASH` in production (not plaintext `ADMIN_PASSWORD`).

### Order tokens and activity privacy

```
ORDER_TOKEN_ENCRYPTION_KEY=your_32_char_key_for_aes_gcm_checkout_exchange
IP_SALT=random_salt_for_ip_anonymization_and_review_votes
```

Both are required in production (`validate-env.mjs`). `ORDER_TOKEN_ENCRYPTION_KEY` encrypts access tokens in `order_checkout_exchanges`; `IP_SALT` salts activity IP anonymization and review voter ID derivation.

### Email (Resend)

```
RESEND_API_KEY=re_xxx
SENDER_EMAIL=noreply@yourdomain.com
COMPANY_NAME=Lab Door Customs
COMPANY_SUPPORT_EMAIL=support@yourdomain.com
```

### Redis (optional locally, required in production)

```
REDIS_URL=redis://localhost:6379
```

Without Redis locally, the app uses in-memory cache and rate limit fallbacks.

### Static SPA hosting

| Variable | Purpose |
|----------|---------|
| `SERVE_FRONTEND` | `true` forces static hosting when `frontend/dist` exists; `false` disables |
| `FRONTEND_DIST_PATH` | Override path to built SPA (default: `frontend/dist`) |

In production, static hosting is enabled automatically when `frontend/dist/index.html` exists after `npm run build`.

---

## Frontend configuration

Copy `frontend/env.template` to `frontend/.env`:

```
VITE_API_BASE_URL=/api
```

Vite proxies `/api` to the backend during `npm run dev`.

Optional:

```
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_GSC_VERIFICATION=verification_token
VITE_SITE_URL=http://localhost:5173
```

Strict env validation (`validate-env.mjs`) runs when `CI=true` or `NODE_ENV=production`.

---

## Scripts

| Command | Location | Purpose |
|---------|----------|---------|
| `npm run dev` | root | API (5000) + Vite (5173) in parallel |
| `npm run build` | root | Frontend build, then backend compile |
| `npm start` | root | Express server (API + static SPA in production) |
| `npm test` | root | Vitest (backend) |
| `npm run validate-env` | root | Backend + frontend env validation |
| `npm run test:frontend` | root | Playwright smoke tests |
| `npm run links:check` | root | Documentation link checker |

Workspace-specific commands: `npm run dev -w backend`, `npm run build -w frontend`, etc.

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| CORS errors | `FRONTEND_URL` matches the browser origin |
| CSRF 403 | Call `/api/csrf-token` first; cookies enabled |
| PayPal redirect fails | `FRONTEND_URL` and PayPal return URLs |
| DB connection | Pooler URL, SSL settings, Supabase status |
| Empty products | Run schema.sql and seed data |
| SPA routes 404 in production | Run `npm run build`; check `frontend/dist` exists |

See [DEBUG_FETCH_ERROR.md](./DEBUG_FETCH_ERROR.md) and [diagnose-paypal-issue.md](./diagnose-paypal-issue.md).
