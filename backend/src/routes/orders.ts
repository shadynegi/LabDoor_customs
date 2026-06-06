// backend/src/routes/orders.ts
import { logger } from '../lib/logger';
import { respond500 } from '../lib/safeError';
import { Router, Request, Response } from 'express';
import sql from '../lib/db';
import { upsertCustomerFromOrder } from '../lib/customers';
import { emailService } from '../lib/email';
import { parsePagination, paginationMeta } from '../lib/pagination';
import {
  getOrderAccessTokenFromRequest,
  orderAccessMatches,
  stripOrderSecrets,
} from '../lib/orderTokens';
import { isAdminAuthenticated, verifyAdmin } from './admin';
import { restoreInventoryTransactional } from '../lib/inventory';
import { cancelPendingOrderAndRestoreStock } from '../lib/orderLifecycle';
import { refundPayPalCapture } from '../lib/paypalRefund';
import { syncOrderAfterRefund, isOrderFullyRefunded } from '../lib/refundSync';
import { buildPayPalRefundDedupeKey } from '../lib/refundIdempotency';
import { getClientIp } from '../lib/clientIp';
import { validateStatusTransition, type OrderStatus } from '../lib/orderStatus';
import { verifyPayPalCaptureForOrder } from '../lib/paypalCaptureVerify';
import { redeemOrderAccessExchangeCode } from '../lib/orderAccessExchange';
import { completeOrderPaymentCapture } from '../lib/paymentReconciliation';
import { sendPostCaptureNotifications } from '../lib/postPaymentCapture';

const router = Router();

function parseOrderRow(order: Record<string, unknown>) {
  return stripOrderSecrets({
    ...order,
    items: typeof order.items === 'string' ? JSON.parse(order.items as string) : order.items,
    shipping_address:
      typeof order.shipping_address === 'string'
        ? JSON.parse(order.shipping_address as string)
        : order.shipping_address,
  });
}

function unauthorizedOrderAccess(res: Response, message?: string) {
  return res.status(401).json({
    success: false,
    error: 'Token required',
    message:
      message ||
      'Provide the access token via X-Order-Access-Token header or use the tracking link from your confirmation email.',
  });
}

function forbiddenOrderAccess(res: Response) {
  return res.status(401).json({
    success: false,
    error: 'Invalid access token',
    message: 'The access token does not match this order.',
  });
}

// ============================================
// INVENTORY MANAGEMENT
// ============================================

interface StockItem {
  product_id: number;
  quantity: number;
  product_name?: string;
}

/**
 * @deprecated Use restoreInventoryTransactional from lib/inventory.ts
 */
async function updateInventory(items: StockItem[], operation: 'decrement' | 'restore'): Promise<void> {
  if (operation === 'restore') {
    await restoreInventoryTransactional(items);
    return;
  }
  throw new Error('Direct inventory decrement is deprecated; use PayPal checkout flow');
}

// Types
interface OrderItem {
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  size_system?: string;
  size_value?: string;
}

interface ShippingAddress {
  full_name: string;
  email: string;
  phone?: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
}

interface Order {
  id?: string;
  order_number?: string;
  customer_email: string;
  customer_name: string;
  shipping_address: ShippingAddress;
  items: OrderItem[];
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total: number;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method: string;
  payment_id?: string;
  paypal_order_id?: string;
  paypal_capture_id?: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  tracking_number?: string;
  tracking_url?: string;
  carrier?: string;
  estimated_delivery?: string;
  delivered_at?: string;
  created_at?: string;
  updated_at?: string;
}

// POST create new order — deprecated; storefront uses PayPal checkout only
router.post('/', async (_req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    error: 'Direct order creation deprecated',
    message:
      'Orders must be placed through PayPal checkout (POST /api/paypal/create-payment). This endpoint no longer accepts public order submissions.',
  });
});

