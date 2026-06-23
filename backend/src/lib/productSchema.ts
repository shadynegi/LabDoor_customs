import sql from './db';
import { publicTableExists } from './bootstrapSchema';
import { logger } from './logger';

/** Idempotent products.video_360 column (see migration-products-video-360.sql). */
export async function ensureProductVideo360Column(): Promise<void> {
  if (!(await publicTableExists('products'))) {
    return;
  }
  await sql`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS video_360 TEXT
  `;
  logger.info('products.video_360 column ready');
}

/** Admin enhancements: SKU, reorder, inventory_movements, order_line_items (see migration-admin-enhancements.sql). */
export async function ensureAdminEnhancementSchema(): Promise<void> {
  if (!(await publicTableExists('products'))) {
    return;
  }

  await sql`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(64)
  `;
  await sql`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_point INTEGER NOT NULL DEFAULT 5
  `;
  await sql`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE
  `;
  await sql`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2)
  `;

  if (await publicTableExists('customers')) {
    await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS admin_notes TEXT`;
  }

  if (await publicTableExists('orders')) {
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_notes TEXT`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_edited_at TIMESTAMPTZ`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_edited_by VARCHAR(100)`;
  }

  await sql`
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
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_created
      ON inventory_movements (product_id, created_at DESC)
  `;

  await sql`
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
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_order_line_items_product_created
      ON order_line_items (product_id, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_order_line_items_order_id ON order_line_items (order_id)
  `;

  logger.info('Admin enhancement schema ready');
}
