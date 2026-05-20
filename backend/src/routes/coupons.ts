// backend/src/routes/coupons.ts
import { Router, Request, Response } from 'express';
import sql from '../lib/db';
import { verifyAdmin } from './admin';

const router = Router();

// Types
interface Coupon {
  id?: string;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  minimum_order?: number;
  maximum_discount?: number;
  max_uses?: number;
  used_count?: number;
  max_uses_per_customer?: number;
  valid_from?: string;
  valid_until?: string;
  is_active?: boolean;
  applies_to?: 'all' | 'category' | 'product';
  applies_to_ids?: number[];
  created_at?: string;
  updated_at?: string;
}

interface CouponValidationRequest {
  code: string;
  subtotal: number;
  customer_email?: string;
  items?: Array<{ product_id: number; category?: string; quantity: number; price: number }>;
}

interface CouponValidationResult {
  valid: boolean;
  coupon?: Coupon;
  discount_amount?: number;
  message: string;
  error_code?: string;
}

// ============================================
// PUBLIC ROUTES
// ============================================

// POST validate coupon code
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { code, subtotal, customer_email, items }: CouponValidationRequest = req.body;

    if (!code || code.trim().length === 0) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Coupon code is required',
        error_code: 'MISSING_CODE',
      });
    }

    if (!subtotal || subtotal <= 0) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Invalid order subtotal',
        error_code: 'INVALID_SUBTOTAL',
      });
    }

    // Find coupon by code (case-insensitive)
    const coupons = await sql`
      SELECT * FROM coupons 
      WHERE UPPER(code) = UPPER(${code.trim()})
      LIMIT 1
    `;

    if (!coupons || coupons.length === 0) {
      return res.json({
        success: true,
        valid: false,
        message: 'Invalid coupon code',
        error_code: 'INVALID_CODE',
      });
    }

    const coupon = coupons[0] as Coupon;

    // Check if coupon is active
    if (!coupon.is_active) {
      return res.json({
        success: true,
        valid: false,
        message: 'This coupon is no longer active',
        error_code: 'INACTIVE',
      });
    }

    // Check validity dates
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return res.json({
        success: true,
        valid: false,
        message: 'This coupon is not yet valid',
        error_code: 'NOT_YET_VALID',
      });
    }

    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return res.json({
        success: true,
        valid: false,
        message: 'This coupon has expired',
        error_code: 'EXPIRED',
      });
    }

   // Check max uses
if (coupon.max_uses != null && coupon.used_count != null && coupon.used_count >= coupon.max_uses) {
  return res.json({
    success: true,
    valid: false,
    message: 'This coupon has reached its usage limit',
    error_code: 'MAX_USES_REACHED',
  });
}

    // Check minimum order amount
    if (coupon.minimum_order && subtotal < coupon.minimum_order) {
      return res.json({
        success: true,
        valid: false,
        message: `Minimum order of $${coupon.minimum_order.toFixed(2)} required for this coupon`,
        error_code: 'MINIMUM_NOT_MET',
        minimum_order: coupon.minimum_order,
      });
    }

    // Check per-customer usage limit
    if (customer_email && coupon.id && coupon.max_uses_per_customer != null) {
      const couponId = coupon.id; // now guaranteed string
    
      const usageCount = await sql`
        SELECT COUNT(*) as count FROM coupon_usage 
        WHERE coupon_id = ${coupon.id} AND customer_email = ${customer_email}
      `;
      
      if (parseInt(usageCount[0].count) >= coupon.max_uses_per_customer) {
        return res.json({
          success: true,
          valid: false,
          message: 'You have already used this coupon the maximum number of times',
          error_code: 'CUSTOMER_LIMIT_REACHED',
        });
      }
    }

    // Calculate discount
    let discount_amount = 0;
    if (coupon.discount_type === 'percentage') {
      discount_amount = (subtotal * coupon.discount_value) / 100;
      // Apply maximum discount cap if set
      if (coupon.maximum_discount && discount_amount > coupon.maximum_discount) {
        discount_amount = coupon.maximum_discount;
      }
    } else {
      // Fixed discount
      discount_amount = Math.min(coupon.discount_value, subtotal);
    }

    // Round to 2 decimal places
    discount_amount = Math.round(discount_amount * 100) / 100;

    res.json({
      success: true,
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        minimum_order: coupon.minimum_order,
        maximum_discount: coupon.maximum_discount,
      },
      discount_amount,
      message: coupon.discount_type === 'percentage'
        ? `${coupon.discount_value}% discount applied!`
        : `$${coupon.discount_value.toFixed(2)} discount applied!`,
    });
  } catch (error: any) {
    console.error('Error validating coupon:', error);
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Error validating coupon',
      error: error.message,
    });
  }
});