// GET all orders (Admin only)
router.get('/', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = parsePagination(req.query);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ success: false, error: parsed.error });
    }
    const { limit: limitNum, offset: offsetNum } = parsed.params;
    const { status, payment_status, search } = req.query;

    const statusStr = status ? String(status) : null;
    const paymentStatusStr = payment_status ? String(payment_status) : null;
    const searchRaw = String(search || '').trim();
    const searchPattern = searchRaw ? `%${searchRaw}%` : null;

    const orders = await sql`
      SELECT * FROM orders
      WHERE (${statusStr ? sql`status = ${statusStr}` : sql`TRUE`})
        AND (${paymentStatusStr ? sql`payment_status = ${paymentStatusStr}` : sql`TRUE`})
        AND (
          ${searchPattern
            ? sql`(
              order_number ILIKE ${searchPattern}
              OR customer_email ILIKE ${searchPattern}
              OR customer_name ILIKE ${searchPattern}
            )`
            : sql`TRUE`}
        )
      ORDER BY created_at DESC
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;

    const countResult = await sql`
      SELECT COUNT(*) as count FROM orders
      WHERE (${statusStr ? sql`status = ${statusStr}` : sql`TRUE`})
        AND (${paymentStatusStr ? sql`payment_status = ${paymentStatusStr}` : sql`TRUE`})
        AND (
          ${searchPattern
            ? sql`(
              order_number ILIKE ${searchPattern}
              OR customer_email ILIKE ${searchPattern}
              OR customer_name ILIKE ${searchPattern}
            )`
            : sql`TRUE`}
        )
    `;

    const totalCount = Number(countResult[0].count);

    // Parse JSON fields if they are strings
    const parsedOrders = orders.map((order: Record<string, unknown>) => parseOrderRow(order));

    res.json({
      success: true,
      data: parsedOrders || [],
      count: totalCount,
      pagination: paginationMeta(totalCount, parsed.params),
    });
  } catch (error: unknown) {
    logger.error('Error fetching orders:', error);
    respond500(res, error, 'Failed to fetch orders');
  }
});

// GET order statistics (Admin dashboard) — before /:id
router.get('/stats/summary', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await sql`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total), 0) as total_revenue,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) as completed_orders,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN total END), 0) as revenue_completed,
        COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN total END), 0) as revenue_pending
      FROM orders
    `;

    const result = stats[0];

    res.json({
      success: true,
      data: {
        total_orders: parseInt(result.total_orders) || 0,
        total_revenue: parseFloat(result.total_revenue) || 0,
        pending_orders: parseInt(result.pending_orders) || 0,
        completed_orders: parseInt(result.completed_orders) || 0,
        revenue_by_status: {
          completed: parseFloat(result.revenue_completed) || 0,
          pending: parseFloat(result.revenue_pending) || 0,
        },
      },
    });
  } catch (error: unknown) {
    logger.error('Error fetching order stats:', error);
    respond500(res, error, 'Failed to fetch order statistics');
  }
});

// GET redeem one-time order access code from confirmation email (no token in URL)
router.get('/access-exchange/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const result = await redeemOrderAccessExchangeCode(code);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired tracking link',
      });
    }

    res.json({
      success: true,
      data: {
        orderNumber: result.orderNumber,
        accessToken: result.accessToken,
        serverOrderId: result.serverOrderId,
      },
    });
  } catch (error: unknown) {
    logger.error('Order access exchange error:', error);
    respond500(res, error, 'Failed to redeem tracking link');
  }
});

// POST order lookup (token in body — avoids query-string leaks)
router.post('/lookup', async (req: Request, res: Response) => {
  try {
    const { orderNumber, accessToken } = req.body as {
      orderNumber?: string;
      accessToken?: string;
    };

    if (!orderNumber?.trim() || !accessToken?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'orderNumber and accessToken are required',
      });
    }

    const order = await sql`
      SELECT * FROM orders
      WHERE order_number = ${orderNumber.trim()}
      LIMIT 1
    `;

    if (!order?.length) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (!orderAccessMatches(order[0].access_token_hash, accessToken.trim())) {
      return forbiddenOrderAccess(res);
    }

    res.json({
      success: true,
      data: parseOrderRow(order[0] as Record<string, unknown>),
    });
  } catch (error: unknown) {
    logger.error('Order lookup error:', error);
    respond500(res, error, 'Failed to lookup order');
  }
});

// GET order by order number (requires per-order access token unless admin)
router.get('/number/:orderNumber', async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const isAdmin = await isAdminAuthenticated(req);
    const accessToken = getOrderAccessTokenFromRequest(req);

    if (!isAdmin && !accessToken) {
      return unauthorizedOrderAccess(res);
    }

    const order = await sql`
      SELECT * FROM orders 
      WHERE order_number = ${orderNumber}
      LIMIT 1
    `;

    if (!order || order.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    if (!isAdmin) {
      if (!orderAccessMatches(order[0].access_token_hash, accessToken!)) {
        return forbiddenOrderAccess(res);
      }
    }

    res.json({
      success: true,
      data: parseOrderRow(order[0] as Record<string, unknown>),
    });
  } catch (error: unknown) {
    logger.error('Error fetching order:', error);
    respond500(res, error, 'Failed to fetch order');
  }
});

// GET orders by customer email — disabled for public (use order number + access token)
router.get('/customer/:email', async (req: Request, res: Response) => {
  if (!(await isAdminAuthenticated(req))) {
    return res.status(403).json({
      success: false,
      error: 'Access denied',
      message:
        'Look up a single order using your order number and access token from your confirmation email.',
    });
  }

  try {
    const { email } = req.params;
    const parsed = parsePagination(req.query);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ success: false, error: parsed.error });
    }
    const { limit, offset } = parsed.params;

    const orders = await sql`
      SELECT * FROM orders 
      WHERE customer_email = ${email}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const parsedOrders = orders.map((order: Record<string, unknown>) => parseOrderRow(order));

    const countResult = await sql`
      SELECT COUNT(*) as total FROM orders WHERE customer_email = ${email}
    `;
    const total = parseInt(countResult[0]?.total || '0');

    res.json({
      success: true,
      data: parsedOrders || [],
      count: parsedOrders?.length || 0,
      pagination: paginationMeta(total, parsed.params),
    });
  } catch (error: unknown) {
    logger.error('Error fetching customer orders:', error);
    respond500(res, error, 'Failed to fetch orders');
  }
});

