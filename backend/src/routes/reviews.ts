// backend/src/routes/reviews.ts - Customer Reviews API
import { logger } from '../lib/logger';
import { Router, Request, Response } from 'express';
import sql from '../lib/db';
import { parsePagination, paginationMeta } from '../lib/pagination';
import { verifyAdmin } from './admin';
import { sanitizeString } from '../utils/sanitize';
import { deriveReviewVoterId } from '../lib/reviewVoterId';
import {
  checkVerifiedPurchase,
  sanitizeReviewImages,
  toPublicReview,
} from '../lib/reviewHelpers';
import { respond500 } from '../lib/safeError';
import { getOrderAccessTokenFromRequest } from '../lib/orderTokens';

const router = Router();

// Types
interface Review {
  id?: string;
  product_id: number;
  customer_email: string;
  customer_name: string;
  order_id?: string;
  rating: number;
  title?: string;
  content?: string;
  pros?: string[];
  cons?: string[];
  is_verified_purchase?: boolean;
  is_recommended?: boolean;
  status?: string;
  images?: string[];
}

interface ReviewFilters {
  rating?: number;
  verified_only?: boolean;
  sort_by?: 'newest' | 'oldest' | 'highest' | 'lowest' | 'helpful';
}

// GET reviews for a product
router.get('/product/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { rating, verified_only, sort_by = 'newest' } = req.query;

    const parsed = parsePagination(req.query);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ success: false, error: parsed.error });
    }
    const { page: pageNum, limit: limitNum, offset } = parsed.params;

    // Build dynamic query conditions
    let reviews;
    
    if (rating && verified_only === 'true') {
      reviews = await sql`
        SELECT * FROM reviews 
        WHERE product_id = ${parseInt(productId)}
          AND status = 'approved'
          AND rating = ${parseInt(rating as string)}
          AND is_verified_purchase = true
        ORDER BY ${sort_by === 'helpful' ? sql`helpful_count DESC` : 
                  sort_by === 'highest' ? sql`rating DESC` :
                  sort_by === 'lowest' ? sql`rating ASC` :
                  sort_by === 'oldest' ? sql`created_at ASC` :
                  sql`created_at DESC`}
        LIMIT ${limitNum} OFFSET ${offset}
      `;
    } else if (rating) {
      reviews = await sql`
        SELECT * FROM reviews 
        WHERE product_id = ${parseInt(productId)}
          AND status = 'approved'
          AND rating = ${parseInt(rating as string)}
        ORDER BY ${sort_by === 'helpful' ? sql`helpful_count DESC` : 
                  sort_by === 'highest' ? sql`rating DESC` :
                  sort_by === 'lowest' ? sql`rating ASC` :
                  sort_by === 'oldest' ? sql`created_at ASC` :
                  sql`created_at DESC`}
        LIMIT ${limitNum} OFFSET ${offset}
      `;
    } else if (verified_only === 'true') {
      reviews = await sql`
        SELECT * FROM reviews 
        WHERE product_id = ${parseInt(productId)}
          AND status = 'approved'
          AND is_verified_purchase = true
        ORDER BY ${sort_by === 'helpful' ? sql`helpful_count DESC` : 
                  sort_by === 'highest' ? sql`rating DESC` :
                  sort_by === 'lowest' ? sql`rating ASC` :
                  sort_by === 'oldest' ? sql`created_at ASC` :
                  sql`created_at DESC`}
        LIMIT ${limitNum} OFFSET ${offset}
      `;
    } else {
      reviews = await sql`
        SELECT * FROM reviews 
        WHERE product_id = ${parseInt(productId)}
          AND status = 'approved'
        ORDER BY ${sort_by === 'helpful' ? sql`helpful_count DESC` : 
                  sort_by === 'highest' ? sql`rating DESC` :
                  sort_by === 'lowest' ? sql`rating ASC` :
                  sort_by === 'oldest' ? sql`created_at ASC` :
                  sql`created_at DESC`}
        LIMIT ${limitNum} OFFSET ${offset}
      `;
    }

    // Get total count and rating breakdown
    const stats = await sql`
      SELECT 
        COUNT(*) as total_reviews,
        COALESCE(AVG(rating)::DECIMAL(3,2), 0) as average_rating,
        COUNT(*) FILTER (WHERE rating = 5) as five_star,
        COUNT(*) FILTER (WHERE rating = 4) as four_star,
        COUNT(*) FILTER (WHERE rating = 3) as three_star,
        COUNT(*) FILTER (WHERE rating = 2) as two_star,
        COUNT(*) FILTER (WHERE rating = 1) as one_star,
        COUNT(*) FILTER (WHERE is_verified_purchase = true) as verified_purchases,
        COUNT(*) FILTER (WHERE is_recommended = true) as recommended
      FROM reviews 
      WHERE product_id = ${parseInt(productId)}
        AND status = 'approved'
    `;

    res.json({
      success: true,
      data: {
        reviews: (reviews as Record<string, unknown>[]).map(toPublicReview),
        stats: stats[0],
        pagination: paginationMeta(
          parseInt(stats[0].total_reviews as string) || 0,
          parsed.params
        )
      }
    });
  } catch (error: unknown) {
    logger.error('Error fetching reviews:', error);
    respond500(res, error, 'Failed to fetch reviews');
  }
});

