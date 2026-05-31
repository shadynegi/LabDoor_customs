# Step-by-Step SQL

Run database schema and migrations for Lab Door Customs.

**Full reference:** [`../info.md`](../info.md) | **Setup:** [DATABASE_SETUP.md](./DATABASE_SETUP.md)

## Prerequisites

- Supabase project created
- Direct connection URI (port 5432) from [GET_DATABASE_URL.md](./GET_DATABASE_URL.md)

## Steps

1. Connect to Supabase SQL Editor.
2. Run scripts from `backend/migrations/` in filename order.
3. Confirm tables exist: products, orders, order_items, customers, coupons, reviews, contact_messages, idempotency_keys, refund_events.
4. Set `DATABASE_URL` to pooler URI (6543) on backend.
5. Start backend — runtime schema patches apply automatically for incremental DDL.

## Verify

```bash
curl http://localhost:5000/api/health
```

Should report database connected.
