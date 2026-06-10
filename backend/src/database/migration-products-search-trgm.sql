-- Product text search acceleration (pg_trgm GIN indexes).
-- Run manually in Supabase SQL Editor after approval (extension + indexes).
-- Safe to re-run. Does not change pricing, checkout, or RLS.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON public.products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_description_trgm
  ON public.products USING gin (description gin_trgm_ops)
  WHERE description IS NOT NULL;
