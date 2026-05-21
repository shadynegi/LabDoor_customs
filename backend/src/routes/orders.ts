// backend/src/routes/orders.ts
import { Router, Request, Response } from 'express';
import sql from '../lib/db';
import { emailService } from '../lib/email';
import { parsePagination, paginationMeta } from '../lib/pagination';
import { verifyAdmin } from './admin';
import { sanitizeOrderData, sanitizeString } from '../utils/sanitize';

const router = Router();

// ============================================
// ORDER STATUS STATE MACHINE
// ============================================
type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [], // Final state - no transitions allowed
  cancelled: [], // Final state - no transitions allowed
};

/**
 * Validate if a status transition is allowed
 */
function validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): { valid: boolean; message: string } {
  if (currentStatus === newStatus) {
    return { valid: true, message: 'Status unchanged' };
  }
  
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  
  if (allowedTransitions.includes(newStatus)) {
    return { valid: true, message: 'Valid transition' };
  }
  
  return {
    valid: false,
    message: `Cannot transition from '${currentStatus}' to '${newStatus}'. Allowed: ${allowedTransitions.length > 0 ? allowedTransitions.join(', ') : 'none (final state)'}`,
  };
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
 * Validate stock availability for all items
 * Returns { valid: true } or { valid: false, outOfStock: [...] }
 */
async function validateStock(items: StockItem[]): Promise<{ valid: boolean; outOfStock: Array<{ product_id: number; product_name: string; requested: number; available: number }> }> {
  const outOfStock: Array<{ product_id: number; product_name: string; requested: number; available: number }> = [];
  
  for (const item of items) {
    const result = await sql`
      SELECT id, name, stock, is_out_of_stock 
      FROM products 
      WHERE id = ${item.product_id}
    `;
    
    if (!result || result.length === 0) {
      outOfStock.push({
        product_id: item.product_id,
        product_name: item.product_name || 'Unknown Product',
        requested: item.quantity,
        available: 0,
      });
      continue;
    }
    
    const product = result[0];
    if (product.is_out_of_stock || product.stock < item.quantity) {
      outOfStock.push({
        product_id: item.product_id,
        product_name: product.name,
        requested: item.quantity,
        available: product.stock,
      });
    }
  }
  
  return {
    valid: outOfStock.length === 0,
    outOfStock,
  };
}

/**
 * Update inventory: decrement or restore stock
 * @param items - Array of items with product_id and quantity
 * @param operation - 'decrement' to reduce stock, 'restore' to add back
 */
async function updateInventory(items: StockItem[], operation: 'decrement' | 'restore'): Promise<void> {
  for (const item of items) {
    if (operation === 'decrement') {
      await sql`
        UPDATE products 
        SET 
          stock = GREATEST(0, stock - ${item.quantity}),
          is_out_of_stock = CASE WHEN stock - ${item.quantity} <= 0 THEN TRUE ELSE FALSE END,
          updated_at = NOW()
        WHERE id = ${item.product_id}
      `;
    } else {
      // Restore stock
      await sql`
        UPDATE products 
        SET 
          stock = stock + ${item.quantity},
          is_out_of_stock = FALSE,
          updated_at = NOW()
        WHERE id = ${item.product_id}
      `;
    }
  }
}

// ============================================
// PAYPAL REFUND HELPER
// ============================================

/**
 * Process PayPal refund for an order
 */
async function processPayPalRefund(captureId: string): Promise<{ success: boolean; refundId?: string; error?: string }> {
  try {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_SECRET;
    const mode = process.env.PAYPAL_MODE || 'sandbox';
    const baseUrl = mode === 'live' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';
    
    // Get access token
    const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });
    
    const authData = await authResponse.json() as { access_token?: string };
    if (!authData.access_token) {
      return { success: false, error: 'Failed to authenticate with PayPal' };
    }
    
    // Process refund
    const refundResponse = await fetch(`${baseUrl}/v2/payments/captures/${captureId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.access_token}`,
      },
      body: JSON.stringify({}), // Full refund
    });
    
    const refundData = await refundResponse.json() as { id?: string; status?: string; message?: string };
    
    if (refundResponse.ok && refundData.id) {
      return { success: true, refundId: refundData.id };
    }
    
    return { success: false, error: refundData.message || 'Refund failed' };
  } catch (error: any) {
    console.error('PayPal refund error:', error);
    return { success: false, error: error.message || 'Refund processing error' };
  }
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

