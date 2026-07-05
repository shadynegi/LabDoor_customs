import type { MockProduct } from '../fixtures/mock-data';
import {
  cloneAdminProducts,
  MOCK_ADMIN_COUPONS,
  MOCK_ADMIN_CUSTOMERS,
  MOCK_ADMIN_ORDERS,
  type MockAdminCoupon,
  type MockAdminCustomer,
  type MockAdminOrder,
  type MockAdminProduct,
} from '../fixtures/admin-mock-data';

function paginate<T>(items: T[], url: string, defaultLimit = 50) {
  const parsed = new URL(url);
  const limit = Math.max(1, parseInt(parsed.searchParams.get('limit') || String(defaultLimit), 10));
  const page = Math.max(1, parseInt(parsed.searchParams.get('page') || '1', 10));
  const offset = (page - 1) * limit;
  const slice = items.slice(offset, offset + limit);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    data: slice,
    pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
  };
}

export type AdminMockStore = ReturnType<typeof createAdminMockStore>;

export function createAdminMockStore() {
  const products: MockAdminProduct[] = cloneAdminProducts();
  const orders: MockAdminOrder[] = MOCK_ADMIN_ORDERS.map((o) => ({ ...o, items: [...o.items] }));
  const customers: MockAdminCustomer[] = MOCK_ADMIN_CUSTOMERS.map((c) => ({ ...c }));
  const coupons: MockAdminCoupon[] = MOCK_ADMIN_COUPONS.map((c) => ({ ...c }));

  let nextProductId = 99001;
  let nextCouponId = 1;

  const findOrder = (id: string) => orders.find((o) => o.id === id);

  return {
    products: products as MockProduct[],
    adminProducts: products,
    adminCoupons: coupons,

    listProducts(url: string) {
      return paginate(products, url, 50);
    },

    getProduct(id: number) {
      return products.find((p) => p.id === id) ?? null;
    },

    createProduct(body: Partial<MockAdminProduct>) {
      const product: MockAdminProduct = {
        id: nextProductId++,
        public_id: `00000000-0000-4000-8000-${String(nextProductId).padStart(12, '0')}`,
        name: String(body.name ?? 'New Product'),
        price: Number(body.price ?? 0),
        image: String(body.image ?? '/assets/blue-nike.png'),
        description: body.description,
        background: body.background,
        stock: Number(body.stock ?? 0),
        is_out_of_stock: Boolean(body.is_out_of_stock),
        view_count: 0,
        cost_price: body.cost_price ?? null,
        created_at: new Date().toISOString(),
      };
      products.push(product);
      return product;
    },

    updateProduct(id: number, body: Partial<MockAdminProduct>) {
      const idx = products.findIndex((p) => p.id === id);
      if (idx < 0) return null;
      products[idx] = { ...products[idx], ...body, id };
      return products[idx];
    },

    deleteProduct(id: number) {
      const idx = products.findIndex((p) => p.id === id);
      if (idx < 0) return false;
      products.splice(idx, 1);
      return true;
    },

    listOrders(url: string, search = '', status = 'all') {
      let filtered = [...orders];
      if (status !== 'all') {
        filtered = filtered.filter((o) => o.status === status);
      }
      const q = search.trim().toLowerCase();
      if (q) {
        filtered = filtered.filter(
          (o) =>
            o.order_number.toLowerCase().includes(q) ||
            o.customer_email.toLowerCase().includes(q) ||
            o.customer_name.toLowerCase().includes(q) ||
            o.id.toLowerCase().includes(q),
        );
      }
      const { data, pagination } = paginate(filtered, url, 50);
      return { data, count: filtered.length, pagination };
    },

    getOrder(id: string) {
      return findOrder(id) ?? null;
    },

    updateOrder(id: string, body: Partial<MockAdminOrder>) {
      const order = findOrder(id);
      if (!order) return null;
      Object.assign(order, body, { updated_at: new Date().toISOString() });
      return order;
    },

    deleteOrder(id: string) {
      const idx = orders.findIndex((o) => o.id === id);
      if (idx < 0) return false;
      orders.splice(idx, 1);
      return true;
    },

    markOrderPaid(id: string, paymentId: string, adminNote: string) {
      const order = findOrder(id);
      if (!order) return null;
      order.payment_status = 'completed';
      order.status = 'processing';
      order.admin_notes = adminNote;
      (order as MockAdminOrder & { payment_id?: string }).payment_id = paymentId;
      return order;
    },

    listCustomers(url: string, search = '', includeDeleted = false) {
      let filtered = customers.filter((c) => includeDeleted || !c.is_deleted);
      const q = search.trim().toLowerCase();
      if (q) {
        filtered = filtered.filter(
          (c) =>
            c.email.toLowerCase().includes(q) ||
            (c.name || '').toLowerCase().includes(q) ||
            (c.phone || '').toLowerCase().includes(q),
        );
      }
      const { data, pagination } = paginate(filtered, url, 50);
      return { data, pagination };
    },

    updateCustomer(id: number, body: Partial<MockAdminCustomer>) {
      const idx = customers.findIndex((c) => c.id === id);
      if (idx < 0) return null;
      customers[idx] = { ...customers[idx], ...body, id };
      return customers[idx];
    },

    softDeleteCustomer(id: number) {
      const customer = customers.find((c) => c.id === id);
      if (!customer) return false;
      customer.is_deleted = true;
      return true;
    },

    restoreCustomer(id: number) {
      const customer = customers.find((c) => c.id === id);
      if (!customer) return false;
      customer.is_deleted = false;
      return true;
    },

    customerHistory(email: string, url: string) {
      const customer = customers.find((c) => c.email === email);
      const customerOrders = orders.filter((o) => o.customer_email === email);
      const { data, pagination } = paginate(customerOrders, url, 10);
      return { customer, orders: data, pagination };
    },

    listCoupons(url: string) {
      return paginate(coupons, url, 10);
    },

    createCoupon(body: Partial<MockAdminCoupon>) {
      const code = String(body.code ?? 'NEWCODE').toUpperCase();
      if (coupons.some((c) => c.code === code)) {
        return { error: 'A coupon with this code already exists' } as const;
      }
      const coupon: MockAdminCoupon = {
        id: `coupon-new-${nextCouponId++}`,
        code,
        description: body.description,
        discount_type: body.discount_type ?? 'percentage',
        discount_value: Number(body.discount_value ?? 10),
        minimum_order: body.minimum_order ?? 0,
        max_uses: body.max_uses ?? null,
        used_count: 0,
        is_active: body.is_active !== false,
        valid_until: body.valid_until ?? null,
        applies_to: body.applies_to ?? 'all',
        applies_to_ids: body.applies_to_ids,
      };
      coupons.push(coupon);
      return coupon;
    },

    updateCoupon(id: string, body: Partial<MockAdminCoupon>) {
      const idx = coupons.findIndex((c) => c.id === id);
      if (idx < 0) return null;
      coupons[idx] = { ...coupons[idx], ...body, id };
      return coupons[idx];
    },

    deleteCoupon(id: string) {
      const idx = coupons.findIndex((c) => c.id === id);
      if (idx < 0) return false;
      coupons.splice(idx, 1);
      return true;
    },
  };
}
