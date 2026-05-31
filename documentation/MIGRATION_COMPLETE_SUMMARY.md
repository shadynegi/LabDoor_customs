# Database Migrations

Migration files and runtime schema patches.

**Full reference:** [`../info.md`](../info.md)

## Files

`backend/migrations/` — SQL scripts for initial schema and incremental changes.

## Runtime patches

Server boot applies incremental DDL for idempotency and refund event tables if not yet migrated.

## Running

Use Supabase SQL Editor or psql with direct connection. See [STEP_BY_STEP_SQL.md](./STEP_BY_STEP_SQL.md).