// POST create new order
router.post('/', async (req: Request, res: Response) => {
  try {
    const orderData: Order = req.body;
    
    // Sanitize input to prevent XSS attacks
    const sanitized = sanitizeOrderData(orderData);
    orderData.customer_email = sanitized.customer_email || orderData.customer_email;
    orderData.customer_name = sanitized.customer_name || orderData.customer_name;
    if (sanitized.shipping_address) {
      orderData.shipping_address = sanitized.shipping_address;
    }

    // Detailed validation
    if (!orderData.customer_email || orderData.customer_email.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Customer email is required',
        message: 'Please provide a valid email address for order tracking',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(orderData.customer_email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
        message: 'Please provide a valid email address',
      });
    }

    if (!orderData.items || orderData.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Order items are required',
        message: 'Your cart is empty. Please add items before placing an order',
      });
    }

    if (!orderData.customer_name || orderData.customer_name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Customer name is required',
        message: 'Please provide your full name',
      });
    }

    // Validate stock availability for all items
    const stockValidation = await validateStock(
      orderData.items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        product_name: item.product_name,
      }))
    );

    if (!stockValidation.valid) {
      const outOfStockMessages = stockValidation.outOfStock.map(
        item => `${item.product_name}: requested ${item.requested}, available ${item.available}`
      );
      return res.status(400).json({
        success: false,
        error: 'Insufficient stock',
        message: `Some items are out of stock or have insufficient quantity`,
        details: {
          outOfStock: stockValidation.outOfStock,
          messages: outOfStockMessages,
        },
      });
    }

    // Generate order number
    const orderNumber = `GSS-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Set defaults
    const payment_status = orderData.payment_status || 'pending';
    const status = orderData.status || 'pending';

    const result = await sql`
      INSERT INTO orders (
        order_number, customer_email, customer_name, shipping_address,
        items, subtotal, shipping_cost, tax, total,
        payment_status, payment_method, payment_id,
        paypal_order_id, paypal_capture_id, status
      ) VALUES (
        ${orderNumber}, ${orderData.customer_email}, ${orderData.customer_name},
        ${JSON.stringify(orderData.shipping_address)}, ${JSON.stringify(orderData.items)},
        ${orderData.subtotal}, ${orderData.shipping_cost}, ${orderData.tax}, ${orderData.total},
        ${payment_status}, ${orderData.payment_method}, ${orderData.payment_id || null},
        ${orderData.paypal_order_id || null}, ${orderData.paypal_capture_id || null}, ${status}
      )
      RETURNING *
    `;

    // Parse JSON fields if they are strings
const dbOrder = result[0] as Order;

const parsedResult: Order = {
  ...dbOrder,
  items: typeof dbOrder.items === 'string' ? JSON.parse(dbOrder.items) : dbOrder.items,
  shipping_address: typeof dbOrder.shipping_address === 'string'
    ? JSON.parse(dbOrder.shipping_address)
    : dbOrder.shipping_address,
};

    // Update inventory - decrement stock for all ordered items
    try {
      await updateInventory(
        orderData.items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        'decrement'
      );
      console.log('✅ Inventory updated for order:', orderNumber);
    } catch (inventoryError) {
      console.error('❌ Error updating inventory:', inventoryError);
      // Log but don't fail the order - inventory can be corrected manually
    }

    // Send order confirmation email automatically
    try {
      const emailData = {
        customerName: orderData.customer_name,
        customerEmail: orderData.customer_email,
        orderNumber: orderNumber,
        items: parsedResult.items.map((item: any) => ({
          product_name: item.product_name,
          product_image: item.product_image || item.image,
          quantity: item.quantity,
          price: parseFloat(item.price?.toString() || '0'),
          size_value: item.size_value,
          size_system: item.size_system,
        })),
        subtotal: parseFloat(orderData.subtotal?.toString() || '0'),
        shipping_cost: parseFloat(orderData.shipping_cost?.toString() || '0'),
        tax: parseFloat(orderData.tax?.toString() || '0'),
        total: parseFloat(orderData.total?.toString() || '0'),
        shippingAddress: parsedResult.shipping_address,
        orderDate: new Date().toISOString(),
      };
      
      // Send email asynchronously (don't block the response)
      emailService.sendOrderConfirmation(emailData)
        .then(result => {
          if (result.success) {
            console.log('✅ Order confirmation email sent for order:', orderNumber);
          } else {
            console.error('❌ Failed to send order confirmation email:', result.error);
          }
        })
        .catch(err => {
          console.error('❌ Error sending order confirmation email:', err);
        });
    } catch (emailError) {
      console.error('❌ Error preparing order confirmation email:', emailError);
      // Don't fail the order creation if email fails
    }

    res.status(201).json({
      success: true,
      data: parsedResult,
      message: 'Order created successfully',
    });
  } catch (error: any) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      message: 'Unable to process your order. Please try again or contact support.',
    });
  }
});

// GET all orders (Admin only)
router.get('/', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = parsePagination(req.query);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ success: false, error: parsed.error });
    }
    const { limit: limitNum, offset: offsetNum } = parsed.params;
    const { status, payment_status } = req.query;

    let orders;
    let countResult;

    const statusStr = String(status || '');
    const paymentStatusStr = String(payment_status || '');

    if (status && payment_status) {
      orders = await sql`
        SELECT * FROM orders 
        WHERE status = ${statusStr} AND payment_status = ${paymentStatusStr}
        ORDER BY created_at DESC
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `;
      countResult = await sql`
        SELECT COUNT(*) as count FROM orders 
        WHERE status = ${statusStr} AND payment_status = ${paymentStatusStr}
      `;
    } else if (status) {
      orders = await sql`
        SELECT * FROM orders 
        WHERE status = ${statusStr}
        ORDER BY created_at DESC
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `;
      countResult = await sql`SELECT COUNT(*) as count FROM orders WHERE status = ${statusStr}`;
    } else if (payment_status) {
      orders = await sql`
        SELECT * FROM orders 
        WHERE payment_status = ${paymentStatusStr}
        ORDER BY created_at DESC
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `;
      countResult = await sql`SELECT COUNT(*) as count FROM orders WHERE payment_status = ${paymentStatusStr}`;
    } else {
      orders = await sql`
        SELECT * FROM orders 
        ORDER BY created_at DESC
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `;
      countResult = await sql`SELECT COUNT(*) as count FROM orders`;
    }

    const totalCount = Number(countResult[0].count);

    // Parse JSON fields if they are strings
    const parsedOrders = orders.map((order: any) => ({
      ...order,
      items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
      shipping_address: typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address,
    }));

    res.json({
      success: true,
      data: parsedOrders || [],
      count: totalCount,
      pagination: paginationMeta(totalCount, parsed.params),
    });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch orders',
    });
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
  } catch (error: any) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch order statistics',
    });
  }
});

// GET order by order number
router.get('/number/:orderNumber', async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;

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

    // Parse JSON fields if they are strings
    const parsedOrder = {
      ...order[0],
      items: typeof order[0].items === 'string' ? JSON.parse(order[0].items) : order[0].items,
      shipping_address: typeof order[0].shipping_address === 'string' ? JSON.parse(order[0].shipping_address) : order[0].shipping_address,
    };

    res.json({
      success: true,
      data: parsedOrder,
    });
  } catch (error: any) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch order',
    });
  }
});

// GET orders by customer email
router.get('/customer/:email', async (req: Request, res: Response) => {
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

    // Parse JSON fields if they are strings
    const parsedOrders = orders.map((order: any) => ({
      ...order,
      items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
      shipping_address: typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address,
    }));

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
  } catch (error: any) {
    console.error('Error fetching customer orders:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch orders',
    });
  }
});

// GET order by ID (UUID)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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

    const parsedOrder = {
      ...order[0],
      items: typeof order[0].items === 'string' ? JSON.parse(order[0].items) : order[0].items,
      shipping_address: typeof order[0].shipping_address === 'string' ? JSON.parse(order[0].shipping_address) : order[0].shipping_address,
    };

    res.json({
      success: true,
      data: parsedOrder,
    });
  } catch (error: any) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch order',
    });
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

    const result = await sql`
      UPDATE orders SET
        status = COALESCE(${updates.status || null}, status),
        tracking_number = COALESCE(${updates.tracking_number || null}, tracking_number),
        tracking_url = COALESCE(${updates.tracking_url || null}, tracking_url),
        carrier = COALESCE(${updates.carrier || null}, carrier),
        estimated_delivery = COALESCE(${updates.estimated_delivery || null}, estimated_delivery),
        payment_status = COALESCE(${updates.payment_status || null}, payment_status),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