// POST create review (admin) — approved by default
router.post('/admin', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const {
      product_id,
      customer_name,
      customer_email,
      rating,
      title,
      content,
      status = 'approved',
      is_verified_purchase = false,
    } = req.body;

    if (!product_id || !customer_name || !rating) {
      return res.status(400).json({
        success: false,
        error: 'Product, customer name, and rating are required',
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
    }

    if (!['pending', 'approved', 'rejected', 'flagged'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const email =
      customer_email && String(customer_email).includes('@')
        ? sanitizeString(String(customer_email)).toLowerCase().slice(0, 255)
        : `admin-review-${Date.now()}@internal.local`;

    const productExists = await sql`SELECT id FROM products WHERE id = ${product_id} LIMIT 1`;
    if (!productExists.length) {
      return res.status(400).json({ success: false, error: 'Product not found' });
    }

    const sanitizedTitle = title ? sanitizeString(title) : null;
    const sanitizedContent = content ? sanitizeString(content) : null;
    const sanitizedName = sanitizeString(customer_name);

    const result = await sql`
      INSERT INTO reviews (
        product_id, customer_email, customer_name, rating, title, content,
        is_verified_purchase, is_recommended, status
      ) VALUES (
        ${product_id},
        ${email},
        ${sanitizedName},
        ${rating},
        ${sanitizedTitle},
        ${sanitizedContent},
        ${Boolean(is_verified_purchase)},
        true,
        ${status}
      )
      RETURNING *
    `;

    res.status(201).json({ success: true, data: result[0] });
  } catch (error: unknown) {
    logger.error('Admin create review error:', error);
    respond500(res, error, 'Failed to create review');
  }
});

// POST create a new review (public — always pending moderation)
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      product_id,
      customer_email,
      customer_name,
      order_id,
      rating,
      title,
      content,
      pros,
      cons,
      is_recommended,
      images
    }: Review = req.body;

    // Validation
    if (!product_id || !customer_email || !customer_name || !rating) {
      return res.status(400).json({
        success: false,
        error: 'Product ID, customer email, customer name, and rating are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    const normalizedEmail = sanitizeString(customer_email).toLowerCase().slice(0, 255);
    if (!normalizedEmail.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email is required' });
    }

    const productExists = await sql`SELECT id FROM products WHERE id = ${product_id} LIMIT 1`;
    if (!productExists.length) {
      return res.status(400).json({ success: false, error: 'Product not found' });
    }

    // Check if customer already reviewed this product
    const existingReview = await sql`
      SELECT id FROM reviews 
      WHERE product_id = ${product_id} 
        AND customer_email = ${normalizedEmail}
      LIMIT 1
    `;

    if (existingReview.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You have already reviewed this product'
      });
    }

    const orderAccessToken = getOrderAccessTokenFromRequest(req);
    const isVerified = order_id
      ? await checkVerifiedPurchase(normalizedEmail, product_id, order_id, orderAccessToken)
      : false;

    const sanitizedTitle = title ? sanitizeString(title) : null;
    const sanitizedContent = content ? sanitizeString(content) : null;
    const sanitizedName = sanitizeString(customer_name);
    const sanitizedPros = pros?.map((p) => sanitizeString(p)).filter(Boolean) || [];
    const sanitizedCons = cons?.map((c) => sanitizeString(c)).filter(Boolean) || [];
    const sanitizedImages = sanitizeReviewImages(images);

    const result = await sql`
      INSERT INTO reviews (
        product_id,
        customer_email,
        customer_name,
        order_id,
        rating,
        title,
        content,
        pros,
        cons,
        is_verified_purchase,
        is_recommended,
        images,
        status
      ) VALUES (
        ${product_id},
        ${normalizedEmail},
        ${sanitizedName},
        ${order_id || null},
        ${rating},
        ${sanitizedTitle},
        ${sanitizedContent},
        ${sanitizedPros},
        ${sanitizedCons},
        ${isVerified},
        ${is_recommended !== false},
        ${sanitizedImages},
        'pending'
      )
      RETURNING *
    `;

    res.status(201).json({
      success: true,
      message: 'Thank you! Your review will be published after approval.',
      data: toPublicReview(result[0] as Record<string, unknown>),
    });
  } catch (error: unknown) {
    logger.error('Error creating review:', error);
    respond500(res, error, 'Failed to create review');
  }
});

