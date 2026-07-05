#!/usr/bin/env node
/**
 * Idempotent demo seed: 10 Test customers + 20 orders for admin dashboard/analytics QA.
 *
 * Usage (from repo root or backend/):
 *   node backend/scripts/seed-test-data.mjs
 *   npm run seed:test-data -w backend
 *
 * Re-run safe: removes prior rows tagged with order_number GSS-TEST-SEED-* and known test emails.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(backendRoot, '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL in backend/.env');
  process.exit(1);
}

const ORDER_PREFIX = 'GSS-TEST-SEED-';
const SHIPPING_COST = 25;
const FREE_SHIPPING_THRESHOLD = 200;

/** Deterministic UUID from a stable string (seed ids survive re-runs). */
function stableUuid(seed) {
  const hash = crypto.createHash('sha256').update(`ldc-test-seed:${seed}`).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const CUSTOMERS = [
  {
    key: 'john',
    name: 'Test John Doe',
    email: 'test.john.doe@example.com',
    phone: '+1-555-0101',
    address: '1420 Broadway Ave',
    city: 'New York',
    state: 'NY',
    country: 'United States',
    postal: '10018',
    adminNotes: 'VIP repeat buyer — high AOV',
  },
  {
    key: 'sarah',
    name: 'Test Sarah Patel',
    email: 'test.sarah.patel@example.com',
    phone: '+91-98765-43210',
    address: '415 Sector 78',
    city: 'Mohali',
    state: 'Punjab',
    country: 'India',
    postal: '140308',
    adminNotes: 'Local Mohali customer',
  },
  {
    key: 'michael',
    name: 'Test Michael Chen',
    email: 'michael.test@example.com',
    phone: '+1-555-0103',
    address: '88 Market Street',
    city: 'San Francisco',
    state: 'CA',
    country: 'United States',
    postal: '94105',
  },
  {
    key: 'emily',
    name: 'Test Emily Rodriguez',
    email: 'test.emily.r@example.com',
    phone: '+1-555-0104',
    address: '2200 Lake Shore Dr',
    city: 'Chicago',
    state: 'IL',
    country: 'United States',
    postal: '60614',
  },
  {
    key: 'david',
    name: 'Test David Kim',
    email: 'david.test.kim@example.com',
    phone: '+1-555-0105',
    address: '501 Pike Street',
    city: 'Seattle',
    state: 'WA',
    country: 'United States',
    postal: '98101',
  },
  {
    key: 'priya',
    name: 'Test Priya Sharma',
    email: 'test.priya.sharma@example.com',
    phone: '+91-99887-76655',
    address: '12 Phase 7',
    city: 'Mohali',
    state: 'Punjab',
    country: 'India',
    postal: '160062',
    adminNotes: 'Had one cancelled unpaid order',
  },
  {
    key: 'james',
    name: 'Test James Wilson',
    email: 'james.test@example.com',
    phone: '+44-20-7946-0958',
    address: '10 Downing Lane',
    city: 'London',
    state: 'England',
    country: 'United Kingdom',
    postal: 'SW1A 2AA',
  },
  {
    key: 'olivia',
    name: 'Test Olivia Brown',
    email: 'test.olivia.brown@example.com',
    phone: '+1-555-0108',
    address: '300 Peachtree St NE',
    city: 'Atlanta',
    state: 'GA',
    country: 'United States',
    postal: '30308',
  },
  {
    key: 'ryan',
    name: 'Test Ryan O\'Connor',
    email: 'ryan.test@example.com',
    phone: '+1-555-0109',
    address: '77 Boylston Street',
    city: 'Boston',
    state: 'MA',
    country: 'United States',
    postal: '02116',
  },
  {
    key: 'nina',
    name: 'Test Nina Kapoor',
    email: 'test.nina.kapoor@example.com',
    phone: '+91-98112-34567',
    address: '9 Industrial Area',
    city: 'Chandigarh',
    state: 'Punjab',
    country: 'India',
    postal: '160002',
  },
];

const customerByKey = Object.fromEntries(CUSTOMERS.map((c) => [c.key, c]));

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function volumeDiscount(subtotal, itemCount) {
  if (itemCount >= 5) return roundMoney(subtotal * 0.2);
  if (itemCount >= 2) return roundMoney(subtotal * 0.1);
  return 0;
}

function pricingFromSubtotal(subtotal, itemCount, couponDiscount = 0) {
  const vol = volumeDiscount(subtotal, itemCount);
  const afterVol = Math.max(0, subtotal - vol);
  const coupon = Math.min(Math.max(0, couponDiscount), afterVol);
  const discount = vol + coupon;
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const total = roundMoney(Math.max(0, subtotal - discount) + shipping);
  return { subtotal: roundMoney(subtotal), shipping, tax: 0, discount, total, volumeDiscount: vol, couponDiscount: coupon };
}

function atOffset({ daysAgo = 0, hours = 12, minutes = 0 }) {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(minutes);
  d.setHours(hours);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function shippingJson(customer) {
  return {
    full_name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    city: customer.city,
    state: customer.state,
    zip_code: customer.postal,
    country: customer.country,
    billing_same_as_shipping: true,
  };
}

function addressBook(customer) {
  return [
    {
      address: customer.address,
      city: customer.city,
      state: customer.state,
      country: customer.country,
      zip_code: customer.postal,
      label: 'primary',
    },
  ];
}

/** 20 orders — status/payment mix + date spread + customer distribution */
const ORDER_SPECS = [
  // Today (2)
  { n: 1, customer: 'john', daysAgo: 0, hours: 9, status: 'pending', payment: 'pending', lines: 2, coupon: false },
  { n: 2, customer: 'sarah', daysAgo: 0, hours: 21, status: 'processing', payment: 'completed', lines: 3, coupon: false },
  // Yesterday (2)
  { n: 3, customer: 'michael', daysAgo: 1, hours: 14, status: 'shipped', payment: 'completed', lines: 2, tracking: 'BD-TEST-1003' },
  { n: 4, customer: 'emily', daysAgo: 1, hours: 23, status: 'delivered', payment: 'completed', lines: 1, delivered: true },
  // Last 7 days (4)
  { n: 5, customer: 'john', daysAgo: 2, hours: 8, status: 'delivered', payment: 'completed', lines: 4, delivered: true },
  { n: 6, customer: 'david', daysAgo: 3, hours: 16, status: 'processing', payment: 'completed', lines: 2 },
  { n: 7, customer: 'priya', daysAgo: 5, hours: 11, status: 'pending', payment: 'failed', lines: 1 },
  { n: 8, customer: 'james', daysAgo: 6, hours: 19, status: 'processing', payment: 'completed', lines: 2 },
  // Last 30 days (4)
  { n: 9, customer: 'olivia', daysAgo: 10, hours: 10, status: 'delivered', payment: 'completed', lines: 3, delivered: true },
  { n: 10, customer: 'ryan', daysAgo: 15, hours: 15, status: 'pending', payment: 'pending', lines: 1 },
  { n: 11, customer: 'nina', daysAgo: 20, hours: 7, status: 'delivered', payment: 'completed', lines: 2, delivered: true, coupon: true },
  { n: 12, customer: 'sarah', daysAgo: 28, hours: 22, status: 'processing', payment: 'completed', lines: 5, coupon: false },
  // Earlier this year (~60–150 days ago) (4)
  { n: 13, customer: 'john', daysAgo: 60, hours: 13, status: 'delivered', payment: 'completed', lines: 3, delivered: true },
  { n: 14, customer: 'michael', daysAgo: 90, hours: 9, status: 'shipped', payment: 'completed', lines: 2, tracking: 'BD-TEST-1014' },
  { n: 15, customer: 'emily', daysAgo: 120, hours: 18, status: 'shipped', payment: 'completed', lines: 1, tracking: 'BD-TEST-1015' },
  { n: 16, customer: 'david', daysAgo: 150, hours: 12, status: 'pending', payment: 'pending', lines: 2 },
  // Previous year (~400–550 days ago) (4)
  { n: 17, customer: 'john', daysAgo: 400, hours: 8, status: 'shipped', payment: 'completed', lines: 2, tracking: 'BD-TEST-1017' },
  { n: 18, customer: 'priya', daysAgo: 450, hours: 17, status: 'cancelled', payment: 'pending', lines: 1, cancelled: true },
  { n: 19, customer: 'nina', daysAgo: 500, hours: 20, status: 'cancelled', payment: 'refunded', lines: 2, cancelled: true, adminNotes: 'Refunded after defect claim' },
  { n: 20, customer: 'sarah', daysAgo: 550, hours: 6, status: 'delivered', payment: 'completed', lines: 1, delivered: true },
];

function pickLineItems(products, lineCount, orderIndex) {
  const items = [];
  let cursor = orderIndex % products.length;
  for (let i = 0; i < lineCount; i += 1) {
    const p = products[cursor % products.length];
    cursor += 1;
    const qty = 1 + ((orderIndex + i) % 2);
    items.push({
      product_id: p.id,
      product_name: p.name,
      product_image: p.image,
      quantity: qty,
      price: Number(p.price),
      size_system: 'US',
      size_value: String(8 + ((orderIndex + i) % 5)),
    });
  }
  return items;
}

function usePoolerMode(url) {
  if (process.env.DB_USE_POOLER === 'true') return true;
  try {
    const parsed = new URL(url.replace(/^postgres(ql)?:\/\//, 'http://'));
    return parsed.hostname.includes('pooler') || parsed.port === '6543';
  } catch {
    return url.includes('pooler') || url.includes(':6543');
  }
}

const sql = postgres(DATABASE_URL, {
  max: 3,
  prepare: !usePoolerMode(DATABASE_URL),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function cleanup() {
  const emails = CUSTOMERS.map((c) => c.email.toLowerCase());
  const orderRows = await sql`
    SELECT id FROM orders WHERE order_number LIKE ${`${ORDER_PREFIX}%`}
  `;
  const orderIds = orderRows.map((r) => r.id);
  if (orderIds.length > 0) {
    await sql`DELETE FROM order_line_items WHERE order_id = ANY(${orderIds}::uuid[])`;
    await sql`DELETE FROM coupon_usage WHERE order_id = ANY(${orderIds}::uuid[])`;
    await sql`DELETE FROM orders WHERE id = ANY(${orderIds}::uuid[])`;
  }
  await sql`DELETE FROM customers WHERE email = ANY(${emails})`;
}

async function loadProducts() {
  const rows = await sql`
    SELECT id, name, price, image FROM products ORDER BY id ASC LIMIT 10
  `;
  if (rows.length === 0) {
    throw new Error('No products in database. Run schema.sql + seed.sql (or create products) first.');
  }
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    price: Number(r.price),
    image: r.image ? String(r.image) : null,
  }));
}

async function seedCustomers(now) {
  for (const c of CUSTOMERS) {
    const id = stableUuid(`customer:${c.key}`);
    const createdAt = atOffset({ daysAgo: 600, hours: 10 });
    await sql`
      INSERT INTO customers (
        id, email, name, phone, total_orders, total_spent,
        last_order_date, first_order_date, addresses, admin_notes,
        is_deleted, created_at, updated_at
      ) VALUES (
        ${id}::uuid,
        ${c.email.toLowerCase()},
        ${c.name},
        ${c.phone},
        0,
        0,
        NULL,
        NULL,
        ${sql.json(addressBook(c))},
        ${c.adminNotes ?? null},
        FALSE,
        ${createdAt},
        ${now}
      )
    `;
  }
}

async function seedOrders(products) {
  const couponRow = await sql`
    SELECT id, code FROM coupons WHERE code = 'LDCOFF10' AND is_active = TRUE LIMIT 1
  `;
  const couponId = couponRow[0]?.id ?? null;
  const couponCode = couponRow[0]?.code ?? 'LDCOFF10';

  for (const spec of ORDER_SPECS) {
    const customer = customerByKey[spec.customer];
    const createdAt = atOffset({ daysAgo: spec.daysAgo, hours: spec.hours });
    const updatedAt = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000);
    const orderId = stableUuid(`order:${spec.n}`);
    const orderNumber = `${ORDER_PREFIX}${String(spec.n).padStart(2, '0')}`;

    const lineItems = pickLineItems(products, spec.lines, spec.n);
    const itemCount = lineItems.reduce((s, li) => s + li.quantity, 0);
    const subtotalRaw = lineItems.reduce((s, li) => s + li.price * li.quantity, 0);
    const couponDiscount =
      spec.coupon && couponId ? roundMoney(subtotalRaw * 0.1) : 0;
    const pricing = pricingFromSubtotal(subtotalRaw, itemCount, couponDiscount);

    const paymentId =
      spec.payment === 'completed' ? `WA-PAY-TEST-${spec.n}` : null;

    await sql`
      INSERT INTO orders (
        id, order_number, customer_email, customer_name, shipping_address,
        items, subtotal, shipping_cost, tax, total,
        payment_status, payment_method, payment_id,
        status, tracking_number, carrier, estimated_delivery, delivered_at,
        admin_notes, created_at, updated_at
      ) VALUES (
        ${orderId}::uuid,
        ${orderNumber},
        ${customer.email.toLowerCase()},
        ${customer.name},
        ${sql.json(shippingJson(customer))},
        ${sql.json(lineItems)},
        ${pricing.subtotal},
        ${pricing.shipping},
        ${pricing.tax},
        ${pricing.total},
        ${spec.payment},
        'WhatsApp',
        ${paymentId},
        ${spec.status},
        ${spec.tracking ?? null},
        ${spec.tracking ? 'Blue Dart' : null},
        ${spec.tracking ? createdAt.toISOString().slice(0, 10) : null},
        ${spec.delivered ? updatedAt : null},
        ${spec.adminNotes ?? (pricing.discount > 0 ? `Seed discount $${pricing.discount.toFixed(2)}${spec.coupon ? ` (${couponCode})` : ' (volume)'}` : null)},
        ${createdAt},
        ${updatedAt}
      )
    `;

    if (spec.payment === 'completed') {
      for (const item of lineItems) {
        const unitPrice = item.price;
        const qty = item.quantity;
        await sql`
          INSERT INTO order_line_items (
            order_id, product_id, product_name, quantity, unit_price, line_total,
            size, created_at
          ) VALUES (
            ${orderId}::uuid,
            ${item.product_id},
            ${item.product_name},
            ${qty},
            ${unitPrice},
            ${roundMoney(unitPrice * qty)},
            ${`US ${item.size_value}`},
            ${createdAt}
          )
        `;
      }

      if (spec.coupon && couponId) {
        await sql`
          INSERT INTO coupon_usage (coupon_id, order_id, customer_email, discount_amount)
          VALUES (${couponId}::uuid, ${orderId}::uuid, ${customer.email.toLowerCase()}, ${couponDiscount})
        `;
      }
    }
  }
}

async function recomputeCustomerAggregates() {
  const emails = CUSTOMERS.map((c) => c.email.toLowerCase());
  await sql`
    UPDATE customers c SET
      total_orders = COALESCE(agg.order_count, 0),
      total_spent = COALESCE(agg.total_spent, 0),
      last_order_date = agg.last_order_date,
      first_order_date = agg.first_order_date,
      updated_at = NOW()
    FROM (
      SELECT
        LOWER(customer_email) AS email,
        COUNT(*)::int AS order_count,
        COALESCE(SUM(total), 0)::decimal AS total_spent,
        MAX(created_at) AS last_order_date,
        MIN(created_at) AS first_order_date
      FROM orders
      WHERE payment_status = 'completed'
        AND LOWER(customer_email) = ANY(${emails})
      GROUP BY LOWER(customer_email)
    ) agg
    WHERE LOWER(c.email) = agg.email
  `;

  await sql`
    UPDATE customers c SET
      total_orders = 0,
      total_spent = 0,
      last_order_date = NULL,
      first_order_date = NULL,
      updated_at = NOW()
    WHERE LOWER(c.email) = ANY(${CUSTOMERS.map((x) => x.email.toLowerCase())})
      AND NOT EXISTS (
        SELECT 1 FROM orders o
        WHERE LOWER(o.customer_email) = LOWER(c.email)
          AND o.payment_status = 'completed'
      )
  `;
}

async function verify() {
  const emails = CUSTOMERS.map((c) => c.email.toLowerCase());
  const [customerCount] = await sql`
    SELECT COUNT(*)::int AS c FROM customers WHERE email = ANY(${emails})
  `;
  const [orderCount] = await sql`
    SELECT COUNT(*)::int AS c FROM orders WHERE order_number LIKE ${`${ORDER_PREFIX}%`}
  `;
  const badNames = await sql`
    SELECT email, name FROM customers
    WHERE email = ANY(${emails})
      AND name NOT ILIKE '%test%'
  `;
  const badEmails = await sql`
    SELECT email FROM customers
    WHERE email = ANY(${emails})
      AND email NOT ILIKE '%test%'
  `;

  const statusMix = await sql`
    SELECT status, COUNT(*)::int AS c
    FROM orders WHERE order_number LIKE ${`${ORDER_PREFIX}%`}
    GROUP BY status ORDER BY status
  `;
  const paymentMix = await sql`
    SELECT payment_status, COUNT(*)::int AS c
    FROM orders WHERE order_number LIKE ${`${ORDER_PREFIX}%`}
    GROUP BY payment_status ORDER BY payment_status
  `;

  console.log('\n── Verification ──');
  console.log(`Customers: ${customerCount.c} (expected 10)`);
  console.log(`Orders:    ${orderCount.c} (expected 20)`);
  console.log('Status mix:', Object.fromEntries(statusMix.map((r) => [r.status, r.c])));
  console.log('Payment mix:', Object.fromEntries(paymentMix.map((r) => [r.payment_status, r.c])));

  const expectedStatus = { pending: 4, processing: 4, shipped: 4, delivered: 6, cancelled: 2 };
  const statusOk = Object.entries(expectedStatus).every(([k, v]) => {
    const row = statusMix.find((r) => r.status === k);
    return row && row.c === v;
  });

  const ok =
    customerCount.c === 10 &&
    orderCount.c === 20 &&
    badNames.length === 0 &&
    badEmails.length === 0 &&
    statusOk;

  if (!ok) {
    if (badNames.length) console.error('Names missing "Test":', badNames);
    if (badEmails.length) console.error('Emails missing "test":', badEmails);
    if (!statusOk) console.error('Unexpected status mix (expected)', expectedStatus);
    throw new Error('Seed verification failed');
  }
  console.log('All checks passed. Filter admin lists with "test" or order prefix GSS-TEST-SEED-.');
}

async function main() {
  console.log('Lab Door Customs — test data seed (idempotent)');
  const products = await loadProducts();
  console.log(`Found ${products.length} catalog product(s)`);

  await cleanup();
  const now = new Date();
  await seedCustomers(now);
  await seedOrders(products);
  await recomputeCustomerAggregates();
  await verify();
}

main()
  .catch((err) => {
    console.error('Seed failed:', err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