// Parse JSON fields if they are strings
const dbOrder = result[0] as Order;

const parsedResult: Order = {
  ...dbOrder,
  items: typeof dbOrder.items === 'string' ? JSON.parse(dbOrder.items) : dbOrder.items,
  shipping_address: typeof dbOrder.shipping_address === 'string'
    ? JSON.parse(dbOrder.shipping_address)
    : dbOrder.shipping_address,
};

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
              console.log('✅ Shipping notification email sent for order:', parsedResult.order_number);
            } else {
              console.error('❌ Failed to send shipping notification email:', result.error);
            }
          })
          .catch(err => {
            console.error('❌ Error sending shipping notification email:', err);
          });
      } catch (emailError) {
        console.error('❌ Error preparing shipping notification email:', emailError);
      }
    }

    res.json({
      success: true,
      data: parsedResult,
      message: 'Order updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update order',
    });
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
const dbOrder = result[0] as Order;

const parsedResult: Order = {
  ...dbOrder,
  items: typeof dbOrder.items === 'string' ? JSON.parse(dbOrder.items) : dbOrder.items,
  shipping_address: typeof dbOrder.shipping_address === 'string'
    ? JSON.parse(dbOrder.shipping_address)
    : dbOrder.shipping_address,
};

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
              console.log('✅ Shipping notification email sent for order:', parsedResult.order_number);
            } else {
              console.error('❌ Failed to send shipping notification email:', result.error);
            }
          })
          .catch(err => {
            console.error('❌ Error sending shipping notification email:', err);
          });
      } catch (emailError) {
        console.error('❌ Error preparing shipping notification email:', emailError);
      }
    }

    res.json({
      success: true,
      data: parsedResult,
      message: 'Order status updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update order status',
    });
  }
});

