# Row-Level Security

Supabase RLS policies for direct client access.

**Full reference:** [`../info.md`](../info.md)

## Architecture note

The production app routes all data access through the Express API with service-role database credentials. RLS policies apply when using the Supabase JavaScript client directly from the browser.

## Applied policies (startup migration)

The backend runs `ensureRlsPolicies()` at boot (see `backend/src/lib/rlsMigration.ts` and `backend/src/database/migration-rls-tighten.sql`):

- **products:** Public catalog read; all writes via `service_role` only
- **orders:** `service_role` only (all access through Express API)
- **contact_messages:** `service_role` only
- **coupons, coupon_usage, payment_idempotency, processed_refund_events:** RLS enabled; `service_role` only (no anon/authenticated PostgREST access)

Legacy permissive policies for authenticated Supabase users are dropped.

For an immediate fix in Supabase SQL Editor, run `backend/src/database/migration-rls-sensitive-tables.sql`.

## Summary

See [RLS_OPTIMIZATION_SUMMARY.md](./RLS_OPTIMIZATION_SUMMARY.md) for policy overview.
