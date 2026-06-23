import sql from './db';
import { logger } from './logger';

export interface OrderLineItemInput {
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  size_value?: string;
}

function parseOrderItems(items: unknown): OrderLineItemInput[] {
  if (typeof items === 'string') {
    return JSON.parse(items) as OrderLineItemInput[];
  }
  return (items as OrderLineItemInput[]) || [];
}

/** Idempotent: replace line items for a completed order (sales analytics source of truth). */
export async function syncOrderLineItemsForOrder(orderId: string): Promise<number> {
  const orders = await sql`
    SELECT id, items, payment_status FROM orders WHERE id = ${orderId}::uuid LIMIT 1
  `;
  if (!orders.length || orders[0].payment_status !== 'completed') {
    return 0;
  }

  const items = parseOrderItems(orders[0].items);
  if (items.length === 0) return 0;

  const productIds = items.map((i) => i.product_id).filter(Boolean);
  const productMeta =
    productIds.length > 0
      ? await sql`
          SELECT id, category, size, color FROM products WHERE id = ANY(${productIds})
        `
      : [];
  const metaById = new Map(
    productMeta.map((p) => [Number(p.id), p as { category?: string; size?: string; color?: string }])
  );

  return sql.begin(async (tx) => {
    await tx`DELETE FROM order_line_items WHERE order_id = ${orderId}::uuid`;

    let inserted = 0;
    for (const item of items) {
      const meta = metaById.get(item.product_id);
      const unitPrice = parseFloat(String(item.price ?? 0));
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;

      await tx`
        INSERT INTO order_line_items (
          order_id, product_id, product_name, quantity, unit_price, line_total,
          category, size, color
        ) VALUES (
          ${orderId}::uuid,
          ${item.product_id},
          ${item.product_name},
          ${qty},
          ${unitPrice},
          ${unitPrice * qty},
          ${meta?.category ?? null},
          ${meta?.size ?? item.size_value ?? null},
          ${meta?.color ?? null}
        )
      `;
      inserted += 1;
    }
    return inserted;
  });
}

/** Backfill line items from completed orders missing rows (maintenance / boot). */
export async function backfillOrderLineItems(batchSize = 100): Promise<number> {
  const rows = await sql`
    SELECT o.id
    FROM orders o
    WHERE o.payment_status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM order_line_items li WHERE li.order_id = o.id
      )
    ORDER BY o.created_at ASC
    LIMIT ${batchSize}
  `;

  let total = 0;
  for (const row of rows) {
    try {
      total += await syncOrderLineItemsForOrder(String(row.id));
    } catch (err) {
      logger.warn({ err, orderId: row.id }, 'order_line_items backfill row failed');
    }
  }
  if (total > 0) {
    logger.info(`Backfilled order_line_items for ${rows.length} order(s)`);
  }
  return rows.length;
}
