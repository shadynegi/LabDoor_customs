// backend/src/routes/admin.ts - Admin authentication and management
import { Router, Request, Response, NextFunction } from 'express';
import sql, { runInChunks } from '../lib/db';
import { invalidateProductCaches } from '../lib/cacheKeys';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const router = Router();

// Bcrypt configuration
const BCRYPT_ROUNDS = 12; // Cost factor for hashing

// Validate JWT secret with complexity requirements
const validateJwtSecretComplexity = (secret: string): { valid: boolean; issues: string[] } => {
  const issues: string[] = [];
  
  if (secret.length < 32) {
    issues.push('Must be at least 32 characters long');
  }
  if (!/[A-Z]/.test(secret)) {
    issues.push('Must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(secret)) {
    issues.push('Must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(secret)) {
    issues.push('Must contain at least one number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(secret)) {
    issues.push('Must contain at least one special character');
  }
  
  return { valid: issues.length === 0, issues };
};

// Validate required environment variables
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('ERROR: JWT_SECRET must be set');
    throw new Error('Invalid JWT_SECRET configuration');
  }
  
  const validation = validateJwtSecretComplexity(secret);
  if (!validation.valid) {
    console.error('ERROR: JWT_SECRET does not meet complexity requirements:');
    validation.issues.forEach(issue => console.error(`  - ${issue}`));
    console.error('Generate a secure secret with: openssl rand -base64 48');
    throw new Error('Invalid JWT_SECRET configuration');
  }
  
  return secret;
};

const getAdminCredentials = (): { username: string; passwordHash: string; plainPassword?: string } => {
  const username = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const plainPassword = process.env.ADMIN_PASSWORD; // Fallback for migration
  
  if (!username) {
    console.error('ERROR: ADMIN_USERNAME must be set');
    throw new Error('Invalid admin credentials configuration');
  }
  
  if (!passwordHash && !plainPassword) {
    console.error('ERROR: Either ADMIN_PASSWORD_HASH or ADMIN_PASSWORD must be set');
    throw new Error('Invalid admin credentials configuration');
  }
  
  // Warn if using plaintext password (insecure)
  if (!passwordHash && plainPassword) {
    console.warn('⚠️  WARNING: Using plaintext ADMIN_PASSWORD. Generate a hash using /api/admin/generate-hash for better security.');
  }
  
  return { username, passwordHash: passwordHash || '', plainPassword };
};

// Utility function to generate password hash (for setup)
const generatePasswordHash = async (password: string): Promise<string> => {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

// Verify password against hash or plaintext (for migration)
const verifyPassword = async (password: string, credentials: ReturnType<typeof getAdminCredentials>): Promise<boolean> => {
  // If hash is available, use bcrypt compare
  if (credentials.passwordHash) {
    return bcrypt.compare(password, credentials.passwordHash);
  }
  
  // Fallback to plaintext comparison (insecure, for migration)
  if (credentials.plainPassword) {
    return password === credentials.plainPassword;
  }
  
  return false;
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
      console.log(`🧹 Cleaned up ${deleted} expired admin session(s)`);
    }
    return { deleted };
  } catch (error) {
    console.error('Session cleanup error:', error);
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
    console.error('User session cleanup error:', error);
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

// Verify token
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

// Middleware to verify admin authentication
export const verifyAdmin = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'No authentication token provided',
    });
  }

  const token = authHeader.substring(7);
  const result = verifyToken(token);

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

    const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
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

    // Clean up expired sessions (runs on each login)
    await cleanupExpiredSessions();
    
    // Clean up old sessions for this user (keep only 5 most recent)
    await cleanupUserSessions(username, 5);

    // Store session in database
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await sql`
      INSERT INTO admin_sessions (token, username, ip_address, user_agent, expires_at)
      VALUES (${token}, ${username}, ${ipAddress}, ${userAgent}, ${expiresAt})
    `.catch(() => {}); // Don't fail if session storage fails

    // Log successful login
    await sql`
      INSERT INTO activity_logs (action_type, metadata, ip_address, user_agent)
      VALUES ('admin_login_success', ${JSON.stringify({ username })}, ${ipAddress}, ${userAgent})
    `.catch(() => {});

    res.json({
      success: true,
      token,
      expiresAt: expiresAt.toISOString(),
      message: 'Login successful',
    });
  } catch (error: any) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
    });
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate hash',
    });
  }
});

