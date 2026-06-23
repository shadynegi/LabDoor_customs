import { describe, it, expect, beforeEach } from 'vitest';
import { sqlMock } from '../setup';
import { clearCache } from '../../backend/src/lib/cache';
import { createCsrfAgent, withCsrf } from '../helpers/http';
import { adminSessionCookie, createTestAdminToken } from '../helpers/adminAuth';
import request from 'supertest';
import { app } from '../../backend/src/server';

function mockAdminEnhancementsDb() {
  sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
    const q = strings.join(' ');
    if (q.includes('admin_sessions')) {
      return [{ username: 'admin' }];
    }
    if (q.includes('inventory_movements') && q.includes('INSERT')) {
      return [{ id: 'mov-1' }];
    }
    if (q.includes('inventory_movements') && q.includes('SELECT')) {
      return [
        {
          id: 'mov-1',
          product_id: 1,
          delta: -2,
          quantity_after: 8,
          reason: 'sale',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ];
    }
    if (q.includes('order_line_items') && q.includes('COUNT')) {
      return [{ c: 0 }];
    }
    if (q.includes('UPDATE customers SET')) {
      return [
        {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'buyer@example.com',
          name: 'Updated Name',
          phone: '555',
          admin_notes: 'VIP',
          total_orders: 2,
          total_spent: 100,
        },
      ];
    }
    if (q.includes('FROM products') && q.includes('reorder_point')) {
      return [{ id: 1, name: 'Shoe', sku: 'SKU-1', stock: 2, reorder_point: 5 }];
    }
    if (q.includes('FROM orders') && q.includes('WHERE id')) {
      return [
        {
          id: '00000000-0000-0000-0000-000000000002',
          order_number: 'GSS-1',
          payment_status: 'pending',
          status: 'pending',
          customer_name: 'Test',
          customer_email: 'test@example.com',
          items: JSON.stringify([{ product_id: 1, product_name: 'Shoe', quantity: 1, price: 50 }]),
          shipping_address: { address: '1 Main' },
          shipping_cost: 0,
          tax: 0,
          subtotal: 50,
          total: 50,
        },
      ];
    }
    if (q.includes('UPDATE orders SET') && q.includes('customer_name')) {
      return [
        {
          id: '00000000-0000-0000-0000-000000000002',
          order_number: 'GSS-1',
          customer_name: 'New Name',
          customer_email: 'test@example.com',
          items: [{ product_id: 1, product_name: 'Shoe', quantity: 1, price: 50 }],
          shipping_address: { address: '1 Main' },
          subtotal: 50,
          shipping_cost: 0,
          tax: 0,
          total: 50,
          payment_status: 'pending',
          status: 'pending',
        },
      ];
    }
    if (q.includes('SELECT stock FROM products') && q.includes('FOR UPDATE')) {
      return [{ stock: 10 }];
    }
    if (q.includes('UPDATE products SET') && q.includes('stock')) {
      return [{ stock: 8 }];
    }
    if (q.includes('activity_logs')) {
      return [];
    }
    return [];
  });
}

describe('Admin enhancements API', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    sqlMock.begin.mockReset();
    sqlMock.begin.mockImplementation(async (fn: (tx: typeof sqlMock) => Promise<unknown>) =>
      fn(sqlMock)
    );
    clearCache();
    mockAdminEnhancementsDb();
  });

  it('GET /api/admin/products/low-stock returns list for admin', async () => {
    const token = createTestAdminToken();
    const res = await request(app)
      .get('/api/admin/products/low-stock')
      .set('Cookie', adminSessionCookie(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/admin/products/:id/inventory-movements returns history', async () => {
    const token = createTestAdminToken();
    const res = await request(app)
      .get('/api/admin/products/1/inventory-movements')
      .set('Cookie', adminSessionCookie(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('PATCH /api/admin/customers/:id updates profile', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(
      agent
        .patch('/api/admin/customers/00000000-0000-0000-0000-000000000001')
        .set('Cookie', adminSessionCookie(createTestAdminToken())),
      csrfToken
    ).send({ name: 'Updated Name', admin_notes: 'VIP' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Updated Name');
  });

  it('POST /api/admin/products/bulk-update accepts stock_delta', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(
      agent
        .post('/api/admin/products/bulk-update')
        .set('Cookie', adminSessionCookie(createTestAdminToken())),
      csrfToken
    ).send({ productIds: [1], updates: { stock_delta: -2 } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PATCH /api/orders/:id/customer-details updates contact info', async () => {
    const orderId = '00000000-0000-0000-0000-000000000002';
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(
      agent
        .patch(`/api/orders/${orderId}/customer-details`)
        .set('Cookie', adminSessionCookie(createTestAdminToken())),
      csrfToken
    ).send({ customer_name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customer_name).toBe('New Name');
  });

  it('GET /api/admin/analytics accepts period query', async () => {
    sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
      const q = strings.join(' ');
      if (q.includes('admin_sessions')) return [{ username: 'admin' }];
      if (q.includes('order_line_items') && q.includes('COUNT')) return [{ c: 0 }];
      if (q.includes('FROM orders') && q.includes('payment_status')) {
        return [
          {
            id: 'o1',
            total: 100,
            created_at: '2026-06-01T00:00:00.000Z',
            items: JSON.stringify([{ product_id: 1, product_name: 'Shoe', quantity: 2, price: 50 }]),
          },
        ];
      }
      if (q.includes('reorder_point')) return [{ c: 0 }];
      return [{ total_orders: 1, total_revenue: 100, orders_last_30_days: 1, revenue_last_30_days: 100 }];
    });

    const token = createTestAdminToken();
    const res = await request(app)
      .get('/api/admin/analytics?period=month')
      .set('Cookie', adminSessionCookie(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sales).toBeDefined();
    expect(res.body.data.sales.summary).toBeDefined();
  });
});
