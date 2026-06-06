import type { Page, Route } from '@playwright/test';
import {
  MOCK_FILTERS,
  MOCK_PRODUCTS,
  MOCK_PUBLIC_REVIEW,
  MOCK_REVIEWS_STATS,
  type MockProduct,
} from '../fixtures/mock-data';

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

function paginateProducts(products: MockProduct[], url: string) {
  const parsed = new URL(url);
  const limit = Math.max(1, parseInt(parsed.searchParams.get('limit') || '10', 10));
  const page = Math.max(1, parseInt(parsed.searchParams.get('page') || '1', 10));
  const offset = (page - 1) * limit;
  const slice = products.slice(offset, offset + limit);
  const total = products.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    success: true,
    data: slice,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

export interface MockApiOptions {
  products?: MockProduct[];
}

/** Intercept storefront `/api/*` calls so E2E runs without a live backend. */
export async function installStorefrontApiMocks(
  page: Page,
  options: MockApiOptions = {},
): Promise<void> {
  const products = options.products ?? MOCK_PRODUCTS;

  await page.route('**/api/**', async (route) => {
    const path = apiPath(route.request().url());
    const method = route.request().method();

    if (path === '/csrf-token' && method === 'GET') {
      return json(route, { success: true, token: 'playwright-csrf-token' });
    }

    if (path === '/products/filters' && method === 'GET') {
      return json(route, { success: true, data: MOCK_FILTERS });
    }

    if (path === '/products/validate-cart' && method === 'POST') {
      let body: { items?: Array<{ product_id: number; quantity: number }> } = {};
      try {
        body = route.request().postDataJSON() as typeof body;
      } catch {
        body = {};
      }

      const refreshed = (body.items ?? []).map((line) => {
        const product = products.find((p) => p.id === line.product_id);
        return {
          id: line.product_id,
          name: product?.name ?? `Product ${line.product_id}`,
          image: product?.image ?? '/assets/blue-nike.png',
          price: product?.price ?? 98,
          quantity: line.quantity,
        };
      });

      const subtotal = refreshed.reduce((sum, item) => sum + item.price * item.quantity, 0);
      return json(route, { success: true, items: refreshed, subtotal });
    }

    if (path.startsWith('/products/category/') && method === 'GET') {
      const category = decodeURIComponent(path.replace('/products/category/', ''));
      const filtered = products.filter((p) => p.category === category);
      return json(route, {
        ...paginateProducts(filtered, route.request().url()),
        count: filtered.length,
      });
    }

    const singleProductMatch = path.match(/^\/products\/(\d+)$/);
    if (singleProductMatch && method === 'GET') {
      const id = parseInt(singleProductMatch[1], 10);
      const product = products.find((p) => p.id === id);
      if (!product) {
        return json(
          route,
          { success: false, error: 'Product not found', message: `Product with ID ${id} does not exist` },
          404,
        );
      }
      return json(route, { success: true, data: product });
    }

    if (path.startsWith('/products') && method === 'GET') {
      return json(route, paginateProducts(products, route.request().url()));
    }

    const reviewsMatch = path.match(/^\/reviews\/product\/(\d+)$/);
    if (reviewsMatch && method === 'GET') {
      const productId = parseInt(reviewsMatch[1], 10);
      const reviews = productId === 1 ? [MOCK_PUBLIC_REVIEW] : [];
      return json(route, {
        success: true,
        data: {
          reviews,
          stats: {
            ...MOCK_REVIEWS_STATS,
            total_reviews: reviews.length,
          },
          pagination: {
            page: 1,
            limit: 10,
            total: reviews.length,
            totalPages: 1,
            hasMore: false,
          },
        },
      });
    }

    if (path === '/contact' && method === 'POST') {
      return json(route, { success: true, message: 'Message sent successfully!' });
    }

    if (path === '/activity/batch' && method === 'POST') {
      return json(route, { success: true });
    }

    if (path.startsWith('/orders') && method === 'GET') {
      return json(route, { success: true, data: [] });
    }

    // Unhandled API — avoid hanging on proxy to offline backend
    return json(route, { success: true, data: null });
  });
}
