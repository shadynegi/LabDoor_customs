// backend/src/routes/activity.ts - Activity logging for user tracking
import { logger } from '../lib/logger';
import { respond500 } from '../lib/safeError';
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import sql from '../lib/db';
import { parsePagination, paginationMeta } from '../lib/pagination';
import { verifyAdmin } from './admin';
import { getClientIp } from '../lib/clientIp';
import { sanitizeActivityPayload } from '../lib/activitySanitize';
import { canBumpProductMetric } from '../lib/activityMetricLimiter';
import { getIpSalt } from '../lib/ipSalt';

const MAX_BATCH_SIZE = 20;

const ALLOWED_ACTION_TYPES = new Set([
  'page_view',
  'product_view',
  'add_to_cart',
  'remove_from_cart',
  'checkout_start',
  'checkout_complete',
  'purchase_complete',
  'search',
  'filter_apply',
  'contact_submit',
  'size_select',
  'quantity_change',
]);

// Anonymize IP address for GDPR compliance
const anonymizeIp = (ip: string): string => {
  if (!ip || ip === 'unknown') return 'anonymous';

  const dailySalt = new Date().toISOString().split('T')[0];
  const salt = getIpSalt();
  const hash = crypto.createHash('sha256')
    .update(ip + dailySalt + salt)
    .digest('hex')
    .substring(0, 16);

  return `anon_${hash}`;
};

const router = Router();

async function bumpProductMetric(actionType: string, entityId: string | number | null | undefined): Promise<void> {
  if (!entityId) return;

  const id = typeof entityId === 'string' ? parseInt(entityId, 10) : entityId;
  if (!Number.isFinite(id)) return;

  const exists = await sql`SELECT id FROM products WHERE id = ${id} LIMIT 1`;
  if (!exists.length) return;

  if (actionType === 'product_view') {
    await sql`UPDATE products SET view_count = view_count + 1 WHERE id = ${id}`.catch(() => {});
  } else if (actionType === 'add_to_cart') {
    await sql`UPDATE products SET cart_count = cart_count + 1 WHERE id = ${id}`.catch(() => {});
  }
}

// POST /activity/log - Log a user activity (public endpoint for frontend tracking)
router.post('/log', async (req: Request, res: Response) => {
  try {
    const {
      sessionId,
      userEmail,
      actionType,
      entityType,
      entityId,
      entityName,
      metadata,
      pageUrl,
      referrer,
    } = req.body;

    if (!actionType || !ALLOWED_ACTION_TYPES.has(actionType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing action type',
      });
    }

    const rawIp = getClientIp(req);
    const anonymizedIp = anonymizeIp(rawIp);
    const userAgent = req.get('user-agent') || '';
    const clean = sanitizeActivityPayload({
      sessionId,
      userEmail,
      entityType,
      entityId,
      entityName,
      metadata,
      pageUrl,
      referrer,
    });

    await sql`
      INSERT INTO activity_logs (
        session_id, user_email, action_type, entity_type, entity_id,
        entity_name, metadata, ip_address, user_agent, page_url, referrer
      ) VALUES (
        ${clean.sessionId},
        ${clean.userEmail},
        ${actionType},
        ${clean.entityType},
        ${clean.entityId},
        ${clean.entityName},
        ${clean.metadataJson},
        ${anonymizedIp},
        ${userAgent},
        ${clean.pageUrl},
        ${clean.referrer}
      )
    `;

    if (
      (actionType === 'product_view' || actionType === 'add_to_cart') &&
      clean.entityId &&
      canBumpProductMetric(rawIp, parseInt(clean.entityId, 10))
    ) {
      await bumpProductMetric(actionType, clean.entityId);
    }

    res.json({ success: true });
  } catch (error: unknown) {
    logger.error('Activity log error:', error);
    res.json({ success: true });
  }
});

