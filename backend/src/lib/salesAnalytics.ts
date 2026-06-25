import sql, { withRetry } from './db';
import {
  startOfIstDay,
  startOfIstDayFromYmd,
  startOfIstMonth,
  startOfIstWeek,
  startOfIstYear,
} from './analyticsIst';

export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'year' | 'all' | 'custom';

export interface AnalyticsDateRange {
  period: AnalyticsPeriod;
  from: Date;
  to: Date;
  bucket: 'hour' | 'day' | 'week' | 'month';
  compareFrom: Date;
  compareTo: Date;
}

const MS_DAY = 24 * 60 * 60 * 1000;

export function parseAnalyticsDateRange(query: Record<string, unknown>): AnalyticsDateRange {
  const period = String(query.period || 'month').toLowerCase() as AnalyticsPeriod;
  const now = new Date();
  const to = query.to ? new Date(String(query.to)) : now;
  let from: Date;
  let bucket: AnalyticsDateRange['bucket'] = 'day';

  switch (period) {
    case 'day':
      from = startOfIstDay(to);
      bucket = 'hour';
      break;
    case 'week':
      from = new Date(to.getTime() - 7 * MS_DAY);
      bucket = 'day';
      break;
    case 'year':
      from = startOfIstYear(to);
      bucket = 'month';
      break;
    case 'all':
      from = startOfIstDayFromYmd('2020-01-01');
      bucket = 'month';
      break;
    case 'custom':
      from = query.from ? new Date(String(query.from)) : new Date(to.getTime() - 30 * MS_DAY);
      bucket = 'day';
      break;
    case 'month':
    default:
      from = startOfIstMonth(to);
      bucket = 'day';
      break;
  }

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    from = startOfIstMonth(now);
  }

  const spanMs = to.getTime() - from.getTime();
  const compareTo = new Date(from.getTime());
  const compareFrom = new Date(from.getTime() - spanMs);

  return { period, from, to, bucket, compareFrom, compareTo };
}

export function analyticsCacheKey(range: AnalyticsDateRange): string {
  if (range.period === 'custom') {
    return `${range.period}:${range.from.toISOString()}:${range.to.toISOString()}`;
  }
  return range.period;
}

function salesQuery<T>(label: string, queryFn: () => Promise<T>): Promise<T> {
  return withRetry(queryFn, { retries: 2, baseMs: 500, label: `salesAnalytics:${label}` });
}

export interface SalesAnalyticsPayload {
  range: {
    period: AnalyticsPeriod;
    from: string;
    to: string;
    bucket: string;
  };
  summary: {
    total_units_sold: number;
    total_revenue: number;
    order_count: number;
    average_order_value: number;
    estimated_gross_profit: number | null;
  };
  compare: {
    total_revenue: number;
    order_count: number;
    total_units_sold: number;
    revenue_change_pct: number | null;
  };
  revenue_by_product: Array<{
    product_id: number | null;
    product_name: string;
    units_sold: number;
    revenue: number;
    revenue_share_pct: number;
    estimated_profit: number | null;
  }>;
  top_sellers_by_units: Array<{ product_id: number | null; product_name: string; units_sold: number }>;
  top_sellers_by_revenue: Array<{ product_id: number | null; product_name: string; revenue: number }>;
  category_breakdown: Array<{ category: string; units_sold: number; revenue: number }>;
  revenue_time_series: Array<{ period_start: string; orders: number; revenue: number; units_sold: number }>;
  best_period: { period_start: string; revenue: number; orders: number } | null;
}