// GET order by ID (UUID) — requires per-order access token unless admin
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isAdmin = await isAdminAuthenticated(req);
    const accessToken = getOrderAccessTokenFromRequest(req);

    if (!isAdmin && !accessToken) {
      return unauthorizedOrderAccess(res);
    }

    const order = await sql`
      SELECT * FROM orders 
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!order || order.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    if (!isAdmin) {
      if (!orderAccessMatches(order[0].access_token_hash, accessToken!)) {
        return forbiddenOrderAccess(res);
      }
    }

    res.json({
      success: true,
      data: parseOrderRow(order[0] as Record<string, unknown>),
    });
  } catch (error: unknown) {
    logger.error('Error fetching order:', error);
    respond500(res, error, 'Failed to fetch order');
  }
});

// PUT update order (Admin only)
router.put('/:id', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates: Partial<Order> = req.body;

    // Get current order
    const currentOrder = await sql`SELECT * FROM orders WHERE id = ${id}`;
    
    if (!currentOrder || currentOrder.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    const currentStatus = currentOrder[0].status as OrderStatus;
    const wasShipped = currentStatus === 'shipped';
    const willBeShipped = updates.status === 'shipped';
    const shouldSendShippingEmail = !wasShipped && willBeShipped;

    // Validate status transition if status is being changed
    if (updates.status && updates.status !== currentStatus) {
      const transition = validateStatusTransition(currentStatus, updates.status as OrderStatus);
      if (!transition.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status transition',
          message: transition.message,
          current_status: currentStatus,
          requested_status: updates.status,
        });
      }
    }

    if (updates.payment_status !== undefined) {
      return res.status(400).json({
        success: false,
        error: 'Payment status cannot be changed via PUT',
        message: 'Use PATCH /payment-status, cancel, or refund endpoints',
      });
    }

    const result = await sql`
      UPDATE orders SET
        status = COALESCE(${updates.status || null}, status),
        tracking_number = COALESCE(${updates.tracking_number || null}, tracking_number),
        tracking_url = COALESCE(${updates.tracking_url || null}, tracking_url),
        carrier = COALESCE(${updates.carrier || null}, carrier),
        estimated_delivery = COALESCE(${updates.estimated_delivery || null}, estimated_delivery),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

