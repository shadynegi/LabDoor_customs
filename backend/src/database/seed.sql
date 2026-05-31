-- Lab Door Customs — optional sample products (development / staging only)
-- Run AFTER schema.sql in Supabase SQL Editor.
-- DO NOT run in production unless you intend to load demo catalog data.

INSERT INTO products (name, price, image, description, background, category, size, color, stock, rating, review_count)
VALUES
  (
    'Nike Drops - Blue',
    98.00,
    '/assets/blue-nike.png',
    'Custom blue Nike-inspired drop with premium finish.',
    '/assets/blue-bg.png',
    'Sneakers',
    'US 10',
    'Blue',
    25,
    4.50,
    0
  ),
  (
    'Nike Drops - Gold Black',
    108.00,
    '/assets/gold-black-nike.png',
    'Gold and black custom sneaker with metallic accents.',
    '/assets/gold-bg.png',
    'Sneakers',
    'US 10',
    'Gold',
    20,
    4.70,
    0
  ),
  (
    'Nike Drops - Pink',
    95.00,
    '/assets/pink-nike.png',
    'Bold pink custom design for standout style.',
    '/assets/pink-bg.png',
    'Sneakers',
    'US 9',
    'Pink',
    30,
    4.60,
    0
  ),
  (
    'Nike Drops - Black Brown',
    102.00,
    '/assets/black-brown-nike.png',
    'Black and brown two-tone custom build.',
    '/assets/brown-bg.png',
    'Sneakers',
    'US 11',
    'Brown',
    18,
    4.40,
    0
  ),
  (
    'Nike Drops - Brown Pink',
    99.00,
    '/assets/brown-pink-nike.png',
    'Brown base with pink highlights — limited style.',
    '/assets/brown-pink-bg.png',
    'Sneakers',
    'US 10',
    'Pink',
    22,
    4.55,
    0
  )
;

INSERT INTO coupons (
  code,
  description,
  discount_type,
  discount_value,
  minimum_order,
  is_active,
  applies_to
)
VALUES (
  'LDCOFF10',
  '10% off your order when applied at checkout',
  'percentage',
  10,
  0,
  TRUE,
  'all'
)
ON CONFLICT (code) DO NOTHING;

-- Image paths match frontend/src/hooks/useProducts.ts imageMap keys.