// POST /admin/logout - Admin logout
router.post('/logout', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.substring(7);

    if (token) {
      await sql`DELETE FROM admin_sessions WHERE token = ${token}`.catch(() => {});
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Logout failed',
    });
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch sessions',
    });
  }
});

// POST /admin/sessions/cleanup - Manually trigger session cleanup
router.post('/sessions/cleanup', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const result = await cleanupExpiredSessions();
    
    res.json({
      success: true,
      message: `Cleaned up ${result.deleted} expired session(s)`,
      deleted: result.deleted,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Session cleanup failed',
    });
  }
});

// GET /admin/analytics - Get dashboard analytics
router.get('/analytics', verifyAdmin, async (req: Request, res: Response) => {
  try {
    // Get order statistics
    const orderStats = await sql`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total), 0) as total_revenue,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_orders,
        COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
        COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) as paid_orders,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as unpaid_orders,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as orders_last_7_days,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as orders_last_30_days,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN total END), 0) as revenue_last_7_days,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN total END), 0) as revenue_last_30_days
      FROM orders
    `;

    // Get product statistics
    const productStats = await sql`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN is_out_of_stock = true OR stock = 0 THEN 1 END) as out_of_stock_products,
        COUNT(CASE WHEN stock > 0 AND stock <= 10 THEN 1 END) as low_stock_products,
        COALESCE(SUM(view_count), 0) as total_views,
        COALESCE(SUM(cart_count), 0) as total_cart_adds
      FROM products
    `;

    // Get top viewed products
    const topViewedProducts = await sql`
      SELECT id, name, view_count, cart_count, stock, is_out_of_stock
      FROM products
      ORDER BY view_count DESC
      LIMIT 5
    `;

    // Get top carted products
    const topCartedProducts = await sql`
      SELECT id, name, view_count, cart_count, stock, is_out_of_stock
      FROM products
      ORDER BY cart_count DESC
      LIMIT 5
    `;

    // Get customer locations from orders
    const customerLocations = await sql`
      SELECT 
        shipping_address->>'country' as country,
        shipping_address->>'city' as city,
        COUNT(*) as order_count,
        COALESCE(SUM(total), 0) as total_revenue
      FROM orders
      WHERE shipping_address->>'country' IS NOT NULL
      GROUP BY shipping_address->>'country', shipping_address->>'city'
      ORDER BY order_count DESC
      LIMIT 20
    `;

    // Get country summary
    const countrySummary = await sql`
      SELECT 
        shipping_address->>'country' as country,
        COUNT(*) as order_count,
        COALESCE(SUM(total), 0) as total_revenue
      FROM orders
      WHERE shipping_address->>'country' IS NOT NULL
      GROUP BY shipping_address->>'country'
      ORDER BY order_count DESC
      LIMIT 10
    `;

    // Get recent orders
    const recentOrders = await sql`
      SELECT id, order_number, customer_name, customer_email, total, status, payment_status, created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 10
    `;

    // Get daily order trend (last 30 days)
    const dailyTrend = await sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as orders,
        COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    // Get contact message stats
    const messageStats = await sql`
      SELECT
        COUNT(*) as total_messages,
        COUNT(CASE WHEN status = 'new' THEN 1 END) as new_messages,
        COUNT(CASE WHEN status = 'read' THEN 1 END) as read_messages,
        COUNT(CASE WHEN status = 'replied' THEN 1 END) as replied_messages,
        COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived_messages
      FROM contact_messages
    `;

    // Get customer stats
    const customerStats = await sql`
      SELECT 
        COUNT(DISTINCT customer_email) as total_customers,
        COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN customer_email END) as new_customers_30_days
      FROM orders
    `;

    res.json({
      success: true,
      data: {
        orders: {
          ...orderStats[0],
          total_revenue: parseFloat(orderStats[0].total_revenue),
          revenue_last_7_days: parseFloat(orderStats[0].revenue_last_7_days),
          revenue_last_30_days: parseFloat(orderStats[0].revenue_last_30_days),
        },
        products: productStats[0],
        topViewedProducts,
        topCartedProducts,
        customerLocations,
        countrySummary,
        recentOrders: recentOrders.map((o: any) => ({
          ...o,
          total: parseFloat(o.total),
        })),
        dailyTrend: dailyTrend.map((d: any) => ({
          ...d,
          revenue: parseFloat(d.revenue),
        })),
        messages: messageStats[0],
        customers: customerStats[0],
      },
    });
  } catch (error: any) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch analytics',
    });
  }
});

