// backend/src/routes/admin.ts - Admin authentication and management
import { logger } from '../lib/logger';
import { Router, Request, Response, NextFunction } from 'express';
import sql, { runInChunks } from '../lib/db';
import { invalidateProductCaches } from '../lib/cacheKeys';
import { parsePagination, paginationMeta } from '../lib/pagination';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { getClientIp } from '../lib/clientIp';
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  secureCookieDefaults,
} from '../lib/cookies';
import { hashAdminSessionToken } from '../lib/adminSession';
import { validateJwtSecretComplexity } from '../lib/jwtSecret';
import { MAX_BULK_IDS, validateStatusTransition, type OrderStatus } from '../lib/orderStatus';
import { stripOrderSecrets } from '../lib/orderTokens';
import { respond500 } from '../lib/safeError';

const router = Router();

// Bcrypt configuration
const BCRYPT_ROUNDS = 12; // Cost factor for hashing

// Validate required environment variables
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    logger.error('ERROR: JWT_SECRET must be set');
    throw new Error('Invalid JWT_SECRET configuration');
  }
  
  const validation = validateJwtSecretComplexity(secret);
  if (!validation.valid) {
    logger.error('ERROR: JWT_SECRET does not meet complexity requirements:');
    validation.issues.forEach(issue => logger.error(`  - ${issue}`));
    logger.error('Generate a secure secret with: openssl rand -base64 48');
    throw new Error('Invalid JWT_SECRET configuration');
  }
  
  return secret;
};

const getAdminCredentials = (): { username: string; passwordHash: string } => {
  const username = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!username) {
    logger.error('ERROR: ADMIN_USERNAME must be set');
    throw new Error('Invalid admin credentials configuration');
  }

  if (!passwordHash) {
    logger.error('ERROR: ADMIN_PASSWORD_HASH must be set (plaintext ADMIN_PASSWORD is not allowed)');
    throw new Error('Invalid admin credentials configuration');
  }

  return { username, passwordHash };
};

// Utility function to generate password hash (for setup)
const generatePasswordHash = async (password: string): Promise<string> => {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

// Verify password against hash or plaintext (for migration)
const verifyPassword = async (password: string, credentials: ReturnType<typeof getAdminCredentials>): Promise<boolean> => {
  return bcrypt.compare(password, credentials.passwordHash);
};

// Clean up expired admin sessions
const cleanupExpiredSessions = async (): Promise<{ deleted: number }> => {
  try {
    const result = await sql`
      DELETE FROM admin_sessions 
      WHERE expires_at < NOW()
      RETURNING id
    `;
    const deleted = result.length;
    if (deleted > 0) {
      logger.info(`🧹 Cleaned up ${deleted} expired admin session(s)`);
    }
    return { deleted };
  } catch (error) {
    logger.error('Session cleanup error:', error);
    return { deleted: 0 };
  }
};

// Clean up old sessions for a specific user (keep only recent ones)
const cleanupUserSessions = async (username: string, keepCount: number = 5): Promise<void> => {
  try {
    // Delete oldest sessions, keeping only the most recent ones
    await sql`
      DELETE FROM admin_sessions 
      WHERE username = ${username}
      AND id NOT IN (
        SELECT id FROM admin_sessions 
        WHERE username = ${username}
        ORDER BY created_at DESC 
        LIMIT ${keepCount}
      )
    `;
  } catch (error) {
    logger.error('User session cleanup error:', error);
  }
};

// Simple JWT-like token generation (for simplicity, using base64 encoded JSON)
const generateToken = (username: string): string => {
  const payload = {
    username,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    iat: Date.now(),
    jti: crypto.randomUUID(),
  };
  const token = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto
    .createHmac('sha256', getJwtSecret())
    .update(token)
    .digest('hex');
  return `${token}.${signature}`;
};

// Verify token signature and expiry (does not check admin_sessions table)
const verifyToken = (token: string): { valid: boolean; username?: string } => {
  try {
    const [payloadBase64, signature] = token.split('.');
    if (!payloadBase64 || !signature) return { valid: false };

    const expectedSignature = crypto
      .createHmac('sha256', getJwtSecret())
      .update(payloadBase64)
      .digest('hex');

    if (signature !== expectedSignature) return { valid: false };

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    if (payload.exp < Date.now()) return { valid: false };

    return { valid: true, username: payload.username };
  } catch {
    return { valid: false };
  }
};

/** Validates HMAC token AND active row in admin_sessions (expires_at > NOW()). */
async function validateAdminSession(
  token: string
): Promise<{ valid: boolean; username?: string }> {
  const signatureResult = verifyToken(token);
  if (!signatureResult.valid || !signatureResult.username) {
    return { valid: false };
  }

  try {
    const tokenHash = hashAdminSessionToken(token);
    const sessions = await sql`
      SELECT username FROM admin_sessions
      WHERE token = ${tokenHash}
      AND expires_at > NOW()
      LIMIT 1
    `;

    if (!sessions || sessions.length === 0) {
      return { valid: false };
    }

    return { valid: true, username: sessions[0].username as string };
  } catch (error) {
    logger.error('Admin session validation error:', error);
    return { valid: false };
  }
}

/** Read admin session from HttpOnly cookie (preferred) or Authorization bearer (legacy). */
export function extractAdminToken(req: Request): string | null {
  const cookieToken = req.cookies?.[ADMIN_SESSION_COOKIE];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return cookieToken;
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/** Returns true when session token is valid and present in admin_sessions. */
export async function isAdminAuthenticated(req: Request): Promise<boolean> {
  const token = extractAdminToken(req);
  if (!token) return false;
  const result = await validateAdminSession(token);
  return result.valid;
}

// Middleware to verify admin authentication
export const verifyAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const token = extractAdminToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated',
    });
  }

  const result = await validateAdminSession(token);

  if (!result.valid) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }

  (req as any).admin = { username: result.username };
  next();
};

