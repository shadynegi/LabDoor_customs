-- Stable public UUID for product detail URLs (/product/{public_id})
-- Integer `products.id` remains the primary key for cart, checkout, and FKs.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS public_id UUID;

UPDATE products
SET public_id = uuid_generate_v4()
WHERE public_id IS NULL;

ALTER TABLE products
  ALTER COLUMN public_id SET NOT NULL;

ALTER TABLE products
  ALTER COLUMN public_id SET DEFAULT uuid_generate_v4();

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_public_id ON products (public_id);

COMMENT ON COLUMN products.public_id IS 'Public UUID used in storefront URLs; integer id remains internal PK';
