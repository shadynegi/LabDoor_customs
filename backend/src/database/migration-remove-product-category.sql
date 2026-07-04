-- Remove product shoe categories and category-scoped coupons
-- Applied on production Supabase (July 2026). Safe to re-run (IF EXISTS / idempotent updates).
-- Run in Supabase SQL Editor after reviewing SUPABASE_SQL_TO_RUN.md

-- Re-scope category coupons to entire order
UPDATE coupons
SET applies_to = 'all', applies_to_ids = NULL
WHERE applies_to = 'category';

-- coupons.applies_to check constraint (name may vary; drop/recreate safely)
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_applies_to_check;
ALTER TABLE coupons ADD CONSTRAINT coupons_applies_to_check
  CHECK (applies_to IN ('all', 'product'));

DROP INDEX IF EXISTS idx_products_category;
ALTER TABLE products DROP COLUMN IF EXISTS category;
ALTER TABLE order_line_items DROP COLUMN IF EXISTS category;