// POST /admin/login - Admin login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required',
      });
    }

    const adminCreds = getAdminCredentials();

    const ipAddress = getClientIp(req);
    const userAgent = req.get('user-agent') || 'unknown';

    // Verify username and password using bcrypt
    const isValidPassword = await verifyPassword(password, adminCreds);
    
    if (username !== adminCreds.username || !isValidPassword) {
      // Log failed login attempt
      await sql`
        INSERT INTO activity_logs (action_type, metadata, ip_address, user_agent)
        VALUES ('admin_login_failed', ${JSON.stringify({ username })}, ${ipAddress}, ${userAgent})
      `.catch(() => {}); // Don't fail if logging fails

      return res.status(401).json({
        success: false,
        error: 'Invalid username or password',
      });
    }

    const token = generateToken(username);
    const tokenHash = hashAdminSessionToken(token);

    // Clean up expired sessions (runs on each login)
    await cleanupExpiredSessions();
    
    // Clean up old sessions for this user (keep only 5 most recent)
    await cleanupUserSessions(username, 5);

    // Store session in database
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await sql`
      INSERT INTO admin_sessions (token, username, ip_address, user_agent, expires_at)
      VALUES (${tokenHash}, ${username}, ${ipAddress}, ${userAgent}, ${expiresAt})
    `;

    // Log successful login
    await sql`
      INSERT INTO activity_logs (action_type, metadata, ip_address, user_agent)
      VALUES ('admin_login_success', ${JSON.stringify({ username })}, ${ipAddress}, ${userAgent})
    `.catch(() => {});

    res.cookie(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions);

    res.json({
      success: true,
      expiresAt: expiresAt.toISOString(),
      message: 'Login successful',
    });
  } catch (error: unknown) {
    logger.error('Admin login error:', error);
    respond500(res, error, 'Request failed');
  }
});

// POST /admin/generate-hash - Generate bcrypt hash for password (for setup only)
// This endpoint should be disabled or removed in production
router.post('/generate-hash', async (req: Request, res: Response) => {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'This endpoint is disabled in production',
      });
    }

    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long',
      });
    }

    const hash = await generatePasswordHash(password);

    res.json({
      success: true,
      message: 'Password hash generated successfully',
      hash,
      instructions: [
        '1. Copy the hash value above',
        '2. Add to your .env file: ADMIN_PASSWORD_HASH=<hash>',
        '3. Remove ADMIN_PASSWORD from .env (optional but recommended)',
        '4. Restart your server',
      ],
    });
  } catch (error: unknown) {
    logger.error("Error:", error);
    respond500(res, error, 'Request failed');
  }
});

// POST /admin/logout - Admin logout
router.post('/logout', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const token = extractAdminToken(req);

    if (token) {
      const tokenHash = hashAdminSessionToken(token);
      await sql`DELETE FROM admin_sessions WHERE token = ${tokenHash}`.catch(() => {});
    }

    res.clearCookie(ADMIN_SESSION_COOKIE, {
      path: secureCookieDefaults.path,
      httpOnly: secureCookieDefaults.httpOnly,
      secure: secureCookieDefaults.secure,
      sameSite: secureCookieDefaults.sameSite,
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: unknown) {
    logger.error("Error:", error);
    respond500(res, error, 'Request failed');
  }
});

// GET /admin/verify - Verify token is valid
router.get('/verify', verifyAdmin, (req: Request, res: Response) => {
  res.json({
    success: true,
    admin: (req as any).admin,
  });
});

