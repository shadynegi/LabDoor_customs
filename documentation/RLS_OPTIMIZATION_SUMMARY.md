# RLS Summary

Row-level security policy overview for Supabase.

**Full reference:** [`../info.md`](../info.md) | **Details:** [RLS_OPTIMIZATION.md](./RLS_OPTIMIZATION.md)

## Current approach

- Primary data path: Express API → postgres.js (bypasses RLS with server credentials)
- RLS enabled on sensitive tables as defense-in-depth for direct Supabase client usage
- Public storefront never uses service role key in browser

## Tables with RLS

Products (read-only public), reviews (approved only), orders (no public access), admin-only tables for coupons and contact messages.