// PATCH update payment status (Admin only)
router.patch('/:id/payment-status', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { payment_status, payment_id } = req.body;

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

    const result = await sql`
      UPDATE orders SET
        payment_status = ${payment_status},
        payment_id = COALESCE(${payment_id || null}, payment_id),
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
const dbOrder = result[0] as Order;

const parsedResult: Order = {
  ...dbOrder,
  items: typeof dbOrder.items === 'string' ? JSON.parse(dbOrder.items) : dbOrder.items,
  shipping_address: typeof dbOrder.shipping_address === 'string'
    ? JSON.parse(dbOrder.shipping_address)
    : dbOrder.shipping_address,
};

    res.json({
      success: true,
      data: parsedResult,
      message: 'Payment status updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating payment status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update payment status',
    });
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

    // Process PayPal refund if payment was completed and refund is requested
    let refundResult: { success: boolean; refundId?: string; error?: string } = { success: false };
    if (process_refund && order.payment_status === 'completed' && order.paypal_capture_id) {
      console.log('Processing PayPal refund for order:', order.order_number);
      refundResult = await processPayPalRefund(order.paypal_capture_id);
      
      if (!refundResult.success) {
        // Don't fail the cancellation if refund fails, but log it
        console.error('❌ Refund failed for order:', order.order_number, refundResult.error);
      } else {
        console.log('✅ Refund processed for order:', order.order_number, 'Refund ID:', refundResult.refundId);
      }
    }

    // Update order status to cancelled
    const updateResult = await sql`
      UPDATE orders SET
        status = 'cancelled',
        payment_status = ${refundResult.success ? 'refunded' : order.payment_status},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    // Restore inventory
    try {
      await updateInventory(
        items.map((item: any) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        'restore'
      );
      console.log('✅ Inventory restored for cancelled order:', order.order_number);
    } catch (inventoryError) {
      console.error('❌ Error restoring inventory:', inventoryError);
    }

// Parse result
const updatedOrder = updateResult[0] as Order;

const parsedResult: Order = {
  ...updatedOrder,
  items: typeof updatedOrder.items === 'string' ? JSON.parse(updatedOrder.items) : updatedOrder.items,
  shipping_address: typeof updatedOrder.shipping_address === 'string'
    ? JSON.parse(updatedOrder.shipping_address)
    : updatedOrder.shipping_address,
};

    // Send cancellation email
    try {
      const emailData = {
        customerName: parsedResult.customer_name,
        customerEmail: parsedResult.customer_email,
        orderNumber: parsedResult.order_number,
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
      };
      
      // TODO: Implement sendOrderCancellation email method
      console.log('📧 Cancellation notification should be sent for order:', parsedResult.order_number);
    } catch (emailError) {
      console.error('❌ Error sending cancellation email:', emailError);
    }

    res.json({
      success: true,
      data: parsedResult,
      refund: {
        processed: refundResult.success,
        refund_id: refundResult.refundId,
        message: refundResult.success ? 'Refund processed successfully' : 'Refund not processed (payment may not have been completed)',
      },
      message: `Order cancelled successfully${refundResult.success ? ' and refund processed' : ''}`,
    });
  } catch (error: any) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel order',
    });
  }
});

// DELETE order (Admin only)
router.delete('/:id', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await sql`
      DELETE FROM orders 
      WHERE id = ${id}
      RETURNING id
    `;

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    res.json({
      success: true,
      message: 'Order deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete order',
    });
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
  } catch (error: any) {
    console.error('Error sending shipping notification:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

