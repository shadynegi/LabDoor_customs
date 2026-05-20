-- Migration: Add size and color columns to products table
-- Run this in your Supabase SQL Editor if the products table already exists

-- Add size column
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS size VARCHAR(50);

-- Add color column
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS color VARCHAR(100);

-- Create indexes for better filter performance
CREATE INDEX IF NOT EXISTS idx_products_size ON products(size);
CREATE INDEX IF NOT EXISTS idx_products_color ON products(color);

-- Update existing sample products with size and color data
UPDATE products SET size = 'US 9', color = 'Blue' WHERE name ILIKE '%blue%' AND size IS NULL;
UPDATE products SET size = 'US 10', color = 'Gold' WHERE name ILIKE '%gold%' AND size IS NULL;
UPDATE products SET size = 'US 8', color = 'Pink' WHERE name ILIKE '%pink%' AND size IS NULL;
UPDATE products SET size = 'US 11', color = 'Brown' WHERE name ILIKE '%brown%' AND color IS NULL AND name NOT ILIKE '%pink%';
UPDATE products SET size = 'US 9', color = 'Brown' WHERE name ILIKE '%sport%' AND size IS NULL;

-- Verify the changes
SELECT id, name, size, color FROM products ORDER BY id;