// POST record coupon usage (called after successful order)
router.post('/use', async (req: Request, res: Response) => {
  try {
    const { coupon_id, order_id, customer_email, discount_amount } = req.body;

    if (!coupon_id || !customer_email || discount_amount === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: coupon_id, customer_email, discount_amount',
      });
    }

    // Record usage
    await sql`
      INSERT INTO coupon_usage (coupon_id, order_id, customer_email, discount_amount)
      VALUES (${coupon_id}, ${order_id || null}, ${customer_email}, ${discount_amount})
    `;

    // Increment used_count on coupon
    await sql`
      UPDATE coupons 
      SET used_count = used_count + 1, updated_at = NOW()
      WHERE id = ${coupon_id}
    `;

    res.json({
      success: true,
      message: 'Coupon usage recorded',
    });
  } catch (error: any) {
    console.error('Error recording coupon usage:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// GET all coupons (Admin only)
router.get('/', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { active_only, include_expired } = req.query;

    let coupons;
    if (active_only === 'true') {
      coupons = await sql`
        SELECT * FROM coupons 
        WHERE is_active = TRUE 
          AND (valid_until IS NULL OR valid_until > NOW())
        ORDER BY created_at DESC
      `;
    } else if (include_expired === 'false') {
      coupons = await sql`
        SELECT * FROM coupons 
        WHERE valid_until IS NULL OR valid_until > NOW()
        ORDER BY created_at DESC
      `;
    } else {
      coupons = await sql`
        SELECT * FROM coupons ORDER BY created_at DESC
      `;
    }

    res.json({
      success: true,
      data: coupons,
      count: coupons.length,
    });
  } catch (error: any) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET single coupon by ID (Admin only)
router.get('/:id', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const coupon = await sql`
      SELECT * FROM coupons WHERE id = ${id}
    `;

    if (!coupon || coupon.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Coupon not found',
      });
    }

    // Get usage stats
    const usageStats = await sql`
      SELECT 
        COUNT(*) as total_uses,
        COALESCE(SUM(discount_amount), 0) as total_discount_given
      FROM coupon_usage 
      WHERE coupon_id = ${id}
    `;

    res.json({
      success: true,
      data: {
        ...coupon[0],
        usage_stats: {
          total_uses: parseInt(usageStats[0].total_uses),
          total_discount_given: parseFloat(usageStats[0].total_discount_given),
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching coupon:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST create coupon (Admin only)
router.post('/', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const couponData: Coupon = req.body;

    // Validate required fields
    if (!couponData.code || couponData.code.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Coupon code is required',
      });
    }

    if (!couponData.discount_type || !['percentage', 'fixed'].includes(couponData.discount_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid discount type. Must be "percentage" or "fixed"',
      });
    }

    if (!couponData.discount_value || couponData.discount_value <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Discount value must be greater than 0',
      });
    }

    // Validate percentage range
    if (couponData.discount_type === 'percentage' && couponData.discount_value > 100) {
      return res.status(400).json({
        success: false,
        error: 'Percentage discount cannot exceed 100%',
      });
    }

    // Check for duplicate code
    const existing = await sql`
      SELECT id FROM coupons WHERE UPPER(code) = UPPER(${couponData.code.trim()})
    `;

    if (existing && existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'A coupon with this code already exists',
      });
    }

    const result = await sql`
      INSERT INTO coupons (
        code, description, discount_type, discount_value,
        minimum_order, maximum_discount, max_uses, max_uses_per_customer,
        valid_from, valid_until, is_active, applies_to, applies_to_ids
      ) VALUES (
        ${couponData.code.trim().toUpperCase()},
        ${couponData.description || null},
        ${couponData.discount_type},
        ${couponData.discount_value},
        ${couponData.minimum_order || 0},
        ${couponData.maximum_discount || null},
        ${couponData.max_uses || null},
        ${couponData.max_uses_per_customer || 1},
        ${couponData.valid_from || null},
        ${couponData.valid_until || null},
        ${couponData.is_active !== false},
        ${couponData.applies_to || 'all'},
        ${couponData.applies_to_ids || null}
      )
      RETURNING *
    `;

    res.status(201).json({
      success: true,
      data: result[0],
      message: 'Coupon created successfully',
    });
  } catch (error: any) {
    console.error('Error creating coupon:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// PUT update coupon (Admin only)
router.put('/:id', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates: Partial<Coupon> = req.body;

    // Check coupon exists
    const existing = await sql`SELECT id FROM coupons WHERE id = ${id}`;
    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Coupon not found',
      });
    }

    // Check for duplicate code if code is being updated
    if (updates.code) {
      const duplicate = await sql`
        SELECT id FROM coupons 
        WHERE UPPER(code) = UPPER(${updates.code.trim()}) AND id != ${id}
      `;
      if (duplicate && duplicate.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'A coupon with this code already exists',
        });
      }
    }

    const result = await sql`
      UPDATE coupons SET
        code = COALESCE(${updates.code?.trim().toUpperCase() || null}, code),
        description = COALESCE(${updates.description || null}, description),
        discount_type = COALESCE(${updates.discount_type || null}, discount_type),
        discount_value = COALESCE(${updates.discount_value || null}, discount_value),
        minimum_order = COALESCE(${updates.minimum_order ?? null}, minimum_order),
        maximum_discount = COALESCE(${updates.maximum_discount || null}, maximum_discount),
        max_uses = COALESCE(${updates.max_uses || null}, max_uses),
        max_uses_per_customer = COALESCE(${updates.max_uses_per_customer || null}, max_uses_per_customer),
        valid_from = COALESCE(${updates.valid_from || null}, valid_from),
        valid_until = COALESCE(${updates.valid_until || null}, valid_until),
        is_active = COALESCE(${updates.is_active ?? null}, is_active),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    res.json({
      success: true,
      data: result[0],
      message: 'Coupon updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating coupon:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// PATCH toggle coupon active status (Admin only)
router.patch('/:id/toggle', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await sql`
      UPDATE coupons SET
        is_active = NOT is_active,
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Coupon not found',
      });
    }

    res.json({
      success: true,
      data: result[0],
      message: `Coupon ${result[0].is_active ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error: any) {
    console.error('Error toggling coupon:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// DELETE coupon (Admin only)
router.delete('/:id', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await sql`
      DELETE FROM coupons WHERE id = ${id}
      RETURNING id
    `;

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Coupon not found',
      });
    }

    res.json({
      success: true,
      message: 'Coupon deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET coupon usage history (Admin only)
router.get('/:id/usage', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const usage = await sql`
      SELECT 
        cu.*,
        o.order_number
      FROM coupon_usage cu
      LEFT JOIN orders o ON cu.order_id = o.id
      WHERE cu.coupon_id = ${id}
      ORDER BY cu.used_at DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `;

    const countResult = await sql`
      SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_id = ${id}
    `;

    res.json({
      success: true,
      data: usage,
      count: parseInt(countResult[0].count),
    });
  } catch (error: any) {
    console.error('Error fetching coupon usage:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
