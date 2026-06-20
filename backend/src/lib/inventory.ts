import sql from './db';
import { logger } from './logger';

export interface InventoryLineItem {
  product_id: number;
  quantity: number;
  product_name?: string;
}

export interface StockShortage {
  product_id: number;
  product_name: string;
  requested: number;
  available: number;
}

export class InsufficientStockError extends Error {
  readonly outOfStock: StockShortage[];

  constructor(outOfStock: StockShortage[]) {
    super('Insufficient stock');
    this.name = 'InsufficientStockError';
    this.outOfStock = outOfStock;
  }
}

/**
 * Atomically decrement stock inside a transaction.
 * Fails if any line item lacks sufficient stock.
 */
export async function decrementInventoryTransactional(
  items: InventoryLineItem[]
): Promise<void> {
  if (items.length === 0) return;

  await sql.begin(async (tx) => {
    const shortages: StockShortage[] = [];

    for (const item of items) {
      const updated = await tx`
        UPDATE products
        SET
          stock = stock - ${item.quantity},
          is_out_of_stock = (stock - ${item.quantity}) <= 0,
          updated_at = NOW()
        WHERE id = ${item.product_id}
          AND stock >= ${item.quantity}
          AND is_out_of_stock = FALSE
        RETURNING id, name, stock
      `;

      if (updated.length === 0) {
        const rows = await tx`
          SELECT id, name, stock, is_out_of_stock
          FROM products
          WHERE id = ${item.product_id}
        `;
        const product = rows[0];
        shortages.push({
          product_id: item.product_id,
          product_name: (product?.name as string) || item.product_name || 'Unknown Product',
          requested: item.quantity,
          available: product ? Number(product.stock) : 0,
        });
      }
    }

    if (shortages.length > 0) {
      throw new InsufficientStockError(shortages);
    }
  });
}

/** Restore stock when an order is cancelled (transactional). */
export async function restoreInventoryTransactional(
  items: InventoryLineItem[]
): Promise<void> {
  if (items.length === 0) return;

  await sql.begin(async (tx) => {
    for (const item of items) {
      await tx`
        UPDATE products
        SET
          stock = stock + ${item.quantity},
          is_out_of_stock = FALSE,
          updated_at = NOW()
        WHERE id = ${item.product_id}
      `;
    }
  });

  logger.info(`Inventory restored for ${items.length} product line(s)`);
}
