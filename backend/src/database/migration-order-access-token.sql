-- Per-order access tokens for secure customer order lookup
-- Run in Supabase SQL Editor after schema.sql

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS access_token_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_orders_access_token_hash ON orders(access_token_hash);

COMMENT ON COLUMN orders.access_token_hash IS 'SHA-256 hash of per-order customer access token (plain token emailed once at order creation)';
