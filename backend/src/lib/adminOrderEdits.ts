import sql from './db';
import { logger } from './logger';
import { applyStockDeltaInTx } from './inventoryMovements';
import type { ValidatedLineItem } from './orderLifecycle';

export interface OrderCustomerDetailsInput {
  customer_name?: string;
  customer_email?: string;
  shipping_address?: Record<string, unknown>;
  admin_notes?: string;
}

export async function patchOrderCustomerDetails(
  orderId: string,
  input: OrderCustomerDetailsInput,
  adminUsername: string
): Promise<{ ok: true; order: Record<string, unknown> } | { ok: false; status: number; error: string }> {
  const rows = await sql`SELECT * FROM orders WHERE id = ${orderId}::uuid LIMIT 1`;
  if (!rows.length) {
    return { ok: false, status: 404, error: 'Order not found' };
  }

  const current = rows[0];
  if (current.status === 'cancelled') {
    return { ok: false, status: 400, error: 'Cannot edit a cancelled order' };
  }

  const email = input.customer_email?.trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, status: 400, error: 'Invalid customer email' };
  }

  const shippingJson =
    input.shipping_address !== undefined ? JSON.stringify(input.shipping_address) : null;

  const updated = await sql`
    UPDATE orders SET
      customer_name = COALESCE(${input.customer_name ?? null}, customer_name),
      customer_email = COALESCE(${email ?? null}, customer_email),
      shipping_address = COALESCE(${shippingJson}::jsonb, shipping_address),
      admin_notes = COALESCE(${input.admin_notes ?? null}, admin_notes),
      admin_edited_at = NOW(),
      admin_edited_by = ${adminUsername},
      updated_at = NOW()
    WHERE id = ${orderId}::uuid
    RETURNING *
  `;

  await sql`
    INSERT INTO activity_logs (action_type, entity_type, entity_id, metadata)
    VALUES (
      'admin_order_customer_edit',
      'order',
      ${orderId},
      ${JSON.stringify({ admin: adminUsername })}
    )
  `.catch((err) => logger.warn({ err }, 'activity log failed for order customer edit'));

  return { ok: true, order: updated[0] as Record<string, unknown> };
}

export async function patchPendingOrderItems(
  orderId: string,
  lineItems: ValidatedLineItem[],
  adminUsername: string
): Promise<{ ok: true; order: Record<string, unknown> } | { ok: false; status: number; error: string }> {
  if (!lineItems?.length) {
    return { ok: false, status: 400, error: 'At least one line item is required' };
  }

  const result = await sql.begin(async (tx) => {
    const locked = await tx`
      SELECT * FROM orders WHERE id = ${orderId}::uuid FOR UPDATE
    `;
    if (!locked.length) {
      return { error: 'not_found' as const };
    }

    const order = locked[0];
    if (order.payment_status !== 'pending' || order.status !== 'pending') {
      return { error: 'not_pending' as const };
    }

    const oldItems =
      typeof order.items === 'string'
        ? (JSON.parse(order.items) as ValidatedLineItem[])
        : (order.items as ValidatedLineItem[]);

    const oldMap = new Map<number, number>();
    for (const item of oldItems) {
      oldMap.set(item.product_id, (oldMap.get(item.product_id) ?? 0) + item.quantity);
    }

    const newMap = new Map<number, number>();
    for (const item of lineItems) {
      if (!item.product_id || item.quantity < 1) {
        return { error: 'invalid_item' as const };
      }
      newMap.set(item.product_id, (newMap.get(item.product_id) ?? 0) + item.quantity);
    }

    const allProductIds = new Set([...oldMap.keys(), ...newMap.keys()]);
    for (const productId of allProductIds) {
      const oldQty = oldMap.get(productId) ?? 0;
      const newQty = newMap.get(productId) ?? 0;
      const delta = newQty - oldQty;
      if (delta === 0) continue;

      if (delta > 0) {
        const dec = await applyStockDeltaInTx(tx, {
          productId,
          delta: -delta,
          reason: 'pending_edit',
          referenceType: 'order',
          referenceId: orderId,
          adminUsername,
          enforceAvailable: true,
        });
        if (!dec.ok) {
          return { error: 'insufficient_stock' as const, productId };
        }
      } else {
        await applyStockDeltaInTx(tx, {
          productId,
          delta: Math.abs(delta),
          reason: 'pending_edit',
          referenceType: 'order',
          referenceId: orderId,
          adminUsername,
        });
      }
    }

    let subtotal = 0;
    for (const item of lineItems) {
      subtotal += item.price * item.quantity;
    }
    const shipping = parseFloat(String(order.shipping_cost ?? 0));
    const tax = parseFloat(String(order.tax ?? 0));
    const total = subtotal + shipping + tax;

    const updated = await tx`
      UPDATE orders SET
        items = ${JSON.stringify(lineItems)}::jsonb,
        subtotal = ${subtotal},
        total = ${total},
        admin_edited_at = NOW(),
        admin_edited_by = ${adminUsername},
        updated_at = NOW()
      WHERE id = ${orderId}::uuid
      RETURNING *
    `;

    return { order: updated[0] };
  });

  if ('error' in result) {
    if (result.error === 'not_found') {
      return { ok: false, status: 404, error: 'Order not found' };
    }
    if (result.error === 'not_pending') {
      return { ok: false, status: 400, error: 'Only pending unpaid orders can have items edited' };
    }
    if (result.error === 'invalid_item') {
      return { ok: false, status: 400, error: 'Each line item requires product_id and quantity >= 1' };
    }
    if (result.error === 'insufficient_stock') {
      return { ok: false, status: 409, error: 'Insufficient stock for updated quantities' };
    }
  }

  await sql`
    INSERT INTO activity_logs (action_type, entity_type, entity_id, metadata)
    VALUES (
      'admin_order_items_edit',
      'order',
      ${orderId},
      ${JSON.stringify({ admin: adminUsername })}
    )
  `.catch(() => {});

  return { ok: true, order: result.order as Record<string, unknown> };
}
