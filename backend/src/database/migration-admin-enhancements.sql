-- Admin enhancements: inventory, customers, sales analytics (order line items)
-- Run in Supabase SQL Editor after reviewing SUPABASE_SQL_TO_RUN.md

-- Product inventory fields
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(64);
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_point INTEGER NOT NULL DEFAULT 5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2) CHECK (cost_price IS NULL OR cost_price >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_unique ON products (sku) WHERE sku IS NOT NULL;

-- Customer CRM notes
ALTER TABLE customers ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Order admin fields
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_edited_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_edited_by VARCHAR(100);

-- Stock movement audit trail
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
  reason VARCHAR(50) NOT NULL,
  reference_type VARCHAR(50),
  reference_id VARCHAR(255),
  admin_username VARCHAR(100),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_created
  ON inventory_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created
  ON inventory_movements (created_at DESC);

-- Normalized line items for sales analytics (completed orders)
CREATE TABLE IF NOT EXISTS order_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  line_total DECIMAL(10, 2) NOT NULL CHECK (line_total >= 0),
  category VARCHAR(100),
  size VARCHAR(50),
  color VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_line_items_product_created
  ON order_line_items (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_line_items_order_id
  ON order_line_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_line_items_created
  ON order_line_items (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_payment_created
  ON orders (payment_status, created_at DESC)
  WHERE payment_status = 'completed';

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages inventory_movements" ON inventory_movements;
CREATE POLICY "Service role manages inventory_movements" ON inventory_movements
  FOR ALL USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Service role manages order_line_items" ON order_line_items;
CREATE POLICY "Service role manages order_line_items" ON order_line_items
  FOR ALL USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

REVOKE ALL ON inventory_movements FROM anon, authenticated;
REVOKE ALL ON order_line_items FROM anon, authenticated;
GRANT ALL ON inventory_movements TO service_role;
GRANT ALL ON order_line_items TO service_role;