// Parse JSON fields if they are strings
const parsedResult = parseOrderRow(result[0] as Record<string, unknown>) as Order;

    // Send shipping notification email automatically when status changes to shipped
    if (shouldSendShippingEmail && parsedResult.tracking_number) {
      try {
        const emailData = {
          customerName: parsedResult.customer_name,
          customerEmail: parsedResult.customer_email,
          orderNumber: parsedResult.order_number!,
          items: parsedResult.items.map((item: any) => ({
            product_name: item.product_name,
            product_image: item.product_image || item.image,
            quantity: item.quantity,
            price: parseFloat(item.price?.toString() || '0'),
            size_value: item.size_value,
            size_system: item.size_system,
          })),
          subtotal: parseFloat(parsedResult.subtotal?.toString() || '0'),
          shipping_cost: parseFloat(parsedResult.shipping_cost?.toString() || '0'),
          tax: parseFloat(parsedResult.tax?.toString() || '0'),
          total: parseFloat(parsedResult.total?.toString() || '0'),
          shippingAddress: parsedResult.shipping_address,
          trackingNumber: parsedResult.tracking_number,
          trackingUrl: parsedResult.tracking_url || `https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=${parsedResult.tracking_number}`,
          carrier: parsedResult.carrier || 'Blue Dart',
          estimatedDelivery: parsedResult.estimated_delivery,
        };
        
        // Send email asynchronously
        emailService.sendShippingNotification(emailData)
          .then(result => {
            if (result.success) {
              logger.info('✅ Shipping notification email sent for order:', parsedResult.order_number);
            } else {
              logger.error('❌ Failed to send shipping notification email:', result.error);
            }
          })
          .catch(err => {
            logger.error('❌ Error sending shipping notification email:', err);
          });
      } catch (emailError) {
        logger.error('❌ Error preparing shipping notification email:', emailError);
      }
    }

    res.json({
      success: true,
      data: parsedResult,
      message: 'Order updated successfully',
    });
  } catch (error: unknown) {
    logger.error('Error updating order:', error);
    respond500(res, error, 'Failed to update order');
  }
});

