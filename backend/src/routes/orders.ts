// backend/src/routes/orders.ts
import { logger } from '../lib/logger';
import { respond500 } from '../lib/safeError';
import { Router, Request, Response } from 'express';
import sql, { query as dbQuery } from '../lib/db';
import { upsertCustomerFromOrder } from '../lib/customers';
import { emailService } from '../lib/email';
import { parsePagination, paginationMeta } from '../lib/pagination';
import {
  stripOrderSecrets,
} from '../lib/orderTokens';
import { isAdminAuthenticated, verifyAdmin } from './admin';
import { restoreInventoryTransactional } from '../lib/inventory';
import { cancelPendingOrderAndRestoreStock } from '../lib/orderLifecycle';
import { PAID_ORDER_CANCEL_DISABLED_MESSAGE } from '../lib/returnPolicy';
import { getClientIp } from '../lib/clientIp';
import { validateStatusTransition, type OrderStatus } from '../lib/orderStatus';
import { patchOrderCustomerDetails, patchPendingOrderItems } from '../lib/adminOrderEdits';
import type { ValidatedLineItem } from '../lib/orderLifecycle';
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

function orderLookupDenied(res: Response) {
  return res.status(404).json({
    success: false,
    error: 'Order not found',
  });
}

function isValidOrderId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
  throw new Error('Direct inventory decrement is deprecated; use checkout place-order flow');
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

// POST create new order — deprecated; storefront uses POST /api/checkout/place-order
router.post('/', async (_req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    error: 'Direct order creation deprecated',
    message:
      'Orders must be placed through checkout (POST /api/checkout/place-order). This endpoint no longer accepts public order submissions.',
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

    const orders = await dbQuery(() => sql`
      SELECT * FROM orders
      WHERE (${statusStr ? sql`status = ${statusStr}` : sql`TRUE`})
        AND (${paymentStatusStr ? sql`payment_status = ${paymentStatusStr}` : sql`TRUE`})
        AND (
          ${searchPattern
            ? sql`(
              order_number ILIKE ${searchPattern}
              OR customer_email ILIKE ${searchPattern}
              OR customer_name ILIKE ${searchPattern}
              OR id::text ILIKE ${searchPattern}
            )`
            : sql`TRUE`}
        )
      ORDER BY created_at DESC
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `, 'orders:q1');

    const countResult = await dbQuery(() => sql`
      SELECT COUNT(*) as count FROM orders
      WHERE (${statusStr ? sql`status = ${statusStr}` : sql`TRUE`})
        AND (${paymentStatusStr ? sql`payment_status = ${paymentStatusStr}` : sql`TRUE`})
        AND (
          ${searchPattern
            ? sql`(
              order_number ILIKE ${searchPattern}
              OR customer_email ILIKE ${searchPattern}
              OR customer_name ILIKE ${searchPattern}
              OR id::text ILIKE ${searchPattern}
            )`
            : sql`TRUE`}
        )
    `, 'orders:q2');

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
    const stats = await dbQuery(() => sql`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total), 0) as total_revenue,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) as completed_orders,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN total END), 0) as revenue_completed,
        COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN total END), 0) as revenue_pending
      FROM orders
    `, 'orders:q3');

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

// GET redeem one-time order access code — removed (use POST /lookup with orderId + email)
router.get('/access-exchange/:code', async (_req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    error: 'Tracking link format deprecated',
    message: 'Use the Track Orders page with your order ID and checkout email.',
  });
});

