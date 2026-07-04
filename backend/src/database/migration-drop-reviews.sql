-- Remove product reviews system (reviews + review_votes tables)
-- Run in Supabase SQL Editor after reviewing SUPABASE_SQL_TO_RUN.md

DROP TRIGGER IF EXISTS trigger_update_product_rating ON public.reviews;
DROP FUNCTION IF EXISTS public.update_product_rating();

DROP POLICY IF EXISTS "Anyone can view approved reviews" ON public.reviews;
DROP POLICY IF EXISTS "Service role can manage all reviews" ON public.reviews;
DROP POLICY IF EXISTS "Service role manages reviews" ON public.reviews;
DROP POLICY IF EXISTS "Service role can manage review votes" ON public.review_votes;
DROP POLICY IF EXISTS "Service role manages review_votes" ON public.review_votes;

DROP TABLE IF EXISTS public.review_votes;
DROP TABLE IF EXISTS public.reviews;