async function aggregateFromLineItems(
  from: Date,
  to: Date,
  bucket: AnalyticsDateRange['bucket']
): Promise<{
  summary: SalesAnalyticsPayload['summary'];
  revenue_by_product: SalesAnalyticsPayload['revenue_by_product'];
  category_breakdown: SalesAnalyticsPayload['category_breakdown'];
  revenue_time_series: SalesAnalyticsPayload['revenue_time_series'];
  best_period: SalesAnalyticsPayload['best_period'];
}> {
  const trunc =
    bucket === 'hour'
      ? sql`date_trunc('hour', li.created_at)`
      : bucket === 'week'
        ? sql`date_trunc('week', li.created_at)`
        : bucket === 'month'
          ? sql`date_trunc('month', li.created_at)`
          : sql`date_trunc('day', li.created_at)`;

  const [summaryRows, productRows, categoryRows, seriesRows] = await Promise.all([
    salesQuery('summary', () => sql`
      SELECT
        COALESCE(SUM(li.quantity), 0)::int AS total_units_sold,
        COALESCE(SUM(li.line_total), 0)::float AS total_revenue,
        COUNT(DISTINCT li.order_id)::int AS order_count,
        COALESCE(SUM(
          CASE WHEN p.cost_price IS NOT NULL
            THEN li.line_total - (p.cost_price * li.quantity)
            ELSE NULL
          END
        ), 0)::float AS estimated_gross_profit
      FROM order_line_items li
      JOIN orders o ON o.id = li.order_id
      LEFT JOIN products p ON p.id = li.product_id
      WHERE o.payment_status = 'completed'
        AND li.created_at >= ${from}
        AND li.created_at <= ${to}
    `),
    salesQuery('by_product', () => sql`
      SELECT
        li.product_id,
        li.product_name,
        SUM(li.quantity)::int AS units_sold,
        SUM(li.line_total)::float AS revenue,
        COALESCE(SUM(
          CASE WHEN p.cost_price IS NOT NULL
            THEN li.line_total - (p.cost_price * li.quantity)
            ELSE NULL
          END
        ), NULL)::float AS estimated_profit
      FROM order_line_items li
      JOIN orders o ON o.id = li.order_id
      LEFT JOIN products p ON p.id = li.product_id
      WHERE o.payment_status = 'completed'
        AND li.created_at >= ${from}
        AND li.created_at <= ${to}
      GROUP BY li.product_id, li.product_name
      ORDER BY revenue DESC
      LIMIT 50
    `),
    salesQuery('by_category', () => sql`
      SELECT
        COALESCE(NULLIF(TRIM(li.category), ''), 'Uncategorized') AS category,
        SUM(li.quantity)::int AS units_sold,
        SUM(li.line_total)::float AS revenue
      FROM order_line_items li
      JOIN orders o ON o.id = li.order_id
      WHERE o.payment_status = 'completed'
        AND li.created_at >= ${from}
        AND li.created_at <= ${to}
      GROUP BY 1
      ORDER BY revenue DESC
      LIMIT 20
    `),
    salesQuery('time_series', () => sql`
      SELECT
        ${trunc} AS period_start,
        COUNT(DISTINCT li.order_id)::int AS orders,
        COALESCE(SUM(li.line_total), 0)::float AS revenue,
        COALESCE(SUM(li.quantity), 0)::int AS units_sold
      FROM order_line_items li
      JOIN orders o ON o.id = li.order_id
      WHERE o.payment_status = 'completed'
        AND li.created_at >= ${from}
        AND li.created_at <= ${to}
      GROUP BY 1
      ORDER BY 1 ASC
    `),
  ]);

  const summaryRow = summaryRows[0] ?? {};
  const totalRevenue = parseFloat(String(summaryRow.total_revenue ?? 0));
  const orderCount = Number(summaryRow.order_count ?? 0);

  const revenue_by_product = productRows.map((r) => {
    const revenue = parseFloat(String(r.revenue ?? 0));
    return {
      product_id: r.product_id != null ? Number(r.product_id) : null,
      product_name: String(r.product_name),
      units_sold: Number(r.units_sold ?? 0),
      revenue,
      revenue_share_pct: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 1000) / 10 : 0,
      estimated_profit: r.estimated_profit != null ? parseFloat(String(r.estimated_profit)) : null,
    };
  });

  const revenue_time_series = seriesRows.map((r) => ({
    period_start: new Date(r.period_start as string | Date).toISOString(),
    orders: Number(r.orders ?? 0),
    revenue: parseFloat(String(r.revenue ?? 0)),
    units_sold: Number(r.units_sold ?? 0),
  }));

  let best_period: SalesAnalyticsPayload['best_period'] = null;
  for (const row of revenue_time_series) {
    if (!best_period || row.revenue > best_period.revenue) {
      best_period = {
        period_start: row.period_start,
        revenue: row.revenue,
        orders: row.orders,
      };
    }
  }

  const profitRaw = summaryRow.estimated_gross_profit;
  const hasProfit = productRows.some((r) => r.estimated_profit != null);

  return {
    summary: {
      total_units_sold: Number(summaryRow.total_units_sold ?? 0),
      total_revenue: totalRevenue,
      order_count: orderCount,
      average_order_value: orderCount > 0 ? totalRevenue / orderCount : 0,
      estimated_gross_profit: hasProfit ? parseFloat(String(profitRaw ?? 0)) : null,
    },
    revenue_by_product,
    category_breakdown: categoryRows.map((r) => ({
      category: String(r.category),
      units_sold: Number(r.units_sold ?? 0),
      revenue: parseFloat(String(r.revenue ?? 0)),
    })),
    revenue_time_series,
    best_period,
  };
}

