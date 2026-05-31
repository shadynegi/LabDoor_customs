# Row-Level Security

Supabase RLS policies for direct client access.

**Full reference:** [`../info.md`](../info.md)

## Architecture note

The production app routes all data access through the Express API with service-role database credentials. RLS policies apply when using the Supabase JavaScript client directly from the browser.

## Recommended policies

- **products:** Public read for active products; admin write via service role only
- **orders:** No public read; customer access via API token validation
- **reviews:** Public read for approved reviews; insert via API
- **contact_messages:** Admin read only

## Summary

See [RLS_OPTIMIZATION_SUMMARY.md](./RLS_OPTIMIZATION_SUMMARY.md) for policy overview.
