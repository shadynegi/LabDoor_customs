import { MOCK_PRODUCTS, type MockProduct } from './mock-data';

export interface MockAdminProduct extends MockProduct {
  view_count?: number;
  cost_price?: number | null;
}

export interface MockAdminOrderItem {
  product_name: string;
  quantity: number;
  price: number;
  size_value?: string;
}

export interface MockAdminOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  status: string;
  payment_status: string;
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total: number;
  created_at: string;
  updated_at?: string;
  items: MockAdminOrderItem[];
  shipping_address?: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  admin_notes?: string;
  tracking_number?: string;
  tracking_url?: string;
  carrier?: string;
  estimated_delivery?: string | null;
}

export interface MockAdminCustomer {
  id: number;
  email: string;
  name: string;
  phone?: string;
  admin_notes?: string;
  total_orders: number;
  total_spent: number;
  first_order_date: string | null;
  last_order_date: string | null;
  is_deleted?: boolean;
}

export interface MockAdminCoupon {
  id: string;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  minimum_order?: number;
  max_uses?: number | null;
  used_count?: number;
  is_active: boolean;
  valid_until?: string | null;
  applies_to: 'all' | 'product';
  applies_to_ids?: number[];
}

export const MOCK_ADMIN_ORDERS: MockAdminOrder[] = [
  {
    id: '00000000-0000-0000-0000-00000000aa01',
    order_number: 'GSS-ADMIN-PENDING',
    customer_name: 'Pending Buyer',
    customer_email: 'pending@example.com',
    status: 'pending',
    payment_status: 'pending',
    subtotal: 98,
    shipping_cost: 25,
    tax: 0,
    total: 123,
    created_at: '2026-06-01T10:00:00.000Z',
    items: [{ product_name: 'Nike Drops - Blue', quantity: 1, price: 98, size_value: '10' }],
    shipping_address: {
      address: '1 Test Street',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'United States',
    },
  },
  {
    id: '00000000-0000-0000-0000-00000000aa02',
    order_number: 'GSS-ADMIN-PROCESSING',
    customer_name: 'Paid Buyer',
    customer_email: 'paid@example.com',
    status: 'processing',
    payment_status: 'completed',
    subtotal: 196,
    shipping_cost: 25,
    tax: 0,
    total: 221,
    created_at: '2026-06-02T14:30:00.000Z',
    items: [{ product_name: 'Golden Essence', quantity: 2, price: 98 }],
    shipping_address: {
      address: '2 Oak Ave',
      city: 'Boston',
      state: 'MA',
      zipCode: '02101',
      country: 'United States',
    },
  },
];

export const MOCK_ADMIN_CUSTOMERS: MockAdminCustomer[] = [
  {
    id: 501,
    email: 'pending@example.com',
    name: 'Pending Buyer',
    phone: '+1-555-0100',
    admin_notes: 'WhatsApp checkout',
    total_orders: 1,
    total_spent: 123,
    first_order_date: '2026-06-01T10:00:00.000Z',
    last_order_date: '2026-06-01T10:00:00.000Z',
  },
  {
    id: 502,
    email: 'paid@example.com',
    name: 'Paid Buyer',
    phone: '+1-555-0101',
    total_orders: 1,
    total_spent: 221,
    first_order_date: '2026-06-02T14:30:00.000Z',
    last_order_date: '2026-06-02T14:30:00.000Z',
  },
];

export const MOCK_ADMIN_COUPONS: MockAdminCoupon[] = [
  {
    id: 'coupon-existing-10',
    code: 'EXISTING10',
    description: '10% off your order',
    discount_type: 'percentage',
    discount_value: 10,
    is_active: true,
    applies_to: 'all',
    used_count: 0,
  },
];

export function cloneAdminProducts(): MockAdminProduct[] {
  return MOCK_PRODUCTS.map((p) => ({
    ...p,
    view_count: 12,
    cost_price: null,
  }));
}
