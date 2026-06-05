// backend/src/routes/products.ts
import { logger } from '../lib/logger';
import { Router, Request, Response } from 'express';
import sql from '../lib/db';
import { cached } from '../lib/cache';
import { CACHE, TTL, invalidateProductCaches } from '../lib/cacheKeys';
import { parsePagination, paginationMeta } from '../lib/pagination';
import { verifyAdmin } from './admin';
import { sanitizeSearchQuery, sanitizeString } from '../utils/sanitize';
import {
  validateProductImageUrl,
  validateOptionalProductImageUrl,
} from '../lib/productImage';

const router = Router();

// Types
interface Product {
  id?: number;
  name: string;
  price: number;
  image: string;
  description?: string;
  background?: string;
  category?: string;
  size?: string;
  color?: string;
  stock?: number;
  rating?: number;
  review_count?: number;
  view_count?: number;
  cart_count?: number;
  is_out_of_stock?: boolean;
  created_at?: string;
  updated_at?: string;
}

// GET all products with pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const parsed = parsePagination(req.query);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ success: false, error: parsed.error });
    }
    const { page, limit, offset } = parsed.params;

    res.setHeader('Cache-Control', 'public, max-age=60');

    const payload = await cached(
      CACHE.productsList(page, limit),
      TTL.productsList,
      async () => {
        const countResult = await sql`SELECT COUNT(*) as total FROM products`;
        const total = parseInt(countResult[0]?.total || '0');
        const products = await sql`
          SELECT * FROM products 
          ORDER BY id ASC
          LIMIT ${limit}
          OFFSET ${offset}
        `;
        return {
          data: products || [],
          pagination: paginationMeta(total, parsed.params),
        };
      }
    );

    res.json({
      success: true,
      data: payload.data,
      pagination: payload.pagination,
    });
  } catch (error: any) {
    logger.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load products',
      message: 'Unable to retrieve products from database. Please try again later.',
    });
  }
});

// GET available filter options (categories, sizes, colors, price range)
router.get('/filters', async (_req: Request, res: Response) => {
  try {
    // Parallel filter queries (independent reads) — chunked via Promise.all, not sequential
    const [categories, sizes, priceRange, ratingStats] = await Promise.all([
      sql`
        SELECT DISTINCT category FROM products 
        WHERE category IS NOT NULL 
        ORDER BY category ASC
      `,
      sql`
        SELECT DISTINCT size FROM products 
        WHERE size IS NOT NULL 
        ORDER BY size ASC
      `,
      sql`
        SELECT MIN(price) as min_price, MAX(price) as max_price FROM products
      `,
      sql`
        SELECT MIN(rating) as min_rating, MAX(rating) as max_rating, AVG(rating) as avg_rating
        FROM products
      `,
    ]);

    res.json({
      success: true,
      data: {
        categories: categories.map(c => c.category),
        sizes: sizes.map(s => s.size),
        priceRange: {
          min: parseFloat(priceRange[0]?.min_price || '0'),
          max: parseFloat(priceRange[0]?.max_price || '1000')
        },
        ratingRange: {
          min: parseFloat(ratingStats[0]?.min_rating || '0'),
          max: parseFloat(ratingStats[0]?.max_rating || '5'),
          avg: parseFloat(ratingStats[0]?.avg_rating || '0')
        },
        sortOptions: [
          { value: 'default', label: 'Default' },
          { value: 'price_asc', label: 'Price: Low to High' },
          { value: 'price_desc', label: 'Price: High to Low' },
          { value: 'rating_desc', label: 'Highest Rated' },
          { value: 'newest', label: 'Newest First' },
          { value: 'oldest', label: 'Oldest First' }
        ]
      }
    });
  } catch (error: any) {
    logger.error('Error fetching filter options:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch filter options',
    });
  }
});

// GET product paths for sitemap (must be registered before /:id)
router.get('/sitemap-urls', async (_req: Request, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=300');

    const payload = await cached('products:sitemap-urls', 300_000, async () => {
      const rows = await sql`
        SELECT id, updated_at
        FROM products
        ORDER BY id ASC
      `;
      return (rows as unknown as Array<{ id: number; updated_at?: string }>).map((p) => ({
        id: p.id,
        path: `/product/${p.id}`,
        updated_at: p.updated_at,
      }));
    });

    res.json({
      success: true,
      data: payload,
      count: payload.length,
    });
  } catch (error: any) {
    logger.error('Error fetching sitemap URLs:', error);
    res.status(500).json({ success: false, error: 'Failed to load sitemap URLs' });
  }
});