// POST /activity/batch - Log multiple activities at once (CSRF-exempt; rate-limited)
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { activities } = req.body;

    if (!activities || !Array.isArray(activities)) {
      return res.status(400).json({
        success: false,
        error: 'Activities array is required',
      });
    }

    if (activities.length > MAX_BATCH_SIZE) {
      return res.status(413).json({
        success: false,
        error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}`,
      });
    }

    const rawIp = getClientIp(req);
    const anonymizedIp = anonymizeIp(rawIp);
    const userAgent = req.get('user-agent') || '';

    let inserted = 0;
    let skipped = 0;

    for (const activity of activities) {
      if (!activity?.actionType || !ALLOWED_ACTION_TYPES.has(activity.actionType)) {
        skipped += 1;
        continue;
      }

      try {
        const clean = sanitizeActivityPayload({
          sessionId: activity.sessionId,
          userEmail: activity.userEmail,
          entityType: activity.entityType,
          entityId: activity.entityId,
          entityName: activity.entityName,
          metadata: activity.metadata,
          pageUrl: activity.pageUrl,
          referrer: activity.referrer,
        });

        const rows = await sql`
          INSERT INTO activity_logs (
            session_id, user_email, action_type, entity_type, entity_id,
            entity_name, metadata, ip_address, user_agent, page_url, referrer
          ) VALUES (
            ${clean.sessionId},
            ${clean.userEmail},
            ${activity.actionType},
            ${clean.entityType},
            ${clean.entityId},
            ${clean.entityName},
            ${clean.metadataJson},
            ${anonymizedIp},
            ${userAgent},
            ${clean.pageUrl},
            ${clean.referrer}
          )
          RETURNING id
        `;
        if (rows.length) inserted += 1;

        if (
          (activity.actionType === 'product_view' || activity.actionType === 'add_to_cart') &&
          clean.entityId &&
          canBumpProductMetric(rawIp, parseInt(clean.entityId, 10))
        ) {
          await bumpProductMetric(activity.actionType, clean.entityId).catch(() => {});
        }
      } catch (itemError) {
        logger.warn('Skipped one activity in batch:', itemError);
      }
    }

    if (!res.headersSent) {
      res.json({ success: true, inserted, skipped });
    }
  } catch (error: unknown) {
    logger.error('Batch activity log error:', error);
    if (!res.headersSent) {
      respond500(res, error, 'Failed to log activity batch');
    }
  }
});

// GET /activity/export - Stream activity logs as NDJSON (admin only, postgres cursor)
router.get('/export', verifyAdmin, async (req: Request, res: Response) => {
  const { actionType, entityType, userEmail, startDate, endDate } = req.query;
  const action = actionType ? String(actionType) : null;
  const entity = entityType ? String(entityType) : null;
  const email = userEmail ? String(userEmail) : null;
  const start = startDate ? String(startDate) : null;
  const end = endDate ? String(endDate) : null;

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Content-Disposition', 'attachment; filename="activity-export.ndjson"');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const cursor = sql`
      SELECT id, session_id, user_email, action_type, entity_type, entity_id,
             entity_name, metadata, ip_address, user_agent, page_url, referrer, created_at
      FROM activity_logs
      WHERE 1=1
      ${action ? sql`AND action_type = ${action}` : sql``}
      ${entity ? sql`AND entity_type = ${entity}` : sql``}
      ${email ? sql`AND user_email = ${email}` : sql``}
      ${start ? sql`AND created_at >= ${start}::timestamptz` : sql``}
      ${end ? sql`AND created_at <= ${end}::timestamptz` : sql``}
      ORDER BY created_at DESC
    `.cursor(50);

    for await (const batch of cursor) {
      for (const row of batch) {
        res.write(`${JSON.stringify(row)}\n`);
      }
    }
    res.end();
  } catch (error: unknown) {
    logger.error('Activity export error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to export activity logs',
      });
    } else {
      res.end();
    }
  }
});

// GET /activity/logs - Get activity logs (admin only, paginated)
router.get('/logs', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = parsePagination(req.query);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ success: false, error: parsed.error });
    }
    const { limit, offset } = parsed.params;
    const { actionType, entityType, userEmail, startDate, endDate } = req.query;

    const action = actionType ? String(actionType) : null;
    const entity = entityType ? String(entityType) : null;
    const email = userEmail ? String(userEmail) : null;
    const start = startDate ? String(startDate) : null;
    const end = endDate ? String(endDate) : null;

    const [logs, countResult] = await Promise.all([
      sql`
        SELECT * FROM activity_logs
        WHERE 1=1
        ${action ? sql`AND action_type = ${action}` : sql``}
        ${entity ? sql`AND entity_type = ${entity}` : sql``}
        ${email ? sql`AND user_email = ${email}` : sql``}
        ${start ? sql`AND created_at >= ${start}::timestamptz` : sql``}
        ${end ? sql`AND created_at <= ${end}::timestamptz` : sql``}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*) as count FROM activity_logs
        WHERE 1=1
        ${action ? sql`AND action_type = ${action}` : sql``}
        ${entity ? sql`AND entity_type = ${entity}` : sql``}
        ${email ? sql`AND user_email = ${email}` : sql``}
        ${start ? sql`AND created_at >= ${start}::timestamptz` : sql``}
        ${end ? sql`AND created_at <= ${end}::timestamptz` : sql``}
      `,
    ]);

    const total = parseInt(countResult[0]?.count || '0');

    res.json({
      success: true,
      data: logs,
      total,
      pagination: paginationMeta(total, parsed.params),
    });
  } catch (error: unknown) {
    logger.error('Get activity logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity logs',
    });
  }
});

// GET /activity/stats - Get activity statistics (admin only)
router.get('/stats', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const actionBreakdown = await sql`
      SELECT action_type, COUNT(*) as count
      FROM activity_logs
      GROUP BY action_type
      ORDER BY count DESC
    `;

    const dailyActivity = await sql`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as total_actions,
        COUNT(CASE WHEN action_type = 'page_view' THEN 1 END) as page_views,
        COUNT(CASE WHEN action_type = 'product_view' THEN 1 END) as product_views,
        COUNT(CASE WHEN action_type = 'add_to_cart' THEN 1 END) as cart_adds,
        COUNT(CASE WHEN action_type = 'checkout_start' THEN 1 END) as checkout_starts,
        COUNT(CASE WHEN action_type = 'purchase_complete' THEN 1 END) as purchases
      FROM activity_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    const uniqueStats = await sql`
      SELECT
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(DISTINCT user_email) FILTER (WHERE user_email IS NOT NULL) as unique_users,
        COUNT(DISTINCT ip_address) as unique_ips
      FROM activity_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `;

    const topPages = await sql`
      SELECT page_url, COUNT(*) as views
      FROM activity_logs
      WHERE action_type = 'page_view' AND page_url IS NOT NULL
      GROUP BY page_url
      ORDER BY views DESC
      LIMIT 10
    `;

    const topProductViews = await sql`
      SELECT entity_id, entity_name, COUNT(*) as views
      FROM activity_logs
      WHERE action_type = 'product_view' AND entity_id IS NOT NULL
      GROUP BY entity_id, entity_name
      ORDER BY views DESC
      LIMIT 10
    `;

    const topProductCartAdds = await sql`
      SELECT entity_id, entity_name, COUNT(*) as cart_adds
      FROM activity_logs
      WHERE action_type = 'add_to_cart' AND entity_id IS NOT NULL
      GROUP BY entity_id, entity_name
      ORDER BY cart_adds DESC
      LIMIT 10
    `;

    res.json({
      success: true,
      data: {
        actionBreakdown,
        dailyActivity,
        uniqueStats: uniqueStats[0],
        topPages,
        topProductViews,
        topProductCartAdds,
      },
    });
  } catch (error: unknown) {
    logger.error('Activity stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity stats',
    });
  }
});

export default router;
