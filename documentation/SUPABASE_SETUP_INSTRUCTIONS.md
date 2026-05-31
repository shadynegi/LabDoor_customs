# Supabase Project Setup

Create and configure Supabase PostgreSQL for Lab Door Customs.

**Full reference:** [`../info.md`](../info.md) | **Database:** [DATABASE_SETUP.md](./DATABASE_SETUP.md)

## Steps

1. Create a project at [supabase.com](https://supabase.com).
2. Note the project URL and service role key (backend only — never expose to frontend).
3. Copy the connection pooler URI (port 6543) for `DATABASE_URL`.
4. Run schema SQL from `backend/migrations/` or follow [STEP_BY_STEP_SQL.md](./STEP_BY_STEP_SQL.md).
5. Configure RLS if using Supabase client directly — see [RLS_OPTIMIZATION.md](./RLS_OPTIMIZATION.md).

## Connection

- **App runtime:** PgBouncer pooler on port 6543
- **Migrations:** Direct connection on port 5432
- **TLS:** Set `DB_SSL_CA_PATH` to Supabase CA bundle in production