// PATCH update order status (Admin only)
router.patch('/:id/status', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required',
      });
    }

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status value',
      });
    }

    // Get current order
    const currentOrder = await sql`SELECT * FROM orders WHERE id = ${id}`;
    
    if (!currentOrder || currentOrder.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    const currentStatus = currentOrder[0].status as OrderStatus;
    
    // Validate status transition
    const transition = validateStatusTransition(currentStatus, status as OrderStatus);
    if (!transition.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status transition',
        message: transition.message,
        current_status: currentStatus,
        requested_status: status,
      });
    }

    const wasShipped = currentStatus === 'shipped';
    const willBeShipped = status === 'shipped';
    const shouldSendShippingEmail = !wasShipped && willBeShipped;

    const result = await sql`
      UPDATE orders SET
        status = ${status},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

// Parse JSON fields if they are strings
const parsedResult = parseOrderRow(result[0] as Record<string, unknown>) as Order;

    // Send shipping notification email automatically when status changes to shipped
    if (shouldSendShippingEmail && parsedResult.tracking_number) {
      try {
        const emailData = {
          customerName: parsedResult.customer_name,
          customerEmail: parsedResult.customer_email,
          orderNumber: parsedResult.order_number!,
          items: parsedResult.items.map((item: any) => ({
            product_name: item.product_name,
            product_image: item.product_image || item.image,
            quantity: item.quantity,
            price: parseFloat(item.price?.toString() || '0'),
            size_value: item.size_value,
            size_system: item.size_system,
          })),
          subtotal: parseFloat(parsedResult.subtotal?.toString() || '0'),
          shipping_cost: parseFloat(parsedResult.shipping_cost?.toString() || '0'),
          tax: parseFloat(parsedResult.tax?.toString() || '0'),
          total: parseFloat(parsedResult.total?.toString() || '0'),
          shippingAddress: parsedResult.shipping_address,
          trackingNumber: parsedResult.tracking_number,
          trackingUrl: parsedResult.tracking_url || `https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=${parsedResult.tracking_number}`,
          carrier: parsedResult.carrier || 'Blue Dart',
          estimatedDelivery: parsedResult.estimated_delivery,
        };
        
        // Send email asynchronously
        emailService.sendShippingNotification(emailData)
          .then(result => {
            if (result.success) {
              logger.info('✅ Shipping notification email sent for order:', parsedResult.order_number);
            } else {
              logger.error('❌ Failed to send shipping notification email:', result.error);
            }
          })
          .catch(err => {
            logger.error('❌ Error sending shipping notification email:', err);
          });
      } catch (emailError) {
        logger.error('❌ Error preparing shipping notification email:', emailError);
      }
    }

    res.json({
      success: true,
      data: parsedResult,
      message: 'Order status updated successfully',
    });
  } catch (error: unknown) {
    logger.error('Error updating order status:', error);
    respond500(res, error, 'Failed to update order status');
  }
});

// PATCH update payment status (Admin only)
router.patch('/:id/payment-status', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { payment_status, payment_id, admin_note } = req.body;
    const adminUser = (req as { admin?: { username?: string } }).admin?.username || 'admin';

    if (!payment_status) {
      return res.status(400).json({
        success: false,
        error: 'Payment status is required',
      });
    }

    const validStatuses = ['pending', 'completed', 'failed', 'refunded'];
    if (!validStatuses.includes(payment_status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment status value',
      });
    }

    if (payment_status === 'refunded') {
      return res.status(400).json({
        success: false,
        error: 'Use the cancel/refund flow to mark orders as refunded',
      });
    }

    const currentOrder = await sql`
      SELECT payment_status, order_number, total, paypal_order_id, paypal_capture_id
      FROM orders WHERE id = ${id}
    `;
    if (!currentOrder.length) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    if (
      payment_status === 'completed' &&
      currentOrder[0].payment_status === 'pending'
    ) {
      if (!admin_note || String(admin_note).trim().length < 3) {
        return res.status(400).json({
          success: false,
          error: 'admin_note is required (min 3 characters) when manually marking an order paid',
        });
      }
      if (!payment_id || String(payment_id).trim().length < 5) {
        return res.status(400).json({
          success: false,
          error: 'payment_id (PayPal capture ID) is required when marking an order paid',
        });
      }

      const captureId = String(payment_id).trim();
      const expectedTotal = parseFloat(String(currentOrder[0].total ?? '0'));
      const verification = await verifyPayPalCaptureForOrder(
        captureId,
        expectedTotal,
        currentOrder[0].paypal_order_id as string | null
      );
      if (!verification.ok) {
        return res.status(400).json({
          success: false,
          error: verification.error,
        });
      }
    }

    if (
      currentOrder[0].payment_status === 'completed' &&
      payment_status !== 'completed'
    ) {
      return res.status(400).json({
        success: false,
        error: 'Cannot change payment status away from completed without refund flow',
      });
    }

    if (
      payment_status === 'failed' &&
      currentOrder[0].payment_status === 'pending'
    ) {
      const restored = await cancelPendingOrderAndRestoreStock(id);
      if (!restored) {
        return res.status(409).json({
          success: false,
          error: 'Could not mark order failed — order may not be pending',
        });
      }
      const failedRow = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
      const parsedFailed = parseOrderRow(failedRow[0] as Record<string, unknown>) as Order;
      return res.json({
        success: true,
        data: parsedFailed,
        message: 'Order marked failed and inventory restored',
      });
    }

    if (
      payment_status === 'completed' &&
      currentOrder[0].payment_status === 'pending'
    ) {
      const captureId = String(payment_id).trim();
      const { updated, order: completedOrder } = await completeOrderPaymentCapture(id, captureId);

      if (!completedOrder) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      if (!updated && completedOrder.payment_status !== 'completed') {
        return res.status(409).json({
          success: false,
          error: 'Could not mark order paid',
        });
      }

      if (updated) {
        await sendPostCaptureNotifications(completedOrder);
      }

      await sql`
        INSERT INTO activity_logs (action_type, metadata, ip_address, user_agent)
        VALUES (
          'admin_mark_paid',
          ${JSON.stringify({
            order_id: id,
            order_number: currentOrder[0].order_number,
            admin: adminUser,
            admin_note: String(admin_note).trim(),
          })},
          ${getClientIp(req)},
          ${req.get('user-agent') || 'admin'}
        )
      `.catch((err) => logger.warn('Failed to log admin mark paid:', err));

      const parsedCompleted = parseOrderRow(completedOrder as Record<string, unknown>) as Order;
      return res.json({
        success: true,
        data: parsedCompleted,
        message: 'Payment status updated successfully',
      });
    }

    const captureIdForUpdate =
      payment_status === 'completed' && payment_id
        ? String(payment_id).trim()
        : null;

    const result = await sql`
      UPDATE orders SET
        payment_status = ${payment_status},
        payment_id = COALESCE(${payment_id || null}, payment_id),
        paypal_capture_id = COALESCE(${captureIdForUpdate}, paypal_capture_id),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    const parsedResult = parseOrderRow(result[0] as Record<string, unknown>) as Order;

    res.json({
      success: true,
      data: parsedResult,
      message: 'Payment status updated successfully',
    });
  } catch (error: unknown) {
    logger.error('Error updating payment status:', error);
    respond500(res, error, 'Failed to update payment status');
  }
});

