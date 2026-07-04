# Supabase Keep-Alive

Lightweight, read-only database ping to reduce the chance of Supabase free-tier projects pausing after inactivity (~7 days without API/database activity).

**Full reference:** [`info.md`](info.md) | **Connection string:** [`GET_DATABASE_URL.md`](./GET_DATABASE_URL.md)

---

## How it works

1. **`backend/scripts/keep-alive.js`** connects with **postgres.js** using `DATABASE_URL` (same driver and pooler rules as `backend/src/lib/db.ts`).
2. Runs a single read-only query: **`SELECT 1 AS ping`** — no inserts, updates, or deletes.
3. Closes the connection and exits (`0` on success, `1` on failure).

Logs (concise):

- `Keep-alive started`
- `Database connection successful`
- `Query executed successfully (SELECT 1 AS ping)`
- `Execution completed`

---

## Scheduling

**Mechanism:** GitHub Actions — [`.github/workflows/keep-supabase-alive.yml`](../.github/workflows/keep-supabase-alive.yml)

| Setting | Value |
|---------|--------|
| Schedule | **Daily** at **09:00 UTC** (`cron: 0 9 * * *`) |
| Manual run | Actions → **Keep Supabase Alive** → **Run workflow** |
| Timeout | 5 minutes (job), 30s default query timeout |

**Why GitHub Actions:** The Railway app may not run continuously; an external scheduler avoids depending on the Express process. No extra hosting cost on the free GitHub plan for public repos.

---

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Supabase **pooler** URI (port **6543** recommended). GitHub secret for CI; `backend/.env` locally. |
| `KEEP_ALIVE_TIMEOUT_MS` | No | Query timeout in ms (default `30000`). |
| `DB_USE_POOLER` | No | Set `true` to force `prepare=false` (same as app). |

No new secrets beyond existing `DATABASE_URL`. Do not commit credentials.

---

## Run manually

From repository root:

```bash
cd backend
npm run keep-alive
```

Or:

```bash
cd backend
node scripts/keep-alive.js
```

Requires `DATABASE_URL` in `backend/.env` or the environment.

---

## Change the schedule

Edit `.github/workflows/keep-supabase-alive.yml`:

```yaml
schedule:
  - cron: '0 9 * * *'   # minute hour day month weekday (UTC)
```

Examples:

| Goal | Cron |
|------|------|
| Daily 09:00 UTC (current) | `0 9 * * *` |
| Every 12 hours | `0 */12 * * *` |
| Twice daily (09:00 and 21:00 UTC) | `0 9,21 * * *` |

[Cron syntax reference](https://docs.github.com/en/actions/writing-workflows/scheduler-syntax)

---

## Deployment / setup

1. **GitHub repository** → **Settings** → **Secrets and variables** → **Actions**
2. Ensure **`DATABASE_URL`** is set to the Supabase **pooler** connection string (same as production Railway).
3. Push the workflow file to `main` — scheduled runs start automatically.
4. Optional: trigger **Run workflow** once to verify logs.

No Railway or app redeploy required for the cron itself.

---

## Testing

**Unit tests:** `Tests/backend/keepAlive.test.ts` — pooler SSL/prepare options and read-only `PING_QUERY` (`SELECT 1 AS ping`).

**Live ping** (with valid `DATABASE_URL`):

```bash
cd backend && npm run keep-alive
```

Expected exit code `0` and `Execution completed` in stdout.

---

## Read-only guarantee

The script executes **only** `SELECT 1 AS ping`. It does not:

- Insert, update, or delete rows
- Run migrations or DDL
- Call Supabase REST or Auth APIs

Safe to run on production databases.
