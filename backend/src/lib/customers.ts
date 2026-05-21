import sql from './db';

/** Upsert aggregated customer row after a new order (skips updates when soft-deleted). */
export async function upsertCustomerFromOrder(
  email: string,
  name: string,
  orderTotal: number
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();

  await sql`
    INSERT INTO customers (
      email, name, total_orders, total_spent, last_order_date, first_order_date
    ) VALUES (
      ${normalizedEmail},
      ${name},
      1,
      ${orderTotal},
      NOW(),
      NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, customers.name),
      total_orders = customers.total_orders + 1,
      total_spent = customers.total_spent + ${orderTotal},
      last_order_date = NOW(),
      updated_at = NOW()
    WHERE customers.is_deleted = FALSE
  `;
}