// GET /admin/sessions - Get active sessions info
router.get('/sessions', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const sessions = await sql`
      SELECT id, username, ip_address, user_agent, created_at, expires_at,
        CASE WHEN expires_at > NOW() THEN true ELSE false END as is_active
      FROM admin_sessions
      ORDER BY created_at DESC
      LIMIT 50
    `;

    const stats = await sql`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_sessions,
        COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_sessions
      FROM admin_sessions
    `;

    res.json({
      success: true,
      data: {
        sessions,
        stats: stats[0],
      },
    });
  } catch (error: unknown) {
    logger.error('Analytics error:', error);
    respond500(res, error, 'Failed to restore customer');
  }
});

// DELETE /admin/customers/:id — soft-delete (no hard DELETE)
router.delete('/customers/:id', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await sql`
      UPDATE customers
      SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${id}::uuid AND is_deleted = FALSE
      RETURNING id, email, is_deleted, deleted_at
    `;

    if (!result.length) {
      const existing = await sql`
        SELECT id, is_deleted FROM customers WHERE id = ${id}::uuid LIMIT 1
      `;
      if (!existing.length) {
        return res.status(404).json({ success: false, error: 'Customer not found' });
      }
      return res.status(409).json({
        success: false,
        error: 'Customer is already deleted',
      });
    }

    res.json({
      success: true,
      message: 'Customer deleted',
      data: result[0],
    });
  } catch (error: unknown) {
    logger.error('Soft-delete customer error:', error);
    respond500(res, error, 'Failed to delete customer');
  }
});

// GET /admin/customers — list from customers table (active only by default)
router.get('/customers', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = parsePagination(req.query);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ success: false, error: parsed.error });
    }
    const { limit, offset } = parsed.params;
    const { search, include_deleted } = req.query;
    const showDeleted = include_deleted === 'true';

    const searchPattern = search ? `%${String(search)}%` : null;

    const [customers, countResult] = await Promise.all([
      sql`
        SELECT id, email, name, phone, total_orders, total_spent,
               last_order_date, first_order_date, is_deleted, deleted_at, created_at
        FROM customers
        WHERE ${showDeleted ? sql`TRUE` : sql`is_deleted = FALSE`}
        ${searchPattern ? sql`AND (email ILIKE ${searchPattern} OR name ILIKE ${searchPattern})` : sql``}
        ORDER BY total_spent DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*) as total FROM customers
        WHERE ${showDeleted ? sql`TRUE` : sql`is_deleted = FALSE`}
        ${searchPattern ? sql`AND (email ILIKE ${searchPattern} OR name ILIKE ${searchPattern})` : sql``}
      `,
    ]);

    const total = parseInt(countResult[0]?.total || '0');

    res.json({
      success: true,
      data: customers.map((c) => ({
        ...c,
        total_spent: parseFloat(String(c.total_spent)),
      })),
      pagination: paginationMeta(total, parsed.params),
    });
  } catch (error: unknown) {
    logger.error('Customers error:', error);
    respond500(res, error, 'Failed to fetch customers');
  }
});

// GET /admin/customers/:email - Get customer order history
router.get('/customers/:email', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { email } = req.params;

    const customerRow = await sql`
      SELECT id, email, name, is_deleted, deleted_at
      FROM customers
      WHERE email = ${email.toLowerCase()}
      LIMIT 1
    `;

    const orders = await sql`
      SELECT *
      FROM orders
      WHERE customer_email = ${email}
      ORDER BY created_at DESC
    `;

    const summary = await sql`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total), 0) as total_spent,
        MAX(created_at) as last_order_date,
        MIN(created_at) as first_order_date
      FROM orders
      WHERE customer_email = ${email}
    `;

    res.json({
      success: true,
      data: {
        email,
        customer: customerRow[0] || null,
        summary: {
          ...summary[0],
          total_spent: parseFloat(summary[0].total_spent),
        },
        orders: orders.map((o: Record<string, unknown>) =>
          stripOrderSecrets({
            ...o,
            total: parseFloat(String(o.total)),
            subtotal: parseFloat(String(o.subtotal)),
            shipping_cost: parseFloat(String(o.shipping_cost)),
            tax: parseFloat(String(o.tax)),
            items: typeof o.items === 'string' ? JSON.parse(o.items as string) : o.items,
            shipping_address:
              typeof o.shipping_address === 'string'
                ? JSON.parse(o.shipping_address as string)
                : o.shipping_address,
          })
        ),
      },
    });
  } catch (error: any) {
    logger.error('Customer history error:', error);
    respond500(res, error, "Request failed");
  }
});

