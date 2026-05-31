# Get Database URL

Find your Supabase PostgreSQL connection string.

**Full reference:** [`../info.md`](../info.md)

---

## Steps

1. Open [supabase.com](https://supabase.com) → your project.
2. Go to **Settings → Database**.
3. Copy the connection string.

---

## For the app (recommended)

Use the **Connection pooling** URI with port **6543**:

```
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

Set as `DATABASE_URL` in backend environment.

---

## For migrations

Use the **Direct connection** URI with port **5432** for running SQL scripts.

---

## GitHub keep-alive

Set the pooler URL as `DATABASE_URL` secret for the keep-alive workflow.
