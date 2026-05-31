# Setup Guide

Detailed local and staging configuration for Lab Door Customs.

**Quick start:** [QUICK_START.md](./QUICK_START.md) | **Full reference:** [`../info.md`](../info.md)

---

## Repository structure

```
LabDoor_customs/
├── backend/          Express API
│   ├── src/
│   │   ├── server.ts
│   │   ├── routes/
│   │   ├── lib/
│   │   ├── middleware/
│   │   └── database/
│   └── tests/
├── frontend/         React SPA
│   ├── src/
│   ├── e2e/
│   └── scripts/
└── documentation/
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
curl -X POST http://localhost:5000/api/admin/generate-hash \
  -H "Content-Type: application/json" \
  -d '{"password":"your_secure_password"}'
```

For production, set `ADMIN_PASSWORD_HASH` instead of plaintext `ADMIN_PASSWORD`.

### Email (Resend)

Sign up at [resend.com](https://resend.com), verify your domain, set:

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

### Logging

```
LOG_LEVEL=debug    # development
LOG_LEVEL=info     # production
```

Pino outputs pretty logs in development and JSON in production.

---

## Frontend configuration

Copy `frontend/env.template` to `frontend/.env`:

```
VITE_API_BASE_URL=http://localhost:5000/api
VITE_BACKEND_URL=http://localhost:5000
```

Optional:

```
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_GSC_VERIFICATION=verification_token
VITE_SITE_URL=http://localhost:5173
```

Strict env validation (`validate-env.mjs`) only runs when `CI=true` or `NODE_ENV=production`.

---

## Scripts

| Command | Location | Purpose |
|---------|----------|---------|
| `npm run dev` | backend | Nodemon + ts-node |
| `npm run build` | backend | TypeScript compile |
| `npm start` | backend | Run `dist/server.js` |
| `npm test` | backend | Vitest |
| `npm run dev` | frontend | Vite dev server |
| `npm run build` | frontend | validate-env + sitemap + build |
| `npm run test:e2e` | frontend | Playwright |
| `npm run links:check` | root | Doc link checker |

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| CORS errors | `FRONTEND_URL` matches frontend origin |
| CSRF 403 | Call `/api/csrf-token` first; cookies enabled |
| PayPal redirect fails | `FRONTEND_URL` and PayPal return URLs |
| DB connection | Pooler URL, SSL settings, Supabase status |
| Empty products | Run schema.sql and seed data |

See [DEBUG_FETCH_ERROR.md](./DEBUG_FETCH_ERROR.md) and [diagnose-paypal-issue.md](./diagnose-paypal-issue.md).
