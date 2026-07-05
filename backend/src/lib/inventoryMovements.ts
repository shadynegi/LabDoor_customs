import type postgres from 'postgres';
import sql from './db';
import { logger } from './logger';
import { LOW_STOCK_THRESHOLD } from './lowStock';

export type InventoryMovementReason =
  | 'sale'
  | 'cancel_restore'
  | 'admin_adjust'
  | 'bulk_update'
  | 'receive_stock'
  | 'pending_edit';

type SqlExecutor = postgres.Sql | postgres.TransactionSql;

export interface LogInventoryMovementInput {
  productId: number;
  delta: number;
  quantityAfter: number;
  reason: InventoryMovementReason;
  referenceType?: string;
  referenceId?: string;
  adminUsername?: string;
  note?: string;
}

export async function logInventoryMovement(
  executor: SqlExecutor,
  input: LogInventoryMovementInput
): Promise<void> {
  await executor`
    INSERT INTO inventory_movements (
      product_id, delta, quantity_after, reason,
      reference_type, reference_id, admin_username, note
    ) VALUES (
      ${input.productId},
      ${input.delta},
      ${input.quantityAfter},
      ${input.reason},
      ${input.referenceType ?? null},
      ${input.referenceId ?? null},
      ${input.adminUsername ?? null},
      ${input.note ?? null}
    )
  `;
}

export interface ApplyStockDeltaInput {
  productId: number;
  delta: number;
  reason: InventoryMovementReason;
  referenceType?: string;
  referenceId?: string;
  adminUsername?: string;
  note?: string;
  /** When true, decrement fails if stock would go negative or product is OOS-flagged for sales. */
  enforceAvailable?: boolean;
}

/**
 * Apply stock delta inside an existing transaction (or default sql).
 * Updates products.stock, is_out_of_stock, and logs inventory_movements.
 */
export async function applyStockDeltaInTx(
  executor: SqlExecutor,
  input: ApplyStockDeltaInput
): Promise<{ ok: true; quantityAfter: number } | { ok: false; available: number }> {
  const { productId, delta, enforceAvailable } = input;

  if (enforceAvailable && delta < 0) {
    const qty = Math.abs(delta);
    const updated = await executor`
      UPDATE products
      SET
        stock = stock - ${qty},
        is_out_of_stock = (stock - ${qty}) <= 0,
        updated_at = NOW()
      WHERE id = ${productId}
        AND stock >= ${qty}
        AND is_out_of_stock = FALSE
      RETURNING stock
    `;
    if (updated.length === 0) {
      const rows = await executor`
        SELECT stock FROM products WHERE id = ${productId}
      `;
      return { ok: false, available: rows[0] ? Number(rows[0].stock) : 0 };
    }
    const quantityAfter = Number(updated[0].stock);
    await logInventoryMovement(executor, {
      productId,
      delta,
      quantityAfter,
      reason: input.reason,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      adminUsername: input.adminUsername,
      note: input.note,
    });
    return { ok: true, quantityAfter };
  }

  const updated = await executor`
    UPDATE products
    SET
      stock = GREATEST(0, stock + ${delta}),
      is_out_of_stock = (GREATEST(0, stock + ${delta})) <= 0,
      updated_at = NOW()
    WHERE id = ${productId}
    RETURNING stock
  `;

  if (updated.length === 0) {
    return { ok: false, available: 0 };
  }

  const quantityAfter = Number(updated[0].stock);
  await logInventoryMovement(executor, {
    productId,
    delta,
    quantityAfter,
    reason: input.reason,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    adminUsername: input.adminUsername,
    note: input.note,
  });

  return { ok: true, quantityAfter };
}

/** Set absolute stock (admin). Returns previous and new quantity. */
export async function setProductStockAbsolute(
  executor: SqlExecutor,
  productId: number,
  newStock: number,
  meta: Omit<LogInventoryMovementInput, 'productId' | 'delta' | 'quantityAfter'>
): Promise<{ previous: number; current: number } | null> {
  if (newStock < 0) {
    throw new Error('Stock cannot be negative');
  }

  const rows = await executor`
    SELECT stock FROM products WHERE id = ${productId} FOR UPDATE
  `;
  if (!rows.length) return null;

  const previous = Number(rows[0].stock);
  const delta = newStock - previous;
  if (delta === 0) {
    return { previous, current: previous };
  }

  await executor`
    UPDATE products
    SET
      stock = ${newStock},
      is_out_of_stock = ${newStock <= 0},
      updated_at = NOW()
    WHERE id = ${productId}
  `;

  await logInventoryMovement(executor, {
    productId,
    delta,
    quantityAfter: newStock,
    reason: meta.reason,
    referenceType: meta.referenceType,
    referenceId: meta.referenceId,
    adminUsername: meta.adminUsername,
    note: meta.note,
  });

  return { previous, current: newStock };
}

export async function getLowStockProducts(limit = 50): Promise<
  Array<{
    id: number;
    name: string;
    stock: number;
    low_stock_threshold: number;
  }>
> {
  const rows = await sql`
    SELECT id, name, stock
    FROM products
    WHERE is_out_of_stock = FALSE
      AND stock <= ${LOW_STOCK_THRESHOLD}
    ORDER BY stock ASC, id ASC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    stock: Number(r.stock),
    low_stock_threshold: LOW_STOCK_THRESHOLD,
  }));
}

export async function getProductInventoryMovements(
  productId: number,
  limit = 50
): Promise<unknown[]> {
  const rows = await sql`
    SELECT id, product_id, delta, quantity_after, reason,
           reference_type, reference_id, admin_username, note, created_at
    FROM inventory_movements
    WHERE product_id = ${productId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return [...rows];
}

/** Daily low-stock digest — logs count only (no email). */
export async function runLowStockAlertDigest(): Promise<{ count: number; emailed: boolean }> {
  const lowStock = await getLowStockProducts(100);
  if (lowStock.length === 0) {
    return { count: 0, emailed: false };
  }

  logger.info(`Low stock alert: ${lowStock.length} product(s) at or below threshold (${LOW_STOCK_THRESHOLD} units)`);
  return { count: lowStock.length, emailed: false };
}
