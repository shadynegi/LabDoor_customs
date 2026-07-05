/** Build a mock order row as returned by customer lookup queries. */
export function mockOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000099',
    order_number: 'GSS-TEST-1',
    customer_email: 'customer@example.com',
    customer_name: 'Test User',
    items: '[]',
    shipping_address: '{}',
    subtotal: '10',
    shipping_cost: '0',
    tax: '0',
    total: '10',
    payment_status: 'completed',
    status: 'processing',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