// POST /admin/products/bulk-update - Bulk update products (e.g., out of stock)
router.post('/products/bulk-update', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { productIds, updates } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Product IDs array is required',
      });
    }

    if (productIds.length > MAX_BULK_IDS) {
      return res.status(400).json({
        success: false,
        error: `Bulk update limited to ${MAX_BULK_IDS} items per request`,
      });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Updates object is required',
      });
    }

    const isOutOfStock = updates.is_out_of_stock !== undefined ? updates.is_out_of_stock : null;
    const stock = updates.stock !== undefined ? updates.stock : null;

    // Chunk large ID lists (10 per txn) — avoids oversized ANY() payloads on huge bulk jobs
    const BULK_CHUNK = 10;
    const chunkResults = await runInChunks(productIds, BULK_CHUNK, async (chunk) =>
      sql.begin(async (txn) => {
        const rows = await txn`
          UPDATE products SET
            is_out_of_stock = COALESCE(${isOutOfStock}, is_out_of_stock),
            stock = COALESCE(${stock}, stock),
            updated_at = NOW()
          WHERE id = ANY(${chunk})
          RETURNING id
        `;
        return rows;
      })
    );

    const updatedCount = chunkResults.reduce((sum, rows) => sum + rows.length, 0);
    invalidateProductCaches();

    res.json({
      success: true,
      message: `${updatedCount} products updated`,
      updatedCount,
    });
  } catch (error: any) {
    logger.error('Bulk update error:', error);
    respond500(res, error, "Request failed");
  }
});

// POST /admin/orders/bulk-update - Bulk update orders
router.post('/orders/bulk-update', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { orderIds, updates } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Order IDs array is required',
      });
    }

    if (orderIds.length > MAX_BULK_IDS) {
      return res.status(400).json({
        success: false,
        error: `Bulk update limited to ${MAX_BULK_IDS} items per request`,
      });
    }

    const status = updates.status !== undefined ? updates.status : null;
    const paymentStatus = updates.payment_status !== undefined ? updates.payment_status : null;

    if (status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Use POST /api/orders/:id/cancel for order cancellation',
      });
    }

    if (paymentStatus === 'refunded' || paymentStatus === 'failed') {
      return res.status(400).json({
        success: false,
        error: 'Payment lifecycle changes must use cancel/refund endpoints',
      });
    }

    if (paymentStatus !== undefined && paymentStatus !== null) {
      return res.status(400).json({
        success: false,
        error: 'Payment status cannot be changed via bulk update. Use PATCH /api/orders/:id/payment-status',
      });
    }

    if (status !== null) {
      const allowed: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
      if (!allowed.includes(status as OrderStatus)) {
        return res.status(400).json({ success: false, error: 'Invalid order status' });
      }

      const currentOrders = await sql`
        SELECT id, status FROM orders WHERE id = ANY(${orderIds}::uuid[])
      `;

      for (const order of currentOrders) {
        const check = validateStatusTransition(
          order.status as OrderStatus,
          status as OrderStatus
        );
        if (!check.valid) {
          return res.status(400).json({
            success: false,
            error: check.message,
            orderId: order.id,
          });
        }
      }
    }

    const BULK_CHUNK = 10;
    const chunkResults = await runInChunks(orderIds, BULK_CHUNK, async (chunk) =>
      sql.begin(async (txn) => {
        const rows = await txn`
          UPDATE orders SET
            status = COALESCE(${status}, status),
            updated_at = NOW()
          WHERE id = ANY(${chunk}::uuid[])
          RETURNING id
        `;
        return rows;
      })
    );

    const updatedCount = chunkResults.reduce((sum, rows) => sum + rows.length, 0);

    res.json({
      success: true,
      message: `${updatedCount} orders updated`,
      updatedCount,
    });
  } catch (error: any) {
    logger.error('Bulk update error:', error);
    respond500(res, error, "Request failed");
  }
});

// POST /admin/messages/bulk-update - Bulk update messages
router.post('/messages/bulk-update', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { messageIds, updates } = req.body;

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message IDs array is required',
      });
    }

    if (messageIds.length > MAX_BULK_IDS) {
      return res.status(400).json({
        success: false,
        error: `Bulk update limited to ${MAX_BULK_IDS} items per request`,
      });
    }

    const status = updates.status !== undefined ? updates.status : null;

    const BULK_CHUNK = 10;
    const chunkResults = await runInChunks(messageIds, BULK_CHUNK, async (chunk) =>
      sql.begin(async (txn) => {
        const rows = await txn`
          UPDATE contact_messages SET
            status = COALESCE(${status}, status),
            updated_at = NOW()
          WHERE id = ANY(${chunk}::uuid[])
          RETURNING id
        `;
        return rows;
      })
    );

    const updatedCount = chunkResults.reduce((sum, rows) => sum + rows.length, 0);

    res.json({
      success: true,
      message: `${updatedCount} messages updated`,
      updatedCount,
    });
  } catch (error: any) {
    logger.error('Bulk update error:', error);
    respond500(res, error, "Request failed");
  }
});

export default router;
