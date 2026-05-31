// backend/src/routes/activity.ts - Activity logging for user tracking
import { logger } from '../lib/logger';
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import sql from '../lib/db';
import { parsePagination, paginationMeta } from '../lib/pagination';
import { verifyAdmin } from './admin';
import { getClientIp } from '../lib/clientIp';

// Anonymize IP address for GDPR compliance
// Uses one-way hash so IPs can be compared but not reversed
const anonymizeIp = (ip: string): string => {
  if (!ip || ip === 'unknown') return 'anonymous';
  
  // Use a daily salt so same IP produces same hash within a day (for session tracking)
  // but different hash on different days (limits long-term tracking)
  const dailySalt = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const hash = crypto.createHash('sha256')
    .update(ip + dailySalt + (process.env.IP_SALT || 'default-salt'))
    .digest('hex')
    .substring(0, 16); // Truncate for storage efficiency
  
  return `anon_${hash}`;
};

const router = Router();

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

    if (!actionType) {
      return res.status(400).json({
        success: false,
        error: 'Action type is required',
      });
    }

    // Get IP (anonymized for GDPR) and user agent
    const rawIp = getClientIp(req);
    const anonymizedIp = anonymizeIp(rawIp);
    const userAgent = req.get('user-agent') || '';

    await sql`
      INSERT INTO activity_logs (
        session_id, user_email, action_type, entity_type, entity_id, 
        entity_name, metadata, ip_address, user_agent, page_url, referrer
      ) VALUES (
        ${sessionId || null},
        ${userEmail || null},
        ${actionType},
        ${entityType || null},
        ${entityId || null},
        ${entityName || null},
        ${JSON.stringify(metadata || {})},
        ${anonymizedIp},
        ${userAgent},
        ${pageUrl || null},
        ${referrer || null}
      )
    `;

    // If it's a product view or cart add, update the product counts
    if (actionType === 'product_view' && entityId) {
      await sql`
        UPDATE products SET view_count = view_count + 1 WHERE id = ${entityId}
      `.catch(() => {});
    } else if (actionType === 'add_to_cart' && entityId) {
      await sql`
        UPDATE products SET cart_count = cart_count + 1 WHERE id = ${entityId}
      `.catch(() => {});
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Activity log error:', error);
    // Don't fail the request, just log the error
    res.json({ success: true });
  }
});

// POST /activity/batch - Log multiple activities at once
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { activities } = req.body;

    if (!activities || !Array.isArray(activities)) {
      return res.status(400).json({
        success: false,
        error: 'Activities array is required',
      });
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.get('user-agent') || '';

    // Process activities in parallel for better performance (1000+ users)
    // Limit concurrency to prevent overwhelming the database
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < activities.length; i += BATCH_SIZE) {
      batches.push(activities.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      await Promise.all(batch.map(async (activity: any) => {
        // Insert activity log
        await sql`
          INSERT INTO activity_logs (
            session_id, user_email, action_type, entity_type, entity_id, 
            entity_name, metadata, ip_address, user_agent, page_url, referrer
          ) VALUES (
            ${activity.sessionId || null},
            ${activity.userEmail || null},
            ${activity.actionType},
            ${activity.entityType || null},
            ${activity.entityId || null},
            ${activity.entityName || null},
            ${JSON.stringify(activity.metadata || {})},
            ${String(ipAddress)},
            ${userAgent},
            ${activity.pageUrl || null},
            ${activity.referrer || null}
          )
        `.catch(() => {});

        // Update product counts
        if (activity.actionType === 'product_view' && activity.entityId) {
          await sql`UPDATE products SET view_count = view_count + 1 WHERE id = ${activity.entityId}`.catch(() => {});
        } else if (activity.actionType === 'add_to_cart' && activity.entityId) {
          await sql`UPDATE products SET cart_count = cart_count + 1 WHERE id = ${activity.entityId}`.catch(() => {});
        }
      }));
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Batch activity log error:', error);
    res.json({ success: true });
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
        error: error instanceof Error ? error.message : 'Failed to export activity logs',
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
      error: error instanceof Error ? error.message : 'Failed to fetch activity logs',
    });
  }
});

// GET /activity/stats - Get activity statistics (admin only)
router.get('/stats', verifyAdmin, async (req: Request, res: Response) => {
  try {
    // Get action type breakdown
    const actionBreakdown = await sql`
      SELECT action_type, COUNT(*) as count
      FROM activity_logs
      GROUP BY action_type
      ORDER BY count DESC
    `;

    // Get daily activity (last 30 days)
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

    // Get unique sessions/users
    const uniqueStats = await sql`
      SELECT 
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(DISTINCT user_email) FILTER (WHERE user_email IS NOT NULL) as unique_users,
        COUNT(DISTINCT ip_address) as unique_ips
      FROM activity_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `;

    // Get top pages
    const topPages = await sql`
      SELECT page_url, COUNT(*) as views
      FROM activity_logs
      WHERE action_type = 'page_view' AND page_url IS NOT NULL
      GROUP BY page_url
      ORDER BY views DESC
      LIMIT 10
    `;

    // Get top products by views
    const topProductViews = await sql`
      SELECT entity_id, entity_name, COUNT(*) as views
      FROM activity_logs
      WHERE action_type = 'product_view' AND entity_id IS NOT NULL
      GROUP BY entity_id, entity_name
      ORDER BY views DESC
      LIMIT 10
    `;

    // Get top products by cart adds
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
  } catch (error: any) {
    logger.error('Activity stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch activity stats',
    });
  }
});

export default router;
