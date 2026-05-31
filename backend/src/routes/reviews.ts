// backend/src/routes/reviews.ts - Customer Reviews API
import { logger } from '../lib/logger';
import { Router, Request, Response } from 'express';
import sql from '../lib/db';
import { parsePagination, paginationMeta } from '../lib/pagination';
import { verifyAdmin } from './admin';
import { sanitizeString } from '../utils/sanitize';

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

// Helper: Check if customer has purchased the product
const checkVerifiedPurchase = async (email: string, productId: number): Promise<boolean> => {
  try {
    const result = await sql`
      SELECT 1 FROM orders 
      WHERE customer_email = ${email}
        AND payment_status = 'completed'
        AND items::text LIKE ${'%"product_id":' + productId + '%'}
      LIMIT 1
    `;
    return result.length > 0;
  } catch {
    return false;
  }
};

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
        reviews,
        stats: stats[0],
        pagination: paginationMeta(
          parseInt(stats[0].total_reviews as string) || 0,
          parsed.params
        )
      }
    });
  } catch (error: any) {
    logger.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch reviews'
    });
  }
});

// POST create a new review
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

    // Check if customer already reviewed this product
    const existingReview = await sql`
      SELECT id FROM reviews 
      WHERE product_id = ${product_id} 
        AND customer_email = ${customer_email.toLowerCase()}
      LIMIT 1
    `;

    if (existingReview.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You have already reviewed this product'
      });
    }

    // Check verified purchase
    const isVerified = await checkVerifiedPurchase(customer_email.toLowerCase(), product_id);

    // Sanitize inputs
    const sanitizedTitle = title ? sanitizeString(title) : null;
    const sanitizedContent = content ? sanitizeString(content) : null;
    const sanitizedName = sanitizeString(customer_name);
    const sanitizedPros = pros?.map(p => sanitizeString(p)).filter(Boolean) || [];
    const sanitizedCons = cons?.map(c => sanitizeString(c)).filter(Boolean) || [];

    // Create review (pending approval for non-verified purchases)
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
        ${customer_email.toLowerCase()},
        ${sanitizedName},
        ${order_id || null},
        ${rating},
        ${sanitizedTitle},
        ${sanitizedContent},
        ${sanitizedPros},
        ${sanitizedCons},
        ${isVerified},
        ${is_recommended !== false},
        ${images || []},
        ${isVerified ? 'approved' : 'pending'}
      )
      RETURNING *
    `;

    res.status(201).json({
      success: true,
      message: isVerified 
        ? 'Thank you for your review!' 
        : 'Thank you! Your review will be published after approval.',
      data: result[0]
    });
  } catch (error: any) {
    logger.error('Error creating review:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create review'
    });
  }
});

// POST vote on a review (helpful/not helpful)
router.post('/:id/vote', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { vote_type, voter_identifier } = req.body;

    if (!vote_type || !['helpful', 'not_helpful'].includes(vote_type)) {
      return res.status(400).json({
        success: false,
        error: 'Valid vote type (helpful or not_helpful) is required'
      });
    }

    if (!voter_identifier) {
      return res.status(400).json({
        success: false,
        error: 'Voter identifier is required'
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
  } catch (error: any) {
    logger.error('Error voting on review:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to record vote'
    });
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
  } catch (error: any) {
    logger.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch reviews'
    });
  }
});

// PATCH update review status (Admin only)
router.patch('/:id/status', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, admin_response } = req.body;

    if (!status || !['pending', 'approved', 'rejected', 'flagged'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Valid status is required'
      });
    }

    const updateData: any = { status };
    if (admin_response) {
      updateData.admin_response = sanitizeString(admin_response);
      updateData.admin_response_at = new Date().toISOString();
    }

    const result = await sql`
      UPDATE reviews 
      SET 
        status = ${status},
        admin_response = ${admin_response ? sanitizeString(admin_response) : sql`admin_response`},
        admin_response_at = ${admin_response ? sql`NOW()` : sql`admin_response_at`},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }

    res.json({
      success: true,
      data: result[0]
    });
  } catch (error: any) {
    logger.error('Error updating review:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update review'
    });
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
  } catch (error: any) {
    logger.error('Error deleting review:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete review'
    });
  }
});

// GET review by customer email (check if can review)
router.get('/check/:productId/:email', async (req: Request, res: Response) => {
  try {
    const { productId, email } = req.params;

    // Check if already reviewed
    const existingReview = await sql`
      SELECT id, rating, created_at FROM reviews 
      WHERE product_id = ${parseInt(productId)} 
        AND customer_email = ${email.toLowerCase()}
      LIMIT 1
    `;

    // Check if has purchased
    const hasPurchased = await checkVerifiedPurchase(email.toLowerCase(), parseInt(productId));

    res.json({
      success: true,
      data: {
        has_reviewed: existingReview.length > 0,
        existing_review: existingReview[0] || null,
        has_purchased: hasPurchased,
        can_review: existingReview.length === 0
      }
    });
  } catch (error: any) {
    logger.error('Error checking review eligibility:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check review eligibility'
    });
  }
});

export default router;