// POST order lookup (orderId + email in body — no access tokens)
router.post('/lookup', async (req: Request, res: Response) => {
  try {
    const { orderId, email } = req.body as {
      orderId?: string;
      email?: string;
    };

    const trimmedId = orderId?.trim() ?? '';
    const trimmedEmail = email?.trim() ?? '';

    if (!trimmedId || !trimmedEmail) {
      return res.status(400).json({
        success: false,
        error: 'orderId and email are required',
      });
    }

    if (!isValidOrderId(trimmedId)) {
      return orderLookupDenied(res);
    }

    const order = await dbQuery(() => sql`
      SELECT * FROM orders
      WHERE id = ${trimmedId}::uuid
        AND LOWER(TRIM(customer_email)) = LOWER(${trimmedEmail})
      LIMIT 1
    `, 'orders:q4');

    if (!order?.length) {
      return orderLookupDenied(res);
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

// GET order by order number (Admin only)
router.get('/number/:orderNumber', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;

    const order = await dbQuery(() => sql`
      SELECT * FROM orders 
      WHERE order_number = ${orderNumber}
      LIMIT 1
    `, 'orders:q5');

    if (!order?.length) {
      return orderLookupDenied(res);
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
        'Look up a single order using your order ID and checkout email on the Track Orders page.',
    });
  }

  try {
    const { email } = req.params;
    const parsed = parsePagination(req.query);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ success: false, error: parsed.error });
    }
    const { limit, offset } = parsed.params;

    const orders = await dbQuery(() => sql`
      SELECT * FROM orders 
      WHERE customer_email = ${email}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `, 'orders:q6');

    const parsedOrders = orders.map((order: Record<string, unknown>) => parseOrderRow(order));

    const countResult = await dbQuery(() => sql`
      SELECT COUNT(*) as total FROM orders WHERE customer_email = ${email}
    `, 'orders:q7');
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

// GET order by ID (UUID) — Admin only
router.get('/:id', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await dbQuery(() => sql`
      SELECT * FROM orders 
      WHERE id = ${id}
      LIMIT 1
    `, 'orders:q8');

    if (!order?.length) {
      return orderLookupDenied(res);
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
    const currentOrder = await dbQuery(() => sql`SELECT * FROM orders WHERE id = ${id}`, 'orders:q9');
    
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

    const result = await dbQuery(() => sql`
      UPDATE orders SET
        status = COALESCE(${updates.status || null}, status),
        tracking_number = COALESCE(${updates.tracking_number || null}, tracking_number),
        tracking_url = COALESCE(${updates.tracking_url || null}, tracking_url),
        carrier = COALESCE(${updates.carrier || null}, carrier),
        estimated_delivery = COALESCE(${updates.estimated_delivery || null}, estimated_delivery),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `, 'orders:q10');

// Parse JSON fields if they are strings
const parsedResult = parseOrderRow(result[0] as Record<string, unknown>) as Order;

    // Send shipping notification email automatically when status changes to shipped
    if (shouldSendShippingEmail && parsedResult.tracking_number) {
      try {
        const emailData = {
          customerName: parsedResult.customer_name,
          customerEmail: parsedResult.customer_email,
          orderNumber: parsedResult.order_number!,
          orderId: parsedResult.id as string,
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
    const currentOrder = await dbQuery(() => sql`SELECT * FROM orders WHERE id = ${id}`, 'orders:q11');
    
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

    const result = await dbQuery(() => sql`
      UPDATE orders SET
        status = ${status},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `, 'orders:q12');

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
          orderId: parsedResult.id as string,
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

    const currentOrder = await dbQuery(() => sql`
      SELECT payment_status, order_number, total, paypal_order_id, paypal_capture_id
      FROM orders WHERE id = ${id}
    `, 'orders:q13');
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
      if (!payment_id || String(payment_id).trim().length < 3) {
        return res.status(400).json({
          success: false,
          error: 'payment_id (payment reference) is required when marking an order paid',
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
      const failedRow = await dbQuery(() => sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`, 'orders:q14');
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

      await dbQuery(
        () =>
          sql`
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
      `,
        'orders:adminMarkPaidLog'
      ).catch((err) => logger.warn('Failed to log admin mark paid:', err));

      const parsedCompleted = parseOrderRow(completedOrder as Record<string, unknown>) as Order;
      return res.json({
        success: true,
        data: parsedCompleted,
        message: 'Payment status updated successfully',
      });
    }

    if (
      payment_status === 'completed' &&
      currentOrder[0].payment_status !== 'pending'
    ) {
      if (currentOrder[0].payment_status === 'completed') {
        const existing = await dbQuery(
          () => sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`,
          'orders:paymentStatusIdempotent'
        );
        const parsedExisting = parseOrderRow(existing[0] as Record<string, unknown>) as Order;
        return res.json({
          success: true,
          data: parsedExisting,
          message: 'Order is already marked paid',
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Only pending orders can be marked paid',
      });
    }

    if (payment_status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Only pending orders can be marked paid',
      });
    }

    const captureIdForUpdate =
      payment_status === 'completed' && payment_id
        ? String(payment_id).trim()
        : null;

    const result = await dbQuery(
      () => sql`
      UPDATE orders SET
        payment_status = ${payment_status},
        payment_id = COALESCE(${payment_id || null}, payment_id),
        paypal_capture_id = COALESCE(${captureIdForUpdate}, paypal_capture_id),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `,
      'orders:updatePaymentStatus'
    );

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
// ORDER CANCELLATION (unpaid pending only — no customer refunds)
// ============================================

// POST cancel order — unpaid pending orders only (no customer refunds)
router.post('/:id/cancel', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Get current order
    const orderResult = await dbQuery(() => sql`SELECT * FROM orders WHERE id = ${id}`, 'orders:q16');
    
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

      const pendingResult = await dbQuery(() => sql`SELECT * FROM orders WHERE id = ${id}`, 'orders:q17');
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

    return res.status(403).json({
      success: false,
      error: 'Refunds not available',
      message: PAID_ORDER_CANCEL_DISABLED_MESSAGE,
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

    const existing = await dbQuery(() => sql`
      SELECT id, payment_status FROM orders WHERE id = ${id}
    `, 'orders:q18');

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
        message: 'Completed orders cannot be deleted. Mark cancelled only if required for reconciliation.',
      });
    }

    const result = await dbQuery(() => sql`
      DELETE FROM orders 
      WHERE id = ${id}
      RETURNING id
    `, 'orders:q19');

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

    const order = await dbQuery(() => sql`
      SELECT * FROM orders WHERE id = ${id}
    `, 'orders:q20');

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
      orderId: orderData.id as string,
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

// PATCH update customer/shipping on order (Admin — does not change paid line totals)
router.patch('/:id/customer-details', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminUser = (req as { admin?: { username?: string } }).admin?.username ?? 'admin';
    const result = await patchOrderCustomerDetails(id, req.body, adminUser);

    if (!result.ok) {
      return res.status(result.status).json({ success: false, error: result.error });
    }

    const parsed = parseOrderRow(result.order);
    res.json({ success: true, data: stripOrderSecrets(parsed), message: 'Order customer details updated' });
  } catch (error: unknown) {
    logger.error('Error patching order customer details:', error);
    respond500(res, error, 'Failed to update order');
  }
});

// PATCH line items on pending unpaid orders only (Admin)
router.patch('/:id/pending-items', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { items } = req.body as { items?: ValidatedLineItem[] };
    const adminUser = (req as { admin?: { username?: string } }).admin?.username ?? 'admin';
    const result = await patchPendingOrderItems(id, items || [], adminUser);

    if (!result.ok) {
      return res.status(result.status).json({ success: false, error: result.error });
    }

    const parsed = parseOrderRow(result.order);
    res.json({ success: true, data: stripOrderSecrets(parsed), message: 'Pending order items updated' });
  } catch (error: unknown) {
    logger.error('Error patching pending order items:', error);
    respond500(res, error, 'Failed to update order items');
  }
});

export default router;

