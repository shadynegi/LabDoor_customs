import type { Page, Route } from '@playwright/test';
import { installStorefrontApiMocks } from './mock-api';
import { createAdminMockStore } from './admin-mock-store';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function apiPath(url: string): string {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/\/api(\/.*)$/);
  return match ? match[1] : parsed.pathname;
}

const MOCK_ANALYTICS = {
  orders: {
    total_orders: 12,
    total_revenue: 2400,
    orders_last_30_days: 4,
    revenue_last_30_days: 820,
  },
  products: {
    total_products: 8,
    out_of_stock_products: 1,
    total_views: 340,
    total_cart_adds: 56,
  },
  customers: {
    total_customers: 10,
    new_customers_30_days: 3,
  },
  topViewedProducts: [],
  topCartedProducts: [],
  customerLocations: [],
  countrySummary: [],
  recentOrders: [],
  dailyTrend: [],
  integrations: {
    ga4: { configured: false, measurementId: null, consoleUrl: 'https://analytics.google.com/' },
    searchConsole: { configured: false, siteUrl: null, consoleUrl: 'https://search.google.com/search-console' },
  },
  sales: {
    range: {
      period: 'month',
      from: '2026-06-01T00:00:00.000+05:30',
      to: '2026-06-30T23:59:59.999+05:30',
      bucket: 'day',
    },
    summary: {
      total_units_sold: 24,
      total_revenue: 2400,
      order_count: 12,
      average_order_value: 200,
      estimated_gross_profit: null,
    },
    compare: { revenue_change_pct: 5 },
    top_sellers_by_units: [],
    top_sellers_by_revenue: [],
    best_period: null,
  },
  inventory: {
    low_stock_count: 0,
    low_stock_products: [],
  },
};

export type AdminMockState = {
  lastAnalyticsQuery: string | null;
  lastExportQuery: string | null;
};

