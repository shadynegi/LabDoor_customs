import type { Page, Route } from '@playwright/test';
import { installStorefrontApiMocks } from './mock-api';

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
  messages: { unread: 0, total: 0 },
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

/** Intercept admin `/api/*` routes for Playwright (storefront mocks + admin session). */
export async function installAdminApiMocks(
  page: Page,
  state: AdminMockState = { lastAnalyticsQuery: null, lastExportQuery: null },
): Promise<void> {
  let adminAuthenticated = false;

  await installStorefrontApiMocks(page);

  await page.route('**/api/**', async (route) => {
    const path = apiPath(route.request().url());
    const method = route.request().method();
    const url = route.request().url();

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
      if (!adminAuthenticated) {
        return json(route, { success: false, error: 'Unauthorized' }, 401);
      }
      state.lastAnalyticsQuery = url.split('/admin/analytics')[1] ?? '';
      return json(route, { success: true, data: MOCK_ANALYTICS });
    }

    if (path === '/admin/analytics/export' && method === 'GET') {
      if (!adminAuthenticated) {
        return json(route, { success: false, error: 'Unauthorized' }, 401);
      }
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

    return route.fallback();
  });
}