// GET /admin/customers - Get customer list with history
router.get('/customers', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;

    let customers;
    if (search) {
      customers = await sql`
        SELECT 
          customer_email as email,
          MAX(customer_name) as name,
          COUNT(*) as total_orders,
          COALESCE(SUM(total), 0) as total_spent,
          MAX(created_at) as last_order_date,
          MIN(created_at) as first_order_date
        FROM orders
        WHERE customer_email ILIKE ${`%${search}%`} OR customer_name ILIKE ${`%${search}%`}
        GROUP BY customer_email
        ORDER BY total_spent DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `;
    } else {
      customers = await sql`
        SELECT 
          customer_email as email,
          MAX(customer_name) as name,
          COUNT(*) as total_orders,
          COALESCE(SUM(total), 0) as total_spent,
          MAX(created_at) as last_order_date,
          MIN(created_at) as first_order_date
        FROM orders
        GROUP BY customer_email
        ORDER BY total_spent DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `;
    }

    const countResult = await sql`
      SELECT COUNT(DISTINCT customer_email) as total FROM orders
    `;

    res.json({
      success: true,
      data: customers.map((c: any) => ({
        ...c,
        total_spent: parseFloat(c.total_spent),
      })),
      total: parseInt(countResult[0].total),
    });
  } catch (error: any) {
    console.error('Customers error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch customers',
    });
  }
});

// GET /admin/customers/:email - Get customer order history
router.get('/customers/:email', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { email } = req.params;

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
        summary: {
          ...summary[0],
          total_spent: parseFloat(summary[0].total_spent),
        },
        orders: orders.map((o: any) => ({
          ...o,
          total: parseFloat(o.total),
          subtotal: parseFloat(o.subtotal),
          shipping_cost: parseFloat(o.shipping_cost),
          tax: parseFloat(o.tax),
          items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items,
          shipping_address: typeof o.shipping_address === 'string' ? JSON.parse(o.shipping_address) : o.shipping_address,
        })),
      },
    });
  } catch (error: any) {
    console.error('Customer history error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch customer history',
    });
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
    console.error('Bulk update error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Bulk update failed',
    });
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

    const status = updates.status !== undefined ? updates.status : null;
    const paymentStatus = updates.payment_status !== undefined ? updates.payment_status : null;

    const BULK_CHUNK = 10;
    const chunkResults = await runInChunks(orderIds, BULK_CHUNK, async (chunk) =>
      sql.begin(async (txn) => {
        const rows = await txn`
          UPDATE orders SET
            status = COALESCE(${status}, status),
            payment_status = COALESCE(${paymentStatus}, payment_status),
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
    console.error('Bulk update error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Bulk update failed',
    });
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
    console.error('Bulk update error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Bulk update failed',
    });
  }
});

export default router;
