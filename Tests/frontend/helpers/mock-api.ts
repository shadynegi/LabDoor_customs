import type { Page, Route } from '@playwright/test';
import {
  MOCK_FILTERS,
  MOCK_PRODUCTS,
  type MockProduct,
} from '../fixtures/mock-data';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export interface PlaceOrderMockResponse {
  success: boolean;
  total: number;
  serverOrderId: string;
  orderNumber: string;
  whatsappUrl: string;
}

export function buildPlaceOrderMockResponse(
  postData: { amount?: string },
  createPaymentTotal?: number,
): PlaceOrderMockResponse {
  const parsedAmount = parseFloat(postData.amount ?? '');
  const mismatch = createPaymentTotal != null;
  const total = createPaymentTotal ?? (Number.isFinite(parsedAmount) ? parsedAmount : 123);
  const orderNumber = mismatch ? 'GSS-MISMATCH' : 'GSS-CHECKOUT-TEST';
  return {
    success: true,
    total,
    serverOrderId: mismatch
      ? '00000000-0000-0000-0000-00000000ff01'
      : '00000000-0000-0000-0000-00000000dd01',
    orderNumber,
    whatsappUrl: `https://wa.me/919888514572?text=${encodeURIComponent(`Order ${orderNumber}`)}`,
  };
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
      type ValidateCartLine = {
        product_id: number;
        quantity: number;
        size_system?: string;
        size_value?: string;
      };
      let body: { items?: ValidateCartLine[] } = {};
      try {
        body = route.request().postDataJSON() as typeof body;
      } catch {
        body = {};
      }

      const validSizeSystems = ['UK', 'US', 'EU'];
      const isValidSize = (line: ValidateCartLine) => {
        const system = line.size_system?.trim().toUpperCase();
        const value = line.size_value?.trim();
        return (
          system &&
          validSizeSystems.includes(system) &&
          value &&
          /^\d+$/.test(value)
        );
      };

      for (const line of body.items ?? []) {
        if (!isValidSize(line)) {
          return json(route, {
            success: false,
            error: 'Size required',
            message: 'Please select a size (system and value) for each cart item',
          }, 400);
        }
      }

      const refreshed = (body.items ?? []).map((line) => {
        const product = products.find((p) => p.id === line.product_id);
        const system = line.size_system!.trim().toUpperCase();
        const value = line.size_value!.trim();
        return {
          id: line.product_id,
          name: product?.name ?? `Product ${line.product_id}`,
          image: product?.image ?? '/assets/blue-nike.png',
          price: product?.price ?? 98,
          quantity: line.quantity,
          size: { system, value },
        };
      });

      const subtotal = refreshed.reduce((sum, item) => sum + item.price * item.quantity, 0);
      return json(route, { success: true, items: refreshed, subtotal });
    }


    const singleProductMatch = path.match(
      /^\/products\/(\d+|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i,
    );
    if (singleProductMatch && method === 'GET') {
      const routeId = singleProductMatch[1];
      const product =
        products.find((p) => p.public_id === routeId) ??
        products.find((p) => String(p.id) === routeId);
      if (!product) {
        return json(
          route,
          { success: false, error: 'Product not found', message: `Product with ID ${routeId} does not exist` },
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

    if (path === '/checkout/place-order' && method === 'POST') {
      let body: { amount?: string } = {};
      try {
        body = route.request().postDataJSON() as typeof body;
      } catch {
        body = {};
      }
      return json(route, buildPlaceOrderMockResponse(body, createPaymentTotal));
    }

    if (path === '/activity/batch' && method === 'POST') {
      return json(route, { success: true });
    }

    const orderAccessExchangeMatch = path.match(/^\/orders\/access-exchange\/([^/]+)$/);
    if (orderAccessExchangeMatch && method === 'GET') {
      return json(route, {
        success: false,
        error: 'Tracking link format deprecated',
        message: 'Use the Track Orders page with your order ID and checkout email.',
      }, 410);
    }

    if (path === '/orders/lookup' && method === 'POST') {
      let body: { orderId?: string; email?: string } = {};
      try {
        body = route.request().postDataJSON() as typeof body;
      } catch {
        body = {};
      }

      if (
        body.orderId === '00000000-0000-0000-0000-00000000ee01' &&
        body.email === 'orders-ui@example.com'
      ) {
        return json(route, {
          success: true,
          data: {
            id: '00000000-0000-0000-0000-00000000ee01',
            order_number: 'GSS-EMAIL-TEST-ABC',
            customer_email: 'orders-ui@example.com',
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

      if (
        body.orderId === '00000000-0000-0000-0000-00000000ee02' &&
        body.email === 'orders-ui@example.com'
      ) {
        return json(route, {
          success: true,
          data: {
            id: '00000000-0000-0000-0000-00000000ee02',
            order_number: 'GSS-SHIPPED-UI-1',
            customer_email: 'orders-ui@example.com',
            customer_name: 'Shipped Buyer',
            shipping_address: {},
            items: [],
            subtotal: 120,
            shipping_cost: 0,
            tax: 0,
            total: 120,
            payment_status: 'completed',
            status: 'shipped',
            tracking_number: '1Z-UI-TEST',
            tracking_url: 'https://track.example/ui-test',
            carrier: 'UPS',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        });
      }

      return json(
        route,
        { success: false, error: 'Order not found' },
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
