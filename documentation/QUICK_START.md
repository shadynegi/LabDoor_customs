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
ADMIN_PASSWORD=your_password
JWT_SECRET=your_secure_jwt_secret_at_least_32_characters_long
ORDER_TOKEN_ENCRYPTION_KEY=your_32_char_encryption_key_for_checkout_tokens
IP_SALT=random_salt_for_ip_anonymization
RESEND_API_KEY=re_xxx
SENDER_EMAIL=noreply@yourdomain.com
```

`ORDER_TOKEN_ENCRYPTION_KEY` and `IP_SALT` are required in production (`validate-env.mjs`).

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
- Admin login: http://localhost:5173/admin/login

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
npm run build
```

---

## Next steps

- [SETUP_GUIDE.md](./SETUP_GUIDE.md) — detailed configuration
- [PAYPAL_SETUP_GUIDE.md](./PAYPAL_SETUP_GUIDE.md) — PayPal sandbox and webhooks
- [DATABASE_SETUP.md](./DATABASE_SETUP.md) — schema and migrations
- [ADMIN_DASHBOARD_GUIDE.md](./ADMIN_DASHBOARD_GUIDE.md) — admin workflows
