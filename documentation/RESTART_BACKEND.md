# Restart Backend

How to restart the Lab Door Customs API server.

**Full reference:** [`../info.md`](../info.md)

---

## Local development

```bash
cd backend
# Ctrl+C to stop, then:
npm run dev
```

---

## Production (Railway)

1. Open Railway dashboard → backend service.
2. Click **Restart** or redeploy from latest commit.
3. Verify: `GET /api/health`

---

## After restart

The server automatically:

- Connects to Redis (required in production)
- Applies schema patches (idempotency, refund events tables)
- Warms product cache
- Starts maintenance jobs (order expiry, idempotency cleanup)

---

## Logs

Check Railway logs or stdout for Pino JSON output. Filter by `X-Request-Id` for specific requests.