/** Intercept admin `/api/*` routes for Playwright (mutable store + storefront mocks). */
export async function installAdminApiMocks(
  page: Page,
  state: AdminMockState = { lastAnalyticsQuery: null, lastExportQuery: null },
): Promise<void> {
  const store = createAdminMockStore();
  let adminAuthenticated = false;

  await installStorefrontApiMocks(page, {
    products: store.products,
    getActiveCoupons: () =>
      store.adminCoupons
        .filter((c) => c.is_active)
        .map((c) => ({
          code: c.code,
          discount_type: c.discount_type,
          discount_value: c.discount_value,
          is_active: c.is_active,
        })),
  });

  await page.route('**/api/**', async (route) => {
    const path = apiPath(route.request().url());
    const method = route.request().method();
    const url = route.request().url();

    const requireAdmin = () => {
      if (!adminAuthenticated) {
        void json(route, { success: false, error: 'Unauthorized' }, 401);
        return false;
      }
      return true;
    };

    if (path === '/admin/verify' && method === 'GET') {
      return json(route, { success: true, authenticated: adminAuthenticated });
    }

    if (path === '/admin/login' && method === 'POST') {
      adminAuthenticated = true;
      return json(route, { success: true, message: 'Login successful' });
    }

    if (path === '/admin/logout' && method === 'POST') {
      adminAuthenticated = false;
      return json(route, { success: true });
    }

    if (path === '/admin/analytics' && method === 'GET') {
      if (!requireAdmin()) return;
      state.lastAnalyticsQuery = url.split('/admin/analytics')[1] ?? '';
      return json(route, { success: true, data: MOCK_ANALYTICS });
    }

    if (path === '/admin/analytics/export' && method === 'GET') {
      if (!requireAdmin()) return;
      state.lastExportQuery = url.split('/admin/analytics/export')[1] ?? '';
      const csv = 'product_name,units_sold,revenue,revenue_share_pct\n"Test Shoe",2,200.00,100\n';
      return route.fulfill({
        status: 200,
        contentType: 'text/csv; charset=utf-8',
        headers: {
          'Content-Disposition': 'attachment; filename="product-sales-custom.csv"',
        },
        body: csv,
      });
    }

    if (path === '/admin/sessions' && method === 'GET') {
      if (!requireAdmin()) return;
      return json(route, {
        success: true,
        data: {
          sessions: [
            {
              id: 'sess-1',
              username: 'admin',
              ip_address: '127.0.0.1',
              created_at: '2026-06-10T10:00:00.000Z',
              expires_at: '2026-06-11T10:00:00.000Z',
              is_active: true,
            },
          ],
          stats: { total_sessions: 1, active_sessions: 1, expired_sessions: 0 },
        },
      });
    }

    if (path === '/admin/sessions/cleanup' && method === 'POST') {
      if (!requireAdmin()) return;
      return json(route, {
        success: true,
        data: { deleted: 0, deleted_expired: 0, deleted_excess: 0 },
        message: 'No expired or excess sessions to remove',
      });
    }

    if (path === '/admin/customers/recompute' && method === 'POST') {
      if (!requireAdmin()) return;
      return json(route, { success: true, message: 'Customer aggregates recomputed from completed orders' });
    }

    if (path === '/activity/export' && method === 'GET') {
      if (!requireAdmin()) return;
      return route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        headers: { 'Content-Disposition': 'attachment; filename="activity-export.ndjson"' },
        body: '{"id":1,"action_type":"page_view"}\n',
      });
    }

    // --- Products (admin CRUD shares storefront catalog) ---
    if (path === '/products' && method === 'POST') {
      if (!requireAdmin()) return;
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const product = store.createProduct(body);
      return json(route, { success: true, data: product, message: 'Product created' });
    }

    const productIdMatch = path.match(/^\/products\/(\d+)$/);
    if (productIdMatch) {
      const productId = parseInt(productIdMatch[1], 10);
      if (method === 'PUT') {
        if (!requireAdmin()) return;
        const body = route.request().postDataJSON() as Record<string, unknown>;
        const updated = store.updateProduct(productId, body);
        if (!updated) return json(route, { success: false, error: 'Product not found' }, 404);
        return json(route, { success: true, data: updated, message: 'Product updated' });
      }
      if (method === 'DELETE') {
        if (!requireAdmin()) return;
        if (!store.deleteProduct(productId)) {
          return json(route, { success: false, error: 'Product not found' }, 404);
        }
        return json(route, { success: true, message: 'Product deleted' });
      }
    }

    if (path === '/admin/products/bulk-update' && method === 'POST') {
      if (!requireAdmin()) return;
      const body = route.request().postDataJSON() as {
        productIds?: number[];
        updates?: { stock?: number; stock_delta?: number; is_out_of_stock?: boolean };
      };
      let updatedCount = 0;
      for (const id of body.productIds ?? []) {
        const product = store.getProduct(id);
        if (!product) continue;
        const updates = body.updates ?? {};
        if (updates.is_out_of_stock !== undefined) product.is_out_of_stock = updates.is_out_of_stock;
        if (updates.stock !== undefined) product.stock = updates.stock;
        if (updates.stock_delta !== undefined) product.stock = Math.max(0, (product.stock ?? 0) + updates.stock_delta);
        updatedCount++;
      }
      return json(route, { success: true, updatedCount });
    }

    if (path === '/admin/products/low-stock' && method === 'GET') {
      if (!requireAdmin()) return;
      const low = store.adminProducts.filter((p) => (p.stock ?? 0) <= 5 && !p.is_out_of_stock);
      return json(route, { success: true, data: low });
    }

    const inventoryMatch = path.match(/^\/admin\/products\/(\d+)\/inventory-movements$/);
    if (inventoryMatch && method === 'GET') {
      if (!requireAdmin()) return;
      return json(route, { success: true, data: [] });
    }

    // --- Coupons ---
    if (path === '/coupons' && method === 'GET') {
      if (!requireAdmin()) return;
      const { data, pagination } = store.listCoupons(url);
      return json(route, { success: true, data, pagination });
    }

    if (path === '/coupons' && method === 'POST') {
      if (!requireAdmin()) return;
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const coupon = store.createCoupon(body);
      if (coupon && 'error' in coupon) {
        return json(route, { success: false, error: coupon.error }, 400);
      }
      return json(route, { success: true, data: coupon, message: 'Coupon created' });
    }

    if (path === '/admin/uploads/product-media' && method === 'POST') {
      if (!requireAdmin()) return;
      const failUpload = route.request().headers()['x-playwright-fail-upload'] === '1';
      if (failUpload) {
        return json(route, { success: false, error: 'Upload storage unavailable' }, 503);
      }
      return json(route, {
        success: true,
        data: { image: '/uploads/playwright-persisted-image.png' },
        message: 'File uploaded',
      });
    }

    const couponIdMatch = path.match(/^\/coupons\/([^/]+)$/);
    if (couponIdMatch) {
      const couponId = couponIdMatch[1];
      if (method === 'PUT') {
        if (!requireAdmin()) return;
        const body = route.request().postDataJSON() as Record<string, unknown>;
        const updated = store.updateCoupon(couponId, body);
        if (!updated) return json(route, { success: false, error: 'Coupon not found' }, 404);
        return json(route, { success: true, data: updated, message: 'Coupon updated' });
      }
      if (method === 'DELETE') {
        if (!requireAdmin()) return;
        if (!store.deleteCoupon(couponId)) {
          return json(route, { success: false, error: 'Coupon not found' }, 404);
        }
        return json(route, { success: true, message: 'Coupon deleted' });
      }
    }

    // --- Orders ---
    if (path === '/orders' && method === 'GET') {
      if (!requireAdmin()) return;
      const parsed = new URL(url);
      const search = parsed.searchParams.get('search') ?? '';
      const status = parsed.searchParams.get('status') ?? 'all';
      const { data, count, pagination } = store.listOrders(url, search, status);
      return json(route, { success: true, data, count, pagination });
    }

    const orderIdMatch = path.match(/^\/orders\/([^/]+)$/);
    if (orderIdMatch) {
      const orderId = orderIdMatch[1];
      if (method === 'GET') {
        if (!requireAdmin()) return;
        const order = store.getOrder(orderId);
        if (!order) return json(route, { success: false, error: 'Order not found' }, 404);
        return json(route, { success: true, data: order });
      }
      if (method === 'PUT') {
        if (!requireAdmin()) return;
        const body = route.request().postDataJSON() as Record<string, unknown>;
        const updated = store.updateOrder(orderId, body);
        if (!updated) return json(route, { success: false, error: 'Order not found' }, 404);
        return json(route, { success: true, data: updated, message: 'Order updated' });
      }
      if (method === 'DELETE') {
        if (!requireAdmin()) return;
        if (!store.deleteOrder(orderId)) {
          return json(route, { success: false, error: 'Order not found' }, 404);
        }
        return json(route, { success: true, message: 'Order deleted' });
      }
    }

    const orderCustomerMatch = path.match(/^\/orders\/([^/]+)\/customer-details$/);
    if (orderCustomerMatch && method === 'PATCH') {
      if (!requireAdmin()) return;
      const orderId = orderCustomerMatch[1];
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const order = store.getOrder(orderId);
      if (!order) return json(route, { success: false, error: 'Order not found' }, 404);
      if (body.customer_name) order.customer_name = String(body.customer_name);
      if (body.customer_email) order.customer_email = String(body.customer_email);
      if (body.shipping_address) order.shipping_address = body.shipping_address as typeof order.shipping_address;
      if (body.admin_notes) order.admin_notes = String(body.admin_notes);
      return json(route, { success: true, data: order, message: 'Customer details updated' });
    }

    const orderPaymentMatch = path.match(/^\/orders\/([^/]+)\/payment-status$/);
    if (orderPaymentMatch && method === 'PATCH') {
      if (!requireAdmin()) return;
      const orderId = orderPaymentMatch[1];
      const body = route.request().postDataJSON() as { payment_id?: string; admin_note?: string };
      if (!body.payment_id || !body.admin_note) {
        return json(route, { success: false, error: 'payment_id and admin_note are required' }, 400);
      }
      const updated = store.markOrderPaid(orderId, body.payment_id, body.admin_note);
      if (!updated) return json(route, { success: false, error: 'Order not found' }, 404);
      return json(route, { success: true, data: updated, message: 'Order marked as paid' });
    }

    const orderNotifyMatch = path.match(/^\/orders\/([^/]+)\/notify-shipped$/);
    if (orderNotifyMatch && method === 'POST') {
      if (!requireAdmin()) return;
      return json(route, { success: true, message: 'Shipping notification sent' });
    }

    const orderCancelMatch = path.match(/^\/orders\/([^/]+)\/cancel$/);
    if (orderCancelMatch && method === 'POST') {
      if (!requireAdmin()) return;
      const orderId = orderCancelMatch[1];
      const updated = store.updateOrder(orderId, { status: 'cancelled', payment_status: 'cancelled' });
      if (!updated) return json(route, { success: false, error: 'Order not found' }, 404);
      return json(route, { success: true, data: updated, message: 'Order cancelled' });
    }

    if (path === '/admin/orders/bulk-update' && method === 'POST') {
      if (!requireAdmin()) return;
      return json(route, { success: true, updatedCount: 0 });
    }

    // --- Customers ---
    if (path === '/admin/customers' && method === 'GET') {
      if (!requireAdmin()) return;
      const parsed = new URL(url);
      const search = parsed.searchParams.get('search') ?? '';
      const includeDeleted = parsed.searchParams.get('include_deleted') === 'true';
      const { data, pagination } = store.listCustomers(url, search, includeDeleted);
      return json(route, { success: true, data, pagination });
    }

    const customerIdMatch = path.match(/^\/admin\/customers\/(\d+)$/);
    if (customerIdMatch) {
      const customerId = parseInt(customerIdMatch[1], 10);
      if (method === 'PATCH') {
        if (!requireAdmin()) return;
        const body = route.request().postDataJSON() as Record<string, unknown>;
        const updated = store.updateCustomer(customerId, body);
        if (!updated) return json(route, { success: false, error: 'Customer not found' }, 404);
        return json(route, { success: true, data: updated, message: 'Customer updated' });
      }
      if (method === 'DELETE') {
        if (!requireAdmin()) return;
        if (!store.softDeleteCustomer(customerId)) {
          return json(route, { success: false, error: 'Customer not found' }, 404);
        }
        return json(route, { success: true, message: 'Customer deleted' });
      }
    }

    const customerRestoreMatch = path.match(/^\/admin\/customers\/(\d+)\/restore$/);
    if (customerRestoreMatch && method === 'POST') {
      if (!requireAdmin()) return;
      const customerId = parseInt(customerRestoreMatch[1], 10);
      if (!store.restoreCustomer(customerId)) {
        return json(route, { success: false, error: 'Customer not found' }, 404);
      }
      return json(route, { success: true, message: 'Customer restored' });
    }

    const customerEmailMatch = path.match(/^\/admin\/customers\/([^/]+)$/);
    if (customerEmailMatch && method === 'GET') {
      const email = decodeURIComponent(customerEmailMatch[1]);
      if (email.includes('@')) {
        if (!requireAdmin()) return;
        const { customer, orders: customerOrders, pagination } = store.customerHistory(email, url);
        if (!customer) return json(route, { success: false, error: 'Customer not found' }, 404);
        return json(route, {
          success: true,
          data: { customer, orders: customerOrders },
          pagination,
        });
      }
    }

    return route.fallback();
  });
}
