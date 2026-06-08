// backend/src/routes/coupons.ts
import { logger } from '../lib/logger';
import { respond500 } from '../lib/safeError';
import { Router, Request, Response } from 'express';
import sql from '../lib/db';
import { cached } from '../lib/cache';
import { CACHE, TTL, invalidateCouponCaches } from '../lib/cacheKeys';
import { verifyAdmin } from './admin';
import { parsePagination, paginationMeta } from '../lib/pagination';
import { computeCheckoutPricingForCart } from '../lib/paypalCheckout';

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

    const cartInputs = (items || [])
      .filter((item) => item?.product_id && item.quantity > 0)
      .map((item) => ({ product_id: item.product_id, quantity: item.quantity }));

    if (!cartInputs.length && (!subtotal || subtotal <= 0)) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Cart items or a valid subtotal are required',
        error_code: 'INVALID_SUBTOTAL',
      });
    }

    const emailKey = (customer_email || '').toLowerCase();
    const cacheSubtotal = subtotal || 0;
    const cacheKey = CACHE.couponValidate(
      code.trim(),
      cacheSubtotal,
      emailKey,
      cartInputs.reduce((sum, item) => sum + item.quantity, 0)
    );

    const result = await cached(cacheKey, TTL.couponValidate, async () => {
      if (cartInputs.length > 0) {
        const computed = await computeCheckoutPricingForCart(
          cartInputs,
          code.trim(),
          customer_email
        );
        if (!computed.ok) {
          return {
            success: true,
            valid: false,
            message: computed.message,
            error_code: computed.error === 'Invalid coupon' ? 'NOT_APPLICABLE' : 'INVALID_CART',
          };
        }

        const { pricing, couponDiscount, couponId } = computed.result;
        if (!couponId || couponDiscount <= 0) {
          return {
            success: true,
            valid: false,
            message: 'This coupon cannot be applied to your cart',
            error_code: 'NOT_APPLICABLE',
          };
        }

        const coupons = await sql`
          SELECT * FROM coupons WHERE id = ${couponId} LIMIT 1
        `;
        const coupon = coupons[0] as Coupon;

        return {
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
          discount_amount: couponDiscount,
          pricing,
          message:
            coupon.discount_type === 'percentage'
              ? `${coupon.discount_value}% discount applied!`
              : `$${coupon.discount_value.toFixed(2)} discount applied!`,
        };
      }

      return {
        success: true,
        valid: false,
        message: 'Cart items are required for coupon validation',
        error_code: 'INVALID_CART',
      };
    });

    res.json(result);
  } catch (error: unknown) {
    logger.error('Error validating coupon:', error);
    respond500(res, error, 'Request failed');
  }
});

// POST /use — deprecated; coupon usage is recorded at payment capture
router.post('/use', (_req: Request, res: Response) => {
  res.status(410).json({
    success: false,
    error: 'Gone',
    message: 'Coupon usage is recorded automatically during payment capture',
  });
});

// GET list coupons (Admin only) — must be before /:id
router.get('/', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = parsePagination(req.query);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ success: false, error: parsed.error });
    }
    const { limit, offset } = parsed.params;

    const [coupons, countResult] = await Promise.all([
      sql`
        SELECT * FROM coupons
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`SELECT COUNT(*) as total FROM coupons`,
    ]);

    const total = parseInt(countResult[0]?.total || '0');

    res.json({
      success: true,
      data: coupons,
      pagination: paginationMeta(total, parsed.params),
    });
  } catch (error: unknown) {
    logger.error('Error listing coupons:', error);
    respond500(res, error, 'Request failed');
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
  } catch (error: unknown) {
    logger.error('Error fetching coupon:', error);
    respond500(res, error, 'Request failed');
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

    invalidateCouponCaches();

    invalidateCouponCaches();

    res.status(201).json({
      success: true,
      data: result[0],
      message: 'Coupon created successfully',
    });
  } catch (error: unknown) {
    logger.error('Error creating coupon:', error);
    respond500(res, error, 'Request failed');
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
        applies_to = COALESCE(${updates.applies_to || null}, applies_to),
        applies_to_ids = COALESCE(${updates.applies_to_ids ?? null}, applies_to_ids),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    invalidateCouponCaches();

    res.json({
      success: true,
      data: result[0],
      message: 'Coupon updated successfully',
    });
  } catch (error: unknown) {
    logger.error('Error updating coupon:', error);
    respond500(res, error, 'Request failed');
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

    invalidateCouponCaches();

    res.json({
      success: true,
      data: result[0],
      message: `Coupon ${result[0].is_active ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error: unknown) {
    logger.error('Error toggling coupon:', error);
    respond500(res, error, 'Request failed');
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

    invalidateCouponCaches();

    res.json({
      success: true,
      message: 'Coupon deleted successfully',
    });
  } catch (error: unknown) {
    logger.error('Error deleting coupon:', error);
    respond500(res, error, 'Request failed');
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
  } catch (error: unknown) {
    logger.error('Error fetching coupon usage:', error);
    respond500(res, error, 'Request failed');
  }
});

export default router;
