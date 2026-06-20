import sql from './db';

/** Upsert aggregated customer row after a successful paid order. */
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

/** Reverse customer stats after a full order refund/cancellation. */
export async function reverseCustomerOrderCredit(
  email: string,
  orderTotal: number
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();

  await sql`
    UPDATE customers SET
      total_orders = GREATEST(0, total_orders - 1),
      total_spent = GREATEST(0, total_spent - ${orderTotal}),
      updated_at = NOW()
    WHERE email = ${normalizedEmail} AND is_deleted = FALSE
  `;
}

/** Reduce customer spend after a partial refund (order count unchanged). */
export async function adjustCustomerPartialRefund(
  email: string,
  refundAmount: number
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();

  await sql`
    UPDATE customers SET
      total_spent = GREATEST(0, total_spent - ${refundAmount}),
      updated_at = NOW()
    WHERE email = ${normalizedEmail} AND is_deleted = FALSE
  `;
}