// POST vote on a review (helpful/not helpful)
router.post('/:id/vote', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { vote_type } = req.body;
    const voter_identifier = deriveReviewVoterId(req);

    if (!vote_type || !['helpful', 'not_helpful'].includes(vote_type)) {
      return res.status(400).json({
        success: false,
        error: 'Valid vote type (helpful or not_helpful) is required'
      });
    }

    const reviewRow = await sql`
      SELECT id, status FROM reviews WHERE id = ${id} LIMIT 1
    `;
    if (!reviewRow.length || reviewRow[0].status !== 'approved') {
      return res.status(404).json({
        success: false,
        error: 'Review not found',
      });
    }

    // Check if already voted
    const existingVote = await sql`
      SELECT id, vote_type FROM review_votes 
      WHERE review_id = ${id} 
        AND voter_identifier = ${voter_identifier}
      LIMIT 1
    `;

    if (existingVote.length > 0) {
      // If same vote, remove it (toggle off)
      if (existingVote[0].vote_type === vote_type) {
        await sql`DELETE FROM review_votes WHERE id = ${existingVote[0].id}`;
        
        // Update review counts
        if (vote_type === 'helpful') {
          await sql`UPDATE reviews SET helpful_count = helpful_count - 1 WHERE id = ${id}`;
        } else {
          await sql`UPDATE reviews SET not_helpful_count = not_helpful_count - 1 WHERE id = ${id}`;
        }
        
        return res.json({
          success: true,
          message: 'Vote removed',
          action: 'removed'
        });
      }
      
      // If different vote, update it
      await sql`
        UPDATE review_votes 
        SET vote_type = ${vote_type}, created_at = NOW()
        WHERE id = ${existingVote[0].id}
      `;
      
      // Update review counts
      if (vote_type === 'helpful') {
        await sql`
          UPDATE reviews 
          SET helpful_count = helpful_count + 1, not_helpful_count = not_helpful_count - 1 
          WHERE id = ${id}
        `;
      } else {
        await sql`
          UPDATE reviews 
          SET helpful_count = helpful_count - 1, not_helpful_count = not_helpful_count + 1 
          WHERE id = ${id}
        `;
      }
      
      return res.json({
        success: true,
        message: 'Vote updated',
        action: 'updated'
      });
    }

    // Create new vote
    await sql`
      INSERT INTO review_votes (review_id, voter_identifier, vote_type)
      VALUES (${id}, ${voter_identifier}, ${vote_type})
    `;

    // Update review count
    if (vote_type === 'helpful') {
      await sql`UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = ${id}`;
    } else {
      await sql`UPDATE reviews SET not_helpful_count = not_helpful_count + 1 WHERE id = ${id}`;
    }

    res.json({
      success: true,
      message: 'Vote recorded',
      action: 'created'
    });
  } catch (error: unknown) {
    logger.error('Error voting on review:', error);
    respond500(res, error, 'Failed to record vote');
  }
});

