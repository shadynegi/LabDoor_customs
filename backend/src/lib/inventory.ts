import sql from './db';
import { logger } from './logger';
import { InsufficientStockError, type InventoryLineItem, type StockShortage } from './inventoryTypes';
import { applyStockDeltaInTx } from './inventoryMovements';

export type { InventoryLineItem, StockShortage };
export { InsufficientStockError };

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
      const result = await applyStockDeltaInTx(tx, {
        productId: item.product_id,
        delta: -item.quantity,
        reason: 'sale',
        referenceType: 'order',
        enforceAvailable: true,
      });

      if (!result.ok) {
        const rows = await tx`
          SELECT id, name, stock FROM products WHERE id = ${item.product_id}
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
  items: InventoryLineItem[],
  referenceId?: string
): Promise<void> {
  if (items.length === 0) return;

  await sql.begin(async (tx) => {
    for (const item of items) {
      await applyStockDeltaInTx(tx, {
        productId: item.product_id,
        delta: item.quantity,
        reason: 'cancel_restore',
        referenceType: 'order',
        referenceId,
      });
    }
  });

  logger.info(`Inventory restored for ${items.length} product line(s)`);
}
