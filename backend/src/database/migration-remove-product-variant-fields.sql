-- Remove per-size/color/SKU product variant columns (one product per shoe).
-- Safe to run multiple times (IF EXISTS).

DROP INDEX IF EXISTS idx_products_sku_unique;
DROP INDEX IF EXISTS idx_products_size;
DROP INDEX IF EXISTS idx_products_color;

ALTER TABLE products DROP COLUMN IF EXISTS sku;
ALTER TABLE products DROP COLUMN IF EXISTS reorder_point;
ALTER TABLE products DROP COLUMN IF EXISTS reorder_alert_enabled;
ALTER TABLE products DROP COLUMN IF EXISTS size;
ALTER TABLE products DROP COLUMN IF EXISTS color;
