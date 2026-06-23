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
  /** When set, create-payment returns this total (for total-mismatch UI tests). */
  createPaymentTotal?: number;
}

/** Intercept storefront `/api/*` calls so E2E runs without a live backend. */
export async function installStorefrontApiMocks(
  page: Page,
  options: MockApiOptions = {},
): Promise<void> {
  const products = options.products ?? MOCK_PRODUCTS;
  const createPaymentTotal = options.createPaymentTotal;

  await page.route('**/api/**', async (route) => {
    const path = apiPath(route.request().url());
    const method = route.request().method();

    if (path === '/csrf-token' && method === 'GET') {
      return json(route, { success: true, csrfToken: 'playwright-csrf-token' });
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

    if (path === '/products/search' && method === 'POST') {
      let body: { query?: string } = {};
      try {
        body = route.request().postDataJSON() as typeof body;
      } catch {
        body = {};
      }
      const q = (body.query || '').toLowerCase();
      const filtered = q
        ? products.filter((p) => p.name.toLowerCase().includes(q))
        : products;
      return json(route, {
        success: true,
        data: filtered.slice(0, 20),
        pagination: { page: 1, limit: 20, total: filtered.length, totalPages: 1, hasMore: false },
      });
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

    if (path === '/coupons/validate' && method === 'POST') {
      let body: {
        code?: string;
        items?: Array<{ product_id: number; quantity: number; price?: number }>;
      } = {};
      try {
        body = route.request().postDataJSON() as typeof body;
      } catch {
        body = {};
      }
      const code = (body.code || '').trim().toUpperCase();
      if (code === 'LDCOFF10') {
        const subtotal = (body.items ?? []).reduce(
          (sum, line) => sum + (line.price ?? 98) * line.quantity,
          0,
        );
        const couponDiscount = Math.round(subtotal * 0.1 * 100) / 100;
        const shipping = subtotal >= 200 ? 0 : 25;
        const total = Math.round((subtotal + shipping - couponDiscount) * 100) / 100;
        return json(route, {
          success: true,
          valid: true,
          coupon: {
            id: 'mock-coupon-ldcoff10',
            code: 'LDCOFF10',
            description: '10% off',
            discount_type: 'percentage',
            discount_value: 10,
          },
          discount_amount: couponDiscount,
          pricing: {
            subtotal,
            shipping,
            volume_discount: 0,
            coupon_discount: couponDiscount,
            total,
          },
          message: '10% discount applied!',
        });
      }
      return json(route, {
        success: true,
        valid: false,
        message: 'Invalid coupon code',
        error_code: 'NOT_FOUND',
      });
    }

    const checkoutExchangeMatch = path.match(/^\/paypal\/checkout-exchange\/([^/]+)$/);
    if (checkoutExchangeMatch && method === 'GET') {
      const code = decodeURIComponent(checkoutExchangeMatch[1]);
      if (code === 'RECON-CODE' || code === 'CHECKOUT-OK') {
        return json(route, {
          success: true,
          accessToken: 'b'.repeat(64),
          serverOrderId: '00000000-0000-0000-0000-00000000cc01',
          orderNumber: 'GSS-RECON-TEST',
          total: 98,
        });
      }
      return json(route, { success: false, error: 'Invalid or expired checkout code' }, 404);
    }

    const captureMatch = path.match(/^\/paypal\/capture-payment\/([^/]+)$/);
    if (captureMatch && method === 'POST') {
      const paypalOrderId = decodeURIComponent(captureMatch[1]);
      if (paypalOrderId === 'PAYPAL-409') {
        return json(
          route,
          {
            success: false,
            error: 'Payment received — order processing',
            message:
              'Payment received — your order is still being confirmed. This usually resolves within a minute.',
          },
          409,
        );
      }
      if (paypalOrderId === 'PAYPAL-OK') {
        return json(route, {
          success: true,
          order: {
            order_number: 'GSS-PAID-TEST',
            total: 98,
            payment_status: 'completed',
            status: 'processing',
            shipping_address: {},
          },
        });
      }
    }

    if (path.startsWith('/paypal/checkout-context/') && method === 'GET') {
      return json(route, {
        success: true,
        alreadyCompleted: false,
        serverOrderId: '00000000-0000-0000-0000-00000000cc01',
        orderNumber: 'GSS-RECON-TEST',
        total: 98,
      });
    }

    if (path === '/paypal/create-payment' && method === 'POST') {
      const mismatch = createPaymentTotal != null;
      return json(route, {
        success: true,
        total: createPaymentTotal ?? 123,
        orderId: mismatch ? 'PAYPAL-MISMATCH' : 'PAYPAL-OK',
        serverOrderId: mismatch
          ? '00000000-0000-0000-0000-00000000ff01'
          : '00000000-0000-0000-0000-00000000dd01',
        orderNumber: mismatch ? 'GSS-MISMATCH' : 'GSS-CHECKOUT-TEST',
        links: [
          {
            rel: 'approve',
            href: `https://www.sandbox.paypal.com/checkoutnow?token=${mismatch ? 'PAYPAL-MISMATCH' : 'PAYPAL-OK'}`,
          },
        ],
      });
    }

    if (path === '/activity/batch' && method === 'POST') {
      return json(route, { success: true });
    }

    const orderAccessExchangeMatch = path.match(/^\/orders\/access-exchange\/([^/]+)$/);
    if (orderAccessExchangeMatch && method === 'GET') {
      const code = decodeURIComponent(orderAccessExchangeMatch[1]);
      if (code === 'EMAIL-LINK-CODE') {
        return json(route, {
          success: true,
          data: {
            orderNumber: 'GSS-EMAIL-TEST-ABC',
            accessToken: 'a'.repeat(64),
            serverOrderId: '00000000-0000-0000-0000-00000000ee01',
          },
        });
      }
      return json(route, { success: false, error: 'Invalid or expired tracking link' }, 404);
    }

    if (path === '/orders/lookup' && method === 'POST') {
      let body: { orderNumber?: string; accessToken?: string } = {};
      try {
        body = route.request().postDataJSON() as typeof body;
      } catch {
        body = {};
      }

      if (
        body.orderNumber === 'GSS-EMAIL-TEST-ABC' &&
        body.accessToken === 'a'.repeat(64)
      ) {
        return json(route, {
          success: true,
          data: {
            id: '00000000-0000-0000-0000-00000000ee01',
            order_number: 'GSS-EMAIL-TEST-ABC',
            customer_email: 'buyer@example.com',
            customer_name: 'Test Buyer',
            shipping_address: {},
            items: [],
            subtotal: 98,
            shipping_cost: 0,
            tax: 0,
            total: 98,
            payment_status: 'completed',
            status: 'processing',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        });
      }

      return json(
        route,
        { success: false, error: 'Order not found or invalid credentials' },
        404,
      );
    }

    if (path.startsWith('/orders') && method === 'GET') {
      return json(route, { success: true, data: [] });
    }

    // Unhandled API — avoid hanging on proxy to offline backend
    return json(route, { success: true, data: null });
  });
}