// ============================================
// ORDER CANCELLATION WITH REFUND
// ============================================

// POST cancel order with optional refund
router.post('/:id/cancel', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, process_refund = true } = req.body;

    // Get current order
    const orderResult = await sql`SELECT * FROM orders WHERE id = ${id}`;
    
    if (!orderResult || orderResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    const order = orderResult[0];
    const currentStatus = order.status as OrderStatus;
    
    // Validate cancellation is allowed
    const transition = validateStatusTransition(currentStatus, 'cancelled');
    if (!transition.valid) {
      return res.status(400).json({
        success: false,
        error: 'Order cannot be cancelled',
        message: transition.message,
        current_status: currentStatus,
      });
    }

    // Parse items for inventory restoration
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

    if (order.payment_status === 'pending') {
      const cancelled = await cancelPendingOrderAndRestoreStock(id);
      if (!cancelled) {
        return res.status(409).json({
          success: false,
          error: 'Order is not in a cancellable pending state',
        });
      }

      const pendingResult = await sql`SELECT * FROM orders WHERE id = ${id}`;
      const parsedPending = {
        ...pendingResult[0],
        items,
        shipping_address:
          typeof pendingResult[0].shipping_address === 'string'
            ? JSON.parse(pendingResult[0].shipping_address)
            : pendingResult[0].shipping_address,
      };

      return res.json({
        success: true,
        data: parsedPending,
        refund: { processed: false, message: 'Pending order cancelled (no payment captured)' },
        message: 'Pending order cancelled and inventory restored',
      });
    }

    // Process PayPal refund if payment was completed and refund is requested
    let refundResult: {
      success: boolean;
      refundId?: string;
      amount?: string;
      error?: string;
    } = { success: false };

    if (
      process_refund &&
      order.payment_status === 'completed' &&
      !order.paypal_capture_id
    ) {
      return res.status(409).json({
        success: false,
        error: 'Missing PayPal capture ID',
        message:
          'This order cannot be auto-refunded. Reconcile the payment in PayPal before cancelling.',
      });
    }

    if (process_refund && order.payment_status === 'completed' && order.paypal_capture_id) {
      logger.info('Processing PayPal refund for order:', order.order_number);

      const orderTotal = parseFloat(String(order.total ?? '0'));
      const priorRefunded = parseFloat(String(order.refunded_amount ?? '0'));
      const remaining = Math.max(0, orderTotal - priorRefunded);

      refundResult = await refundPayPalCapture(
        order.paypal_capture_id,
        remaining > 0 ? remaining.toFixed(2) : undefined,
        'USD'
      );

      if (!refundResult.success) {
        logger.error('❌ Refund failed for order:', order.order_number, refundResult.error);
        return res.status(502).json({
          success: false,
          error: 'Refund failed',
          message: 'Order was not cancelled. Resolve the PayPal refund manually before retrying.',
          refund: {
            processed: false,
          },
        });
      }

      logger.info('✅ Refund processed for order:', order.order_number, 'Refund ID:', refundResult.refundId);

      const refundAmount =
        refundResult.amount ??
        (remaining > 0 ? remaining.toFixed(2) : orderTotal.toFixed(2));

      await syncOrderAfterRefund(order.paypal_capture_id, {
        fullRefund: true,
        refundAmount,
        dedupeKey: refundResult.refundId
          ? buildPayPalRefundDedupeKey(refundResult.refundId)
          : undefined,
        source: 'admin_cancel',
      });

      const orderRefunded = await isOrderFullyRefunded(id);
      if (!orderRefunded) {
        return res.status(502).json({
          success: false,
          error: 'Refund sync failed',
          message:
            'PayPal refund succeeded but the order could not be marked refunded. Reconcile manually.',
          refund: {
            processed: true,
            refundId: refundResult.refundId,
          },
        });
      }
    } else if (order.payment_status === 'completed' && !process_refund) {
      return res.status(400).json({
        success: false,
        error: 'Paid orders cannot be cancelled without processing a refund',
      });
    }

    const updateResult = await sql`
      SELECT * FROM orders WHERE id = ${id}
    `;

    if (!updateResult.length) {
      return res.status(404).json({ success: false, error: 'Order not found after refund sync' });
    }

    const parsedResult: Order = {
      ...(updateResult[0] as Order),
      items,
      shipping_address:
        typeof updateResult[0].shipping_address === 'string'
          ? JSON.parse(updateResult[0].shipping_address)
          : (updateResult[0].shipping_address as ShippingAddress),
    };

    // Send cancellation email
    try {
      emailService.sendOrderCancellation({
        customerName: parsedResult.customer_name,
        customerEmail: parsedResult.customer_email,
        orderNumber: parsedResult.order_number!,
        items: parsedResult.items.map((item: any) => ({
          product_name: item.product_name,
          product_image: item.product_image || item.image,
          quantity: item.quantity,
          price: parseFloat(item.price?.toString() || '0'),
          size_value: item.size_value,
          size_system: item.size_system,
        })),
        subtotal: parseFloat(parsedResult.subtotal?.toString() || '0'),
        shipping_cost: parseFloat(parsedResult.shipping_cost?.toString() || '0'),
        tax: parseFloat(parsedResult.tax?.toString() || '0'),
        total: parseFloat(parsedResult.total?.toString() || '0'),
        shippingAddress: parsedResult.shipping_address,
        cancellationReason: reason,
        refundProcessed: refundResult.success,
        refundId: refundResult.refundId,
      })
        .then((result) => {
          if (result.success) {
            logger.info('✅ Cancellation email sent for order:', parsedResult.order_number);
          } else {
            logger.error('❌ Failed to send cancellation email:', result.error);
          }
        })
        .catch((err) => {
          logger.error('❌ Error sending cancellation email:', err);
        });
    } catch (emailError) {
      logger.error('❌ Error sending cancellation email:', emailError);
    }

    return res.json({
      success: true,
      data: parsedResult,
      refund: {
        processed: refundResult.success,
        refund_id: refundResult.refundId,
        message: refundResult.success ? 'Refund processed successfully' : 'Refund not processed',
      },
      message: `Order cancelled successfully${refundResult.success ? ' and refund processed' : ''}`,
    });
  } catch (error: unknown) {
    logger.error('Error cancelling order:', error);
    respond500(res, error, 'Failed to cancel order');
  }
});

