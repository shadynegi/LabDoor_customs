# Restart Server

How to restart the Lab Door Customs application server.

**Full reference:** [`../info.md`](../info.md)

---

## Local development

**API only:**

```bash
cd backend
# Ctrl+C to stop, then:
npm run dev
```

**Full stack (API + Vite):**

```bash
# Ctrl+C to stop, then from repository root:
npm run dev
```

**Production-like (API + static SPA):**

```bash
npm run build
cd backend && SERVE_FRONTEND=true npm start
```

---

## Production (Railway)

1. Open Railway dashboard → service linked to the repository root.
2. Click **Restart** or redeploy from the latest commit.
3. Verify: `GET https://www.yourdomain.com/api/health`

---

## After restart

The server automatically:

- Connects to Redis (required in production)
- Applies schema patches (idempotency, refund events, checkout exchange tables)
- Warms product cache
- Starts maintenance jobs (order expiry, idempotency cleanup, checkout exchange cleanup)
- Serves `frontend/dist` when present in production

---

## Logs

Check Railway logs or stdout for Pino JSON output. Filter by `X-Request-Id` for specific requests.