// GET products by category (must be registered before /:id)
router.get('/category/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const parsed = parsePagination(req.query);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ success: false, error: parsed.error });
    }
    const { limit, offset } = parsed.params;

    const [products, countResult] = await Promise.all([
      sql`
        SELECT * FROM products 
        WHERE category = ${category}
        ORDER BY id ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `,
      sql`SELECT COUNT(*) as total FROM products WHERE category = ${category}`,
    ]);
    const total = parseInt(countResult[0]?.total || '0');

    res.json({
      success: true,
      data: products || [],
      count: products?.length || 0,
      pagination: paginationMeta(total, parsed.params),
    });
  } catch (error: any) {
    logger.error('Error fetching products by category:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch products',
    });
  }
});

// GET single product by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const row = await cached(CACHE.productSingle(id), TTL.productSingle, async () => {
      const product = await sql`
        SELECT * FROM products 
        WHERE id = ${id}
        LIMIT 1
      `;
      return product[0] ?? null;
    });

    if (!row) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
        message: `Product with ID ${id} does not exist`,
      });
    }

    res.json({
      success: true,
      data: row,
    });
  } catch (error: any) {
    logger.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch product',
    });
  }
});

// POST create new product (Admin only)
router.post('/', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const productData: Product = req.body;

    // Validation with descriptive messages
    if (!productData.name || productData.name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Product name is required',
        message: 'Please provide a valid product name',
      });
    }

    if (!productData.price || productData.price <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid price is required',
        message: 'Product price must be greater than zero',
      });
    }

    if (productData.name.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Product name too long',
        message: 'Product name must be less than 100 characters',
      });
    }

    const imageResult = validateProductImageUrl(productData.image, 'Product image');
    if (!imageResult.ok) {
      return res.status(400).json({ success: false, error: imageResult.error });
    }

    const backgroundResult = validateOptionalProductImageUrl(
      productData.background,
      'Background image'
    );
    if (!backgroundResult.ok) {
      return res.status(400).json({ success: false, error: backgroundResult.error });
    }

    const result = await sql`
      INSERT INTO products (name, price, image, description, background, category, size, color, stock, rating, review_count)
      VALUES (
        ${productData.name},
        ${productData.price},
        ${imageResult.value},
        ${productData.description || null},
        ${backgroundResult.value},
        ${productData.category || null},
        ${productData.size || null},
        ${productData.color || null},
        ${productData.stock || 0},
        ${productData.rating || 0},
        ${productData.review_count || 0}
      )
      RETURNING *
    `;

    invalidateProductCaches();

    res.status(201).json({
      success: true,
      data: result[0],
      message: 'Product created successfully',
    });
  } catch (error: any) {
    logger.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create product',
    });
  }
});