// GET all reviews (Admin only)
router.get('/', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { status, product_id } = req.query;

    const parsed = parsePagination(req.query);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ success: false, error: parsed.error });
    }
    const { limit: limitNum, offset } = parsed.params;

    const statusStr = status as string | undefined;
    const productIdStr = product_id as string | undefined;
    const productIdNum = productIdStr ? parseInt(productIdStr, 10) : undefined;

    let reviews;
    let countResult;
    
    if (statusStr && productIdNum !== undefined) {
      reviews = await sql`
        SELECT r.*, p.name as product_name
        FROM reviews r
        LEFT JOIN products p ON r.product_id = p.id
        WHERE r.status = ${statusStr}
          AND r.product_id = ${productIdNum}
        ORDER BY r.created_at DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM reviews 
        WHERE status = ${statusStr} AND product_id = ${productIdNum}
      `;
    } else if (statusStr) {
      reviews = await sql`
        SELECT r.*, p.name as product_name
        FROM reviews r
        LEFT JOIN products p ON r.product_id = p.id
        WHERE r.status = ${statusStr}
        ORDER BY r.created_at DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM reviews WHERE status = ${statusStr}
      `;
    } else if (productIdNum !== undefined) {
      reviews = await sql`
        SELECT r.*, p.name as product_name
        FROM reviews r
        LEFT JOIN products p ON r.product_id = p.id
        WHERE r.product_id = ${productIdNum}
        ORDER BY r.created_at DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM reviews WHERE product_id = ${productIdNum}
      `;
    } else {
      reviews = await sql`
        SELECT r.*, p.name as product_name
        FROM reviews r
        LEFT JOIN products p ON r.product_id = p.id
        ORDER BY r.created_at DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `;
      countResult = await sql`SELECT COUNT(*) as total FROM reviews`;
    }

    // Get stats
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'flagged') as flagged
      FROM reviews
    `;

    res.json({
      success: true,
      data: reviews,
      stats: stats[0],
      pagination: paginationMeta(
        parseInt(countResult[0].total as string) || 0,
        parsed.params
      )
    });
  } catch (error: unknown) {
    logger.error('Error fetching reviews:', error);
    respond500(res, error, 'Failed to fetch reviews');
  }
});

// PATCH update review (admin)
router.patch('/:id', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      status,
      admin_response,
      product_id,
      customer_name,
      customer_email,
      rating,
      title,
      content,
      is_verified_purchase,
    } = req.body;

    if (status && !['pending', 'approved', 'rejected', 'flagged'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
    }

    const existing = await sql`SELECT id FROM reviews WHERE id = ${id} LIMIT 1`;
    if (!existing.length) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    const sanitizedTitle = title !== undefined ? (title ? sanitizeString(title) : null) : undefined;
    const sanitizedContent = content !== undefined ? (content ? sanitizeString(content) : null) : undefined;
    const sanitizedName =
      customer_name !== undefined ? sanitizeString(String(customer_name)) : undefined;
    const sanitizedEmail =
      customer_email !== undefined
        ? sanitizeString(String(customer_email)).toLowerCase().slice(0, 255)
        : undefined;

    if (product_id !== undefined) {
      const productExists = await sql`SELECT id FROM products WHERE id = ${product_id} LIMIT 1`;
      if (!productExists.length) {
        return res.status(400).json({ success: false, error: 'Product not found' });
      }
    }

    const result = await sql`
      UPDATE reviews SET
        product_id = COALESCE(${product_id ?? null}, product_id),
        status = COALESCE(${status ?? null}, status),
        admin_response = COALESCE(
          ${admin_response !== undefined ? (admin_response ? sanitizeString(admin_response) : null) : null},
          admin_response
        ),
        admin_response_at = CASE
          WHEN ${admin_response !== undefined} THEN NOW()
          ELSE admin_response_at
        END,
        customer_name = COALESCE(${sanitizedName ?? null}, customer_name),
        customer_email = COALESCE(${sanitizedEmail ?? null}, customer_email),
        rating = COALESCE(${rating ?? null}, rating),
        title = COALESCE(${sanitizedTitle !== undefined ? sanitizedTitle : null}, title),
        content = COALESCE(${sanitizedContent !== undefined ? sanitizedContent : null}, content),
        is_verified_purchase = COALESCE(
          ${is_verified_purchase !== undefined ? Boolean(is_verified_purchase) : null},
          is_verified_purchase
        ),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    res.json({ success: true, data: result[0] });
  } catch (error: unknown) {
    logger.error('Error updating review:', error);
    respond500(res, error, 'Failed to update review');
  }
});

// DELETE review (Admin only)
router.delete('/:id', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await sql`
      DELETE FROM reviews WHERE id = ${id} RETURNING id, product_id
    `;

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error: unknown) {
    logger.error('Error deleting review:', error);
    respond500(res, error, 'Failed to delete review');
  }
});

async function checkReviewEligibility(productId: number, email: string) {
  const normalizedEmail = sanitizeString(email).toLowerCase().slice(0, 255);
  if (!normalizedEmail.includes('@')) {
    return { status: 400 as const, error: 'Invalid email' };
  }

  const existingReview = await sql`
    SELECT 1 FROM reviews
    WHERE product_id = ${productId}
      AND customer_email = ${normalizedEmail}
    LIMIT 1
  `;

  const canReview = existingReview.length === 0;
  return {
    status: 200 as const,
    data: {
      can_review: canReview,
      message: canReview
        ? 'You may submit a review for this product.'
        : 'A review may already exist for this product and email, or eligibility could not be confirmed.',
    },
  };
}

// POST check review eligibility (email in body — avoids PII in URLs)
router.post('/check', async (req: Request, res: Response) => {
  try {
    const { product_id, email } = req.body as { product_id?: number; email?: string };
    const productId = parseInt(String(product_id), 10);

    if (!productId || Number.isNaN(productId) || !email?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'product_id and email are required',
      });
    }

    const result = await checkReviewEligibility(productId, email);
    if (result.status === 400) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: result.data });
  } catch (error: unknown) {
    logger.error('Error checking review eligibility:', error);
    respond500(res, error, 'Failed to check review eligibility');
  }
});

export default router;
