# Database Setup

PostgreSQL schema and migrations for Lab Door Customs on Supabase.

**Full reference:** [`../info.md`](../info.md)

---

## Connection

| Use case | Port | Notes |
|----------|------|-------|
| App server (production) | 6543 | PgBouncer pooler — `prepare: false` |
| Migrations / admin | 5432 | Direct connection |

```
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:6543/postgres?pgbouncer=true
```

Production TLS: set `DB_SSL_CA_PATH` to Supabase CA bundle.

---

## Initial setup

1. Create a Supabase project.
2. Run `backend/src/database/schema.sql` in the SQL editor.
3. Optionally run `backend/src/database/seed.sql` for sample products.
4. Apply migration files in `backend/src/database/` as needed.

---

## Core tables

| Table | Purpose |
|-------|---------|
| `products` | Catalog — price, stock, category, size, color, ratings |
| `orders` | Orders — JSONB items/shipping, PayPal IDs, payment/status enums |
| `customers` | Aggregated stats — total_orders, total_spent, soft delete |
| `coupons` | Discount rules — type, limits, scope (`applies_to`) |
| `coupon_usage` | Per-order coupon reservations |
| `contact_messages` | Contact form inbox |
| `activity_logs` | Client activity (anonymized IP) |
| `admin_sessions` | Admin session tokens |

---

## Payment tables

Created at server startup via `ensureIdempotencyTable()` and `ensureOrderPaymentSchema()`:

| Table | Purpose |
|-------|---------|
| `payment_idempotency` | Create/capture deduplication |
| `processed_refund_events` | Refund webhook/admin deduplication |

Migration files:

- `migration-payment-idempotency.sql`
- `migration-paypal-unique-refunds.sql`
- `migration-processed-refund-events.sql`

---

## Orders table highlights

| Column | Purpose |
|--------|---------|
| `paypal_order_id` | PayPal checkout order ID (unique when set) |
| `paypal_capture_id` | PayPal capture ID (unique when set) |
| `refunded_amount` | Cumulative refunded total |
| `access_token_hash` | SHA-256 hash of customer access token |
| `items` | JSONB line items |
| `shipping_address` | JSONB shipping details |

---

## Reviews

Applied via `migration-reviews.sql`:

- `reviews` — rating, content, moderation status, verified purchase
- `review_votes` — helpful/not helpful votes
- Trigger updates product `rating` and `review_count`

---

## Row-level security

Supabase RLS policies may be applied for direct client access. The backend uses the **service role** connection and bypasses RLS for API operations.

See [RLS_OPTIMIZATION.md](./RLS_OPTIMIZATION.md).

---

## Maintenance

The backend runs scheduled jobs:

- Expire abandoned pending orders (restore stock)
- Clean expired idempotency rows
- Reap stuck processing idempotency keys

---

## Keep-alive

GitHub Actions cron (every 6 days) runs `backend/scripts/keep-alive.js` to prevent Supabase free-tier pausing. Requires `DATABASE_URL` secret.

See [SUPABASE_SETUP_INSTRUCTIONS.md](./SUPABASE_SETUP_INSTRUCTIONS.md), [GET_DATABASE_URL.md](./GET_DATABASE_URL.md).