// DELETE order (Admin only)
router.delete('/:id', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await sql`
      SELECT id, payment_status FROM orders WHERE id = ${id}
    `;

    if (!existing.length) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    if (existing[0].payment_status === 'completed') {
      return res.status(409).json({
        success: false,
        error: 'Cannot delete a completed order',
        message: 'Cancel and refund the order before deleting it from the database.',
      });
    }

    const result = await sql`
      DELETE FROM orders 
      WHERE id = ${id}
      RETURNING id
    `;

    res.json({
      success: true,
      message: 'Order deleted successfully',
    });
  } catch (error: unknown) {
    logger.error('Error deleting order:', error);
    respond500(res, error, 'Failed to delete order');
  }
});

// POST send shipping notification (Admin only)
router.post('/:id/notify-shipped', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await sql`
      SELECT * FROM orders WHERE id = ${id}
    `;

    if (!order || order.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    const orderData = order[0];

    if (!orderData.tracking_number) {
      return res.status(400).json({
        success: false,
        error: 'Order must have tracking number before sending notification',
      });
    }

    // Parse JSON fields if they are strings
    const items = typeof orderData.items === 'string' ? JSON.parse(orderData.items) : orderData.items;
    const shippingAddress = typeof orderData.shipping_address === 'string' ? JSON.parse(orderData.shipping_address) : orderData.shipping_address;

    const emailData = {
      customerName: orderData.customer_name,
      customerEmail: orderData.customer_email,
      orderNumber: orderData.order_number,
      items: items,
      subtotal: parseFloat(orderData.subtotal),
      shipping_cost: parseFloat(orderData.shipping_cost),
      tax: parseFloat(orderData.tax),
      total: parseFloat(orderData.total),
      shippingAddress: shippingAddress,
      trackingNumber: orderData.tracking_number,
      trackingUrl: orderData.tracking_url,
      estimatedDelivery: orderData.estimated_delivery,
    };

    const result = await emailService.sendShippingNotification(emailData);

    if (result.success) {
      res.json({
        success: true,
        message: 'Shipping notification sent successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to send email',
      });
    }
  } catch (error: unknown) {
    logger.error('Error sending shipping notification:', error);
    respond500(res, error, 'Request failed');
  }
});

export default router;

