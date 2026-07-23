# Lab Door Customs — Start-to-Test Guide

Sequential commands from a fresh clone through running the app and executing the full test suite.

**Related docs:** [QUICK_START.md](QUICK_START.md) (short setup), [test_guidelines.md](test_guidelines.md) (test details), [info.md](info.md) (system reference).

---

## Prerequisites

- **Node.js 20+**
- **PostgreSQL** (Supabase free tier works) — required for local dev with a real database
- **WhatsApp** — `WHATSAPP_CONTACT_NUMBER` (backend) and `VITE_WHATSAPP_CONTACT_NUMBER` (frontend build)

---

## Phase 1 — One-time setup

Open a terminal in the repository root (folder containing `package.json`).

### 1. Go to the project

```powershell
cd C:\Users\TejasBogra\Downloads\LDC
```

Adjust the path if you cloned the repo elsewhere.

### 2. Create environment files

**Windows (PowerShell):**

```powershell
Copy-Item backend\env.template backend\.env
Copy-Item frontend\env.template frontend\.env
```

**macOS / Linux:**

```bash
cp backend/env.template backend/.env
cp frontend/env.template frontend/.env
```

### 3. Configure environment variables

Edit the files in your editor.

**`backend/.env`** — minimum for local development:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:6543/postgres?pgbouncer=true
WHATSAPP_CONTACT_NUMBER=+91XXXXXXXXXX
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2b$12$your_bcrypt_hash_here
JWT_SECRET=your_secure_jwt_secret_at_least_32_characters_long
ORDER_TOKEN_ENCRYPTION_KEY=your_32_char_encryption_key_for_checkout_tokens
IP_SALT=random_salt_for_ip_anonymization
```

**`frontend/.env`:**

```env
VITE_API_BASE_URL=/api
VITE_WHATSAPP_CONTACT_NUMBER=+91XXXXXXXXXX
```

Vite proxies `/api` to the backend during development.

Generate the admin hash with `node backend/scripts/generate-admin-hash.mjs "your-secure-password"` (or `POST /api/admin/generate-hash` in local dev only).

See [SETUP_GUIDE.md](SETUP_GUIDE.md) and [info.md](info.md) for the full variable list.

### 4. Install dependencies

From the repository root:

```powershell
npm install
```

### 5. Install Playwright (first time only)

UI tests live in the `Tests/` workspace and need Chromium:

```powershell
cd Tests
npm install
npm run test:frontend:install
cd ..
```

### 6. Set up the database

In the **Supabase SQL editor** (not a terminal command):

1. Run `backend/src/database/schema.sql`
2. Run any `backend/src/database/migration-*.sql` files you have not applied yet

See [DATABASE_SETUP.md](DATABASE_SETUP.md) and [SUPABASE_SQL_TO_RUN.md](SUPABASE_SQL_TO_RUN.md) for details.

---

## Phase 2 — Validate configuration

From the repository root:

```powershell
npm run validate-env
```

Fix any reported issues before starting the app.

Optional optimization baseline: `npm run audit:codebase` (writes `documentation/OPTIMIZATION_BASELINE.md`).

---

## Phase 3 — Start the application (development)

From the repository root:

```powershell
npm run dev
```

This starts both (orchestrated by `scripts/dev.mjs` + `concurrently`; single `Ctrl+C` stops both on Windows):

| Service | URL |
|---------|-----|
| Frontend (Vite) | http://localhost:5173 |
| Backend API | http://localhost:5000 |

**Manual checks in the browser:**

| Page | URL |
|------|-----|
| Storefront | http://localhost:5173 |
| API health (via proxy) | http://localhost:5173/api/health |
| API health (direct) | http://localhost:5000/api/health |
| Admin login | http://localhost:5173/admin/login |

Stop dev servers with `Ctrl+C` when you are done manually testing (exit code 0 when stopped intentionally).

---

## Phase 4 — Run automated tests

Open a **new** terminal (dev servers do not need to be running). From the repository root:

```powershell
cd C:\Users\TejasBogra\Downloads\LDC
npm test
```

This single command runs all suites in order:

| Suite | Tool | Tests | Needs live DB? |
|-------|------|-------|----------------|
| Backend unit | Vitest | 138 | No (mocked) |
| API integration | Vitest | 78 | No (mocked) |
| Frontend unit | Vitest + RTL | 13 | No |
| Frontend UI | Playwright | 286 (93 desktop + 193 mobile) | No (mocked API + static preview) |
| Viewport overflow audit | Playwright script | 12 widths × 16 routes | No (static preview) |
| **Total** | | **520** | |

The runner auto-builds the frontend for UI tests if `frontend/dist` is missing, installs Playwright in `Tests/` on first run if needed, and runs the viewport overflow audit after Playwright.

### Test reports

Reports are written to `documentation/test-results/`:

| File | Contents |
|------|----------|
| `backend-unit-{runId}.md` / `.json` | Backend unit test results |
| `api-{runId}.md` / `.json` | API integration results |
| `frontend-unit-{runId}.md` / `.json` | Frontend unit (RTL) results |
| `frontend-ui-{runId}.md` / `.json` | Playwright UI results |
| `viewport-audit-{runId}.md` / `.json` | Viewport overflow audit |
| `summary-{runId}.md` / `.json` | Combined overview |
| `latest-summary.json` | Most recent full run |

`{runId}` is a timestamp such as `2026-06-06_13-19-41` shared across all reports from one `npm test` run.

### Run individual suites

```powershell
npm run test:backend       # Backend unit only
npm run test:api           # API integration only
npm run test:frontend-unit # React component/hook unit tests
npm run test:frontend      # Playwright UI + viewport audit (alias: npm run test:ui)
npm run test:all           # Same as npm test
```

See [test_guidelines.md](test_guidelines.md) for coverage details and manual QA flows.

---

## Phase 5 — Optional checks

### Production-like single-server mode

Builds the frontend and serves it from Express on one port:

```powershell
npm run build
cd backend
```

**Windows (PowerShell):**

```powershell
$env:SERVE_FRONTEND="true"; npm start
```

**macOS / Linux:**

```bash
SERVE_FRONTEND=true npm start
```

Open http://localhost:5000

### Documentation link check

From the repository root:

```powershell
npm run links:check
```

---

## Tests only (no database or dev server)

If you only want to verify the codebase without configuring Supabase:

```powershell
cd C:\Users\TejasBogra\Downloads\LDC
npm install
cd Tests
npm install
npm run test:frontend:install
cd ..
npm test
```

Automated tests mock Postgres, Redis, and API responses — no running server required.

---

## Quick reference

| Step | Command |
|------|---------|
| Install | `npm install` |
| Env files | Copy `env.template` → `.env` in `backend/` and `frontend/` |
| Database | Run SQL in Supabase (see `backend/src/database/`) |
| Validate env | `npm run validate-env` |
| Dev mode | `npm run dev` |
| All tests | `npm test` |
| Frontend unit | `npm run test:frontend-unit` |
| Build | `npm run build` |

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| `playwright` not found | `cd Tests && npm install && npm run test:frontend:install` |
| UI tests fail immediately | `npm run build -w frontend`, then `npm test` again |
| API errors in dev | Check `backend/.env` and `DATABASE_URL`; confirm schema/migrations ran |
| Port in use | Stop other processes on 5000 / 5173 or change `PORT` in `backend/.env` |

More detail: [DEBUG_FETCH_ERROR.md](DEBUG_FETCH_ERROR.md), [RESTART_BACKEND.md](RESTART_BACKEND.md), [test_guidelines.md](test_guidelines.md).

---

## Next steps

- [WHATSAPP_CHECKOUT_GUIDE.md](WHATSAPP_CHECKOUT_GUIDE.md) — WhatsApp checkout and admin payment confirmation
- [ADMIN_DASHBOARD_GUIDE.md](ADMIN_DASHBOARD_GUIDE.md) — admin workflows
- [PRE_LAUNCH_CHECKLIST.md](PRE_LAUNCH_CHECKLIST.md) — production go-live
- [DEPLOYMENT.md](DEPLOYMENT.md) — deploy topology