/** Fallback when order_line_items empty — unpack orders.items JSONB. */
async function aggregateFromOrdersJson(
  from: Date,
  to: Date,
  bucket: AnalyticsDateRange['bucket']
): Promise<ReturnType<typeof aggregateFromLineItems>> {
  const trunc =
    bucket === 'month'
      ? sql`date_trunc('month', o.created_at)`
      : bucket === 'week'
        ? sql`date_trunc('week', o.created_at)`
        : sql`date_trunc('day', o.created_at)`;

  const orderRows = await salesQuery('json_orders', () => sql`
    SELECT id, total, created_at, items
    FROM orders o
    WHERE o.payment_status = 'completed'
      AND o.created_at >= ${from}
      AND o.created_at <= ${to}
  `);

  type ProductAgg = {
    product_id: number | null;
    product_name: string;
    units_sold: number;
    revenue: number;
  };

  const byProduct = new Map<string, ProductAgg>();
  const byCategory = new Map<string, { units_sold: number; revenue: number }>();
  const byPeriod = new Map<string, { orders: number; revenue: number; units_sold: number }>();

  let totalUnits = 0;
  let totalRevenue = 0;

  for (const order of orderRows) {
    const orderTotal = parseFloat(String(order.total ?? 0));
    totalRevenue += orderTotal;
    const created = new Date(order.created_at as string | Date);
    const periodKey =
      bucket === 'month'
        ? startOfIstMonth(created).toISOString()
        : bucket === 'week'
          ? startOfIstWeek(created).toISOString()
          : startOfIstDay(created).toISOString();

    const period = byPeriod.get(periodKey) ?? { orders: 0, revenue: 0, units_sold: 0 };
    period.orders += 1;
    period.revenue += orderTotal;
    byPeriod.set(periodKey, period);

    const items =
      typeof order.items === 'string' ? JSON.parse(order.items as string) : (order.items as unknown[]) || [];

    for (const raw of items) {
      const item = raw as Record<string, unknown>;
      const qty = Number(item.quantity ?? 0);
      const price = parseFloat(String(item.price ?? 0));
      const lineTotal = qty * price;
      totalUnits += qty;
      period.units_sold += qty;

      const pid = item.product_id != null ? Number(item.product_id) : null;
      const pname = String(item.product_name ?? 'Unknown');
      const key = pid != null ? String(pid) : pname;
      const agg = byProduct.get(key) ?? { product_id: pid, product_name: pname, units_sold: 0, revenue: 0 };
      agg.units_sold += qty;
      agg.revenue += lineTotal;
      byProduct.set(key, agg);
    }
  }

  const revenue_by_product = [...byProduct.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 50)
    .map((r) => ({
      ...r,
      revenue_share_pct: totalRevenue > 0 ? Math.round((r.revenue / totalRevenue) * 1000) / 10 : 0,
      estimated_profit: null as number | null,
    }));

  const revenue_time_series = [...byPeriod.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period_start, v]) => ({
      period_start,
      orders: v.orders,
      revenue: v.revenue,
      units_sold: v.units_sold,
    }));

  let best_period: SalesAnalyticsPayload['best_period'] = null;
  for (const row of revenue_time_series) {
    if (!best_period || row.revenue > best_period.revenue) {
      best_period = { period_start: row.period_start, revenue: row.revenue, orders: row.orders };
    }
  }

  const orderCount = orderRows.length;

  return {
    summary: {
      total_units_sold: totalUnits,
      total_revenue: totalRevenue,
      order_count: orderCount,
      average_order_value: orderCount > 0 ? totalRevenue / orderCount : 0,
      estimated_gross_profit: null,
    },
    revenue_by_product,
    category_breakdown: [...byCategory.entries()].map(([category, v]) => ({
      category,
      ...v,
    })),
    revenue_time_series,
    best_period,
  };
}

