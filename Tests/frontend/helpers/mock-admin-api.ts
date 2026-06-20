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
};

/** Intercept admin `/api/*` routes for Playwright (storefront mocks + admin session). */
export async function installAdminApiMocks(page: Page): Promise<void> {
  let adminAuthenticated = false;

  await installStorefrontApiMocks(page);

  await page.route('**/api/**', async (route) => {
    const path = apiPath(route.request().url());
    const method = route.request().method();

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
      return json(route, { success: true, data: MOCK_ANALYTICS });
    }

    return route.fallback();
  });
}