// PUT update product (Admin only)
router.put('/:id', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates: Partial<Product> = req.body;

    // Handle is_out_of_stock separately since it's a boolean
    const isOutOfStock = updates.is_out_of_stock !== undefined ? updates.is_out_of_stock : null;

    let imageValue: string | null = null;
    if (updates.image !== undefined) {
      const imageResult = validateProductImageUrl(updates.image, 'Product image');
      if (!imageResult.ok) {
        return res.status(400).json({ success: false, error: imageResult.error });
      }
      imageValue = imageResult.value;
    }

    let backgroundValue: string | null | undefined = undefined;
    if (updates.background !== undefined) {
      const bgResult = validateOptionalProductImageUrl(updates.background, 'Background image');
      if (!bgResult.ok) {
        return res.status(400).json({ success: false, error: bgResult.error });
      }
      backgroundValue = bgResult.value;
    }

    const result = await sql`
      UPDATE products SET
        name = COALESCE(${updates.name || null}, name),
        price = COALESCE(${updates.price || null}, price),
        image = COALESCE(${imageValue}, image),
        description = COALESCE(${updates.description || null}, description),
        background = COALESCE(${backgroundValue !== undefined ? backgroundValue : null}, background),
        category = COALESCE(${updates.category || null}, category),
        size = COALESCE(${updates.size || null}, size),
        color = COALESCE(${updates.color || null}, color),
        stock = COALESCE(${updates.stock || null}, stock),
        rating = COALESCE(${updates.rating || null}, rating),
        review_count = COALESCE(${updates.review_count || null}, review_count),
        is_out_of_stock = COALESCE(${isOutOfStock}, is_out_of_stock),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    invalidateProductCaches(id);

    res.json({
      success: true,
      data: result[0],
      message: 'Product updated successfully',
    });
  } catch (error: any) {
    logger.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update product',
    });
  }
});

// DELETE product (Admin only)
router.delete('/:id', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await sql`
      DELETE FROM products 
      WHERE id = ${id}
      RETURNING id
    `;

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    invalidateProductCaches(id);

    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete product',
    });
  }
});

// POST search/filter products with advanced options
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { 
      query, 
      minPrice, 
      maxPrice, 
      category,
      size,
      color,
      minRating,
      sortBy = 'default',
      page = 1,
      limit: bodyLimit = 20,
    } = req.body;

    const limitRaw = parseInt(String(bodyLimit), 10);
    if (Number.isNaN(limitRaw) || limitRaw < 1) {
      return res.status(400).json({ success: false, error: 'Invalid limit' });
    }
    if (limitRaw > 100) {
      return res.status(400).json({ success: false, error: 'limit must not exceed 100' });
    }
    const limit = limitRaw;
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const offset = (pageNum - 1) * limit;

    // Sanitize inputs
    const sanitizedQuery = query ? sanitizeSearchQuery(query) : '';
    const sanitizedCategory = category ? sanitizeString(category) : null;
    const sanitizedSize = size ? sanitizeString(size) : null;
    const sanitizedColor = color ? sanitizeString(color) : null;
    const searchPattern = `%${sanitizedQuery}%`;
    
    // Validate numeric filters
    const priceMin = minPrice !== undefined && minPrice !== null ? Number(minPrice) : null;
    const priceMax = maxPrice !== undefined && maxPrice !== null ? Number(maxPrice) : null;
    const ratingMin = minRating !== undefined && minRating !== null ? Number(minRating) : null;

    // Validate sortBy option
    const validSortOptions = ['default', 'price_asc', 'price_desc', 'rating_desc', 'newest', 'oldest'];
    const sortOption = validSortOptions.includes(sortBy) ? sortBy : 'default';

    // Build dynamic query using SQL template literals
    // The postgres library handles parameterization automatically
    let products;

    // Determine sort order
    const getSortOrder = () => {
      switch (sortOption) {
        case 'price_asc': return sql`ORDER BY price ASC`;
        case 'price_desc': return sql`ORDER BY price DESC`;
        case 'rating_desc': return sql`ORDER BY rating DESC NULLS LAST`;
        case 'newest': return sql`ORDER BY created_at DESC`;
        case 'oldest': return sql`ORDER BY created_at ASC`;
        default: return sql`ORDER BY id ASC`;
      }
    };

    // Build WHERE conditions
    const hasSearchQuery = sanitizedQuery.trim().length > 0;
    const hasCategory = sanitizedCategory !== null;
    const hasSize = sanitizedSize !== null;
    const hasColor = sanitizedColor !== null;
    const hasPriceRange = priceMin !== null || priceMax !== null;
    const hasRating = ratingMin !== null;

    if (!hasSearchQuery && !hasCategory && !hasSize && !hasColor && !hasPriceRange && !hasRating) {
      products = await sql`
        SELECT * FROM products 
        ${getSortOrder()}
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else {
      products = await sql`
        SELECT * FROM products 
        WHERE 1=1
        ${hasSearchQuery ? sql`AND (name ILIKE ${searchPattern} OR description ILIKE ${searchPattern})` : sql``}
        ${hasCategory ? sql`AND category = ${sanitizedCategory}` : sql``}
        ${hasSize ? sql`AND size = ${sanitizedSize}` : sql``}
        ${hasColor ? sql`AND color = ${sanitizedColor}` : sql``}
        ${priceMin !== null ? sql`AND price >= ${priceMin}` : sql``}
        ${priceMax !== null ? sql`AND price <= ${priceMax}` : sql``}
        ${hasRating ? sql`AND rating >= ${ratingMin}` : sql``}
        ${getSortOrder()}
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    }

    res.json({
      success: true,
      data: products || [],
      count: products?.length || 0,
      pagination: {
        page: pageNum,
        limit,
        offset,
        hasMore: (products?.length || 0) === limit,
      },
      filters: {
        query: sanitizedQuery || null,
        category: sanitizedCategory,
        size: sanitizedSize,
        color: sanitizedColor,
        minPrice: priceMin,
        maxPrice: priceMax,
        minRating: ratingMin,
        sortBy: sortOption
      }
    });
  } catch (error: any) {
    logger.error('Error searching products:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search products',
    });
  }
});

export default router;

