import sql, { withRetry } from './db';

function analyticsQuery<T>(label: string, queryFn: () => Promise<T>): Promise<T> {
  return withRetry(queryFn, { retries: 2, baseMs: 500, label: `adminAnalytics:${label}` });
}

export async function fetchAdminAnalytics() {
  const [
    orderStats,
    orderStats30d,
    customerStats,
    customerStats30d,
    productStats,
    topViewed,
    topCarted,
    countrySummary,
    recentOrders,
    dailyTrend,
    messageStats,
  ] = await Promise.all([
    analyticsQuery('order_stats', () => sql`
      SELECT
        COUNT(*)::int AS total_orders,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN total ELSE 0 END), 0)::float AS total_revenue
      FROM orders
    `),
    analyticsQuery('order_stats_30d', () => sql`
      SELECT
        COUNT(*)::int AS orders_last_30_days,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN total ELSE 0 END), 0)::float AS revenue_last_30_days
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `),
    analyticsQuery('customer_stats', () => sql`
      SELECT COUNT(*)::int AS total_customers FROM customers WHERE is_deleted = false OR is_deleted IS NULL
    `),
    analyticsQuery('customer_stats_30d', () => sql`
      SELECT COUNT(*)::int AS new_customers_30_days
      FROM customers
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND (is_deleted = false OR is_deleted IS NULL)
    `),
    analyticsQuery('product_stats', () => sql`
      SELECT
        COUNT(*)::int AS total_products,
        COUNT(*) FILTER (WHERE is_out_of_stock = true OR stock <= 0)::int AS out_of_stock_products,
        COALESCE(SUM(view_count), 0)::int AS total_views,
        COALESCE(SUM(cart_count), 0)::int AS total_cart_adds
      FROM products
    `),
    analyticsQuery('top_viewed', () => sql`
      SELECT id, name, COALESCE(view_count, 0)::int AS view_count
      FROM products
      ORDER BY view_count DESC NULLS LAST, id ASC
      LIMIT 5
    `),
    analyticsQuery('top_carted', () => sql`
      SELECT id, name, COALESCE(cart_count, 0)::int AS cart_count
      FROM products
      ORDER BY cart_count DESC NULLS LAST, id ASC
      LIMIT 5
    `),
    analyticsQuery('country_summary', () => sql`
      SELECT
        COALESCE(shipping_address->>'country', 'Unknown') AS country,
        COUNT(*)::int AS order_count,
        COALESCE(SUM(total), 0)::float AS total_revenue
      FROM orders
      WHERE payment_status = 'completed'
      GROUP BY 1
      ORDER BY order_count DESC
      LIMIT 12
    `),
    analyticsQuery('recent_orders', () => sql`
      SELECT id, order_number, customer_name, customer_email, total, status, payment_status, created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 8
    `),
    analyticsQuery('daily_trend', () => sql`
      SELECT
        DATE(created_at) AS date,
        COUNT(*)::int AS orders,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN total ELSE 0 END), 0)::float AS revenue
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `),
    analyticsQuery('message_stats', () => sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'new')::int AS new,
        COUNT(*) FILTER (WHERE status = 'read')::int AS read,
        COUNT(*) FILTER (WHERE status = 'replied')::int AS replied,
        COUNT(*) FILTER (WHERE status = 'archived')::int AS archived
      FROM contact_messages
    `),
  ]);

  const ga4Id = process.env.VITE_GA4_MEASUREMENT_ID?.trim() || null;
  const siteUrl = process.env.VITE_SITE_URL?.trim() || process.env.FRONTEND_URL?.trim() || null;

  return {
    orders: {
      total_orders: orderStats[0]?.total_orders ?? 0,
      total_revenue: parseFloat(String(orderStats[0]?.total_revenue ?? 0)),
      orders_last_30_days: orderStats30d[0]?.orders_last_30_days ?? 0,
      revenue_last_30_days: parseFloat(String(orderStats30d[0]?.revenue_last_30_days ?? 0)),
    },
    customers: {
      total_customers: customerStats[0]?.total_customers ?? 0,
      new_customers_30_days: customerStats30d[0]?.new_customers_30_days ?? 0,
    },
    products: {
      total_products: productStats[0]?.total_products ?? 0,
      out_of_stock_products: productStats[0]?.out_of_stock_products ?? 0,
      total_views: productStats[0]?.total_views ?? 0,
      total_cart_adds: productStats[0]?.total_cart_adds ?? 0,
    },
    topViewedProducts: topViewed,
    topCartedProducts: topCarted,
    countrySummary,
    customerLocations: countrySummary,
    recentOrders,
    dailyTrend,
    messages: messageStats[0] ?? { total: 0, new: 0, read: 0, replied: 0, archived: 0 },
    integrations: {
      ga4: {
        configured: Boolean(ga4Id),
        measurementId: ga4Id,
        consoleUrl: ga4Id ? 'https://analytics.google.com/' : null,
      },
      searchConsole: {
        configured: Boolean(siteUrl),
        siteUrl,
        consoleUrl: siteUrl ? 'https://search.google.com/search-console' : null,
      },
    },
  };
}
