-- Reviews System Migration
-- Run this in your Supabase SQL Editor

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  content TEXT,
  pros TEXT[], -- Array of positive points
  cons TEXT[], -- Array of negative points
  is_verified_purchase BOOLEAN DEFAULT FALSE,
  is_recommended BOOLEAN DEFAULT TRUE,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'flagged')),
  admin_response TEXT,
  admin_response_at TIMESTAMP WITH TIME ZONE,
  images TEXT[], -- Array of image URLs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Review helpful votes tracking (prevent duplicate votes)
CREATE TABLE IF NOT EXISTS review_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  voter_identifier VARCHAR(255) NOT NULL, -- Email or session ID
  vote_type VARCHAR(20) NOT NULL CHECK (vote_type IN ('helpful', 'not_helpful')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(review_id, voter_identifier)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_email ON reviews(customer_email);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_verified ON reviews(is_verified_purchase);
CREATE INDEX IF NOT EXISTS idx_review_votes_review_id ON review_votes(review_id);

-- Function to update product rating when reviews change (search_path fixed for Supabase linter 0011)
CREATE OR REPLACE FUNCTION public.update_product_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  avg_rating DECIMAL(3,2);
  total_reviews INTEGER;
BEGIN
  SELECT
    COALESCE(AVG(rating)::DECIMAL(3,2), 0),
    COUNT(*)
  INTO avg_rating, total_reviews
  FROM public.reviews
  WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
    AND status = 'approved';

  UPDATE public.products
  SET
    rating = avg_rating,
    review_count = total_reviews,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger to auto-update product rating
DROP TRIGGER IF EXISTS trigger_update_product_rating ON reviews;
CREATE TRIGGER trigger_update_product_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_product_rating();

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reviews (single service_role policy — API serves approved reviews)
DROP POLICY IF EXISTS "Anyone can view approved reviews" ON reviews;
DROP POLICY IF EXISTS "Service role can manage all reviews" ON reviews;
DROP POLICY IF EXISTS "Service role manages reviews" ON reviews;
CREATE POLICY "Service role manages reviews" ON reviews
  FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- RLS Policies for review_votes
DROP POLICY IF EXISTS "Service role can manage review votes" ON review_votes;
CREATE POLICY "Service role can manage review votes" ON review_votes
  FOR ALL USING ((select auth.role()) = 'service_role');

-- Comments
COMMENT ON TABLE reviews IS 'Customer reviews for products';
COMMENT ON TABLE review_votes IS 'Tracks helpful/not helpful votes on reviews';
COMMENT ON COLUMN reviews.is_verified_purchase IS 'True if reviewer has a completed order containing this product';
COMMENT ON COLUMN reviews.pros IS 'Array of positive aspects mentioned by reviewer';
COMMENT ON COLUMN reviews.cons IS 'Array of negative aspects mentioned by reviewer';
