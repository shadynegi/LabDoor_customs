# Quick Start

Get Lab Door Customs running locally in about 10 minutes.

**Full reference:** [`../info.md`](../info.md)

---

## Prerequisites

- Node.js 20+
- PostgreSQL database (Supabase free tier works)
- PayPal Developer sandbox account
- Resend API key (for emails — optional for basic testing)

---

## 1. Clone and install

```bash
cd LabDoor_customs/backend
cp env.template .env
npm install

cd ../frontend
cp env.template .env
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
RESEND_API_KEY=re_xxx
SENDER_EMAIL=noreply@yourdomain.com
```

Apply the database schema:

```bash
# Run backend/src/database/schema.sql in Supabase SQL editor
# Then run any migration-*.sql files as needed
```

---

## 3. Configure frontend (`.env`)

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_BACKEND_URL=http://localhost:5000
```

---

## 4. Start servers

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

- Storefront: http://localhost:5173
- API health: http://localhost:5000/api/health
- Admin login: http://localhost:5173/admin/login
- Admin dashboard: http://localhost:5173/adminshivamdashboard

---

## 5. Verify

```bash
cd backend && npm test
cd frontend && npm run build   # skips strict env in dev
```

---

## Next steps

- [SETUP_GUIDE.md](./SETUP_GUIDE.md) — detailed configuration
- [PAYPAL_SETUP_GUIDE.md](./PAYPAL_SETUP_GUIDE.md) — PayPal sandbox and webhooks
- [DATABASE_SETUP.md](./DATABASE_SETUP.md) — schema and migrations
- [ADMIN_DASHBOARD_GUIDE.md](./ADMIN_DASHBOARD_GUIDE.md) — admin workflows