export async function fetchSalesAnalytics(range: AnalyticsDateRange): Promise<SalesAnalyticsPayload> {
  const lineItemCount = await salesQuery('line_item_count', () => sql`
    SELECT COUNT(*)::int AS c FROM order_line_items LIMIT 1
  `);
  const hasLineItems = Number(lineItemCount[0]?.c ?? 0) > 0;

  const core = hasLineItems
    ? await aggregateFromLineItems(range.from, range.to, range.bucket)
    : await aggregateFromOrdersJson(range.from, range.to, range.bucket);

  const compareCore = hasLineItems
    ? await aggregateFromLineItems(range.compareFrom, range.compareTo, range.bucket)
    : await aggregateFromOrdersJson(range.compareFrom, range.compareTo, range.bucket);

  const prevRevenue = compareCore.summary.total_revenue;
  const revenueChange =
    prevRevenue > 0
      ? Math.round(((core.summary.total_revenue - prevRevenue) / prevRevenue) * 1000) / 10
      : null;

  const sortedUnits = [...core.revenue_by_product].sort((a, b) => b.units_sold - a.units_sold);
  const sortedRevenue = [...core.revenue_by_product].sort((a, b) => b.revenue - a.revenue);

  return {
    range: {
      period: range.period,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      bucket: range.bucket,
    },
    summary: core.summary,
    compare: {
      total_revenue: compareCore.summary.total_revenue,
      order_count: compareCore.summary.order_count,
      total_units_sold: compareCore.summary.total_units_sold,
      revenue_change_pct: revenueChange,
    },
    revenue_by_product: core.revenue_by_product,
    top_sellers_by_units: sortedUnits.slice(0, 10).map((r) => ({
      product_id: r.product_id,
      product_name: r.product_name,
      units_sold: r.units_sold,
    })),
    top_sellers_by_revenue: sortedRevenue.slice(0, 10).map((r) => ({
      product_id: r.product_id,
      product_name: r.product_name,
      revenue: r.revenue,
    })),
    category_breakdown: core.category_breakdown,
    revenue_time_series: core.revenue_time_series,
    best_period: core.best_period,
  };
}

export function salesAnalyticsToCsv(data: SalesAnalyticsPayload): string {
  const header = 'product_name,units_sold,revenue,revenue_share_pct\n';
  const rows = data.revenue_by_product
    .map(
      (r) =>
        `"${r.product_name.replace(/"/g, '""')}",${r.units_sold},${r.revenue.toFixed(2)},${r.revenue_share_pct}`
    )
    .join('\n');
  return header + rows;
}
